import { useCallback, useRef, useState } from "react";
import { apiClient } from "@/lib/api";
import type { AnalysisSyncStatus } from "@/lib/analysisSetupTypes";
import { clampPollDelay, isMissingEndpoint } from "@/lib/analysisSync";
import { useAdaptivePoll } from "@/hooks/use-adaptive-poll";

type Options = {
  enabled?: boolean;
  /** Minimum gap between booking-summary refreshes while sync-status is available; null = only on phase changes. */
  summaryEveryMs?: number | null;
  /** Summary cadence when the backend has no sync-status endpoint yet; null = no periodic refresh. */
  legacySummaryEveryMs?: number | null;
};

const IDLE_DELAY_MS = 60000;

/**
 * One poll loop per page: the lightweight sync-status every tick (honouring `poll_after_ms`),
 * the heavier booking summary only on the first tick, on sync phase changes, or when its gap elapsed.
 */
export function useAnalysisLiveState(bookingId: number, options: Options = {}) {
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [sync, setSync] = useState<AnalysisSyncStatus | null>(null);
  const [syncSupported, setSyncSupported] = useState<boolean | null>(null);
  const supportedRef = useRef<boolean | null>(null);
  const lastSummaryAt = useRef(0);
  const lastPhase = useRef<string | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const refreshSummary = useCallback(async () => {
    if (!Number.isFinite(bookingId)) return null;
    const res = await apiClient.getBookingAnalysis(bookingId);
    lastSummaryAt.current = Date.now();
    if (res.error) {
      setSummaryError(res.error);
      return null;
    }
    const data = (res.data || {}) as Record<string, unknown>;
    setSummary(data);
    setSummaryError(null);
    return data;
  }, [bookingId]);

  const pollNow = useAdaptivePoll(
    async () => {
      const { summaryEveryMs = null, legacySummaryEveryMs = null } = optionsRef.current;
      let syncDelay: number | null = null;
      let phaseChanged = false;
      if (supportedRef.current !== false) {
        const res = await apiClient.getBookingAnalysisSyncStatus(bookingId);
        if (isMissingEndpoint(res)) {
          supportedRef.current = false;
          setSyncSupported(false);
        } else if (!res.error && res.data) {
          supportedRef.current = true;
          setSyncSupported(true);
          setSync(res.data);
          phaseChanged = lastPhase.current !== null && lastPhase.current !== res.data.phase;
          lastPhase.current = res.data.phase;
          syncDelay = clampPollDelay(res.data.poll_after_ms);
        } else {
          syncDelay = 15000;
        }
      }
      const legacy = supportedRef.current === false;
      const gap = legacy ? legacySummaryEveryMs : summaryEveryMs;
      const due = gap != null && Date.now() - lastSummaryAt.current >= gap;
      if (lastSummaryAt.current === 0 || phaseChanged || due) await refreshSummary();
      if (legacy) return gap ?? IDLE_DELAY_MS;
      return Math.min(syncDelay ?? IDLE_DELAY_MS, gap ?? IDLE_DELAY_MS);
    },
    { enabled: (options.enabled ?? true) && Number.isFinite(bookingId) && bookingId > 0 },
  );

  return { summary, summaryError, sync, syncSupported, refreshSummary, pollNow };
}

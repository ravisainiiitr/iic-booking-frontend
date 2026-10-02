import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePeakWindow } from "@/hooks/use-peak-window";
import {
  isPeakBlockableUserType,
  peakNow,
  prefetchBookingPage,
  PEAK_EXTERNAL_PAUSED_EVENT,
  refreshPeakStatus,
} from "@/lib/peakWindow";
import type { PeakPausedPayload } from "@/lib/peakWindowEvents";
import ExternalNoticeBanner from "./ExternalNoticeBanner";
import ExternalPausedPage from "./ExternalPausedPage";

/** A 403 from the API without an end time keeps the paused page up for this long before re-checking. */
const FORCED_PAUSE_FALLBACK_MS = 2 * 60_000;

type ForcedPause = { message: string; until: number; endsAt: string | null };

/**
 * Peak booking window wrapper: shows external users the paused page / advance notice and
 * warms the booking chunk for internal users while a window is open.
 */
export default function PeakWindowGate({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, logout } = useAuth();
  const peak = usePeakWindow();
  const [forced, setForced] = useState<ForcedPause | null>(null);

  const blockable = isAuthenticated && isPeakBlockableUserType(user?.user_type ?? null);

  useEffect(() => {
    const onPaused = (e: Event) => {
      const detail = (e as CustomEvent<PeakPausedPayload>).detail ?? {};
      const endsAt = detail.peak_window?.ends_at ?? null;
      const endMs = endsAt ? Date.parse(endsAt) : NaN;
      setForced({
        message: detail.message || detail.detail || "",
        endsAt,
        until: Number.isFinite(endMs) ? endMs : peakNow() + FORCED_PAUSE_FALLBACK_MS,
      });
      void refreshPeakStatus();
    };
    window.addEventListener(PEAK_EXTERNAL_PAUSED_EVENT, onPaused);
    return () => window.removeEventListener(PEAK_EXTERNAL_PAUSED_EVENT, onPaused);
  }, []);

  useEffect(() => {
    if (!forced) return;
    const wait = Math.max(0, forced.until - peakNow()) + 250;
    const t = window.setTimeout(() => setForced(null), wait);
    return () => window.clearTimeout(t);
  }, [forced]);

  useEffect(() => {
    if (peak.active && isAuthenticated && !blockable) prefetchBookingPage();
  }, [peak.active, isAuthenticated, blockable]);

  const checkAgain = useCallback(async () => {
    setForced(null);
    await refreshPeakStatus();
  }, []);

  if (blockable && (peak.externalPaused || forced)) {
    return (
      <ExternalPausedPage
        message={peak.externalPaused ? peak.message : forced?.message || peak.message}
        endsAt={peak.externalPaused ? peak.window?.ends_at ?? null : forced?.endsAt ?? null}
        onLogout={logout}
        onCheckAgain={checkAgain}
      />
    );
  }

  return (
    <>
      {blockable && peak.externalNotice ? (
        <ExternalNoticeBanner startsAt={peak.window?.starts_at ?? null} endsAt={peak.window?.ends_at ?? null} />
      ) : null}
      {children}
    </>
  );
}

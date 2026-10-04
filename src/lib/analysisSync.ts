import type { AnalysisSyncPhase, AnalysisSyncStatus, AnalysisViewport } from "@/lib/analysisSetupTypes";

/** New Remote Analysis endpoints answer 404/405 until the backend that serves them is deployed. */
export function isMissingEndpoint(res: { error?: string; status?: number }): boolean {
  return Boolean(res.error) && (res.status === 404 || res.status === 405 || res.status === 501);
}

export function formatBytes(n?: number | null): string {
  const v = Math.max(0, Number(n || 0));
  if (v < 1024) return `${v} B`;
  if (v < 1024 ** 2) return `${(v / 1024).toFixed(1)} KB`;
  if (v < 1024 ** 3) return `${Math.round(v / 1024 ** 2)} MB`;
  return `${(v / 1024 ** 3).toFixed(1)} GB`;
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

const TRANSFER_PHASES: ReadonlySet<AnalysisSyncPhase> = new Set([
  "staging_input",
  "collecting",
  "copying_to_workspace",
  "verifying",
  "cleaning_pc",
]);

export function isTransferPhase(phase?: AnalysisSyncPhase | null): boolean {
  return Boolean(phase && TRANSFER_PHASES.has(phase));
}

export function clampPollDelay(ms: number | null | undefined, fallback = 10000): number {
  const v = Number(ms);
  if (!Number.isFinite(v) || v <= 0) return fallback;
  return Math.min(60000, Math.max(1000, Math.round(v)));
}

export type SyncTone = "progress" | "done" | "failed" | "idle";

export interface SyncDescription {
  tone: SyncTone;
  headline: string;
  detail: string | null;
  percent: number | null;
}

/** Storage/SDK exception text that should never be shown to users verbatim. */
const RAW_ERROR_RE = /An error occurred \(|Traceback|botocore|Exception|GetObject|PutObject/i;

/**
 * User-facing wording for a sync-status payload. `targetLabel` names the folder results land in
 * ("Processed Data" for My Research, "Analyzed Data" for Booking Details).
 */
export function describeSync(status: AnalysisSyncStatus | null, targetLabel = "Processed Data"): SyncDescription {
  if (!status) return { tone: "idle", headline: "", detail: null, percent: null };
  const filesDone = Math.max(0, Number(status.files_done || 0));
  const filesTotal = status.files_total == null ? null : Math.max(0, Number(status.files_total));
  const percent =
    typeof status.percent === "number" && Number.isFinite(status.percent)
      ? Math.max(0, Math.min(100, Math.round(status.percent)))
      : null;

  if (status.phase === "failed") {
    const kept = status.kept_files?.length || 0;
    const message = status.message && !RAW_ERROR_RE.test(status.message) ? status.message : null;
    return {
      tone: "failed",
      headline: kept
        ? `${plural(kept, "file")} couldn't be verified`
        : message || `Copying results to ${targetLabel} didn't finish`,
      detail: kept
        ? `${kept === 1 ? "It's" : "They're"} still on the Analysis PC and will be retried automatically.`
        : status.pc_cleanup === "done"
          ? "Your files reached the portal safely and will be copied again automatically. You can also click Retry now."
          : "Anything already copied is safe. Nothing was removed from the Analysis PC.",
      percent,
    };
  }

  if (status.phase === "done") {
    const saved = filesDone || filesTotal || 0;
    if (saved === 0) {
      return {
        tone: "done",
        headline: "No result files were found in the Output folder",
        detail: "Only files saved in the Output folder on the Analysis PC are copied.",
        percent: 100,
      };
    }
    const cleanup =
      status.pc_cleanup === "done"
        ? "Removed from the Analysis PC"
        : status.pc_cleanup === "kept"
          ? `${plural(status.kept_files?.length || 0, "file")} kept on the Analysis PC`
          : status.pc_cleanup === "pending"
            ? "Removing from the Analysis PC…"
            : null;
    return {
      tone: "done",
      headline: `${plural(saved, "file")} saved to ${targetLabel}`,
      detail: cleanup,
      percent: 100,
    };
  }

  if (isTransferPhase(status.phase)) {
    const inbound = status.direction === "input";
    const base =
      status.message ||
      (inbound
        ? "Copying your input data to the Analysis PC"
        : status.phase === "verifying"
          ? "Verifying copied results"
          : status.phase === "cleaning_pc"
            ? "Removing verified files from the Analysis PC"
            : "Copying results to My Research");
    if (percent == null) {
      return {
        tone: "progress",
        headline: base,
        detail: `${plural(filesDone, "file")} received`,
        percent: null,
      };
    }
    const parts: string[] = [];
    if (status.bytes_total) parts.push(`${formatBytes(status.bytes_done)} of ${formatBytes(status.bytes_total)}`);
    if (filesTotal) parts.push(`${filesDone} of ${plural(filesTotal, "file")}`);
    return {
      tone: "progress",
      headline: `${base} — ${percent}%`,
      detail: parts.length ? parts.join(" · ") : null,
      percent,
    };
  }

  return { tone: "idle", headline: status.message || "", detail: null, percent };
}

/** Best-effort status for backends without sync-status, derived from the booking analysis summary. */
export function legacySyncFromSummary(summary: Record<string, unknown> | null): AnalysisSyncStatus | null {
  if (!summary) return null;
  const exp = (summary.experience || {}) as Record<string, unknown>;
  const ws = (exp.workspace || {}) as Record<string, unknown>;
  const results = (exp.results || {}) as Record<string, unknown>;
  const cleanup = (exp.cleanup || {}) as Record<string, unknown>;
  const rawPhase = String(ws.sync_phase || "").toLowerCase();
  const files = Number(results.file_count || 0);
  const failed = rawPhase === "failed" || rawPhase === "error";
  const done = !failed && (cleanup.status === "done" || ["completed", "cleaned", "archived"].includes(rawPhase));
  return {
    phase: failed ? "failed" : done ? "done" : "collecting",
    direction: "output",
    percent: null,
    bytes_done: Number(results.total_size_bytes || 0) || null,
    bytes_total: null,
    files_done: files,
    files_total: null,
    current_file: null,
    message: failed ? String(ws.sync_message || "") || null : "Collecting results from the Analysis PC",
    verified: false,
    pc_cleanup: "not_supported",
    kept_files: [],
    destination: null,
    updated_at: null,
    poll_after_ms: 5000,
  };
}

/** Usable remote-desktop area in CSS pixels; the backend sizes the RDP desktop to it (dpr is informational). */
export function measureViewport(surface?: HTMLElement | null, reservedTopPx = 64): AnalysisViewport {
  const rect = surface?.getBoundingClientRect();
  const width = rect && rect.width > 0 ? rect.width : window.innerWidth;
  const height = rect && rect.height > 0 ? rect.height : window.innerHeight - reservedTopPx;
  const dpr = Number(window.devicePixelRatio) || 1;
  return {
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
    dpr: Math.round(dpr * 100) / 100,
  };
}

export function myResearchFolderHref(workspaceId?: string | null, folderId?: string | null): string | null {
  if (!workspaceId) return null;
  const qs = new URLSearchParams({ tab: "files" });
  if (folderId) qs.set("folder", folderId);
  return `/my-research/${workspaceId}?${qs.toString()}`;
}

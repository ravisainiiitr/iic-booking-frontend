/** Shared types for interactive secure downloads (installers, future firmware/docs). */

export type DownloadPhase =
  | "idle"
  | "preparing"
  | "transferring"
  | "starting"
  | "success"
  | "error";

export type DownloadStepId =
  | "validate"
  | "metadata"
  | "checksum"
  | "prepare"
  | "transfer"
  | "browser";

export type DownloadStepState = "pending" | "active" | "done" | "error";

export type DownloadStep = {
  id: DownloadStepId;
  label: string;
  state: DownloadStepState;
};

export type DownloadableReleaseMeta = {
  id?: string;
  version?: string;
  channel?: string;
  release_date?: string | null;
  download_size_bytes?: number;
  sha256?: string;
  signature_status?: string;
  signature_status_display?: string;
  supported_windows?: string;
  original_name?: string;
  offline_original_name?: string;
  has_file?: boolean;
  has_offline_file?: boolean;
};

export type SecureDownloadKind = "online" | "offline";

export type SecureDownloadRequest = {
  /** Stable product key for history / analytics hooks later */
  productKey: string;
  productLabel: string;
  kind: SecureDownloadKind;
  meta: DownloadableReleaseMeta;
  /**
   * Preferred: issue a short-lived ticket and let the browser download natively
   * (fast for large installers — no SPA RAM buffering).
   */
  startNativeDownload?: (opts: {
    signal?: AbortSignal;
  }) => Promise<{
    url: string;
    filename: string;
    sha256?: string;
    sizeBytes?: number;
    version?: string;
  }>;
  /** Fallback: authenticated fetch that buffers the file in memory (slow for 100MB+). */
  fetchArtifact?: (opts: {
    onProgress?: (loaded: number, total: number | null) => void;
    signal?: AbortSignal;
  }) => Promise<{
    blob: Blob;
    filename: string;
    sha256?: string;
    sizeBytes?: number;
  }>;
};

export type DownloadHistoryEntry = {
  id: string;
  productKey: string;
  productLabel: string;
  version: string;
  filename: string;
  sizeBytes: number;
  sha256: string;
  kind: SecureDownloadKind;
  downloadedAt: string;
  downloadedBy?: string;
};

export function formatBytes(n?: number | null): string {
  const v = Number(n || 0);
  if (!v) return "—";
  if (v < 1024) return `${v} B`;
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`;
  if (v < 1024 * 1024 * 1024) return `${(v / (1024 * 1024)).toFixed(1)} MB`;
  return `${(v / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Rough ETA — default assumes ~500 KB/s campus WAN (not LAN). */
export function estimateDownloadSeconds(sizeBytes?: number | null, bytesPerSec = 500_000): number | null {
  const v = Number(sizeBytes || 0);
  if (!v || bytesPerSec <= 0) return null;
  return Math.max(1, Math.ceil(v / bytesPerSec));
}

export function formatEta(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `~${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  // Show a realistic range for campus networks (0.5×–2× of midpoint estimate)
  const lo = Math.max(1, Math.floor(m * 0.7));
  const hi = Math.max(lo + 1, Math.ceil(m * 1.8));
  if (m < 2) return s ? `~${m}m ${s}s` : `~${m}m`;
  return `~${lo}–${hi} min`;
}

export const DEFAULT_DOWNLOAD_STEPS: Omit<DownloadStep, "state">[] = [
  { id: "validate", label: "Validating installer" },
  { id: "metadata", label: "Reading metadata" },
  { id: "checksum", label: "Verifying checksum" },
  { id: "prepare", label: "Preparing secure download" },
  { id: "transfer", label: "Authorizing download" },
  { id: "browser", label: "Starting browser download" },
];

import { Check, Circle, Download, Loader2, RefreshCw, ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  estimateDownloadSeconds,
  formatBytes,
  formatEta,
  type DownloadHistoryEntry,
  type DownloadPhase,
  type DownloadStep,
  type DownloadableReleaseMeta,
} from "./types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phase: DownloadPhase;
  steps: DownloadStep[];
  progress: number;
  bytesLoaded: number;
  bytesTotal: number | null;
  meta: DownloadableReleaseMeta | null;
  productLabel: string;
  filename?: string;
  sha256?: string;
  sizeBytes?: number;
  error?: string | null;
  errorDetail?: string | null;
  history?: DownloadHistoryEntry[];
  onRetry?: () => void;
  onDownloadAgain?: () => void;
  onContactAdmin?: () => void;
};

function StepIcon({ state }: { state: DownloadStep["state"] }) {
  if (state === "done") {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
    );
  }
  if (state === "active") {
    return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
  }
  if (state === "error") {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive/15 text-destructive">
        <X className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
    );
  }
  return <Circle className="h-5 w-5 text-muted-foreground/40" />;
}

export function SecureDownloadDialog({
  open,
  onOpenChange,
  phase,
  steps,
  progress,
  bytesLoaded,
  bytesTotal,
  meta,
  productLabel,
  filename,
  sha256,
  sizeBytes,
  error,
  errorDetail,
  history = [],
  onRetry,
  onDownloadAgain,
  onContactAdmin,
}: Props) {
  const displaySize = sizeBytes || bytesTotal || meta?.download_size_bytes || 0;
  const eta = estimateDownloadSeconds(displaySize);
  const title =
    phase === "success"
      ? "Download Started Successfully"
      : phase === "error"
        ? "Unable to prepare installer"
        : phase === "transferring"
          ? "Preparing Download"
          : "Preparing Installer…";

  const subtitle =
    phase === "success"
      ? "Your browser should now display the download progress."
      : phase === "error"
        ? "We could not start this download. You can retry or contact an administrator."
        : "Please wait while we prepare your download.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            {phase === "success" ? (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 animate-in zoom-in-50 duration-300">
                <Check className="h-5 w-5" strokeWidth={2.5} />
              </span>
            ) : phase === "error" ? (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive/15 text-destructive">
                <ShieldAlert className="h-5 w-5" />
              </span>
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Download className="h-5 w-5" />
              </span>
            )}
            {title}
          </DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>

        {/* Package stats */}
        <div className="grid grid-cols-2 gap-2 rounded-xl border bg-muted/30 p-3 text-sm">
          <Stat label="Product" value={productLabel} />
          <Stat label="Version" value={meta?.version || "—"} />
          <Stat label="Size" value={formatBytes(displaySize)} />
          <Stat
            label="Est. time"
            value={formatEta(eta)}
          />
          <Stat label="Released" value={meta?.release_date || "—"} />
          <Stat
            label="Signature"
            value={meta?.signature_status_display || meta?.signature_status || "—"}
          />
          <div className="col-span-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">SHA256</p>
            <p className="mt-0.5 break-all font-mono text-[11px] leading-snug">
              {sha256 || meta?.sha256 || "—"}
            </p>
          </div>
          {meta?.supported_windows ? (
            <div className="col-span-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Supported Windows
              </p>
              <p className="mt-0.5 text-sm font-medium">{meta.supported_windows}</p>
            </div>
          ) : null}
        </div>

        {phase !== "success" && phase !== "error" ? (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  {phase === "transferring" || phase === "starting"
                    ? "Starting download"
                    : "Preparing Download"}
                </span>
                <span className="tabular-nums text-muted-foreground">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2.5" />
              {bytesTotal && phase === "transferring" && bytesLoaded > 0 && bytesLoaded < bytesTotal * 0.98 ? (
                <p className="text-xs text-muted-foreground tabular-nums">
                  {formatBytes(bytesLoaded)} of {formatBytes(bytesTotal)}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Download starts from secure cloud storage — your browser handles the transfer
                  directly (typically much faster than proxying through the portal).
                </p>
              )}
            </div>

            <ol className="space-y-2.5">
              {steps.map((step) => (
                <li key={step.id} className="flex items-center gap-3 text-sm">
                  <StepIcon state={step.state} />
                  <span
                    className={cn(
                      step.state === "done" && "text-foreground",
                      step.state === "active" && "font-medium text-primary",
                      step.state === "pending" && "text-muted-foreground",
                      step.state === "error" && "text-destructive",
                    )}
                  >
                    {step.label}
                    {step.state === "active" ? "…" : ""}
                  </span>
                </li>
              ))}
            </ol>
          </>
        ) : null}

        {phase === "success" ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30">
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
              ✓ Download Started
            </p>
            <p className="mt-1 font-medium">{filename || "installer.exe"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Version {meta?.version || "—"} · {formatBytes(displaySize)}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Your browser is downloading directly from cloud storage (AWS). Progress appears in
              the browser download bar. On campus Wi‑Fi, large installers (~130–170 MB) can take
              several minutes — prefer a wired connection and avoid running multiple downloads at
              once. If nothing appears, use Download Again below.
            </p>
          </div>
        ) : null}

        {phase === "error" ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <p className="font-semibold text-destructive">{error || "Download failed"}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Server temporarily unavailable</li>
              <li>Installer missing or not published</li>
              <li>Network interruption</li>
            </ul>
            {errorDetail ? (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-medium">View Details</summary>
                <pre className="mt-2 whitespace-pre-wrap break-all rounded-md bg-muted p-2 font-mono text-[11px]">
                  {errorDetail}
                </pre>
              </details>
            ) : null}
          </div>
        ) : null}

        {history.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Recent downloads (this browser)
            </p>
            <ul className="max-h-28 space-y-1.5 overflow-y-auto text-xs">
              {history.slice(0, 5).map((h) => (
                <li
                  key={h.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5"
                >
                  <span className="font-medium">{h.version}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {h.kind}
                  </Badge>
                  <span className="text-muted-foreground">
                    {new Date(h.downloadedAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          {phase === "error" ? (
            <>
              <Button variant="outline" onClick={onContactAdmin}>
                Contact Administrator
              </Button>
              <Button onClick={onRetry}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </>
          ) : null}
          {phase === "success" ? (
            <Button onClick={onDownloadAgain}>
              <Download className="mr-2 h-4 w-4" />
              Download Again
            </Button>
          ) : null}
          {(phase === "preparing" || phase === "transferring" || phase === "starting") && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}
          {(phase === "success" || phase === "error" || phase === "idle") && (
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
  );
}

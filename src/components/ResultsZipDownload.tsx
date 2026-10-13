import { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { Progress } from "@/components/ui/progress";
import { formatBytes, type ResultsDownloadProgress } from "@/lib/resultsDownload";

type ZipDownloadResult = Awaited<ReturnType<typeof apiClient.downloadBookingResultsZip>>;

/** Download a booking's results ZIP with real progress; ``progress`` is null when idle. */
export function useResultsZipDownload(onError?: (result: ZipDownloadResult) => void) {
  const [progress, setProgress] = useState<ResultsDownloadProgress | null>(null);

  const start = useCallback(
    async (bookingId: number): Promise<ZipDownloadResult> => {
      setProgress({ phase: "preparing", receivedBytes: 0, totalBytes: 0, percent: null });
      const result = await apiClient.downloadBookingResultsZip(bookingId, setProgress);
      if (result.error) {
        toast.error(result.error);
        onError?.(result);
        setProgress(null);
      } else if (result.mode === "saved") {
        toast.success("Results ZIP saved.");
        window.setTimeout(() => setProgress(null), 1500);
      } else {
        if (result.mode === "browser") {
          toast.success("Download started. Follow its progress in your browser's downloads.");
        }
        setProgress(null);
      }
      return result;
    },
    [onError],
  );

  return { progress, busy: progress !== null, start };
}

export function zipButtonLabel(progress: ResultsDownloadProgress | null): string {
  if (!progress) return "Download folder (ZIP)";
  if (progress.phase === "preparing") return "Preparing download...";
  if (progress.phase === "done") return "Saved";
  return progress.percent == null ? "Saving ZIP..." : `Saving ZIP... ${progress.percent}%`;
}

export function ResultsZipProgress({ progress }: { progress: ResultsDownloadProgress | null }) {
  if (!progress) return null;
  if (progress.phase === "preparing") {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Collecting the result files...
      </p>
    );
  }
  const done = progress.phase === "done";
  const amount = progress.totalBytes
    ? `${formatBytes(progress.receivedBytes)} of ${formatBytes(progress.totalBytes)}`
    : formatBytes(progress.receivedBytes);
  return (
    <div className="space-y-2" role="status" aria-live="polite">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{done ? `Saved ${formatBytes(progress.receivedBytes)}` : `Saving ZIP: ${amount}`}</span>
        {progress.percent != null ? <span>{progress.percent}%</span> : null}
      </div>
      <Progress value={progress.percent ?? 0} className="h-2" />
      {!done ? <p className="text-xs text-muted-foreground">Keep this page open until saving finishes.</p> : null}
    </div>
  );
}

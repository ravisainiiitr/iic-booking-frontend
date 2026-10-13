import { Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { formatBytes } from "@/lib/resultsDownload";
import { formatDuration, type UploadProgress } from "@/lib/uploadWithProgress";

/** Upload progress for result files sent with "Complete booking". */
export function CompleteUploadProgress({ progress }: { progress: UploadProgress }) {
  if (progress.phase === "processing") {
    return (
      <div className="mt-3 space-y-2" role="status" aria-live="polite">
        <Progress value={100} className="h-2" />
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Upload finished ({formatBytes(progress.totalBytes)}). Saving the files and completing the booking...
        </p>
      </div>
    );
  }
  const rate = progress.bytesPerSecond ? `${formatBytes(Math.round(progress.bytesPerSecond))}/s` : null;
  const left = progress.secondsLeft != null ? `about ${formatDuration(progress.secondsLeft)} left` : null;
  return (
    <div className="mt-3 space-y-2" role="status" aria-live="polite">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="tabular-nums">
          Uploading {formatBytes(progress.sentBytes)} of {formatBytes(progress.totalBytes)}
        </span>
        <span className="tabular-nums">{progress.percent}%</span>
      </div>
      <Progress value={progress.percent} className="h-2" />
      <p className="text-xs text-muted-foreground">
        {[rate, left].filter(Boolean).join(" · ")}
        {rate || left ? ". " : ""}
        Keep this page open. The booking is marked completed only after the upload finishes.
      </p>
    </div>
  );
}

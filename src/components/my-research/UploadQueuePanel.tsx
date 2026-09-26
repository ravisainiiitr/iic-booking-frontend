import { CheckCircle2, Loader2, RotateCcw, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatBytes } from "./researchUtils";
import type { QueuedUpload } from "./useResearchUploads";

const STAGE_LABEL: Record<QueuedUpload["status"], string> = {
  queued: "Waiting…",
  preparing: "Preparing…",
  uploading: "Uploading",
  verifying: "Verifying…",
  done: "Uploaded",
  failed: "Failed",
  cancelled: "Cancelled",
};

interface Props {
  items: QueuedUpload[];
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onClear: () => void;
}

export function UploadQueuePanel({ items, onCancel, onRetry, onClear }: Props) {
  if (items.length === 0) return null;
  const count = (status: QueuedUpload["status"]) => items.filter((i) => i.status === status).length;
  const uploaded = count("done");
  const failed = count("failed");
  const cancelled = count("cancelled");
  const finished = uploaded + failed + cancelled;
  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <p className="text-sm font-semibold">
          Uploads · {uploaded}/{items.length} uploaded
          {failed > 0 ? <span className="text-destructive"> · {failed} failed</span> : null}
          {cancelled > 0 ? <span className="font-normal text-muted-foreground"> · {cancelled} cancelled</span> : null}
        </p>
        {finished > 0 ? (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onClear}>
            Clear finished
          </Button>
        ) : null}
      </div>
      <ul className="max-h-60 divide-y overflow-y-auto">
        {items.map((item) => {
          const pct = item.file.size > 0 ? Math.round((item.loaded / item.file.size) * 100) : item.status === "done" ? 100 : 0;
          const active = !["done", "failed", "cancelled"].includes(item.status);
          return (
            <li key={item.id} className="space-y-1 px-3 py-2">
              <div className="flex items-center gap-2">
                {item.status === "done" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                ) : item.status === "failed" ? (
                  <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                ) : active ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-violet-600" />
                ) : (
                  <X className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0 flex-1 truncate text-sm">{item.file.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {item.status === "uploading" ? `${pct}% of ${formatBytes(item.file.size)}` : STAGE_LABEL[item.status]}
                </span>
                {active ? (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onCancel(item.id)} title="Cancel upload">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                ) : item.status === "failed" || item.status === "cancelled" ? (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onRetry(item.id)} title="Retry">
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </div>
              {item.status === "uploading" || item.status === "verifying" ? <Progress value={pct} className="h-1.5" /> : null}
              {item.error ? <p className="text-xs text-destructive">{item.error}</p> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Check, Loader2 } from "lucide-react";

export type SyncStage = {
  id: string;
  label: string;
  status: "pending" | "active" | "done" | string;
  progress_percent?: number;
  file_count?: number;
  total_size_bytes?: number;
  logical_folder?: string;
};

function formatBytes(n?: number) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function DataSyncPipeline({ stages }: { stages: SyncStage[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Data synchronization</CardTitle>
        <CardDescription>
          Portal → Analysis Workspace → Analysis Environment → Results → Download
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {stages.map((s) => {
          const done = s.status === "done";
          const active = s.status === "active";
          return (
            <div
              key={s.id}
              className={cn(
                "rounded-lg border px-3 py-2.5",
                active && "border-sky-500/40 bg-sky-500/5",
                done && "border-emerald-500/30 bg-emerald-500/5"
              )}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {done ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : active ? (
                    <Loader2 className="h-4 w-4 animate-spin text-sky-600" />
                  ) : (
                    <span className="block h-4 w-4 rounded-full border border-muted-foreground/40" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{s.label}</p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    {s.logical_folder ? <span>{s.logical_folder}</span> : null}
                    {typeof s.file_count === "number" ? <span>{s.file_count} files</span> : null}
                    {typeof s.total_size_bytes === "number" && s.total_size_bytes > 0 ? (
                      <span>{formatBytes(s.total_size_bytes)}</span>
                    ) : null}
                  </div>
                  {active && typeof s.progress_percent === "number" ? (
                    <Progress value={s.progress_percent} className="mt-2 h-1.5" />
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

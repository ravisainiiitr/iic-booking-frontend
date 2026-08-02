import { cn } from "@/lib/utils";
import { Check, Circle, Loader2 } from "lucide-react";

export type StageStatus = "pending" | "active" | "done" | "skipped";

export type JourneyStage = {
  id: string;
  label: string;
  status: StageStatus;
  timestamp?: string | null;
  detail?: string;
};

function formatTs(ts?: string | null) {
  if (!ts) return null;
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

export function AnalysisJourneyTimeline({ stages }: { stages: JourneyStage[] }) {
  return (
    <ol className="space-y-0">
      {stages.map((stage, idx) => {
        const done = stage.status === "done";
        const active = stage.status === "active";
        const last = idx === stages.length - 1;
        return (
          <li key={stage.id} className="relative flex gap-4 pb-6 last:pb-0">
            {!last && (
              <span
                className={cn(
                  "absolute left-[15px] top-8 h-[calc(100%-1.25rem)] w-px",
                  done ? "bg-emerald-500/50" : "bg-border"
                )}
                aria-hidden
              />
            )}
            <div
              className={cn(
                "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                done && "border-emerald-500 bg-emerald-500 text-white",
                active && "border-sky-500 bg-sky-500/15 text-sky-600 dark:text-sky-400",
                !done && !active && "border-muted-foreground/30 bg-background text-muted-foreground"
              )}
            >
              {done ? (
                <Check className="h-4 w-4" />
              ) : active ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Circle className="h-3 w-3" />
              )}
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p
                  className={cn(
                    "font-medium leading-tight",
                    active && "text-sky-700 dark:text-sky-300",
                    !done && !active && "text-muted-foreground"
                  )}
                >
                  {stage.label}
                </p>
                {formatTs(stage.timestamp) ? (
                  <span className="text-xs text-muted-foreground">{formatTs(stage.timestamp)}</span>
                ) : null}
              </div>
              {stage.detail ? (
                <p className="mt-0.5 text-sm text-muted-foreground">{stage.detail}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

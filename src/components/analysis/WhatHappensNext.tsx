import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Eraser,
  FileOutput,
  Loader2,
  PlayCircle,
  RefreshCw,
  Sparkles,
} from "lucide-react";

export type NextStepStatus = "pending" | "active" | "done";

export type NextStep = {
  id: string;
  label: string;
  status: NextStepStatus;
  timestamp?: string | null;
  detail?: string;
};

const DEFAULT_STEPS: NextStep[] = [
  { id: "prepare", label: "Preparing Workspace", status: "pending" },
  { id: "sync", label: "Synchronizing Data", status: "pending" },
  { id: "launch", label: "Launching Analysis Environment", status: "pending" },
  { id: "analyze", label: "Analysis in Progress", status: "pending" },
  { id: "results_sync", label: "Results Synchronization", status: "pending" },
  { id: "cleanup", label: "Workspace Cleanup", status: "pending" },
  { id: "available", label: "Results Available", status: "pending" },
];

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  prepare: Loader2,
  sync: RefreshCw,
  launch: PlayCircle,
  analyze: Sparkles,
  results_sync: FileOutput,
  cleanup: Eraser,
  available: CheckCircle2,
};

function formatTs(ts?: string | null) {
  if (!ts) return null;
  try {
    return new Date(ts).toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

export function WhatHappensNext({
  steps,
  className,
}: {
  steps?: NextStep[] | null;
  className?: string;
}) {
  const list = steps?.length ? steps : DEFAULT_STEPS;

  return (
    <Card className={cn("overflow-hidden border-slate-200/80 shadow-sm dark:border-border", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">What happens next</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="flex flex-col gap-0 md:flex-row md:flex-wrap md:items-start md:justify-between md:gap-y-4">
          {list.map((step, idx) => {
            const Icon = ICONS[step.id] || Sparkles;
            const done = step.status === "done";
            const active = step.status === "active";
            return (
              <li key={step.id} className="relative flex flex-1 items-start gap-3 md:min-w-[9rem] md:flex-col md:items-center md:px-1">
                {idx < list.length - 1 ? (
                  <span
                    className={cn(
                      "absolute left-[15px] top-8 hidden h-[calc(100%-1.5rem)] w-px md:left-auto md:right-[-50%] md:top-4 md:block md:h-px md:w-[calc(100%-2rem)] md:translate-x-1/2",
                      done ? "bg-emerald-400" : "bg-slate-200 dark:bg-border"
                    )}
                    aria-hidden
                  />
                ) : null}
                <div
                  className={cn(
                    "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border shadow-sm",
                    done && "border-emerald-500 bg-emerald-500 text-white",
                    active && "border-primary bg-primary text-primary-foreground ring-4 ring-primary/15",
                    !done && !active && "border-slate-200 bg-white text-slate-400 dark:border-border dark:bg-card"
                  )}
                >
                  {done ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : active ? (
                    <Icon className={cn("h-4 w-4", step.id === "prepare" || step.id === "sync" ? "animate-spin" : "")} />
                  ) : (
                    <Icon className="h-3.5 w-3.5" />
                  )}
                </div>
                <div className="min-w-0 flex-1 pb-4 md:pb-0 md:text-center">
                  <p
                    className={cn(
                      "text-sm font-semibold leading-snug",
                      active && "text-primary",
                      !done && !active && "text-muted-foreground"
                    )}
                  >
                    {active ? "Current · " : done ? "✓ " : ""}
                    {step.label}
                  </p>
                  {formatTs(step.timestamp) ? (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{formatTs(step.timestamp)}</p>
                  ) : null}
                  {step.detail ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">{step.detail}</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>

        <ul className="space-y-1.5 rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-sm text-muted-foreground dark:border-border dark:bg-muted/30">
          <li className="flex gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            Verify input data before starting. Additional files sync before the Analysis Environment opens.
          </li>
          <li className="flex gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            Click End Analysis when finished so the next user can start promptly.
          </li>
          <li className="flex gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            You will receive an email notification when results are ready to download from Booking Details.
          </li>
        </ul>
      </CardContent>
    </Card>
  );
}

/** Map journey / session flags into WhatHappensNext step statuses. */
export function buildWhatHappensSteps(opts: {
  queued?: boolean;
  preparing?: boolean;
  started?: boolean;
  results?: boolean;
  cleanupDone?: boolean;
  journey?: Array<{ id: string; status?: string; timestamp?: string | null; detail?: string }>;
}): NextStep[] {
  const { queued, preparing, started, results, cleanupDone, journey } = opts;
  const byId = Object.fromEntries((journey || []).map((j) => [j.id, j]));

  let activeId = "prepare";
  if (results || cleanupDone) activeId = cleanupDone ? "available" : "cleanup";
  else if (started) activeId = "analyze";
  else if (queued) activeId = "prepare";
  else if (preparing) activeId = "sync";
  else activeId = "prepare";

  const order = DEFAULT_STEPS.map((s) => s.id);
  const activeIdx = order.indexOf(activeId);

  return DEFAULT_STEPS.map((step, idx) => {
    const j = byId[step.id];
    let status: NextStepStatus = "pending";
    if (idx < activeIdx) status = "done";
    else if (idx === activeIdx) status = "active";
    if (results && step.id === "available") status = "done";
    if (started && ["prepare", "sync", "launch"].includes(step.id)) status = "done";
    if (results && ["analyze", "results_sync"].includes(step.id)) status = "done";
    return {
      ...step,
      status,
      timestamp: j?.timestamp,
      detail: j?.detail,
    };
  });
}

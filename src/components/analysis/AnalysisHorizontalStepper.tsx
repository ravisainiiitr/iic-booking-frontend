import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export type StepperStep = {
  id: string;
  label: string;
  status: "pending" | "active" | "done" | string;
};

/** Compact 5-step horizontal journey (design §1.3). */
export function AnalysisHorizontalStepper({ steps }: { steps: StepperStep[] }) {
  return (
    <nav aria-label="Analysis progress" className="w-full overflow-x-auto">
      <ol className="flex w-full min-w-0 items-center justify-between gap-1 px-1 py-2 sm:min-w-[640px]">
        {steps.map((step, idx) => {
          const done = step.status === "done";
          const active = step.status === "active";
          const last = idx === steps.length - 1;
          return (
            <li key={step.id} className="flex flex-1 items-center">
              <div className="flex min-w-0 flex-col items-center gap-2 text-center">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold shadow-sm xl:h-10 xl:w-10",
                    done && "border-emerald-500 bg-emerald-500 text-white",
                    active && "border-primary bg-primary text-primary-foreground ring-4 ring-primary/20",
                    !done && !active && "border-muted-foreground/25 bg-background text-muted-foreground"
                  )}
                >
                  {done ? <Check className="h-4 w-4" /> : idx + 1}
                </div>
                <span
                  className={cn(
                    "max-w-[9rem] text-[11px] font-medium leading-tight sm:text-xs xl:max-w-none",
                    active && "text-primary",
                    done && "text-emerald-700 dark:text-emerald-400",
                    !done && !active && "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </div>
              {!last && (
                <div
                  className={cn(
                    "mx-1 mb-6 h-0.5 flex-1 rounded",
                    done ? "bg-emerald-400" : "bg-border"
                  )}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Map rich journey → 5 design steps. */
export function toHorizontalSteps(
  journey: Array<{ id: string; status: string }> | undefined,
  opts?: { queued?: boolean; results?: boolean; started?: boolean; ready?: boolean }
): StepperStep[] {
  const byId = Object.fromEntries((journey || []).map((j) => [j.id, j.status]));
  const done = (id: string) => byId[id] === "done";
  const active = (id: string) => byId[id] === "active";

  const bookingDone = done("booking") || true;
  const queued =
    opts?.queued || active("waiting") || (done("waiting") === false && !opts?.ready);
  const envReady =
    opts?.ready || done("allocated") || done("sync_in") || active("allocated") || active("sync_in");
  const inProgress = opts?.started || done("started") || active("started") || active("remaining");
  const results = opts?.results || done("ready") || done("download") || active("download");

  return [
    { id: "booking", label: "Booking Confirmed", status: bookingDone ? "done" : "pending" },
    {
      id: "queue",
      label: "In Queue",
      status: envReady || inProgress || results ? "done" : queued ? "active" : "pending",
    },
    {
      id: "ready",
      label: "Environment Ready",
      status: inProgress || results ? "done" : envReady ? "active" : "pending",
    },
    {
      id: "progress",
      label: "Analysis in Progress",
      status: results ? "done" : inProgress ? "active" : "pending",
    },
    {
      id: "results",
      label: "Results Ready",
      status: results ? "active" : "pending",
    },
  ];
}

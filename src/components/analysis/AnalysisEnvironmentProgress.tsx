import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ProvisionStep = {
  id: string;
  label: string;
  status: "done" | "active" | "pending" | string;
};

type Props = {
  title?: string;
  subtitle?: string;
  steps: ProvisionStep[];
  /** 0–100; when omitted, ring spins indefinitely while any step is active. */
  progressPercent?: number | null;
  onCancel?: () => void;
  cancelLabel?: string;
  className?: string;
  /** Compact overlay style (desktop handoff). */
  compact?: boolean;
};

function normalizeStatus(status: string): "done" | "active" | "pending" {
  const s = String(status || "").toLowerCase();
  if (s === "done" || s === "complete" || s === "completed" || s === "success") return "done";
  if (s === "active" || s === "running" || s === "in_progress" || s === "current") return "active";
  return "pending";
}

function derivePercent(steps: ProvisionStep[], explicit?: number | null): number {
  if (typeof explicit === "number" && Number.isFinite(explicit)) {
    return Math.max(0, Math.min(100, Math.round(explicit)));
  }
  if (!steps.length) return 12;
  const weights = steps.map((s) => {
    const st = normalizeStatus(s.status);
    if (st === "done") return 1;
    if (st === "active") return 0.45;
    return 0;
  });
  const sum = weights.reduce((a, b) => a + b, 0);
  return Math.max(8, Math.min(96, Math.round((sum / steps.length) * 100)));
}

/**
 * Windows-app style circular provisioning UI for Analysis Environment launch.
 * User-facing copy must never mention Guacamole or internal tunnel names.
 */
export function AnalysisEnvironmentProgress({
  title = "Preparing Analysis Environment",
  subtitle = "Please keep this tab open. Your Analysis PC opens automatically when ready.",
  steps,
  progressPercent,
  onCancel,
  cancelLabel = "Cancel",
  className,
  compact,
}: Props) {
  const pct = derivePercent(steps, progressPercent);
  const active = steps.some((s) => normalizeStatus(s.status) === "active");
  const allDone = steps.length > 0 && steps.every((s) => normalizeStatus(s.status) === "done");
  const circumference = 2 * Math.PI * 42;
  const offset = circumference * (1 - pct / 100);

  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-col items-center",
        compact ? "max-w-md gap-4" : "max-w-lg gap-6",
        className
      )}
      role="status"
      aria-live="polite"
      aria-busy={!allDone}
    >
      <div className="relative flex h-28 w-28 items-center justify-center sm:h-32 sm:w-32">
        <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden>
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            className="stroke-slate-200 dark:stroke-slate-700"
            strokeWidth="8"
          />
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            className={cn(
              "stroke-[#0b3d91] transition-[stroke-dashoffset] duration-700 ease-out dark:stroke-sky-400",
              active && !allDone && "animate-pulse"
            )}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="relative z-10 flex flex-col items-center">
          {allDone ? (
            <Check className="h-8 w-8 text-emerald-600" />
          ) : (
            <Loader2 className="h-7 w-7 animate-spin text-[#0b3d91] dark:text-sky-400" />
          )}
          <span className="mt-1 text-xs font-semibold tabular-nums text-slate-600 dark:text-muted-foreground">
            {pct}%
          </span>
        </div>
      </div>

      <div className="space-y-1 text-center">
        <h2 className={cn("font-semibold tracking-tight text-slate-900 dark:text-foreground", compact ? "text-lg" : "text-xl")}>
          {title}
        </h2>
        {subtitle ? (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>

      <ul className="w-full space-y-2 rounded-xl border border-slate-200/80 bg-white/90 px-4 py-3 text-left shadow-sm dark:border-border dark:bg-card/90">
        {steps.map((step) => {
          const st = normalizeStatus(step.status);
          return (
            <li key={step.id} className="flex items-center gap-3 text-sm">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                {st === "done" ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : st === "active" ? (
                  <span className="relative flex h-3.5 w-3.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#0b3d91]/40" />
                    <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-[#0b3d91]" />
                  </span>
                ) : (
                  <span className="h-3 w-3 rounded-full border-2 border-slate-300 dark:border-slate-600" />
                )}
              </span>
              <span
                className={cn(
                  st === "done" && "text-slate-600 dark:text-muted-foreground",
                  st === "active" && "font-semibold text-slate-900 dark:text-foreground",
                  st === "pending" && "text-slate-400"
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ul>

      {onCancel ? (
        <Button type="button" variant="outline" size="sm" className="gap-1.5 shadow-sm" onClick={onCancel}>
          <X className="h-3.5 w-3.5" />
          {cancelLabel}
        </Button>
      ) : null}
    </div>
  );
}

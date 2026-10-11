import type { ComponentType, ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Tone = "brand" | "emerald" | "amber" | "violet" | "slate" | "sky";

const TONES: Record<Tone, string> = {
  brand: "from-primary/10 text-primary",
  emerald: "from-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  amber: "from-amber-500/10 text-amber-700 dark:text-amber-300",
  violet: "from-violet-500/10 text-violet-700 dark:text-violet-300",
  slate: "from-slate-500/10 text-slate-700 dark:text-slate-200",
  sky: "from-sky-500/10 text-sky-700 dark:text-sky-300",
};

export interface ReportKpiCardProps {
  title: string;
  value: ReactNode;
  hint?: ReactNode;
  /** Definition shown behind the info icon. */
  definition?: string;
  definitionLabel?: string;
  icon?: ComponentType<{ className?: string }>;
  tone?: Tone;
  /** Drill-down target; the whole card becomes a link. */
  to?: string;
  linkLabel?: string;
  className?: string;
  children?: ReactNode;
}

/** A Reports & Statistics headline figure with its definition and, where it has one, a drill-down. */
export function ReportKpiCard({
  title,
  value,
  hint,
  definition,
  definitionLabel,
  icon: Icon,
  tone = "brand",
  to,
  linkLabel = "View users & bookings",
  className,
  children,
}: ReportKpiCardProps) {
  const body = (
    <div
      className={cn(
        "relative h-full overflow-hidden rounded-xl border bg-card p-4 shadow-sm transition-all",
        "bg-gradient-to-br to-transparent",
        TONES[tone].split(" ")[0],
        to && "group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-md",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>{title}</span>
          {definition ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={definitionLabel ?? `What ${title} means`}
                    className="text-muted-foreground/80 hover:text-foreground"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs font-normal normal-case tracking-normal">
                  {definition}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
        </p>
        {Icon ? <Icon className={cn("h-5 w-5 shrink-0 opacity-80", TONES[tone].split(" ").slice(1).join(" "))} /> : null}
      </div>
      <div className={cn("mt-2 text-2xl font-bold tabular-nums", TONES[tone].split(" ").slice(1).join(" "))}>
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
      {children}
      {to ? (
        <p className="mt-2 flex items-center gap-1 text-xs font-medium text-primary/80 group-hover:text-primary">
          {linkLabel} <ArrowRight className="h-3 w-3" />
        </p>
      ) : null}
    </div>
  );
  if (!to) return body;
  return (
    <Link to={to} className="group block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
      {body}
    </Link>
  );
}

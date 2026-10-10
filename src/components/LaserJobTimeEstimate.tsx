import { Timer } from "lucide-react";
import type { LaserJobTimeEstimate as LaserJobTimeEstimateData } from "@/lib/api";
import { formatMinutes, laserJobEstimateLines } from "@/lib/laserTimeEstimate";
import { cn } from "@/lib/utils";

interface LaserJobTimeEstimateProps {
  estimate: LaserJobTimeEstimateData;
  className?: string;
}

/** Machine-time estimate of a laser job, measured from the uploaded DXFs. */
export function LaserJobTimeEstimate({ estimate, className }: LaserJobTimeEstimateProps) {
  return (
    <div className={cn("rounded-md border bg-muted/30 px-3 py-2 text-sm", className)} data-testid="laser-job-time-estimate">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <Timer className="h-4 w-4 text-muted-foreground" aria-hidden />
          Estimated machine time
        </span>
        <span className="font-semibold tabular-nums" data-testid="laser-job-time-total">
          {formatMinutes(estimate.total_min)}
        </span>
      </div>
      <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
        {laserJobEstimateLines(estimate).map((line) => (
          <li key={line.label} className="flex justify-between gap-4">
            <span>{line.label}</span>
            <span className="tabular-nums">{formatMinutes(line.minutes)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-xs text-muted-foreground">
        Worked out from the cut length, pierces, corners and head moves in the drawings, at typical speeds for each sheet
        on this machine ({estimate.preset_label}). The actual time on the day may differ.
      </p>
      {estimate.warnings.map((w) => (
        <p key={w} className="mt-1 text-xs text-amber-800 dark:text-amber-300">
          {w}
        </p>
      ))}
    </div>
  );
}

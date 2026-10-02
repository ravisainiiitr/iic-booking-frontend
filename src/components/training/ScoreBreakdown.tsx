import { cn } from "@/lib/utils";
import { formatScore, scoreBreakdownRows } from "./trainingHelpers";

/** Points per selection factor, positive in green and negative in red, with the total. */
export function ScoreBreakdown({
  breakdown,
  total,
  className,
}: {
  breakdown: Record<string, unknown> | null | undefined;
  total?: number | string | null;
  className?: string;
}) {
  const rows = scoreBreakdownRows(breakdown);
  if (!rows.length) return <p className={cn("text-xs text-muted-foreground", className)}>No score breakdown available.</p>;
  return (
    <dl className={cn("grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2", className)}>
      {rows.map((row) => (
        <div key={row.key} className="flex items-center justify-between gap-3 border-b border-border/40 py-0.5">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd
            className={cn(
              "font-medium tabular-nums",
              row.value > 0 && "text-emerald-700 dark:text-emerald-300",
              row.value < 0 && "text-rose-700 dark:text-rose-300",
            )}
          >
            {row.value > 0 ? "+" : ""}
            {formatScore(row.value)}
          </dd>
        </div>
      ))}
      {total !== undefined ? (
        <div className="flex items-center justify-between gap-3 py-0.5 font-semibold sm:col-span-2">
          <dt>Total score</dt>
          <dd className="tabular-nums">{formatScore(total)}</dd>
        </div>
      ) : null}
    </dl>
  );
}

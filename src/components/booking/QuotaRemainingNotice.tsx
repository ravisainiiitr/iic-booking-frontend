import type { ReactNode } from "react";
import { Gauge } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  summary?: string | null;
  /** Set when this booking needs more time than is left; slot picking is then stopped. */
  blockReason?: string | null;
  /** E.g. "View bookings counted", under the text. */
  action?: ReactNode;
  className?: string;
};

export function QuotaRemainingNotice({ summary, blockReason, action, className }: Props) {
  if (!summary && !blockReason) return null;
  return (
    <div
      role={blockReason ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-md border px-3 py-2 text-sm",
        blockReason
          ? "border-amber-500/50 bg-amber-500/10 text-amber-950 dark:text-amber-100"
          : "border-border bg-muted/40 text-foreground",
        className,
      )}
      data-testid="quota-remaining-notice"
    >
      <Gauge className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div>
        {summary && <p>{summary}</p>}
        {blockReason && <p className={cn("font-medium", summary && "mt-0.5")}>{blockReason}</p>}
        {action && <div className="mt-1">{action}</div>}
      </div>
    </div>
  );
}

export default QuotaRemainingNotice;

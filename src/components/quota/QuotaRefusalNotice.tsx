import { quotaBreakdownRequestFromFailure, quotaFailureSummary, type QuotaFailure } from "@/lib/quotaBreakdown";
import { cn } from "@/lib/utils";
import { ViewBookingsCountedButton } from "./ViewBookingsCountedButton";

/** Refused for a weekly / monthly limit: the figures in words plus "View bookings counted". */
export function QuotaRefusalNotice({ failure, className }: { failure: QuotaFailure; className?: string }) {
  return (
    <div
      role="alert"
      className={cn(
        "space-y-1.5 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-foreground",
        className,
      )}
      data-testid="quota-refusal-notice"
    >
      <p>{quotaFailureSummary(failure)}</p>
      <ViewBookingsCountedButton request={quotaBreakdownRequestFromFailure(failure)} />
    </div>
  );
}

export default QuotaRefusalNotice;

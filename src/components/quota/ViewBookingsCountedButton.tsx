import { ListChecks } from "lucide-react";
import { openQuotaBreakdown, type QuotaBreakdownOpenOptions, type QuotaBreakdownRequest } from "@/lib/quotaBreakdown";
import { cn } from "@/lib/utils";
import { preloadQuotaBreakdown } from "./QuotaBreakdownHost";

type Props = {
  request: QuotaBreakdownRequest;
  options?: QuotaBreakdownOpenOptions;
  label?: string;
  className?: string;
};

/** Link-style button that opens the "bookings counted toward this limit" dialog. */
export function ViewBookingsCountedButton({ request, options, label = "View bookings counted", className }: Props) {
  return (
    <button
      type="button"
      onClick={() => openQuotaBreakdown(request, options)}
      onPointerEnter={preloadQuotaBreakdown}
      onFocus={preloadQuotaBreakdown}
      className={cn(
        "inline-flex items-center gap-1 rounded text-sm font-medium text-primary underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      data-testid="view-bookings-counted"
    >
      <ListChecks className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {label}
    </button>
  );
}

export default ViewBookingsCountedButton;

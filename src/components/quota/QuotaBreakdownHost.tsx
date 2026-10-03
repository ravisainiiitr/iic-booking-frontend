import { lazy, Suspense, useEffect, useState } from "react";
import { subscribeQuotaBreakdown, type QuotaBreakdownOpenOptions, type QuotaBreakdownRequest } from "@/lib/quotaBreakdown";

const loadDialog = () => import("./QuotaBreakdownDialog");
const QuotaBreakdownDialog = lazy(loadDialog);

/** Warms the dialog chunk (e.g. on hover) so it opens without a visible delay. */
export function preloadQuotaBreakdown(): void {
  void loadDialog();
}

/** Mounted once in App; renders the breakdown dialog whenever `openQuotaBreakdown` is called. */
export function QuotaBreakdownHost() {
  const [open, setOpen] = useState<({ request: QuotaBreakdownRequest } & QuotaBreakdownOpenOptions) | null>(null);

  useEffect(() => subscribeQuotaBreakdown((request, opts) => setOpen({ request, ...opts })), []);

  if (!open) return null;
  return (
    <Suspense fallback={null}>
      <QuotaBreakdownDialog
        request={open.request}
        onClose={() => setOpen(null)}
        onOpenBooking={
          open.onOpenBooking
            ? (id) => {
                setOpen(null);
                open.onOpenBooking?.(id);
              }
            : undefined
        }
      />
    </Suspense>
  );
}

export default QuotaBreakdownHost;

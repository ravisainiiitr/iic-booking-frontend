import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { courierTrackingApi, type BookingArrival } from "@/lib/courierTrackingApi";
import { SampleArrivalForm } from "./SampleArrivalForm";

/**
 * "Mark Sample Submitted" for an external booking user: registers the courier and AWB (tracked live, with milestone
 * notices) or manual delivery, through the courier-tracking service. Where that service does not apply (internal
 * users, or it cannot be reached) the previous action (``fallback``) is shown instead.
 */
export function SampleDispatchAction({
  bookingId,
  fallback,
  onSaved,
}: {
  bookingId: number;
  fallback: ReactNode;
  onSaved: () => void;
}) {
  const [data, setData] = useState<BookingArrival | null | undefined>(undefined);
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    courierTrackingApi
      .bookingArrival(bookingId)
      .then(setData)
      .catch(() => setData(null));
  }, [bookingId]);
  useEffect(load, [load]);

  if (data === undefined) return null; // brief: avoids flashing the wrong button
  if (!data || !data.eligibility.is_external || !data.eligibility.may_declare) return <>{fallback}</>;

  const active = data.active;
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} data-testid="sample-dispatch">
        <Send className="mr-2 h-4 w-4" aria-hidden="true" />
        {active ? "Update shipment" : "Mark Sample Submitted"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{active ? "Update shipment" : "Mark Sample Submitted"}</DialogTitle>
            <DialogDescription>
              Choose your courier and enter the AWB / tracking number: the portal follows the shipment and tells you at each
              step (in transit, out for delivery, delivered). Or choose hand delivery.
            </DialogDescription>
          </DialogHeader>
          <SampleArrivalForm
            bookingId={bookingId}
            eligibility={data.eligibility}
            current={active}
            onCancel={() => setOpen(false)}
            onSaved={(_arrival, message) => {
              toast.success(message);
              setOpen(false);
              load();
              onSaved();
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

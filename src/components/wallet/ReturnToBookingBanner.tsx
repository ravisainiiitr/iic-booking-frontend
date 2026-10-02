import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { clearReturnToBooking, readReturnToBooking } from "@/lib/rechargeReturn";

/**
 * "Back to your XPS booking" on the wallet page when the user came here from the booking page
 * (to recharge or to link a supervisor wallet). The booking form itself is kept as a draft.
 */
export function ReturnToBookingBanner({ className }: { className?: string }) {
  const navigate = useNavigate();
  const [target, setTarget] = useState(() => readReturnToBooking());
  if (!target) return null;
  const what = target.equipmentName ? `your ${target.equipmentName} booking` : "your booking";
  return (
    <div
      role="status"
      className={
        "mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm " +
        (className ?? "")
      }
      data-testid="return-to-booking-banner"
    >
      <span>
        {target.reason === "wallet_link"
          ? `Once your supervisor approves the request, go back to ${what} — your details are saved.`
          : `Recharged? Go back to ${what} — your details are saved.`}
      </span>
      <span className="flex items-center gap-1">
        <Button
          type="button"
          size="sm"
          onClick={() => {
            clearReturnToBooking();
            navigate(target.path);
          }}
        >
          <ArrowLeft className="mr-1 h-4 w-4" aria-hidden />
          Back to booking
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          aria-label="Dismiss"
          onClick={() => {
            clearReturnToBooking();
            setTarget(null);
          }}
        >
          <X className="h-4 w-4" aria-hidden />
        </Button>
      </span>
    </div>
  );
}

export default ReturnToBookingBanner;

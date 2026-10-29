import { CalendarClock, FilePlus2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { describeWindow, type ExternalWindow, type SpecialPolicy } from "@/lib/externalBookingApi";

export interface SpecialRequestDraft {
  equipmentId: number;
  equipmentName: string;
  inputValues: Record<string, unknown>;
  numberOfSamples?: number;
}

/**
 * For external users while the central external booking window applies: which dates are open, when the next week
 * opens (IST), and a way to request a special booking for other dates. Renders nothing otherwise.
 */
export function ExternalWindowNotice({
  window,
  special,
  draft,
  className,
}: {
  window: ExternalWindow | null;
  special: SpecialPolicy | null;
  draft?: SpecialRequestDraft | null;
  className?: string;
}) {
  const navigate = useNavigate();
  if (!window?.applies_to_you) return null;
  const canRequest = Boolean(special?.available_to_you && draft?.equipmentId);
  return (
    <section
      aria-label="External booking window"
      className={cn("mx-auto mb-3 flex max-w-3xl flex-col gap-2 rounded-lg border bg-muted/40 p-3 text-sm sm:flex-row sm:items-center", className)}
    >
      <CalendarClock className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
      <p className="flex-1" aria-live="polite">
        {describeWindow(window)}
      </p>
      {special?.available_to_you ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!canRequest}
          title={canRequest ? undefined : "Fill in the booking details above first."}
          onClick={() => navigate("/external-special-requests/new", { state: { draft } })}
        >
          <FilePlus2 className="mr-1 h-4 w-4" aria-hidden="true" />
          Request a Special Booking
        </Button>
      ) : null}
    </section>
  );
}

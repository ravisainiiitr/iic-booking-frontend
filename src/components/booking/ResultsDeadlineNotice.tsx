import { format } from "date-fns";
import { AlertTriangle, CalendarCheck } from "lucide-react";
import type { BookingResultsDeadline } from "@/lib/api";

const OPEN_STATUSES = new Set(["PENDING", "BOOKED", "PROCESSING"]);

/** The results deadline matters while the booking is open (results not yet shared). */
export function resultsDeadlineApplies(status: string | null | undefined): boolean {
  return OPEN_STATUSES.has(String(status || "").toUpperCase());
}

/** Lab Operators only track the results deadline once the sample is accepted (or the booking is processing). */
export function sampleAcceptedForResults(
  status: string | null | undefined,
  sampleTrace: Array<{ status?: string | null }> | null | undefined,
): boolean {
  if (String(status || "").toUpperCase() === "PROCESSING") return true;
  return (sampleTrace ?? []).some((e) => String(e.status || "").toUpperCase() === "SAMPLE_ACCEPTED");
}

const receivedOn = (iso: string | null | undefined) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : format(d, "EEE d MMM, h:mm a");
};

/**
 * Booking details: staff see "Results due" (and an overdue warning); the booking user sees
 * "Results expected by" only when the OIC shows the results deadline to users. The server sends no
 * deadline until the lab has received the sample, so nothing shows before receipt.
 */
export function ResultsDeadlineNotice({
  deadline,
  status,
  staffView,
  now = new Date(),
}: {
  deadline?: BookingResultsDeadline | null;
  status: string;
  staffView: boolean;
  now?: Date;
}) {
  if (!deadline || !resultsDeadlineApplies(status)) return null;
  if (!staffView && !deadline.visible_to_user) return null;
  const fromReceipt = deadline.counted_from_receipt ? receivedOn(deadline.sample_received_at) : null;

  if (staffView) {
    return (
      <div
        className={
          deadline.overdue
            ? "mb-4 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2.5 text-sm text-red-900 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100"
            : "mb-4 flex items-start gap-2 rounded-lg border bg-muted/20 px-3 py-2.5 text-sm"
        }
        data-testid="results-deadline-staff"
      >
        {deadline.overdue ? (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        ) : (
          <CalendarCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
        <div className="min-w-0">
          <p className="font-semibold">
            {deadline.overdue ? "Results overdue" : "Results due"}: {deadline.due_display}
          </p>
          <p className={deadline.overdue ? "text-xs" : "text-xs text-muted-foreground"}>
            Results deadline: {deadline.label}
            {deadline.extended ? " (extended for this booking)" : ""}.{" "}
            {fromReceipt ? `Counted from sample receipt on ${fromReceipt}, after the slot ended. ` : ""}
            {deadline.visible_to_user ? "The user can see this date." : "Not shown to the user."}
          </p>
        </div>
      </div>
    );
  }

  const passed = now.getTime() > new Date(deadline.due_at).getTime();
  return (
    <div className="mb-4 flex items-start gap-2 rounded-lg border bg-muted/20 px-3 py-2.5 text-sm" data-testid="results-deadline-user">
      <CalendarCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <p className="font-semibold text-foreground">
          {passed ? "Results were expected by" : "Results expected by"} {deadline.due_display}
        </p>
        <p className="text-xs text-muted-foreground">
          {passed
            ? "The laboratory is working on your results and will update you. You can use Message the lab for any question."
            : `The laboratory shares results ${deadline.label}${
                fromReceipt ? ` (your sample was received on ${fromReceipt})` : ""
              }. You receive an email and a notification when they are available.`}
        </p>
      </div>
    </div>
  );
}

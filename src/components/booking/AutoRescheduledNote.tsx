import { CalendarClock } from "lucide-react";
import type { AutoReschedulePayload } from "@/lib/bookingDeadlines";

/** Staff badge text, e.g. "Auto-rescheduled after maintenance — originally Mon 12 Oct, 9:00 am; sample deadline extended to …". */
export function autoRescheduleNoteText(payload?: AutoReschedulePayload | null): string | null {
  if (!payload) return null;
  if (payload.note) return payload.note;
  const original = payload.original_display ? ` — originally ${payload.original_display}` : "";
  const deadline = payload.sample_deadline_display
    ? `; sample deadline extended to ${payload.sample_deadline_display}`
    : "";
  return `Auto-rescheduled after maintenance${original}${deadline}`;
}

/** Booking details: the booking was moved automatically to this slot after the equipment came back from maintenance. */
export function AutoRescheduledNote({
  payload,
  staffView,
}: {
  payload?: AutoReschedulePayload | null;
  staffView: boolean;
}) {
  const text = autoRescheduleNoteText(payload);
  if (!text || !payload) return null;
  const hours = Number(payload.extension_hours || 0);
  return (
    <div
      className="mb-4 flex items-start gap-2 rounded-lg border border-sky-300 bg-sky-50 px-3 py-2.5 text-sm text-sky-950 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-100"
      data-testid="auto-rescheduled-note"
    >
      <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        <p className="font-semibold">{text}</p>
        <p className="text-xs">
          {staffView
            ? `Moved by the system in booking order after the maintenance period.${
                hours > 0
                  ? ` The sample submission deadline and the Booking Not Utilized threshold are extended by ${hours} h for this booking.`
                  : ""
              }`
            : "Your booking was moved automatically because the equipment was under maintenance. The price is unchanged."}
        </p>
      </div>
    </div>
  );
}

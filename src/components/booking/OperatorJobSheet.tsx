import { forwardRef, type ReactNode } from "react";
import { AlertTriangle, CalendarClock, ClipboardList, Mail, MessageSquareText, Phone, Wind } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { applyFacultyNamePrefix } from "@/lib/displayName";
import { getUserTypeDisplayName } from "@/lib/userTypes";
import { isCommentsInputFieldKey } from "@/lib/bookingInputValues";
import type { BookingInputFieldDef } from "@/lib/bookingInputDisplay";
import { formatDurationMinutes, groupSlotsByDay, latestSampleStage, telHref, type JobSheetSlot } from "@/lib/jobSheet";
import { SampleRequirementsTable, TextWithLinks } from "@/components/booking/SampleRequirementsTable";

/** The booking fields the job sheet reads (a subset of the booking details payload). */
export type JobSheetBooking = {
  booking_id: string | number;
  virtual_booking_id?: string | null;
  equipment_code: string;
  equipment_name: string;
  equipment_weekly_view_display?: string | null;
  status: string;
  status_display: string;
  user_name: string;
  user_email?: string | null;
  user_phone?: string | null;
  user_department?: string | null;
  user_type_snapshot?: string | null;
  user_type_snapshot_display?: string | null;
  wallet_owner_name?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  total_time_minutes?: number | null;
  daily_slots?: JobSheetSlot[] | null;
  sample_trace?: Array<{ status: string; status_display?: string | null; created_at: string }> | null;
  input_values?: Record<string, unknown> | null;
  input_fields?: BookingInputFieldDef[] | null;
  notes?: string | null;
  atmosphere_sensitive_sample?: boolean;
  sample_return_after_analysis?: boolean;
  source_booking_id?: number | null;
  sample_collection_deadline_at?: string | null;
};

type OperatorJobSheetProps = {
  booking: JobSheetBooking;
  statusBadgeClass?: string;
  /** Edit inputs button, shown beside the requirements heading (hidden when printing). */
  editInputs?: ReactNode;
  className?: string;
};

function Fact({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm sm:text-base font-medium text-foreground break-words">{children}</dd>
    </div>
  );
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

/**
 * What the Lab Operator needs to run the test: who, when, sample stage, handling flags, the user's
 * instructions and the sample requirements table. No charges, payment or contact-card details.
 */
export const OperatorJobSheet = forwardRef<HTMLDivElement, OperatorJobSheetProps>(function OperatorJobSheet(
  { booking, statusBadgeClass, editInputs, className },
  ref,
) {
  const bookingRef = booking.virtual_booking_id || `${booking.equipment_code}-#${booking.booking_id}`;
  const hideTimes = String(booking.equipment_weekly_view_display || "").toUpperCase() === "SLOT_ID";
  const days = groupSlotsByDay(booking.daily_slots, { hideTimes });
  const slotCount = days.reduce((n, d) => n + d.slotCount, 0);
  const duration = formatDurationMinutes(booking.total_time_minutes);
  const stage = latestSampleStage(booking.sample_trace);
  const userType = booking.user_type_snapshot_display || getUserTypeDisplayName(booking.user_type_snapshot);
  const userName = applyFacultyNamePrefix(booking.user_name, booking.user_type_snapshot) || booking.user_name;
  const phoneHref = telHref(booking.user_phone);
  const values = booking.input_values ?? {};
  const commentsKey = Object.keys(values).find((k) => isCommentsInputFieldKey(k));
  const comments = commentsKey ? String(values[commentsKey] ?? "").trim() : "";
  const notes = String(booking.notes || "").trim();
  const flags: Array<{ key: string; icon: ReactNode; text: string }> = [];
  if (booking.atmosphere_sensitive_sample) {
    flags.push({
      key: "atmosphere",
      icon: <Wind className="h-4 w-4 shrink-0" aria-hidden />,
      text: "Atmosphere-sensitive sample — brought at slot start. Do not mark Booking Not Utilized before the slot begins.",
    });
  }
  if (booking.sample_return_after_analysis) {
    flags.push({
      key: "return",
      icon: <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />,
      text: "Return the sample to the user after analysis.",
    });
  }

  return (
    <div ref={ref} className={cn("operator-jobsheet min-w-0 w-full space-y-4", className)} data-testid="operator-job-sheet">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <ClipboardList className="h-3.5 w-3.5" aria-hidden />
            Job sheet
          </p>
          <h2 className="mt-0.5 text-xl sm:text-2xl font-semibold leading-tight">{booking.equipment_name}</h2>
          <p className="mt-1 font-mono text-base sm:text-lg font-semibold tracking-tight break-all">{bookingRef}</p>
          {booking.source_booking_id ? (
            <p className="mt-0.5 text-sm text-muted-foreground">Repeat sample of booking #{booking.source_booking_id}</p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Badge className={cn("text-sm", statusBadgeClass)}>{booking.status_display}</Badge>
          {stage && (
            <span className="text-xs text-muted-foreground">
              Sample: <span className="font-semibold text-foreground">{stage.status_display || stage.status}</span>
            </span>
          )}
        </div>
      </header>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-xl border border-border/80 bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-3">
        <Fact label="Date & time" className="sm:col-span-2 lg:col-span-1">
          {days.length > 0 ? (
            <ul className="space-y-0.5">
              {days.map((d) => (
                <li key={d.dateLabel} className="flex flex-wrap gap-x-2">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarClock className="h-4 w-4 text-muted-foreground" aria-hidden />
                    {d.dateLabel}
                  </span>
                  <span className="text-muted-foreground">{d.ranges.join(", ")}</span>
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-muted-foreground">No slot booked</span>
          )}
        </Fact>
        <Fact label="Booked time">
          {duration || "—"}
          {slotCount > 0 && (
            <span className="text-muted-foreground font-normal">
              {" "}
              · {slotCount} {slotCount === 1 ? "slot" : "slots"}
            </span>
          )}
        </Fact>
        <Fact label="User">
          <span className="block">{userName}</span>
          <span className="block text-sm font-normal text-muted-foreground">
            {[userType, booking.user_department].filter(Boolean).join(" · ")}
          </span>
        </Fact>
        {booking.wallet_owner_name ? <Fact label="Supervisor">{booking.wallet_owner_name}</Fact> : null}
        {(phoneHref || booking.user_email) && (
          <Fact label="Contact">
            {phoneHref && (
              <a href={phoneHref} className="flex items-center gap-1.5 text-primary hover:underline">
                <Phone className="h-4 w-4" aria-hidden />
                {booking.user_phone}
              </a>
            )}
            {booking.user_email && (
              <a href={`mailto:${booking.user_email}`} className="flex items-center gap-1.5 text-primary hover:underline break-all">
                <Mail className="h-4 w-4 shrink-0" aria-hidden />
                {booking.user_email}
              </a>
            )}
          </Fact>
        )}
        {booking.sample_collection_deadline_at && booking.status.toUpperCase() === "COMPLETED" ? (
          <Fact label="Sample collection by">{formatDate(booking.sample_collection_deadline_at)}</Fact>
        ) : null}
      </dl>

      {flags.length > 0 && (
        <ul className="space-y-1.5" aria-label="Sample handling">
          {flags.map((f) => (
            <li
              key={f.key}
              className="flex items-start gap-2 rounded-lg border border-sky-500/40 bg-sky-50/80 px-3 py-2 text-sm font-medium text-sky-950 dark:bg-sky-950/30 dark:text-sky-100"
            >
              {f.icon}
              <span>{f.text}</span>
            </li>
          ))}
        </ul>
      )}

      {(comments || notes) && (
        <section
          aria-labelledby="jobsheet-instructions-heading"
          className="jobsheet-section rounded-xl border border-amber-300/70 bg-amber-50/80 px-4 py-3 dark:border-amber-800/60 dark:bg-amber-950/25"
        >
          <h3 id="jobsheet-instructions-heading" className="flex items-center gap-2 text-sm font-semibold text-amber-950 dark:text-amber-100">
            <MessageSquareText className="h-4 w-4" aria-hidden />
            {comments ? "Instructions from the user" : "Booking notes"}
          </h3>
          {comments && (
            <p className="mt-1.5 whitespace-pre-wrap break-words text-sm sm:text-base text-foreground">
              <TextWithLinks text={comments} />
            </p>
          )}
          {notes && (
            <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-foreground">
              {comments && <span className="font-semibold">Booking note: </span>}
              {notes}
            </p>
          )}
        </section>
      )}

      <SampleRequirementsTable fields={booking.input_fields} inputValues={values} toolbar={editInputs} />
    </div>
  );
});

export default OperatorJobSheet;

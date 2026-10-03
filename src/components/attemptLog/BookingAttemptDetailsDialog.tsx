import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { format } from "date-fns";
import { AlertCircle, CalendarClock, CheckCircle2, ChevronRight, Gauge, Loader2, MessageSquareText, UserRound } from "lucide-react";
import { apiClient } from "@/lib/api";
import type { BookingAttemptDetail, BookingAttemptPerson, BookingAttemptSlot } from "@/lib/bookingAttemptDetail";
import { formatDurationMinutes, groupSlotsByDay } from "@/lib/jobSheet";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SampleRequirementsTable } from "@/components/booking/SampleRequirementsTable";
import { preloadQuotaBreakdown } from "@/components/quota/QuotaBreakdownHost";

const QuotaBreakdownPanel = lazy(() =>
  import("@/components/quota/QuotaBreakdownDialog").then((m) => ({ default: m.QuotaBreakdownPanel })),
);

/** What the log list already knows about the row, shown while (or if) the details cannot be loaded. */
export type BookingAttemptRowSummary = {
  id: number;
  requested_at: string | null;
  outcome: string;
  equipment_name: string;
  equipment_code: string;
  user_name: string;
  user_email: string;
  failure_reason?: string;
  failure_title?: string;
  failure_summary?: string;
  display_booking_id?: string | null;
};

type Props = {
  row: BookingAttemptRowSummary | null;
  onOpenChange: (open: boolean) => void;
  /** Opens the booking created by a successful attempt. */
  onOpenBooking?: () => void;
  /** Quota failures: list the bookings counted toward the limit for the requested period, after the outcome. */
  showQuotaBreakdown?: boolean;
  onOpenCountedBooking?: (bookingId: number) => void;
};

function QuotaBreakdownSection({ logId, onOpenBooking }: { logId: number; onOpenBooking?: (bookingId: number) => void }) {
  return (
    <Section icon={<Gauge className="h-4 w-4 text-primary" aria-hidden />} title="Bookings counted toward this limit">
      <Suspense
        fallback={
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
          </div>
        }
      >
        <QuotaBreakdownPanel request={{ logId }} onOpenBooking={onOpenBooking} variant="inline" />
      </Suspense>
    </Section>
  );
}

function formatWhen(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : format(d, "EEE, d MMM yyyy, h:mm a");
}

function Section({ icon, title, children, className }: { icon: ReactNode; title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-border/80 bg-card shadow-sm", className)} aria-label={title}>
      <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3">
        {icon}
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

function PersonDetails({ person }: { person: BookingAttemptPerson }) {
  const supervisor = person.supervisor_name || person.wallet_owner_name;
  const department = [person.department_name, person.department_code ? `(${person.department_code})` : ""]
    .filter(Boolean)
    .join(" ");
  const rows: Array<[string, ReactNode]> = [
    ["Name", <span className="font-semibold">{person.name}</span>],
    ["User type", person.user_type_label],
    ["Department", department],
    ["Email", person.email ? <a href={`mailto:${person.email}`} className="text-primary underline-offset-2 hover:underline break-all">{person.email}</a> : null],
    ["Phone", person.phone],
    ["ID number", person.id_number],
    ["Designation", person.designation],
    ["Supervisor", supervisor],
    [
      "Wallet",
      person.wallet_owner_name && person.wallet_owner_name !== supervisor ? `${person.wallet_owner_name}'s wallet` : null,
    ],
  ];
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      {rows
        .filter(([, value]) => value != null && value !== "")
        .map(([label, value]) => (
          <div key={label} className="flex min-w-0 gap-2">
            <dt className="w-24 shrink-0 text-muted-foreground">{label}</dt>
            <dd className="min-w-0 break-words text-foreground">{value}</dd>
          </div>
        ))}
    </dl>
  );
}

function SlotList({ slots }: { slots: BookingAttemptSlot[] }) {
  const days = groupSlotsByDay(slots);
  return (
    <ul className="space-y-1 text-sm">
      {days.map((day) => (
        <li key={day.dateLabel} className="flex flex-wrap gap-x-2">
          <span className="font-medium">{day.dateLabel}</span>
          <span className="text-muted-foreground">{day.ranges.join(", ")}</span>
          <span className="text-xs text-muted-foreground">
            ({day.slotCount} {day.slotCount === 1 ? "slot" : "slots"})
          </span>
        </li>
      ))}
    </ul>
  );
}

function OutcomeSection({ detail, row }: { detail: BookingAttemptDetail | null; row: BookingAttemptRowSummary }) {
  const outcome = detail?.outcome_details;
  const success = (outcome?.status ?? row.outcome) === "SUCCESS";
  const title =
    outcome?.title ||
    (success ? `Booking created${row.display_booking_id ? `: ${row.display_booking_id}` : ""}` : row.failure_title || "Booking failed");
  const message = outcome?.message || (success ? "" : row.failure_summary || row.failure_reason || "");
  const technical = outcome ? outcome.technical : row.failure_reason;
  const Icon = success ? CheckCircle2 : AlertCircle;
  return (
    <section
      aria-label="Outcome"
      data-testid="attempt-outcome"
      className={cn(
        "rounded-xl border-l-4 border px-4 py-3",
        success
          ? "border-green-600/40 border-l-green-600 bg-green-50/70 dark:bg-green-950/25"
          : "border-red-600/40 border-l-red-600 bg-red-50/70 dark:bg-red-950/25",
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Outcome</p>
      <h3 className={cn("mt-1 flex items-start gap-2 text-base font-semibold", success ? "text-green-800 dark:text-green-300" : "text-red-800 dark:text-red-300")}>
        <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <span>{title}</span>
      </h3>
      {message && message !== title && <p className="mt-1 text-sm text-foreground">{message}</p>}
      {(outcome?.notes ?? []).length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-foreground">
          {(outcome?.notes ?? []).map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
      {technical && technical !== message && (
        <details className="group mt-3 text-sm">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
            <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" aria-hidden />
            Technical details
          </summary>
          <p className="mt-2 whitespace-pre-wrap break-words rounded-md bg-background/80 p-2 font-mono text-xs text-muted-foreground">
            {technical}
          </p>
        </details>
      )}
    </section>
  );
}

/**
 * Booking Attempt Log details: when and on what, who booked (as on the booking details page), the requested slots,
 * the user's inputs as the job sheet's table, the outcome in plain language, and for a limit failure the bookings
 * counted toward that limit last.
 */
export function BookingAttemptDetailsDialog({
  row,
  onOpenChange,
  onOpenBooking,
  showQuotaBreakdown = false,
  onOpenCountedBooking,
}: Props) {
  const [detail, setDetail] = useState<BookingAttemptDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!row) {
      setDetail(null);
      setError(null);
      return;
    }
    let cancelled = false;
    if (showQuotaBreakdown) preloadQuotaBreakdown();
    setLoading(true);
    setError(null);
    setDetail(null);
    apiClient
      .getBookingAttemptLogDetail(row.id)
      .then((res) => {
        if (cancelled) return;
        const err = (res as { error?: string }).error;
        if (err) {
          setError(err);
          return;
        }
        const payload = ((res as { data?: BookingAttemptDetail }).data ?? res) as BookingAttemptDetail;
        setDetail(payload && typeof payload === "object" && "outcome_details" in payload ? payload : null);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load the attempt details.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [row?.id]);

  if (!row) return null;
  const success = (detail?.outcome ?? row.outcome) === "SUCCESS";
  const when = formatWhen(detail?.requested_at ?? row.requested_at);
  const bookingId = detail?.display_booking_id ?? row.display_booking_id;
  const picked = detail?.requested_slots ?? [];
  const booked = detail?.booked_slots ?? [];
  const slotsDiffer =
    booked.length > 0 &&
    picked.length > 0 &&
    booked.map((s) => s.id).join(",") !== picked.map((s) => s.id).join(",");
  const slotsToShow = picked.length > 0 ? picked : booked;
  const duration = formatDurationMinutes(detail?.duration_minutes);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl grid-cols-[minmax(0,1fr)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 pr-6">
            Booking attempt details
            <Badge className={success ? "bg-green-600" : "bg-red-600"}>{success ? "Success" : "Failed"}</Badge>
          </DialogTitle>
          <DialogDescription className="flex flex-wrap gap-x-3 gap-y-1">
            <span>
              <span className="font-medium text-foreground">{detail?.equipment_name ?? row.equipment_name}</span>
              {(detail?.equipment_code ?? row.equipment_code) && ` (${detail?.equipment_code ?? row.equipment_code})`}
            </span>
            {when && <span>Attempted {when}</span>}
            {bookingId &&
              (onOpenBooking ? (
                <button type="button" onClick={onOpenBooking} className="font-mono text-primary underline-offset-2 hover:underline">
                  Booking {bookingId}
                </button>
              ) : (
                <span className="font-mono">Booking {bookingId}</span>
              ))}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10" role="status" aria-label="Loading attempt details">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                {error} Showing what the log list has.
              </p>
            )}

            <Section icon={<UserRound className="h-4 w-4 text-primary" aria-hidden />} title="User details">
              {detail?.user ? (
                <PersonDetails person={detail.user} />
              ) : (
                <PersonDetails person={{ id: 0, name: row.user_name, email: row.user_email }} />
              )}
              {detail?.requested_by && (
                <p className="mt-3 border-t border-border/60 pt-2 text-sm text-muted-foreground">
                  Submitted on the user's behalf by{" "}
                  <span className="font-medium text-foreground">{detail.requested_by.name}</span>
                  {detail.requested_by.user_type_label ? ` (${detail.requested_by.user_type_label})` : ""}
                </p>
              )}
            </Section>

            {detail && (
              <Section icon={<CalendarClock className="h-4 w-4 text-primary" aria-hidden />} title="Requested slots">
                {slotsToShow.length > 0 ? (
                  <SlotList slots={slotsToShow} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    The exact slots were not recorded for this attempt
                    {detail.slots_requested ? ` (${detail.slots_requested} ${detail.slots_requested === 1 ? "slot" : "slots"} requested)` : ""}.
                  </p>
                )}
                {slotsDiffer && (
                  <div className="mt-3 border-t border-border/60 pt-2">
                    <p className="mb-1 text-sm font-medium">Booked slots</p>
                    <SlotList slots={booked} />
                  </div>
                )}
                {(detail.selected_parameters ?? []).length > 0 && (
                  <p className="mt-2 text-sm">
                    <span className="text-muted-foreground">Slot options: </span>
                    {(detail.selected_parameters ?? []).join(", ")}
                  </p>
                )}
                {duration && <p className="mt-2 text-xs text-muted-foreground">Total time: {duration}</p>}
              </Section>
            )}

            {detail && (
              <SampleRequirementsTable
                title="User inputs"
                emptyText="No inputs were recorded for this attempt."
                fields={detail.input_fields}
                inputValues={detail.input_values}
              />
            )}

            {detail?.comments && (
              <Section icon={<MessageSquareText className="h-4 w-4 text-primary" aria-hidden />} title="Comments">
                <p className="whitespace-pre-wrap break-words text-sm">{detail.comments}</p>
              </Section>
            )}

            <OutcomeSection detail={detail} row={row} />

            {showQuotaBreakdown && !success && <QuotaBreakdownSection logId={row.id} onOpenBooking={onOpenCountedBooking} />}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default BookingAttemptDetailsDialog;

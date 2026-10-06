import { format } from "date-fns";
import { CalendarClock, FlaskConical, Microscope, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { resultsDeadlineAnchor } from "@/lib/bookingDeadlines";
import type { NextSampleReminder } from "@/lib/loginTips";
import {
  bookingSampleDeadline,
  estimateResultsDue,
  estimateSampleDeadline,
  formatSlotTime,
  hoursLabel,
  isWalkInSampleEquipment,
  nextWeekdayAt10,
  resultsDeadlineEquipment,
  sampleAtSlotEquipment,
  typicalResultsDeadline,
  typicalSampleLeadHours,
  type SamplePolicyEquipment,
} from "@/lib/samplePolicy";
import { useSamplePolicyEquipment } from "./useSamplePolicyEquipment";

const FALLBACK_EXAMPLE_LEAD_HOURS = 24;

function policyPoints(
  typicalLead: number | null,
  publishesResultsTimes = false,
): Array<{ title: string; text: string }> {
  return [
    {
      title: "Submission deadline",
      text:
        "Submit your sample to the laboratory before the sample deadline of your booking. The deadline is the slot start time minus the sample lead time configured for the equipment" +
        (typicalLead ? ` (${hoursLabel(typicalLead)} for most instruments)` : "") +
        ". If it falls on a Saturday, Sunday or institute holiday, it moves to the same time on the previous working day.",
    },
    {
      title: "Early submission",
      text:
        "You are welcome to submit your sample before the deadline, provided it is not atmosphere-sensitive. Please note that early submission does not lead to earlier analysis or earlier results; the sample is analysed in your booked slot.",
    },
    {
      title: "Atmosphere-sensitive samples",
      text:
        "Where the equipment permits, select Atmosphere-sensitive sample (submit at slot start) while booking; such a sample may be submitted at the start of the slot.",
    },
    {
      title: "Recording of receipt",
      text:
        "When you hand over the sample, request the Lab Operator to record its receipt in the portal. You can follow its progress under Sample Lifecycle in the booking details. The time for results starts only once receipt is recorded.",
    },
    {
      title: "Checking your deadline",
      text:
        "The booking details in My Bookings show the time remaining to submit the sample. An email and a portal notification are also sent 12 hours before the deadline.",
    },
    {
      title: "Bookings not utilized",
      text:
        "A sample whose receipt has not been recorded in the portal is considered not submitted. The booking is then treated as Booking Not Utilized and the charges are not refunded. The portal applies this automatically 24 hours after the slot ends, and the laboratory may also record it.",
    },
    {
      title: "If you are delayed",
      text:
        "Inform the laboratory before the deadline through Message the lab in the booking details, choosing Sample submission delayed. Acceptance of a late sample is at the laboratory's discretion.",
    },
    {
      title: "After the sample is accepted",
      text:
        "Once the laboratory has accepted your sample, the booking can no longer be rescheduled or cancelled. Use Message the lab for any change.",
    },
    {
      title: "Results",
      text:
        "Each instrument has a target time within which the laboratory shares results after analysis, and in most cases you will receive your results within this time. The time counts only once the Lab Operator has recorded receipt of your sample: from the end of your slot, or from the receipt if the sample is received after the slot. You receive an email and a notification when your results are available in the portal." +
        (publishesResultsTimes
          ? " Where the laboratory publishes this time, it is listed below and the booking details show the date by which results are expected."
          : ""),
    },
    {
      title: "Delays in results",
      text:
        "In rare circumstances, such as a medical emergency or other unforeseen events, results may be delayed. The laboratory will inform you if this happens, and we appreciate your patience and understanding.",
    },
    {
      title: "Collection after analysis",
      text:
        "Collect your sample within the collection period stated in the completion email. Samples not collected within that period may be discarded.",
    },
  ];
}

const dayAndTime = (d: Date) => format(d, "EEEE, h:mm a");

function WorkedExample({
  nextBooking,
  rows,
  typicalLead,
}: {
  nextBooking: NextSampleReminder | null;
  rows: SamplePolicyEquipment[];
  typicalLead: number | null;
}) {
  const own = nextBooking ? bookingSampleDeadline(nextBooking, rows) : null;
  if (nextBooking && own && own.kind !== "unknown") {
    const slot = (
      <>
        Your booking: <span className="font-medium text-foreground">{nextBooking.equipmentName}</span>,{" "}
        <span className="font-medium text-foreground">{formatSlotTime(nextBooking.startTime)}</span>.
      </>
    );
    return (
      <p className="text-sm leading-relaxed text-muted-foreground" data-testid="sample-policy-example">
        {slot}{" "}
        {own.kind === "at-slot" ? (
          <>
            No advance deadline applies: bring your sample at the start of the slot.
            {own.walkIn ? " After the slot, take the sample back with you." : ""}
          </>
        ) : own.kind === "deadline" ? (
          <>
            Submit the sample by <span className="font-medium text-foreground">{formatSlotTime(own.deadlineAt)}</span>
            {own.leadHours ? ` (${hoursLabel(own.leadHours)} before the slot)` : ""}.
          </>
        ) : (
          <>
            Submit the sample by <span className="font-medium text-foreground">{formatSlotTime(own.deadline)}</span> (
            {hoursLabel(own.leadHours)} before the slot{own.movedFromWeekend ? ", moved back from the weekend" : ""}). If that
            day is an institute holiday, the deadline moves to the previous working day; the booking details show the exact
            deadline.
          </>
        )}
      </p>
    );
  }

  const lead = typicalLead ?? FALLBACK_EXAMPLE_LEAD_HOURS;
  const now = new Date();
  const cases = [nextWeekdayAt10(now, 2), nextWeekdayAt10(now, 1)].map((slot) => ({
    slot,
    ...estimateSampleDeadline(slot, lead),
  }));
  return (
    <div className="space-y-2" data-testid="sample-policy-example">
      <p className="text-sm text-muted-foreground">
        {typicalLead
          ? `Example with a lead time of ${hoursLabel(lead)}, the most common setting at present:`
          : `Example with an illustrative lead time of ${hoursLabel(lead)}:`}
      </p>
      <ul className="space-y-1.5 text-sm">
        {cases.map((c) => (
          <li key={c.slot.toISOString()} className="rounded-lg border border-border/70 bg-background/60 px-3 py-2">
            Slot on <span className="font-medium">{dayAndTime(c.slot)}</span>: submit by{" "}
            <span className="font-medium">{dayAndTime(c.deadline)}</span>
            {c.movedFromWeekend ? " (moved back from the weekend to the previous working day)" : ""}.
          </li>
        ))}
      </ul>
    </div>
  );
}

function SampleAtSlotList({ rows, status }: { rows: SamplePolicyEquipment[]; status: "loading" | "ready" | "error" }) {
  if (status === "loading") return <p className="text-sm text-muted-foreground">Loading the equipment list…</p>;
  if (status === "error") {
    return (
      <p className="text-sm text-muted-foreground">
        The equipment list could not be loaded. The booking details show whether a submission deadline applies to your
        booking.
      </p>
    );
  }
  const list = sampleAtSlotEquipment(rows);
  if (!list.length) return <p className="text-sm text-muted-foreground">No equipment currently follows this arrangement.</p>;
  return (
    <ul className="grid gap-1.5 sm:grid-cols-2" data-testid="sample-at-slot-list">
      {list.map((eq) => (
        <li key={eq.equipment_id} className="rounded-lg border border-emerald-200/80 bg-white/70 px-3 py-2 text-sm dark:border-emerald-500/25 dark:bg-white/5">
          <span className="font-medium text-foreground">{eq.name}</span>
          {isWalkInSampleEquipment(eq) ? (
            <span className="block text-xs text-muted-foreground">Take the sample back after the slot.</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function ResultsTimesSection({ rows }: { rows: SamplePolicyEquipment[] }) {
  const list = resultsDeadlineEquipment(rows);
  const typical = typicalResultsDeadline(rows);
  const fridaySlotEnd = nextWeekdayAt10(new Date(), 5);
  fridaySlotEnd.setHours(17, 0, 0, 0);
  const receivedBeforeSlot = new Date(fridaySlotEnd.getTime() - 24 * 3_600_000);
  const anchor = resultsDeadlineAnchor(fridaySlotEnd, { received: true, receivedAt: receivedBeforeSlot });
  const due = typical && anchor ? estimateResultsDue(anchor, typical) : null;
  return (
    <section
      aria-labelledby="results-times-heading"
      className="space-y-2 rounded-xl border border-violet-200 bg-violet-50/70 p-4 dark:border-violet-500/30 dark:bg-violet-500/10"
      data-testid="results-times-section"
    >
      <h3 id="results-times-heading" className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Timer className="h-4 w-4 text-violet-700 dark:text-violet-300" aria-hidden />
        When to expect results
      </h3>
      <p className="text-sm leading-relaxed text-muted-foreground">
        For these instruments the laboratory shares results within the time shown, counted from the end of your slot
        or, if your sample is received after the slot, from the time the Lab Operator records its receipt. No results
        date applies until the receipt is recorded. Working days do not include Saturdays, Sundays or institute
        holidays.
      </p>
      <ul className="grid gap-1.5 sm:grid-cols-2" data-testid="results-times-list">
        {list.map((eq) => (
          <li
            key={eq.equipment_id}
            className="rounded-lg border border-violet-200/80 bg-white/70 px-3 py-2 text-sm dark:border-violet-500/25 dark:bg-white/5"
          >
            <span className="font-medium text-foreground">{eq.name}</span>
            <span className="block text-xs text-muted-foreground">Results {eq.results_deadline_public!.label}</span>
          </li>
        ))}
      </ul>
      {typical && due ? (
        <p className="text-sm text-muted-foreground" data-testid="results-times-example">
          Example: a slot ending on <span className="font-medium text-foreground">{dayAndTime(fridaySlotEnd)}</span>,
          with the sample received before the slot, on an instrument with results {typical.label}: results expected by{" "}
          <span className="font-medium text-foreground">
            {typical.unit === "HOURS" ? dayAndTime(due) : `the end of ${format(due, "EEEE")}`}
          </span>
          {typical.unit === "HOURS" ? "" : " (the weekend is not counted)"}. Your booking details show the exact date.
        </p>
      ) : null}
    </section>
  );
}

export default function SampleSubmissionPolicyDialog({
  open,
  onOpenChange,
  nextBooking,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nextBooking: NextSampleReminder | null;
}) {
  const equipment = useSamplePolicyEquipment("all", open);
  const typicalLead = typicalSampleLeadHours(equipment.rows);
  const resultsRows = resultsDeadlineEquipment(equipment.rows);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] max-w-2xl flex-col gap-0 overflow-hidden rounded-xl p-0">
        <DialogHeader className="border-b px-5 pb-4 pt-5 text-left sm:px-6">
          <DialogTitle className="flex items-center gap-2 pr-6 text-lg">
            <FlaskConical className="h-5 w-5 shrink-0 text-sky-700 dark:text-sky-300" aria-hidden />
            Sample submission policy
          </DialogTitle>
          <DialogDescription>
            Applies to bookings in which the laboratory analyses your sample. Each equipment has its own sample deadline,
            configured by the laboratory.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4 sm:px-6">
          <ol className="space-y-3" aria-label="Policy">
            {policyPoints(typicalLead, resultsRows.length > 0).map((p, i) => (
              <li key={p.title} className="flex gap-3">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-800 dark:bg-sky-500/20 dark:text-sky-200"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{p.title}</p>
                  <p className="text-sm leading-relaxed text-muted-foreground">{p.text}</p>
                </div>
              </li>
            ))}
          </ol>

          <section
            aria-labelledby="sample-at-slot-heading"
            className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10"
          >
            <h3 id="sample-at-slot-heading" className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Microscope className="h-4 w-4 text-emerald-700 dark:text-emerald-300" aria-hidden />
              Exception: equipment where the sample is brought to the slot
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              For the following equipment, the advance submission deadline in point 1 does not apply. Bring your sample at
              the start of your slot; the Lab Operator records its receipt during the slot.
            </p>
            <SampleAtSlotList rows={equipment.rows} status={equipment.status} />
          </section>

          <section
            aria-labelledby="sample-example-heading"
            className="space-y-2 rounded-xl border border-sky-200 bg-sky-50/70 p-4 dark:border-sky-500/30 dark:bg-sky-500/10"
          >
            <h3 id="sample-example-heading" className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <CalendarClock className="h-4 w-4 text-sky-700 dark:text-sky-300" aria-hidden />
              {nextBooking && bookingSampleDeadline(nextBooking, equipment.rows).kind !== "unknown"
                ? "Your next booking"
                : "How the deadline is worked out"}
            </h3>
            <WorkedExample nextBooking={nextBooking} rows={equipment.rows} typicalLead={typicalLead} />
          </section>

          {resultsRows.length > 0 && <ResultsTimesSection rows={equipment.rows} />}
        </div>

        <DialogFooter className="border-t px-5 py-3 sm:px-6">
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

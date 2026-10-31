import { Check, Circle, CircleDot, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Where a booking stands from the user's side, as a row of steps (31 Oct 2026 committee: one guided, interactive
 * flow from booking to results). External users see payment and the label/requisition step; internal users go
 * straight from booking to sending the sample. Every step is derived from data the booking already carries.
 */
export type JourneyStepState = "done" | "current" | "todo" | "stopped";

export interface JourneyStep {
  key: string;
  label: string;
  state: JourneyStepState;
  /** What the user should do now (only on the current step). */
  hint?: string;
}

export interface JourneyBooking {
  status?: string | null;
  sample_trace?: Array<{ status: string }> | null;
  has_results?: boolean | null;
}

const STOPPED = new Set(["CANCELLED", "REFUNDED", "REJECTED", "BOOKING_NOT_UTILIZED", "ABSENT", "OTHER_DISRUPTION", "UNDER_MAINTENANCE"]);
const UNPAID = new Set(["PENDING_PAYMENT", "PAYMENT_PENDING", "AWAITING_PAYMENT"]);
const SENT = new Set(["SAMPLE_SENT", "HELD_AT_OFFICE", "FORWARDED_TO_LAB", "SAMPLE_ACCEPTED", "SAMPLE_REJECTED", "PROCESSING", "COMPLETED", "RETURNED", "ARCHIVED", "DISPOSED"]);
const RECEIVED = new Set(["FORWARDED_TO_LAB", "SAMPLE_ACCEPTED", "PROCESSING", "COMPLETED", "RETURNED", "ARCHIVED", "DISPOSED"]);
const ANALYSED = new Set(["PROCESSING", "COMPLETED", "RETURNED", "ARCHIVED", "DISPOSED"]);

export function journeySteps(booking: JourneyBooking, { external }: { external: boolean }): JourneyStep[] {
  const status = String(booking.status ?? "").toUpperCase();
  const trace = new Set((booking.sample_trace ?? []).map((e) => String(e.status).toUpperCase()));
  const has = (set: Set<string>) => [...trace].some((s) => set.has(s));
  const paid = !UNPAID.has(status) && status !== "PENDING_APPROVAL";
  const sent = has(SENT);
  const received = has(RECEIVED);
  const rejected = trace.has("SAMPLE_REJECTED");
  const analysed = has(ANALYSED) || status === "COMPLETED";
  const results = Boolean(booking.has_results) || status === "COMPLETED";

  const raw: Array<{ key: string; label: string; done: boolean; hint: string }> = [
    { key: "booked", label: "Booked", done: true, hint: "" },
    ...(external
      ? [{ key: "paid", label: "Paid", done: paid, hint: "Complete the payment to confirm the slot." }]
      : []),
    {
      key: "sent",
      label: external ? "Label and form, sample sent" : "Sample handed over",
      done: sent,
      hint: external
        ? "Download the shipping label and requisition form (one PDF), then send the sample and enter the courier details."
        : "Bring or send the sample to the lab and mark it as sent.",
    },
    { key: "received", label: "Received at the lab", done: received, hint: "The lab records the receipt against your booking ID." },
    { key: "analysis", label: "Analysis", done: analysed, hint: "The lab runs the analysis in your slot." },
    { key: "results", label: "Results", done: results, hint: "Results appear here and you are emailed." },
  ];

  // A completed booking has been through every step, whatever was recorded on the way.
  if (status === "COMPLETED") raw.forEach((s) => (s.done = true));
  const stopped = STOPPED.has(status) || rejected;
  let currentSet = false;
  return raw.map((s) => {
    if (s.done) return { key: s.key, label: s.label, state: "done" as const };
    if (!currentSet) {
      currentSet = true;
      return stopped
        ? { key: s.key, label: s.label, state: "stopped" as const, hint: rejected ? "The lab could not accept the sample; see the messages on this booking." : "This booking was closed before this step." }
        : { key: s.key, label: s.label, state: "current" as const, hint: s.hint };
    }
    return { key: s.key, label: s.label, state: "todo" as const };
  });
}

const ICON: Record<JourneyStepState, typeof Check> = { done: Check, current: CircleDot, todo: Circle, stopped: XCircle };

export function BookingJourney({ booking, external }: { booking: JourneyBooking; external: boolean }) {
  const steps = journeySteps(booking, { external });
  const current = steps.find((s) => s.state === "current" || s.state === "stopped");
  return (
    <section aria-label="Booking progress" className="space-y-2" data-testid="booking-journey">
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-2 text-xs">
        {steps.map((s, i) => {
          const Icon = ICON[s.state];
          return (
            <li key={s.key} className="flex items-center gap-1" aria-current={s.state === "current" ? "step" : undefined}>
              <span
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2 py-1",
                  s.state === "done" && "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100",
                  s.state === "current" && "border-primary bg-primary/10 font-semibold text-foreground",
                  s.state === "todo" && "text-muted-foreground",
                  s.state === "stopped" && "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100",
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{s.label}</span>
                <span className="sr-only">
                  {s.state === "done" ? " (done)" : s.state === "current" ? " (current step)" : s.state === "stopped" ? " (stopped)" : ""}
                </span>
              </span>
              {i < steps.length - 1 ? <span aria-hidden="true" className="text-muted-foreground">›</span> : null}
            </li>
          );
        })}
      </ol>
      {current?.hint ? <p className="text-xs text-muted-foreground" data-testid="journey-hint">Next: {current.hint}</p> : null}
    </section>
  );
}

export default BookingJourney;

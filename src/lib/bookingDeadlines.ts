import { format } from "date-fns";

/** Default owner cancel/reschedule window when the equipment does not set one (matches My Bookings). */
export const DEFAULT_RESCHEDULE_HOURS_THRESHOLD = 48;

const OWNER_ACTIONABLE_STATUSES = new Set(["PENDING", "BOOKED", "DISRUPTION_PENDING"]);

export interface DeadlineBookingFields {
  status?: string | null;
  start_time?: string | null;
  equipment_reschedule_hours_threshold?: number | null;
  maintenance_disruption_flag?: boolean | null;
  equipment_is_operational?: boolean | null;
  is_waitlist_entry?: boolean | null;
  source_booking_id?: number | null;
  virtual_booking_id?: string | null;
  /** Server rules for the viewer; false once the lab has accepted the sample, and for non-owners (block reason `*_owner_only`). */
  can_reschedule?: boolean | null;
  reschedule_block_reason?: string | null;
  can_cancel?: boolean | null;
  cancel_block_reason?: string | null;
}

export type DeadlineKind = "open" | "passed" | "disruption" | "disruption_waiting" | "waitlist" | "none";

export interface CancelRescheduleDeadline {
  kind: DeadlineKind;
  /** start_time − threshold hours; null when no time-based cutoff applies. */
  deadline: Date | null;
  /** Repeat bookings cannot be cancelled by the owner, only rescheduled. */
  rescheduleOnly: boolean;
  /** The lab has accepted the sample, so the owner / supervisor can no longer reschedule or cancel. */
  sampleLocked?: boolean;
}

export const DEADLINE_PASSED_TEXT = "Deadline passed — contact the Officer in Charge";
export const SAMPLE_ACCEPTED_LOCKED_TEXT =
  "Sample accepted by the lab — rescheduling and cancellation are no longer available. Use Message the lab if something has changed.";
export const RESCHEDULE_LOCKED_SAMPLE_ACCEPTED = "reschedule_locked_sample_accepted";
export const CANCEL_LOCKED_SAMPLE_ACCEPTED = "cancel_locked_sample_accepted";

export function isSampleAcceptedLocked(booking: DeadlineBookingFields): boolean {
  return (
    booking.reschedule_block_reason === RESCHEDULE_LOCKED_SAMPLE_ACCEPTED ||
    booking.cancel_block_reason === CANCEL_LOCKED_SAMPLE_ACCEPTED ||
    (booking.can_reschedule === false && !booking.reschedule_block_reason)
  );
}

/** Owner-facing Cancel / Reschedule buttons stay hidden when the server says no; unknown (null) leaves the local rules in charge. */
export function serverAllowsOwnerCancel(booking: DeadlineBookingFields): boolean {
  return booking.can_cancel !== false;
}

export function serverAllowsReschedule(booking: DeadlineBookingFields): boolean {
  return booking.can_reschedule !== false;
}

export function isWaitlistBooking(booking: DeadlineBookingFields): boolean {
  return String(booking.status || "").toUpperCase() === "WAITLISTED" || booking.is_waitlist_entry === true;
}

export function isRepeatBooking(booking: DeadlineBookingFields): boolean {
  return (
    booking.source_booking_id != null ||
    (typeof booking.virtual_booking_id === "string" && booking.virtual_booking_id.endsWith("R"))
  );
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

/**
 * Owner cancel/reschedule window, mirroring `isWithinThresholdWindow` / `canReschedule` in My Bookings:
 * allowed while status is PENDING/BOOKED/DISRUPTION_PENDING and hours until start ≥ threshold
 * (exact cutoff counts as open). Maintenance disruption bypasses the threshold.
 */
export function cancelRescheduleDeadline(booking: DeadlineBookingFields, now: Date): CancelRescheduleDeadline {
  const result = timeWindow(booking, now);
  if (isSampleAcceptedLocked(booking) && result.kind !== "waitlist" && result.kind !== "none") {
    return { ...result, sampleLocked: true };
  }
  return result;
}

function timeWindow(booking: DeadlineBookingFields, now: Date): CancelRescheduleDeadline {
  const rescheduleOnly = isRepeatBooking(booking);
  if (isWaitlistBooking(booking)) return { kind: "waitlist", deadline: null, rescheduleOnly: false };
  if (!OWNER_ACTIONABLE_STATUSES.has(String(booking.status || "").toUpperCase())) {
    return { kind: "none", deadline: null, rescheduleOnly };
  }
  if (booking.maintenance_disruption_flag) {
    const kind = booking.equipment_is_operational === false ? "disruption_waiting" : "disruption";
    return { kind, deadline: null, rescheduleOnly };
  }
  const start = parseDate(booking.start_time);
  if (!start) return { kind: "none", deadline: null, rescheduleOnly };
  const threshold = booking.equipment_reschedule_hours_threshold ?? DEFAULT_RESCHEDULE_HOURS_THRESHOLD;
  const deadline = new Date(start.getTime() - threshold * 60 * 60 * 1000);
  const open = start.getTime() > now.getTime() && now.getTime() <= deadline.getTime();
  return { kind: open ? "open" : "passed", deadline, rescheduleOnly };
}

/** Sample-trace stages that mean the lab has received the sample (backend `SAMPLE_ACCEPTED_OR_LATER_STATUSES`). */
export const RECEIVED_SAMPLE_STATUSES: ReadonlySet<string> = new Set([
  "SAMPLE_ACCEPTED",
  "PROCESSING",
  "COMPLETED",
  "RETURNED",
  "ARCHIVED",
  "DISPOSED",
]);

export interface SampleReceipt {
  received: boolean;
  /** Latest Sample Accepted time; null when the sample came to the slot or no receipt time was recorded. */
  receivedAt: Date | null;
}

/**
 * Mirrors backend `booking_sample_receipt`: received once a Sample Accepted (or later) stage exists or the
 * booking is Processing; walk-in equipment never records receipt, so its sample counts as received at the slot.
 */
export function sampleReceipt(
  trace: ReadonlyArray<{ status?: string | null; created_at?: string | null }> | null | undefined,
  { walkIn = false, bookingStatus }: { walkIn?: boolean; bookingStatus?: string | null } = {}
): SampleReceipt {
  const events = trace ?? [];
  const received = events.some((e) => RECEIVED_SAMPLE_STATUSES.has(String(e.status || "").toUpperCase()));
  const processing = String(bookingStatus || "").toUpperCase() === "PROCESSING";
  if (!received) return { received: walkIn || processing, receivedAt: null };
  const acceptedAt = events
    .filter((e) => String(e.status || "").toUpperCase() === "SAMPLE_ACCEPTED")
    .map((e) => parseDate(e.created_at))
    .filter((d): d is Date => d != null)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  return { received: true, receivedAt: acceptedAt ?? null };
}

/**
 * Results deadline anchor (backend `results_deadline_anchor`): none before receipt, otherwise the later of
 * the slot end and the receipt time (the slot end when no receipt time is known).
 */
export function resultsDeadlineAnchor(slotEnd: Date | null, receipt: SampleReceipt): Date | null {
  if (!slotEnd || !receipt.received) return null;
  if (receipt.receivedAt && receipt.receivedAt.getTime() > slotEnd.getTime()) return receipt.receivedAt;
  return slotEnd;
}

export type LifecycleCountdownPhase = "submit_sample" | "booking" | "collect_sample" | string;

export interface CountdownViewer {
  /** The booking user (a staff member's own booking counts as theirs). */
  isOwner: boolean;
  /** Officer in Charge, temporary OIC, Admin or Department Admin (the shared staff view of booking details). */
  isOicOrAdmin: boolean;
  /** Lab Operator / Lab in-charge. */
  isLabOperator: boolean;
}

/**
 * Booking-details countdowns are for the booking user (and faculty owner): the submit-sample countdown is
 * hidden from the OIC / Admin staff view, and the collect / discard countdown from that view and Lab Operators.
 */
export function lifecycleCountdownVisible(phase: LifecycleCountdownPhase | null | undefined, viewer: CountdownViewer): boolean {
  if (viewer.isOwner) return true;
  if (phase === "submit_sample") return !viewer.isOicOrAdmin;
  if (phase === "collect_sample") return !viewer.isOicOrAdmin && !viewer.isLabOperator;
  return true;
}

/** e.g. "Tue 7 Oct, 9:00 pm" (local time). */
export function formatDeadlineDateTime(date: Date): string {
  return format(date, "EEE d MMM, h:mm aaa");
}

export function formatDeadlineText(result: CancelRescheduleDeadline): string | null {
  if (result.sampleLocked) return SAMPLE_ACCEPTED_LOCKED_TEXT;
  switch (result.kind) {
    case "open":
      if (!result.deadline) return null;
      return `${result.rescheduleOnly ? "Reschedule" : "Cancel/reschedule"} until ${formatDeadlineDateTime(result.deadline)}`;
    case "passed":
      return DEADLINE_PASSED_TEXT;
    case "disruption":
      return result.rescheduleOnly
        ? "Reschedule anytime (equipment disruption)"
        : "Reschedule or cancel anytime (equipment disruption)";
    case "disruption_waiting":
      return result.rescheduleOnly
        ? "Reschedule opens when the equipment is working again"
        : "Reschedule opens when the equipment is working again; you can cancel anytime";
    case "waitlist":
      return "You can leave the waitlist anytime";
    default:
      return null;
  }
}

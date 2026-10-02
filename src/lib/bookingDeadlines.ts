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
  input_edit_refund_deadline?: string | null;
  /** Server rules for the viewer; false once the lab has accepted the sample. */
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
    booking.can_reschedule === false
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

/** Secondary line while a lower charge from editing sample details is still refunded instantly. */
export function inputEditRefundDeadlineText(booking: DeadlineBookingFields, now: Date): string | null {
  const deadline = parseDate(booking.input_edit_refund_deadline);
  if (!deadline || deadline.getTime() <= now.getTime()) return null;
  return `Edit sample details with refund until ${formatDeadlineDateTime(deadline)}`;
}

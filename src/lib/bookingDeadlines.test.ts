import { describe, expect, it } from "vitest";
import {
  DEADLINE_PASSED_TEXT,
  SAMPLE_ACCEPTED_LOCKED_TEXT,
  cancelRescheduleDeadline,
  formatDeadlineText,
  inputEditRefundDeadlineText,
  isSampleAcceptedLocked,
  serverAllowsOwnerCancel,
  serverAllowsReschedule,
} from "./bookingDeadlines";

// Local-time constructors keep these tests independent of the machine time zone.
const NOW = new Date(2026, 9, 2, 12, 0, 0);
const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute, 0);

const booking = (overrides: Record<string, unknown> = {}) => ({
  status: "BOOKED",
  start_time: at(9, 21).toISOString(),
  equipment_reschedule_hours_threshold: 48,
  ...overrides,
});

const LOCKED = {
  can_reschedule: false,
  reschedule_block_reason: "reschedule_locked_sample_accepted",
  can_cancel: false,
  cancel_block_reason: "cancel_locked_sample_accepted",
};

describe("cancel and reschedule locked after the lab accepts the sample", () => {
  it("replaces the deadline with one combined line and no cancel cutoff", () => {
    const result = cancelRescheduleDeadline(booking(LOCKED), NOW);
    expect(result.kind).toBe("open");
    expect(result.sampleLocked).toBe(true);
    expect(SAMPLE_ACCEPTED_LOCKED_TEXT).toBe(
      "Sample accepted by the lab — rescheduling and cancellation are no longer available. Use Message the lab if something has changed.",
    );
    const text = formatDeadlineText(result);
    expect(text).toBe(SAMPLE_ACCEPTED_LOCKED_TEXT);
    expect(text).not.toMatch(/cancel until/i);
  });

  it("detects the lock from either block reason", () => {
    for (const fields of [
      { cancel_block_reason: "cancel_locked_sample_accepted" },
      { reschedule_block_reason: "reschedule_locked_sample_accepted" },
      { can_reschedule: false },
    ]) {
      expect(isSampleAcceptedLocked(fields)).toBe(true);
      expect(formatDeadlineText(cancelRescheduleDeadline(booking(fields), NOW))).toBe(SAMPLE_ACCEPTED_LOCKED_TEXT);
    }
  });

  it("is not triggered by an owner-only cancel block (supervisor view)", () => {
    const fields = { can_cancel: false, cancel_block_reason: "cancel_owner_only", can_reschedule: true };
    expect(isSampleAcceptedLocked(fields)).toBe(false);
    expect(formatDeadlineText(cancelRescheduleDeadline(booking(fields), NOW))).toBe(
      "Cancel/reschedule until Wed 7 Oct, 9:00 pm",
    );
  });

  it("shows the combined line once the cutoff has passed, keeping kind passed", () => {
    const result = cancelRescheduleDeadline(booking(LOCKED), at(8, 9));
    expect(result.kind).toBe("passed");
    expect(formatDeadlineText(result)).toBe(SAMPLE_ACCEPTED_LOCKED_TEXT);
  });

  it("shows the combined line for repeat bookings", () => {
    const result = cancelRescheduleDeadline(booking({ ...LOCKED, source_booking_id: 7 }), NOW);
    expect(formatDeadlineText(result)).toBe(SAMPLE_ACCEPTED_LOCKED_TEXT);
  });

  it("is unaffected when the flags are true or unknown", () => {
    for (const v of [true, null, undefined]) {
      const result = cancelRescheduleDeadline(booking({ can_reschedule: v, can_cancel: v }), NOW);
      expect(result.sampleLocked).toBeUndefined();
      expect(formatDeadlineText(result)).toBe("Cancel/reschedule until Wed 7 Oct, 9:00 pm");
    }
  });

  it("does not add the locked text to bookings with no owner actions", () => {
    const result = cancelRescheduleDeadline(booking({ ...LOCKED, status: "COMPLETED" }), NOW);
    expect(formatDeadlineText(result)).toBeNull();
  });
});

describe("owner Cancel / Reschedule button visibility from server flags", () => {
  it("hides both once the lab has accepted the sample", () => {
    expect(serverAllowsOwnerCancel(LOCKED)).toBe(false);
    expect(serverAllowsReschedule(LOCKED)).toBe(false);
  });

  it("hides Cancel for a supervisor (owner-only) while Reschedule follows its own flag", () => {
    const supervisor = { can_cancel: false, cancel_block_reason: "cancel_owner_only", can_reschedule: true };
    expect(serverAllowsOwnerCancel(supervisor)).toBe(false);
    expect(serverAllowsReschedule(supervisor)).toBe(true);
  });

  it("shows both before acceptance, and when the server did not say (older payloads)", () => {
    for (const v of [true, null, undefined]) {
      expect(serverAllowsOwnerCancel({ can_cancel: v })).toBe(true);
      expect(serverAllowsReschedule({ can_reschedule: v })).toBe(true);
    }
  });
});

describe("cancelRescheduleDeadline", () => {
  it("is open before the cutoff and formats the deadline", () => {
    const result = cancelRescheduleDeadline(booking(), NOW);
    expect(result.kind).toBe("open");
    expect(result.deadline?.getTime()).toBe(at(7, 21).getTime());
    expect(formatDeadlineText(result)).toBe("Cancel/reschedule until Wed 7 Oct, 9:00 pm");
  });

  it("counts the exact cutoff moment as open", () => {
    const result = cancelRescheduleDeadline(booking(), at(7, 21));
    expect(result.kind).toBe("open");
  });

  it("is passed one minute after the cutoff", () => {
    const result = cancelRescheduleDeadline(booking(), at(7, 21, 1));
    expect(result.kind).toBe("passed");
    expect(formatDeadlineText(result)).toBe(DEADLINE_PASSED_TEXT);
    expect(DEADLINE_PASSED_TEXT).toBe("Deadline passed — contact the Officer in Charge");
  });

  it("is passed once the booking has started, even with a zero threshold", () => {
    const result = cancelRescheduleDeadline(
      booking({ equipment_reschedule_hours_threshold: 0, start_time: at(2, 12).toISOString() }),
      NOW,
    );
    expect(result.kind).toBe("passed");
  });

  it("defaults to a 48 hour threshold when missing or null", () => {
    for (const threshold of [undefined, null]) {
      const result = cancelRescheduleDeadline(booking({ equipment_reschedule_hours_threshold: threshold }), NOW);
      expect(result.deadline?.getTime()).toBe(at(7, 21).getTime());
    }
  });

  it("uses the equipment threshold when set", () => {
    const result = cancelRescheduleDeadline(booking({ equipment_reschedule_hours_threshold: 24 }), NOW);
    expect(result.deadline?.getTime()).toBe(at(8, 21).getTime());
  });

  it("applies to PENDING and DISRUPTION_PENDING too", () => {
    expect(cancelRescheduleDeadline(booking({ status: "PENDING" }), NOW).kind).toBe("open");
    expect(cancelRescheduleDeadline(booking({ status: "disruption_pending" }), NOW).kind).toBe("open");
  });

  it("returns none for statuses the owner cannot change", () => {
    for (const status of ["COMPLETED", "CANCELLED", "HOLD", "PENDING_PAYMENT", "REFUNDED"]) {
      const result = cancelRescheduleDeadline(booking({ status }), NOW);
      expect(result.kind).toBe("none");
      expect(formatDeadlineText(result)).toBeNull();
    }
  });

  it("returns none when start_time is missing or invalid", () => {
    expect(cancelRescheduleDeadline(booking({ start_time: undefined }), NOW).kind).toBe("none");
    expect(cancelRescheduleDeadline(booking({ start_time: "" }), NOW).kind).toBe("none");
    expect(cancelRescheduleDeadline(booking({ start_time: "not a date" }), NOW).kind).toBe("none");
  });

  it("allows reschedule anytime under a maintenance disruption, ignoring the threshold", () => {
    const result = cancelRescheduleDeadline(
      booking({ maintenance_disruption_flag: true, start_time: at(2, 13).toISOString() }),
      NOW,
    );
    expect(result).toMatchObject({ kind: "disruption", deadline: null });
    expect(formatDeadlineText(result)).toBe("Reschedule or cancel anytime (equipment disruption)");
  });

  it("waits for the equipment to work again when it is not operational", () => {
    const result = cancelRescheduleDeadline(
      booking({ maintenance_disruption_flag: true, equipment_is_operational: false }),
      NOW,
    );
    expect(result.kind).toBe("disruption_waiting");
    expect(formatDeadlineText(result)).toMatch(/^Reschedule opens when the equipment is working again/);
  });

  it("tells waitlisted users they can leave anytime", () => {
    for (const b of [booking({ status: "WAITLISTED" }), booking({ status: "PENDING", is_waitlist_entry: true })]) {
      const result = cancelRescheduleDeadline(b, NOW);
      expect(result).toMatchObject({ kind: "waitlist", deadline: null });
      expect(formatDeadlineText(result)).toBe("You can leave the waitlist anytime");
    }
  });

  it("omits cancel wording for repeat bookings", () => {
    for (const b of [booking({ source_booking_id: 12 }), booking({ virtual_booking_id: "XRD-0042R" })]) {
      const result = cancelRescheduleDeadline(b, NOW);
      expect(result.rescheduleOnly).toBe(true);
      expect(formatDeadlineText(result)).toBe("Reschedule until Wed 7 Oct, 9:00 pm");
    }
    const disrupted = cancelRescheduleDeadline(booking({ source_booking_id: 12, maintenance_disruption_flag: true }), NOW);
    expect(formatDeadlineText(disrupted)).not.toMatch(/cancel/i);
  });
});

describe("inputEditRefundDeadlineText", () => {
  it("shows the refund window while it is in the future", () => {
    expect(inputEditRefundDeadlineText({ input_edit_refund_deadline: at(3, 9, 30).toISOString() }, NOW)).toBe(
      "Edit sample details with refund until Sat 3 Oct, 9:30 am",
    );
  });

  it("returns null when missing, invalid or past", () => {
    expect(inputEditRefundDeadlineText({}, NOW)).toBeNull();
    expect(inputEditRefundDeadlineText({ input_edit_refund_deadline: "nope" }, NOW)).toBeNull();
    expect(inputEditRefundDeadlineText({ input_edit_refund_deadline: at(1, 9).toISOString() }, NOW)).toBeNull();
  });
});

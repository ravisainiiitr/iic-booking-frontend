import { describe, expect, it } from "vitest";
import { slotIsAutoPickable } from "./slotAutoPick";

const now = new Date("2026-11-04T10:00:00+05:30").getTime();

describe("automatic slot picks", () => {
  it("never picks a past slot, for staff too", () => {
    expect(slotIsAutoPickable({ status: "AVAILABLE", start_datetime: "2026-11-02T09:00:00+05:30" }, { now })).toBe(false);
    expect(slotIsAutoPickable({ status: "AVAILABLE", start_datetime: "2026-11-04T15:00:00+05:30" }, { now })).toBe(true);
  });

  it("uses the real start, not the operating date (MCU 03:00 slot of the previous cycle)", () => {
    // Tuesday's cycle 03:00 slot starts Wednesday 03:00, already past at Wednesday 10:00.
    expect(slotIsAutoPickable({ status: "AVAILABLE", start_datetime: "2026-11-04T03:00:00+05:30" }, { now })).toBe(false);
    // Wednesday's cycle 03:00 slot starts Thursday 03:00.
    expect(slotIsAutoPickable({ status: "AVAILABLE", start_datetime: "2026-11-05T03:00:00+05:30" }, { now })).toBe(true);
  });

  it("only picks open slots", () => {
    const later = "2026-11-06T09:00:00+05:30";
    for (const status of ["BOOKED", "NOT_AVAILABLE", "UNDER_MAINTENANCE", "BLOCKED", "OPERATOR_ABSENT", "RESERVED_EXTERNAL"]) {
      expect(slotIsAutoPickable({ status, start_datetime: later }, { now }), status).toBe(false);
    }
    expect(slotIsAutoPickable({ status: "AVAILABLE", booking_id: 9, start_datetime: later }, { now })).toBe(false);
    expect(slotIsAutoPickable({ status: "RESERVED_EXTERNAL", start_datetime: later }, { now, forExternal: true })).toBe(true);
  });
});

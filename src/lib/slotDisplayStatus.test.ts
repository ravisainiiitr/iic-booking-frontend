import { describe, expect, it } from "vitest";
import { isCompletedSlot, slotShownStatus } from "./slotDisplayStatus";

describe("slotShownStatus", () => {
  it("shows a Booked slot of a completed booking as Completed", () => {
    expect(slotShownStatus({ status: "BOOKED", display_status: "COMPLETED", booking_status: "COMPLETED" })).toBe("COMPLETED");
  });

  it("falls back to booking_status when display_status is missing", () => {
    expect(slotShownStatus({ status: "BOOKED", booking_status: "COMPLETED" })).toBe("COMPLETED");
    expect(isCompletedSlot({ status: "BOOKED", booking_status: "completed" })).toBe(true);
  });

  it("keeps open bookings and other statuses as they are", () => {
    expect(slotShownStatus({ status: "BOOKED", display_status: "BOOKED", booking_status: "BOOKED" })).toBe("BOOKED");
    expect(slotShownStatus({ status: "BOOKED", booking_status: "PENDING" })).toBe("BOOKED");
    expect(slotShownStatus({ status: "AVAILABLE" })).toBe("AVAILABLE");
    expect(slotShownStatus({ status: "BOOKING_NOT_UTILIZED", booking_status: "COMPLETED" })).toBe("BOOKING_NOT_UTILIZED");
    expect(slotShownStatus(null)).toBe("");
  });
});

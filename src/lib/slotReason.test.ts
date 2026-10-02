import { describe, expect, it } from "vitest";

import { shortSlotReason, slotAccessibleLabel, unavailableBookingSlotReason, type SlotReasonInput } from "./slotReason";

const base: SlotReasonInput = {
  slotExists: true,
  isDisabled: true,
  isSelected: false,
  isPast: false,
  considerBooked: false,
  isSaturdayCol: false,
  isSundayCol: false,
  slotStatusUpper: "AVAILABLE",
  slotStatusLabel: "",
  deptBlockedForUser: false,
  notConsecutive: false,
  limitReached: false,
  wouldExceedLimit: false,
  chargeNotCalculated: false,
  isAdminOrOic: false,
};

describe("slot reason", () => {
  it("returns nothing for bookable or selected slots", () => {
    expect(unavailableBookingSlotReason({ ...base, isDisabled: false })).toBeNull();
    expect(unavailableBookingSlotReason({ ...base, isSelected: true })).toBeNull();
  });

  it("explains each kind of greyed-out slot", () => {
    expect(unavailableBookingSlotReason({ ...base, considerBooked: true })).toBe("Already booked by someone else.");
    expect(unavailableBookingSlotReason({ ...base, considerBooked: true, justTaken: true })).toMatch(/just before you/);
    expect(unavailableBookingSlotReason({ ...base, slotStatusUpper: "UNDER_MAINTENANCE" })).toMatch(/maintenance/);
    expect(unavailableBookingSlotReason({ ...base, slotExists: false, holidayName: "Diwali" })).toMatch(/Holiday \(Diwali\)/);
    expect(unavailableBookingSlotReason({ ...base, isPast: true })).toBe("This time has already passed.");
    expect(unavailableBookingSlotReason({ ...base, overQuotaReason: "Only 30 min left this week." })).toBe("Only 30 min left this week.");
    expect(unavailableBookingSlotReason({ ...base, notConsecutive: true })).toMatch(/back-to-back/);
    expect(unavailableBookingSlotReason({ ...base, chargeNotCalculated: true })).toMatch(/Step 1/);
    expect(unavailableBookingSlotReason({ ...base, walletLinkRequired: true })).toMatch(/wallet/);
  });

  it("puts a real slot status ahead of quota or selection rules", () => {
    expect(
      unavailableBookingSlotReason({ ...base, considerBooked: true, overQuotaReason: "Over quota" }),
    ).toBe("Already booked by someone else.");
  });

  it("builds screen-reader labels", () => {
    const date = new Date(2026, 9, 7);
    expect(slotAccessibleLabel({ date, start: "10:00", end: "11:30", state: "available" })).toBe("Wed 7 Oct, 10:00–11:30, available");
    expect(slotAccessibleLabel({ date, start: "10:00", end: "11:30", state: "unavailable", shortReason: "booked" })).toBe(
      "Wed 7 Oct, 10:00–11:30, unavailable: booked",
    );
    expect(slotAccessibleLabel({ date, start: "10:00", state: "selected" })).toBe("Wed 7 Oct, 10:00, selected");
  });

  it("shortens reasons for labels", () => {
    expect(shortSlotReason("Already booked (#12).")).toBe("booked");
    expect(shortSlotReason("The equipment is under maintenance at this time.")).toBe("maintenance");
    expect(shortSlotReason("This booking needs 90 min but you only have 60 min left this week.")).toBe("over your quota");
    expect(shortSlotReason(null)).toBeNull();
  });
});

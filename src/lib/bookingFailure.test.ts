import { describe, expect, it } from "vitest";

import { classifyBookingFailure, droppedSlotsNotice, partitionSelectionAfterRefresh } from "./bookingFailure";

describe("classifyBookingFailure", () => {
  it("recognises the common backend messages", () => {
    expect(classifyBookingFailure("You don't have access to any wallet.")).toBe("no_wallet");
    expect(classifyBookingFailure("Slots [12] are not available for booking.")).toBe("slot_taken");
    expect(classifyBookingFailure("One or more slots are invalid or not available.")).toBe("slot_taken");
    expect(classifyBookingFailure("Booking unsuccessful. All slots are occupied.")).toBe("slot_taken");
    expect(classifyBookingFailure("Weekly quota exceeded for XPS")).toBe("quota");
    expect(classifyBookingFailure("Insufficient wallet balance")).toBe("insufficient_funds");
    expect(classifyBookingFailure("Your wallet does not have enough balance for this booking.")).toBe("insufficient_funds");
    expect(classifyBookingFailure("Anything", { waitlist_full: true })).toBe("waitlist_full");
    expect(classifyBookingFailure("Something odd")).toBe("other");
  });
});

describe("keeping the form after a failed booking", () => {
  const selected = [
    { slotId: 1, slotData: { id: 1, start_datetime: "2026-10-08T10:00:00+05:30" }, time: "10:00" },
    { slotId: 2, slotData: { id: 2, start_datetime: "2026-10-08T11:00:00+05:30" }, time: "11:00" },
    { slotId: 3, slotData: { id: 3, start_datetime: "2026-10-08T12:00:00+05:30" }, time: "12:00" },
  ];

  it("keeps still-free slots and drops the taken or vanished ones", () => {
    const fresh = [
      { id: 1, start_datetime: "2026-10-08T10:00:00+05:30", status: "AVAILABLE" },
      { id: 2, start_datetime: "2026-10-08T11:00:00+05:30", status: "BOOKED" },
    ];
    const { keep, dropped } = partitionSelectionAfterRefresh(selected, fresh, (s) => s.status === "AVAILABLE");
    expect(keep.map((s) => s.slotId)).toEqual([1]);
    expect(keep[0].slotData.status).toBe("AVAILABLE");
    expect(dropped.map((s) => s.slotId)).toEqual([2, 3]);
  });

  it("matches by start time when slot ids were regenerated", () => {
    const fresh = [{ id: 99, start_datetime: "2026-10-08T10:00:00+05:30", status: "AVAILABLE" }];
    const { keep } = partitionSelectionAfterRefresh(selected.slice(0, 1), fresh, () => true);
    expect(keep[0].slotData.id).toBe(99);
  });

  it("explains what happened", () => {
    expect(droppedSlotsNotice(0)).toBe("");
    expect(droppedSlotsNotice(1)).toMatch(/^1 of your selected slots was taken/);
    expect(droppedSlotsNotice(2)).toMatch(/^2 of your selected slots were taken/);
    expect(droppedSlotsNotice(1)).not.toMatch(/details are kept/i);
  });
});

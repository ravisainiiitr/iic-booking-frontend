import { describe, expect, it } from "vitest";
import {
  BASE_MODE_COLOR,
  bookingPathFor,
  cardHeadline,
  describeModeWeekdays,
  familyColors,
  formatDay,
  isMultiModeEquipment,
  modeHeadline,
  shortStatus,
  weeksOf,
} from "./modeAvailability";
import { modeColor } from "./multiMode";

describe("modeAvailability helpers", () => {
  it("colours the base slate and modes like the Multi-mode equipment page", () => {
    const colors = familyColors([
      { equipment_id: 1, role: "base" },
      { equipment_id: 5, role: "mode" },
      { equipment_id: 3, role: "mode" },
    ]);
    expect(colors.get(1)).toBe(BASE_MODE_COLOR);
    expect(colors.get(5)).toBe(modeColor([5, 3], 5));
    expect(colors.get(3)).not.toBe(colors.get(5));
  });

  it("formats dates without time-zone shifts", () => {
    expect(formatDay("2030-01-10")).toBe("Thu, 10 Jan");
    expect(formatDay("2030-01-13")).toBe("Sun, 13 Jan");
  });

  it("gives short cell statuses", () => {
    expect(shortStatus({ status: "available", free_slots: 3, label: "" })).toBe("3 free");
    expect(shortStatus({ status: "full", label: "" })).toBe("Full");
    expect(shortStatus({ status: "not_open", opens_at: "2030-01-09T21:00:00", label: "" })).toBe("Opens Wed");
    expect(shortStatus({ status: "not_available", label: "No slots" })).toBe("Unavailable");
  });

  it("summarises a mode for the legend and the card", () => {
    const available = { state: "available" as const, next_available: { date: "2030-01-10", free_slots: 2 }, next_opening: null };
    expect(modeHeadline(available)).toBe("Next available: Thu, 10 Jan");
    expect(cardHeadline(available, true)).toBe("Thu, 10 Jan");
    const full = { state: "full" as const, next_available: null, next_opening: { date: "2030-01-15", opens_at: "2030-01-09T21:00:00" } };
    expect(modeHeadline(full)).toBe("Fully booked for now · more from Tue, 15 Jan");
    expect(cardHeadline(full)).toBe("Fully booked for now");
    const later = { state: "not_open" as const, next_available: null, next_opening: full.next_opening };
    expect(cardHeadline(later)).toBe("Booking opens Wed, 9 Jan, 9:00 PM");
    expect(cardHeadline(later, true)).toBe("Opens Wed, 9 Jan");
    expect(cardHeadline({ state: "maintenance", next_available: null, next_opening: null })).toBe("Under maintenance");
  });

  it("describes weekday patterns", () => {
    expect(describeModeWeekdays([1, 3])).toBe("Runs Tue, Thu");
    expect(describeModeWeekdays([])).toBe("No running days in the next 4 weeks");
    expect(describeModeWeekdays([0, 1, 2, 3, 4, 5, 6])).toBe("Runs every day");
  });

  it("splits days into Monday-first weeks and builds booking links", () => {
    const days = Array.from({ length: 14 }, (_, i) => ({ weekday: i % 7 }));
    expect(weeksOf(days).map((w) => w.length)).toEqual([7, 7]);
    expect(bookingPathFor(7, "2030-01-10")).toBe("/book-equipment?equipment_id=7&date=2030-01-10");
    expect(bookingPathFor(7, null, true)).toBe("/book-equipment?equipment_id=7&mode=book");
  });

  it("recognises multi-mode equipment", () => {
    expect(isMultiModeEquipment({ enable_multi_mode: true })).toBe(true);
    expect(isMultiModeEquipment({ parent_equipment: 4 })).toBe(true);
    expect(isMultiModeEquipment({ parent_equipment: null, enable_multi_mode: false })).toBe(false);
    expect(isMultiModeEquipment(null)).toBe(false);
  });
});

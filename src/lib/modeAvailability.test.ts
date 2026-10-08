import { describe, expect, it } from "vitest";
import {
  BASE_MODE_COLOR,
  bookingPathFor,
  describeModeWeekdays,
  familyColors,
  formatDay,
  isMultiModeEquipment,
  modeHeadline,
  modeSummaryText,
  modesForHeader,
  shortStatus,
  weekdayRange,
  weeksOf,
} from "./modeAvailability";
import { modeColor } from "./multiMode";

describe("header summary", () => {
  it("compacts running days into ranges", () => {
    expect(weekdayRange([0, 1, 2, 3, 4])).toBe("Mon–Fri");
    expect(weekdayRange([4, 0, 2])).toBe("Mon/Wed/Fri");
    expect(weekdayRange([0, 1, 2, 4])).toBe("Mon–Wed/Fri");
    expect(weekdayRange([5, 6])).toBe("Sat/Sun");
    expect(weekdayRange([0, 1, 2, 3, 4, 5, 6])).toBe("Daily");
    expect(weekdayRange([])).toBe("");
  });

  it("describes each mode's state in a few words", () => {
    const base = { weekdays: [0, 1, 2, 3, 4], next_available: null, next_opening: null };
    expect(modeSummaryText({ ...base, state: "available", next_available: { date: "2026-10-21", free_slots: 3 } })).toBe(
      "Mon–Fri · next Wed 21 Oct",
    );
    expect(modeSummaryText({ ...base, state: "full", next_opening: { date: "2026-10-21", opens_at: "2026-10-14T21:00:00" } })).toBe(
      "Mon–Fri · full until Wed 21 Oct",
    );
    expect(
      modeSummaryText({ ...base, state: "full", next_opening: { date: "2026-10-21", opens_at: "2026-10-14T21:00:00" } }, true),
    ).toBe("Mon–Fri · full");
    expect(modeSummaryText({ ...base, state: "not_open", next_opening: { date: "2026-10-21", opens_at: "2026-10-14T21:00:00" } })).toBe(
      "Mon–Fri · opens Wed 14 Oct",
    );
    expect(modeSummaryText({ ...base, state: "maintenance" })).toBe("Mon–Fri · maintenance");
    expect(modeSummaryText({ ...base, weekdays: [], state: "not_running" })).toBe("not scheduled");
  });

  it("leads with the current mode", () => {
    const modes = [{ equipment_id: 1 }, { equipment_id: 2 }, { equipment_id: 3 }];
    expect(modesForHeader(modes, 3).map((m) => m.equipment_id)).toEqual([3, 1, 2]);
    expect(modesForHeader(modes, 1).map((m) => m.equipment_id)).toEqual([1, 2, 3]);
  });
});

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
    expect(shortStatus({ status: "not_open", opens_at: "2030-01-09T21:00:00", label: "" })).toBe("Opens 9 Jan");
    expect(shortStatus({ status: "not_available", label: "No slots" })).toBe("Unavailable");
  });

  it("summarises a mode for the legend", () => {
    const available = { state: "available" as const, next_available: { date: "2030-01-10", free_slots: 2 }, next_opening: null };
    expect(modeHeadline(available)).toBe("Next available: Thu, 10 Jan");
    const full = { state: "full" as const, next_available: null, next_opening: { date: "2030-01-15", opens_at: "2030-01-09T21:00:00" } };
    expect(modeHeadline(full)).toBe("Fully booked for now · more from Tue, 15 Jan");
    const later = { state: "not_open" as const, next_available: null, next_opening: full.next_opening };
    expect(modeHeadline(later)).toBe("Next runs Tue, 15 Jan · booking opens Wed, 9 Jan, 9:00 PM");
    expect(modeHeadline({ state: "maintenance", next_available: null, next_opening: null })).toBe("Under maintenance");
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

import { describe, expect, it } from "vitest";
import { describeHours, describeWeekdays, modeColor, monthGrid, scheduleCoversDate, weekdayOf } from "./multiMode";

describe("weekdayOf", () => {
  it("uses Monday = 0 like the server", () => {
    expect(weekdayOf("2026-10-05")).toBe(0);
    expect(weekdayOf("2026-10-11")).toBe(6);
  });
});

describe("scheduleCoversDate", () => {
  const base = { start_date: "2026-10-01", end_date: "2026-10-31" };

  it("covers every day in range when no weekdays are picked", () => {
    expect(scheduleCoversDate({ ...base, weekdays: [] }, "2026-10-01")).toBe(true);
    expect(scheduleCoversDate({ ...base, weekdays: [] }, "2026-10-31")).toBe(true);
    expect(scheduleCoversDate({ ...base, weekdays: [] }, "2026-11-01")).toBe(false);
  });

  it("only covers the picked weekdays", () => {
    const monThu = { ...base, weekdays: [0, 3] };
    expect(scheduleCoversDate(monThu, "2026-10-05")).toBe(true);
    expect(scheduleCoversDate(monThu, "2026-10-08")).toBe(true);
    expect(scheduleCoversDate(monThu, "2026-10-06")).toBe(false);
  });
});

describe("monthGrid", () => {
  it("starts weeks on Monday and pads outside days", () => {
    const weeks = monthGrid(2026, 9);
    expect(weeks[0].slice(0, 3)).toEqual([null, null, null]);
    expect(weeks[0][3]).toBe("2026-10-01");
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });
});

describe("labels", () => {
  it("describes weekdays and hours in plain words", () => {
    expect(describeWeekdays([])).toBe("Every day");
    expect(describeWeekdays([3, 0])).toBe("Mon, Thu");
    expect(describeHours(null, null)).toBe("All day");
    expect(describeHours("09:00:00", "13:00:00")).toBe("09:00–13:00");
  });

  it("keeps a stable colour per mode", () => {
    expect(modeColor([11, 12], 12)).toBe(modeColor([11, 12], 12));
    expect(modeColor([11, 12], 11)).not.toBe(modeColor([11, 12], 12));
  });
});

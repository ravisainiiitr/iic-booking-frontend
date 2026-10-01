import { describe, expect, it } from "vitest";
import {
  buildWeeklySlotRows,
  consecutiveRun,
  describeWeeklySelection,
  formatDurationMinutes,
  preferredSlotDraftProblem,
  rowIndexForStart,
  runProblemMessage,
  slotsRequiredForMinutes,
  validRunStarts,
} from "./weeklySlotTemplate";

const masters = (pairs: Array<[string, string, boolean?]>) =>
  pairs.map(([open_time, close_time, is_active = true]) => ({ open_time, close_time, is_active }));

describe("buildWeeklySlotRows", () => {
  it("uses active slot masters with their real open and close times, sorted", () => {
    const rows = buildWeeklySlotRows({
      slot_duration_minutes: 90,
      slot_masters: masters([
        ["10:30:00", "12:00:00"],
        ["09:00:00", "10:30:00"],
        ["13:00:00", "14:30:00"],
        ["15:00:00", "16:30:00", false],
      ]),
    });
    expect(rows.map((r) => r.key)).toEqual(["09:00", "10:30", "13:00"]);
    expect(rows.map((r) => r.label)).toEqual(["09:00 – 10:30", "10:30 – 12:00", "13:00 – 14:30"]);
    expect(rows[0]).toMatchObject({ start: 540, end: 630 });
  });

  it("treats a 00:00 close or a close before open as ending after midnight", () => {
    const rows = buildWeeklySlotRows({ slot_masters: masters([["18:00", "00:00"], ["22:00", "01:00"]]) });
    expect(rows[0]).toMatchObject({ start: 1080, end: 1440, timeRange: "18:00 – 00:00" });
    expect(rows[1]).toMatchObject({ start: 1320, end: 1500 });
  });

  it("falls back to slot master open times plus the slot duration", () => {
    const rows = buildWeeklySlotRows({ slot_duration_minutes: 45, slot_master_times: ["09:00:00", "09:45:00"] });
    expect(rows.map((r) => [r.key, r.end])).toEqual([
      ["09:00", 585],
      ["09:45", 630],
    ]);
  });

  it("falls back to the slot window split by the slot duration, dropping a partial last slot", () => {
    const rows = buildWeeklySlotRows({ slot_start_time: "09:00", slot_end_time: "13:00", slot_duration_minutes: 90 });
    expect(rows.map((r) => r.timeRange)).toEqual(["09:00 – 10:30", "10:30 – 12:00"]);
  });

  it("returns no rows when the equipment has no slot timings", () => {
    expect(buildWeeklySlotRows({ slot_duration_minutes: 60 })).toEqual([]);
    expect(buildWeeklySlotRows(null)).toEqual([]);
  });

  it("keeps only slots fully inside the weekly view window when asked", () => {
    const source = {
      slot_masters: masters([["08:00", "09:00"], ["09:00", "10:00"], ["17:00", "18:00"]]),
      weekly_view_time_from: "09:00",
      weekly_view_time_to: "17:30",
    };
    expect(buildWeeklySlotRows(source).length).toBe(3);
    expect(buildWeeklySlotRows(source, { applyVisibilityWindow: true }).map((r) => r.key)).toEqual(["09:00"]);
  });

  it("labels rows by slot position when the equipment hides times", () => {
    const rows = buildWeeklySlotRows({ slot_masters: masters([["09:00", "10:00"], ["10:00", "11:00"]]) }, { hideTimes: true });
    expect(rows.map((r) => r.label)).toEqual(["Slot 1", "Slot 2"]);
    expect(rows[1].timeRange).toBe("10:00 – 11:00");
  });
});

describe("consecutive selection", () => {
  // 09:00–10:30, 10:30–12:00, lunch break, 13:00–14:30, 14:30–16:00
  const rows = buildWeeklySlotRows({
    slot_masters: masters([
      ["09:00", "10:30"],
      ["10:30", "12:00"],
      ["13:00", "14:30"],
      ["14:30", "16:00"],
    ]),
  });

  it("selects N back-to-back slots from the start row", () => {
    const run = consecutiveRun(rows, 0, 2);
    expect(run.ok).toBe(true);
    if (run.ok) {
      expect(run.rows.map((r) => r.key)).toEqual(["09:00", "10:30"]);
      expect(run.minutes).toBe(180);
    }
  });

  it("blocks a run that crosses a break", () => {
    const run = consecutiveRun(rows, 1, 2);
    expect(run).toMatchObject({ ok: false, reason: "break" });
    expect(runProblemMessage(run, 2)).toContain("cross a break at 12:00");
  });

  it("blocks a run past the day's last slot", () => {
    const run = consecutiveRun(rows, 3, 2);
    expect(run).toMatchObject({ ok: false, reason: "past_end" });
    expect(runProblemMessage(run, 2)).toContain("past the last slot");
    expect(consecutiveRun(rows, 0, 5)).toMatchObject({ ok: false, reason: "past_end" });
  });

  it("lists the valid start rows for a slot count", () => {
    expect([...validRunStarts(rows, 1)]).toEqual([0, 1, 2, 3]);
    expect([...validRunStarts(rows, 2)]).toEqual([0, 2]);
    expect([...validRunStarts(rows, 3)]).toEqual([]);
  });

  it("finds the row of a saved start time", () => {
    expect(rowIndexForStart(rows, "13:00")).toBe(2);
    expect(rowIndexForStart(rows, "13:15")).toBe(-1);
    expect(rowIndexForStart(rows, "")).toBe(-1);
  });

  it("summarises the weekly selection", () => {
    const run = consecutiveRun(rows, 2, 2);
    expect(run.ok).toBe(true);
    if (run.ok) {
      expect(describeWeeklySelection(2, run.rows)).toBe("Every Wednesday, 13:00–16:00 (2 slots)");
      const hidden = buildWeeklySlotRows({ slot_masters: masters([["09:00", "10:00"]]) }, { hideTimes: true });
      expect(describeWeeklySelection(0, hidden, true)).toBe("Every Monday, Slot 1 (1 slot)");
    }
  });
});

describe("preferredSlotDraftProblem", () => {
  const rows = buildWeeklySlotRows({ slot_masters: masters([["09:00", "10:00"], ["10:00", "11:00"]]) });
  const draft = { enabled: true, weekday: 2, startTime: "09:00", slotCount: 2 };

  it("accepts an aligned run or a disabled preference", () => {
    expect(preferredSlotDraftProblem(draft, rows)).toBeNull();
    expect(preferredSlotDraftProblem({ ...draft, enabled: false, startTime: "" }, rows)).toBeNull();
  });

  it("asks to choose or reselect otherwise", () => {
    expect(preferredSlotDraftProblem({ ...draft, startTime: "" }, rows)).toContain("Choose your preferred slot");
    expect(preferredSlotDraftProblem({ ...draft, startTime: "09:30" }, rows)).toContain("no longer matches");
    expect(preferredSlotDraftProblem({ ...draft, weekday: 5 }, rows)).toContain("no longer matches");
    expect(preferredSlotDraftProblem({ ...draft, startTime: "10:00" }, rows)).toContain("no longer matches");
  });
});

describe("slotsRequiredForMinutes", () => {
  it("matches the booking page's slot count rule", () => {
    expect(slotsRequiredForMinutes(180, { slot_duration_minutes: 90 })).toBe(2);
    expect(slotsRequiredForMinutes(181, { slot_duration_minutes: 90 })).toBe(3);
    expect(slotsRequiredForMinutes(100, { slot_duration_minutes: 90, slot_tolerance_minutes: 10 })).toBe(1);
    expect(slotsRequiredForMinutes(30, { slot_duration_minutes: null })).toBe(1);
  });

  it("is unknown without an analysis time", () => {
    expect(slotsRequiredForMinutes(null, { slot_duration_minutes: 60 })).toBeNull();
    expect(slotsRequiredForMinutes(0, { slot_duration_minutes: 60 })).toBeNull();
  });
});

describe("formatDurationMinutes", () => {
  it("reads naturally", () => {
    expect(formatDurationMinutes(180)).toBe("3 hours");
    expect(formatDurationMinutes(90)).toBe("1 hour 30 min");
    expect(formatDurationMinutes(45)).toBe("45 min");
  });
});

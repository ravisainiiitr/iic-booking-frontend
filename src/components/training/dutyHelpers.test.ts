import { describe, expect, it } from "vitest";
import type { CalendarSlot, FairnessRow } from "@/lib/trainingOpsTypes";
import {
  academicYearChoices,
  dutyFormProblem,
  formatHours,
  periodQuery,
  groupSlotsByDay,
  mergeSelectedSlots,
  nextInRotation,
  planPayload,
  recentMonths,
  slotSelectable,
  type DutyFormState,
} from "./dutyHelpers";

const slot = (id: number, start: string, end: string, status = "AVAILABLE"): CalendarSlot => ({
  id,
  start_at: start,
  end_at: end,
  status,
  booked: false,
});

const form = (patch: Partial<DutyFormState> = {}): DutyFormState => ({
  mode: "range",
  slotIds: [],
  dateFrom: "2026-11-02",
  dateTo: "2026-11-06",
  timeFrom: "09:00",
  timeTo: "13:00",
  weekdays: [0, 1, 2, 3, 4],
  ...patch,
});

describe("dutyHelpers", () => {
  it("formats hours", () => {
    expect(formatHours(0)).toBe("0 h");
    expect(formatHours(0.5)).toBe("30 min");
    expect(formatHours(3)).toBe("3 h");
    expect(formatHours(2.5)).toBe("2.5 h");
    expect(formatHours(1.25)).toBe("1.25 h");
  });

  it("merges contiguous selected slots into one shift", () => {
    const slots = [
      slot(1, "2026-11-02T09:00:00+05:30", "2026-11-02T10:00:00+05:30"),
      slot(2, "2026-11-02T10:00:00+05:30", "2026-11-02T11:00:00+05:30"),
      slot(3, "2026-11-02T13:00:00+05:30", "2026-11-02T14:00:00+05:30"),
    ];
    const merged = mergeSelectedSlots(slots, new Set([3, 1, 2]));
    expect(merged.map((m) => m.slotIds)).toEqual([[1, 2], [3]]);
    expect(merged[0].end).toBe("2026-11-02T11:00:00+05:30");
  });

  it("groups slots by day in order", () => {
    const groups = groupSlotsByDay([
      slot(2, "2026-11-03T09:00:00", "2026-11-03T10:00:00"),
      slot(1, "2026-11-02T09:00:00", "2026-11-02T10:00:00"),
    ]);
    expect(groups.map((g) => g.day)).toEqual(["2026-11-02", "2026-11-03"]);
  });

  it("refuses past and maintenance slots", () => {
    const now = new Date("2026-11-02T08:00:00");
    expect(slotSelectable(slot(1, "2026-11-02T09:00:00", "2026-11-02T10:00:00"), now)).toBe(true);
    expect(slotSelectable(slot(1, "2026-11-01T09:00:00", "2026-11-01T10:00:00"), now)).toBe(false);
    expect(slotSelectable(slot(1, "2026-11-02T09:00:00", "2026-11-02T10:00:00", "UNDER_MAINTENANCE"), now)).toBe(false);
  });

  it("builds plan payloads per mode", () => {
    expect(planPayload(5, form({ mode: "slots", slotIds: [7, 8] }), 3)).toEqual({ equipment_id: 5, mode: "slots", operator_id: 3, slot_ids: [7, 8] });
    const range = planPayload(5, form());
    expect(range).toMatchObject({ mode: "range", date_from: "2026-11-02", date_to: "2026-11-06", time_from: "09:00", weekdays: [0, 1, 2, 3, 4] });
    expect(range.operator_id).toBeUndefined();
  });

  it("explains incomplete forms", () => {
    expect(dutyFormProblem(form({ mode: "slots" }))).toMatch(/at least one slot/);
    expect(dutyFormProblem(form({ timeTo: "08:00" }))).toMatch(/end after/);
    expect(dutyFormProblem(form({ weekdays: [] }))).toMatch(/weekday/);
    expect(dutyFormProblem(form())).toBe("");
  });

  it("lists recent months newest first", () => {
    const months = recentMonths(3, new Date(2026, 0, 15));
    expect(months.map((m) => m.value)).toEqual(["2026-01", "2025-12", "2025-11"]);
  });

  it("names the next person in rotation", () => {
    const row = (rank: number | null, name: string, reasons: string[] = []): FairnessRow => ({
      user_id: rank ?? 0,
      roster_entry_id: 1,
      name,
      email: "",
      faculty_name: "",
      department_name: "",
      source: "AWARD",
      basis: "",
      rank,
      priority: 100,
      eligible: true,
      blocked: [],
      hard_blocked: [],
      reasons,
      breakdown: {},
      metrics: {},
      cooling_until: null,
      last_duty_end: null,
    });
    expect(nextInRotation([row(1, "Asha", ["Next in the fair rotation", "No duty hours yet this term"])])).toBe(
      "Asha is next in the fair rotation — no duty hours yet this term.",
    );
    expect(nextInRotation([row(null, "Ravi")])).toMatch(/needs a reason/);
    expect(nextInRotation([])).toBe("");
  });

  it("lists academic years July-June, newest first", () => {
    expect(academicYearChoices(2, new Date(2026, 9, 10))).toEqual(["2026-27", "2025-26"]);
    expect(academicYearChoices(1, new Date(2027, 2, 1))).toEqual(["2026-27"]);
  });

  it("turns the period selector into accounting filters", () => {
    expect(periodQuery("ay:2026-27")).toEqual({ academic_year: "2026-27" });
    expect(periodQuery("m:2026-10")).toEqual({ month: "2026-10" });
    expect(periodQuery("")).toEqual({});
  });
});

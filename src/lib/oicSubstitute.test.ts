import { describe, expect, it } from "vitest";
import {
  buildAssignPlan,
  endActionLabel,
  formatDmy,
  groupByPerson,
  groupSubstitutions,
  periodDmy,
  planBySubstitute,
  planProblems,
  planToAssignments,
  rowErrorsByEquipment,
  substitutionDays,
  substitutionStatusClass,
  substitutionTab,
  todayInIst,
  type OicAssignRow,
  type OicSubstituteStatus,
  type OicSubstitution,
} from "./oicSubstitute";

const item = (id: number, status: OicSubstituteStatus, start_at: string, resume_at: string): OicSubstitution => ({
  id,
  batch_id: null,
  equipment: { id: 1, code: "EQ1", name: "Equipment" },
  primary_oic: null,
  substitute: null,
  start_at,
  resume_at,
  start_display: "",
  end_display: "",
  status,
  status_label: status,
  reason: "Leave",
  created_at: start_at,
  created_by: null,
  ended_at: null,
  ended_by: null,
  end_reason: "",
  can_end: false,
  events: [],
});

describe("oicSubstitute helpers", () => {
  it("puts expired, revoked and cancelled under Past", () => {
    expect(substitutionTab("active")).toBe("active");
    expect(substitutionTab("scheduled")).toBe("scheduled");
    expect(substitutionTab("expired")).toBe("past");
    expect(substitutionTab("revoked")).toBe("past");
    expect(substitutionTab("cancelled")).toBe("past");
  });

  it("orders active by end and scheduled by start", () => {
    const groups = groupSubstitutions([
      item(1, "active", "2026-10-01T00:00:00Z", "2026-10-20T00:00:00Z"),
      item(2, "active", "2026-10-02T00:00:00Z", "2026-10-10T00:00:00Z"),
      item(3, "scheduled", "2026-11-05T00:00:00Z", "2026-11-09T00:00:00Z"),
      item(4, "scheduled", "2026-11-01T00:00:00Z", "2026-11-30T00:00:00Z"),
      item(5, "revoked", "2026-09-01T00:00:00Z", "2026-09-05T00:00:00Z"),
    ]);
    expect(groups.active.map((i) => i.id)).toEqual([2, 1]);
    expect(groups.scheduled.map((i) => i.id)).toEqual([4, 3]);
    expect(groups.past.map((i) => i.id)).toEqual([5]);
  });

  it("cancels scheduled and revokes active substitutions", () => {
    expect(endActionLabel("scheduled")).toBe("Cancel");
    expect(endActionLabel("active")).toBe("Revoke");
  });

  it("uses semantic status tokens", () => {
    expect(substitutionStatusClass("active")).toContain("bg-success-subtle");
    expect(substitutionStatusClass("scheduled")).toContain("bg-info-subtle");
    expect(substitutionStatusClass("revoked")).toContain("bg-destructive-subtle");
    expect(substitutionStatusClass("expired")).toContain("bg-muted");
  });

  it("gives today's date in IST", () => {
    expect(todayInIst(new Date("2026-10-06T19:00:00Z"))).toBe("2026-10-07");
    expect(todayInIst(new Date("2026-10-06T18:00:00Z"))).toBe("2026-10-06");
  });

  it("shows dates as DD-MM-YYYY and a midnight end as the last day", () => {
    expect(formatDmy("2026-10-06")).toBe("06-10-2026");
    expect(formatDmy("")).toBe("");
    // 06-10-2026 10:00 IST until midnight IST starting 09-10-2026
    const days = substitutionDays({ start_at: "2026-10-06T04:30:00Z", resume_at: "2026-10-08T18:30:00Z" });
    expect(days).toEqual({ start: "2026-10-06", end: "2026-10-08" });
    expect(periodDmy(days.start, days.end)).toBe("06-10-2026 to 08-10-2026");
    expect(periodDmy("2026-10-06", "2026-10-06")).toBe("06-10-2026");
  });
});

describe("oicSubstitute bulk assignment", () => {
  const xrd = { id: 1, code: "XRD-1", name: "XRD" };
  const sem = { id: 2, code: "SEM-1", name: "SEM" };
  const tem = { id: 3, code: "TEM-1", name: "TEM" };
  const beta = { id: 11, name: "Beta", email: "b@x" };
  const gamma = { id: 12, name: "Gamma", email: "g@x" };
  const shared = { startDate: "2026-10-07", endDate: "2026-10-09" };
  const row = (over: Partial<OicAssignRow>): OicAssignRow => ({
    selected: true,
    substitutes: [],
    customDates: false,
    startDate: "",
    endDate: "",
    ...over,
  });

  it("builds the plan from selected rows, with own dates only where chosen", () => {
    const plan = buildAssignPlan([xrd, sem, tem], {
      1: row({ substitutes: [beta] }),
      2: row({ substitutes: [beta], customDates: true, startDate: "2026-10-10", endDate: "2026-10-11" }),
      3: row({ selected: false, substitutes: [gamma] }),
    }, shared);
    expect(plan.map((p) => p.equipment.id)).toEqual([1, 2]);
    expect(planToAssignments(plan)).toEqual([
      { equipment_id: 1, substitute_ids: [11] },
      { equipment_id: 2, substitute_ids: [11], start_date: "2026-10-10", end_date: "2026-10-11" },
    ]);
  });

  it("flags rows without a substitute or with bad dates", () => {
    const plan = buildAssignPlan([xrd, sem, tem], {
      1: row({ substitutes: [] }),
      2: row({ substitutes: [beta], customDates: true, startDate: "2026-10-05", endDate: "2026-10-06" }),
      3: row({ substitutes: [gamma], customDates: true, startDate: "2026-10-09", endDate: "2026-10-08" }),
    }, shared);
    expect(planProblems(plan, "2026-10-06")).toEqual({
      1: "Choose a substitute.",
      2: "The start date cannot be in the past.",
      3: "The end date must be on or after the start date.",
    });
  });

  it("summarises who gets what, per substitute", () => {
    const plan = buildAssignPlan([xrd, sem, tem], {
      1: row({ substitutes: [gamma] }),
      2: row({ substitutes: [gamma, beta] }),
      3: row({ substitutes: [beta] }),
    }, shared);
    const summary = planBySubstitute(plan);
    expect(summary.map((g) => [g.substitute.name, g.items.map((i) => i.equipment.name)])).toEqual([
      ["Beta", ["SEM", "TEM"]],
      ["Gamma", ["XRD", "SEM"]],
    ]);
  });

  it("maps server row errors back to equipment", () => {
    const assignments = [
      { equipment_id: 1, substitute_ids: [11] },
      { equipment_id: 2, substitute_ids: [12] },
    ];
    expect(
      rowErrorsByEquipment(
        [
          { index: 1, equipment_id: 2, message: "Overlaps." },
          { index: 1, message: "Also this." },
          { index: 0, equipment_id: null, message: "Not yours." },
        ],
        assignments,
      ),
    ).toEqual({ 2: "Overlaps. Also this.", 1: "Not yours." });
  });

  it("groups list items by substitute or by granting OIC", () => {
    const a = { ...item(1, "active", "2026-10-01T00:00:00Z", "2026-10-20T00:00:00Z"), substitute: gamma, primary_oic: beta };
    const b = { ...item(2, "active", "2026-10-01T00:00:00Z", "2026-10-20T00:00:00Z"), substitute: beta, primary_oic: beta };
    const c = { ...item(3, "scheduled", "2026-10-01T00:00:00Z", "2026-10-20T00:00:00Z"), substitute: gamma, primary_oic: beta };
    expect(groupByPerson([a, b, c], "substitute").map((g) => [g.person?.name, g.items.map((i) => i.id)])).toEqual([
      ["Beta", [2]],
      ["Gamma", [1, 3]],
    ]);
    expect(groupByPerson([a, b, c], "primary_oic")).toHaveLength(1);
  });
});

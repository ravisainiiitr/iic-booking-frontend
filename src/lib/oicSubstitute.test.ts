import { describe, expect, it } from "vitest";
import {
  endActionLabel,
  groupSubstitutions,
  substitutionStatusClass,
  substitutionTab,
  todayInIst,
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
});

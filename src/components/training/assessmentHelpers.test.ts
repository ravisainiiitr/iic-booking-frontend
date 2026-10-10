import { describe, expect, it } from "vitest";
import { previewGrade, slugKey } from "./assessmentHelpers";

const items = [
  { key: "safety", label: "Safety briefing", critical: true },
  { key: "startup", label: "Start-up", critical: false },
  { key: "data", label: "Data handling", critical: false },
  { key: "shutdown", label: "Shutdown", critical: true },
];
const pass = { theory: 70, practical: 75 };

describe("previewGrade", () => {
  it("waits until every item is marked", () => {
    expect(previewGrade(items, { safety: true }, 80, pass)).toMatchObject({ result: null, unmarked: 3 });
  });

  it("passes when all critical items pass and marks are reached", () => {
    const g = previewGrade(items, { safety: true, startup: true, data: false, shutdown: true }, 80, pass);
    expect(g).toMatchObject({ result: "PASS", practicalPct: 75, reasons: [] });
  });

  it("asks for a retake on a failed critical item or low theory", () => {
    expect(previewGrade(items, { safety: false, startup: true, data: true, shutdown: true }, 90, pass).result).toBe("RETAKE");
    expect(previewGrade(items, { safety: true, startup: true, data: true, shutdown: true }, 50, pass).result).toBe("RETAKE");
  });

  it("fails when a critical item fails and practical is under half the pass mark", () => {
    const g = previewGrade(items, { safety: false, startup: false, data: false, shutdown: false }, 90, pass);
    expect(g.result).toBe("FAIL");
    expect(g.reasons[0]).toMatch(/Safety briefing; Shutdown/);
  });
});

describe("slugKey", () => {
  it("makes unique keys", () => {
    expect(slugKey("Sample prep & mounting", new Set())).toBe("sample_prep_mounting");
    expect(slugKey("Safety", new Set(["safety"]))).toBe("safety_2");
    expect(slugKey("!!!", new Set())).toBe("item");
  });
});

import { describe, expect, it } from "vitest";
import type { TemplateHealth, TemplateHealthIssue } from "@/lib/api";
import {
  clampTemplateValues,
  fixTemplateUrl,
  templateApplyNotice,
  templateHealthBadge,
  templateSaveBlocker,
} from "@/lib/templateHealth";

const issue = (over: Partial<TemplateHealthIssue>): TemplateHealthIssue => ({
  code: "numeric_max",
  severity: "error",
  message: "No. of Samples is 15; max 10 allowed.",
  field: "A",
  set: 1,
  ...over,
});

const health = (issues: TemplateHealthIssue[]): TemplateHealth => ({
  status: issues.some((i) => i.severity === "error") ? "needs_attention" : issues.length ? "advice" : "ok",
  issues,
  error_count: issues.filter((i) => i.severity === "error").length,
  fixable_error_count: 0,
  warning_count: issues.filter((i) => i.severity === "warning").length,
});

describe("templateHealthBadge", () => {
  it("flags fixable errors as needing attention and warnings as advice", () => {
    expect(templateHealthBadge(health([issue({})]))).toMatchObject({ tone: "attention", label: "Needs attention", count: 1 });
    expect(
      templateHealthBadge(health([issue({ code: "wallet_low", severity: "warning", message: "Recharge" })]))
    ).toMatchObject({ tone: "advice", issue: { code: "wallet_low" } });
  });

  it("ignores info and errors the user cannot fix by editing", () => {
    expect(templateHealthBadge(health([issue({ code: "field_removed", severity: "info" })]))).toBeNull();
    expect(templateHealthBadge(health([issue({ code: "equipment_not_operational" })]))).toBeNull();
    expect(templateHealthBadge(undefined)).toBeNull();
  });
});

describe("templateSaveBlocker", () => {
  it("blocks saving on a number outside its limits only", () => {
    const formula = issue({ code: "numeric_formula_max", field: "B", set: 2 });
    expect(templateSaveBlocker(health([issue({ code: "required_missing" }), formula]))).toBe(formula);
    expect(templateSaveBlocker(health([issue({ code: "numeric_min", message: "No. of Samples is 0; the minimum is 1." })])))
      .toMatchObject({ code: "numeric_min" });
    expect(templateSaveBlocker(health([issue({ code: "wallet_low", severity: "warning" })]))).toBeNull();
    expect(templateSaveBlocker(null)).toBeNull();
  });
});

describe("clampTemplateValues", () => {
  it("sets values to the limit in sample set 1 and extra sets, leaving the input untouched", () => {
    const values = { A: "15", B: "2", _sample_sets: [{ A: "9", B: "2" }] };
    const { values: next, adjusted } = clampTemplateValues(values, [
      issue({ limit: 10, fix: "clamp", label: "No. of Samples" }),
      issue({ code: "numeric_formula_max", set: 2, limit: 8, fix: "clamp", label: "No. of Samples" }),
      issue({ code: "required_missing", field: "D" }),
    ]);
    expect(next).toEqual({ A: "10", B: "2", _sample_sets: [{ A: "8", B: "2" }] });
    expect(values.A).toBe("15");
    expect(adjusted).toEqual([
      { field: "A", label: "No. of Samples", set: 1, from: 15, to: 10 },
      { field: "A", label: "No. of Samples", set: 2, from: 9, to: 8 },
    ]);
  });

  it("skips fields the template does not have", () => {
    const { values, adjusted } = clampTemplateValues({ B: "1" }, [issue({ limit: 10, fix: "clamp" })]);
    expect(values).toEqual({ B: "1" });
    expect(adjusted).toEqual([]);
  });
});

describe("templateApplyNotice", () => {
  it("lists changes and what to fix in one message", () => {
    const notice = templateApplyNotice("TGA", {
      adjusted: [{ field: "A", label: "No. of Samples", set: 1, from: 15, to: 10 }],
      dropped: ["Z"],
      health: health([issue({ code: "quota_low", severity: "warning", message: "You have 2 h left." })]),
    });
    expect(notice).toEqual({
      tone: "warning",
      message: 'Template "TGA" applied with changes: No. of Samples 15 → 10; reset: Z. Before booking: You have 2 h left.',
    });
  });

  it("is quiet when nothing changed and nothing needs fixing", () => {
    expect(templateApplyNotice("TGA", { health: health([issue({ code: "preferred_weekend", severity: "warning" })]) })).toBeNull();
  });

  it("is informational when only inputs were reset", () => {
    expect(templateApplyNotice("TGA", { dropped: ["Z"] })?.tone).toBe("info");
  });
});

describe("fixTemplateUrl", () => {
  it("opens the editor at the field", () => {
    const url = fixTemplateUrl({ id: 7, equipment: 3 }, { field: "A" }, "/booking-templates");
    expect(url).toContain("mode=template");
    expect(url).toContain("template_id=7");
    expect(url).toContain("return_to=%2Fbooking-templates");
    expect(url.endsWith("&fix=A")).toBe(true);
  });
});

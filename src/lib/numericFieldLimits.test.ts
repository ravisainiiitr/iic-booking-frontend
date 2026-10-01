import { describe, expect, it } from "vitest";

import {
  isNumericHelpTextConvention,
  numericConstraints,
  numericHelpTextForDisplay,
  numericMaxFormula,
  resolveFieldAFormulaMax,
  resolveNumericFieldBounds,
} from "@/lib/numericFieldLimits";
import { configuredStaticMax } from "@/lib/sampleSetLimits";

describe("numericConstraints", () => {
  it("prefers options over help-text lines", () => {
    const c = numericConstraints({ options: { min: 2, max: 8, step: 0.5 }, help_text: "1\n2\n1" });
    expect([c.min, c.max, c.step]).toEqual([2, 8, 0.5]);
    expect(c.source).toEqual({ min: "options", max: "options", step: "options" });
  });

  it("falls back to help-text lines 1–3 for what options do not set", () => {
    const c = numericConstraints({ options: { max: 4 }, help_text: "1\n2\n0.5" });
    expect([c.min, c.max, c.step]).toEqual([1, 4, 0.5]);
    expect(c.source).toEqual({ min: "help_text", max: "options", step: "help_text" });
  });

  it("returns undefined (not the UI defaults) when nothing is configured", () => {
    const c = numericConstraints({ options: [], help_text: "" });
    expect([c.min, c.max, c.step, c.maxFormula]).toEqual([undefined, undefined, undefined, ""]);
    expect(resolveNumericFieldBounds({ options: [], help_text: "" })).toEqual({ min: 0, max: 100, step: 1 });
  });

  it("ignores a non-positive options step in favour of the help text", () => {
    expect(numericConstraints({ options: { step: 0 }, help_text: "0\n10\n0.1" }).step).toBe(0.1);
  });

  it("reads max_formula from options and legacy plain values", () => {
    expect(numericMaxFormula({ min: 1, max_formula: " B*4 " })).toBe("B*4");
    expect(numericMaxFormula("B*4")).toBe("B*4");
    expect(numericMaxFormula(["B*4"])).toBe("B*4");
    expect(numericMaxFormula(["a", "b"])).toBe("");
    expect(numericConstraints({ options: { min: 1, max_formula: "B*4" } }).maxFormula).toBe("B*4");
  });
});

describe("readers agree with the resolver", () => {
  const helpOnly = { field_key: "B", field_type: "NUMERIC", options: [], help_text: "1\n2\n1" };
  const optionsOnly = { field_key: "B", field_type: "NUMERIC", options: { min: 1, max: 2, step: 1 }, help_text: "" };

  it("gives the same bounds and combined max for help-text and options configuration", () => {
    expect(resolveNumericFieldBounds(helpOnly)).toEqual(resolveNumericFieldBounds(optionsOnly));
    expect(configuredStaticMax(helpOnly)).toBe(2);
    expect(configuredStaticMax(optionsOnly)).toBe(2);
  });

  it("has no combined max for a formula field", () => {
    expect(configuredStaticMax({ field_key: "A", field_type: "NUMERIC", options: { min: 1, max_formula: "B*4", max: 9 } })).toBe(
      undefined,
    );
  });

  it("evaluates field A's formula, falling back to options.max", () => {
    expect(resolveFieldAFormulaMax({ field_key: "A", options: { max_formula: "B*4" } }, { B: 2 })).toBe(8);
    expect(resolveFieldAFormulaMax({ field_key: "A", options: "B*4" }, { B: 3 })).toBe(12);
    expect(resolveFieldAFormulaMax({ field_key: "A", options: { max: 5 } }, {})).toBe(5);
    expect(resolveFieldAFormulaMax({ field_key: "B", options: { max_formula: "A*2" } }, { A: 1 })).toBeUndefined();
  });
});

describe("help-text convention", () => {
  it.each([
    ["1\n2\n1", true],
    ["1\r\n2\r\n0.01", true],
    ["0\n\n0.5", true],
    ["0 100 0.01", true],
    ["Enter the count\nMax 10", false],
    ["1\n2\n1\nslots of 90 minutes", false],
    ["Number of hours", false],
    ["", false],
  ])("%j → %s", (helpText, pure) => {
    expect(isNumericHelpTextConvention(helpText)).toBe(pure);
  });

  it("hides only pure numeric help text of NUMERIC fields", () => {
    expect(numericHelpTextForDisplay({ field_type: "NUMERIC", help_text: "1\n2\n1" })).toBe("");
    expect(numericHelpTextForDisplay({ field_type: "NUMERIC", help_text: "Max 2 slots" })).toBe("Max 2 slots");
    expect(numericHelpTextForDisplay({ field_type: "TEXT", help_text: "1\n2\n1" })).toBe("1\n2\n1");
  });
});

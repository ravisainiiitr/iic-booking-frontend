import { describe, expect, it } from "vitest";

import {
  commitNumericInput,
  numericInputHint,
  numericInputStatus,
  sanitizeNumericTyping,
} from "@/lib/numericInput";
import {
  boundsWithCombinedMax,
  combinedLimits,
  maxForExtraSet,
  maxForPrimarySet,
} from "@/lib/sampleSetLimits";

const bounds = { min: 1, max: 10, step: 1 };

describe("numericInputStatus", () => {
  it("disables the down arrow at the min and the up arrow at the max", () => {
    expect(numericInputStatus("1", bounds)).toMatchObject({ atMin: true, canDecrement: false, canIncrement: true });
    expect(numericInputStatus(10, bounds)).toMatchObject({ atMax: true, canIncrement: false, canDecrement: true });
    expect(numericInputStatus("5", bounds)).toMatchObject({ canIncrement: true, canDecrement: true });
  });

  it("allows only the up arrow on a blank box", () => {
    expect(numericInputStatus("", bounds)).toMatchObject({ canIncrement: true, canDecrement: false });
  });

  it("flags a legacy 0 as below the min", () => {
    expect(numericInputStatus(0, bounds)).toMatchObject({ belowMin: true, canDecrement: false, canIncrement: true });
  });
});

describe("numericInputHint", () => {
  it("says when the max is reached", () => {
    expect(numericInputHint("10", bounds)).toEqual({ text: "Max 10 reached", tone: "info" });
    expect(numericInputHint("9", bounds)).toBeNull();
    expect(numericInputHint("1", bounds)).toBeNull();
  });

  it("uses the caller's wording for a combined maximum", () => {
    expect(numericInputHint("4", { ...bounds, max: 4 }, { maxHint: "Combined max of 20 reached across all sample sets" })).toEqual({
      text: "Combined max of 20 reached across all sample sets",
      tone: "info",
    });
  });

  it("asks the user to change an out-of-range saved value", () => {
    expect(numericInputHint(0, bounds)).toEqual({ text: "Minimum is 1 — please change this value", tone: "error" });
    expect(numericInputHint("12", bounds)).toEqual({ text: "Maximum is 10 — please change this value", tone: "error" });
  });

  it("explains a correction the box made", () => {
    expect(numericInputHint("10", bounds, { clampNote: { kind: "max", entered: "25" } })?.text).toBe(
      "Max 10 reached (25 is over the limit)",
    );
    expect(numericInputHint("1", bounds, { clampNote: { kind: "min", entered: "0" } })?.text).toBe(
      "Minimum is 1 (0 is not allowed)",
    );
  });
});

describe("sanitizeNumericTyping", () => {
  it("corrects a value over the max straight away", () => {
    expect(sanitizeNumericTyping("25", bounds)).toEqual({ value: "10", clampNote: { kind: "max", entered: "25" } });
  });

  it("keeps a value under the min while typing (corrected on blur)", () => {
    expect(sanitizeNumericTyping("0", bounds)).toEqual({ value: "0", clampNote: null });
    expect(sanitizeNumericTyping("1", { min: 2, max: 20, step: 1 })).toEqual({ value: "1", clampNote: null });
  });

  it("ignores a minus sign unless negatives are allowed", () => {
    expect(sanitizeNumericTyping("-3", bounds)).toBeNull();
    expect(sanitizeNumericTyping("-3", { min: -10, max: 10, step: 1 })).toEqual({ value: "-3", clampNote: null });
  });
});

describe("commitNumericInput (blur)", () => {
  it("raises 0 and negatives to the min with a note", () => {
    expect(commitNumericInput("0", bounds)).toEqual({ value: "1", clampNote: { kind: "min", entered: "0" } });
    expect(commitNumericInput("-4", bounds)).toEqual({ value: "1", clampNote: { kind: "min", entered: "-4" } });
    expect(commitNumericInput("0.4", bounds)).toEqual({ value: "1", clampNote: { kind: "min", entered: "0.4" } });
  });

  it("keeps a configured min of 2", () => {
    expect(commitNumericInput("1", { min: 2, max: 8, step: 1 }).value).toBe("2");
  });

  it("lowers a value over the max with a note", () => {
    expect(commitNumericInput("11", bounds)).toEqual({ value: "10", clampNote: { kind: "max", entered: "11" } });
  });

  it("leaves a blank box blank and keeps decimals of decimal fields", () => {
    expect(commitNumericInput("", bounds)).toEqual({ value: "", clampNote: null });
    expect(commitNumericInput("0.03", { min: 0, max: 100, step: 0.01 })).toEqual({ value: "0.03", clampNote: null });
    expect(commitNumericInput("3.6", bounds)).toEqual({ value: "4", clampNote: null });
  });
});

describe("combined A / B maximum", () => {
  const fields = [
    { field_key: "A", field_label: "No. of samples", field_type: "NUMERIC", options: { max: 20 }, is_required: true },
    { field_key: "B", field_label: "Slots", field_type: "NUMERIC", options: { max: 4 }, is_required: true },
  ];
  const [limitA] = combinedLimits(fields);

  it("caps sample set 1 at what the other sets leave, with the combined hint", () => {
    expect(maxForPrimarySet(limitA, [{ A: "12" }])).toBe(8);
    const { bounds: capped, maxHint } = boundsWithCombinedMax({ min: 1, max: 20, step: 1 }, limitA, 8);
    expect(capped.max).toBe(8);
    expect(maxHint).toBe("Combined max of 20 reached across all sample sets");
    expect(numericInputHint("8", capped, { maxHint })?.text).toBe("Combined max of 20 reached across all sample sets");
    expect(numericInputStatus("8", capped).canIncrement).toBe(false);
  });

  it("caps an extra set the same way", () => {
    expect(maxForExtraSet(limitA, { A: "15" }, [{ A: "3" }], 0)).toBe(5);
  });

  it("keeps the field's own max (and wording) when the combined limit is not tighter", () => {
    expect(boundsWithCombinedMax({ min: 1, max: 20, step: 1 }, limitA, 20)).toEqual({ bounds: { min: 1, max: 20, step: 1 } });
    expect(boundsWithCombinedMax({ min: 1, max: 20, step: 1 }, undefined, 3)).toEqual({ bounds: { min: 1, max: 20, step: 1 } });
  });

  it("never caps below the min", () => {
    expect(boundsWithCombinedMax({ min: 1, max: 20, step: 1 }, limitA, 0).bounds.max).toBe(1);
  });
});

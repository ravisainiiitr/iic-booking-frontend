import { describe, expect, it } from "vitest";

import {
  applyNumericLimitDraft,
  EMPTY_NUMERIC_LIMIT_DRAFT,
  maxFormulaError,
  MIN_BELOW_ONE_MESSAGE,
  numericLimitDraftError,
  numericLimitDraftFromField,
} from "@/lib/numericFieldConfig";
import { configuredStaticMax } from "@/lib/sampleSetLimits";
import { resolveNumericFieldBounds } from "@/lib/numericFieldLimits";

const draft = (patch: Partial<typeof EMPTY_NUMERIC_LIMIT_DRAFT>) => ({ ...EMPTY_NUMERIC_LIMIT_DRAFT, ...patch });

describe("numericLimitDraftFromField", () => {
  it("prefills the boxes from help-text lines when options are empty", () => {
    expect(numericLimitDraftFromField({ options: [], help_text: "1\n2\n1" })).toEqual({
      min: "1", max: "2", step: "1", maxFormula: "",
    });
  });

  it("prefers options and carries the max formula", () => {
    expect(numericLimitDraftFromField({ options: { min: 1, max_formula: "B*4" }, help_text: "0\n50\n0.5" })).toEqual({
      min: "1", max: "50", step: "0.5", maxFormula: "B*4",
    });
  });
});

describe("numericLimitDraftError", () => {
  it.each([
    [draft({ min: "5", max: "2" }), "Min (5) cannot be greater than Max (2)."],
    [draft({ step: "0" }), "Step must be greater than 0."],
    [draft({ max: "abc" }), "Max must be a number."],
    [draft({ min: "0.5", step: "1" }), "Min must be a whole number when Step is a whole number."],
    [draft({ maxFormula: "b*4" }), "Max formula may only use field keys A–Z (capitals), SLOT_DURATION_MINUTES, numbers and + - * / ( )."],
    [draft({ maxFormula: "B**" }), "Max formula is not a valid expression (e.g. B*4)."],
  ])("%j", (d, message) => {
    expect(numericLimitDraftError(d)).toBe(message);
  });

  it("accepts valid and empty boxes", () => {
    expect(numericLimitDraftError(EMPTY_NUMERIC_LIMIT_DRAFT)).toBeNull();
    expect(numericLimitDraftError(draft({ min: "1", max: "2", step: "1" }))).toBeNull();
    expect(numericLimitDraftError(draft({ min: "0.5", max: "2.5", step: "0.5" }))).toBeNull();
    expect(maxFormulaError("SLOT_DURATION_MINUTES/30 + A")).toBeNull();
  });

  it("does not allow a min below 1 unless decimals or negatives are allowed", () => {
    expect(numericLimitDraftError(draft({ min: "0" }))).toBe(MIN_BELOW_ONE_MESSAGE);
    expect(numericLimitDraftError(draft({ min: "0", max: "5", step: "1" }))).toBe(MIN_BELOW_ONE_MESSAGE);
    expect(numericLimitDraftError(draft({ min: "0.5" }))).toBe(MIN_BELOW_ONE_MESSAGE);
    expect(numericLimitDraftError(draft({ min: "0", step: "0.1" }))).toBeNull();
    expect(numericLimitDraftError(draft({ min: "0" }), { allowNegative: true })).toBeNull();
    expect(numericLimitDraftError(draft({ min: "-7", step: "0.1" }))).toBeNull();
    expect(numericLimitDraftError(draft({ min: "2" }))).toBeNull();
  });
});

describe("applyNumericLimitDraft", () => {
  it("moves pure help-text limits into options and clears the help text without changing the limits", () => {
    const field = { options: [], help_text: "1\n2\n1" };
    const saved = applyNumericLimitDraft(field, numericLimitDraftFromField(field));
    expect(saved).toEqual({ options: { min: 1, max: 2, step: 1 }, help_text: "" });
    const after = { field_key: "B", field_type: "NUMERIC", ...saved };
    expect(resolveNumericFieldBounds(after)).toEqual(resolveNumericFieldBounds(field));
    expect(configuredStaticMax(after)).toBe(configuredStaticMax({ field_key: "B", field_type: "NUMERIC", ...field }));
  });

  it("keeps descriptive help text and other option keys", () => {
    const saved = applyNumericLimitDraft(
      { options: { allow_negative: true, max: 9 }, help_text: "Each slot is 1.5 hours" },
      draft({ max: "2", maxFormula: " B*4 " }),
    );
    expect(saved).toEqual({ options: { allow_negative: true, max: 2, max_formula: "B*4" }, help_text: "Each slot is 1.5 hours" });
  });

  it("keeps limits typed the old way into the help text of a field with empty boxes", () => {
    expect(applyNumericLimitDraft({ options: [], help_text: "1\n2\n1" }, draft({ max: "3" }))).toEqual({
      options: { min: 1, max: 3, step: 1 },
      help_text: "",
    });
  });

  it("removes cleared boxes and returns [] when nothing is left", () => {
    expect(applyNumericLimitDraft({ options: { min: 1, max_formula: "B*4" }, help_text: "" }, EMPTY_NUMERIC_LIMIT_DRAFT)).toEqual({
      options: [],
      help_text: "",
    });
  });
});

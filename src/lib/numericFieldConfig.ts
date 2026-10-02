/**
 * Min / Max / Step / Max formula boxes of a NUMERIC field in the equipment form. Values are kept in
 * `options` ({ min, max, step, max_formula }); existing help-text limits (lines 1–3) prefill the boxes.
 * Mirrors the backend `numeric_field_limits.normalize_numeric_field_config`.
 */
import {
  formatNumericBound,
  isNumericHelpTextConvention,
  NUMERIC_MIN_FLOOR,
  numericConstraints,
  parseNumericHelpText,
} from "@/lib/numericFieldLimits";

export type NumericLimitDraft = { min: string; max: string; step: string; maxFormula: string };

export const EMPTY_NUMERIC_LIMIT_DRAFT: NumericLimitDraft = { min: "", max: "", step: "", maxFormula: "" };

const LABELS = { min: "Min", max: "Max", step: "Step" } as const;

/** Box values for a field as configured today (options first, else help-text lines 1–3). */
export function numericLimitDraftFromField(field: { options?: unknown; help_text?: string | null }): NumericLimitDraft {
  const c = numericConstraints(field);
  const text = (n: number | undefined) => (n === undefined ? "" : formatNumericBound(n));
  return { min: text(c.min), max: text(c.max), step: text(c.step), maxFormula: c.maxFormula };
}

/** undefined when blank, null when not a number. */
function parseBox(raw: string): number | undefined | null {
  const s = String(raw ?? "").trim().replace(",", ".");
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Why `formula` is not a usable max formula (A–Z, SLOT_DURATION_MINUTES, numbers, + - * / ( )), else null. */
export function maxFormulaError(formula: string): string | null {
  const f = String(formula ?? "").trim();
  if (!f) return null;
  const expr = f.replace(/\bSLOT_DURATION_MINUTES\b/g, "1").replace(/\b[A-Z]\b/g, "1");
  if (!/^[0-9+\-*/().\s]+$/.test(expr)) {
    return "Max formula may only use field keys A–Z (capitals), SLOT_DURATION_MINUTES, numbers and + - * / ( ).";
  }
  try {
    Function(`"use strict"; return (${expr});`)();
  } catch {
    return "Max formula is not a valid expression (e.g. B*4).";
  }
  return null;
}

export const MIN_BELOW_ONE_MESSAGE =
  "Min must be at least 1: number inputs cannot be 0. For decimal values set a Step below 1; " +
  "for negative values tick Allow negative.";

export const MIN_FLOOR_NOTE =
  "Minimum is 1 for number inputs (use a Step below 1 for decimals, or tick Allow negative).";

/**
 * First problem with the boxes (min ≤ max, step > 0, whole numbers with a whole step, min of at least 1
 * unless decimals or negatives are allowed, formula syntax), else null.
 */
export function numericLimitDraftError(
  draft: NumericLimitDraft,
  { allowNegative = false }: { allowNegative?: boolean } = {},
): string | null {
  const values: Partial<Record<keyof typeof LABELS, number>> = {};
  for (const key of ["min", "max", "step"] as const) {
    const n = parseBox(draft[key]);
    if (n === null) return `${LABELS[key]} must be a number.`;
    if (n !== undefined) values[key] = n;
  }
  const { min, max, step } = values;
  if (step !== undefined && step <= 0) return "Step must be greater than 0.";
  if (min !== undefined && max !== undefined && min > max) {
    return `Min (${formatNumericBound(min)}) cannot be greater than Max (${formatNumericBound(max)}).`;
  }
  if (step !== undefined && Number.isInteger(step)) {
    for (const key of ["min", "max"] as const) {
      const n = values[key];
      if (n !== undefined && !Number.isInteger(n)) {
        return `${LABELS[key]} must be a whole number when Step is a whole number.`;
      }
    }
  }
  if (min !== undefined && min >= 0 && min < NUMERIC_MIN_FLOOR && !allowNegative && !(step !== undefined && step < 1)) {
    return MIN_BELOW_ONE_MESSAGE;
  }
  return maxFormulaError(draft.maxFormula);
}

/**
 * options / help_text to save for a NUMERIC field. The boxes replace min / max / step / max_formula in
 * options (other keys such as allow_negative are kept). Help text that is only min / max / step numbers
 * fills any empty box and is then cleared; any other help text is kept as is.
 */
export function applyNumericLimitDraft(
  field: { options?: unknown; help_text?: string | null },
  draft: NumericLimitDraft,
): { options: Record<string, unknown> | never[]; help_text: string } {
  const raw = field.options;
  const options: Record<string, unknown> =
    raw && typeof raw === "object" && !Array.isArray(raw) ? { ...(raw as Record<string, unknown>) } : {};
  for (const key of ["min", "max", "step"] as const) {
    const n = parseBox(draft[key]);
    if (n === undefined || n === null) delete options[key];
    else options[key] = n;
  }
  const formula = String(draft.maxFormula ?? "").trim();
  if (formula) options.max_formula = formula;
  else delete options.max_formula;
  let helpText = String(field.help_text ?? "");
  if (isNumericHelpTextConvention(helpText)) {
    for (const [key, value] of Object.entries(parseNumericHelpText(helpText))) {
      if (options[key] === undefined) options[key] = value;
    }
    helpText = "";
  }
  return { options: Object.keys(options).length > 0 ? options : [], help_text: helpText };
}

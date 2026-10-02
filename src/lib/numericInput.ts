/** Typing / arrow / blur behaviour shared by every NUMERIC dynamic-field input. */

import {
  formatNumericBound,
  isNumericInputDraft,
  numericFieldAllowsNegative,
  roundToStepPrecision,
  type NumericFieldBounds,
} from "@/lib/numericFieldLimits";

/** Why the input last changed the user's value: it was over the max or under the min. */
export type NumericClampNote = { kind: "max" | "min"; entered: string } | null;

export type NumericInputHint = { text: string; tone: "info" | "error" } | null;

export type NumericInputStatus = {
  value: number | undefined;
  atMin: boolean;
  atMax: boolean;
  belowMin: boolean;
  aboveMax: boolean;
  canIncrement: boolean;
  canDecrement: boolean;
};

/** A complete number, or undefined for blank / partially typed values ("", "-", "1."). */
export function parseNumericInput(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || typeof raw === "boolean") return undefined;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : undefined;
  const text = String(raw).trim();
  if (text === "" || isNumericInputDraft(text)) return undefined;
  const n = Number(text.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

export function numericInputStatus(raw: unknown, bounds: NumericFieldBounds): NumericInputStatus {
  const value = parseNumericInput(raw);
  if (value === undefined) {
    return {
      value,
      atMin: false,
      atMax: false,
      belowMin: false,
      aboveMax: false,
      canIncrement: true,
      canDecrement: false,
    };
  }
  return {
    value,
    atMin: value <= bounds.min,
    atMax: value >= bounds.max,
    belowMin: value < bounds.min,
    aboveMax: value > bounds.max,
    canIncrement: value < bounds.max,
    canDecrement: value > bounds.min,
  };
}

/** Default "max reached" wording; callers pass their own for combined limits across sample sets. */
export function maxReachedHint(max: number): string {
  return `Max ${formatNumericBound(max)} reached`;
}

/**
 * Message shown next to the box: out-of-range values (e.g. a 0 saved before the minimum of 1) are
 * errors; reaching the max, or the input having just corrected the value, is information.
 */
export function numericInputHint(
  raw: unknown,
  bounds: NumericFieldBounds,
  { maxHint, clampNote = null }: { maxHint?: string; clampNote?: NumericClampNote } = {}
): NumericInputHint {
  const status = numericInputStatus(raw, bounds);
  const min = formatNumericBound(bounds.min);
  const max = formatNumericBound(bounds.max);
  if (status.belowMin) return { text: `Minimum is ${min} — please change this value`, tone: "error" };
  if (status.aboveMax) return { text: `Maximum is ${max} — please change this value`, tone: "error" };
  const reached = maxHint || maxReachedHint(bounds.max);
  if (clampNote?.kind === "max" && status.atMax) {
    return { text: `${reached} (${clampNote.entered} is over the limit)`, tone: "info" };
  }
  if (clampNote?.kind === "min" && status.atMin) {
    return { text: `Minimum is ${min} (${clampNote.entered} is not allowed)`, tone: "info" };
  }
  if (status.atMax) return { text: reached, tone: "info" };
  return null;
}

/**
 * Value to keep while the user types. Above the max is corrected straight away (with a note); below the
 * min is kept so the user can finish typing (e.g. "1" on the way to "12" when the min is 2) and is
 * corrected on blur. Returns null to ignore the keystroke (a minus sign when negatives are not allowed).
 */
export function sanitizeNumericTyping(
  raw: string,
  bounds: NumericFieldBounds
): { value: string; clampNote: NumericClampNote } | null {
  const text = raw.trim();
  if (text.startsWith("-") && !numericFieldAllowsNegative(bounds)) return null;
  const value = parseNumericInput(text);
  if (value !== undefined && value > bounds.max) {
    return { value: formatNumericBound(bounds.max), clampNote: { kind: "max", entered: text } };
  }
  return { value: raw, clampNote: null };
}

/** Final value when the box loses focus: rounded to the step and pulled into [min, max]. */
export function commitNumericInput(
  raw: unknown,
  bounds: NumericFieldBounds
): { value: string; clampNote: NumericClampNote } {
  const text = raw === undefined || raw === null ? "" : String(raw).trim();
  if (text === "" || text === "-" || text === "." || text === "-.") return { value: "", clampNote: null };
  const n = Number(text.replace(",", "."));
  if (!Number.isFinite(n)) {
    return { value: formatNumericBound(bounds.min), clampNote: { kind: "min", entered: text } };
  }
  const rounded = roundToStepPrecision(n, bounds.step);
  if (rounded < bounds.min) {
    return { value: formatNumericBound(bounds.min), clampNote: { kind: "min", entered: text } };
  }
  if (rounded > bounds.max) {
    return { value: formatNumericBound(bounds.max), clampNote: { kind: "max", entered: text } };
  }
  return { value: formatNumericBound(rounded), clampNote: null };
}

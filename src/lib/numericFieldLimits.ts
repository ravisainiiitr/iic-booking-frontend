/** NUMERIC dynamic-field limits from options / help_text. */

export type NumericFieldBounds = {
  min: number;
  max: number;
  step: number;
};

export const DEFAULT_NUMERIC_MIN = 0;
export const DEFAULT_NUMERIC_MAX = 100;
export const DEFAULT_NUMERIC_STEP = 1;

function isTruthyOption(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    return s === "true" || s === "1" || s === "yes";
  }
  return false;
}

/** True when the field config allows values below zero. */
export function numericFieldAllowsNegative(bounds: NumericFieldBounds): boolean {
  return bounds.min < 0;
}

/** Intermediate typed values while entering a signed number (e.g. "-", "-.", "1."). */
export function isNumericInputDraft(value: string): boolean {
  const v = value.trim().replace(",", ".");
  if (v === "" || v === "-" || v === "." || v === "-.") return true;
  return /^-?\d+\.$/.test(v);
}

function toFiniteNumber(value: unknown): number | undefined {
  if (value == null || value === false || value === true) return undefined;
  let raw = String(value).trim();
  if (!raw) return undefined;
  // Allow "0.01", "0,01", or a number embedded in text ("step 0.01")
  raw = raw.replace(",", ".");
  const direct = Number(raw);
  if (Number.isFinite(direct)) return direct;
  const match = raw.match(/-?\d+(?:\.\d+)?/);
  if (!match) return undefined;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : undefined;
}

function firstNumberInLine(line: string | undefined): number | undefined {
  if (!line || !line.trim()) return undefined;
  return toFiniteNumber(line.trim());
}

/**
 * NUMERIC help_text convention:
 *   line 1 → lower limit (min)
 *   line 2 → upper limit (max)
 *   line 3 → step / resolution (e.g. 0.01)
 *
 * Also accepts a single line: "0 100 0.01" or "0,100,0.01" or "0;100;0.01".
 */
export function parseNumericHelpText(helpText?: string | null): Partial<NumericFieldBounds> {
  if (!helpText || !String(helpText).trim()) return {};
  const normalized = String(helpText).replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  const lines = normalized.split("\n");
  const out: Partial<NumericFieldBounds> = {};

  if (lines.length >= 2) {
    const min = firstNumberInLine(lines[0]);
    const max = firstNumberInLine(lines[1]);
    const step = firstNumberInLine(lines[2]);
    if (min !== undefined) out.min = min;
    if (max !== undefined) out.max = max;
    if (step !== undefined && step > 0) out.step = step;
    return out;
  }

  // Single-line: min max step (space / comma / semicolon separated)
  const parts = normalized.split(/[,;\s]+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) {
    const min = toFiniteNumber(parts[0]);
    const max = toFiniteNumber(parts[1]);
    const step = toFiniteNumber(parts[2]);
    if (min !== undefined) out.min = min;
    if (max !== undefined) out.max = max;
    if (step !== undefined && step > 0) out.step = step;
  } else if (parts.length === 1) {
    // Ambiguous single number — treat as step only when clearly fractional, else min
    const n = toFiniteNumber(parts[0]);
    if (n !== undefined) {
      if (n > 0 && n < 1) out.step = n;
      else out.min = n;
    }
  }
  return out;
}

function optionsObject(options: unknown): Record<string, unknown> {
  return options && typeof options === "object" && !Array.isArray(options)
    ? (options as Record<string, unknown>)
    : {};
}

/** options.max_formula (e.g. "B*4"), or a legacy plain-formula options value ("B*4" / ["B*4"]); "" when none. */
export function numericMaxFormula(options: unknown): string {
  if (typeof options === "string") return options.trim();
  if (Array.isArray(options)) {
    return options.length === 1 && typeof options[0] === "string" ? options[0].trim() : "";
  }
  const formula = optionsObject(options).max_formula;
  return typeof formula === "string" ? formula.trim() : "";
}

export type NumericConstraintSource = "options" | "help_text" | null;

export type NumericConstraints = {
  min?: number;
  max?: number;
  step?: number;
  maxFormula: string;
  source: { min: NumericConstraintSource; max: NumericConstraintSource; step: NumericConstraintSource };
};

/**
 * The min / max / step / max formula configured on the equipment for a NUMERIC field. The single place
 * that decides where a numeric limit comes from: options first, then help-text lines 1–3, else undefined
 * (no UI default). Mirrors the backend `numeric_field_limits.numeric_constraints`.
 */
export function numericConstraints(
  field: { options?: unknown; help_text?: string | null } | null | undefined,
): NumericConstraints {
  const opts = optionsObject(field?.options);
  const fromHelp = parseNumericHelpText(field?.help_text);
  const out: NumericConstraints = {
    maxFormula: numericMaxFormula(field?.options),
    source: { min: null, max: null, step: null },
  };
  for (const key of ["min", "max", "step"] as const) {
    let value = toFiniteNumber(opts[key]);
    if (key === "step" && value !== undefined && value <= 0) value = undefined;
    let source: NumericConstraintSource = value !== undefined ? "options" : null;
    if (value === undefined && fromHelp[key] !== undefined) {
      value = fromHelp[key];
      source = "help_text";
    }
    out[key] = value;
    out.source[key] = source;
  }
  return out;
}

const PLAIN_NUMBER_RE = /^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/;

/** True when the help text is only the min / max / step numbers (nothing a user should read). */
export function isNumericHelpTextConvention(helpText?: string | null): boolean {
  if (!helpText || !String(helpText).trim()) return false;
  const normalized = String(helpText).replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  const lines = normalized.split("\n");
  let tokens: string[];
  if (lines.length >= 2) {
    if (lines.length > 3) return false;
    tokens = lines.map((l) => l.trim()).filter(Boolean);
  } else {
    tokens = normalized.split(/[,;\s]+/).filter(Boolean);
    if (tokens.length !== 1 && tokens.length !== 3) return false;
  }
  return (
    tokens.length > 0 &&
    tokens.every((t) => PLAIN_NUMBER_RE.test(t)) &&
    Object.keys(parseNumericHelpText(helpText)).length > 0
  );
}

/** Help text to show users: empty for a NUMERIC field whose help text is only the limit numbers. */
export function numericHelpTextForDisplay(field: { field_type?: string; help_text?: string | null }): string {
  const text = String(field.help_text ?? "").trim();
  if (String(field.field_type ?? "").toUpperCase() === "NUMERIC" && isNumericHelpTextConvention(text)) return "";
  return text;
}

/** Number inputs cannot go below 1 unless the field is set up for decimal or negative values. */
export const NUMERIC_MIN_FLOOR = 1;

type NumericFieldConfigLike = {
  options?: unknown;
  help_text?: string | null;
  default_value?: unknown;
};

function strictDefaultNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || typeof value === "boolean") return undefined;
  const raw = String(value).trim().replace(",", ".");
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * True when the equipment set the field up for decimal or negative values, so the minimum of 1 does not
 * apply: Allow negative, a negative or fractional Min (e.g. -7 eV, 0.1 s/step), a Step below 1, or a
 * negative / fractional default (e.g. a 0.02 degree step size). A Min of 0 alone is not such a signal.
 * Mirrors the backend `numeric_field_allows_below_one`.
 */
export function numericFieldAllowsBelowOne(field: NumericFieldConfigLike | null | undefined): boolean {
  const opts = optionsObject(field?.options);
  if (isTruthyOption(opts.allow_negative) || isTruthyOption(opts.allowNegative)) return true;
  const configured = numericConstraints(field);
  if (configured.min !== undefined && configured.min < NUMERIC_MIN_FLOOR && configured.min !== 0) return true;
  if (configured.step !== undefined && configured.step < 1) return true;
  const def = strictDefaultNumber(field?.default_value);
  return def !== undefined && def < NUMERIC_MIN_FLOOR && def !== 0;
}

/** Resolution of a fractional default (0.02 → 0.01), so an unset Step does not round it away. */
function stepFromDefault(value: unknown): number | undefined {
  const n = strictDefaultNumber(value);
  if (n === undefined || Number.isInteger(n)) return undefined;
  const text = Math.abs(n).toFixed(10).replace(/0+$/, "");
  const places = text.includes(".") ? text.length - text.indexOf(".") - 1 : 0;
  return places > 0 ? Number((10 ** -places).toFixed(places)) : undefined;
}

export type ResolveNumericBoundsOptions = {
  /** Set false to get the configured minimum without the floor of 1 (e.g. for legacy values). */
  applyMinFloor?: boolean;
};

export function resolveNumericFieldBounds(
  field: NumericFieldConfigLike | null | undefined,
  formulaMax?: number | null,
  { applyMinFloor = true }: ResolveNumericBoundsOptions = {}
): NumericFieldBounds {
  const opts = optionsObject(field?.options);
  const configured = numericConstraints(field);

  let min = configured.min ?? DEFAULT_NUMERIC_MIN;
  if (applyMinFloor && min < NUMERIC_MIN_FLOOR && !numericFieldAllowsBelowOne(field)) {
    min = NUMERIC_MIN_FLOOR;
  }
  let max: number;
  if (formulaMax !== undefined && formulaMax !== null && Number.isFinite(formulaMax)) {
    max = Number(formulaMax);
  } else {
    max = configured.max ?? DEFAULT_NUMERIC_MAX;
  }
  const step = configured.step ?? stepFromDefault(field?.default_value) ?? DEFAULT_NUMERIC_STEP;

  // Explicit allow_negative: if min is still non-negative, open the floor to -max.
  const allowNegative =
    isTruthyOption(opts.allow_negative) || isTruthyOption(opts.allowNegative);
  if (allowNegative && min >= 0) {
    min = -Math.abs(max === 0 ? DEFAULT_NUMERIC_MAX : max);
  }

  if (max < min) max = min;
  return { min, max, step };
}

export function formatNumericBound(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (Number.isInteger(n)) return String(n);
  return String(Number(n.toFixed(10))).replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");
}

/**
 * Initial / default value for a NUMERIC dynamic field.
 * Honours configured min/max (including negative lower limits and negative defaults).
 * An optional field starts blank when it has no default or its default is below the minimum (e.g. a
 * legacy default of 0), so nothing is charged for a value the user did not choose.
 * A required field with a blank default: A/B prefer 1 if that lies in range (sample/slot counts), else min.
 */
export function initialNumericFieldValue(field: {
  field_key?: string;
  default_value?: unknown;
  options?: unknown;
  help_text?: string | null;
  is_required?: boolean;
}): string {
  const bounds = resolveNumericFieldBounds(field);
  const { min, max } = bounds;
  const required = field.is_required !== false;
  const raw = field.default_value;
  if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
    const parsed = Number(String(raw).trim().replace(",", "."));
    if (Number.isFinite(parsed)) {
      if (parsed < min && !required) return "";
      const clamped = Math.min(max, Math.max(min, parsed));
      return formatNumericBound(clamped);
    }
  }
  if (!required) return "";
  const key = String(field.field_key || "").toUpperCase();
  if ((key === "A" || key === "B") && 1 >= min && 1 <= max) {
    return "1";
  }
  return formatNumericBound(min);
}

function strictFiniteNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "" || typeof value === "boolean") return undefined;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : undefined;
}

type FormulaFieldLike = {
  field_key?: string;
  field_type?: string;
  default_value?: unknown;
  options?: unknown;
  help_text?: string | null;
};

/**
 * Values a max formula uses for fields a sample set leaves empty or hidden: the value the form starts
 * each field with (its default within its limits, else its minimum). First row per key wins.
 * Mirrors the backend `formula_fallback_value`.
 */
export function formulaFallbackValues(
  fields: ReadonlyArray<FormulaFieldLike | null | undefined> | null | undefined
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const field of fields ?? []) {
    const key = String(field?.field_key || "");
    if (!field || !key || key in out) continue;
    const start =
      String(field.field_type || "").toUpperCase().trim() === "NUMERIC"
        ? strictFiniteNumber(initialNumericFieldValue({ ...field, is_required: true }))
        : strictFiniteNumber(field.default_value);
    if (start !== undefined) out[key] = start;
  }
  return out;
}

function formulaNumber(n: number): string {
  const text = formatNumericBound(n);
  return n < 0 ? `(${text})` : text;
}

/**
 * Upper limit from a NUMERIC field's options.max_formula (field keys A–Z and SLOT_DURATION_MINUTES,
 * e.g. "B*4", or a constant such as "1"), worked out with one sample set's `values`. Any field may have
 * one. Only the other fields' current values are read (no recursion); an empty referenced field uses
 * `fallbacks` (see `formulaFallbackValues`). Undefined, with a console warning, when the formula cannot
 * be worked out, so the static limits apply. Mirrors the backend `evaluate_max_formula`.
 */
export function resolveFormulaMax(
  field: { field_key?: string; options?: unknown } | null | undefined,
  values: Record<string, unknown>,
  slotDurationMinutes?: number | null,
  fallbacks?: Record<string, number>,
): number | undefined {
  const formula = numericMaxFormula(field?.options);
  if (!formula) return undefined;
  let expr = formula;
  for (const token of Array.from(new Set(formula.match(/\b[A-Z]\b/g) ?? []))) {
    const raw = values?.[token];
    const value = (typeof raw === "object" ? undefined : strictFiniteNumber(raw)) ?? fallbacks?.[token];
    if (value === undefined) {
      console.warn(`Ignoring max formula "${formula}" on field ${field?.field_key}: field ${token} has no value or default.`);
      return undefined;
    }
    expr = expr.replace(new RegExp(`\\b${token}\\b`, "g"), formulaNumber(value));
  }
  expr = expr.replace(/\bSLOT_DURATION_MINUTES\b/g, formulaNumber(strictFiniteNumber(slotDurationMinutes) ?? 0));
  let result: number | undefined;
  try {
    if (/^[0-9+\-*/().\s]+$/.test(expr)) {
      result = strictFiniteNumber(Function(`"use strict"; return (${expr});`)());
    }
  } catch {
    result = undefined;
  }
  if (result === undefined) {
    console.warn(`Ignoring max formula "${formula}" on field ${field?.field_key}: it cannot be worked out.`);
  }
  return result;
}

/** True when a numeric input is present and within resolved [min, max]. */
export function isNumericValueWithinBounds(
  raw: unknown,
  field: { field_key?: string; options?: unknown; help_text?: string | null },
  formulaMax?: number | null
): boolean {
  if (raw === undefined || raw === null || raw === "") return false;
  const n = typeof raw === "number" ? raw : Number(String(raw).trim().replace(",", "."));
  if (!Number.isFinite(n)) return false;
  const { min, max } = resolveNumericFieldBounds(field, formulaMax);
  return n >= min && n <= max;
}

/** HTML step attribute — keep decimal resolution (never coerce to int). */
export function formatStepAttr(step: number): string {
  if (!Number.isFinite(step) || step <= 0) return "1";
  return formatNumericBound(step);
}

export function decimalPlacesForStep(step: number): number {
  if (!Number.isFinite(step) || step <= 0) return 0;
  const s = formatStepAttr(step);
  const i = s.indexOf(".");
  return i === -1 ? 0 : s.length - i - 1;
}

export function roundToStepPrecision(value: number, step: number): number {
  const places = decimalPlacesForStep(step);
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/** Increment/decrement by step while staying within [min, max]. */
export function nudgeNumericValue(
  current: string | number | null | undefined,
  direction: 1 | -1,
  bounds: NumericFieldBounds
): string {
  const { min, max, step } = bounds;
  const raw =
    current === "" || current === null || current === undefined
      ? min
      : typeof current === "number"
        ? current
        : Number(String(current).trim());
  const base = Number.isFinite(raw) ? raw : min;
  const next = roundToStepPrecision(base + direction * step, step);
  const clamped = Math.min(max, Math.max(min, next));
  return formatNumericBound(clamped);
}

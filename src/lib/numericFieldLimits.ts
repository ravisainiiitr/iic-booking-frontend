/** NUMERIC dynamic-field limits from options / help_text. */

export type NumericFieldBounds = {
  min: number;
  max: number;
  step: number;
};

export const DEFAULT_NUMERIC_MIN = 0;
export const DEFAULT_NUMERIC_MAX = 100;
export const DEFAULT_NUMERIC_STEP = 1;

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

export function resolveNumericFieldBounds(
  field: {
    options?: unknown;
    help_text?: string | null;
  } | null | undefined,
  formulaMax?: number | null
): NumericFieldBounds {
  const rawOptions = field?.options;
  const opts =
    rawOptions && typeof rawOptions === "object" && !Array.isArray(rawOptions)
      ? (rawOptions as Record<string, unknown>)
      : {};
  const fromHelp = parseNumericHelpText(field?.help_text);

  const min = toFiniteNumber(opts.min) ?? fromHelp.min ?? DEFAULT_NUMERIC_MIN;
  let max: number;
  if (formulaMax !== undefined && formulaMax !== null && Number.isFinite(formulaMax)) {
    max = Number(formulaMax);
  } else {
    max = toFiniteNumber(opts.max) ?? fromHelp.max ?? DEFAULT_NUMERIC_MAX;
  }
  let step = toFiniteNumber(opts.step) ?? fromHelp.step ?? DEFAULT_NUMERIC_STEP;
  if (step <= 0) step = DEFAULT_NUMERIC_STEP;
  if (max < min) max = min;
  return { min, max, step };
}

export function formatNumericBound(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (Number.isInteger(n)) return String(n);
  return String(Number(n.toFixed(10))).replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");
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

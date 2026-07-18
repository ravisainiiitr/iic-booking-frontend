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
  const n = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : undefined;
}

/**
 * NUMERIC help_text convention:
 *   line 1 → lower limit (min)
 *   line 2 → upper limit (max)
 *   line 3 → step / resolution (e.g. 0.01)
 */
export function parseNumericHelpText(helpText?: string | null): Partial<NumericFieldBounds> {
  if (!helpText || !String(helpText).trim()) return {};
  const lines = String(helpText).replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const out: Partial<NumericFieldBounds> = {};
  if (lines[0]?.trim()) {
    const n = toFiniteNumber(lines[0].trim());
    if (n !== undefined) out.min = n;
  }
  if (lines[1]?.trim()) {
    const n = toFiniteNumber(lines[1].trim());
    if (n !== undefined) out.max = n;
  }
  if (lines[2]?.trim()) {
    const n = toFiniteNumber(lines[2].trim());
    if (n !== undefined && n > 0) out.step = n;
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
  if (Number.isInteger(n)) return String(n);
  return String(Number(n.toFixed(6))).replace(/\.?0+$/, "");
}

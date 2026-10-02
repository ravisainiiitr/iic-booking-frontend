/**
 * Field A / B maximums configured on the equipment apply to all sample sets of a booking combined
 * (sample set 1 plus every "Samples with different parameters" set). Mirrors the backend
 * `sample_set_limits.combined_max_error`.
 */
import { formatNumericBound, numericConstraints, resolveNumericFieldBounds } from "@/lib/numericFieldLimits";

export const COMBINED_LIMIT_FIELD_KEYS = ["A", "B"] as const;

export type CombinedLimitFieldDef = {
  field_key?: string;
  field_label?: string;
  field_type?: string;
  options?: unknown;
  help_text?: string | null;
  default_value?: unknown;
  is_required?: boolean;
};

export type CombinedLimit = {
  key: string;
  label: string;
  max: number;
  /** Smallest value a new sample set needs for this field (field min, or one step when required). */
  floor: number;
};

export type CombinedAllowance = CombinedLimit & {
  used: number;
  remaining: number;
  over: boolean;
};

type Values = Record<string, unknown>;

function toNumber(value: unknown): number {
  if (value === undefined || value === null || value === "" || typeof value === "boolean") return 0;
  const n = typeof value === "number" ? value : Number(String(value).trim().replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** Maximum set on the equipment (options.max, else help_text line 2); not the UI fallback of 100 or a formula max. */
export function configuredStaticMax(field: CombinedLimitFieldDef): number | undefined {
  const configured = numericConstraints(field);
  return configured.maxFormula ? undefined : configured.max;
}

export function combinedLimits(fields: CombinedLimitFieldDef[] | null | undefined): CombinedLimit[] {
  const out: CombinedLimit[] = [];
  for (const field of fields ?? []) {
    const key = String(field.field_key || "").trim().toUpperCase();
    if (!(COMBINED_LIMIT_FIELD_KEYS as readonly string[]).includes(key)) continue;
    if (String(field.field_type || "").trim().toUpperCase() !== "NUMERIC") continue;
    const max = configuredStaticMax(field);
    if (max === undefined) continue;
    const { min, step } = resolveNumericFieldBounds(field);
    out.push({
      key: String(field.field_key),
      label: field.field_label || String(field.field_key),
      max,
      floor: Math.max(min, field.is_required ? step : 0),
    });
  }
  return out;
}

function sumOver(groups: Values[], key: string): number {
  return groups.reduce((total, group) => total + toNumber(group?.[key]), 0);
}

export function combinedAllowances(
  fields: CombinedLimitFieldDef[] | null | undefined,
  primary: Values,
  sets: Values[],
): CombinedAllowance[] {
  return combinedLimits(fields).map((limit) => {
    const used = sumOver([primary, ...sets], limit.key);
    return { ...limit, used, remaining: limit.max - used, over: used > limit.max };
  });
}

export function combinedLimitMessage(allowance: CombinedAllowance): string {
  return (
    `Total ${allowance.label} across all sample sets (${formatNumericBound(allowance.used)}) exceeds the maximum ` +
    `allowed (${formatNumericBound(allowance.max)}) for this equipment.`
  );
}

/**
 * First combined-limit error, or null. Only bookings with extra sample sets are checked (like the backend).
 * `baseline` is the booking's stored inputs when editing: a total that already exceeded the maximum may be
 * kept or lowered, but not raised.
 */
export function combinedLimitError(
  fields: CombinedLimitFieldDef[] | null | undefined,
  primary: Values,
  sets: Values[],
  baseline?: { primary: Values; sets: Values[] },
): string | null {
  if (sets.length === 0) return null;
  const before = baseline ? combinedAllowances(fields, baseline.primary, baseline.sets) : [];
  const over = combinedAllowances(fields, primary, sets).find(
    (a) => a.over && !((before.find((b) => b.key === a.key)?.used ?? -Infinity) >= a.used),
  );
  return over ? combinedLimitMessage(over) : null;
}

/** Largest value extra set `index` may hold for `limit` given every other set (and sample set 1). */
export function maxForExtraSet(limit: CombinedLimit, primary: Values, sets: Values[], index: number): number {
  const others = sumOver([primary, ...sets.filter((_, i) => i !== index)], limit.key);
  return Math.max(0, limit.max - others);
}

/** Largest value sample set 1 may hold for `limit` given the extra sample sets. */
export function maxForPrimarySet(limit: CombinedLimit, sets: Values[]): number {
  return Math.max(0, limit.max - sumOver(sets, limit.key));
}

export function combinedMaxReachedHint(limit: CombinedLimit): string {
  return `Combined max of ${formatNumericBound(limit.max)} reached across all sample sets`;
}

/**
 * Bounds for one sample set's A / B input when what is left of the combined maximum (`available`) is
 * tighter than the field's own maximum; `maxHint` then explains the limit next to the box.
 */
export function boundsWithCombinedMax<B extends { min: number; max: number; step: number }>(
  bounds: B,
  limit: CombinedLimit | undefined,
  available: number | undefined,
): { bounds: B; maxHint?: string } {
  if (!limit || available === undefined || !(available < bounds.max)) return { bounds };
  return {
    bounds: { ...bounds, max: Math.max(bounds.min, available) },
    maxHint: combinedMaxReachedHint(limit),
  };
}

/**
 * Values for a new sample set copied from `template`, with A / B lowered to what is still available.
 * Returns null when a field cannot fit its minimum in the remaining allowance.
 */
export function fitNewSampleSet<T extends Values>(
  fields: CombinedLimitFieldDef[] | null | undefined,
  primary: Values,
  sets: Values[],
  template: T,
): T | null {
  const next: Values = { ...template };
  for (const allowance of combinedAllowances(fields, primary, sets)) {
    const remaining = Math.max(0, allowance.remaining);
    if (remaining < allowance.floor) return null;
    if (toNumber(next[allowance.key]) > remaining) {
      next[allowance.key] = formatNumericBound(remaining);
    }
  }
  return next as T;
}

export function formatAllowance(allowance: CombinedAllowance): string {
  return `${allowance.label}: ${formatNumericBound(allowance.used)} of ${formatNumericBound(allowance.max)} used across all sample sets`;
}

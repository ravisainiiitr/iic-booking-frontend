/**
 * Field A / B maximums configured on the equipment apply to all sample sets of a booking combined
 * (sample set 1 plus every "Samples with different parameters" set). Mirrors the backend
 * `sample_set_limits.combined_max_error`.
 */
import {
  formatNumericBound,
  isNumericInputDraft,
  numericConstraints,
  numericMaxFormula,
  resolveFieldAFormulaMax,
  resolveNumericFieldBounds,
  type NumericFieldBounds,
} from "@/lib/numericFieldLimits";

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

export function combinedMaxAllowedHint(limit: CombinedLimit): string {
  return `Combined max of ${formatNumericBound(limit.max)} allowed across all sample sets`;
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
    maxHint: combinedMaxAllowedHint(limit),
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

export type SampleSetFormulaContext = {
  /** Equipment slot length, for formulas using SLOT_DURATION_MINUTES. */
  slotDurationMinutes?: number | null;
  /** External booking users skip field A's formula / options.max, as in sample set 1. */
  skipFormulaLimits?: boolean;
};

function formulaMaxFor(field: CombinedLimitFieldDef, values: Values, ctx: SampleSetFormulaContext) {
  return ctx.skipFormulaLimits ? undefined : resolveFieldAFormulaMax(field, values, ctx.slotDurationMinutes);
}

/**
 * Limits of a NUMERIC field in one sample set. A formula maximum (e.g. A <= B*4) is worked out from that
 * set's own values, exactly as sample set 1's is from its values.
 */
export function sampleSetFieldBounds(
  field: CombinedLimitFieldDef,
  values: Values,
  ctx: SampleSetFormulaContext = {},
): NumericFieldBounds {
  return resolveNumericFieldBounds(field, formulaMaxFor(field, values, ctx));
}

/** How a formula maximum was worked out, e.g. "B × 4, where B is Number of Slots = 2" (mirrors the backend). */
export function formulaLimitNote(formula: string, values: Values, labels: Record<string, string>): string {
  const refs: string[] = [];
  for (const key of new Set(formula.match(/(?<![A-Za-z0-9_])[A-Z](?![A-Za-z0-9_])/g) ?? [])) {
    const raw = values[key];
    const n = raw === undefined || raw === null || raw === "" ? NaN : Number(String(raw).trim().replace(",", "."));
    const shown = Number.isFinite(n) ? formatNumericBound(n) : "not set";
    const label = labels[key];
    refs.push(label && label !== key ? `${key} is ${label} = ${shown}` : `${key} = ${shown}`);
  }
  const note = formula.trim().replace(/\s*\*\s*/g, " × ");
  return refs.length ? `${note}, where ${refs.join(" and ")}` : note;
}

/**
 * First NUMERIC value outside its limits in an extra sample set, each set checked on its own values (its
 * own B for A <= B*4), named by set ("Sample set 2: …"), else null. Mirrors the backend check.
 * `storedSets` are the sets as saved when editing: an unchanged value below the minimum of 1 saved before
 * that rule is kept, as the backend does.
 */
export function sampleSetFieldLimitError(
  fields: CombinedLimitFieldDef[] | null | undefined,
  sets: Values[],
  ctx: SampleSetFormulaContext = {},
  storedSets: Values[] = [],
): string | null {
  const numeric = (fields ?? []).filter((f) => String(f.field_type || "").trim().toUpperCase() === "NUMERIC");
  if (numeric.length === 0) return null;
  const labels: Record<string, string> = {};
  for (const f of fields ?? []) {
    const key = String(f.field_key || "");
    if (key && !(key in labels)) labels[key] = f.field_label || key;
  }
  for (const [index, values] of sets.entries()) {
    for (const field of numeric) {
      const key = String(field.field_key || "");
      const raw = values?.[key];
      if (raw === undefined || raw === null || raw === "" || (typeof raw === "string" && isNumericInputDraft(raw))) {
        continue;
      }
      const n = typeof raw === "number" ? raw : Number(String(raw).trim().replace(",", "."));
      if (!Number.isFinite(n)) continue;
      const formulaMax = formulaMaxFor(field, values, ctx);
      const { min, max } = resolveNumericFieldBounds(field, formulaMax);
      const label = labels[key] || key;
      const prefix = `Sample set ${index + 2}: `;
      if (n < min) {
        const stored = storedSets[index]?.[key];
        const keptLegacy =
          stored !== undefined &&
          String(stored).trim() === String(raw).trim() &&
          n >= resolveNumericFieldBounds(field, undefined, { applyMinFloor: false }).min;
        if (keptLegacy) continue;
        return `${prefix}${label} cannot be less than ${formatNumericBound(min)}.`;
      }
      if (n > max) {
        const formula = formulaMax !== undefined ? numericMaxFormula(field.options) : "";
        const note = formula ? ` (${formulaLimitNote(formula, values, labels)})` : "";
        return `${prefix}${label} cannot be greater than ${formatNumericBound(max)}${note}.`;
      }
    }
  }
  return null;
}

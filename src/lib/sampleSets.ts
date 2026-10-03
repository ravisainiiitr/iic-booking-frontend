import { buildInitialInputValues, type DynamicFieldDefaultDef } from "@/lib/dynamicFieldDefaults";
import { normalizeChoiceOption } from "@/lib/dynamicFieldOptions";
import { resolveChoiceDisplay } from "@/lib/bookingInputDisplay";

/** Extra sample parameter sets in one booking live under this key of `input_values`. */
export const SAMPLE_SETS_KEY = "_sample_sets";
/** Additional sets on top of sample set 1 (matches the backend limit). */
export const MAX_SAMPLE_SETS = 20;

export type SampleSetValues = Record<
  string,
  string | boolean | string[] | string[][] | number | Record<string, unknown>[]
>;

/**
 * Whether new sample sets may be added for this equipment: the main admin's "Allow samples with different
 * parameters" switch (on unless explicitly false) and never for 3D printing.
 */
export function sampleSetsAllowedFor(
  equipment: { allow_multiple_sample_sets?: boolean | null; profile_type?: string | null } | null | undefined,
): boolean {
  return equipment?.allow_multiple_sample_sets !== false && equipment?.profile_type !== "PRINT_3D";
}

export function readSampleSets(inputValues: Record<string, unknown> | null | undefined): SampleSetValues[] {
  const raw = inputValues?.[SAMPLE_SETS_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.filter((s): s is SampleSetValues => !!s && typeof s === "object" && !Array.isArray(s));
}

export function withoutSampleSets<T extends Record<string, unknown>>(inputValues: T): T {
  if (!inputValues || !(SAMPLE_SETS_KEY in inputValues)) return inputValues;
  const { [SAMPLE_SETS_KEY]: _omit, ...rest } = inputValues;
  void _omit;
  return rest as T;
}

/** Values a new sample set starts with: each field's configured default, never sample set 1's values. */
export function defaultSampleSetValues(fields: DynamicFieldDefaultDef[]): SampleSetValues {
  return buildInitialInputValues(fields) as SampleSetValues;
}

type SummaryField = { field_key: string; field_label?: string; field_type?: string; options?: unknown };

function displayValue(field: SummaryField, set: SampleSetValues): string {
  const type = String(field.field_type || "").toUpperCase().trim();
  const raw = set[field.field_key];
  if (type === "TABLE" || type === "TYPED_TABLE" || type === "ICPMS_STANDARD_COVERAGE") return "";
  if (type === "PERIODIC_TABLE") {
    const elements = String(set[`${field.field_key}_elements`] ?? "").trim();
    return elements ? elements.split(",").map((s) => s.trim()).filter(Boolean).join(", ") : "";
  }
  if (type === "TOGGLE") return raw === true || raw === "true" ? "Yes" : "No";
  const options = Array.isArray(field.options) ? field.options.map((o, i) => normalizeChoiceOption(o, i)) : [];
  const label = (v: unknown) => options.find((o) => o.value === String(v))?.label ?? String(v);
  if (Array.isArray(raw)) return raw.map(label).join(", ");
  if (raw === undefined || raw === null || String(raw).trim() === "") return "";
  return type === "RADIO" || type === "COMBO" ? resolveChoiceDisplay(raw, field.options, type) : String(raw);
}

/** Short "Label: value · …" line shown on a collapsed sample set. */
export function sampleSetSummary(fields: SummaryField[], set: SampleSetValues, limit = 3): string {
  const parts: string[] = [];
  for (const field of fields) {
    const value = displayValue(field, set);
    if (!value) continue;
    parts.push(`${String(field.field_label || field.field_key).replace(/:\s*$/, "")}: ${value}`);
    if (parts.length >= limit) break;
  }
  return parts.join(" · ");
}

export function withSampleSets<T extends Record<string, unknown>>(
  inputValues: T,
  sets: SampleSetValues[],
): T & { [SAMPLE_SETS_KEY]?: SampleSetValues[] } {
  const base = withoutSampleSets(inputValues);
  return sets.length > 0 ? { ...base, [SAMPLE_SETS_KEY]: sets } : base;
}

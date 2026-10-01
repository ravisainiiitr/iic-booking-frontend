import { apiClient } from "@/lib/api";
import { mergePeriodicDisplaySymbols, parsePeriodicHelpText } from "@/data/periodicTableData";
import type { SampleSetValues } from "@/lib/sampleSets";

export type PeriodicSelectionField = {
  field_key: string;
  field_type?: string;
  help_text?: string | null;
  source_element_field_key?: string | null;
};

export const splitElements = (raw: unknown): string[] =>
  typeof raw === "string" && raw ? raw.split(",").map((s) => s.trim()).filter(Boolean) : [];

/**
 * Same rules as the booking page's periodic "Apply": element counts plus ICPMS standard coverage.
 * Returns the value updates for one sample set (sample set 1 or an extra set).
 */
export async function computePeriodicElementUpdates(
  fields: PeriodicSelectionField[],
  field: PeriodicSelectionField,
  symbols: string[],
): Promise<SampleSetValues> {
  const key = field.field_key;
  const { disabled: disabledSet, preselected } = parsePeriodicHelpText(field.help_text);
  const icpmsFields = fields.filter(
    (f) => String(f.field_type || "").toUpperCase().trim() === "ICPMS_STANDARD_COVERAGE",
  );
  const matching = icpmsFields.filter((f) => String(f.source_element_field_key || "").trim() === key);
  const coverageFields = matching.length > 0 ? matching : icpmsFields;
  const updates: SampleSetValues = {};

  const build = (picked: string[]) => {
    const merged = mergePeriodicDisplaySymbols(picked, field.help_text);
    const all = merged.all.filter((s) => !disabledSet.has(s));
    const billable = merged.billable.length;
    const countFor = (k: string) => (k === "A" || k === "B" ? (billable > 0 ? Math.max(1, billable) : 0) : billable);
    updates[key] = countFor(key);
    updates[`${key}_elements`] = all.join(",");
    for (const f of coverageFields) {
      const src = String(f.source_element_field_key || "").trim();
      if (!src) continue;
      updates[src] = countFor(src);
      updates[`${src}_elements`] = all.join(",");
    }
    return all;
  };

  let allowed = build([...symbols, ...Array.from(preselected)]);

  if (coverageFields.length > 0) {
    let count = 0;
    try {
      while (allowed.length > 0) {
        const res = await apiClient.getIcpmsMinStandardsCover(allowed);
        const uncovered = Array.isArray(res?.data?.uncovered) ? res.data.uncovered : [];
        if (uncovered.length === 0) {
          count = res?.data?.count ?? 0;
          break;
        }
        const exclude = window.confirm(
          `Some selected elements cannot be covered by available standards.\n\nUncovered elements:\n${uncovered.join(", ")}\n\nDo you want to exclude these elements and recalculate?`,
        );
        if (!exclude) {
          allowed = build(Array.from(preselected));
          break;
        }
        const uncoveredSet = new Set(uncovered.map((u) => String(u).toUpperCase()));
        const remaining = allowed.filter((s) => preselected.has(s) || !uncoveredSet.has(s.toUpperCase()));
        if (remaining.length === allowed.length) break;
        allowed = build(remaining);
      }
    } catch {
      count = 0;
    }
    for (const f of coverageFields) updates[f.field_key] = count;
  }
  return updates;
}

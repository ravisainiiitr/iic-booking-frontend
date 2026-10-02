/**
 * The equipment's sample-count input (a NUMERIC field labelled like "No. of Samples", "Number of samples",
 * "Sample count" or "Samples") and booking totals over all sample sets.
 * Mirrors the backend `booking_sample_summary.py`.
 */
import { readSampleSets } from "@/lib/sampleSets";

const NUMERIC_FIELD_TYPES = new Set(["NUMERIC", "NUMBER"]);
const COUNT_WORDS = String.raw`(?:nos\.?|no\.?|number|count|qty\.?|quantity|how\s+many)`;
const SAMPLE_COUNT_LABEL_RE = new RegExp(
  String.raw`\b${COUNT_WORDS}\s*(?:of\s+)?samples?\b|\bsamples?\s*\(?\s*${COUNT_WORDS}|^\s*samples?\s*$`,
  "i",
);
const PER_SAMPLE_RE = /\b(?:per|each)\s+sample\b/i;

type CountField = { field_key: string; field_label?: string; field_type?: string };

export function isSampleCountLabel(label: string | null | undefined): boolean {
  const text = String(label || "");
  return SAMPLE_COUNT_LABEL_RE.test(text) && !PER_SAMPLE_RE.test(text);
}

/** Key of the first NUMERIC input (in field-key order) labelled as a sample count, else null. */
export function sampleCountFieldKey(fields: CountField[] | null | undefined): string | null {
  const sorted = [...(fields ?? [])].sort((a, b) => String(a.field_key).localeCompare(String(b.field_key)));
  for (const field of sorted) {
    if (!NUMERIC_FIELD_TYPES.has(String(field.field_type || "").trim().toUpperCase())) continue;
    if (isSampleCountLabel(field.field_label)) return field.field_key;
  }
  return null;
}

export function positiveCount(value: unknown): number | null {
  if (value === undefined || value === null || typeof value === "boolean") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim().replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export type SampleSummary = { sets: number; samples: number | null };

export function bookingSampleSummary(
  fields: CountField[] | null | undefined,
  inputValues: Record<string, unknown> | null | undefined,
): SampleSummary {
  const values = inputValues ?? {};
  const groups = [values, ...readSampleSets(values).filter((s) => Object.keys(s).length > 0)];
  const key = sampleCountFieldKey(fields);
  const counts = key ? groups.map((g) => positiveCount(g[key])).filter((n): n is number => n !== null) : [];
  const total = counts.reduce((sum, n) => sum + n, 0);
  return { sets: groups.length, samples: counts.length > 0 ? Math.round(total * 100) / 100 : null };
}

/** "3 sets · 12 samples", "4 samples", "2 sets"; "" when there is nothing worth showing. */
export function formatSampleSummary(summary: SampleSummary | null | undefined): string {
  if (!summary) return "";
  const parts: string[] = [];
  if (summary.sets > 1) parts.push(`${summary.sets} sets`);
  if (summary.samples != null) parts.push(`${summary.samples} ${summary.samples === 1 ? "sample" : "samples"}`);
  return parts.join(" · ");
}

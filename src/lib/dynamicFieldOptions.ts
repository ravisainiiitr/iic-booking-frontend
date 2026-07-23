/**
 * Safe helpers for Dynamic Input Field options (RADIO / COMBO / MULTI_SELECT / TABLE headers).
 * Prevents React error #31 when options contain bare objects (e.g. {}).
 */

export function normalizeChoiceOption(
  option: unknown,
  index = 0
): { value: string; label: string } {
  if (option == null) {
    const fallback = String(index + 1);
    return { value: fallback, label: fallback };
  }
  if (typeof option === "string" || typeof option === "number" || typeof option === "boolean") {
    const s = String(option);
    return { value: s, label: s };
  }
  if (typeof option === "object") {
    const o = option as Record<string, unknown>;
    const rawValue = o.value ?? o.label ?? o.id ?? o.name;
    const rawLabel = o.label ?? o.value ?? o.name ?? o.id;
    const isScalar = (v: unknown) =>
      typeof v === "string" || typeof v === "number" || typeof v === "boolean";
    const value = isScalar(rawValue) ? String(rawValue) : String(index + 1);
    const label = isScalar(rawLabel) ? String(rawLabel) : value;
    return { value, label };
  }
  const fallback = String(index + 1);
  return { value: fallback, label: fallback };
}

/** Textarea display for options (one line per option / column header). */
export function optionsToLines(options: unknown): string {
  if (!Array.isArray(options)) return "";
  return options
    .map((o, i) => normalizeChoiceOption(o, i).label.trim())
    .filter((s) => s.length > 0)
    .join("\n");
}

/** Parse textarea lines into string options. */
export function linesToOptions(text: string): string[] {
  return String(text || "")
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Normalize API options for non-NUMERIC fields to a string[]. */
export function normalizeOptionsList(options: unknown): string[] {
  if (!Array.isArray(options)) return [];
  return options
    .map((o, i) => normalizeChoiceOption(o, i).label.trim())
    .filter((s) => s.length > 0);
}

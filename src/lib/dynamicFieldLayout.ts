/** Field types whose control fits beside its label on sm+ screens; anything else keeps the label on top. */
export const INLINE_DYNAMIC_FIELD_TYPES = new Set([
  "NUMERIC",
  "TEXT",
  "RADIO",
  "COMBO",
  "MULTI_SELECT",
  "TOGGLE",
  "PERIODIC_TABLE",
]);

/** Controls that can grow taller than one line, so the label lines up with their first line instead of their centre. */
export const TOP_ALIGNED_DYNAMIC_FIELD_TYPES = new Set(["MULTI_SELECT", "PERIODIC_TABLE"]);

const LONG_TEXT_LABEL = /requirement|remark|comment|description|note|detail|instruction|purpose/i;

export const normalizeDynamicFieldType = (fieldType: unknown) => String(fieldType || "").toUpperCase().trim();

/** Width for single-line controls (TEXT / COMBO) placed in the right-hand column. */
export function dynamicFieldControlWidth(fieldType: unknown, label?: unknown): string {
  const type = normalizeDynamicFieldType(fieldType);
  if (type === "COMBO") return "w-full sm:max-w-sm";
  if (type === "TEXT") return LONG_TEXT_LABEL.test(String(label || "")) ? "w-full" : "w-full sm:max-w-md";
  return "w-full";
}

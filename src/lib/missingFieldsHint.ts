/** "Fill in X and Y to see charges and available slots" for Step 1. */

export type RequiredFieldLike = {
  field_key?: string | null;
  field_label?: string | null;
  is_required?: boolean | null;
};

/** Same emptiness rule the page uses before calculating charges (0 counts as empty for required numbers). */
export function isRequiredValueMissing(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === "number" && value === 0)
  );
}

export function missingRequiredFields(
  fields: RequiredFieldLike[] | null | undefined,
  values: Record<string, unknown>,
  hiddenKeys?: ReadonlySet<string>,
): Array<{ key: string; label: string }> {
  const out: Array<{ key: string; label: string }> = [];
  for (const f of fields ?? []) {
    const key = String(f?.field_key || "").trim();
    if (!key || !f?.is_required) continue;
    if (hiddenKeys?.has(key)) continue;
    if (!isRequiredValueMissing(values[key])) continue;
    out.push({ key, label: String(f.field_label || key).trim() || key });
  }
  return out;
}

export function joinFieldNames(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

export function missingFieldsSentence(labels: string[]): string {
  if (labels.length === 0) return "";
  return `Fill in ${joinFieldNames(labels)} to see charges and available slots.`;
}

/** Moves focus to a Step 1 field: its input (id = field key) or the first control in its row. */
export function focusBookingField(key: string, doc: Document = document): boolean {
  const direct = doc.getElementById(key);
  const row = doc.querySelector<HTMLElement>(`[data-booking-field="${CSS.escape(key)}"]`);
  const target =
    (direct && isFocusable(direct) ? direct : null) ??
    row?.querySelector<HTMLElement>("input:not([type=hidden]),select,textarea,button,[tabindex]:not([tabindex='-1'])") ??
    null;
  (row ?? direct)?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  if (!target) return false;
  target.focus({ preventScroll: true });
  return true;
}

function isFocusable(el: HTMLElement): boolean {
  return /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(el.tagName) || el.tabIndex >= 0;
}

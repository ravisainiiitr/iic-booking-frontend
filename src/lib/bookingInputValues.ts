/** Shared helpers for booking custom input field emptiness / optional-param prompts. */

export type BookingInputFieldLike = {
  field_key?: string;
  field_type?: string;
  is_required?: boolean;
  editing_required?: boolean;
};

export function isBookingInputValueEmpty(
  value: unknown,
  field?: BookingInputFieldLike,
  allValues?: Record<string, unknown>
): boolean {
  const type = String(field?.field_type || "").toUpperCase();
  const key = String(field?.field_key || "").trim();

  if (type === "PERIODIC_TABLE" && key && allValues) {
    const els = allValues[`${key}_elements`];
    const elsEmpty = els === undefined || els === null || String(els).trim() === "";
    const countEmpty =
      value === undefined ||
      value === null ||
      value === "" ||
      (typeof value === "number" && value === 0);
    return elsEmpty && countEmpty;
  }

  if (typeof value === "boolean") return false;
  if (value === undefined || value === null || value === "") return true;
  if (typeof value === "string" && value.trim() === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === "number" && value === 0) return true;
  return false;
}

/** Free-text comments should not drive the post-booking “complete details” prompt. */
export function isCommentsInputFieldKey(fieldKey: string | undefined | null): boolean {
  return String(fieldKey || "").trim().toLowerCase() === "comments";
}

/**
 * Non-essential (optional at book time) fields that are empty and marked editable after booking.
 * These are the fields the lab wants users to finish soon after confirming a slot.
 */
export function getIncompleteOptionalEditableFields<T extends BookingInputFieldLike>(
  fields: T[] | null | undefined,
  values: Record<string, unknown>
): T[] {
  if (!fields?.length) return [];
  return fields.filter((f) => {
    const key = String(f.field_key || "").trim();
    if (!key || isCommentsInputFieldKey(key)) return false;
    if (f.is_required) return false;
    if (!f.editing_required) return false;
    return isBookingInputValueEmpty(values[key], f, values);
  });
}

export function hasIncompleteOptionalEditableParams(
  fields: BookingInputFieldLike[] | null | undefined,
  values: Record<string, unknown>
): boolean {
  return getIncompleteOptionalEditableFields(fields, values).length > 0;
}

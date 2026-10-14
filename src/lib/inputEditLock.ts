import { isCommentsInputFieldKey } from "@/lib/bookingInputValues";

/** Shown next to an input whose field has "Editing required" unchecked, for viewers who cannot change it. */
export const LOCKED_INPUT_HINT = "Editable by the OIC, Department Administrator or Main Administrator only";

/**
 * After booking, fields with "Editing required" unchecked can only be changed by the equipment's Officer in
 * Charge (incl. an active temporary OIC), a Department Administrator of its department or the Main
 * Administrator (`viewer_can_edit_locked_inputs` on the booking). The server enforces the same rule.
 */
export function isInputLockedForViewer(
  field: { field_key?: string; editing_required?: boolean } | null | undefined,
  canEditLockedInputs: boolean,
): boolean {
  if (canEditLockedInputs || !field) return false;
  if (isCommentsInputFieldKey(field.field_key)) return false;
  return field.editing_required === false;
}

export function lockedInputKeys(
  fields: Array<{ field_key?: string; editing_required?: boolean }> | null | undefined,
  canEditLockedInputs: boolean,
): Set<string> {
  const keys = new Set<string>();
  (fields ?? []).forEach((f) => {
    if (f.field_key && isInputLockedForViewer(f, canEditLockedInputs)) keys.add(f.field_key);
  });
  return keys;
}

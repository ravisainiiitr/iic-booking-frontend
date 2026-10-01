/**
 * Booking Assistant → booking page handoff. Instruments whose inputs can't be collected in chat
 * (file uploads, tables, periodic tables…) open the booking page with the equipment, the chosen day
 * and whatever the user already answered in chat. Inputs travel via sessionStorage and are
 * sanitized against the equipment's current fields by the booking page.
 */

export const BOOKING_ASSISTANT_PREFILL_KEY = "iic_booking_assistant_prefill";

export type BookingAssistantPrefill = {
  equipment_id: number;
  date?: string | null;
  input_values: Record<string, unknown>;
  saved_at: number;
};

const MAX_AGE_MS = 30 * 60 * 1000;

/** Stash the chat inputs and return the booking page URL to open. */
export function prepareBookingAssistantHandoff(
  href: string,
  prefill: { equipment_id?: unknown; date?: unknown; input_values?: unknown } | null | undefined
): string {
  const eq = Number(prefill?.equipment_id);
  const inputs =
    prefill?.input_values && typeof prefill.input_values === "object"
      ? (prefill.input_values as Record<string, unknown>)
      : {};
  if (!Number.isFinite(eq) || eq <= 0 || Object.keys(inputs).length === 0) return href;
  const payload: BookingAssistantPrefill = {
    equipment_id: eq,
    date: typeof prefill?.date === "string" ? prefill.date : null,
    input_values: inputs,
    saved_at: Date.now(),
  };
  try {
    sessionStorage.setItem(BOOKING_ASSISTANT_PREFILL_KEY, JSON.stringify(payload));
  } catch {
    return href;
  }
  return `${href}${href.includes("?") ? "&" : "?"}from=assistant`;
}

/** Read (and consume) the stashed inputs for this equipment; stale or foreign entries are ignored. */
export function takeBookingAssistantPrefill(equipmentId: number): BookingAssistantPrefill | null {
  try {
    const raw = sessionStorage.getItem(BOOKING_ASSISTANT_PREFILL_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as BookingAssistantPrefill;
    if (Number(p?.equipment_id) !== Number(equipmentId)) return null;
    sessionStorage.removeItem(BOOKING_ASSISTANT_PREFILL_KEY);
    if (!p.saved_at || Date.now() - p.saved_at > MAX_AGE_MS) return null;
    return p;
  } catch {
    return null;
  }
}

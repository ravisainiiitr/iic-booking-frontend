export interface SlotStatusFields {
  status?: string | null;
  display_status?: string | null;
  booking_status?: string | null;
}

/**
 * True when a Booked slot belongs to a completed booking. The stored slot status stays BOOKED
 * (the slot remains occupied); only what it is shown as changes. `booking_status` is the fallback
 * for API responses that predate `display_status`.
 */
export function isCompletedSlot(slot: SlotStatusFields | null | undefined): boolean {
  if (!slot) return false;
  if (String(slot.display_status || "").toUpperCase() === "COMPLETED") return true;
  return (
    String(slot.status || "").toUpperCase() === "BOOKED" &&
    String(slot.booking_status || "").toUpperCase() === "COMPLETED"
  );
}

/** Status key a slot is shown as (colour/label lookup): COMPLETED for completed bookings, else the slot status. */
export function slotShownStatus(slot: SlotStatusFields | null | undefined): string {
  if (isCompletedSlot(slot)) return "COMPLETED";
  return String(slot?.status || "").toUpperCase();
}

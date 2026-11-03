/**
 * Whether the booking page may pick a slot by itself (auto-select, consecutive extension, split booking): it must
 * start after ``now`` by its real start time (never the slot's ``date``, which is the operating day), not be booked,
 * and be open - Available, or Reserved (External) when staff book for an external user. Staff can still click any
 * other slot by hand; this rule is only for automatic picks.
 */
export type AutoPickSlot = { status?: string | null; booking_id?: unknown; start_datetime?: string | null };

export function slotIsAutoPickable(
  slot: AutoPickSlot | null | undefined,
  { now = Date.now(), forExternal = false, externalOpen = false }: { now?: number; forExternal?: boolean; externalOpen?: boolean } = {},
): boolean {
  if (!slot || !slot.start_datetime) return false;
  const status = String(slot.status || "").toUpperCase();
  if (status === "BOOKED" || slot.booking_id) return false;
  const open = status === "AVAILABLE" || (forExternal && (status === "RESERVED_EXTERNAL" || externalOpen));
  if (!open) return false;
  const start = new Date(slot.start_datetime).getTime();
  return !Number.isNaN(start) && start > now;
}

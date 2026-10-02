/** Helpers for keeping the booking form after a failed submit. */

export type FailureKind = "slot_taken" | "no_wallet" | "insufficient_funds" | "quota" | "waitlist_full" | "other";

export function classifyBookingFailure(message: string | null | undefined, extra?: { waitlist_full?: boolean }): FailureKind {
  if (extra?.waitlist_full) return "waitlist_full";
  const m = String(message || "").toLowerCase();
  if (!m) return "other";
  if (
    m.includes("access to any wallet") ||
    m.includes("link your supervisor") ||
    m.includes("join request") ||
    (m.includes("wallet") && m.includes("not linked"))
  ) {
    return "no_wallet";
  }
  if (m.includes("insufficient") || m.includes("enough balance") || m.includes("recharge") || m.includes("wallet balance")) {
    return "insufficient_funds";
  }
  if (m.includes("quota") || m.includes("limit exceeded") || m.includes("weekly limit") || m.includes("monthly limit")) return "quota";
  if (
    m.includes("not available") ||
    m.includes("no longer available") ||
    m.includes("occupied") ||
    m.includes("already booked") ||
    m.includes("invalid")
  ) {
    return "slot_taken";
  }
  return "other";
}

type SlotRef = { slotId?: number | null; slotData?: { id?: number | null; start_datetime?: string | null } | null };
type FreshSlot = { id?: number | null; start_datetime?: string | null };

/**
 * Splits the user's selection into slots still bookable (per the freshly loaded week) and those that are gone.
 * A selected slot missing from the fresh data counts as gone.
 */
export function partitionSelectionAfterRefresh<S extends SlotRef, F extends FreshSlot>(
  selected: S[],
  fresh: F[],
  isStillSelectable: (slot: F) => boolean,
): { keep: Array<S & { slotData: F }>; dropped: S[] } {
  const byId = new Map<number, F>();
  const byStart = new Map<string, F>();
  for (const f of fresh) {
    if (typeof f.id === "number") byId.set(f.id, f);
    if (f.start_datetime) byStart.set(f.start_datetime, f);
  }
  const keep: Array<S & { slotData: F }> = [];
  const dropped: S[] = [];
  for (const s of selected) {
    const id = s.slotData?.id ?? s.slotId;
    const match =
      (typeof id === "number" ? byId.get(id) : undefined) ??
      (s.slotData?.start_datetime ? byStart.get(s.slotData.start_datetime) : undefined);
    if (match && isStillSelectable(match)) keep.push({ ...s, slotData: match });
    else dropped.push(s);
  }
  return { keep, dropped };
}

export function droppedSlotsNotice(count: number): string {
  if (count <= 0) return "";
  return count === 1
    ? "1 of your selected slots was taken by someone else and has been removed (marked in the grid)."
    : `${count} of your selected slots were taken by someone else and have been removed (marked in the grid).`;
}

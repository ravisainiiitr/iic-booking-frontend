/** Pending-actions item key for bookings awaiting completion (iic_booking/equipment/pending_actions.py). */
export const BOOKINGS_AWAITING_COMPLETION_KEY = "bookings_awaiting_completion";

/** Only Lab Operators mark bookings completed, so only their dashboard lists bookings awaiting completion. */
export function showsBookingsAwaitingCompletion(userType: unknown): boolean {
  return String(userType ?? "").toLowerCase() === "operator";
}

/**
 * The pending-actions item links to the dashboard card, which only Lab Operators have; everyone else
 * (OICs, temporary OICs) still gets the 9:00 AM reminder email.
 */
export function withoutAwaitingCompletionUnlessOperator<T extends { key: string }>(items: T[], userType: unknown): T[] {
  return showsBookingsAwaitingCompletion(userType)
    ? items
    : items.filter((i) => i.key !== BOOKINGS_AWAITING_COMPLETION_KEY);
}

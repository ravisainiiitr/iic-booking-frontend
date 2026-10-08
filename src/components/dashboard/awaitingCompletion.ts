import type { BookingAwaitingCompletion } from "@/lib/api";

type AwaitingRow = Pick<
  BookingAwaitingCompletion,
  "overdue" | "is_overdue" | "waiting_for_user" | "results_due_at" | "results_due_at_display"
>;

/** Overdue once the equipment's results overdue time has passed (older payloads: any "overdue" text). */
export function awaitingIsOverdue(row: AwaitingRow): boolean {
  return row.is_overdue ?? Boolean(row.overdue);
}

/** "Overdue by 13 h", "Due by Wed 07 Oct 2026, 06:31 PM" or "Waiting for the user". */
export function awaitingOverdueText(row: AwaitingRow, now: Date = new Date()): string {
  if (awaitingIsOverdue(row)) return row.overdue ? `Overdue by ${row.overdue}` : "Overdue";
  const due = row.results_due_at ? new Date(row.results_due_at) : null;
  if (row.waiting_for_user && due && due.getTime() <= now.getTime()) return "Waiting for the user";
  return row.results_due_at_display ? `Due by ${row.results_due_at_display}` : "—";
}

/** Pending-actions item key for bookings awaiting completion (iic_booking/equipment/pending_actions.py). */
export const BOOKINGS_AWAITING_COMPLETION_KEY = "bookings_awaiting_completion";

/** Only Lab Operators mark bookings completed, so only their dashboard lists bookings awaiting completion. */
export function showsBookingsAwaitingCompletion(userType: unknown): boolean {
  return String(userType ?? "").toLowerCase() === "operator";
}

/**
 * The pending-actions item (overdue bookings only) links to the dashboard card, which only Lab Operators have;
 * everyone else (OICs, temporary OICs) still gets the 9:00 AM reminder email.
 */
export function withoutAwaitingCompletionUnlessOperator<T extends { key: string }>(items: T[], userType: unknown): T[] {
  return showsBookingsAwaitingCompletion(userType)
    ? items
    : items.filter((i) => i.key !== BOOKINGS_AWAITING_COMPLETION_KEY);
}

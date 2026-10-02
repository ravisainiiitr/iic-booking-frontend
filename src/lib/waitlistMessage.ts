/** Friendly copy for a booking that went to the waitlist instead of getting a slot. */

export function waitlistPositionFrom(res: { waitlist_position?: number | null; waitlist_code?: string | null; error?: string | null }): number | null {
  if (typeof res.waitlist_position === "number" && res.waitlist_position > 0) return res.waitlist_position;
  const fromCode = String(res.waitlist_code || "").match(/(\d+)/);
  if (fromCode) return Number(fromCode[1]);
  const fromError = String(res.error || "").match(/\bWL(\d+)\b/i);
  return fromError ? Number(fromError[1]) : null;
}

export function isWaitlistedResponse(res: { waitlist_position?: number | null; waitlist_code?: string | null; error?: string | null }): boolean {
  return (
    waitlistPositionFrom(res) != null ||
    !!res.waitlist_code ||
    String(res.error || "").toLowerCase().includes("booking waitlisted")
  );
}

export function waitlistQueueMessage(position: number | null): string {
  return position != null
    ? `You're #${position} in the queue — we'll notify you if a slot frees up.`
    : "You're in the queue — we'll notify you if a slot frees up.";
}

export const WAITLIST_FOLLOW_UP =
  "No slot was booked or charged yet. If a slot frees up for you, it is booked automatically and you get an email; you can also check My Bookings.";

export const WAITLIST_FULL_MESSAGE =
  "All slots this week are taken and the waiting queue is full. Try another week, or check back later — cancelled slots go back on the calendar.";

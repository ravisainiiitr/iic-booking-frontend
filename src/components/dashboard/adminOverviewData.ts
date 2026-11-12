export interface AttentionItem {
  key: string;
  label: string;
  count: number;
  link: string;
  description: string;
  details?: string[];
  /** From the signed-in user's own pending actions (its link is always valid for them). */
  fromPendingActions?: boolean;
}

/**
 * The signed-in user's pending actions first (they carry per-user detail), then scope-wide items
 * from the dashboard summary that are not already listed. Zero counts are dropped.
 */
export function mergeAttentionItems(summaryItems: AttentionItem[], pendingItems: AttentionItem[]): AttentionItem[] {
  const seen = new Set<string>();
  const merged: AttentionItem[] = [];
  for (const item of pendingItems) {
    if (!item.count || seen.has(item.key)) continue;
    seen.add(item.key);
    merged.push({ ...item, fromPendingActions: true });
  }
  for (const item of summaryItems) {
    if (!item.count || seen.has(item.key)) continue;
    seen.add(item.key);
    merged.push({ ...item, fromPendingActions: false });
  }
  return merged;
}

const IST_OFFSET_MS = 330 * 60_000;
const WEEKLY_OPENING_DAY = 3; // Wednesday
const WEEKLY_OPENING_HOUR = 21;

/** Next weekly booking opening (Wednesday 9 pm IST) strictly after `nowMs`; used when the peak window is not configured. */
export function nextWeeklyOpening(nowMs: number): Date {
  const ist = new Date(nowMs + IST_OFFSET_MS);
  const daysAhead = (WEEKLY_OPENING_DAY - ist.getUTCDay() + 7) % 7;
  let target = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + daysAhead, WEEKLY_OPENING_HOUR);
  if (target <= ist.getTime()) target += 7 * 24 * 60 * 60_000;
  return new Date(target - IST_OFFSET_MS);
}

/** "2d 4h", "3h 12m" or "12m" (at least one minute). */
export function formatCountdown(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export interface RatingsSummary {
  days: number;
  booking_average: number | null;
  booking_count: number;
  portal_average: number | null;
  portal_count: number;
}

export interface ExperienceRatingCard {
  value: string;
  hint: string;
  /** "portal" = the "Rate your experience" ratings (Experience Ratings page); "booking" = ratings of bookings. */
  source: "portal" | "booking" | null;
}

const plural = (n: number, word: string) => `${n.toLocaleString("en-IN")} ${word}${n === 1 ? "" : "s"}`;

/**
 * Experience rating card. Institute-wide it leads with the portal's "Rate your experience" ratings (average on the
 * 1–5 scale and how many were submitted, all time), with booking ratings of the last ``days`` as a second line. A
 * department view has only booking ratings (portal ratings are not tied to a department). Never shows a zero average.
 */
export function experienceRatingCard(ratings: RatingsSummary | null | undefined, departmentSelected: boolean): ExperienceRatingCard {
  if (!ratings) return { value: "—", hint: "Ratings could not be loaded", source: null };
  const bookingLine = ratings.booking_count && ratings.booking_average != null
    ? `bookings ${ratings.booking_average.toFixed(1)} / 5 (${plural(ratings.booking_count, "rating")} in ${ratings.days} days)`
    : "";
  if (!departmentSelected && ratings.portal_count > 0 && ratings.portal_average != null) {
    return {
      value: `${ratings.portal_average.toFixed(1)} / 5`,
      hint: `Based on ${plural(ratings.portal_count, "rating")}${bookingLine ? ` · ${bookingLine}` : ""}`,
      source: "portal",
    };
  }
  if (ratings.booking_count > 0 && ratings.booking_average != null) {
    return {
      value: `${ratings.booking_average.toFixed(1)} / 5`,
      hint: `Based on ${plural(ratings.booking_count, "booking rating")} in ${ratings.days} days`,
      source: "booking",
    };
  }
  return {
    value: "No ratings yet",
    hint: departmentSelected ? `No booking ratings in the last ${ratings.days} days` : "No experience ratings submitted yet",
    source: null,
  };
}

const istDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });

/**
 * Reports filtered to the same window as a dashboard figure: "today" (bookings made today) or "month" (charges this
 * month, which Reports computes the same way from the 1st). Dates are IST calendar days.
 */
/**
 * View Booking listing the bookings made today, any status (the "Bookings made today" card). Reports would filter
 * by session date and show something else. ``realOnly`` leaves out test bookings, as the card's count does.
 */
export function madeTodayLink(realOnly: boolean, now: number = Date.now()): string {
  const today = istDate.format(new Date(now));
  return `/booking-management?made_from=${today}&made_to=${today}${realOnly ? "&real_only=1" : ""}`;
}

export function reportsLink(window: "today" | "month", now: number = Date.now()): string {
  const today = istDate.format(new Date(now));
  const from = window === "today" ? today : `${today.slice(0, 8)}01`;
  return `/reports?from=${from}&to=${today}`;
}

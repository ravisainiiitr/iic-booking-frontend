/**
 * Weekly grid rows for equipment whose operating day does not start at midnight ("Operating day starts at", e.g.
 * 09:00 for a 09:00 → 09:00 cycle). Slots that open before that time belong to the cycle that began the previous
 * calendar day (the server dates them by the cycle), so rows start at the operating day start and wrap round.
 */

function minutes(time: string): number {
  const [h, m] = String(time || "").split(":").map((v) => parseInt(v, 10));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

/** "09:00" / "09:00:00" → minutes after midnight; null / "" / 00:00 → 0 (calendar day). */
export function operatingDayStartMinutes(dayStart?: string | null): number {
  return dayStart ? minutes(dayStart) % 1440 : 0;
}

/** HH:mm keys in operating-day order: from the day start, wrapping past midnight. Calendar days: plain time order. */
export function orderByOperatingDay(times: string[], dayStart?: string | null): string[] {
  const start = operatingDayStartMinutes(dayStart);
  const key = (t: string) => (minutes(t) - start + 1440) % 1440;
  return [...times].sort((a, b) => key(a) - key(b) || a.localeCompare(b));
}

/** True when a row's slots run on the next calendar day (they open before the operating day start). */
export function isNextDayRow(time: string, dayStart?: string | null): boolean {
  const start = operatingDayStartMinutes(dayStart);
  return start > 0 && minutes(time) < start;
}

export const NEXT_DAY_SUFFIX = " (+1 day)";

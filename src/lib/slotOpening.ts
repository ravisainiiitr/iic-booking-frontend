/**
 * When next week's slots open (per-equipment weekday + time, in the server's timezone),
 * and how to show the remaining time.
 */

const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

function parseHHMM(time: string): { h: number; m: number } | null {
  const match = String(time || "").trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return { h, m };
}

/**
 * Epoch ms of the next opening strictly after `nowMs`.
 * @param refWeekday 0 = Monday … 6 = Sunday (backend convention)
 * @param utcOffsetMinutes server timezone offset (IST = 330)
 */
export function nextSlotOpening(nowMs: number, utcOffsetMinutes: number, refWeekday: number, refTime: string): number | null {
  const t = parseHHMM(refTime);
  if (!t || !Number.isInteger(refWeekday) || refWeekday < 0 || refWeekday > 6) return null;
  const offsetMs = utcOffsetMinutes * MINUTE;
  const local = new Date(nowMs + offsetMs);
  const weekdayMon0 = (local.getUTCDay() + 6) % 7;
  const mondayLocalMidnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - weekdayMon0 * DAY;
  let openingLocal = mondayLocalMidnight + refWeekday * DAY + (t.h * 60 + t.m) * MINUTE;
  if (openingLocal - offsetMs <= nowMs) openingLocal += 7 * DAY;
  return openingLocal - offsetMs;
}

/** "Wed 9:00 pm" in the server timezone. */
export function formatOpeningLabel(openingMs: number, utcOffsetMinutes: number): string {
  const local = new Date(openingMs + utcOffsetMinutes * MINUTE);
  const day = DAY_SHORT[(local.getUTCDay() + 6) % 7];
  const h = local.getUTCHours();
  const m = local.getUTCMinutes();
  const ampm = h >= 12 ? "pm" : "am";
  return `${day} ${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** "2d 4h", "4h 10m", "9m 05s", "42s" — seconds only appear in the last hour. */
export function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

/** Spoken form for screen readers, updated rarely (aria-live must not chatter every second). */
export function countdownAriaText(ms: number): string {
  const totalMin = Math.max(0, Math.ceil(ms / MINUTE));
  if (totalMin >= 60 * 24) {
    const d = Math.floor(totalMin / (60 * 24));
    return `${d} day${d === 1 ? "" : "s"}`;
  }
  if (totalMin >= 60) {
    const h = Math.floor(totalMin / 60);
    return `about ${h} hour${h === 1 ? "" : "s"}`;
  }
  return `${totalMin} minute${totalMin === 1 ? "" : "s"}`;
}

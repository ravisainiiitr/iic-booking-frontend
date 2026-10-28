import { format, parseISO } from "date-fns";

/**
 * Lab wall-clock date and time of a server timestamp. The API sends slot times with the lab's offset
 * ("2026-10-21T09:30:00+05:30"), so reading the digits keeps the grid in lab time whatever the browser's time zone.
 * Timestamps without a time part, or in another form, fall back to the browser's reading.
 */
const WALL_CLOCK = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/;

export function wallDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = WALL_CLOCK.exec(iso);
  if (m) return m[1];
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  try {
    return format(parseISO(iso), "yyyy-MM-dd");
  } catch {
    return "";
  }
}

export function wallTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = WALL_CLOCK.exec(iso);
  if (m) return m[2];
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  try {
    return format(parseISO(iso), "HH:mm");
  } catch {
    return "";
  }
}

/** "Wed, 21 Oct 2026, 09:30" in lab time. */
export function wallDateTimeLabel(iso: string | null | undefined): string {
  const d = wallDate(iso);
  const t = wallTime(iso);
  if (!d) return "";
  return `${format(parseISO(d), "EEE, d MMM yyyy")}${t ? `, ${t}` : ""}`;
}

/** A booking window in lab time; the end date is left out when it is the same day. */
export function wallWindowLabel(startIso: string | null | undefined, endIso: string | null | undefined): string {
  const start = wallDateTimeLabel(startIso);
  if (!start) return "";
  if (!endIso) return start;
  return wallDate(startIso) === wallDate(endIso)
    ? `${start} – ${wallTime(endIso)}`
    : `${start} – ${wallDateTimeLabel(endIso)}`;
}

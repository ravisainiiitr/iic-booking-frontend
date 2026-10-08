function toMinutes(key: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(key.trim());
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function fromMinutes(total: number): string {
  const wrapped = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

export const FULL_DAY_MINUTES = 1440;

/** True when a Slot Master's Close time equals its Open time: a full 24-hour slot (ends next day at the same time). */
export function isFullDaySlotTimes(open: string | null | undefined, close: string | null | undefined): boolean {
  const o = toMinutes(String(open ?? ""));
  return o != null && o === toMinutes(String(close ?? ""));
}

export const SLOT_MASTER_CLOSE_TIME_HELP =
  "Set Close = Open for a full 24-hour slot (e.g. 00:00–00:00); if Close is earlier than Open the slot ends next day.";

/** Why the Slot Master rows cannot be saved (a full 24-hour slot must be the only active slot), or null. */
export function slotMastersError(
  rows: ReadonlyArray<{ open_time?: string | null; close_time?: string | null; is_active?: boolean | null }>,
): string | null {
  const active = rows.filter((r) => r.is_active !== false && toMinutes(String(r.open_time ?? "")) != null && toMinutes(String(r.close_time ?? "")) != null);
  if (active.length > 1 && active.some((r) => isFullDaySlotTimes(r.open_time, r.close_time))) {
    return "A full 24-hour slot (Close = Open) must be the only active slot of this equipment. Deactivate or remove the other slots, or set a Close time different from the Open time.";
  }
  return null;
}

/** "24 h", "48 h", "1.5 h". */
export function hoursHint(minutes: number): string {
  const h = Math.round((minutes / 60) * 100) / 100;
  return `${h} h`;
}

/**
 * Label for a span of whole days (at least 24 h): "00:00 – 24:00 (24 h)" for one day from midnight,
 * else "09:00 – 09:00 (+1 day, 24 h)", so it never reads as zero length.
 */
function multiDayLabel(startM: number, endLabel: string, days: number, minutes: number, sep: string): string {
  const start = fromMinutes(startM);
  if (days === 1 && startM === 0 && endLabel === "00:00") return `${start}${sep}24:00 (${hoursHint(minutes)})`;
  return `${start}${sep}${endLabel} (+${days} day${days === 1 ? "" : "s"}, ${hoursHint(minutes)})`;
}

/** Duration of a Slot Master from its "HH:MM" times: Close = Open is 24 h, Close earlier than Open ends next day. */
export function slotMasterDurationMinutes(open: string | null | undefined, close: string | null | undefined): number | null {
  const o = toMinutes(String(open ?? ""));
  const c = toMinutes(String(close ?? ""));
  if (o == null || c == null) return null;
  return c > o ? c - o : c + FULL_DAY_MINUTES - o;
}

/** "00:00 – 24:00 (24 h)", "18:00 – 00:00 (+1 day)", "09:00 – 10:00" for a Slot Master's open/close times. */
export function slotMasterRangeLabel(open: string | null | undefined, close: string | null | undefined): string {
  const o = toMinutes(String(open ?? ""));
  const c = toMinutes(String(close ?? ""));
  if (o == null || c == null) return "";
  if (o === c) return multiDayLabel(o, fromMinutes(c), 1, FULL_DAY_MINUTES, " – ");
  return `${fromMinutes(o)} – ${fromMinutes(c)}${c < o ? " (+1 day)" : ""}`;
}

/**
 * Row label for a weekly slot grid, e.g. "09:00 – 10:30".
 * Uses the slot's real end time when known, else start + duration; returns the start alone if it is not a time.
 * An end equal to the start is a full 24-hour slot: "00:00 – 24:00 (24 h)".
 */
export function slotTimeRangeLabel(
  startKey: string,
  endKey?: string | null,
  durationMinutes?: number | null,
): string {
  const startM = toMinutes(startKey);
  if (startM == null) return startKey;
  const start = fromMinutes(startM);
  const endM = endKey ? toMinutes(endKey) : null;
  if (endM != null && endM === startM) return multiDayLabel(startM, fromMinutes(endM), 1, FULL_DAY_MINUTES, " – ");
  if (endM != null) return `${start} – ${fromMinutes(endM)}`;
  const duration = Math.max(1, durationMinutes || 60);
  if (duration % FULL_DAY_MINUTES === 0) {
    const days = duration / FULL_DAY_MINUTES;
    return multiDayLabel(startM, start, days, duration, " – ");
  }
  return `${start} – ${fromMinutes(startM + duration)}`;
}

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/**
 * "HH:mm – HH:mm" for a slot's (or run of slots') real start and end. A span of at least 24 h reads
 * "00:00 – 24:00 (24 h)" or "09:00 – 09:00 (+1 day, 24 h)" instead of looking zero length.
 */
export function slotSpanLabel(start: Date | string, end: Date | string, sep = " – "): string {
  const s = typeof start === "string" ? new Date(start) : start;
  const e = typeof end === "string" ? new Date(end) : end;
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return `${String(start)}${sep}${String(end)}`;
  const minutes = Math.round((e.getTime() - s.getTime()) / 60000);
  if (minutes < FULL_DAY_MINUTES) return `${hhmm(s)}${sep}${hhmm(e)}`;
  const sDay = new Date(s.getFullYear(), s.getMonth(), s.getDate()).getTime();
  const eDay = new Date(e.getFullYear(), e.getMonth(), e.getDate()).getTime();
  const days = Math.max(1, Math.round((eDay - sDay) / 86400000));
  return multiDayLabel(s.getHours() * 60 + s.getMinutes(), hhmm(e), days, minutes, sep);
}

/** First known end time for each row start time, so each row can show its real slot length. */
export function slotRowEndTimes<T>(
  slots: readonly T[] | null | undefined,
  startKeyOf: (slot: T) => string,
  endKeyOf: (slot: T) => string,
): Map<string, string> {
  const ends = new Map<string, string>();
  for (const slot of slots ?? []) {
    const start = startKeyOf(slot);
    if (!start || ends.has(start)) continue;
    const end = endKeyOf(slot);
    if (end) ends.set(start, end);
  }
  return ends;
}

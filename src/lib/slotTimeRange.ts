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

/** Close time in minutes as stored: "24:00" is midnight at the end of the day, the same as "00:00". */
function closeMinutes(close: string | null | undefined): number | null {
  const c = toMinutes(String(close ?? ""));
  return c == null ? null : c % FULL_DAY_MINUTES;
}

/** True when a Slot Master is a full 24-hour slot: Close = Open (00:00–24:00 is stored as 00:00–00:00). */
export function isFullDaySlotTimes(open: string | null | undefined, close: string | null | undefined): boolean {
  const o = toMinutes(String(open ?? ""));
  return o != null && o === closeMinutes(close);
}

export const SLOT_MASTER_CLOSE_TIME_HELP =
  "Use 24:00 for midnight at the end of the day (e.g. 12:00–24:00). For a full-day slot use 00:00–24:00. If Close is earlier than Open the slot ends next day.";

/**
 * "HH:MM" Close time as typed in the Slot Master editor, or null when it is not a time.
 * Accepts "9:30", "09:30", "09:30:00" and "24:00" / "24:00:00" (midnight at the end of the day).
 */
export function parseSlotCloseInput(raw: string | null | undefined): string | null {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(raw ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  const sec = Number(m[3] ?? 0);
  if (h === 24 && min === 0 && sec === 0) return "24:00";
  if (h > 23 || min > 59 || sec > 59) return null;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

/** Close time shown in the Slot Master editor: a stored midnight close ("00:00:00") reads "24:00". */
export function slotCloseTimeForForm(close: string | null | undefined): string {
  const c = closeMinutes(close);
  return c == null ? "" : c === 0 ? "24:00" : fromMinutes(c);
}

/** Close time sent to the API as "HH:MM": "24:00" is stored as 00:00; unparseable input is sent as typed. */
export function slotCloseTimeForApi(close: string): string {
  const parsed = parseSlotCloseInput(close);
  return parsed === "24:00" ? "00:00" : parsed ?? close;
}

type SlotMasterTimes = { open_time?: string | null; close_time?: string | null; is_active?: boolean | null };

/** Why the Slot Master rows cannot be saved (a full-day slot not alone, or overlapping active slots), or null. */
export function slotMastersError(rows: ReadonlyArray<SlotMasterTimes>): string | null {
  const badClose = rows.find((r) => String(r.close_time ?? "").trim() !== "" && parseSlotCloseInput(r.close_time) == null);
  if (badClose) return `Close time "${String(badClose.close_time).trim()}" is not a time. Use HH:MM, e.g. 12:00, or 24:00 for midnight at the end of the day.`;
  const active = rows.filter((r) => r.is_active !== false && toMinutes(String(r.open_time ?? "")) != null && closeMinutes(r.close_time) != null);
  if (active.length > 1 && active.some((r) => isFullDaySlotTimes(r.open_time, r.close_time))) {
    return "A full 24-hour slot (00:00–24:00, or Close = Open) must be the only active slot of this equipment. Deactivate or remove the other slots, or shorten this one.";
  }
  const spans = active.map((r) => {
    const start = toMinutes(String(r.open_time ?? "")) as number;
    return { r, start, end: start + (slotMasterDurationMinutes(r.open_time, r.close_time) as number) };
  });
  for (let i = 0; i < spans.length; i++) {
    for (let j = i + 1; j < spans.length; j++) {
      const a = spans[i];
      const b = spans[j];
      if ([-FULL_DAY_MINUTES, 0, FULL_DAY_MINUTES].some((k) => a.start < b.end + k && b.start + k < a.end)) {
        const label = (s: SlotMasterTimes) => slotMasterRangeLabel(s.open_time, s.close_time).replace(" – ", "–");
        return `Active slots must not overlap: ${label(a.r)} overlaps ${label(b.r)}. Slots may touch, e.g. 00:00–12:00 and 12:00–24:00.`;
      }
    }
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

/** "start – end" for a span shorter than 24 h: an end at midnight reads "24:00", a later end "02:00 (+1 day)". */
function underDayLabel(startM: number, minutes: number, sep: string): string {
  const end = startM + minutes;
  if (end === FULL_DAY_MINUTES) return `${fromMinutes(startM)}${sep}24:00`;
  return `${fromMinutes(startM)}${sep}${fromMinutes(end)}${end > FULL_DAY_MINUTES ? " (+1 day)" : ""}`;
}

/** Duration of a Slot Master from its "HH:MM" times: Close = Open is 24 h, Close earlier than Open ends next day. */
export function slotMasterDurationMinutes(open: string | null | undefined, close: string | null | undefined): number | null {
  const o = toMinutes(String(open ?? ""));
  const c = closeMinutes(close);
  if (o == null || c == null) return null;
  return c > o ? c - o : c + FULL_DAY_MINUTES - o;
}

/** "00:00 – 24:00 (24 h)", "12:00 – 24:00", "18:00 – 02:00 (+1 day)", "09:00 – 10:00" for a Slot Master's open/close times. */
export function slotMasterRangeLabel(open: string | null | undefined, close: string | null | undefined): string {
  const o = toMinutes(String(open ?? ""));
  const minutes = slotMasterDurationMinutes(open, close);
  if (o == null || minutes == null) return "";
  if (minutes === FULL_DAY_MINUTES) return multiDayLabel(o, fromMinutes(o), 1, FULL_DAY_MINUTES, " – ");
  return underDayLabel(o, minutes, " – ");
}

/**
 * Row label for a weekly slot grid, e.g. "09:00 – 10:30", "12:00 – 24:00" or "18:00 – 02:00 (+1 day)".
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
  if (endKey && closeMinutes(endKey) != null) return slotMasterRangeLabel(fromMinutes(startM), endKey);
  const duration = Math.max(1, durationMinutes || 60);
  if (duration % FULL_DAY_MINUTES === 0) {
    const days = duration / FULL_DAY_MINUTES;
    return multiDayLabel(startM, fromMinutes(startM), days, duration, " – ");
  }
  return underDayLabel(startM, duration, " – ");
}

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/**
 * "HH:mm – HH:mm" for a slot's (or run of slots') real start and end. An end at midnight reads "24:00",
 * an end on the next day "02:00 (+1 day)"; a span of at least 24 h reads "00:00 – 24:00 (24 h)" or
 * "09:00 – 09:00 (+1 day, 24 h)" instead of looking zero length.
 */
export function slotSpanLabel(start: Date | string, end: Date | string, sep = " – "): string {
  const s = typeof start === "string" ? new Date(start) : start;
  const e = typeof end === "string" ? new Date(end) : end;
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return `${String(start)}${sep}${String(end)}`;
  const minutes = Math.round((e.getTime() - s.getTime()) / 60000);
  const sDay = new Date(s.getFullYear(), s.getMonth(), s.getDate()).getTime();
  const eDay = new Date(e.getFullYear(), e.getMonth(), e.getDate()).getTime();
  if (minutes < FULL_DAY_MINUTES) {
    if (minutes <= 0 || eDay === sDay) return `${hhmm(s)}${sep}${hhmm(e)}`;
    return underDayLabel(s.getHours() * 60 + s.getMinutes(), minutes, sep);
  }
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

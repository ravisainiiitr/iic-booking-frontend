function toMinutes(key: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(key.trim());
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function fromMinutes(total: number): string {
  const wrapped = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

/**
 * Row label for a weekly slot grid, e.g. "09:00 – 10:30".
 * Uses the slot's real end time when known, else start + duration; returns the start alone if it is not a time.
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
  const end = endM != null && endM !== startM ? fromMinutes(endM) : fromMinutes(startM + Math.max(1, durationMinutes || 60));
  return `${start} – ${end}`;
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

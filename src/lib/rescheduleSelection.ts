import { parseISO } from "date-fns";
import { wallDate } from "./slotWallClock";

/** The fields the reschedule grid's slots have that this rule needs. */
export interface DaySlot {
  id: number;
  start_datetime: string;
}

const dayOf = (s: DaySlot) => wallDate(s.start_datetime);
const startOf = (s: DaySlot) => parseISO(s.start_datetime).getTime();

/**
 * True when a selection may run from ``earlier`` on one day straight to ``later`` on a later day, so a booking longer
 * than a day's slots (e.g. 16 + 5) can be moved as one block. The server takes every free slot between the chosen
 * start and end and refuses the move unless that is exactly the booking's number of slots, so no usable slot may lie
 * between the two — later that day, on a skipped working day, or earlier on the next day. Slots that cannot be booked
 * (closed evenings, weekends, holidays) do not break the run.
 * ``slots`` should be every slot loaded, including any hidden from the grid.
 */
export function continuesOnNextDay(
  earlier: DaySlot,
  later: DaySlot,
  slots: DaySlot[],
  usable: (slot: DaySlot) => boolean,
): boolean {
  if (dayOf(earlier) >= dayOf(later)) return false;
  const from = startOf(earlier);
  const to = startOf(later);
  return !slots.some((s) => {
    const t = startOf(s);
    return t > from && t < to && usable(s);
  });
}

/**
 * Starting from ``first``, the next ``count`` slots that make one consecutive run, using ``isNext(candidate, run)``
 * to decide whether a usable slot continues the run. Returns the run found, which is shorter than ``count`` when it
 * breaks (a booked slot, the end of the loaded week).
 */
export function consecutiveRunFrom<T extends DaySlot>(
  first: T,
  count: number,
  slots: T[],
  usable: (slot: T) => boolean,
  isNext: (candidate: T, run: T[]) => boolean,
): T[] {
  const ordered = [...slots].sort((a, b) => startOf(a) - startOf(b));
  const run: T[] = [first];
  for (const s of ordered) {
    if (run.length >= count) break;
    if (startOf(s) <= startOf(run[run.length - 1]) || !usable(s)) continue;
    if (!isNext(s, run)) break;
    run.push(s);
  }
  return run;
}

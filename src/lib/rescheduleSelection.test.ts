import { describe, expect, it } from "vitest";
import { consecutiveRunFrom, continuesOnNextDay, type DaySlot } from "./rescheduleSelection";

let nextId = 1;
const slot = (start: string): DaySlot => ({ id: nextId++, start_datetime: start });

// Wed 21 Oct 16:30 and 17:00 are the day's last bookable slots; Thu 22 Oct opens at 09:30.
const wedLast = slot("2026-10-21T17:00:00+05:30");
const wedBefore = slot("2026-10-21T16:30:00+05:30");
const thuFirst = slot("2026-10-22T09:30:00+05:30");
const thuSecond = slot("2026-10-22T10:00:00+05:30");
const always = () => true;

describe("continuesOnNextDay", () => {
  it("lets the last slot of a day run into the first slot of the next", () => {
    const slots = [wedBefore, wedLast, thuFirst, thuSecond];
    expect(continuesOnNextDay(wedLast, thuFirst, slots, always)).toBe(true);
  });

  it("refuses when a usable slot follows on the first day", () => {
    const slots = [wedBefore, wedLast, thuFirst];
    expect(continuesOnNextDay(wedBefore, thuFirst, slots, always)).toBe(false);
  });

  it("refuses when a usable slot comes earlier on the next day", () => {
    const slots = [wedLast, thuFirst, thuSecond];
    expect(continuesOnNextDay(wedLast, thuSecond, slots, always)).toBe(false);
  });

  it("ignores slots that cannot be booked (closed evening hours staff can see)", () => {
    const evening = slot("2026-10-21T17:30:00+05:30");
    const early = slot("2026-10-22T09:00:00+05:30");
    const slots = [wedLast, evening, early, thuFirst];
    const usable = (s: DaySlot) => s.id !== evening.id && s.id !== early.id;
    expect(continuesOnNextDay(wedLast, thuFirst, slots, usable)).toBe(true);
    expect(continuesOnNextDay(wedLast, thuFirst, slots, always)).toBe(false);
  });

  it("refuses the same day or a backwards order", () => {
    const slots = [wedBefore, wedLast, thuFirst];
    expect(continuesOnNextDay(wedBefore, wedLast, slots, always)).toBe(false);
    expect(continuesOnNextDay(thuFirst, wedLast, slots, always)).toBe(false);
  });

  it("skips days with no usable slot but not a working day", () => {
    const fri = slot("2026-10-23T17:00:00+05:30");
    const satClosed = slot("2026-10-24T09:30:00+05:30");
    const mon = slot("2026-10-26T09:30:00+05:30");
    const slots = [fri, satClosed, mon];
    expect(continuesOnNextDay(fri, mon, slots, (s) => s.id !== satClosed.id)).toBe(true);
    expect(continuesOnNextDay(fri, mon, slots, always)).toBe(false);
  });
});

describe("consecutiveRunFrom", () => {
  const day = (d: string, times: string[]) => times.map((t) => slot(`2026-11-${d}T${t}:00+05:30`));
  const wed = day("04", ["16:00", "16:30", "17:00"]);
  const thu = day("05", ["09:30", "10:00", "10:30"]);
  const all = [...wed, ...thu];
  // Adjacent when on the same day 30 minutes apart, or continuing on the next day.
  const isNext = (c: DaySlot, run: DaySlot[]) => {
    const last = run[run.length - 1];
    const gap = Date.parse(c.start_datetime) - Date.parse(last.start_datetime);
    return gap === 30 * 60 * 1000 || continuesOnNextDay(last, c, all, always);
  };

  it("collects the run across the day boundary", () => {
    expect(consecutiveRunFrom(wed[1], 4, all, always, isNext).map((s) => s.id)).toEqual(
      [wed[1], wed[2], thu[0], thu[1]].map((s) => s.id),
    );
  });

  it("stops at a slot that cannot be used", () => {
    const usable = (s: DaySlot) => s.id !== wed[2].id;
    expect(consecutiveRunFrom(wed[0], 4, all, usable, isNext)).toHaveLength(2);
  });

  it("returns a short run at the end of the loaded slots", () => {
    expect(consecutiveRunFrom(thu[1], 4, all, always, isNext)).toHaveLength(2);
  });
});

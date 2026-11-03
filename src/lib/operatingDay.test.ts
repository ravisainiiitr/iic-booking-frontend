import { describe, expect, it } from "vitest";
import { isNextDayRow, orderByOperatingDay } from "./operatingDay";

describe("operating day row order", () => {
  it("starts at the operating day start and wraps round", () => {
    expect(orderByOperatingDay(["03:00", "09:00", "15:00", "21:00"], "09:00:00")).toEqual(["09:00", "15:00", "21:00", "03:00"]);
  });

  it("keeps calendar-day order without a start", () => {
    expect(orderByOperatingDay(["15:00", "03:00", "09:00"], null)).toEqual(["03:00", "09:00", "15:00"]);
    expect(orderByOperatingDay(["15:00", "03:00"], "00:00")).toEqual(["03:00", "15:00"]);
  });

  it("marks the rows that run on the next morning", () => {
    expect(isNextDayRow("03:00", "09:00")).toBe(true);
    expect(isNextDayRow("09:00", "09:00")).toBe(false);
    expect(isNextDayRow("21:00", "09:00")).toBe(false);
    expect(isNextDayRow("03:00", null)).toBe(false);
  });
});

describe("consecutive slots across midnight", () => {
  it("follows real start times, not the slot's operating date", async () => {
    const { startsWhenEnds } = await import("./operatingDay");
    // Wednesday cycle (09:00 start): 21:00-03:00 ends Thursday 03:00; the next slot is dated Wednesday but starts Thursday.
    expect(startsWhenEnds("2026-11-05T03:00:00+05:30", "2026-11-05T03:00:00+05:30")).toBe(true);
    // Thursday's 03:00 slot starts on Friday, a day later.
    expect(startsWhenEnds("2026-11-06T03:00:00+05:30", "2026-11-05T03:00:00+05:30")).toBe(false);
    expect(startsWhenEnds("2026-11-04T15:00:00+05:30", "2026-11-04T15:00:00+05:30")).toBe(true);
    expect(startsWhenEnds("", "2026-11-04T15:00:00+05:30")).toBe(false);
  });
});

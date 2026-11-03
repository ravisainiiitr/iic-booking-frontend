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

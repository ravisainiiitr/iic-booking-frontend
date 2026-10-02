import { describe, expect, it } from "vitest";

import { countdownAriaText, formatCountdown, formatOpeningLabel, nextSlotOpening } from "./slotOpening";

const IST = 330;
/** Epoch ms for an IST wall-clock time. */
function ist(y: number, mo: number, d: number, h = 0, mi = 0, s = 0) {
  return Date.UTC(y, mo - 1, d, h, mi, s) - IST * 60_000;
}

describe("next slot opening", () => {
  // Fri 2 Oct 2026; Wednesday = weekday 2
  it("finds the coming Wednesday 9 pm in IST", () => {
    const now = ist(2026, 10, 2, 10, 0);
    expect(nextSlotOpening(now, IST, 2, "21:00")).toBe(ist(2026, 10, 7, 21, 0));
  });

  it("is today when the time has not passed yet", () => {
    const now = ist(2026, 10, 7, 20, 59, 30);
    expect(nextSlotOpening(now, IST, 2, "21:00")).toBe(ist(2026, 10, 7, 21, 0));
  });

  it("moves to next week right at and after the opening", () => {
    expect(nextSlotOpening(ist(2026, 10, 7, 21, 0), IST, 2, "21:00")).toBe(ist(2026, 10, 14, 21, 0));
    expect(nextSlotOpening(ist(2026, 10, 7, 21, 0, 1), IST, 2, "21:00")).toBe(ist(2026, 10, 14, 21, 0));
  });

  it("uses server time zone, not the browser's", () => {
    // 16:00 UTC Wed is 21:30 IST — already past this week's opening.
    const now = Date.UTC(2026, 9, 7, 16, 0);
    expect(nextSlotOpening(now, IST, 2, "21:00")).toBe(ist(2026, 10, 14, 21, 0));
  });

  it("handles Monday and Sunday schedules", () => {
    expect(nextSlotOpening(ist(2026, 10, 4, 23, 0), IST, 0, "09:30")).toBe(ist(2026, 10, 5, 9, 30));
    expect(nextSlotOpening(ist(2026, 10, 5, 0, 0), IST, 6, "18:00")).toBe(ist(2026, 10, 11, 18, 0));
  });

  it("rejects bad schedules", () => {
    expect(nextSlotOpening(0, IST, 7, "21:00")).toBeNull();
    expect(nextSlotOpening(0, IST, 2, "9pm")).toBeNull();
  });

  it("labels the opening in server time", () => {
    expect(formatOpeningLabel(ist(2026, 10, 7, 21, 0), IST)).toBe("Wed 9:00 pm");
    expect(formatOpeningLabel(ist(2026, 10, 5, 9, 30), IST)).toBe("Mon 9:30 am");
    expect(formatOpeningLabel(ist(2026, 10, 5, 12, 0), IST)).toBe("Mon 12:00 pm");
  });
});

describe("countdown formatting", () => {
  it("formats remaining time", () => {
    expect(formatCountdown(2 * 86400_000 + 4 * 3600_000 + 5_000)).toBe("2d 4h");
    expect(formatCountdown(4 * 3600_000 + 10 * 60_000)).toBe("4h 10m");
    expect(formatCountdown(9 * 60_000 + 5_000)).toBe("9m 05s");
    expect(formatCountdown(42_000)).toBe("42s");
    expect(formatCountdown(-5)).toBe("0s");
  });

  it("has a calm spoken form", () => {
    expect(countdownAriaText(3 * 86400_000)).toBe("3 days");
    expect(countdownAriaText(2 * 3600_000 + 1)).toBe("about 2 hours");
    expect(countdownAriaText(60_000)).toBe("1 minute");
  });
});

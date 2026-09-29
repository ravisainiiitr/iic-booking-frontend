import { describe, expect, it } from "vitest";
import { slotRowEndTimes, slotTimeRangeLabel } from "./slotTimeRange";

describe("slotTimeRangeLabel", () => {
  it("prefers the real slot end time", () => {
    expect(slotTimeRangeLabel("09:00", "10:30", 60)).toBe("09:00 – 10:30");
  });

  it("falls back to start plus duration", () => {
    expect(slotTimeRangeLabel("9:30", null, 45)).toBe("09:30 – 10:15");
    expect(slotTimeRangeLabel("23:30", "", 60)).toBe("23:30 – 00:30");
  });

  it("defaults to one hour and leaves non-time keys alone", () => {
    expect(slotTimeRangeLabel("14:00")).toBe("14:00 – 15:00");
    expect(slotTimeRangeLabel("Slot 1", "10:00", 60)).toBe("Slot 1");
  });
});

describe("slotRowEndTimes", () => {
  it("keeps the first known end per start time", () => {
    const ends = slotRowEndTimes(
      [
        { s: "09:00", e: "" },
        { s: "09:00", e: "10:00" },
        { s: "09:00", e: "11:00" },
        { s: "11:00", e: "12:30" },
      ],
      (x) => x.s,
      (x) => x.e,
    );
    expect(ends.get("09:00")).toBe("10:00");
    expect(ends.get("11:00")).toBe("12:30");
  });
});

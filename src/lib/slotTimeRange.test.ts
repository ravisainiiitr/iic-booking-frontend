import { describe, expect, it } from "vitest";
import {
  isFullDaySlotTimes,
  slotMasterDurationMinutes,
  slotMasterRangeLabel,
  slotMastersError,
  slotRowEndTimes,
  slotSpanLabel,
  slotTimeRangeLabel,
} from "./slotTimeRange";

describe("full 24-hour slots", () => {
  it("reads Close = Open as 24 h, never zero length", () => {
    expect(isFullDaySlotTimes("00:00", "00:00:00")).toBe(true);
    expect(isFullDaySlotTimes("00:00", "23:59")).toBe(false);
    expect(slotMasterDurationMinutes("00:00", "00:00")).toBe(1440);
    expect(slotMasterDurationMinutes("09:00", "09:00")).toBe(1440);
    expect(slotMasterDurationMinutes("18:00", "00:00")).toBe(360);
    expect(slotMasterDurationMinutes("09:00", "10:30")).toBe(90);
  });

  it("labels Slot Master rows", () => {
    expect(slotMasterRangeLabel("00:00", "00:00")).toBe("00:00 – 24:00 (24 h)");
    expect(slotMasterRangeLabel("09:00", "09:00")).toBe("09:00 – 09:00 (+1 day, 24 h)");
    expect(slotMasterRangeLabel("18:00", "00:00")).toBe("18:00 – 00:00 (+1 day)");
    expect(slotMasterRangeLabel("09:00", "10:00")).toBe("09:00 – 10:00");
    expect(slotMasterRangeLabel("", "10:00")).toBe("");
  });

  it("labels grid rows whose end equals the start as a full day", () => {
    expect(slotTimeRangeLabel("00:00", "00:00", 60)).toBe("00:00 – 24:00 (24 h)");
    expect(slotTimeRangeLabel("08:00:00", "08:00", 60)).toBe("08:00 – 08:00 (+1 day, 24 h)");
    expect(slotTimeRangeLabel("00:00", null, 1440)).toBe("00:00 – 24:00 (24 h)");
  });

  it("labels real slot datetimes", () => {
    const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m);
    expect(slotSpanLabel(at(12, 0), at(13, 0))).toBe("00:00 – 24:00 (24 h)");
    expect(slotSpanLabel(at(12, 9), at(13, 9))).toBe("09:00 – 09:00 (+1 day, 24 h)");
    expect(slotSpanLabel(at(12, 0), at(14, 0), "–")).toBe("00:00–00:00 (+2 days, 48 h)");
    expect(slotSpanLabel(at(12, 18), at(13, 0))).toBe("18:00 – 00:00");
    expect(slotSpanLabel(at(12, 0), at(12, 23, 59))).toBe("00:00 – 23:59");
    expect(slotSpanLabel(at(12, 9).toISOString(), at(12, 10).toISOString())).toBe("09:00 – 10:00");
  });

  it("allows a full-day slot only as the only active slot", () => {
    expect(slotMastersError([{ open_time: "00:00", close_time: "00:00", is_active: true }])).toBeNull();
    expect(
      slotMastersError([
        { open_time: "00:00", close_time: "00:00", is_active: true },
        { open_time: "09:00", close_time: "10:00", is_active: false },
      ]),
    ).toBeNull();
    expect(
      slotMastersError([
        { open_time: "09:00", close_time: "10:00" },
        { open_time: "10:00", close_time: "11:00" },
      ]),
    ).toBeNull();
    expect(
      slotMastersError([
        { open_time: "00:00", close_time: "00:00", is_active: true },
        { open_time: "09:00", close_time: "10:00", is_active: true },
      ]),
    ).toMatch(/only active slot/);
  });
});

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

import { describe, expect, it } from "vitest";
import {
  isFullDaySlotTimes,
  parseSlotCloseInput,
  slotCloseTimeForApi,
  slotCloseTimeForForm,
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
    expect(slotMasterRangeLabel("18:00", "00:00")).toBe("18:00 – 24:00");
    expect(slotMasterRangeLabel("12:00", "24:00")).toBe("12:00 – 24:00");
    expect(slotMasterRangeLabel("00:00", "24:00")).toBe("00:00 – 24:00 (24 h)");
    expect(slotMasterRangeLabel("18:00", "02:00")).toBe("18:00 – 02:00 (+1 day)");
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
    expect(slotSpanLabel(at(12, 18), at(13, 0))).toBe("18:00 – 24:00");
    expect(slotSpanLabel(at(12, 18), at(13, 2))).toBe("18:00 – 02:00 (+1 day)");
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

describe("24:00 close times", () => {
  it("labels midnight ends as 24:00 and keeps +1 day for real overnight slots", () => {
    expect(slotTimeRangeLabel("12:00", "00:00:00")).toBe("12:00 – 24:00");
    expect(slotTimeRangeLabel("12:00", "24:00")).toBe("12:00 – 24:00");
    expect(slotTimeRangeLabel("00:00", "24:00")).toBe("00:00 – 24:00 (24 h)");
    expect(slotTimeRangeLabel("18:00", "02:00")).toBe("18:00 – 02:00 (+1 day)");
    expect(slotMasterDurationMinutes("12:00", "24:00")).toBe(720);
    expect(isFullDaySlotTimes("00:00", "24:00")).toBe(true);
  });

  it("parses typed close times", () => {
    expect(parseSlotCloseInput("24:00")).toBe("24:00");
    expect(parseSlotCloseInput(" 24:00:00 ")).toBe("24:00");
    expect(parseSlotCloseInput("9:30")).toBe("09:30");
    expect(parseSlotCloseInput("12:00:00")).toBe("12:00");
    expect(parseSlotCloseInput("24:30")).toBeNull();
    expect(parseSlotCloseInput("25:00")).toBeNull();
    expect(parseSlotCloseInput("12:60")).toBeNull();
    expect(parseSlotCloseInput("noon")).toBeNull();
  });

  it("round-trips the equipment form: stored 00:00 loads as 24:00 and saves as 00:00", () => {
    expect(slotCloseTimeForForm("00:00:00")).toBe("24:00");
    expect(slotCloseTimeForForm("12:00:00")).toBe("12:00");
    expect(slotCloseTimeForForm(null)).toBe("");
    expect(slotCloseTimeForApi(slotCloseTimeForForm("00:00:00"))).toBe("00:00");
    expect(slotCloseTimeForApi("24:00:00")).toBe("00:00");
    expect(slotCloseTimeForApi(slotCloseTimeForForm("12:00:00"))).toBe("12:00");
  });

  it("rejects overlapping active slots but allows touching ones", () => {
    const rows = (...r: Array<[string, string, boolean?]>) => r.map(([o, c, a]) => ({ open_time: o, close_time: c, is_active: a ?? true }));
    expect(slotMastersError(rows(["00:00", "12:00"], ["12:00", "24:00"]))).toBeNull();
    expect(slotMastersError(rows(["18:00", "02:00"], ["02:00", "10:00"]))).toBeNull();
    expect(slotMastersError(rows(["00:00", "12:00"], ["11:00", "24:00"]))).toBe(
      "Active slots must not overlap: 00:00–12:00 overlaps 11:00–24:00. Slots may touch, e.g. 00:00–12:00 and 12:00–24:00.",
    );
    expect(slotMastersError(rows(["18:00", "02:00"], ["01:00", "03:00"]))).toMatch(/must not overlap/);
    expect(slotMastersError(rows(["18:00", "02:00"], ["01:00", "03:00", false]))).toBeNull();
    expect(slotMastersError(rows(["00:00", "24:00"], ["09:00", "10:00"]))).toMatch(/only active slot/);
    expect(slotMastersError(rows(["12:00", "24:30"]))).toMatch(/is not a time/);
    expect(slotCloseTimeForApi("9:30")).toBe("09:30");
  });
});

describe("slotTimeRangeLabel", () => {
  it("prefers the real slot end time", () => {
    expect(slotTimeRangeLabel("09:00", "10:30", 60)).toBe("09:00 – 10:30");
  });

  it("falls back to start plus duration", () => {
    expect(slotTimeRangeLabel("9:30", null, 45)).toBe("09:30 – 10:15");
    expect(slotTimeRangeLabel("23:30", "", 60)).toBe("23:30 – 00:30 (+1 day)");
    expect(slotTimeRangeLabel("23:00", "", 60)).toBe("23:00 – 24:00");
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

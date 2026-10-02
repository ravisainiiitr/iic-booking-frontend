import { describe, expect, it } from "vitest";
import { formatDurationMinutes, groupSlotsByDay, latestSampleStage, telHref } from "./jobSheet";

const slot = (start: string, end: string, slot_name = "") => ({ start_datetime: start, end_datetime: end, slot_name });

describe("groupSlotsByDay", () => {
  it("merges back-to-back slots into one range per day", () => {
    const days = groupSlotsByDay([
      slot("2026-10-06T11:00:00", "2026-10-06T12:00:00"),
      slot("2026-10-06T10:00:00", "2026-10-06T11:00:00"),
      slot("2026-10-06T14:00:00", "2026-10-06T15:00:00"),
      slot("2026-10-07T09:00:00", "2026-10-07T10:00:00"),
    ]);
    expect(days).toHaveLength(2);
    expect(days[0].slotCount).toBe(3);
    expect(days[0].ranges).toHaveLength(2);
    expect(days[0].ranges[0]).toMatch(/10:00.*12:00/i);
    expect(days[1].ranges).toHaveLength(1);
  });

  it("lists slot names when the equipment hides times", () => {
    const days = groupSlotsByDay(
      [slot("2026-10-06T10:00:00", "2026-10-06T11:00:00", "S1"), slot("2026-10-06T11:00:00", "2026-10-06T12:00:00", "S2")],
      { hideTimes: true },
    );
    expect(days[0].ranges).toEqual(["S1", "S2"]);
  });
});

describe("job sheet helpers", () => {
  it("formats durations", () => {
    expect(formatDurationMinutes(120)).toBe("2 h");
    expect(formatDurationMinutes(90)).toBe("1 h 30 min");
    expect(formatDurationMinutes(45)).toBe("45 min");
    expect(formatDurationMinutes(0)).toBe("");
  });

  it("returns the latest sample stage", () => {
    expect(
      latestSampleStage([
        { status: "SAMPLE_ACCEPTED", status_display: "Sample Accepted", created_at: "2026-10-06T10:00:00Z" },
        { status: "SAMPLE_SENT", status_display: "Sample Sent", created_at: "2026-10-05T10:00:00Z" },
      ])?.status_display,
    ).toBe("Sample Accepted");
    expect(latestSampleStage([])).toBeNull();
  });

  it("builds tel: links only for real numbers", () => {
    expect(telHref("+91 98765 43210")).toBe("tel:+919876543210");
    expect(telHref("n/a")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import { quotaBlockReason, quotaBlocksBooking, quotaReferenceDate, quotaSummaryText, type MyBookingQuota } from "./bookingQuota";

function quota(over: Partial<MyBookingQuota> = {}, binding: Partial<NonNullable<MyBookingQuota["binding"]>> = {}): MyBookingQuota {
  const b = {
    period: "WEEKLY" as const,
    scope: "individual",
    shared: false,
    limit_minutes: 240,
    used_minutes: 180,
    remaining_minutes: 60,
    period_start: "2026-10-05",
    period_end: "2026-10-11",
    ...binding,
  };
  return {
    equipment_id: 1,
    equipment_name: "XPS",
    equipment_group_name: null,
    reference_date: "2026-10-05",
    applies: true,
    periods: [b],
    remaining_minutes: b.remaining_minutes,
    binding: b,
    ...over,
  };
}

describe("booking quota", () => {
  it("summarises usage in plain words", () => {
    expect(quotaSummaryText(quota())).toBe("You've used 180 of 240 min on XPS this week (60 min left).");
    expect(quotaSummaryText(quota({}, { period: "MONTHLY" }))).toContain("this month");
    expect(quotaSummaryText(quota({ equipment_group_name: "Surface analysis" }, { shared: true }))).toContain("on Surface analysis");
  });

  it("says next week when browsing the upcoming week", () => {
    expect(quotaSummaryText(quota({}, { period_start: "2026-10-12" }), "2026-10-08")).toContain("on XPS next week");
    expect(quotaSummaryText(quota({}, { period_start: "2026-10-05" }), "2026-10-08")).toContain("on XPS this week");
    expect(quotaBlockReason(quota({}, { period_start: "2026-10-12" }), 90, "2026-10-08")).toContain("60 min left next week");
  });

  it("shows nothing when no quota applies", () => {
    expect(quotaSummaryText(quota({ applies: false, binding: null, remaining_minutes: null }))).toBeNull();
    expect(quotaSummaryText(null)).toBeNull();
  });

  it("blocks slot selection when the booking needs more than what is left", () => {
    expect(quotaBlocksBooking(quota(), 60)).toBe(false);
    expect(quotaBlocksBooking(quota(), 61)).toBe(true);
    expect(quotaBlocksBooking(quota({ remaining_minutes: 0 }, { remaining_minutes: 0 }), null)).toBe(true);
    expect(quotaBlocksBooking(quota({ applies: false }), 999)).toBe(false);
  });

  it("explains the block", () => {
    expect(quotaBlockReason(quota(), 90)).toBe(
      "This booking needs 90 min but you only have 60 min left this week. Reduce the samples in Step 1 or pick a slot in another week.",
    );
    expect(quotaBlockReason(quota({ remaining_minutes: 0 }, { remaining_minutes: 0 }), 30)).toMatch(/used all your booking time for this week/);
    expect(quotaBlockReason(quota(), 30)).toBeNull();
  });

  it("uses the visible week's Monday as the reference date", () => {
    expect(quotaReferenceDate(new Date(2026, 9, 5))).toBe("2026-10-05");
  });
});

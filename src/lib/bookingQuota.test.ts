import { describe, expect, it } from "vitest";

import {
  quotaBlockReason,
  quotaBlocksBooking,
  quotaLimitIsEffectivelyUnlimited,
  quotaReferenceDate,
  quotaSummaryText,
  unlimitedQuotaConfigHint,
  visibleQuota,
  type MyBookingQuota,
} from "./bookingQuota";

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

  it("treats limits nobody can use up as no limit", () => {
    expect(quotaLimitIsEffectivelyUnlimited("WEEKLY", 10075)).toBe(true);
    expect(quotaLimitIsEffectivelyUnlimited("WEEKLY", 8999)).toBe(false);
    expect(quotaLimitIsEffectivelyUnlimited("MONTHLY", 44640)).toBe(true);
    expect(quotaLimitIsEffectivelyUnlimited("MONTHLY", 10075)).toBe(false);

    const unlimitedWeek = quota({}, { limit_minutes: 10075, used_minutes: 0, remaining_minutes: 10075 });
    expect(quotaSummaryText(unlimitedWeek)).toBeNull();
    expect(quotaBlocksBooking(unlimitedWeek, 600)).toBe(false);
    expect(visibleQuota(unlimitedWeek)?.applies).toBe(false);

    const unlimitedMonth = quota({}, { period: "MONTHLY", limit_minutes: 44000, used_minutes: 0, remaining_minutes: 44000 });
    expect(quotaSummaryText(unlimitedMonth)).toBeNull();
  });

  it("keeps a realistic limit when another period is effectively unlimited", () => {
    const week = { period: "WEEKLY" as const, scope: "Individual Weekly", shared: false, limit_minutes: 10075, used_minutes: 0, remaining_minutes: 10075, period_start: "2026-10-05", period_end: "2026-10-11" };
    const month = { ...week, period: "MONTHLY" as const, scope: "Individual Monthly", limit_minutes: 600, used_minutes: 100, remaining_minutes: 500, period_start: "2026-10-01" };
    const q = quota({ periods: [week, month], binding: week, remaining_minutes: 10075 });
    expect(quotaSummaryText(q)).toBe("You've used 100 of 600 min on XPS this month (500 min left).");
    expect(quotaBlocksBooking(q, 501)).toBe(true);
    expect(quotaSummaryText(quota({}, { limit_minutes: 600, used_minutes: 0, remaining_minutes: 600 }))).toBe(
      "You've used 0 of 600 min on XPS this week (600 min left).",
    );
  });

  it("notes unreachable limits in the quota form", () => {
    expect(unlimitedQuotaConfigHint([{ quota_type: "WEEKLY", internal_individual_quota_minutes: 600 }])).toBeNull();
    expect(unlimitedQuotaConfigHint([{ quota_type: "WEEKLY", external_faculty_quota_minutes: 10075 }])).toMatch(/^Weekly limits .* no limit\./);
    const both = unlimitedQuotaConfigHint([
      { quota_type: "WEEKLY", internal_individual_quota_minutes: 9999 },
      { quota_type: "MONTHLY", internal_faculty_quota_minutes: 44640 },
    ]);
    expect(both).toContain("Weekly limits");
    expect(both).toContain("Monthly limits");
    expect(unlimitedQuotaConfigHint(undefined)).toBeNull();
  });

  it("uses the visible week's Monday as the reference date", () => {
    expect(quotaReferenceDate(new Date(2026, 9, 5))).toBe("2026-10-05");
  });
});

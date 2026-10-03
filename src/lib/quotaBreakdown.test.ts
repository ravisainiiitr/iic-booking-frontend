import { describe, expect, it, vi } from "vitest";

import type { MyBookingQuota } from "./bookingQuota";
import {
  nearLimitPeriod,
  openQuotaBreakdown,
  quotaBreakdownQuery,
  quotaBreakdownRequestFromFailure,
  quotaBreakdownRequestFromPeriod,
  quotaFailureFrom,
  quotaFailureSummary,
  subscribeQuotaBreakdown,
  type QuotaFailure,
} from "./quotaBreakdown";

const failure = (over: Partial<QuotaFailure> = {}): QuotaFailure => ({
  scope: "individual",
  scope_label: "Individual Weekly",
  period: "WEEKLY",
  period_start: "2026-10-05T00:00:00+05:30",
  period_end: "2026-10-11T23:59:59.999999+05:30",
  period_label: "Week of Mon 5 Oct – Sun 11 Oct 2026",
  limit_minutes: 270,
  used_minutes: 210,
  requested_minutes: 90,
  remaining_minutes: 60,
  over_by_minutes: 30,
  members_count: 1,
  equipment_id: 7,
  equipment_name: "XPS",
  user_id: 11,
  date: "2026-10-07",
  booking_id: null,
  message: "Individual Weekly quota exceeded",
  ...over,
});

function quota(binding: Partial<NonNullable<MyBookingQuota["binding"]>> = {}): MyBookingQuota {
  const b = {
    period: "WEEKLY" as const,
    scope: "Individual Weekly",
    shared: false,
    limit_minutes: 240,
    used_minutes: 200,
    remaining_minutes: 40,
    period_start: "2026-10-05T00:00:00+05:30",
    period_end: "2026-10-11T23:59:59+05:30",
    ...binding,
  };
  return {
    equipment_id: 7,
    equipment_name: "XPS",
    equipment_group_name: null,
    reference_date: "2026-10-05",
    applies: true,
    periods: [b],
    remaining_minutes: b.remaining_minutes,
    binding: b,
  };
}

describe("quotaFailureFrom", () => {
  it("reads the payload from an API error response or a thrown error", () => {
    const q = failure();
    expect(quotaFailureFrom({ error: "x", data: { error: "x", code: "QUOTA_EXCEEDED", quota: q } })).toEqual(q);
    expect(quotaFailureFrom(Object.assign(new Error("x"), { quota: q }))).toEqual(q);
  });

  it("ignores responses without a minutes-limit payload", () => {
    expect(quotaFailureFrom({ error: "Slot taken", data: { error: "Slot taken" } })).toBeNull();
    expect(quotaFailureFrom({ quota: { period: "DAILY", equipment_id: 1 } })).toBeNull();
    expect(quotaFailureFrom(null)).toBeNull();
  });
});

describe("quotaBreakdownQuery", () => {
  it("maps a failure to the endpoint's parameters", () => {
    const qs = new URLSearchParams(quotaBreakdownQuery(quotaBreakdownRequestFromFailure(failure({ booking_id: 42 }))));
    expect(Object.fromEntries(qs)).toEqual({
      equipment: "7",
      period: "week",
      scope: "individual",
      date: "2026-10-07",
      user_id: "11",
      booking_id: "42",
      requested: "90",
    });
  });

  it("sends only the log id (and no limit params) for attempt log entries", () => {
    expect(quotaBreakdownQuery({ logId: 5, equipment: 7, period: "MONTHLY" })).toBe("log_id=5");
  });

  it("uses the IST date of the period start when the failure has no date", () => {
    const req = quotaBreakdownRequestFromFailure(failure({ date: null, period: "MONTHLY" }));
    expect(new URLSearchParams(quotaBreakdownQuery(req)).get("date")).toBe("2026-10-05");
    expect(new URLSearchParams(quotaBreakdownQuery(req)).get("period")).toBe("month");
  });
});

describe("quotaFailureSummary", () => {
  it("explains an individual limit with the figures", () => {
    expect(quotaFailureSummary(failure())).toBe(
      "Your weekly limit is 270 min. 210 min are already booked for the week of Mon 5 Oct – Sun 11 Oct 2026 and this needs 90 min (30 min over).",
    );
  });

  it("names the research group for faculty limits", () => {
    const text = quotaFailureSummary(failure({ scope: "group", period: "MONTHLY", members_count: 4, period_label: "October 2026" }));
    expect(text).toMatch(/^Your research group's monthly limit \(shared by 4 people\) is 270 min\./);
    expect(text).toContain("for October 2026");
  });

  it("says when the request alone is bigger than the limit", () => {
    expect(quotaFailureSummary(failure({ limit_minutes: 200, used_minutes: 0, requested_minutes: 270, over_by_minutes: 70 }))).toBe(
      "This request alone (270 min) exceeds the weekly limit (200 min).",
    );
  });
});

describe("nearLimitPeriod", () => {
  it("offers the breakdown from 80% of the binding limit", () => {
    expect(nearLimitPeriod(quota({ used_minutes: 191, remaining_minutes: 49 }))).toBeNull();
    expect(nearLimitPeriod(quota({ used_minutes: 192, remaining_minutes: 48 }))?.period).toBe("WEEKLY");
  });

  it("never for limits nobody can reach", () => {
    expect(nearLimitPeriod(quota({ limit_minutes: 10075, used_minutes: 9000, remaining_minutes: 1075 }))).toBeNull();
    expect(nearLimitPeriod(null)).toBeNull();
  });

  it("asks for the group scope on shared limits", () => {
    const p = quota({ shared: true }).binding!;
    expect(quotaBreakdownRequestFromPeriod(7, p, 3)).toEqual({
      equipment: 7,
      period: "WEEKLY",
      scope: "group",
      date: "2026-10-05",
      userId: 3,
    });
  });
});

describe("openQuotaBreakdown", () => {
  it("notifies the mounted host until it unsubscribes", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeQuotaBreakdown(listener);
    openQuotaBreakdown({ logId: 9 });
    expect(listener).toHaveBeenCalledWith({ logId: 9 }, {});
    unsubscribe();
    openQuotaBreakdown({ logId: 10 });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

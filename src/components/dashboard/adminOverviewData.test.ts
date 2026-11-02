import { describe, expect, it } from "vitest";
import { experienceRatingCard, formatCountdown, mergeAttentionItems, nextWeeklyOpening, reportsLink } from "./adminOverviewData";

const item = (key: string, count = 1, link = `/${key}`) => ({ key, label: key, count, link, description: "" });

describe("mergeAttentionItems", () => {
  it("lists the user's pending actions first and adds summary items that are not already there", () => {
    const merged = mergeAttentionItems(
      [item("open_support_tickets", 3), item("wallet_recharge_requests", 9, "/summary-link")],
      [item("wallet_recharge_requests", 2), item("notice_requests", 1)],
    );
    expect(merged.map((i) => [i.key, i.count, i.fromPendingActions])).toEqual([
      ["wallet_recharge_requests", 2, true],
      ["notice_requests", 1, true],
      ["open_support_tickets", 3, false],
    ]);
  });

  it("drops zero counts", () => {
    expect(mergeAttentionItems([item("a", 0)], [item("b", 0)])).toEqual([]);
  });
});

describe("nextWeeklyOpening", () => {
  const ist = (s: string) => Date.parse(`${s}+05:30`);

  it("returns the coming Wednesday at 9 pm IST", () => {
    // Monday 5 Oct 2026, 10:00 IST
    expect(nextWeeklyOpening(ist("2026-10-05T10:00:00")).toISOString()).toBe("2026-10-07T15:30:00.000Z");
  });

  it("returns the same day before 9 pm on a Wednesday and next week after it", () => {
    expect(nextWeeklyOpening(ist("2026-10-07T20:59:00")).toISOString()).toBe("2026-10-07T15:30:00.000Z");
    expect(nextWeeklyOpening(ist("2026-10-07T21:00:00")).toISOString()).toBe("2026-10-14T15:30:00.000Z");
  });

  it("uses the IST date even when it is still Tuesday in UTC", () => {
    // Wednesday 00:30 IST = Tuesday 19:00 UTC
    expect(nextWeeklyOpening(ist("2026-10-07T00:30:00")).toISOString()).toBe("2026-10-07T15:30:00.000Z");
  });
});

describe("formatCountdown", () => {
  it("shows days and hours, hours and minutes, or minutes", () => {
    expect(formatCountdown((2 * 24 + 4) * 3_600_000 + 5 * 60_000)).toBe("2d 4h");
    expect(formatCountdown(3 * 3_600_000 + 12 * 60_000)).toBe("3h 12m");
    expect(formatCountdown(5 * 60_000)).toBe("5m");
    expect(formatCountdown(10_000)).toBe("1m");
  });
});

describe("experienceRatingCard", () => {
  const ratings = { days: 90, booking_average: 4.24, booking_count: 12, portal_average: 4.4, portal_count: 128 };

  it("institute-wide shows the portal average on the 1-5 scale with how many ratings were submitted", () => {
    expect(experienceRatingCard(ratings, false)).toEqual({
      value: "4.4 / 5",
      hint: "Based on 128 ratings · bookings 4.2 / 5 (12 ratings in 90 days)",
      source: "portal",
    });
  });

  it("a department view counts that department's booking ratings only", () => {
    expect(experienceRatingCard(ratings, true)).toEqual({
      value: "4.2 / 5", hint: "Based on 12 booking ratings in 90 days", source: "booking",
    });
  });

  it("falls back to booking ratings when nobody has rated the portal", () => {
    const card = experienceRatingCard({ ...ratings, portal_average: null, portal_count: 0, booking_count: 1 }, false);
    expect(card).toEqual({ value: "4.2 / 5", hint: "Based on 1 booking rating in 90 days", source: "booking" });
  });

  it("shows an empty state instead of a zero average", () => {
    const none = { days: 90, booking_average: null, booking_count: 0, portal_average: null, portal_count: 0 };
    expect(experienceRatingCard(none, false)).toEqual({ value: "No ratings yet", hint: "No experience ratings submitted yet", source: null });
    expect(experienceRatingCard(none, true).hint).toBe("No booking ratings in the last 90 days");
    expect(experienceRatingCard(null, false).value).toBe("—");
  });
});

describe("reportsLink", () => {
  it("opens Reports on the same IST window as the figure", () => {
    const lateEvening = Date.parse("2026-11-30T20:00:00Z"); // 1 Dec 01:30 IST
    expect(reportsLink("today", lateEvening)).toBe("/reports?from=2026-12-01&to=2026-12-01");
    expect(reportsLink("month", Date.parse("2026-11-02T10:00:00Z"))).toBe("/reports?from=2026-11-01&to=2026-11-02");
  });
});

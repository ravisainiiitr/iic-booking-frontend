import { describe, expect, it } from "vitest";
import { formatCountdown, mergeAttentionItems, nextWeeklyOpening } from "./adminOverviewData";

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

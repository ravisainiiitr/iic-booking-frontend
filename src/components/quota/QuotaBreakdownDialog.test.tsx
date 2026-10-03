// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { QuotaBreakdown, QuotaBreakdownRow } from "@/lib/quotaBreakdown";

const getQuotaBreakdown = vi.fn();
vi.mock("@/lib/api", () => ({ apiClient: { getQuotaBreakdown: (...args: unknown[]) => getQuotaBreakdown(...args) } }));

import { QuotaBreakdownPanel, formatSlotSpan } from "./QuotaBreakdownDialog";

afterEach(cleanup);
beforeEach(() => getQuotaBreakdown.mockReset());

const row = (over: Partial<QuotaBreakdownRow> = {}): QuotaBreakdownRow => ({
  booking_id: 101,
  display_booking_id: "XPS202600101",
  equipment_id: 7,
  equipment_name: "XPS",
  equipment_code: "XPS",
  slot_start: "2026-10-06T04:30:00Z",
  slot_end: "2026-10-06T06:00:00Z",
  minutes: 90,
  counted: true,
  status: "BOOKED",
  status_label: "Booked",
  user_id: 11,
  user_name: "Asha Rao",
  note: null,
  is_viewer: true,
  can_open: true,
  ...over,
});

const breakdown = (over: Partial<QuotaBreakdown> = {}): QuotaBreakdown => ({
  equipment: { id: 7, name: "XPS", code: "XPS" },
  equipment_group_name: "Surface analysis",
  scope: "group",
  scope_label: "Faculty Weekly",
  period: "WEEKLY",
  period_start: "2026-10-05T00:00:00+05:30",
  period_end: "2026-10-11T23:59:59+05:30",
  period_label: "Week of Mon 5 Oct – Sun 11 Oct 2026",
  limit_minutes: 300,
  used_minutes: 240,
  requested_minutes: 90,
  remaining_minutes: 60,
  over_by_minutes: 30,
  effectively_unlimited: false,
  subject: { id: 11, name: "Asha Rao" },
  group_owner: { id: 3, name: "Dr. Mehta" },
  group_members_count: 3,
  excluded_booking_id: null,
  counted: [
    row(),
    row({
      booking_id: null,
      display_booking_id: "XPS202600102",
      user_id: 12,
      user_name: "Vikram Singh",
      minutes: 150,
      is_viewer: false,
      can_open: false,
    }),
  ],
  not_counted: [row({ booking_id: 103, display_booking_id: "XPS202600103", counted: false, status: "CANCELLED", status_label: "Cancelled", note: "Cancelled – the time went back to the limit" })],
  not_counted_truncated: false,
  members: [
    { user_id: 12, name: "Vikram Singh", minutes: 150, bookings: 1, is_viewer: false },
    { user_id: 11, name: "Asha Rao", minutes: 90, bookings: 1, is_viewer: true },
  ],
  viewer_access: "self",
  full_details: false,
  computed_at: "2026-10-03T10:00:00Z",
  historical: false,
  ...over,
});

describe("formatSlotSpan", () => {
  it("shows slots in Indian time whatever the browser zone", () => {
    expect(formatSlotSpan("2026-10-06T04:30:00Z", "2026-10-06T06:00:00Z")).toMatch(/6 Oct.*10:00.?11:30/);
    expect(formatSlotSpan("2026-10-04T18:00:00Z", "2026-10-04T19:00:00Z")).toMatch(/^Sun.*4 Oct.*23:30.*Mon.*5 Oct.*00:30$/);
  });
});

describe("QuotaBreakdownPanel", () => {
  it("shows a student their group's bookings by person, linking only their own", async () => {
    getQuotaBreakdown.mockResolvedValue({ data: breakdown() });
    render(<QuotaBreakdownPanel request={{ equipment: 7, period: "WEEKLY", scope: "group", date: "2026-10-07" }} />);

    expect(await screen.findByText("Week of Mon 5 Oct – Sun 11 Oct 2026")).toBeTruthy();
    expect(screen.getByText(/Research group limit on Surface analysis \(Dr\. Mehta's group, 3 people\)/)).toBeTruthy();
    expect(screen.getByText("Over by").nextSibling?.textContent).toBe("30 min");
    expect(screen.getByText(/only your own bookings can be opened/)).toBeTruthy();

    const people = screen.getByRole("list", { name: "Minutes by person" });
    expect(within(people).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Vikram Singh: 150 min · 1 booking",
      "Asha Rao (you): 90 min · 1 booking",
    ]);

    const own = screen.getByRole("link", { name: "XPS202600101" });
    expect(own.getAttribute("href")).toBe("/my-bookings?booking=XPS202600101");
    expect(screen.queryByRole("link", { name: "XPS202600102" })).toBeNull();
    expect(screen.getByText("XPS202600102")).toBeTruthy();
    expect(screen.getByText("Not counted (1)")).toBeTruthy();
  });

  it("opens bookings in place for staff and explains attempt log figures", async () => {
    getQuotaBreakdown.mockResolvedValue({
      data: breakdown({
        scope: "individual",
        scope_label: "Individual Weekly",
        members: [],
        counted: [row({ is_viewer: false })],
        used_minutes: 120,
        limit_minutes: 200,
        over_by_minutes: 10,
        viewer_access: "staff",
        full_details: true,
        historical: true,
        attempt: {
          attempted_at: "2026-09-30T15:35:00Z",
          period_source: "requested_slot",
          logged_used_minutes: 120,
          logged_limit_minutes: 270,
          logged_requested_minutes: 90,
          limit_changed: true,
          usage_changed: false,
        },
      }),
    });
    const onOpen = vi.fn();
    render(<QuotaBreakdownPanel request={{ logId: 5 }} onOpenBooking={onOpen} />);

    expect(await screen.findByText(/Limit now 200 min \(was 270 min at the time of the attempt\)\./)).toBeTruthy();
    expect(screen.getByText(/Worked out now from current bookings/)).toBeTruthy();
    expect(screen.getByText("Asha Rao's limit on Surface analysis")).toBeTruthy();
    screen.getByRole("button", { name: "XPS202600101" }).click();
    expect(onOpen).toHaveBeenCalledWith(101);
    expect(getQuotaBreakdown).toHaveBeenCalledWith({ logId: 5 });
  });

  it("says so when nothing counts and shows server errors", async () => {
    getQuotaBreakdown.mockResolvedValueOnce({
      data: breakdown({ counted: [], not_counted: [], members: [], used_minutes: 0, requested_minutes: 0, over_by_minutes: 0, remaining_minutes: 300 }),
    });
    render(<QuotaBreakdownPanel request={{ equipment: 7, period: "WEEKLY" }} />);
    expect(await screen.findByText("No bookings count toward this limit in this period.")).toBeTruthy();
    expect(screen.getByText("Left").nextSibling?.textContent).toBe("300 min");
    cleanup();

    getQuotaBreakdown.mockResolvedValueOnce({ error: "You can only see bookings counted toward your own (or your group's) limit." });
    render(<QuotaBreakdownPanel request={{ equipment: 7, period: "WEEKLY", userId: 99 }} />);
    expect(await screen.findByText(/You can only see bookings counted/)).toBeTruthy();
  });
});

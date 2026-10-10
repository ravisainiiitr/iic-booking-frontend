// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AdminDashboardSummary } from "@/lib/api";

const api = vi.hoisted(() => ({
  getAdminDashboardSummary: vi.fn(),
  getPendingActions: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ apiClient: api }));
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
vi.mock("@/hooks/use-peak-window", () => ({
  usePeakWindow: () => ({ loaded: true, active: false, window: null }),
}));

import AdminOverview from "./AdminOverview";

function summary(overrides: Partial<AdminDashboardSummary> = {}): AdminDashboardSummary {
  return {
    scope: "department",
    department: { id: 4, name: "Chemistry" },
    generated_at: "2026-10-02T13:30:00Z",
    cache_seconds: 60,
    bookings: { created_today: 3, created_this_week: 11, created_last_7_days: 14, sessions_today: 5, sessions_next_7_days: 21 },
    revenue: { month: "2026-10", charged_this_month: 12500, charged_bookings_this_month: 9, refunded_this_month: 0, charged_last_month: 40000 },
    equipment: { total: 12, operational: 10, under_maintenance: 2, disposed: 0, other: 0 },
    users: { active: 340, new_last_7_days: 4, new_last_30_days: 19 },
    waitlist: { active: 6 },
    booking_attempts: { days: 7, total: 50, failed: 5, top_failure_reasons: [{ reason: "Slot already taken", count: 3 }] },
    ratings: { days: 90, booking_average: 4.4, booking_count: 25, portal_average: null, portal_count: 0 },
    attention: [
      { key: "wallet_recharge_requests", label: "Wallet recharge requests", count: 2, link: "/admin-settings/wallet-recharge-requests", description: "Awaiting approval" },
      { key: "bookings_disrupted", label: "Disrupted bookings", count: 1, link: "/booking-management", description: "Need follow-up" },
    ],
    bookings_per_day: [
      { date: "2026-10-01", count: 4, charged: 1000 },
      { date: "2026-10-02", count: 3, charged: 800 },
    ],
    top_equipment: [{ equipment_id: 1, name: "FE-SEM", code: "SEM1", bookings: 4, hours: 12.5, charged: 5000 }],
    recent_bookings: [
      {
        booking_id: 99,
        reference: "IIC-0099",
        equipment_name: "FE-SEM",
        user_name: "A. Kumar",
        status: "CONFIRMED",
        status_display: "Confirmed",
        total_charge: 500,
        created_at: "2026-10-02T12:00:00Z",
      },
    ],
    system: { backend_version: "v2.5.47", build_date: "2026-10-02", server_time: "2026-10-02T13:30:00Z" },
    ...overrides,
  };
}

describe("AdminOverview", () => {
  beforeEach(() => {
    api.getAdminDashboardSummary.mockResolvedValue({ data: summary() });
    api.getPendingActions.mockResolvedValue({
      data: {
        items: [
          { key: "notice_requests", label: "Notice board requests", count: 1, link: "/admin-settings/communication?tab=notices", description: "" },
        ],
      },
    });
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows the scoped figures and the merged attention list", async () => {
    render(<AdminOverview onOpen={vi.fn()} canOpen={() => true} />);
    expect(await screen.findByText("Administration overview")).toBeTruthy();
    expect(screen.getByText("Chemistry")).toBeTruthy();
    expect(screen.getByText("21 in the next 7 days")).toBeTruthy();
    expect(screen.getByText("10/12")).toBeTruthy();
    expect(screen.getByText("Notice board requests")).toBeTruthy();
    expect(screen.getByText("Disrupted bookings")).toBeTruthy();
    expect(screen.getByText("IIC-0099 · A. Kumar")).toBeTruthy();
    expect(screen.getByText(/Backend online · v2.5.47/)).toBeTruthy();
  });

  it("only links to pages the user has in their menu", async () => {
    const onOpen = vi.fn();
    render(<AdminOverview onOpen={onOpen} canOpen={(p) => p === "/admin-settings/wallet-recharge-requests"} />);
    await screen.findByText("Administration overview");
    expect(screen.queryByRole("button", { name: "Open Disrupted bookings" })).toBeNull();
    expect(screen.queryByRole("button", { name: /View all/ })).toBeNull();
    // The user's own pending actions are always openable.
    await userEvent.setup().click(screen.getByRole("button", { name: "Open Notice board requests" }));
    expect(onOpen).toHaveBeenLastCalledWith("/admin-settings/communication?tab=notices");
    await userEvent.setup().click(screen.getByRole("button", { name: "Open Wallet recharge requests" }));
    expect(onOpen).toHaveBeenLastCalledWith("/admin-settings/wallet-recharge-requests");
  });

  it("shows the tip of the day between the header and the figures, without a separate attention bar", async () => {
    render(<AdminOverview onOpen={vi.fn()} canOpen={() => true} notices={<p>Tip slot</p>} />);
    const header = await screen.findByText("Administration overview");
    const notice = screen.getByText("Tip slot");
    expect(screen.queryByText(/Needs your attention/)).toBeNull();
    const firstKpi = screen.getByText("Sessions today");
    expect(header.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(notice.compareDocumentPosition(firstKpi) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("offers a retry when the overview cannot load", async () => {
    api.getAdminDashboardSummary.mockResolvedValueOnce({ error: "Only the Main Administrator can view this overview." });
    render(<AdminOverview onOpen={vi.fn()} canOpen={() => true} />);
    expect(await screen.findByText("Only the Main Administrator can view this overview.")).toBeTruthy();
    await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }));
    expect(api.getAdminDashboardSummary).toHaveBeenLastCalledWith({ refresh: true });
    expect(await screen.findByText("Administration overview")).toBeTruthy();
  });

  it("opens the equipment, users and cancellations overviews from their cards", async () => {
    api.getAdminDashboardSummary.mockResolvedValue({
      data: summary({
        cancellations: { days: 30, total: 8, previous_total: 5, late: 3, refunded: 1200, bookings_created: 160, rate: 0.05 },
      }),
    });
    const onOpen = vi.fn();
    render(<AdminOverview onOpen={onOpen} canOpen={() => true} />);
    await screen.findByText("Administration overview");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Equipment\s*10\/12/ }));
    expect(onOpen).toHaveBeenLastCalledWith("/admin/insights/equipment");
    await user.click(screen.getByRole("button", { name: /Active users/ }));
    expect(onOpen).toHaveBeenLastCalledWith("/admin/insights/users");
    expect(screen.getByText("5.0% of 160 bookings · ▲ 3 vs the 30 days before")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Cancellations \(30 days\)/ }));
    expect(onOpen).toHaveBeenLastCalledWith("/admin/insights/cancellations");
  });

  it("keeps the insight cards plain when the pages are not in the user's menu or the server is older", async () => {
    render(<AdminOverview onOpen={vi.fn()} canOpen={() => false} />);
    await screen.findByText("Administration overview");
    expect(screen.queryByRole("button", { name: /Active users/ })).toBeNull();
    expect(screen.getByText("Cancellations (30 days)")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Cancellations/ })).toBeNull();
  });
});

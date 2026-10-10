// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { CancellationInsights, EquipmentInsights, UserInsights } from "@/lib/adminInsights";

const state = vi.hoisted(() => ({
  api: {
    getAdminEquipmentInsights: vi.fn(),
    getAdminUserInsights: vi.fn(),
    getAdminCancellationInsights: vi.fn(),
  },
}));

vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: state.api }));
vi.mock("@/components/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/components/ExportMenu", () => ({
  ExportMenu: ({ report }: { report: string }) => <button type="button">Export {report}</button>,
}));
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

import EquipmentOverview from "./EquipmentOverview";
import UsersOverview from "./UsersOverview";
import CancellationsDashboard from "./CancellationsDashboard";
import {
  EMPTY_USER_FILTERS,
  filtersFromSearch,
  formatDuration,
  formatPercent,
  insightParams,
  insightQuery,
} from "@/lib/adminInsights";

const page = { scope: "institute" as const, department: null, generated_at: "2026-10-10T10:00:00Z", count: 1, page: 1, page_size: 25, total_pages: 1 };

const equipmentData: EquipmentInsights = {
  ...page,
  card: { total: 68, operational: 63, under_maintenance: 4, disposed: 2, other: 1 },
  summary: {
    total: 68,
    by_status: [
      { key: "operational", label: "Operational", count: 63 },
      { key: "under_maintenance", label: "Under maintenance", count: 4 },
      { key: "other", label: "Other", count: 1 },
    ],
    by_category: [{ key: "5", label: "Microscopy", count: 10 }],
    by_department: [{ key: "2", label: "Physics", count: 68 }],
    by_profile_type: [{ key: "TIME", label: "Time based", count: 68 }],
    by_oic: [{ key: "9", label: "Dr. OIC", count: 12 }],
    test_only: 0,
    upcoming_bookings: 31,
    utilisation: 0.4234,
    utilisation_days: 30,
  },
  results: [
    {
      equipment_id: 3,
      name: "FE-SEM",
      code: "SEM1",
      status: "MAINTENANCE",
      status_display: "Under Maintenance",
      status_group: "under_maintenance",
      status_group_display: "Under maintenance",
      profile_type: "TIME",
      profile_type_display: "Time based",
      category: { id: 5, name: "Microscopy" },
      department: { id: 2, name: "Physics" },
      parent_equipment: null,
      test_only: false,
      officers_in_charge: [{ id: 9, name: "Dr. OIC", email: "oic@example.com" }],
      down_since: "2026-10-08T09:00:00+05:30",
      downtime_hours: 49,
      last_status_change: "2026-10-08T09:00:00+05:30",
      upcoming_bookings: 2,
      next_booking_at: "2026-10-12T10:00:00+05:30",
      utilisation: 0.5,
      booked_hours_30d: 40,
      slot_hours_30d: 80,
    },
  ],
  options: {
    statuses: [{ value: "operational", label: "Operational" }],
    categories: [{ id: 5, name: "Microscopy" }],
    oics: [{ id: 9, name: "Dr. OIC" }],
    profile_types: [{ value: "TIME", label: "Time based" }],
    departments: [{ id: 2, name: "Physics" }],
  },
};

const userData: UserInsights = {
  ...page,
  card: { active: 340, new_last_7_days: 4, new_last_30_days: 19 },
  definitions: { active: "Account enabled (can sign in).", booked_in_period: "Created a booking.", programme: "" },
  summary: {
    total: 340,
    active: 340,
    inactive: 12,
    internal: 300,
    external: 40,
    new_last_30_days: 19,
    by_category: [
      { key: "iitr_student", label: "IITR Students", segment: "internal", count: 250 },
      { key: "external_industry", label: "Industry", segment: "external", count: 40 },
    ],
    by_programme: [{ key: "phd", label: "PhD / research", count: 200 }],
    internal_by_department: [{ id: 2, name: "Physics", faculty: 20, students: 250, staff: 30, startups: 0, total: 300 }],
    external_by_organisation: [{ id: 7, name: "Acme Labs", type: "Industry", state: "Delhi", count: 40 }],
    external_by_state: [{ key: "DL", label: "Delhi", count: 40 }],
    trend: { granularity: "month", series: [{ period: "2026-10-01", internal: 3, external: 1, total: 4 }] },
  },
  results: [
    {
      id: 41,
      name: "Asha Rao",
      email: "asha@example.com",
      phone: "9876543210",
      category: "iitr_student",
      category_display: "IITR Students",
      user_type_display: "IITR Student",
      programme: "phd",
      programme_display: "PhD / research",
      department: { id: 2, name: "Physics", type: "INTERNAL" },
      date_joined: "2026-01-05T10:00:00+05:30",
      is_active: true,
      bookings_count: 7,
      last_booking_at: "2026-10-01T10:00:00+05:30",
      wallet_owner_id: 12,
    },
  ],
  options: {
    categories: [{ value: "iitr_student", label: "IITR Students", segment: "internal" }],
    programmes: [{ value: "phd", label: "PhD / research" }],
    departments: [{ id: 2, name: "Physics", type: "INTERNAL" }],
  },
};

const breakdown = (key: string, label: string, count: number) => ({ key, label, count, late: 0, refund: 0 });

const cancellationData: CancellationInsights = {
  ...page,
  date_from: "2026-09-11",
  date_to: "2026-10-10",
  include_no_shows: false,
  late_minutes: 1440,
  summary: {
    total: 8,
    late: 3,
    late_share: 0.375,
    charge_total: 8000,
    refund_total: 6000,
    retained_total: 2000,
    refunded_count: 6,
    refund_unknown: 1,
    refund_estimated: 2,
    bookings_created: 160,
    rate: 0.05,
    previous: { date_from: "2026-08-12", date_to: "2026-09-10", total: 5, late: 1, bookings_created: 150, rate: 0.0333 },
    change: 3,
    by_role: [breakdown("USER", "Booking user", 5), breakdown("SYSTEM", "Automatic", 3)],
    by_reason: [breakdown("USER_REQUEST", "Cancelled by the user", 5)],
    by_lead_time: [breakdown("under_2h", "Less than 2 hours before", 3)],
    by_category: [breakdown("iitr_student", "IITR Students", 8)],
    by_data_quality: [breakdown("RECORDED", "Recorded", 6), breakdown("INFERRED", "Inferred", 2)],
    by_equipment: [{ id: 3, label: "FE-SEM", count: 8, late: 3, code: "SEM1" }],
    by_department: [{ id: 2, label: "Physics", count: 8, late: 3 }],
    by_oic: [{ id: 9, label: "Dr. OIC", count: 8, late: 3 }],
    refills: [{ key: "waitlist", label: "Re-booked from the waitlist", count: 2 }],
    trend: { granularity: "day", series: [{ period: "2026-10-09", count: 2, late: 1 }] },
  },
  results: [
    {
      id: 101,
      booking: { pk: 555, display_id: "IIC-0555", status: "CANCELLED", status_display: "Cancelled" },
      user: { id: 41, name: "Asha Rao", category: "iitr_student", category_display: "IITR Students", department: "Physics" },
      equipment: { id: 3, name: "FE-SEM", code: "SEM1" },
      slot_start: "2026-10-09T10:00:00+05:30",
      slot_end: "2026-10-09T11:00:00+05:30",
      cancelled_at: "2026-10-09T09:00:00+05:30",
      actor_role: "USER",
      actor_role_display: "Booking user",
      cancelled_by: "Asha Rao",
      reason: "USER_REQUEST",
      reason_display: "Cancelled by the user",
      note: "Sample not ready",
      lead_minutes: 60,
      late: true,
      charge: 1000,
      refund: null,
      refund_estimated: false,
      data_quality: "INFERRED",
      data_quality_display: "Inferred",
      refill: "waitlist",
      refill_display: "Re-booked from the waitlist",
    },
  ],
  options: {
    equipment: [{ id: 3, name: "FE-SEM", code: "SEM1" }],
    roles: [{ value: "USER", label: "Booking user" }],
    reasons: [{ value: "USER_REQUEST", label: "Cancelled by the user" }],
    data_qualities: [{ value: "INFERRED", label: "Inferred" }],
    categories: [{ value: "iitr_student", label: "IITR Students" }],
    departments: [{ id: 2, name: "Physics" }],
    oics: [{ id: 9, name: "Dr. OIC" }],
  },
};

beforeAll(() => {
  Element.prototype.scrollIntoView ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
});

beforeEach(() => {
  state.api.getAdminEquipmentInsights.mockResolvedValue({ data: equipmentData });
  state.api.getAdminUserInsights.mockResolvedValue({ data: userData });
  state.api.getAdminCancellationInsights.mockResolvedValue({ data: cancellationData });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const lastParams = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls[fn.mock.calls.length - 1][0];

describe("admin insight helpers", () => {
  it("drops empty filters and sends flags as 1", () => {
    expect(insightParams({ a: "", b: " x ", c: false, d: true }, { page: 2 })).toEqual({ b: "x", d: true, page: 2 });
    expect(insightQuery({ a: "", status: "active", late_only: true })).toBe("?status=active&late_only=1");
    expect(insightQuery({})).toBe("");
  });

  it("reads filters from the page URL", () => {
    const f = filtersFromSearch(EMPTY_USER_FILTERS, new URLSearchParams("status=inactive&not_booked=1&x=1"));
    expect(f.status).toBe("inactive");
    expect(f.not_booked).toBe(true);
    expect("x" in f).toBe(false);
  });

  it("formats durations and percentages", () => {
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(150)).toBe("2 h 30 min");
    expect(formatDuration(3 * 1440 + 240)).toBe("3 d 4 h");
    expect(formatDuration(null)).toBe("—");
    expect(formatPercent(0.4234)).toBe("42.3%");
    expect(formatPercent(null)).toBe("—");
  });
});

describe("EquipmentOverview", () => {
  it("shows the card totals, links each equipment and filters live from the status tiles", async () => {
    render(
      <MemoryRouter>
        <EquipmentOverview />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Dashboard card: 63/68 operational")).toBeTruthy();
    expect(lastParams(state.api.getAdminEquipmentInsights)).toMatchObject({ with_options: true, page: 1, page_size: 25 });
    const table = screen.getByRole("region", { name: "Equipment" });
    expect(within(table).getByRole("link", { name: "FE-SEM" }).getAttribute("href")).toBe("/equipment/3");
    expect(within(table).getByText("50.0%")).toBeTruthy();
    expect(within(table).getByText("2 d 1 h down")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Under maintenance/ }));
    await waitFor(() =>
      expect(lastParams(state.api.getAdminEquipmentInsights)).toMatchObject({ status: "under_maintenance", page: 1 }),
    );
    expect(lastParams(state.api.getAdminEquipmentInsights).with_options).toBeUndefined();
  });

  it("applies the search after typing stops, without an Apply button", async () => {
    render(
      <MemoryRouter>
        <EquipmentOverview />
      </MemoryRouter>,
    );
    await screen.findByText("Dashboard card: 63/68 operational");
    expect(screen.queryByRole("button", { name: /Apply/ })).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: "Search equipment" }), { target: { value: "sem " } });
    await waitFor(() => expect(lastParams(state.api.getAdminEquipmentInsights)).toMatchObject({ search: "sem" }));
  });
});

describe("UsersOverview", () => {
  it("opens on active users with the definition shown and links wallets", async () => {
    render(
      <MemoryRouter>
        <UsersOverview />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Dashboard card: 340 active")).toBeTruthy();
    expect(screen.getByText(/Account enabled \(can sign in\)\./)).toBeTruthy();
    expect(lastParams(state.api.getAdminUserInsights)).toMatchObject({ status: "active", sort: "-joined", trend: "month" });
    const table = screen.getByRole("region", { name: "Users" });
    expect(within(table).getByRole("link", { name: /Supervisor's/ }).getAttribute("href")).toBe("/admin/wallet-ledger/12");
    expect(within(table).getByText("PhD / research")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^Active/ }));
    await waitFor(() => expect(lastParams(state.api.getAdminUserInsights)).toMatchObject({ status: "all" }));
    fireEvent.click(screen.getByRole("button", { name: "Weekly" }));
    await waitFor(() => expect(lastParams(state.api.getAdminUserInsights)).toMatchObject({ trend: "week" }));
  });
});

describe("CancellationsDashboard", () => {
  it("shows the rate and trend, links the booking and flags reconstructed records", async () => {
    render(
      <MemoryRouter>
        <CancellationsDashboard />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/of 160 bookings made · previously 3\.3%/)).toBeTruthy();
    expect(screen.getByText(/▲ 3 vs previous period \(\+60%\)/)).toBeTruthy();
    expect(screen.getByText(/rebuilt from booking history/)).toBeTruthy();
    const table = screen.getByRole("region", { name: "Cancellations" });
    expect(within(table).getByRole("link", { name: "IIC-0555" })).toBeTruthy();
    expect(within(table).getByRole("link", { name: "FE-SEM" }).getAttribute("href")).toBe("/equipment/3");
    expect(within(table).getByText("Not known")).toBeTruthy();
    expect(within(table).getByText("Late")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Late \(under 24 h\)/ }));
    await waitFor(() => expect(lastParams(state.api.getAdminCancellationInsights)).toMatchObject({ late_only: true }));
    fireEvent.click(screen.getByRole("button", { name: /FE-SEM \(SEM1\)/ }));
    await waitFor(() => expect(lastParams(state.api.getAdminCancellationInsights)).toMatchObject({ equipment: "3" }));
  });

  it("shows the error with a retry", async () => {
    state.api.getAdminCancellationInsights.mockResolvedValueOnce({ error: "Only the Main Administrator can view this." });
    render(
      <MemoryRouter>
        <CancellationsDashboard />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Only the Main Administrator can view this.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("link", { name: "IIC-0555" })).toBeTruthy();
  });
});

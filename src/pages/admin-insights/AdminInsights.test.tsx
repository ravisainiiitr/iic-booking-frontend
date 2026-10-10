// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type {
  CancellationInsights,
  EquipmentInsights,
  RefundRequestInsights,
  StaffProficiency,
  StaffProficiencyRow,
  UserCard,
  UserInsights,
  WalletBookings,
} from "@/lib/adminInsights";

const state = vi.hoisted(() => ({
  api: {
    getAdminEquipmentInsights: vi.fn(),
    getAdminUserInsights: vi.fn(),
    getAdminCancellationInsights: vi.fn(),
    getAdminRefundRequestInsights: vi.fn(),
    getAdminUserCard: vi.fn(),
    getAdminWalletBookings: vi.fn(),
    getAdminStaffProficiency: vi.fn(),
  },
  exportParams: null as Record<string, unknown> | null,
}));

vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: state.api }));
vi.mock("@/components/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/components/ExportMenu", () => ({
  ExportMenu: ({ report, getParams }: { report: string; getParams?: () => Record<string, unknown> }) => (
    <button type="button" onClick={() => (state.exportParams = getParams?.() ?? null)}>
      Export {report}
    </button>
  ),
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
    by_oic: [{ key: "9", label: "Dr. OIC", count: 12 }],
    by_profile_type: [{ key: "TIME", label: "Time based", count: 68 }],
    upcoming_bookings: 31,
    utilisation: 0.4234,
    utilisation_days: 30,
    utilisation_formula: "Booked hours ÷ available hours.",
    utilisation_period_note: "Counted from 01-10-2026.",
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
      supervisor: {
        id: 12,
        name: "Prof. Mehta",
        email: "mehta@example.com",
        department: "Physics",
        source: "wallet",
        source_display: "Linked to the supervisor's wallet",
        pending: false,
      },
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

const refundUser = {
  id: 41,
  name: "Asha Rao",
  email: "asha@example.com",
  category: "iitr_student",
  category_display: "IITR Students",
  department: "Physics",
};

const refundData: RefundRequestInsights = {
  ...page,
  date_from: "2026-09-11",
  date_to: "2026-10-10",
  default_window_hours: 48,
  repeat_min: 2,
  summary: {
    total: 9,
    bookings_created: 363,
    rate: 0.0248,
    within_window: 9,
    unique_users: 6,
    unique_users_within_window: 6,
    repeat_refunders: 1,
    refund_total: 7441,
    by_source: [
      { key: "self_service", label: "Cancelled by the user", count: 9 },
      { key: "request", label: "Request for admin approval", count: 0 },
      { key: "partial", label: "Partial (some slots)", count: 0 },
    ],
    by_status: [{ key: "refunded", label: "Refunded", count: 9 }],
    by_window: [
      { key: "within", label: "Within the window", count: 9 },
      { key: "outside", label: "Inside the cut-off", count: 0 },
    ],
    by_equipment: [{ id: 3, label: "FE-SEM", code: "SEM1", count: 4 }],
    repeaters: [
      { user: refundUser, count: 3, within_window: 3, bookings: 3, refund_total: 2400, last_requested_at: "2026-10-08T10:00:00+05:30" },
    ],
    previous: { date_from: "2026-08-12", date_to: "2026-09-10", total: 0, unique_users: 0 },
    change: 9,
  },
  results: [
    {
      id: "c7",
      source: "self_service",
      source_display: "Cancelled by the user",
      booking: { pk: 777, display_id: "IIC-0777", status: "REFUNDED", status_display: "Refunded" },
      user: refundUser,
      equipment: { id: 3, name: "FE-SEM", code: "SEM1" },
      requested_at: "2026-10-08T10:00:00+05:30",
      slot_start: "2026-10-12T10:00:00+05:30",
      lead_minutes: 5760,
      window_hours: 48,
      within_window: true,
      status: "refunded",
      status_display: "Refunded",
      responded_at: null,
      refund: 800,
      wallet_transaction: { id: 9001, amount: 800, created_at: "2026-10-08T10:00:01+05:30", description: "Refund", wallet_owner_id: 12 },
      note: "",
    },
  ],
  options: {
    equipment: [{ id: 3, name: "FE-SEM", code: "SEM1" }],
    categories: [{ value: "iitr_student", label: "IITR Students" }],
    departments: [{ id: 2, name: "Physics" }],
    sources: [{ value: "self_service", label: "Cancelled by the user" }],
    statuses: [{ value: "refunded", label: "Refunded" }],
    windows: [{ value: "within", label: "Within the window" }],
  },
};

const booking = (pk: number, user: { id: number; name: string }) => ({
  pk,
  display_id: `IIC-${pk}`,
  equipment: { id: 3, name: "FE-SEM", code: "SEM1" },
  user,
  slot_start: "2026-10-12T10:00:00+05:30",
  status: "BOOKED",
  status_display: "Booked",
  charge: 500,
  created_at: "2026-10-05T10:00:00+05:30",
});

const cardFor = (id: number, name: string, extra: Partial<UserCard> = {}): UserCard => ({
  profile: {
    id,
    name,
    email: `${name.split(" ")[0].toLowerCase()}@example.com`,
    phone: "9876543210",
    profile_picture_url: null,
    user_type_display: "IITR Student",
    category: "iitr_student",
    category_display: "IITR Students",
    programme_display: "PhD / research",
    employee_id: "21PH001",
    designation: "",
    degree_name: "Ph.D.",
    department: { id: 2, name: "Physics", type: "INTERNAL" },
    supervisor: null,
    is_active: true,
    is_test_account: false,
    date_joined: "2026-01-05T10:00:00+05:30",
    last_login: "2026-10-09T10:00:00+05:30",
  },
  wallet: null,
  linked_wallet: null,
  certifications: [],
  bookings: { total: 1, charged: 500, cancelled: 0, recent: [booking(901, { id, name })] },
  ...extra,
});

const studentCard = cardFor(41, "Asha Rao", {
  wallet: { owner_id: 12, is_owner: false, balance: 1500 },
  certifications: [
    { id: 1, equipment: "FE-SEM", level: "Independent user", status: "ACTIVE", status_display: "Active", awarded_at: null, valid_until: null, certificate_no: "" },
  ],
});
studentCard.profile.supervisor = {
  id: 12,
  name: "Prof. Mehta",
  email: "mehta@example.com",
  department: "Physics",
  source: "wallet",
  source_display: "Linked to the supervisor's wallet",
  pending: false,
};
const supervisorCard = cardFor(12, "Prof. Mehta", { linked_wallet: { owner_id: 12, linked_users: 2 } });

const walletBookings: WalletBookings = {
  owner: { id: 12, name: "Prof. Mehta" },
  summary: {
    linked_users: 2,
    bookings: 2,
    charged: 1000,
    cancelled: 0,
    by_member: [
      { id: 12, name: "Prof. Mehta", email: "mehta@example.com", is_owner: true, bookings: 1, charged: 500, cancelled: 0 },
      { id: 41, name: "Asha Rao", email: "asha@example.com", is_owner: false, bookings: 1, charged: 500, cancelled: 0 },
    ],
  },
  results: [booking(902, { id: 12, name: "Prof. Mehta" }), booking(901, { id: 41, name: "Asha Rao" })],
  count: 2,
  page: 1,
  page_size: 10,
  total_pages: 1,
  options: {
    members: [
      { id: 12, name: "Prof. Mehta", email: "mehta@example.com", is_owner: true },
      { id: 41, name: "Asha Rao", email: "asha@example.com", is_owner: false },
    ],
    equipment: [{ id: 3, name: "FE-SEM", code: "SEM1" }],
    statuses: [{ value: "BOOKED", label: "Booked" }],
  },
};

const staffRow = (over: Partial<StaffProficiencyRow>): StaffProficiencyRow => ({
  id: 1,
  name: "",
  role: "operator",
  equipment: [{ id: 3, name: "FE-SEM", code: "SEM1" }],
  pending: 0,
  overdue: 0,
  pending_by_kind: [],
  handled: 0,
  avg_response_hours: null,
  score: null,
  rank: null,
  ...over,
});

const proficiencyData: StaffProficiency = {
  scope: "institute",
  department: null,
  generated_at: "2026-10-10T10:00:00Z",
  date_from: "2026-09-11",
  date_to: "2026-10-10",
  days: 30,
  sort: "proficiency",
  formula: "Handled ÷ (handled + pending + overdue) × 100.",
  decision_overdue_hours: 48,
  operators: [
    staffRow({ id: 21, name: "Quick Operator", handled: 9, pending: 1, avg_response_hours: 2, score: 90, rank: 1 }),
    staffRow({ id: 22, name: "Busy Operator", handled: 2, pending: 4, overdue: 2, avg_response_hours: 30, score: 25, rank: 2 }),
    staffRow({ id: 23, name: "Idle Operator" }),
  ],
  oics: [staffRow({ id: 9, name: "Dr. OIC", role: "oic", handled: 3, pending: 1, score: 75, rank: 1 })],
};

const personPending: NonNullable<StaffProficiency["person"]> = {
  id: 22,
  name: "Busy Operator",
  role: "operator",
  pending: [
    {
      key: "completion:501",
      kind: "completion",
      kind_display: "Completion",
      equipment_id: 3,
      equipment_name: "FE-SEM",
      equipment_code: "SEM1",
      booking_pk: 501,
      booking_ref: "BK-0501",
      link: "/booking-management?expand=501",
      user_name: "Asha Rao",
      since: "2026-10-07T10:00:00+05:30",
      waiting_hours: 72,
      overdue: true,
    },
  ],
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
  state.api.getAdminRefundRequestInsights.mockResolvedValue({ data: refundData });
  state.api.getAdminUserCard.mockImplementation(async (id: number) => ({ data: id === 12 ? supervisorCard : studentCard }));
  state.api.getAdminWalletBookings.mockResolvedValue({ data: walletBookings });
  state.api.getAdminStaffProficiency.mockImplementation(async (p: { person?: number }) => ({
    data: p.person ? { ...proficiencyData, person: personPending } : proficiencyData,
  }));
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

  it("leaves profile type out until it is included, in the page and the export", async () => {
    render(
      <MemoryRouter>
        <EquipmentOverview />
      </MemoryRouter>,
    );
    await screen.findByText("Dashboard card: 63/68 operational");
    expect(screen.queryByText("By profile type")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Export admin-equipment-overview" }));
    expect(state.exportParams).not.toHaveProperty("include_profile_type");

    fireEvent.click(screen.getByRole("checkbox", { name: "Include profile type" }));
    expect(await screen.findByText("By profile type")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Export admin-equipment-overview" }));
    expect(state.exportParams).toMatchObject({ include_profile_type: "1" });
  });

  it("shows modes as counted on the parent instrument", async () => {
    state.api.getAdminEquipmentInsights.mockResolvedValue({
      data: {
        ...equipmentData,
        results: [{ ...equipmentData.results[0], utilisation: null, utilisation_counted_under: 1 }],
      },
    });
    render(
      <MemoryRouter>
        <EquipmentOverview />
      </MemoryRouter>,
    );
    const table = await screen.findByRole("region", { name: "Equipment" });
    expect(await within(table).findByText("Counted on parent")).toBeTruthy();
  });

  it("explains the utilisation figure", async () => {
    render(
      <MemoryRouter>
        <EquipmentOverview />
      </MemoryRouter>,
    );
    await screen.findByText("Dashboard card: 63/68 operational");
    expect(screen.getByText(/Booked hours ÷ available hours\./)).toBeTruthy();
    expect(screen.getByText(/40 of 80 h/)).toBeTruthy();
  });

  it("keeps the department picked in the URL for every panel", async () => {
    state.api.getAdminEquipmentInsights.mockResolvedValue({
      data: {
        ...equipmentData,
        departments: [
          { id: 2, name: "Physics", code: "PHY", owns_equipment: true },
          { id: 4, name: "Humanities", code: "HSS", owns_equipment: false },
        ],
        selected_department_id: 2,
        department: { id: 2, name: "Physics" },
      },
    });
    render(
      <MemoryRouter initialEntries={["/admin/insights/equipment?dept=2"]}>
        <EquipmentOverview />
      </MemoryRouter>,
    );
    await screen.findByText("Dashboard card: 63/68 operational");
    expect(lastParams(state.api.getAdminEquipmentInsights)).toMatchObject({ dept: "2" });
    await waitFor(() => expect(lastParams(state.api.getAdminStaffProficiency)).toMatchObject({ dept: "2" }));
    expect(screen.getByText("Department")).toBeTruthy();
  });
});

describe("StaffProficiencyPanels", () => {
  it("ranks Lab Operators and Officers in Charge and lists a person's pending bookings", async () => {
    render(
      <MemoryRouter>
        <EquipmentOverview />
      </MemoryRouter>,
    );
    const operators = await screen.findByRole("region", { name: "Lab Operators" });
    await within(operators).findByRole("button", { name: "Quick Operator" });
    const names = within(operators)
      .getAllByRole("button")
      .map((b) => b.textContent);
    expect(names).toEqual(["Quick Operator", "Busy Operator", "Idle Operator"]);
    expect(within(operators).getByText("2 overdue")).toBeTruthy();
    expect(within(operators).getByText("No work in period")).toBeTruthy();
    const oics = screen.getByRole("region", { name: "Officers in Charge" });
    expect(within(oics).getByRole("button", { name: "Dr. OIC" })).toBeTruthy();
    expect(lastParams(state.api.getAdminStaffProficiency)).toMatchObject({ sort: "proficiency", days: "30" });

    fireEvent.click(screen.getByRole("radio", { name: "Fewest pending" }));
    await waitFor(() => expect(lastParams(state.api.getAdminStaffProficiency)).toMatchObject({ sort: "pending" }));

    fireEvent.click(within(operators).getByRole("button", { name: "Busy Operator" }));
    const dialog = await screen.findByRole("dialog");
    const link = await within(dialog).findByRole("link", { name: "BK-0501" });
    expect(link.getAttribute("href")).toBe("/booking-management?expand=501");
    expect(within(dialog).getByText("Overdue")).toBeTruthy();
    expect(lastParams(state.api.getAdminStaffProficiency)).toMatchObject({ person: 22, role: "operator" });
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
    expect(within(table).getByRole("button", { name: "Prof. Mehta" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^Active/ }));
    await waitFor(() => expect(lastParams(state.api.getAdminUserInsights)).toMatchObject({ status: "all" }));
    fireEvent.click(screen.getByRole("button", { name: "Weekly" }));
    await waitFor(() => expect(lastParams(state.api.getAdminUserInsights)).toMatchObject({ trend: "week" }));
  });

  it("opens the user card from the name, then the supervisor's card with bookings by linked users", async () => {
    render(
      <MemoryRouter>
        <UsersOverview />
      </MemoryRouter>,
    );
    const table = await screen.findByRole("region", { name: "Users" });
    fireEvent.click(within(table).getByRole("button", { name: "Asha Rao" }));

    const drawer = await screen.findByRole("dialog");
    expect(await within(drawer).findByText("ID: 21PH001")).toBeTruthy();
    expect(state.api.getAdminUserCard).toHaveBeenLastCalledWith(41);
    expect(within(drawer).getByRole("img", { name: "No photo for Asha Rao" })).toBeTruthy();
    expect(within(drawer).getByText("FE-SEM · Independent user")).toBeTruthy();
    expect(within(drawer).getByRole("link", { name: /Supervisor's wallet/ }).getAttribute("href")).toBe("/admin/wallet-ledger/12");
    expect(within(drawer).getByRole("link", { name: "IIC-901" })).toBeTruthy();
    expect(within(drawer).getByRole("link", { name: "View all bookings" }).getAttribute("href")).toBe(
      "/booking-management?search=asha%40example.com&status=all",
    );
    expect(within(drawer).queryByRole("region", { name: "Bookings by linked users" })).toBeNull();

    fireEvent.click(within(drawer).getByRole("button", { name: "Prof. Mehta" }));
    expect(await within(drawer).findByRole("region", { name: "Totals per linked user" })).toBeTruthy();
    expect(state.api.getAdminWalletBookings).toHaveBeenLastCalledWith(12, expect.objectContaining({ with_options: true }));
    const linked = within(drawer).getByRole("region", { name: "Linked users' bookings" });
    expect(within(linked).getByRole("link", { name: "IIC-902" })).toBeTruthy();

    fireEvent.click(within(drawer).getByText("(wallet owner)", { selector: "span" }));
    await waitFor(() =>
      expect(state.api.getAdminWalletBookings.mock.calls.at(-1)?.[1]).toMatchObject({ member: "12", page: 1 }),
    );

    fireEvent.click(within(drawer).getByRole("button", { name: "Back" }));
    expect(await within(drawer).findByText("ID: 21PH001")).toBeTruthy();
  });

  it("shows the supervisor's department and email, a pending supervisor, and Not linked", async () => {
    const pendingCard = cardFor(43, "Ravi Kumar");
    pendingCard.profile.supervisor = {
      id: null,
      name: "Dr. Guide",
      email: "guide@iitr.ac.in",
      department: "Chemistry Department",
      source: "pending_invite",
      source_display: "Supervisor invited by email — not on the portal yet",
      pending: true,
    };
    const cards: Record<number, UserCard> = { 41: studentCard, 43: pendingCard, 44: cardFor(44, "Astitva Dubey") };
    state.api.getAdminUserCard.mockImplementation(async (id: number) => ({ data: cards[id] }));
    const rows = [41, 43, 44].map((id) => ({ ...userData.results[0], id, name: cards[id].profile.name, supervisor: null }));
    state.api.getAdminUserInsights.mockResolvedValue({ data: { ...userData, results: rows } });
    render(
      <MemoryRouter>
        <UsersOverview />
      </MemoryRouter>,
    );
    const table = await screen.findByRole("region", { name: "Users" });
    expect(within(table).getAllByText("Not linked")).toHaveLength(3);

    fireEvent.click(within(table).getByRole("button", { name: "Asha Rao" }));
    let drawer = await screen.findByRole("dialog");
    let sup = await within(drawer).findByTestId("card-supervisor");
    expect(within(sup).getByRole("button", { name: "Prof. Mehta" })).toBeTruthy();
    expect(within(sup).getByText("Physics")).toBeTruthy();
    expect(within(sup).getByRole("link", { name: "mehta@example.com" })).toBeTruthy();
    expect(within(sup).queryByText("Pending confirmation")).toBeNull();
    cleanup();

    render(
      <MemoryRouter initialEntries={["/admin/insights/users?user=43"]}>
        <UsersOverview />
      </MemoryRouter>,
    );
    drawer = await screen.findByRole("dialog");
    sup = await within(drawer).findByTestId("card-supervisor");
    expect(within(sup).getByText("Dr. Guide")).toBeTruthy();
    expect(within(sup).queryByRole("button")).toBeNull();
    expect(within(sup).getByText("Pending confirmation")).toBeTruthy();
    expect(within(sup).getByText("Chemistry Department")).toBeTruthy();
    cleanup();

    render(
      <MemoryRouter initialEntries={["/admin/insights/users?user=44"]}>
        <UsersOverview />
      </MemoryRouter>,
    );
    drawer = await screen.findByRole("dialog");
    expect(await within(drawer).findByText("Not linked")).toBeTruthy();
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

  it("lists refund requests with the window, wallet credit and repeat refunders", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/insights/cancellations?view=refunds"]}>
        <CancellationsDashboard />
      </MemoryRouter>,
    );
    const table = await screen.findByRole("region", { name: "Refund requests" });
    expect(within(table).getByRole("link", { name: "IIC-0777" })).toBeTruthy();
    expect(within(table).getByText("Yes (48 h)")).toBeTruthy();
    expect(within(table).getByRole("link", { name: "Credit #9001" }).getAttribute("href")).toBe("/admin/wallet-ledger/12");
    expect(screen.getByText("2.5%")).toBeTruthy();
    expect(lastParams(state.api.getAdminRefundRequestInsights)).toMatchObject({ with_options: true, sort: "-requested_at" });

    fireEvent.click(screen.getByRole("button", { name: /Asha Rao.*3 requests/ }));
    await waitFor(() => expect(lastParams(state.api.getAdminRefundRequestInsights)).toMatchObject({ user: "41", page: 1 }));
    fireEvent.click(screen.getByRole("button", { name: /Booked, then refunded in the window/ }));
    await waitFor(() => expect(lastParams(state.api.getAdminRefundRequestInsights)).toMatchObject({ window: "within" }));

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Cancellations" }));
    expect(await screen.findByRole("region", { name: "Cancellations" })).toBeTruthy();
  });
});

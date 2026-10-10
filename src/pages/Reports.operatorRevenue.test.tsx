// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const getCurrentUser = vi.fn();
const getBookingStats = vi.fn();
const getEquipmentReportData = vi.fn();
const getBookings = vi.fn();

vi.mock("@/lib/api", () => ({
  apiClient: {
    getToken: () => "token",
    getCurrentUser: (...args: unknown[]) => getCurrentUser(...args),
    isAdminPanelUser: () => false,
    checkAdminRole: async () => ({ data: { is_admin: false } }),
    getBookingStats: (...args: unknown[]) => getBookingStats(...args),
    getBookings: (...args: unknown[]) => getBookings(...args),
    adminList: async () => ({ data: [{ equipment_id: 7, name: "Gamma SEM", code: "SEM1" }] }),
    getEquipmentReportData: (...args: unknown[]) => getEquipmentReportData(...args),
    getEquipments: async () => ({ data: { equipments: [] } }),
    getFacultyWalletExpenseReport: async () => ({ data: null }),
    downloadReportExport: vi.fn(),
  },
}));
vi.mock("@/components/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/pages/FinanceReports", () => ({ default: () => null }));

import Reports from "./Reports";
import ReportBookingsList from "./ReportBookingsList";

const summary = {
  total_equipment: 1,
  total_hours: 10,
  utilized_hours: 4,
  downtime_hours: 1,
  utilization_factor: 0.4,
  available_hours_working_window: 8,
  completed_hours_in_working_window: 3,
  utilization_vs_working_capacity: 0.375,
};

const equipmentReport = (withRevenue: boolean) => ({
  data: {
    date_from: "2026-10-01",
    date_to: "2026-10-31",
    equipment: [],
    utilization_pie: [{ name: "No slot data", value: 0, hours: 0 }],
    revenue_visible: withRevenue,
    summary: withRevenue
      ? { ...summary, revenue_total: 250, revenue_internal: 250, revenue_external: 0 }
      : summary,
    ...(withRevenue
      ? {
          financial: {
            revenue_by_user_type: [{ user_type_snapshot: "student", total: 250, count: 1 }],
            revenue_by_department: [],
            revenue_by_equipment: [],
            revenue_by_external_category: [],
          },
        }
      : {}),
  },
});

const stats = (withMoney: boolean) => ({
  data: {
    total_bookings: 2,
    status_counts: { COMPLETED: 1, BOOKED: 1 },
    charged_bookings: 2,
    total_hours: 2,
    scope: "equipment",
    revenue_visible: withMoney,
    ...(withMoney ? { total_spent: 400, average_cost: 200, refunded_amount: 0 } : {}),
  },
});

const booking = {
  booking_id: "B-1",
  equipment_name: "Gamma SEM",
  equipment_code: "SEM1",
  start_time: "2026-10-05T10:00:00+05:30",
  end_time: "2026-10-05T11:00:00+05:30",
  total_hours: 1,
  total_charge: "250.00",
  status: "COMPLETED",
  status_display: "Completed",
  created_at: "2026-10-01T10:00:00+05:30",
};

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  getBookings.mockResolvedValue({ data: { bookings: [booking], total_count: 1 } });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("Reports & Statistics revenue visibility", () => {
  it("shows Lab Operators usage cards but no revenue", async () => {
    getCurrentUser.mockResolvedValue({ data: { id: 5, user_type: "operator", rbac_permissions: ["reports.view"] } });
    getEquipmentReportData.mockResolvedValue(equipmentReport(false));
    render(
      <MemoryRouter>
        <Reports />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Utilization factor")).toBeTruthy();
    expect(screen.getByText("Utilization vs capacity")).toBeTruthy();
    expect(screen.queryByText(/Revenue/)).toBeNull();
    expect(document.body.textContent).not.toContain("₹");
    expect(getBookingStats).not.toHaveBeenCalled();
  });

  it("keeps revenue for an Officer in charge", async () => {
    getCurrentUser.mockResolvedValue({ data: { id: 6, user_type: "manager", rbac_permissions: ["reports.view"] } });
    getBookingStats.mockResolvedValue(stats(true));
    getEquipmentReportData.mockResolvedValue(equipmentReport(true));
    render(
      <MemoryRouter>
        <Reports />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Revenue (total)")).toBeTruthy();
    expect(screen.getByText("Revenue by user type")).toBeTruthy();
  });
});

describe("Reports utilization factor", () => {
  const renderWith = async (overrides: Record<string, unknown>) => {
    getCurrentUser.mockResolvedValue({ data: { id: 5, user_type: "operator", rbac_permissions: ["reports.view"] } });
    const report = equipmentReport(false);
    getEquipmentReportData.mockResolvedValue({ data: { ...report.data, summary: { ...summary, ...overrides } } });
    render(
      <MemoryRouter>
        <Reports />
      </MemoryRouter>,
    );
    await screen.findByText("Utilization factor");
  };

  it("explains the weekly view window formula", async () => {
    await renderWith({ utilization_booked_hours: 4, utilization_available_hours: 10 });
    expect(
      screen.getByText("Booked hours ÷ available hours within weekly view window, excluding weekends and holidays"),
    ).toBeTruthy();
    expect(screen.getByText("40.00%")).toBeTruthy();
    expect(screen.getByLabelText("How the utilization factor is calculated")).toBeTruthy();
  });

  it("shows N/A when there are no available hours", async () => {
    await renderWith({ utilization_factor: null });
    expect(screen.getByText("N/A")).toBeTruthy();
  });
});

describe("Reports booking details revenue visibility", () => {
  it("hides the amount card and column when money is not visible", async () => {
    getBookingStats.mockResolvedValue(stats(false));
    render(
      <MemoryRouter>
        <ReportBookingsList />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Gamma SEM")).toBeTruthy();
    expect(screen.getByText("Total Hours")).toBeTruthy();
    expect(screen.queryByText("Amount (₹)")).toBeNull();
    expect(screen.queryByText(/Total Amount/)).toBeNull();
    expect(document.body.textContent).not.toContain("₹");
  });

  it("shows amounts when money is visible", async () => {
    getBookingStats.mockResolvedValue(stats(true));
    render(
      <MemoryRouter>
        <ReportBookingsList />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Gamma SEM")).toBeTruthy();
    expect(screen.getByText("Amount (₹)")).toBeTruthy();
    expect(screen.getByText("Total Amount Charged")).toBeTruthy();
  });
});

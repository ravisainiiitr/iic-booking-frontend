// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const getReportDrilldownUsers = vi.fn();
const getReportDrilldownBookings = vi.fn();

vi.mock("@/lib/api", () => ({
  apiClient: {
    getReportDrilldownUsers: (...args: unknown[]) => getReportDrilldownUsers(...args),
    getReportDrilldownBookings: (...args: unknown[]) => getReportDrilldownBookings(...args),
    downloadReportExport: vi.fn(),
  },
}));
vi.mock("@/components/DashboardHeader", () => ({ default: () => null }));

import ReportDrilldown from "./ReportDrilldown";

const header = {
  source: "performance",
  report_title: "Equipment Performance Report",
  date_from: "2026-01-01",
  date_to: "2026-10-11",
  period_display: "01 Jan 2026 – 11 Oct 2026",
  revenue_definition: "Completed bookings with a slot in the period.",
  revenue_visible: true,
  segment: {
    dimension: "category",
    dimension_label: "User category",
    value: "iitr_student",
    label: "IITR Students",
    bookings: 3,
    users: 2,
    revenue: 225.5,
  },
};

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/reports/drilldown" element={<ReportDrilldown />} />
      </Routes>
    </MemoryRouter>,
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Reports drill-down", () => {
  it("lists the users of a report row with links to their bookings", async () => {
    getReportDrilldownUsers.mockResolvedValue({
      data: {
        ...header,
        users: [
          { user_id: 11, name: "Asha Rao", email: "asha@iitr.ac.in", category: "iitr_student",
            category_label: "IITR Students", department: "Physics", bookings: 2, revenue: 150 },
          { user_id: 12, name: "Ravi Kumar", email: "ravi@iitr.ac.in", category: "iitr_student",
            category_label: "IITR Students", department: "Chemistry", bookings: 1, revenue: 75.5 },
        ],
        count: 2,
      },
    });
    renderAt("/reports/drilldown?src=performance&dim=category&val=iitr_student&from=2026-01-01&to=2026-10-11&eq=all");
    expect(await screen.findByText("Asha Rao")).toBeTruthy();
    expect(getReportDrilldownUsers).toHaveBeenCalledWith("performance", expect.objectContaining({
      dimension: "category", value: "iitr_student", date_from: "2026-01-01", date_to: "2026-10-11",
    }));
    expect(screen.getAllByText("IITR Students").length).toBeGreaterThan(0);
    expect(document.body.textContent).toContain("₹150.00");
    const links = screen.getAllByRole("link", { name: /Bookings/ });
    expect(links[0].getAttribute("href")).toContain("user=11");
    expect(links[0].getAttribute("href")).toContain("dim=category");
    const back = screen.getByRole("link", { name: "Reports & Statistics" });
    expect(back.getAttribute("href")).toBe("/reports?from=2026-01-01&to=2026-10-11&eq=all");
  });

  it("shows one user's bookings with links to each booking and equipment", async () => {
    getReportDrilldownBookings.mockResolvedValue({
      data: {
        ...header,
        user: { user_id: 11, name: "Asha Rao", email: "asha@iitr.ac.in", category_label: "IITR Students",
                department: "Physics", bookings: 1, revenue: 100 },
        bookings: [
          { pk: 501, display_id: "IICXPS0001", equipment: { id: 7, name: "Alpha XPS", code: "XPS1" },
            user: { id: 11, name: "Asha Rao", email: "asha@iitr.ac.in" }, category_label: "IITR Students",
            department: "Physics", slot_start: "2026-10-05T10:00:00+05:30", slot_end: "2026-10-05T11:00:00+05:30",
            completed_at: null, hours: 1, status: "COMPLETED", status_display: "Completed", charge: 100 },
        ],
        count: 1,
        truncated: false,
      },
    });
    renderAt("/reports/drilldown?src=performance&dim=category&val=iitr_student&user=11");
    expect(await screen.findByText("IICXPS0001")).toBeTruthy();
    expect(getReportDrilldownBookings).toHaveBeenCalledWith("performance", expect.objectContaining({ user: 11 }));
    expect(screen.getByRole("link", { name: "IICXPS0001" }).getAttribute("href")).toContain("IICXPS0001");
    expect(screen.getByRole("link", { name: "Alpha XPS" }).getAttribute("href")).toBe("/equipment/7");
    expect(screen.getByRole("link", { name: "IITR Students" }).getAttribute("href")).not.toContain("user=");
  });

  it("hides money when the viewer may not see revenue", async () => {
    getReportDrilldownUsers.mockResolvedValue({
      data: {
        ...header,
        revenue_visible: false,
        segment: { ...header.segment, revenue: undefined },
        users: [{ user_id: 11, name: "Asha Rao", email: "a@x", category: "iitr_student",
                  category_label: "IITR Students", department: "", bookings: 2 }],
        count: 1,
      },
    });
    renderAt("/reports/drilldown?src=performance&dim=all");
    expect(await screen.findByText("Asha Rao")).toBeTruthy();
    expect(document.body.textContent).not.toContain("₹");
  });
});

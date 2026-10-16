// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const api = vi.hoisted(() => ({ getMaintenanceStatus: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiClient: api }));

import MaintenanceBanner, { maintenanceBannerText } from "./MaintenanceBanner";

const period = {
  period_id: 3,
  equipment_id: 4,
  equipment_code: "XPS",
  equipment_name: "X-Ray Photoelectron Spectroscopy",
  since: "2026-10-13T07:09:00Z",
  since_display: "Tue 13 Oct 2026, 12:39 PM",
  last_checked_on: "2026-10-16",
  bookings_affected: 3,
  bookings_on_hold: 3,
  users_notified: 1,
  results_paused: 23,
  adopted: false,
};

const renderBanner = () =>
  render(
    <MemoryRouter>
      <MaintenanceBanner />
    </MemoryRouter>,
  );

afterEach(() => cleanup());

describe("MaintenanceBanner", () => {
  it("summarises each equipment under maintenance", async () => {
    api.getMaintenanceStatus.mockResolvedValue({ data: { periods: [period] } });
    renderBanner();
    const row = await screen.findByTestId("maintenance-banner-row");
    expect(row.textContent).toContain(
      "Under maintenance since Tue 13 Oct 2026, 12:39 PM — 3 bookings affected, 1 user notified, results-overdue paused for 23 bookings",
    );
  });

  it("uses singular wording for one booking", () => {
    expect(maintenanceBannerText({ ...period, bookings_affected: 1, users_notified: 2, results_paused: 1 })).toBe(
      "Under maintenance since Tue 13 Oct 2026, 12:39 PM — 1 booking affected, 2 users notified, results-overdue paused for 1 booking",
    );
  });

  it("renders nothing when no equipment is under maintenance", async () => {
    api.getMaintenanceStatus.mockResolvedValue({ data: { periods: [] } });
    const { container } = renderBanner();
    await Promise.resolve();
    expect(container.textContent).toBe("");
  });
});

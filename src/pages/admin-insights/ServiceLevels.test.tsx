// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ServiceLevels as ServiceLevelsData } from "@/lib/adminInsights";

const state = vi.hoisted(() => ({
  api: { getAdminServiceLevels: vi.fn() },
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

import ServiceLevels, { formatTurnaround } from "./ServiceLevels";

const figures = {
  bookings: 12,
  carried_out: 9,
  not_utilized: 1,
  no_show_rate: 0.1,
  cancelled: 2,
  cancellation_rate: 0.1667,
  lab_stopped: 0,
  lab_stopped_rate: 0,
  lead_days: 3,
  turnaround_hours: 20,
  results_timed: 7,
  results_awaited: 1,
  rating: 4.5,
  rated: 4,
};

const data: ServiceLevelsData = {
  scope: "institute",
  department: null,
  selected_department_id: null,
  departments: [],
  generated_at: "2026-11-06T10:00:00Z",
  date_from: "2026-10-08",
  date_to: "2026-11-06",
  previous_from: "2026-09-08",
  previous_to: "2026-10-07",
  utilisation_period_note: "",
  summary: {
    ...figures,
    utilisation: 0.42,
    instruments: 2,
    previous: { ...figures, bookings: 8, turnaround_hours: null, utilisation: 0.3 },
  },
  results: [
    { ...figures, equipment_id: 3, name: "FE-SEM", code: "SEM1", department: "Physics", utilisation: 0.5 },
    {
      ...figures,
      equipment_id: 4,
      name: "XRD",
      code: "",
      department: "",
      turnaround_hours: null,
      results_timed: 0,
      rating: null,
      rated: 0,
      utilisation: null,
    },
  ],
  count: 2,
  page: 1,
  page_size: 25,
  total_pages: 1,
  options: { equipment: [{ id: 3, name: "FE-SEM", code: "SEM1" }] },
};

function show() {
  render(
    <MemoryRouter>
      <ServiceLevels />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  state.exportParams = null;
  state.api.getAdminServiceLevels.mockReset();
  state.api.getAdminServiceLevels.mockResolvedValue({ data });
});

afterEach(cleanup);

describe("ServiceLevels", () => {
  it("shows each instrument's figures and links to its page", async () => {
    show();
    const link = await screen.findByRole("link", { name: "FE-SEM" });
    expect(link.getAttribute("href")).toBe("/equipment/3");
    expect(screen.getByText("7 timed")).toBeTruthy();
    expect(screen.getByText("4 rated")).toBeTruthy();
  });

  it("states the previous period's figure, or that there is none", async () => {
    show();
    expect(await screen.findByText("Previous period: 8")).toBeTruthy();
    expect(screen.getByText("No figure for the previous period")).toBeTruthy();
  });

  it("shows no figure, not zero, when no results were timed", async () => {
    show();
    await screen.findByRole("link", { name: "XRD" });
    expect(screen.queryByText("0 timed")).toBeNull();
    expect(screen.queryByText("0 h")).toBeNull();
  });

  it("sorts on the server, highest first, then the other way", async () => {
    show();
    await screen.findByRole("link", { name: "FE-SEM" });
    fireEvent.click(screen.getByRole("button", { name: /Turnaround/ }));
    await waitFor(() => {
      expect(state.api.getAdminServiceLevels.mock.lastCall?.[0].sort).toBe("-turnaround");
    });
    fireEvent.click(screen.getByRole("button", { name: /Turnaround/ }));
    await waitFor(() => {
      expect(state.api.getAdminServiceLevels.mock.lastCall?.[0].sort).toBe("turnaround");
    });
  });

  it("exports the dates on screen", async () => {
    show();
    await screen.findByRole("link", { name: "FE-SEM" });
    fireEvent.click(screen.getByRole("button", { name: "Export admin-service-levels" }));
    expect(state.exportParams).toMatchObject({ date_from: "2026-10-08", date_to: "2026-11-06" });
  });

  it("offers a retry when loading fails", async () => {
    state.api.getAdminServiceLevels.mockResolvedValue({ error: "Could not load." });
    show();
    expect(await screen.findByRole("button", { name: "Try again" })).toBeTruthy();
  });
});

describe("formatTurnaround", () => {
  it("uses hours below two days and days from there", () => {
    expect(formatTurnaround(null)).toBe("—");
    expect(formatTurnaround(0)).toBe("0 h");
    expect(formatTurnaround(20.5)).toBe("20.5 h");
    expect(formatTurnaround(72)).toBe("3 days");
  });
});

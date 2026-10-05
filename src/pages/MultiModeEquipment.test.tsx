// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const api = vi.hoisted(() => ({
  getOicMultiMode: vi.fn(),
  getMultiModeFamily: vi.fn(),
  saveMultiModeFamily: vi.fn(),
  createOicMultiModeSchedule: vi.fn(),
  updateOicMultiModeSchedule: vi.fn(),
  deleteOicMultiModeSchedule: vi.fn(),
}));

vi.mock("@/components/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: api }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import MultiModeEquipment from "./MultiModeEquipment";

const family = {
  parent_equipment_id: 10,
  parent_code: "XPS",
  parent_name: "X-ray Photoelectron Spectroscopy",
  department_id: 33,
  department_name: "IIC",
  children: [{ equipment_id: 11, code: "UPS", name: "UPS", mode_availability: "SCHEDULED_ONLY" }],
  schedules: [
    {
      id: 1,
      parent_equipment_id: 10,
      mode_equipment_id: 11,
      mode_equipment_code: "UPS",
      start_date: "2026-10-01",
      end_date: "2026-10-31",
      start_time: null,
      end_time: null,
      weekdays: [0],
      behavior: "EXCLUSIVE",
    },
  ],
};

const candidates = [
  { equipment_id: 11, code: "UPS", name: "UPS", is_mode: true, mode_availability: "SCHEDULED_ONLY" },
  { equipment_id: 12, code: "DP", name: "Depth Profile", is_mode: false, mode_availability: "ALWAYS" },
];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 5, 10, 0, 0));
  api.getOicMultiMode.mockResolvedValue({
    data: {
      scope: "oic",
      department_id: null,
      departments: [],
      families: [family],
      base_candidates: [{ equipment_id: 10, code: "XPS", name: "X-ray Photoelectron Spectroscopy" }],
    },
  });
  api.getMultiModeFamily.mockResolvedValue({ data: { family, candidates } });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <MultiModeEquipment />
    </MemoryRouter>,
  );

describe("MultiModeEquipment", () => {
  it("opens the first family and marks only the repeat weekdays on the calendar", async () => {
    renderPage();
    expect(await screen.findByText("Modes of XPS")).toBeTruthy();
    expect(api.getMultiModeFamily).toHaveBeenCalledWith(10);
    // Mondays in October 2026: 5, 12, 19 and 26.
    expect(screen.getAllByRole("button", { name: /1 schedule\(s\)/ })).toHaveLength(4);
    expect(screen.getByText(/Only this mode: the base instrument/)).toBeTruthy();
  });

  it("saves ticked modes with their availability", async () => {
    api.saveMultiModeFamily.mockResolvedValue({
      data: { family, candidates: candidates.map((c) => ({ ...c, is_mode: true })) },
    });
    renderPage();
    const dp = await screen.findByRole("checkbox", { name: /Depth Profile/ });
    fireEvent.click(dp);
    fireEvent.click(screen.getByRole("button", { name: "Save modes" }));
    await waitFor(() => expect(api.saveMultiModeFamily).toHaveBeenCalledTimes(1));
    expect(api.saveMultiModeFamily).toHaveBeenCalledWith(10, [
      { equipment_id: 11, mode_availability: "SCHEDULED_ONLY" },
      { equipment_id: 12, mode_availability: "ALWAYS" },
    ]);
  });

  it("shows why a mode in use cannot be removed", async () => {
    api.saveMultiModeFamily.mockResolvedValue({
      error: "Cannot remove a mode that is still in use. UPS has 1 current or future schedule(s): 2026-10-01 to 2026-10-31.",
      status: 409,
    });
    renderPage();
    fireEvent.click(await screen.findByRole("checkbox", { name: /UPS/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save modes" }));
    expect(await screen.findByText("Modes not saved")).toBeTruthy();
    expect(screen.getByText(/UPS has 1 current or future schedule/)).toBeTruthy();
  });
});

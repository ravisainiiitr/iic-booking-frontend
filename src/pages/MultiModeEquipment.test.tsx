// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const api = vi.hoisted(() => ({
  getOicMultiMode: vi.fn(),
  getMultiModeFamily: vi.fn(),
  createOicMultiModeSchedule: vi.fn(),
  updateOicMultiModeSchedule: vi.fn(),
  deleteOicMultiModeSchedule: vi.fn(),
  removeMultiModeMode: vi.fn(),
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
  children: [{ equipment_id: 11, code: "UPS", name: "UPS", mode_availability: "SCHEDULED_ONLY", current_schedule_count: 1 }],
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
  vi.restoreAllMocks();
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <MultiModeEquipment />
    </MemoryRouter>,
  );

describe("MultiModeEquipment", () => {
  it("has no separate modes section and marks only the repeat weekdays on the calendar", async () => {
    renderPage();
    expect(await screen.findByText("Mode calendar")).toBeTruthy();
    expect(screen.queryByText("Modes of XPS")).toBeNull();
    expect(screen.queryByText(/Only on scheduled days/)).toBeNull();
    expect(api.getMultiModeFamily).toHaveBeenCalledWith(10);
    // Mondays in October 2026: 5, 12, 19 and 26.
    expect(screen.getAllByRole("button", { name: /1 schedule\(s\)/ })).toHaveLength(4);
    expect(screen.getByText(/01-10-2026 to 31-10-2026/)).toBeTruthy();
  });

  it("sends blank dates as an always-available schedule", async () => {
    api.createOicMultiModeSchedule.mockResolvedValue({ data: { schedule: {}, mode_linked: false } });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Add schedule" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Leave both dates blank to make this mode always available/)).toBeTruthy();
    expect((within(dialog).getByLabelText("From date") as HTMLInputElement).placeholder).toBe("DD-MM-YYYY");
    fireEvent.click(within(dialog).getByRole("button", { name: "Add schedule" }));
    await waitFor(() => expect(api.createOicMultiModeSchedule).toHaveBeenCalledTimes(1));
    expect(api.createOicMultiModeSchedule).toHaveBeenCalledWith(
      expect.objectContaining({ mode_equipment_id: 11, start_date: null, end_date: null, parent_equipment_id: 10 }),
    );
  });

  it("accepts DD-MM-YYYY dates and sends ISO to the API", async () => {
    api.createOicMultiModeSchedule.mockResolvedValue({ data: { schedule: {}, mode_linked: false } });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Add schedule" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("From date"), { target: { value: "12-10-2026" } });
    fireEvent.change(within(dialog).getByLabelText("To date"), { target: { value: "16-10-2026" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add schedule" }));
    await waitFor(() => expect(api.createOicMultiModeSchedule).toHaveBeenCalledTimes(1));
    expect(api.createOicMultiModeSchedule).toHaveBeenCalledWith(
      expect.objectContaining({ start_date: "2026-10-12", end_date: "2026-10-16" }),
    );
  });

  it("removes a mode after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    api.removeMultiModeMode.mockResolvedValue({
      data: { family: { ...family, children: [], schedules: [] }, candidates, schedules_deleted: 1 },
    });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Remove mode" }));
    await waitFor(() => expect(api.removeMultiModeMode).toHaveBeenCalledWith(10, 11));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Remove mode" })).toBeNull());
  });

  it("flags a mode that has no current schedule", async () => {
    api.getMultiModeFamily.mockResolvedValue({
      data: {
        family: { ...family, children: [{ ...family.children[0], current_schedule_count: 0 }], schedules: [] },
        candidates,
      },
    });
    renderPage();
    expect(await screen.findByText(/No current schedule: users cannot book it/)).toBeTruthy();
  });
});

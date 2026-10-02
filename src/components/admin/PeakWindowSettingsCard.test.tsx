// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import PeakWindowSettingsCard from "./PeakWindowSettingsCard";

const SETTINGS = {
  enabled: true,
  lead_minutes: 5,
  trail_minutes: 15,
  block_external_users: true,
  external_notice_minutes: 30,
  defer_background_tasks: true,
  updated_at: "2026-10-02T10:00:00+05:30",
  status: {
    peak_window_active: false,
    starts_at: null,
    ends_at: null,
    next_window: {
      opening_at: "2026-10-07T21:00:00+05:30",
      starts_at: "2026-10-07T20:55:00+05:30",
      ends_at: "2026-10-07T21:15:00+05:30",
    },
  },
};

const api = vi.hoisted(() => ({
  getPeakWindowSettings: vi.fn(),
  updatePeakWindowSettings: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: api }));
vi.mock("@/lib/peakWindow", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/peakWindow")>()),
  refreshPeakStatus: vi.fn(async () => {}),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Radix Switch measures itself.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

afterEach(() => cleanup());

describe("PeakWindowSettingsCard", () => {
  it("shows the next window and saves edited minutes", async () => {
    api.getPeakWindowSettings.mockResolvedValue({ data: SETTINGS });
    api.updatePeakWindowSettings.mockImplementation(async (body) => ({ data: { ...SETTINGS, ...body } }));
    render(<PeakWindowSettingsCard />);

    expect(await screen.findByText(/Next window: Wednesday, 7 Oct, 8:55 pm – 9:15 pm \(opening 9:00 pm\)/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Minutes before opening"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(api.updatePeakWindowSettings).toHaveBeenCalled());
    expect(api.updatePeakWindowSettings.mock.calls[0][0]).toMatchObject({ lead_minutes: 10, trail_minutes: 15, enabled: true });
  });
});

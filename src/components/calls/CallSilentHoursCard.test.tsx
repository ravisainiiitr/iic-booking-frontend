// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getCallSilentHours: vi.fn(), saveCallSilentHours: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiClient: api }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from "sonner";

import CallSilentHoursCard from "./CallSilentHoursCard";

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const defaults = {
  enabled: false, office_start: "09:00", office_end: "17:30", silent_weekends: true, silent_holidays: true,
  active_now: false, follows_base_equipment: false,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CallSilentHoursCard", () => {
  it("shows the default office hours and saves what the officer chose", async () => {
    api.getCallSilentHours.mockResolvedValue({ data: defaults });
    api.saveCallSilentHours.mockImplementation(async (_id: number, v: unknown) => ({ data: v }));
    render(<CallSilentHoursCard equipmentId={7} />);

    const end = (await screen.findByLabelText("Office hours end")) as HTMLInputElement;
    expect((screen.getByLabelText("Office hours start") as HTMLInputElement).value).toBe("09:00");
    expect(end.value).toBe("17:30");

    fireEvent.click(screen.getByRole("switch", { name: "Silent hours" }));
    fireEvent.change(end, { target: { value: "18:00" } });
    fireEvent.click(screen.getByLabelText("Silent on holidays"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(api.saveCallSilentHours).toHaveBeenCalled());
    expect(api.saveCallSilentHours).toHaveBeenCalledWith(7, expect.objectContaining({ enabled: true, office_end: "18:00", silent_holidays: false, silent_weekends: true }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it("shows nothing when the server refuses this person", async () => {
    api.getCallSilentHours.mockResolvedValue({ error: "Only the Officer In Charge can change silent hours." });
    const { container } = render(<CallSilentHoursCard equipmentId={7} />);
    await waitFor(() => expect(api.getCallSilentHours).toHaveBeenCalled());
    expect(container.innerHTML).toBe("");
  });

  it("tells the officer when users cannot call right now, and shows a refused save", async () => {
    api.getCallSilentHours.mockResolvedValue({ data: { ...defaults, enabled: true, active_now: true } });
    api.saveCallSilentHours.mockResolvedValue({ error: "Office hours must end after they start." });
    render(<CallSilentHoursCard equipmentId={7} />);
    expect(await screen.findByText("Users cannot call right now.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Office hours must end after they start."));
  });
});

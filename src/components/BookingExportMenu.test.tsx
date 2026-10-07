// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const api = vi.hoisted(() => ({ exportBookings: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));

vi.mock("@/lib/api", () => ({ apiClient: api }));
vi.mock("sonner", () => ({ toast }));

import { BookingExportMenu } from "./BookingExportMenu";

const openAndPick = async (label: RegExp) => {
  fireEvent.keyDown(screen.getByRole("button", { name: /Export/ }), { key: "Enter" });
  fireEvent.click(await screen.findByRole("menuitem", { name: label }));
};

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("BookingExportMenu", () => {
  it("offers Excel (.xlsx), CSV and PDF", async () => {
    render(<BookingExportMenu view="staff" getFilters={() => ({})} />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Export" }), { key: "Enter" });
    const items = await screen.findAllByRole("menuitem");
    expect(items.map((i) => i.textContent)).toEqual(["Excel (.xlsx)", "CSV", "PDF"]);
  });

  it("reads the filters when a format is chosen, not when the menu was rendered", async () => {
    api.exportBookings.mockResolvedValue({ rowCount: 3 });
    let filters = { status: "BOOKED" };
    render(<BookingExportMenu view="my" getFilters={() => filters} />);
    filters = { status: "COMPLETED", search: "xrd" } as typeof filters;
    await openAndPick(/Excel/);
    await waitFor(() => expect(api.exportBookings).toHaveBeenCalledWith("xlsx", "my", { status: "COMPLETED", search: "xrd" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Exported 3 bookings."));
  });

  it("shows a loading state while exporting and blocks a second export", async () => {
    let finish: (v: { rowCount: number }) => void = () => {};
    api.exportBookings.mockReturnValue(new Promise((r) => (finish = r)));
    render(<BookingExportMenu view="staff" getFilters={() => ({})} />);
    await openAndPick(/PDF/);
    const button = await screen.findByRole("button", { name: /Exporting/ });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    await act(async () => finish({ rowCount: 1 }));
    expect(((await screen.findByRole("button", { name: "Export" })) as HTMLButtonElement).disabled).toBe(false);
    expect(api.exportBookings).toHaveBeenCalledTimes(1);
  });

  it("shows the server's message (e.g. the row cap) as an error toast", async () => {
    const message = "12,000 bookings match these filters; exports are limited to 10,000. Narrow the filters (for example a date range) and try again.";
    api.exportBookings.mockResolvedValue({ error: message });
    render(<BookingExportMenu view="staff" getFilters={() => ({})} />);
    await openAndPick(/CSV/);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message));
    expect(toast.success).not.toHaveBeenCalled();
  });
});

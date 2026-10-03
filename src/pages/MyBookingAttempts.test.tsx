// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { MyBookingAttempt, MyBookingAttemptsPage } from "@/lib/myBookingAttempts";

const listMyBookingAttempts = vi.fn();
const openQuotaBreakdown = vi.fn();

vi.mock("@/lib/api", () => ({
  apiClient: { listMyBookingAttempts: (...args: unknown[]) => listMyBookingAttempts(...args) },
}));
vi.mock("@/lib/quotaBreakdown", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/quotaBreakdown")>()),
  openQuotaBreakdown: (...args: unknown[]) => openQuotaBreakdown(...args),
}));
vi.mock("@/components/DashboardHeader", () => ({ default: () => null }));

import MyBookingAttempts from "./MyBookingAttempts";

afterEach(cleanup);
beforeEach(() => {
  listMyBookingAttempts.mockReset();
  openQuotaBreakdown.mockReset();
});

const attempt = (over: Partial<MyBookingAttempt> = {}): MyBookingAttempt => ({
  id: 41,
  requested_at: "2026-09-30T15:30:04Z",
  equipment_id: 7,
  equipment_code: "XPS",
  equipment_name: "X-ray Photoelectron Spectrometer",
  outcome: "FAILED",
  failure_code: "quota",
  failure_title: "Weekly limit reached",
  failure_summary: "This booking would take your group over its weekly limit.",
  slots_requested: 1,
  duration_minutes: 90,
  requested_slots: [{ id: 5, slot_name: "Slot 2", date: "2026-10-06", start_datetime: "2026-10-06T04:30:00Z", end_datetime: "2026-10-06T06:00:00Z" }],
  booked_by_name: null,
  booked_for_name: null,
  can_view_calculation: true,
  ...over,
});

const page = (results: MyBookingAttempt[], total = results.length): { data: MyBookingAttemptsPage } => ({
  data: { results, total_count: total, limit: 20, offset: 0 },
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <MyBookingAttempts />
    </MemoryRouter>,
  );

describe("MyBookingAttempts", () => {
  it("lists failed attempts and opens the calculation only for limit failures", async () => {
    listMyBookingAttempts.mockResolvedValue(
      page([
        attempt(),
        attempt({
          id: 42,
          failure_code: "slot_taken",
          failure_title: "Slot no longer free",
          failure_summary: "Someone booked this slot first.",
          can_view_calculation: false,
          booked_by_name: "Dr. Mehta",
        }),
      ]),
    );
    renderPage();

    const table = await screen.findByRole("table");
    expect(listMyBookingAttempts).toHaveBeenCalledWith({ outcome: "FAILED", date_from: "", date_to: "", limit: 20, offset: 0 });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toMatch(/Wed, 30 Sept?, 21:00:04/);
    expect(rows[0].textContent).toMatch(/Weekly limit reached/);
    expect(rows[1].textContent).toMatch(/Submitted for you by Dr\. Mehta\./);
    expect(within(rows[1]).queryByRole("button", { name: /View calculation/ })).toBeNull();

    fireEvent.click(within(rows[0]).getByRole("button", { name: /View calculation/ }));
    expect(openQuotaBreakdown).toHaveBeenCalledWith({ logId: 41 });
  });

  it("filters by date and pages through results", async () => {
    listMyBookingAttempts.mockResolvedValue(page([attempt()], 45));
    renderPage();

    expect(await screen.findByText("1–20 of 45")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    await waitFor(() => expect(listMyBookingAttempts).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 20 })));

    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-09-01" } });
    await waitFor(() =>
      expect(listMyBookingAttempts).toHaveBeenLastCalledWith(expect.objectContaining({ date_from: "2026-09-01", offset: 0 })),
    );
  });

  it("says when there is nothing to show and when loading fails", async () => {
    listMyBookingAttempts.mockResolvedValueOnce(page([]));
    renderPage();
    expect(await screen.findByText("You have no unsuccessful booking attempts.")).toBeTruthy();
    cleanup();

    listMyBookingAttempts.mockResolvedValueOnce({ error: "Server unavailable" });
    renderPage();
    expect(await screen.findByText("Server unavailable")).toBeTruthy();
  });
});

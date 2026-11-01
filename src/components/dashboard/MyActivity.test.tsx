// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getMyActivity: vi.fn() }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiClient: api,
}));

import MyActivity, { relativeTo } from "./MyActivity";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const inHours = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();

const booking = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  display_id: `IICXRD${id}`,
  equipment: { id: 7, name: "X-ray Diffractometer", code: "XRD" },
  status: "BOOKED",
  status_display: "Booked",
  slot_start: inHours(50),
  slot_end: inHours(51),
  charge: 500,
  sample_deadline: inHours(10),
  ...extra,
});

const activity = (extra: Record<string, unknown> = {}) => ({
  generated_at: new Date().toISOString(),
  next: booking(1),
  upcoming: [booking(1), booking(2, { status: "PENDING_PAYMENT", status_display: "Awaiting payment", sample_deadline: null })],
  counts: { upcoming: 2, awaiting_payment: 1, needs_choice: 0, waitlisted: 0, processing: 1, completed_month: 3 },
  results: { new: 1, recent: [{ ...booking(3, { status: "COMPLETED" }), files: 2, ready_at: inHours(-5), new: true }] },
  spend: {
    this_month: 1500,
    last_month: 1000,
    year: 9000,
    months: ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"].map((month, i) => ({ month, amount: i * 300, bookings: i })),
  },
  hours: { this_month: 4.5, year: 30 },
  wallet: { balance: 12500.5, is_owner: true },
  book_again: [{ id: 7, name: "X-ray Diffractometer", code: "XRD", times: 6, last_booked: inHours(-48), available: true }],
  ...extra,
});

describe("My activity", () => {
  it("shows the next session with its countdown and an urgent sample deadline, and opens it", async () => {
    api.getMyActivity.mockResolvedValue({ data: activity() });
    const onOpen = vi.fn();
    render(<MyActivity onOpen={onOpen} />);
    const next = await screen.findByTestId("my-activity-next");
    expect(within(next).getByText(/Next up · in 2 d/)).toBeTruthy();
    expect(within(next).getByText(/Sample due/)).toBeTruthy();
    fireEvent.click(within(next).getByRole("button", { name: /View booking/ }));
    expect(onOpen).toHaveBeenCalledWith("/my-bookings?booking=IICXRD1", "My Bookings");
  });

  it("summarises what needs attention, results, time, wallet and spending", async () => {
    api.getMyActivity.mockResolvedValue({ data: activity() });
    const onOpen = vi.fn();
    render(<MyActivity onOpen={onOpen} />);
    await screen.findByTestId("my-activity");
    expect(screen.getByText("1 awaiting payment")).toBeTruthy();
    expect(screen.getByText("1 being processed")).toBeTruthy();
    expect(screen.getByText("₹12,500.50")).toBeTruthy();
    expect(screen.getByText("50%")).toBeTruthy(); // 1500 vs 1000 last month
    expect(screen.getByRole("list", { name: "Spending in the last six months" }).children).toHaveLength(6);
    fireEvent.click(screen.getByRole("button", { name: /Booked 6× this year/ }));
    expect(onOpen).toHaveBeenCalledWith("/book-equipment?equipment_id=7", "Book Equipment");
    expect(screen.getByText("New")).toBeTruthy();
  });

  it("invites a new user to book when nothing is scheduled", async () => {
    api.getMyActivity.mockResolvedValue({
      data: activity({ next: null, upcoming: [], book_again: [], wallet: null, results: { new: 0, recent: [] } }),
    });
    render(<MyActivity onOpen={vi.fn()} />);
    expect(await screen.findByText("No sessions scheduled")).toBeTruthy();
    expect(screen.getByText(/Nothing scheduled/)).toBeTruthy();
  });

  it("offers a retry when loading fails", async () => {
    api.getMyActivity.mockResolvedValueOnce({ error: "boom" }).mockResolvedValueOnce({ data: activity() });
    render(<MyActivity onOpen={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByTestId("my-activity")).toBeTruthy();
  });

  it("words the countdown", () => {
    const now = new Date("2026-11-01T10:00:00");
    expect(relativeTo(new Date("2026-11-01T10:20:00"), now)).toBe("in 20 min");
    expect(relativeTo(new Date("2026-11-01T13:00:00"), now)).toBe("in 3 h");
    expect(relativeTo(new Date("2026-11-03T14:00:00"), now)).toBe("in 2 d 4 h");
    expect(relativeTo(new Date("2026-11-01T09:00:00"), now)).toBe("now");
  });
});

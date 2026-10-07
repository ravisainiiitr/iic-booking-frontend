// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import BookingManagement from "./BookingManagement";

const api = vi.hoisted(() => ({ getBookings: vi.fn() }));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 1, email: "oic@example.test", name: "OIC", user_type: "manager" },
    isAuthenticated: true,
    loading: false,
  }),
}));
vi.mock("@/components/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/components/booking/LabQuestionsAwaitingCard", () => ({ LabQuestionsAwaitingCard: () => null }));
vi.mock("@/lib/api", () => ({
  apiClient: new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === "getBookings") return api.getBookings;
        return vi.fn(async () => ({ data: {} }));
      },
    },
  ),
}));

type Params = Record<string, unknown>;

function booking(n: number) {
  return {
    booking_id: n,
    virtual_booking_id: `XPS2026${String(n).padStart(5, "0")}`,
    equipment_code: "XPS",
    equipment_name: "XPS",
    user_name: `User ${n}`,
    user_email: "",
    status: "BOOKED",
    start_time: "2026-10-06T04:30:00Z",
    total_time_minutes: 60,
  };
}

function page(params: Params, total = 25) {
  const offset = Number(params.offset ?? 0);
  const limit = Number(params.limit ?? 10);
  const rows = Array.from({ length: Math.max(0, Math.min(limit, total - offset)) }, (_, i) => booking(offset + i + 1));
  return { data: { bookings: rows, total_count: total } };
}

const calls = () => api.getBookings.mock.calls.map(([p]) => p as Params).filter((p) => p.list_view);
const lastCall = () => calls()[calls().length - 1];
const sleep = (ms: number) => act(() => new Promise<void>((r) => setTimeout(r, ms)));

function renderPage() {
  render(
    <MemoryRouter>
      <BookingManagement />
    </MemoryRouter>,
  );
  return screen.getByRole("searchbox", { name: "Search" });
}

beforeEach(() => {
  api.getBookings.mockImplementation(async (params: Params) => page(params));
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("View Booking (staff) live filters", { timeout: 20_000 }, () => {
  it("has no Apply button and keeps Clear", async () => {
    renderPage();
    await screen.findByText("XPS202600001");
    expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
    expect(screen.getByRole("button", { name: "Clear" })).toBeTruthy();
  });

  it("searches after 2+ characters without a button, ignores 1 character and resets when cleared", async () => {
    const search = renderPage();
    await screen.findByText("XPS202600001");
    const initial = calls().length;

    fireEvent.change(search, { target: { value: "x" } });
    await sleep(600);
    expect(calls().length).toBe(initial);

    fireEvent.change(search, { target: { value: "xp" } });
    fireEvent.change(search, { target: { value: "xps" } });
    await waitFor(() => expect(lastCall().search).toBe("xps"));
    expect(calls().length).toBe(initial + 1);
    expect(lastCall().offset).toBe(0);

    fireEvent.change(search, { target: { value: "" } });
    await waitFor(() => expect(calls().length).toBe(initial + 2));
    expect(lastCall().search).toBeUndefined();
  });

  it("applies a date change immediately and goes back to page 1", async () => {
    renderPage();
    await screen.findByText("XPS202600001");
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    await waitFor(() => expect(lastCall().offset).toBe(10));

    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "01-10-2026" } });
    await waitFor(() => expect(lastCall().start_date).toBe("2026-10-01"));
    expect(lastCall().offset).toBe(0);
    expect(await screen.findByText("Page 1 of 3")).toBeTruthy();
  });

  it("never shows an older query's results after a newer one", async () => {
    const search = renderPage();
    await screen.findByText("XPS202600001");

    let releaseSlow: () => void = () => {};
    api.getBookings.mockImplementation((params: Params) => {
      if (params.search === "old") {
        return new Promise((resolve) => {
          releaseSlow = () => resolve({ data: { bookings: [booking(901)], total_count: 1 } });
        });
      }
      if (params.search === "newer") return Promise.resolve({ data: { bookings: [booking(902)], total_count: 1 } });
      return Promise.resolve(page(params));
    });

    fireEvent.change(search, { target: { value: "old" } });
    await waitFor(() => expect(lastCall().search).toBe("old"));
    fireEvent.change(search, { target: { value: "newer" } });
    await screen.findByText("XPS202600902");
    await act(async () => releaseSlow());
    expect(screen.queryByText("XPS202600901")).toBeNull();
    expect(screen.getByText("XPS202600902")).toBeTruthy();
  });

  it("numbers rows with S.No continuing across pages", async () => {
    renderPage();
    await screen.findByText("XPS202600001");
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader")[0].textContent).toBe("S.No");
    const firstCell = () => within(screen.getAllByRole("row")[1]).getAllByRole("cell")[0].textContent;
    expect(firstCell()).toBe("1");

    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    await screen.findByText("XPS202600011");
    expect(firstCell()).toBe("11");
    expect(screen.getByText(/Showing 11–20 of 25/)).toBeTruthy();
  });
});

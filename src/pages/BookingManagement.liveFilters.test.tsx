// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import BookingManagement from "./BookingManagement";

const api = vi.hoisted(() => ({ getBookings: vi.fn(), exportBookings: vi.fn() }));
const auth = vi.hoisted(() => ({ userType: "manager" }));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 1, email: "oic@example.test", name: "OIC", user_type: auth.userType },
    isAuthenticated: true,
    loading: false,
  }),
}));
vi.mock("@/components/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/components/booking/LabQuestionsAwaitingCard", () => ({ LabQuestionsAwaitingCard: () => null }));
vi.mock("@/components/BookingLabMessages", () => ({ default: () => null }));
vi.mock("@/lib/api", () => ({
  apiClient: new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === "getBookings") return api.getBookings;
        if (prop === "exportBookings") return api.exportBookings;
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

function renderPage(url = "/booking-management") {
  render(
    <MemoryRouter initialEntries={[url]}>
      <BookingManagement />
    </MemoryRouter>,
  );
  return screen.getByRole("searchbox", { name: "Search" });
}

const statusBox = () => screen.getByRole("combobox", { name: "Status" });

beforeEach(() => {
  auth.userType = "manager";
  api.getBookings.mockImplementation(async (params: Params) => page(params));
  api.exportBookings.mockResolvedValue({ rowCount: 25 });
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
    expect(within(table).getAllByRole("columnheader")[0].textContent).toBe("S.No.");
    const firstCell = () => within(screen.getAllByRole("row")[1]).getAllByRole("cell")[0].textContent;
    expect(firstCell()).toBe("1");

    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    await screen.findByText("XPS202600011");
    expect(firstCell()).toBe("11");
    expect(screen.getByText(/Showing 11–20 of 25/)).toBeTruthy();
  });

  it("exports with exactly the filters, search and sort the list is using, without paging", async () => {
    const search = renderPage();
    await screen.findByText("XPS202600001");
    fireEvent.change(search, { target: { value: "xps" } });
    await waitFor(() => expect(lastCall().search).toBe("xps"));
    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "01-10-2026" } });
    await waitFor(() => expect(lastCall().start_date).toBe("2026-10-01"));
    fireEvent.click(screen.getByRole("button", { name: /^Equipment/ }));
    await waitFor(() => expect(lastCall().ordering).toBeTruthy());

    fireEvent.keyDown(screen.getByRole("button", { name: "Export" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: /CSV/ }));

    await waitFor(() => expect(api.exportBookings).toHaveBeenCalledTimes(1));
    const { limit: _limit, offset: _offset, list_view: _listView, ...listFilters } = lastCall();
    expect(api.exportBookings).toHaveBeenCalledWith("csv", "staff", listFilters);
    expect(listFilters).toMatchObject({ search: "xps", start_date: "2026-10-01", ordering: lastCall().ordering });
  });
});

describe("View Booking (staff) rows per page", { timeout: 20_000 }, () => {
  const rowsBox = () => screen.getByRole("combobox", { name: "Rows per page" });
  const firstCell = () => within(screen.getAllByRole("row")[1]).getAllByRole("cell")[0].textContent;
  const choose = async (size: string) => {
    fireEvent.keyDown(rowsBox(), { key: "Enter" });
    fireEvent.click(await screen.findByRole("option", { name: size }));
  };

  beforeEach(() => {
    // jsdom lacks the pointer/scroll APIs Radix Select calls when it opens.
    Element.prototype.scrollIntoView ??= vi.fn();
    Element.prototype.hasPointerCapture ??= vi.fn(() => false);
    Element.prototype.releasePointerCapture ??= vi.fn();
    window.localStorage.clear();
    api.getBookings.mockImplementation(async (params: Params) => page(params, 130));
  });

  it("starts at 10, offers 10 / 25 / 50 / 100 / 500 and keeps S.No and the range right for the chosen size", async () => {
    renderPage();
    await screen.findByText("XPS202600001");
    expect(rowsBox().textContent).toBe("10");
    expect(lastCall()).toMatchObject({ limit: 10, offset: 0 });

    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    await screen.findByText("XPS202600011");
    fireEvent.keyDown(rowsBox(), { key: "Enter" });
    expect((await screen.findAllByRole("option")).map((o) => o.textContent)).toEqual(["10", "25", "50", "100", "500"]);
    fireEvent.click(screen.getByRole("option", { name: "25" }));

    // A new size goes back to page 1.
    await waitFor(() => expect(lastCall()).toMatchObject({ limit: 25, offset: 0 }));
    await screen.findByText("XPS202600025");
    expect(firstCell()).toBe("1");
    expect(screen.getByText(/Showing 1–25 of 130/)).toBeTruthy();
    expect(screen.getByText("Page 1 of 6")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    await screen.findByText("XPS202600026");
    expect(lastCall()).toMatchObject({ limit: 25, offset: 25 });
    expect(firstCell()).toBe("26");
    expect(screen.getByText(/Showing 26–50 of 130/)).toBeTruthy();
  });

  it("remembers the choice for the user and loads the remembered size first", async () => {
    renderPage();
    await screen.findByText("XPS202600001");
    await choose("500");
    await waitFor(() => expect(lastCall()).toMatchObject({ limit: 500, offset: 0 }));
    expect(window.localStorage.getItem("iic.rowsPerPage.view-booking.1")).toBe("500");

    cleanup();
    api.getBookings.mockClear();
    renderPage();
    await screen.findByText("XPS202600130");
    expect(calls().map((c) => c.limit)).toEqual(calls().map(() => 500));
    expect(screen.getAllByRole("row")).toHaveLength(131);
    expect(rowsBox().textContent).toBe("500");
  });

  it("does not page the export", async () => {
    renderPage();
    await screen.findByText("XPS202600001");
    await choose("100");
    await waitFor(() => expect(lastCall().limit).toBe(100));
    fireEvent.keyDown(screen.getByRole("button", { name: "Export" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: /CSV/ }));
    await waitFor(() => expect(api.exportBookings).toHaveBeenCalledTimes(1));
    const filters = api.exportBookings.mock.calls[0][2] as Params;
    expect(filters.limit).toBeUndefined();
    expect(filters.offset).toBeUndefined();
  });
});

describe("View Booking (staff) default status", { timeout: 20_000 }, () => {
  it.each(["operator", "manager", "dept_admin"])("opens on All status for %s and lists every booking", async (userType) => {
    auth.userType = userType;
    renderPage();
    await screen.findByText("XPS202600001");
    expect(statusBox().textContent).toContain("All status");
    expect(calls().length).toBeGreaterThan(0);
    for (const call of calls()) {
      expect(call.status).toBeUndefined();
      expect(call.list_status).toBeUndefined();
      expect(call.results_overdue).toBeUndefined();
      expect(call.ordering).toBe("default");
    }
  });

  it("keeps Booked as the Main Administrator's default", async () => {
    auth.userType = "admin";
    renderPage();
    await screen.findByText("XPS202600001");
    expect(statusBox().textContent).toContain("Booked");
    expect(calls().length).toBeGreaterThan(0);
    for (const call of calls()) expect(call.list_status).toBe("BOOKED");
  });

  it("offers Pending and Result Overdue and sends them as list_status", async () => {
    Element.prototype.scrollIntoView ??= vi.fn();
    Element.prototype.hasPointerCapture ??= vi.fn(() => false);
    Element.prototype.releasePointerCapture ??= vi.fn();
    renderPage();
    await screen.findByText("XPS202600001");
    fireEvent.keyDown(statusBox(), { key: "Enter" });
    fireEvent.click(await screen.findByRole("option", { name: "Pending" }));
    await waitFor(() => expect(lastCall().list_status).toBe("RESULTS_PENDING"));
    fireEvent.keyDown(statusBox(), { key: "Enter" });
    fireEvent.click(await screen.findByRole("option", { name: "Result Overdue" }));
    await waitFor(() => expect(lastCall().list_status).toBe("RESULT_OVERDUE"));
    expect(lastCall().status).toBeUndefined();
  });

  it("sends the default order until a column is sorted, and Default order resets it", async () => {
    renderPage();
    await screen.findByText("XPS202600001");
    expect(lastCall().ordering).toBe("default");
    expect(screen.queryByRole("button", { name: "Default order" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Equipment/ }));
    await waitFor(() => expect(lastCall().ordering).toBe("equipment_name"));
    fireEvent.click(screen.getByRole("button", { name: "Default order" }));
    await waitFor(() => expect(lastCall().ordering).toBe("default"));
  });

  it("exports all statuses by default for non-admins and Booked for the Main Administrator", async () => {
    for (const [userType, status] of [["manager", undefined], ["admin", "BOOKED"]] as const) {
      auth.userType = userType;
      renderPage();
      await screen.findByText("XPS202600001");
      fireEvent.keyDown(screen.getByRole("button", { name: "Export" }), { key: "Enter" });
      fireEvent.click(await screen.findByRole("menuitem", { name: /CSV/ }));
      await waitFor(() => expect(api.exportBookings).toHaveBeenCalledTimes(1));
      expect(api.exportBookings.mock.calls[0][2].list_status).toBe(status);
      expect(api.exportBookings.mock.calls[0][2].ordering).toBe("default");
      cleanup();
      vi.clearAllMocks();
      api.getBookings.mockImplementation(async (params: Params) => page(params));
      api.exportBookings.mockResolvedValue({ rowCount: 25 });
    }
  });

  it("still honours ?results=overdue for every role, and Clear goes back to All status", async () => {
    for (const userType of ["manager", "admin"]) {
      auth.userType = userType;
      renderPage("/booking-management?results=overdue");
      await screen.findByText("XPS202600001");
      expect(calls()[0].list_status).toBe("RESULT_OVERDUE");
      expect(calls()[0].status).toBeUndefined();
      expect(statusBox().textContent).toContain("Result Overdue");

      fireEvent.click(screen.getByRole("button", { name: "Clear" }));
      await waitFor(() => expect(lastCall().list_status).toBeUndefined());
      expect(lastCall().status).toBeUndefined();
      expect(statusBox().textContent).toContain("All status");
      cleanup();
      vi.clearAllMocks();
      api.getBookings.mockImplementation(async (params: Params) => page(params));
    }
  });

  it("still opens ?expand on All status for the Main Administrator", async () => {
    auth.userType = "admin";
    renderPage("/booking-management?expand=7");
    await waitFor(() => expect(calls().length).toBeGreaterThan(0));
    for (const call of calls()) expect(call.status).toBeUndefined();
  });
});

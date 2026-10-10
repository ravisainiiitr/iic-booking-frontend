// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MyBookings from "./MyBookings";

const api = vi.hoisted(() => ({ getBookings: vi.fn(), exportBookings: vi.fn() }));
const auth = vi.hoisted(() => ({ userType: "student" }));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 7, email: "student@example.test", name: "Student", user_type: auth.userType },
    isAuthenticated: true,
    loading: false,
  }),
}));
vi.mock("@/components/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/lib/api", () => ({
  apiClient: new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === "getBookings") return api.getBookings;
        if (prop === "exportBookings") return api.exportBookings;
        if (prop === "getToken") return () => "token";
        if (prop === "getMyWaitlistEntries") return async () => ({ data: { entries: [] } });
        return vi.fn(async () => ({ data: {} }));
      },
    },
  ),
}));

type Params = Record<string, unknown>;

function booking(n: number) {
  return {
    booking_id: n,
    real_booking_id: n,
    virtual_booking_id: `XRD2026${String(n).padStart(5, "0")}`,
    user: 7,
    equipment_code: "XRD",
    equipment_name: "X-Ray Diffractometer",
    status: "BOOKED",
    status_display: "Booked",
    start_time: "2026-10-06T04:30:00Z",
    end_time: "2026-10-06T05:30:00Z",
    total_time_minutes: 60,
    total_charge: "100.00",
    created_at: new Date(Date.UTC(2026, 9, 1) - n * 60_000).toISOString(),
    daily_slots: [],
  };
}

function page(params: Params, total = 60) {
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
      <MyBookings />
    </MemoryRouter>,
  );
  return screen.getByRole("searchbox", { name: "Search" });
}

beforeEach(() => {
  auth.userType = "student";
  api.getBookings.mockImplementation(async (params: Params) => page(params));
  api.exportBookings.mockResolvedValue({ rowCount: 60 });
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

describe("View Booking (My Bookings) live filters", { timeout: 20_000 }, () => {
  it("searches after 2+ characters with no Apply button and ignores a single character", async () => {
    const search = renderPage();
    await screen.findAllByText("XRD202600001");
    expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
    const initial = calls().length;

    fireEvent.change(search, { target: { value: "x" } });
    await sleep(600);
    expect(calls().length).toBe(initial);

    fireEvent.change(search, { target: { value: "xrd" } });
    await waitFor(() => expect(lastCall().search).toBe("xrd"));
    expect(calls().length).toBe(initial + 1);
    expect(lastCall().offset).toBe(0);
  });

  it("applies a date change immediately", async () => {
    renderPage();
    await screen.findAllByText("XRD202600001");
    fireEvent.change(screen.getByLabelText("End date"), { target: { value: "31-10-2026" } });
    await waitFor(() => expect(lastCall().end_date).toBe("2026-10-31"));
  });

  it("numbers rows with S.No continuing across pages, in the table and the mobile cards", async () => {
    renderPage();
    await screen.findAllByText("XRD202600001");
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader")[0].textContent).toBe("S.No.");
    const firstCell = () => within(within(table).getAllByRole("row")[1]).getAllByRole("cell")[0].textContent;
    expect(firstCell()).toBe("1");

    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    await screen.findAllByText("XRD202600051");
    expect(lastCall().offset).toBe(50);
    expect(firstCell()).toBe("51");
    const firstCard = within(screen.getByRole("list", { name: "Bookings" })).getAllByRole("listitem")[0];
    expect(firstCard.textContent).toContain("S.No.51");
  });

  it("starts at 50 rows, switches to 100 from page 1 and remembers the choice", async () => {
    Element.prototype.scrollIntoView ??= vi.fn();
    Element.prototype.hasPointerCapture ??= vi.fn(() => false);
    Element.prototype.releasePointerCapture ??= vi.fn();
    window.localStorage.clear();
    api.getBookings.mockImplementation(async (params: Params) => page(params, 260));
    renderPage();
    await screen.findAllByText("XRD202600001");
    const rowsBox = () => screen.getByRole("combobox", { name: "Rows per page" });
    expect(rowsBox().textContent).toBe("50");
    expect(lastCall()).toMatchObject({ limit: 50, offset: 0 });

    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    await screen.findAllByText("XRD202600051");
    fireEvent.keyDown(rowsBox(), { key: "Enter" });
    fireEvent.click(await screen.findByRole("option", { name: "100" }));
    await waitFor(() => expect(lastCall()).toMatchObject({ limit: 100, offset: 0 }));
    await screen.findAllByText("XRD202600100");
    expect(window.localStorage.getItem("iic.rowsPerPage.my-bookings.7")).toBe("100");

    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    await waitFor(() => expect(lastCall()).toMatchObject({ limit: 100, offset: 100 }));
    const table = screen.getByRole("table");
    await waitFor(() =>
      expect(within(within(table).getAllByRole("row")[1]).getAllByRole("cell")[0].textContent).toBe("101"),
    );
    window.localStorage.clear();
  });

  it("exports with the filters and search the list is using, without paging", async () => {
    const search = renderPage();
    await screen.findAllByText("XRD202600001");
    fireEvent.change(search, { target: { value: "xrd" } });
    await waitFor(() => expect(lastCall().search).toBe("xrd"));
    fireEvent.change(screen.getByLabelText("End date"), { target: { value: "31-10-2026" } });
    await waitFor(() => expect(lastCall().end_date).toBe("2026-10-31"));

    fireEvent.keyDown(screen.getByRole("button", { name: "Export" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: /PDF/ }));

    await waitFor(() => expect(api.exportBookings).toHaveBeenCalledTimes(1));
    const { limit: _limit, offset: _offset, list_view: _listView, ...listFilters } = lastCall();
    expect(api.exportBookings).toHaveBeenCalledWith("pdf", "my", listFilters);
    expect(listFilters).toMatchObject({ search: "xrd", end_date: "2026-10-31" });
  });

  it.each(["student", "faculty", "finance", "operator", "manager", "dept_admin", "admin"])(
    "opens on All status with no date range for %s",
    async (userType) => {
      auth.userType = userType;
      renderPage();
      await screen.findAllByText("XRD202600001");
      expect(screen.getByRole("combobox", { name: "Status" }).textContent).toContain("All status");
      expect(calls().length).toBeGreaterThan(0);
      for (const call of calls()) {
        expect(call.status).toBeUndefined();
        expect(call.start_date).toBeUndefined();
        expect(call.end_date).toBeUndefined();
      }
    },
  );
});

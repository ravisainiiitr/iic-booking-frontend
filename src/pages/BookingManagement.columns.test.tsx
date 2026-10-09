// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import BookingManagement from "./BookingManagement";

const api = vi.hoisted(() => ({ getBookings: vi.fn() }));
const auth = vi.hoisted(() => ({ userType: "admin" }));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 1, email: "staff@example.test", name: "Staff", user_type: auth.userType },
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
      get: (_t, prop) => (prop === "getBookings" ? api.getBookings : vi.fn(async () => ({ data: {} }))),
    },
  ),
}));

const EQUIPMENT = "Nuclear Magnetic Resonance Spectrometer 500 MHz with TXI Cryoprobe";
const USER = "Demo User With A Long Name";
const SUPERVISOR = "Prof. Example Supervisor";

const row = {
  booking_id: 7,
  virtual_booking_id: "IICNMR TXI202600002",
  equipment_code: "NMR TXI",
  equipment_name: EQUIPMENT,
  user_name: USER,
  user_email: "demo.user@example.test",
  user_phone: "+91 90000 00000",
  wallet_owner_name: SUPERVISOR,
  status: "BOOKED",
  status_display: "Booked",
  start_time: "2026-10-12T04:30:00Z",
  total_time_minutes: 1439,
};

const EXPECTED_HEADERS = [
  "S.No.",
  "Booking ID",
  "Status",
  "Equipment",
  "User Name",
  "Supervisor Name",
  "User Mobile",
  "Booking Date & Time",
  "Duration",
];

const lastOrdering = () => {
  const calls = api.getBookings.mock.calls.map(([p]) => p as Record<string, unknown>).filter((p) => p.list_view);
  return calls[calls.length - 1]?.ordering;
};

async function renderList() {
  render(
    <MemoryRouter initialEntries={["/booking-management"]}>
      <BookingManagement />
    </MemoryRouter>,
  );
  await screen.findByText("IICNMR TXI202600002");
  return screen.getByRole("table");
}

beforeEach(() => {
  api.getBookings.mockResolvedValue({ data: { bookings: [row], total_count: 1 } });
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

describe("View Booking columns", { timeout: 20_000 }, () => {
  it.each(["admin", "dept_admin", "manager", "operator"])(
    "shows the same nine columns in order for %s, without User Email",
    async (role) => {
      auth.userType = role;
      const table = await renderList();
      const headers = within(table)
        .getAllByRole("columnheader")
        .map((th) => th.textContent?.trim());
      expect(headers).toEqual(EXPECTED_HEADERS);
      expect(within(table).queryByText(/email/i)).toBeNull();
      expect(within(table).queryByText(EQUIPMENT)).toBeNull();
      expect(within(table).getByText("NMR TXI").getAttribute("title")).toBe(EQUIPMENT);
      expect(within(table).queryByText(row.user_email)).toBeNull();
      expect(within(table).getByText(row.user_phone)).toBeTruthy();
      expect(within(table).getByText("23h 59m")).toBeTruthy();
    },
  );

  it("keeps every heading and cell on one line and truncates long names with a tooltip", async () => {
    const table = await renderList();
    for (const cell of within(table).getAllByRole("columnheader")) {
      expect(cell.className).toContain("whitespace-nowrap");
    }
    const cells = within(table).getAllByRole("cell");
    expect(cells).toHaveLength(EXPECTED_HEADERS.length);
    for (const cell of cells) {
      expect(cell.className).toContain("whitespace-nowrap");
    }
    for (const text of [USER, SUPERVISOR]) {
      const cell = within(table).getByText(text).closest("td")!;
      expect(cell.className).toMatch(/\btruncate\b/);
      expect(cell.getAttribute("title")).toBe(text);
    }
    const equipment = within(table).getByText("NMR TXI").closest("td")!;
    expect(equipment.className).not.toMatch(/\btruncate\b/);
    expect(equipment.className).not.toMatch(/w-\[/);
    const id = within(table).getByRole("button", { name: /IICNMR TXI202600002/ });
    expect(id.className).toContain("whitespace-nowrap");
    const duration = within(table).getByText("23h 59m").closest("td")!;
    expect(duration.className).toMatch(/\btext-right\b/);
    expect(duration.className).toContain("tabular-nums");
    expect(cells[0].className).toMatch(/\btext-center\b/);
  });

  it("still sorts by the remaining columns", async () => {
    const table = await renderList();
    const sortBy = (label: string) =>
      fireEvent.click(within(within(table).getByRole("columnheader", { name: new RegExp(`^${label}`) })).getByRole("button"));

    sortBy("User Name");
    await waitFor(() => expect(lastOrdering()).toBe("user_name"));
    await screen.findByText("IICNMR TXI202600002");
    sortBy("User Name");
    await waitFor(() => expect(lastOrdering()).toBe("-user_name"));
    await screen.findByText("IICNMR TXI202600002");
    sortBy("Booking Date & Time");
    await waitFor(() => expect(lastOrdering()).toBe("start_time"));
    await screen.findByText("IICNMR TXI202600002");
    sortBy("Duration");
    await waitFor(() => expect(lastOrdering()).toBe("duration"));
  });

  it("sorts Equipment by the equipment code key and marks only that column", async () => {
    const table = await renderList();
    const header = (label: string) => within(table).getByRole("columnheader", { name: new RegExp(`^${label}`) });

    fireEvent.click(within(header("Equipment")).getByRole("button"));
    await waitFor(() => expect(lastOrdering()).toBe("equipment_code"));
    await screen.findByText("IICNMR TXI202600002");
    expect(header("Equipment").getAttribute("aria-sort")).toBe("ascending");
    expect(header("Booking ID").getAttribute("aria-sort")).toBe("none");

    fireEvent.click(within(header("Equipment")).getByRole("button"));
    await waitFor(() => expect(lastOrdering()).toBe("-equipment_code"));
    await screen.findByText("IICNMR TXI202600002");
    expect(header("Equipment").getAttribute("aria-sort")).toBe("descending");
  });
});

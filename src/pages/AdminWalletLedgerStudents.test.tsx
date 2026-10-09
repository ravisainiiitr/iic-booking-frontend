// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

const state = vi.hoisted(() => ({
  user: { id: 1, user_type: "admin" } as { id: number; user_type: string },
  api: {
    getWalletLedgerOwners: vi.fn(),
    getWalletLedgerOptions: vi.fn(),
    getWalletLedgerOwner: vi.fn(),
    getWalletLedgerTransactions: vi.fn(),
    getWalletLedgerLinkedStudents: vi.fn(),
  },
}));

vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: state.api }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: state.user, loading: false, isAuthenticated: true }) }));
vi.mock("@/components/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/components/ExportMenu", () => ({
  ExportMenu: ({ report }: { report: string }) => <button type="button">Export {report}</button>,
}));

import AdminWalletLedger from "./AdminWalletLedger";
import AdminWalletLedgerOwner from "./AdminWalletLedgerOwner";
import { EMPTY_LINKED_STUDENT_FILTERS, linkedStudentParams } from "@/lib/walletLedger";

const subWallet = { id: 31, department_id: 9, department_name: "IIC", department_code: "IIC", balance: "1200.00" };

const owner = {
  s_no: 1,
  owner_id: 5,
  wallet_id: 8,
  name: "Prof. Asha Rao",
  email: "asha@example.test",
  employee_id: "E100",
  user_type: "faculty",
  user_type_label: "Faculty",
  department_id: 4,
  department_name: "Physics",
  total_balance: "1200.00",
  sub_wallets: [subWallet],
  linked_students: 2,
  status: "active" as const,
  last_transaction_at: "2026-10-01T10:00:00+05:30",
};

const detail = {
  ...owner,
  designation: "Professor",
  phone: "",
  wallet_created_at: "2025-01-01T10:00:00+05:30",
  total_credits: "1450.00",
  total_debits: "250.00",
  students: [{ id: 41, name: "Ravi Kumar", email: "ravi@example.test", enrollment: "21PH001", user_type_label: "Student", department_name: "Physics", linked_at: null }],
  credit_departments: [],
  sub_wallets: [{ ...subWallet, transaction_count: 3 }],
};

const student = (over: Record<string, unknown>) => ({
  s_no: 1,
  join_request_id: 1,
  student_id: 41,
  name: "Ravi Kumar",
  enrollment: "21PH001",
  email: "ravi@example.test",
  department_name: "Physics",
  user_type: "student",
  user_type_label: "Student",
  is_active: true,
  status: "linked",
  status_label: "Linked",
  requested_at: "2026-08-01T10:00:00+05:30",
  responded_at: "2026-08-02T10:00:00+05:30",
  sub_wallets: [{ id: 31, department_name: "IIC" }],
  spending_limit_enabled: true,
  weekly_limit: "1000.00",
  monthly_limit: "3000.00",
  week_spent: "1000.00",
  month_spent: "1500.00",
  total_charged: "2500.00",
  total_refunded: "500.00",
  total_spent: "2000.00",
  range_spent: "0.00",
  last_charge_at: "2026-10-05T10:00:00+05:30",
  last_booking_at: "2026-10-05T10:00:00+05:30",
  ...over,
});

const studentsResponse = {
  owner_id: 5,
  owner_name: "Prof. Asha Rao",
  count: 2,
  summary: { linked: 1, pending: 1, removed: 0, declined: 0, cancelled: 0, with_limits: 1, total_spent: "2000.00", range_spent: "0.00", supervised: 1 },
  period: { week_start: "2026-10-05", week_end: "2026-10-11", month_start: "2026-10-01" },
  statuses: [
    { value: "linked", label: "Linked" },
    { value: "pending", label: "Pending approval" },
  ],
  results: [
    student({}),
    student({
      s_no: 2,
      join_request_id: 2,
      student_id: 42,
      name: "Meera Iyer",
      enrollment: "22PH007",
      status: "pending",
      status_label: "Pending approval",
      responded_at: null,
      sub_wallets: [],
      spending_limit_enabled: false,
      week_spent: null,
      month_spent: null,
      total_charged: "0.00",
      total_refunded: "0.00",
      total_spent: "0.00",
      last_booking_at: null,
    }),
  ],
  supervised: [
    { s_no: 1, student_id: 50, name: "Dr. Post Doc", enrollment: "", email: "pd@example.test", department_name: "Physics", user_type_label: "Post Doctoral Fellow", is_active: true },
  ],
};

const txnResponse = {
  count: 0,
  page: 1,
  page_size: 25,
  summary: { transactions: 0, total_credits: "0.00", total_debits: "0.00", net: "0.00" },
  categories: [],
  performers: [],
  results: [],
};

beforeAll(() => {
  Element.prototype.scrollIntoView ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
});

beforeEach(() => {
  state.user = { id: 1, user_type: "admin" };
  state.api.getWalletLedgerOwners.mockResolvedValue({
    data: { count: 1, page: 1, page_size: 25, summary: { owners: 1, total_balance: "1200.00", negative_owners: 0, zero_owners: 0 }, results: [owner] },
  });
  state.api.getWalletLedgerOptions.mockResolvedValue({ data: null });
  state.api.getWalletLedgerOwner.mockResolvedValue({ data: detail });
  state.api.getWalletLedgerTransactions.mockResolvedValue({ data: txnResponse });
  state.api.getWalletLedgerLinkedStudents.mockResolvedValue({ data: studentsResponse });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.localStorage.clear();
});

function UsersProbe() {
  const location = useLocation();
  return <div>Users section {JSON.stringify(location.state)}</div>;
}

function OwnerProbe() {
  const location = useLocation();
  return (
    <div>
      Owner page {location.search} {JSON.stringify(location.state)}
    </div>
  );
}

function renderList() {
  return render(
    <MemoryRouter initialEntries={["/admin/wallet-ledger"]}>
      <Routes>
        <Route path="/admin/wallet-ledger" element={<AdminWalletLedger />} />
        <Route path="/admin/wallet-ledger/:ownerId" element={<OwnerProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderOwner(url = "/admin/wallet-ledger/5?tab=students") {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/admin/wallet-ledger/:ownerId" element={<AdminWalletLedgerOwner />} />
        <Route path="/admin/section/users" element={<UsersProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

const lastCall = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls[fn.mock.calls.length - 1][0];

async function choose(label: string | RegExp, option: string | RegExp, container: HTMLElement = document.body) {
  fireEvent.keyDown(within(container).getByRole("combobox", { name: label }), { key: "Enter" });
  fireEvent.click(await screen.findByRole("option", { name: option }));
}

describe("Owners list: linked students", () => {
  it("filters owners by whether they have linked students", async () => {
    renderList();
    await screen.findByText("Prof. Asha Rao");
    await choose("Linked students", "Has linked students");
    await waitFor(() => expect(lastCall(state.api.getWalletLedgerOwners)).toMatchObject({ has_students: "yes", page: 1 }));
    fireEvent.click(screen.getByRole("button", { name: /Students/ }));
    await waitFor(() => expect(lastCall(state.api.getWalletLedgerOwners).ordering).toBe("-students"));
  });

  it("opens a drawer from the students chip without leaving the page", async () => {
    renderList();
    fireEvent.click(await screen.findByRole("button", { name: "Linked students of Prof. Asha Rao: 2" }));
    const drawer = await screen.findByRole("dialog");
    expect(screen.queryByText(/Owner page/)).toBeNull();
    expect(lastCall(state.api.getWalletLedgerLinkedStudents)).toEqual({ owner: 5 });
    expect(await within(drawer).findByText("Ravi Kumar")).toBeTruthy();
    expect(within(drawer).getByText("Meera Iyer")).toBeTruthy();
    expect(within(drawer).getByText(/Supervised \(not linked to wallet\)/)).toBeTruthy();
    expect(within(drawer).getByText("Dr. Post Doc")).toBeTruthy();

    fireEvent.change(within(drawer).getByLabelText("Search linked students"), { target: { value: "22PH" } });
    expect(within(drawer).queryByText("Ravi Kumar")).toBeNull();
    expect(within(drawer).getByText("Meera Iyer")).toBeTruthy();
    fireEvent.change(within(drawer).getByLabelText("Search linked students"), { target: { value: "" } });
    await choose("Link status", "Linked", drawer);
    expect(within(drawer).queryByText("Meera Iyer")).toBeNull();
    expect(within(drawer).queryByText("Dr. Post Doc")).toBeNull();

    fireEvent.click(within(drawer).getByRole("button", { name: "Open transactions for Ravi Kumar" }));
    expect(await screen.findByText(/Owner page \?student=41/)).toBeTruthy();
    expect(screen.getByText(/"studentName":"Ravi Kumar"/)).toBeTruthy();
  });

  it("opens the full student table from the drawer", async () => {
    renderList();
    fireEvent.click(await screen.findByRole("button", { name: /Linked students of Prof. Asha Rao/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Open wallet and full student table/ }));
    expect(await screen.findByText(/Owner page \?tab=students/)).toBeTruthy();
  });
});

describe("Owner page: Linked students tab", () => {
  it("shows status, limits usage, spend, supervised group and export", async () => {
    renderOwner();
    const table = await screen.findByRole("table", { name: "Linked students" });
    const ravi = await within(table).findByTestId("linked-student-41");
    expect(within(ravi).getByText("Linked")).toBeTruthy();
    expect(within(ravi).getByText("ravi@example.test")).toBeTruthy();
    expect(within(ravi).getByText("ID: 21PH001")).toBeTruthy();
    expect(within(ravi).getByText("Week: ₹1,000.00 of ₹1,000.00").className).toContain("text-red-600");
    expect(within(ravi).getByText("Month: ₹1,500.00 of ₹3,000.00")).toBeTruthy();
    expect(within(ravi).getByText("₹2,000.00")).toBeTruthy();
    expect(within(ravi).getByText("IIC")).toBeTruthy();
    const meera = within(table).getByTestId("linked-student-42");
    expect(within(meera).getByText("Pending approval")).toBeTruthy();
    expect(within(meera).getByText("Never")).toBeTruthy();
    expect(screen.getByText("Export admin-wallet-linked-students")).toBeTruthy();
    expect(screen.getByText("Dr. Post Doc")).toBeTruthy();
    expect(lastCall(state.api.getWalletLedgerLinkedStudents)).toEqual({ owner: "5", ordering: "status" });
  });

  it("searches live, filters by status and period, and sorts", async () => {
    renderOwner();
    await screen.findByTestId("linked-student-41");
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "ra" } });
    await waitFor(() => expect(lastCall(state.api.getWalletLedgerLinkedStudents)).toMatchObject({ search: "ra" }));
    await choose("Link status", "Pending approval");
    await waitFor(() => expect(lastCall(state.api.getWalletLedgerLinkedStudents)).toMatchObject({ status: "pending" }));
    await choose("Spend period", "This month");
    await waitFor(() => expect(lastCall(state.api.getWalletLedgerLinkedStudents).date_from).toMatch(/^\d{4}-\d{2}-01$/));
    expect(await screen.findByRole("button", { name: /In period/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Total spent/ }));
    await waitFor(() => expect(lastCall(state.api.getWalletLedgerLinkedStudents).ordering).toBe("-total_spent"));
  });

  it("clicking a student filters the Transactions tab to their bookings", async () => {
    renderOwner();
    fireEvent.click(await screen.findByRole("button", { name: "Ravi Kumar" }));
    expect(await screen.findByText(/Showing transactions for bookings by/)).toBeTruthy();
    await waitFor(() => expect(lastCall(state.api.getWalletLedgerTransactions)).toMatchObject({ owner: "5", related_user: "41" }));
    expect(screen.getByRole("tab", { name: "Transactions" }).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Show all" }));
    await waitFor(() => expect(lastCall(state.api.getWalletLedgerTransactions).related_user).toBeUndefined());
    expect(screen.queryByText(/Showing transactions for bookings by/)).toBeNull();
  });

  it("opens the student in User Management", async () => {
    renderOwner();
    fireEvent.click(await screen.findByRole("button", { name: "Open Ravi Kumar in User Management" }));
    expect(await screen.findByText(/Users section \{"openUserId":41\}/)).toBeTruthy();
  });

  it("applies a student filter from the URL", async () => {
    renderOwner("/admin/wallet-ledger/5?student=41");
    expect(await screen.findByText("Ravi Kumar")).toBeTruthy();
    await waitFor(() => expect(lastCall(state.api.getWalletLedgerTransactions)).toMatchObject({ related_user: "41" }));
    expect(state.api.getWalletLedgerLinkedStudents).not.toHaveBeenCalled();
  });
});

describe("linked student params", () => {
  it("builds compact params with the owner and range", () => {
    expect(
      linkedStudentParams(
        { ...EMPTY_LINKED_STUDENT_FILTERS, status: "linked", date_preset: "custom", date_from: "2026-04-01" },
        "-total_spent",
        5,
      ),
    ).toEqual({ owner: "5", status: "linked", date_from: "2026-04-01", ordering: "-total_spent" });
  });
});

// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const state = vi.hoisted(() => ({
  user: { id: 1, user_type: "admin" } as { id: number; user_type: string },
  api: {
    getWalletLedgerOwners: vi.fn(),
    getWalletLedgerOptions: vi.fn(),
    getWalletLedgerOwner: vi.fn(),
    getWalletLedgerTransactions: vi.fn(),
    previewWalletLedgerAdjustment: vi.fn(),
    createWalletLedgerAdjustment: vi.fn(),
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
import { EMPTY_TRANSACTION_FILTERS, formatLedgerAmount, presetRange, transactionFilterParams } from "@/lib/walletLedger";

const options = {
  owner_types: [{ value: "faculty", label: "Faculty" }],
  departments: [{ value: "4", label: "Physics" }],
  sub_wallet_departments: [{ value: "9", label: "IIC" }],
  categories: [{ value: "booking_charge", label: "Booking charge" }],
  performers: [{ value: "admin", label: "Administrator" }],
  reasons: [
    { value: "manual_adjustment", label: "Manual adjustment" },
    { value: "correction", label: "Correction" },
  ],
  max_amount: "10000000.00",
};

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

const ownersResponse = {
  count: 1,
  page: 1,
  page_size: 25,
  summary: { owners: 1, total_balance: "1200.00", negative_owners: 0, zero_owners: 0 },
  results: [owner],
};

const txn = {
  s_no: 1,
  id: 77,
  created_at: "2026-10-01T10:00:00+05:30",
  transaction_type: "debit" as const,
  amount: "250.00",
  category: "booking_charge",
  category_label: "Booking charge",
  performer: "user" as const,
  performed_by: "Prof. Asha Rao",
  booking_code: "IIC-XRD-0042",
  sub_wallet_id: 31,
  department_name: "IIC",
  department_code: "IIC",
  owner_id: 5,
  owner_name: "Prof. Asha Rao",
  owner_department: "Physics",
  balance_after: "1200.00",
  description: "Booking #42 - XRD",
  remarks: "",
  reference: "",
  external_reference: "",
  related_user_name: "",
};

const txnResponse = {
  count: 1,
  page: 1,
  page_size: 25,
  summary: { transactions: 1, total_credits: "0.00", total_debits: "250.00", net: "-250.00" },
  categories: options.categories,
  performers: options.performers,
  results: [txn],
};

const detail = {
  ...owner,
  designation: "Professor",
  phone: "",
  wallet_created_at: "2025-01-01T10:00:00+05:30",
  total_credits: "1450.00",
  total_debits: "250.00",
  students: [],
  credit_departments: [{ value: "12", label: "Chemistry" }],
  sub_wallets: [{ ...subWallet, transaction_count: 3, total_credits: "1450.00", total_debits: "250.00" }],
};

beforeAll(() => {
  Element.prototype.scrollIntoView ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
});

beforeEach(() => {
  state.user = { id: 1, user_type: "admin" };
  state.api.getWalletLedgerOwners.mockResolvedValue({ data: ownersResponse });
  state.api.getWalletLedgerOptions.mockResolvedValue({ data: options });
  state.api.getWalletLedgerTransactions.mockResolvedValue({ data: txnResponse });
  state.api.getWalletLedgerOwner.mockResolvedValue({ data: detail });
  state.api.previewWalletLedgerAdjustment.mockImplementation(async (p: { direction: string; amount: string }) => ({
    data: {
      owner: { id: 5, name: "Prof. Asha Rao", email: "asha@example.test" },
      direction: p.direction,
      sub_wallet_id: 31,
      sub_wallet_exists: true,
      department: { id: 9, name: "IIC", code: "IIC" },
      amount: Number(p.amount).toFixed(2),
      balance_before: "1200.00",
      balance_after: (1200 + (p.direction === "credit" ? 1 : -1) * Number(p.amount)).toFixed(2),
    },
  }));
  state.api.createWalletLedgerAdjustment.mockImplementation(async (p: { direction: string; amount: string }) => ({
    data: {
      id: 1,
      reference: "WAC-2026-000001",
      direction: p.direction,
      amount: Number(p.amount).toFixed(2),
      reason: "correction",
      reason_label: "Correction",
      remarks: "",
      external_reference: "",
      balance_before: "1200.00",
      balance_after: "1700.00",
      sub_wallet_id: 31,
      department_name: "IIC",
      transaction_id: 90,
      owner_id: 5,
      notify_owner: true,
      created_at: null,
      replayed: false,
    },
  }));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.localStorage.clear();
});

function renderList(url = "/admin/wallet-ledger") {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/admin/wallet-ledger" element={<AdminWalletLedger />} />
        <Route path="/admin/wallet-ledger/:ownerId" element={<div>Owner page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderOwner() {
  return render(
    <MemoryRouter initialEntries={["/admin/wallet-ledger/5"]}>
      <Routes>
        <Route path="/admin/wallet-ledger/:ownerId" element={<AdminWalletLedgerOwner />} />
      </Routes>
    </MemoryRouter>,
  );
}

const lastCall = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls[fn.mock.calls.length - 1][0];

async function choose(label: string | RegExp, option: string | RegExp, container: HTMLElement = document.body) {
  fireEvent.keyDown(within(container).getByRole("combobox", { name: label }), { key: "Enter" });
  fireEvent.click(await screen.findByRole("option", { name: option }));
}

describe("Wallet owners", () => {
  it("lists owners with balances, summary and S.No", async () => {
    renderList();
    expect(await screen.findByText("Prof. Asha Rao")).toBeTruthy();
    expect(lastCall(state.api.getWalletLedgerOwners)).toMatchObject({ ordering: "name", page: 1, page_size: 25 });
    expect(screen.getAllByText("₹1,200.00").length).toBeGreaterThan(1);
    expect(screen.getByText("Export admin-wallet-owners")).toBeTruthy();
    const row = screen.getByRole("row", { name: /Open wallet of Prof. Asha Rao/ });
    expect(within(row).getAllByRole("cell")[0].textContent).toBe("1");
  });

  it("searches live after two letters and filters by department", async () => {
    renderList();
    await screen.findByText("Prof. Asha Rao");
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "a" } });
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "as" } });
    await waitFor(() => expect(lastCall(state.api.getWalletLedgerOwners)).toMatchObject({ search: "as", page: 1 }));
    await choose("Department", "Physics");
    await waitFor(() => expect(lastCall(state.api.getWalletLedgerOwners)).toMatchObject({ search: "as", department: "4" }));
    fireEvent.click(screen.getByRole("button", { name: /Clear filters/ }));
    await waitFor(() => expect(lastCall(state.api.getWalletLedgerOwners).department).toBeUndefined());
  });

  it("sorts by balance and offers 25 / 100 / 500 rows", async () => {
    renderList();
    await screen.findByText("Prof. Asha Rao");
    fireEvent.click(screen.getByRole("button", { name: /Total balance/ }));
    await waitFor(() => expect(lastCall(state.api.getWalletLedgerOwners).ordering).toBe("-balance"));
    fireEvent.keyDown(screen.getByTestId("rows-per-page"), { key: "Enter" });
    expect((await screen.findAllByRole("option")).map((o) => o.textContent)).toEqual(["25", "100", "500"]);
    fireEvent.click(screen.getByRole("option", { name: "100" }));
    await waitFor(() => expect(lastCall(state.api.getWalletLedgerOwners).page_size).toBe(100));
  });

  it("opens the owner page on row click", async () => {
    renderList();
    fireEvent.click(await screen.findByRole("row", { name: /Open wallet of Prof. Asha Rao/ }));
    expect(await screen.findByText("Owner page")).toBeTruthy();
  });

  it("shows an error with a retry", async () => {
    state.api.getWalletLedgerOwners.mockResolvedValueOnce({ error: "Server unavailable" });
    renderList();
    expect(await screen.findByText("Server unavailable")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Prof. Asha Rao")).toBeTruthy();
  });

  it("badges test accounts and filters them", async () => {
    state.api.getWalletLedgerOwners.mockResolvedValue({
      data: { ...ownersResponse, results: [{ ...owner, is_test_account: true }] },
    });
    renderList();
    const row = await screen.findByRole("row", { name: /Open wallet of Prof. Asha Rao/ });
    expect(within(row).getByTestId("test-account-badge").textContent).toBe("Test — not counted in revenue");
    expect(lastCall(state.api.getWalletLedgerOwners).test).toBeUndefined();
    await choose("Test accounts", "Hide test accounts");
    await waitFor(() => expect(lastCall(state.api.getWalletLedgerOwners)).toMatchObject({ test: "hide", page: 1 }));
  });

  it("is limited to the Main Administrator", async () => {
    state.user = { id: 2, user_type: "dept_admin" };
    renderList();
    expect(await screen.findByText("Main Administrator only")).toBeTruthy();
    expect(state.api.getWalletLedgerOwners).not.toHaveBeenCalled();
    expect(state.api.getWalletLedgerOptions).not.toHaveBeenCalled();
  });
});

describe("All transactions", () => {
  it("shows signed amounts, booking links and filters by date preset and type", async () => {
    renderList("/admin/wallet-ledger?tab=transactions");
    expect(await screen.findByText("TXN-77")).toBeTruthy();
    expect(screen.getByRole("link", { name: "IIC-XRD-0042" }).getAttribute("href")).toBe("/booking-management?expand=IIC-XRD-0042");
    const row = screen.getByText("TXN-77").closest("tr") as HTMLElement;
    expect(within(row).getByText(/−\s*₹250.00/).className).toContain("text-red-600");
    expect(screen.getByText("Export admin-wallet-transactions")).toBeTruthy();
    await choose("Date", "Last 7 days");
    await waitFor(() => {
      const p = lastCall(state.api.getWalletLedgerTransactions);
      expect(p.date_from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(p.date_to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
    await choose("Type", "Debits");
    await waitFor(() => expect(lastCall(state.api.getWalletLedgerTransactions)).toMatchObject({ type: "debit", page: 1 }));
    expect(lastCall(state.api.getWalletLedgerTransactions).owner).toBeUndefined();
  });
});

describe("Owner page and credit / debit", () => {
  it("shows the owner card and only that owner's transactions", async () => {
    renderOwner();
    expect(await screen.findByText("Professor · Faculty")).toBeTruthy();
    await screen.findByText("TXN-77");
    expect(lastCall(state.api.getWalletLedgerTransactions)).toMatchObject({ owner: "5" });
    expect(screen.queryByTestId("test-account-badge")).toBeNull();
  });

  it("badges a test account owner", async () => {
    state.api.getWalletLedgerOwner.mockResolvedValue({ data: { ...detail, is_test_account: true } });
    renderOwner();
    expect(await screen.findByText("Professor · Faculty")).toBeTruthy();
    expect(screen.getByTestId("test-account-badge").textContent).toBe("Test — not counted in revenue");
  });

  it("shows the owner's photo on the ID card, enlarges it, and falls back to initials if it fails", async () => {
    state.api.getWalletLedgerOwner.mockResolvedValue({
      data: { ...detail, profile_picture_url: "https://api.example.test/api/users/5/profile-picture/" },
    });
    renderOwner();
    const enlarge = await screen.findByRole("button", { name: "Enlarge photo of Prof. Asha Rao" });
    const img = within(enlarge).getByRole("img", { name: "Prof. Asha Rao" });
    expect(img.getAttribute("src")).toBe("https://api.example.test/api/users/5/profile-picture/");
    expect(screen.getByText("ID: E100")).toBeTruthy();
    fireEvent.click(enlarge);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("img", { name: "Prof. Asha Rao" })).toBeTruthy();
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.error(img);
    expect((await screen.findByTestId("owner-photo-fallback")).textContent).toBe("AR");
    expect(screen.queryByRole("button", { name: /Enlarge photo/ })).toBeNull();
  });

  it("shows initials on the ID card when the owner has no photo", async () => {
    renderOwner();
    expect((await screen.findByTestId("owner-photo-fallback")).textContent).toBe("AR");
    expect(screen.queryByRole("button", { name: /Enlarge photo/ })).toBeNull();
  });

  it("credits after a confirmation step showing the new balance", async () => {
    renderOwner();
    fireEvent.click(await screen.findByRole("button", { name: "Credit IIC" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("checkbox", { name: /Notify wallet owner by email/ }).getAttribute("aria-checked")).toBe("true");
    const review = within(dialog).getByRole("button", { name: "Review" }) as HTMLButtonElement;
    expect(review.disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText("Amount (₹)"), { target: { value: "500" } });
    await choose("Reason", "Correction", dialog);
    fireEvent.change(within(dialog).getByLabelText("Remarks"), { target: { value: "Missed refund" } });
    fireEvent.change(within(dialog).getByLabelText(/External reference/), { target: { value: "UTR123" } });
    fireEvent.click(review);
    await waitFor(() =>
      expect(state.api.previewWalletLedgerAdjustment).toHaveBeenCalledWith({
        owner_id: 5,
        direction: "credit",
        amount: "500",
        sub_wallet_id: 31,
        department_id: null,
      }),
    );
    expect(await within(dialog).findByText("Confirm credit")).toBeTruthy();
    expect(within(dialog).getByTestId("wl-new-balance").textContent).toBe("₹1,700.00");
    fireEvent.click(within(dialog).getByRole("button", { name: "Credit ₹500.00" }));
    await waitFor(() => expect(state.api.createWalletLedgerAdjustment).toHaveBeenCalledTimes(1));
    expect(lastCall(state.api.createWalletLedgerAdjustment)).toMatchObject({
      owner_id: 5,
      direction: "credit",
      amount: "500",
      reason: "correction",
      remarks: "Missed refund",
      external_reference: "UTR123",
      notify_owner: true,
      sub_wallet_id: 31,
    });
    expect(lastCall(state.api.createWalletLedgerAdjustment).client_request_id.length).toBeGreaterThanOrEqual(8);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(state.api.getWalletLedgerOwner).toHaveBeenCalledTimes(2));
  });

  it("blocks a debit above the balance and retries with the same request id", async () => {
    state.api.createWalletLedgerAdjustment.mockResolvedValueOnce({ error: "Network error" });
    renderOwner();
    fireEvent.click(await screen.findByRole("button", { name: "Debit IIC" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Amount (₹)"), { target: { value: "1500" } });
    expect(within(dialog).getByText(/cannot exceed the available ₹1,200.00/)).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText("Amount (₹)"), { target: { value: "200.5" } });
    await choose("Reason", "Manual adjustment", dialog);
    fireEvent.change(within(dialog).getByLabelText("Remarks"), { target: { value: "Duplicate credit" } });
    fireEvent.click(within(dialog).getByRole("checkbox", { name: /Notify wallet owner/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Review" }));
    expect(await within(dialog).findByText("Confirm debit")).toBeTruthy();
    expect(within(dialog).getByTestId("wl-new-balance").textContent).toBe("₹999.50");
    const confirm = within(dialog).getByRole("button", { name: "Debit ₹200.50" });
    fireEvent.click(confirm);
    expect(await within(dialog).findByText("Network error")).toBeTruthy();
    fireEvent.click(confirm);
    await waitFor(() => expect(state.api.createWalletLedgerAdjustment).toHaveBeenCalledTimes(2));
    const [first, second] = state.api.createWalletLedgerAdjustment.mock.calls.map((c) => c[0]);
    expect(second.client_request_id).toBe(first.client_request_id);
    expect(second).toMatchObject({ direction: "debit", amount: "200.5", notify_owner: false });
  });
});

describe("wallet ledger helpers", () => {
  it("formats rupees with Indian grouping", () => {
    expect(formatLedgerAmount("1234567.5")).toBe("₹12,34,567.50");
    expect(formatLedgerAmount(-20)).toBe("−₹20.00");
  });

  it("computes preset ranges, with the financial year from 1 April", () => {
    const today = new Date(2026, 1, 15);
    expect(presetRange("fy", today)).toEqual({ from: "2025-04-01", to: "2026-02-15" });
    expect(presetRange("7d", today)).toEqual({ from: "2026-02-09", to: "2026-02-15" });
    expect(presetRange("month", new Date(2026, 9, 8))).toEqual({ from: "2026-10-01", to: "2026-10-08" });
  });

  it("builds compact transaction params", () => {
    expect(
      transactionFilterParams({ ...EMPTY_TRANSACTION_FILTERS, type: "credit", date_preset: "custom", date_from: "2026-01-01" }, "-amount", 9),
    ).toEqual({ type: "credit", date_from: "2026-01-01", owner: "9", ordering: "-amount" });
  });
});

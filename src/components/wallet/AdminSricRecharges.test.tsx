// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import AdminSricRecharges from "./AdminSricRecharges";

const api = vi.hoisted(() => ({
  getAdminSricRecharges: vi.fn(),
  refreshAdminSricRecharges: vi.fn(),
  creditSricRecharge: vi.fn(),
  creditReadySricRecharges: vi.fn(),
  rejectSricRecharge: vi.fn(),
  verifySricRecharge: vi.fn(),
  lookupSricRechargeUser: vi.fn(),
  getSricRechargeSettings: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ apiClient: api }));
vi.mock("@/components/ExportMenu", () => ({
  ExportMenu: ({ report }: { report: string }) => <span data-testid="export-menu">{report}</span>,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));

const base = {
  project_number: "XYZ-9001/26-27",
  receiver_code: "IIC-000-002",
  receiver_label: "IIC",
  department_id: 3,
  department_name: "Example Centre",
  amount: "5000.00",
  amount_raw: "5000",
  financial_year: "2026-27",
  review_reason: "",
  review_message: "",
  credited_at: null,
  balance_after: null,
  email_date: "2026-10-01T09:55:00+05:30",
  created_at: "2026-10-01T09:56:00+05:30",
  fund_receipt_verified: false,
  pi_name: "Test Faculty One",
  employee_id: "900001",
  matched_user: { id: 41, name: "Test Faculty One", email: "faculty.one@example.test", emp_id: "900001" },
  can_credit: false,
  can_reject: false,
  can_verify: false,
};

const rows = [
  {
    ...base,
    id: 1,
    reference: "SWR-000001",
    ledger_id: "L-1001",
    status: "needs_review",
    status_display: "Needs review",
    review_reason: "origin_unverified",
    review_message: "The email's origin could not be verified, so it is not credited automatically.",
    origin_verified: false,
    can_credit: true,
    can_reject: true,
  },
  {
    ...base,
    id: 2,
    reference: "SWR-000002",
    ledger_id: "L-1001",
    status: "duplicate",
    status_display: "Duplicate",
    duplicate_of_reference: "SWR-000001",
  },
  {
    ...base,
    id: 3,
    reference: "SWR-000003",
    ledger_id: "L-1002",
    status: "credited",
    status_display: "Credited",
    credited_at: "2026-10-01T10:00:00+05:30",
    can_verify: true,
  },
  {
    ...base,
    id: 4,
    reference: "SWR-000004",
    ledger_id: "L-1003",
    status: "awaiting_credit",
    status_display: "Ready to credit (auto-credit off)",
    can_credit: true,
    can_reject: true,
  },
];

function listResponse() {
  return {
    data: {
      results: rows,
      count: rows.length,
      page: 1,
      page_size: 25,
      status_counts: { needs_review: 1, duplicate: 1, credited: 1, awaiting_credit: 1 },
      financial_years: ["2026-27"],
      receivers: [
        { code: "IIC-000-002", label: "IIC" },
        { code: "TINK-000-01", label: "Tinkering" },
      ],
      credited_total: "5000.00",
      scan_enabled: true,
      auto_credit_enabled: false,
      last_scan_at: null,
      last_scan_result: {},
    },
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AdminSricRecharges", () => {
  it("lists SRIC rows; duplicates are visible but cannot be credited", async () => {
    api.getAdminSricRecharges.mockResolvedValue(listResponse());
    render(<AdminSricRecharges />);
    const dup = await screen.findByTestId("sric-row-2");
    expect(within(dup).getByText("Duplicate")).toBeTruthy();
    expect(within(dup).getByText("Same as SWR-000001")).toBeTruthy();
    expect(within(dup).queryByRole("button", { name: /Credit/ })).toBeNull();
    expect(within(dup).queryByRole("button", { name: /Reject/ })).toBeNull();
    expect(within(screen.getByTestId("sric-row-1")).getByText("Email origin not verified")).toBeTruthy();
    expect(screen.getByText("Auto-credit: off")).toBeTruthy();
    expect(screen.getByTestId("export-menu").textContent).toBe("sric-wallet-recharges");
  });

  it("credits a needs-review row after confirmation", async () => {
    api.getAdminSricRecharges.mockResolvedValue(listResponse());
    api.creditSricRecharge.mockResolvedValue({ data: { message: "Credited ₹5,000.00.", row: rows[0] } });
    render(<AdminSricRecharges />);
    const row = await screen.findByTestId("sric-row-1");
    fireEvent.click(within(row).getByRole("button", { name: "Credit" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /Credit ₹/ }));
    await waitFor(() => expect(api.creditSricRecharge).toHaveBeenCalledWith(1, { note: "" }));
    await waitFor(() => expect(api.getAdminSricRecharges).toHaveBeenCalledTimes(2));
  });

  it("records fund-receipt verification with remarks", async () => {
    api.getAdminSricRecharges.mockResolvedValue(listResponse());
    api.verifySricRecharge.mockResolvedValue({ data: { message: "Fund receipt verified.", row: rows[2] } });
    render(<AdminSricRecharges />);
    const row = await screen.findByTestId("sric-row-3");
    expect(within(row).getByText("Not verified")).toBeTruthy();
    fireEvent.click(within(row).getByRole("button", { name: /Verify/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Remarks"), { target: { value: "Matched SRIC ledger" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(api.verifySricRecharge).toHaveBeenCalledWith(3, true, "Matched SRIC ledger"));
  });

  it("requires a reason to reject and filters by status", async () => {
    api.getAdminSricRecharges.mockResolvedValue(listResponse());
    api.rejectSricRecharge.mockResolvedValue({ data: { message: "Row rejected.", row: rows[3] } });
    render(<AdminSricRecharges />);
    const row = await screen.findByTestId("sric-row-4");
    fireEvent.click(within(row).getByRole("button", { name: /Reject/ }));
    const dialog = await screen.findByRole("dialog");
    const reject = within(dialog).getByRole("button", { name: "Reject" }) as HTMLButtonElement;
    expect(reject.disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: "Test entry from SRIC" } });
    fireEvent.click(reject);
    await waitFor(() => expect(api.rejectSricRecharge).toHaveBeenCalledWith(4, "Test entry from SRIC"));

    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "needs_review" } });
    await waitFor(() =>
      expect(api.getAdminSricRecharges).toHaveBeenLastCalledWith(expect.objectContaining({ status: "needs_review", page: 1 })),
    );
  });

  it("badges test entries, shows a reversed credit with its adjustment and can hide test entries", async () => {
    const testRow = {
      ...base,
      id: 9,
      reference: "SWR-000009",
      ledger_id: "TEST-L-2001",
      status: "credited",
      status_display: "Reversed",
      credited_at: "2026-10-09T20:00:00+05:30",
      is_test: true,
      reversed: true,
      reversed_at: "2026-10-09T20:10:00+05:30",
      reversal_ref: "WAD-2026-000123",
      reversed_by_name: "Main Admin",
    };
    const res = listResponse();
    api.getAdminSricRecharges.mockResolvedValue({ data: { ...res.data, results: [...rows, testRow], test_count: 1 } });
    render(<AdminSricRecharges />);
    const row = await screen.findByTestId("sric-row-9");
    expect(within(row).getByText("TEST")).toBeTruthy();
    expect(within(row).getByText("Reversed")).toBeTruthy();
    expect(within(row).getByRole("link", { name: "WAD-2026-000123" }).getAttribute("href")).toBe("/admin/wallet-ledger/41");
    expect(within(row).getByText("Not applicable (reversed)")).toBeTruthy();
    expect(within(row).queryByRole("button", { name: /Verify/ })).toBeNull();
    expect(within(screen.getByTestId("sric-row-3")).queryByText("TEST")).toBeNull();
    expect(screen.getByText(/test entries are not counted in totals or exports/)).toBeTruthy();

    fireEvent.click(screen.getByRole("switch", { name: /Show test entries/ }));
    await waitFor(() =>
      expect(api.getAdminSricRecharges).toHaveBeenLastCalledWith(expect.objectContaining({ test: "hide", page: 1 })),
    );
  });
});

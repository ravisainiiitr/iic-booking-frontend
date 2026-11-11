// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import AdminOfflineRecharges from "./AdminOfflineRecharges";

const api = vi.hoisted(() => ({
  getOfflineRechargeQueue: vi.fn(),
  getOfflineRecharge: vi.fn(),
  decideOfflineRecharge: vi.fn(),
  reconcileOfflineRecharge: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ apiClient: api }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/PageShell", () => ({
  PageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PageHero: ({ title }: { title: string }) => <h1>{title}</h1>,
  StandaloneOnly: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  heroButtonClass: { secondary: "" },
}));

const base = {
  id: 5,
  reference: "IIC-TXN-000005",
  status: "PENDING",
  department: { id: 3, name: "IIC" },
  claimed_amount: "5000.00",
  approved_amount: null,
  payment_date: "2026-11-10",
  payment_mode: "NEFT",
  payment_mode_label: "NEFT",
  payment_mode_other: "",
  transaction_reference: "SBIN12345678",
  payer_bank: "SBI",
  payer_account_name: "Acme Labs",
  paid_into: "IIC grant",
  remarks: "",
  receipt_url: "https://media.example/r.pdf",
  receipt_name: "r.pdf",
  decision_note: "",
  decided_at: null,
  decided_by: "",
  wallet_transaction_id: null,
  reconciliation_status: "NOT_STARTED",
  reconciled_reference: "",
  reconciled_credit_date: null,
  reconciliation_note: "",
  reconciled_at: null,
  created_at: "2026-11-11T10:00:00+05:30",
  user: { id: 1, name: "Acme User", email: "a@example.com", organisation: "Acme" },
};
const pending = { ...base, state: "pending", state_label: "Pending approval", can_decide: true, can_reconcile: false };
const approved = {
  ...base,
  status: "APPROVED",
  state: "approved",
  state_label: "Approved · awaiting reconciliation",
  approved_amount: "5000.00",
  can_decide: false,
  can_reconcile: true,
};

function queue(requests: unknown[], role = "accounts") {
  return {
    data: { role, state: "pending", counts: { pending: 1, approved: 0, mismatch: 0, reconciled: 0, rejected: 0 }, requests },
  };
}

const renderPage = () =>
  render(
    <MemoryRouter>
      <AdminOfflineRecharges />
    </MemoryRouter>,
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AdminOfflineRecharges", () => {
  it("approves with a required note and an amount no higher than declared", async () => {
    api.getOfflineRechargeQueue.mockResolvedValue(queue([pending]));
    api.getOfflineRecharge.mockResolvedValue({
      data: { request: { ...pending, audit: [{ action: "offline_payment_submitted", from_status: "", to_status: "PENDING", actor: "Acme User", message: "", at: "2026-11-11T10:00:00+05:30" }] } },
    });
    api.decideOfflineRecharge.mockResolvedValue({ data: { request: approved, message: "Approved" } });
    renderPage();
    expect(await screen.findByText(/department and can reconcile/)).toBeTruthy();
    fireEvent.click(await screen.findByTestId("orc-queue-row"));
    expect(await screen.findByText("Submitted")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    const confirm = screen.getByTestId("orc-confirm") as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Amount to credit (₹)"), { target: { value: "4500" } });
    fireEvent.change(screen.getByLabelText("Approval note"), { target: { value: "Bank shows 4,500" } });
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(api.decideOfflineRecharge).toHaveBeenCalledWith(5, "approve", { note: "Bank shows 4,500", approved_amount: "4500" }),
    );
  });

  it("rejects only with a reason", async () => {
    api.getOfflineRechargeQueue.mockResolvedValue(queue([pending]));
    api.getOfflineRecharge.mockResolvedValue({ data: { request: pending } });
    api.decideOfflineRecharge.mockResolvedValue({ data: { request: { ...pending, state: "rejected" }, message: "Rejected." } });
    renderPage();
    fireEvent.click(await screen.findByTestId("orc-queue-row"));
    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    const confirm = screen.getByTestId("orc-confirm") as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Reason for rejection"), { target: { value: "Receipt unreadable" } });
    fireEvent.click(confirm);
    await waitFor(() => expect(api.decideOfflineRecharge).toHaveBeenCalledWith(5, "reject", { note: "Receipt unreadable" }));
  });

  it("hides decisions the viewer may not take and reconciles with reference and date", async () => {
    api.getOfflineRechargeQueue.mockResolvedValue(queue([approved]));
    api.getOfflineRecharge.mockResolvedValue({ data: { request: approved } });
    api.reconcileOfflineRecharge.mockResolvedValue({ data: { request: { ...approved, state: "reconciled" }, message: "Saved" } });
    renderPage();
    fireEvent.click(await screen.findByTestId("orc-queue-row"));
    await screen.findByRole("button", { name: "Mark reconciled" });
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Mark reconciled" }));
    const confirm = screen.getByTestId("orc-confirm") as HTMLButtonElement;
    fireEvent.change(screen.getByLabelText("Bank / grant credit reference"), { target: { value: "GRANT-CR-77" } });
    expect(confirm.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Date funds were credited"), { target: { value: "2026-11-05" } });
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(api.reconcileOfflineRecharge).toHaveBeenCalledWith(5, {
        outcome: "reconciled",
        reference: "GRANT-CR-77",
        credit_date: "2026-11-05",
        note: "",
      }),
    );
  });

  it("switches state tabs", async () => {
    api.getOfflineRechargeQueue.mockResolvedValue(queue([]));
    renderPage();
    await screen.findByText("Nothing here.");
    fireEvent.click(screen.getByRole("tab", { name: /Mismatch/ }));
    await waitFor(() => expect(api.getOfflineRechargeQueue).toHaveBeenLastCalledWith({ state: "mismatch", q: undefined }));
  });
});

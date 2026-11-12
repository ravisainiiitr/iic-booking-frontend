// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import OfflineRechargePanel from "./OfflineRechargePanel";

const api = vi.hoisted(() => ({
  getOfflineRecharges: vi.fn(),
  getDepartmentsForRecharge: vi.fn(),
  submitOfflineRecharge: vi.fn(),
  cancelOfflineRecharge: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ apiClient: api }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const row = (over: Record<string, unknown> = {}) => ({
  id: 7,
  reference: "IIC-TXN-000007",
  state: "pending",
  state_label: "Pending approval",
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
  payer_account_name: "Acme",
  paid_into: "",
  remarks: "",
  receipt_url: "https://media.example/receipt.pdf",
  receipt_name: "receipt.pdf",
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
  user: { id: 1, name: "Acme", email: "a@example.com", organisation: "" },
  can_cancel: true,
  ...over,
});

function list(requests: unknown[], available = true) {
  return { data: { available, payment_modes: [], max_receipt_mb: 10, requests } };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("OfflineRechargePanel", () => {
  it("is hidden when the option is closed and nothing was recorded", async () => {
    api.getOfflineRecharges.mockResolvedValue(list([], false));
    const { container } = render(<OfflineRechargePanel />);
    await waitFor(() => expect(api.getOfflineRecharges).toHaveBeenCalled());
    expect(container.querySelector("[data-testid='offline-recharge-panel']")).toBeNull();
  });

  it("shows each state, the rejection reason and the receipt link", async () => {
    api.getOfflineRecharges.mockResolvedValue(
      list([
        row(),
        row({ id: 8, state: "rejected", state_label: "Rejected", decision_note: "Unreadable receipt", can_cancel: false }),
        row({ id: 9, state: "reconciled", state_label: "Reconciled", approved_amount: "4500.00", can_cancel: false }),
      ]),
    );
    render(<OfflineRechargePanel />);
    expect(await screen.findByTestId("orc-state-pending")).toBeTruthy();
    expect(screen.getByTestId("orc-state-rejected")).toBeTruthy();
    expect(screen.getByTestId("orc-state-reconciled")).toBeTruthy();
    expect(screen.getByText("Reason: Unreadable receipt")).toBeTruthy();
    expect(screen.getByText(/Approved ₹4,500.00 of ₹5,000.00 declared/)).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /Receipt/ })[0].getAttribute("href")).toBe("https://media.example/receipt.pdf");
    expect(screen.getAllByRole("button", { name: "Cancel" })).toHaveLength(1);
  });

  it("offers a camera capture input and submits the form with the photo", async () => {
    api.getOfflineRecharges.mockResolvedValue(list([]));
    api.getDepartmentsForRecharge.mockResolvedValue({
      data: { departments: [{ id: 3, name: "IIC", code: "IIC", department_type: "internal" }] },
    });
    api.submitOfflineRecharge.mockResolvedValue({ data: { request: row(), created: true, message: "Submitted" } });
    render(<OfflineRechargePanel />);
    fireEvent.click(await screen.findByTestId("orc-open"));

    const camera = await screen.findByTestId("orc-camera-input");
    expect(camera.getAttribute("capture")).toBe("environment");
    expect(camera.getAttribute("accept")).toBe("image/*");
    expect(screen.getByTestId("orc-file-input").getAttribute("accept")).toContain("application/pdf");

    // Nothing filled: the form explains what is missing and sends nothing.
    fireEvent.click(screen.getByTestId("orc-submit"));
    expect(await screen.findByTestId("error-receipt_file")).toBeTruthy();
    expect(api.submitOfflineRecharge).not.toHaveBeenCalled();

    await waitFor(() => expect((screen.getByLabelText("Credit to (department)") as HTMLSelectElement).value).toBe("3"));
    fireEvent.change(screen.getByLabelText("Amount paid (₹)"), { target: { value: "5000" } });
    fireEvent.change(screen.getByLabelText("Date of payment"), { target: { value: "2026-11-01" } });
    fireEvent.change(screen.getByLabelText("Mode"), { target: { value: "UPI" } });
    fireEvent.change(screen.getByLabelText(/UTR \/ transaction reference/), { target: { value: "412345678901" } });
    fireEvent.change(screen.getByLabelText("Payer bank"), { target: { value: "HDFC Bank" } });
    fireEvent.change(screen.getByLabelText("Payer account name"), { target: { value: "Acme Labs" } });
    const photo = new File(["jpeg"], "IMG_20261101.jpg", { type: "image/jpeg" });
    fireEvent.change(camera, { target: { files: [photo] } });
    fireEvent.click(screen.getByTestId("orc-submit"));

    await waitFor(() => expect(api.submitOfflineRecharge).toHaveBeenCalledTimes(1));
    const fd = api.submitOfflineRecharge.mock.calls[0][0] as FormData;
    expect(fd.get("payment_mode")).toBe("UPI");
    expect(fd.get("department_id")).toBe("3");
    expect((fd.get("receipt_file") as File).name).toBe("IMG_20261101.jpg");
    expect(String(fd.get("client_request_id"))).not.toBe("");
    await waitFor(() => expect(api.getOfflineRecharges).toHaveBeenCalledTimes(2));
  });

  it("cancels a pending request", async () => {
    api.getOfflineRecharges.mockResolvedValue(list([row()]));
    api.cancelOfflineRecharge.mockResolvedValue({ data: { request: row({ state: "cancelled" }), message: "Request cancelled." } });
    render(<OfflineRechargePanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(api.cancelOfflineRecharge).toHaveBeenCalledWith(7));
  });
});

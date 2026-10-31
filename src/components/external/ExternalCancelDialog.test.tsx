// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  cancellationQuote: vi.fn(),
  cancelWithRefund: vi.fn(),
  addRefundAccount: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/externalBookingApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/externalBookingApi")>();
  return { ...actual, externalBookingApi: api };
});

import { ExternalBookingApiError, type CancellationQuote } from "@/lib/externalBookingApi";
import { ExternalCancelDialog } from "./ExternalCancelDialog";

const base: CancellationQuote = {
  applies: true,
  disruption: false,
  bank_refund_allowed: false,
  tier: "half",
  penalty_percent: 50,
  paid: "1298.00",
  gst_paid: "198.00",
  return_shipping: "118.00",
  refundable_base: "1000.00",
  gst_refunded: true,
  refund_base: "500.00",
  refund_gst: "90.00",
  refund: "590.00",
  free_until: "2026-11-10T10:00:00+05:30",
  half_until: "2026-11-11T10:00:00+05:30",
  rules: { free_hours: 48, half_hours: 24, half_penalty_percent: 50 },
  accounts: [],
};

function renderDialog(onCancelled = vi.fn()) {
  render(<ExternalCancelDialog bookingId={7} bookingLabel="IICX-7" open onOpenChange={vi.fn()} onCancelled={onCancelled} />);
  return onCancelled;
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("ExternalCancelDialog", () => {
  it("shows the penalty, the non-refundable shipping and the refund before confirming, and sends the shown amount", async () => {
    api.cancellationQuote.mockResolvedValue(base);
    api.cancelWithRefund.mockResolvedValue({ refund: { refund_amount: "590.00" }, booking_status: "REFUNDED" });
    const onCancelled = renderDialog();
    const breakdown = await screen.findByTestId("refund-breakdown");
    expect(breakdown.textContent).toContain("Return shipping (non-refundable)");
    expect(breakdown.textContent).toContain("50%");
    expect(screen.getByTestId("refund-total").textContent).toBe("₹590.00");
    expect(screen.queryByText(/Where should the refund go/)).toBeNull(); // no bank choice outside a disruption
    fireEvent.click(screen.getByTestId("confirm-cancel"));
    await waitFor(() => expect(onCancelled).toHaveBeenCalled());
    expect(api.cancelWithRefund).toHaveBeenCalledWith(7, expect.objectContaining({ destination: "wallet", expected_refund: "590.00" }));
  });

  it("says plainly when nothing is refunded", async () => {
    api.cancellationQuote.mockResolvedValue({ ...base, tier: "full", penalty_percent: 100, refund: "0.00", refund_base: "0.00", refund_gst: "0.00" });
    renderDialog();
    expect(await screen.findByText(/the whole amount is kept/)).toBeTruthy();
    expect(screen.getByTestId("confirm-cancel").textContent).toContain("Cancel without refund");
  });

  it("after a disruption saves a bank account and asks for a bank refund", async () => {
    api.cancellationQuote.mockResolvedValue({ ...base, tier: "disruption", penalty_percent: 0, disruption: true, bank_refund_allowed: true, refund: "1180.00" });
    api.addRefundAccount.mockResolvedValue({ id: 3, account_holder_name: "A", bank_name: "SBI", ifsc: "SBIN0001234", branch: "", account_number: "XXXX9012", is_default: true, created_at: null });
    api.cancelWithRefund.mockResolvedValue({ refund: { refund_amount: "1180.00" }, booking_status: "CANCELLED" });
    renderDialog();
    fireEvent.click(await screen.findByText("My bank account"));
    fireEvent.change(screen.getByLabelText("Account holder's name"), { target: { value: "Asha Verma" } });
    fireEvent.change(screen.getByLabelText("Bank"), { target: { value: "State Bank of India" } });
    fireEvent.change(screen.getByLabelText("Account number"), { target: { value: "123456789012" } });
    fireEvent.change(screen.getByLabelText("Account number again"), { target: { value: "123456789012" } });
    fireEvent.change(screen.getByLabelText("IFSC"), { target: { value: "SBIN0001234" } });
    fireEvent.click(screen.getByTestId("confirm-cancel"));
    await waitFor(() => expect(api.cancelWithRefund).toHaveBeenCalled());
    expect(api.addRefundAccount).toHaveBeenCalled();
    expect(api.cancelWithRefund).toHaveBeenCalledWith(7, expect.objectContaining({ destination: "bank", bank_account_id: 3 }));
  });

  it("reloads the quote when the amount changed while the dialog was open", async () => {
    api.cancellationQuote.mockResolvedValueOnce(base).mockResolvedValueOnce({ ...base, tier: "full", penalty_percent: 100, refund: "0.00" });
    api.cancelWithRefund.mockRejectedValue(new ExternalBookingApiError(409, { error: "changed", code: "quote_changed" }));
    renderDialog();
    fireEvent.click(await screen.findByTestId("confirm-cancel"));
    expect(await screen.findByText(/refund amount changed/)).toBeTruthy();
    await waitFor(() => expect(api.cancellationQuote).toHaveBeenCalledTimes(2));
  });
});

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ labFailureQuote: vi.fn(), refundLabFailure: vi.fn() }));
vi.mock("@/lib/externalBookingApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/externalBookingApi")>()),
  externalBookingApi: api,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import LabFailureRefundDialog from "./LabFailureRefundDialog";

const quote = (over: Record<string, unknown> = {}) => ({
  paid: "1298.00", gst_paid: "198.00", return_shipping: "118.00", refundable_base: "1000.00", refund_base: "1100.00",
  refund_gst: "198.00", refund: "1298.00", gst_refunded: true, invoice_requested: false, shipping_refunded: "118.00",
  portion_percent: 100, service_refunded: "1000.00", tier: "lab_failure", kinds: {}, ...over,
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const renderDialog = (onDone = vi.fn()) =>
  render(<LabFailureRefundDialog bookingId={42} bookingReference="FESEM-42" open onOpenChange={vi.fn()} onDone={onDone} />);

describe("LabFailureRefundDialog", () => {
  it("shows the server's figures and refunds the amount shown", async () => {
    api.labFailureQuote.mockResolvedValue(quote());
    api.refundLabFailure.mockResolvedValue({ refund: {}, booking_status: "REFUNDED" });
    const onDone = vi.fn();
    renderDialog(onDone);
    const breakdown = await screen.findByTestId("lab-failure-breakdown");
    expect(within(breakdown).getByText("Return shipping refunded")).toBeTruthy();
    expect(screen.getByTestId("lab-failure-total").textContent).toMatch(/1,298/);
    const submit = screen.getByRole("button", { name: /Refund/ });
    expect((submit as HTMLButtonElement).disabled).toBe(true); // no reason yet
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: "The detector failed during the run." } });
    fireEvent.click(screen.getByRole("button", { name: /Refund .*1,298/ }));
    await waitFor(() => expect(api.refundLabFailure).toHaveBeenCalled());
    expect(api.refundLabFailure).toHaveBeenCalledWith(42, {
      kind: "equipment_failure", reason: "The detector failed during the run.", portion_percent: 100, expected_refund: "1298.00",
    });
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it("asks the server again for a partial share and explains GST held back after an invoice", async () => {
    api.labFailureQuote.mockImplementation(async (_id: number, portion: number) =>
      quote({ portion_percent: portion, refund: "500.00", refund_base: "500.00", refund_gst: "0.00", gst_refunded: false,
              invoice_requested: true, shipping_refunded: "0.00", service_refunded: "500.00" }),
    );
    renderDialog();
    await screen.findByTestId("lab-failure-breakdown");
    fireEvent.click(screen.getByRole("radio", { name: /Part of the service charges/ }));
    await waitFor(() => expect(api.labFailureQuote).toHaveBeenLastCalledWith(42, 50));
    expect(await screen.findByText(/settled by SRIC with a credit note/)).toBeTruthy();
    expect(screen.getByText("Not refunded")).toBeTruthy();
  });

  it("shows the server's refusal", async () => {
    api.labFailureQuote.mockRejectedValue(new Error("This booking has already been refunded."));
    renderDialog();
    expect((await screen.findByRole("alert")).textContent).toContain("already been refunded");
  });
});

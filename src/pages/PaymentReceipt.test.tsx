// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PaymentReceipt from "./PaymentReceipt";

const api = vi.hoisted(() => ({ getPaymentReceipt: vi.fn() }));
vi.mock("@/lib/api", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/api")>()), apiClient: api }));
vi.mock("@/components/DashboardHeader", () => ({ default: () => <div /> }));
const pdf = vi.hoisted(() => ({ generatePaymentReceiptPdf: vi.fn(async () => new Blob(["%PDF"], { type: "application/pdf" })), receiptFileName: () => "payment_receipt_x.pdf" }));
vi.mock("@/lib/paymentReceiptPdf", () => pdf);
const save = vi.hoisted(() => ({ saveBlob: vi.fn() }));
vi.mock("@/lib/dispatchPack", async (orig) => ({ ...(await orig<typeof import("@/lib/dispatchPack")>()), saveBlob: save.saveBlob }));

const sample = {
  receipt_number: "iic_book_1_sample",
  title: "Payment Receipt",
  not_a_tax_invoice: "This is a payment receipt, not a GST tax invoice. Where a tax invoice applies, it is issued by SRIC, IIT Roorkee.",
  test_mode: true,
  collected_by: "DEAN SRIC IIT ROORKEE",
  institution: "Indian Institute of Technology Roorkee",
  service_name: "IIT Roorkee Equipment Booking Portal",
  payer_name: "Sample Test User",
  purpose: "Booking balance payment",
  description: "Equipment booking charges, Sample XRD",
  booking_reference: "XRD-TEST-0001",
  equipment: "Sample XRD",
  booking_total: "1180.00",
  booking_gst: "180.00",
  razorpay_payment_id: "pay_TESTSAMPLE",
  razorpay_order_id: "order_TESTSAMPLE",
  method: "upi",
  paid_at: "2026-11-08T10:00:00+05:30",
  status: "Captured",
  currency: "INR",
  base_amount: "1000.00",
  convenience_fee: "20.00",
  gst_on_fee: "3.60",
  gst_on_fee_percent: "18.0000",
  total_paid: "1023.60",
};

function show(entry = "/payments/receipts/pay_TESTSAMPLE") {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/payments/receipts/:paymentId" element={<PaymentReceipt />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PaymentReceipt", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows the institution, logo, merchant, references, breakdown and the not-a-tax-invoice line", async () => {
    api.getPaymentReceipt.mockResolvedValue({ data: sample });
    show();
    const receipt = await screen.findByTestId("payment-receipt");
    expect(receipt.textContent).toContain("Indian Institute of Technology Roorkee");
    expect(receipt.textContent).toContain("DEAN SRIC IIT ROORKEE");
    expect(receipt.textContent).toContain("iic_book_1_sample");
    expect(receipt.textContent).toContain("XRD-TEST-0001");
    expect(receipt.textContent).toContain("pay_TESTSAMPLE");
    expect(receipt.textContent).toContain("not a GST tax invoice");
    expect(receipt.textContent).toMatch(/test mode/i);
    expect(screen.getByTestId("receipt-total").textContent).toContain("1,023.60");
    expect(receipt.textContent).toContain("of which GST");
    expect(screen.getByAltText(/Indian Institute of Technology Roorkee logo/).getAttribute("src")).toBe("/IITR_Logo.png");
    expect(screen.getByRole("link", { name: "Cancellation and Refund Policy" }).getAttribute("href")).toBe("/cancellation-refund-policy/");
  });

  it("prompts to download the receipt as a PDF and offers Continue only for a portal path", async () => {
    api.getPaymentReceipt.mockResolvedValue({ data: { ...sample, bank_reference: "RRN123", settlement_utr: "" } });
    show("/payments/receipts/pay_TESTSAMPLE?next=%2Fwallet");
    expect((await screen.findByTestId("receipt-prompt")).textContent).toContain("Payment confirmed");
    expect(screen.getByTestId("payment-receipt").textContent).toContain("RRN123");
    fireEvent.click(screen.getByRole("button", { name: /Download receipt \(PDF\)/ }));
    await waitFor(() => expect(save.saveBlob).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: /Continue/ })).toBeTruthy();
  });

  it("ignores a continue address outside the portal", async () => {
    api.getPaymentReceipt.mockResolvedValue({ data: sample });
    show("/payments/receipts/pay_TESTSAMPLE?next=https%3A%2F%2Fevil.example");
    await screen.findByTestId("receipt-prompt");
    expect(screen.queryByRole("button", { name: /Continue/ })).toBeNull();
  });

  it("shows the server's refusal for an unconfirmed or someone else's payment", async () => {
    api.getPaymentReceipt.mockResolvedValue({ error: "Not found." });
    show();
    expect((await screen.findByRole("alert")).textContent).toContain("Not found");
  });
});

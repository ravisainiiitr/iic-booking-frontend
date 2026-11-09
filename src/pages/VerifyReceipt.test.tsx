// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ verifyReceipt: vi.fn() }));
vi.mock("@/lib/api", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/api")>()), apiClient: api }));

import VerifyReceipt from "./VerifyReceipt";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const genuine = {
  valid: true, receipt_number: "IITR/IIC/2026/00001", test_mode: false, paid_at: "2026-11-08T08:38:50+00:00", currency: "INR",
  total: "944.00", booking_total: "944.00", booking_gst: "144.00", status: "paid", status_label: "Paid",
  payer_name: "A User", payer_organisation: "Some College", purpose: "Analysis charges for 'XRD'", booking_reference: "IICXRD1",
  department_name: "Institute Instrumentation Centre", grant_code: "IIC-000-002", collected_by: "DEAN SRIC IIT ROORKEE, IITR",
  razorpay_payment_id: "pay_X", settlement_utr: "", booking_note: "Booking status: Booked.",
};

describe("Verify a payment receipt", () => {
  it("checks the receipt straight away when opened from the QR code", async () => {
    api.verifyReceipt.mockResolvedValue({ data: genuine });
    render(<MemoryRouter initialEntries={["/verify-receipt?n=IITR%2FIIC%2F2026%2F00001&c=K7Q2M-9XWPD"]}><VerifyReceipt /></MemoryRouter>);
    expect(await screen.findByTestId("receipt-valid")).toBeTruthy();
    expect(api.verifyReceipt).toHaveBeenCalledWith("IITR/IIC/2026/00001", "K7Q2M-9XWPD");
    expect(screen.getByText(/Genuine receipt · Paid/)).toBeTruthy();
    expect(screen.getByText("Rs. 944.00")).toBeTruthy();
    expect(screen.getByText("IIC-000-002")).toBeTruthy();
  });

  it("says plainly when nothing matches", async () => {
    api.verifyReceipt.mockResolvedValue({ data: { valid: false } });
    render(<MemoryRouter initialEntries={["/verify-receipt"]}><VerifyReceipt /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("Receipt no."), { target: { value: "IITR/IIC/2026/00002" } });
    fireEvent.change(screen.getByLabelText("Verification code"), { target: { value: "AAAAA-AAAAA" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));
    expect(await screen.findByTestId("receipt-invalid")).toBeTruthy();
    expect(screen.getByText(/do not accept the receipt/)).toBeTruthy();
  });
});

import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { generatePaymentReceiptPdf, receiptFileName } from "./paymentReceiptPdf";
import type { PaymentReceipt } from "./api";

const receipt: PaymentReceipt = {
  receipt_number: "iic_book_1_sample", title: "Payment Receipt",
  not_a_tax_invoice: "This is a payment receipt, not a GST tax invoice.", test_mode: true,
  collected_by: "DEAN SRIC IIT ROORKEE", institution: "Indian Institute of Technology Roorkee",
  service_name: "IIT Roorkee Equipment Booking Portal", payer_name: "Sample User", purpose: "Booking balance payment",
  description: "Analysis charges for 'Sample XRD'", booking_reference: "XRD-TEST-0001", equipment: "Sample XRD",
  booking_total: "1180.00", booking_gst: "180.00", razorpay_payment_id: "pay_TEST", razorpay_order_id: "order_TEST",
  method: "upi", bank_reference: "RRN123", settlement_utr: "UTR456", paid_at: "2026-11-08T10:00:00+05:30", status: "Captured",
  currency: "INR", base_amount: "1180.00", convenience_fee: "23.60", gst_on_fee: "4.25", gst_on_fee_percent: "18", total_paid: "1207.85",
};

describe("payment receipt PDF", () => {
  it("is a single A4 page, named after the booking", async () => {
    const blob = await generatePaymentReceiptPdf(receipt);
    const doc = await PDFDocument.load(await blob.arrayBuffer());
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    expect([Math.round(width), Math.round(height)]).toEqual([595, 842]);
    expect(doc.getTitle()).toBe("Payment Receipt iic_book_1_sample");
    expect(receiptFileName(receipt)).toBe("payment_receipt_XRD-TEST-0001.pdf");
  });

  it("still fits one page for a wallet recharge without a bank reference", async () => {
    const blob = await generatePaymentReceiptPdf({ ...receipt, booking_reference: "", booking_total: "", booking_gst: "", bank_reference: "", settlement_utr: "", test_mode: false });
    expect((await PDFDocument.load(await blob.arrayBuffer())).getPageCount()).toBe(1);
  });
});

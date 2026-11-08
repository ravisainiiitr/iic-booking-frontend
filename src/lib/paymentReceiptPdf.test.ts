import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import { generatePaymentReceiptPdf, hexToRgb01, paymentRows, receiptFileName } from "./paymentReceiptPdf";
import { rupeesInWords } from "./amountInWords";
import type { PaymentReceipt } from "./api";

const receipt: PaymentReceipt = {
  receipt_number: "iic_book_1_sample", title: "Payment Receipt",
  not_a_tax_invoice: "This is a payment receipt, not a GST tax invoice. Where a tax invoice applies, it is issued by SRIC, IIT Roorkee.", test_mode: true,
  collected_by: "DEAN SRIC IIT ROORKEE", institution: "Indian Institute of Technology Roorkee",
  service_name: "IIT Roorkee Equipment Booking Portal", payer_name: "Sample User", purpose: "Booking balance payment",
  description: "Analysis charges for 'Sample XRD'", booking_reference: "XRD-TEST-0001", equipment: "Sample XRD",
  booking_total: "1180.00", booking_gst: "180.00", razorpay_payment_id: "pay_TEST", razorpay_order_id: "order_TEST",
  method: "upi", bank_reference: "RRN123", settlement_utr: "UTR456", paid_at: "2026-11-08T10:00:00+05:30", status: "Captured",
  currency: "INR", base_amount: "1180.00", convenience_fee: "23.60", gst_on_fee: "4.25", gst_on_fee_percent: "18", total_paid: "1207.85",
  payment_mode: "UPI",
  payment_details: [["UPI reference no. (RRN)", "531234567890"], ["UPI transaction ID", "AXL0123456789"],
    ["Payer UPI ID", "sa*******@okhdfcbank"], ["Payer bank / app", "HDFC Bank (Google Pay)"]],
  computer_generated: "This is a computer-generated receipt and does not require a signature.",
  office: "Sponsored Research & Industrial Consultancy (SRIC)", institute_gstin: "05AAALI0033R1Z5",
  payer_organisation: "Sample Institute of Science, Department of Physics", payer_email: "sample.user@example.org",
};

afterEach(() => vi.unstubAllGlobals());

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

  it("still fits one page for a wallet recharge without payment details", async () => {
    const blob = await generatePaymentReceiptPdf({ ...receipt, booking_reference: "", booking_total: "", booking_gst: "", bank_reference: "",
      settlement_utr: "", test_mode: false, payment_details: undefined, payment_mode: undefined });
    expect((await PDFDocument.load(await blob.arrayBuffer())).getPageCount()).toBe(1);
  });

  it("applies the admin's template and still fits one page with long values", async () => {
    expect(hexToRgb01("#FF0000")).toEqual([1, 0, 0]);
    expect(hexToRgb01("gold")).toBeNull();
    const blob = await generatePaymentReceiptPdf({ ...receipt, institution: "A Very Long Institution Name ".repeat(4), institute_gstin: "",
      template: { address: "Somewhere ".repeat(30), contact_email: "office@example.org", website: "example.org", refund_note: "R ".repeat(150),
        extra_note: "E ".repeat(150), brand_color: "#0B3D2E", accent_color: "#AA3300", show_gstin: false, show_logo: false, show_watermark: false } });
    expect((await PDFDocument.load(await blob.arrayBuffer())).getPageCount()).toBe(1);
  });

  it("lists the payment mode's own references, else the stored bank reference", () => {
    expect(paymentRows(receipt).slice(0, 3)).toEqual([["Payment mode", "UPI"], ["UPI reference no. (RRN)", "531234567890"],
      ["UPI transaction ID", "AXL0123456789"]]);
    const fallback = paymentRows({ ...receipt, payment_details: undefined, payment_mode: undefined });
    expect(fallback.slice(0, 2)).toEqual([["Payment mode", "UPI"], ["Bank reference (RRN / UTR)", "RRN123"]]);
  });

  it("writes the amount in words, Indian numbering", () => {
    expect(rupeesInWords("1207.85")).toBe("Rupees One Thousand Two Hundred Seven and Eighty Five Paise Only");
    expect(rupeesInWords("5000")).toBe("Rupees Five Thousand Only");
    expect(rupeesInWords("1234567.5")).toBe("Rupees Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven and Fifty Paise Only");
    expect(rupeesInWords("120000000")).toBe("Rupees Twelve Crore Only");
  });

  it.runIf(Boolean(process.env.RECEIPT_SAMPLE_DIR))("writes sample receipts for review", async () => {
    const logo = readFileSync(resolve(__dirname, "../../public/IITR_Logo.png"));
    vi.stubGlobal("fetch", async () => new Response(logo));
    const dir = process.env.RECEIPT_SAMPLE_DIR as string;
    const live = { ...receipt, test_mode: false };
    const card: PaymentReceipt = { ...live, payment_mode: "Debit card (Visa)", method: "card", booking_reference: "", booking_total: "", booking_gst: "",
      description: "Wallet recharge for Department of Physics", equipment: "", convenience_fee: "0", gst_on_fee: "0", base_amount: "5000.00", total_paid: "5000.00",
      payment_details: [["Card number", "XXXX XXXX XXXX 1007"], ["Issuing bank", "HDFC Bank"], ["Authorisation code", "A1B2C3"], ["Bank reference no. (RRN)", "998877665544"]] };
    const custom: PaymentReceipt = { ...live, office: "Office of the Dean, SRIC", institute_gstin: "",
      template: { address: "IIT Roorkee, Roorkee 247667, Uttarakhand", contact_email: "arsric@iitr.ac.in", website: "equip.iitr.ac.in",
        refund_note: "Refunds are credited to the portal wallet.", extra_note: "Please keep this receipt for your records.",
        brand_color: "#0B3D2E", accent_color: "#B8860B", show_gstin: false, show_logo: true, show_watermark: false } };
    for (const [name, r] of [["upi", live], ["card", card], ["test", receipt], ["custom", custom]] as const) {
      writeFileSync(resolve(dir, `receipt_${name}.pdf`), Buffer.from(await (await generatePaymentReceiptPdf(r)).arrayBuffer()));
    }
  });
});

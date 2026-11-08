import { loadPdfMastheadBytes, ORG_ENGLISH, PDF_BRAND_RGB, PDF_INK_RGB } from "@/lib/pdfLetterhead";
import { pdfSafe } from "@/lib/externalRequisitionFormPdf";
import { INSTITUTION, POLICY_LINKS } from "@/lib/institutionIdentity";
import type { PaymentReceipt } from "@/lib/api";

/**
 * Payment receipt as a one-page A4 PDF (pdf-lib, built in the browser): institute masthead, who collected the payment,
 * the receipt and payment references, the bank reference (RRN / UTR) when known, the amount breakdown and the notes.
 * Never titled a tax invoice. A test-mode receipt carries a banner on top.
 */
const PAGE: [number, number] = [595.28, 841.89];
const MARGIN = 48;

function money(value: string | number | null | undefined): string {
  const n = Number(value || 0);
  return `Rs. ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }) + " IST";
}

export function receiptFileName(r: Pick<PaymentReceipt, "receipt_number" | "booking_reference">): string {
  const base = (r.booking_reference || r.receipt_number || "receipt").replace(/[^A-Za-z0-9_-]+/g, "_");
  return `payment_receipt_${base}.pdf`;
}

export async function generatePaymentReceiptPdf(r: PaymentReceipt): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  doc.setTitle(`Payment Receipt ${r.receipt_number}`);
  doc.setAuthor(ORG_ENGLISH);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const [W, H] = PAGE;
  const contentW = W - MARGIN * 2;
  const brand = rgb(PDF_BRAND_RGB[0] / 255, PDF_BRAND_RGB[1] / 255, PDF_BRAND_RGB[2] / 255);
  const ink = rgb(PDF_INK_RGB[0] / 255, PDF_INK_RGB[1] / 255, PDF_INK_RGB[2] / 255);
  const muted = rgb(0.38, 0.42, 0.48);
  const rule = rgb(0.8, 0.82, 0.86);
  const tint = rgb(0.95, 0.97, 0.99);
  const page = doc.addPage(PAGE);
  let y = H - MARGIN;
  const text = (s: string, x: number, at: number, size: number, f = font, c = ink) => page.drawText(pdfSafe(s), { x, y: at, size, font: f, color: c });
  const right = (s: string, xRight: number, at: number, size: number, f = font, c = ink) =>
    text(s, xRight - f.widthOfTextAtSize(pdfSafe(s), size), at, size, f, c);
  const centred = (s: string, at: number, size: number, f = bold, c = ink) => text(s, (W - f.widthOfTextAtSize(pdfSafe(s), size)) / 2, at, size, f, c);

  if (r.test_mode) {
    page.drawRectangle({ x: MARGIN, y: y - 20, width: contentW, height: 20, color: rgb(1, 0.95, 0.85), borderColor: rgb(0.85, 0.47, 0.02), borderWidth: 1 });
    centred("TEST MODE - SAMPLE ONLY, NO REAL MONEY WAS COLLECTED", y - 14, 9.5, bold, rgb(0.57, 0.25, 0.05));
    y -= 30;
  }

  try {
    const mast = await doc.embedPng(await loadPdfMastheadBytes());
    const w = Math.min(280, contentW);
    const h = (mast.height / mast.width) * w;
    y -= h;
    page.drawImage(mast, { x: (W - w) / 2, y, width: w, height: h });
    y -= 14;
  } catch {
    y -= 16;
    centred(ORG_ENGLISH, y, 15, bold, brand);
    y -= 18;
  }
  centred(r.service_name, y, 10, font, muted);
  y -= 26;
  centred("PAYMENT RECEIPT", y, 17, bold, brand);
  y -= 22;

  // Receipt number, date and amount at a glance.
  const boxH = 50;
  page.drawRectangle({ x: MARGIN, y: y - boxH, width: contentW, height: boxH, color: tint, borderColor: rule, borderWidth: 0.8 });
  const third = contentW / 3;
  ([
    ["Receipt no.", r.receipt_number],
    ["Paid on", when(r.paid_at)],
    ["Amount paid", money(r.total_paid)],
  ] as Array<[string, string]>).forEach(([k, v], i) => {
    text(k, MARGIN + 12 + third * i, y - 17, 8, font, muted);
    text(v, MARGIN + 12 + third * i, y - 35, i === 2 ? 13 : 10.5, bold, i === 2 ? brand : ink);
  });
  y -= boxH + 18;

  // Who paid, for what, and every reference.
  const rows: Array<[string, string]> = [
    ["Received from", r.payer_name || "-"],
    ["Payment for", r.description],
    ...(r.booking_reference ? ([["Booking ID", r.booking_reference]] as Array<[string, string]>) : []),
    ["Collected by", `${r.collected_by}, ${r.institution}`],
    ["Payment method", (r.method || "-").toUpperCase()],
    ["Payment status", r.status],
    ["Razorpay payment ID", r.razorpay_payment_id],
    ["Razorpay order ID", r.razorpay_order_id],
    ["Bank reference (RRN / UTR)", r.bank_reference || "Not provided by the bank for this payment method"],
    ...(r.settlement_utr ? ([["Settlement UTR (to the institute)", r.settlement_utr]] as Array<[string, string]>) : []),
  ];
  const labelW = contentW * 0.34;
  for (const [k, v] of rows) {
    const h = 19;
    page.drawRectangle({ x: MARGIN, y: y - h, width: labelW, height: h, color: tint, borderColor: rule, borderWidth: 0.5 });
    page.drawRectangle({ x: MARGIN + labelW, y: y - h, width: contentW - labelW, height: h, borderColor: rule, borderWidth: 0.5 });
    text(k, MARGIN + 6, y - 13, 8.8, bold);
    let value = pdfSafe(v);
    while (font.widthOfTextAtSize(value, 8.8) > contentW - labelW - 12 && value.length > 4) value = value.slice(0, -2);
    text(value, MARGIN + labelW + 6, y - 13, 8.8);
    y -= h;
  }
  y -= 18;

  // Amount breakdown.
  text("Amount", MARGIN, y, 10.5, bold, brand);
  y -= 8;
  const lines: Array<[string, string, boolean?]> = [];
  if (r.booking_total) {
    lines.push([`Booking charge${r.booking_gst ? `, including GST of ${money(r.booking_gst)}` : ""}`, money(r.booking_total)]);
    lines.push(["Paid online for this booking", money(r.base_amount)]);
  } else {
    lines.push(["Amount", money(r.base_amount)]);
  }
  if (Number(r.convenience_fee) > 0) {
    lines.push(["Payment gateway convenience fee", money(r.convenience_fee)]);
    lines.push([`GST on the convenience fee (${Number(r.gst_on_fee_percent)}%)`, money(r.gst_on_fee)]);
  }
  lines.push([`Total paid (${r.currency})`, money(r.total_paid), true]);
  for (const [k, v, total] of lines) {
    const h = total ? 24 : 19;
    if (total) page.drawRectangle({ x: MARGIN, y: y - h, width: contentW, height: h, color: tint });
    page.drawLine({ start: { x: MARGIN, y: y - h }, end: { x: W - MARGIN, y: y - h }, thickness: total ? 1 : 0.5, color: total ? brand : rule });
    text(k, MARGIN + 6, y - h + 7, total ? 10.5 : 9, total ? bold : font);
    right(v, W - MARGIN - 6, y - h + 7, total ? 10.5 : 9, total ? bold : font, total ? brand : ink);
    y -= h;
  }
  y -= 26;

  // Notes.
  const notes = [
    r.not_a_tax_invoice,
    "Refunds, where due, are credited to the portal wallet or paid to a bank account through the institute's process; they are not returned automatically to the card or UPI account used.",
    `Cancellation and Refund Policy: https://equip.iitr.ac.in${POLICY_LINKS.refund}`,
    `Payment questions: ${INSTITUTION.email}`,
  ];
  for (const note of notes) {
    let line = "";
    for (const word of pdfSafe(note).split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, 8.5) > contentW) {
        text(line, MARGIN, y, 8.5, font, muted);
        y -= 11.5;
        line = word;
      } else line = next;
    }
    if (line) {
      text(line, MARGIN, y, 8.5, font, muted);
      y -= 15;
    }
  }

  page.drawLine({ start: { x: MARGIN, y: MARGIN + 14 }, end: { x: W - MARGIN, y: MARGIN + 14 }, thickness: 0.5, color: rule });
  text("Computer-generated receipt; no signature is required.", MARGIN, MARGIN, 8, font, muted);
  right("equip.iitr.ac.in", W - MARGIN, MARGIN, 8, font, muted);

  const bytes = await doc.save();
  return new Blob([bytes], { type: "application/pdf" });
}

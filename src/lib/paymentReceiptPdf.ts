import { ORG_ENGLISH, PDF_BRAND_RGB, PDF_INK_RGB } from "@/lib/pdfLetterhead";
import { pdfSafe } from "@/lib/externalRequisitionFormPdf";
import { INSTITUTION, POLICY_LINKS } from "@/lib/institutionIdentity";
import { rupeesInWords } from "@/lib/amountInWords";
import type { PaymentReceipt } from "@/lib/api";
import { paymentRows } from "@/lib/receiptRows";

export { paymentRows };

/**
 * Payment receipt as a one-page A4 PDF (pdf-lib, built in the browser), modelled on the SRIC office receipt: institute
 * header with GSTIN, receipt number and date, "received with thanks from", the amount in figures and in words, what it
 * was paid for, how it was paid (with that payment mode's own bank references), the amount breakdown, and a
 * computer-generated note in place of a signature. Never titled a tax invoice. A test-mode receipt says so twice.
 */
const PAGE: [number, number] = [595.28, 841.89];
const M = 42;

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

/** "#RRGGBB" as 0-1 channels, or null when it is not a colour. */
export function hexToRgb01(hex: string | undefined | null): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || "").trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

async function bytesOf(path: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(path);
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

export async function generatePaymentReceiptPdf(r: PaymentReceipt): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb, degrees } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  doc.setTitle(`Payment Receipt ${r.receipt_number}`);
  doc.setAuthor(ORG_ENGLISH);
  doc.setSubject(r.description || "Online payment receipt");
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const sansBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const sansItalic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  type Font = typeof sans;
  const [W, H] = PAGE;
  const CW = W - M * 2;
  // The Main Admin's receipt template (dashboard); every value falls back to the built-in design.
  const t = r.template || {};
  const brand = hexToRgb01(t.brand_color) || [PDF_BRAND_RGB[0] / 255, PDF_BRAND_RGB[1] / 255, PDF_BRAND_RGB[2] / 255];
  const accent = hexToRgb01(t.accent_color) || [0.76, 0.6, 0.22];
  const website = t.website || "equip.iitr.ac.in";
  const contactEmail = t.contact_email || INSTITUTION.email;
  const navy = rgb(...brand);
  const ink = rgb(PDF_INK_RGB[0] / 255, PDF_INK_RGB[1] / 255, PDF_INK_RGB[2] / 255);
  const muted = rgb(0.4, 0.45, 0.52);
  const rule = rgb(0.84, 0.86, 0.9);
  const tint = rgb(0.955, 0.966, 0.984);
  const gold = rgb(...accent);
  const white = rgb(1, 1, 1);
  const green = rgb(0.06, 0.5, 0.3);
  const page = doc.addPage(PAGE);

  const width = (s: string, size: number, f: Font = sans) => f.widthOfTextAtSize(pdfSafe(s), size);
  const text = (s: string, x: number, y: number, size: number, f: Font = sans, color = ink) =>
    page.drawText(pdfSafe(s), { x, y, size, font: f, color });
  const right = (s: string, xr: number, y: number, size: number, f: Font = sans, color = ink) => text(s, xr - width(s, size, f), y, size, f, color);
  const wrap = (s: string, size: number, maxW: number, f: Font = sans): string[] => {
    const lines: string[] = [];
    let line = "";
    for (const word of pdfSafe(s).split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (width(next, size, f) <= maxW) line = next;
      else {
        if (line) lines.push(line);
        // A single over-long token (an ID) is cut to fit rather than overflowing.
        let w = word;
        while (width(w, size, f) > maxW && w.length > 4) w = w.slice(0, -1);
        line = w;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : ["-"];
  };
  const label = (s: string, x: number, y: number) => text(s.toUpperCase(), x, y, 7, sansBold, muted);

  const wantCrest = t.show_logo !== false;
  const wantWatermark = t.show_watermark !== false;
  const logoBytes = wantCrest || wantWatermark ? await bytesOf(INSTITUTION.logoPath) : null;
  const crestImage = logoBytes ? await doc.embedPng(logoBytes).catch(() => null) : null;
  const logo = wantCrest ? crestImage : null;

  if (r.test_mode) {
    page.drawText("TEST MODE - NO MONEY COLLECTED", {
      x: 95, y: 250, size: 34, font: sansBold, color: rgb(0.85, 0.47, 0.02), opacity: 0.12, rotate: degrees(35),
    });
  }

  // Top band.
  page.drawRectangle({ x: 0, y: H - 9, width: W, height: 9, color: navy });
  page.drawRectangle({ x: 0, y: H - 11.5, width: W, height: 2.5, color: gold });
  let y = H - 30;
  if (r.test_mode) {
    page.drawRectangle({ x: M, y: y - 18, width: CW, height: 18, color: rgb(1, 0.95, 0.85), borderColor: rgb(0.85, 0.47, 0.02), borderWidth: 0.8 });
    const t = "TEST MODE  -  SAMPLE RECEIPT, NO REAL MONEY WAS COLLECTED";
    text(t, (W - width(t, 8.5, sansBold)) / 2, y - 12.5, 8.5, sansBold, rgb(0.57, 0.25, 0.05));
    y -= 28;
  }

  // Header: crest, institute, office, address and GSTIN; title and PAID mark on the right.
  const logoSize = 64;
  if (logo) page.drawImage(logo, { x: M, y: y - logoSize, width: logoSize, height: logoSize });
  const hx = M + (logo ? logoSize + 14 : 0);
  const headW = W - M - hx;
  const institution = (r.institution || "Indian Institute of Technology Roorkee").toUpperCase();
  let headSize = 15;
  while (width(institution, headSize, serifBold) > headW && headSize > 10) headSize -= 0.5;
  text(institution, hx, y - 17, headSize, serifBold, navy);
  text(wrap(r.office || INSTITUTION.unit, 9.5, headW, sansBold)[0], hx, y - 32, 9.5, sansBold, ink);
  text(wrap(t.address || INSTITUTION.addressLines.join(", "), 8.5, headW)[0], hx, y - 45, 8.5, sans, muted);
  // Older servers send no template: they always showed the GSTIN. With a template, a blank GSTIN means "hidden".
  const gstin = t.show_gstin === false ? "" : r.template ? r.institute_gstin || "" : r.institute_gstin || INSTITUTION.gstin;
  text(wrap([gstin && `GSTIN: ${gstin}`, contactEmail].filter(Boolean).join("   |   "), 8.5, headW)[0], hx, y - 57, 8.5, sans, muted);
  y -= logoSize + 12;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1.4, color: navy });
  page.drawLine({ start: { x: M, y: y - 3 }, end: { x: W - M, y: y - 3 }, thickness: 0.6, color: gold });
  y -= 30;

  // Title row.
  text(wrap((r.title || "Payment Receipt").toUpperCase(), 18, CW - 120, serifBold)[0], M, y, 18, serifBold, navy);
  const service = r.service_name || "IIT Roorkee Equipment Booking Portal";
  text(service, M, y - 14, 8.5, sans, muted);
  const stamp = r.test_mode ? "TEST" : "PAID";
  const stampColor = r.test_mode ? rgb(0.85, 0.47, 0.02) : green;
  const sw = width(stamp, 13, sansBold) + 26;
  page.drawRectangle({ x: W - M - sw, y: y - 8, width: sw, height: 26, borderColor: stampColor, borderWidth: 1.6, opacity: 0, borderOpacity: 0.9 });
  page.drawRectangle({ x: W - M - sw + 2.5, y: y - 5.5, width: sw - 5, height: 21, borderColor: stampColor, borderWidth: 0.6, opacity: 0, borderOpacity: 0.9 });
  text(stamp, W - M - sw + 13, y + 0.5, 13, sansBold, stampColor);
  y -= 30;

  // Receipt no. / date / mode strip.
  const stripH = 42;
  page.drawRectangle({ x: M, y: y - stripH, width: CW, height: stripH, color: tint, borderColor: rule, borderWidth: 0.6 });
  const cells: [string, string][] = [
    ["Receipt no.", r.receipt_number],
    ["Date of payment", when(r.paid_at)],
    ["Payment mode", r.payment_mode || (r.method || "Online").toUpperCase()],
  ];
  const cellW = CW / cells.length;
  cells.forEach(([k, v], i) => {
    const cx = M + cellW * i + 12;
    if (i) page.drawLine({ start: { x: M + cellW * i, y: y - stripH + 8 }, end: { x: M + cellW * i, y: y - 8 }, thickness: 0.5, color: rule });
    label(k, cx, y - 15);
    text(wrap(v, 10, cellW - 20, sansBold)[0], cx, y - 31, 10, sansBold, ink);
  });
  y -= stripH + 22;

  // Received from (left) and amount (right).
  const boxW = 190;
  const boxH = 66;
  const leftW = CW - boxW - 18;
  label("Received with thanks from", M, y);
  let ly = y - 16;
  for (const line of wrap(r.payer_name || "-", 13, leftW, sansBold).slice(0, 2)) {
    text(line, M, ly, 13, sansBold, ink);
    ly -= 15;
  }
  if (r.payer_organisation) {
    for (const line of wrap(r.payer_organisation, 9.5, leftW).slice(0, 2)) {
      text(line, M, ly, 9.5, sans, ink);
      ly -= 12;
    }
  }
  if (r.payer_email) {
    text(wrap(r.payer_email, 9, leftW)[0], M, ly, 9, sans, muted);
    ly -= 12;
  }
  const bx = W - M - boxW;
  page.drawRectangle({ x: bx, y: y - boxH + 8, width: boxW, height: boxH, color: navy });
  page.drawRectangle({ x: bx, y: y - boxH + 8, width: 4, height: boxH, color: gold });
  text("AMOUNT RECEIVED", bx + 16, y - 9, 7.5, sansBold, rgb(0.8, 0.86, 0.95));
  const amount = money(r.total_paid);
  let amountSize = 21;
  while (width(amount, amountSize, sansBold) > boxW - 30 && amountSize > 12) amountSize -= 1;
  text(amount, bx + 16, y - 36, amountSize, sansBold, white);
  text(r.currency || "INR", bx + 16, y - 50, 7.5, sans, rgb(0.8, 0.86, 0.95));
  y = Math.min(ly, y - boxH + 8) - 12;

  const words = rupeesInWords(r.total_paid);
  const wordLines = wrap(`(${words})`, 9.5, CW - 24, sansItalic).slice(0, 2);
  const wordsH = 10 + wordLines.length * 12;
  page.drawRectangle({ x: M, y: y - wordsH, width: CW, height: wordsH, color: tint });
  page.drawRectangle({ x: M, y: y - wordsH, width: 2.5, height: wordsH, color: gold });
  wordLines.forEach((line, i) => text(line, M + 12, y - 15 - i * 12, 9.5, sansItalic, ink));
  y -= wordsH + 22;

  // On account of (left) | Payment details (right).
  const colGap = 22;
  const colW = (CW - colGap) / 2;
  const account: [string, string][] = [["Purpose", r.description]];
  if (r.booking_reference) account.push(["Booking ID", r.booking_reference]);
  if (r.equipment && !(r.description || "").includes(r.equipment)) account.push(["Instrument", r.equipment]);
  account.push(["Collected by", `${r.collected_by}, ${r.institution}`]);
  account.push(["Received through", "Razorpay online payment gateway"]);
  const column = (title: string, rows: [string, string][], x: number, top: number): number => {
    text(title, x, top, 10, sansBold, navy);
    page.drawLine({ start: { x, y: top - 5 }, end: { x: x + colW, y: top - 5 }, thickness: 0.8, color: navy });
    let cy = top - 19;
    for (const [k, v] of rows) {
      label(k, x, cy);
      cy -= 11;
      for (const line of wrap(v || "-", 9.5, colW).slice(0, 3)) {
        text(line, x, cy, 9.5, sans, ink);
        cy -= 11.5;
      }
      cy -= 5;
    }
    return cy;
  };
  const endLeft = column("ON ACCOUNT OF", account, M, y);
  // The mode is in the strip above and "Captured" is the PAID mark: only other statuses (refunds) are repeated here.
  const details = paymentRows(r).filter(([k, v]) => k !== "Payment mode" && !(k === "Payment status" && /^captured$/i.test(v)));
  const endRight = column("PAYMENT DETAILS", details, M + colW + colGap, y);
  y = Math.min(endLeft, endRight) - 6;

  // Amount breakdown: each line's base amount and GST in their own columns.
  type Line = { label: string; base?: number; gst?: number; amount: number; gstNote?: string };
  const num = (v: string | number | null | undefined) => Number(v || 0);
  const pct = (gst: number, base: number) => (base > 0 ? `${Math.round((gst / base) * 10000) / 100}%` : "");
  const lines: Line[] = [];
  let deduction = false;
  if (r.booking_total) {
    const total = num(r.booking_total);
    const gst = num(r.booking_gst);
    const base = Math.round((total - gst) * 100) / 100;
    const label = r.equipment ? `Booking charge - ${r.equipment}` : "Booking charge";
    lines.push({ label, base, gst, amount: total, gstNote: gst > 0 ? `GST @ ${pct(gst, base)}` : "No GST" });
    const paidOnline = num(r.base_amount);
    if (total - paidOnline > 0.005) {
      deduction = true;
      lines.push({ label: "Less: already paid from the wallet or earlier", amount: -(Math.round((total - paidOnline) * 100) / 100) });
    }
  } else {
    lines.push({ label: r.description || "Amount", base: num(r.base_amount), amount: num(r.base_amount), gstNote: "GST not applicable" });
  }
  if (num(r.convenience_fee) > 0) {
    const fee = num(r.convenience_fee);
    const feeGst = num(r.gst_on_fee);
    lines.push({ label: "Payment gateway convenience fee", base: fee, gst: feeGst, amount: Math.round((fee + feeGst) * 100) / 100,
      gstNote: `GST @ ${Number(r.gst_on_fee_percent) || pct(feeGst, fee).replace("%", "")}%` });
  }
  const signed = (n: number) => (n < 0 ? `- ${money(-n)}` : money(n));
  const xAmount = W - M - 10;
  const xGst = W - M - 112;
  const xBase = W - M - 208;
  const labelW = xBase - 90 - (M + 10);
  const rowH = 19;
  page.drawRectangle({ x: M, y: y - rowH, width: CW, height: rowH, color: tint, borderColor: rule, borderWidth: 0.5 });
  text("PARTICULARS", M + 10, y - 13, 7.5, sansBold, muted);
  right("BASE AMOUNT", xBase, y - 13, 7.5, sansBold, muted);
  right("GST", xGst, y - 13, 7.5, sansBold, muted);
  right("AMOUNT", xAmount, y - 13, 7.5, sansBold, muted);
  y -= rowH;
  for (const line of lines) {
    const h = line.gstNote ? 26 : rowH;
    text(wrap(line.label, 9.5, labelW)[0], M + 10, y - 13, 9.5, sans, ink);
    if (line.gstNote) text(line.gstNote, M + 10, y - 23, 7.5, sans, muted);
    right(line.base === undefined ? "" : money(line.base), xBase, y - 13, 9.5, sans, ink);
    right(line.base === undefined ? "" : line.gst ? money(line.gst) : "Nil", xGst, y - 13, 9.5, sans, line.gst ? ink : muted);
    right(signed(line.amount), xAmount, y - 13, 9.5, line.base === undefined ? sans : sansBold, ink);
    page.drawLine({ start: { x: M, y: y - h }, end: { x: W - M, y: y - h }, thickness: 0.5, color: rule });
    y -= h;
  }
  page.drawRectangle({ x: M, y: y - 24, width: CW, height: 24, color: navy });
  text(`Total received (${r.currency || "INR"})`, M + 10, y - 16, 10.5, sansBold, white);
  if (!deduction) {
    // Column totals only when every line adds up (no amount already paid earlier).
    const baseTotal = lines.reduce((a, l) => a + (l.base || 0), 0);
    const gstTotal = lines.reduce((a, l) => a + (l.gst || 0), 0);
    right(money(baseTotal), xBase, y - 16, 9.5, sans, white);
    right(gstTotal ? money(gstTotal) : "Nil", xGst, y - 16, 9.5, sans, white);
  }
  right(money(r.total_paid), xAmount, y - 16, 10.5, sansBold, white);
  y -= 24 + 13;

  // Notes.
  const notes = [
    r.not_a_tax_invoice,
    t.refund_note ??
      "Refunds, where due, go to the portal wallet or to a bank account through the institute, not automatically back to the card or UPI account used.",
    t.extra_note || "",
    `Cancellation and Refund Policy: https://equip.iitr.ac.in${POLICY_LINKS.refund}`,
  ].filter(Boolean);
  const cgH = 26;
  const cgY = 26 + 10;
  // Notes, as many as fit above the computer-generated note (the first, "not a tax invoice", always does).
  for (const note of notes) {
    const noteLines = wrap(note, 8, CW);
    if (y - noteLines.length * 10 < cgY + cgH + 2) break;
    for (const line of noteLines) {
      text(line, M, y, 8, sans, muted);
      y -= 10.5;
    }
    y -= 3;
  }

  // Computer-generated note in place of a signature, anchored just above the footer.
  page.drawRectangle({ x: M, y: cgY, width: CW, height: cgH, borderColor: gold, borderWidth: 0.9, color: rgb(0.995, 0.985, 0.955) });
  const cg = wrap(r.computer_generated || "This is a computer-generated receipt and does not require a signature.", 9.5, CW - 28, sansBold)[0];
  text(cg, M + 14, cgY + 9.5, 9.5, sansBold, ink);

  // Footer band.
  page.drawRectangle({ x: 0, y: 0, width: W, height: 26, color: navy });
  page.drawRectangle({ x: 0, y: 26, width: W, height: 1.8, color: gold });
  text(wrap(`${service}  |  ${website}`, 7.8, CW - 190)[0], M, 9.5, 7.8, sans, white);
  right(`Generated ${when(new Date().toISOString())}`, W - M, 9.5, 7.8, sans, white);

  // IIT Roorkee crest as a watermark across the middle of the page, over everything so filled boxes never hide it.
  if (crestImage && wantWatermark) {
    const size = 330;
    page.drawImage(crestImage, { x: (W - size) / 2, y: (H - size) / 2 - 30, width: size, height: size, opacity: 0.07 });
  }

  const bytes = await doc.save();
  return new Blob([bytes], { type: "application/pdf" });
}

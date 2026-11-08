import {
  DEFAULT_DEPARTMENT_NAME,
  loadPdfMastheadBytes,
  ORG_ENGLISH,
  PDF_BRAND_RGB,
  PDF_INK_RGB,
} from "@/lib/pdfLetterhead";
import type { PDFPage } from "pdf-lib";
import type { BookingDetailCardBooking } from "@/components/BookingDetailCard";

/**
 * Equipment Requisition Form: one A4 page that goes inside the sample parcel. The header names the booking and the
 * equipment; the body holds the applicant's details, the declaration and the signature boxes with the stamp, so the
 * user only signs it and gets it stamped. Booking details, samples, charges and payment are already in the portal and
 * on the receipt, so they are not repeated here (8 Nov 2026). Built in the browser with pdf-lib (Helvetica, WinAnsi:
 * other characters are replaced, never dropped silently).
 */

const PAGE: [number, number] = [595.28, 841.89]; // A4 portrait, points
const MARGIN = 42;
const FOOTER = 30;
const LINE = 1.25; // line height factor
const BLANK = "-";
/** A cell the user fills in by hand: left empty, with room to write. */
const FILL = "\u0000fill";
const FILL_HEIGHT = 22;

type Rgb = { r: number; g: number; b: number };

/** The reference printed on the form: built from the booking id (no separate register). */
export function requisitionReference(booking: Pick<BookingDetailCardBooking, "booking_id" | "created_at">): string {
  const created = booking.created_at ? new Date(booking.created_at) : new Date();
  const year = Number.isNaN(created.getTime()) ? new Date().getFullYear() : created.getFullYear();
  return `IIC/REQ/${year}/${booking.booking_id}`;
}

/** Characters the built-in PDF fonts can draw (WinAnsi): common symbols mapped, anything else replaced. */
export function pdfSafe(text: unknown): string {
  return String(text ?? "")
    .replace(/[\u2012-\u2015\u2212]/g, "-")
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u20B9/g, "Rs. ")
    .replace(/[\u2022\u00B7\u25CF]/g, "-")
    .replace(/[\u00A0\u2007\u202F]/g, " ")
    .replace(/[\r\t]/g, " ")
    .replace(/[^\n\x20-\x7E\u00A1-\u00FF]/g, "?");
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export async function generateExternalEquipmentRequisitionFormPdf(booking: BookingDetailCardBooking): Promise<Blob> {
  // pdf-lib (~350 KB) loads only when a form is generated, not with every booking card.
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const bookingRef = String(booking.virtual_booking_id || booking.booking_id);
  doc.setTitle(`Equipment Requisition Form ${bookingRef}`);
  doc.setAuthor(DEFAULT_DEPARTMENT_NAME);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const [W, H] = PAGE;
  const contentW = W - MARGIN * 2;
  const color = (c: Rgb) => rgb(c.r, c.g, c.b);
  const BRAND: Rgb = { r: PDF_BRAND_RGB[0] / 255, g: PDF_BRAND_RGB[1] / 255, b: PDF_BRAND_RGB[2] / 255 };
  const INK: Rgb = { r: PDF_INK_RGB[0] / 255, g: PDF_INK_RGB[1] / 255, b: PDF_INK_RGB[2] / 255 };
  const MUTED: Rgb = { r: 0.38, g: 0.42, b: 0.48 };
  const RULE: Rgb = { r: 0.78, g: 0.8, b: 0.84 };
  const TINT: Rgb = { r: 0.94, g: 0.96, b: 0.99 };
  const generatedOn = fmtDate(new Date());

  let page: PDFPage = doc.addPage(PAGE);
  let y = H - MARGIN;

  const wrap = (raw: unknown, size: number, maxW: number, f = font): string[] => {
    const out: string[] = [];
    for (const para of pdfSafe(raw).split("\n")) {
      let current = "";
      for (const word of para.split(/\s+/).filter(Boolean)) {
        let w = word;
        // A single word wider than the column (long e-mail, URL): break it by characters.
        while (f.widthOfTextAtSize(w, size) > maxW) {
          let cut = w.length - 1;
          while (cut > 1 && f.widthOfTextAtSize(w.slice(0, cut), size) > maxW) cut--;
          if (current) {
            out.push(current);
            current = "";
          }
          out.push(w.slice(0, cut));
          w = w.slice(cut);
        }
        const next = current ? `${current} ${w}` : w;
        if (f.widthOfTextAtSize(next, size) <= maxW) current = next;
        else {
          out.push(current);
          current = w;
        }
      }
      out.push(current);
    }
    return out.length ? out : [""];
  };

  const newPage = () => {
    page = doc.addPage(PAGE);
    y = H - MARGIN;
    // Running head on continuation pages.
    page.drawText(pdfSafe(`Equipment Requisition Form - ${bookingRef}`), { x: MARGIN, y: y - 8, size: 8.5, font: bold, color: color(BRAND) });
    page.drawLine({ start: { x: MARGIN, y: y - 14 }, end: { x: W - MARGIN, y: y - 14 }, thickness: 0.6, color: color(RULE) });
    y -= 26;
  };
  const ensure = (h: number) => {
    if (y - h < MARGIN + FOOTER) newPage();
  };
  const text = (s: string, x: number, at: number, size: number, f = font, c: Rgb = INK) =>
    page.drawText(s, { x, y: at, size, font: f, color: color(c) });

  // ---- letterhead and reference box -------------------------------------------------------------------------
  try {
    const mast = await doc.embedPng(await loadPdfMastheadBytes());
    const w = Math.min(300, contentW);
    const h = (mast.height / mast.width) * w;
    y -= h;
    page.drawImage(mast, { x: (W - w) / 2, y, width: w, height: h });
    y -= 12;
  } catch {
    const org = pdfSafe(ORG_ENGLISH);
    y -= 16;
    text(org, (W - bold.widthOfTextAtSize(org, 15)) / 2, y, 15, bold, BRAND);
    y -= 22;
  }
  const centred = (s: string, size: number, f = bold, c: Rgb = INK) => {
    const t = pdfSafe(s);
    text(t, (W - f.widthOfTextAtSize(t, size)) / 2, y, size, f, c);
    y -= size * LINE;
  };
  centred(DEFAULT_DEPARTMENT_NAME, 13, bold, BRAND);
  y -= 2;
  centred("EQUIPMENT REQUISITION FORM", 15, bold, INK);
  y -= 4;

  // Header box: the booking and the equipment it is for.
  const name = (booking.equipment_name || "").trim();
  const code = (booking.equipment_code || "").trim();
  const equipmentName = (code && !name.includes(code) ? `${name} (${code})` : name) || code || BLANK;
  const equipLines = wrap(equipmentName, 10.5, contentW * 0.56 - 16, bold).slice(0, 2);
  const boxH = 30 + equipLines.length * 13;
  page.drawRectangle({ x: MARGIN, y: y - boxH, width: contentW, height: boxH, color: color(TINT), borderColor: color(RULE), borderWidth: 0.8 });
  const cols: Array<[string, string[], number]> = [
    ["Booking ID", [bookingRef], 0.26],
    ["Equipment", equipLines, 0.56],
    ["Date", [generatedOn], 0.18],
  ];
  let colX = MARGIN;
  for (const [k, vs, share] of cols) {
    text(pdfSafe(k), colX + 10, y - 15, 8, font, MUTED);
    vs.forEach((v, i) => text(pdfSafe(v), colX + 10, y - 30 - i * 13, 10.5, bold, INK));
    colX += contentW * share;
  }
  y -= boxH + 16;

  // ---- building blocks --------------------------------------------------------------------------------------
  let section = 0;
  const sectionTitle = (title: string) => {
    ensure(46);
    section += 1;
    page.drawRectangle({ x: MARGIN, y: y - 18, width: contentW, height: 18, color: color(BRAND) });
    text(pdfSafe(`${section}.  ${title.toUpperCase()}`), MARGIN + 8, y - 12.5, 9.5, bold, { r: 1, g: 1, b: 1 });
    y -= 18;
  };

  /** Two-column ruled table: label | value. Rows wrap; a row never splits across pages. */
  const kvTable = (rows: Array<[string, unknown]>) => {
    const labelW = contentW * 0.32;
    const pad = 4;
    const size = 9;
    for (const [label, value] of rows) {
      const fill = value === FILL;
      const shown = fill ? "" : String(value ?? "").trim() || BLANK;
      const left = wrap(label, size, labelW - pad * 2, bold);
      const right = wrap(shown, size, contentW - labelW - pad * 2);
      const h = Math.max(Math.max(left.length, right.length) * size * LINE + pad * 2, fill ? FILL_HEIGHT : 0);
      ensure(h);
      page.drawRectangle({ x: MARGIN, y: y - h, width: labelW, height: h, color: color(TINT), borderColor: color(RULE), borderWidth: 0.6 });
      page.drawRectangle({ x: MARGIN + labelW, y: y - h, width: contentW - labelW, height: h, borderColor: color(RULE), borderWidth: 0.6 });
      left.forEach((l, i) => text(l, MARGIN + pad, y - pad - size - i * size * LINE + 2, size, bold, INK));
      right.forEach((l, i) => text(l, MARGIN + labelW + pad, y - pad - size - i * size * LINE + 2, size, font, INK));
      y -= h;
    }
    y -= 9;
  };

  const paragraph = (s: string, size = 9.5, c: Rgb = INK) => {
    y -= 5;
    for (const l of wrap(s, size, contentW)) {
      ensure(size * LINE);
      text(l, MARGIN, y - size, size, font, c);
      y -= size * LINE;
    }
    y -= 6;
  };

  // ---- 1. applicant ------------------------------------------------------------------------------------------
  sectionTitle("Applicant details");
  kvTable([
    ["Name", booking.user_name],
    ["Institute / organisation", booking.user_department],
    ["User category", booking.user_type_snapshot_display || booking.user_type_snapshot],
    ["Official e-mail", booking.user_email],
    ["Contact number", booking.user_phone],
  ]);

  // ---- 7. declaration ----------------------------------------------------------------------------------------
  sectionTitle("Declaration");
  paragraph(
    "I declare that the information above is correct; that the samples are as described, safe to handle and free " +
      "of hazardous, radioactive or biological material unless declared to the laboratory in advance; and that I " +
      "accept the terms and conditions and the refund and cancellation policy of the IIC Booking Portal.",
  );

  // ---- 8. signatures, approval and stamp -------------------------------------------------------------------------
  sectionTitle("Authorisation");
  const boxH2 = 70;
  ensure(boxH2 + 30);
  const third = contentW / 3;
  const boxes: Array<[string, string]> = [
    ["Signature of applicant", "Name and date"],
    ["Supervisor / HOD", "Signature with seal"],
    ["Departmental approval", "Authorised signatory"],
  ];
  boxes.forEach(([title, hint], i) => {
    const x = MARGIN + third * i;
    page.drawRectangle({ x, y: y - boxH2, width: third, height: boxH2, borderColor: color(RULE), borderWidth: 0.8 });
    text(pdfSafe(title), x + 6, y - 13, 9, bold, INK);
    page.drawLine({ start: { x: x + 8, y: y - boxH2 + 20 }, end: { x: x + third - 8, y: y - boxH2 + 20 }, thickness: 0.5, color: color(MUTED) });
    text(pdfSafe(hint), x + 8, y - boxH2 + 8, 7.5, font, MUTED);
  });
  y -= boxH2 + 10;
  ensure(70);
  page.drawRectangle({
    x: W - MARGIN - 150, y: y - 64, width: 150, height: 64,
    borderColor: color(MUTED), borderWidth: 0.8, borderDashArray: [3, 2],
  });
  text("Official stamp", W - MARGIN - 150 + 44, y - 36, 9, font, MUTED);
  text(pdfSafe("For office use: received on ____________  by ____________"), MARGIN, y - 36, 9, font, MUTED);
  y -= 76;

  // ---- footer on every page ----------------------------------------------------------------------------------------
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: MARGIN, y: MARGIN + 12 }, end: { x: W - MARGIN, y: MARGIN + 12 }, thickness: 0.5, color: color(RULE) });
    p.drawText(pdfSafe(`Booking ${bookingRef}`), { x: MARGIN, y: MARGIN, size: 8, font, color: color(MUTED) });
    const mid = pdfSafe(`Generated ${generatedOn} from the IIC Booking Portal`);
    p.drawText(mid, { x: (W - font.widthOfTextAtSize(mid, 8)) / 2, y: MARGIN, size: 8, font, color: color(MUTED) });
    const right = `Page ${i + 1} of ${pages.length}`;
    p.drawText(right, { x: W - MARGIN - font.widthOfTextAtSize(right, 8), y: MARGIN, size: 8, font, color: color(MUTED) });
  });

  const bytes = await doc.save();
  return new Blob([bytes], { type: "application/pdf" });
}

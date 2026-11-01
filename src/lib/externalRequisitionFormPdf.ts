import {
  DEFAULT_DEPARTMENT_NAME,
  loadPdfMastheadBytes,
  ORG_ENGLISH,
  PDF_BRAND_RGB,
  PDF_INK_RGB,
} from "@/lib/pdfLetterhead";
import { readSampleSets, SAMPLE_SETS_KEY } from "@/lib/sampleSets";
import type { PDFPage } from "pdf-lib";
import type { BookingDetailCardBooking } from "@/components/BookingDetailCard";

/**
 * Equipment Requisition Form: an A4, print-ready PDF filled from the booking, so the user mainly signs it and gets
 * it stamped. Numbered sections with ruled tables; text wraps instead of being cut, long tables continue on the
 * next page (headers repeated) and every page carries the reference and "Page X of Y". Built in the browser with
 * pdf-lib (Helvetica, WinAnsi: other characters are replaced, never dropped silently).
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
type Person = { name?: string | null; email?: string | null; phone?: string | null } | null | undefined;

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

function fmtTime(d: Date): string {
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function personLine(p: Person): string {
  if (!p?.name) return "";
  return [p.name, p.email, p.phone].filter(Boolean).join(", ");
}

function inputText(value: unknown, options?: Array<string | { value?: string; label?: string }>): string {
  const label = (v: unknown) => {
    const hit = options?.find((o) => typeof o !== "string" && o?.value === v);
    return hit && typeof hit !== "string" ? hit.label || String(v) : String(v);
  };
  if (value == null || value === "") return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map((v) => (Array.isArray(v) ? v.join(" x ") : label(v))).filter(Boolean).join(", ");
  if (typeof value === "object") return "";
  return label(value);
}

/** The booking's time: one line per day with its first start and last end. */
function slotLines(booking: BookingDetailCardBooking): string[] {
  const byDay = new Map<string, { start: Date; end: Date; n: number }>();
  for (const s of booking.daily_slots ?? []) {
    const start = new Date(s.start_datetime);
    const end = new Date(s.end_datetime);
    if (Number.isNaN(start.getTime())) continue;
    const key = s.date || start.toISOString().slice(0, 10);
    const cur = byDay.get(key);
    if (!cur) byDay.set(key, { start, end, n: 1 });
    else byDay.set(key, { start: start < cur.start ? start : cur.start, end: end > cur.end ? end : cur.end, n: cur.n + 1 });
  }
  if (byDay.size === 0 && booking.start_time) {
    const start = new Date(booking.start_time);
    const end = booking.end_time ? new Date(booking.end_time) : null;
    return [`${fmtDate(start)}, ${fmtTime(start)}${end ? ` - ${fmtTime(end)}` : ""}`];
  }
  return [...byDay.values()]
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .map((d) => `${fmtDate(d.start)}, ${fmtTime(d.start)} - ${fmtTime(d.end)} (${d.n} slot${d.n === 1 ? "" : "s"})`);
}

export async function generateExternalEquipmentRequisitionFormPdf(booking: BookingDetailCardBooking): Promise<Blob> {
  // pdf-lib (~350 KB) loads only when a form is generated, not with every booking card.
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  doc.setTitle(`Equipment Requisition Form ${requisitionReference(booking)}`);
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
  const reference = requisitionReference(booking);
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
    page.drawText(pdfSafe(`Equipment Requisition Form - ${reference}`), { x: MARGIN, y: y - 8, size: 8.5, font: bold, color: color(BRAND) });
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
  centred("External users", 9.5, font, MUTED);
  y -= 6;

  const boxH = 46;
  page.drawRectangle({ x: MARGIN, y: y - boxH, width: contentW, height: boxH, color: color(TINT), borderColor: color(RULE), borderWidth: 0.8 });
  const cols: Array<[string, string]> = [
    ["Requisition / reference no.", reference],
    ["Booking ID", String(booking.virtual_booking_id || booking.booking_id)],
    ["Date of generation", generatedOn],
  ];
  cols.forEach(([k, v], i) => {
    const x = MARGIN + 12 + (contentW / 3) * i;
    text(pdfSafe(k), x, y - 17, 8, font, MUTED);
    text(pdfSafe(v), x, y - 33, 11, bold, INK);
  });
  y -= boxH + 14;

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

  /** Ruled grid with a header row repeated on every page it spans. */
  const grid = (headers: string[], widths: number[], rows: string[][]) => {
    const size = 9;
    const pad = 4.5;
    const total = widths.reduce((a, b) => a + b, 0);
    const ws = widths.map((w) => (w / total) * contentW);
    const drawRow = (cells: string[], header: boolean) => {
      const lines = cells.map((c, i) => wrap(c || (header ? "" : " "), size, ws[i] - pad * 2, header ? bold : font));
      const h = Math.max(...lines.map((l) => l.length)) * size * LINE + pad * 2;
      return { lines, h };
    };
    const head = drawRow(headers, true);
    const paint = (r: { lines: string[][]; h: number }, header: boolean) => {
      let x = MARGIN;
      r.lines.forEach((ls, i) => {
        page.drawRectangle({ x, y: y - r.h, width: ws[i], height: r.h, color: header ? color(TINT) : undefined, borderColor: color(RULE), borderWidth: 0.6 });
        ls.forEach((l, j) => text(l, x + pad, y - pad - size - j * size * LINE + 2, size, header ? bold : font, INK));
        x += ws[i];
      });
      y -= r.h;
    };
    ensure(head.h + 24);
    paint(head, true);
    for (const cells of rows) {
      const r = drawRow(cells, false);
      if (y - r.h < MARGIN + FOOTER) {
        newPage();
        paint(head, true);
      }
      paint(r, false);
    }
    y -= 12;
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
    ["Designation / status", booking.user_type_snapshot_display || booking.user_type_snapshot],
    ["Department / institute / organisation", booking.user_department],
    ["Official e-mail", booking.user_email],
    ["Contact number", booking.user_phone],
    ["User category", booking.user_type_snapshot_display || booking.user_type_snapshot],
    ["Invoice in the name of (with GSTIN, if any)", FILL],
  ]);

  // ---- 2. equipment and booking ------------------------------------------------------------------------------
  sectionTitle("Equipment and booking");
  const slots = slotLines(booking);
  kvTable([
    ["Equipment", `${booking.equipment_name || ""}${booking.equipment_code ? ` (${booking.equipment_code})` : ""}`],
    ["Equipment ID", String(booking.equipment ?? "")],
    ["Laboratory", DEFAULT_DEPARTMENT_NAME],
    ["Lab Operator", personLine(booking.lab_in_charge)],
    ["Officer In Charge (OIC)", (booking.oic_contacts ?? []).map(personLine).filter(Boolean).join("\n")],
    ["Booking ID", String(booking.virtual_booking_id || booking.booking_id)],
    ["Booking date and time", slots.join("\n")],
    ["Total booked time", booking.total_hours ? `${booking.total_hours} hours` : ""],
  ]);

  // ---- 3. requested analysis / service ----------------------------------------------------------------------
  const fields = booking.input_fields ?? [];
  const values = booking.input_values ?? {};
  const shownKeys = new Set<string>();
  const requested: Array<[string, unknown]> = [];
  for (const f of fields) {
    if (f.field_key === SAMPLE_SETS_KEY) continue;
    const v = inputText(values[f.field_key], f.options);
    shownKeys.add(f.field_key);
    if (v) requested.push([f.field_label || f.field_key, v]);
  }
  for (const [k, v] of Object.entries(values)) {
    if (shownKeys.has(k) || k.startsWith("_")) continue;
    const t = inputText(v);
    if (t) requested.push([k.replace(/_/g, " "), t]);
  }
  sectionTitle("Requested analysis / service");
  kvTable(requested.length ? requested : [["Details", "As entered at booking (none recorded)"]]);

  // ---- 4. samples ------------------------------------------------------------------------------------------
  sectionTitle("Sample details");
  const sets = readSampleSets(values as Record<string, unknown>);
  const labelOf = new Map(fields.map((f) => [f.field_key, f.field_label || f.field_key]));
  const sampleRows = sets.map((set, i) => {
    const parts = Object.entries(set)
      .map(([k, v]) => {
        const t = inputText(v, fields.find((f) => f.field_key === k)?.options);
        return t ? `${labelOf.get(k) ?? k.replace(/_/g, " ")}: ${t}` : "";
      })
      .filter(Boolean);
    return [String(i + 1), parts.join("; "), ""];
  });
  const blankRows = Math.max(0, 4 - sampleRows.length);
  grid(
    ["#", "Sample description / parameters", "Sample ID / remarks (user)"],
    [6, 60, 34],
    [...sampleRows, ...Array.from({ length: blankRows }, (_, i) => [String(sampleRows.length + i + 1), "", ""])],
  );

  // ---- 5. charges ------------------------------------------------------------------------------------------
  const breakdown = (booking.charge_breakdown ?? []).filter((r) => r && r.description);
  if (breakdown.length || Number(booking.total_charge) > 0) {
    sectionTitle("Applicable charges");
    const money = (n: number | string) => `Rs. ${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    grid(
      ["Description", "Amount"],
      [75, 25],
      [...breakdown.map((r) => [String(r.description), money(r.amount)]), ["Total", money(booking.total_charge)]],
    );
  }

  // ---- 6. payment (filled in by the user) ---------------------------------------------------------------------
  sectionTitle("Payment details (attach the payment receipt)");
  kvTable([
    ["I-STEM FBR no.", FILL],
    ["Account holder", FILL],
    ["Bank", FILL],
    ["Date of transaction", FILL],
    ["UTR / transaction no.", FILL],
    ["Amount paid (Rs.)", FILL],
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

  // ---- 9. bank details (reference) --------------------------------------------------------------------------------
  sectionTitle("Bank account for payment (reference)");
  kvTable([
    ["Bank", "State Bank of India, IIT Roorkee branch - 247667 (branch no. 1069)"],
    ["Account holder", "DEAN SRIC IITR"],
    ["Account no.", "33136732957"],
    ["IFS code", "SBIN0001069"],
    ["GSTIN of IIT Roorkee", "05AAALI0033R1Z5"],
  ]);

  // ---- footer on every page ----------------------------------------------------------------------------------------
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: MARGIN, y: MARGIN + 12 }, end: { x: W - MARGIN, y: MARGIN + 12 }, thickness: 0.5, color: color(RULE) });
    p.drawText(pdfSafe(`Ref. ${reference}`), { x: MARGIN, y: MARGIN, size: 8, font, color: color(MUTED) });
    const mid = pdfSafe(`Generated ${generatedOn} from the IIC Booking Portal`);
    p.drawText(mid, { x: (W - font.widthOfTextAtSize(mid, 8)) / 2, y: MARGIN, size: 8, font, color: color(MUTED) });
    const right = `Page ${i + 1} of ${pages.length}`;
    p.drawText(right, { x: W - MARGIN - font.widthOfTextAtSize(right, 8), y: MARGIN, size: 8, font, color: color(MUTED) });
  });

  const bytes = await doc.save();
  return new Blob([bytes], { type: "application/pdf" });
}

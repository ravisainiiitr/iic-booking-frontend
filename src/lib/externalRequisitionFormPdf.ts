import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  DEFAULT_DEPARTMENT_NAME,
  loadPdfMastheadBytes,
  PDF_BRAND_RGB,
  PDF_INK_RGB,
} from "@/lib/pdfLetterhead";
import type { BookingDetailCardBooking } from "@/components/BookingDetailCard";

function fmtDate(d: Date): string {
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function checkbox(label: string, checked: boolean): string {
  // Keep ASCII-only to avoid WinAnsi encoding errors in built-in PDF fonts.
  return `${checked ? "[x]" : "[ ]"} ${label}`;
}

export async function generateExternalEquipmentRequisitionFormPdf(booking: BookingDetailCardBooking): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 portrait (pt)
  const { width, height } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 40;
  let y = height - margin;

  const draw = (text: string, size = 10, opts?: { bold?: boolean; color?: { r: number; g: number; b: number } }) => {
    const usedFont = opts?.bold ? fontBold : font;
    page.drawText(text, {
      x: margin,
      y,
      size,
      font: usedFont,
      color: opts?.color ? rgb(opts.color.r, opts.color.g, opts.color.b) : rgb(0, 0, 0),
      maxWidth: width - margin * 2,
    });
    y -= size + 6;
  };

  const line = (gap = 10) => {
    y -= gap;
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 1,
      color: rgb(0.85, 0.85, 0.85),
    });
    y -= gap;
  };

  // Standard IITR letterhead (logo + Hindi + English + department + title)
  const mastheadBytes = await loadPdfMastheadBytes();
  const masthead = await pdfDoc.embedPng(mastheadBytes);
  const maxW = Math.min(340, width - margin * 2);
  const scale = maxW / masthead.width;
  const imgW = masthead.width * scale;
  const imgH = masthead.height * scale;
  y -= imgH;
  page.drawImage(masthead, { x: (width - imgW) / 2, y, width: imgW, height: imgH });
  y -= 14;
  const dept = DEFAULT_DEPARTMENT_NAME;
  const deptSize = 14;
  const deptW = fontBold.widthOfTextAtSize(dept, deptSize);
  page.drawText(dept, {
    x: (width - deptW) / 2,
    y,
    size: deptSize,
    font: fontBold,
    color: rgb(PDF_BRAND_RGB[0] / 255, PDF_BRAND_RGB[1] / 255, PDF_BRAND_RGB[2] / 255),
  });
  y -= 18;
  const docTitle = "Equipment Requisition Form (External Users)";
  const titleSize = 12;
  const titleW = fontBold.widthOfTextAtSize(docTitle, titleSize);
  page.drawText(docTitle, {
    x: (width - titleW) / 2,
    y,
    size: titleSize,
    font: fontBold,
    color: rgb(PDF_INK_RGB[0] / 255, PDF_INK_RGB[1] / 255, PDF_INK_RGB[2] / 255),
  });
  y -= 10;
  line(8);

  // Prefilled summary
  const bookingId = booking.virtual_booking_id || String(booking.booking_id);
  const slots = booking.daily_slots?.length ?? 0;
  const start = booking.start_time ? new Date(booking.start_time) : null;
  draw(`Equipment Name: ${booking.equipment_name || booking.equipment_code}`, 11, { bold: true });
  draw(`Booking ID: ${bookingId}    Slots: ${slots}    Date: ${start ? fmtDate(start) : "—"}`, 10);
  line(8);

  // User details
  draw("User Details", 11, { bold: true });
  draw(`Name (CAPITAL letters): ${booking.user_name || ""}`);
  draw(`E-mail (CAPITAL letters): ${booking.user_email || ""}`);
  draw(`Contact Number: ${booking.user_phone || ""}`);
  draw(`Institute / Organisation (with GST number, if any): ${booking.user_department || ""}`);
  draw("Invoice required in the name of: _______________________________");
  line(8);

  // Category checkboxes
  const ut = (booking.user_type_snapshot || "").toLowerCase();
  const isEdu = ut === "external";
  const isRnd = ut === "rnd";
  const isIndustry = ut === "industry";
  draw("Category (tick):", 11, { bold: true });
  draw(checkbox("Educational Institute", isEdu));
  draw(checkbox("Govt. R & D lab", isRnd));
  draw(checkbox("Industry", isIndustry));
  draw(checkbox("Other", !isEdu && !isRnd && !isIndustry));
  y -= 4;
  draw("No. of Slots (one slot = 90 minutes): __________    (Max 4 samples in one slot)", 10);
  line(8);

  // Sample / data
  draw("Sample Details", 11, { bold: true });
  draw("Sample Type:  [ ] Solid/Film   [ ] Powder");
  draw("Sample Requirement: Maximum Height 10–12 mm");
  draw("Requested Data (tick):  [ ] Imaging   [ ] EDS   [ ] Mapping");
  line(8);

  // Payment details section (user fills)
  draw("Payment Details (payment receipt must be attached)", 11, { bold: true });
  draw("I-STEM FBR No.: _______________________________");
  draw("Name of the A/c Holder: ________________________");
  draw("Name of the Bank: ______________________________");
  draw("Date of transaction: ____________________________");
  draw("UTR / Transaction number: _______________________");
  draw("Total Amount (Rs): ______________________________");
  y -= 6;
  draw("Signature of User: ______________________________");
  draw("Supervisor/HOD (Signature with Seal): ____________");
  line(8);

  // Bank details (from template)
  draw("Bank Account Details (for reference)", 11, { bold: true });
  draw("Name of the Bank: STATE BANK OF INDIA");
  draw("Branch Office: IIT ROORKEE - 247667");
  draw("Account No.: 33136732957");
  draw("Holder Name: DEAN SRIC IITR");
  draw("Branch No.: 1069");
  draw("IFS Code: SBIN0001069");
  draw("GST No.: 05AAALI0033R1Z5");

  const bytes = await pdfDoc.save();
  return new Blob([bytes], { type: "application/pdf" });
}


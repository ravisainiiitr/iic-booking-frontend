/**
 * Export Analysis Charges as a professional rate sheet (PDF / Excel).
 * Layout: department as document header; columns Equipment | User Category | Charge | GST.
 */
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

export type AnalysisChargeExportRow = {
  equipmentName: string;
  userCategory: string;
  charge: string;
  gst: string;
};

function defaultFilename(ext: "xlsx" | "pdf"): string {
  return `analysis-charges-${format(new Date(), "yyyy-MM-dd-HHmm")}.${ext}`;
}

/** jsPDF core fonts do not render ₹ reliably — use Rs. in PDF body text. */
function pdfSafeMoney(text: string): string {
  return String(text || "")
    .replace(/\u20B9/g, "Rs.")
    .replace(/₹/g, "Rs.")
    .replace(/\s+/g, " ")
    .trim();
}

export function exportAnalysisChargesExcel(
  rows: AnalysisChargeExportRow[],
  options?: { filename?: string; departmentName?: string }
): void {
  if (!rows.length) return;
  const dept = (options?.departmentName || "").trim() || "Department";
  const generated = format(new Date(), "dd MMM yyyy, HH:mm");
  const aoa: (string | number)[][] = [
    ["Institute Equipment Booking Portal — Analysis Charges"],
    [`Department: ${dept}`],
    [`Generated: ${generated}`],
    [],
    ["S.No.", "Equipment", "User Category", "Charge", "GST"],
    ...rows.map((r, i) => [i + 1, r.equipmentName, r.userCategory, r.charge, r.gst]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 8 }, { wch: 42 }, { wch: 28 }, { wch: 56 }, { wch: 18 }];
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 4 } },
  ];
  const wb = XLSX.utils.book_new();
  const sheetName = dept.slice(0, 31) || "Analysis Charges";
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const name = options?.filename || defaultFilename("xlsx");
  XLSX.writeFile(wb, name.endsWith(".xlsx") ? name : `${name}.xlsx`);
}

export function exportAnalysisChargesPdf(
  rows: AnalysisChargeExportRow[],
  options?: { filename?: string; departmentName?: string; title?: string }
): void {
  if (!rows.length) return;
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const marginX = 36;
  const dept = (options?.departmentName || "").trim() || "Department";
  const title = options?.title || "Analysis Charges";

  // Header band
  doc.setFillColor(15, 76, 129);
  doc.rect(0, 0, pageW, 72, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Institute Equipment Booking Portal", marginX, 28);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(title, marginX, 48);
  doc.setFontSize(9);
  doc.text(`Generated ${format(new Date(), "dd MMM yyyy, HH:mm")}`, pageW - marginX, 48, {
    align: "right",
  });

  // Department title block
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(dept, marginX, 98);
  doc.setDrawColor(15, 76, 129);
  doc.setLineWidth(1.2);
  doc.line(marginX, 106, pageW - marginX, 106);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text("Charges by user category (standard published rates)", marginX, 122);

  autoTable(doc, {
    startY: 136,
    head: [["S.No.", "Equipment", "User Category", "Charge", "GST"]],
    body: rows.map((r, i) => [
      String(i + 1),
      r.equipmentName,
      r.userCategory,
      pdfSafeMoney(r.charge),
      r.gst,
    ]),
    margin: { left: marginX, right: marginX },
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: { top: 6, right: 5, bottom: 6, left: 5 },
      overflow: "linebreak",
      valign: "top",
      lineColor: [226, 232, 240],
      lineWidth: 0.4,
      textColor: [15, 23, 42],
    },
    headStyles: {
      fillColor: [15, 76, 129],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 8.5,
      cellPadding: { top: 7, right: 5, bottom: 7, left: 5 },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 36, halign: "center" },
      1: { cellWidth: 145, fontStyle: "bold" },
      2: { cellWidth: 105 },
      3: { cellWidth: 170 },
      4: { cellWidth: 72, halign: "center" },
    },
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages();
      const pageH = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(
        `Page ${data.pageNumber} of ${pageCount}`,
        pageW / 2,
        pageH - 18,
        { align: "center" }
      );
    },
  });

  const name = options?.filename || defaultFilename("pdf");
  doc.save(name.endsWith(".pdf") ? name : `${name}.pdf`);
}

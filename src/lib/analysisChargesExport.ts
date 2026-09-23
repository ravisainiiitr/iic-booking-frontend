/**
 * Export Analysis Charges rate-card rows to Excel (.xlsx) or PDF.
 */
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

export type AnalysisChargeExportRow = {
  department: string;
  equipmentCode: string;
  equipmentName: string;
  userCategory: string;
  charge: string;
  gst: string;
};

function defaultFilename(ext: "xlsx" | "pdf"): string {
  return `analysis-charges-${format(new Date(), "yyyy-MM-dd-HHmm")}.${ext}`;
}

export function exportAnalysisChargesExcel(
  rows: AnalysisChargeExportRow[],
  options?: { filename?: string }
): void {
  if (!rows.length) return;
  const header = ["Department", "Equipment Code", "Equipment Name", "User Category", "Charge", "GST"];
  const data = rows.map((r) => [
    r.department,
    r.equipmentCode,
    r.equipmentName,
    r.userCategory,
    r.charge,
    r.gst,
  ]);
  const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
  ws["!cols"] = [
    { wch: 28 },
    { wch: 14 },
    { wch: 36 },
    { wch: 28 },
    { wch: 48 },
    { wch: 18 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Analysis Charges");
  const name = options?.filename || defaultFilename("xlsx");
  XLSX.writeFile(wb, name.endsWith(".xlsx") ? name : `${name}.xlsx`);
}

export function exportAnalysisChargesPdf(
  rows: AnalysisChargeExportRow[],
  options?: { filename?: string; title?: string }
): void {
  if (!rows.length) return;
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const title = options?.title || "Institute Equipment Booking Portal — Analysis Charges";
  doc.setFontSize(14);
  doc.text(title, 40, 36);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Generated ${format(new Date(), "dd MMM yyyy, HH:mm")}`, 40, 52);
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 64,
    head: [["Department", "Code", "Equipment", "User category", "Charge", "GST"]],
    body: rows.map((r) => [
      r.department,
      r.equipmentCode,
      r.equipmentName,
      r.userCategory,
      r.charge,
      r.gst,
    ]),
    styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
    headStyles: { fillColor: [15, 76, 129], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 90 },
      1: { cellWidth: 55 },
      2: { cellWidth: 140 },
      3: { cellWidth: 100 },
      4: { cellWidth: 220 },
      5: { cellWidth: 70 },
    },
  });

  const name = options?.filename || defaultFilename("pdf");
  doc.save(name.endsWith(".pdf") ? name : `${name}.pdf`);
}

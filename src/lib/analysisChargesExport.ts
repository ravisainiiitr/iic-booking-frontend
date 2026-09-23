/**
 * Export Analysis Charges as a professional rate sheet (PDF / Excel).
 * Layout: department header; rows = equipment; columns = user categories (charge + GST).
 */
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

export type AnalysisChargeLine = {
  option: string;
  amount: string;
};

export type AnalysisChargeExportRow = {
  equipmentName: string;
  userCategory: string;
  /** Flat text fallback (single-line / simple profiles). */
  charge: string;
  gst: string;
  /** Multi-parameter: one entry per option (Room Temperature, etc.). */
  chargeLines?: AnalysisChargeLine[];
};

export type AnalysisChargePivotTable = {
  categories: string[];
  rows: Array<{
    equipmentName: string;
    cells: Record<
      string,
      { charge: string; gst: string; chargeLines?: AnalysisChargeLine[] }
    >;
  }>;
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

/** Pivot long-format charge rows so user categories become column headers. */
export function pivotAnalysisChargeRows(
  rows: AnalysisChargeExportRow[]
): AnalysisChargePivotTable {
  const categoryOrder: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const cat = String(r.userCategory || "").trim() || "—";
    if (!seen.has(cat)) {
      seen.add(cat);
      categoryOrder.push(cat);
    }
  }

  const byEquipment = new Map<
    string,
    Record<string, { charge: string; gst: string; chargeLines?: AnalysisChargeLine[] }>
  >();
  const equipmentOrder: string[] = [];

  for (const r of rows) {
    const name = String(r.equipmentName || "").trim() || "—";
    const cat = String(r.userCategory || "").trim() || "—";
    if (!byEquipment.has(name)) {
      byEquipment.set(name, {});
      equipmentOrder.push(name);
    }
    byEquipment.get(name)![cat] = {
      charge: String(r.charge || "").trim() || "—",
      gst: String(r.gst || "").trim() || "—",
      ...(r.chargeLines && r.chargeLines.length > 0 ? { chargeLines: r.chargeLines } : {}),
    };
  }

  return {
    categories: categoryOrder,
    rows: equipmentOrder.map((equipmentName) => ({
      equipmentName,
      cells: byEquipment.get(equipmentName) || {},
    })),
  };
}

function cellDisplay(
  charge: string,
  gst: string,
  chargeLines?: AnalysisChargeLine[]
): string {
  const lines =
    chargeLines && chargeLines.length > 0
      ? chargeLines.map((l) => `${l.option}: ${l.amount}`).join("\n")
      : String(charge || "").trim() || "—";
  const g = String(gst || "").trim();
  if (!g || /^—$/.test(g)) return lines;
  return `${lines}\n(${g})`;
}

export function exportAnalysisChargesExcel(
  rows: AnalysisChargeExportRow[],
  options?: { filename?: string; departmentName?: string }
): void {
  if (!rows.length) return;
  const dept = (options?.departmentName || "").trim() || "Department";
  const generated = format(new Date(), "dd MMM yyyy, HH:mm");
  const pivot = pivotAnalysisChargeRows(rows);
  const header = ["S.No.", "Equipment", ...pivot.categories];
  const aoa: (string | number)[][] = [
    ["Institute Equipment Booking Portal — Analysis Charges"],
    [`Department: ${dept}`],
    [`Generated: ${generated}`],
    [],
    header,
    ...pivot.rows.map((r, i) => [
      i + 1,
      r.equipmentName,
      ...pivot.categories.map((cat) => {
        const cell = r.cells[cat];
        return cell ? cellDisplay(cell.charge, cell.gst, cell.chargeLines) : "—";
      }),
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 8 },
    { wch: 36 },
    ...pivot.categories.map(() => ({ wch: 28 })),
  ];
  const lastCol = Math.max(header.length - 1, 1);
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: lastCol } },
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
  const pivot = pivotAnalysisChargeRows(rows);
  const useLandscape = pivot.categories.length > 3;
  const doc = new jsPDF({
    orientation: useLandscape ? "landscape" : "portrait",
    unit: "pt",
    format: "a4",
  });
  const pageW = doc.internal.pageSize.getWidth();
  const marginX = 28;
  const dept = (options?.departmentName || "").trim() || "Department";
  const title = options?.title || "Analysis Charges";

  doc.setFillColor(15, 76, 129);
  doc.rect(0, 0, pageW, 64, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Institute Equipment Booking Portal", marginX, 26);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(title, marginX, 44);
  doc.setFontSize(9);
  doc.text(`Department: ${dept}`, marginX, 58);

  const head = [["S.No.", "Equipment", ...pivot.categories.map((c) => pdfSafeMoney(c))]];
  const body = pivot.rows.map((r, i) => [
    String(i + 1),
    pdfSafeMoney(r.equipmentName),
    ...pivot.categories.map((cat) => {
      const cell = r.cells[cat];
      if (!cell) return "—";
      return pdfSafeMoney(cellDisplay(cell.charge, cell.gst, cell.chargeLines));
    }),
  ]);

  autoTable(doc, {
    startY: 76,
    head,
    body,
    margin: { left: marginX, right: marginX },
    styles: {
      fontSize: pivot.categories.length > 4 ? 7 : 8,
      cellPadding: 4,
      valign: "top",
      overflow: "linebreak",
      lineColor: [180, 190, 200],
      lineWidth: 0.4,
    },
    headStyles: {
      fillColor: [15, 76, 129],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 8,
      lineColor: [15, 76, 129],
      lineWidth: 0.4,
    },
    alternateRowStyles: {
      fillColor: [245, 248, 252],
    },
    columnStyles: {
      0: { cellWidth: 28, halign: "center" },
      1: { cellWidth: useLandscape ? 110 : 90, textColor: [15, 76, 129], fontStyle: "bold" },
    },
    didDrawPage: (data) => {
      const pageH = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(
        `Generated ${format(new Date(), "dd MMM yyyy, HH:mm")}`,
        marginX,
        pageH - 16
      );
      doc.text(
        `Page ${data.pageNumber}`,
        pageW - marginX,
        pageH - 16,
        { align: "right" }
      );
    },
  });

  const name = options?.filename || defaultFilename("pdf");
  doc.save(name.endsWith(".pdf") ? name : `${name}.pdf`);
}

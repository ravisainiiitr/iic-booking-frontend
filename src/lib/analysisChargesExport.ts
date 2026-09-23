/**
 * Export Analysis Charges as a professional rate sheet (PDF / Excel).
 * Layout: department header; rows = equipment (+ parameter for multi-param);
 * columns = user categories.
 */
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { DEFAULT_DEPARTMENT_NAME, drawPdfLetterhead } from "@/lib/pdfLetterhead";

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

export type AnalysisChargePivotCell = {
  amount: string;
  gst: string;
};

export type AnalysisChargePivotDisplayRow = {
  equipmentName: string;
  /** Present for multi-parameter profiles (shown once per option row). */
  parameter: string | null;
  isMultiParam: boolean;
  isFirstOfEquipment: boolean;
  equipmentRowSpan: number;
  serialNumber: number;
  cells: Record<string, AnalysisChargePivotCell>;
};

export type AnalysisChargePivotTable = {
  categories: string[];
  hasParameters: boolean;
  rows: AnalysisChargePivotDisplayRow[];
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

/**
 * Pivot long-format charge rows so user categories become column headers.
 * Multi-parameter equipment expands to one table row per option (parameter
 * shown once on the left — not repeated inside every user-type cell).
 */
export function pivotAnalysisChargeRows(
  rows: AnalysisChargeExportRow[]
): AnalysisChargePivotTable {
  const categoryOrder: string[] = [];
  const seenCat = new Set<string>();
  for (const r of rows) {
    const cat = String(r.userCategory || "").trim() || "—";
    if (!seenCat.has(cat)) {
      seenCat.add(cat);
      categoryOrder.push(cat);
    }
  }

  type EqBucket = {
    byCategory: Record<
      string,
      { charge: string; gst: string; chargeLines?: AnalysisChargeLine[] }
    >;
  };
  const byEquipment = new Map<string, EqBucket>();
  const equipmentOrder: string[] = [];

  for (const r of rows) {
    const name = String(r.equipmentName || "").trim() || "—";
    const cat = String(r.userCategory || "").trim() || "—";
    if (!byEquipment.has(name)) {
      byEquipment.set(name, { byCategory: {} });
      equipmentOrder.push(name);
    }
    byEquipment.get(name)!.byCategory[cat] = {
      charge: String(r.charge || "").trim() || "—",
      gst: String(r.gst || "").trim() || "—",
      ...(r.chargeLines && r.chargeLines.length > 0 ? { chargeLines: r.chargeLines } : {}),
    };
  }

  const displayRows: AnalysisChargePivotDisplayRow[] = [];
  let serial = 0;
  let hasParameters = false;

  for (const equipmentName of equipmentOrder) {
    const bucket = byEquipment.get(equipmentName)!;
    const cats = categoryOrder
      .map((c) => bucket.byCategory[c])
      .filter(Boolean);
    const optionOrder: string[] = [];
    const seenOpt = new Set<string>();
    for (const cell of cats) {
      for (const line of cell.chargeLines || []) {
        const opt = String(line.option || "").trim();
        if (opt && !seenOpt.has(opt)) {
          seenOpt.add(opt);
          optionOrder.push(opt);
        }
      }
    }

    if (optionOrder.length > 0) {
      hasParameters = true;
      serial += 1;
      const span = optionOrder.length;
      optionOrder.forEach((opt, optIdx) => {
        const cells: Record<string, AnalysisChargePivotCell> = {};
        for (const cat of categoryOrder) {
          const src = bucket.byCategory[cat];
          if (!src) {
            cells[cat] = { amount: "—", gst: "—" };
            continue;
          }
          const line = (src.chargeLines || []).find(
            (l) => String(l.option || "").trim() === opt
          );
          cells[cat] = {
            amount: line?.amount?.trim() || "—",
            gst: src.gst || "—",
          };
        }
        displayRows.push({
          equipmentName,
          parameter: opt,
          isMultiParam: true,
          isFirstOfEquipment: optIdx === 0,
          equipmentRowSpan: span,
          serialNumber: serial,
          cells,
        });
      });
    } else {
      serial += 1;
      const cells: Record<string, AnalysisChargePivotCell> = {};
      for (const cat of categoryOrder) {
        const src = bucket.byCategory[cat];
        cells[cat] = src
          ? { amount: src.charge || "—", gst: src.gst || "—" }
          : { amount: "—", gst: "—" };
      }
      displayRows.push({
        equipmentName,
        parameter: null,
        isMultiParam: false,
        isFirstOfEquipment: true,
        equipmentRowSpan: 1,
        serialNumber: serial,
        cells,
      });
    }
  }

  return { categories: categoryOrder, hasParameters, rows: displayRows };
}

function cellExportText(cell: AnalysisChargePivotCell): string {
  return String(cell.amount || "").trim() || "—";
}

const GST_EXPORT_NOTE =
  "Note: All rates are exclusive of GST. GST @ 18% will be applicable to external users. No GST is applicable to IIT Roorkee internal users.";

export function exportAnalysisChargesExcel(
  rows: AnalysisChargeExportRow[],
  options?: { filename?: string; departmentName?: string }
): void {
  if (!rows.length) return;
  const dept = (options?.departmentName || "").trim() || "Department";
  const generated = format(new Date(), "dd MMM yyyy, HH:mm");
  const pivot = pivotAnalysisChargeRows(rows);
  const header = pivot.hasParameters
    ? ["S.No.", "Equipment", "Parameter", ...pivot.categories]
    : ["S.No.", "Equipment", ...pivot.categories];
  const aoa: (string | number)[][] = [
    ["Institute Equipment Booking Portal — Analysis Charges"],
    [`Department: ${dept}`],
    [`Generated: ${generated}`],
    [GST_EXPORT_NOTE],
    [],
    header,
    ...pivot.rows.map((r) => {
      const amounts = pivot.categories.map((cat) => {
        const cell = r.cells[cat];
        return cell ? cellExportText(cell) : "—";
      });
      if (pivot.hasParameters) {
        return [
          r.isFirstOfEquipment ? r.serialNumber : "",
          r.isFirstOfEquipment ? r.equipmentName : "",
          r.parameter || "—",
          ...amounts,
        ];
      }
      return [r.serialNumber, r.equipmentName, ...amounts];
    }),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = pivot.hasParameters
    ? [
        { wch: 8 },
        { wch: 36 },
        { wch: 22 },
        ...pivot.categories.map(() => ({ wch: 22 })),
      ]
    : [{ wch: 8 }, { wch: 36 }, ...pivot.categories.map(() => ({ wch: 28 }))];
  const lastCol = Math.max(header.length - 1, 1);
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: lastCol } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: lastCol } },
  ];
  const wb = XLSX.utils.book_new();
  const sheetName = dept.slice(0, 31) || "Analysis Charges";
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const name = options?.filename || defaultFilename("xlsx");
  XLSX.writeFile(wb, name.endsWith(".xlsx") ? name : `${name}.xlsx`);
}

export async function exportAnalysisChargesPdf(
  rows: AnalysisChargeExportRow[],
  options?: { filename?: string; departmentName?: string; title?: string }
): Promise<void> {
  if (!rows.length) return;
  const pivot = pivotAnalysisChargeRows(rows);
  const useLandscape = pivot.categories.length > 3 || pivot.hasParameters;
  const doc = new jsPDF({
    orientation: useLandscape ? "landscape" : "portrait",
    unit: "pt",
    format: "a4",
  });
  const pageW = doc.internal.pageSize.getWidth();
  const marginX = 28;
  const dept = (options?.departmentName || "").trim() || DEFAULT_DEPARTMENT_NAME;
  const title = options?.title || "Analysis Charges";

  let y = await drawPdfLetterhead(doc, {
    departmentName: dept,
    documentTitle: title,
  });

  doc.setTextColor(146, 64, 14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  const noteLines = doc.splitTextToSize(GST_EXPORT_NOTE, pageW - marginX * 2);
  doc.text(noteLines, marginX, y);
  const tableStartY = y + noteLines.length * 10 + 8;

  const head = [
    pivot.hasParameters
      ? ["S.No.", "Equipment", "Parameter", ...pivot.categories.map((c) => pdfSafeMoney(c))]
      : ["S.No.", "Equipment", ...pivot.categories.map((c) => pdfSafeMoney(c))],
  ];
  const body = pivot.rows.map((r) => {
    const amounts = pivot.categories.map((cat) => {
      const cell = r.cells[cat];
      if (!cell) return "—";
      return pdfSafeMoney(cellExportText(cell));
    });
    if (pivot.hasParameters) {
      return [
        r.isFirstOfEquipment ? String(r.serialNumber) : "",
        r.isFirstOfEquipment ? pdfSafeMoney(r.equipmentName) : "",
        pdfSafeMoney(r.parameter || "—"),
        ...amounts,
      ];
    }
    return [String(r.serialNumber), pdfSafeMoney(r.equipmentName), ...amounts];
  });

  autoTable(doc, {
    startY: tableStartY,
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
    columnStyles: pivot.hasParameters
      ? {
          0: { cellWidth: 26, halign: "center" },
          1: { cellWidth: useLandscape ? 100 : 80, textColor: [15, 76, 129], fontStyle: "bold" },
          2: { cellWidth: 70, fontStyle: "bold" },
        }
      : {
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

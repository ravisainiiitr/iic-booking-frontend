/**
 * Shared look for client-side table exports, matching the portal's tables and the server exports:
 * centred headers and cells (long free text left), shaded header, thin grid, S.No. supplied by callers.
 */
import type { UserOptions } from "jspdf-autotable";

const BRAND_RGB: [number, number, number] = [21, 63, 121];
const GRID_RGB: [number, number, number] = [213, 221, 232];
const STRIPE_RGB: [number, number, number] = [245, 247, 251];

/** jsPDF-autotable options: centred cells, shaded header repeated on every page, thin grid. */
export function pdfTableStyle(opts: { fontSize?: number; cellPadding?: number } = {}): Partial<UserOptions> {
  return {
    theme: "grid",
    showHead: "everyPage",
    styles: {
      fontSize: opts.fontSize ?? 8,
      cellPadding: opts.cellPadding ?? 3,
      halign: "center",
      valign: "middle",
      overflow: "linebreak",
      lineColor: GRID_RGB,
      lineWidth: 0.4,
    },
    headStyles: {
      fillColor: BRAND_RGB,
      textColor: 255,
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
    },
    alternateRowStyles: { fillColor: STRIPE_RGB },
  };
}

export type StyledCell = string | number | null | undefined;

export interface StyledSheet {
  name: string;
  /** Lines above the table: title first, then filters / "Generated …". */
  intro?: string[];
  header: string[];
  rows: StyledCell[][];
  /** Column widths in characters; computed from the content when omitted. */
  widths?: number[];
  /** Columns holding long free text (descriptions, remarks): left-aligned like on screen. */
  leftColumns?: number[];
  /** Absolute URL per row and column; linked cells open the record on the portal. */
  links?: Array<Array<string | undefined> | undefined>;
}

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function frozenSheetViews(headerRow: number): string {
  const split = headerRow + 1;
  return (
    `<sheetViews><sheetView workbookViewId="0">` +
    `<pane ySplit="${split}" topLeftCell="A${split + 1}" activePane="bottomLeft" state="frozen"/>` +
    `<selection pane="bottomLeft" activeCell="A${split + 1}" sqref="A${split + 1}"/>` +
    `</sheetView></sheetViews>`
  );
}

/** SheetJS cannot write frozen panes, so they are added to each sheet's XML. */
export function freezeHeaderXml(xml: string, headerRow: number): string {
  const views = frozenSheetViews(headerRow);
  if (/<sheetViews[\s>]/.test(xml)) return xml.replace(/<sheetViews[\s\S]*?<\/sheetViews>/, views);
  const anchor = xml.search(/<sheetFormatPr|<cols[\s/>]|<sheetData/);
  return anchor < 0 ? xml : xml.slice(0, anchor) + views + xml.slice(anchor);
}

function columnWidths(sheet: StyledSheet): number[] {
  if (sheet.widths) return sheet.widths;
  return sheet.header.map((head, c) => {
    const longest = sheet.rows.reduce((max, row) => Math.max(max, String(row[c] ?? "").length), head.length);
    return Math.min(Math.max(longest + 2, 8), 50);
  });
}

/** Excel workbook with centred, bordered tables, a bold shaded header row (frozen), autofilter and links. */
export async function downloadStyledWorkbook(sheets: StyledSheet[], filename: string): Promise<void> {
  const [XLSX, { default: JSZip }] = await Promise.all([import("xlsx-js-style"), import("jszip")]);
  const wb = XLSX.utils.book_new();
  const headerRows: number[] = [];
  const thin = { style: "thin", color: { rgb: "CBD5E1" } };
  const border = { top: thin, bottom: thin, left: thin, right: thin };

  for (const sheet of sheets) {
    const intro = sheet.intro ?? [];
    const headerRow = intro.length ? intro.length + 1 : 0;
    headerRows.push(headerRow);
    const aoa: StyledCell[][] = [...intro.map((line) => [line]), ...(intro.length ? [[]] : []), sheet.header, ...sheet.rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const cellAt = (r: number, c: number) => {
      const ref = XLSX.utils.encode_cell({ r, c });
      if (!ws[ref]) ws[ref] = { t: "s", v: "" };
      return ws[ref];
    };
    intro.forEach((_, r) => {
      cellAt(r, 0).s = r === 0
        ? { font: { bold: true, sz: 13, color: { rgb: "153F79" } } }
        : { font: { color: { rgb: "475569" } } };
    });
    sheet.header.forEach((_, c) => {
      cellAt(headerRow, c).s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { patternType: "solid", fgColor: { rgb: "153F79" } },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border,
      };
    });
    const left = new Set(sheet.leftColumns ?? []);
    sheet.rows.forEach((row, i) => {
      const r = headerRow + 1 + i;
      const stripe = i % 2 === 1 ? { fill: { patternType: "solid", fgColor: { rgb: "F5F7FB" } } } : {};
      sheet.header.forEach((_, c) => {
        const cell = cellAt(r, c);
        const url = sheet.links?.[i]?.[c];
        if (url && row[c] != null && row[c] !== "") cell.l = { Target: url, Tooltip: "Open on the portal" };
        cell.s = {
          alignment: { horizontal: left.has(c) ? "left" : "center", vertical: "center", wrapText: true },
          border,
          ...(url ? { font: { color: { rgb: "1D4ED8" }, underline: true } } : {}),
          ...stripe,
        };
      });
    });
    ws["!cols"] = columnWidths(sheet).map((wch) => ({ wch }));
    if (sheet.rows.length) {
      ws["!autofilter"] = {
        ref: XLSX.utils.encode_range({
          s: { r: headerRow, c: 0 },
          e: { r: headerRow + sheet.rows.length, c: sheet.header.length - 1 },
        }),
      };
    }
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.replace(/[\\/*?:[\]]/g, "-").slice(0, 31) || "Sheet");
  }

  const raw = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  const zip = await JSZip.loadAsync(raw);
  await Promise.all(
    headerRows.map(async (headerRow, i) => {
      const path = `xl/worksheets/sheet${i + 1}.xml`;
      const xml = await zip.file(path)?.async("string");
      if (xml) zip.file(path, freezeHeaderXml(xml, headerRow));
    }),
  );
  const blob = await zip.generateAsync({ type: "blob", mimeType: XLSX_MIME });
  const name = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

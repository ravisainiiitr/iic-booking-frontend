/**
 * Export wallet / sub-wallet transaction rows to Excel (.xlsx) or PDF.
 */
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { DEFAULT_DEPARTMENT_NAME, drawPdfLetterhead } from "@/lib/pdfLetterhead";

export interface WalletTransactionExportRow {
  equipment_name?: string | null;
  related_user_name?: string | null;
  created_at: string;
  transaction_type: "credit" | "debit" | string;
  description?: string;
  description_display?: string;
  amount: string;
  balance_after?: string | null;
  department_name?: string | null;
  department_code?: string | null;
}

function departmentCell(r: WalletTransactionExportRow): string {
  const parts = [r.department_name, r.department_code].filter(Boolean);
  return parts.join(" ").trim();
}

function descriptionCell(r: WalletTransactionExportRow): string {
  return (r.description_display || r.description || "")
    .replace(/\s+/g, " ")
    .trim();
}

function balanceCell(r: WalletTransactionExportRow): string {
  if (r.balance_after == null || String(r.balance_after) === "") return "";
  const n = Number(r.balance_after);
  return Number.isFinite(n) ? n.toFixed(2) : String(r.balance_after);
}

function amountCell(r: WalletTransactionExportRow): string {
  const n = Number(r.amount);
  return Number.isFinite(n) ? n.toFixed(2) : String(r.amount);
}

function defaultFilename(prefix: string, ext: "xlsx" | "pdf"): string {
  return `${prefix}-${format(new Date(), "yyyy-MM-dd-HHmm")}.${ext}`;
}

/**
 * Export transactions as Excel workbook (opens in Microsoft Excel / LibreOffice).
 */
export function exportWalletTransactionsExcel(
  rows: WalletTransactionExportRow[],
  options?: { filename?: string; sheetTitle?: string }
): void {
  if (!rows.length) return;
  const header = [
    "Equipment Name",
    "Booked by",
    "Date & Time",
    "Type",
    "Description",
    "Department",
    "Amount (INR)",
    "Balance Remaining (INR)",
  ];
  const data = rows.map((r) => [
    r.equipment_name ?? "",
    r.related_user_name ?? "",
    new Date(r.created_at).toLocaleString(),
    r.transaction_type === "credit" ? "Credit" : "Debit",
    descriptionCell(r),
    departmentCell(r),
    amountCell(r),
    balanceCell(r),
  ]);
  const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
  ws["!cols"] = [
    { wch: 28 },
    { wch: 22 },
    { wch: 22 },
    { wch: 10 },
    { wch: 48 },
    { wch: 22 },
    { wch: 14 },
    { wch: 18 },
  ];
  const wb = XLSX.utils.book_new();
  const sheetName = (options?.sheetTitle || "Transactions").slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const name = options?.filename || defaultFilename("wallet-transactions", "xlsx");
  XLSX.writeFile(wb, name.endsWith(".xlsx") ? name : `${name}.xlsx`);
}

/**
 * Export transactions as PDF (landscape A4 table).
 */
export async function exportWalletTransactionsPdf(
  rows: WalletTransactionExportRow[],
  options?: { filename?: string; title?: string; departmentName?: string }
): Promise<void> {
  if (!rows.length) return;
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const title = options?.title ?? "Wallet transaction history";
  const startY = await drawPdfLetterhead(doc, {
    departmentName: options?.departmentName || DEFAULT_DEPARTMENT_NAME,
    documentTitle: title,
    mastheadMaxWidth: 300,
  });

  const body = rows.map((r) => [
    (r.equipment_name ?? "—").slice(0, 80),
    (r.related_user_name ?? "—").slice(0, 40),
    new Date(r.created_at).toLocaleString(),
    r.transaction_type === "credit" ? "Credit" : "Debit",
    descriptionCell(r).slice(0, 200),
    departmentCell(r).slice(0, 40),
    amountCell(r),
    balanceCell(r) || "—",
  ]);

  autoTable(doc, {
    startY,
    head: [
      [
        "Equipment",
        "Booked by",
        "Date & time",
        "Type",
        "Description",
        "Department",
        "Amount (INR)",
        "Balance (INR)",
      ],
    ],
    body,
    styles: { fontSize: 6.5, cellPadding: 2.5, overflow: "linebreak" },
    headStyles: { fillColor: [55, 65, 81], textColor: 255 },
    margin: { left: 20, right: 20 },
    tableWidth: doc.internal.pageSize.getWidth() - 40,
    columnStyles: {
      0: { cellWidth: 85 },
      1: { cellWidth: 65 },
      2: { cellWidth: 85 },
      3: { cellWidth: 35 },
      4: { cellWidth: "auto" },
      5: { cellWidth: 65 },
      6: { cellWidth: 55, halign: "right" },
      7: { cellWidth: 55, halign: "right" },
    },
  });

  const name = options?.filename || defaultFilename("wallet-transactions", "pdf");
  doc.save(name.endsWith(".pdf") ? name : `${name}.pdf`);
}

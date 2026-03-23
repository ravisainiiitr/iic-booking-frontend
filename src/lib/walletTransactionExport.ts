/**
 * Export wallet / sub-wallet transaction rows to Excel (.xlsx) or PDF.
 */
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

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
export function exportWalletTransactionsPdf(
  rows: WalletTransactionExportRow[],
  options?: { filename?: string; title?: string }
): void {
  if (!rows.length) return;
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const title = options?.title ?? "Wallet transaction history";
  doc.setFontSize(11);
  doc.text(title, 40, 32);
  doc.setFontSize(8);

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
    startY: 42,
    head: [
      [
        "Equipment",
        "Booked by",
        "Date & time",
        "Type",
        "Description",
        "Department",
        "Amount (₹)",
        "Balance (₹)",
      ],
    ],
    body,
    styles: { fontSize: 7, cellPadding: 3, overflow: "linebreak" },
    headStyles: { fillColor: [55, 65, 81], textColor: 255 },
    margin: { left: 28, right: 28 },
    tableWidth: "auto",
    columnStyles: {
      0: { cellWidth: 90 },
      1: { cellWidth: 70 },
      2: { cellWidth: 95 },
      3: { cellWidth: 38 },
      4: { cellWidth: "auto" },
      5: { cellWidth: 70 },
      6: { cellWidth: 52 },
      7: { cellWidth: 52 },
    },
  });

  const name = options?.filename || defaultFilename("wallet-transactions", "pdf");
  doc.save(name.endsWith(".pdf") ? name : `${name}.pdf`);
}

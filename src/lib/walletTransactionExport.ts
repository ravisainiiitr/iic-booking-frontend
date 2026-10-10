/**
 * Export wallet / sub-wallet transaction rows to Excel (.xlsx) or PDF.
 */
import { format } from "date-fns";
import { DEFAULT_DEPARTMENT_NAME, drawPdfLetterhead } from "@/lib/pdfLetterhead";
import { downloadStyledWorkbook, pdfTableStyle } from "@/lib/styledExport";

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
export async function exportWalletTransactionsExcel(
  rows: WalletTransactionExportRow[],
  options?: { filename?: string; sheetTitle?: string }
): Promise<void> {
  if (!rows.length) return;
  const header = [
    "S.No.",
    "Equipment Name",
    "Booked by",
    "Date & Time",
    "Type",
    "Description",
    "Department",
    "Amount (INR)",
    "Balance Remaining (INR)",
  ];
  const data = rows.map((r, index) => [
    index + 1,
    r.equipment_name ?? "",
    r.related_user_name ?? "",
    new Date(r.created_at).toLocaleString(),
    r.transaction_type === "credit" ? "Credit" : "Debit",
    descriptionCell(r),
    departmentCell(r),
    amountCell(r),
    balanceCell(r),
  ]);
  const title = options?.sheetTitle || "Transactions";
  await downloadStyledWorkbook(
    [
      {
        name: title,
        intro: [`Wallet transactions — ${title}`, `Generated: ${format(new Date(), "dd MMM yyyy, HH:mm")}`],
        header,
        rows: data,
        widths: [7, 28, 22, 22, 10, 48, 22, 14, 18],
        leftColumns: [5],
      },
    ],
    options?.filename || defaultFilename("wallet-transactions", "xlsx"),
  );
}

/**
 * Export transactions as PDF (landscape A4 table).
 */
export async function exportWalletTransactionsPdf(
  rows: WalletTransactionExportRow[],
  options?: { filename?: string; title?: string; departmentName?: string }
): Promise<void> {
  if (!rows.length) return;
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const title = options?.title ?? "Wallet transaction history";
  const startY = await drawPdfLetterhead(doc, {
    departmentName: options?.departmentName || DEFAULT_DEPARTMENT_NAME,
    documentTitle: title,
    mastheadMaxWidth: 300,
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${format(new Date(), "dd MMM yyyy, HH:mm")}`, 20, startY);

  const body = rows.map((r, index) => [
    String(index + 1),
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
    ...pdfTableStyle({ fontSize: 6.5, cellPadding: 2.5 }),
    startY: startY + 10,
    head: [
      [
        "S.No.",
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
    margin: { left: 20, right: 20 },
    tableWidth: doc.internal.pageSize.getWidth() - 40,
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 85 },
      2: { cellWidth: 65 },
      3: { cellWidth: 85 },
      4: { cellWidth: 35 },
      5: { cellWidth: "auto", halign: "left" },
      6: { cellWidth: 65 },
      7: { cellWidth: 55 },
      8: { cellWidth: 55 },
    },
  });

  const name = options?.filename || defaultFilename("wallet-transactions", "pdf");
  doc.save(name.endsWith(".pdf") ? name : `${name}.pdf`);
}

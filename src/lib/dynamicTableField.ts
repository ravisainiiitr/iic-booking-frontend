/**
 * Shared helpers for Dynamic Input Field type TABLE:
 * - optional row count driven by another field (source_element_field_key)
 * - first column treated as read-only serial number (S.No.) when configured
 */

export type TableColumnHeader = string;

/** True when a column header is the serial-number column (S.No. / Sr. No. / Serial No.). */
export function isSerialNumberHeader(header: string | null | undefined): boolean {
  const raw = String(header ?? "").trim().toLowerCase();
  if (!raw) return false;
  const compact = raw.replace(/[\s._-]+/g, "");
  if (compact === "sno" || compact === "srno" || compact === "serialno" || compact === "serialnumber") {
    return true;
  }
  if (raw === "s.no" || raw === "s.no." || raw === "s no" || raw === "s no.") return true;
  if (raw.includes("serial") && raw.includes("no")) return true;
  if (raw.startsWith("sr") && (raw.includes("no") || raw.includes("."))) return true;
  return false;
}

/** Normalize options list into column header strings. */
export function parseTableColumnHeaders(options: unknown): string[] {
  if (!Array.isArray(options)) return [];
  return options
    .map((h) => {
      if (typeof h === "string") return h.trim();
      if (h && typeof h === "object") {
        const o = h as { label?: unknown; value?: unknown };
        return String(o.label ?? o.value ?? "").trim();
      }
      return String(h ?? "").trim();
    })
    .filter(Boolean);
}

/**
 * Resolve display columns for a TABLE field.
 * When row-count is driven by another field, ensure a leading serial column exists.
 */
export function resolveTableColumns(
  options: unknown,
  opts?: { ensureSerialWhenRowDriven?: boolean; rowCountDriven?: boolean }
): { columns: string[]; hasSerialColumn: boolean } {
  let columns = parseTableColumnHeaders(options);
  const rowCountDriven = Boolean(opts?.rowCountDriven);
  const ensureSerial = opts?.ensureSerialWhenRowDriven !== false && rowCountDriven;
  const hasSerial = columns.length > 0 && isSerialNumberHeader(columns[0]);
  if (ensureSerial && !hasSerial) {
    columns = ["S.No.", ...columns];
  }
  if (ensureSerial && columns.length === 0) {
    columns = ["S.No."];
  }
  return {
    columns,
    hasSerialColumn: columns.length > 0 && isSerialNumberHeader(columns[0]),
  };
}

/** Parse a positive integer row count from a linked numeric field value. */
export function parseTableRowCount(raw: unknown): number {
  if (raw == null || raw === "") return 0;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

/**
 * Build table rows for the desired count.
 * Preserves existing cell data for overlapping rows; pads/truncates as needed.
 * When hasSerialColumn, column 0 is always set to 1…N (read-only serial).
 */
export function syncTableRowsToCount(
  prevRows: unknown,
  rowCount: number,
  colCount: number,
  hasSerialColumn: boolean
): string[][] {
  const n = Math.max(0, Math.floor(rowCount));
  const cols = Math.max(0, Math.floor(colCount));
  if (cols === 0) return [];

  const prev: string[][] = Array.isArray(prevRows)
    ? (prevRows as unknown[])
        .filter((r) => Array.isArray(r))
        .map((r) => (r as unknown[]).map((c) => String(c ?? "")))
    : [];

  const built: string[][] = [];
  for (let i = 0; i < n; i++) {
    const row = prev[i] ? prev[i].slice() : Array(cols).fill("");
    while (row.length < cols) row.push("");
    if (row.length > cols) row.length = cols;
    if (hasSerialColumn) {
      row[0] = String(i + 1);
    }
    built.push(row);
  }
  return built;
}

/** Whether two row matrices are deeply equal (string cells). */
export function tableRowsEqual(a: string[][], b: string[][]): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (r, i) =>
      r.length === (b[i]?.length || 0) && r.every((c, j) => c === (b[i]?.[j] ?? ""))
  );
}

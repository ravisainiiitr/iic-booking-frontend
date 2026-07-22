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

type FieldLike = {
  field_key?: string | null;
  field_type?: string | null;
  source_element_field_key?: string | null;
  options?: unknown;
};

/**
 * Resolve which field key drives a TABLE's row count.
 * Prefer configured source_element_field_key; otherwise fall back to NUMERIC "A"
 * (common "No. of Samples" pattern), then the first NUMERIC field.
 */
export function resolveTableRowCountSourceKey(
  tableField: FieldLike,
  allFields: FieldLike[] | null | undefined
): string {
  const configured = String(tableField?.source_element_field_key ?? "").trim().toUpperCase();
  const fields = Array.isArray(allFields) ? allFields : [];
  const numericKeys = fields
    .filter((f) => String(f?.field_type || "").toUpperCase().trim() === "NUMERIC")
    .map((f) => String(f?.field_key || "").trim().toUpperCase())
    .filter(Boolean);

  if (configured) {
    if (numericKeys.length === 0 || numericKeys.includes(configured)) return configured;
    return configured;
  }
  if (numericKeys.includes("A")) return "A";
  return numericKeys[0] || "";
}

/** Look up a value in a field-values map with case-insensitive key match. */
export function getFieldValueCI(
  values: Record<string, unknown> | null | undefined,
  fieldKey: string
): unknown {
  if (!values || !fieldKey) return undefined;
  if (Object.prototype.hasOwnProperty.call(values, fieldKey)) return values[fieldKey];
  const want = fieldKey.toUpperCase();
  for (const k of Object.keys(values)) {
    if (k.toUpperCase() === want) return values[k];
  }
  return undefined;
}

/**
 * Apply TABLE row-count sync onto a values map. Returns whether anything changed.
 * When `onlySourceKey` is set, only tables driven by that key are updated.
 */
export function applyTableRowSyncToValues(
  values: Record<string, unknown>,
  allFields: FieldLike[] | null | undefined,
  onlySourceKey?: string | null
): boolean {
  const fields = Array.isArray(allFields) ? allFields : [];
  if (fields.length === 0) return false;
  const only = onlySourceKey ? String(onlySourceKey).trim().toUpperCase() : "";
  let changed = false;

  for (const field of fields) {
    if (String(field?.field_type || "").toUpperCase().trim() !== "TABLE") continue;
    const sourceKey = resolveTableRowCountSourceKey(field, fields);
    if (!sourceKey) continue;
    if (only && sourceKey !== only) continue;

    const tableKey = String(field?.field_key || "").trim();
    if (!tableKey) continue;

    const n = parseTableRowCount(getFieldValueCI(values, sourceKey));
    const { columns, hasSerialColumn } = resolveTableColumns(field.options, {
      rowCountDriven: true,
    });
    const prevRows = getFieldValueCI(values, tableKey);
    const built = syncTableRowsToCount(prevRows, n, columns.length, hasSerialColumn);
    const prevArr = (Array.isArray(prevRows) ? prevRows : []) as string[][];
    if (!tableRowsEqual(prevArr, built)) {
      values[tableKey] = built;
      changed = true;
    }
  }
  return changed;
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

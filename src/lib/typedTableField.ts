/**
 * Advanced table (TYPED_TABLE) dynamic input fields: every column has its own type and limits, and rows are
 * either added by the user or follow a NUMERIC field (e.g. one row per sample). Mirrors the backend rules in
 * `iic_booking/equipment/typed_table.py`.
 */
/** Same as `SAMPLE_SETS_KEY` in sampleSets.ts (not imported: dynamicTableField / sampleSets import this module). */
const SAMPLE_SETS_KEY = "_sample_sets";

function getFieldValueCI(values: Record<string, unknown> | null | undefined, fieldKey: string): unknown {
  if (!values || !fieldKey) return undefined;
  if (Object.prototype.hasOwnProperty.call(values, fieldKey)) return values[fieldKey];
  const want = fieldKey.toUpperCase();
  for (const k of Object.keys(values)) {
    if (k.toUpperCase() === want) return values[k];
  }
  return undefined;
}

function parseTableRowCount(raw: unknown): number {
  if (raw == null || raw === "") return 0;
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export const TYPED_TABLE = "TYPED_TABLE";
export const TYPED_TABLE_COLUMN_TYPES = [
  "NUMERIC",
  "TEXT",
  "RADIO",
  "COMBO",
  "MULTI_SELECT",
  "TOGGLE",
  "PERIODIC_TABLE",
] as const;
export type TypedTableColumnType = (typeof TYPED_TABLE_COLUMN_TYPES)[number];
export const TYPED_TABLE_COLUMN_TYPE_LABELS: Record<TypedTableColumnType, string> = {
  NUMERIC: "Numeric",
  TEXT: "Text",
  RADIO: "Radio",
  COMBO: "Combobox (dropdown)",
  MULTI_SELECT: "Multi-select",
  TOGGLE: "Toggle (Yes/No)",
  PERIODIC_TABLE: "Periodic table",
};
export const TYPED_TABLE_CHOICE_TYPES: readonly string[] = ["RADIO", "COMBO", "MULTI_SELECT"];
export const TYPED_TABLE_MAX_COLUMNS = 20;
export const TYPED_TABLE_MAX_ROWS_CAP = 200;
export const TYPED_TABLE_DEFAULT_MAX_ROWS = 50;
export const TYPED_TABLE_TEXT_MAX_LENGTH = 500;

export type TypedTableColumn = {
  key: string;
  label: string;
  type: TypedTableColumnType;
  required?: boolean;
  help_text?: string;
  default?: unknown;
  options?: string[];
  min?: number | null;
  max?: number | null;
  step?: number | null;
  integer?: boolean;
  max_length?: number | null;
};

export type TypedTableRowsConfig = {
  mode: "USER" | "LINKED";
  link_field_key?: string | null;
  min_rows?: number;
  max_rows?: number;
  initial_rows?: number;
  serial_column?: boolean;
  allow_duplicate?: boolean;
};

export type TypedTableConfig = {
  version?: number;
  columns: TypedTableColumn[];
  rows: TypedTableRowsConfig;
};

export type TypedTableRow = Record<string, unknown>;

export type TypedTableFieldLike = {
  field_key?: string | null;
  field_label?: string | null;
  field_type?: string | null;
  is_required?: boolean;
  table_config?: unknown;
};

export type TypedTableProblem = {
  key: string;
  label: string;
  kind: string;
  message: string;
  row: number | null;
  column: string | null;
  limit?: number | null;
  set: number;
  /** 0-based position in the stored rows (blank rows included), for focusing the cell. */
  rowIndex?: number | null;
};

export function isTypedTableField(field: { field_type?: string | null } | null | undefined): boolean {
  return String(field?.field_type || "").toUpperCase().trim() === TYPED_TABLE;
}

/** The field's schema, or null when it has no columns (shown as "not configured yet"). */
export function readTypedTableConfig(raw: unknown): TypedTableConfig | null {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const cfg = value as Partial<TypedTableConfig>;
  const columns = Array.isArray(cfg.columns)
    ? cfg.columns.filter((c): c is TypedTableColumn => !!c && typeof c === "object" && !!(c as TypedTableColumn).key)
    : [];
  if (!columns.length) return null;
  const rows = (cfg.rows && typeof cfg.rows === "object" ? cfg.rows : {}) as TypedTableRowsConfig;
  return {
    version: 1,
    columns,
    rows: {
      mode: rows.mode === "LINKED" ? "LINKED" : "USER",
      link_field_key: rows.link_field_key ? String(rows.link_field_key).toUpperCase() : null,
      min_rows: Number(rows.min_rows) || 0,
      max_rows: Number(rows.max_rows) || TYPED_TABLE_DEFAULT_MAX_ROWS,
      initial_rows: rows.initial_rows == null ? 1 : Number(rows.initial_rows) || 0,
      serial_column: rows.serial_column !== false,
      allow_duplicate: rows.allow_duplicate !== false,
    },
  };
}

export function typedTableLinkKey(config: TypedTableConfig | null | undefined): string {
  if (!config || config.rows.mode !== "LINKED") return "";
  return String(config.rows.link_field_key || "").toUpperCase();
}

export function readTypedTableRows(raw: unknown): TypedTableRow[] {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value.map((row) => (row && typeof row === "object" && !Array.isArray(row) ? (row as TypedTableRow) : {}));
}

function isBlankCell(column: TypedTableColumn, value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (column.type === "TOGGLE") return value === false;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export function isTypedTableRowBlank(config: TypedTableConfig, row: TypedTableRow | null | undefined): boolean {
  if (!row) return true;
  return config.columns.every((c) => isBlankCell(c, row[c.key]));
}

/** Rows with at least one filled cell: what the table's field key stands for in charge / time formulas. */
export function typedTableFilledRowCount(raw: unknown): number {
  return readTypedTableRows(raw).filter((row) =>
    Object.values(row).some((v) => !(v === undefined || v === null || v === "" || v === false || (Array.isArray(v) && v.length === 0))),
  ).length;
}

/** A new row: each column's default value (toggles start off). */
export function newTypedTableRow(config: TypedTableConfig): TypedTableRow {
  const row: TypedTableRow = {};
  for (const column of config.columns) {
    if (column.default === undefined || column.default === null || column.default === "") continue;
    row[column.key] = Array.isArray(column.default) ? [...column.default] : column.default;
  }
  return row;
}

/** Starting rows for a user-managed table (linked tables start empty and follow their field). */
export function initialTypedTableRows(config: TypedTableConfig | null): TypedTableRow[] {
  if (!config || config.rows.mode === "LINKED") return [];
  const count = Math.min(
    Math.max(config.rows.initial_rows ?? 1, config.rows.min_rows ?? 0),
    config.rows.max_rows ?? TYPED_TABLE_DEFAULT_MAX_ROWS,
  );
  return Array.from({ length: count }, () => newTypedTableRow(config));
}

export function linkedTypedTableTarget(config: TypedTableConfig, group: Record<string, unknown>): number {
  const link = typedTableLinkKey(config);
  if (!link) return 0;
  return Math.min(parseTableRowCount(getFieldValueCI(group, link)), config.rows.max_rows ?? TYPED_TABLE_DEFAULT_MAX_ROWS);
}

/*
 * Rows a linked table drops when its count goes down are kept here (per booking form scope and field), so
 * raising the count again brings them back instead of blank rows. Cleared when the form is reset.
 */
const hiddenRowStash = new Map<string, TypedTableRow[]>();

function stashKey(scope: string, fieldKey: string): string {
  return `${scope}::${fieldKey.toUpperCase()}`;
}

export function typedTableHiddenRowCount(scope: string, fieldKey: string): number {
  return hiddenRowStash.get(stashKey(scope, fieldKey))?.length ?? 0;
}

/** Forget hidden rows: all of them, or those whose scope starts with `scopePrefix` (e.g. "set-"). */
export function clearTypedTableRowStash(scopePrefix?: string): void {
  for (const map of [hiddenRowStash, lastResize] as Map<string, unknown>[]) {
    if (!scopePrefix) {
      map.clear();
      continue;
    }
    for (const key of Array.from(map.keys())) {
      if (key.startsWith(scopePrefix)) map.delete(key);
    }
  }
}

/** Rows for a linked table after its count changed to `target`, restoring rows hidden earlier. */
export function resizeLinkedTypedTableRows(
  config: TypedTableConfig,
  prevRaw: unknown,
  target: number,
  scope: string,
  fieldKey: string,
): TypedTableRow[] {
  const key = stashKey(scope, fieldKey);
  // React may run a state updater twice for the same state (StrictMode); repeat the result, not the move.
  const last = lastResize.get(key);
  if (last && last.source === prevRaw && last.target === target) return last.result;
  const prev = readTypedTableRows(prevRaw);
  const stash = hiddenRowStash.get(key) ?? [];
  let result = prev;
  if (prev.length > target) {
    const hidden = prev.slice(target).filter((row) => !isTypedTableRowBlank(config, row));
    const next = [...hidden, ...stash];
    if (next.length) hiddenRowStash.set(key, next);
    else hiddenRowStash.delete(key);
    result = prev.slice(0, target);
  } else if (prev.length < target) {
    const need = target - prev.length;
    const restored = stash.slice(0, need);
    const rest = stash.slice(need);
    if (rest.length) hiddenRowStash.set(key, rest);
    else hiddenRowStash.delete(key);
    const fresh = Array.from({ length: need - restored.length }, () => newTypedTableRow(config));
    result = [...prev, ...restored, ...fresh];
  }
  if (prevRaw !== null && typeof prevRaw === "object") lastResize.set(key, { source: prevRaw, target, result });
  return result;
}

const lastResize = new Map<string, { source: unknown; target: number; result: TypedTableRow[] }>();

/**
 * Resize every linked advanced table in `values` (one sample set) to its linked field's value.
 * Returns whether anything changed. `onlySourceKey` limits it to tables linked to that key.
 */
export function applyTypedTableRowSync(
  values: Record<string, unknown>,
  fields: TypedTableFieldLike[] | null | undefined,
  onlySourceKey?: string | null,
  scope = "primary",
): boolean {
  const only = onlySourceKey ? String(onlySourceKey).trim().toUpperCase() : "";
  let changed = false;
  for (const field of fields ?? []) {
    if (!isTypedTableField(field)) continue;
    const config = readTypedTableConfig(field.table_config);
    const link = typedTableLinkKey(config);
    const tableKey = String(field.field_key || "").trim();
    if (!config || !link || !tableKey) continue;
    if (only && link !== only) continue;
    const prev = getFieldValueCI(values, tableKey);
    const prevRows = readTypedTableRows(prev);
    const target = linkedTypedTableTarget(config, values);
    if (prevRows.length === target && Array.isArray(prev)) continue;
    values[tableKey] = resizeLinkedTypedTableRows(config, prevRows, target, scope, tableKey);
    changed = true;
  }
  return changed;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || typeof value === "boolean") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = String(value).trim();
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

export function formatTypedTableNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 1e6) / 1e6);
}

/** Problem with one cell (null when the value is fine or blank). */
export function typedTableCellProblem(
  column: TypedTableColumn,
  value: unknown,
): { kind: string; message: string; limit?: number | null } | null {
  if (column.type === "TOGGLE" || isBlankCell(column, value)) return null;
  const label = column.label;
  if (column.type === "NUMERIC") {
    const n = toNumber(value);
    if (n === null) return { kind: "invalid", message: `${label} must be a number.` };
    if (column.integer && !Number.isInteger(n)) return { kind: "integer", message: `${label} must be a whole number.` };
    if (column.min !== null && column.min !== undefined && n < column.min) {
      return { kind: "min", limit: column.min, message: `${label} cannot be less than ${formatTypedTableNumber(column.min)}.` };
    }
    if (column.max !== null && column.max !== undefined && n > column.max) {
      return { kind: "max", limit: column.max, message: `${label} cannot be greater than ${formatTypedTableNumber(column.max)}.` };
    }
    return null;
  }
  if (column.type === "TEXT") {
    const limit = column.max_length || TYPED_TABLE_TEXT_MAX_LENGTH;
    if (String(value).trim().length > limit) {
      return { kind: "max_length", limit, message: `${label} can be at most ${limit} characters.` };
    }
    return null;
  }
  if (column.type === "RADIO" || column.type === "COMBO") {
    if (!(column.options ?? []).includes(String(value).trim())) {
      return { kind: "option", message: `${label}: "${String(value)}" is not one of the options.` };
    }
    return null;
  }
  if (column.type === "MULTI_SELECT") {
    const bad = asList(value).find((v) => !(column.options ?? []).includes(v));
    return bad ? { kind: "option", message: `${label}: "${bad}" is not one of the options.` } : null;
  }
  return null;
}

/** Everything the booking would reject in one table value (one sample set). */
export function typedTableProblems(
  field: TypedTableFieldLike,
  raw: unknown,
  group: Record<string, unknown>,
  {
    checkRequired = true,
    set = 1,
    linkLabel,
  }: { checkRequired?: boolean; set?: number; /** Label of the input that sets the row count. */ linkLabel?: string } = {},
): TypedTableProblem[] {
  const config = readTypedTableConfig(field.table_config);
  if (!config) return [];
  const key = String(field.field_key || "");
  const label = String(field.field_label || key);
  const prefix = set > 1 ? `Sample set ${set}: ` : "";
  const out: TypedTableProblem[] = [];
  const add = (kind: string, message: string, extra: Partial<TypedTableProblem> = {}) =>
    out.push({ key, label, kind, message: prefix + message, row: null, column: null, set, ...extra });

  const linked = !!typedTableLinkKey(config);
  const allRows = readTypedTableRows(raw);
  const indexed = allRows.map((row, index) => ({ row, index }));
  const rows = linked ? indexed : indexed.filter(({ row }) => !isTypedTableRowBlank(config, row));
  rows.forEach(({ row, index }, i) => {
    for (const column of config.columns) {
      const problem = typedTableCellProblem(column, row[column.key]);
      const at = { row: i + 1, column: column.key, rowIndex: index };
      if (problem) {
        add(problem.kind, `${label}, row ${i + 1}: ${problem.message}`, { ...at, limit: problem.limit ?? null });
      } else if (checkRequired && column.required && column.type !== "TOGGLE" && isBlankCell(column, row[column.key])) {
        add("required", `${label}, row ${i + 1}: ${column.label} is required.`, at);
      }
    }
  });
  const maxRows = config.rows.max_rows ?? TYPED_TABLE_DEFAULT_MAX_ROWS;
  if (linked) {
    const target = linkedTypedTableTarget(config, group);
    if (checkRequired && rows.length !== target) {
      const source = linkLabel ? `“${linkLabel.replace(/:\s*$/, "")}”` : `field ${typedTableLinkKey(config)}`;
      add("row_count", `${label} must have ${target} row${target === 1 ? "" : "s"} (set by ${source}); it has ${rows.length}.`, { limit: target });
    }
  } else {
    if (rows.length > maxRows) add("max_rows", `${label}: at most ${maxRows} rows are allowed.`, { limit: maxRows });
    const needed = Math.max(config.rows.min_rows ?? 0, field.is_required ? 1 : 0);
    if (checkRequired && rows.length < needed) {
      add("min_rows", `${label}: add at least ${needed} row${needed === 1 ? "" : "s"}.`, { limit: needed });
    }
  }
  return out;
}

function sampleSetGroups(values: Record<string, unknown> | null | undefined): Record<string, unknown>[] {
  if (!values) return [];
  const sets = Array.isArray(values[SAMPLE_SETS_KEY]) ? (values[SAMPLE_SETS_KEY] as unknown[]) : [];
  return [values, ...sets.filter((s): s is Record<string, unknown> => !!s && typeof s === "object" && !Array.isArray(s))];
}

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * First advanced-table problem across sample set 1 and the extra sets in `values`, or null. With `baseline`
 * (the values as saved), a table whose rows and linked count are unchanged in a set is not checked again,
 * as on the server.
 */
export function firstTypedTableProblem(
  fields: TypedTableFieldLike[] | null | undefined,
  values: Record<string, unknown> | null | undefined,
  opts: { checkRequired?: boolean; baseline?: Record<string, unknown> | null } = {},
): TypedTableProblem | null {
  const tables = (fields ?? []).filter((f) => isTypedTableField(f) && readTypedTableConfig(f.table_config));
  if (!tables.length || !values) return null;
  const groups = sampleSetGroups(values);
  const baseGroups = opts.baseline ? sampleSetGroups(opts.baseline) : null;
  for (let i = 0; i < groups.length; i++) {
    const seen = new Set<string>();
    for (const field of tables) {
      const key = String(field.field_key || "");
      if (seen.has(key.toUpperCase())) continue;
      seen.add(key.toUpperCase());
      const value = getFieldValueCI(groups[i], key);
      const base = baseGroups?.[i];
      if (base) {
        const link = typedTableLinkKey(readTypedTableConfig(field.table_config));
        const unchanged =
          sameValue(value, getFieldValueCI(base, key)) &&
          (!link || String(getFieldValueCI(groups[i], link) ?? "").trim() === String(getFieldValueCI(base, link) ?? "").trim());
        if (unchanged) continue;
      }
      const linkKey = typedTableLinkKey(readTypedTableConfig(field.table_config));
      const linkLabel = linkKey
        ? (fields ?? []).find((f) => String(f.field_key || "").toUpperCase() === linkKey.toUpperCase())?.field_label
        : undefined;
      const problems = typedTableProblems(field, value, groups[i], {
        checkRequired: opts.checkRequired,
        set: i + 1,
        linkLabel: linkLabel || undefined,
      });
      if (problems.length) return problems[0];
    }
  }
  return null;
}

/** Display text of one cell ("Yes"/"No" for toggles, comma-joined lists). */
export function formatTypedTableCell(column: TypedTableColumn, value: unknown): string {
  if (column.type === "TOGGLE") return value === true || value === "true" ? "Yes" : value === false ? "No" : "";
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.map((v) => String(v)).join(", ");
  return String(value);
}

/** Header labels and display rows (with S.No. when configured) for read-only views. */
export function typedTableDisplay(
  config: TypedTableConfig,
  raw: unknown,
): { columns: string[]; rows: string[][] } {
  const serial = config.rows.serial_column !== false;
  const rows = readTypedTableRows(raw)
    .filter((row) => !isTypedTableRowBlank(config, row))
    .map((row, i) => [...(serial ? [String(i + 1)] : []), ...config.columns.map((c) => formatTypedTableCell(c, row[c.key]))]);
  return { columns: [...(serial ? ["S.No."] : []), ...config.columns.map((c) => c.label)], rows };
}

/** Wrapper id of a table on the booking page: the field key, or `sample-set-<index>-<key>` in extra sets. */
export function typedTableDomId(fieldKey: string, set = 1): string {
  return set > 1 ? `sample-set-${set - 2}-${fieldKey}` : fieldKey;
}

/** Scroll to and focus the cell (or the table) a problem is about. */
export function focusTypedTableProblem(problem: Pick<TypedTableProblem, "key" | "set" | "column" | "rowIndex">): void {
  if (typeof document === "undefined") return;
  const base = typedTableDomId(problem.key, problem.set);
  const ids = [problem.column && problem.rowIndex != null ? `${base}-r${problem.rowIndex}-${problem.column}` : "", base];
  for (const id of ids) {
    const el = id ? document.getElementById(id) : null;
    if (el) {
      el.scrollIntoView?.({ behavior: "smooth", block: "center" });
      el.focus?.({ preventScroll: true });
      return;
    }
  }
}

/** For the charge estimate: an advanced table counts as its number of filled rows. */
export function isTypedTableRowsValue(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0 && value.every((r) => !!r && typeof r === "object" && !Array.isArray(r));
}

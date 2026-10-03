/** Admin column builder for advanced table (TYPED_TABLE) fields: editable draft, conversion and checks. */
import {
  readTypedTableConfig,
  typedTableCellProblem,
  TYPED_TABLE_CHOICE_TYPES,
  TYPED_TABLE_COLUMN_TYPES,
  TYPED_TABLE_DEFAULT_MAX_ROWS,
  TYPED_TABLE_MAX_COLUMNS,
  TYPED_TABLE_MAX_ROWS_CAP,
  TYPED_TABLE_TEXT_MAX_LENGTH,
  type TypedTableColumn,
  type TypedTableColumnType,
  type TypedTableConfig,
} from "@/lib/typedTableField";

export const TYPED_TABLE_MAX_OPTIONS = 50;
const MAX_LABEL_LENGTH = 100;
const MAX_HELP_LENGTH = 300;
const COLUMN_KEY_RE = /^[a-z][a-z0-9_]{0,39}$/;

export type TypedTableDraftColumn = {
  /** Stable React key; not saved. */
  uid: number;
  label: string;
  /** Blank = made from the label on save. */
  key: string;
  type: TypedTableColumnType;
  required: boolean;
  help_text: string;
  optionsText: string;
  min: string;
  max: string;
  step: string;
  integer: boolean;
  max_length: string;
  /** TOGGLE: "true" / ""; MULTI_SELECT: comma-separated. */
  default: string;
};

export type TypedTableDraft = {
  columns: TypedTableDraftColumn[];
  mode: "USER" | "LINKED";
  link_field_key: string;
  min_rows: string;
  max_rows: string;
  initial_rows: string;
  serial_column: boolean;
  allow_duplicate: boolean;
};

export type NumericFieldChoice = { key: string; label: string };

let nextUid = 1;

export function slugifyColumnKey(label: string): string {
  let slug = String(label || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!slug) slug = "col";
  if (!/^[a-z]/.test(slug)) slug = `c_${slug}`;
  return slug.slice(0, 40);
}

export function newDraftColumn(type: TypedTableColumnType = "TEXT", label = ""): TypedTableDraftColumn {
  return {
    uid: nextUid++,
    label,
    key: "",
    type,
    required: false,
    help_text: "",
    optionsText: "",
    min: "",
    max: "",
    step: "",
    integer: false,
    max_length: "",
    default: "",
  };
}

const numText = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

function defaultText(column: TypedTableColumn): string {
  const value = column.default;
  if (value === undefined || value === null) return "";
  if (column.type === "TOGGLE") return value === true ? "true" : "";
  if (Array.isArray(value)) return value.map(String).join(", ");
  return String(value);
}

export function draftFromTypedTableConfig(raw: unknown): TypedTableDraft {
  const config = readTypedTableConfig(raw);
  if (!config) {
    return {
      columns: [newDraftColumn("TEXT", "Sample code")],
      mode: "USER",
      link_field_key: "",
      min_rows: "0",
      max_rows: String(TYPED_TABLE_DEFAULT_MAX_ROWS),
      initial_rows: "1",
      serial_column: true,
      allow_duplicate: true,
    };
  }
  return {
    columns: config.columns.map((c) => ({
      ...newDraftColumn(c.type, c.label),
      key: c.key,
      required: Boolean(c.required),
      help_text: c.help_text || "",
      optionsText: (c.options ?? []).join("\n"),
      min: numText(c.min),
      max: numText(c.max),
      step: numText(c.step),
      integer: Boolean(c.integer),
      max_length: numText(c.max_length),
      default: defaultText(c),
    })),
    mode: config.rows.mode,
    link_field_key: config.rows.link_field_key || "",
    min_rows: String(config.rows.min_rows ?? 0),
    max_rows: String(config.rows.max_rows ?? TYPED_TABLE_DEFAULT_MAX_ROWS),
    initial_rows: String(config.rows.initial_rows ?? 1),
    serial_column: config.rows.serial_column !== false,
    allow_duplicate: config.rows.allow_duplicate !== false,
  };
}

const parseNum = (text: string): number | null => {
  const t = text.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};

const parseIntOr = (text: string, fallback: number): number => {
  const n = parseNum(text);
  return n === null || Number.isNaN(n) ? fallback : Math.trunc(n);
};

export function draftOptions(column: Pick<TypedTableDraftColumn, "optionsText">): string[] {
  const out: string[] = [];
  for (const line of column.optionsText.split(/\r?\n/)) {
    const v = line.trim();
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

/** Keys as they will be saved (blank keys made from labels, kept unique). */
function resolvedKeys(columns: TypedTableDraftColumn[]): string[] {
  const used = new Set<string>();
  return columns.map((c) => {
    if (c.key.trim()) {
      const key = c.key.trim().toLowerCase();
      used.add(key);
      return key;
    }
    const base = slugifyColumnKey(c.label);
    let key = base;
    let n = 2;
    while (used.has(key) || columns.some((o) => o !== c && o.key.trim().toLowerCase() === key)) {
      const suffix = `_${n++}`;
      key = `${base.slice(0, 40 - suffix.length)}${suffix}`;
    }
    used.add(key);
    return key;
  });
}

function columnFromDraft(c: TypedTableDraftColumn, key: string): TypedTableColumn {
  const column: TypedTableColumn = {
    key,
    label: c.label.trim(),
    type: c.type,
    required: c.required,
    help_text: c.help_text.trim(),
  };
  if (TYPED_TABLE_CHOICE_TYPES.includes(c.type)) column.options = draftOptions(c);
  if (c.type === "NUMERIC") {
    const min = parseNum(c.min);
    const max = parseNum(c.max);
    const step = parseNum(c.step);
    column.min = min === null || Number.isNaN(min) ? null : min;
    column.max = max === null || Number.isNaN(max) ? null : max;
    column.step = step === null || Number.isNaN(step) ? null : step;
    column.integer = c.integer;
  }
  if (c.type === "TEXT") {
    const len = parseNum(c.max_length);
    column.max_length = len === null || Number.isNaN(len) ? null : Math.trunc(len);
  }
  const d = c.default.trim();
  column.default = null;
  if (d && c.type !== "PERIODIC_TABLE") {
    if (c.type === "NUMERIC") column.default = Number.isFinite(Number(d)) ? Number(d) : d;
    else if (c.type === "TOGGLE") column.default = d === "true";
    else if (c.type === "MULTI_SELECT") column.default = d.split(",").map((s) => s.trim()).filter(Boolean);
    else column.default = d;
  }
  return column;
}

/** The schema saved in `table_config` (the server normalises it again). */
export function typedTableConfigFromDraft(draft: TypedTableDraft): TypedTableConfig {
  const keys = resolvedKeys(draft.columns);
  const linked = draft.mode === "LINKED";
  const max_rows = parseIntOr(draft.max_rows, TYPED_TABLE_DEFAULT_MAX_ROWS);
  const min_rows = linked ? 0 : parseIntOr(draft.min_rows, 0);
  return {
    version: 1,
    columns: draft.columns.map((c, i) => columnFromDraft(c, keys[i])),
    rows: {
      mode: draft.mode,
      link_field_key: linked ? draft.link_field_key.trim().toUpperCase() || null : null,
      min_rows,
      max_rows,
      initial_rows: linked ? 0 : Math.min(Math.max(parseIntOr(draft.initial_rows, Math.max(1, min_rows)), min_rows), max_rows),
      serial_column: draft.serial_column,
      allow_duplicate: draft.allow_duplicate,
    },
  };
}

/**
 * Problems that stop the schema being saved, in the server's words. `numericFields` are the NUMERIC fields
 * of the same user type (the only fields rows can be linked to); `selfKey` is the table's own key.
 */
export function typedTableDraftErrors(
  draft: TypedTableDraft,
  numericFields: NumericFieldChoice[],
  selfKey?: string,
): string[] {
  const errors: string[] = [];
  if (draft.columns.length === 0) errors.push("Add at least one column to the advanced table.");
  if (draft.columns.length > TYPED_TABLE_MAX_COLUMNS) {
    errors.push(`An advanced table can have at most ${TYPED_TABLE_MAX_COLUMNS} columns.`);
  }
  const keys = resolvedKeys(draft.columns);
  const seen = new Map<string, number>();
  draft.columns.forEach((c, i) => {
    const label = c.label.trim();
    const name = label ? `Column "${label}"` : `Column ${i + 1}`;
    if (!label) errors.push(`Column ${i + 1} needs a label.`);
    else if (label.length > MAX_LABEL_LENGTH) errors.push(`${name}: label can be at most ${MAX_LABEL_LENGTH} characters.`);
    if (!(TYPED_TABLE_COLUMN_TYPES as readonly string[]).includes(c.type)) errors.push(`${name}: unknown type "${c.type}".`);
    if (c.key.trim() && !COLUMN_KEY_RE.test(c.key.trim().toLowerCase())) {
      errors.push(`${name}: key "${c.key.trim()}" must start with a letter and use only letters, digits and _.`);
    }
    if (seen.has(keys[i])) errors.push(`Column key "${keys[i]}" is used by more than one column.`);
    seen.set(keys[i], i);
    if (c.help_text.trim().length > MAX_HELP_LENGTH) errors.push(`${name}: help text can be at most ${MAX_HELP_LENGTH} characters.`);

    if (TYPED_TABLE_CHOICE_TYPES.includes(c.type)) {
      const options = draftOptions(c);
      if (options.length === 0) errors.push(`${name} needs at least one option.`);
      if (options.length > TYPED_TABLE_MAX_OPTIONS) errors.push(`${name} can have at most ${TYPED_TABLE_MAX_OPTIONS} options.`);
    }
    if (c.type === "NUMERIC") {
      const min = parseNum(c.min);
      const max = parseNum(c.max);
      const step = parseNum(c.step);
      if (Number.isNaN(min)) errors.push(`${name}: lower limit must be a number.`);
      if (Number.isNaN(max)) errors.push(`${name}: upper limit must be a number.`);
      if (Number.isNaN(step)) errors.push(`${name}: step must be a number.`);
      if (min !== null && max !== null && !Number.isNaN(min) && !Number.isNaN(max) && min > max) {
        errors.push(`${name}: lower limit cannot be greater than the upper limit.`);
      }
      if (step !== null && !Number.isNaN(step) && step <= 0) errors.push(`${name}: step must be greater than 0.`);
      if (c.integer && step !== null && !Number.isNaN(step) && !Number.isInteger(step)) {
        errors.push(`${name}: whole-number columns need a whole-number step.`);
      }
    }
    if (c.type === "TEXT" && c.max_length.trim()) {
      const len = parseNum(c.max_length);
      if (len === null || Number.isNaN(len) || !Number.isInteger(len) || len < 1 || len > TYPED_TABLE_TEXT_MAX_LENGTH) {
        errors.push(`${name}: maximum length must be a whole number from 1 to ${TYPED_TABLE_TEXT_MAX_LENGTH}.`);
      }
    }
    if (c.default.trim() && c.type !== "PERIODIC_TABLE" && label) {
      const column = columnFromDraft(c, keys[i]);
      const problem = typedTableCellProblem(column, column.default);
      if (problem) errors.push(`${name}: default value — ${problem.message}`);
    }
  });

  const maxRows = parseNum(draft.max_rows);
  if (maxRows === null || Number.isNaN(maxRows) || !Number.isInteger(maxRows) || maxRows < 1 || maxRows > TYPED_TABLE_MAX_ROWS_CAP) {
    errors.push(`Maximum rows must be a whole number from 1 to ${TYPED_TABLE_MAX_ROWS_CAP}.`);
  }
  if (draft.mode === "LINKED") {
    const link = draft.link_field_key.trim().toUpperCase();
    if (!/^[A-Z]$/.test(link)) errors.push("Choose the field key (A–Z) that sets the number of rows.");
    else if (selfKey && link === selfKey.toUpperCase()) errors.push("Rows cannot be linked to the table itself.");
    else if (!numericFields.some((f) => f.key.toUpperCase() === link)) {
      errors.push(`Rows can only follow a Numeric field of the same user type; field ${link} is not one.`);
    }
  } else {
    const minRows = parseNum(draft.min_rows);
    const initialRows = parseNum(draft.initial_rows);
    if (minRows !== null && (Number.isNaN(minRows) || !Number.isInteger(minRows) || minRows < 0)) {
      errors.push("Minimum rows must be a whole number of 0 or more.");
    } else if (minRows !== null && maxRows !== null && !Number.isNaN(maxRows) && minRows > maxRows) {
      errors.push("Minimum rows cannot be greater than maximum rows.");
    }
    if (initialRows !== null && (Number.isNaN(initialRows) || !Number.isInteger(initialRows) || initialRows < 0)) {
      errors.push("Initial rows must be a whole number of 0 or more.");
    }
  }
  return errors;
}

/** One-line description for the field list, e.g. "3 columns · rows follow field A (max 50)". */
export function typedTableConfigSummary(raw: unknown): string {
  const config = readTypedTableConfig(raw);
  if (!config) return "No columns yet";
  const n = config.columns.length;
  const rows =
    config.rows.mode === "LINKED"
      ? `rows follow field ${config.rows.link_field_key || "?"} (max ${config.rows.max_rows})`
      : `users add rows (max ${config.rows.max_rows})`;
  return `${n} column${n === 1 ? "" : "s"} · ${rows}`;
}

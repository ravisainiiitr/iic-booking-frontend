import { normalizeChoiceOption } from "@/lib/dynamicFieldOptions";
import { readTypedTableConfig, typedTableDisplay } from "@/lib/typedTableField";

/** Field definition as returned with a booking (`input_fields`). */
export type BookingInputFieldDef = {
  field_key: string;
  field_label?: string;
  field_type?: string;
  options?: unknown;
  help_text?: string | null;
  /** Columns and row rules of an advanced table (TYPED_TABLE). */
  table_config?: unknown;
};

export type BookingInputValues = Record<string, unknown>;

export function formatInputScalar(v: unknown): string {
  if (v === undefined || v === null) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) {
    if (v.length > 0 && Array.isArray(v[0])) return `${(v as unknown[][]).length} row(s)`;
    if (v.length > 0 && v.every((r) => !!r && typeof r === "object")) return `${v.length} row(s)`;
    return v.join(", ");
  }
  return String(v);
}

/** Label of the chosen RADIO / COMBO option (stored as value, label, 1-based index or boolean). */
export function resolveChoiceDisplay(value: unknown, options: unknown, fieldType: string | undefined): string {
  const type = String(fieldType || "").toUpperCase();
  if (value === undefined || value === null || value === "") return "—";
  if (type !== "RADIO" && type !== "COMBO") return formatInputScalar(value);
  if (!Array.isArray(options) || options.length === 0) return formatInputScalar(value);

  const normalized = options.map((o, i) => normalizeChoiceOption(o, i));
  const optionLabels = normalized.map((o) => o.label);
  const optionValues = normalized.map((o) => o.value);

  const isBoolLike =
    typeof value === "boolean" ||
    (typeof value === "string" && (value.trim().toLowerCase() === "true" || value.trim().toLowerCase() === "false"));
  if (isBoolLike && options.length >= 1) {
    const boolVal = value === true || String(value).trim().toLowerCase() === "true";
    const yesIdx = optionLabels.findIndex((l) => /^yes$/i.test(String(l)));
    const noIdx = optionLabels.findIndex((l) => /^no$/i.test(String(l)));
    if (yesIdx >= 0 && noIdx >= 0) {
      return boolVal ? (optionLabels[yesIdx] || optionValues[yesIdx]) : (optionLabels[noIdx] || optionValues[noIdx]);
    }
    const yesValIdx = optionValues.findIndex((v) => /^true$/i.test(String(v)));
    const noValIdx = optionValues.findIndex((v) => /^false$/i.test(String(v)));
    if (yesValIdx >= 0 && noValIdx >= 0) {
      return boolVal ? (optionLabels[yesValIdx] || optionValues[yesValIdx]) : (optionLabels[noValIdx] || optionValues[noValIdx]);
    }
    // Convention: two options, first = false, second = true (e.g. "No", "Yes")
    if (options.length === 2) {
      return boolVal ? (optionLabels[1] ?? optionValues[1]) : (optionLabels[0] ?? optionValues[0]);
    }
  }

  const strVal = String(value).trim();
  if (/^\d+$/.test(strVal)) {
    const idx = parseInt(strVal, 10);
    if (idx >= 1 && idx <= optionLabels.length) return optionLabels[idx - 1] || strVal;
  }
  const byValue = optionValues.indexOf(strVal);
  if (byValue >= 0) return optionLabels[byValue] || strVal;
  const byLabel = optionLabels.indexOf(strVal);
  if (byLabel >= 0) return optionLabels[byLabel];
  return strVal;
}

/** Rows of a TABLE input (stored as string[][] or its JSON). */
export function readTableRows(raw: unknown): string[][] {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value) || !value.every((r) => Array.isArray(r))) return [];
  return (value as unknown[][]).map((row) => row.map((cell) => (cell == null ? "" : String(cell))));
}

export function tableColumnLabels(options: unknown): string[] {
  return Array.isArray(options) ? options.map((o, i) => normalizeChoiceOption(o, i).label).filter(Boolean) : [];
}

export type FormattedInputValue =
  | { kind: "empty" }
  | { kind: "text"; text: string }
  | { kind: "table"; columns: string[]; rows: string[][] };

function isBlank(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);
}

/**
 * A booking input as the lab reads it: option labels instead of stored codes, Yes/No for toggles,
 * selected elements for the periodic table, rows for a table input; `empty` when the user left it blank.
 */
export function formatBookingInputValue(field: BookingInputFieldDef, values: BookingInputValues): FormattedInputValue {
  const type = String(field.field_type || "").toUpperCase();
  const raw = values[field.field_key];

  if (type === "TABLE") {
    const rows = readTableRows(raw).filter((row) => row.some((cell) => cell.trim() !== ""));
    if (rows.length === 0) return { kind: "empty" };
    return { kind: "table", columns: tableColumnLabels(field.options), rows };
  }
  if (type === "TYPED_TABLE") {
    const config = readTypedTableConfig(field.table_config);
    if (!config) return isBlank(raw) ? { kind: "empty" } : { kind: "text", text: formatInputScalar(raw) };
    const display = typedTableDisplay(config, raw);
    return display.rows.length ? { kind: "table", ...display } : { kind: "empty" };
  }
  if (type === "PERIODIC_TABLE") {
    const elements = String(values[`${field.field_key}_elements`] ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (elements.length > 0) return { kind: "text", text: elements.join(", ") };
    return isBlank(raw) ? { kind: "empty" } : { kind: "text", text: formatInputScalar(raw) };
  }
  if (type === "TOGGLE") {
    if (raw === undefined || raw === null || raw === "") return { kind: "empty" };
    return { kind: "text", text: raw === true || String(raw).toLowerCase() === "true" ? "Yes" : "No" };
  }
  if (isBlank(raw)) return { kind: "empty" };
  if (type === "RADIO" || type === "COMBO") {
    return { kind: "text", text: resolveChoiceDisplay(raw, field.options, type) };
  }
  if (type === "MULTI_SELECT" && Array.isArray(raw)) {
    const options = Array.isArray(field.options) ? field.options.map((o, i) => normalizeChoiceOption(o, i)) : [];
    const label = (v: unknown) => options.find((o) => o.value === String(v))?.label ?? String(v);
    return { kind: "text", text: raw.map(label).join(", ") };
  }
  return { kind: "text", text: formatInputScalar(raw) };
}

/** One-line text of a formatted value ("Name: N, Count: 5; …" for tables), for PDFs, toasts and compact lists. */
export function formattedValueText(value: FormattedInputValue, maxRows = 10): string {
  if (value.kind === "empty") return "";
  if (value.kind === "text") return value.text;
  const shown = value.rows.slice(0, maxRows).map((row) => {
    const named = value.columns.length >= row.length;
    return row
      .map((cell, i) => (cell.trim() === "" || (named && value.columns[i] === "S.No.") ? "" : named ? `${value.columns[i]}: ${cell}` : cell))
      .filter(Boolean)
      .join(", ");
  });
  const more = value.rows.length - shown.length;
  return shown.filter(Boolean).join("; ") + (more > 0 ? `; … ${more} more row(s)` : "");
}

/** Label → one-line value for every filled-in field (field order, option labels, Yes/No, table rows). */
export function inputLabelsAndValues(
  fields: BookingInputFieldDef[] | null | undefined,
  values: BookingInputValues,
): Record<string, string> {
  const out: Record<string, string> = {};
  (fields ?? []).forEach((field) => {
    if (!field.field_key || field.field_key === "comments") return;
    const text = formattedValueText(formatBookingInputValue(field, values));
    if (text) out[String(field.field_label || field.field_key).replace(/:\s*$/, "")] = text;
  });
  return out;
}

/** Comparable form of a formatted value, used to spot parameters that differ between sample sets. */
export function formattedValueKey(value: FormattedInputValue): string {
  if (value.kind === "empty") return "";
  if (value.kind === "text") return value.text.trim().toLowerCase();
  return JSON.stringify(value.rows);
}

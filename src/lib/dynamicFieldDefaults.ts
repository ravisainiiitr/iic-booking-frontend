/**
 * Starting values of the booking form's dynamic input fields: what Step 1 shows on a fresh booking and
 * what every new "sample with different parameters" starts from.
 */
import { mergePeriodicDisplaySymbols, parsePeriodicHelpText } from "@/data/periodicTableData";
import {
  applyTableRowSyncToValues,
  resolveTableColumns,
  resolveTableRowCountSourceKey,
} from "@/lib/dynamicTableField";
import { initialNumericFieldValue } from "@/lib/numericFieldLimits";
import { initialTypedTableRows, readTypedTableConfig, type TypedTableRow } from "@/lib/typedTableField";

export type DynamicInputValue = string | boolean | string[] | number | string[][] | TypedTableRow[];

export type DynamicFieldDefaultDef = {
  field_key?: string;
  field_type?: string;
  options?: unknown;
  help_text?: string | null;
  default_value?: unknown;
  is_required?: boolean;
  source_element_field_key?: string | null;
  table_config?: unknown;
};

/** Default value for one dynamic input field when equipment is loaded or the booking form resets. */
export function getInitialDynamicInputValue(
  field: DynamicFieldDefaultDef,
  allFields?: DynamicFieldDefaultDef[] | null,
): DynamicInputValue {
  const fieldType = String(field.field_type || "").toUpperCase().trim();
  const defaultValue = field.default_value;
  if (fieldType === "TOGGLE") {
    return defaultValue === "true" || defaultValue === true;
  }
  if (fieldType === "MULTI_SELECT") {
    return defaultValue ? String(defaultValue).split(",") : [];
  }
  if (fieldType === "PERIODIC_TABLE") {
    const count = defaultValue ? parseInt(String(defaultValue), 10) : 0;
    return isNaN(count) ? 0 : count;
  }
  if (fieldType === "ICPMS_STANDARD_COVERAGE") {
    return 0;
  }
  if (fieldType === "TABLE") {
    const sourceKey = resolveTableRowCountSourceKey(field, allFields);
    const { columns, hasSerialColumn } = resolveTableColumns(field.options, {
      rowCountDriven: Boolean(sourceKey),
    });
    const colCount = columns.length;
    if (!colCount) return [];
    if (!sourceKey) {
      const row = Array(colCount).fill("");
      if (hasSerialColumn) row[0] = "1";
      return [row];
    }
    // Row count driven by another field — start empty; sync fills from source value
    return [];
  }
  if (fieldType === "TYPED_TABLE") {
    return initialTypedTableRows(readTypedTableConfig(field.table_config));
  }
  if (fieldType === "NUMERIC") {
    return initialNumericFieldValue(field);
  }
  if (fieldType === "RADIO" || fieldType === "COMBO") {
    if (defaultValue) return String(defaultValue);
    const opts = field.options;
    if (Array.isArray(opts) && opts.length > 0) {
      const first = opts[0];
      return String(first && typeof first === "object" && "value" in first ? first.value : first);
    }
    return "";
  }
  return defaultValue ? String(defaultValue) : "";
}

/**
 * Starting values for every field (keyed by field_key): periodic tables get their preselected elements
 * (`<key>_elements`) and billable count, and row-count-driven tables are sized from their source field.
 */
export function buildInitialInputValues(
  fields: DynamicFieldDefaultDef[] | null | undefined,
): Record<string, DynamicInputValue> {
  const list = fields ?? [];
  const values: Record<string, DynamicInputValue> = {};
  for (const field of list) {
    const key = field.field_key;
    if (!key) continue;
    const fieldType = String(field.field_type || "").toUpperCase().trim();
    if (fieldType === "PERIODIC_TABLE") {
      const { preselected } = parsePeriodicHelpText(field.help_text);
      const fromOptions = Array.isArray(field.options)
        ? field.options.map((s) => String(s).trim()).filter(Boolean)
        : [];
      const { all, billable } = mergePeriodicDisplaySymbols([...fromOptions, ...Array.from(preselected)], field.help_text);
      values[key] = billable.length;
      values[`${key}_elements`] = all.join(",");
    } else {
      values[key] = getInitialDynamicInputValue(field, list);
    }
  }
  // Own scope: starting values never take rows a linked advanced table hid in the live form.
  applyTableRowSyncToValues(values as Record<string, unknown>, list, null, "init");
  return values;
}

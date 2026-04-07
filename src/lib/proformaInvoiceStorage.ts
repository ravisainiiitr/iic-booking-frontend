/** Persisted line items when building a proforma via Book Equipment (?proforma=1). */
export const PROFORMA_LINE_ITEMS_STORAGE_KEY = "proforma_invoice_line_items_v1";

export type ProformaLineItemField = {
  field_key: string;
  field_label: string;
  field_type: string;
  is_required?: boolean;
  default_value?: string;
  options?: Array<{ value?: string; label?: string } | string>;
  help_text?: string;
};

export type ProformaLineItemStored = {
  equipment_id: number;
  equipment_code: string;
  equipment_name: string;
  profile_type: string;
  input_fields: ProformaLineItemField[];
  input_values: Record<string, string | number>;
};

export function readProformaLineItemsFromStorage(): ProformaLineItemStored[] {
  try {
    const raw = sessionStorage.getItem(PROFORMA_LINE_ITEMS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ProformaLineItemStored[]) : [];
  } catch {
    return [];
  }
}

export function writeProformaLineItemsToStorage(items: ProformaLineItemStored[]) {
  sessionStorage.setItem(PROFORMA_LINE_ITEMS_STORAGE_KEY, JSON.stringify(items));
}

/** Map Book Equipment form state into proforma calculate payload shape. */
export function inputValuesForProformaStorage(
  raw: Record<string, string | boolean | string[] | number | string[][] | undefined>
): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) {
      if (v.length > 0 && Array.isArray(v[0])) out[k] = JSON.stringify(v);
      else out[k] = (v as string[]).join(",");
    } else if (typeof v === "boolean") out[k] = v;
    else if (typeof v === "number") out[k] = v;
    else out[k] = String(v);
  }
  return out;
}

type EquipmentInputFieldLike = {
  field_key?: string;
  field_label?: string;
  field_type?: string;
  is_required?: boolean;
  default_value?: string;
  options?: unknown;
};

/**
 * Build Book Equipment–style `inputFieldValues` from equipment defaults, then overlay a saved proforma line.
 */
export function mergeProformaLineIntoInputFieldValues(
  line: ProformaLineItemStored,
  equipmentDetail: { input_fields?: EquipmentInputFieldLike[] }
): Record<string, string | boolean | string[] | number | string[][]> {
  const equipmentInputFields = equipmentDetail.input_fields ?? [];
  const base: Record<string, string | boolean | string[] | number | string[][]> = {};

  if (equipmentInputFields.length === 0 && line.input_fields.length > 0) {
    for (const field of line.input_fields) {
      const fieldType = String(field.field_type || "").toUpperCase().trim();
      const key = field.field_key;
      if (!key) continue;
      if (fieldType === "TOGGLE") base[key] = false;
      else if (fieldType === "MULTI_SELECT") base[key] = [];
      else if (fieldType === "PERIODIC_TABLE") {
        base[key] = 0;
        base[key + "_elements"] = "";
      } else if (fieldType === "TABLE") base[key] = [[""]];
      else if (fieldType === "ICPMS_STANDARD_COVERAGE") base[key] = 0;
      else if (fieldType === "NUMERIC" && (key === "A" || key === "B")) base[key] = "1";
      else if (fieldType === "NUMERIC") base[key] = "0";
      else base[key] = "";
    }
  }

  for (const field of equipmentInputFields) {
    const fieldType = String(field.field_type || "").toUpperCase().trim();
    const key = String(field.field_key ?? "");
    if (!key) continue;
    if (fieldType === "TOGGLE") {
      base[key] = field.default_value === "true" || field.default_value === true;
    } else if (fieldType === "MULTI_SELECT") {
      base[key] = field.default_value ? String(field.default_value).split(",").map((s) => s.trim()).filter(Boolean) : [];
    } else if (fieldType === "PERIODIC_TABLE") {
      const count = field.default_value ? parseInt(String(field.default_value), 10) : 0;
      base[key] = Number.isNaN(count) ? 0 : count;
      base[key + "_elements"] =
        field.options && Array.isArray(field.options) ? (field.options as string[]).join(",") : "";
    } else if (fieldType === "ICPMS_STANDARD_COVERAGE") {
      base[key] = 0;
    } else if (fieldType === "TABLE") {
      const cols = Array.isArray(field.options) ? field.options.length : 0;
      base[key] = cols ? [Array(cols).fill("")] : [];
    } else if ((key === "A" || key === "B") && fieldType === "NUMERIC") {
      const num = Number(field.default_value);
      base[key] = String(Number.isNaN(num) || num < 1 ? 1 : num);
    } else {
      base[key] = field.default_value != null && field.default_value !== "" ? String(field.default_value) : "";
    }
  }

  const stored = line.input_values;
  for (const field of line.input_fields) {
    const key = field.field_key;
    const ft = String(field.field_type || "").toUpperCase();
    if (!(key in stored) && !(key + "_elements" in stored)) continue;

    if (ft === "MULTI_SELECT") {
      const v = stored[key];
      if (v === undefined) continue;
      base[key] = String(v)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      continue;
    }
    if (ft === "TOGGLE") {
      const v = stored[key];
      base[key] = v === true || v === "true" || String(v) === "true";
      continue;
    }
    if (ft === "NUMERIC") {
      const v = stored[key];
      if (v === undefined) continue;
      const n = typeof v === "number" ? v : parseFloat(String(v));
      if (key === "A" || key === "B") {
        base[key] = String(Number.isNaN(n) || n < 1 ? 1 : n);
      } else {
        base[key] = String(Number.isNaN(n) ? "0" : n);
      }
      continue;
    }
    if (ft === "PERIODIC_TABLE") {
      if (stored[key] !== undefined) {
        const n = typeof stored[key] === "number" ? stored[key] : parseFloat(String(stored[key]));
        base[key] = Number.isNaN(Number(n)) ? 0 : Number(n);
      }
      if (stored[key + "_elements"] !== undefined) {
        base[key + "_elements"] = String(stored[key + "_elements"]);
      }
      continue;
    }
    if (ft === "TABLE") {
      const v = stored[key];
      if (v === undefined) continue;
      try {
        const parsed = JSON.parse(String(v));
        if (Array.isArray(parsed)) base[key] = parsed as string[][];
      } catch {
        /* keep default */
      }
      continue;
    }
    if (stored[key] !== undefined) {
      base[key] = typeof stored[key] === "number" ? String(stored[key]) : String(stored[key]);
    }
  }

  for (const [k, v] of Object.entries(stored)) {
    if (k.endsWith("_elements") && base[k] === undefined) {
      base[k] = String(v);
    }
  }

  return base;
}

import { formatINR } from "@/lib/money";
import { normalizeOptionsList } from "@/lib/dynamicFieldOptions";
import { isExternalBookingUserType, normalizeUserTypeCode } from "@/lib/userTypes";

export type ChargeCategoryRowInput = {
  userType: string;
  label: string;
  primary: string;
  secondary: string;
  /** Breakpoint units after which secondary applies (e.g. elements). */
  breakpoint?: string | number | null;
  notes?: string;
};

export type MultiParamSlotOptionInput = {
  user_type?: string | null;
  param_code?: string | null;
  param_name?: string | null;
  unit_charge?: string | number | null;
  unit_time_minutes?: number | string | null;
  is_active?: boolean;
};

export type ChargeCategoryPresentationContext = {
  inputFields?: Array<{ field_key?: string | null; options?: unknown }> | null;
  slotOptions?: MultiParamSlotOptionInput[] | null;
};

export type ChargeCategoryPresentation = {
  /** When true, use the simplified layout (not the legacy primary/secondary table). */
  simplified: boolean;
  /** Profile family driving the simplified copy. */
  mode: "sample_element" | "sample" | "hour" | "multi_param" | "legacy";
  subtitle: string;
  rows: Array<{
    userType: string;
    label: string;
    chargeLine: string;
    gstLine: string;
  }>;
  /**
   * MULTI_PARAM only: Field B option labels (e.g. 12 Hour / 24 Hour / 48 Hour)
   * and per-user-type charges looked up from slot options by matching option text ↔ param_code.
   */
  optionColumns?: string[];
  multiParamRows?: Array<{
    userType: string;
    label: string;
    chargesByOption: Record<string, string>;
    gstLine: string;
  }>;
};

function formatBreakpoint(raw: string | number | null | undefined): string | null {
  if (raw == null || String(raw).trim() === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n === 0) return null;
  return Number.isInteger(n) ? String(n) : String(n);
}

function hasSecondaryCharge(secondary: string | null | undefined): boolean {
  if (secondary == null || String(secondary).trim() === "" || String(secondary).trim() === "—") {
    return false;
  }
  const n = Number(secondary);
  return Number.isFinite(n) ? n !== 0 : true;
}

function gstLineForUserType(userType: string): string {
  return isExternalBookingUserType(userType) ? "GST extra @18%" : "No GST";
}

function moneyOrDash(raw: string): string {
  if (!raw || raw === "—") return "—";
  return formatINR(raw);
}

function normKey(raw: string | null | undefined): string {
  return String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** Resolve Field B option labels from dynamic input fields. */
export function getMultiParamFieldBOptions(
  inputFields?: Array<{ field_key?: string | null; options?: unknown }> | null
): string[] {
  if (!Array.isArray(inputFields)) return [];
  const fieldB = inputFields.find((f) => String(f?.field_key ?? "").trim().toUpperCase() === "B");
  if (!fieldB) return [];
  return normalizeOptionsList(fieldB.options);
}

/**
 * Option column order: Field B options first; any active slot param_codes not listed in B are appended
 * (sorted by unit_time_minutes when available).
 */
function resolveMultiParamOptionColumns(
  fieldBOptions: string[],
  slotOptions: MultiParamSlotOptionInput[]
): string[] {
  const active = slotOptions.filter((s) => s && s.is_active !== false);
  const columns: string[] = [];
  const seen = new Set<string>();

  for (const opt of fieldBOptions) {
    const label = String(opt ?? "").trim();
    if (!label) continue;
    const key = normKey(label);
    if (seen.has(key)) continue;
    seen.add(key);
    columns.push(label);
  }

  const extras = active
    .map((s) => ({
      code: String(s.param_code ?? "").trim(),
      minutes: Number(s.unit_time_minutes),
    }))
    .filter((x) => x.code && !seen.has(normKey(x.code)));

  extras.sort((a, b) => {
    const am = Number.isFinite(a.minutes) ? a.minutes : Number.POSITIVE_INFINITY;
    const bm = Number.isFinite(b.minutes) ? b.minutes : Number.POSITIVE_INFINITY;
    if (am !== bm) return am - bm;
    return a.code.localeCompare(b.code);
  });

  for (const extra of extras) {
    const key = normKey(extra.code);
    if (seen.has(key)) continue;
    seen.add(key);
    columns.push(extra.code);
  }

  return columns;
}

function findSlotChargeForOption(
  slotOptions: MultiParamSlotOptionInput[],
  userType: string,
  optionLabel: string
): string | null {
  const ut = normalizeUserTypeCode(userType);
  const optKey = normKey(optionLabel);
  if (!ut || !optKey) return null;

  const active = slotOptions.filter((s) => s && s.is_active !== false);
  const forUser = active.filter((s) => normalizeUserTypeCode(s.user_type) === ut);

  const matchIn = (list: MultiParamSlotOptionInput[]) =>
    list.find((s) => normKey(s.param_code) === optKey) ||
    list.find((s) => normKey(s.param_name) === optKey);

  const hit = matchIn(forUser) || matchIn(active);
  if (!hit || hit.unit_charge == null || String(hit.unit_charge).trim() === "") return null;
  return String(hit.unit_charge);
}

function buildMultiParamPresentation(
  rows: ChargeCategoryRowInput[],
  context: ChargeCategoryPresentationContext
): ChargeCategoryPresentation | null {
  const slotOptions = Array.isArray(context.slotOptions) ? context.slotOptions : [];
  const fieldBOptions = getMultiParamFieldBOptions(context.inputFields);
  const optionColumns = resolveMultiParamOptionColumns(fieldBOptions, slotOptions);

  if (optionColumns.length === 0) return null;

  const multiParamRows = rows.map((row) => {
    const chargesByOption: Record<string, string> = {};
    for (const opt of optionColumns) {
      const raw = findSlotChargeForOption(slotOptions, row.userType, opt);
      chargesByOption[opt] = raw != null ? moneyOrDash(raw) : "—";
    }
    return {
      userType: row.userType,
      label: row.label,
      chargesByOption,
      gstLine: gstLineForUserType(row.userType),
    };
  });

  return {
    simplified: true,
    mode: "multi_param",
    subtitle:
      "Standard rates for this equipment by duration option (per sample), including student and faculty categories.",
    rows: [],
    optionColumns,
    multiParamRows,
  };
}

/**
 * Build simplified charge copy for SAMPLE_ELEMENT, SAMPLE (no secondary), HOUR (no secondary),
 * and MULTI_PARAM (Field B options × slot-option charges).
 * Other profile types return simplified:false so the caller keeps the legacy multi-column table.
 */
export function buildChargeCategoryPresentation(
  profileType: string | null | undefined,
  rows: ChargeCategoryRowInput[],
  context?: ChargeCategoryPresentationContext | null
): ChargeCategoryPresentation {
  const t = String(profileType || "").toUpperCase();
  const anySecondary = rows.some((r) => hasSecondaryCharge(r.secondary));
  const anyBreakpoint = rows.some((r) => formatBreakpoint(r.breakpoint) != null);

  if (t === "MULTI_PARAM" || t === "MULTI-PARAMETER") {
    const multi = buildMultiParamPresentation(rows, context ?? {});
    if (multi) return multi;
    return {
      simplified: false,
      mode: "legacy",
      subtitle: "Standard rates for this equipment, including student and faculty categories.",
      rows: [],
    };
  }

  let mode: ChargeCategoryPresentation["mode"] = "legacy";
  if (t === "SAMPLE_ELEMENT" || (t === "SAMPLE" && anySecondary && anyBreakpoint)) {
    mode = "sample_element";
  } else if (t === "SAMPLE" && !anySecondary) {
    mode = "sample";
  } else if (t === "HOUR" && !anySecondary) {
    mode = "hour";
  }

  if (mode === "legacy") {
    return {
      simplified: false,
      mode,
      subtitle: "Standard rates for this equipment, including student and faculty categories.",
      rows: [],
    };
  }

  const subtitle =
    mode === "hour"
      ? "Standard rates for this equipment (per hour), including student and faculty categories."
      : "Standard rates for this equipment (per sample), including student and faculty categories.";

  const presented = rows.map((row) => {
    const primary = moneyOrDash(row.primary);
    const secondary = moneyOrDash(row.secondary);
    const bp = formatBreakpoint(row.breakpoint);
    let chargeLine = primary;

    if (mode === "sample_element" && primary !== "—" && secondary !== "—" && bp) {
      chargeLine = `${primary}/Sample upto ${bp} elements and thereafter ${secondary} per element extra`;
    } else if (mode === "sample_element" && primary !== "—" && secondary !== "—") {
      chargeLine = `${primary}/Sample and thereafter ${secondary} per element extra`;
    } else if (mode === "sample" && primary !== "—") {
      chargeLine = `${primary}/Sample`;
    } else if (mode === "hour" && primary !== "—") {
      chargeLine = `${primary}/Hour`;
    }

    return {
      userType: row.userType,
      label: row.label,
      chargeLine,
      gstLine: gstLineForUserType(row.userType),
    };
  });

  return { simplified: true, mode, subtitle, rows: presented };
}

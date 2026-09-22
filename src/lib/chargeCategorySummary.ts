import {
  CHARGE_ESTIMATE_USER_TYPE_OPTIONS,
  getChargeEstimateUserTypeLabel,
  getUserTypeDisplayName,
  normalizeUserTypeCode,
} from "@/lib/userTypes";

export type ChargeCategorySummaryRow = {
  userType: string;
  label: string;
  primary: string;
  secondary: string;
  breakpoint: string;
  notes: string;
};

/** Build charge-by-user-category rows for View Charges / Calculate Charges summaries. */
export function buildChargeCategorySummaryRows(eq: {
  charge_profiles?: Array<Record<string, unknown>>;
  base_charges_by_user_type?: Array<{
    user_type: string;
    user_type_display?: string;
    profile_type_display?: string | null;
    primary_unit_charge?: string;
    secondary_unit_charge?: string;
  }>;
  profile_type?: string;
  slot_options?: Array<Record<string, unknown>>;
  param_definitions?: Array<Record<string, unknown>>;
} | null | undefined): ChargeCategorySummaryRow[] {
  if (!eq) return [];
  const profileType = String(eq.profile_type || "").toUpperCase();
  const defaultBasis =
    profileType === "HOUR"
      ? "Per hour"
      : profileType === "SAMPLE" || profileType === "SAMPLE_ELEMENT" || profileType === "MULTI_PARAM"
        ? "Per sample"
        : profileType === "PRINT_3D"
          ? "Per print (see profile)"
          : profileType
            ? `Profile: ${profileType}`
            : "";

  const byType = new Map<string, ChargeCategorySummaryRow>();

  const profiles = Array.isArray(eq.charge_profiles) ? eq.charge_profiles : [];
  for (const cp of profiles) {
    if (cp && cp.is_active === false) continue;
    const code = normalizeUserTypeCode(String(cp.user_type ?? "")) || String(cp.user_type ?? "");
    if (!code) continue;
    const primary =
      cp.primary_unit_charge != null && String(cp.primary_unit_charge) !== ""
        ? String(cp.primary_unit_charge)
        : "—";
    const secRaw = cp.secondary_unit_charge;
    const secondary =
      secRaw != null && String(secRaw).trim() !== "" && Number(secRaw) !== 0 ? String(secRaw) : "";
    const bpRaw = cp.breakpoint;
    const breakpoint =
      bpRaw != null && String(bpRaw).trim() !== "" && Number(bpRaw) !== 0 ? String(bpRaw) : "";
    const noteParts: string[] = [];
    if (defaultBasis) noteParts.push(defaultBasis);
    if (breakpoint) noteParts.push(`Applies after ${breakpoint} units`);
    byType.set(code, {
      userType: code,
      label: getUserTypeDisplayName(code) || getChargeEstimateUserTypeLabel(code) || code,
      primary,
      secondary,
      breakpoint,
      notes: noteParts.join(" · "),
    });
  }

  const baseRows = Array.isArray(eq.base_charges_by_user_type) ? eq.base_charges_by_user_type : [];
  for (const row of baseRows) {
    const code = normalizeUserTypeCode(String(row.user_type ?? "")) || String(row.user_type ?? "");
    if (!code || byType.has(code)) continue;
    byType.set(code, {
      userType: code,
      label: row.user_type_display || getUserTypeDisplayName(code) || code,
      primary: row.primary_unit_charge != null ? String(row.primary_unit_charge) : "—",
      secondary:
        row.secondary_unit_charge != null && String(row.secondary_unit_charge).trim() !== ""
          ? String(row.secondary_unit_charge)
          : "",
      breakpoint: "",
      notes: row.profile_type_display || defaultBasis,
    });
  }

  if (profileType === "MULTI_PARAM") {
    const slots = Array.isArray(eq.slot_options)
      ? eq.slot_options
      : Array.isArray(eq.param_definitions)
        ? eq.param_definitions
        : [];
    for (const slot of slots) {
      if (!slot || slot.is_active === false) continue;
      const code = normalizeUserTypeCode(String(slot.user_type ?? "")) || String(slot.user_type ?? "");
      if (!code || byType.has(code)) continue;
      byType.set(code, {
        userType: code,
        label: getUserTypeDisplayName(code) || getChargeEstimateUserTypeLabel(code) || code,
        primary: "—",
        secondary: "",
        breakpoint: "",
        notes: defaultBasis,
      });
    }
  }

  const preferred = CHARGE_ESTIMATE_USER_TYPE_OPTIONS.map((o) => o.code);
  const ordered: string[] = [];
  for (const code of preferred) {
    if (byType.has(code)) ordered.push(code);
  }
  for (const code of byType.keys()) {
    if (!ordered.includes(code)) ordered.push(code);
  }
  return ordered.map((c) => byType.get(c)!);
}

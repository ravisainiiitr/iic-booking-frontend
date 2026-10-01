import type { AnalysisChargeExportRow } from "@/lib/analysisChargesExport";
import { buildChargeCategoryPresentation } from "@/lib/chargeCategoryPresentation";
import { buildChargeCategorySummaryRows } from "@/lib/chargeCategorySummary";
import { isExternalBookingUserType } from "@/lib/userTypes";

export type AnalysisChargeEquipment = {
  name: string;
  profile_type: string;
  charge_profiles: Array<Record<string, unknown>>;
  input_fields?: Array<{ field_key?: string | null; options?: unknown; user_type?: string }>;
  slot_options?: Array<Record<string, unknown>>;
};

/**
 * Long-format Analysis Charges rows (one per user category) for one equipment.
 * `filterUserTypes` holds lower-cased user-type codes; null keeps every category.
 */
export function buildAnalysisChargeRowsForEquipment(
  eq: AnalysisChargeEquipment,
  filterUserTypes: Set<string> | null
): AnalysisChargeExportRow[] {
  const keep = (userType: string) =>
    !filterUserTypes || filterUserTypes.has(String(userType || "").toLowerCase());

  const rows: AnalysisChargeExportRow[] = [];
  const summaryRows = buildChargeCategorySummaryRows(eq).filter((row) => keep(row.userType));
  const presentation = buildChargeCategoryPresentation(eq.profile_type, summaryRows, {
    inputFields: eq.input_fields,
    slotOptions: Array.isArray(eq.slot_options) ? eq.slot_options : [],
  });

  if (presentation.simplified && presentation.mode === "multi_param") {
    const opts = presentation.optionColumns ?? [];
    for (const row of (presentation.multiParamRows ?? []).filter((r) => keep(r.userType))) {
      if (row.chargeLine) {
        rows.push({
          equipmentName: eq.name,
          userCategory: row.label,
          charge: row.chargeLine,
          gst: row.gstLine,
        });
        continue;
      }
      const chargeLines = opts.map((opt) => ({
        option: opt,
        amount: row.chargesByOption[opt] ?? "—",
      }));
      rows.push({
        equipmentName: eq.name,
        userCategory: row.label,
        charge: chargeLines.map((l) => `${l.option}: ${l.amount}`).join("\n"),
        chargeLines,
        gst: row.gstLine,
      });
    }
  } else if (presentation.simplified) {
    for (const row of presentation.rows.filter((r) => keep(r.userType))) {
      rows.push({
        equipmentName: eq.name,
        userCategory: row.label,
        charge: row.chargeLine,
        gst: row.gstLine,
      });
    }
  } else {
    for (const row of summaryRows) {
      const parts = [`₹${row.primary}`];
      if (row.secondary) parts.push(`Secondary ₹${row.secondary}`);
      if (row.notes) parts.push(row.notes);
      rows.push({
        equipmentName: eq.name,
        userCategory: row.label,
        charge: row.displayText || parts.join(" · "),
        gst: isExternalBookingUserType(row.userType) ? "GST extra @18%" : "No GST",
      });
    }
  }
  return rows;
}

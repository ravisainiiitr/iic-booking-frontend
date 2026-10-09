/** Display helpers for the 3D print estimate breakdown (weight / time model on the server). */
import type { PrintEstimateBreakdown, PrintSupportMode } from "@/lib/api";

export const SUPPORT_MODE_OPTIONS: Array<{ value: PrintSupportMode; label: string; hint: string }> = [
  { value: "auto", label: "Auto", hint: "Touching build plate if the model has overhangs, otherwise none" },
  { value: "none", label: "None", hint: "No supports; overhangs may sag" },
  { value: "buildplate", label: "Touching build plate only", hint: "Supports only where they can stand on the plate" },
  { value: "everywhere", label: "Everywhere", hint: "Supports also standing on the model itself" },
];

export const SUPPORT_MODE_LABELS: Record<string, string> = {
  auto: "Auto",
  none: "None",
  buildplate: "Touching build plate only",
  everywhere: "Everywhere",
};

export const PRINT_ESTIMATE_NOTE =
  "Estimate from the model's geometry and the printer's profile; the lab confirms the actual weight and time.";

/** 155 → "2 h 35 m"; 45 → "45 min". */
export function formatPrintDuration(minutes: number | null | undefined): string {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total - h * 60;
  return m ? `${h} h ${m} m` : `${h} h`;
}

function grams(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 g";
  return `${value < 10 ? value.toFixed(1) : value.toFixed(value < 100 ? 1 : 0)} g`;
}

export interface PrintEstimateTotals {
  modelG: number;
  supportG: number;
  wasteG: number;
  /** Supports in a separate support material (charged at its own rate). */
  supportMaterialG: number;
  supportMaterialCode: string;
  totalMin: number;
  warmupMin: number;
  supportMode: string | null;
  supportModeRequested: string | null;
  overhangAreaMm2: number;
  overhangPlateMm2: number;
  notes: string[];
}

/** Sum the per-copy breakdowns of several files: each × copies × sets. Null when none has a breakdown. */
export function sumPrintEstimates(
  items: Array<{ breakdown?: PrintEstimateBreakdown | null; quantity: number }>,
  sets = 1,
): PrintEstimateTotals | null {
  const withBreakdown = items.filter((i) => i.breakdown);
  if (!withBreakdown.length) return null;
  const totals: PrintEstimateTotals = {
    modelG: 0,
    supportG: 0,
    wasteG: 0,
    supportMaterialG: 0,
    supportMaterialCode: "",
    totalMin: 0,
    warmupMin: 0,
    supportMode: null,
    supportModeRequested: null,
    overhangAreaMm2: 0,
    overhangPlateMm2: 0,
    notes: [],
  };
  const modes = new Set<string>();
  for (const item of withBreakdown) {
    const b = item.breakdown as PrintEstimateBreakdown;
    const copies = Math.max(1, item.quantity || 1) * Math.max(1, sets);
    totals.modelG += (b.model_g || 0) * copies;
    totals.supportG += (b.support_g || 0) * copies;
    totals.wasteG += (b.waste_g || 0) * copies;
    totals.supportMaterialG += (b.support_material_g || 0) * copies;
    totals.supportMaterialCode ||= b.support_material_code || "";
    // Same as the booked time: every copy is quoted with its own warm-up.
    totals.totalMin += (b.total_min || 0) * copies;
    totals.warmupMin += (b.warmup_min || 0) * copies;
    totals.overhangAreaMm2 += b.overhang_area_mm2 || 0;
    totals.overhangPlateMm2 += b.overhang_plate_mm2 || 0;
    totals.supportModeRequested ||= b.support_mode_requested || null;
    modes.add(b.support_mode);
    for (const note of b.notes ?? []) if (!totals.notes.includes(note)) totals.notes.push(note);
  }
  totals.supportMode = modes.size === 1 ? [...modes][0] : "mixed";
  return totals;
}

/** "Model 18.2 g + supports 3.1 g + waste 0.5 g; ~2 h 35 m incl. 10 min warm-up". */
export function printEstimateSummary(t: PrintEstimateTotals): string {
  const parts = [`Model ${grams(t.modelG)}`];
  if (t.supportG > 0.05) {
    parts.push(`supports ${grams(t.supportG)}${t.supportMaterialCode ? ` (${t.supportMaterialCode})` : ""}`);
  }
  if (t.wasteG > 0.05) parts.push(`waste ${grams(t.wasteG)}`);
  const warmup = t.warmupMin > 0 ? ` incl. ${Math.round(t.warmupMin)} min warm-up` : "";
  return `${parts.join(" + ")}; ~${formatPrintDuration(t.totalMin)}${warmup}`;
}

/** "Touching build plate only" or "Auto → touching build plate only". */
export function supportModeSummary(t: PrintEstimateTotals): string {
  const resolved = t.supportMode === "mixed" ? "depends on the file" : SUPPORT_MODE_LABELS[t.supportMode ?? "none"] ?? "None";
  if (t.supportModeRequested === "auto") return `Auto → ${resolved.charAt(0).toLowerCase()}${resolved.slice(1)}`;
  return resolved;
}

export function formatAreaMm2(value: number): string {
  return `${Math.round(value).toLocaleString("en-IN")} mm²`;
}

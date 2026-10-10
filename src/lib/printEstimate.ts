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
  /** Brim / raft in the model material. */
  adhesionG: number;
  adhesionMin: number;
  /** "Brim", "Raft", "mixed" or "" (none). */
  adhesionLabel: string;
  /** Support type label ("Tree"), "mixed", or "" when not reported. */
  supportTypeLabel: string;
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
    adhesionG: 0,
    adhesionMin: 0,
    adhesionLabel: "",
    supportTypeLabel: "",
  };
  const modes = new Set<string>();
  const types = new Set<string>();
  const adhesions = new Set<string>();
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
    if (b.support_type_label) types.add(b.support_type_label);
    totals.adhesionG += (b.adhesion_g || 0) * copies;
    totals.adhesionMin += (b.adhesion_min || 0) * copies;
    if (b.adhesion && b.adhesion !== "none") adhesions.add(b.adhesion_label || b.adhesion);
    for (const note of b.notes ?? []) if (!totals.notes.includes(note)) totals.notes.push(note);
  }
  totals.supportMode = modes.size === 1 ? [...modes][0] : "mixed";
  totals.supportTypeLabel = types.size > 1 ? "mixed" : [...types][0] ?? "";
  totals.adhesionLabel = adhesions.size > 1 ? "mixed" : [...adhesions][0] ?? "";
  return totals;
}

/** "brim" / "raft" / "brim / raft" for the weight split. */
function adhesionWord(t: PrintEstimateTotals): string {
  return t.adhesionLabel && t.adhesionLabel !== "mixed" ? t.adhesionLabel.toLowerCase() : "brim / raft";
}

/** Per-part weight split for the running estimate: model, supports, brim / raft, waste. */
export function printWeightSplit(t: PrintEstimateTotals): string[] {
  const round = (g: number) => Math.round(g * 10) / 10;
  return [
    `model ${round(t.modelG)} g`,
    t.supportG > 0.05 ? `supports ${round(t.supportG)} g` : null,
    t.adhesionG > 0.05 ? `${adhesionWord(t)} ${round(t.adhesionG)} g` : null,
    t.wasteG > 0.05 ? `waste ${round(t.wasteG)} g` : null,
  ].filter((s): s is string => !!s);
}

/** "About 45% less support material than Normal", "About 5% more …", or "" for 1. */
export function supportTypeMaterialNote(volumeFactor: number | null | undefined): string {
  const f = Number(volumeFactor);
  if (!Number.isFinite(f) || Math.abs(f - 1) < 0.01) return "";
  const pct = Math.round(Math.abs(1 - f) * 100);
  return `About ${pct}% ${f < 1 ? "less" : "more"} support material than Normal`;
}

/** "Model 18.2 g + supports 3.1 g + waste 0.5 g; ~2 h 35 m incl. 10 min warm-up". */
export function printEstimateSummary(t: PrintEstimateTotals): string {
  const parts = [`Model ${grams(t.modelG)}`];
  if (t.supportG > 0.05) {
    parts.push(`supports ${grams(t.supportG)}${t.supportMaterialCode ? ` (${t.supportMaterialCode})` : ""}`);
  }
  if (t.adhesionG > 0.05) parts.push(`${adhesionWord(t)} ${grams(t.adhesionG)}`);
  if (t.wasteG > 0.05) parts.push(`waste ${grams(t.wasteG)}`);
  const warmup = t.warmupMin > 0 ? ` incl. ${Math.round(t.warmupMin)} min warm-up` : "";
  return `${parts.join(" + ")}; ~${formatPrintDuration(t.totalMin)}${warmup}`;
}

/** "Touching build plate only" or "Auto → touching build plate only". */
export function supportModeSummary(t: PrintEstimateTotals): string {
  const resolved = t.supportMode === "mixed" ? "depends on the file" : SUPPORT_MODE_LABELS[t.supportMode ?? "none"] ?? "None";
  let text = t.supportModeRequested === "auto" ? `Auto → ${resolved.charAt(0).toLowerCase()}${resolved.slice(1)}` : resolved;
  if (t.supportTypeLabel && t.supportMode !== "none") {
    text = `${t.supportTypeLabel === "mixed" ? "Mixed types" : t.supportTypeLabel} · ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
  }
  if (t.adhesionLabel) text += ` · ${t.adhesionLabel === "mixed" ? "brim / raft" : t.adhesionLabel.toLowerCase()}`;
  return text;
}

export function formatAreaMm2(value: number): string {
  return `${Math.round(value).toLocaleString("en-IN")} mm²`;
}

import type { LaserCutAnalysis, LaserSheetMaterial } from "@/lib/api";

/** Edge left on every side of the part on the user's own sheet (same as the backend). */
export const OWN_SHEET_MARGIN_MM = 5;
/** Wait after the last keystroke before a typed quantity or size is saved and the charge refreshed. */
export const LIVE_INPUT_DEBOUNCE_MS = 300;
export const OWN_SHEET_UPLOAD_HINT = "Upload your design to auto-fill the sheet size.";
export const OWN_PRINT_UPLOAD_HINT = "Upload your model to auto-fill the material you need.";

export interface OwnSheetSize {
  widthMm: number;
  heightMm: number;
  rotated: boolean;
}

function overflow(w: number, h: number, bedW: number, bedH: number): number {
  return Math.max(0, w - bedW) + Math.max(0, h - bedH);
}

function smallestStandardSize(w: number, h: number, sizes: Array<[number, number]>): [number, number] | null {
  let best: [number, number] | null = null;
  for (const [sw, sh] of sizes) {
    const fitted: [number, number] | null = w <= sw && h <= sh ? [sw, sh] : w <= sh && h <= sw ? [sh, sw] : null;
    if (fitted && (!best || fitted[0] * fitted[1] < best[0] * best[1])) best = fitted;
  }
  return best;
}

/**
 * Sheet the user should bring for one part: its bounding box plus the margin on every side, rounded up to the
 * next whole mm (or the smallest standard size it fits on), turned 90° when that overflows the bed less.
 */
export function ownSheetSize(
  widthMm: number | string | null | undefined,
  heightMm: number | string | null | undefined,
  options: { marginMm?: number; bed?: [number, number] | null; standardSizes?: Array<[number, number]> } = {},
): OwnSheetSize | null {
  const pw = Number(widthMm);
  const ph = Number(heightMm);
  if (widthMm == null || heightMm == null || !(pw > 0) || !(ph > 0)) return null;
  const margin = Math.max(0, options.marginMm ?? OWN_SHEET_MARGIN_MM);
  // Round away float noise (e.g. 210.00000001) before rounding up.
  const ceilMm = (v: number) => Math.ceil(Math.round(v * 1e6) / 1e6);
  let w = ceilMm(pw + 2 * margin);
  let h = ceilMm(ph + 2 * margin);
  const standard = smallestStandardSize(w, h, options.standardSizes ?? []);
  if (standard) [w, h] = standard;
  let rotated = false;
  const bed = options.bed;
  if (bed && bed[0] > 0 && bed[1] > 0 && overflow(h, w, bed[0], bed[1]) < overflow(w, h, bed[0], bed[1])) {
    [w, h] = [h, w];
    rotated = true;
  }
  return { widthMm: w, heightMm: h, rotated };
}

export interface LaserOwnSheet extends OwnSheetSize {
  /** "user": entered by the user; "model": worked out from the drawing. */
  source: "user" | "model";
}

/** The size the user entered, else the server's size from the drawing, else the same rule worked out here. */
export function laserOwnSheet(part: LaserCutAnalysis, material?: LaserSheetMaterial | null): LaserOwnSheet | null {
  const userW = Number(part.own_sheet_width_mm);
  const userH = Number(part.own_sheet_height_mm);
  if (part.own_sheet_width_mm != null && part.own_sheet_height_mm != null && userW > 0 && userH > 0) {
    return { widthMm: userW, heightMm: userH, rotated: false, source: "user" };
  }
  if (part.status !== "COMPLETED") return null;
  const suggested = part.own_sheet_suggested;
  if (suggested && Number(suggested.width_mm) > 0 && Number(suggested.height_mm) > 0) {
    return {
      widthMm: Number(suggested.width_mm),
      heightMm: Number(suggested.height_mm),
      rotated: Boolean(suggested.rotated),
      source: "model",
    };
  }
  const bed: [number, number] | null = material
    ? [Number(material.sheet_width_mm) || 0, Number(material.sheet_height_mm) || 0]
    : null;
  const size = ownSheetSize(part.width_mm, part.height_mm, { bed });
  return size ? { ...size, source: "model" } : null;
}

export function formatMm(value: number | string | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

/** Model size (X × Y × Z mm) from a 3D print analysis bounding box, or null. */
export function printModelSize(boundingBox: Record<string, unknown> | null | undefined): string | null {
  const size = (boundingBox?.size ?? null) as { x?: unknown; y?: unknown; z?: unknown } | null;
  const dims = [size?.x, size?.y, size?.z].map((v) => Number(v));
  if (!size || dims.some((v) => !(v > 0))) return null;
  return `${dims.map((v) => formatMm(v)).join(" × ")} mm`;
}

/** Whole number of at least 1, or null (typing in progress / invalid). */
export function parseWholeQuantity(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return n >= 1 ? n : null;
}

export function ownMaterialChargeNote(charge: string | number | null | undefined, kind: "sheet" | "printing"): string {
  const n = Number(charge);
  if (!Number.isFinite(n) || n <= 0) {
    return `No ${kind} material charge (machine time is still charged).`;
  }
  const rupees = `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return kind === "sheet"
    ? `A fixed charge of ${rupees} replaces the sheet material cost.`
    : `A fixed charge of ${rupees} replaces the material cost (model and supports); machine time is still charged.`;
}

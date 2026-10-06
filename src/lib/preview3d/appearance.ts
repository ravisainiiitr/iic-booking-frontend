/**
 * Physically based looks for the 3D previews, derived from whatever the booking already knows about
 * the material (name, code, laser sheet family, an optional colour). Pure data: no three.js here, so
 * callers outside the lazy 3D chunk can use it.
 */

export type PrintFamily = "PLA" | "PETG" | "ABS" | "ASA" | "TPU" | "NYLON" | "PC" | "RESIN" | "GENERIC";

export interface PrintAppearance {
  family: PrintFamily;
  /** Short label for the overlay, e.g. "PLA · White". */
  label: string;
  color: string;
  roughness: number;
  metalness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  /** 0 = opaque; >0 lets light through (clear PETG, resin). */
  transmission: number;
  /** FDM prints show faint layer lines; resin prints do not. */
  layerLines: boolean;
}

export type LaserKind =
  | "acrylic"
  | "plywood"
  | "mdf"
  | "wood"
  | "steel"
  | "stainless"
  | "aluminium"
  | "brass"
  | "copper"
  | "paper"
  | "leather"
  | "generic";

export type LaserTexture = "wood-grain" | "mdf" | "brushed" | "none";

export interface LaserAppearance {
  kind: LaserKind;
  label: string;
  /** Top and bottom faces. */
  color: string;
  /** Cut sides (laser-charred wood, oxidised steel, polished acrylic). */
  edgeColor: string;
  cutLineColor: string;
  engraveColor: string;
  roughness: number;
  metalness: number;
  clearcoat: number;
  transmission: number;
  texture: LaserTexture;
}

interface NamedColor {
  name: string;
  hex: string;
  clear?: boolean;
}

const COLOR_WORDS: Array<[RegExp, NamedColor]> = [
  [/\b(clear|transparent|translucent)\b/, { name: "Clear", hex: "#e6f0f4", clear: true }],
  [/\bnatural\b/, { name: "Natural", hex: "#efe6d2" }],
  [/\bwhite\b/, { name: "White", hex: "#f2f1ed" }],
  [/\bblack\b/, { name: "Black", hex: "#1e1f22" }],
  [/\b(grey|gray)\b/, { name: "Grey", hex: "#8a8f96" }],
  [/\bsilver\b/, { name: "Silver", hex: "#bfc4c9" }],
  [/\bnavy\b/, { name: "Navy", hex: "#1f2f5c" }],
  [/\bblue\b/, { name: "Blue", hex: "#1f5fbf" }],
  [/\b(cyan|teal|turquoise)\b/, { name: "Teal", hex: "#169c9c" }],
  [/\bgreen\b/, { name: "Green", hex: "#2e8b4a" }],
  [/\byellow\b/, { name: "Yellow", hex: "#f2c230" }],
  [/\borange\b/, { name: "Orange", hex: "#ef7d1a" }],
  [/\bred\b/, { name: "Red", hex: "#c62a2f" }],
  [/\b(purple|violet)\b/, { name: "Purple", hex: "#6b3fa0" }],
  [/\bpink\b/, { name: "Pink", hex: "#e66a9a" }],
  [/\bbrown\b/, { name: "Brown", hex: "#7a4b2a" }],
  [/\bgold(en)?\b/, { name: "Gold", hex: "#c9a23a" }],
  [/\b(beige|skin|ivory|cream)\b/, { name: "Beige", hex: "#e6d3b3" }],
];

const HEX_RE = /#?\b([0-9a-f]{6})\b/i;

function textOf(...parts: Array<string | null | undefined>): string {
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[_\-/]+/g, " ");
}

/** A colour named in the material text, or an explicit hex hint such as "#ff8800". */
export function detectColor(text: string | null | undefined, hint?: string | null): NamedColor | null {
  const h = (hint || "").trim();
  if (h) {
    const m = HEX_RE.exec(h);
    if (m) return { name: "", hex: `#${m[1].toLowerCase()}` };
    const fromHint = detectColor(h);
    if (fromHint) return fromHint;
  }
  const t = textOf(text);
  if (!t) return null;
  for (const [re, c] of COLOR_WORDS) if (re.test(t)) return c;
  return null;
}

export function detectPrintFamily(text: string): PrintFamily {
  const t = textOf(text);
  if (/\bpetg?\b|\bpet g\b/.test(t)) return "PETG";
  if (/\bpla\b/.test(t)) return "PLA";
  if (/\babs\b/.test(t)) return "ABS";
  if (/\basa\b/.test(t)) return "ASA";
  if (/\b(tpu|tpe|flex|flexible)\b/.test(t)) return "TPU";
  if (/\b(nylon|pa ?\d*|pa cf)\b/.test(t)) return "NYLON";
  if (/\b(pc|polycarbonate)\b/.test(t)) return "PC";
  if (/\b(resin|sla|dlp|msla|lcd)\b/.test(t)) return "RESIN";
  return "GENERIC";
}

const PRINT_DEFAULTS: Record<PrintFamily, Omit<PrintAppearance, "family" | "label">> = {
  PLA: { color: "#f1efe9", roughness: 0.42, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.4, transmission: 0, layerLines: true },
  PETG: { color: "#d6e6ec", roughness: 0.2, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.15, transmission: 0.35, layerLines: true },
  ABS: { color: "#ece9df", roughness: 0.62, metalness: 0, clearcoat: 0.05, clearcoatRoughness: 0.6, transmission: 0, layerLines: true },
  ASA: { color: "#e9e6dd", roughness: 0.66, metalness: 0, clearcoat: 0.04, clearcoatRoughness: 0.6, transmission: 0, layerLines: true },
  TPU: { color: "#2d2f33", roughness: 0.85, metalness: 0, clearcoat: 0, clearcoatRoughness: 1, transmission: 0, layerLines: true },
  NYLON: { color: "#efe8d8", roughness: 0.72, metalness: 0, clearcoat: 0, clearcoatRoughness: 1, transmission: 0, layerLines: true },
  PC: { color: "#e3edf2", roughness: 0.18, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.1, transmission: 0.3, layerLines: true },
  RESIN: { color: "#9aa1a9", roughness: 0.32, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.25, transmission: 0, layerLines: false },
  GENERIC: { color: "#d9dce1", roughness: 0.5, metalness: 0, clearcoat: 0.15, clearcoatRoughness: 0.4, transmission: 0, layerLines: true },
};

const PRINT_LABELS: Record<PrintFamily, string> = {
  PLA: "PLA",
  PETG: "PETG",
  ABS: "ABS",
  ASA: "ASA",
  TPU: "TPU",
  NYLON: "Nylon",
  PC: "Polycarbonate",
  RESIN: "Resin",
  GENERIC: "Plastic",
};

export function printAppearance(input: {
  materialName?: string | null;
  materialCode?: string | null;
  colorHint?: string | null;
}): PrintAppearance {
  const text = textOf(input.materialName, input.materialCode);
  const family = detectPrintFamily(text);
  const base = { ...PRINT_DEFAULTS[family] };
  const color = detectColor(text, input.colorHint);
  if (color) {
    base.color = color.hex;
    if (color.clear) {
      base.transmission = Math.max(base.transmission, 0.9);
      base.roughness = Math.min(base.roughness, 0.1);
    } else if (base.transmission > 0 && color.name !== "Natural") {
      base.transmission = 0.06;
    }
  }
  if (/\bsilk\b/.test(text)) {
    base.clearcoat = 0.9;
    base.clearcoatRoughness = 0.1;
    base.metalness = 0.25;
    base.roughness = 0.3;
  }
  if (/\bmatte?\b/.test(text)) {
    base.clearcoat = 0;
    base.roughness = 0.82;
  }
  if (/\b(carbon|cf)\b/.test(text)) {
    base.color = color?.hex ?? "#2f3135";
    base.roughness = 0.75;
    base.clearcoat = 0;
  }
  const familyLabel = family === "GENERIC" ? (input.materialName || input.materialCode || "Plastic").trim() : PRINT_LABELS[family];
  const label = color?.name && !new RegExp(`\\b${color.name}\\b`, "i").test(familyLabel) ? `${familyLabel} · ${color.name}` : familyLabel;
  return { family, label, ...base };
}

const LASER_DEFAULTS: Record<LaserKind, Omit<LaserAppearance, "kind" | "label">> = {
  acrylic: {
    color: "#e6f0f4",
    edgeColor: "#f4fbfd",
    cutLineColor: "#ffffff",
    engraveColor: "#f8fafc",
    roughness: 0.05,
    metalness: 0,
    clearcoat: 1,
    transmission: 0.9,
    texture: "none",
  },
  plywood: {
    color: "#d9b486",
    edgeColor: "#3a2416",
    cutLineColor: "#2a1a10",
    engraveColor: "#5a371f",
    roughness: 0.78,
    metalness: 0,
    clearcoat: 0,
    transmission: 0,
    texture: "wood-grain",
  },
  wood: {
    color: "#c99a66",
    edgeColor: "#33200f",
    cutLineColor: "#24160b",
    engraveColor: "#4f2f18",
    roughness: 0.7,
    metalness: 0,
    clearcoat: 0.05,
    transmission: 0,
    texture: "wood-grain",
  },
  mdf: {
    color: "#b48a5f",
    edgeColor: "#2e1d12",
    cutLineColor: "#24160c",
    engraveColor: "#4b2e19",
    roughness: 0.86,
    metalness: 0,
    clearcoat: 0,
    transmission: 0,
    texture: "mdf",
  },
  steel: {
    color: "#80858c",
    edgeColor: "#46494e",
    cutLineColor: "#2f3236",
    engraveColor: "#3b3e42",
    roughness: 0.42,
    metalness: 1,
    clearcoat: 0,
    transmission: 0,
    texture: "brushed",
  },
  stainless: {
    color: "#c4c8cd",
    edgeColor: "#8b8f95",
    cutLineColor: "#5d6166",
    engraveColor: "#5f6368",
    roughness: 0.26,
    metalness: 1,
    clearcoat: 0,
    transmission: 0,
    texture: "brushed",
  },
  aluminium: {
    color: "#d2d6db",
    edgeColor: "#a7acb2",
    cutLineColor: "#7c8187",
    engraveColor: "#6b7076",
    roughness: 0.34,
    metalness: 1,
    clearcoat: 0,
    transmission: 0,
    texture: "brushed",
  },
  brass: {
    color: "#c9a54c",
    edgeColor: "#8a6a24",
    cutLineColor: "#6b5019",
    engraveColor: "#5c4515",
    roughness: 0.3,
    metalness: 1,
    clearcoat: 0,
    transmission: 0,
    texture: "brushed",
  },
  copper: {
    color: "#c27a4e",
    edgeColor: "#7c4529",
    cutLineColor: "#5e321c",
    engraveColor: "#4f2a17",
    roughness: 0.3,
    metalness: 1,
    clearcoat: 0,
    transmission: 0,
    texture: "brushed",
  },
  paper: {
    color: "#e9dcc4",
    edgeColor: "#7a5a3a",
    cutLineColor: "#5c4129",
    engraveColor: "#8a6a48",
    roughness: 0.92,
    metalness: 0,
    clearcoat: 0,
    transmission: 0,
    texture: "none",
  },
  leather: {
    color: "#7a4a2b",
    edgeColor: "#3a2214",
    cutLineColor: "#26150c",
    engraveColor: "#3f2414",
    roughness: 0.75,
    metalness: 0,
    clearcoat: 0.05,
    transmission: 0,
    texture: "none",
  },
  generic: {
    color: "#cfd3d8",
    edgeColor: "#8e949b",
    cutLineColor: "#4b5158",
    engraveColor: "#5b6168",
    roughness: 0.6,
    metalness: 0,
    clearcoat: 0,
    transmission: 0,
    texture: "none",
  },
};

const LASER_LABELS: Record<LaserKind, string> = {
  acrylic: "Acrylic",
  plywood: "Plywood",
  wood: "Wood",
  mdf: "MDF",
  steel: "Mild steel",
  stainless: "Stainless steel",
  aluminium: "Aluminium",
  brass: "Brass",
  copper: "Copper",
  paper: "Card / paper",
  leather: "Leather",
  generic: "Sheet",
};

export function detectLaserKind(family: string | null | undefined, text: string): LaserKind {
  const t = textOf(text);
  if (/\b(acrylic|perspex|pmma|plexi(glass)?|cast acrylic)\b/.test(t)) return "acrylic";
  if (/\bply(wood)?\b/.test(t)) return "plywood";
  if (/\bmdf\b/.test(t)) return "mdf";
  if (/\b(stainless|ss ?\d{3}|ss)\b/.test(t)) return "stainless";
  if (/\b(alu|aluminium|aluminum)\b/.test(t)) return "aluminium";
  if (/\bbrass\b/.test(t)) return "brass";
  if (/\bcopper\b/.test(t)) return "copper";
  if (/\b(mild steel|ms|gi|steel|crca|hr sheet|cr sheet)\b/.test(t)) return "steel";
  if (/\b(wood|pine|birch|bamboo|oak|teak|walnut|balsa)\b/.test(t)) return "wood";
  if (/\b(card|cardboard|paper|board)\b/.test(t)) return "paper";
  if (/\bleather\b/.test(t)) return "leather";
  switch ((family || "").toUpperCase()) {
    case "ACRYLIC":
      return "acrylic";
    case "MDF":
      return "mdf";
    case "MS":
      return "steel";
    case "SS":
      return "stainless";
    default:
      return "generic";
  }
}

export function laserAppearance(input: {
  family?: string | null;
  materialName?: string | null;
  materialCode?: string | null;
  colorHint?: string | null;
}): LaserAppearance {
  const text = textOf(input.materialName, input.materialCode);
  const kind = detectLaserKind(input.family, text);
  const base = { ...LASER_DEFAULTS[kind] };
  const color = detectColor(text, input.colorHint);
  if (color && (kind === "acrylic" || kind === "generic" || kind === "paper" || kind === "leather")) {
    base.color = color.hex;
    if (kind === "acrylic") {
      if (color.clear) {
        base.transmission = 0.92;
      } else if (/\b(tint|tinted|fluor|fluorescent|translucent)\b/.test(text)) {
        base.transmission = 0.6;
        base.edgeColor = color.hex;
      } else {
        base.transmission = 0;
        base.roughness = 0.08;
        base.edgeColor = color.hex;
        base.cutLineColor = color.name === "White" ? "#d7dde2" : "#f1f5f9";
        base.engraveColor = color.name === "White" ? "#c7ced6" : "#e2e8f0";
      }
    }
  }
  const label = color?.name && (kind === "acrylic" || kind === "generic") ? `${LASER_LABELS[kind]} · ${color.name}` : LASER_LABELS[kind];
  return { kind, label, ...base };
}

const ENGRAVE_LAYER_RE = /engrav|etch|raster|scor(e|ing)|marking|\bmark\b/i;

/** Layers named like "ENGRAVE", "Etch", "Score" are engraved, not cut through. */
export function isEngraveLayer(layer: string | null | undefined): boolean {
  return !!layer && ENGRAVE_LAYER_RE.test(layer);
}

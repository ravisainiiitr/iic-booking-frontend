/**
 * Support structures for the 3D print preview, drawn like the chosen support type prints. They grow from the
 * same overhang columns as the estimate (`computeSupports`: grid cells under faces that need support, down to
 * the plate or, with "everywhere", to the model below), so "touching build plate only" already leaves out
 * anything that would start on the model.
 *
 *  - grid (Normal): straight walls both ways under the overhangs, with a dense interface (roof) on top
 *  - lines / zigzag: thin parallel walls, straight or zig-zagging
 *  - snug: walls that follow the overhang's outline, with lines inside
 *  - concentric: rings that follow the outline inwards; gyroid: wavy walls both ways
 *  - tree / organic: trunks from the plate (or the model, "everywhere") that branch to contact points under the
 *    overhangs; organic branches curve smoothly
 *  - resin: thin pins with a cone tip at each contact point, spaced and sized by light / medium / heavy
 *
 * The wall thickness / strut radius is scaled so the drawn volume matches the estimate (envelope × support
 * density × the type's material factor, plus the interface), within limits that keep it looking like a print.
 * Coordinates are the Y-up preview mesh's. Pure (no three.js), so it can run in a worker or a test.
 */
import type { SupportColumns } from "./supportGeometry";

export type SupportStyle =
  | "columns"
  | "grid"
  | "lines"
  | "zigzag"
  | "snug"
  | "concentric"
  | "gyroid"
  | "tree"
  | "organic"
  | "resin";

export type ResinLevel = "light" | "medium" | "heavy";

const STYLE_BY_TYPE: Record<string, SupportStyle> = {
  normal: "grid",
  lines: "lines",
  zigzag: "zigzag",
  snug: "snug",
  concentric: "concentric",
  gyroid: "gyroid",
  tree: "tree",
  organic: "organic",
  resin_light: "resin",
  resin_medium: "resin",
  resin_heavy: "resin",
};

/** Drawing style for a support type key; without a type: Normal on FDM, medium pins on resin, plain columns else. */
export function supportStyleFor(type?: string | null, technology?: string | null): SupportStyle {
  const key = String(type ?? "").toLowerCase();
  if (key in STYLE_BY_TYPE) return STYLE_BY_TYPE[key];
  const tech = String(technology ?? "").toUpperCase();
  if (tech === "RESIN") return "resin";
  if (tech === "FDM") return "grid";
  return "columns";
}

export function resinLevelFor(type?: string | null): ResinLevel {
  const key = String(type ?? "").toLowerCase();
  return key === "resin_light" ? "light" : key === "resin_heavy" ? "heavy" : "medium";
}

/** Floats per box: centre x, bottom y, centre z, length (along yaw), height, width, yaw (three.js rotation.y). */
export const BOX_STRIDE = 7;
/** Floats per strut: x0, y0, z0, x1, y1, z1, radius at 0, radius at 1. */
export const ROD_STRIDE = 8;

export interface SupportStructure {
  style: SupportStyle;
  /** Walls and columns. */
  boxes: Float32Array;
  boxCount: number;
  /** Interface (roof) slabs under the overhangs. */
  roofs: Float32Array;
  roofCount: number;
  /** Struts: trunks, branches and pins. */
  rods: Float32Array;
  rodCount: number;
  /** Volume drawn, mm³. */
  volumeMm3: number;
  /** Volume the estimate implies (envelope × density × type factor + interface), mm³. */
  targetVolumeMm3: number;
}

export interface SupportStructureOptions {
  style: SupportStyle;
  /** Support density, % (default 12 on FDM, 4 for resin pins). */
  densityPct?: number | null;
  /** The type's material factor (Tree 0.55…); default 1. */
  volumeFactor?: number | null;
  /** Interface (roof) thickness, mm; 0 = none. */
  interfaceMm?: number | null;
  resinLevel?: ResinLevel;
  /** Plate height in mesh coordinates (the mesh's lowest y). */
  floorY: number;
  /** Level of detail: most walls / struts drawn. */
  maxElements?: number;
}

export const EMPTY_STRUCTURE: SupportStructure = {
  style: "columns",
  boxes: new Float32Array(0),
  boxCount: 0,
  roofs: new Float32Array(0),
  roofCount: 0,
  rods: new Float32Array(0),
  rodCount: 0,
  volumeMm3: 0,
  targetVolumeMm3: 0,
};

const LINE_WIDTH_MM = 0.45;
const DEFAULT_MAX_ELEMENTS = 9000;
const TREE_MAX_ANGLE_TAN = Math.tan((40 * Math.PI) / 180);
const ON_FLOOR_MM = 0.25;

interface Column {
  ix: number;
  iz: number;
  x: number;
  z: number;
  y0: number;
  y1: number;
}

interface Lattice {
  cell: number;
  columns: Column[];
  /** Columns per occupied cell. */
  byCell: Map<number, Column[]>;
}

const cellKey = (ix: number, iz: number) => ix * 1_000_003 + iz;

function lattice(s: SupportColumns): Lattice {
  const cell = s.cellMm;
  let x0 = Infinity;
  let z0 = Infinity;
  for (let i = 0; i < s.count; i += 1) {
    x0 = Math.min(x0, s.columns[i * 4]);
    z0 = Math.min(z0, s.columns[i * 4 + 1]);
  }
  const columns: Column[] = [];
  const byCell = new Map<number, Column[]>();
  for (let i = 0; i < s.count; i += 1) {
    const x = s.columns[i * 4];
    const z = s.columns[i * 4 + 1];
    const col: Column = {
      ix: Math.round((x - x0) / cell),
      iz: Math.round((z - z0) / cell),
      x,
      z,
      y0: s.columns[i * 4 + 2],
      y1: s.columns[i * 4 + 3],
    };
    columns.push(col);
    const key = cellKey(col.ix, col.iz);
    const list = byCell.get(key);
    if (list) list.push(col);
    else byCell.set(key, [col]);
  }
  return { cell, columns, byCell };
}

class FloatList {
  data: number[] = [];
  push(...v: number[]) {
    for (const n of v) this.data.push(n);
  }
  get length() {
    return this.data.length;
  }
  toArray() {
    return Float32Array.from(this.data);
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function frustumVolume(len: number, r0: number, r1: number) {
  return (Math.PI / 3) * len * (r0 * r0 + r0 * r1 + r1 * r1);
}

/** A wall element before its thickness is known. */
interface Wall {
  x: number;
  z: number;
  y0: number;
  y1: number;
  len: number;
  yaw: number;
}

const ALONG_X = 0;
const ALONG_Z = -Math.PI / 2;

function lineSpacing(style: SupportStyle, density: number): number {
  const single = LINE_WIDTH_MM / Math.max(density, 0.02);
  if (style === "grid" || style === "gyroid") return clamp(single * 2, 2, 16);
  return clamp(single, 1.2, 12);
}

/** Distance (in cells, 4-neighbour steps) from outside the supported area, per occupied cell. */
function insideDistance(lat: Lattice): Map<number, number> {
  const dist = new Map<number, number>();
  const queue: number[] = [];
  const cells = [...lat.byCell.keys()];
  const has = (ix: number, iz: number) => lat.byCell.has(cellKey(ix, iz));
  for (const key of cells) {
    const { ix, iz } = lat.byCell.get(key)![0];
    if (!has(ix + 1, iz) || !has(ix - 1, iz) || !has(ix, iz + 1) || !has(ix, iz - 1)) {
      dist.set(key, 1);
      queue.push(key);
    }
  }
  for (let q = 0; q < queue.length; q += 1) {
    const key = queue[q];
    const { ix, iz } = lat.byCell.get(key)![0];
    const d = dist.get(key)!;
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const n = cellKey(ix + dx, iz + dz);
      if (lat.byCell.has(n) && !dist.has(n)) {
        dist.set(n, d + 1);
        queue.push(n);
      }
    }
  }
  return dist;
}

/** Wall elements of a walled style at a stride of `k` cells. */
function wallsFor(style: SupportStyle, lat: Lattice, k: number, roofMm: number): Wall[] {
  const c = lat.cell;
  const walls: Wall[] = [];
  const add = (col: Column, x: number, z: number, len: number, yaw: number) => {
    const top = col.y1 - Math.min(roofMm, (col.y1 - col.y0) * 0.5);
    if (top - col.y0 > 0.05) walls.push({ x, z, y0: col.y0, y1: top, len, yaw });
  };
  const amp = Math.min(c * k * 0.35, 3);
  const period = Math.max(2 * c, 2 * k * c);
  const wave = (t: number) => amp * Math.sin((2 * Math.PI * t) / period);

  if (style === "concentric" || style === "snug") {
    const dist = insideDistance(lat);
    for (const [key, cols] of lat.byCell) {
      const d = dist.get(key) ?? 1;
      const { ix, iz } = cols[0];
      const ring = style === "concentric" ? (d - 1) % k === 0 : d === 1;
      if (ring) {
        for (const [dx, dz] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const n = cellKey(ix + dx, iz + dz);
          const nd = dist.get(n);
          if (nd !== undefined && nd >= d) continue;
          for (const col of cols) {
            if (dx) add(col, col.x + (dx * c) / 2, col.z, c, ALONG_Z);
            else add(col, col.x, col.z + (dz * c) / 2, c, ALONG_X);
          }
        }
      }
      if (style === "snug" && d > 1 && iz % k === 0) for (const col of cols) add(col, col.x, col.z, c, ALONG_X);
    }
    return walls;
  }

  for (const col of lat.columns) {
    const rowX = col.iz % k === 0;
    const rowZ = col.ix % k === 0;
    switch (style) {
      case "grid":
        if (rowX) add(col, col.x, col.z, c, ALONG_X);
        if (rowZ) add(col, col.x, col.z, c, ALONG_Z);
        break;
      case "lines":
        if (rowX) add(col, col.x, col.z, c, ALONG_X);
        break;
      case "zigzag":
        if (rowX) {
          const a = Math.min(amp, c * 0.9);
          const dz = col.ix % 2 === 0 ? 2 * a : -2 * a;
          add(col, col.x, col.z, Math.hypot(c, dz), Math.atan2(-dz, c));
        }
        break;
      case "gyroid":
        if (rowX) {
          const dz = wave(col.x + c / 2) - wave(col.x - c / 2);
          add(col, col.x, col.z + wave(col.x), Math.hypot(c, dz), Math.atan2(-dz, c));
        }
        if (rowZ) {
          const dx = wave(col.z + c / 2 + period / 4) - wave(col.z - c / 2 + period / 4);
          add(col, col.x + wave(col.z + period / 4), col.z, Math.hypot(c, dx), Math.atan2(-c, dx));
        }
        break;
      default:
        break;
    }
  }
  return walls;
}

/** Interface slabs: one per run of neighbouring cells along x with about the same top. */
function roofsFor(lat: Lattice, roofMm: number): { roofs: FloatList; volume: number } {
  const roofs = new FloatList();
  let volume = 0;
  if (roofMm <= 0) return { roofs, volume };
  const c = lat.cell;
  const sorted = [...lat.columns].sort((a, b) => a.iz - b.iz || a.ix - b.ix || a.y1 - b.y1);
  let run: Column[] = [];
  const flush = () => {
    if (!run.length) return;
    const first = run[0];
    const last = run[run.length - 1];
    const top = run.reduce((m, r) => m + r.y1, 0) / run.length;
    const h = Math.min(roofMm, Math.max(0.05, (top - first.y0) * 0.5));
    const len = last.x - first.x + c;
    roofs.push((first.x + last.x) / 2, top - h, first.z, len, h, c, 0);
    volume += len * h * c;
    run = [];
  };
  for (const col of sorted) {
    const prev = run[run.length - 1];
    if (prev && (col.iz !== prev.iz || col.ix !== prev.ix + 1 || Math.abs(col.y1 - prev.y1) > 0.3)) flush();
    run.push(col);
  }
  flush();
  return { roofs, volume };
}

function emitWalls(walls: Wall[], thickness: number): { boxes: FloatList; volume: number } {
  const boxes = new FloatList();
  let volume = 0;
  for (const w of walls) {
    const h = w.y1 - w.y0;
    boxes.push(w.x, w.y0, w.z, w.len, h, thickness, w.yaw);
    volume += w.len * h * thickness;
  }
  return { boxes, volume };
}

interface Tip {
  x: number;
  z: number;
  y0: number;
  y1: number;
}

/** Contact points at least `spacing` apart, every supported region getting at least one. */
function pickTips(lat: Lattice, spacing: number): Tip[] {
  const hash = new Map<number, Tip[]>();
  const tips: Tip[] = [];
  const hk = (x: number, z: number) => cellKey(Math.floor(x / spacing), Math.floor(z / spacing));
  const sorted = [...lat.columns].sort((a, b) => a.iz - b.iz || a.ix - b.ix);
  for (const col of sorted) {
    const gx = Math.floor(col.x / spacing);
    const gz = Math.floor(col.z / spacing);
    let near = false;
    for (let dx = -1; dx <= 1 && !near; dx += 1) {
      for (let dz = -1; dz <= 1 && !near; dz += 1) {
        for (const t of hash.get(cellKey(gx + dx, gz + dz)) ?? []) {
          if (Math.abs(t.y0 - col.y0) < 1 && Math.hypot(t.x - col.x, t.z - col.z) < spacing * 0.95) {
            near = true;
            break;
          }
        }
      }
    }
    if (near) continue;
    const tip = { x: col.x, z: col.z, y0: col.y0, y1: col.y1 };
    tips.push(tip);
    const key = hk(col.x, col.z);
    const list = hash.get(key);
    if (list) list.push(tip);
    else hash.set(key, [tip]);
  }
  return tips;
}

interface Strut {
  a: [number, number, number];
  b: [number, number, number];
  r0: number;
  r1: number;
}

function curve(a: [number, number, number], b: [number, number, number], r0: number, r1: number, steps: number): Strut[] {
  // Leaves `a` going up, reaches `b` from below: a smooth S like organic supports.
  const rise = b[1] - a[1];
  const p1: [number, number, number] = [a[0], a[1] + rise * 0.55, a[2]];
  const p2: [number, number, number] = [b[0], b[1] - rise * 0.35, b[2]];
  const at = (t: number): [number, number, number] => {
    const u = 1 - t;
    const w0 = u * u * u;
    const w1 = 3 * u * u * t;
    const w2 = 3 * u * t * t;
    const w3 = t * t * t;
    return [
      w0 * a[0] + w1 * p1[0] + w2 * p2[0] + w3 * b[0],
      w0 * a[1] + w1 * p1[1] + w2 * p2[1] + w3 * b[1],
      w0 * a[2] + w1 * p1[2] + w2 * p2[2] + w3 * b[2],
    ];
  };
  const out: Strut[] = [];
  let prev = a;
  for (let i = 1; i <= steps; i += 1) {
    const p = at(i / steps);
    out.push({ a: prev, b: p, r0: r0 + ((r1 - r0) * (i - 1)) / steps, r1: r0 + ((r1 - r0) * i) / steps });
    prev = p;
  }
  return out;
}

/** Trunks and branches: tips grouped per base height and area, one trunk per group on its most central tip. */
function treeStruts(tips: Tip[], organic: boolean, floorY: number): Strut[] {
  const struts: Strut[] = [];
  const tipR = organic ? 0.5 : 0.4;
  const spacing = organic ? 14 : 11;
  const groups = new Map<string, Tip[]>();
  for (const t of tips) {
    const key = `${Math.round(t.y0)}:${Math.floor(t.x / spacing)}:${Math.floor(t.z / spacing)}`;
    const list = groups.get(key);
    if (list) list.push(t);
    else groups.set(key, [t]);
  }
  const connect = (a: [number, number, number], b: [number, number, number], r0: number, r1: number) => {
    if (organic) struts.push(...curve(a, b, r0, r1, 4));
    else struts.push({ a, b, r0, r1 });
  };
  for (const group of groups.values()) {
    const cx = group.reduce((s, t) => s + t.x, 0) / group.length;
    const cz = group.reduce((s, t) => s + t.z, 0) / group.length;
    const trunk = group.reduce((best, t) => (Math.hypot(t.x - cx, t.z - cz) < Math.hypot(best.x - cx, best.z - cz) ? t : best));
    const base = trunk.y0;
    const reach = (t: Tip, x: number, z: number) => t.y1 - Math.hypot(t.x - x, t.z - z) / TREE_MAX_ANGLE_TAN;
    let mergeY = Math.min(...group.map((t) => reach(t, trunk.x, trunk.z)));
    mergeY = clamp(mergeY, base + Math.min(2, (trunk.y1 - base) * 0.3), trunk.y1 - 0.3);
    const trunkR = clamp(tipR * Math.sqrt(group.length) * 0.9, tipR, organic ? 4.5 : 3.5);
    const onFloor = base <= floorY + ON_FLOOR_MM;
    if (onFloor) {
      const foot = Math.min(0.8, (mergeY - base) * 0.2);
      struts.push({ a: [trunk.x, base, trunk.z], b: [trunk.x, base + foot, trunk.z], r0: trunkR * (organic ? 1.9 : 1.5), r1: trunkR });
      struts.push({ a: [trunk.x, base + foot, trunk.z], b: [trunk.x, mergeY, trunk.z], r0: trunkR, r1: trunkR * (organic ? 0.75 : 0.85) });
    } else {
      struts.push({ a: [trunk.x, base, trunk.z], b: [trunk.x, mergeY, trunk.z], r0: trunkR * 0.8, r1: trunkR * 0.8 });
    }
    const top: [number, number, number] = [trunk.x, mergeY, trunk.z];
    const others = group.filter((t) => t !== trunk || mergeY < t.y1 - 0.3);
    if (others.length > 4) {
      // Split into sides; each side gets its own branch that forks again to the contact points.
      const sides = new Map<number, Tip[]>();
      for (const t of others) {
        const side = Math.floor(((Math.atan2(t.z - trunk.z, t.x - trunk.x) + Math.PI) / (2 * Math.PI)) * 4) % 4;
        const list = sides.get(side);
        if (list) list.push(t);
        else sides.set(side, [t]);
      }
      for (const side of sides.values()) {
        const sx = trunk.x + (side.reduce((s, t) => s + t.x, 0) / side.length - trunk.x) * 0.5;
        const sz = trunk.z + (side.reduce((s, t) => s + t.z, 0) / side.length - trunk.z) * 0.5;
        const lowestTip = Math.min(...side.map((t) => t.y1));
        const nodeY = clamp(
          Math.min(...side.map((t) => reach(t, sx, sz))),
          mergeY + Math.hypot(sx - trunk.x, sz - trunk.z) * 0.6,
          lowestTip - 0.3,
        );
        if (nodeY <= mergeY + 0.2) {
          for (const t of side) connect(top, [t.x, t.y1, t.z], tipR * 1.4, tipR);
          continue;
        }
        const node: [number, number, number] = [sx, nodeY, sz];
        connect(top, node, Math.max(tipR, trunkR * 0.7), tipR * Math.sqrt(side.length) * 0.8);
        for (const t of side) connect(node, [t.x, t.y1, t.z], tipR * 1.3, tipR);
      }
    } else {
      for (const t of others) connect(top, [t.x, t.y1, t.z], tipR * 1.4, tipR);
    }
  }
  return struts;
}

const RESIN_PINS: Record<ResinLevel, { spacing: number; r: number }> = {
  light: { spacing: 4.5, r: 0.35 },
  medium: { spacing: 3.2, r: 0.5 },
  heavy: { spacing: 2.4, r: 0.7 },
};

function resinStruts(tips: Tip[], r: number, floorY: number): Strut[] {
  const struts: Strut[] = [];
  for (const t of tips) {
    const h = t.y1 - t.y0;
    if (h < 0.4) continue;
    const tipLen = Math.min(1.2, h * 0.3);
    const onFloor = t.y0 <= floorY + ON_FLOOR_MM;
    const foot = onFloor ? Math.min(0.8, h * 0.2) : 0;
    if (foot > 0) struts.push({ a: [t.x, t.y0, t.z], b: [t.x, t.y0 + foot, t.z], r0: r * 2.4, r1: r });
    else struts.push({ a: [t.x, t.y0, t.z], b: [t.x, t.y0 + Math.min(0.6, h * 0.15), t.z], r0: r * 0.3, r1: r });
    const shaft0 = t.y0 + (foot || Math.min(0.6, h * 0.15));
    const shaft1 = t.y1 - tipLen;
    if (shaft1 > shaft0) struts.push({ a: [t.x, shaft0, t.z], b: [t.x, shaft1, t.z], r0: r, r1: r });
    struts.push({ a: [t.x, Math.max(shaft0, shaft1), t.z], b: [t.x, t.y1, t.z], r0: r, r1: r * 0.3 });
  }
  return struts;
}

function emitStruts(struts: Strut[], scale: number): { rods: FloatList; volume: number } {
  const rods = new FloatList();
  let volume = 0;
  for (const s of struts) {
    const r0 = s.r0 * scale;
    const r1 = s.r1 * scale;
    rods.push(s.a[0], s.a[1], s.a[2], s.b[0], s.b[1], s.b[2], r0, r1);
    volume += frustumVolume(Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1], s.b[2] - s.a[2]), r0, r1);
  }
  return { rods, volume };
}

export function buildSupportStructure(supports: SupportColumns | null | undefined, options: SupportStructureOptions): SupportStructure {
  const style = options.style;
  if (!supports || !supports.count) return { ...EMPTY_STRUCTURE, style };
  const lat = lattice(supports);
  const c = lat.cell;
  const maxElements = Math.max(50, options.maxElements ?? DEFAULT_MAX_ELEMENTS);
  const density = clamp((options.densityPct ?? (style === "resin" ? 4 : 12)) / 100, 0.01, 1);
  const factor = clamp(Number(options.volumeFactor) || 1, 0.05, 3);
  const supportTarget = supports.volumeMm3 * density * factor;

  if (style === "columns") {
    const boxes = new FloatList();
    let volume = 0;
    const width = c * 0.6;
    for (const col of lat.columns) {
      const h = Math.max(0.05, col.y1 - col.y0);
      boxes.push(col.x, col.y0, col.z, width, h, width, 0);
      volume += width * width * h;
    }
    return { ...EMPTY_STRUCTURE, style, boxes: boxes.toArray(), boxCount: lat.columns.length, volumeMm3: volume, targetVolumeMm3: volume };
  }

  if (style === "tree" || style === "organic" || style === "resin") {
    const organic = style === "organic";
    const pin = RESIN_PINS[options.resinLevel ?? "medium"];
    let spacing = style === "resin" ? pin.spacing : organic ? 5 : 4;
    let struts: Strut[] = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const tips = pickTips(lat, Math.max(spacing, c));
      struts = style === "resin" ? resinStruts(tips, pin.r, options.floorY) : treeStruts(tips, organic, options.floorY);
      if (struts.length <= maxElements) break;
      spacing *= Math.sqrt(struts.length / maxElements) * 1.1;
    }
    const raw = emitStruts(struts, 1).volume;
    const scale = raw > 0 ? clamp(Math.sqrt(supportTarget / raw), style === "resin" ? 0.6 : 0.5, style === "resin" ? 1.8 : 2.5) : 1;
    const { rods, volume } = emitStruts(struts, scale);
    return {
      ...EMPTY_STRUCTURE,
      style,
      rods: rods.toArray(),
      rodCount: rods.length / ROD_STRIDE,
      volumeMm3: volume,
      targetVolumeMm3: supportTarget,
    };
  }

  const roofMm = Math.max(0, Number(options.interfaceMm) || 0);
  const { roofs, volume: roofVolume } = roofsFor(lat, roofMm);
  let k = Math.max(1, Math.round(lineSpacing(style, density) / c));
  let walls: Wall[] = [];
  for (let attempt = 0; attempt < 6; attempt += 1) {
    walls = wallsFor(style, lat, k, roofMm);
    if (walls.length <= maxElements) break;
    k = Math.ceil(k * (walls.length / maxElements) * 1.05);
  }
  const area = walls.reduce((s, w) => s + w.len * (w.y1 - w.y0), 0);
  const thickness = area > 0 ? clamp(supportTarget / area, 0.25, Math.max(0.3, Math.min(2.5, c * k * 0.6))) : LINE_WIDTH_MM;
  const { boxes, volume } = emitWalls(walls, thickness);
  return {
    style,
    boxes: boxes.toArray(),
    boxCount: boxes.length / BOX_STRIDE,
    roofs: roofs.toArray(),
    roofCount: roofs.length / BOX_STRIDE,
    rods: new Float32Array(0),
    rodCount: 0,
    volumeMm3: volume + roofVolume,
    targetVolumeMm3: supportTarget + roofVolume,
  };
}

// --------------------------------------------------------------------------------------------- bed adhesion

export type AdhesionKind = "none" | "brim" | "raft";

export interface AdhesionStructure {
  kind: AdhesionKind;
  /** Flat slabs (box layout, yaw 0) in mesh coordinates. */
  boxes: Float32Array;
  boxCount: number;
  /** The model and its supports sit this much higher (on the raft). */
  liftMm: number;
  areaMm2: number;
}

export interface AdhesionOptions {
  kind: AdhesionKind;
  brimWidthMm?: number | null;
  raftMarginMm?: number | null;
  raftMm?: number | null;
  /** Raft also runs under supports standing on the plate. */
  supports?: SupportColumns | null;
}

export const NO_ADHESION: AdhesionStructure = { kind: "none", boxes: new Float32Array(0), boxCount: 0, liftMm: 0, areaMm2: 0 };

const BRIM_HEIGHT_MM = 0.3;

/** Brim (flat loops round the first layer) or raft (thick lattice under the part and plate supports). */
export function buildAdhesion(positions: Float32Array, options: AdhesionOptions): AdhesionStructure {
  const kind = options.kind;
  const tris = Math.floor(positions.length / 9);
  if (kind === "none" || !tris) return NO_ADHESION;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    minX = Math.min(minX, positions[i]);
    maxX = Math.max(maxX, positions[i]);
    minY = Math.min(minY, positions[i + 1]);
    minZ = Math.min(minZ, positions[i + 2]);
    maxZ = Math.max(maxZ, positions[i + 2]);
  }
  const width = kind === "brim" ? Math.max(0, Number(options.brimWidthMm ?? 5)) : Math.max(0, Number(options.raftMarginMm ?? 3));
  const cell = clamp(Math.max(maxX - minX, maxZ - minZ) / 150, 0.4, 2);
  const pad = Math.ceil(width / cell) + 2;
  const ox = minX - pad * cell;
  const oz = minZ - pad * cell;
  const nx = Math.ceil((maxX - minX) / cell) + 2 * pad + 1;
  const nz = Math.ceil((maxZ - minZ) / cell) + 2 * pad + 1;
  const mask = new Uint8Array(nx * nz);
  const mark = (x: number, z: number) => {
    const ix = Math.floor((x - ox) / cell);
    const iz = Math.floor((z - oz) / cell);
    if (ix >= 0 && iz >= 0 && ix < nx && iz < nz) mask[ix * nz + iz] = 1;
  };
  // First layer: triangles lying on the plate, rasterised at cell centres.
  for (let t = 0; t < tris; t += 1) {
    const i = t * 9;
    if (Math.max(positions[i + 1], positions[i + 4], positions[i + 7]) > minY + ON_FLOOR_MM) continue;
    const xs = [positions[i], positions[i + 3], positions[i + 6]];
    const zs = [positions[i + 2], positions[i + 5], positions[i + 8]];
    const det = (zs[1] - zs[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (zs[0] - zs[2]);
    mark((xs[0] + xs[1] + xs[2]) / 3, (zs[0] + zs[1] + zs[2]) / 3);
    if (Math.abs(det) < 1e-12) continue;
    const ix0 = Math.max(0, Math.floor((Math.min(...xs) - ox) / cell));
    const ix1 = Math.min(nx - 1, Math.floor((Math.max(...xs) - ox) / cell));
    const iz0 = Math.max(0, Math.floor((Math.min(...zs) - oz) / cell));
    const iz1 = Math.min(nz - 1, Math.floor((Math.max(...zs) - oz) / cell));
    for (let ix = ix0; ix <= ix1; ix += 1) {
      const cx = ox + (ix + 0.5) * cell;
      for (let iz = iz0; iz <= iz1; iz += 1) {
        const cz = oz + (iz + 0.5) * cell;
        const a = ((zs[1] - zs[2]) * (cx - xs[2]) + (xs[2] - xs[1]) * (cz - zs[2])) / det;
        const b = ((zs[2] - zs[0]) * (cx - xs[2]) + (xs[0] - xs[2]) * (cz - zs[2])) / det;
        if (a >= -1e-6 && b >= -1e-6 && 1 - a - b >= -1e-6) mask[ix * nz + iz] = 1;
      }
    }
  }
  const s = options.supports;
  if (kind === "raft" && s) {
    const half = s.cellMm / 2;
    for (let i = 0; i < s.count; i += 1) {
      if (s.columns[i * 4 + 2] > minY + ON_FLOOR_MM) continue;
      const x = s.columns[i * 4];
      const z = s.columns[i * 4 + 1];
      for (let x1 = x - half; x1 <= x + half + 1e-9; x1 += cell) for (let z1 = z - half; z1 <= z + half + 1e-9; z1 += cell) mark(x1, z1);
    }
  }
  // Distance (cells) from the footprint, 8-neighbour steps.
  const steps = Math.ceil(width / cell);
  const dist = new Int16Array(nx * nz).fill(-1);
  let queue: number[] = [];
  for (let k = 0; k < mask.length; k += 1) {
    if (mask[k]) {
      dist[k] = 0;
      queue.push(k);
    }
  }
  if (!queue.length) return NO_ADHESION;
  for (let d = 0; d < steps; d += 1) {
    const next: number[] = [];
    for (const k of queue) {
      const ix = Math.floor(k / nz);
      const iz = k - ix * nz;
      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dz = -1; dz <= 1; dz += 1) {
          const jx = ix + dx;
          const jz = iz + dz;
          if (jx < 0 || jz < 0 || jx >= nx || jz >= nz) continue;
          const j = jx * nz + jz;
          if (dist[j] >= 0) continue;
          dist[j] = d + 1;
          next.push(j);
        }
      }
    }
    queue = next;
  }
  const inside = (k: number) => (kind === "brim" ? dist[k] > 0 : dist[k] >= 0);
  const raftMm = Math.max(0.2, Number(options.raftMm ?? 0.9));
  const y0 = kind === "brim" ? minY : minY - raftMm;
  const h = kind === "brim" ? BRIM_HEIGHT_MM : raftMm;
  const boxes = new FloatList();
  let area = 0;
  for (let iz = 0; iz < nz; iz += 1) {
    let start = -1;
    for (let ix = 0; ix <= nx; ix += 1) {
      const on = ix < nx && inside(ix * nz + iz);
      if (on && start < 0) start = ix;
      if (!on && start >= 0) {
        const len = (ix - start) * cell;
        boxes.push(ox + start * cell + len / 2, y0, oz + (iz + 0.5) * cell, len, h, cell, 0);
        area += len * cell;
        start = -1;
      }
    }
  }
  return { kind, boxes: boxes.toArray(), boxCount: boxes.length / BOX_STRIDE, liftMm: kind === "raft" ? raftMm : 0, areaMm2: area };
}

/**
 * Minimal ASCII DXF reader for the laser-cut booking preview.
 *
 * Mirrors the backend rules (laser_cut_service.py): cut geometry is LINE, LWPOLYLINE, POLYLINE,
 * CIRCLE, ARC, ELLIPSE and SPLINE in model space, with INSERT block references expanded. Units come
 * from $INSUNITS. The backend measurement is authoritative for size and cost; this is only for drawing.
 */

export type DxfUnitKey = "mm" | "cm" | "m" | "in" | "ft";
export type DxfDetectedUnit = DxfUnitKey | "unitless";

export const DXF_UNIT_TO_MM: Record<DxfUnitKey, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
  in: 25.4,
  ft: 304.8,
};

export const DXF_UNIT_LABELS: Record<DxfUnitKey, string> = {
  mm: "Millimetres",
  cm: "Centimetres",
  m: "Metres",
  in: "Inches",
  ft: "Feet",
};

const INSUNITS_TO_UNIT: Record<number, DxfUnitKey> = { 1: "in", 2: "ft", 4: "mm", 5: "cm", 6: "m" };

export type Point2 = [number, number];

export interface DxfPath {
  points: Point2[];
  closed: boolean;
}

export interface DxfBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface DxfGeometry {
  paths: DxfPath[];
  bounds: DxfBounds | null;
  detectedUnits: DxfDetectedUnit;
  entityCount: number;
  warnings: string[];
}

const MAX_BLOCK_DEPTH = 8;
const MAX_ENTITIES = 50_000;
const ARC_SEGMENTS_PER_TURN = 64;

interface Group {
  code: number;
  value: string;
}

interface RawEntity {
  type: string;
  groups: Group[];
  /** POLYLINE vertices (each VERTEX's groups). */
  vertices?: Group[][];
}

interface BlockDef {
  baseX: number;
  baseY: number;
  entities: RawEntity[];
}

function tokenize(text: string): Group[] {
  const lines = text.split(/\r\n|\r|\n/);
  const out: Group[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = Number.parseInt(lines[i].trim(), 10);
    if (Number.isNaN(code)) {
      i -= 1;
      continue;
    }
    out.push({ code, value: lines[i + 1].trim() });
  }
  return out;
}

function num(groups: Group[], code: number, fallback = 0): number {
  const g = groups.find((x) => x.code === code);
  if (!g) return fallback;
  const v = Number.parseFloat(g.value);
  return Number.isFinite(v) ? v : fallback;
}

function str(groups: Group[], code: number): string {
  return groups.find((x) => x.code === code)?.value ?? "";
}

/** Split a flat group list (entities between 0-codes) into raw entities, folding POLYLINE vertices. */
function collectEntities(groups: Group[], start: number, stopValues: string[]): { entities: RawEntity[]; end: number } {
  const entities: RawEntity[] = [];
  let i = start;
  let polyline: RawEntity | null = null;
  while (i < groups.length) {
    const g = groups[i];
    if (g.code !== 0) {
      i += 1;
      continue;
    }
    if (stopValues.includes(g.value)) break;
    const type = g.value;
    const body: Group[] = [];
    i += 1;
    while (i < groups.length && groups[i].code !== 0) {
      body.push(groups[i]);
      i += 1;
    }
    if (type === "VERTEX" && polyline) {
      polyline.vertices!.push(body);
      continue;
    }
    if (type === "SEQEND") {
      polyline = null;
      continue;
    }
    const entity: RawEntity = { type, groups: body };
    if (type === "POLYLINE") {
      entity.vertices = [];
      polyline = entity;
    } else {
      polyline = null;
    }
    entities.push(entity);
  }
  return { entities, end: i };
}

function readHeaderUnits(groups: Group[]): DxfDetectedUnit {
  for (let i = 0; i < groups.length - 1; i += 1) {
    if (groups[i].code === 9 && groups[i].value === "$INSUNITS") {
      for (let j = i + 1; j < groups.length && groups[j].code !== 9 && groups[j].code !== 0; j += 1) {
        if (groups[j].code === 70) {
          const code = Number.parseInt(groups[j].value, 10);
          return INSUNITS_TO_UNIT[code] ?? "unitless";
        }
      }
      return "unitless";
    }
  }
  return "unitless";
}

function readSections(groups: Group[]) {
  const blocks = new Map<string, BlockDef>();
  let modelEntities: RawEntity[] = [];
  let units: DxfDetectedUnit = "unitless";
  let i = 0;
  while (i < groups.length) {
    const g = groups[i];
    if (g.code === 0 && g.value === "SECTION") {
      const name = groups[i + 1]?.code === 2 ? groups[i + 1].value : "";
      let end = i + 2;
      while (end < groups.length && !(groups[end].code === 0 && groups[end].value === "ENDSEC")) end += 1;
      const section = groups.slice(i + 2, end);
      if (name === "HEADER") {
        units = readHeaderUnits(section);
      } else if (name === "ENTITIES") {
        modelEntities = collectEntities(section, 0, []).entities;
      } else if (name === "BLOCKS") {
        let k = 0;
        while (k < section.length) {
          if (section[k].code === 0 && section[k].value === "BLOCK") {
            const header: Group[] = [];
            k += 1;
            while (k < section.length && section[k].code !== 0) {
              header.push(section[k]);
              k += 1;
            }
            const { entities, end: blockEnd } = collectEntities(section, k, ["ENDBLK"]);
            const blockName = str(header, 2);
            if (blockName) {
              blocks.set(blockName, { baseX: num(header, 10), baseY: num(header, 20), entities });
            }
            k = blockEnd + 1;
          } else {
            k += 1;
          }
        }
      }
      i = end + 1;
    } else {
      i += 1;
    }
  }
  return { blocks, modelEntities, units };
}

type Transform = (p: Point2) => Point2;

const identity: Transform = (p) => p;

function segmentsFor(sweepRad: number): number {
  return Math.max(8, Math.ceil((Math.abs(sweepRad) / (2 * Math.PI)) * ARC_SEGMENTS_PER_TURN));
}

function arcPoints(cx: number, cy: number, r: number, startRad: number, endRad: number): Point2[] {
  let sweep = endRad - startRad;
  while (sweep <= 0) sweep += 2 * Math.PI;
  const n = segmentsFor(sweep);
  const pts: Point2[] = [];
  for (let s = 0; s <= n; s += 1) {
    const a = startRad + (sweep * s) / n;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

/** Points along a polyline segment with a DXF bulge (tan of a quarter of the included angle). */
function bulgeSegment(a: Point2, b: Point2, bulge: number): Point2[] {
  if (!bulge) return [b];
  const theta = 4 * Math.atan(bulge);
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const chord = Math.hypot(dx, dy);
  if (chord === 0) return [b];
  const r = chord / (2 * Math.sin(theta / 2));
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const h = r * Math.cos(theta / 2);
  const cx = mx - (h * dy) / chord;
  const cy = my + (h * dx) / chord;
  const start = Math.atan2(a[1] - cy, a[0] - cx);
  const n = segmentsFor(theta);
  const pts: Point2[] = [];
  for (let s = 1; s <= n; s += 1) {
    const ang = start + (theta * s) / n;
    pts.push([cx + Math.abs(r) * Math.cos(ang), cy + Math.abs(r) * Math.sin(ang)]);
  }
  pts[pts.length - 1] = b;
  return pts;
}

function polylineWithBulges(vertices: Array<{ p: Point2; bulge: number }>, closed: boolean): Point2[] {
  if (!vertices.length) return [];
  const out: Point2[] = [vertices[0].p];
  const count = closed ? vertices.length : vertices.length - 1;
  for (let i = 0; i < count; i += 1) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    out.push(...bulgeSegment(a.p, b.p, a.bulge));
  }
  if (closed && out.length > 1) out.pop();
  return out;
}

/** Arbitrary Axis Algorithm reduced to 2D: an extrusion of (0,0,-1) mirrors X. */
function ocsMirror(groups: Group[]): boolean {
  return num(groups, 230, 1) < 0;
}

function lwpolylineVertices(groups: Group[]): Array<{ p: Point2; bulge: number }> {
  const verts: Array<{ p: Point2; bulge: number }> = [];
  let current: { x?: number; y?: number; bulge: number } | null = null;
  const flush = () => {
    if (current && current.x !== undefined && current.y !== undefined) {
      verts.push({ p: [current.x, current.y], bulge: current.bulge });
    }
  };
  for (const g of groups) {
    if (g.code === 10) {
      flush();
      current = { x: Number.parseFloat(g.value), bulge: 0 };
    } else if (g.code === 20 && current) {
      current.y = Number.parseFloat(g.value);
    } else if (g.code === 42 && current) {
      current.bulge = Number.parseFloat(g.value) || 0;
    }
  }
  flush();
  return verts;
}

function splinePoints(groups: Group[]): Point2[] {
  const fit: Point2[] = [];
  const ctrl: Point2[] = [];
  let pendingFitX: number | null = null;
  let pendingCtrlX: number | null = null;
  for (const g of groups) {
    const v = Number.parseFloat(g.value);
    if (g.code === 11) pendingFitX = v;
    else if (g.code === 21 && pendingFitX !== null) {
      fit.push([pendingFitX, v]);
      pendingFitX = null;
    } else if (g.code === 10) pendingCtrlX = v;
    else if (g.code === 20 && pendingCtrlX !== null) {
      ctrl.push([pendingCtrlX, v]);
      pendingCtrlX = null;
    }
  }
  return fit.length >= 2 ? fit : ctrl;
}

function entityToPaths(entity: RawEntity): DxfPath[] {
  const g = entity.groups;
  const mirror = ocsMirror(g);
  const ocs = (p: Point2): Point2 => (mirror ? [-p[0], p[1]] : p);
  switch (entity.type) {
    case "LINE":
      return [{ points: [[num(g, 10), num(g, 20)], [num(g, 11), num(g, 21)]], closed: false }];
    case "LWPOLYLINE": {
      const closed = (num(g, 70) & 1) === 1;
      const pts = polylineWithBulges(lwpolylineVertices(g), closed).map(ocs);
      return pts.length >= 2 ? [{ points: pts, closed }] : [];
    }
    case "POLYLINE": {
      const flags = num(g, 70);
      if (flags & (16 | 64)) return [];
      const closed = (flags & 1) === 1;
      const verts = (entity.vertices || []).map((vg) => ({ p: [num(vg, 10), num(vg, 20)] as Point2, bulge: num(vg, 42) }));
      const pts = polylineWithBulges(verts, closed).map(ocs);
      return pts.length >= 2 ? [{ points: pts, closed }] : [];
    }
    case "CIRCLE": {
      const r = num(g, 40);
      if (r <= 0) return [];
      const pts = arcPoints(num(g, 10), num(g, 20), r, 0, 2 * Math.PI);
      pts.pop();
      return [{ points: pts.map(ocs), closed: true }];
    }
    case "ARC": {
      const r = num(g, 40);
      if (r <= 0) return [];
      const start = (num(g, 50) * Math.PI) / 180;
      const end = (num(g, 51) * Math.PI) / 180;
      return [{ points: arcPoints(num(g, 10), num(g, 20), r, start, end).map(ocs), closed: false }];
    }
    case "ELLIPSE": {
      const cx = num(g, 10);
      const cy = num(g, 20);
      const mx = num(g, 11);
      const my = num(g, 21);
      const ratio = num(g, 40, 1);
      const t0 = num(g, 41, 0);
      let t1 = num(g, 42, 2 * Math.PI);
      const major = Math.hypot(mx, my);
      if (major === 0) return [];
      const rot = Math.atan2(my, mx);
      while (t1 <= t0) t1 += 2 * Math.PI;
      const full = Math.abs(t1 - t0 - 2 * Math.PI) < 1e-6;
      const n = segmentsFor(t1 - t0);
      const pts: Point2[] = [];
      for (let s = 0; s <= n; s += 1) {
        const t = t0 + ((t1 - t0) * s) / n;
        const ex = major * Math.cos(t);
        const ey = major * ratio * Math.sin(t);
        pts.push([cx + ex * Math.cos(rot) - ey * Math.sin(rot), cy + ex * Math.sin(rot) + ey * Math.cos(rot)]);
      }
      if (full) pts.pop();
      return [{ points: pts.map(ocs), closed: full }];
    }
    case "SPLINE": {
      const pts = splinePoints(g);
      const closed = (num(g, 70) & 1) === 1;
      return pts.length >= 2 ? [{ points: pts, closed }] : [];
    }
    default:
      return [];
  }
}

function insertTransform(entity: RawEntity, block: BlockDef, colIdx: number, rowIdx: number): Transform {
  const g = entity.groups;
  const mirror = ocsMirror(g);
  const ix = num(g, 10);
  const iy = num(g, 20);
  const sx = num(g, 41, 1) || 1;
  const sy = num(g, 42, 1) || 1;
  const rot = (num(g, 50) * Math.PI) / 180;
  const colSpacing = num(g, 44);
  const rowSpacing = num(g, 45);
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const offX = colIdx * colSpacing;
  const offY = rowIdx * rowSpacing;
  return ([x, y]) => {
    const lx = (x - block.baseX) * sx + offX;
    const ly = (y - block.baseY) * sy + offY;
    const wx = ix + lx * cos - ly * sin;
    const wy = iy + lx * sin + ly * cos;
    return mirror ? [-wx, wy] : [wx, wy];
  };
}

/** Parse DXF text into flattened 2D cut paths in drawing units. */
export function parseDxfGeometry(text: string): DxfGeometry {
  const groups = tokenize(text);
  if (!groups.length || !groups.some((g) => g.code === 0 && g.value === "SECTION")) {
    throw new Error("This file is not an ASCII DXF drawing that the preview can read.");
  }
  const { blocks, modelEntities, units } = readSections(groups);
  const warnings: string[] = [];
  const paths: DxfPath[] = [];
  let entityCount = 0;
  let truncated = false;

  const walk = (entities: RawEntity[], transform: Transform, depth: number) => {
    for (const entity of entities) {
      if (truncated) return;
      if (entity.type === "INSERT") {
        const block = blocks.get(str(entity.groups, 2));
        if (!block) continue;
        if (depth >= MAX_BLOCK_DEPTH) {
          if (!warnings.includes("Deeply nested blocks were skipped.")) warnings.push("Deeply nested blocks were skipped.");
          continue;
        }
        const cols = Math.max(1, Math.min(100, num(entity.groups, 70, 1)));
        const rows = Math.max(1, Math.min(100, num(entity.groups, 71, 1)));
        for (let r = 0; r < rows; r += 1) {
          for (let c = 0; c < cols; c += 1) {
            const local = insertTransform(entity, block, c, r);
            walk(block.entities, (p) => transform(local(p)), depth + 1);
          }
        }
        continue;
      }
      if (num(entity.groups, 60) === 1) continue;
      const entityPaths = entityToPaths(entity);
      if (!entityPaths.length) continue;
      entityCount += 1;
      if (entityCount > MAX_ENTITIES) {
        truncated = true;
        warnings.push("The drawing is very large; only part of it is shown in the preview.");
        return;
      }
      for (const path of entityPaths) {
        paths.push({ closed: path.closed, points: transform === identity ? path.points : path.points.map(transform) });
      }
    }
  };
  walk(modelEntities, identity, 0);

  let bounds: DxfBounds | null = null;
  for (const path of paths) {
    for (const [x, y] of path.points) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (!bounds) bounds = { minX: x, minY: y, maxX: x, maxY: y };
      else {
        if (x < bounds.minX) bounds.minX = x;
        if (y < bounds.minY) bounds.minY = y;
        if (x > bounds.maxX) bounds.maxX = x;
        if (y > bounds.maxY) bounds.maxY = y;
      }
    }
  }
  return { paths, bounds, detectedUnits: units, entityCount, warnings };
}

export function unitToMm(unit: string | null | undefined): number {
  return DXF_UNIT_TO_MM[(unit || "mm") as DxfUnitKey] ?? 1;
}

/** Shoelace area (positive = counter-clockwise). */
export function signedArea(points: Point2[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

export function pointInPolygon([x, y]: Point2, poly: Point2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const CLOSE_TOLERANCE_RATIO = 1e-6;

/**
 * Closed loops for extrusion: explicit closed paths plus open paths whose ends meet.
 * Returns outlines with the holes directly inside them (even nesting depth = solid, odd = hole).
 */
export function buildRegions(geometry: DxfGeometry, maxLoops = 2000): Array<{ outer: Point2[]; holes: Point2[][] }> {
  if (!geometry.bounds) return [];
  const span = Math.max(geometry.bounds.maxX - geometry.bounds.minX, geometry.bounds.maxY - geometry.bounds.minY, 1);
  const tol = span * CLOSE_TOLERANCE_RATIO + 1e-9;
  const loops: Point2[][] = [];
  for (const path of geometry.paths) {
    if (path.points.length < 3) continue;
    const first = path.points[0];
    const last = path.points[path.points.length - 1];
    const endsMeet = Math.hypot(first[0] - last[0], first[1] - last[1]) <= tol;
    if (path.closed || endsMeet) {
      const pts = endsMeet && !path.closed ? path.points.slice(0, -1) : path.points;
      if (pts.length >= 3 && Math.abs(signedArea(pts)) > tol * tol) loops.push(pts);
    }
    if (loops.length > maxLoops) return [];
  }
  const areas = loops.map((l) => Math.abs(signedArea(l)));
  const order = loops.map((_, i) => i).sort((a, b) => areas[b] - areas[a]);
  const parent = new Array<number>(loops.length).fill(-1);
  const depth = new Array<number>(loops.length).fill(0);
  for (let oi = 0; oi < order.length; oi += 1) {
    const i = order[oi];
    for (let oj = oi - 1; oj >= 0; oj -= 1) {
      const j = order[oj];
      if (areas[j] > areas[i] && pointInPolygon(loops[i][0], loops[j])) {
        parent[i] = j;
        depth[i] = depth[j] + 1;
        break;
      }
    }
  }
  const regions = new Map<number, { outer: Point2[]; holes: Point2[][] }>();
  for (const i of order) {
    if (depth[i] % 2 === 0) regions.set(i, { outer: loops[i], holes: [] });
  }
  for (const i of order) {
    if (depth[i] % 2 === 1 && regions.has(parent[i])) regions.get(parent[i])!.holes.push(loops[i]);
  }
  return Array.from(regions.values());
}

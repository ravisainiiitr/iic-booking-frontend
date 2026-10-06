/**
 * STL -> render-ready triangle data for the 3D print preview, without three.js so it can run in a
 * Web Worker: parse (binary or ASCII), convert Z-up (slicer convention) to Y-up, simplify very large
 * meshes by vertex clustering, and compute creased normals (smooth on curves, sharp on edges).
 */

export interface StlMeshData {
  /** Non-indexed triangles, 9 floats each, millimetres, Y up. */
  positions: Float32Array;
  normals: Float32Array;
  triangleCount: number;
  sourceTriangleCount: number;
  simplified: boolean;
  min: [number, number, number];
  max: [number, number, number];
}

export interface StlMeshOptions {
  /** Simplify above this many triangles. */
  maxTriangles?: number;
  /** Faces meeting at a sharper angle keep a hard edge. */
  creaseAngleDeg?: number;
}

export type StlMeshPhase = "parse" | "simplify" | "normals";
export type StlMeshProgress = (phase: StlMeshPhase, fraction: number) => void;

export const DEFAULT_MAX_TRIANGLES = 400_000;
const WELD_RESOLUTION = 131_072;

function progressTicker(onProgress: StlMeshProgress | undefined, phase: StlMeshPhase, total: number) {
  if (!onProgress || total <= 0) return () => {};
  const step = Math.max(1, Math.floor(total / 50));
  let next = step;
  return (i: number) => {
    if (i >= next) {
      next = i + step;
      onProgress(phase, Math.min(1, i / total));
    }
  };
}

export function isBinaryStl(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 84) return false;
  const count = new DataView(buffer).getUint32(80, true);
  if (84 + count * 50 === buffer.byteLength) return true;
  const head = new TextDecoder().decode(new Uint8Array(buffer, 0, Math.min(1024, buffer.byteLength)));
  if (!/^\s*solid/i.test(head)) return true;
  return !/facet\s+normal|vertex\s/i.test(head);
}

/** Raw triangle soup, Z up as stored in the file. */
export function parseStlPositions(buffer: ArrayBuffer, onProgress?: StlMeshProgress): Float32Array {
  if (isBinaryStl(buffer)) {
    const view = new DataView(buffer);
    const declared = view.getUint32(80, true);
    const count = Math.min(declared, Math.floor((buffer.byteLength - 84) / 50));
    const out = new Float32Array(count * 9);
    const tick = progressTicker(onProgress, "parse", count);
    let o = 0;
    for (let t = 0; t < count; t += 1) {
      const base = 84 + t * 50 + 12;
      for (let k = 0; k < 9; k += 1) out[o + k] = view.getFloat32(base + k * 4, true);
      o += 9;
      tick(t);
    }
    return out;
  }
  const text = new TextDecoder().decode(new Uint8Array(buffer));
  const re = /vertex\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)/g;
  let values = new Float32Array(Math.max(9, Math.floor(text.length / 40)));
  let n = 0;
  const tick = progressTicker(onProgress, "parse", text.length);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (n + 3 > values.length) {
      const grown = new Float32Array(values.length * 2);
      grown.set(values);
      values = grown;
    }
    values[n] = Number.parseFloat(m[1]);
    values[n + 1] = Number.parseFloat(m[2]);
    values[n + 2] = Number.parseFloat(m[3]);
    n += 3;
    tick(re.lastIndex);
  }
  const usable = n - (n % 9);
  return values.slice(0, usable);
}

/** Drop NaN / zero-area triangles and turn Z-up into Y-up: (x, y, z) -> (x, z, -y). */
function cleanAndOrient(raw: Float32Array): Float32Array {
  const triCount = raw.length / 9;
  const out = new Float32Array(raw.length);
  let o = 0;
  for (let t = 0; t < triCount; t += 1) {
    const i = t * 9;
    let ok = true;
    for (let k = 0; k < 9; k += 1) {
      if (!Number.isFinite(raw[i + k])) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    const ax = raw[i + 3] - raw[i];
    const ay = raw[i + 4] - raw[i + 1];
    const az = raw[i + 5] - raw[i + 2];
    const bx = raw[i + 6] - raw[i];
    const by = raw[i + 7] - raw[i + 1];
    const bz = raw[i + 8] - raw[i + 2];
    const cx = ay * bz - az * by;
    const cy = az * bx - ax * bz;
    const cz = ax * by - ay * bx;
    if (cx * cx + cy * cy + cz * cz === 0) continue;
    for (let v = 0; v < 3; v += 1) {
      out[o] = raw[i + v * 3];
      out[o + 1] = raw[i + v * 3 + 2];
      out[o + 2] = -raw[i + v * 3 + 1];
      o += 3;
    }
  }
  return o === out.length ? out : out.slice(0, o);
}

function bounds(pos: Float32Array): { min: [number, number, number]; max: [number, number, number] } {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) {
    for (let k = 0; k < 3; k += 1) {
      const v = pos[i + k];
      if (v < min[k]) min[k] = v;
      if (v > max[k]) max[k] = v;
    }
  }
  if (!pos.length) return { min: [0, 0, 0], max: [0, 0, 0] };
  return { min, max };
}

interface Welded {
  /** 3 vertex ids per triangle. */
  index: Uint32Array;
  /** Vertex positions (cluster centroids). */
  verts: Float32Array;
  vertexCount: number;
}

/**
 * Merge vertices that fall in the same cell of a `resolution`^3 grid over the bounding box. With a fine
 * grid this only welds duplicate corners; with a coarse grid it simplifies (triangles whose corners
 * collapse into one cell disappear).
 */
function weld(pos: Float32Array, resolution: number, dropCollapsed: boolean, onTick?: (i: number) => void): Welded {
  const { min, max } = bounds(pos);
  const extent = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2], 1e-9);
  const cell = extent / resolution;
  const r = resolution + 1;
  const ids = new Map<number, number>();
  const triCount = pos.length / 9;
  const sums: number[] = [];
  const counts: number[] = [];
  const index = new Uint32Array(triCount * 3);
  let kept = 0;
  const corner = [0, 0, 0];
  for (let t = 0; t < triCount; t += 1) {
    for (let v = 0; v < 3; v += 1) {
      const i = t * 9 + v * 3;
      const x = pos[i];
      const y = pos[i + 1];
      const z = pos[i + 2];
      const key =
        Math.floor((x - min[0]) / cell) + Math.floor((y - min[1]) / cell) * r + Math.floor((z - min[2]) / cell) * r * r;
      let id = ids.get(key);
      if (id === undefined) {
        id = counts.length;
        ids.set(key, id);
        sums.push(x, y, z);
        counts.push(1);
      } else if (dropCollapsed) {
        sums[id * 3] += x;
        sums[id * 3 + 1] += y;
        sums[id * 3 + 2] += z;
        counts[id] += 1;
      }
      corner[v] = id;
    }
    onTick?.(t);
    if (dropCollapsed && (corner[0] === corner[1] || corner[1] === corner[2] || corner[0] === corner[2])) continue;
    index[kept * 3] = corner[0];
    index[kept * 3 + 1] = corner[1];
    index[kept * 3 + 2] = corner[2];
    kept += 1;
  }
  const verts = new Float32Array(counts.length * 3);
  for (let id = 0; id < counts.length; id += 1) {
    const c = counts[id];
    verts[id * 3] = sums[id * 3] / c;
    verts[id * 3 + 1] = sums[id * 3 + 1] / c;
    verts[id * 3 + 2] = sums[id * 3 + 2] / c;
  }
  return { index: kept === triCount ? index : index.slice(0, kept * 3), verts, vertexCount: counts.length };
}

function expand(w: Welded): Float32Array {
  const out = new Float32Array(w.index.length * 3);
  for (let c = 0; c < w.index.length; c += 1) {
    const id = w.index[c];
    out[c * 3] = w.verts[id * 3];
    out[c * 3 + 1] = w.verts[id * 3 + 1];
    out[c * 3 + 2] = w.verts[id * 3 + 2];
  }
  return out;
}

/** Vertex clustering until the mesh has at most `target` triangles. */
export function simplifyPositions(pos: Float32Array, target: number, onProgress?: StlMeshProgress): Float32Array {
  const triCount = pos.length / 9;
  if (triCount <= target) return pos;
  let resolution = Math.max(16, Math.min(4096, Math.round(Math.sqrt(target) * 1.4)));
  let best: Float32Array | null = null;
  for (let pass = 0; pass < 5; pass += 1) {
    const tick = progressTicker(
      onProgress ? (ph, f) => onProgress(ph, Math.min(0.99, (pass + f) / 3)) : undefined,
      "simplify",
      triCount,
    );
    const w = weld(pos, resolution, true, tick);
    const count = w.index.length / 3;
    if (count <= target) {
      best = expand(w);
      if (count >= target * 0.55 || pass === 4) break;
      resolution = Math.round(resolution * Math.min(1.6, Math.sqrt(target / Math.max(count, 1)) * 0.95));
    } else {
      resolution = Math.max(8, Math.round(resolution * Math.sqrt(target / count) * 0.95));
    }
  }
  if (!best) {
    const w = weld(pos, Math.max(8, Math.round(resolution * 0.7)), true);
    best = expand(w);
  }
  onProgress?.("simplify", 1);
  return best;
}

/**
 * Per-corner normals: average the normals of faces around a vertex, but only those within the crease
 * angle of this face, so cylinders look round while box edges stay crisp.
 */
export function creasedNormals(pos: Float32Array, creaseAngleDeg = 35, onProgress?: StlMeshProgress): Float32Array {
  const triCount = pos.length / 9;
  const w = weld(pos, WELD_RESOLUTION, false);
  const faceN = new Float32Array(triCount * 3);
  const faceU = new Float32Array(triCount * 3);
  for (let t = 0; t < triCount; t += 1) {
    const i = t * 9;
    const ax = pos[i + 3] - pos[i];
    const ay = pos[i + 4] - pos[i + 1];
    const az = pos[i + 5] - pos[i + 2];
    const bx = pos[i + 6] - pos[i];
    const by = pos[i + 7] - pos[i + 1];
    const bz = pos[i + 8] - pos[i + 2];
    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;
    const len = Math.hypot(nx, ny, nz) || 1;
    faceN[t * 3] = nx;
    faceN[t * 3 + 1] = ny;
    faceN[t * 3 + 2] = nz;
    faceU[t * 3] = nx / len;
    faceU[t * 3 + 1] = ny / len;
    faceU[t * 3 + 2] = nz / len;
  }
  const degree = new Uint32Array(w.vertexCount + 1);
  for (let c = 0; c < w.index.length; c += 1) degree[w.index[c] + 1] += 1;
  for (let v = 0; v < w.vertexCount; v += 1) degree[v + 1] += degree[v];
  const fill = degree.slice(0, w.vertexCount);
  const faces = new Uint32Array(w.index.length);
  for (let c = 0; c < w.index.length; c += 1) faces[fill[w.index[c]]++] = Math.floor(c / 3);

  const cosCrease = Math.cos((creaseAngleDeg * Math.PI) / 180);
  const out = new Float32Array(triCount * 9);
  const tick = progressTicker(onProgress, "normals", w.index.length);
  for (let c = 0; c < w.index.length; c += 1) {
    const t = Math.floor(c / 3);
    const v = w.index[c];
    const ux = faceU[t * 3];
    const uy = faceU[t * 3 + 1];
    const uz = faceU[t * 3 + 2];
    let sx = 0;
    let sy = 0;
    let sz = 0;
    for (let k = degree[v]; k < degree[v + 1]; k += 1) {
      const f = faces[k];
      if (faceU[f * 3] * ux + faceU[f * 3 + 1] * uy + faceU[f * 3 + 2] * uz >= cosCrease) {
        sx += faceN[f * 3];
        sy += faceN[f * 3 + 1];
        sz += faceN[f * 3 + 2];
      }
    }
    const len = Math.hypot(sx, sy, sz);
    if (len > 0) {
      out[c * 3] = sx / len;
      out[c * 3 + 1] = sy / len;
      out[c * 3 + 2] = sz / len;
    } else {
      out[c * 3] = ux;
      out[c * 3 + 1] = uy;
      out[c * 3 + 2] = uz;
    }
    tick(c);
  }
  onProgress?.("normals", 1);
  return out;
}

export function buildStlMesh(buffer: ArrayBuffer, options: StlMeshOptions = {}, onProgress?: StlMeshProgress): StlMeshData {
  const raw = parseStlPositions(buffer, onProgress);
  onProgress?.("parse", 1);
  const sourceTriangleCount = raw.length / 9;
  let positions = cleanAndOrient(raw);
  if (!positions.length) throw new Error("The STL file has no triangles to draw.");
  // Measured before simplifying: clustering moves corners inwards slightly.
  const { min, max } = bounds(positions);
  const target = Math.max(1000, options.maxTriangles ?? DEFAULT_MAX_TRIANGLES);
  const before = positions.length / 9;
  positions = simplifyPositions(positions, target, onProgress);
  const simplified = positions.length / 9 < before;
  const normals = creasedNormals(positions, options.creaseAngleDeg ?? 35, onProgress);
  return {
    positions,
    normals,
    triangleCount: positions.length / 9,
    sourceTriangleCount,
    simplified,
    min,
    max,
  };
}

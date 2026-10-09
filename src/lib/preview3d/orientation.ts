/**
 * Print orientation: a 3 × 3 rotation matrix (row-major, 9 numbers) applied to the STL's own coordinates
 * (Z up, as slicers and the server read it). `null` means "as uploaded".
 *
 * The preview draws Y-up meshes, converted from the file by C: (x, y, z) -> (x, z, -y), so a file-space
 * rotation R becomes C R Cᵀ in the viewer.
 */
import type { StlMeshData } from "./stlMesh";

export type Orientation = number[] | null;
export type Axis = "x" | "y" | "z";
export type Vec3 = [number, number, number];

export const IDENTITY: number[] = [1, 0, 0, 0, 1, 0, 0, 0, 1];

const C = [1, 0, 0, 0, 0, 1, 0, -1, 0];
const CT = [1, 0, 0, 0, 0, -1, 0, 1, 0];

function clean(v: number): number {
  const r = Math.round(v * 1e6) / 1e6;
  return Object.is(r, -0) ? 0 : r;
}

export function multiply(a: number[], b: number[]): number[] {
  const out = new Array<number>(9);
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      out[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
    }
  }
  return out;
}

export function apply(m: number[], v: Vec3): Vec3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

export function transpose(m: number[]): number[] {
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}

export function normalizeOrientation(m: Orientation | undefined): Orientation {
  if (!m || m.length !== 9 || m.some((v) => !Number.isFinite(Number(v)))) return null;
  const out = m.map((v) => clean(Number(v)));
  return isIdentity(out) ? null : out;
}

export function isIdentity(m: Orientation | undefined): boolean {
  if (!m) return true;
  return m.every((v, i) => Math.abs(v - IDENTITY[i]) < 1e-6);
}

export function sameOrientation(a: Orientation | undefined, b: Orientation | undefined): boolean {
  const x = a ?? IDENTITY;
  const y = b ?? IDENTITY;
  return x.every((v, i) => Math.abs(v - y[i]) < 1e-4);
}

export function orientationKey(m: Orientation | undefined): string {
  return m ? m.map((v) => v.toFixed(4)).join(",") : "";
}

/** Rotation by a multiple of 90° about a printer axis (exact zeros and ones). */
export function axisRotation(axis: Axis, quarterTurns: number): number[] {
  const q = ((quarterTurns % 4) + 4) % 4;
  const c = [1, 0, -1, 0][q];
  const s = [0, 1, 0, -1][q];
  if (axis === "x") return [1, 0, 0, 0, c, -s, 0, s, c];
  if (axis === "y") return [c, 0, s, 0, 1, 0, -s, 0, c];
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}

/** Turn the current orientation by 90° about a printer axis (positive = counter-clockwise seen from +axis). */
export function rotate90(current: Orientation, axis: Axis, direction: 1 | -1 = 1): Orientation {
  return normalizeOrientation(multiply(axisRotation(axis, direction), current ?? IDENTITY));
}

/** Smallest rotation turning `direction` (already oriented) to point straight down (-Z). */
export function faceDownRotation(direction: Vec3): number[] {
  const len = Math.hypot(direction[0], direction[1], direction[2]) || 1;
  const d: Vec3 = [direction[0] / len, direction[1] / len, direction[2] / len];
  const c = -d[2];
  if (c > 1 - 1e-9) return [...IDENTITY];
  if (c < -1 + 1e-9) return [1, 0, 0, 0, -1, 0, 0, 0, -1];
  // axis = d × (0, 0, -1)
  const ax: Vec3 = [-d[1], d[0], 0];
  const s = Math.hypot(ax[0], ax[1], ax[2]);
  const k: Vec3 = [ax[0] / s, ax[1] / s, ax[2] / s];
  const angle = Math.atan2(s, c);
  const sin = Math.sin(angle);
  const vers = 1 - Math.cos(angle);
  const K = [0, -k[2], k[1], k[2], 0, -k[0], -k[1], k[0], 0];
  const K2 = multiply(K, K);
  return IDENTITY.map((v, i) => clean(v + sin * K[i] + vers * K2[i]));
}

/** Place a face (outward normal, in the current orientation's printer axes) flat on the plate. */
export function layFlat(current: Orientation, normal: Vec3): Orientation {
  return normalizeOrientation(multiply(faceDownRotation(normal), current ?? IDENTITY));
}

/** The viewer's (Y-up) matrix for a file-space orientation. */
export function viewerMatrix(m: Orientation): number[] {
  return multiply(multiply(C, m ?? IDENTITY), CT);
}

/** A viewer-space (Y-up) direction in printer axes (Z up). */
export function viewerToPrinter(v: Vec3): Vec3 {
  return apply(CT, v);
}

function bounds(pos: Float32Array): { min: Vec3; max: Vec3 } {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
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

function rotateArray(src: Float32Array, m: number[]): Float32Array {
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i += 3) {
    const x = src[i];
    const y = src[i + 1];
    const z = src[i + 2];
    out[i] = m[0] * x + m[1] * y + m[2] * z;
    out[i + 1] = m[3] * x + m[4] * y + m[5] * z;
    out[i + 2] = m[6] * x + m[7] * y + m[8] * z;
  }
  return out;
}

/** The preview mesh turned to an orientation (positions, normals and bounds). */
export function orientMesh(mesh: StlMeshData, m: Orientation): StlMeshData {
  if (isIdentity(m)) return mesh;
  const v = viewerMatrix(m);
  const positions = rotateArray(mesh.positions, v);
  const normals = rotateArray(mesh.normals, v);
  const { min, max } = bounds(positions);
  return { ...mesh, positions, normals, min, max };
}

/**
 * The largest flat area of a (Y-up) mesh: faces grouped by normal direction (about 3°), area-weighted.
 * Returns its outward normal in printer axes and its area, or null.
 */
export function largestFlatFace(positions: Float32Array): { normal: Vec3; areaMm2: number } | null {
  const groups = new Map<string, { nx: number; ny: number; nz: number; area: number }>();
  let signed = 0;
  const tris = positions.length / 9;
  const normals = new Float32Array(tris * 3);
  const areas = new Float32Array(tris);
  for (let t = 0; t < tris; t += 1) {
    const i = t * 9;
    const ax = positions[i + 3] - positions[i];
    const ay = positions[i + 4] - positions[i + 1];
    const az = positions[i + 5] - positions[i + 2];
    const bx = positions[i + 6] - positions[i];
    const by = positions[i + 7] - positions[i + 1];
    const bz = positions[i + 8] - positions[i + 2];
    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;
    const len = Math.hypot(nx, ny, nz);
    signed += positions[i] * nx + positions[i + 1] * ny + positions[i + 2] * nz;
    if (len <= 0) continue;
    normals[t * 3] = nx / len;
    normals[t * 3 + 1] = ny / len;
    normals[t * 3 + 2] = nz / len;
    areas[t] = len / 2;
  }
  const sign = signed < 0 ? -1 : 1;
  for (let t = 0; t < tris; t += 1) {
    const a = areas[t];
    if (a <= 0) continue;
    const nx = normals[t * 3] * sign;
    const ny = normals[t * 3 + 1] * sign;
    const nz = normals[t * 3 + 2] * sign;
    const key = `${Math.round(nx * 20)},${Math.round(ny * 20)},${Math.round(nz * 20)}`;
    const g = groups.get(key);
    if (g) {
      g.nx += nx * a;
      g.ny += ny * a;
      g.nz += nz * a;
      g.area += a;
    } else {
      groups.set(key, { nx: nx * a, ny: ny * a, nz: nz * a, area: a });
    }
  }
  let best: { nx: number; ny: number; nz: number; area: number } | null = null;
  for (const g of groups.values()) if (!best || g.area > best.area) best = g;
  if (!best) return null;
  const len = Math.hypot(best.nx, best.ny, best.nz) || 1;
  return { normal: viewerToPrinter([best.nx / len, best.ny / len, best.nz / len]), areaMm2: best.area };
}

/** Plain-language summary of an orientation for staff ("As uploaded", "Turned"). */
export function describeOrientation(m: Orientation): string {
  if (isIdentity(m)) return "As uploaded";
  const down = apply(transpose(m ?? IDENTITY), [0, 0, -1]);
  const labels: Array<[Vec3, string]> = [
    [[0, 0, -1], "Turned on the plate"],
    [[0, 0, 1], "Upside down"],
    [[1, 0, 0], "On its right side"],
    [[-1, 0, 0], "On its left side"],
    [[0, 1, 0], "On its back"],
    [[0, -1, 0], "On its front"],
  ];
  for (const [d, label] of labels) {
    if (d[0] * down[0] + d[1] * down[1] + d[2] * down[2] > 0.999) return label;
  }
  return "Tilted (laid flat on a face)";
}

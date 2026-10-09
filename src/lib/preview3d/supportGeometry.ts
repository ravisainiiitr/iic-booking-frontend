/**
 * Support columns for the 3D print preview, from the same overhang rule as the server's estimate: a face
 * needs support when its downward normal leans past the overhang angle from vertical (-ny > sin(angle)) and it
 * is not on the plate. Each grid cell under an overhang gets a column down to the plate ("everywhere" also down
 * to the model surface below); "touching build plate only" keeps only columns with a clear path to the plate.
 *
 * Works on the Y-up preview mesh after orientation; pure (no three.js) so it can run anywhere.
 */

export type SupportViewMode = "none" | "buildplate" | "everywhere";

export interface SupportColumns {
  /** 4 floats per column: x, z (cell centre), bottom y, top y. */
  columns: Float32Array;
  count: number;
  cellMm: number;
  /** Triangles that need support (indices into the mesh). */
  overhangTriangles: Uint32Array;
  /** Projected overhang area needing support in this mode, mm². */
  overhangAreaMm2: number;
  /** Envelope volume of the columns, mm³ (the printed support is this × the support density). */
  volumeMm3: number;
}

export interface SupportOptions {
  mode: SupportViewMode;
  angleDeg?: number;
  /** Grid cells along the longer side of the model. */
  gridCells?: number;
  /** Gap between the support top and the model (Z distance). */
  gapMm?: number;
}

const ON_BED_MM = 0.2;
const MIN_COLUMN_MM = 0.3;

class Pairs {
  cells: Int32Array;
  ys: Float32Array;
  n = 0;
  constructor(size = 1024) {
    this.cells = new Int32Array(size);
    this.ys = new Float32Array(size);
  }
  push(cell: number, y: number) {
    if (this.n === this.cells.length) {
      const c = new Int32Array(this.n * 2);
      c.set(this.cells);
      this.cells = c;
      const y2 = new Float32Array(this.n * 2);
      y2.set(this.ys);
      this.ys = y2;
    }
    this.cells[this.n] = cell;
    this.ys[this.n] = y;
    this.n += 1;
  }
}

export const EMPTY_SUPPORTS: SupportColumns = {
  columns: new Float32Array(0),
  count: 0,
  cellMm: 1,
  overhangTriangles: new Uint32Array(0),
  overhangAreaMm2: 0,
  volumeMm3: 0,
};

export function computeSupports(positions: Float32Array, options: SupportOptions): SupportColumns {
  const tris = Math.floor(positions.length / 9);
  if (!tris) return EMPTY_SUPPORTS;
  const angle = ((options.angleDeg ?? 45) * Math.PI) / 180;
  const minLean = Math.sin(angle);
  const gap = options.gapMm ?? 0.2;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let signed = 0;
  for (let t = 0; t < tris; t += 1) {
    const i = t * 9;
    for (let v = 0; v < 9; v += 3) {
      const x = positions[i + v];
      const y = positions[i + v + 1];
      const z = positions[i + v + 2];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    const ax = positions[i + 3] - positions[i];
    const ay = positions[i + 4] - positions[i + 1];
    const az = positions[i + 5] - positions[i + 2];
    const bx = positions[i + 6] - positions[i];
    const by = positions[i + 7] - positions[i + 1];
    const bz = positions[i + 8] - positions[i + 2];
    signed += positions[i] * (ay * bz - az * by) + positions[i + 1] * (az * bx - ax * bz) + positions[i + 2] * (ax * by - ay * bx);
  }
  const sign = signed < 0 ? -1 : 1;
  const cells = Math.max(16, options.gridCells ?? 120);
  const cell = Math.max(0.6, Math.max(maxX - minX, maxZ - minZ) / cells);
  const nx = Math.floor((maxX - minX) / cell) + 1;
  const nz = Math.floor((maxZ - minZ) / cell) + 1;

  const over = new Pairs();
  const up = new Pairs(4096);
  const overTris: number[] = [];
  let overArea = 0;

  const raster = (i: number, out: Pairs) => {
    const x0 = positions[i];
    const y0 = positions[i + 1];
    const z0 = positions[i + 2];
    const x1 = positions[i + 3];
    const y1 = positions[i + 4];
    const z1 = positions[i + 5];
    const x2 = positions[i + 6];
    const y2 = positions[i + 7];
    const z2 = positions[i + 8];
    const det = (z1 - z2) * (x0 - x2) + (x2 - x1) * (z0 - z2);
    const lo = (v: number, o: number) => Math.max(0, Math.floor((v - o) / cell - 0.5));
    const hi = (v: number, o: number, n: number) => Math.min(n - 1, Math.ceil((v - o) / cell - 0.5));
    const ix0 = lo(Math.min(x0, x1, x2), minX);
    const ix1 = hi(Math.max(x0, x1, x2), minX, nx);
    const iz0 = lo(Math.min(z0, z1, z2), minZ);
    const iz1 = hi(Math.max(z0, z1, z2), minZ, nz);
    let hits = 0;
    if (Math.abs(det) > 1e-12) {
      for (let ix = ix0; ix <= ix1; ix += 1) {
        const cx = minX + (ix + 0.5) * cell;
        for (let iz = iz0; iz <= iz1; iz += 1) {
          const cz = minZ + (iz + 0.5) * cell;
          const a = ((z1 - z2) * (cx - x2) + (x2 - x1) * (cz - z2)) / det;
          const b = ((z2 - z0) * (cx - x2) + (x0 - x2) * (cz - z2)) / det;
          const c = 1 - a - b;
          if (a < -1e-6 || b < -1e-6 || c < -1e-6) continue;
          out.push(ix * nz + iz, a * y0 + b * y1 + c * y2);
          hits += 1;
        }
      }
    }
    if (!hits) {
      // Smaller than a cell: its centre stands for it.
      const cx = (x0 + x1 + x2) / 3;
      const cz = (z0 + z1 + z2) / 3;
      const ix = Math.min(nx - 1, Math.max(0, Math.floor((cx - minX) / cell)));
      const iz = Math.min(nz - 1, Math.max(0, Math.floor((cz - minZ) / cell)));
      out.push(ix * nz + iz, (y0 + y1 + y2) / 3);
    }
  };

  for (let t = 0; t < tris; t += 1) {
    const i = t * 9;
    const ax = positions[i + 3] - positions[i];
    const ay = positions[i + 4] - positions[i + 1];
    const az = positions[i + 5] - positions[i + 2];
    const bx = positions[i + 6] - positions[i];
    const by = positions[i + 7] - positions[i + 1];
    const bz = positions[i + 8] - positions[i + 2];
    const cx = ay * bz - az * by;
    const cy = az * bx - ax * bz;
    const cz = ax * by - ay * bx;
    const len = Math.hypot(cx, cy, cz);
    if (len <= 0) continue;
    const ny = (sign * cy) / len;
    if (ny > 1e-6) {
      raster(i, up);
    } else if (-ny > minLean) {
      const topY = Math.max(positions[i + 1], positions[i + 4], positions[i + 7]);
      if (topY <= minY + ON_BED_MM) continue;
      overTris.push(t);
      overArea += Math.abs(cy) / 2;
      if (options.mode !== "none") raster(i, over);
    }
  }

  const overhangTriangles = Uint32Array.from(overTris);
  if (options.mode === "none" || !over.n) {
    return { ...EMPTY_SUPPORTS, cellMm: cell, overhangTriangles, overhangAreaMm2: options.mode === "none" ? overArea : 0 };
  }

  // Floors per cell, sorted by height.
  const order = new Uint32Array(up.n);
  for (let k = 0; k < up.n; k += 1) order[k] = k;
  order.sort((a, b) => up.cells[a] - up.cells[b] || up.ys[a] - up.ys[b]);
  const start = new Int32Array(nx * nz + 1).fill(-1);
  const floorY = new Float32Array(up.n);
  for (let k = 0; k < up.n; k += 1) floorY[k] = up.ys[order[k]];
  const cellOf = new Int32Array(up.n);
  for (let k = 0; k < up.n; k += 1) cellOf[k] = up.cells[order[k]];
  for (let k = up.n - 1; k >= 0; k -= 1) start[cellOf[k]] = k;

  const highestBelow = (c: number, y: number): number | null => {
    let k = start[c];
    if (k < 0) return null;
    let found: number | null = null;
    for (; k < up.n && cellOf[k] === c; k += 1) {
      if (floorY[k] < y - 1e-3) found = floorY[k];
      else break;
    }
    return found;
  };

  const merged = new Map<string, number[]>();
  let plateCells = 0;
  for (let k = 0; k < over.n; k += 1) {
    const c = over.cells[k];
    const y = over.ys[k];
    const below = highestBelow(c, y);
    const blocked = below !== null && below > minY + ON_BED_MM;
    if (options.mode === "buildplate" && blocked) continue;
    const bottom = below !== null ? Math.max(minY, below) : minY;
    const top = y - gap;
    if (top - bottom < MIN_COLUMN_MM) continue;
    const key = `${c}:${Math.round(bottom * 10)}`;
    const prev = merged.get(key);
    if (prev) {
      if (top > prev[3]) prev[3] = top;
      continue;
    }
    const ix = Math.floor(c / nz);
    const iz = c - ix * nz;
    merged.set(key, [minX + (ix + 0.5) * cell, minZ + (iz + 0.5) * cell, bottom, top]);
    if (!blocked) plateCells += 1;
  }
  const columns = new Float32Array(merged.size * 4);
  let o = 0;
  let volume = 0;
  for (const col of merged.values()) {
    columns.set(col, o);
    o += 4;
    volume += (col[3] - col[2]) * cell * cell;
  }
  return {
    columns,
    count: merged.size,
    cellMm: cell,
    overhangTriangles,
    overhangAreaMm2: options.mode === "buildplate" ? plateCells * cell * cell : overArea,
    volumeMm3: volume,
  };
}

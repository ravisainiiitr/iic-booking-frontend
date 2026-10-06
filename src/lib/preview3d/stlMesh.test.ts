import { describe, expect, it } from "vitest";
import { buildStlMesh, creasedNormals, isBinaryStl, parseStlPositions, simplifyPositions } from "@/lib/preview3d/stlMesh";
import { formatMm } from "@/lib/preview3d/env";

type Tri = [number, number, number, number, number, number, number, number, number];

/** Axis-aligned box from (0,0,0) to (w,d,h), Z up, outward winding. */
function boxTris(w: number, d: number, h: number): Tri[] {
  const p = (x: number, y: number, z: number) => [x * w, y * d, z * h];
  const quad = (a: number[], b: number[], c: number[], e: number[]): Tri[] => [
    [...a, ...b, ...c] as Tri,
    [...a, ...c, ...e] as Tri,
  ];
  return [
    ...quad(p(0, 0, 0), p(0, 1, 0), p(1, 1, 0), p(1, 0, 0)),
    ...quad(p(0, 0, 1), p(1, 0, 1), p(1, 1, 1), p(0, 1, 1)),
    ...quad(p(0, 0, 0), p(1, 0, 0), p(1, 0, 1), p(0, 0, 1)),
    ...quad(p(0, 1, 0), p(0, 1, 1), p(1, 1, 1), p(1, 1, 0)),
    ...quad(p(0, 0, 0), p(0, 0, 1), p(0, 1, 1), p(0, 1, 0)),
    ...quad(p(1, 0, 0), p(1, 1, 0), p(1, 1, 1), p(1, 0, 1)),
  ];
}

function binaryStl(tris: Tri[]): ArrayBuffer {
  const buf = new ArrayBuffer(84 + tris.length * 50);
  const view = new DataView(buf);
  view.setUint32(80, tris.length, true);
  tris.forEach((t, i) => {
    const base = 84 + i * 50 + 12;
    t.forEach((v, k) => view.setFloat32(base + k * 4, v, true));
  });
  return buf;
}

function asciiStl(tris: Tri[]): ArrayBuffer {
  const lines = ["solid test"];
  for (const t of tris) {
    lines.push("facet normal 0 0 0", "outer loop");
    for (let v = 0; v < 3; v += 1) lines.push(`vertex ${t[v * 3]} ${t[v * 3 + 1]} ${t[v * 3 + 2]}`);
    lines.push("endloop", "endfacet");
  }
  lines.push("endsolid test");
  return new TextEncoder().encode(lines.join("\n")).buffer as ArrayBuffer;
}

/** UV sphere, a smooth mesh with about `seg * seg * 2` triangles (none degenerate at the poles). */
function sphereSoup(seg: number, r = 10): Float32Array {
  const pt = (i: number, j: number) => {
    const th = (i / seg) * Math.PI;
    const ph = (j / seg) * Math.PI * 2;
    return [r * Math.sin(th) * Math.cos(ph), r * Math.cos(th), r * Math.sin(th) * Math.sin(ph)];
  };
  const out: number[] = [];
  for (let i = 0; i < seg; i += 1) {
    for (let j = 0; j < seg; j += 1) {
      const a = pt(i, j);
      const b = pt(i + 1, j);
      const c = pt(i + 1, j + 1);
      const e = pt(i, j + 1);
      if (i < seg - 1) out.push(...a, ...c, ...b);
      if (i > 0) out.push(...a, ...e, ...c);
    }
  }
  return new Float32Array(out);
}

describe("STL parsing", () => {
  it("reads binary and ASCII files to the same triangles", () => {
    const tris = boxTris(20, 10, 5);
    const bin = binaryStl(tris);
    const ascii = asciiStl(tris);
    expect(isBinaryStl(bin)).toBe(true);
    expect(isBinaryStl(ascii)).toBe(false);
    expect(Array.from(parseStlPositions(ascii))).toEqual(Array.from(parseStlPositions(bin)));
    expect(parseStlPositions(bin)).toHaveLength(12 * 9);
  });

  it("turns the slicer's Z-up into Y-up and measures the model before any simplification", () => {
    const mesh = buildStlMesh(binaryStl(boxTris(20, 10, 5)));
    expect(mesh.triangleCount).toBe(12);
    expect(mesh.simplified).toBe(false);
    expect(mesh.max[0] - mesh.min[0]).toBeCloseTo(20);
    expect(mesh.max[1] - mesh.min[1]).toBeCloseTo(5);
    expect(mesh.max[2] - mesh.min[2]).toBeCloseTo(10);
  });

  it("drops degenerate triangles and rejects a file with nothing to draw", () => {
    const flat: Tri = [0, 0, 0, 1, 1, 1, 2, 2, 2];
    expect(buildStlMesh(binaryStl([...boxTris(1, 1, 1), flat])).triangleCount).toBe(12);
    expect(() => buildStlMesh(binaryStl([flat]))).toThrow(/no triangles/);
  });

  it("reports progress for each phase", () => {
    const phases = new Set<string>();
    buildStlMesh(binaryStl(boxTris(5, 5, 5)), {}, (phase) => phases.add(phase));
    expect(phases).toEqual(new Set(["parse", "normals"]));
  });
});

describe("simplifyPositions", () => {
  it("brings a dense mesh under the target and keeps its overall size", () => {
    const soup = sphereSoup(120);
    expect(soup.length / 9).toBe(28_560);
    const out = simplifyPositions(soup, 4000);
    const tris = out.length / 9;
    expect(tris).toBeLessThanOrEqual(4000);
    expect(tris).toBeGreaterThan(1000);
    let maxY = -Infinity;
    for (let i = 1; i < out.length; i += 3) maxY = Math.max(maxY, out[i]);
    expect(maxY).toBeGreaterThan(9);
  });

  it("leaves small meshes alone", () => {
    const soup = sphereSoup(10);
    expect(simplifyPositions(soup, 1000)).toBe(soup);
  });
});

describe("creasedNormals", () => {
  it("keeps the edges of a box sharp", () => {
    const pos = new Float32Array(boxTris(1, 1, 1).flat());
    const n = creasedNormals(pos, 35);
    for (let c = 0; c < n.length; c += 3) {
      const axisAligned = [n[c], n[c + 1], n[c + 2]].filter((v) => Math.abs(Math.abs(v) - 1) < 1e-6);
      expect(axisAligned).toHaveLength(1);
    }
  });

  it("smooths a sphere so corner normals point away from the centre", () => {
    const pos = sphereSoup(24);
    const n = creasedNormals(pos, 35);
    let worst = 1;
    for (let c = 0; c < pos.length; c += 3) {
      const len = Math.hypot(pos[c], pos[c + 1], pos[c + 2]);
      const dot = (n[c] * pos[c] + n[c + 1] * pos[c + 1] + n[c + 2] * pos[c + 2]) / len;
      worst = Math.min(worst, dot);
    }
    expect(worst).toBeGreaterThan(0.97);
  });
});

describe("formatMm", () => {
  it("drops needless decimals", () => {
    expect(formatMm(20)).toBe("20");
    expect(formatMm(19.9999)).toBe("20");
    expect(formatMm(77.64)).toBe("77.6");
    expect(formatMm(3.256)).toBe("3.26");
    expect(formatMm(1234.4)).toBe("1234");
  });
});

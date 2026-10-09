import { describe, expect, it } from "vitest";
import { computeSupports } from "./supportGeometry";
import {
  axisRotation,
  describeOrientation,
  faceDownRotation,
  isIdentity,
  largestFlatFace,
  layFlat,
  multiply,
  normalizeOrientation,
  orientMesh,
  rotate90,
  viewerMatrix,
  type Orientation,
} from "./orientation";
import type { StlMeshData } from "./stlMesh";

// Unit box, outward winding, Z up (as in the STL file).
const BOX = [
  [[0, 0, 0], [1, 1, 0], [1, 0, 0]], [[0, 0, 0], [0, 1, 0], [1, 1, 0]],
  [[0, 0, 1], [1, 0, 1], [1, 1, 1]], [[0, 0, 1], [1, 1, 1], [0, 1, 1]],
  [[0, 0, 0], [1, 0, 0], [1, 0, 1]], [[0, 0, 0], [1, 0, 1], [0, 0, 1]],
  [[0, 1, 0], [1, 1, 1], [1, 1, 0]], [[0, 1, 0], [0, 1, 1], [1, 1, 1]],
  [[0, 0, 0], [0, 0, 1], [0, 1, 1]], [[0, 0, 0], [0, 1, 1], [0, 1, 0]],
  [[1, 0, 0], [1, 1, 0], [1, 1, 1]], [[1, 0, 0], [1, 1, 1], [1, 0, 1]],
];

/** Boxes (x, y, z, w, d, h) in printer axes, as a Y-up preview mesh. */
function boxes(...specs: number[][]): StlMeshData {
  const out: number[] = [];
  for (const [x, y, z, w, d, h] of specs) {
    for (const tri of BOX) {
      for (const [a, b, c] of tri) out.push(x + a * w, z + c * h, -(y + b * d));
    }
  }
  const positions = Float32Array.from(out);
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k += 1) {
      min[k] = Math.min(min[k], positions[i + k]);
      max[k] = Math.max(max[k], positions[i + k]);
    }
  }
  return {
    positions,
    normals: new Float32Array(positions.length),
    triangleCount: positions.length / 9,
    sourceTriangleCount: positions.length / 9,
    simplified: false,
    min,
    max,
  };
}

const mushroom = () => boxes([-20, -20, 0, 40, 40, 5], [-5, -5, 5, 10, 10, 25], [-30, -30, 30, 60, 60, 5]);
const bracket = () => boxes([0, 0, 0, 10, 20, 40], [10, 0, 30, 30, 20, 10]);

describe("computeSupports", () => {
  it("adds no supports to a model without overhangs", () => {
    const cube = boxes([0, 0, 0, 20, 20, 20]);
    for (const mode of ["buildplate", "everywhere"] as const) {
      const s = computeSupports(cube.positions, { mode });
      expect(s.count).toBe(0);
      expect(s.overhangTriangles.length).toBe(0);
    }
  });

  it("supports a bracket arm down to the plate with about the arm's volume", () => {
    const s = computeSupports(bracket().positions, { mode: "buildplate" });
    expect(s.count).toBeGreaterThan(50);
    // The arm's underside is 30 × 20 mm at 30 mm: about 18 000 mm³ of envelope.
    expect(s.volumeMm3).toBeGreaterThan(18_000 * 0.85);
    expect(s.volumeMm3).toBeLessThan(18_000 * 1.1);
    for (let i = 0; i < s.count; i += 1) {
      expect(s.columns[i * 4 + 2]).toBeCloseTo(0, 3);
      expect(s.columns[i * 4 + 3]).toBeLessThanOrEqual(30);
    }
  });

  it("adds more supports everywhere than touching the build plate only", () => {
    const m = mushroom();
    const plate = computeSupports(m.positions, { mode: "buildplate" });
    const all = computeSupports(m.positions, { mode: "everywhere" });
    expect(plate.count).toBeGreaterThan(0);
    expect(all.volumeMm3).toBeGreaterThan(plate.volumeMm3);
    // Everywhere also stands on the base slab (top at 5 mm).
    let onBase = 0;
    for (let i = 0; i < all.count; i += 1) if (Math.abs(all.columns[i * 4 + 2] - 5) < 0.01) onBase += 1;
    expect(onBase).toBeGreaterThan(0);
    // Touching the plate only: nothing starts on the model.
    for (let i = 0; i < plate.count; i += 1) expect(plate.columns[i * 4 + 2]).toBeCloseTo(0, 3);
  });

  it("needs fewer supports at a larger overhang angle and none when turned the right way", () => {
    const m = bracket();
    expect(computeSupports(m.positions, { mode: "everywhere", angleDeg: 45 }).count).toBeGreaterThan(0);
    const lying = orientMesh(m, faceDownRotation([0, -1, 0]));
    const s = computeSupports(lying.positions, { mode: "everywhere" });
    expect(s.count).toBe(0);
  });

  it("is fast on a large mesh", () => {
    const specs: number[][] = [];
    for (let i = 0; i < 6000; i += 1) specs.push([(i % 80) * 2, Math.floor(i / 80) * 2, (i % 7) * 3, 1.5, 1.5, 1 + (i % 5)]);
    const big = boxes(...specs);
    const t0 = performance.now();
    computeSupports(big.positions, { mode: "everywhere" });
    expect(performance.now() - t0).toBeLessThan(1500);
  });
});

describe("orientation", () => {
  it("turns by quarter turns and comes back after four", () => {
    let m: Orientation = null;
    for (let i = 0; i < 4; i += 1) m = rotate90(m, "x");
    expect(m).toBeNull();
    expect(rotate90(null, "z")).toEqual(axisRotation("z", 1));
    expect(rotate90(rotate90(null, "y"), "y", -1)).toBeNull();
  });

  it("lays a face flat and describes the result", () => {
    const m = layFlat(null, [0, -1, 0]);
    expect(describeOrientation(m)).toBe("On its front");
    expect(describeOrientation(null)).toBe("As uploaded");
    expect(describeOrientation(axisRotation("z", 1))).toBe("Turned on the plate");
    expect(describeOrientation(normalizeOrientation(faceDownRotation([0.3, -0.5, 0.81])))).toBe("Tilted (laid flat on a face)");
    const r = faceDownRotation([0.3, -0.5, 0.81]);
    const det =
      r[0] * (r[4] * r[8] - r[5] * r[7]) - r[1] * (r[3] * r[8] - r[5] * r[6]) + r[2] * (r[3] * r[7] - r[4] * r[6]);
    expect(det).toBeCloseTo(1, 5);
  });

  it("finds the largest flat face and orients the preview mesh like the server", () => {
    // A plate standing on its edge: its largest faces (40 × 30 mm) face ±Y.
    const m = boxes([0, 0, 0, 40, 5, 30]);
    const face = largestFlatFace(m.positions);
    expect(face).not.toBeNull();
    expect(Math.abs(face!.normal[1])).toBeCloseTo(1, 3);
    expect(face!.areaMm2).toBeCloseTo(1200, 0);
    const lying = orientMesh(m, layFlat(null, face!.normal));
    expect(lying.max[1] - lying.min[1]).toBeCloseTo(5, 3);
    const bracketLying = orientMesh(bracket(), layFlat(null, [0, -1, 0]));
    expect(bracketLying.max[1] - bracketLying.min[1]).toBeCloseTo(20, 3);
    expect(isIdentity(multiply(viewerMatrix(null), [1, 0, 0, 0, 1, 0, 0, 0, 1]))).toBe(true);
  });
});

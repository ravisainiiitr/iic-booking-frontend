import { describe, expect, it } from "vitest";
import {
  PRINT_SIZE_TOLERANCE_MM,
  checkStlSize,
  fitsOnlyWhenRotated,
  fitsPrintSize,
  previewBedSize,
  printSizeError,
  printSizeLimitFrom,
  stlModelSize,
  tinyModelWarning,
  type PrintSizeLimit,
} from "@/lib/printSizeLimit";

const FACES = [
  [[0, 0, 0], [1, 1, 0], [1, 0, 0]], [[0, 0, 0], [0, 1, 0], [1, 1, 0]],
  [[0, 0, 1], [1, 0, 1], [1, 1, 1]], [[0, 0, 1], [1, 1, 1], [0, 1, 1]],
  [[0, 0, 0], [1, 0, 0], [1, 0, 1]], [[0, 0, 0], [1, 0, 1], [0, 0, 1]],
  [[0, 1, 0], [1, 1, 1], [1, 1, 0]], [[0, 1, 0], [0, 1, 1], [1, 1, 1]],
  [[0, 0, 0], [0, 0, 1], [0, 1, 1]], [[0, 0, 0], [0, 1, 1], [0, 1, 0]],
  [[1, 0, 0], [1, 1, 0], [1, 1, 1]], [[1, 0, 0], [1, 1, 1], [1, 0, 1]],
];

function boxTriangles(w: number, d: number, h: number): number[][][] {
  return FACES.map((tri) => tri.map(([x, y, z]) => [5 + x * w, -3 + y * d, 2 + z * h]));
}

function binaryBoxStl(w: number, d: number, h: number): ArrayBuffer {
  const tris = boxTriangles(w, d, h);
  const buf = new ArrayBuffer(84 + tris.length * 50);
  const view = new DataView(buf);
  view.setUint32(80, tris.length, true);
  tris.forEach((tri, i) => tri.flat().forEach((v, k) => view.setFloat32(84 + i * 50 + 12 + k * 4, v, true)));
  return buf;
}

function asciiBoxStl(w: number, d: number, h: number): ArrayBuffer {
  const lines = ["solid box"];
  for (const tri of boxTriangles(w, d, h)) {
    lines.push("  facet normal 0 0 0", "    outer loop");
    for (const [x, y, z] of tri) lines.push(`      vertex ${x.toExponential(6)} ${y.toFixed(6)} ${z}`);
    lines.push("    endloop", "  endfacet");
  }
  lines.push("endsolid box");
  return new TextEncoder().encode(lines.join("\n")).buffer as ArrayBuffer;
}

const limit = (x: number | null, y: number | null, z: number | null, allowRotation = true): PrintSizeLimit => ({
  x,
  y,
  z,
  allowRotation,
});

describe("stlModelSize", () => {
  it("reads the bounding box of binary and ASCII STL files", () => {
    for (const build of [binaryBoxStl, asciiBoxStl]) {
      const [w, d, h] = stlModelSize(build(120.5, 40, 7.25));
      expect(w).toBeCloseTo(120.5, 3);
      expect(d).toBeCloseTo(40, 3);
      expect(h).toBeCloseTo(7.25, 3);
    }
  });

  it("throws for a file without triangles", () => {
    expect(() => stlModelSize(new TextEncoder().encode("solid x\nendsolid x\n").buffer as ArrayBuffer)).toThrow();
  });
});

describe("fitsPrintSize", () => {
  it("has no limit when the printer has none", () => {
    expect(printSizeLimitFrom(null)).toBeNull();
    expect(printSizeLimitFrom({ x: null, y: "", z: null })).toBeNull();
    expect(fitsPrintSize([5000, 5000, 5000], null)).toBe(true);
    expect(printSizeError("a.stl", [5000, 5000, 5000], null)).toBeNull();
  });

  it("checks each axis with the 0.5 mm tolerance when rotation is off", () => {
    const l = limit(200, 100, 50, false);
    expect(PRINT_SIZE_TOLERANCE_MM).toBe(0.5);
    expect(fitsPrintSize([200.5, 100, 50], l)).toBe(true);
    expect(fitsPrintSize([200.6, 100, 50], l)).toBe(false);
    expect(fitsPrintSize([100, 200, 50], l)).toBe(false);
  });

  it("compares sorted dimensions when rotation is allowed", () => {
    const l = limit(200, 100, 50);
    expect(fitsPrintSize([50, 200, 100], l)).toBe(true);
    expect(fitsOnlyWhenRotated([50, 200, 100], l)).toBe(true);
    expect(fitsOnlyWhenRotated([200, 100, 50], l)).toBe(false);
    expect(fitsPrintSize([150, 150, 10], l)).toBe(false);
    expect(printSizeError("big.stl", [150, 150, 10], l)).toBe(
      "big.stl is 150 × 150 × 10 mm (W × D × H), larger than this printer's maximum print size of 200 × 100 × 50 mm " +
        "even when rotated. Scale the model down or split it into parts, then upload it again.",
    );
  });

  it("treats a blank axis as unlimited", () => {
    const l = printSizeLimitFrom({ x: "20", y: 20, z: null, allow_rotation: false });
    expect(l).toEqual(limit(20, 20, null, false));
    expect(fitsPrintSize([10, 10, 900], l)).toBe(true);
    expect(fitsPrintSize([30, 10, 900], l)).toBe(false);
    expect(printSizeError("a.stl", [30, 10, 900], l)).toContain("maximum print size of 20 × 20 × any mm.");
    expect(previewBedSize(l)).toEqual({ x: 20, y: 20, z: 0 });
  });
});

describe("checkStlSize", () => {
  it("flags a too-large model and warns about a tiny one without blocking it", () => {
    const l = limit(100, 100, 100);
    const big = checkStlSize("big.stl", binaryBoxStl(150, 10, 10), l);
    expect(big.error).toContain("big.stl is 150 × 10 × 10 mm");
    const tiny = checkStlSize("tiny.stl", binaryBoxStl(0.2, 0.1, 0.05), l);
    expect(tiny.error).toBeNull();
    expect(tiny.warning).toContain("exported in metres or inches");
    expect(tinyModelWarning([1, 0.5, 0.5])).toBeNull();
  });

  it("leaves unreadable files to the server analysis", () => {
    expect(checkStlSize("bad.stl", new ArrayBuffer(10), limit(1, 1, 1))).toMatchObject({ error: null, size: null });
  });
});

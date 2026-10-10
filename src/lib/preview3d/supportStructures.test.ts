import { describe, expect, it } from "vitest";
import { computeSupports, type SupportColumns } from "./supportGeometry";
import {
  BOX_STRIDE,
  ROD_STRIDE,
  buildAdhesion,
  buildSupportStructure,
  resinLevelFor,
  supportStyleFor,
  type SupportStructure,
  type SupportStyle,
} from "./supportStructures";

// Unit box, outward winding, Z up (as in the STL file).
const BOX = [
  [[0, 0, 0], [1, 1, 0], [1, 0, 0]], [[0, 0, 0], [0, 1, 0], [1, 1, 0]],
  [[0, 0, 1], [1, 0, 1], [1, 1, 1]], [[0, 0, 1], [1, 1, 1], [0, 1, 1]],
  [[0, 0, 0], [1, 0, 0], [1, 0, 1]], [[0, 0, 0], [1, 0, 1], [0, 0, 1]],
  [[0, 1, 0], [1, 1, 1], [1, 1, 0]], [[0, 1, 0], [0, 1, 1], [1, 1, 1]],
  [[0, 0, 0], [0, 0, 1], [0, 1, 1]], [[0, 0, 0], [0, 1, 1], [0, 1, 0]],
  [[1, 0, 0], [1, 1, 0], [1, 1, 1]], [[1, 0, 0], [1, 1, 1], [1, 0, 1]],
];

/** Boxes (x, y, z, w, d, h) in printer axes, as Y-up preview positions. */
function boxes(...specs: number[][]): Float32Array {
  const out: number[] = [];
  for (const [x, y, z, w, d, h] of specs) {
    for (const tri of BOX) for (const [a, b, c] of tri) out.push(x + a * w, z + c * h, -(y + b * d));
  }
  return Float32Array.from(out);
}

const mushroom = () => boxes([-20, -20, 0, 40, 40, 5], [-5, -5, 5, 10, 10, 25], [-30, -30, 30, 60, 60, 5]);
const bracket = () => boxes([0, 0, 0, 10, 20, 40], [10, 0, 30, 30, 20, 10]);
const WALLED: SupportStyle[] = ["grid", "lines", "zigzag", "snug", "concentric", "gyroid"];
const STRUTTED: SupportStyle[] = ["tree", "organic", "resin"];

function columnsBounds(s: SupportColumns) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let top = -Infinity;
  for (let i = 0; i < s.count; i += 1) {
    minX = Math.min(minX, s.columns[i * 4]);
    maxX = Math.max(maxX, s.columns[i * 4]);
    minZ = Math.min(minZ, s.columns[i * 4 + 1]);
    maxZ = Math.max(maxZ, s.columns[i * 4 + 1]);
    top = Math.max(top, s.columns[i * 4 + 3]);
  }
  const pad = s.cellMm * 2 + 3;
  return { minX: minX - pad, maxX: maxX + pad, minZ: minZ - pad, maxZ: maxZ + pad, top: top + 1e-3 };
}

/** Where every wall and every root strut (one not growing from another) stands, and whether all lie inside the supported area. */
function inspect(st: SupportStructure, s: SupportColumns) {
  const b = columnsBounds(s);
  const bottoms: number[] = [];
  let inside = true;
  const check = (x: number, y: number, z: number) => {
    if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ || y > b.top || y < -1e-3) inside = false;
  };
  for (let i = 0; i < st.boxCount; i += 1) {
    const o = i * BOX_STRIDE;
    check(st.boxes[o], st.boxes[o + 1], st.boxes[o + 2]);
    check(st.boxes[o], st.boxes[o + 1] + st.boxes[o + 4], st.boxes[o + 2]);
    bottoms.push(st.boxes[o + 1]);
  }
  const point = (o: number) => `${st.rods[o].toFixed(3)},${st.rods[o + 1].toFixed(3)},${st.rods[o + 2].toFixed(3)}`;
  const ends = new Set(Array.from({ length: st.rodCount }, (_, i) => point(i * ROD_STRIDE + 3)));
  for (let i = 0; i < st.rodCount; i += 1) {
    const o = i * ROD_STRIDE;
    check(st.rods[o], st.rods[o + 1], st.rods[o + 2]);
    check(st.rods[o + 3], st.rods[o + 4], st.rods[o + 5]);
    if (!ends.has(point(o))) bottoms.push(st.rods[o + 1]);
  }
  return { bottoms, inside };
}

describe("support styles", () => {
  it("maps the support types and technologies to a drawing style", () => {
    expect(supportStyleFor("normal")).toBe("grid");
    expect(supportStyleFor("tree")).toBe("tree");
    expect(supportStyleFor("organic")).toBe("organic");
    expect(supportStyleFor("resin_heavy")).toBe("resin");
    expect(supportStyleFor(null, "FDM")).toBe("grid");
    expect(supportStyleFor(null, "RESIN")).toBe("resin");
    expect(supportStyleFor(undefined, "MJP")).toBe("columns");
    expect(supportStyleFor(undefined)).toBe("columns");
    expect(resinLevelFor("resin_light")).toBe("light");
    expect(resinLevelFor("resin_heavy")).toBe("heavy");
    expect(resinLevelFor(null)).toBe("medium");
  });
});

describe("buildSupportStructure", () => {
  it("draws nothing for None or a model without overhangs", () => {
    const none = computeSupports(bracket(), { mode: "none" });
    const cube = computeSupports(boxes([0, 0, 0, 20, 20, 20]), { mode: "everywhere" });
    for (const style of [...WALLED, ...STRUTTED, "columns"] as SupportStyle[]) {
      for (const s of [none, cube]) {
        const st = buildSupportStructure(s, { style, floorY: 0, interfaceMm: 0.4 });
        expect(st.boxCount + st.rodCount + st.roofCount).toBe(0);
      }
    }
    expect(buildSupportStructure(null, { style: "tree", floorY: 0 }).rodCount).toBe(0);
  });

  it("builds walls for the walled types and struts for tree, organic and resin, inside the supported area", () => {
    const s = computeSupports(bracket(), { mode: "buildplate", gridCells: 70 });
    for (const style of WALLED) {
      const st = buildSupportStructure(s, { style, floorY: 0 });
      expect(st.boxCount, style).toBeGreaterThan(0);
      expect(st.rodCount, style).toBe(0);
      expect(inspect(st, s).inside, style).toBe(true);
    }
    for (const style of STRUTTED) {
      const st = buildSupportStructure(s, { style, floorY: 0 });
      expect(st.rodCount, style).toBeGreaterThan(0);
      expect(st.boxCount, style).toBe(0);
      expect(inspect(st, s).inside, style).toBe(true);
    }
  });

  it("gives each type its own pattern", () => {
    const s = computeSupports(bracket(), { mode: "buildplate", gridCells: 70 });
    const yaws = (st: SupportStructure) =>
      new Set(Array.from({ length: st.boxCount }, (_, i) => Math.round(st.boxes[i * BOX_STRIDE + 6] * 100) / 100));
    expect([...yaws(buildSupportStructure(s, { style: "lines", floorY: 0 }))]).toEqual([0]);
    expect(yaws(buildSupportStructure(s, { style: "grid", floorY: 0 })).size).toBe(2);
    expect(yaws(buildSupportStructure(s, { style: "zigzag", floorY: 0 })).size).toBe(2);
    expect(yaws(buildSupportStructure(s, { style: "gyroid", floorY: 0 })).size).toBeGreaterThan(4);
    const tree = buildSupportStructure(s, { style: "tree", floorY: 0 });
    const organic = buildSupportStructure(s, { style: "organic", floorY: 0 });
    // Organic branches are curves of several struts; tree branches are straight.
    expect(organic.rodCount).toBeGreaterThan(tree.rodCount);
    const light = buildSupportStructure(s, { style: "resin", resinLevel: "light", floorY: 0 });
    const heavy = buildSupportStructure(s, { style: "resin", resinLevel: "heavy", floorY: 0 });
    expect(heavy.rodCount).toBeGreaterThan(light.rodCount);
    expect(heavy.volumeMm3).toBeGreaterThan(light.volumeMm3);
  });

  it("draws about the volume the estimate implies, with the type's factor", () => {
    const s = computeSupports(bracket(), { mode: "buildplate", gridCells: 70 });
    for (const style of ["grid", "lines", "tree", "organic"] as SupportStyle[]) {
      const st = buildSupportStructure(s, { style, floorY: 0, densityPct: 15, volumeFactor: style === "tree" ? 0.55 : 1 });
      expect(st.targetVolumeMm3, style).toBeCloseTo(s.volumeMm3 * 0.15 * (style === "tree" ? 0.55 : 1), 0);
      expect(st.volumeMm3 / st.targetVolumeMm3, style).toBeGreaterThan(0.65);
      expect(st.volumeMm3 / st.targetVolumeMm3, style).toBeLessThan(1.35);
    }
    const normal = buildSupportStructure(s, { style: "grid", floorY: 0, densityPct: 15 });
    const tree = buildSupportStructure(s, { style: "tree", floorY: 0, densityPct: 15, volumeFactor: 0.55 });
    expect(tree.volumeMm3).toBeLessThan(normal.volumeMm3);
  });

  it("adds an interface under the overhangs only when it is on", () => {
    const s = computeSupports(bracket(), { mode: "buildplate", gridCells: 70 });
    const on = buildSupportStructure(s, { style: "grid", floorY: 0, interfaceMm: 0.4 });
    const off = buildSupportStructure(s, { style: "grid", floorY: 0, interfaceMm: 0 });
    expect(on.roofCount).toBeGreaterThan(0);
    expect(off.roofCount).toBe(0);
    for (let i = 0; i < on.roofCount; i += 1) {
      const o = i * BOX_STRIDE;
      // The roof's top is the support's top: just under the arm (30 mm, less the 0.2 mm gap).
      expect(on.roofs[o + 1] + on.roofs[o + 4]).toBeCloseTo(29.8, 1);
    }
    expect(on.targetVolumeMm3).toBeGreaterThan(off.targetVolumeMm3);
  });

  it("keeps everything on the plate with 'touching build plate only' and builds on the model 'everywhere'", () => {
    const m = mushroom();
    const plate = computeSupports(m, { mode: "buildplate", gridCells: 70 });
    const all = computeSupports(m, { mode: "everywhere", gridCells: 70 });
    for (const style of ["grid", "tree", "organic", "resin"] as SupportStyle[]) {
      const onPlate = inspect(buildSupportStructure(plate, { style, floorY: 0 }), plate);
      expect(Math.max(...onPlate.bottoms), style).toBeLessThan(0.3);
      const everywhere = inspect(buildSupportStructure(all, { style, floorY: 0 }), all);
      // Some of it stands on the base slab (top at 5 mm).
      expect(everywhere.bottoms.some((y) => Math.abs(y - 5) < 0.3), style).toBe(true);
    }
  });

  it("caps the number of elements", () => {
    const s = computeSupports(mushroom(), { mode: "everywhere", gridCells: 70 });
    for (const style of ["grid", "gyroid", "tree", "organic", "resin"] as SupportStyle[]) {
      const st = buildSupportStructure(s, { style, floorY: 0, maxElements: 300 });
      expect(st.boxCount + st.rodCount, style).toBeLessThanOrEqual(300);
      expect(st.boxCount + st.rodCount, style).toBeGreaterThan(0);
    }
  });

  it("is quick on a large support area", () => {
    const big = boxes([0, 0, 0, 10, 10, 60], [-90, -90, 60, 190, 190, 4]);
    const s = computeSupports(big, { mode: "everywhere", gridCells: 70 });
    const t0 = performance.now();
    for (const style of ["grid", "concentric", "tree", "organic"] as SupportStyle[]) buildSupportStructure(s, { style, floorY: 0 });
    expect(performance.now() - t0).toBeLessThan(1500);
  });
});

describe("buildAdhesion", () => {
  const cube = () => boxes([0, 0, 0, 20, 20, 20]);

  it("draws a brim of the set width round the first layer", () => {
    const brim = buildAdhesion(cube(), { kind: "brim", brimWidthMm: 5 });
    expect(brim.boxCount).toBeGreaterThan(0);
    expect(brim.liftMm).toBe(0);
    // A 5 mm ring round a 20 × 20 mm square: 30² - 20² = 500 mm².
    expect(brim.areaMm2).toBeGreaterThan(400);
    expect(brim.areaMm2).toBeLessThan(620);
    for (let i = 0; i < brim.boxCount; i += 1) expect(brim.boxes[i * BOX_STRIDE + 1]).toBeCloseTo(0, 5);
  });

  it("puts a raft under the part and its plate supports, lifting the model", () => {
    const raft = buildAdhesion(cube(), { kind: "raft", raftMarginMm: 3, raftMm: 0.9 });
    expect(raft.liftMm).toBeCloseTo(0.9);
    expect(raft.areaMm2).toBeGreaterThan(26 * 26 * 0.9);
    for (let i = 0; i < raft.boxCount; i += 1) {
      expect(raft.boxes[i * BOX_STRIDE + 1]).toBeCloseTo(-0.9, 5);
      expect(raft.boxes[i * BOX_STRIDE + 4]).toBeCloseTo(0.9, 5);
    }
    const m = bracket();
    const supports = computeSupports(m, { mode: "buildplate", gridCells: 70 });
    const withSupports = buildAdhesion(m, { kind: "raft", supports });
    const partOnly = buildAdhesion(m, { kind: "raft" });
    expect(withSupports.areaMm2).toBeGreaterThan(partOnly.areaMm2 + 400);
  });

  it("draws nothing without bed adhesion", () => {
    expect(buildAdhesion(cube(), { kind: "none" }).boxCount).toBe(0);
  });
});

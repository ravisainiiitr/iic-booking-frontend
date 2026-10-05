import { describe, expect, it } from "vitest";
import { buildRegions, parseDxfGeometry, signedArea, unitToMm } from "@/lib/dxfGeometry";

function dxf(sections: string[]): string {
  return [...sections, "0", "EOF"].join("\n");
}

function header(insunits?: number): string {
  if (insunits === undefined) return ["0", "SECTION", "2", "HEADER", "0", "ENDSEC"].join("\n");
  return ["0", "SECTION", "2", "HEADER", "9", "$INSUNITS", "70", String(insunits), "0", "ENDSEC"].join("\n");
}

function rect(x: number, y: number, w: number, h: number): string {
  return [
    "0", "LWPOLYLINE", "8", "0", "90", "4", "70", "1",
    "10", String(x), "20", String(y),
    "10", String(x + w), "20", String(y),
    "10", String(x + w), "20", String(y + h),
    "10", String(x), "20", String(y + h),
  ].join("\n");
}

function circle(x: number, y: number, r: number): string {
  return ["0", "CIRCLE", "8", "0", "10", String(x), "20", String(y), "40", String(r)].join("\n");
}

function entities(...items: string[]): string {
  return ["0", "SECTION", "2", "ENTITIES", ...items, "0", "ENDSEC"].join("\n");
}

describe("parseDxfGeometry", () => {
  it("reads $INSUNITS and the bounding box of every cut entity", () => {
    const g = parseDxfGeometry(dxf([header(4), entities(rect(0, 0, 200, 100), circle(50, 50, 10))]));
    expect(g.detectedUnits).toBe("mm");
    expect(g.entityCount).toBe(2);
    expect(g.bounds).toEqual({ minX: 0, minY: 0, maxX: 200, maxY: 100 });
  });

  it("treats a drawing without $INSUNITS as unitless", () => {
    const g = parseDxfGeometry(dxf([header(), entities(rect(0, 0, 10, 5))]));
    expect(g.detectedUnits).toBe("unitless");
    expect(unitToMm("cm") * 10).toBe(100);
  });

  it("expands INSERT blocks with their insertion point and scale", () => {
    const blocks = [
      "0", "SECTION", "2", "BLOCKS",
      "0", "BLOCK", "8", "0", "2", "PLATE", "70", "0", "10", "0", "20", "0",
      rect(0, 0, 20, 10),
      "0", "ENDBLK",
      "0", "ENDSEC",
    ].join("\n");
    const insert = ["0", "INSERT", "8", "0", "2", "PLATE", "10", "100", "20", "50", "41", "2", "42", "2"].join("\n");
    const g = parseDxfGeometry(dxf([header(4), blocks, entities(insert)]));
    expect(g.bounds).toEqual({ minX: 100, minY: 50, maxX: 140, maxY: 70 });
  });

  it("builds a region with a hole for the 3D extrusion", () => {
    const g = parseDxfGeometry(dxf([header(4), entities(rect(0, 0, 200, 100), circle(50, 50, 10))]));
    const regions = buildRegions(g);
    expect(regions).toHaveLength(1);
    expect(regions[0].holes).toHaveLength(1);
    expect(Math.abs(signedArea(regions[0].outer))).toBeCloseTo(20000, 0);
  });
});

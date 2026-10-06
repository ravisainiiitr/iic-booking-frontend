import { describe, expect, it } from "vitest";
import { detectColor, detectPrintFamily, isEngraveLayer, laserAppearance, printAppearance } from "@/lib/preview3d/appearance";

describe("printAppearance", () => {
  it("defaults to a matte off-white PLA look with layer lines", () => {
    const a = printAppearance({ materialName: "PLA" });
    expect(a.family).toBe("PLA");
    expect(a.label).toBe("PLA");
    expect(a.color).toBe("#f1efe9");
    expect(a.transmission).toBe(0);
    expect(a.layerLines).toBe(true);
  });

  it("uses the colour named in the material and adds it to the label", () => {
    const a = printAppearance({ materialName: "Black PLA" });
    expect(a.color).toBe("#1e1f22");
    expect(a.label).toBe("PLA · Black");
  });

  it("prefers an explicit hex colour from the booking", () => {
    expect(printAppearance({ materialName: "PLA", colorHint: "#FF8800" }).color).toBe("#ff8800");
    expect(detectColor("Red PLA", "blue")?.name).toBe("Blue");
  });

  it("lets light through clear PETG and keeps coloured PETG nearly opaque", () => {
    const clear = printAppearance({ materialName: "PETG Clear" });
    expect(clear.family).toBe("PETG");
    expect(clear.transmission).toBeGreaterThanOrEqual(0.9);
    expect(clear.roughness).toBeLessThanOrEqual(0.1);
    expect(printAppearance({ materialName: "PETG Red" }).transmission).toBeLessThan(0.1);
  });

  it("shows resin without layer lines and with a readable label", () => {
    const a = printAppearance({ materialName: "Standard resin grey" });
    expect(a.family).toBe("RESIN");
    expect(a.layerLines).toBe(false);
    expect(a.label).toBe("Resin · Grey");
    expect(printAppearance({ materialCode: "NYLON" }).label).toBe("Nylon");
  });

  it("recognises common filament codes and falls back to the material name", () => {
    expect(detectPrintFamily("abs_white")).toBe("ABS");
    expect(detectPrintFamily("TPU 95A")).toBe("TPU");
    expect(detectPrintFamily("Polycarbonate")).toBe("PC");
    const custom = printAppearance({ materialName: "Wood fill" });
    expect(custom.family).toBe("GENERIC");
    expect(custom.label).toBe("Wood fill");
  });

  it("gives silk filament a sheen and matte filament no clearcoat", () => {
    expect(printAppearance({ materialName: "Silk PLA" }).clearcoat).toBeGreaterThan(0.8);
    expect(printAppearance({ materialName: "Matte PLA" }).clearcoat).toBe(0);
  });
});

describe("laserAppearance", () => {
  it("makes clear acrylic transparent and coloured acrylic opaque", () => {
    const clear = laserAppearance({ materialName: "Clear Acrylic 3 mm" });
    expect(clear.kind).toBe("acrylic");
    expect(clear.transmission).toBeGreaterThan(0.85);
    expect(clear.label).toBe("Acrylic · Clear");
    const red = laserAppearance({ materialName: "Red Acrylic 3 mm" });
    expect(red.transmission).toBe(0);
    expect(red.color).toBe("#c62a2f");
  });

  it("uses wood grain for plywood, a fibre texture for MDF and a brushed finish for metals", () => {
    expect(laserAppearance({ materialName: "Birch Plywood 4 mm" }).texture).toBe("wood-grain");
    expect(laserAppearance({ materialName: "MDF 3 mm" }).texture).toBe("mdf");
    const ss = laserAppearance({ materialName: "SS304 1 mm" });
    expect(ss.kind).toBe("stainless");
    expect(ss.texture).toBe("brushed");
    expect(ss.metalness).toBe(1);
    expect(laserAppearance({ materialName: "Mild steel 2 mm" }).kind).toBe("steel");
  });

  it("falls back to the sheet family when the name says nothing about the material", () => {
    expect(laserAppearance({ family: "MDF", materialName: "Sheet A" }).kind).toBe("mdf");
    expect(laserAppearance({ family: "MS", materialName: "Sheet B" }).kind).toBe("steel");
    expect(laserAppearance({ family: "OTHER", materialName: "Sheet C" }).kind).toBe("generic");
  });
});

describe("isEngraveLayer", () => {
  it("treats engrave, etch, score and marking layers as engraving", () => {
    for (const name of ["ENGRAVE", "Engraving", "etch-text", "SCORE", "Marking", "mark"]) expect(isEngraveLayer(name)).toBe(true);
    for (const name of ["0", "CUT", "Outline", "Remark", "", null, undefined]) expect(isEngraveLayer(name)).toBe(false);
  });
});

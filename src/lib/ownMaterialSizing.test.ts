import { describe, expect, it } from "vitest";
import type { LaserCutAnalysis } from "@/lib/api";
import {
  laserOwnSheet,
  ownMaterialChargeNote,
  ownSheetSize,
  parseWholeQuantity,
  printModelSize,
} from "@/lib/ownMaterialSizing";

describe("ownSheetSize", () => {
  it("adds the 5 mm margin on every side and rounds up to the next mm", () => {
    expect(ownSheetSize("200", "100.2")).toEqual({ widthMm: 210, heightMm: 111, rotated: false });
    expect(ownSheetSize(50, 20, { marginMm: 0 })).toEqual({ widthMm: 50, heightMm: 20, rotated: false });
    expect(ownSheetSize(null, 20)).toBeNull();
    expect(ownSheetSize(0, 20)).toBeNull();
  });

  it("turns the sheet only when that overflows the machine bed less", () => {
    expect(ownSheetSize(400, 1300, { bed: [2438.4, 1219.2] })).toEqual({ widthMm: 1310, heightMm: 410, rotated: true });
    expect(ownSheetSize(100, 300, { bed: [2438.4, 1219.2] })).toEqual({ widthMm: 110, heightMm: 310, rotated: false });
  });

  it("picks the smallest standard size the part fits on, else rounded mm", () => {
    const standard: Array<[number, number]> = [[600, 300], [297, 210], [420, 297]];
    expect(ownSheetSize(280, 190, { standardSizes: standard })).toEqual({ widthMm: 297, heightMm: 210, rotated: false });
    expect(ownSheetSize(200, 290, { standardSizes: standard })).toEqual({ widthMm: 297, heightMm: 420, rotated: false });
    expect(ownSheetSize(700, 100, { standardSizes: standard })?.widthMm).toBe(710);
  });
});

describe("laserOwnSheet", () => {
  const base = { id: "p", status: "COMPLETED", width_mm: "200", height_mm: "100" } as LaserCutAnalysis;

  it("uses the size the user entered, then the server's size from the drawing, then works it out", () => {
    expect(laserOwnSheet({ ...base, own_sheet_width_mm: "300.0", own_sheet_height_mm: "250.0" })).toMatchObject({
      widthMm: 300,
      heightMm: 250,
      source: "user",
    });
    expect(
      laserOwnSheet({ ...base, own_sheet_suggested: { width_mm: "1310", height_mm: "410", rotated: true } }),
    ).toEqual({ widthMm: 1310, heightMm: 410, rotated: true, source: "model" });
    expect(laserOwnSheet(base)).toEqual({ widthMm: 210, heightMm: 110, rotated: false, source: "model" });
    expect(laserOwnSheet({ ...base, status: "FAILED" })).toBeNull();
  });
});

describe("helpers", () => {
  it("reads whole quantities only", () => {
    expect(parseWholeQuantity("12")).toBe(12);
    expect(parseWholeQuantity("")).toBeNull();
    expect(parseWholeQuantity("0")).toBeNull();
    expect(parseWholeQuantity("2.5")).toBeNull();
  });

  it("formats the model size and the own-material charge note", () => {
    expect(printModelSize({ size: { x: 120.5, y: 40, z: 7.25 } })).toBe("120.5 × 40 × 7.3 mm");
    expect(printModelSize({})).toBeNull();
    expect(ownMaterialChargeNote("0.00", "sheet")).toBe("No sheet material charge (machine time is still charged).");
    expect(ownMaterialChargeNote("250", "sheet")).toBe("A fixed charge of ₹250.00 replaces the sheet material cost.");
    expect(ownMaterialChargeNote("100", "printing")).toBe("A fixed charge of ₹100.00 replaces the material cost (model and supports); machine time is still charged.",
    );
  });
});

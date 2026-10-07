import { describe, expect, it } from "vitest";
import { fabricationJobQuantity, PRINT_3D_SERVER_KEYS } from "@/lib/fabricationProfiles";

describe("fabricationJobQuantity", () => {
  it("reads a whole number from 1 to 1000", () => {
    expect(fabricationJobQuantity("3")).toBe(3);
    expect(fabricationJobQuantity(" 12 ")).toBe(12);
    expect(fabricationJobQuantity(1000)).toBe(1000);
  });

  it("falls back to 1 for empty, fractional or out-of-range values", () => {
    for (const value of [undefined, null, "", "0", "-2", "1.5", "1001", "abc", true]) {
      expect(fabricationJobQuantity(value)).toBe(1);
    }
  });

  it("keeps Quantity Required (A) out of the keys the server fills for 3D printing", () => {
    expect(PRINT_3D_SERVER_KEYS).not.toContain("A");
  });
});

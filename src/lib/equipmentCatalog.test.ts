import { describe, expect, it } from "vitest";
import { catalogDepartmentFromParam, isCatalogFamilyParent } from "./equipmentCatalog";

describe("catalogDepartmentFromParam", () => {
  it("reads a department id or 'all' from the URL", () => {
    expect(catalogDepartmentFromParam("12")).toBe(12);
    expect(catalogDepartmentFromParam("all")).toBe("all");
  });

  it("ignores a missing or malformed value", () => {
    expect(catalogDepartmentFromParam(null)).toBeNull();
    expect(catalogDepartmentFromParam("")).toBeNull();
    expect(catalogDepartmentFromParam("abc")).toBeNull();
    expect(catalogDepartmentFromParam("-3")).toBeNull();
    expect(catalogDepartmentFromParam("1.5")).toBeNull();
  });
});

describe("isCatalogFamilyParent", () => {
  const nmr = { equipment_id: 7, enable_multi_mode: true, parent_equipment: null };
  const xps = { equipment_id: 4, enable_multi_mode: true, parent_equipment: null };
  const ups = { equipment_id: 57, enable_multi_mode: false, parent_equipment: 4 };

  it("opens the equipment page for a multi-mode instrument with no child modes", () => {
    expect(isCatalogFamilyParent([nmr, xps, ups], 7)).toBe(false);
  });

  it("opens the family view when child modes exist", () => {
    expect(isCatalogFamilyParent([nmr, xps, ups], 4)).toBe(true);
  });

  it("opens the family view from the API has_child_modes flag when browsing", () => {
    expect(isCatalogFamilyParent([{ ...xps, has_child_modes: true }], 4)).toBe(true);
    expect(isCatalogFamilyParent([{ ...nmr, has_child_modes: false }], 7)).toBe(false);
  });

  it("opens a searched equipment directly, even when it has child modes", () => {
    expect(isCatalogFamilyParent([xps], 4, { searchActive: true })).toBe(false);
    expect(isCatalogFamilyParent([nmr, xps, ups], 4, { searchActive: true })).toBe(false);
    expect(
      isCatalogFamilyParent([{ ...xps, has_child_modes: true }], 4, { searchActive: true }),
    ).toBe(false);
  });
});

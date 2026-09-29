import { describe, expect, it } from "vitest";
import { isCatalogFamilyParent } from "./equipmentCatalog";

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

  it("still opens the family view during a search, where children may be filtered out", () => {
    expect(isCatalogFamilyParent([xps], 4, { searchActive: true })).toBe(true);
  });

  it("uses the API has_child_modes flag during a search", () => {
    expect(
      isCatalogFamilyParent([{ ...nmr, has_child_modes: false }], 7, { searchActive: true }),
    ).toBe(false);
    expect(
      isCatalogFamilyParent([{ ...xps, has_child_modes: true }], 4, { searchActive: true }),
    ).toBe(true);
  });
});

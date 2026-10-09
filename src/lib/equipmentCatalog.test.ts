import { describe, expect, it } from "vitest";
import {
  catalogDepartmentFromParam,
  filterCatalogEquipmentForDisplay,
  isCatalogFamilyParent,
  sortCatalogOperationalFirst,
} from "./equipmentCatalog";

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

type Row = { equipment_id: number; status?: string | null; parent_equipment?: number | null; enable_multi_mode?: boolean };
const ids = (rows: Row[]) => rows.map((r) => r.equipment_id);

describe("sortCatalogOperationalFirst", () => {
  it("lists every non-operational status after operational equipment, keeping order within each group", () => {
    const rows: Row[] = [
      { equipment_id: 1, status: "REPAIR" },
      { equipment_id: 2, status: "ACTIVE" },
      { equipment_id: 3, status: "INACTIVE" },
      { equipment_id: 4, status: "ACTIVE" },
      { equipment_id: 5, status: "MAINTENANCE" },
      { equipment_id: 6, status: "OTHER" },
      { equipment_id: 7, status: "ACTIVE" },
    ];
    expect(ids(sortCatalogOperationalFirst(rows))).toEqual([2, 4, 7, 1, 3, 5, 6]);
    expect(ids(rows)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("keeps rows without a status in place", () => {
    expect(ids(sortCatalogOperationalFirst([{ equipment_id: 1 }, { equipment_id: 2, status: "REPAIR" }, { equipment_id: 3 }]))).toEqual([1, 3, 2]);
  });
});

describe("filterCatalogEquipmentForDisplay ordering", () => {
  const family: Row[] = [
    { equipment_id: 10, status: "REPAIR", enable_multi_mode: true },
    { equipment_id: 11, status: "ACTIVE", parent_equipment: 10 },
    { equipment_id: 12, status: "REPAIR", parent_equipment: 10 },
    { equipment_id: 13, status: "ACTIVE", parent_equipment: 10 },
    { equipment_id: 20, status: "ACTIVE" },
    { equipment_id: 30, status: "INACTIVE" },
    { equipment_id: 40, status: "ACTIVE" },
  ];

  it("puts non-operational cards last in the default catalog view", () => {
    expect(ids(filterCatalogEquipmentForDisplay(family, null))).toEqual([20, 40, 10, 30]);
  });

  it("uses each card's own status in a family view", () => {
    expect(ids(filterCatalogEquipmentForDisplay(family, 10))).toEqual([11, 13, 10, 12]);
  });

  it("orders search results the same way", () => {
    expect(ids(filterCatalogEquipmentForDisplay(family, null, { searchActive: true }))).toEqual([11, 13, 20, 40, 10, 12, 30]);
  });

  it("orders a plain list without multi-mode equipment", () => {
    const plain: Row[] = [
      { equipment_id: 1, status: "REPAIR" },
      { equipment_id: 2, status: "ACTIVE" },
      { equipment_id: 3, status: "ACTIVE" },
    ];
    expect(ids(filterCatalogEquipmentForDisplay(plain, null))).toEqual([2, 3, 1]);
  });
});

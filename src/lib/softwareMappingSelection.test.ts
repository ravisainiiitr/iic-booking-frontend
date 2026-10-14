import { describe, expect, it } from "vitest";
import { describeSelectedSoftware, pickDefaultCatalogId, shortCatalogId } from "./softwareMappingSelection";

const EXCEL = "129304ed-5d3d-43f7-98f5-e641e507b9bd";
const MULTIPAK = "8cc15df9-4d80-4630-b82f-ef066897eb23";
const GONE = "00000000-0000-4000-8000-000000000000";

describe("describeSelectedSoftware", () => {
  const catalogs = [{ id: EXCEL, name: "Excel" }];

  it("labels active, archived and unknown ids without showing a bare UUID", () => {
    const rows = describeSelectedSoftware([EXCEL, MULTIPAK, GONE], catalogs, [
      { id: MULTIPAK, name: "MultiPak 9.6.0", state: "archived" },
    ]);
    expect(rows).toEqual([
      { id: EXCEL, label: "Excel", unavailable: false },
      {
        id: MULTIPAK,
        label: "MultiPak 9.6.0",
        unavailable: true,
        note: "archived in the software catalog, not used for allocation",
      },
      { id: GONE, label: "Unknown software (removed from catalog)", unavailable: true, note: "ID 00000000…" },
    ]);
    for (const r of rows) expect(r.label).not.toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
  });

  it("marks disabled entries", () => {
    const [row] = describeSelectedSoftware([MULTIPAK], [], [{ id: MULTIPAK, name: "MultiPak", state: "disabled" }]);
    expect(row.unavailable).toBe(true);
    expect(row.note).toContain("disabled");
  });
});

describe("pickDefaultCatalogId", () => {
  const catalogs = [{ id: EXCEL }];

  it("never picks an unavailable id", () => {
    expect(pickDefaultCatalogId([MULTIPAK, EXCEL], catalogs, MULTIPAK)).toBe(EXCEL);
    expect(pickDefaultCatalogId([MULTIPAK], catalogs)).toBeNull();
  });

  it("keeps the current default when it is still usable", () => {
    expect(pickDefaultCatalogId([EXCEL], catalogs, EXCEL)).toBe(EXCEL);
  });
});

describe("shortCatalogId", () => {
  it("returns the first UUID segment", () => {
    expect(shortCatalogId(MULTIPAK)).toBe("8cc15df9");
  });
});

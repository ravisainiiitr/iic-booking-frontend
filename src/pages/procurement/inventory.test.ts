// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { PmImportPreview, PmRequestLine, PmSuggestedLine } from "@/lib/procurementApi";
import { daysSince } from "./AccountsPage";
import { CONDITIONS, EMPTY_ENTRY, EMPTY_EXTRA, entryPayload, extraPayload, labelOf, scanPath, tagFromScan } from "./inventory";
import { hours } from "./MaintenancePage";
import { importableCount } from "./RegisterImport";
import { fromLine, storesEditPayload } from "./RequestDetail";
import { suggestionToLine } from "./RequestWizard";

describe("QR scan helpers", () => {
  it("reads the tag from a label URL, including encoded slashes", () => {
    const url = `https://equip.iitr.ac.in${scanPath("IIC/MAJ/2024/0007")}`;
    expect(url).toBe("https://equip.iitr.ac.in/procurement/scan/IIC%2FMAJ%2F2024%2F0007");
    expect(tagFromScan(url)).toBe("IIC/MAJ/2024/0007");
    expect(tagFromScan(`${url}?src=label#x`)).toBe("IIC/MAJ/2024/0007");
  });

  it("accepts a bare tag and tolerates bad escapes", () => {
    expect(tagFromScan("  AST-12 ")).toBe("AST-12");
    expect(tagFromScan("50%off")).toBe("50%off");
  });

  it("labels known options and falls back to the raw value", () => {
    expect(labelOf(CONDITIONS, CONDITIONS[0].value)).toBe(CONDITIONS[0].label);
    expect(labelOf(CONDITIONS, "ODD")).toBe("ODD");
    expect(labelOf(CONDITIONS, null)).toBe("—");
  });
});

describe("register entry payloads", () => {
  it("sends numbers and nulls for the register placement", () => {
    expect(entryPayload(EMPTY_ENTRY)).toEqual({
      register_id: null,
      register_page: null,
      register_serial: "",
      register_entry_date: null,
    });
    expect(
      entryPayload({ register_id: "4", register_page: "12", register_serial: " 3 ", register_entry_date: "2024-04-01" }),
    ).toEqual({ register_id: 4, register_page: 12, register_serial: "3", register_entry_date: "2024-04-01" });
  });

  it("normalises optional GFR details", () => {
    const out = extraPayload({ ...EMPTY_EXTRA, quantity: "", parent_id: "9", po_date: "2024-01-02" });
    expect(out.quantity).toBe(1);
    expect(out.parent_id).toBe(9);
    expect(out.po_date).toBe("2024-01-02");
    expect(out.invoice_date).toBeNull();
  });
});

describe("requirement lines from inventory", () => {
  const suggestion = {
    item_id: 5,
    code: "ITM-5",
    name: "Vacuum pump oil",
    uom: "L",
    part_number: "VP-1",
    category: { id: 1, name: "Oils", nature: "CONSUMABLE" },
    usage: "CONSUMABLE",
    source: "link",
    typical_quantity: "2.000",
    notes: "",
    central_stock: "0.000",
    lab_stock: "1.000",
    reorder_level: "2.000",
    reorder_due: true,
    below_min: false,
    available_for_typical: false,
    last_unit_price: "1250.00",
    gst_rate: "18.00",
    suggested_quantity: "4.000",
  } satisfies PmSuggestedLine;

  it("prefills item, quantity, price and GST", () => {
    expect(suggestionToLine(suggestion)).toEqual({
      item_id: "5",
      description: "Vacuum pump oil",
      specification: "Part no. VP-1",
      quantity: "4",
      uom: "L",
      estimated_unit_price: "1250",
      gst_rate: "18",
    });
  });
});

describe("stores line edits", () => {
  const line = {
    id: 11,
    item_id: 5,
    description: "Oil",
    quantity: "2.000",
    uom: "L",
    estimated_unit_price: "100.00",
    gst_rate: "18.00",
    fulfilment: "",
    store_note: "",
  } as unknown as PmRequestLine;

  it("sends only changed, removed and new lines", () => {
    const same = fromLine(line);
    expect(storesEditPayload([line], [same])).toEqual([]);
    const changed = { ...same, quantity: "1", fulfilment: "FROM_STOCK" };
    expect(storesEditPayload([line], [changed])).toEqual([
      expect.objectContaining({ id: 11, quantity: "1", fulfilment: "FROM_STOCK", item_id: 5 }),
    ]);
    expect(storesEditPayload([line], [{ ...same, remove: true }])).toEqual([{ id: 11, remove: true }]);
    const added = { ...same, id: null, item_id: "", description: "  Gloves ", estimated_unit_price: "" };
    expect(storesEditPayload([line], [same, added])).toEqual([
      expect.objectContaining({ item_id: null, description: "Gloves", estimated_unit_price: "0" }),
    ]);
    expect(storesEditPayload([line], [same, { ...added, description: " " }])).toEqual([]);
  });
});

describe("small helpers", () => {
  it("counts importable rows", () => {
    expect(importableCount(null)).toBe(0);
    const p = { counts: { OK: 3, WARNING: 2, ERROR: 1, DUPLICATE: 4 } } as unknown as PmImportPreview;
    expect(importableCount(p)).toBe(5);
  });

  it("formats downtime and bill waiting days", () => {
    expect(hours(null)).toBe("—");
    expect(hours(5.25)).toBe("5.3 h");
    expect(hours(72)).toBe("3 days");
    const now = Date.parse("2026-10-10T12:00:00Z");
    expect(daysSince("2026-10-01T12:00:00Z", now)).toBe(9);
    expect(daysSince("2026-10-11T12:00:00Z", now)).toBe(0);
    expect(daysSince("not a date", now)).toBeNull();
    expect(daysSince(null, now)).toBeNull();
  });
});

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DisruptionPromptDialog } from "./DisruptionPromptDialog";
import { EMPTY_PROCUREMENT_DRAFT, ProcurementItemsFields, suggestionToDraftItem } from "./ProcurementItemsFields";
import { EMPTY_MAINTENANCE_DRAFT, maintenanceBody, procurementRequestBody } from "@/lib/disruptions";
import type { PmSuggestedLine } from "@/lib/procurementApi";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const suggestion: PmSuggestedLine = {
  item_id: 7,
  code: "ITM-7",
  name: "Rotary pump oil",
  uom: "L",
  part_number: "RP-2",
  category: { id: 1, name: "Oils", nature: "CONSUMABLE" },
  usage: "CONSUMABLE",
  source: "link",
  typical_quantity: "1.000",
  notes: "",
  central_stock: "0.500",
  lab_stock: "0.000",
  reorder_level: "2.000",
  reorder_due: true,
  below_min: true,
  available_for_typical: false,
  last_unit_price: "900.00",
  gst_rate: "18.00",
  suggested_quantity: "2.000",
};

describe("inventory-linked requirement items", () => {
  it("prefills a draft row from an equipment-linked item", () => {
    expect(suggestionToDraftItem(suggestion)).toEqual({
      item_id: 7,
      name: "Rotary pump oil",
      quantity: "2",
      estimated_cost: "900",
      recommended_by_service_person: true,
      notes: "Part no. RP-2; ITM-7; in stock: 0.5 L",
    });
  });

  it("sends item_id only for inventory items", () => {
    const body = procurementRequestBody({
      category: "CONSUMABLE",
      notes: "",
      items: [suggestionToDraftItem(suggestion), { ...suggestionToDraftItem(suggestion), item_id: null, name: "Gasket" }],
    });
    expect(body?.items[0].item_id).toBe(7);
    expect(body?.items[1]).not.toHaveProperty("item_id");
  });

  it("adds a linked item with one click, replacing the empty first row", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ results: [suggestion] }), { status: 200 }))
    );
    const onChange = vi.fn();
    render(
      <ProcurementItemsFields
        categories={[{ value: "CONSUMABLE", label: "Consumables" }]}
        value={EMPTY_PROCUREMENT_DRAFT}
        onChange={onChange}
        equipmentId={3}
      />
    );
    fireEvent.click(await screen.findByRole("button", { name: /Rotary pump oil/ }));
    const next = onChange.mock.calls[0][0];
    expect(next.items).toHaveLength(1);
    expect(next.items[0].item_id).toBe(7);
  });
});

describe("maintenance on resume", () => {
  it("normalises the maintenance draft", () => {
    expect(maintenanceBody(null)).toBeNull();
    expect(maintenanceBody({ ...EMPTY_MAINTENANCE_DRAFT, service_cost: "1200.5", other_cost: "-3", remarks: " ok " })).toEqual({
      kind: "BREAKDOWN",
      service_provider: "",
      service_cost: "1200.5",
      other_cost: "0",
      under_warranty_or_amc: false,
      remarks: "ok",
    });
  });

  it("offers to record maintenance when the user may, and saves it on its own", () => {
    const onSubmit = vi.fn();
    render(
      <DisruptionPromptDialog
        open
        mode="resume"
        title="Record action taken"
        canAttachReport
        procurement={{
          available: true,
          categories: [{ value: "CONSUMABLE", label: "Consumables" }],
          can_record_maintenance: true,
          maintenance_kinds: [
            { value: "BREAKDOWN", label: "Breakdown repair" },
            { value: "CALIBRATION", label: "Calibration" },
          ],
        }}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    );
    const save = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: /Record in maintenance history/ }));
    expect(save.disabled).toBe(false);
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "CALIBRATION" } });
    fireEvent.change(screen.getByLabelText(/Service charges/), { target: { value: "2500" } });
    fireEvent.click(save);
    const values = onSubmit.mock.calls[0][0];
    expect(values.procurement).toBeNull();
    expect(maintenanceBody(values.maintenance)).toMatchObject({ kind: "CALIBRATION", service_cost: "2500" });
  });

  it("does not offer maintenance without permission", () => {
    render(
      <DisruptionPromptDialog
        open
        mode="resume"
        title="Record action taken"
        procurement={{ available: true, categories: [{ value: "CONSUMABLE", label: "Consumables" }] }}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    expect(screen.queryByText("Record in maintenance history")).toBeNull();
  });
});

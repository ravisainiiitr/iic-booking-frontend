// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { LaserCutAnalysis, LaserSheetMaterial } from "@/lib/api";

const api = vi.hoisted(() => ({
  analyzeEquipmentDxf: vi.fn(),
  updateLaserCutAnalysis: vi.fn(),
  deleteLaserCutAnalysis: vi.fn(),
  getEquipmentLaserSheetMaterials: vi.fn(async () => ({ data: { materials: [], own_material_fixed_charge: null } })),
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiClient: api,
}));
vi.mock("@/components/DxfModelPreview", () => ({ default: () => <div data-testid="dxf-preview-stub" /> }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { LaserCutBookingPanel, laserPartsBlockReason, laserPartsKey } from "@/components/LaserCutBookingPanel";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const acrylic: LaserSheetMaterial = {
  id: 7,
  code: "ACR-3",
  name: "Acrylic 3 mm",
  material_family: "ACRYLIC",
  thickness_mm: "3.00",
  sheet_width_mm: "2438.4",
  sheet_height_mm: "1219.2",
  sheet_rate: "6018.00",
  user_type: null,
  is_active: true,
  display_order: 0,
};

function part(over: Partial<LaserCutAnalysis> = {}): LaserCutAnalysis {
  return {
    id: "p1",
    status: "COMPLETED",
    part_name: "plate",
    display_part_name: "plate",
    quantity: 5,
    material_id: 7,
    units: "mm",
    units_assumed: false,
    width_mm: "200.00",
    height_mm: "100.00",
    area_mm2: "20000.00",
    estimated_material_cost: "202.43",
    dxf_filename: "plate.dxf",
    fit_error: null,
    ...over,
  } as LaserCutAnalysis;
}

describe("laserPartsBlockReason", () => {
  it("explains what is missing before the parts can be booked", () => {
    expect(laserPartsBlockReason([])).toBe("Upload at least one DXF file.");
    expect(laserPartsBlockReason([part({ material_id: null })])).toBe("plate: choose a sheet material.");
    expect(laserPartsBlockReason([part({ fit_error: "The part does not fit on the sheet." })])).toBe(
      "plate: The part does not fit on the sheet.",
    );
    expect(laserPartsBlockReason([part({ status: "FAILED" })])).toMatch(/could not be measured/);
    expect(laserPartsBlockReason([part()])).toBeNull();
  });

  it("does not check the sheet size when the user brings their own sheet", () => {
    const big = part({ fit_error: "The part does not fit on the sheet." });
    expect(laserPartsBlockReason([big], true)).toBeNull();
    expect(laserPartsBlockReason([part({ material_id: null, fit_error: "x" })], true)).toBe("plate: choose a sheet material.");
  });

  it("changes the parts key when quantity, material or the own-material choice changes", () => {
    const base = laserPartsKey([part()], false);
    expect(laserPartsKey([part({ quantity: 6 })], false)).not.toBe(base);
    expect(laserPartsKey([part({ material_id: 8 })], false)).not.toBe(base);
    expect(laserPartsKey([part()], true)).not.toBe(base);
    expect(laserPartsKey([part()], false)).toBe(base);
  });
});

describe("LaserCutBookingPanel", () => {
  it("uploads a DXF, shows size and per-part cost, and reports the batch as ready", async () => {
    api.analyzeEquipmentDxf.mockResolvedValue({ data: { id: "b1", status: "COMPLETED", items: [part()] } });
    const onReady = vi.fn();
    render(<LaserCutBookingPanel equipmentId={12} materials={[acrylic]} ownMaterialCharge="250" onReady={onReady} />);

    const file = new File(["0\nEOF\n"], "plate.dxf", { type: "application/dxf" });
    fireEvent.change(screen.getByTestId("laser-dxf-input"), { target: { files: [file] } });

    await waitFor(() => expect(screen.getByTestId("laser-part-cost").textContent).toContain("202.43"));
    expect(screen.getByTestId("laser-part-size").textContent).toContain("200 × 100 mm (0.0200 m² each)");
    expect(api.analyzeEquipmentDxf).toHaveBeenCalledWith(12, expect.objectContaining({ file, batch_id: null, material_id: "7" }));
    await waitFor(() =>
      expect(onReady).toHaveBeenLastCalledWith(
        expect.objectContaining({ batchId: "b1", ownMaterial: false, materialEstimate: 202.43 }),
      ),
    );
    expect(screen.getByLabelText("I will bring my own sheet material")).toBeTruthy();
  });

  it("saves a quantity change when the field loses focus", async () => {
    api.analyzeEquipmentDxf.mockResolvedValue({ data: { id: "b1", status: "COMPLETED", items: [part()] } });
    api.updateLaserCutAnalysis.mockResolvedValue({ data: part({ quantity: 2, estimated_material_cost: "80.97" }) });
    render(<LaserCutBookingPanel equipmentId={12} materials={[acrylic]} onReady={vi.fn()} />);
    fireEvent.change(screen.getByTestId("laser-dxf-input"), { target: { files: [new File(["x"], "plate.dxf")] } });

    const qty = await screen.findByLabelText("Quantity");
    fireEvent.change(qty, { target: { value: "2" } });
    fireEvent.blur(qty);

    await waitFor(() => expect(api.updateLaserCutAnalysis).toHaveBeenCalledWith("p1", { quantity: 2 }));
    await waitFor(() => expect(screen.getByTestId("laser-part-cost").textContent).toContain("80.97"));
  });

  it("clears the oversize error when own material is ticked and brings it back when unticked", async () => {
    const fitError = "The part is 3000 × 1500 mm, which does not fit on a 2438.4 × 1219.2 mm sheet of Acrylic 3 mm.";
    api.analyzeEquipmentDxf.mockResolvedValue({
      data: { id: "b1", status: "COMPLETED", items: [part({ width_mm: "3000.00", height_mm: "1500.00", fit_error: fitError })] },
    });
    const onReady = vi.fn();
    render(<LaserCutBookingPanel equipmentId={12} materials={[acrylic]} ownMaterialCharge="250" onReady={onReady} />);
    fireEvent.change(screen.getByTestId("laser-dxf-input"), { target: { files: [new File(["x"], "plate.dxf")] } });

    expect((await screen.findByTestId("laser-part-fit-error")).textContent).toBe(fitError);
    expect(screen.getByTestId("laser-block-reason").textContent).toContain("does not fit");
    expect(screen.queryByTestId("laser-own-sheet-note")).toBeNull();
    expect(onReady).toHaveBeenLastCalledWith(null);

    fireEvent.click(screen.getByLabelText("I will bring my own sheet material"));
    await waitFor(() => expect(screen.queryByTestId("laser-part-fit-error")).toBeNull());
    expect(screen.queryByTestId("laser-block-reason")).toBeNull();
    expect(screen.getByTestId("laser-own-sheet-note").textContent).toBe(
      "Size not checked against IIC sheets — make sure your sheet is large enough.",
    );
    await waitFor(() =>
      expect(onReady).toHaveBeenLastCalledWith(expect.objectContaining({ batchId: "b1", ownMaterial: true })),
    );

    fireEvent.click(screen.getByLabelText("I will bring my own sheet material"));
    expect((await screen.findByTestId("laser-part-fit-error")).textContent).toBe(fitError);
    expect(screen.getByTestId("laser-block-reason").textContent).toContain("does not fit");
    expect(screen.queryByTestId("laser-own-sheet-note")).toBeNull();
    await waitFor(() => expect(onReady).toHaveBeenLastCalledWith(null));
  });

  it("skips the sheet check in the replace dialog when the booking uses own material", async () => {
    api.analyzeEquipmentDxf.mockResolvedValue({
      data: { id: "b1", status: "COMPLETED", items: [part({ fit_error: "does not fit" })] },
    });
    const onReady = vi.fn();
    render(
      <LaserCutBookingPanel equipmentId={12} materials={[acrylic]} ownMaterialCharge={null} ownMaterialSelected onReady={onReady} />,
    );
    fireEvent.change(screen.getByTestId("laser-dxf-input"), { target: { files: [new File(["x"], "plate.dxf")] } });

    await waitFor(() => expect(onReady).toHaveBeenLastCalledWith(expect.objectContaining({ batchId: "b1" })));
    expect(screen.queryByTestId("laser-part-fit-error")).toBeNull();
    expect(screen.getByTestId("laser-own-sheet-note")).toBeTruthy();
  });

  it("hides the own-material option when the equipment has no own-material charge", async () => {
    render(<LaserCutBookingPanel equipmentId={12} materials={[acrylic]} ownMaterialCharge={null} onReady={vi.fn()} />);
    expect(screen.queryByLabelText("I will bring my own sheet material")).toBeNull();
  });

  it("tells the user to contact the OIC when no sheet is configured", async () => {
    render(<LaserCutBookingPanel equipmentId={12} materials={[]} onReady={vi.fn()} />);
    const note = await screen.findByTestId("laser-no-materials");
    expect(note.textContent).toBe("No materials configured — contact the OIC.");
  });

  it("does not show the no-materials note when sheets exist", () => {
    render(<LaserCutBookingPanel equipmentId={12} materials={[acrylic]} onReady={vi.fn()} />);
    expect(screen.queryByTestId("laser-no-materials")).toBeNull();
  });

  it("rejects files that are not DXF or ZIP", async () => {
    render(<LaserCutBookingPanel equipmentId={12} materials={[acrylic]} onReady={vi.fn()} />);
    fireEvent.change(screen.getByTestId("laser-dxf-input"), { target: { files: [new File(["x"], "part.stl")] } });
    await new Promise((r) => setTimeout(r, 0));
    expect(api.analyzeEquipmentDxf).not.toHaveBeenCalled();
  });
});

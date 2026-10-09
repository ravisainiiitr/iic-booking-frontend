// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

import { LaserCutBookingPanel } from "@/components/LaserCutBookingPanel";

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
    own_sheet_width_mm: null,
    own_sheet_height_mm: null,
    own_sheet_suggested: { width_mm: "210", height_mm: "110", rotated: false },
    ...over,
  } as LaserCutAnalysis;
}

async function renderWithPart(props: Partial<Parameters<typeof LaserCutBookingPanel>[0]> = {}) {
  api.analyzeEquipmentDxf.mockResolvedValue({ data: { id: "b1", status: "COMPLETED", items: [part()] } });
  const onReady = vi.fn();
  const onUpdatingChange = vi.fn();
  render(
    <LaserCutBookingPanel
      equipmentId={12}
      materials={[acrylic]}
      ownMaterialCharge="0.00"
      onReady={onReady}
      onUpdatingChange={onUpdatingChange}
      {...props}
    />,
  );
  fireEvent.change(screen.getByTestId("laser-dxf-input"), { target: { files: [new File(["x"], "plate.dxf")] } });
  await screen.findByLabelText("Quantity");
  return { onReady, onUpdatingChange };
}

describe("live part quantity", () => {
  it("saves the quantity while typing after a short pause, without leaving the box", async () => {
    api.updateLaserCutAnalysis.mockResolvedValue({ data: part({ quantity: 23, estimated_material_cost: "931.18" }) });
    const { onReady, onUpdatingChange } = await renderWithPart();
    await waitFor(() => expect(onReady).toHaveBeenLastCalledWith(expect.objectContaining({ batchId: "b1" })));

    const qty = screen.getByLabelText("Quantity");
    fireEvent.change(qty, { target: { value: "2" } });
    fireEvent.change(qty, { target: { value: "23" } });
    expect(screen.getByTestId("laser-part-updating").textContent).toBe("Updating…");
    expect(onReady).toHaveBeenLastCalledWith(null);
    expect(onUpdatingChange).toHaveBeenLastCalledWith(true);
    expect(api.updateLaserCutAnalysis).not.toHaveBeenCalled();

    await waitFor(() => expect(api.updateLaserCutAnalysis).toHaveBeenCalledTimes(1));
    expect(api.updateLaserCutAnalysis).toHaveBeenCalledWith("p1", { quantity: 23 });
    await waitFor(() => expect(screen.getByTestId("laser-part-cost").textContent).toContain("931.18"));
    await waitFor(() =>
      expect(onReady).toHaveBeenLastCalledWith(expect.objectContaining({ parts: [expect.objectContaining({ quantity: 23 })] })),
    );
    expect(onUpdatingChange).toHaveBeenLastCalledWith(false);
  });

  it("sends a value typed during a save next, and only the last answer is shown", async () => {
    let resolveFirst: (v: unknown) => void = () => {};
    api.updateLaserCutAnalysis
      .mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)))
      .mockResolvedValueOnce({ data: part({ quantity: 9, estimated_material_cost: "364.37" }) });
    await renderWithPart();
    const qty = screen.getByLabelText("Quantity");

    fireEvent.change(qty, { target: { value: "8" } });
    await waitFor(() => expect(api.updateLaserCutAnalysis).toHaveBeenCalledTimes(1));
    fireEvent.change(qty, { target: { value: "9" } });
    await new Promise((r) => setTimeout(r, 400));
    expect(api.updateLaserCutAnalysis).toHaveBeenCalledTimes(1);

    await act(async () => resolveFirst({ data: part({ quantity: 8, estimated_material_cost: "323.88" }) }));
    await waitFor(() => expect(api.updateLaserCutAnalysis).toHaveBeenCalledTimes(2));
    expect(api.updateLaserCutAnalysis).toHaveBeenLastCalledWith("p1", { quantity: 9 });
    await waitFor(() => expect(screen.getByTestId("laser-part-cost").textContent).toContain("364.37"));
    expect(screen.queryByText(/323\.88/)).toBeNull();
  });

  it("blocks booking while the quantity box is empty", async () => {
    const { onReady } = await renderWithPart();
    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "" } });
    expect(screen.getByTestId("laser-block-reason").textContent).toBe("Number of parts must be a whole number of at least 1.");
    expect(onReady).toHaveBeenLastCalledWith(null);
    await new Promise((r) => setTimeout(r, 400));
    expect(api.updateLaserCutAnalysis).not.toHaveBeenCalled();
  });
});

describe("own sheet size", () => {
  it("asks for the design before the sheet size can be filled", () => {
    render(<LaserCutBookingPanel equipmentId={12} materials={[acrylic]} ownMaterialCharge="0.00" onReady={vi.fn()} />);
    expect(screen.getByText("No sheet material charge (machine time is still charged).")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("I will bring my own sheet material"));
    expect(screen.getByTestId("laser-own-sheet-hint").textContent).toBe("Upload your design to auto-fill the sheet size.");
  });

  it("auto-fills the sheet from the drawing when ticked and again when the model changes", async () => {
    await renderWithPart();
    expect(screen.queryByTestId("laser-own-sheet-p1")).toBeNull();
    fireEvent.click(screen.getByLabelText("I will bring my own sheet material"));

    const width = screen.getByLabelText("Your sheet width (mm) for plate") as HTMLInputElement;
    const height = screen.getByLabelText("Your sheet height (mm) for plate") as HTMLInputElement;
    expect([width.value, height.value]).toEqual(["210", "110"]);
    expect(screen.getByTestId("laser-own-sheet-source").textContent).toContain(
      "Auto-filled from your design: 200 × 100 mm part + 5 mm margin on each side.",
    );
    expect(screen.getByTestId("laser-own-sheet-source").textContent).toContain("bring enough for all 5");

    api.analyzeEquipmentDxf.mockResolvedValue({
      data: {
        id: "b1",
        status: "COMPLETED",
        items: [
          part(),
          part({
            id: "p2",
            part_name: "rail",
            display_part_name: "rail",
            quantity: 1,
            width_mm: "400.00",
            height_mm: "1300.00",
            own_sheet_suggested: { width_mm: "1310", height_mm: "410", rotated: true },
          }),
        ],
      },
    });
    fireEvent.change(screen.getByTestId("laser-dxf-input"), { target: { files: [new File(["x"], "rail.dxf")] } });
    const railWidth = (await screen.findByLabelText("Your sheet width (mm) for rail")) as HTMLInputElement;
    expect(railWidth.value).toBe("1310");
    expect(screen.getByTestId("laser-own-sheet-p2").textContent).toContain("turned to suit the machine bed");
  });

  it("saves a size the user types and resets it to the model size", async () => {
    await renderWithPart();
    fireEvent.click(screen.getByLabelText("I will bring my own sheet material"));
    api.updateLaserCutAnalysis.mockResolvedValueOnce({
      data: part({ own_sheet_width_mm: "300.0", own_sheet_height_mm: "110.0" }),
    });

    fireEvent.change(screen.getByLabelText("Your sheet width (mm) for plate"), { target: { value: "300" } });
    await waitFor(() =>
      expect(api.updateLaserCutAnalysis).toHaveBeenCalledWith("p1", {
        own_sheet_width_mm: 300,
        own_sheet_height_mm: 110,
        own_material: true,
      }),
    );
    await waitFor(() => expect(screen.getByTestId("laser-own-sheet-source").textContent).toMatch(/^Entered by you\./));
    expect((screen.getByLabelText("Your sheet width (mm) for plate") as HTMLInputElement).value).toBe("300");

    api.updateLaserCutAnalysis.mockResolvedValueOnce({ data: part() });
    fireEvent.click(screen.getByRole("button", { name: "Reset to model size" }));
    await waitFor(() =>
      expect(api.updateLaserCutAnalysis).toHaveBeenLastCalledWith("p1", {
        own_sheet_width_mm: null,
        own_sheet_height_mm: null,
        own_material: true,
      }),
    );
    await waitFor(() =>
      expect((screen.getByLabelText("Your sheet width (mm) for plate") as HTMLInputElement).value).toBe("210"),
    );
    expect(screen.queryByRole("button", { name: "Reset to model size" })).toBeNull();
  });
});

// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { PrintAnalysisResult, PrintMaterial } from "@/lib/api";

const api = vi.hoisted(() => ({
  analyzeEquipmentStl: vi.fn(),
  getEquipmentPrintMaterials: vi.fn(),
  getPrintAnalysis: vi.fn(),
  updatePrintAnalysisPart: vi.fn(),
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiClient: api,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
vi.mock("@/components/StlModelPreview", () => ({ StlModelPreview: () => <div data-testid="stl-preview-stub" /> }));

import { Print3DBookingPanel } from "@/components/Print3DBookingPanel";

const pla = { id: 7, code: "PLA", name: "PLA white", density_g_per_cm3: "1.24", price_per_gram: "2" } as PrintMaterial;

function analysis(over: Partial<PrintAnalysisResult> = {}): PrintAnalysisResult {
  return {
    id: "a1",
    status: "COMPLETED",
    stl_filename: "bracket.stl",
    part_name: "bracket",
    quantity: 1,
    weight_grams: "12.4",
    estimated_time_minutes: 40,
    bounding_box: { size: { x: 40, y: 20, z: 10 } },
    ...over,
  } as PrintAnalysisResult;
}

function stlFile(): File {
  const buffer = new ArrayBuffer(84);
  const file = new File([buffer], "bracket.stl", { type: "model/stl" });
  Object.defineProperty(file, "arrayBuffer", { value: async () => buffer });
  return file;
}

async function renderAnalyzed() {
  api.analyzeEquipmentStl.mockResolvedValue({ data: analysis() });
  const onReady = vi.fn();
  const onUpdatingChange = vi.fn();
  const view = render(
    <Print3DBookingPanel
      equipmentId={5}
      materials={[pla]}
      maxPrintSize={null}
      ownMaterialCharge="0.00"
      onReady={onReady}
      onUpdatingChange={onUpdatingChange}
    />,
  );
  const input = view.container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [stlFile()] } });
  await screen.findByLabelText("Copies");
  await waitFor(() => expect(onReady).toHaveBeenLastCalledWith(expect.objectContaining({ analysisId: "a1" })));
  return { onReady, onUpdatingChange };
}

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Print3DBookingPanel live copies", () => {
  it("saves the copies while typing after a short pause and refreshes the totals", async () => {
    api.updatePrintAnalysisPart.mockResolvedValue({ data: analysis({ quantity: 12 }) });
    const { onReady, onUpdatingChange } = await renderAnalyzed();

    const copies = screen.getByLabelText("Copies");
    fireEvent.change(copies, { target: { value: "1" } });
    fireEvent.change(copies, { target: { value: "12" } });
    expect(screen.getByTestId("print-part-updating")).toBeTruthy();
    expect(onReady).toHaveBeenLastCalledWith(null);
    expect(onUpdatingChange).toHaveBeenLastCalledWith(true);
    expect(api.updatePrintAnalysisPart).not.toHaveBeenCalled();

    await waitFor(() => expect(api.updatePrintAnalysisPart).toHaveBeenCalledTimes(1));
    expect(api.updatePrintAnalysisPart).toHaveBeenCalledWith("a1", { quantity: 12 });
    await waitFor(() =>
      expect(onReady).toHaveBeenLastCalledWith(expect.objectContaining({ analysisId: "a1", weightGrams: 156 })),
    );
    expect(screen.getByTestId("print-total-weight").textContent).toContain("156");
    expect(onUpdatingChange).toHaveBeenLastCalledWith(false);
  });

  it("does not save or offer a charge while the copies box is empty", async () => {
    const { onReady } = await renderAnalyzed();
    fireEvent.change(screen.getByLabelText("Copies"), { target: { value: "" } });
    expect(onReady).toHaveBeenLastCalledWith(null);
    await new Promise((r) => setTimeout(r, 400));
    expect(api.updatePrintAnalysisPart).not.toHaveBeenCalled();
  });
});

describe("Print3DBookingPanel own printing material", () => {
  it("asks for the model, then auto-fills the material to bring and the model size", async () => {
    api.analyzeEquipmentStl.mockResolvedValue({ data: analysis() });
    const view = render(
      <Print3DBookingPanel equipmentId={5} materials={[pla]} maxPrintSize={null} ownMaterialCharge="0.00" onReady={vi.fn()} />,
    );
    expect(screen.getByText("No printing material charge (machine time is still charged).")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("I will bring my own printing material"));
    expect(screen.getByTestId("print-own-material-need").textContent).toBe(
      "Upload your model to auto-fill the material you need.",
    );

    const input = view.container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [stlFile()] } });
    await waitFor(() => expect(screen.getByTestId("print-own-material-grams").textContent).toContain("13"));
    expect(screen.getByTestId("print-own-material-need").textContent).toContain("of PLA white");
    expect(screen.getByTestId("print-own-material-sizes").textContent).toBe("Model size: 40 × 20 × 10 mm");

    api.updatePrintAnalysisPart.mockResolvedValue({ data: analysis({ quantity: 3 }) });
    fireEvent.change(screen.getByLabelText("Copies"), { target: { value: "3" } });
    await waitFor(() => expect(screen.getByTestId("print-own-material-grams").textContent).toContain("39"));
    expect(screen.getByTestId("print-own-material-need").textContent).toContain("for every copy");
  });
});

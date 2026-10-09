// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { PrintMaterial } from "@/lib/api";

const api = vi.hoisted(() => ({
  analyzeEquipmentStl: vi.fn(),
  getEquipmentPrintMaterials: vi.fn(),
  getPrintAnalysis: vi.fn(),
}));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), warning: vi.fn() }));
const preview = vi.hoisted(() => ({ props: [] as Array<Record<string, unknown>> }));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiClient: api,
}));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/components/StlModelPreview", () => ({
  StlModelPreview: (props: Record<string, unknown>) => {
    preview.props.push(props);
    return <div data-testid="stl-preview-stub" />;
  },
}));

import { Print3DBookingPanel, printSizeBlockMessage } from "@/components/Print3DBookingPanel";

const pla: PrintMaterial = {
  id: 7,
  code: "PLA",
  name: "PLA white",
  density_g_per_cm3: "1.24",
  price_per_gram: "2",
} as PrintMaterial;

const FACES = [
  [[0, 0, 0], [1, 1, 0], [1, 0, 0]], [[0, 0, 0], [0, 1, 0], [1, 1, 0]],
  [[0, 0, 1], [1, 0, 1], [1, 1, 1]], [[0, 0, 1], [1, 1, 1], [0, 1, 1]],
];

function boxStl(w: number, d: number, h: number): ArrayBuffer {
  const buf = new ArrayBuffer(84 + FACES.length * 50);
  const view = new DataView(buf);
  view.setUint32(80, FACES.length, true);
  FACES.forEach((tri, i) =>
    tri.flatMap(([x, y, z]) => [x * w, y * d, z * h]).forEach((v, k) => view.setFloat32(84 + i * 50 + 12 + k * 4, v, true)),
  );
  return buf;
}

function stlFile(name: string, buffer: ArrayBuffer): File {
  const file = new File([buffer], name, { type: "model/stl" });
  Object.defineProperty(file, "arrayBuffer", { value: async () => buffer });
  return file;
}

const LIMIT = { x: 220, y: 220, z: 250, allow_rotation: true, tolerance_mm: 0.5 };

function renderPanel(onReady = vi.fn(), maxPrintSize: typeof LIMIT | null = LIMIT) {
  const view = render(
    <Print3DBookingPanel equipmentId={5} materials={[pla]} maxPrintSize={maxPrintSize} onReady={onReady} />,
  );
  const input = view.container.querySelector('input[type="file"]') as HTMLInputElement;
  return { ...view, input, onReady };
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
  preview.props = [];
});

describe("Print3DBookingPanel maximum print size", () => {
  it("shows the printer's maximum size near the upload", () => {
    renderPanel();
    expect(screen.getByTestId("print-max-size").textContent).toContain("220 × 220 × 250 mm");
    expect(screen.getByTestId("print-max-size").textContent).toContain("accepted; the lab re-orients it");
  });

  it("refuses a model larger than the printer before uploading it and highlights it in the preview", async () => {
    const { input, onReady } = renderPanel();
    fireEvent.change(input, { target: { files: [stlFile("wing.stl", boxStl(300, 20, 10))] } });

    const alert = await screen.findByTestId("print-size-error");
    expect(alert.getAttribute("role")).toBe("alert");
    expect(alert.textContent).toContain("This model is too large for this printer");
    expect(alert.textContent).toContain("wing.stl is 300 × 20 × 10 mm (W × D × H)");
    expect(alert.textContent).toContain("220 × 220 × 250 mm even when rotated");
    expect(api.analyzeEquipmentStl).not.toHaveBeenCalled();
    expect(onReady).toHaveBeenLastCalledWith(null);
    expect((screen.getByRole("button", { name: "Re-analyze" }) as HTMLButtonElement).disabled).toBe(true);

    await waitFor(() => expect(preview.props.length).toBeGreaterThan(0));
    const last = preview.props[preview.props.length - 1];
    expect(last.bedSize).toEqual({ x: 220, y: 220, z: 250 });
    expect(last.sizeCheck).toEqual({ tooLarge: true, rotated: false, limitLabel: "220 × 220 × 250 mm" });
  });

  it("accepts a model that fits when turned and sends it for analysis", async () => {
    api.analyzeEquipmentStl.mockResolvedValue({ error: "stop here" });
    const { input } = renderPanel();
    fireEvent.change(input, { target: { files: [stlFile("rod.stl", boxStl(240, 20, 20))] } });

    await waitFor(() => expect(api.analyzeEquipmentStl).toHaveBeenCalled());
    expect(screen.queryByTestId("print-size-error")).toBeNull();
    const last = preview.props[preview.props.length - 1];
    expect(last.sizeCheck).toEqual({ tooLarge: false, rotated: true, limitLabel: "220 × 220 × 250 mm" });
  });

  it("shows the server's size refusal inline", async () => {
    api.analyzeEquipmentStl.mockResolvedValue({
      error: "part.stl is 230 × 20 × 20 mm (W × D × H), larger than this printer's maximum print size.",
      code: "PRINT_SIZE_EXCEEDED",
    });
    const { input } = renderPanel(vi.fn(), null);
    expect(screen.queryByTestId("print-max-size")).toBeNull();
    fireEvent.change(input, { target: { files: [stlFile("part.stl", boxStl(230, 20, 20))] } });

    expect((await screen.findByTestId("print-size-error")).textContent).toContain("part.stl is 230 × 20 × 20 mm");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("reports the size refusal so the booking page can block Book, and clears it when the file is removed", async () => {
    const onSizeBlockChange = vi.fn();
    const { container } = render(
      <Print3DBookingPanel
        equipmentId={5}
        materials={[pla]}
        maxPrintSize={LIMIT}
        onReady={vi.fn()}
        onSizeBlockChange={onSizeBlockChange}
      />,
    );
    expect(onSizeBlockChange).toHaveBeenLastCalledWith(null);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [stlFile("wing.stl", boxStl(300, 20, 10))] } });

    await waitFor(() =>
      expect(onSizeBlockChange).toHaveBeenLastCalledWith(
        expect.stringContaining("wing.stl is 300 × 20 × 10 mm (W × D × H), larger than this printer's maximum print size of 220 × 220 × 250 mm"),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: /Remove/ }));
    await waitFor(() => expect(onSizeBlockChange).toHaveBeenLastCalledWith(null));

    fireEvent.change(input, { target: { files: [stlFile("wing.stl", boxStl(300, 20, 10))] } });
    await waitFor(() => expect(onSizeBlockChange).toHaveBeenLastCalledWith(expect.stringContaining("wing.stl")));
    cleanup();
    expect(onSizeBlockChange).toHaveBeenLastCalledWith(null);
  });

  it("reports the server's size refusal too", async () => {
    api.analyzeEquipmentStl.mockResolvedValue({ error: "part.stl is 230 × 20 × 20 mm, too large.", code: "PRINT_SIZE_EXCEEDED" });
    const onSizeBlockChange = vi.fn();
    const { container } = render(
      <Print3DBookingPanel equipmentId={5} materials={[pla]} maxPrintSize={null} onReady={vi.fn()} onSizeBlockChange={onSizeBlockChange} />,
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [stlFile("part.stl", boxStl(230, 20, 20))] } });
    await waitFor(() => expect(onSizeBlockChange).toHaveBeenLastCalledWith("part.stl is 230 × 20 × 20 mm, too large."));
  });

  it("warns, without blocking, when the model looks like it is not in millimetres", async () => {
    api.analyzeEquipmentStl.mockResolvedValue({ error: "stop here" });
    const { input } = renderPanel();
    fireEvent.change(input, { target: { files: [stlFile("tiny.stl", boxStl(0.1, 0.05, 0.02))] } });

    expect((await screen.findByTestId("print-size-warning")).textContent).toContain("metres or inches");
    await waitFor(() => expect(api.analyzeEquipmentStl).toHaveBeenCalled());
  });
});

describe("Print3DBookingPanel supports and estimate breakdown", () => {
  const pva = { id: 9, code: "PVA", name: "PVA support", density_g_per_cm3: "1.19", price_per_gram: "5" } as PrintMaterial;
  const breakdown = {
    technology: "FDM",
    model_g: 18.2,
    support_g: 3.1,
    waste_g: 0.5,
    total_g: 21.8,
    model_material_g: 21.8,
    support_material_g: 0,
    print_min: 145,
    support_min: 12,
    warmup_min: 10,
    total_min: 155,
    layers: 400,
    layer_height_mm: 0.1,
    infill_percent: 100,
    support_mode: "buildplate",
    support_mode_requested: "auto",
    overhang_area_mm2: 820,
    overhang_plate_mm2: 600,
    notes: [],
  };

  it("sends the support choice and shows the breakdown with the detected overhangs", async () => {
    api.getEquipmentPrintMaterials.mockResolvedValue({
      data: {
        materials: [pla],
        support_materials: [pva],
        support_defaults: {
          technology: "FDM",
          supports_available: true,
          modes_selectable: true,
          density_pct: 12,
          angle_deg: 45,
          angle_range: [30, 70],
        },
      },
    });
    api.analyzeEquipmentStl.mockResolvedValue({
      data: {
        id: "a1",
        status: "COMPLETED",
        weight_grams: 22,
        estimated_time_minutes: 155,
        material_code_snapshot: "PLA",
        estimate_breakdown: breakdown,
      },
    });
    const { input, onReady } = renderPanel(vi.fn(), null);
    expect(await screen.findByTestId("print-supports")).toBeTruthy();
    expect(screen.getByTestId("print-support-material")).toBeTruthy();
    fireEvent.click(screen.getByTestId("print-support-advanced-toggle"));
    expect(screen.getByTestId("print-support-density").textContent).toBe("12% (printer default)");
    expect(screen.getByTestId("print-support-angle").textContent).toBe("45° (default)");

    fireEvent.change(input, { target: { files: [stlFile("bracket.stl", boxStl(40, 20, 10))] } });
    await waitFor(() => expect(api.analyzeEquipmentStl).toHaveBeenCalled());
    expect(api.analyzeEquipmentStl.mock.calls[0][1].supports).toEqual({
      support_mode: "auto",
      support_density_pct: null,
      support_angle_deg: null,
      support_material_id: null,
    });

    const summary = await screen.findByTestId("print-estimate-breakdown");
    expect(summary.textContent).toContain("Model 18.2 g + supports 3.1 g + waste 0.5 g; ~2 h 35 m incl. 10 min warm-up");
    expect(summary.textContent).toContain("Estimate");
    expect(screen.getByTestId("print-overhangs").textContent).toContain("Detected overhangs: 820 mm² (600 mm² with a clear path");
    expect(screen.getByTestId("print-overhangs").textContent).toContain("Auto → touching build plate only");
    expect(screen.getByTestId("print-total-time").textContent).toBe("155 min (2 h 35 m)");
    expect(onReady).toHaveBeenLastCalledWith(expect.objectContaining({ weightGrams: 22, supportWeightGrams: 0 }));
  });

  it("shows supports printed in a separate support material", async () => {
    api.getEquipmentPrintMaterials.mockResolvedValue({ data: { materials: [pla], support_materials: [pva] } });
    api.analyzeEquipmentStl.mockResolvedValue({
      data: {
        id: "a2",
        status: "COMPLETED",
        weight_grams: 19,
        estimated_time_minutes: 170,
        quantity: 2,
        material_code_snapshot: "PLA",
        estimate_breakdown: { ...breakdown, support_material_code: "PVA", support_material_g: 2.6, model_material_g: 19.2 },
      },
    });
    const { input, onReady } = renderPanel(vi.fn(), null);
    fireEvent.change(input, { target: { files: [stlFile("bracket.stl", boxStl(40, 20, 10))] } });
    expect((await screen.findByTestId("print-total-support-weight")).textContent).toBe("6 g");
    expect(screen.getByTestId("print-estimate-breakdown").textContent).toContain("supports 6.2 g (PVA)");
    expect(onReady).toHaveBeenLastCalledWith(
      expect.objectContaining({ weightGrams: 38, supportWeightGrams: 6, supportMaterialCode: "PVA" }),
    );
  });

  it("hides the supports choice for printers without supports and old analyses show no breakdown", async () => {
    api.getEquipmentPrintMaterials.mockResolvedValue({
      data: { materials: [pla], support_defaults: { technology: "SLS", supports_available: false, modes_selectable: false, density_pct: 0, angle_deg: 45, angle_range: [30, 70] } },
    });
    api.analyzeEquipmentStl.mockResolvedValue({
      data: { id: "a3", status: "COMPLETED", weight_grams: 10, estimated_time_minutes: 30, material_code_snapshot: "PLA" },
    });
    const { input } = renderPanel(vi.fn(), null);
    await waitFor(() => expect(api.getEquipmentPrintMaterials).toHaveBeenCalled());
    fireEvent.change(input, { target: { files: [stlFile("cube.stl", boxStl(20, 20, 20))] } });
    expect((await screen.findByTestId("print-total-time")).textContent).toBe("30 min");
    expect(screen.queryByTestId("print-supports")).toBeNull();
    expect(screen.queryByTestId("print-estimate-breakdown")).toBeNull();
  });
});

describe("printSizeBlockMessage", () => {
  it("names the first oversized file and counts the rest, else uses the server's refusal", () => {
    expect(printSizeBlockMessage([], null)).toBeNull();
    expect(printSizeBlockMessage(["a.stl is too big."], "server")).toBe("a.stl is too big.");
    expect(printSizeBlockMessage(["a.stl is too big.", "b.stl is too big."], null)).toBe(
      "2 models are too large for this printer. a.stl is too big.",
    );
    expect(printSizeBlockMessage([], "server says no")).toBe("server says no");
  });
});

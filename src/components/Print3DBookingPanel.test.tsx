// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { PrintMaterial } from "@/lib/api";

const api = vi.hoisted(() => ({
  analyzeEquipmentStl: vi.fn(),
  getEquipmentPrintMaterials: vi.fn(),
  getPrintAnalysis: vi.fn(),
  recalculatePrintAnalysis: vi.fn(),
  getPrintAnalysisOrientations: vi.fn(),
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
  Element.prototype.scrollIntoView ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
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
      support_type: null,
      support_interface: null,
      adhesion: "none",
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

  it("offers the printer's support types, interface and bed adhesion and shows them in the breakdown", async () => {
    api.getEquipmentPrintMaterials.mockResolvedValue({
      data: {
        materials: [pla],
        support_defaults: {
          technology: "FDM",
          supports_available: true,
          modes_selectable: true,
          density_pct: 12,
          angle_deg: 45,
          angle_range: [30, 70],
          support_types: [
            { key: "normal", label: "Normal (grid)", description: "Straight columns.", volume_factor: 1, speed_factor: 1 },
            { key: "tree", label: "Tree", description: "Branches to the overhangs.", slicers: "Cura Tree", volume_factor: 0.55, speed_factor: 0.85 },
          ],
          default_support_type: "normal",
          interface_layers: 2,
          adhesion_types: [
            { key: "none", label: "Skirt / none", description: "No extra material." },
            { key: "raft", label: "Raft", description: "A lattice under the part." },
          ],
        },
      },
    });
    api.analyzeEquipmentStl.mockResolvedValue({
      data: {
        id: "a4",
        status: "COMPLETED",
        weight_grams: 23,
        estimated_time_minutes: 160,
        material_code_snapshot: "PLA",
        estimate_breakdown: {
          ...breakdown,
          support_g: 1.7,
          support_type: "tree",
          support_type_label: "Tree",
          adhesion: "raft",
          adhesion_label: "Raft",
          adhesion_g: 1.4,
          total_g: 21.8,
          total_min: 160,
        },
      },
    });
    const { input } = renderPanel(vi.fn(), null);
    expect((await screen.findByTestId("print-support-type-hint")).textContent).toContain("Straight columns.");

    fireEvent.click(screen.getByTestId("print-support-type"));
    fireEvent.click(await screen.findByRole("option", { name: "Tree" }));
    const hint = screen.getByTestId("print-support-type-hint").textContent;
    expect(hint).toContain("About 45% less support material than Normal");
    expect(hint).toContain("Like: Cura Tree.");
    fireEvent.click(screen.getByTestId("print-adhesion"));
    fireEvent.click(await screen.findByRole("option", { name: "Raft" }));
    fireEvent.click(screen.getByTestId("print-support-advanced-toggle"));
    fireEvent.click(screen.getByTestId("print-support-interface"));

    fireEvent.change(input, { target: { files: [stlFile("bracket.stl", boxStl(40, 20, 10))] } });
    await waitFor(() => expect(api.analyzeEquipmentStl).toHaveBeenCalled());
    expect(api.analyzeEquipmentStl.mock.calls[0][1].supports).toMatchObject({
      support_type: "tree",
      support_interface: false,
      adhesion: "raft",
    });
    const summary = await screen.findByTestId("print-estimate-breakdown");
    expect(summary.textContent).toContain("Model 18.2 g + supports 1.7 g + raft 1.4 g + waste 0.5 g");
    expect(screen.getByTestId("print-overhangs").textContent).toContain("Tree · auto → touching build plate only · raft");
    expect(screen.getByTestId("print-bar-weight").textContent).toContain("raft 1.4 g");

    await waitFor(() =>
      expect(preview.props[preview.props.length - 1].supports).toMatchObject({
        type: "tree",
        technology: "FDM",
        densityPct: 12,
        volumeFactor: 0.55,
        interfaceMm: 0,
        adhesion: "raft",
        summary: "Tree supports ~1.7 g",
      }),
    );
    expect(screen.getByTestId("print-preview-area")).toBeTruthy();
    expect(screen.getByTestId("print-options-grid").contains(screen.getByTestId("print-adhesion-card"))).toBe(true);
    const bar = screen.getByTestId("print-weight-bar");
    expect(bar.textContent).toContain("Model");
    expect(bar.textContent).toContain("Supports");
    expect(bar.textContent).toContain("Raft");
  });

  it("keeps the support choice on printers set to print without supports in Auto", async () => {
    api.getEquipmentPrintMaterials.mockResolvedValue({
      data: {
        materials: [pla],
        support_defaults: {
          technology: "FDM",
          supports_available: true,
          supports_by_default: false,
          modes_selectable: true,
          density_pct: 12,
          angle_deg: 45,
          angle_range: [30, 70],
          support_types: [
            { key: "normal", label: "Normal (grid)", description: "Straight columns.", volume_factor: 1, speed_factor: 1 },
            { key: "tree", label: "Tree", description: "Branches.", volume_factor: 0.55, speed_factor: 0.85 },
          ],
          default_support_type: "normal",
        },
      },
    });
    renderPanel(vi.fn(), null);
    expect((await screen.findByTestId("print-support-mode-hint")).textContent).toContain(
      "This printer prints without supports in Auto",
    );
    expect(screen.getByTestId("print-support-type-field")).toBeTruthy();
    fireEvent.click(screen.getByTestId("print-support-mode"));
    fireEvent.click(await screen.findByRole("option", { name: "Everywhere" }));
    expect(screen.getByTestId("print-support-mode-hint").textContent).not.toContain("without supports in Auto");
  });

  it("explains that powder printers need no supports and old analyses show no breakdown", async () => {
    api.getEquipmentPrintMaterials.mockResolvedValue({
      data: {
        materials: [pla],
        support_defaults: {
          technology: "SLS",
          technology_label: "Powder (SLS)",
          supports_available: false,
          modes_selectable: false,
          density_pct: 0,
          angle_deg: 45,
          angle_range: [30, 70],
        },
      },
    });
    api.analyzeEquipmentStl.mockResolvedValue({
      data: { id: "a3", status: "COMPLETED", weight_grams: 10, estimated_time_minutes: 30, material_code_snapshot: "PLA" },
    });
    const { input } = renderPanel(vi.fn(), null);
    await waitFor(() => expect(api.getEquipmentPrintMaterials).toHaveBeenCalled());
    fireEvent.change(input, { target: { files: [stlFile("cube.stl", boxStl(20, 20, 20))] } });
    expect((await screen.findByTestId("print-total-time")).textContent).toBe("30 min");
    expect(screen.queryByTestId("print-supports")).toBeNull();
    expect(screen.getByTestId("print-supports-not-needed").textContent).toContain("Powder (SLS) printer");
    expect(screen.queryByTestId("print-estimate-breakdown")).toBeNull();
  });
});

describe("Print3DBookingPanel orientation and live estimate", { timeout: 20000 }, () => {
  const supportDefaults = {
    technology: "FDM",
    supports_available: true,
    modes_selectable: true,
    density_pct: 12,
    angle_deg: 45,
    angle_range: [30, 70],
  };
  const breakdown = {
    technology: "FDM",
    model_g: 18.2,
    support_g: 6.2,
    waste_g: 0.5,
    total_g: 24.9,
    model_material_g: 24.9,
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
    progress: [0.5, 1],
    notes: [],
  };
  const analysed = {
    id: "a1",
    status: "COMPLETED",
    weight_grams: 25,
    estimated_time_minutes: 155,
    material_code_snapshot: "PLA",
    bounding_box: { size: { x: 40, y: 20, z: 40 } },
    estimate_breakdown: breakdown,
  };
  const turned = [1, 0, 0, 0, 0, -1, 0, 1, 0];
  const comparison = {
    analysis_id: "a1",
    scored_support_mode: "auto",
    current_index: 0,
    best_index: 1,
    candidates: [
      { label: "As uploaded", kind: "axis", orientation: null, is_current: true, size_mm: [40, 20, 40], fits: true, support_g: 6.2, total_g: 24.9, total_min: 155, height_mm: 40, overhang_area_mm2: 600, support_mode: "buildplate" },
      { label: "On its front", kind: "axis", orientation: turned, is_current: false, size_mm: [40, 40, 20], fits: true, support_g: 1.1, total_g: 19.8, total_min: 137, height_mm: 20, overhang_area_mm2: 50, support_mode: "buildplate" },
    ],
    saving: { support_g: 5.1, total_g: 5.1, total_min: 18 },
  };

  function setup(limit: typeof LIMIT | null = LIMIT, extra: Record<string, unknown> = {}) {
    api.getEquipmentPrintMaterials.mockResolvedValue({ data: { materials: [pla], support_defaults: supportDefaults } });
    api.analyzeEquipmentStl.mockResolvedValue({ data: analysed });
    api.getPrintAnalysisOrientations.mockResolvedValue({ data: comparison });
    const onReady = vi.fn();
    const onSizeBlockChange = vi.fn();
    const view = render(
      <Print3DBookingPanel
        equipmentId={5}
        materials={[pla]}
        maxPrintSize={limit}
        onReady={onReady}
        onSizeBlockChange={onSizeBlockChange}
        {...extra}
      />,
    );
    const input = view.container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [stlFile("bracket.stl", boxStl(40, 20, 40))] } });
    return { onReady, onSizeBlockChange };
  }

  const lastPreview = () => preview.props[preview.props.length - 1];

  it("shows the supports and the time profile in the preview and saves a rotation with a fresh estimate", async () => {
    api.recalculatePrintAnalysis.mockResolvedValue({
      data: {
        ...analysed,
        weight_grams: 20,
        estimated_time_minutes: 137,
        slicer_settings: { orientation: turned },
        bounding_box: { size: { x: 40, y: 40, z: 20 } },
        estimate_breakdown: { ...breakdown, support_g: 1.1, total_g: 19.8, total_min: 137 },
      },
    });
    const { onReady } = setup(LIMIT, { charge: { amount: "1234.5" } });
    expect(await screen.findByTestId("print-orientation")).toBeTruthy();
    await waitFor(() =>
      expect(lastPreview().supports).toEqual({
        mode: "buildplate",
        angleDeg: 45,
        color: null,
        summary: "Supports ~6.2 g",
        type: null,
        technology: "FDM",
        densityPct: 12,
        volumeFactor: null,
        interfaceMm: 0,
        adhesion: "none",
        brimWidthMm: null,
      }),
    );
    expect(lastPreview().timeline).toEqual({ progress: [0.5, 1], printMinutes: 155, warmupMinutes: 10 });
    expect(lastPreview().orientation).toBeNull();
    expect(screen.getByTestId("print-estimate-bar").textContent).toContain("₹1,234.50");
    expect(screen.getByTestId("print-bar-weight").textContent).toContain("supports 6.2 g");

    fireEvent.click(screen.getByTestId("print-rotate-x-plus"));
    expect(lastPreview().orientation).toEqual(turned);
    expect(screen.getByTestId("print-orientation-label").textContent).toContain("updating estimate");
    expect(lastPreview().supports).toMatchObject({ summary: "Supports: updating…" });

    await waitFor(() => expect(api.recalculatePrintAnalysis).toHaveBeenCalled(), { timeout: 5000 });
    expect(api.recalculatePrintAnalysis).toHaveBeenCalledTimes(1);
    expect(api.recalculatePrintAnalysis.mock.calls[0][0]).toBe("a1");
    expect(api.recalculatePrintAnalysis.mock.calls[0][1]).toMatchObject({ material_id: "7", density_percent: 100, orientation: turned });
    await waitFor(() => expect(screen.getByTestId("print-bar-weight").textContent).toMatch(/^20 g/));
    const ready = onReady.mock.calls[onReady.mock.calls.length - 1][0];
    expect(ready.items[0].orientation).toEqual(turned);
    expect(ready.partsKey).toContain("0.0000,-1.0000");
    expect(screen.getByTestId("print-part-orientation").textContent).toBe("On its front");
    expect(lastPreview().orientation).toEqual(turned);
  });

  it("suggests the least-support orientation and turns the part on request", async () => {
    api.recalculatePrintAnalysis.mockResolvedValue({ data: { ...analysed, slicer_settings: { orientation: turned } } });
    setup();
    const hint = await screen.findByTestId("print-orientation-hint", {}, { timeout: 8000 });
    expect(hint.textContent).toContain("Turning this part could save 5.1 g of supports and 18 min of print time.");
    expect(api.getPrintAnalysisOrientations.mock.calls[0][0]).toBe("a1");

    fireEvent.click(screen.getByTestId("print-auto-orient"));
    expect(screen.getByTestId("print-orientation-saving").textContent).toContain("Support: 6.2 g → 1.1 g, time −18 min");
    expect(api.getPrintAnalysisOrientations).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId("print-orientation-use-best"));
    expect(lastPreview().orientation).toEqual(turned);
    await waitFor(() => expect(api.recalculatePrintAnalysis).toHaveBeenCalled(), { timeout: 5000 });
    expect(api.recalculatePrintAnalysis.mock.calls[0][1].orientation).toEqual(turned);
  });

  it("blocks booking when the turned part no longer fits the printer", async () => {
    api.recalculatePrintAnalysis.mockResolvedValue({
      data: { ...analysed, slicer_settings: { orientation: turned }, bounding_box: { size: { x: 300, y: 40, z: 20 } } },
    });
    const { onSizeBlockChange } = setup({ ...LIMIT, allow_rotation: false });
    fireEvent.click(await screen.findByTestId("print-rotate-x-plus"));
    expect((await screen.findByTestId("print-orientation-size-error", {}, { timeout: 5000 })).textContent).toContain(
      "bracket.stl turned this way is 300 × 40 × 20 mm",
    );
    expect(onSizeBlockChange).toHaveBeenLastCalledWith(expect.stringContaining("Choose another orientation."));

    api.recalculatePrintAnalysis.mockResolvedValue({ data: { ...analysed, slicer_settings: {} } });
    fireEvent.click(screen.getByTestId("print-orientation-reset"));
    await waitFor(() => expect(onSizeBlockChange).toHaveBeenLastCalledWith(null), { timeout: 5000 });
    expect(api.recalculatePrintAnalysis.mock.calls[1][1].orientation).toBeNull();
  });

  it("does not look for a better orientation when supports are off", async () => {
    setup();
    await screen.findByTestId("print-orientation");
    fireEvent.click(screen.getByTestId("print-support-mode"));
    fireEvent.click(await screen.findByRole("option", { name: "None" }));
    await new Promise((r) => setTimeout(r, 1200));
    expect(screen.queryByTestId("print-orientation-hint")).toBeNull();
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

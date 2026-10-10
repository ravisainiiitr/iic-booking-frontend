// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { DxfGeometry } from "@/lib/dxfGeometry";
import type { FabricationPart } from "@/lib/api";
import { resetWebGLCache } from "@/lib/preview3d/env";
import { clearStlMeshCache } from "@/lib/preview3d/loadStlMesh";

const three = vi.hoisted(() => ({
  stages: [] as Array<{
    opts: { reducedMotion: boolean; autoRotate?: boolean };
    setView: ReturnType<typeof vi.fn>;
    setOverlayVisible: ReturnType<typeof vi.fn>;
    invalidate: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  }>,
  materials: [] as Array<{ wireframe: boolean }>,
  print: { exceedsBed: false },
  laser: { exceedsSheet: false, hasSheet: true },
  buildPrintScene: vi.fn(),
  buildLaserScene: vi.fn(),
}));

vi.mock("@/components/preview3d/stage", () => ({
  PreviewStage: class {
    opts: unknown;
    setView = vi.fn();
    setOverlayVisible = vi.fn();
    invalidate = vi.fn();
    dispose = vi.fn();
    constructor(_mount: HTMLElement, opts: unknown) {
      this.opts = opts;
      three.stages.push(this as never);
    }
  },
  disposeObject: vi.fn(),
}));
vi.mock("@/components/preview3d/printScene", () => ({
  buildPrintScene: (...args: unknown[]) => {
    three.buildPrintScene(...args);
    three.materials = [{ wireframe: false }];
    return { materials: three.materials, size: [0, 0, 0], exceedsBed: three.print.exceedsBed };
  },
}));
vi.mock("@/components/preview3d/laserScene", () => ({
  buildLaserScene: (...args: unknown[]) => {
    three.buildLaserScene(...args);
    three.materials = [{ wireframe: false }];
    return { materials: three.materials, ...three.laser };
  },
}));

const api = vi.hoisted(() => ({ getPrintAnalysisStlBuffer: vi.fn() }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiClient: api,
}));

import { StlModelPreview } from "@/components/StlModelPreview";
import { DxfModelPreview } from "@/components/DxfModelPreview";
import { BookedStlPreview, bookedPrintTimeline } from "@/components/BookedStlPreview";

type Tri = number[];

function boxStl(w: number, d: number, h: number): ArrayBuffer {
  const p = (x: number, y: number, z: number) => [x * w, y * d, z * h];
  const quad = (a: number[], b: number[], c: number[], e: number[]): Tri[] => [
    [...a, ...b, ...c],
    [...a, ...c, ...e],
  ];
  const tris = [
    ...quad(p(0, 0, 0), p(0, 1, 0), p(1, 1, 0), p(1, 0, 0)),
    ...quad(p(0, 0, 1), p(1, 0, 1), p(1, 1, 1), p(0, 1, 1)),
    ...quad(p(0, 0, 0), p(1, 0, 0), p(1, 0, 1), p(0, 0, 1)),
    ...quad(p(0, 1, 0), p(0, 1, 1), p(1, 1, 1), p(1, 1, 0)),
    ...quad(p(0, 0, 0), p(0, 0, 1), p(0, 1, 1), p(0, 1, 0)),
    ...quad(p(1, 0, 0), p(1, 1, 0), p(1, 1, 1), p(1, 0, 1)),
  ];
  const buf = new ArrayBuffer(84 + tris.length * 50);
  const view = new DataView(buf);
  view.setUint32(80, tris.length, true);
  tris.forEach((t, i) => t.forEach((v, k) => view.setFloat32(84 + i * 50 + 12 + k * 4, v, true)));
  return buf;
}

const plate: DxfGeometry = {
  paths: [
    { points: [[0, 0], [160, 0], [160, 90], [0, 90]], closed: true, layer: "0" },
    { points: [[20, 20], [25, 20], [25, 25], [20, 25]], closed: true, layer: "CUT" },
    { points: [[40, 70], [120, 70]], closed: false, layer: "ENGRAVE" },
  ],
  bounds: { minX: 0, minY: 0, maxX: 160, maxY: 90 },
  detectedUnits: "mm",
  entityCount: 3,
  warnings: [],
};

function mockMatchMedia(matching: string[]) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      matches: matching.some((m) => query.includes(m)),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    }),
  });
}

let fills = 0;

beforeEach(() => {
  fills = 0;
  three.stages = [];
  three.print.exceedsBed = false;
  three.laser = { exceedsSheet: false, hasSheet: true };
  clearStlMeshCache();
  mockMatchMedia([]);
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (target, key) => {
      if (key === "fill") return () => (fills += 1);
      if (key in target) return target[key as string];
      return () => {};
    },
    set: (target, key, value) => {
      target[key as string] = value;
      return true;
    },
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(((type: string) =>
    type === "2d" ? ctx : null) as never);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  resetWebGLCache(null);
});

describe("StlModelPreview", () => {
  it("draws a shaded still view and explains why when WebGL is not available", async () => {
    resetWebGLCache(false);
    render(
      <StlModelPreview
        buffer={boxStl(20, 10, 5)}
        materialName="Black PLA"
        stats={{ weightGrams: 46.2, timeMinutes: 138, quantity: 2 }}
      />,
    );

    expect(await screen.findByTestId("stl-preview-2d")).toBeTruthy();
    expect(screen.getByTestId("stl-preview-webgl-off").textContent).toContain("needs WebGL");
    expect(screen.getByTestId("stl-preview-size").textContent).toContain("20 × 10 × 5 mm");
    expect(screen.getByTestId("stl-preview-material").textContent).toBe("PLA · Black");
    expect(screen.getByTestId("stl-preview-stats").textContent).toBe("47 g· 2 h 18 mineach");
    expect(fills).toBeGreaterThan(0);
    expect(screen.queryByRole("toolbar")).toBeNull();
    expect(three.stages).toHaveLength(0);
  });

  it("builds the 3D scene with the material look and wires the view controls", async () => {
    resetWebGLCache(true);
    three.print.exceedsBed = true;
    const { unmount } = render(
      <StlModelPreview buffer={boxStl(20, 10, 5)} materialName="PETG Clear" bedSize={{ x: 220, y: 220, z: 250 }} layerHeightMm={0.2} />,
    );

    await waitFor(() => expect(three.stages).toHaveLength(1));
    const stage = three.stages[0];
    expect(stage.opts.autoRotate).toBe(true);
    expect(stage.opts.reducedMotion).toBe(false);
    const [, mesh, appearance, bed, layer] = three.buildPrintScene.mock.calls[0];
    expect(mesh.triangleCount).toBe(12);
    expect(appearance.family).toBe("PETG");
    expect(appearance.transmission).toBeGreaterThan(0.85);
    expect(bed).toEqual({ x: 220, y: 220, z: 250 });
    expect(layer).toBe(0.2);
    expect(await screen.findByTestId("stl-preview-exceeds")).toBeTruthy();

    fireEvent.click(screen.getByTitle("Top view"));
    fireEvent.click(screen.getByTitle("Front view"));
    fireEvent.click(screen.getByRole("button", { name: /Plate/ }));
    fireEvent.click(screen.getByRole("button", { name: "Reset view" }));
    expect(stage.setView.mock.calls.map((c) => c[0])).toEqual(["top", "front", "sheet", "home"]);

    fireEvent.click(screen.getByRole("button", { name: "Wireframe" }));
    expect(three.materials[0].wireframe).toBe(true);
    const dims = screen.getByRole("button", { name: "Show dimensions" });
    expect(dims.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(dims);
    expect(stage.setOverlayVisible).toHaveBeenLastCalledWith(false);

    unmount();
    expect(stage.dispose).toHaveBeenCalled();
  });

  it("turns the build volume red when the model is larger than the printer's maximum size", async () => {
    resetWebGLCache(true);
    three.print.exceedsBed = true;
    const { rerender } = render(
      <StlModelPreview
        buffer={boxStl(300, 10, 5)}
        bedSize={{ x: 220, y: 220, z: 250 }}
        sizeCheck={{ tooLarge: true, rotated: false, limitLabel: "220 × 220 × 250 mm" }}
      />,
    );
    await waitFor(() => expect(three.buildPrintScene).toHaveBeenCalled());
    expect(three.buildPrintScene.mock.calls[0][5]).toEqual({ overLimit: true });
    expect(screen.getByTestId("stl-preview-too-large").textContent).toBe(
      "Too large for this printer (maximum 220 × 220 × 250 mm).",
    );
    expect(screen.queryByTestId("stl-preview-exceeds")).toBeNull();

    rerender(
      <StlModelPreview
        buffer={boxStl(300, 10, 5)}
        bedSize={{ x: 220, y: 220, z: 250 }}
        sizeCheck={{ tooLarge: false, rotated: true, limitLabel: "220 × 220 × 250 mm" }}
      />,
    );
    await waitFor(() => expect(screen.queryByTestId("stl-preview-too-large")).toBeNull());
    expect(screen.getByTestId("stl-preview-rotated").textContent).toContain("when turned");
    expect(three.buildPrintScene.mock.calls.at(-1)?.[5]).toMatchObject({ overLimit: false });
  });

  it("does not auto-rotate for people who prefer reduced motion", async () => {
    resetWebGLCache(true);
    mockMatchMedia(["prefers-reduced-motion"]);
    render(<StlModelPreview buffer={boxStl(10, 10, 10)} />);
    await waitFor(() => expect(three.stages).toHaveLength(1));
    expect(three.stages[0].opts.reducedMotion).toBe(true);
  });

  it("explains a file it cannot read", async () => {
    resetWebGLCache(true);
    render(<StlModelPreview buffer={new ArrayBuffer(120)} />);
    expect((await screen.findByText(/could not draw this file/)).textContent).toContain("no triangles");
    expect(three.stages).toHaveLength(0);
  });
});

describe("DxfModelPreview", () => {
  it("shows the 2D outline with cuts and engraving told apart when WebGL is off", () => {
    resetWebGLCache(false);
    render(<DxfModelPreview geometry={plate} unitScale={1} thicknessMm={3} materialName="Clear Acrylic 3 mm" />);

    const svg = screen.getByTestId("dxf-preview-2d");
    const lines = svg.querySelectorAll("polyline");
    expect(lines).toHaveLength(3);
    expect(lines[0].getAttribute("stroke-dasharray")).toBeNull();
    expect(lines[2].getAttribute("stroke-dasharray")).toBe("4 3");
    expect(screen.getByTestId("dxf-preview-webgl-off").textContent).toContain("Showing the 2D outline");
    expect(screen.getByTestId("dxf-preview-legend").textContent).toContain("Engrave (dashed)");
    expect(screen.getByTestId("dxf-preview-material").textContent).toBe("Acrylic · Clear");
    expect(screen.getByTestId("dxf-preview-size").textContent).toContain("160 × 90 mm");
    expect(screen.queryByRole("button", { name: "Outline" })).toBeNull();
  });

  it("extrudes the cut outline on the stock sheet and switches to the flat outline on request", () => {
    resetWebGLCache(true);
    three.laser = { exceedsSheet: true, hasSheet: true };
    render(
      <DxfModelPreview
        geometry={plate}
        unitScale={1}
        thicknessMm={3}
        materialName="Birch Plywood 3 mm"
        sheetWidthMm={100}
        sheetHeightMm={100}
      />,
    );

    expect(three.stages).toHaveLength(1);
    const input = three.buildLaserScene.mock.calls[0][1];
    expect(input.regions).toHaveLength(1);
    expect(input.regions[0].holes).toHaveLength(1);
    expect(input.cutPaths).toHaveLength(2);
    expect(input.engravePaths).toHaveLength(1);
    expect(input.thicknessMm).toBe(3);
    expect(input.sheet).toEqual({ widthMm: 100, heightMm: 100 });
    expect(input.appearance.texture).toBe("wood-grain");
    expect(screen.getByTestId("dxf-preview-exceeds").textContent).toContain("100 × 100 mm sheet");

    fireEvent.click(screen.getByRole("button", { name: /Sheet/ }));
    expect(three.stages[0].setView).toHaveBeenCalledWith("sheet");

    fireEvent.click(screen.getByRole("button", { name: "Outline" }));
    expect(screen.getByTestId("dxf-preview-2d")).toBeTruthy();
    expect(three.stages[0].dispose).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Show 3D" }));
    expect(screen.getByTestId("dxf-preview-3d")).toBeTruthy();
    expect(three.stages).toHaveLength(2);
  });

  it("falls back to 2D when the drawing has no closed outline to extrude", () => {
    resetWebGLCache(true);
    const open: DxfGeometry = { ...plate, paths: [{ points: [[0, 0], [160, 90]], closed: false, layer: "0" }] };
    render(<DxfModelPreview geometry={open} unitScale={1} />);
    expect(screen.getByTestId("dxf-preview-2d")).toBeTruthy();
    expect(screen.getByText(/No closed outlines found/)).toBeTruthy();
    expect(three.stages).toHaveLength(0);
  });
});

describe("BookedStlPreview", () => {
  const part = (n: number): FabricationPart => ({
    kind: "print",
    analysis_id: `p${n}`,
    name: `Gear ${n}`,
    filename: `gear${n}.stl`,
    quantity: 1,
    material_name: "Black PLA",
    weight_g_each: 12,
    time_min_each: 45,
  });

  it("downloads each booked model when it is first shown and moves between models", async () => {
    resetWebGLCache(false);
    api.getPrintAnalysisStlBuffer.mockImplementation(async (id: string) =>
      id === "p1" ? { buffer: boxStl(20, 10, 5) } : { error: "Not found" },
    );
    render(<BookedStlPreview parts={[part(1), part(2)]} />);

    await waitFor(() => expect(api.getPrintAnalysisStlBuffer).toHaveBeenCalledWith("p1", expect.anything()));
    expect((await screen.findByTestId("stl-preview-size")).textContent).toContain("20 × 10 × 5 mm");
    expect(screen.getByTestId("stl-preview-stats").textContent).toContain("12 g");
    expect(screen.getByTestId("stl-preview-position").textContent).toBe("Model 1 of 2");

    fireEvent.click(screen.getByRole("button", { name: "Next model" }));
    expect((await screen.findByText(/could not be loaded for the preview/)).textContent).toContain("Not found");
    expect(screen.getByTestId("stl-preview-position").textContent).toBe("Model 2 of 2");

    fireEvent.click(screen.getByRole("button", { name: "Previous model" }));
    expect(api.getPrintAnalysisStlBuffer).toHaveBeenCalledTimes(2);
  });

  it("draws the default 220 × 220 mm plate when the printer has no maximum size", async () => {
    resetWebGLCache(true);
    api.getPrintAnalysisStlBuffer.mockResolvedValue({ buffer: boxStl(240, 10, 5) });
    render(<BookedStlPreview parts={[part(1)]} maxPrintSize={null} />);

    await waitFor(() => expect(three.buildPrintScene).toHaveBeenCalled());
    const [, , , bed, , options] = three.buildPrintScene.mock.calls[0];
    expect(bed).toEqual({ x: 220, y: 220, z: 250 });
    expect(options).toEqual({ overLimit: false });
    expect(screen.getByTestId("stl-preview-plate").textContent).toBe("Build plate 220 × 220 mm");
    expect(screen.queryByTestId("stl-preview-too-large")).toBeNull();
  });

  it("uses the OIC's maximum print size as the plate and highlights a model that is too large", async () => {
    resetWebGLCache(true);
    api.getPrintAnalysisStlBuffer.mockResolvedValue({ buffer: boxStl(300, 10, 5) });
    render(
      <BookedStlPreview parts={[part(1)]} maxPrintSize={{ x: "256", y: "256", z: "256", allow_rotation: true }} />,
    );

    await waitFor(() => expect(three.buildPrintScene).toHaveBeenCalled());
    const [, , , bed, , options] = three.buildPrintScene.mock.calls[0];
    expect(bed).toEqual({ x: 256, y: 256, z: 256 });
    expect(options).toEqual({ overLimit: true });
    expect(screen.getByTestId("stl-preview-plate").textContent).toBe("Build plate 256 × 256 mm");
    expect(screen.getByTestId("stl-preview-too-large").textContent).toBe(
      "Too large for this printer (maximum 256 × 256 × 256 mm).",
    );
  });

  it("does not highlight a model that fits the configured plate", async () => {
    resetWebGLCache(true);
    api.getPrintAnalysisStlBuffer.mockResolvedValue({ buffer: boxStl(200, 10, 5) });
    render(<BookedStlPreview parts={[part(1)]} maxPrintSize={{ x: 256, y: 256, z: 256 }} />);
    await waitFor(() => expect(three.buildPrintScene).toHaveBeenCalled());
    expect(three.buildPrintScene.mock.calls[0][5]).toEqual({ overLimit: false });
    expect(screen.queryByTestId("stl-preview-too-large")).toBeNull();
  });

  it("opens a booked part in the user's orientation with its supports", async () => {
    resetWebGLCache(true);
    api.getPrintAnalysisStlBuffer.mockResolvedValue({ buffer: boxStl(40, 20, 5) });
    const oriented: FabricationPart = {
      ...part(1),
      orientation: [0, 0, 1, 0, 1, 0, -1, 0, 0],
      support_mode: "buildplate",
      support_g_each: 2.4,
      support_angle_deg: 50,
    };
    render(<BookedStlPreview parts={[oriented]} maxPrintSize={{ x: 256, y: 256, z: 256 }} />);
    expect((await screen.findByTestId("stl-preview-orientation-note")).textContent).toBe("User-selected orientation");
    expect((await screen.findByTestId("stl-preview-size")).textContent).toContain("5 × 20 × 40 mm");
    expect(screen.getByTestId("stl-preview-supports").textContent).toContain("Supports ~2.4 g");
    await waitFor(() => expect(three.buildPrintScene).toHaveBeenCalled());
    expect(three.buildPrintScene.mock.calls.at(-1)[5]).toMatchObject({ overLimit: false, supports: expect.any(Object) });
  });

  it("draws a booked part like the booking page: layer height and separate support material colour", async () => {
    resetWebGLCache(true);
    api.getPrintAnalysisStlBuffer.mockResolvedValue({ buffer: boxStl(40, 20, 5) });
    const booked: FabricationPart = {
      ...part(1),
      support_mode: "everywhere",
      support_g_each: 3,
      support_material_code: "PVA",
      layer_height_mm: "0.12",
      print_progress: [0.5, 1],
      print_minutes: 42.5,
      warmup_minutes: 6,
    };
    render(<BookedStlPreview parts={[booked]} maxPrintSize={{ x: 256, y: 256, z: 256 }} />);
    await waitFor(() => expect(three.buildPrintScene).toHaveBeenCalled());
    const call = three.buildPrintScene.mock.calls.at(-1);
    expect(call[4]).toBe(0.12);
    expect(call[5]).toMatchObject({ supportColor: "#f59e0b" });
  });

  it("shows the download progress, and when the model cannot be loaded offers Try again and Download STL", async () => {
    let finish: (res: { buffer?: ArrayBuffer; error?: string }) => void = () => {};
    api.getPrintAnalysisStlBuffer.mockImplementationOnce(
      (_id: string, options: { onProgress?: (loaded: number, total: number | null) => void }) =>
        new Promise((resolve) => {
          options.onProgress?.(5 * 1024 * 1024, 35 * 1024 * 1024);
          finish = resolve;
        }),
    );
    const onDownload = vi.fn();
    render(<BookedStlPreview parts={[part(1)]} onDownload={onDownload} />);

    expect((await screen.findByTestId("booked-stl-loading")).textContent).toContain("Downloading the model… 5.0 of 35.0 MB");
    finish({ error: "the download stopped responding" });
    expect((await screen.findByTestId("booked-stl-error")).textContent).toContain("the download stopped responding");

    fireEvent.click(screen.getByRole("button", { name: "Download STL" }));
    expect(onDownload).toHaveBeenCalledWith(expect.objectContaining({ analysis_id: "p1" }));

    resetWebGLCache(true);
    api.getPrintAnalysisStlBuffer.mockResolvedValueOnce({ buffer: boxStl(20, 10, 5) });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect((await screen.findByTestId("stl-preview-size")).textContent).toContain("20 × 10 × 5 mm");
    expect(api.getPrintAnalysisStlBuffer).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId("booked-stl-error")).toBeNull();
  });

  it("previews a booking like IICTEST-3DP-01202600002: two STLs, the first turned on the plate, with model info", async () => {
    resetWebGLCache(true);
    api.getPrintAnalysisStlBuffer.mockImplementation(async (id: string) => ({
      buffer: id === "gear-uuid" ? boxStl(40, 20, 5) : boxStl(30, 30, 10),
    }));
    // fabrication_parts as GET /api/bookings/?booking_id=… returns them for the owner, OIC, operator and admin.
    const parts: FabricationPart[] = [
      {
        ...part(1),
        analysis_id: "gear-uuid",
        name: "gear",
        filename: "gear.stl",
        weight_g_each: 11,
        time_min_each: 30,
        orientation: [1, 0, 0, 0, -1, 0, 0, 0, -1],
        file_available: true,
        volume_cm3: 8.23,
        layer_height_mm: 0.2,
      },
      { ...part(2), analysis_id: "hub-uuid", name: "hub", filename: "hub.stl", file_available: true, volume_cm3: null },
    ];
    render(<BookedStlPreview parts={parts} maxPrintSize={{ x: 256, y: 256, z: 256 }} />);

    await waitFor(() => expect(api.getPrintAnalysisStlBuffer).toHaveBeenCalledWith("gear-uuid", expect.anything()));
    expect((await screen.findByTestId("stl-preview-size")).textContent).toContain("40 × 20 × 5 mm");
    expect(screen.getByTestId("stl-preview-orientation-note").textContent).toBe("User-selected orientation");
    expect(screen.getByTestId("stl-preview-stats").textContent).toContain("11 g");
    expect(screen.getByTestId("booked-stl-volume").textContent).toBe("8.23 cm³");
    expect(screen.getByTestId("booked-stl-info").textContent).toContain("Volume (one copy)8.23 cm³");
    expect(screen.getByTestId("booked-stl-info").textContent).toContain("Weight (one copy)11 g");
    expect(screen.getByTestId("stl-preview-position").textContent).toBe("Model 1 of 2");

    fireEvent.click(screen.getByRole("button", { name: "Next model" }));
    await waitFor(() => expect(api.getPrintAnalysisStlBuffer).toHaveBeenCalledWith("hub-uuid", expect.anything()));
    await waitFor(() => expect(screen.getByTestId("stl-preview-size").textContent).toContain("30 × 30 × 10 mm"));
    expect(screen.queryByTestId("booked-stl-volume")).toBeNull();
  });
});

describe("bookedPrintTimeline", () => {
  const base: FabricationPart = { kind: "print", analysis_id: "p1", name: "Gear", quantity: 2, time_min_each: 40 };

  it("uses the saved estimate's progress, print and warm-up minutes for one copy", () => {
    expect(bookedPrintTimeline({ ...base, print_progress: [0.25, 1], print_minutes: "42.5", warmup_minutes: 6 })).toEqual({
      progress: [0.25, 1],
      printMinutes: 42.5,
      warmupMinutes: 6,
    });
  });

  it("falls back to the per-copy time of bookings made before the breakdown was saved", () => {
    expect(bookedPrintTimeline(base)).toEqual({ progress: null, printMinutes: 40, warmupMinutes: null });
    expect(bookedPrintTimeline({ ...base, time_min_each: null })).toBeNull();
  });
});

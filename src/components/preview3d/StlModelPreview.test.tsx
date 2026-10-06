// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  buildPrintScene: vi.fn(),
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

import { StlModelPreview } from "@/components/StlModelPreview";

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

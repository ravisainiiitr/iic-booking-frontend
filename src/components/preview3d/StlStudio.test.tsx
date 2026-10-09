// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { resetWebGLCache } from "@/lib/preview3d/env";
import { clearStlMeshCache } from "@/lib/preview3d/loadStlMesh";
import { faceDownRotation } from "@/lib/preview3d/orientation";

const three = vi.hoisted(() => ({
  calls: [] as unknown[][],
  scene: null as null | {
    materials: Array<{ wireframe: boolean }>;
    supports: { visible: boolean } | null;
    overhangs: { visible: boolean } | null;
    setCut: ReturnType<typeof vi.fn>;
  },
  stages: 0,
}));

vi.mock("@/components/preview3d/stage", () => ({
  PreviewStage: class {
    setView = vi.fn();
    setOverlayVisible = vi.fn();
    invalidate = vi.fn();
    dispose = vi.fn();
    clearContent = vi.fn();
    constructor() {
      three.stages += 1;
    }
  },
  disposeObject: vi.fn(),
}));
vi.mock("@/components/preview3d/printScene", () => ({
  buildPrintScene: (...args: unknown[]) => {
    three.calls.push(args);
    const opts = args[5] as { supports?: { count: number } };
    three.scene = {
      materials: [{ wireframe: false }],
      supports: opts.supports?.count ? { visible: true } : null,
      overhangs: opts.supports ? { visible: false } : null,
      setCut: vi.fn(),
    };
    return { ...three.scene, size: [0, 0, 0], exceedsBed: false };
  },
}));

import { StlModelPreview, timeAtHeight } from "@/components/StlModelPreview";

// Boxes (x, y, z, w, d, h) as a binary STL (Z up).
function boxesStl(...specs: number[][]): ArrayBuffer {
  const BOX = [
    [[0, 0, 0], [1, 1, 0], [1, 0, 0]], [[0, 0, 0], [0, 1, 0], [1, 1, 0]],
    [[0, 0, 1], [1, 0, 1], [1, 1, 1]], [[0, 0, 1], [1, 1, 1], [0, 1, 1]],
    [[0, 0, 0], [1, 0, 0], [1, 0, 1]], [[0, 0, 0], [1, 0, 1], [0, 0, 1]],
    [[0, 1, 0], [1, 1, 1], [1, 1, 0]], [[0, 1, 0], [0, 1, 1], [1, 1, 1]],
    [[0, 0, 0], [0, 0, 1], [0, 1, 1]], [[0, 0, 0], [0, 1, 1], [0, 1, 0]],
    [[1, 0, 0], [1, 1, 0], [1, 1, 1]], [[1, 0, 0], [1, 1, 1], [1, 0, 1]],
  ];
  const tris: number[][] = [];
  for (const [x, y, z, w, d, h] of specs) {
    for (const t of BOX) tris.push(t.flatMap(([a, b, c]) => [x + a * w, y + b * d, z + c * h]));
  }
  const buf = new ArrayBuffer(84 + tris.length * 50);
  const view = new DataView(buf);
  view.setUint32(80, tris.length, true);
  tris.forEach((t, i) => t.forEach((v, k) => view.setFloat32(84 + i * 50 + 12 + k * 4, v, true)));
  return buf;
}

const bracket = () => boxesStl([0, 0, 0, 10, 20, 40], [10, 0, 30, 30, 20, 10]);

beforeEach(() => {
  three.calls = [];
  three.scene = null;
  three.stages = 0;
  clearStlMeshCache();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {} }),
  });
  resetWebGLCache(true);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  resetWebGLCache(null);
});

describe("StlModelPreview: supports, orientation and layers", () => {
  it("shows generated supports and lets the user hide them or highlight overhangs", async () => {
    render(
      <StlModelPreview
        buffer={bracket()}
        bedSize={{ x: 220, y: 220, z: 250 }}
        layerHeightMm={0.2}
        supports={{ mode: "buildplate", angleDeg: 45, summary: "Supports ~3.1 g" }}
      />,
    );
    await waitFor(() => expect(three.calls.length).toBeGreaterThan(0));
    const opts = three.calls.at(-1)![5] as { supports: { count: number; overhangTriangles: Uint32Array }; supportColor: string };
    expect(opts.supports.count).toBeGreaterThan(20);
    expect(opts.supports.overhangTriangles.length).toBeGreaterThan(0);
    expect(opts.supportColor).toMatch(/^#/);
    expect(screen.getByTestId("stl-preview-supports").textContent).toContain("Supports ~3.1 g");

    fireEvent.click(screen.getByTestId("stl-preview-toggle-supports"));
    expect(three.scene!.supports!.visible).toBe(false);
    fireEvent.click(screen.getByTestId("stl-preview-toggle-overhangs"));
    expect(three.scene!.overhangs!.visible).toBe(true);
    expect(three.stages).toBe(1);
  });

  it("shows no supports for 'none' and re-draws the turned model on the same stage", async () => {
    const buffer = bracket();
    const { rerender } = render(
      <StlModelPreview buffer={buffer} bedSize={{ x: 220, y: 220, z: 250 }} supports={{ mode: "none" }} />,
    );
    await waitFor(() => expect(three.calls.length).toBeGreaterThan(0));
    expect((three.calls.at(-1)![5] as { supports: { count: number } }).supports.count).toBe(0);
    expect(screen.getByTestId("stl-preview-supports").textContent).toBe("No supports");
    expect((screen.getByTestId("stl-preview-toggle-supports") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("stl-preview-size").textContent).toContain("40 × 20 × 40 mm");

    const lying = faceDownRotation([0, -1, 0]);
    rerender(
      <StlModelPreview
        buffer={buffer}
        bedSize={{ x: 220, y: 220, z: 250 }}
        supports={{ mode: "none" }}
        orientation={lying}
        orientationNote="User-selected orientation"
      />,
    );
    await waitFor(() => expect(screen.getByTestId("stl-preview-size").textContent).toContain("40 × 40 × 20 mm"));
    expect(screen.getByTestId("stl-preview-orientation-note").textContent).toBe("User-selected orientation");
    expect(three.stages).toBe(1);
    expect((three.calls.at(-1)![5] as { keepView?: boolean }).keepView).toBe(true);
  });

  it("re-checks the size limit for the turned model", async () => {
    const limit = { x: 30, y: 50, z: 50, allowRotation: false };
    const buffer = bracket();
    const { rerender } = render(<StlModelPreview buffer={buffer} sizeLimit={limit} />);
    await waitFor(() => expect(three.calls.length).toBeGreaterThan(0));
    rerender(<StlModelPreview buffer={buffer} sizeLimit={limit} orientation={faceDownRotation([1, 0, 0])} />);
    // On its side the bracket is 40 wide: over the 30 mm limit.
    expect((await screen.findByTestId("stl-preview-too-large")).textContent).toContain("30 × 50 × 50 mm");
  });

  it("previews the print layer by layer with the time at that height", async () => {
    render(
      <StlModelPreview
        buffer={bracket()}
        layerHeightMm={0.2}
        timeline={{ progress: [0.5, 1], printMinutes: 70, warmupMinutes: 10 }}
      />,
    );
    const slider = (await screen.findByTestId("stl-preview-layer-slider")) as HTMLInputElement;
    expect(slider.max).toBe("200");
    expect(screen.getByTestId("stl-preview-layer-label").textContent).toContain("done after ~1 h 10 min");
    fireEvent.change(slider, { target: { value: "100" } });
    expect(screen.getByTestId("stl-preview-layer-label").textContent).toBe("Layer 100 / 200 · 20 mm · ~40 min into the print");
    await waitFor(() => expect(three.scene!.setCut).toHaveBeenLastCalledWith(20));
  });

  it("works out the time at a height from the estimate's profile", () => {
    const t = { progress: [0.2, 0.6, 1], printMinutes: 100, warmupMinutes: 10 };
    expect(timeAtHeight(t, 0)).toBe(10);
    expect(timeAtHeight(t, 1)).toBe(100);
    expect(timeAtHeight(t, 1 / 3)).toBeCloseTo(10 + 0.2 * 90, 5);
    expect(timeAtHeight(t, 0.5)).toBeCloseTo(10 + 0.4 * 90, 5);
    expect(timeAtHeight({ printMinutes: 0 }, 0.5)).toBeNull();
  });
});

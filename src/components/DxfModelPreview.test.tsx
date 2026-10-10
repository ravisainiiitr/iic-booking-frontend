// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DxfModelPreview } from "@/components/DxfModelPreview";
import type { DxfGeometry, DxfPath } from "@/lib/dxfGeometry";

const square = (x: number, y: number, s: number, layer: string): DxfPath => ({
  points: [
    [x, y],
    [x + s, y],
    [x + s, y + s],
    [x, y + s],
  ],
  closed: true,
  layer,
});

const geometry: DxfGeometry = {
  paths: [square(0, 0, 100, "CUT"), square(20, 20, 10, "ENGRAVE")],
  bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
  detectedUnits: "mm",
  entityCount: 2,
  warnings: [],
};

const shapes = () => screen.getByTestId("dxf-preview-2d").querySelectorAll("g > *").length;
const viewWidth = () => Number(screen.getByTestId("dxf-preview-2d").getAttribute("viewBox")!.split(" ")[2]);

afterEach(cleanup);

describe("DxfModelPreview 2D outline", () => {
  it("hides and shows the cut and engrave layers", () => {
    render(<DxfModelPreview geometry={geometry} unitScale={1} force2d />);
    expect(shapes()).toBe(2);
    fireEvent.click(screen.getByTestId("dxf-preview-layer-engrave"));
    expect(screen.getByTestId("dxf-preview-layer-engrave").getAttribute("aria-pressed")).toBe("false");
    expect(shapes()).toBe(1);
    fireEvent.click(screen.getByTestId("dxf-preview-layer-cut"));
    expect(shapes()).toBe(0);
    fireEvent.click(screen.getByTestId("dxf-preview-layer-engrave"));
    expect(shapes()).toBe(1);
  });

  it("zooms with the buttons and the keyboard and fits back", () => {
    render(<DxfModelPreview geometry={geometry} unitScale={1} force2d heightClass="h-[60vh]" />);
    const full = viewWidth();
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(viewWidth()).toBeCloseTo(full / 1.25);
    fireEvent.keyDown(screen.getByTestId("dxf-preview-2d"), { key: "+" });
    expect(viewWidth()).toBeCloseTo(full / 1.25 / 1.25);
    fireEvent.click(screen.getByRole("button", { name: "Fit the drawing" }));
    expect(viewWidth()).toBeCloseTo(full);
    expect(screen.getByRole("button", { name: "Zoom out" })).toHaveProperty("disabled", true);
  });
});

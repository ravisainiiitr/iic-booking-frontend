// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import type { DxfGeometry } from "@/lib/dxfGeometry";
import type { FabricationPart } from "@/lib/api";

const api = vi.hoisted(() => ({ getLaserCutDxfText: vi.fn() }));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiClient: api,
}));
vi.mock("@/components/DxfModelPreview", () => {
  const Stub = ({ widthMm, materialFamily }: { widthMm?: number | null; materialFamily?: string | null }) => (
    <div data-testid="dxf-preview-stub" data-family={materialFamily ?? ""}>
      {widthMm}
    </div>
  );
  return { default: Stub, DxfModelPreview: Stub };
});

import { DxfPreviewNavigator, laserPartMetrics, type DxfPreviewItem } from "@/components/DxfPreviewNavigator";
import { BookedDxfPreview } from "@/components/FabricationBookingParts";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const square: DxfGeometry = {
  paths: [{ points: [[0, 0], [10, 0], [10, 10], [0, 10]], closed: true }],
  bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
  detectedUnits: "mm",
  entityCount: 1,
  warnings: [],
};

function item(n: number, over: Partial<DxfPreviewItem> = {}): DxfPreviewItem {
  return {
    id: `p${n}`,
    name: `Part ${n}`,
    filename: `part${n}.dxf`,
    geometry: square,
    unitScale: 1,
    widthMm: n * 100,
    heightMm: 50,
    metrics: laserPartMetrics({ widthMm: n * 100, heightMm: 50, quantity: n }),
    ...over,
  };
}

function Harness({ items }: { items: DxfPreviewItem[] }) {
  const [active, setActive] = useState<string | null>(items[0].id);
  return <DxfPreviewNavigator items={items} activeId={active} onActiveChange={setActive} />;
}

describe("DxfPreviewNavigator", () => {
  it("moves between files with previous / next and shows each file's measurements", async () => {
    render(<Harness items={[item(1), item(2), item(3)]} />);

    expect(screen.getByTestId("dxf-preview-position").textContent).toBe("File 1 of 3");
    expect((screen.getByRole("button", { name: "Previous file" }) as HTMLButtonElement).disabled).toBe(true);
    expect((await screen.findByTestId("dxf-preview-stub")).textContent).toBe("100");

    fireEvent.click(screen.getByRole("button", { name: "Next file" }));
    expect(screen.getByTestId("dxf-preview-position").textContent).toBe("File 2 of 3");
    expect(screen.getByRole("tab", { name: /Part 2/ }).getAttribute("aria-selected")).toBe("true");
    expect((await screen.findByTestId("dxf-preview-stub")).textContent).toBe("200");
    expect(screen.getByTestId("dxf-preview-metrics").textContent).toContain("200 × 50 mm");
    expect(screen.getByTestId("dxf-preview-metrics").textContent).toContain("Quantity2");

    fireEvent.click(screen.getByRole("button", { name: "Next file" }));
    expect((screen.getByRole("button", { name: "Next file" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("supports arrow keys, Home / End on the file tabs and a tap on a file name", () => {
    render(<Harness items={[item(1), item(2), item(3)]} />);
    const first = screen.getByRole("tab", { name: /Part 1/ });

    fireEvent.keyDown(first, { key: "ArrowRight" });
    const second = screen.getByRole("tab", { name: /Part 2/ });
    expect(second.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(second);

    fireEvent.keyDown(second, { key: "End" });
    expect(screen.getByTestId("dxf-preview-position").textContent).toBe("File 3 of 3");
    fireEvent.keyDown(screen.getByRole("tab", { name: /Part 3/ }), { key: "Home" });
    expect(screen.getByTestId("dxf-preview-position").textContent).toBe("File 1 of 3");

    fireEvent.click(screen.getByRole("tab", { name: /Part 3/ }));
    expect(screen.getByTestId("dxf-preview-position").textContent).toBe("File 3 of 3");
  });

  it("swipes to the next / previous file on touch screens", () => {
    render(<Harness items={[item(1), item(2)]} />);
    const area = screen.getByTestId("dxf-preview-metrics");

    fireEvent.touchStart(area, { touches: [{ clientX: 300, clientY: 100 }] });
    fireEvent.touchEnd(area, { changedTouches: [{ clientX: 180, clientY: 110 }] });
    expect(screen.getByTestId("dxf-preview-position").textContent).toBe("File 2 of 2");

    fireEvent.touchStart(area, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchEnd(area, { changedTouches: [{ clientX: 120, clientY: 300 }] });
    expect(screen.getByTestId("dxf-preview-position").textContent).toBe("File 2 of 2");
  });

  it("hides the navigation for a single file and explains files it cannot draw", () => {
    const { unmount } = render(<Harness items={[item(1, { geometry: null })]} />);
    expect(screen.queryByTestId("dxf-preview-position")).toBeNull();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.getByText(/cannot draw this file/).textContent).toContain("100 × 50 mm");
    unmount();

    render(<Harness items={[item(1, { error: "This DXF could not be read." }), item(2)]} />);
    expect(screen.getByText("This DXF could not be read.")).toBeTruthy();
  });
});

describe("BookedDxfPreview", () => {
  const dxf = ["0", "SECTION", "2", "ENTITIES", "0", "LINE", "8", "0", "10", "0", "20", "0", "11", "100", "21", "0", "0", "ENDSEC", "0", "EOF"].join("\n");
  const part = (n: number): FabricationPart => ({
    kind: "laser",
    analysis_id: `a${n}`,
    name: `Bracket ${n}`,
    filename: `bracket${n}.dxf`,
    quantity: 1,
    units: "mm",
    width_mm: String(n * 100),
    height_mm: "50",
    area_mm2: String(n * 5000),
    material_name: "Acrylic 3 mm",
    thickness_mm: "3",
  });

  it("loads each booked drawing when it is first shown", async () => {
    api.getLaserCutDxfText.mockResolvedValue({ text: dxf });
    render(<BookedDxfPreview parts={[part(1), part(2)]} />);

    await waitFor(() => expect(api.getLaserCutDxfText).toHaveBeenCalledWith("a1"));
    expect(api.getLaserCutDxfText).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("dxf-preview-metrics").textContent).toContain("Acrylic 3 mm (3 mm)");

    fireEvent.click(screen.getByRole("button", { name: "Next file" }));
    await waitFor(() => expect(api.getLaserCutDxfText).toHaveBeenCalledWith("a2"));
    expect(screen.getByTestId("dxf-preview-position").textContent).toBe("File 2 of 2");

    fireEvent.click(screen.getByRole("button", { name: "Previous file" }));
    expect(api.getLaserCutDxfText).toHaveBeenCalledTimes(2);
  });

  it("gives the 3D view the sheet's material family, as on the booking page", async () => {
    api.getLaserCutDxfText.mockResolvedValue({ text: dxf });
    render(<BookedDxfPreview parts={[{ ...part(1), material_family: "ACRYLIC" }]} />);
    expect((await screen.findByTestId("dxf-preview-stub")).getAttribute("data-family")).toBe("ACRYLIC");
  });
});

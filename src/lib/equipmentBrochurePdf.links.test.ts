import { afterEach, describe, expect, it, vi } from "vitest";

const saved = vi.hoisted(() => [] as string[]);

vi.mock("jspdf", async (importOriginal) => {
  const real = await importOriginal<typeof import("jspdf")>();
  class CapturingPdf extends real.jsPDF {
    constructor(...args: ConstructorParameters<typeof real.jsPDF>) {
      super(...args);
      this.save = (() => {
        saved.push(this.output());
        return this;
      }) as never;
    }
  }
  return { ...real, jsPDF: CapturingPdf };
});
vi.mock("@/lib/api", () => ({ apiClient: { getEquipmentImageProxyPath: () => "/img" } }));
vi.mock("@/lib/pdfLetterhead", () => ({
  DEFAULT_DEPARTMENT_NAME: "IIC",
  PDF_BRAND_RGB: [21, 63, 121],
  PDF_INK_RGB: [15, 23, 42],
  drawPdfLetterhead: vi.fn(async () => 120),
}));

import { exportDepartmentBrochurePdf, type EquipmentBrochurePdfInput } from "./equipmentBrochurePdf";

const equipment = (id: number, name: string): EquipmentBrochurePdfInput => ({
  equipmentId: id,
  name,
  code: `EQ${id}`,
  generalSpecs: [],
  sampleSpecs: [],
  chargeRows: [],
  contacts: [],
});

afterEach(() => vi.unstubAllGlobals());

describe("department brochure PDF", () => {
  it("links contents to each equipment page, back to the contents, and lists them as bookmarks", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));

    await exportDepartmentBrochurePdf("IIC", [equipment(1, "XRD"), equipment(2, "FE-SEM")]);

    const pdf = saved.at(-1) ?? "";
    expect(pdf).toContain("/Outlines");
    expect(pdf).toContain("(1. XRD \\(EQ1\\))");
    expect(pdf).toContain("(2. FE-SEM \\(EQ2\\))");
    // Contents rows (2) and "Back to contents" on each equipment page (2) are in-document links.
    const internalLinks = pdf.match(/\/Subtype \/Link[^]*?\/Dest \[/g) ?? [];
    expect(internalLinks.length).toBeGreaterThanOrEqual(4);
    expect(pdf).not.toMatch(/\/URI/);
  });
});

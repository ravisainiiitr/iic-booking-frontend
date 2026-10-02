// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { SampleRequirementsTable } from "@/components/booking/SampleRequirementsTable";
import { printElement } from "./jobSheet";

const field = (i: number) => ({ field_key: String.fromCharCode(65 + i), field_label: `Input ${i + 1}`, field_type: "TEXT" });
const valuesFor = (columns: number) =>
  Object.fromEntries(Array.from({ length: columns }, (_, i) => [String.fromCharCode(65 + i), `v${i + 1}`]));

const printSheet = (columns: number, extraSets = 1) => {
  const fields = Array.from({ length: columns }, (_, i) => field(i));
  const values = { ...valuesFor(columns), _sample_sets: Array.from({ length: extraSets }, () => valuesFor(columns)) };
  const { container } = render(<SampleRequirementsTable fields={fields} inputValues={values} />);
  let classesWhilePrinting: string[] = [];
  vi.spyOn(window, "print").mockImplementation(() => {
    classesWhilePrinting = Array.from(document.documentElement.classList);
  });
  printElement(container);
  const portal = document.getElementById("jobsheet-print-portal")!;
  return { portal, classesWhilePrinting };
};

afterEach(() => {
  window.dispatchEvent(new Event("afterprint"));
  vi.restoreAllMocks();
  cleanup();
});

describe("Print job sheet", () => {
  it("prints the same sets-as-rows table on portrait A4 when it is narrow", () => {
    const { portal, classesWhilePrinting } = printSheet(3, 2);
    const rows = Array.from(portal.querySelectorAll("tbody > tr > th")).map((th) => th.textContent);
    expect(rows).toEqual(["Set 1", "Set 2", "Set 3"]);
    expect(Array.from(portal.querySelectorAll("thead th")).map((th) => th.textContent)).toEqual([
      "Set",
      "Input 1",
      "Input 2",
      "Input 3",
    ]);
    expect(classesWhilePrinting).toContain("print-jobsheet");
    expect(classesWhilePrinting).not.toContain("print-jobsheet-landscape");
  });

  it("switches to landscape for many inputs and a smaller font for very many", () => {
    expect(printSheet(6).classesWhilePrinting).toContain("print-jobsheet-landscape");
    cleanup();
    window.dispatchEvent(new Event("afterprint"));
    const wide = printSheet(10).classesWhilePrinting;
    expect(wide).toEqual(expect.arrayContaining(["print-jobsheet-landscape", "print-jobsheet-compact"]));
  });

  it("removes the print classes after printing", () => {
    printSheet(8);
    window.dispatchEvent(new Event("afterprint"));
    expect(document.documentElement.classList.contains("print-jobsheet-landscape")).toBe(false);
    expect(document.getElementById("jobsheet-print-portal")).toBeNull();
  });
});

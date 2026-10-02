import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/lib/api", () => ({ apiClient: {} }));

import SampleSetsEditor, { type SampleSetField } from "@/components/SampleSetsEditor";
import {
  formulaLimitNote,
  sampleSetFieldBounds,
  sampleSetFieldLimitError,
} from "@/lib/sampleSetLimits";

const B_LABEL = "Number of Slots ( Slot Duration: 1.5 Hours )";

/** Production FE-SEM APREO (probe 2026-10-02): A max formula B*4; B with no limits; C a radio. */
const apreo: SampleSetField[] = [
  {
    field_key: "A",
    field_label: "No. of Samples",
    field_type: "NUMERIC",
    options: { min: 1, max_formula: "B*4" },
    default_value: "1",
    is_required: true,
  },
  { field_key: "B", field_label: B_LABEL, field_type: "NUMERIC", options: [], default_value: "1", is_required: true },
  {
    field_key: "C",
    field_label: "Do You want to Avail Gold Coating Facility?",
    field_type: "RADIO",
    options: ["Yes", "No"],
    default_value: "No",
  },
];
const [fieldA] = apreo;
const formulaError = (max: number, b: number, set = 2) =>
  `Sample set ${set}: No. of Samples cannot be greater than ${max} (B × 4, where B is ${B_LABEL} = ${b}).`;

describe("sampleSetFieldBounds", () => {
  it("works out A's formula maximum from the set's own B", () => {
    expect(sampleSetFieldBounds(fieldA, { A: "1", B: "2" })).toEqual({ min: 1, max: 8, step: 1 });
    expect(sampleSetFieldBounds(fieldA, { A: "1", B: 3 })).toEqual({ min: 1, max: 12, step: 1 });
    expect(sampleSetFieldBounds(fieldA, { A: "1", B: "1" })).toEqual({ min: 1, max: 4, step: 1 });
  });

  it("skips the formula for external booking users, as sample set 1 does", () => {
    expect(sampleSetFieldBounds(fieldA, { B: "1" }, { skipFormulaLimits: true }).max).toBe(100);
  });

  it("supports SLOT_DURATION_MINUTES and legacy plain-formula options", () => {
    const field = { field_key: "A", field_type: "NUMERIC", options: "SLOT_DURATION_MINUTES/B" };
    expect(sampleSetFieldBounds(field, { B: 3 }, { slotDurationMinutes: 90 }).max).toBe(30);
  });
});

describe("sampleSetFieldLimitError", () => {
  it("rejects set 2's A above 4 × its own B and names the set", () => {
    expect(sampleSetFieldLimitError(apreo, [{ A: "9", B: "2", C: "No" }])).toBe(formulaError(8, 2));
  });

  it("uses each set's own B, never sample set 1's", () => {
    expect(sampleSetFieldLimitError(apreo, [{ A: "12", B: "3" }])).toBeNull();
    expect(sampleSetFieldLimitError(apreo, [{ A: "5", B: "1" }])).toBe(formulaError(4, 1));
    expect(sampleSetFieldLimitError(apreo, [{ A: "8", B: "2" }, { A: "9", B: "2" }])).toBe(formulaError(8, 2, 3));
  });

  it("re-checks A when B in that set is lowered", () => {
    const sets = [{ A: "8", B: "2" }];
    expect(sampleSetFieldLimitError(apreo, sets)).toBeNull();
    expect(sampleSetFieldLimitError(apreo, [{ ...sets[0], B: "1" }])).toBe(formulaError(4, 1));
  });

  it("keeps the minimum of 1, but not for unchanged legacy values", () => {
    expect(sampleSetFieldLimitError(apreo, [{ A: "0", B: "1" }])).toBe(
      "Sample set 2: No. of Samples cannot be less than 1.",
    );
    // A's own configured min is 1, so a stored 0 is not a legacy value; B has no configured min.
    expect(sampleSetFieldLimitError(apreo, [{ A: "0", B: "1" }], {}, [{ A: "0", B: "1" }])).toBe(
      "Sample set 2: No. of Samples cannot be less than 1.",
    );
    expect(sampleSetFieldLimitError(apreo, [{ A: "1", B: "0" }], {}, [{ A: "1", B: "0" }])).toBeNull();
    expect(sampleSetFieldLimitError(apreo, [{ A: "1", B: "0" }])).toBe(`Sample set 2: ${B_LABEL} cannot be less than 1.`);
  });

  it("ignores blanks and half-typed numbers, and external users' A formula", () => {
    expect(sampleSetFieldLimitError(apreo, [{ A: "", B: "1" }, { A: "1.", B: "1" }])).toBeNull();
    expect(sampleSetFieldLimitError(apreo, [{ A: "9", B: "1" }], { skipFormulaLimits: true })).toBeNull();
  });

  it("explains the formula the same way as the backend", () => {
    expect(formulaLimitNote("B*4", { B: 2 }, { B: B_LABEL })).toBe(`B × 4, where B is ${B_LABEL} = 2`);
    expect(formulaLimitNote("B*4", {}, {})).toBe("B × 4, where B = not set");
  });
});

describe("SampleSetsEditor with a formula maximum (APREO)", () => {
  const render = (sets: Record<string, string>[], extra: Record<string, unknown> = {}) =>
    renderToStaticMarkup(
      <SampleSetsEditor fields={apreo} sets={sets} onChange={() => {}} primaryValues={{ A: "1", B: "5", C: "No" }} {...extra} />,
    );
  const inputFor = (html: string, key: string, set = 0) =>
    html.match(new RegExp(`<input[^>]*id="sample-set-${set}-${key}"[^>]*>`))?.[0] ?? "";

  it("gives set 2's A the max from set 2's B, with the Max N allowed hint and the up arrow off", () => {
    const html = render([{ A: "8", B: "2", C: "No" }]);
    expect(inputFor(html, "A")).toContain('max="8"');
    expect(html).toContain("Max 8 allowed");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Increase by 1"[^>]*aria-controls="sample-set-0-A"/);
    expect(html).not.toContain('role="alert"');
  });

  it("does not use sample set 1's larger B for set 2", () => {
    const html = render([{ A: "4", B: "1", C: "No" }]);
    expect(inputFor(html, "A")).toContain('max="4"');
    expect(html).toContain("Max 4 allowed");
  });

  it("flags A above the new max when that set's B was lowered", () => {
    const html = render([{ A: "8", B: "1", C: "No" }]);
    expect(inputFor(html, "A")).toContain('aria-invalid="true"');
    expect(html).toContain("Maximum is 4 — please change this value");
    expect(html).toContain(formulaError(4, 1));
  });

  it("checks every set on its own values", () => {
    const html = render([{ A: "12", B: "3", C: "No" }, { A: "6", B: "1", C: "No" }]);
    expect(inputFor(html, "A", 0)).toContain('max="12"');
    expect(inputFor(html, "A", 1)).toContain('max="4"');
    expect(html).toContain(formulaError(4, 1, 3));
  });

  it("drops A's formula for external booking users", () => {
    const html = render([{ A: "8", B: "1", C: "No" }], { skipFormulaLimits: true });
    expect(inputFor(html, "A")).toContain('max="100"');
    expect(html).not.toContain('role="alert"');
  });
});

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/lib/api", () => ({ apiClient: {} }));

import SampleSetsEditor, {
  SAMPLE_SET_HELPER_TEXT,
  SAMPLE_SETS_SWITCHED_OFF_NOTE,
  type SampleSetField,
} from "@/components/SampleSetsEditor";
import { AllowSampleSetsField, canEditSampleSetsSwitch } from "@/components/admin/AllowSampleSetsField";
import { defaultSampleSetValues, sampleSetSummary, sampleSetsAllowedFor } from "@/lib/sampleSets";

const fields: SampleSetField[] = [
  { field_key: "A", field_label: "No. of Samples", field_type: "NUMERIC", options: { min: 1, max: 4 }, is_required: true },
  { field_key: "B", field_label: "Detector", field_type: "RADIO", options: ["SE", "BSE"], default_value: "BSE" },
  { field_key: "C", field_label: "Coating", field_type: "COMBO", options: ["None", "Gold"] },
  { field_key: "D", field_label: "Remarks", field_type: "TEXT" },
  { field_key: "E", field_label: "Tilt", field_type: "TOGGLE", default_value: "true" },
];

const setOne = { A: 3, B: "SE", C: "Gold", D: "Fragile", E: false };

const render = (props: Partial<Parameters<typeof SampleSetsEditor>[0]> = {}) =>
  renderToStaticMarkup(
    <SampleSetsEditor fields={fields} sets={[]} onChange={() => {}} primaryValues={setOne} {...props} />,
  );

describe("new sample sets", () => {
  it("start from the equipment defaults, not from sample set 1", () => {
    const values = defaultSampleSetValues(fields);
    expect(values).toEqual({ A: "1", B: "BSE", C: "None", D: "", E: true });
    for (const key of Object.keys(setOne) as Array<keyof typeof setOne>) {
      expect(values[key]).not.toEqual(setOne[key]);
    }
  });

  it("use each field's configured default value", () => {
    expect(
      defaultSampleSetValues([
        { field_key: "A", field_type: "NUMERIC", default_value: "2", options: { min: 1, max: 4 } },
        { field_key: "D", field_type: "TEXT", default_value: "Powder" },
      ]),
    ).toEqual({ A: "2", D: "Powder" });
  });
});

describe("SampleSetsEditor layout", () => {
  it("shows one add button with a short helper when there is only sample set 1", () => {
    const html = render();
    expect(html).toContain("Add sample with different parameters");
    expect(html).toContain(SAMPLE_SET_HELPER_TEXT);
    expect(html).not.toContain("Sample set 2");
  });

  it("compact (peak window): only an add link, with the helper behind an info button", () => {
    const html = render({ compact: true });
    expect(html).toContain('data-testid="sample-sets-compact"');
    expect(html).toContain("Add sample with different parameters");
    expect(html).toContain('aria-label="About samples with different parameters"');
    expect(html).not.toContain(SAMPLE_SET_HELPER_TEXT);
    expect(render({ compact: true, sets: [{ A: 1, B: "BSE", C: "None", D: "", E: true }] })).toContain("Sample set 2");
  });

  it("renders a card per extra set and an Add another sample set button", () => {
    const html = render({ sets: [{ A: 1, B: "BSE", C: "None", D: "", E: true }] });
    expect(html).toContain("Sample set 2");
    expect(html).toContain('aria-label="Remove Sample set 2"');
    expect(html).toContain("Copy set 1 values");
    expect(html).toContain("Add another sample set");
    expect(html).not.toContain(SAMPLE_SET_HELPER_TEXT);
  });

  it("hides the add option when the equipment switch is off", () => {
    const html = render({ allowAdd: false });
    expect(html).not.toContain("Add sample with different parameters");
    expect(html).not.toContain("Add another sample set");
    expect(html).not.toContain(SAMPLE_SETS_SWITCHED_OFF_NOTE);
  });

  it("keeps existing sets editable when the switch is off, without an add button", () => {
    const html = render({ allowAdd: false, sets: [{ A: 1, B: "BSE", C: "None", D: "", E: true }] });
    expect(html).toContain("Sample set 2");
    expect(html).toContain(SAMPLE_SETS_SWITCHED_OFF_NOTE);
    expect(html).not.toContain("Add another sample set");
    expect(html).toMatch(/<button[^>]*aria-label="Duplicate Sample set 2"[^>]*disabled=""|<button[^>]*disabled=""[^>]*aria-label="Duplicate Sample set 2"/);
  });

  it("summarises a set in one line", () => {
    expect(sampleSetSummary(fields, { A: 2, B: "SE", C: "", D: "x", E: true })).toBe(
      "No. of Samples: 2 · Detector: SE · Remarks: x",
    );
  });
});

describe("sampleSetsAllowedFor", () => {
  it("is on by default and off when the main admin turns it off or for 3D printing", () => {
    expect(sampleSetsAllowedFor({})).toBe(true);
    expect(sampleSetsAllowedFor(null)).toBe(true);
    expect(sampleSetsAllowedFor({ allow_multiple_sample_sets: true })).toBe(true);
    expect(sampleSetsAllowedFor({ allow_multiple_sample_sets: false })).toBe(false);
    expect(sampleSetsAllowedFor({ profile_type: "PRINT_3D" })).toBe(false);
  });
});

describe("AllowSampleSetsField (equipment form)", () => {
  const renderField = (checked: boolean | undefined, canEdit: boolean) =>
    renderToStaticMarkup(<AllowSampleSetsField checked={checked} canEdit={canEdit} onCheckedChange={() => {}} />);

  it("is ticked by default", () => {
    const html = renderField(undefined, true);
    expect(html).toContain("Allow samples with different parameters");
    expect(html).toMatch(/role="checkbox"[^>]*aria-checked="true"|aria-checked="true"[^>]*role="checkbox"/);
    expect(html).not.toContain("Only the main administrator can change this.");
  });

  it("is read-only with a note for anyone but the main administrator", () => {
    const html = renderField(false, false);
    expect(html).toMatch(/aria-checked="false"/);
    expect(html).toMatch(/<button[^>]*disabled=""/);
    expect(html).toContain("Only the main administrator can change this.");
  });

  it("follows the API's edit flag (superuser of any user type) and falls back to the main-admin type", () => {
    expect(canEditSampleSetsSwitch(true, false)).toBe(true);
    expect(canEditSampleSetsSwitch(false, true)).toBe(false);
    expect(canEditSampleSetsSwitch(undefined, true)).toBe(true);
    expect(canEditSampleSetsSwitch(undefined, false)).toBe(false);
  });
});

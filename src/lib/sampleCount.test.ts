import { describe, expect, it } from "vitest";
import { bookingSampleSummary, formatSampleSummary, isSampleCountLabel, sampleCountFieldKey } from "./sampleCount";

describe("sample count field", () => {
  it("recognises the usual sample-count labels", () => {
    for (const label of ["No. of Samples", "Number of samples", "Nos. of sample", "Sample count", "Samples", "Quantity of samples"]) {
      expect(isSampleCountLabel(label), label).toBe(true);
    }
  });

  it("ignores per-sample quantities and unrelated labels", () => {
    for (const label of ["No. of scans per sample", "Number of elements in each sample", "Sample name", "Temperature (°C)"]) {
      expect(isSampleCountLabel(label), label).toBe(false);
    }
  });

  it("picks the first numeric sample-count field in key order", () => {
    const fields = [
      { field_key: "C", field_label: "No. of samples", field_type: "NUMERIC" },
      { field_key: "A", field_label: "No. of samples", field_type: "TEXT" },
      { field_key: "B", field_label: "Number of samples", field_type: "NUMERIC" },
    ];
    expect(sampleCountFieldKey(fields)).toBe("B");
    expect(sampleCountFieldKey([{ field_key: "A", field_label: "Solvent", field_type: "TEXT" }])).toBeNull();
  });
});

describe("booking sample summary", () => {
  const fields = [{ field_key: "A", field_label: "No. of Samples", field_type: "NUMERIC" }];

  it("adds up samples over all sets and skips empty sets", () => {
    const summary = bookingSampleSummary(fields, { A: "4", _sample_sets: [{ A: 3 }, {}, { A: "5" }] });
    expect(summary).toEqual({ sets: 3, samples: 12 });
    expect(formatSampleSummary(summary)).toBe("3 sets · 12 samples");
  });

  it("formats single sets and unknown counts", () => {
    expect(formatSampleSummary(bookingSampleSummary(fields, { A: 1 }))).toBe("1 sample");
    expect(formatSampleSummary(bookingSampleSummary([], { B: "x", _sample_sets: [{ B: "y" }] }))).toBe("2 sets");
    expect(formatSampleSummary(bookingSampleSummary([], { B: "x" }))).toBe("");
    expect(formatSampleSummary(null)).toBe("");
  });
});

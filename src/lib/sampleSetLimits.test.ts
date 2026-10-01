import { describe, expect, it } from "vitest";
import {
  combinedAllowances,
  combinedLimitError,
  combinedLimits,
  fitNewSampleSet,
  formatAllowance,
  maxForExtraSet,
} from "./sampleSetLimits";

const fields = [
  { field_key: "A", field_label: "No. of Samples", field_type: "NUMERIC", options: { min: 1, max: 4 }, is_required: true },
  { field_key: "B", field_label: "No. of Slots", field_type: "NUMERIC", help_text: "1\n2\n1", is_required: true },
  { field_key: "C", field_label: "Notes", field_type: "TEXT" },
];

describe("combinedLimits", () => {
  it("takes A and B with a configured max only", () => {
    expect(combinedLimits(fields).map((l) => [l.key, l.max, l.floor])).toEqual([
      ["A", 4, 1],
      ["B", 2, 1],
    ]);
    expect(
      combinedLimits([
        { field_key: "A", field_type: "NUMERIC", options: { max_formula: "B*4", max: 10 } },
        { field_key: "B", field_type: "NUMERIC" },
        { field_key: "D", field_type: "NUMERIC", options: { max: 3 } },
      ]),
    ).toEqual([]);
  });
});

describe("combinedLimitError", () => {
  it("rejects a combined total above the max (FE-SEM APREO: B max 2, 2 + 2)", () => {
    expect(combinedLimitError(fields, { A: 1, B: 2 }, [{ A: 1, B: "2" }])).toBe(
      "Total No. of Slots across all sample sets (4) exceeds the maximum allowed (2) for this equipment.",
    );
  });

  it("allows exactly the max and ignores single-set bookings", () => {
    expect(combinedLimitError(fields, { A: 2, B: 1 }, [{ A: 2, B: 1 }])).toBeNull();
    expect(combinedLimitError(fields, { A: 4, B: 2 }, [])).toBeNull();
  });

  it("checks field A too", () => {
    expect(combinedLimitError(fields, { A: 3, B: 1 }, [{ A: 2, B: 1 }])).toContain("Total No. of Samples");
  });

  it("lets an already-over booking keep or lower its total but not raise it", () => {
    const baseline = { primary: { A: 1, B: 2 }, sets: [{ A: 1, B: 2 }] };
    expect(combinedLimitError(fields, { A: 1, B: 2 }, [{ A: 1, B: 1 }], baseline)).toBeNull();
    expect(combinedLimitError(fields, { A: 1, B: 2 }, [{ A: 1, B: 3 }], baseline)).toContain("(5)");
  });
});

describe("FE-SEM APREO field shape", () => {
  const apreo = (bHelpText: string) => [
    { field_key: "A", field_label: "No. of Samples", field_type: "NUMERIC", options: { min: 1, max_formula: "B*4" }, help_text: "" },
    { field_key: "B", field_label: "Number of Slots", field_type: "NUMERIC", options: [], help_text: bHelpText },
  ];

  it("has nothing to sum while B has no configured max", () => {
    expect(combinedLimits(apreo(""))).toEqual([]);
    expect(combinedLimitError(apreo(""), { A: 8, B: 2 }, [{ A: 8, B: 2 }])).toBeNull();
  });

  it("caps B across sets once B max 2 is set through help-text line 2", () => {
    expect(combinedLimits(apreo("1\n2\n1")).map((l) => [l.key, l.max])).toEqual([["B", 2]]);
    expect(combinedLimitError(apreo("1\n2\n1"), { A: 2, B: 2 }, [{ A: 2, B: 2 }])).toBe(
      "Total Number of Slots across all sample sets (4) exceeds the maximum allowed (2) for this equipment.",
    );
    expect(combinedLimitError(apreo("1\n2\n1"), { A: 4, B: 1 }, [{ A: 4, B: 1 }])).toBeNull();
  });
});

describe("allowance helpers", () => {
  it("reports usage and the per-set max", () => {
    const [, b] = combinedAllowances(fields, { A: 1, B: 1 }, [{ A: 1, B: 1 }]);
    expect(formatAllowance(b)).toBe("No. of Slots: 2 of 2 used across all sample sets");
    expect(b.remaining).toBe(0);
    const limitB = combinedLimits(fields)[1];
    expect(maxForExtraSet(limitB, { B: 1 }, [{ B: 1 }, { B: 0 }], 1)).toBe(0);
    expect(maxForExtraSet(limitB, { B: 1 }, [{ B: 1 }], 0)).toBe(1);
  });

  it("fits a new set into the remaining allowance or refuses when the minimum cannot fit", () => {
    expect(fitNewSampleSet(fields, { A: 3, B: 1 }, [], { A: 3, B: 1, C: "x" })).toEqual({ A: "1", B: 1, C: "x" });
    expect(fitNewSampleSet(fields, { A: 1, B: 2 }, [], { A: 1, B: 2 })).toBeNull();
    expect(fitNewSampleSet(fields, { A: 1, B: 1 }, [{ A: 1, B: 1 }], { A: 1, B: 1 })).toBeNull();
  });
});

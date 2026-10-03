import { describe, expect, it } from "vitest";
import { formatBookingInputValue, formattedValueText, inputLabelsAndValues } from "@/lib/bookingInputDisplay";
import { describeDroppedInputs, sanitizeRebookInputValues } from "@/lib/rebookPrefill";
import { sampleSetSummary } from "@/lib/sampleSets";
import { filledInputCount } from "@/lib/bookingTemplates";

const fields = [
  { field_key: "A", field_label: "No. of samples:", field_type: "NUMERIC" },
  { field_key: "B", field_label: "Select Element", field_type: "PERIODIC_TABLE" },
  { field_key: "C", field_label: "Sample Type", field_type: "RADIO", options: ["Solid/Films", "Powder"] },
  { field_key: "D", field_label: "Sample Details", field_type: "TABLE", options: ["S.No.", "Name", "Count"] },
];

describe("readable booking inputs", () => {
  it("turns table JSON into rows and drops the serial column in one-line text", () => {
    const value = formatBookingInputValue(fields[3], { D: '[["1","N","5"],["2","",""],["","",""]]' });
    expect(formattedValueText(value)).toBe("Name: N, Count: 5");
  });

  it("gives labels and option labels for PDFs, never raw keys or JSON", () => {
    const out = inputLabelsAndValues(fields, { A: "2", B: "5", B_elements: "C,Lu", C: "2", D: [["1", "N", "5"]] });
    expect(out).toEqual({
      "No. of samples": "2",
      "Select Element": "C, Lu",
      "Sample Type": "Powder",
      "Sample Details": "Name: N, Count: 5",
    });
  });

  it("names reset inputs by label and counts inputs no longer on the form", () => {
    expect(describeDroppedInputs(["C", "B_elements", "Q", "Z", "old_note"], fields)).toEqual([
      "Sample Type",
      "Select Element (elements)",
      "Old note",
      "2 inputs no longer on the form",
    ]);
    const { droppedLabels } = sanitizeRebookInputValues({ C: "Gel", Q: "1" }, fields);
    expect(droppedLabels).toEqual(["Sample Type", "1 input no longer on the form"]);
  });

  it("shows the option label for a choice stored as its position", () => {
    expect(sampleSetSummary(fields, { A: "3", C: "1" })).toBe("No. of samples: 3 · Sample Type: Solid/Films");
  });

  it("counts a periodic-table field and its elements as one input", () => {
    expect(filledInputCount({ A: "2", B: "5", B_elements: "C,Lu", comments: "x", _sample_sets: [{ A: "1" }] })).toBe(2);
  });
});

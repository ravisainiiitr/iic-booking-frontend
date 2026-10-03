import { describe, expect, it } from "vitest";
import {
  draftFromTypedTableConfig,
  newDraftColumn,
  slugifyColumnKey,
  typedTableConfigFromDraft,
  typedTableConfigSummary,
  typedTableDraftErrors,
  type TypedTableDraft,
} from "@/lib/typedTableBuilder";

const numeric = [{ key: "A", label: "No. of samples" }];

function draft(patch: Partial<TypedTableDraft> = {}): TypedTableDraft {
  return { ...draftFromTypedTableConfig(null), ...patch };
}

describe("typed table builder", () => {
  it("makes keys from labels like the server", () => {
    expect(slugifyColumnKey("Max temperature (°C)")).toBe("max_temperature_c");
    expect(slugifyColumnKey("2θ range")).toBe("c_2_range");
    expect(slugifyColumnKey("")).toBe("col");
  });

  it("round-trips a schema and converts numbers, defaults and options", () => {
    const temp = { ...newDraftColumn("NUMERIC", "Max temperature"), min: "25", max: "100", step: "0.5", default: "40" };
    const form = { ...newDraftColumn("RADIO", "Form"), optionsText: "Powder\nFilm\nPowder", default: "Film" };
    const dry = { ...newDraftColumn("TOGGLE", "Dry"), default: "true" };
    const config = typedTableConfigFromDraft(
      draft({ columns: [temp, form, dry], mode: "LINKED", link_field_key: "a", max_rows: "20" }),
    );
    expect(config.columns.map((c) => c.key)).toEqual(["max_temperature", "form", "dry"]);
    expect(config.columns[0]).toMatchObject({ min: 25, max: 100, step: 0.5, default: 40 });
    expect(config.columns[1].options).toEqual(["Powder", "Film"]);
    expect(config.columns[2].default).toBe(true);
    expect(config.rows).toMatchObject({ mode: "LINKED", link_field_key: "A", min_rows: 0, initial_rows: 0, max_rows: 20 });
    const again = draftFromTypedTableConfig(config);
    expect(again.columns.map((c) => [c.label, c.key, c.min, c.max])).toEqual([
      ["Max temperature", "max_temperature", "25", "100"],
      ["Form", "form", "", ""],
      ["Dry", "dry", "", ""],
    ]);
    expect(typedTableConfigSummary(config)).toBe("3 columns · rows follow field A (max 20)");
    expect(typedTableConfigSummary(config, { A: "No. of samples:" })).toBe(
      "3 columns · rows follow field A – No. of samples (max 20)",
    );
  });

  it("reports duplicate keys, limits, missing options and bad defaults", () => {
    const errors = typedTableDraftErrors(
      draft({
        columns: [
          { ...newDraftColumn("TEXT", "Code"), key: "code" },
          { ...newDraftColumn("TEXT", "Code 2"), key: "code" },
          { ...newDraftColumn("NUMERIC", "Temp"), min: "10", max: "5" },
          newDraftColumn("COMBO", "Gas"),
          { ...newDraftColumn("NUMERIC", "Count"), integer: true, step: "0.5", max: "10", default: "11" },
          newDraftColumn("TEXT", ""),
        ],
      }),
      numeric,
    );
    expect(errors).toEqual([
      'Column key "code" is used by more than one column.',
      'Column "Temp": lower limit cannot be greater than the upper limit.',
      'Column "Gas" needs at least one option.',
      'Column "Count": whole-number columns need a whole-number step.',
      'Column "Count": default value — Count cannot be greater than 10.',
      "Column 6 needs a label.",
    ]);
  });

  it("checks the linked field and the row limits", () => {
    const linked = (link: string) => typedTableDraftErrors(draft({ mode: "LINKED", link_field_key: link }), numeric, "C");
    expect(linked("")).toEqual(["Choose the field key (A–Z) that sets the number of rows."]);
    expect(linked("C")).toEqual(["Rows cannot be linked to the table itself."]);
    expect(linked("B")).toEqual(["Rows can only follow a Numeric field of the same user type; field B is not one."]);
    expect(linked("A")).toEqual([]);
    expect(typedTableDraftErrors(draft({ min_rows: "5", max_rows: "3" }), numeric)).toEqual([
      "Minimum rows cannot be greater than maximum rows.",
    ]);
    expect(typedTableDraftErrors(draft({ max_rows: "500" }), numeric)).toEqual([
      "Maximum rows must be a whole number from 1 to 200.",
    ]);
  });
});

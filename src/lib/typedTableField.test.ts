import { afterEach, describe, expect, it } from "vitest";
import { applyTableRowSyncToValues } from "@/lib/dynamicTableField";
import { buildInitialInputValues } from "@/lib/dynamicFieldDefaults";
import { formatBookingInputValue } from "@/lib/bookingInputDisplay";
import { isBookingInputValueEmpty } from "@/lib/bookingInputValues";
import {
  clearTypedTableRowStash,
  firstTypedTableProblem,
  initialTypedTableRows,
  readTypedTableConfig,
  typedTableDisplay,
  typedTableFilledRowCount,
  typedTableHiddenRowCount,
  typedTableProblems,
} from "@/lib/typedTableField";

const columns = [
  { key: "code", label: "Sample code", type: "TEXT", required: true, max_length: 10 },
  { key: "temp", label: "Max temperature", type: "NUMERIC", min: 25, max: 100, step: 1, integer: true },
  { key: "form", label: "Form", type: "RADIO", options: ["Powder", "Film"] },
  { key: "gas", label: "Gas", type: "COMBO", options: ["N2", "Ar"] },
  { key: "tests", label: "Tests", type: "MULTI_SELECT", options: ["XRD", "SEM"] },
  { key: "dry", label: "Dry", type: "TOGGLE" },
  { key: "elements", label: "Elements", type: "PERIODIC_TABLE" },
];

const linkedField = {
  field_key: "C",
  field_label: "Sample details",
  field_type: "TYPED_TABLE",
  table_config: { columns, rows: { mode: "LINKED", link_field_key: "A", max_rows: 5 } },
};
const userField = {
  field_key: "D",
  field_label: "Extra rows",
  field_type: "TYPED_TABLE",
  is_required: true,
  table_config: { columns, rows: { mode: "USER", min_rows: 1, max_rows: 3, initial_rows: 2 } },
};
const fields = [{ field_key: "A", field_label: "No. of samples", field_type: "NUMERIC" }, linkedField, userField];

afterEach(() => clearTypedTableRowStash());

describe("typed table schema", () => {
  it("reads the schema and returns null without columns", () => {
    expect(readTypedTableConfig({ columns: [] })).toBeNull();
    expect(readTypedTableConfig("not json")).toBeNull();
    const config = readTypedTableConfig(JSON.stringify(userField.table_config));
    expect(config?.rows).toMatchObject({ mode: "USER", min_rows: 1, max_rows: 3, initial_rows: 2, serial_column: true });
    expect(initialTypedTableRows(config)).toHaveLength(2);
    expect(initialTypedTableRows(readTypedTableConfig(linkedField.table_config))).toEqual([]);
  });

  it("starts user tables with their initial rows and linked tables with one row per sample", () => {
    const values = buildInitialInputValues([
      { field_key: "A", field_type: "NUMERIC", default_value: "2", is_required: true },
      linkedField,
      userField,
    ]);
    expect(values.C).toHaveLength(2);
    expect(values.D).toHaveLength(2);
  });
});

describe("linked rows", () => {
  it("follow the linked field, capped at the maximum rows", () => {
    const values: Record<string, unknown> = { A: "3", C: [] };
    expect(applyTableRowSyncToValues(values, fields)).toBe(true);
    expect(values.C).toHaveLength(3);
    values.A = "9";
    applyTableRowSyncToValues(values, fields, "A");
    expect(values.C).toHaveLength(5);
  });

  it("keep rows hidden by a lower count and bring them back when it goes up", () => {
    const values: Record<string, unknown> = {
      A: "3",
      C: [{ code: "S1" }, { code: "S2" }, { code: "S3" }],
    };
    values.A = "1";
    applyTableRowSyncToValues(values, fields, "A");
    expect(values.C).toEqual([{ code: "S1" }]);
    expect(typedTableHiddenRowCount("primary", "C")).toBe(2);
    values.A = "3";
    applyTableRowSyncToValues(values, fields, "A");
    expect(values.C).toEqual([{ code: "S1" }, { code: "S2" }, { code: "S3" }]);
    expect(typedTableHiddenRowCount("primary", "C")).toBe(0);
  });

  it("keeps hidden rows apart per sample set", () => {
    const set: Record<string, unknown> = { A: "2", C: [{ code: "X1" }, { code: "X2" }] };
    set.A = "1";
    applyTableRowSyncToValues(set, fields, "A", "set-1");
    expect(typedTableHiddenRowCount("set-1", "C")).toBe(1);
    expect(typedTableHiddenRowCount("primary", "C")).toBe(0);
    clearTypedTableRowStash("set-1::");
    expect(typedTableHiddenRowCount("set-1", "C")).toBe(0);
  });
});

describe("typed table checks", () => {
  const group = { A: "2" };

  it("reports out-of-range, whole-number, option and length problems per cell", () => {
    const rows = [
      { code: "S1", temp: 120 },
      { code: "S2", temp: 10 },
    ];
    const problems = typedTableProblems(linkedField, rows, group);
    expect(problems.map((p) => p.message)).toEqual([
      "Sample details, row 1: Max temperature cannot be greater than 100.",
      "Sample details, row 2: Max temperature cannot be less than 25.",
    ]);
    expect(problems[0]).toMatchObject({ kind: "max", limit: 100, row: 1, column: "temp" });
    const more = typedTableProblems(linkedField, [{ code: "TOO-LONG-CODE", temp: 40.5, form: "Gel" }, { code: "S2", tests: ["TEM"] }], group);
    expect(more.map((p) => p.kind)).toEqual(["max_length", "integer", "option", "option"]);
  });

  it("needs required cells and the linked number of rows", () => {
    const problems = typedTableProblems(linkedField, [{ temp: 30 }], group);
    expect(problems.map((p) => p.kind)).toEqual(["required", "row_count"]);
    expect(problems[1].message).toBe("Sample details must have 2 rows (set by field A); it has 1.");
    expect(typedTableProblems(linkedField, [{ temp: 30 }], group, { checkRequired: false })).toEqual([]);
  });

  it("drops blank rows in user tables and checks the minimum rows", () => {
    expect(typedTableProblems(userField, [{}, {}], {}).map((p) => p.message)).toEqual(["Extra rows: add at least 1 row."]);
    const tooMany = [{ code: "1" }, { code: "2" }, { code: "3" }, { code: "4" }];
    expect(typedTableProblems(userField, tooMany, {}).map((p) => p.kind)).toEqual(["max_rows"]);
  });

  it("finds the first problem across sample sets and skips tables unchanged since saving", () => {
    const values = {
      A: "1",
      C: [{ code: "S1" }],
      D: [{ code: "U1" }],
      _sample_sets: [{ A: "1", C: [{ code: "S9", temp: 500 }], D: [{ code: "U2" }] }],
    };
    const problem = firstTypedTableProblem(fields, values);
    expect(problem?.message).toBe("Sample set 2: Sample details, row 1: Max temperature cannot be greater than 100.");
    expect(problem).toMatchObject({ set: 2, key: "C", rowIndex: 0, column: "temp" });
    expect(firstTypedTableProblem(fields, values, { baseline: values })).toBeNull();
  });
});

describe("typed table display", () => {
  const config = readTypedTableConfig(linkedField.table_config)!;
  const rows = [
    { code: "S1", temp: 40, form: "Powder", tests: ["XRD", "SEM"], dry: true, elements: ["Fe", "O"] },
    {},
  ];

  it("counts filled rows for formulas", () => {
    expect(typedTableFilledRowCount(rows)).toBe(1);
    expect(typedTableFilledRowCount([{ dry: false }])).toBe(0);
  });

  it("shows S.No., labels and readable cells", () => {
    expect(typedTableDisplay(config, rows)).toEqual({
      columns: ["S.No.", "Sample code", "Max temperature", "Form", "Gas", "Tests", "Dry", "Elements"],
      rows: [["1", "S1", "40", "Powder", "", "XRD, SEM", "Yes", "Fe, O"]],
    });
  });

  it("formats a typed table for the job sheet and treats blank tables as empty", () => {
    expect(formatBookingInputValue(linkedField, { C: rows })).toMatchObject({ kind: "table", columns: expect.arrayContaining(["Sample code"]) });
    expect(formatBookingInputValue(linkedField, { C: [{}] })).toEqual({ kind: "empty" });
    expect(isBookingInputValueEmpty([{}], linkedField)).toBe(true);
    expect(isBookingInputValueEmpty(rows, linkedField)).toBe(false);
  });
});

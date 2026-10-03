// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { SampleRequirementsTable } from "./SampleRequirementsTable";

const fields = [
  { field_key: "A", field_label: "No. of Samples", field_type: "NUMERIC" },
  { field_key: "B", field_label: "Sample form", field_type: "RADIO", options: [{ value: "pwd", label: "Powder" }, { value: "liq", label: "Liquid" }] },
  { field_key: "C", field_label: "Scan range (2θ, degrees)", field_type: "TEXT" },
  { field_key: "D", field_label: "Hazard information", field_type: "TEXT" },
  { field_key: "E", field_label: "Unused field", field_type: "TEXT" },
  { field_key: "comments", field_label: "Comments", field_type: "TEXT" },
];

afterEach(cleanup);

describe("SampleRequirementsTable", () => {
  it("shows a single set as one row, without blank fields or comments", () => {
    render(
      <SampleRequirementsTable
        fields={fields}
        inputValues={{ A: "4", B: "pwd", C: "10–80", D: "", E: "", comments: "Handle with gloves" }}
      />,
    );
    const table = screen.getByRole("table");
    const headers = within(table).getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual(["Set", "No. of Samples", "Sample form", "Scan range (2θ, degrees)"]);
    expect(within(table).getAllByRole("rowheader").map((h) => h.textContent)).toEqual(["Set 1"]);
    const cells = within(table).getAllByRole("cell").map((c) => c.textContent);
    expect(cells).toEqual(["4", "Powder", "10–80"]);
    expect(table.querySelector("tfoot")).toBeNull();
    expect(table.querySelector(".jobsheet-diff")).toBeNull();
    expect(table.textContent).not.toContain("Handle with gloves");
    expect(screen.getByText("1 sample set")).toBeTruthy();
    expect(screen.getByText("4 samples")).toBeTruthy();
    expect(table.getAttribute("data-print-columns")).toBe("4");
  });

  it("shows several sets as rows, tints values that vary from Set 1 and totals the samples", () => {
    render(
      <SampleRequirementsTable
        fields={fields}
        inputValues={{
          A: "4",
          B: "pwd",
          C: "10–80",
          _sample_sets: [
            { A: "3", B: "liq", C: "10–80" },
            { A: "5", B: "pwd", C: "5–90" },
          ],
        }}
      />,
    );
    const table = screen.getByRole("table");
    const headers = within(table).getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual(["Set", "No. of Samples", "Sample form", "Scan range (2θ, degrees)"]);
    const bodyRows = Array.from(table.querySelectorAll("tbody tr"));
    const text = (row: Element) =>
      within(row as HTMLElement)
        .getAllByRole("cell")
        .map((c) => c.textContent?.replace(" (varies from Set 1)", ""));
    expect(bodyRows.map((r) => r.querySelector("th")?.textContent)).toEqual(["Set 1", "Set 2", "Set 3"]);
    expect(bodyRows.map(text)).toEqual([
      ["4", "Powder", "10–80"],
      ["3", "Liquid", "10–80"],
      ["5", "Powder", "5–90"],
    ]);
    const set2 = within(bodyRows[1] as HTMLElement).getAllByRole("cell");
    expect(set2[1].className).toContain("jobsheet-diff");
    expect(set2[2].className).not.toContain("jobsheet-diff");
    const footer = Array.from(table.querySelectorAll("tfoot th, tfoot td")).map((c) => c.textContent);
    expect(footer).toEqual(["Total", "12", "", ""]);
    expect(screen.getByText("3 sample sets")).toBeTruthy();
    expect(screen.getByText(/Tinted values vary from Set 1/)).toBeTruthy();
  });

  it("keeps sets as rows whatever the number of sets and parameters (no transposing)", () => {
    const sets = Array.from({ length: 7 }, (_, i) => ({ A: String(i + 1), B: "pwd" }));
    render(<SampleRequirementsTable fields={fields} inputValues={{ A: "1", B: "pwd", _sample_sets: sets }} />);
    const table = screen.getByRole("table");
    const headers = within(table).getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual(["Set", "No. of Samples", "Sample form"]);
    expect(within(table).getAllByRole("rowheader").map((h) => h.textContent)).toEqual([
      ...Array.from({ length: 8 }, (_, i) => `Set ${i + 1}`),
      "Total",
    ]);
  });

  it("renders links and nested table inputs", () => {
    render(
      <SampleRequirementsTable
        fields={[
          { field_key: "A", field_label: "Reference", field_type: "TEXT" },
          { field_key: "B", field_label: "Sample list", field_type: "TABLE", options: ["Name", "Mass (mg)"] },
        ]}
        inputValues={{ A: "See https://example.org/spec for details", B: [["S1", "5"], ["S2", "7"]] }}
      />,
    );
    expect(screen.getByRole("link", { name: "https://example.org/spec" }).getAttribute("href")).toBe("https://example.org/spec");
    expect(screen.getByRole("columnheader", { name: "Mass (mg)" })).toBeTruthy();
    expect(screen.getByText("S2")).toBeTruthy();
  });

  it("shows advanced (typed) tables with S.No., column labels and readable cells per sample set", () => {
    const typed = {
      field_key: "C",
      field_label: "Sample details",
      field_type: "TYPED_TABLE",
      table_config: {
        columns: [
          { key: "code", label: "Sample code", type: "TEXT" },
          { key: "temp", label: "Max temperature", type: "NUMERIC", max: 100 },
          { key: "dry", label: "Dry", type: "TOGGLE" },
        ],
        rows: { mode: "LINKED", link_field_key: "A" },
      },
    };
    render(
      <SampleRequirementsTable
        fields={[{ field_key: "A", field_label: "No. of Samples", field_type: "NUMERIC" }, typed]}
        inputValues={{
          A: "2",
          C: [{ code: "S1", temp: 40, dry: true }, { code: "S2", temp: 80 }],
          _sample_sets: [{ A: "1", C: [{ code: "T1", temp: 20 }] }],
        }}
      />,
    );
    const nested = screen.getAllByRole("columnheader", { name: "Max temperature" });
    expect(nested).toHaveLength(2);
    expect(screen.getAllByRole("columnheader", { name: "S.No." })).toHaveLength(2);
    expect(screen.getByText("Yes")).toBeTruthy();
    expect(screen.getByText("T1")).toBeTruthy();
  });

  it("says so when the user entered nothing", () => {
    render(<SampleRequirementsTable fields={fields} inputValues={{ comments: "only a note" }} />);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText(/did not enter any sample details/)).toBeTruthy();
  });
});

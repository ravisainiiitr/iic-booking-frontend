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
  it("shows a single set as a Parameter | Value table without blank fields or comments", () => {
    render(
      <SampleRequirementsTable
        fields={fields}
        inputValues={{ A: "4", B: "pwd", C: "10–80", D: "", E: "", comments: "Handle with gloves" }}
      />,
    );
    const table = screen.getByRole("table");
    const headers = within(table).getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual(["Parameter", "Value"]);
    const rowHeaders = within(table).getAllByRole("rowheader").map((h) => h.textContent);
    expect(rowHeaders).toEqual(["No. of Samples", "Sample form", "Scan range (2θ, degrees)"]);
    expect(within(table).getByText("Powder")).toBeTruthy();
    expect(table.textContent).not.toContain("Handle with gloves");
    expect(screen.getByText("4 samples")).toBeTruthy();
    expect(table.querySelector("caption")?.textContent).toBe("Sample requirements");
  });

  it("shows several sets as columns, flags differing values and totals the samples", () => {
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
    expect(headers).toEqual(["Parameter", "Set 14 samples", "Set 23 samples", "Set 35 samples"]);
    const formRow = within(table).getByRole("rowheader", { name: /Sample form/ }).closest("tr")!;
    expect(formRow.textContent).toContain("Varies");
    const cells = within(formRow).getAllByRole("cell");
    expect(cells.map((c) => c.textContent?.replace(" (differs from Set 1)", ""))).toEqual(["Powder", "Liquid", "Powder"]);
    expect(cells[1].className).toContain("jobsheet-diff");
    expect(cells[2].className).not.toContain("jobsheet-diff");
    expect(table.querySelector("tfoot")?.textContent).toContain("12 across 3 sets");
    expect(screen.getByText("3 sample sets")).toBeTruthy();
  });

  it("turns the table (one row per set) when there are many sets and few parameters", () => {
    const sets = Array.from({ length: 7 }, (_, i) => ({ A: String(i + 1), B: "pwd" }));
    render(<SampleRequirementsTable fields={fields} inputValues={{ A: "1", B: "pwd", _sample_sets: sets }} />);
    const table = screen.getByRole("table");
    const headers = within(table).getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual(["Set", "No. of Samples", "Sample form"]);
    expect(within(table).getAllByRole("rowheader").slice(0, 2).map((h) => h.textContent)).toEqual(["Set 1", "Set 2"]);
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

  it("says so when the user entered nothing", () => {
    render(<SampleRequirementsTable fields={fields} inputValues={{ comments: "only a note" }} />);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText(/did not enter any sample details/)).toBeTruthy();
  });
});

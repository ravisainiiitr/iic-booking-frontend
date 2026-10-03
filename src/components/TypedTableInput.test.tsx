// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import TypedTableInput from "@/components/TypedTableInput";
import { applyTableRowSyncToValues } from "@/lib/dynamicTableField";
import { clearTypedTableRowStash, readTypedTableConfig, type TypedTableRow } from "@/lib/typedTableField";

const columns = [
  { key: "code", label: "Sample code", type: "TEXT", required: true },
  { key: "temp", label: "Max temperature", type: "NUMERIC", min: 25, max: 100 },
  { key: "dry", label: "Dry", type: "TOGGLE" },
];
const userConfig = readTypedTableConfig({ columns, rows: { mode: "USER", min_rows: 1, max_rows: 3, initial_rows: 1 } });
const linkedTable = {
  field_key: "C",
  field_type: "TYPED_TABLE",
  table_config: { columns, rows: { mode: "LINKED", link_field_key: "A", max_rows: 10 } },
};

function setWidth(width: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  window.matchMedia = ((query: string) => ({
    matches: width < 768,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

function UserTable({ initial }: { initial: TypedTableRow[] }) {
  const [rows, setRows] = useState<TypedTableRow[]>(initial);
  return <TypedTableInput fieldKey="D" label="Extra rows" config={userConfig} value={rows} onChange={setRows} idPrefix="D" />;
}

/** Booking-form stand-in: a NUMERIC field A and a table whose rows follow it. */
function LinkedForm() {
  const [values, setValues] = useState<Record<string, unknown>>({ A: "2", C: [{ code: "S1" }, { code: "S2" }] });
  const change = (key: string, value: unknown) =>
    setValues((prev) => {
      const next = { ...prev, [key]: value };
      applyTableRowSyncToValues(next, [linkedTable], key);
      return next;
    });
  return (
    <>
      <input aria-label="No. of samples" value={String(values.A)} onChange={(e) => change("A", e.target.value)} />
      <TypedTableInput
        fieldKey="C"
        label="Sample details"
        config={readTypedTableConfig(linkedTable.table_config)}
        value={values.C}
        onChange={(rows) => change("C", rows)}
        linkLabel="No. of samples"
        idPrefix="C"
      />
    </>
  );
}

beforeEach(() => setWidth(1280));
afterEach(() => {
  cleanup();
  clearTypedTableRowStash();
});

describe("TypedTableInput", () => {
  it("renders typed cells with headers, S.No. and limits", () => {
    render(<UserTable initial={[{ code: "S1", temp: 40, dry: true }]} />);
    const table = screen.getByRole("table", { name: "Extra rows" });
    const headers = within(table).getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers.slice(0, 4)).toEqual(["S.No.", "Sample code*", "Max temperature25–100", "Dry"]);
    expect((screen.getByLabelText("Extra rows, row 1: Sample code") as HTMLInputElement).value).toBe("S1");
    expect(screen.getByRole("switch", { name: "Extra rows, row 1: Dry" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("1 of max 3 rows (at least 1).")).toBeTruthy();
  });

  it("adds, duplicates and removes rows within the row limits", () => {
    render(<UserTable initial={[{ code: "S1" }]} />);
    expect((screen.getByRole("button", { name: "Remove row 1" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Add row" }));
    fireEvent.click(screen.getByRole("button", { name: "Duplicate row 1" }));
    expect(screen.getAllByRole("row")).toHaveLength(4);
    expect((screen.getByLabelText("Extra rows, row 2: Sample code") as HTMLInputElement).value).toBe("S1");
    expect((screen.getByRole("button", { name: "Add row" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Max 3 rows allowed")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove row 3" }));
    expect(screen.getAllByRole("row")).toHaveLength(3);
  });

  it("corrects a number over the upper limit and shows the Max N allowed hint", () => {
    render(<UserTable initial={[{}]} />);
    const box = screen.getByLabelText("Extra rows, row 1: Max temperature") as HTMLInputElement;
    fireEvent.change(box, { target: { value: "150" } });
    expect(box.value).toBe("100");
    expect(screen.getByText("Max 100 allowed (150 is over the limit)")).toBeTruthy();
    fireEvent.change(box, { target: { value: "10" } });
    fireEvent.blur(box);
    expect(box.value).toBe("25");
  });

  it("linked rows follow their field, with no add or remove buttons, and hidden rows come back", () => {
    render(<LinkedForm />);
    expect(screen.queryByRole("button", { name: "Add row" })).toBeNull();
    expect(screen.getByText("2 rows, set by No. of samples.")).toBeTruthy();
    const count = screen.getByLabelText("No. of samples");
    fireEvent.change(count, { target: { value: "4" } });
    expect(screen.getAllByRole("row")).toHaveLength(5);
    fireEvent.change(count, { target: { value: "1" } });
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(screen.getByRole("status").textContent).toContain("1 filled row is hidden because No. of samples went down");
    fireEvent.change(count, { target: { value: "2" } });
    expect((screen.getByLabelText("Sample details, row 2: Sample code") as HTMLInputElement).value).toBe("S2");
  });

  it("stacks rows as cards on phones", () => {
    setWidth(390);
    render(<UserTable initial={[{ code: "S1" }]} />);
    expect(screen.queryByRole("table")).toBeNull();
    const card = screen.getByRole("group", { name: "Row 1" });
    expect(within(card).getByLabelText("Extra rows, row 1: Sample code")).toBeTruthy();
  });
});

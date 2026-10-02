import { describe, expect, it } from "vitest";
import { formatBookingInputValue, formattedValueKey } from "./bookingInputDisplay";

describe("formatBookingInputValue", () => {
  it("shows option labels, Yes/No and selected elements", () => {
    const radio = { field_key: "B", field_type: "RADIO", options: [{ value: "pwd", label: "Powder" }, { value: "liq", label: "Liquid" }] };
    expect(formatBookingInputValue(radio, { B: "liq" })).toEqual({ kind: "text", text: "Liquid" });
    expect(formatBookingInputValue(radio, { B: "1" })).toEqual({ kind: "text", text: "Powder" });

    const toggle = { field_key: "C", field_type: "TOGGLE" };
    expect(formatBookingInputValue(toggle, { C: true })).toEqual({ kind: "text", text: "Yes" });
    expect(formatBookingInputValue(toggle, { C: "false" })).toEqual({ kind: "text", text: "No" });

    const multi = { field_key: "D", field_type: "MULTI_SELECT", options: [{ value: "a", label: "Alpha" }, "Beta"] };
    expect(formatBookingInputValue(multi, { D: ["a", "Beta"] })).toEqual({ kind: "text", text: "Alpha, Beta" });

    const periodic = { field_key: "E", field_type: "PERIODIC_TABLE" };
    expect(formatBookingInputValue(periodic, { E: "3", E_elements: "Fe, Cu,Zn" })).toEqual({ kind: "text", text: "Fe, Cu, Zn" });
  });

  it("treats blank values as empty but keeps zero", () => {
    const num = { field_key: "A", field_type: "NUMERIC" };
    expect(formatBookingInputValue(num, {})).toEqual({ kind: "empty" });
    expect(formatBookingInputValue(num, { A: "  " })).toEqual({ kind: "empty" });
    expect(formatBookingInputValue(num, { A: 0 })).toEqual({ kind: "text", text: "0" });
  });

  it("reads table inputs from arrays or JSON and drops blank rows", () => {
    const table = { field_key: "F", field_type: "TABLE", options: ["Sample", "Mass (mg)"] };
    expect(formatBookingInputValue(table, { F: JSON.stringify([["S1", "5"], ["", ""]]) })).toEqual({
      kind: "table",
      columns: ["Sample", "Mass (mg)"],
      rows: [["S1", "5"]],
    });
    expect(formatBookingInputValue(table, { F: [["", ""]] })).toEqual({ kind: "empty" });
  });

  it("compares values case-insensitively for the differs-from-set-1 check", () => {
    expect(formattedValueKey({ kind: "text", text: "DMSO " })).toBe(formattedValueKey({ kind: "text", text: "dmso" }));
    expect(formattedValueKey({ kind: "empty" })).not.toBe(formattedValueKey({ kind: "text", text: "x" }));
  });
});

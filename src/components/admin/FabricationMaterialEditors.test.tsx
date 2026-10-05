// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  LaserSheetMaterialsEditor,
  PrintMaterialsEditor,
  derivedPricePerGram,
  emailListError,
  laserRowPayload,
  laserSheetRowsError,
  newLaserSheetRow,
  newPrintMaterialRow,
  ownChargeError,
  parseEmailList,
  printMaterialRowsError,
  printRowPayload,
} from "@/components/admin/FabricationMaterialEditors";

afterEach(cleanup);

describe("supplier rate conversion", () => {
  it("matches the backend price-per-gram conversion", () => {
    expect(derivedPricePerGram("2500", "PER_KG", "1.24")).toBeCloseTo(2.5, 6);
    expect(derivedPricePerGram("12000", "PER_LITRE", "1.2")).toBeCloseTo(10, 6);
    expect(derivedPricePerGram("3", "PER_GRAM", "1.24")).toBe(3);
    expect(derivedPricePerGram("", "PER_KG", "1.24")).toBeNull();
    expect(derivedPricePerGram("100", "PER_LITRE", "0")).toBeNull();
  });

  it("sends the supplier rate instead of a typed price when both are present", () => {
    const row = { ...newPrintMaterialRow(0), code: "PLA", name: "PLA", price_per_gram: "9", source_rate: "2500", source_unit: "PER_KG" };
    expect(printRowPayload(row)).toMatchObject({ price_per_gram: null, source_rate: "2500", source_unit: "PER_KG" });
    expect(printRowPayload({ ...row, source_rate: "" })).toMatchObject({ price_per_gram: "9", source_rate: null, source_unit: "" });
  });
});

describe("row validation", () => {
  it("requires a price or a supplier rate for 3D print materials", () => {
    const row = { ...newPrintMaterialRow(0), code: "PLA", name: "PLA" };
    expect(printMaterialRowsError([row])).toMatch(/price per gram, or a supplier rate/);
    expect(printMaterialRowsError([{ ...row, source_rate: "2500" }])).toBeNull();
    expect(printMaterialRowsError([{ ...row, price_per_gram: "2" }, { ...row, price_per_gram: "3" }])).toMatch(/used twice/);
  });

  it("requires thickness, sheet size and sheet price for laser sheets", () => {
    const row = { ...newLaserSheetRow(0), code: "ACR-3", name: "Acrylic 3 mm" };
    expect(row.sheet_width_mm).toBe("2438.4");
    expect(laserSheetRowsError([row])).toMatch(/thickness/);
    const ok = { ...row, thickness_mm: "3", sheet_rate: "6018" };
    expect(laserSheetRowsError([ok])).toBeNull();
    expect(laserSheetRowsError([ok, { ...ok, code: "acr-3" }])).toMatch(/used twice/);
    expect(laserRowPayload(ok)).toMatchObject({ code: "ACR-3", thickness_mm: "3", sheet_rate: "6018", user_type: null });
  });
});

describe("notification emails and own-material charge", () => {
  it("parses one address per line or comma separated, without duplicates", () => {
    expect(parseEmailList("a@x.in, b@x.in\nA@x.in\n\n c@x.in ")).toEqual(["a@x.in", "b@x.in", "c@x.in"]);
    expect(emailListError(["a@x.in", "not-an-email"])).toMatch(/not-an-email/);
    expect(emailListError(Array.from({ length: 11 }, (_, i) => `u${i}@x.in`))).toMatch(/10/);
    expect(emailListError(["a@x.in"])).toBeNull();
  });

  it("accepts an empty or non-negative own-material charge", () => {
    expect(ownChargeError("")).toBeNull();
    expect(ownChargeError("250")).toBeNull();
    expect(ownChargeError("-1")).not.toBeNull();
    expect(ownChargeError("abc")).not.toBeNull();
  });
});

describe("editors", () => {
  it("edits a laser sheet row in place", () => {
    const onChange = vi.fn();
    const row = { ...newLaserSheetRow(0), id: 4, code: "ACR-3", name: "Acrylic", thickness_mm: "3", sheet_rate: "6018" };
    render(<LaserSheetMaterialsEditor rows={[row]} onChange={onChange} />);
    expect(screen.getByTestId("laser-sheets-editor")).toBeTruthy();
    fireEvent.change(screen.getByDisplayValue("Acrylic"), { target: { value: "Acrylic clear" } });
    expect(onChange).toHaveBeenCalledWith([{ ...row, name: "Acrylic clear" }]);
  });

  it("shows the derived price per gram for a supplier rate", () => {
    const row = { ...newPrintMaterialRow(0), code: "PLA", name: "PLA", source_rate: "2500", source_unit: "PER_KG" };
    render(<PrintMaterialsEditor rows={[row]} onChange={vi.fn()} />);
    expect(screen.getByTestId("derived-price").textContent).toContain("2.50");
  });

  it("lets the caller handle removal (for example to confirm and call the API)", () => {
    const onRemove = vi.fn();
    const onChange = vi.fn();
    const row = { ...newPrintMaterialRow(0), id: 9, code: "PLA", name: "PLA", price_per_gram: "2" };
    render(<PrintMaterialsEditor rows={[row]} onChange={onChange} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole("button", { name: /remove/i }));
    expect(onRemove).toHaveBeenCalledWith(row, 0);
    expect(onChange).not.toHaveBeenCalled();
  });
});

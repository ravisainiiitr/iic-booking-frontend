// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const state = vi.hoisted(() => ({ api: { getAnalysisChargesCatalog: vi.fn() } }));

vi.mock("@/lib/api", () => ({ apiClient: state.api }));
vi.mock("@/components/Header", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/analysisChargeRows", () => ({
  buildAnalysisChargeRowsForEquipment: (eq: { name: string }) => [
    { equipmentName: eq.name, userCategory: "Internal", charge: "100", gst: "" },
  ],
}));

import AnalysisCharges, { matchesChargeSearch } from "./AnalysisCharges";

const eq = (id: number, code: string, name: string, dept: number, deptName: string, deptCode: string) => ({
  equipment_id: id, code, name, profile_type: "single", status: "active",
  internal_department: dept, internal_department_name: deptName, internal_department_code: deptCode,
  charge_profiles: [],
});
const xrd = eq(1, "XRD-01", "Powder X-Ray Diffractometer", 1, "Institute Instrumentation Centre", "IIC");
const fesem = eq(2, "FESEM-01", "Field Emission SEM", 1, "Institute Instrumentation Centre", "IIC");
const raman = eq(3, "RAMAN-1", "Raman Spectrometer", 2, "Department of Physics", "PHY");
const departments = [
  { id: 1, name: "Institute Instrumentation Centre", code: "IIC", equipment_count: 2 },
  { id: 2, name: "Department of Physics", code: "PHY", equipment_count: 1 },
];
const userTypes = [{ code: "internal", label: "Internal" }];

function renderPage() {
  return render(<MemoryRouter><AnalysisCharges /></MemoryRouter>);
}

function tableNames() {
  return screen.getAllByRole("rowheader").map((th) => th.textContent);
}

describe("analysis charges search", () => {
  beforeEach(() => {
    state.api.getAnalysisChargesCatalog.mockImplementation(async (opts: { internalDepartmentId?: number }) => {
      const all = [xrd, fesem, raman];
      const equipments = opts?.internalDepartmentId
        ? all.filter((e) => e.internal_department === opts.internalDepartmentId)
        : all;
      return { data: { departments, user_types: userTypes, equipments } };
    });
  });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("matches every word against name, code and department", () => {
    expect(matchesChargeSearch(xrd, "xrd")).toBe(true);
    expect(matchesChargeSearch(xrd, "powder diffract")).toBe(true);
    expect(matchesChargeSearch(raman, "physics")).toBe(true);
    expect(matchesChargeSearch(raman, "raman iic")).toBe(false);
    expect(matchesChargeSearch(fesem, "  ")).toBe(true);
  });

  it("finds equipment in any department and shows its charges", async () => {
    renderPage();
    expect(await screen.findByRole("rowheader", { name: "Powder X-Ray Diffractometer" })).toBeTruthy();
    expect(screen.queryByRole("checkbox", { name: /Raman/ })).toBeNull();

    fireEvent.change(screen.getByLabelText("Search equipment"), { target: { value: "raman" } });

    expect(await screen.findByText("1 equipment found across all departments.", { exact: false })).toBeTruthy();
    expect(tableNames()).toEqual(["Raman Spectrometer (PHY)"]);
    expect(screen.getByRole("heading", { name: 'Search results for "raman"' })).toBeTruthy();
  });

  it("lets a search result be unticked and clears back to the department", async () => {
    renderPage();
    await screen.findByRole("rowheader", { name: "Powder X-Ray Diffractometer" });
    fireEvent.change(screen.getByLabelText("Search equipment"), { target: { value: "iic" } });
    expect(tableNames()).toEqual(["Powder X-Ray Diffractometer (IIC)", "Field Emission SEM (IIC)"]);

    fireEvent.click(screen.getByRole("checkbox", { name: /Field Emission SEM/ }));
    expect(tableNames()).toEqual(["Powder X-Ray Diffractometer (IIC)"]);

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(tableNames()).toEqual(["Powder X-Ray Diffractometer", "Field Emission SEM"]);
  });

  it("says when nothing matches", async () => {
    renderPage();
    await screen.findByRole("rowheader", { name: "Powder X-Ray Diffractometer" });
    fireEvent.change(screen.getByLabelText("Search equipment"), { target: { value: "nmr" } });
    const notes = screen.getAllByText(/No equipment matches your search/);
    expect(notes.length).toBeGreaterThan(0);
    expect(within(document.body).queryAllByRole("rowheader")).toHaveLength(0);
  });
});

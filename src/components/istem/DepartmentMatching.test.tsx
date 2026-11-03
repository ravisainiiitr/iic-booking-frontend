// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const api = vi.hoisted(() => ({
  getIstemEquipmentSuggestions: vi.fn(),
  saveIstemEquipmentMappingsBulk: vi.fn(),
  getIstemEquipmentListing: vi.fn(),
  getIstemDepartmentMappings: vi.fn(),
  saveIstemDepartmentMappings: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ apiClient: api }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

import DepartmentMatching, { initialChoices } from "./DepartmentMatching";
import IstemListingPanel from "./IstemListingPanel";
import IstemDepartmentsPanel, { initialDepartmentChoices } from "./IstemDepartmentsPanel";

const XRF = {
  equipment_id: 7, code: "XRF-01", name: "XRF", department: { id: 3, name: "Chemistry" }, requires_istem_fbr: true,
  input_fields: [{ key: "A", label: "Samples" }], default_sample_key: "A", istem_departments: ["164"], confident: true,
  candidates: [{ equipment_id: "38750", equipment_name: "X-ray Fluorescence (XRF) -IIC", score: 0.95, reasons: ["model", "name"],
    location: "Analytical Section -1, IIC", mapped_to: [] }],
};
const OVEN = {
  equipment_id: 8, code: "OV-1", name: "Oven", department: { id: 3, name: "Chemistry" }, requires_istem_fbr: false,
  input_fields: [], default_sample_key: "", istem_departments: [], confident: false,
  candidates: [{ equipment_id: "40001", equipment_name: "Vacuum Oven", score: 0.5, reasons: ["name"], mapped_to: [] }],
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Department matching against the I-STEM list", () => {
  it("ticks only certain matches by default", () => {
    const c = initialChoices([XRF, OVEN]);
    expect(c[7]).toEqual({ istem: "38750", key: "A", include: true });
    expect(c[8]).toEqual({ istem: "40001", key: "__none__", include: false });
  });

  it("searches I-STEM automatically for the department and saves the ticked rows", async () => {
    api.getIstemEquipmentSuggestions.mockResolvedValue({ data: { department_id: 3, istem_total: 120, equipment: [XRF, OVEN] } });
    api.saveIstemEquipmentMappingsBulk.mockResolvedValue({
      data: { results: [{ equipment_id: 7, ok: true, warnings: [] }], saved: 1, failed: 0, checked: true },
    });
    const onSaved = vi.fn();
    render(<DepartmentMatching departments={[{ id: 3, name: "Chemistry" }]} allDepartments connected onSaved={onSaved} />);
    await screen.findAllByTestId("matching-row");
    expect(api.getIstemEquipmentSuggestions).toHaveBeenCalledWith("3", false);
    expect(screen.getByText("Searched I-STEM department 164")).toBeTruthy();
    expect(screen.getByText(/same model, similar name/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save 1 mapping(s)" }));
    await waitFor(() => expect(api.saveIstemEquipmentMappingsBulk).toHaveBeenCalledWith([
      { equipment_id: 7, istem_equipment_id: "38750", sample_count_input_key: "A" },
    ]));
    expect(onSaved).toHaveBeenCalled();
    await waitFor(() => expect(screen.getAllByTestId("matching-row")).toHaveLength(1));
  });

  it("explains when I-STEM is not connected", () => {
    render(<DepartmentMatching departments={[]} allDepartments connected={false} onSaved={vi.fn()} />);
    expect(screen.getByText(/I-STEM is not connected/)).toBeTruthy();
    expect(api.getIstemEquipmentSuggestions).not.toHaveBeenCalled();
  });
});

describe("I-STEM listing", () => {
  it("lists I-STEM equipment with what each is mapped to and filters to unmapped", async () => {
    api.getIstemEquipmentListing.mockResolvedValue({ data: { total: 2, mapped: 1, equipment: [
      { equipment_id: "38750", equipment_name: "X-ray Fluorescence (XRF) -IIC", mapped_to: [{ equipment_id: 7, name: "XRF" }] },
      { equipment_id: "40001", equipment_name: "Vacuum Oven", mapped_to: [] },
    ] } });
    render(<IstemListingPanel connected />);
    expect(await screen.findAllByTestId("istem-listing-row")).toHaveLength(2);
    expect(screen.getByText("1 of 2 mapped on the portal")).toBeTruthy();
    fireEvent.click(screen.getByRole("switch"));
    expect(screen.getAllByTestId("istem-listing-row")).toHaveLength(1);
    expect(screen.getByText("Vacuum Oven")).toBeTruthy();
  });
});

describe("I-STEM departments", () => {
  const ROWS = [
    { istem_department_id: "164", equipment_count: 2, sample_equipment: ["FESEM", "XRF"], locations: ["Analytical Section -1, IIC"],
      department: null, suggested: { id: 3, name: "IIC", instruments: 1 } },
    { istem_department_id: "171", equipment_count: 1, sample_equipment: ["pXRF"], locations: [],
      department: { id: 5, name: "Earth Sciences" }, suggested: null },
  ];

  it("pre-selects the saved department, else the suggestion", () => {
    expect(initialDepartmentChoices(ROWS)).toEqual({ "164": "3", "171": "5" });
  });

  it("saves only the rows that change", async () => {
    api.getIstemDepartmentMappings.mockResolvedValue({ data: { istem_departments: ROWS,
      portal_departments: [{ id: 3, name: "IIC" }, { id: 5, name: "Earth Sciences" }] } });
    api.saveIstemDepartmentMappings.mockResolvedValue({ data: { saved: 1, removed: 0 } });
    render(<IstemDepartmentsPanel connected onSaved={vi.fn()} />);
    expect(await screen.findAllByTestId("istem-department-row")).toHaveLength(2);
    expect(screen.getByText("Suggested: IIC (1 mapped instrument(s))")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save 1 change(s)" }));
    await waitFor(() => expect(api.saveIstemDepartmentMappings).toHaveBeenCalledWith([
      { istem_department_id: "164", department_id: 3 },
    ]));
  });
});

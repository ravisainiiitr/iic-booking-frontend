// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const state = vi.hoisted(() => ({
  api: {
    getIstemEquipmentMappings: vi.fn(),
    getIstemDepartmentMappings: vi.fn(),
    getIstemEquipmentSuggestions: vi.fn(),
    getIstemEquipmentListing: vi.fn(),
    saveIstemEquipmentMappingsBulk: vi.fn(),
    saveIstemDepartmentMappings: vi.fn(),
    searchIstemEquipment: vi.fn(),
    saveIstemEquipmentMapping: vi.fn(),
    getIstemInstitute: vi.fn(),
    saveIstemInstitute: vi.fn(),
  },
}));

vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: state.api }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, user_type: "admin" }, loading: false, isAuthenticated: true }) }));
vi.mock("@/components/DashboardHeader", () => ({ default: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

import AdminIstemEquipmentMapping from "./AdminIstemEquipmentMapping";
import { confidence, filterInstruments, sourceNote } from "@/components/istem/mappingModel";
import type { IstemMappingEquipmentRow } from "@/lib/api";

beforeAll(() => {
  // cmdk / Radix popover need these in jsdom.
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView = () => {};
});

const xrf: IstemMappingEquipmentRow = {
  equipment_id: 44, code: "XRF", name: "X-Ray Fluorescence (XRF)", department: { id: 1, name: "IIC" },
  requires_istem_fbr: true, input_fields: [{ key: "A", label: "No. of samples" }], open_istem_bookings: 0,
  mapping: {
    istem_equipment_id: "38750", sample_count_input_key: "A", is_active: true, notes: "", set_by: "IIC Administrator",
    set_at: "2026-11-02T10:00:00Z", remote_found: true, remote_equipment_name: "X-ray Fluorescence (XRF) -IIC",
    remote_checked_at: "2026-11-02T10:00:00Z",
  },
};
const fesem: IstemMappingEquipmentRow = {
  equipment_id: 45, code: "FESEM-01", name: "Field Emission SEM", department: { id: 1, name: "IIC" }, requires_istem_fbr: true,
  input_fields: [{ key: "A", label: "Samples" }], open_istem_bookings: 0, mapping: null,
};
const ebsd: IstemMappingEquipmentRow = { ...fesem, equipment_id: 47, code: "EBSD", name: "Electron Backscatter Diffraction" };
const raman: IstemMappingEquipmentRow = { ...fesem, equipment_id: 46, code: "RAMAN", name: "Raman", department: { id: 2, name: "Physics" }, requires_istem_fbr: false };

const LIVE = { live: true, read_at: "2026-11-03T05:00:00Z", problem: "", institute_id: "213" };
const LISTING = [
  { equipment_id: "38750", equipment_name: "X-ray Fluorescence (XRF) -IIC", department_id: "164", mapped_to: [{ equipment_id: 44, name: "XRF" }] },
  { equipment_id: "38751", equipment_name: "Field Emission Scanning Electron Microscope (FESEM)", department_id: "164", mapped_to: [] },
  { equipment_id: "38760", equipment_name: "EBSD Detector", department_id: "164", mapped_to: [] },
  { equipment_id: "40001", equipment_name: "Raman Spectrometer", department_id: "165", mapped_to: [] },
];

function mappings(linked: boolean) {
  return { data: {
    istem_connected: true, all_departments: true, equipment: [xrf, fesem, ebsd, raman],
    departments: [
      { id: 1, name: "IIC", total: 3, mapped: 1, fbr_unmapped: 2, istem_department_ids: linked ? ["164"] : [] },
      { id: 2, name: "Physics", total: 1, mapped: 0, fbr_unmapped: 0, istem_department_ids: [] },
    ],
  } };
}

function renderPage() {
  return render(<MemoryRouter><AdminIstemEquipmentMapping /></MemoryRouter>);
}

describe("I-STEM mapping helpers", () => {
  it("filters, rates and explains", () => {
    expect(filterInstruments([xrf, fesem, raman], "todo").map((r) => r.code)).toEqual(["FESEM-01", "RAMAN"]);
    expect(confidence(0.95).label).toBe("Certain");
    expect(confidence(0.75).label).toBe("Likely");
    expect(sourceNote(LIVE)).toBe("");
  });
});

describe("I-STEM mapping page", () => {
  beforeEach(() => {
    state.api.getIstemEquipmentMappings.mockResolvedValue(mappings(false));
    state.api.getIstemEquipmentListing.mockResolvedValue({ data: { equipment: LISTING, total: 4, mapped: 1, istem_source: LIVE } });
    state.api.getIstemDepartmentMappings.mockResolvedValue({ data: {
      istem_source: LIVE, portal_departments: [{ id: 1, name: "IIC" }, { id: 2, name: "Physics" }],
      istem_departments: [
        { istem_department_id: "164", name: "Institute Instrumentation Centre", equipment_count: 3, sample_equipment: ["EBSD Detector"], locations: [], department: null, suggested: { id: 1, name: "IIC", instruments: 1, by: "instruments" } },
        { istem_department_id: "165", name: "Department of Physics", equipment_count: 1, sample_equipment: ["Raman Spectrometer"], locations: [], department: null, suggested: { id: 2, name: "Physics", instruments: 0, by: "name" } },
        { istem_department_id: "1030", name: "Institute Computer Centre ICC", equipment_count: 0, sample_equipment: [], locations: [], department: null, suggested: null },
      ],
    } });
    state.api.getIstemEquipmentSuggestions.mockResolvedValue({ data: {
      department_id: 1, istem_total: 4, istem_source: LIVE,
      equipment: [{
        equipment_id: 45, code: "FESEM-01", name: "Field Emission SEM", department: { id: 1, name: "IIC" }, requires_istem_fbr: true,
        input_fields: [{ key: "A", label: "Samples" }], default_sample_key: "A", istem_departments: ["164"], confident: true,
        candidates: [{ ...LISTING[1], score: 0.95, reasons: ["model", "name"] }],
      }],
    } });
    state.api.saveIstemEquipmentMappingsBulk.mockResolvedValue({ data: { results: [{ equipment_id: 45, ok: true, warnings: [] }], saved: 1, failed: 0, checked: true } });
    state.api.saveIstemDepartmentMappings.mockResolvedValue({ data: { saved: 2, removed: 0 } });
    state.api.getIstemInstitute.mockResolvedValue({ data: {
      institute_id: "213", source: "token", token_institute_id: "213", user_entity: "IN", saved: null, can_set: true, problem: "",
    } });
  });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("reads I-STEM's whole list on arrival and opens on the I-STEM departments", async () => {
    renderPage();
    await waitFor(() => expect(state.api.getIstemEquipmentListing).toHaveBeenCalled());
    const rows = await screen.findAllByTestId("istem-department-row");
    expect(rows.map((r) => within(r).getAllByText(/Institute|Department/)[0].textContent)).toEqual([
      "Institute Instrumentation Centre", "Department of Physics",
    ]);
    expect(screen.getByText("4")).toBeTruthy(); // equipment on I-STEM
    fireEvent.click(screen.getByText(/Show 1 department with no active equipment/));
    expect(screen.getAllByTestId("istem-department-row")).toHaveLength(3);
  });

  it("matches every suggested department at once", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Accept all suggestions (2)" }));
    await waitFor(() => expect(state.api.saveIstemDepartmentMappings).toHaveBeenCalledWith([
      { istem_department_id: "164", department_id: 1 },
      { istem_department_id: "165", department_id: 2 },
    ]));
  });

  it("offers the linked I-STEM department's equipment for each instrument and saves the pick", async () => {
    state.api.getIstemEquipmentMappings.mockResolvedValue(mappings(true));
    renderPage();
    const rows = await screen.findAllByTestId("istem-mapping-row");
    expect(rows).toHaveLength(3);
    const ebsdRow = rows.find((r) => within(r).queryByText("Electron Backscatter Diffraction"))!;
    fireEvent.click(within(ebsdRow).getByRole("combobox", { name: "Choose I-STEM equipment" }));
    expect(await screen.findByText("Linked I-STEM department (3)")).toBeTruthy();
    expect(screen.queryByText("Raman Spectrometer")).toBeNull(); // other I-STEM department
    fireEvent.click(await screen.findByText("EBSD Detector"));
    await waitFor(() => expect(state.api.saveIstemEquipmentMappingsBulk).toHaveBeenCalledWith([
      { equipment_id: 47, istem_equipment_id: "38760", sample_count_input_key: "A" },
    ]));
  });

  it("accepts all certain matches of the department", async () => {
    state.api.getIstemEquipmentMappings.mockResolvedValue(mappings(true));
    renderPage();
    const button = await screen.findByRole("button", { name: "Accept all certain (1)" });
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(button);
    await waitFor(() => expect(state.api.saveIstemEquipmentMappingsBulk).toHaveBeenCalledWith([
      { equipment_id: 45, istem_equipment_id: "38751", sample_count_input_key: "A" },
    ]));
  });

  it("asks the Main Admin for the institute when I-STEM's sign-in names none, then reads the list again", async () => {
    state.api.getIstemInstitute
      .mockResolvedValueOnce({ data: { institute_id: null, source: "", token_institute_id: null, user_entity: "DP", saved: null, can_set: true, problem: "" } })
      .mockResolvedValue({ data: { institute_id: "213", source: "portal", token_institute_id: null, user_entity: "DP", saved: { institute_id: "213", set_at: "2026-11-04T05:00:00Z", set_by: "Demo Admin" }, can_set: true, problem: "" } });
    state.api.saveIstemInstitute.mockResolvedValue({ data: { institute_id: "213", departments: 34, warnings: [] } });
    renderPage();
    const card = await screen.findByTestId("istem-institute-card");
    fireEvent.change(within(card).getByLabelText("I-STEM institute ID"), { target: { value: "213" } });
    fireEvent.click(within(card).getByRole("button", { name: "Check and save" }));
    await waitFor(() => expect(state.api.saveIstemInstitute).toHaveBeenCalledWith("213"));
    await waitFor(() => expect(screen.queryByTestId("istem-institute-card")).toBeNull());
    expect(await screen.findByText(/institute 213 \(set on portal\)/)).toBeTruthy();
    await waitFor(() => expect(state.api.getIstemEquipmentListing.mock.calls.length).toBeGreaterThanOrEqual(2));
  });

  it("says why when I-STEM's list cannot be read", async () => {
    state.api.getIstemEquipmentListing.mockResolvedValue({ error: "I-STEM signed the portal in but named no institute (institute_id)." });
    renderPage();
    expect(await screen.findByText(/named no institute/)).toBeTruthy();
  });
});

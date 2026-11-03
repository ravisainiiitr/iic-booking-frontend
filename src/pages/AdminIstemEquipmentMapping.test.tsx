// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const state = vi.hoisted(() => ({
  api: {
    getIstemEquipmentMappings: vi.fn(),
    getIstemDepartmentMappings: vi.fn(),
    getIstemEquipmentSuggestions: vi.fn(),
    saveIstemEquipmentMappingsBulk: vi.fn(),
    saveIstemDepartmentMappings: vi.fn(),
    searchIstemEquipment: vi.fn(),
    saveIstemEquipmentMapping: vi.fn(),
    getIstemEquipmentListing: vi.fn(),
  },
}));

vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: state.api }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, user_type: "admin" }, loading: false, isAuthenticated: true }) }));
vi.mock("@/components/DashboardHeader", () => ({ default: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

import AdminIstemEquipmentMapping from "./AdminIstemEquipmentMapping";
import { confidence, filterInstruments, sourceNote } from "@/components/istem/mappingModel";
import type { IstemMappingEquipmentRow } from "@/lib/api";

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
const raman: IstemMappingEquipmentRow = { ...fesem, equipment_id: 46, code: "RAMAN", name: "Raman", department: { id: 2, name: "Physics" }, requires_istem_fbr: false };

const LIVE = { live: true, read_at: "2026-11-03T05:00:00Z", problem: "" };

function renderPage() {
  return render(<MemoryRouter><AdminIstemEquipmentMapping /></MemoryRouter>);
}

describe("I-STEM mapping helpers", () => {
  it("filters, rates and explains", () => {
    expect(filterInstruments([xrf, fesem, raman], "todo").map((r) => r.code)).toEqual(["FESEM-01", "RAMAN"]);
    expect(filterInstruments([xrf, fesem], "all", "38750").map((r) => r.code)).toEqual(["XRF"]);
    expect(confidence(0.95).label).toBe("Certain");
    expect(confidence(0.75).label).toBe("Likely");
    expect(confidence(0.5).label).toBe("Possible");
    expect(sourceNote(LIVE)).toBe("");
    expect(sourceNote({ live: false, read_at: null, problem: "I-STEM's server is not answering at the moment (it is run by IISc)." }))
      .toContain("Showing I-STEM's list as read earlier");
  });
});

describe("I-STEM mapping page", () => {
  beforeEach(() => {
    state.api.getIstemEquipmentMappings.mockResolvedValue({ data: {
      istem_connected: true, all_departments: true, equipment: [xrf, fesem, raman],
      departments: [
        { id: 1, name: "IIC", total: 2, mapped: 1, fbr_unmapped: 1, istem_department_ids: [] },
        { id: 2, name: "Physics", total: 1, mapped: 0, fbr_unmapped: 0, istem_department_ids: ["171"] },
      ],
    } });
    state.api.getIstemDepartmentMappings.mockResolvedValue({ data: {
      istem_source: LIVE, portal_departments: [{ id: 1, name: "IIC" }, { id: 2, name: "Physics" }],
      istem_departments: [
        { istem_department_id: "164", equipment_count: 12, sample_equipment: ["FESEM", "XRF"], locations: ["Analytical Section -1, IIC"], department: null, suggested: { id: 1, name: "IIC", instruments: 1 } },
        { istem_department_id: "171", name: "Department of Physics", equipment_count: 3, sample_equipment: ["Raman"], locations: [], department: { id: 2, name: "Physics" }, suggested: null },
      ],
    } });
    state.api.getIstemEquipmentSuggestions.mockResolvedValue({ data: {
      department_id: 1, istem_total: 15, istem_source: LIVE,
      equipment: [{
        equipment_id: 45, code: "FESEM-01", name: "Field Emission SEM", department: { id: 1, name: "IIC" }, requires_istem_fbr: true,
        input_fields: [{ key: "A", label: "Samples" }], default_sample_key: "A", istem_departments: [], confident: true,
        candidates: [{ equipment_id: "38751", equipment_name: "Field Emission Scanning Electron Microscope (FESEM)", score: 0.95, reasons: ["model", "name"], mapped_to: [] }],
      }],
    } });
  });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("opens on the first department with work, with its instruments and the best I-STEM match", async () => {
    renderPage();
    const items = await screen.findAllByTestId("department-item");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText("Not linked to I-STEM")).toBeTruthy();
    expect(await within(items[1]).findByText("I-STEM: Department of Physics (171)")).toBeTruthy();
    const rows = await screen.findAllByTestId("istem-mapping-row");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Found on I-STEM")).toBeTruthy();
    expect(await within(rows[1]).findByText("Field Emission Scanning Electron Microscope (FESEM)")).toBeTruthy();
    expect(within(rows[1]).getByText("Certain")).toBeTruthy();
    expect(state.api.getIstemEquipmentSuggestions).toHaveBeenCalledWith("1", false);
  });

  it("accepts a suggestion with one click", async () => {
    state.api.saveIstemEquipmentMappingsBulk.mockResolvedValue({ data: { results: [{ equipment_id: 45, ok: true, warnings: [] }], saved: 1, failed: 0, checked: true } });
    renderPage();
    const rows = await screen.findAllByTestId("istem-mapping-row");
    fireEvent.click(await within(rows[1]).findByRole("button", { name: /Accept/ }));
    await waitFor(() => expect(state.api.saveIstemEquipmentMappingsBulk).toHaveBeenCalledWith([
      { equipment_id: 45, istem_equipment_id: "38751", sample_count_input_key: "A" },
    ]));
  });

  it("accepts all certain matches of the department", async () => {
    state.api.saveIstemEquipmentMappingsBulk.mockResolvedValue({ data: { results: [], saved: 1, failed: 0, checked: true } });
    renderPage();
    const button = await screen.findByRole("button", { name: "Accept all certain (1)" });
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(button);
    await waitFor(() => expect(state.api.saveIstemEquipmentMappingsBulk).toHaveBeenCalledTimes(1));
  });

  it("switches department from the list", async () => {
    renderPage();
    const items = await screen.findAllByTestId("department-item");
    fireEvent.click(items[1]);
    expect(await screen.findByRole("heading", { name: "Physics" })).toBeTruthy();
    await waitFor(() => expect(state.api.getIstemEquipmentSuggestions).toHaveBeenCalledWith("2", false));
    expect(screen.getAllByTestId("linked-istem-department")).toHaveLength(1);
  });

  it("explains when I-STEM is not answering and the saved list is used", async () => {
    state.api.getIstemEquipmentSuggestions.mockResolvedValue({ data: {
      department_id: 1, istem_total: 15, equipment: [],
      istem_source: { live: false, read_at: "2026-11-03T05:00:00Z", problem: "I-STEM's server is not answering at the moment (it is run by IISc)." },
    } });
    renderPage();
    expect(await screen.findByText(/Mappings can still be saved/)).toBeTruthy();
    expect(screen.getByText(/I-STEM not answering/)).toBeTruthy();
  });
});

describe("I-STEM institute", () => {
  it("shows the institute named in I-STEM's token", async () => {
    const { apiClient } = await import("@/lib/api");
    const api = apiClient as unknown as Record<string, ReturnType<typeof vi.fn>>;
    api.getIstemEquipmentMappings.mockResolvedValue({ data: { istem_connected: true, all_departments: true, equipment: [], departments: [] } });
    api.getIstemDepartmentMappings.mockResolvedValue({ data: { istem_departments: [], portal_departments: [],
      istem_source: { live: true, read_at: "2026-11-03T05:00:00Z", problem: "", institute_id: "213" } } });
    api.getIstemEquipmentSuggestions.mockResolvedValue({ data: { department_id: null, istem_total: 0, equipment: [] } });
    render(<MemoryRouter><AdminIstemEquipmentMapping /></MemoryRouter>);
    expect(await screen.findByText(/I-STEM connected · institute 213/)).toBeTruthy();
  });
});

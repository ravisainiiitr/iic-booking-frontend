// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const state = vi.hoisted(() => ({
  api: {
    getIstemEquipmentMappings: vi.fn(),
    searchIstemEquipment: vi.fn(),
    saveIstemEquipmentMapping: vi.fn(),
    verifyIstemEquipmentMappings: vi.fn(),
  },
}));

vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: state.api }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, user_type: "admin" }, loading: false, isAuthenticated: true }) }));
vi.mock("@/components/DashboardHeader", () => ({ default: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

import AdminIstemEquipmentMapping, { filterRows } from "./AdminIstemEquipmentMapping";
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
  equipment_id: 45, code: "FESEM", name: "FESEM", department: { id: 2, name: "Physics" }, requires_istem_fbr: true,
  input_fields: [{ key: "B", label: "Samples" }], open_istem_bookings: 0, mapping: null,
};
const raman: IstemMappingEquipmentRow = { ...fesem, equipment_id: 46, code: "RAMAN", name: "Raman", requires_istem_fbr: false };

function renderPage() {
  return render(<MemoryRouter><AdminIstemEquipmentMapping /></MemoryRouter>);
}

describe("I-STEM equipment mapping", () => {
  beforeEach(() => {
    state.api.getIstemEquipmentMappings.mockResolvedValue({
      data: { istem_connected: true, all_departments: true, equipment: [xrf, fesem, raman] },
    });
  });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("filters instruments that need mapping, are mapped, or match a department", () => {
    const rows = [xrf, fesem, raman];
    expect(filterRows(rows, "needs", "", "__all__").map((r) => r.code)).toEqual(["FESEM"]);
    expect(filterRows(rows, "mapped", "", "__all__").map((r) => r.code)).toEqual(["XRF"]);
    expect(filterRows(rows, "all", "38750", "__all__").map((r) => r.code)).toEqual(["XRF"]);
    expect(filterRows(rows, "all", "", "2").map((r) => r.code)).toEqual(["FESEM", "RAMAN"]);
    expect(filterRows([{ ...xrf, mapping: { ...xrf.mapping!, remote_found: false } }], "not_found", "", "__all__")).toHaveLength(1);
  });

  it("lists instruments with their I-STEM status", async () => {
    renderPage();
    const rows = await screen.findAllByTestId("istem-mapping-row");
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText("38750")).toBeTruthy();
    expect(within(rows[0]).getByText("Found on I-STEM")).toBeTruthy();
    expect(within(rows[1]).getByRole("button", { name: "Map" })).toBeTruthy();
  });

  it("maps an instrument by picking it from the I-STEM search", async () => {
    state.api.searchIstemEquipment.mockResolvedValue({
      data: { results: [{ equipment_id: "41001", equipment_name: "Field Emission SEM", mapped_to: [] }] },
    });
    state.api.saveIstemEquipmentMapping.mockResolvedValue({ data: { mapping: {}, warnings: [], checked: true } });
    renderPage();
    const rows = await screen.findAllByTestId("istem-mapping-row");
    fireEvent.click(within(rows[1]).getByRole("button", { name: "Map" }));
    fireEvent.click(await screen.findByRole("button", { name: /Search/ }));
    fireEvent.click(await screen.findByText("Field Emission SEM"));
    fireEvent.click(screen.getByRole("button", { name: /Save mapping/ }));
    await waitFor(() => expect(state.api.saveIstemEquipmentMapping).toHaveBeenCalledWith(45, {
      istem_equipment_id: "41001", sample_count_input_key: "", is_active: true, notes: "",
    }));
    expect(state.api.searchIstemEquipment).toHaveBeenCalledWith("FESEM");
  });

  it("locks the I-STEM ID while bookings are open on I-STEM", async () => {
    state.api.getIstemEquipmentMappings.mockResolvedValue({
      data: { istem_connected: false, all_departments: false, equipment: [{ ...xrf, open_istem_bookings: 2 }] },
    });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    expect((screen.getByLabelText("I-STEM equipment ID") as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText(/2 booking\(s\) are still open on I-STEM/)).toBeTruthy();
    expect(screen.getByText(/its equipment list cannot be searched/)).toBeTruthy();
  });
});

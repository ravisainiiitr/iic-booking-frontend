// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const state = vi.hoisted(() => ({
  userType: "admin",
  api: {
    getEquipmentConfigAudit: vi.fn(),
    getEquipmentConfigAuditFacets: vi.fn(),
    getEquipmentConfigAuditDetail: vi.fn(),
    getOicRegisteredRequests: vi.fn(),
  },
}));

vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: state.api }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: 1, user_type: state.userType }, loading: false, isAuthenticated: true }),
}));
vi.mock("@/components/DashboardHeader", () => ({ default: () => null }));

import AdminEquipmentConfigAudit from "./AdminEquipmentConfigAudit";
import OicRequestRegistration from "@/components/booking/OicRequestRegistration";

const row = {
  id: 9, equipment_id: 44, equipment_code: "XRD-01", equipment_name: "Powder XRD", object_type: "Equipment",
  object_label: "", action: "UPDATED", action_label: "Updated", setting: "reschedule_hours_threshold",
  setting_label: "Reschedule Hours Threshold", previous_value: "48", new_value: "24", changed_by_id: 1,
  changed_by: "Demo Admin", changed_by_role: "admin", changed_by_department: "IIC", is_system: false,
  source: "DASHBOARD", source_label: "Dashboard", changed_at: "2026-11-03T10:00:00Z",
};

beforeEach(() => {
  state.userType = "admin";
  state.api.getEquipmentConfigAudit.mockResolvedValue({ data: {
    count: 1, page: 1, page_size: 25, num_pages: 1, results: [row],
    sources: [{ value: "DASHBOARD", label: "Dashboard" }], actions: [],
  } });
  state.api.getEquipmentConfigAuditFacets.mockResolvedValue({ data: {
    equipment: [{ id: 44, code: "XRD-01", name: "Powder XRD" }], users: [{ id: 1, name: "Demo Admin" }],
    settings: [{ value: "reschedule_hours_threshold", label: "Reschedule Hours Threshold" }],
  } });
  state.api.getEquipmentConfigAuditDetail.mockResolvedValue({ data: { ...row, process: "PATCH /api/admin/equipment/44/", reference: "req-1" } });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Equipment configuration audit trail", () => {
  it("lists changes with old and new values and opens the detail", async () => {
    render(<MemoryRouter><AdminEquipmentConfigAudit /></MemoryRouter>);
    const rows = await screen.findByTestId("audit-rows");
    expect(within(rows).getByText("Powder XRD")).toBeTruthy();
    expect(within(rows).getByText("48")).toBeTruthy();
    expect(within(rows).getByText("24")).toBeTruthy();
    expect(within(rows).getByText("Demo Admin")).toBeTruthy();
    fireEvent.click(within(rows).getByRole("button"));
    expect(await screen.findByText("PATCH /api/admin/equipment/44/")).toBeTruthy();
    expect(state.api.getEquipmentConfigAuditDetail).toHaveBeenCalledWith(9);
  });

  it("filters by date and search", async () => {
    render(<MemoryRouter><AdminEquipmentConfigAudit /></MemoryRouter>);
    await screen.findByTestId("audit-rows");
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-11-01" } });
    await waitFor(() => expect(state.api.getEquipmentConfigAudit).toHaveBeenLastCalledWith(
      expect.objectContaining({ date_from: "2026-11-01", page: 1 }),
    ));
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "xrd" } });
    fireEvent.submit(screen.getByLabelText("Search").closest("form")!);
    await waitFor(() => expect(state.api.getEquipmentConfigAudit).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: "xrd" }),
    ));
  });

  it("is closed to everyone but the Main Administrator", () => {
    state.userType = "manager";
    render(<MemoryRouter><AdminEquipmentConfigAudit /></MemoryRouter>);
    expect(screen.getByRole("alert").textContent).toContain("Only the Main Administrator");
    expect(state.api.getEquipmentConfigAudit).not.toHaveBeenCalled();
  });
});

describe("OIC request registration panel", () => {
  it("shows the registered requests and switches registration on", async () => {
    state.api.getOicRegisteredRequests.mockResolvedValue({ data: { allowed: true, equipment_id: 5, results: [
      { booking_id: 7, reference: "IICERL202600007", status: "BOOKED", status_display: "Booked", start_time: "2026-11-05T04:30:00Z", end_time: null, notes: "", created_at: "2026-11-03T10:00:00Z" },
    ] } });
    const onActive = vi.fn();
    render(<OicRequestRegistration equipmentId={5} active={false} onActiveChange={onActive} />);
    expect(await screen.findByText("IICERL202600007")).toBeTruthy();
    fireEvent.click(screen.getByRole("switch"));
    expect(onActive).toHaveBeenCalledWith(true);
  });
});

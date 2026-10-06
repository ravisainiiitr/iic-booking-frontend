// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import ChangeSlotStatus from "./ChangeSlotStatus";

const auth = vi.hoisted(() => ({ state: { user: { id: 3, user_type: "manager" } as Record<string, unknown> } }));
const api = vi.hoisted(() => ({ getSlotStatusPicker: vi.fn() }));
const departmentFilter = vi.hoisted(() => ({ rendered: false }));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth.state }));
vi.mock("@/components/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/components/DepartmentFilter", () => ({
  default: ({ onResolved }: { onResolved?: (v: number) => void }) => {
    departmentFilter.rendered = true;
    onResolved?.(5);
    return <div data-testid="department-filter" />;
  },
}));
vi.mock("@/lib/api", () => ({ apiClient: api }));

const filters = {
  scope: "equipment",
  department_locked: true,
  locked_department_id: null,
  department_id: null,
  equipment_id: null,
  equipment_options: [
    { equipment_id: 11, code: "XRD", name: "X-ray Diffractometer", department_id: 5 },
    { equipment_id: 12, code: "SEM", name: "SEM", department_id: 5 },
  ],
};

const rows = [
  {
    equipment_id: 11,
    code: "XRD",
    name: "X-ray Diffractometer",
    status: "ACTIVE",
    status_display: "Operational",
    department_id: 5,
    department_name: "Institute Instrumentation Centre",
    department_code: "IIC",
    temporary_oic: false,
  },
  {
    equipment_id: 12,
    code: "SEM",
    name: "SEM",
    status: "REPAIR",
    status_display: "Under Maintenance",
    department_id: 5,
    department_name: "Institute Instrumentation Centre",
    department_code: "IIC",
    temporary_oic: true,
  },
];

function Where() {
  const loc = useLocation();
  return <div data-testid="where">{`${loc.pathname}${loc.search}`}</div>;
}

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/change-slot-status"]}>
      <Routes>
        <Route path="/change-slot-status" element={<ChangeSlotStatus />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  departmentFilter.rendered = false;
  api.getSlotStatusPicker.mockReset();
  api.getSlotStatusPicker.mockResolvedValue({ data: { equipment: rows, count: 2, filters } });
});
afterEach(() => cleanup());

describe("Change slot status picker", () => {
  it("lists the OIC's equipment without a department filter and opens the slot status calendar", async () => {
    auth.state = { user: { id: 3, user_type: "manager" } };
    renderPage();
    expect(await screen.findByText("X-ray Diffractometer")).toBeTruthy();
    expect(screen.getByText("Temporary OIC")).toBeTruthy();
    expect(screen.getByText("Under Maintenance")).toBeTruthy();
    expect(departmentFilter.rendered).toBe(false);
    expect(api.getSlotStatusPicker).toHaveBeenCalledWith({ departmentId: undefined, equipmentId: undefined });

    fireEvent.click(screen.getAllByRole("button", { name: /change slot status/i })[0]);
    expect(screen.getByTestId("where").textContent).toBe("/book-equipment?equipment_id=11&mode=status");
  });

  it("gives the Main Administrator a department filter and loads that department", async () => {
    auth.state = { user: { id: 1, user_type: "admin" } };
    renderPage();
    await waitFor(() => expect(api.getSlotStatusPicker).toHaveBeenCalledWith({ departmentId: 5, equipmentId: undefined }));
    expect(screen.getByTestId("department-filter")).toBeTruthy();
    expect(await screen.findByText("SEM")).toBeTruthy();
  });

  it("sends Department Administrators and other roles back to the dashboard", async () => {
    auth.state = { user: { id: 2, user_type: "dept_admin" } };
    renderPage();
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/dashboard"));
    expect(api.getSlotStatusPicker).not.toHaveBeenCalled();
  });
});

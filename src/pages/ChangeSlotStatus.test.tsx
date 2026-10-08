// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect, type ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import ChangeSlotStatus from "./ChangeSlotStatus";

const auth = vi.hoisted(() => ({ state: { user: { id: 3, user_type: "manager" } as Record<string, unknown> } }));
const api = vi.hoisted(() => ({ getSlotStatusPicker: vi.fn() }));
const departmentFilter = vi.hoisted(() => ({ rendered: false, value: null as unknown }));
const bookEquipment = vi.hoisted(() => ({ mounts: 0 }));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth.state }));
vi.mock("@/components/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/components/DepartmentFilter", () => ({
  default: ({
    value,
    onChange,
    onResolved,
    defaultDepartmentName,
  }: {
    value: "all" | number;
    onChange: (v: number) => void;
    onResolved?: (v: "all" | number) => void;
    defaultDepartmentName?: string;
  }) => {
    departmentFilter.rendered = true;
    departmentFilter.value = value;
    useEffect(() => {
      if (value === "all" && defaultDepartmentName) {
        onChange(5);
        onResolved?.(5);
      } else onResolved?.(value);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return <div data-testid="department-filter" />;
  },
}));
vi.mock("@/components/ui/select", async () => {
  const React = await import("react");
  const Ctx = React.createContext<(v: string) => void>(() => undefined);
  return {
    Select: ({ onValueChange, children }: { onValueChange: (v: string) => void; children: ReactNode }) => (
      <Ctx.Provider value={onValueChange}>{children}</Ctx.Provider>
    ),
    SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    SelectValue: () => null,
    SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    SelectItem: ({ value, children }: { value: string; children: ReactNode }) => {
      const onValueChange = React.useContext(Ctx);
      return (
        <button type="button" role="option" onClick={() => onValueChange(value)}>
          {children}
        </button>
      );
    },
  };
});
vi.mock("@/pages/BookEquipment", () => ({
  default: ({ slotStatusFilters }: { slotStatusFilters?: ReactNode }) => {
    useEffect(() => {
      bookEquipment.mounts += 1;
    }, []);
    return <div data-testid="slot-status-calendar">{slotStatusFilters}</div>;
  },
}));
vi.mock("@/lib/api", () => ({ apiClient: api }));

const row = (equipment_id: number, name: string, extra: Record<string, unknown> = {}) => ({
  equipment_id,
  code: name.slice(0, 3).toUpperCase(),
  name,
  status: "ACTIVE",
  status_display: "Operational",
  department_id: 5,
  department_name: "Institute Instrumentation Centre",
  department_code: "IIC",
  temporary_oic: false,
  ...extra,
});

const iicRows = [
  row(11, "X-ray Diffractometer"),
  row(12, "SEM", { status: "REPAIR", status_display: "Under Maintenance", temporary_oic: true }),
];

function Where() {
  const loc = useLocation();
  return <div data-testid="where">{`${loc.pathname}${loc.search}`}</div>;
}

const renderPage = (entry = "/change-slot-status") =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route
          path="/change-slot-status"
          element={
            <>
              <ChangeSlotStatus />
              <Where />
            </>
          }
        />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>
  );

const where = () => screen.getByTestId("where").textContent ?? "";

beforeEach(() => {
  departmentFilter.rendered = false;
  departmentFilter.value = null;
  bookEquipment.mounts = 0;
  api.getSlotStatusPicker.mockReset();
  api.getSlotStatusPicker.mockResolvedValue({ data: { equipment: iicRows, count: 2, filters: {} } });
});
afterEach(() => cleanup());

describe("Change slot status", () => {
  it("opens the OIC's first equipment directly, without a department filter", async () => {
    auth.state = { user: { id: 3, user_type: "manager" } };
    renderPage();
    expect(await screen.findByTestId("slot-status-calendar")).toBeTruthy();
    expect(where()).toBe("/change-slot-status?equipment_id=11");
    expect(departmentFilter.rendered).toBe(false);
    expect(api.getSlotStatusPicker).toHaveBeenCalledWith({});
    expect(screen.getByRole("option", { name: /SEM.*Under Maintenance.*Temporary OIC/ })).toBeTruthy();
  });

  it("switches equipment from the filter, updating the URL and reloading the calendar", async () => {
    auth.state = { user: { id: 3, user_type: "manager" } };
    renderPage("/change-slot-status?equipment_id=11&month=2026-12");
    await screen.findByTestId("slot-status-calendar");
    expect(bookEquipment.mounts).toBe(1);

    fireEvent.click(screen.getByRole("option", { name: /SEM/ }));
    await waitFor(() => expect(where()).toBe("/change-slot-status?equipment_id=12"));
    await waitFor(() => expect(bookEquipment.mounts).toBe(2));
  });

  it("preselects the equipment from the link", async () => {
    auth.state = { user: { id: 3, user_type: "manager" } };
    renderPage("/change-slot-status?equipment_id=12&month=2026-11");
    await screen.findByTestId("slot-status-calendar");
    expect(where()).toBe("/change-slot-status?equipment_id=12&month=2026-11");
  });

  it("gives the Main Administrator a department filter defaulting to IIC", async () => {
    auth.state = { user: { id: 1, user_type: "admin" } };
    renderPage();
    await waitFor(() => expect(api.getSlotStatusPicker).toHaveBeenCalledWith({ departmentId: 5 }));
    expect(screen.getByTestId("department-filter")).toBeTruthy();
    await screen.findByTestId("slot-status-calendar");
    expect(where()).toBe("/change-slot-status?dept=5&equipment_id=11");
  });

  it("opens a linked equipment in its own department for the Main Administrator", async () => {
    auth.state = { user: { id: 1, user_type: "admin" } };
    const mechRows = [row(40, "Laser Cutter", { department_id: 7, department_code: "MIED" }), row(41, "Lathe", { department_id: 7 })];
    api.getSlotStatusPicker.mockImplementation(async (q: { departmentId?: number; equipmentId?: number }) => ({
      data: { equipment: q.equipmentId === 41 ? [mechRows[1]] : q.departmentId === 7 ? mechRows : iicRows, count: 2, filters: {} },
    }));
    renderPage("/change-slot-status?equipment_id=41");
    await screen.findByTestId("slot-status-calendar");
    expect(api.getSlotStatusPicker).toHaveBeenCalledWith({ equipmentId: 41 });
    expect(api.getSlotStatusPicker).toHaveBeenCalledWith({ departmentId: 7 });
    expect(api.getSlotStatusPicker).not.toHaveBeenCalledWith({ departmentId: 5 });
    expect(departmentFilter.value).toBe(7);
    expect(where()).toBe("/change-slot-status?equipment_id=41&dept=7");
  });

  it("shows a friendly message when the OIC has no equipment", async () => {
    auth.state = { user: { id: 3, user_type: "manager" } };
    api.getSlotStatusPicker.mockResolvedValue({ data: { equipment: [], count: 0, filters: {} } });
    renderPage();
    expect(await screen.findByText(/not Officer In-charge of any equipment/)).toBeTruthy();
    expect(screen.queryByTestId("slot-status-calendar")).toBeNull();
  });

  it("sends Department Administrators and other roles back to the dashboard", async () => {
    auth.state = { user: { id: 2, user_type: "dept_admin" } };
    renderPage();
    await waitFor(() => expect(where()).toBe("/dashboard"));
    expect(api.getSlotStatusPicker).not.toHaveBeenCalled();
  });
});

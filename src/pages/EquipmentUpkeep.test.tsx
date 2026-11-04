// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const api = vi.hoisted(() => ({
  list: vi.fn(),
  detail: vi.fn(),
  saveSetting: vi.fn(),
  createPlan: vi.fn(),
  updatePlan: vi.fn(),
  closePlan: vi.fn(),
  completePlan: vi.fn(),
  alerts: vi.fn(),
  acknowledge: vi.fn(),
}));

vi.mock("@/lib/upkeepApi", () => ({ upkeepApi: api }));
vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: { getToken: () => "tok" } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/training/trainingUi", async (orig) => {
  const actual = await orig<typeof import("@/components/training/trainingUi")>();
  return {
    ...actual,
    TrainingPageFrame: ({ title, children }: { title: string; children: React.ReactNode }) => (
      <div>
        <h1>{title}</h1>
        {children}
      </div>
    ),
  };
});

import EquipmentUpkeep from "./EquipmentUpkeep";

const eq = { equipment_id: 7, name: "XRD", code: "XRD1", status: "ACTIVE" };
const alert = {
  id: 3, equipment: eq, kind: "PLAN_OVERDUE", kind_label: "Maintenance overdue", severity: "CRITICAL",
  message: "Calibration was due on 01 Nov 2026, 3 day(s) ago.", opened_at: "2026-11-04T01:30:00Z", resolved_at: null,
  acknowledged_by: null, acknowledged_at: null, acknowledge_note: "",
};
const plan = {
  id: 9, equipment_id: 7, kind: "CALIBRATION", kind_label: "Calibration", title: "Si standard calibration",
  instructions: "", interval_days: 180, lead_days: 14, last_done_on: null, next_due_on: "2026-11-01", state: "OVERDUE",
  responsible: { id: 2, name: "Lab Operator" }, is_active: true, closed_reason: "", can_record: true,
};
const detail = {
  equipment: eq,
  setting: { uptime_target_pct: 95, breakdown_alert_count: 3, breakdown_window_days: 90 },
  metrics: {
    days: 90, from: "", to: "", uptime_pct: 93.2, availability_excl_planned_pct: 94, target_pct: 95, below_target: true,
    downtime_hours: 146.9, breakdown_hours: 120, planned_hours: 26.9, staff_unavailable_hours: 0, breakdowns: 3,
    mttr_hours: 40, mtbf_hours: 671, causes: [{ cause: "Vacuum fault", count: 2, hours: 100 }],
  },
  plans: [plan],
  completions: [],
  alerts: [alert],
  can_manage: true,
  kinds: [{ value: "PREVENTIVE", label: "Preventive maintenance" }, { value: "CALIBRATION", label: "Calibration" }],
};

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <EquipmentUpkeep />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.list.mockResolvedValue({
    data: {
      results: [{ equipment: eq, uptime_pct: 93.2, target_pct: 95, below_target: true, breakdowns: 3, downtime_hours: 146.9,
        open_alerts: 1, plans: 1, next_due_on: "2026-11-01", can_manage: true }],
      truncated: false,
    },
  });
  api.alerts.mockResolvedValue({ data: { results: [alert] } });
  api.detail.mockResolvedValue({ data: detail });
});

afterEach(() => cleanup());

describe("Equipment upkeep", () => {
  it("lists equipment with uptime against target and open alerts, and acknowledges an alert", async () => {
    api.acknowledge.mockResolvedValue({ data: { ...alert, acknowledged_by: { id: 1, name: "OIC" } } });
    renderAt("/upkeep");
    expect(await screen.findByRole("button", { name: "XRD" })).toBeTruthy();
    expect(screen.getByText("93.2%")).toBeTruthy();
    expect(screen.getByText("Open alerts (1)")).toBeTruthy();
    expect(api.list).toHaveBeenCalledWith({ days: 90 });
    fireEvent.click(screen.getByRole("button", { name: "Acknowledge" }));
    fireEvent.change(await screen.findByRole("textbox"), { target: { value: "Engineer booked" } });
    const buttons = screen.getAllByRole("button", { name: "Acknowledge" });
    fireEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(api.acknowledge).toHaveBeenCalledWith(3, "Engineer booked"));
  });

  it("opens the equipment detail with metrics, the schedule and recording a completion", async () => {
    api.completePlan.mockResolvedValue({ data: { completion: {}, plan: { ...plan, state: "OK", next_due_on: "2027-05-03" } } });
    renderAt("/upkeep?equipment=7");
    const metrics = await screen.findByTestId("upkeep-metrics");
    expect(metrics.textContent).toContain("93.2%");
    expect(metrics.textContent).toContain("40.0 h"); // MTTR
    expect(metrics.textContent).toContain("28.0 d"); // MTBF 671 h
    expect(screen.getByText("Vacuum fault")).toBeTruthy();
    expect(screen.getByText("Overdue")).toBeTruthy();
    expect(api.detail).toHaveBeenCalledWith(7, 90);
    fireEvent.click(screen.getByRole("button", { name: "Record done" }));
    fireEvent.change(await screen.findByLabelText("Service / calibration report reference"), { target: { value: "CAL/11" } });
    fireEvent.click(screen.getByRole("button", { name: "Record" }));
    await waitFor(() => expect(api.completePlan).toHaveBeenCalledWith(9, { notes: "", report_reference: "CAL/11" }));
  });

  it("lets the OIC schedule new maintenance", async () => {
    api.createPlan.mockResolvedValue({ data: { ...plan, id: 10 } });
    renderAt("/upkeep?equipment=7");
    fireEvent.click(await screen.findByRole("button", { name: /Schedule/ }));
    fireEvent.change(await screen.findByLabelText("What is done"), { target: { value: "Chiller filter" } });
    fireEvent.change(screen.getByLabelText("Repeat every (days)"), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(api.createPlan).toHaveBeenCalledWith(7, { title: "Chiller filter", kind: "PREVENTIVE", interval_days: 30, lead_days: 14, instructions: "" }),
    );
  });

  it("hides scheduling and targets from staff who cannot manage", async () => {
    api.detail.mockResolvedValue({ data: { ...detail, can_manage: false, plans: [{ ...plan, can_record: true }] } });
    renderAt("/upkeep?equipment=7");
    await screen.findByTestId("upkeep-metrics");
    expect(screen.queryByRole("button", { name: /Schedule/ })).toBeNull();
    expect(screen.queryByLabelText("Uptime target (%)")).toBeNull();
    expect(screen.getByRole("button", { name: "Record done" })).toBeTruthy();
  });
});

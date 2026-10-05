// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import OICEquipmentSettings from "./OICEquipmentSettings";

const auth = vi.hoisted(() => ({
  state: {
    user: { id: 3, email: "oic@iitr.ac.in", name: "OIC", user_type: "manager" } as Record<string, unknown>,
    isAuthenticated: true,
    loading: false,
  },
}));

const api = vi.hoisted(() => ({
  canEditReference: false,
  update: vi.fn(),
}));

const settingsRow = {
  equipment_id: 7,
  equipment_code: "FESEM",
  equipment_name: "Field Emission SEM",
  profile_type: "STANDARD",
  usage: { waitlist_active: 3, urgent_pending: 1, rush_relief_this_week: 2, surcharge_this_week: 0 },
  settings: {
    slot_window_reference_weekday: 2,
    slot_window_reference_time: "21:00",
    weekly_view_time_from: null,
    weekly_view_time_to: null,
    external_slot_quota_percent: 0,
    booking_not_utilize_window_hours: 24,
    results_deadline_value: 0,
    results_deadline_unit: "WORKING_DAYS",
    show_results_deadline_to_users: false,
    sample_submission_lead_hours: 0,
    sample_collect_deadline_hours: 0,
    waitlist_queue_depth: 10,
    max_urgent_requests: null,
    max_rush_relief_requests_per_week: 2,
    max_surcharge_urgent_requests_per_week: null,
    important_instruction: "",
    important_instruction_by_user_type: {},
  },
};

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth.state }));
vi.mock("@/components/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/components/RichTextEditor", () => ({ RichTextEditor: () => null }));
vi.mock("@/lib/api", () => {
  const handlers: Record<string, unknown> = {
    getOicEquipmentSettings: async () => ({
      data: {
        equipments: [settingsRow],
        has_print_3d_equipment: false,
        can_edit_slot_window_reference: api.canEditReference,
        instruction_user_types: [],
      },
    }),
    getOicEquipmentGroupQuotas: async () => ({ data: { groups: [] } }),
    updateOicEquipmentSettings: (...args: unknown[]) => api.update(...args),
  };
  return {
    apiClient: new Proxy(handlers, { get: (target, key: string) => target[key] ?? (async () => ({ data: null })) }),
  };
});

const renderAs = (userType: string) => {
  auth.state = { ...auth.state, user: { ...auth.state.user, user_type: userType } };
  api.canEditReference = userType === "admin";
  api.update.mockReset();
  api.update.mockResolvedValue({ data: { equipment: settingsRow } });
  return render(
    <MemoryRouter>
      <OICEquipmentSettings />
    </MemoryRouter>,
  );
};

afterEach(() => cleanup());

describe("Equipment Booking Configuration: slot window reference", () => {
  it("is hidden from the Officer In Charge and never sent on save", async () => {
    renderAs("manager");
    expect(await screen.findByLabelText("Weekly view from (24h)")).toBeTruthy();
    expect(screen.queryByText("Slot window reference weekday")).toBeNull();
    expect(screen.queryByText("Reference time (24h)")).toBeNull();
    expect(screen.queryByTestId("oic-slot-window-reference")).toBeNull();

    fireEvent.change(screen.getByLabelText("Waitlist depth"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: /Save changes/ }));
    await waitFor(() => expect(api.update).toHaveBeenCalledTimes(1));
    const payload = api.update.mock.calls[0][1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("slot_window_reference_weekday");
    expect(payload).not.toHaveProperty("slot_window_reference_time");
    expect(payload.waitlist_queue_depth).toBe(12);
    expect(payload).not.toHaveProperty("max_rush_relief_requests_per_week");
  });

  it("is shown to the Main Administrator and sent on save", async () => {
    renderAs("admin");
    expect(await screen.findByText("Slot window reference weekday")).toBeTruthy();
    expect(screen.getByLabelText("Reference time (24h)")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Reference time (24h)"), { target: { value: "18:30" } });
    fireEvent.click(screen.getByRole("button", { name: /Save changes/ }));
    await waitFor(() => expect(api.update).toHaveBeenCalledTimes(1));
    const payload = api.update.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.slot_window_reference_weekday).toBe(2);
    expect(payload.slot_window_reference_time).toBe("18:30");
  });
});

describe("Equipment Booking Configuration: waitlist and urgent request depth", () => {
  it("shows each limit with its current fill", async () => {
    renderAs("manager");
    expect(await screen.findByText("Waitlist and urgent requests")).toBeTruthy();
    expect(screen.getByTestId("oic-usage-waitlist_queue_depth").textContent).toBe("3 of 10 in queue");
    expect(screen.getByTestId("oic-usage-max_urgent_requests").textContent).toBe("1 open (no limit)");
    expect(screen.getByTestId("oic-usage-max_rush_relief_requests_per_week").textContent).toBe("2 of 2 this week");
    expect(screen.getByTestId("oic-usage-max_surcharge_urgent_requests_per_week").textContent).toBe(
      "0 this week (no limit)",
    );
  });

  it("refuses an out-of-range value before saving and sends empty as no limit", async () => {
    renderAs("manager");
    const typeB = await screen.findByLabelText("Type B urgent requests (50% surcharge) per week");
    fireEvent.change(typeB, { target: { value: "101" } });
    fireEvent.click(screen.getByRole("button", { name: /Save changes/ }));
    expect(await screen.findByText("Enter a whole number from 0 to 100, or leave empty.")).toBeTruthy();
    expect(api.update).not.toHaveBeenCalled();

    fireEvent.change(typeB, { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Type A urgent requests (rush relief) per week"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /Save changes/ }));
    await waitFor(() => expect(api.update).toHaveBeenCalledTimes(1));
    const payload = api.update.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.max_rush_relief_requests_per_week).toBeNull();
    expect(payload).not.toHaveProperty("max_surcharge_urgent_requests_per_week");
  });
});

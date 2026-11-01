// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { maintenancePlacement } from "./maintenanceVisibility";

const api = vi.hoisted(() => ({ getPendingActions: vi.fn(), getMaintenanceStatus: vi.fn() }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiClient: api,
}));

import PendingActionsSummary from "@/components/PendingActions/PendingActionsSummary";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("maintenance placement (no duplicate banner)", () => {
  it.each([
    [{ showsLabStyleDashboard: true, isAdmin: false }, { banner: false, inAttention: true }],   // OIC, Lab Operator
    [{ showsLabStyleDashboard: false, isAdmin: true }, { banner: true, inAttention: false }],   // Main Administrator
    [{ showsLabStyleDashboard: false, isAdmin: false }, { banner: false, inAttention: false }], // users
  ])("%j -> %j, never both", (role, expected) => {
    const placed = maintenancePlacement(role);
    expect(placed).toEqual(expected);
    expect(placed.banner && placed.inAttention).toBe(false);
  });
});

const period = (id: number, extra: Record<string, unknown> = {}) => ({
  period_id: id, equipment_id: 100 + id, equipment_code: `EQ${id}`, equipment_name: `Instrument ${id}`,
  since: "2026-11-01T09:00:00+05:30", since_display: "Sun 1 Nov, 09:00", last_checked_on: null,
  bookings_affected: 2, bookings_on_hold: 1, users_notified: 2, results_paused: 0, adopted: false,
  recovery_status: "UNKNOWN", recovery_text: "Recovery time not known", action_required: false, action: "", ...extra,
});

describe("Needs your attention with maintenance", () => {
  const renderIt = () =>
    render(
      <MemoryRouter>
        <PendingActionsSummary includeMaintenance />
      </MemoryRouter>,
    );

  it("stays compact with many instruments under maintenance", async () => {
    api.getPendingActions.mockResolvedValue({ data: { items: [] } });
    api.getMaintenanceStatus.mockResolvedValue({ data: { periods: Array.from({ length: 8 }, (_, i) => period(i + 1)) } });
    renderIt();
    const box = await screen.findByTestId("pending-actions-summary");
    expect(within(box).getByText(/Maintenance updates \(8\)/)).toBeTruthy(); // one summary line
    expect(within(box).queryAllByTestId("maintenance-update")).toHaveLength(0); // details stay folded
    expect(within(box).queryAllByTestId("maintenance-action")).toHaveLength(0);
  });

  it("a Lab Operator sees who has been asked to act, not the OIC action", async () => {
    api.getPendingActions.mockResolvedValue({ data: { items: [] } });
    api.getMaintenanceStatus.mockResolvedValue({
      data: { periods: [period(1, { recovery_status: "DELAYED", waiting_for: "The Officer In Charge has been asked to confirm the equipment's status." })] },
    });
    renderIt();
    expect(await screen.findByText("Needs your attention (0)")).toBeTruthy(); // not counted as the operator's task
    fireEvent.click(screen.getByRole("button", { name: /View details/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Maintenance updates \(1\)/ }));
    const row = await screen.findByTestId("maintenance-update");
    expect(row.textContent).toContain("Officer In Charge has been asked");
    expect(row.textContent).not.toContain("mark it Operational");
  });
});

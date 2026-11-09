// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const api = vi.hoisted(() => ({ getMaintenanceStatus: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiClient: api }));

import OperationsAlerts, { operationsAlertChips } from "./OperationsAlerts";

const period = {
  period_id: 1,
  equipment_id: 7,
  equipment_name: "FE-SEM",
  equipment_code: "SEM1",
  since_display: "3 Nov 2026",
  bookings_affected: 3,
  users_notified: 2,
  results_paused: 1,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("operationsAlertChips", () => {
  it("summarises each kind of alert and leaves out empty kinds", () => {
    expect(operationsAlertChips([period as never], 16)).toEqual(["1 under maintenance · 3 bookings affected", "16 disruptions without a reason"]);
    expect(operationsAlertChips([], 1)).toEqual(["1 disruption without a reason"]);
    expect(operationsAlertChips([], 0)).toEqual([]);
  });
});

describe("OperationsAlerts", () => {
  it("shows maintenance and disruptions in one panel, collapsed until opened", async () => {
    api.getMaintenanceStatus.mockResolvedValue({ data: { periods: [period] } });
    const review = vi.fn();
    render(
      <MemoryRouter>
        <OperationsAlerts showMaintenance disruptionsMissingReason={16} onReviewDisruptions={review} />
      </MemoryRouter>,
    );
    const toggle = await screen.findByTestId("operations-alerts-toggle");
    expect(await screen.findByText("1 under maintenance · 3 bookings affected")).toBeTruthy();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByTestId("operations-alerts-maintenance")).toBeNull();

    const user = userEvent.setup();
    await user.click(toggle);
    expect(screen.getByTestId("operations-alerts-maintenance").textContent).toContain("FE-SEM");
    await user.click(screen.getByRole("button", { name: /Review disruptions/ }));
    expect(review).toHaveBeenCalledOnce();
  });

  it("renders nothing when nothing needs attention, and does not load maintenance when not asked", () => {
    const { container } = render(<OperationsAlerts showMaintenance={false} disruptionsMissingReason={0} />);
    expect(container.innerHTML).toBe("");
    expect(api.getMaintenanceStatus).not.toHaveBeenCalled();
  });
});

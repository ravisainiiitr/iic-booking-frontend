// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const api = vi.hoisted(() => ({ getPendingActions: vi.fn(), getMaintenanceStatus: vi.fn() }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiClient: api,
}));

import PendingActionsSummary from "@/components/PendingActions/PendingActionsSummary";

const awaiting = {
  key: "bookings_awaiting_completion",
  label: "Bookings awaiting completion",
  count: 1,
  link: "/dashboard#bookings-awaiting-completion",
  description: "Complete each booking.",
};
const approvals = { key: "registration_approvals", label: "Registration approvals", count: 2, link: "/x", description: "" };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PendingActionsSummary", () => {
  it("leaves out items that have their own card on the page", async () => {
    api.getPendingActions.mockResolvedValue({ data: { items: [awaiting, approvals] } });
    render(
      <MemoryRouter>
        <PendingActionsSummary excludeKeys={["bookings_awaiting_completion"]} />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Needs your attention (2)")).toBeTruthy();
    expect(screen.queryByText(/Bookings awaiting completion/)).toBeNull();
  });

  it("renders nothing when the only item is excluded", async () => {
    api.getPendingActions.mockResolvedValue({ data: { items: [awaiting] } });
    const { container } = render(
      <MemoryRouter>
        <PendingActionsSummary excludeKeys={["bookings_awaiting_completion"]} />
      </MemoryRouter>,
    );
    await vi.waitFor(() => expect(api.getPendingActions).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(container.textContent).toBe("");
  });

  it("keeps every item when nothing is excluded", async () => {
    api.getPendingActions.mockResolvedValue({ data: { items: [awaiting, approvals] } });
    render(
      <MemoryRouter>
        <PendingActionsSummary />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Needs your attention (3)")).toBeTruthy();
  });

  const period = (id: number, action: boolean) => ({
    period_id: id, equipment_id: 100 + id, equipment_code: `EQ${id}`, equipment_name: `Instrument ${id}`,
    since: "2026-11-01T09:00:00+05:30", since_display: "Sun 1 Nov, 09:00", last_checked_on: null,
    bookings_affected: 3, bookings_on_hold: 1, users_notified: 2, results_paused: 1, adopted: false,
    recovery_status: action ? "DELAYED" : "UNKNOWN", recovery_text: action ? "Recovery delayed" : "Recovery time not known",
    action_required: action, action: action ? "The expected recovery time has passed: confirm the equipment's status." : "",
  });

  const renderOic = () =>
    render(
      <MemoryRouter>
        <PendingActionsSummary includeMaintenance />
      </MemoryRouter>,
    );

  it("folds maintenance in: actions count and stay in view, updates sit under a collapsed subsection", async () => {
    api.getPendingActions.mockResolvedValue({ data: { items: [approvals] } });
    api.getMaintenanceStatus.mockResolvedValue({ data: { periods: [period(1, true), period(2, false)] } });
    renderOic();
    expect(await screen.findByText("Needs your attention (3)")).toBeTruthy(); // 2 approvals + 1 maintenance action
    const actions = await screen.findAllByTestId("maintenance-action");
    expect(actions).toHaveLength(1);
    expect(actions[0].textContent).toContain("3 bookings affected · 2 users notified · results-overdue paused for 1 booking");
    expect(actions[0].textContent).toContain("confirm the equipment's status");
    expect(screen.queryByTestId("maintenance-update")).toBeNull(); // informational: not until details are opened

    fireEvent.click(screen.getByRole("button", { name: /View details/ }));
    const updatesToggle = screen.getByRole("button", { name: /Maintenance updates \(1\)/ });
    expect(updatesToggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(updatesToggle);
    expect(screen.getAllByTestId("maintenance-update")).toHaveLength(1);
    expect(screen.getAllByTestId("maintenance-action")).toHaveLength(1); // never listed twice
  });

  it("informational maintenance alone is not counted as a pending task", async () => {
    api.getPendingActions.mockResolvedValue({ data: { items: [] } });
    api.getMaintenanceStatus.mockResolvedValue({ data: { periods: [period(2, false)] } });
    renderOic();
    expect(await screen.findByText("Needs your attention (0)")).toBeTruthy();
    expect(screen.getByText(/Maintenance updates \(1\)/)).toBeTruthy();
    expect(screen.queryByTestId("maintenance-action")).toBeNull();
  });

  it("does not ask for maintenance on dashboards that do not show it", async () => {
    api.getPendingActions.mockResolvedValue({ data: { items: [approvals] } });
    render(
      <MemoryRouter>
        <PendingActionsSummary />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Needs your attention (2)")).toBeTruthy();
    expect(api.getMaintenanceStatus).not.toHaveBeenCalled();
  });
});

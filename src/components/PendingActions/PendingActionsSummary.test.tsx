// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const api = vi.hoisted(() => ({ getPendingActions: vi.fn() }));
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
});

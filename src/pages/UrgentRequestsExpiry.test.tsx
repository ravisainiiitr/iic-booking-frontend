// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import UrgentRequests from "./UrgentRequests";

const auth = vi.hoisted(() => ({
  state: {
    user: { id: 3, email: "oic@iitr.ac.in", name: "OIC", user_type: "manager" } as Record<string, unknown>,
    isAuthenticated: true,
    loading: false,
  },
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth.state }));
vi.mock("@/components/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/components/DepartmentFilter", () => ({ default: () => null }));
vi.mock("@/lib/api", () => {
  const handlers: Record<string, unknown> = {
    getUrgentHoldExpiryConfig: async () => ({ data: { urgent_booking_validity_days: 3 } }),
    listUrgentBookingRequests: async () => ({ data: { urgent_requests: [], count: 0, total_count: 0 } }),
  };
  return {
    apiClient: new Proxy(handlers, { get: (target, key: string) => target[key] ?? (async () => ({ data: null })) }),
  };
});

const renderAs = (userType: string) => {
  auth.state = { ...auth.state, user: { ...auth.state.user, user_type: userType } };
  return render(
    <MemoryRouter>
      <UrgentRequests />
    </MemoryRouter>,
  );
};

afterEach(() => cleanup());

describe("Urgent request expiry", () => {
  it.each(["manager", "operator", "dept_admin"])("is read-only for %s", async (userType) => {
    renderAs(userType);
    expect(await screen.findByText("3 day(s)")).toBeTruthy();
    expect(screen.getByText("(set by the Main Administrator for all departments)")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Change" })).toBeNull();
    expect(screen.queryByLabelText("Urgent request validity in days")).toBeNull();
  });

  it("can be changed by the Main Administrator", async () => {
    renderAs("admin");
    expect(await screen.findByText("3 day(s)")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Change" })).toBeTruthy();
    expect(screen.queryByText("(set by the Main Administrator for all departments)")).toBeNull();
  });
});

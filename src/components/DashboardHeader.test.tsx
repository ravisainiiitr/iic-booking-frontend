// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DashboardHeader from "./DashboardHeader";

const shell = vi.hoisted(() => ({ staff: false }));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 7, name: "Demo User", email: "demo@example.test", user_type: "manager" },
    isAuthenticated: true,
    refreshUser: async () => undefined,
    logout: async () => undefined,
  }),
}));
vi.mock("@/lib/api", () => ({
  apiClient: {
    isAdminPanelUser: () => false,
    getWalletBalance: async () => ({}),
    getWallet: async () => ({}),
    getWalletJoinRequests: async () => ({}),
    getProfilePictureUrl: () => "",
  },
}));
vi.mock("@/components/UserGuide/UserGuideProvider", () => ({
  useUserGuide: () => ({ openGuide: () => undefined, openWhatsNew: () => undefined, hasGuide: false }),
}));
vi.mock("@/components/my-research/useMyResearchAvailability", () => ({ useMyResearchAvailability: () => ({ available: false }) }));
vi.mock("@/components/NotificationBell", () => ({ default: () => null }));
vi.mock("@/components/ServerClock", () => ({ ServerClock: () => null }));
vi.mock("@/components/IITRBanner", () => ({ default: () => null }));
vi.mock("@/lib/staffApp", () => ({ useStaffAppShell: () => shell.staff, isStaffAppNavPath: () => false }));

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <DashboardHeader />
    </MemoryRouter>,
  );

afterEach(() => {
  cleanup();
  shell.staff = false;
});

describe("DashboardHeader search button", () => {
  it("is left out on the dashboard, which has its own search bar", () => {
    renderAt("/dashboard");
    expect(screen.queryByRole("button", { name: "Search" })).toBeNull();
  });

  it("stays on other pages", () => {
    renderAt("/equipments");
    expect(screen.getByRole("button", { name: "Search" })).toBeTruthy();
  });

  it("is left out of the staff app header on the dashboard too", () => {
    shell.staff = true;
    renderAt("/dashboard");
    expect(screen.queryByRole("button", { name: "Search" })).toBeNull();
    cleanup();
    renderAt("/booking-management");
    expect(screen.getByRole("button", { name: "Search" })).toBeTruthy();
  });
});

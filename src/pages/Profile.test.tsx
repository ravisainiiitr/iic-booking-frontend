// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const auth = vi.hoisted(() => ({
  current: {
    user: null as Record<string, unknown> | null,
    loading: true,
    isAuthenticated: false,
  },
}));

const getProfileMe = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    ...auth.current,
    refreshUser: vi.fn(),
    updateUser: vi.fn(),
  }),
}));

vi.mock("@/lib/api", () => ({
  apiClient: {
    getProfileMe,
    getDepartments: vi.fn().mockResolvedValue({ data: { departments: [] } }),
    getProjects: vi.fn().mockResolvedValue({ data: [] }),
    getProfilePictureUrl: vi.fn(() => ""),
  },
}));

vi.mock("@/components/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/components/profile/LoginPasswordCard", () => ({ default: () => null }));
vi.mock("@/components/profile/MobileDevicesCard", () => ({ default: () => null }));

import Profile from "./Profile";

const storedUser = { id: 5, email: "person@example.com", name: "Test Person", user_type: "student" };

function page() {
  return (
    <MemoryRouter initialEntries={["/profile"]}>
      <Routes>
        <Route path="/profile" element={<Profile />} />
        <Route path="/auth" element={<p>Sign-in page</p>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  getProfileMe.mockReset();
  getProfileMe.mockResolvedValue({ data: { ...storedUser } });
});

afterEach(cleanup);

describe("Profile after a reload", () => {
  it("waits for the auth check, then loads the profile exactly once", async () => {
    // Stored user restored, but the token check is still running (what a reload looks like).
    auth.current = { user: storedUser, loading: true, isAuthenticated: true };
    const { rerender } = render(page());
    expect(getProfileMe).not.toHaveBeenCalled();
    expect(screen.queryByText("Sign-in page")).toBeNull();

    auth.current = { user: { ...storedUser }, loading: false, isAuthenticated: true };
    rerender(page());

    expect(await screen.findByText("My Profile")).toBeTruthy();
    expect(getProfileMe).toHaveBeenCalledTimes(1);

    auth.current = { user: { ...storedUser, name: "Renamed" }, loading: false, isAuthenticated: true };
    rerender(page());
    await waitFor(() => expect(screen.getByText("My Profile")).toBeTruthy());
    expect(getProfileMe).toHaveBeenCalledTimes(1);
  });

  it("goes to sign-in once the auth check finds no session", async () => {
    auth.current = { user: null, loading: true, isAuthenticated: false };
    const { rerender } = render(page());
    expect(screen.queryByText("Sign-in page")).toBeNull();

    auth.current = { user: null, loading: false, isAuthenticated: false };
    rerender(page());

    expect(await screen.findByText("Sign-in page")).toBeTruthy();
    expect(getProfileMe).not.toHaveBeenCalled();
  });
});

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";

const apiClient = vi.hoisted(() => ({
  onUnauthorized: null as (() => void) | null,
  getToken: vi.fn(() => null),
  setToken: vi.fn(),
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ apiClient }));
vi.mock("@/lib/nativeApp", () => ({ isNativeApp: () => false, appEntryPath: () => "/app/sign-in" }));

import { AuthProvider } from "./AuthContext";
import { consumePostLoginRedirect } from "@/lib/authRedirect";
import { registerOpenWorkspace } from "@/lib/workspaceResume";

const replace = vi.fn();

function sessionEndsOn(url: string) {
  const { pathname, search, hash } = new URL(url, "https://equip.iitr.ac.in");
  vi.stubGlobal("location", { pathname, search, hash, replace });
  render(
    <AuthProvider>
      <div />
    </AuthProvider>,
  );
  act(() => apiClient.onUnauthorized?.());
}

beforeEach(() => {
  sessionStorage.clear();
  replace.mockReset();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("session invalidated (401)", () => {
  it("returns to the page open in the dashboard panel after signing in", () => {
    const unregister = registerOpenWorkspace({ path: "/my-bookings", title: "My bookings" });
    sessionEndsOn("/dashboard");
    unregister();

    expect(replace).toHaveBeenCalledWith("/auth");
    expect(consumePostLoginRedirect()).toBe("/my-bookings");
  });

  it("returns to a standalone page with its query", () => {
    sessionEndsOn("/wallet?tab=history");
    expect(replace).toHaveBeenCalledWith("/auth");
    expect(consumePostLoginRedirect()).toBe("/wallet?tab=history");
  });

  it("keeps the dashboard default from the home and sign-in pages", () => {
    sessionEndsOn("/");
    expect(consumePostLoginRedirect()).toBe("/dashboard");
    cleanup();
    replace.mockReset();

    sessionEndsOn("/auth?reason=inactivity");
    expect(replace).not.toHaveBeenCalled();
    expect(consumePostLoginRedirect()).toBe("/dashboard");
  });
});

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";

const { apiClient, native } = vi.hoisted(() => ({
  apiClient: {
    onUnauthorized: null as (() => void) | null,
    getToken: vi.fn(() => null),
    setToken: vi.fn(),
    getCurrentUser: vi.fn(),
    signOut: vi.fn(),
  },
  native: { value: false },
}));

vi.mock("@/lib/api", () => ({ apiClient }));
vi.mock("@/lib/nativeApp", () => ({ isNativeApp: () => native.value, appEntryPath: () => "/app/sign-in" }));

import { AuthProvider, useAuth } from "./AuthContext";
import { recordSignInMethod } from "@/lib/channelISignOut";

const assign = vi.fn();
const windowOpen = vi.fn();
const SERVER_URL = "https://channeli.in/auth/logout";
let logout: () => Promise<{ channelISession: boolean }>;
let result: { channelISession: boolean };

function Capture() {
  logout = useAuth().logout;
  return null;
}

async function logOut() {
  render(
    <AuthProvider>
      <Capture />
    </AuthProvider>,
  );
  await act(async () => {
    result = await logout();
  });
}

beforeEach(() => {
  localStorage.clear();
  assign.mockReset();
  windowOpen.mockReset();
  native.value = false;
  apiClient.signOut.mockReset();
  apiClient.setToken.mockReset();
  vi.stubGlobal("location", { pathname: "/dashboard", search: "", hash: "", replace: vi.fn(), assign });
  vi.stubGlobal("open", windowOpen);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("logging out of the portal", () => {
  it("is silent after a Channel i sign-in: no Channel i window or tab", async () => {
    recordSignInMethod("channel_i");
    apiClient.signOut.mockResolvedValue({ data: { message: "ok", omniport_logout_url: SERVER_URL } });
    await logOut();
    expect(windowOpen).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
    expect(apiClient.setToken).toHaveBeenCalledWith(null);
    expect(result.channelISession).toBe(true); // so the caller shows the main page
  });

  it("stays silent when the portal cannot be reached", async () => {
    recordSignInMethod("channel_i");
    apiClient.signOut.mockResolvedValue({ error: "Network error" });
    await logOut();
    expect(windowOpen).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
    expect(apiClient.setToken).toHaveBeenCalledWith(null);
  });

  it("reports a password sign-in, so the caller shows the sign-in page", async () => {
    recordSignInMethod("password");
    apiClient.signOut.mockResolvedValue({ data: { message: "ok", omniport_logout_url: SERVER_URL } });
    await logOut();
    expect(windowOpen).not.toHaveBeenCalled();
    expect(result.channelISession).toBe(false);
  });

  it("treats the mobile app as not Channel i", async () => {
    native.value = true;
    recordSignInMethod("channel_i");
    apiClient.signOut.mockResolvedValue({ data: { message: "ok" } });
    await logOut();
    expect(windowOpen).not.toHaveBeenCalled();
    expect(result.channelISession).toBe(false);
  });

  it("does not reuse the sign-in method for the next session", async () => {
    recordSignInMethod("channel_i");
    apiClient.signOut.mockResolvedValue({ data: { message: "ok" } });
    await logOut();
    expect(localStorage.getItem("portal_sign_in_method")).toBeNull();
  });
});

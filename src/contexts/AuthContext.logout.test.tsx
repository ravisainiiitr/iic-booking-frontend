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
import { CHANNEL_I_LOGOUT_URL, recordSignInMethod } from "@/lib/channelISignOut";

const assign = vi.fn();
const SERVER_URL = "https://channeli.in/auth/logout";
let logout: () => Promise<void>;

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
    await logout();
  });
}

beforeEach(() => {
  localStorage.clear();
  assign.mockReset();
  native.value = false;
  apiClient.signOut.mockReset();
  vi.stubGlobal("location", { pathname: "/dashboard", search: "", hash: "", replace: vi.fn(), assign });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("logging out of the portal", () => {
  it("also ends the Channel i session after a Channel i sign-in", async () => {
    recordSignInMethod("channel_i");
    apiClient.signOut.mockResolvedValue({ data: { message: "ok", omniport_logout_url: SERVER_URL } });
    await logOut();
    expect(assign).toHaveBeenCalledWith(SERVER_URL);
  });

  it("still ends the Channel i session when the portal cannot be reached", async () => {
    recordSignInMethod("channel_i");
    apiClient.signOut.mockResolvedValue({ error: "Network error" });
    await logOut();
    expect(assign).toHaveBeenCalledWith(CHANNEL_I_LOGOUT_URL);
  });

  it("covers a Channel i session that began before the sign-in method was recorded", async () => {
    apiClient.signOut.mockResolvedValue({ data: { message: "ok", omniport_logout_url: SERVER_URL } });
    await logOut();
    expect(assign).toHaveBeenCalledWith(SERVER_URL);
  });

  it("stays on the portal after a password sign-in, even for a Channel i account", async () => {
    recordSignInMethod("password");
    apiClient.signOut.mockResolvedValue({ data: { message: "ok", omniport_logout_url: SERVER_URL } });
    await logOut();
    expect(assign).not.toHaveBeenCalled();
  });

  it("stays on the portal for an account with no Channel i sign-in", async () => {
    apiClient.signOut.mockResolvedValue({ data: { message: "ok" } });
    await logOut();
    expect(assign).not.toHaveBeenCalled();
  });

  it("never leaves the mobile app", async () => {
    native.value = true;
    recordSignInMethod("channel_i");
    apiClient.signOut.mockResolvedValue({ data: { message: "ok", omniport_logout_url: SERVER_URL } });
    await logOut();
    expect(assign).not.toHaveBeenCalled();
  });

  it("does not reuse the sign-in method for the next session", async () => {
    recordSignInMethod("channel_i");
    apiClient.signOut.mockResolvedValue({ data: { message: "ok" } });
    await logOut();
    expect(localStorage.getItem("portal_sign_in_method")).toBeNull();
  });
});

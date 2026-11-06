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
import { CHANNEL_I_LOGOUT_URL, CHANNEL_I_LOGOUT_WINDOW_MS, recordSignInMethod } from "@/lib/channelISignOut";

const assign = vi.fn();
const windowOpen = vi.fn();
const popup = { close: vi.fn() };
const SERVER_URL = "https://channeli.in/auth/logout";
let logout: () => Promise<{ channelISignedOut: boolean }>;
let result: { channelISignedOut: boolean };

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
  popup.close.mockReset();
  windowOpen.mockReset();
  windowOpen.mockReturnValue(popup);
  native.value = false;
  apiClient.signOut.mockReset();
  vi.stubGlobal("location", { pathname: "/dashboard", search: "", hash: "", replace: vi.fn(), assign });
  vi.stubGlobal("open", windowOpen);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("logging out of the portal", () => {
  it("also ends the Channel i session after a Channel i sign-in", async () => {
    recordSignInMethod("channel_i");
    apiClient.signOut.mockResolvedValue({ data: { message: "ok", omniport_logout_url: SERVER_URL } });
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    await logOut();
    expect(windowOpen).toHaveBeenCalledTimes(1);
    expect(windowOpen.mock.calls[0][0]).toBe(CHANNEL_I_LOGOUT_URL);
    expect(assign).not.toHaveBeenCalled(); // this tab stays on the portal
    expect(result.channelISignedOut).toBe(true); // so the caller shows the main page
    expect(popup.close).not.toHaveBeenCalled(); // not before Channel i has had time to end the session
    vi.advanceTimersByTime(CHANNEL_I_LOGOUT_WINDOW_MS);
    expect(popup.close).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("opens the window before waiting on anything, while the click still allows it", async () => {
    recordSignInMethod("channel_i");
    let finish: (v: unknown) => void = () => undefined;
    apiClient.signOut.mockReturnValue(new Promise((r) => (finish = r)));
    render(<AuthProvider><Capture /></AuthProvider>);
    const pending = logout();
    expect(windowOpen).toHaveBeenCalledTimes(1);
    finish({ data: { message: "ok", omniport_logout_url: SERVER_URL } });
    await act(async () => {
      await pending;
    });
  });

  it("leaves for Channel i in this tab when the browser blocks the window", async () => {
    windowOpen.mockReturnValue(null);
    recordSignInMethod("channel_i");
    apiClient.signOut.mockResolvedValue({ data: { message: "ok", omniport_logout_url: SERVER_URL } });
    await logOut();
    expect(assign).toHaveBeenCalledWith(SERVER_URL);
  });

  it("still ends the Channel i session when the portal cannot be reached", async () => {
    recordSignInMethod("channel_i");
    apiClient.signOut.mockResolvedValue({ error: "Network error" });
    await logOut();
    expect(windowOpen.mock.calls[0][0]).toBe(CHANNEL_I_LOGOUT_URL);
    expect(result.channelISignedOut).toBe(true);
  });

  it("covers a Channel i session that began before the sign-in method was recorded", async () => {
    apiClient.signOut.mockResolvedValue({ data: { message: "ok", omniport_logout_url: SERVER_URL } });
    await logOut();
    expect(windowOpen.mock.calls[0][0]).toBe(SERVER_URL);
  });

  it("stays on the portal after a password sign-in, even for a Channel i account", async () => {
    recordSignInMethod("password");
    apiClient.signOut.mockResolvedValue({ data: { message: "ok", omniport_logout_url: SERVER_URL } });
    await logOut();
    expect(assign).not.toHaveBeenCalled();
    expect(windowOpen).not.toHaveBeenCalled();
    expect(result.channelISignedOut).toBe(false);
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
    expect(windowOpen).not.toHaveBeenCalled();
  });

  it("does not reuse the sign-in method for the next session", async () => {
    recordSignInMethod("channel_i");
    apiClient.signOut.mockResolvedValue({ data: { message: "ok" } });
    await logOut();
    expect(localStorage.getItem("portal_sign_in_method")).toBeNull();
  });
});

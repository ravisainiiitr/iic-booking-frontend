// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nativePromise = vi.fn();

function installBridge() {
  (window as unknown as { Capacitor?: unknown }).Capacitor = {
    isNativePlatform: () => true,
    getPlatform: () => "android",
    nativePromise,
  };
}

async function loadModule() {
  vi.resetModules();
  return import("./nativeApp");
}

function tokenStore(initial: string | null) {
  let token = initial;
  return {
    getToken: () => token,
    setToken: vi.fn((next: string | null) => {
      token = next;
    }),
  };
}

beforeEach(() => {
  nativePromise.mockReset();
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/");
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
});

function nativeCalls(method: string) {
  return nativePromise.mock.calls.filter((call) => call[1] === method);
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
});

describe("in a normal browser", () => {
  it("does nothing", async () => {
    const mod = await loadModule();
    expect(mod.isNativeApp()).toBe(false);
    await expect(mod.getNativeSession()).resolves.toEqual({ status: "none" });
    await expect(mod.enrollNativeDevice("webtoken")).resolves.toBeNull();
    await expect(mod.recoverNativeSession("iicm_old", tokenStore("iicm_old"))).resolves.toBeNull();
    expect(nativePromise).not.toHaveBeenCalled();
  });

  it("keeps the home page for signed-in users", async () => {
    const mod = await loadModule();
    await mod.bootstrapNativeApp(tokenStore("webtoken"));
    expect(window.location.pathname).toBe("/");
  });

  it("ignores a Capacitor object that is not the native app", async () => {
    (window as unknown as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => false, nativePromise };
    const mod = await loadModule();
    expect(mod.isNativeApp()).toBe(false);
  });
});

describe("inside the app", () => {
  beforeEach(installBridge);

  it("recognises device session tokens", async () => {
    const mod = await loadModule();
    expect(mod.isMobileSessionToken("iicm_abc")).toBe(true);
    expect(mod.isMobileSessionToken("0123456789abcdef")).toBe(false);
    expect(mod.isMobileSessionToken(null)).toBe(false);
  });

  it("renews a rejected device token once via a forced native refresh", async () => {
    nativePromise.mockResolvedValue({ status: "ok", accessToken: "iicm_new", accessExpiresAt: Date.now() + 1e6 });
    const mod = await loadModule();
    const tokens = tokenStore("iicm_old");
    await expect(mod.recoverNativeSession("iicm_old", tokens)).resolves.toBe("iicm_new");
    expect(nativePromise).toHaveBeenCalledWith("IicSession", "getSession", { forceRefresh: true });
    expect(tokens.setToken).toHaveBeenCalledWith("iicm_new");
  });

  it("reuses a token another request already renewed", async () => {
    const mod = await loadModule();
    await expect(mod.recoverNativeSession("iicm_old", tokenStore("iicm_newer"))).resolves.toBe("iicm_newer");
    expect(nativePromise).not.toHaveBeenCalled();
  });

  it("gives up when the device session was revoked", async () => {
    nativePromise.mockResolvedValue({ status: "signed_out", code: "SESSION_REVOKED" });
    const mod = await loadModule();
    await expect(mod.recoverNativeSession("iicm_old", tokenStore("iicm_old"))).resolves.toBeNull();
  });

  it("never sends web tokens through recovery and never enrolls a device token", async () => {
    const mod = await loadModule();
    await expect(mod.recoverNativeSession("webtoken", tokenStore("webtoken"))).resolves.toBeNull();
    await expect(mod.enrollNativeDevice("iicm_abc")).resolves.toBeNull();
    expect(nativePromise).not.toHaveBeenCalled();
  });

  it("shares one native refresh between concurrent callers", async () => {
    let resolve: (v: unknown) => void = () => undefined;
    nativePromise.mockReturnValue(new Promise((r) => (resolve = r)));
    const mod = await loadModule();
    const a = mod.getNativeSession(true);
    const b = mod.getNativeSession(true);
    resolve({ status: "ok", accessToken: "iicm_x" });
    await expect(a).resolves.toEqual(await b);
    expect(nativePromise).toHaveBeenCalledTimes(1);
  });

  it("enrolls after sign-in and returns the device token", async () => {
    nativePromise.mockResolvedValue({ status: "ok", accessToken: "iicm_dev", requireBiometric: false });
    const mod = await loadModule();
    await expect(mod.enrollNativeDevice("webtoken")).resolves.toBe("iicm_dev");
    expect(nativePromise).toHaveBeenCalledWith("IicSession", "enroll", { authToken: "webtoken" });
  });

  it("enrolls each web token only once", async () => {
    nativePromise.mockResolvedValue({ status: "ok", accessToken: "iicm_dev" });
    const mod = await loadModule();
    const [first, second] = await Promise.all([mod.enrollNativeDevice("webtoken"), mod.enrollNativeDevice("webtoken")]);
    expect(first).toBe("iicm_dev");
    expect(second).toBeNull();
    await expect(mod.enrollNativeDevice("webtoken")).resolves.toBeNull();
    expect(nativeCalls("enroll")).toHaveLength(1);
  });

  it("may retry an enrolment that failed offline", async () => {
    nativePromise
      .mockResolvedValueOnce({ status: "offline" })
      .mockResolvedValueOnce({ status: "ok", accessToken: "iicm_dev" });
    const mod = await loadModule();
    await expect(mod.enrollNativeDevice("webtoken")).resolves.toBeNull();
    await expect(mod.enrollNativeDevice("webtoken")).resolves.toBe("iicm_dev");
    expect(nativeCalls("enroll")).toHaveLength(2);
  });

  it("uses the stored device session when the app says this sign-in is already enrolled", async () => {
    nativePromise.mockImplementation((_plugin: string, method: string) =>
      Promise.resolve(
        method === "enroll" ? { status: "already_enrolled" } : { status: "ok", accessToken: "iicm_saved" },
      ),
    );
    const mod = await loadModule();
    await expect(mod.enrollNativeDevice("webtoken")).resolves.toBe("iicm_saved");
  });

  it("opens the staff home instead of the public home page when launched signed in", async () => {
    nativePromise.mockResolvedValue({ status: "ok", accessToken: "iicm_saved", accessExpiresAt: Date.now() + 1e6 });
    const mod = await loadModule();
    await mod.bootstrapNativeApp(tokenStore(null));
    expect(window.location.pathname).toBe("/app");
  });

  it("opens the app sign-in screen, never the public home page, when signed out", async () => {
    nativePromise.mockResolvedValue({ status: "none" });
    const mod = await loadModule();
    await mod.bootstrapNativeApp(tokenStore(null));
    expect(window.location.pathname).toBe("/app/sign-in");
  });

  it("sends the website sign-in page to the app sign-in screen", async () => {
    window.history.replaceState(null, "", "/auth");
    nativePromise.mockResolvedValue({ status: "none" });
    const mod = await loadModule();
    await mod.bootstrapNativeApp(tokenStore(null));
    expect(window.location.pathname).toBe("/app/sign-in");
  });

  it("shows the not-available screen when the device session was ended for the app audience", async () => {
    nativePromise.mockResolvedValue({ status: "signed_out", code: "APP_AUDIENCE" });
    const mod = await loadModule();
    const tokens = tokenStore("iicm_old");
    await mod.bootstrapNativeApp(tokens);
    expect(tokens.setToken).toHaveBeenCalledWith(null);
    expect(window.location.pathname).toBe("/app/not-available");
  });

  it("remembers an audience refusal from enrolment and does not retry it", async () => {
    nativePromise.mockResolvedValue({ status: "error", code: "APP_AUDIENCE", httpStatus: 403 });
    const mod = await loadModule();
    const seen = vi.fn();
    window.addEventListener(mod.APP_AUDIENCE_EVENT, seen);
    await expect(mod.enrollNativeDevice("webtoken")).resolves.toBeNull();
    await expect(mod.enrollNativeDevice("webtoken")).resolves.toBeNull();
    expect(nativeCalls("enroll")).toHaveLength(1);
    expect(seen).toHaveBeenCalledTimes(1);
    expect(mod.appAudienceRefused()).toBe(true);
    expect(mod.consumeAppAudienceRefusal()).toBeTruthy();
    expect(mod.appAudienceRefused()).toBe(false);
    window.removeEventListener(mod.APP_AUDIENCE_EVENT, seen);
  });

  it("leaves deep links alone", async () => {
    window.history.replaceState(null, "", "/my-bookings");
    nativePromise.mockResolvedValue({ status: "ok", accessToken: "iicm_saved", accessExpiresAt: Date.now() + 1e6 });
    const mod = await loadModule();
    await mod.bootstrapNativeApp(tokenStore(null));
    expect(window.location.pathname).toBe("/my-bookings");
  });

  it("restores the remembered session before first render", async () => {
    nativePromise.mockResolvedValue({ status: "ok", accessToken: "iicm_saved", accessExpiresAt: Date.now() + 1e6 });
    const mod = await loadModule();
    const tokens = tokenStore(null);
    await mod.bootstrapNativeApp(tokens);
    expect(tokens.setToken).toHaveBeenCalledWith("iicm_saved");
    expect(document.documentElement.classList.contains("iic-native-app")).toBe(true);
  });

  it("drops a stale device token when the phone was signed out remotely", async () => {
    nativePromise.mockResolvedValue({ status: "signed_out", code: "SESSION_REVOKED" });
    localStorage.setItem("user", "{}");
    const mod = await loadModule();
    const tokens = tokenStore("iicm_stale");
    await mod.bootstrapNativeApp(tokens);
    expect(tokens.setToken).toHaveBeenCalledWith(null);
    expect(localStorage.getItem("user")).toBeNull();
  });

  it("keeps the current token when the phone is offline", async () => {
    nativePromise.mockResolvedValue({ status: "offline" });
    const mod = await loadModule();
    const tokens = tokenStore("iicm_current");
    await mod.bootstrapNativeApp(tokens);
    expect(tokens.setToken).not.toHaveBeenCalled();
  });
});

describe("api client inside the app", () => {
  beforeEach(installBridge);

  it("retries a request once with a renewed device token after a 401", async () => {
    nativePromise.mockResolvedValue({ status: "ok", accessToken: "iicm_new" });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401, json: () => Promise.resolve({ detail: "Invalid token." }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ id: 7, email: "a@b.c" }) });
    vi.stubGlobal("fetch", fetchMock);
    localStorage.setItem("auth_token", "iicm_old");
    vi.resetModules();
    const { apiClient } = await import("./api");
    const onUnauthorized = vi.fn();
    apiClient.onUnauthorized = onUnauthorized;

    const res = await apiClient.getCurrentUser();

    expect(res.data).toMatchObject({ id: 7 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("Token iicm_new");
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(localStorage.getItem("auth_token")).toBe("iicm_new");
  });

  it("signs out when renewal fails", async () => {
    nativePromise.mockResolvedValue({ status: "signed_out" });
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401, json: () => Promise.resolve({}) });
    vi.stubGlobal("fetch", fetchMock);
    localStorage.setItem("auth_token", "iicm_old");
    vi.resetModules();
    const { apiClient } = await import("./api");
    const onUnauthorized = vi.fn();
    apiClient.onUnauthorized = onUnauthorized;

    await apiClient.getCurrentUser();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).toHaveBeenCalled();
    expect(localStorage.getItem("auth_token")).toBeNull();
  });

  it("swaps a fresh web sign-in for a device token", async () => {
    nativePromise.mockResolvedValue({ status: "ok", accessToken: "iicm_dev" });
    vi.resetModules();
    const { apiClient } = await import("./api");

    apiClient.setToken("webtoken123");
    await vi.waitFor(() => expect(localStorage.getItem("auth_token")).toBe("iicm_dev"));
    expect(nativePromise).toHaveBeenCalledWith("IicSession", "enroll", { authToken: "webtoken123" });
  });

  it("registers the phone once when sign-in stores the token twice, and keeps the phone signed in", async () => {
    nativePromise.mockImplementation((_plugin: string, method: string) =>
      Promise.resolve(method === "enroll" ? { status: "ok", accessToken: "iicm_dev" } : undefined),
    );
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) });
    vi.stubGlobal("fetch", fetchMock);
    vi.resetModules();
    const { apiClient } = await import("./api");

    // signIn() stores the token, then AuthContext.login() stores it again.
    apiClient.setToken("webtoken123");
    apiClient.setToken("webtoken123");
    await vi.waitFor(() => expect(localStorage.getItem("auth_token")).toBe("iicm_dev"));
    await new Promise((r) => setTimeout(r, 0));

    expect(nativeCalls("enroll")).toHaveLength(1);
    expect(nativeCalls("clear")).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.getItem("auth_token")).toBe("iicm_dev");
  });

  it("never revokes when the page is already on a phone session", async () => {
    let finishEnroll: (v: unknown) => void = () => undefined;
    nativePromise.mockImplementation((_plugin: string, method: string) =>
      method === "enroll" ? new Promise((r) => (finishEnroll = r)) : Promise.resolve(undefined),
    );
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) });
    vi.stubGlobal("fetch", fetchMock);
    vi.resetModules();
    const { apiClient } = await import("./api");

    apiClient.setToken("webtoken123");
    apiClient.setToken("iicm_restored");
    finishEnroll({ status: "ok", accessToken: "iicm_dev" });
    await new Promise((r) => setTimeout(r, 0));

    expect(nativeCalls("clear")).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.getItem("auth_token")).toBe("iicm_restored");
  });

  it("ends only the orphaned device session when signed out during enrolment", async () => {
    let finishEnroll: (v: unknown) => void = () => undefined;
    nativePromise.mockImplementation((_plugin: string, method: string) =>
      method === "enroll" ? new Promise((r) => (finishEnroll = r)) : Promise.resolve(undefined),
    );
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) });
    vi.stubGlobal("fetch", fetchMock);
    vi.resetModules();
    const { apiClient } = await import("./api");

    apiClient.setToken("webtoken123");
    apiClient.setToken(null);
    finishEnroll({ status: "ok", accessToken: "iicm_dev" });
    await vi.waitFor(() => expect(nativeCalls("clear")).toHaveLength(1));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/auth\/mobile\/logout\/$/);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Token iicm_dev");
    expect(nativeCalls("clear")[0][2]).toEqual({ revoke: false });
    expect(localStorage.getItem("auth_token")).toBeNull();
  });

  it("logout signs the phone out on the server and clears the app session", async () => {
    nativePromise.mockResolvedValue(undefined);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) });
    vi.stubGlobal("fetch", fetchMock);
    localStorage.setItem("auth_token", "iicm_dev");
    vi.resetModules();
    const { apiClient } = await import("./api");

    await apiClient.signOut();

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/auth\/logout\/$/);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Token iicm_dev");
    expect(nativeCalls("clear")).toEqual([["IicSession", "clear", { revoke: false }]]);
    expect(localStorage.getItem("auth_token")).toBeNull();
  });

  it("logout asks the app to revoke the phone when the server could not be reached", async () => {
    nativePromise.mockResolvedValue(undefined);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    localStorage.setItem("auth_token", "iicm_dev");
    vi.resetModules();
    const { apiClient } = await import("./api");

    await apiClient.signOut();

    expect(nativeCalls("clear")).toEqual([["IicSession", "clear", { revoke: true }]]);
    expect(localStorage.getItem("auth_token")).toBeNull();
  });
});

describe("api client in a browser", () => {
  it("does not try to renew web tokens", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401, json: () => Promise.resolve({}) });
    vi.stubGlobal("fetch", fetchMock);
    localStorage.setItem("auth_token", "webtoken");
    vi.resetModules();
    const { apiClient } = await import("./api");
    apiClient.onUnauthorized = vi.fn();

    await apiClient.getCurrentUser();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(nativePromise).not.toHaveBeenCalled();
    expect(localStorage.getItem("auth_token")).toBeNull();
  });
});

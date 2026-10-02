/**
 * Integration with the IIC Booking Android/iOS app (a Capacitor shell that loads this site).
 *
 * Everything here is a no-op in a normal browser. Inside the app, the native layer keeps a
 * device-bound refresh token in the phone's keystore and hands this page only short-lived
 * access tokens (prefixed "iicm_"), so users stay signed in without re-entering OTPs.
 */

export const MOBILE_SESSION_TOKEN_PREFIX = "iicm_";

type CapacitorBridge = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  nativePromise?: <T>(plugin: string, method: string, options?: Record<string, unknown>) => Promise<T>;
};

export type NativeSessionStatus = "ok" | "none" | "signed_out" | "offline" | "unavailable";

type NativeSessionResult = {
  status: NativeSessionStatus;
  accessToken?: string;
  accessExpiresAt?: number;
  code?: string;
};

type NativeEnrollResult = Omit<NativeSessionResult, "status"> & {
  status: NativeSessionStatus | "error" | "device_lock_required" | "storage_error";
  requireBiometric?: boolean;
  httpStatus?: number;
};

export type NativeAppInfo = {
  platform: string;
  appVersion: string;
  appBuild: number;
  deviceId: string;
  deviceName: string;
  enrolled: boolean;
  appLockEnabled: boolean;
  appLockRequired: boolean;
  deviceSecure: boolean;
  hasBiometric: boolean;
};

type TokenAccess = {
  getToken: () => string | null;
  setToken: (token: string | null) => void;
};

const BOOT_TIMEOUT_MS = 4000;
const BACKGROUND_REFRESH_MS = 15 * 60 * 1000;

function bridge(): CapacitorBridge | null {
  if (typeof window === "undefined") return null;
  const cap = (window as unknown as { Capacitor?: CapacitorBridge }).Capacitor;
  if (!cap || typeof cap.nativePromise !== "function") return null;
  try {
    return cap.isNativePlatform?.() ? cap : null;
  } catch {
    return null;
  }
}

function callNative<T>(plugin: string, method: string, options: Record<string, unknown> = {}): Promise<T> {
  const cap = bridge();
  if (!cap?.nativePromise) return Promise.reject(new Error("Not running in the IIC Booking app"));
  return cap.nativePromise<T>(plugin, method, options);
}

export function isNativeApp(): boolean {
  return bridge() !== null;
}

export function nativePlatform(): string | null {
  return bridge()?.getPlatform?.() ?? null;
}

export function isMobileSessionToken(token: string | null | undefined): boolean {
  return typeof token === "string" && token.startsWith(MOBILE_SESSION_TOKEN_PREFIX);
}

const sessionInFlight: Record<"cached" | "forced", Promise<NativeSessionResult> | null> = {
  cached: null,
  forced: null,
};

/** Current access token from the app (refreshed natively when close to expiry). Single-flight. */
export function getNativeSession(forceRefresh = false): Promise<NativeSessionResult> {
  if (!isNativeApp()) return Promise.resolve({ status: "none" });
  const slot = forceRefresh ? "forced" : "cached";
  const pending = sessionInFlight[slot];
  if (pending) return pending;
  const request = callNative<NativeSessionResult>("IicSession", "getSession", { forceRefresh })
    .catch((): NativeSessionResult => ({ status: "unavailable" }))
    .finally(() => {
      sessionInFlight[slot] = null;
    });
  sessionInFlight[slot] = request;
  return request;
}

/**
 * Called after an "iicm_" token was rejected. Returns a token worth retrying with, or null
 * when the device session is gone and the user must sign in again.
 */
export async function recoverNativeSession(rejectedToken: string, tokens: TokenAccess): Promise<string | null> {
  if (!isNativeApp() || !isMobileSessionToken(rejectedToken)) return null;
  const current = tokens.getToken();
  if (current && current !== rejectedToken) return current;
  const result = await getNativeSession(true);
  if (result.status === "ok" && result.accessToken && result.accessToken !== rejectedToken) {
    tokens.setToken(result.accessToken);
    return result.accessToken;
  }
  return null;
}

/**
 * After a normal sign-in inside the app, register this phone so the user stays signed in.
 * Returns the device access token to use instead of the web token, or null.
 */
export async function enrollNativeDevice(webToken: string): Promise<string | null> {
  if (!isNativeApp() || !webToken || isMobileSessionToken(webToken)) return null;
  try {
    const result = await callNative<NativeEnrollResult>("IicSession", "enroll", { authToken: webToken });
    if (result.status === "ok" && result.accessToken) return result.accessToken;
    if (result.status === "device_lock_required") {
      notifyNative(
        "To stay signed in on this phone, administrator accounts need a fingerprint, face unlock or screen lock. You will need to sign in again next time.",
      );
    }
  } catch {
    /* the web session keeps working; the user just isn't remembered on this device */
  }
  return null;
}

export async function clearNativeSession(revoke = false): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await callNative("IicSession", "clear", { revoke });
  } catch {
    /* ignore */
  }
}

export async function getNativeAppInfo(): Promise<NativeAppInfo | null> {
  if (!isNativeApp()) return null;
  try {
    return await callNative<NativeAppInfo>("IicSession", "getInfo");
  } catch {
    return null;
  }
}

/** Turns fingerprint / face / screen-lock protection of the app on or off. Throws with a user-facing message. */
export async function setNativeAppLock(enabled: boolean): Promise<boolean> {
  const result = await callNative<{ enabled: boolean }>("IicSession", "setAppLock", { enabled });
  return !!result?.enabled;
}

function notifyNative(message: string) {
  window.setTimeout(() => window.alert(message), 0);
}

function applySession(result: NativeSessionResult, tokens: TokenAccess) {
  const current = tokens.getToken();
  if (result.status === "ok" && result.accessToken) {
    if (result.accessToken !== current) tokens.setToken(result.accessToken);
    return;
  }
  if ((result.status === "signed_out" || result.status === "none") && isMobileSessionToken(current)) {
    tokens.setToken(null);
    localStorage.removeItem("user");
  }
}

let installed = false;

/**
 * Restores the device session before the app renders (bounded wait, so a slow network never
 * blocks startup) and installs app-only behaviour. Resolves immediately in a browser.
 */
export async function bootstrapNativeApp(tokens: TokenAccess): Promise<void> {
  if (!isNativeApp() || installed) return;
  installed = true;
  document.documentElement.classList.add("iic-native-app");
  installDownloadHandling();
  installPrint();
  installPullToRefresh();

  const timeout = new Promise<null>((resolve) => window.setTimeout(() => resolve(null), BOOT_TIMEOUT_MS));
  const result = await Promise.race([getNativeSession(false), timeout]);
  if (result) {
    applySession(result, tokens);
    const current = tokens.getToken();
    if (result.status === "none" && current && !isMobileSessionToken(current)) {
      // Signed in before this phone was registered (e.g. enrolment failed offline): try again quietly.
      void enrollNativeDevice(current).then((access) => {
        if (access && tokens.getToken() === current) tokens.setToken(access);
      });
    }
  }

  const refreshIfNeeded = () => {
    if (document.visibilityState !== "visible") return;
    void getNativeSession(false).then((r) => applySession(r, tokens));
  };
  document.addEventListener("visibilitychange", refreshIfNeeded);
  window.setInterval(refreshIfNeeded, BACKGROUND_REFRESH_MS);
}

// ---- Downloads: blob:/data: links cannot be fetched by Android's download manager ----

function guessFileName(href: string, mime: string): string {
  const ext = mime.split("/")[1]?.split(/[;+]/)[0] || "bin";
  return `download-${Date.now()}.${ext === "plain" ? "txt" : ext}`;
}

async function saveUrlToDevice(href: string, fileName: string | null) {
  try {
    const blob = await (await fetch(href)).blob();
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    await callNative("IicFiles", "saveBase64", {
      fileName: fileName || guessFileName(href, blob.type || "application/octet-stream"),
      mimeType: blob.type || "application/octet-stream",
      data: data.substring(data.indexOf(",") + 1),
      open: true,
    });
  } catch (err) {
    console.error("Could not save download in the app", err);
    window.alert("The file could not be saved. Please try again.");
  }
}

function isLocalObjectUrl(href: string | null | undefined): href is string {
  return !!href && (href.startsWith("blob:") || href.startsWith("data:"));
}

function installDownloadHandling() {
  const handleAnchor = (anchor: HTMLAnchorElement): boolean => {
    const href = anchor.getAttribute("href") ? anchor.href : "";
    if (!isLocalObjectUrl(href)) return false;
    void saveUrlToDevice(href, anchor.getAttribute("download"));
    return true;
  };

  const nativeClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function patchedClick(this: HTMLAnchorElement) {
    if (handleAnchor(this)) return;
    nativeClick.call(this);
  };

  document.addEventListener(
    "click",
    (event) => {
      const anchor = (event.target as Element | null)?.closest?.("a");
      if (anchor instanceof HTMLAnchorElement && handleAnchor(anchor)) event.preventDefault();
    },
    true,
  );

  // Pages often revoke the object URL right after click(); keep it alive while we read it.
  if (typeof URL.revokeObjectURL === "function") {
    const nativeRevoke = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (url: string) => {
      window.setTimeout(() => nativeRevoke(url), 60_000);
    };
  }

  const nativeOpen = window.open.bind(window);
  window.open = ((url?: string | URL, target?: string, features?: string) => {
    const href = url == null ? "" : String(url);
    if (isLocalObjectUrl(href)) {
      void saveUrlToDevice(href, null);
      return null;
    }
    return nativeOpen(url, target, features);
  }) as typeof window.open;
}

function installPrint() {
  window.print = () => {
    void callNative("IicFiles", "print", { title: document.title }).catch(() => {
      window.alert("Printing is not available on this phone.");
    });
  };
}

// ---- Pull down at the top of a page to reload ----

function scrollableAncestorScrolled(el: Element | null): boolean {
  for (let node = el; node && node !== document.body; node = node.parentElement) {
    if (node.scrollTop > 0) return true;
  }
  return false;
}

function installPullToRefresh() {
  const THRESHOLD = 110;
  let startY: number | null = null;
  let pulled = 0;
  const indicator = document.createElement("div");
  indicator.setAttribute("aria-hidden", "true");
  indicator.style.cssText =
    "position:fixed;left:50%;top:8px;z-index:2147483647;transform:translate(-50%,-60px);" +
    "transition:transform .15s ease,opacity .15s ease;opacity:0;pointer-events:none;" +
    "background:#1e3a8a;color:#fff;font:600 13px system-ui,sans-serif;padding:6px 14px;border-radius:999px;" +
    "box-shadow:0 2px 8px rgba(0,0,0,.2)";

  const reset = () => {
    startY = null;
    pulled = 0;
    indicator.style.opacity = "0";
    indicator.style.transform = "translate(-50%,-60px)";
  };

  const blocked = (target: EventTarget | null): boolean => {
    const active = document.activeElement;
    if (active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) return true;
    if (document.querySelector('[role="dialog"],[role="alertdialog"]')) return true;
    return scrollableAncestorScrolled(target instanceof Element ? target : null);
  };

  document.addEventListener(
    "touchstart",
    (event) => {
      if (event.touches.length !== 1 || window.scrollY > 0 || blocked(event.target)) {
        startY = null;
        return;
      }
      startY = event.touches[0].clientY;
    },
    { passive: true },
  );

  document.addEventListener(
    "touchmove",
    (event) => {
      if (startY === null) return;
      pulled = event.touches[0].clientY - startY;
      if (pulled <= 0 || window.scrollY > 0) {
        reset();
        return;
      }
      if (!indicator.isConnected) document.body.appendChild(indicator);
      const progress = Math.min(pulled / THRESHOLD, 1);
      indicator.textContent = progress >= 1 ? "Release to refresh" : "Pull to refresh";
      indicator.style.opacity = String(progress);
      indicator.style.transform = `translate(-50%,${Math.round(-60 + 60 * progress)}px)`;
    },
    { passive: true },
  );

  document.addEventListener(
    "touchend",
    () => {
      const shouldReload = startY !== null && pulled >= THRESHOLD;
      reset();
      if (shouldReload) window.location.reload();
    },
    { passive: true },
  );
  document.addEventListener("touchcancel", reset, { passive: true });
}

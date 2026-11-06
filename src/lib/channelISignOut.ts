import { isNativeApp } from "@/lib/nativeApp";

/**
 * Channel i's own Log out page: it ends the Channel i session, then shows the Channel i sign-in page. It ignores any
 * "next" address and cannot be framed, so it runs in a small window of its own while the portal returns to its main page.
 */
export const CHANNEL_I_LOGOUT_URL = "https://channeli.in/auth/logout";

/** Long enough for Channel i's page to load and end the session, on a slow connection too. */
export const CHANNEL_I_LOGOUT_WINDOW_MS = 6000;

const SIGN_IN_METHOD_KEY = "portal_sign_in_method";

export type SignInMethod = "channel_i" | "password";

export function recordSignInMethod(method: SignInMethod): void {
  try {
    localStorage.setItem(SIGN_IN_METHOD_KEY, method);
  } catch {
    /* storage unavailable: logout then relies on the server's answer alone */
  }
}

/** True when this session is known to have signed in through Channel i. */
export function signedInWithChannelI(): boolean {
  try {
    return localStorage.getItem(SIGN_IN_METHOD_KEY) === "channel_i";
  } catch {
    return false;
  }
}

/** Null when the browser blocks the window; the caller then falls back to leaving for Channel i in this tab. */
export function openChannelILogoutWindow(url: string = CHANNEL_I_LOGOUT_URL): Window | null {
  try {
    return window.open(url, "channel_i_logout", "popup,width=520,height=640");
  } catch {
    return null;
  }
}

function takeSignInMethod(): string | null {
  try {
    const method = localStorage.getItem(SIGN_IN_METHOD_KEY);
    localStorage.removeItem(SIGN_IN_METHOD_KEY);
    return method;
  } catch {
    return null;
  }
}

/**
 * Where to send the browser so logging out of the portal also ends the Channel i session, or null when there is none.
 * Sessions older than this record have no method: the server's answer, based on the account type, decides those.
 * Falls back to the known page when the server could not be reached, so a shared computer is not left signed in.
 */
export function channelILogoutTarget(serverUrl?: string | null): string | null {
  const method = takeSignInMethod();
  if (isNativeApp() || method === "password") return null;
  if (serverUrl) return serverUrl;
  return method === "channel_i" ? CHANNEL_I_LOGOUT_URL : null;
}

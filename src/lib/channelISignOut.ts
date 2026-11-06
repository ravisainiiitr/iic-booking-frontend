import { isNativeApp } from "@/lib/nativeApp";

/**
 * Channel i's own Log out page: it ends the Channel i session, then shows the Channel i sign-in page. It ignores any
 * "next" address, so the user cannot be returned to the portal from there.
 */
export const CHANNEL_I_LOGOUT_URL = "https://channeli.in/auth/logout";

const SIGN_IN_METHOD_KEY = "portal_sign_in_method";

export type SignInMethod = "channel_i" | "password";

export function recordSignInMethod(method: SignInMethod): void {
  try {
    localStorage.setItem(SIGN_IN_METHOD_KEY, method);
  } catch {
    /* storage unavailable: logout then relies on the server's answer alone */
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

import { isNativeApp } from "@/lib/nativeApp";

const SIGN_IN_METHOD_KEY = "portal_sign_in_method";

export type SignInMethod = "channel_i" | "password";

export function recordSignInMethod(method: SignInMethod): void {
  try {
    localStorage.setItem(SIGN_IN_METHOD_KEY, method);
  } catch {
    /* storage unavailable: logout then shows the sign-in page */
  }
}

/** Whether this session began with Channel i (outside the mobile app); forgets the record, so it is not reused. */
export function takeChannelISignIn(): boolean {
  let method: string | null = null;
  try {
    method = localStorage.getItem(SIGN_IN_METHOD_KEY);
    localStorage.removeItem(SIGN_IN_METHOD_KEY);
  } catch {
    /* storage unavailable */
  }
  return !isNativeApp() && method === "channel_i";
}

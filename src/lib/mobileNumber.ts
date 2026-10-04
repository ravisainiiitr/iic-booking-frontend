/**
 * Mobile number rule shared by registration, My Profile and the post-login "Complete your profile" prompt.
 * Mirrors iic_booking/users/mobile_number.py: a 10-digit Indian mobile number starting with 6, 7, 8 or 9,
 * optionally written with +91, 91 or a leading 0, spaces, dashes or brackets.
 */

import { isMobileSessionToken } from "@/lib/nativeApp";

export const INDIAN_MOBILE_HINT = "10-digit Indian mobile number starting with 6, 7, 8 or 9.";
export const INDIAN_MOBILE_ERROR = "Enter a valid 10-digit Indian mobile number (e.g. 9876543210). It must start with 6, 7, 8 or 9.";

export function normalizeIndianMobile(value: string | null | undefined): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const digits = raw.replace(/[\s\-().]/g, "").replace(/^(?:\+91|0091|91(?=\d{10}$)|0+)/, "");
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

export function isValidMobileNumber(value: string | null | undefined): boolean {
  return normalizeIndianMobile(value) !== null;
}

export type MobilePromptUser = {
  id?: number | null;
  user_type?: number | string | null;
  is_faculty?: boolean | null;
  phone_number?: string | null;
  /** Server-computed; preferred over the local rule when present. */
  needs_mobile_number?: boolean | null;
};

/** IIT Roorkee faculty accounts, including Officer In Charge accounts (held by faculty), are never prompted. */
const EXEMPT_USER_TYPES = new Set(["faculty", "manager"]);

export function isMobilePromptExempt(user: MobilePromptUser | null | undefined): boolean {
  if (!user) return true;
  if (user.is_faculty === true) return true;
  return EXEMPT_USER_TYPES.has(String(user.user_type ?? "").trim().toLowerCase());
}

export function userNeedsMobileNumber(user: MobilePromptUser | null | undefined): boolean {
  if (!user || isMobilePromptExempt(user)) return false;
  if (typeof user.needs_mobile_number === "boolean") return user.needs_mobile_number;
  return !isValidMobileNumber(user.phone_number);
}

// ---- "Remind me later": hidden until the next sign-in ----
// Website: a new sign-in issues a new session token, so the snooze is tied to the token (shared by all tabs).
// Android app: access tokens rotate during a session, so the snooze lasts for the app session instead.

const SNOOZE_PREFIX = "iic_mobile_prompt_snoozed_";
const APP_SESSION_VALUE = "app";

function tokenFingerprint(token: string): string {
  let h = 5381;
  for (let i = 0; i < token.length; i++) h = ((h << 5) + h + token.charCodeAt(i)) | 0;
  return `${token.length}.${(h >>> 0).toString(36)}`;
}

function snoozeSlot(token: string): { store: Storage; value: string } {
  return isMobileSessionToken(token)
    ? { store: sessionStorage, value: APP_SESSION_VALUE }
    : { store: localStorage, value: tokenFingerprint(token) };
}

export function isMobilePromptSnoozed(userId: number, token: string | null | undefined): boolean {
  if (!token) return false;
  try {
    const { store, value } = snoozeSlot(token);
    return store.getItem(SNOOZE_PREFIX + userId) === value;
  } catch {
    return false;
  }
}

export function snoozeMobilePrompt(userId: number, token: string | null | undefined) {
  if (!token) return;
  try {
    const { store, value } = snoozeSlot(token);
    store.setItem(SNOOZE_PREFIX + userId, value);
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearMobilePromptSnooze(userId: number) {
  try {
    localStorage.removeItem(SNOOZE_PREFIX + userId);
    sessionStorage.removeItem(SNOOZE_PREFIX + userId);
  } catch {
    /* ignore */
  }
}

/** Where the prompt may open: the dashboard, or Today in the staff Android app. */
export function isMobilePromptPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  return path === "/dashboard" || path === "/app";
}

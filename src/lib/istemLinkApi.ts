import { API_BASE_URL, apiClient } from "@/lib/api";

/**
 * Linking the signed-in user's portal account to their existing I-STEM account: look the account up by the email or
 * mobile number registered on I-STEM, then prove it with an OTP sent to the I-STEM email. The server enforces every
 * rule (availability, rate limits, attempts); this client only reflects what it returns.
 */
const base = () => `${API_BASE_URL}/istem/link`;

export type IstemLinkState = "PENDING" | "AWAITING_OTP" | "LINKED" | "NEEDS_REVIEW" | "DISABLED" | null;

export interface IstemProfile {
  email?: string;
  mobile?: string;
  first_name?: string;
  last_name?: string;
  organisation?: string;
  department?: string;
  city?: string;
  state?: string;
  user_type?: string;
}

export interface IstemLinkStatus {
  state: IstemLinkState;
  linking_available: boolean;
  otp_required: boolean;
  email_masked?: string;
  paused_until?: string | null;
  otp?: { expires_at: string; attempts_left: number };
  public_user_id?: string;
  istem_profile?: IstemProfile;
}

export class IstemLinkError extends Error {
  status: number;
  code: string;
  body: Record<string, unknown>;

  constructor(status: number, body: Record<string, unknown>) {
    super((typeof body.error === "string" && body.error) || `Request failed (${status})`);
    this.status = status;
    this.code = typeof body.code === "string" ? body.code : "";
    this.body = body;
  }

  /** Seconds to wait before asking for another OTP (``too_soon``). */
  get retryAfter(): number | null {
    const v = this.body.retry_after;
    return typeof v === "number" ? v : null;
  }
}

async function request<T>(path: string, json?: unknown): Promise<T> {
  const token = apiClient.getToken();
  const headers: Record<string, string> = token ? { Authorization: `Token ${token}` } : {};
  if (json !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${base()}${path}`, {
    method: json === undefined ? "GET" : "POST",
    headers,
    body: json === undefined ? undefined : JSON.stringify(json),
    credentials: "omit",
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new IstemLinkError(res.status, data);
  return data as T;
}

export const istemLinkApi = {
  status: () => request<IstemLinkStatus>("/"),
  findAccount: (lookup: { email?: string; mobile?: string }) =>
    request<{ message: string; email_masked: string }>("/find-account/", lookup),
  sendOtp: () => request<{ message: string; email_masked: string; expires_at: string; attempts_left: number }>("/send-otp/", {}),
  verifyOtp: (otp: string) => request<IstemLinkStatus & { message: string }>("/verify-otp/", { otp }),
};

const TEST_KEY_STORAGE = "istem_test";

/**
 * The I-STEM registration test key from the test link (``/auth?istem_test=<key>``). While the server has one set, only
 * that link offers "Already registered on I-STEM?"; the key is kept for the tab so it survives moving between pages.
 */
export function istemTestKey(): string {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get(TEST_KEY_STORAGE);
    if (fromUrl) {
      sessionStorage.setItem(TEST_KEY_STORAGE, fromUrl);
      return fromUrl;
    }
    return sessionStorage.getItem(TEST_KEY_STORAGE) || "";
  } catch {
    return "";
  }
}

/** Registration with an existing I-STEM account (before the portal account exists; no sign-in token). */
async function publicRequest<T>(path: string, json?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}/istem/register${path}`, {
    method: json === undefined ? "GET" : "POST",
    headers: json === undefined ? {} : { "Content-Type": "application/json" },
    body: json === undefined ? undefined : JSON.stringify(json),
    credentials: "omit",
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new IstemLinkError(res.status, data);
  return data as T;
}

export const istemRegisterApi = {
  availability: () => {
    const key = istemTestKey();
    return publicRequest<{ available: boolean }>(`/availability/${key ? `?istem_test=${encodeURIComponent(key)}` : ""}`);
  },
  lookup: (email: string, mobile: string) =>
    publicRequest<{ message: string; token: string; email_masked: string; expires_in: number }>("/lookup/", {
      email,
      mobile,
      ...(istemTestKey() ? { istem_test: istemTestKey() } : {}),
    }),
  verify: (token: string, otp: string) =>
    publicRequest<{ message: string; profile: IstemProfile & { mobile?: string; state?: string }; link_token: string }>(
      "/verify/",
      { token, otp },
    ),
  /** Creates the approved account from the verified I-STEM profile and signs the user in (no password, no form). */
  complete: (linkToken: string, userType: string) =>
    publicRequest<{ token: string; user: Record<string, unknown>; onboarding: { required: boolean; steps: string[] } }>("/complete/", {
      link_token: linkToken,
      user_type: userType,
      ...(istemTestKey() ? { istem_test: istemTestKey() } : {}),
    }),
};

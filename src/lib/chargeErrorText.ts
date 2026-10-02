/** Plain-language explanation for a failed charge calculation (replaces the old "Coming Soon" card). */

export type ChargeErrorKind = "no_profile" | "needs_user" | "internal_only" | "values" | "network" | "other";

export type FriendlyChargeError = {
  kind: ChargeErrorKind;
  title: string;
  detail: string;
  retryable: boolean;
};

const NETWORK_PATTERNS = ["failed to fetch", "network", "timeout", "timed out", "load failed", "502", "503", "504"];

export function friendlyChargeError(raw: string | null | undefined, opts: { network?: boolean } = {}): FriendlyChargeError {
  const text = String(raw || "").trim();
  const lower = text.toLowerCase();

  if (opts.network || NETWORK_PATTERNS.some((p) => lower.includes(p))) {
    return {
      kind: "network",
      title: "Couldn't reach the server",
      detail: "Charges couldn't be worked out because the connection dropped. Check your connection and try again.",
      retryable: true,
    };
  }
  if (lower.includes("no active charge profile")) {
    return {
      kind: "no_profile",
      title: "Charges aren't set up for your user category yet",
      detail:
        "This equipment has no rates for your user category, so it can't be booked online right now. Please contact the Officer in Charge of this equipment.",
      retryable: false,
    };
  }
  if (lower.includes("select a user") || lower.includes("select a user category")) {
    return { kind: "needs_user", title: "Choose who the booking is for", detail: text, retryable: false };
  }
  if (lower.includes("internal rates are shown only")) {
    return { kind: "internal_only", title: "Sign in to see IIT Roorkee rates", detail: text, retryable: false };
  }
  if (lower.startsWith("error calculating time") || lower.startsWith("error calculating charge")) {
    return {
      kind: "values",
      title: "We couldn't work out the charge from these values",
      detail:
        "Please check the numbers in Step 1 (for example sample count or duration) and change them if needed. If it keeps happening, contact the Officer in Charge.",
      retryable: true,
    };
  }
  if (text) {
    return { kind: "other", title: "Charges couldn't be calculated", detail: text, retryable: true };
  }
  return {
    kind: "other",
    title: "Charges couldn't be calculated",
    detail: "Something went wrong while working out the charge. Please try again.",
    retryable: true,
  };
}

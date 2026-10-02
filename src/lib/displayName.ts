import { normalizeUserTypeCode } from "@/lib/userTypes";

const HONORIFIC = String.raw`(?:prof(?:essor)?|dr|mr|mrs|ms|shri|smt)\b\.?`;
const BARE_TITLE_RE = new RegExp(String.raw`^(?:${HONORIFIC}[\s.,]*)+$`, "i");
const ACADEMIC_TITLE_RE = /^(?:prof(?:essor)?|dr)\b/i;
const REDUNDANT_PROF_RE = new RegExp(String.raw`^prof(?:essor)?\b\.?\s+(?=${HONORIFIC}(?:\s|$))`, "i");

/**
 * Trim and collapse whitespace; drops a leading "Prof." that only duplicates another title
 * ("Prof. Prof. X", "Prof. Dr. X"). Returns "" for empty input or a bare title such as "Prof.".
 */
export function cleanPersonName(name: string | null | undefined): string {
  let cleaned = (name || "").replace(/\s+/g, " ").trim();
  while (REDUNDANT_PROF_RE.test(cleaned)) cleaned = cleaned.replace(REDUNDANT_PROF_RE, "");
  if (!cleaned || BARE_TITLE_RE.test(cleaned)) return "";
  return cleaned;
}

/**
 * Apply "Prof." prefix for faculty display names (idempotent).
 * Never returns a bare title: an empty or title-only name yields "".
 */
export function applyFacultyNamePrefix(
  name: string | null | undefined,
  userType?: string | number | null
): string {
  const cleaned = cleanPersonName(name);
  if (!cleaned) return "";
  if (normalizeUserTypeCode(userType) !== "faculty") return cleaned;
  if (ACADEMIC_TITLE_RE.test(cleaned)) return cleaned;
  return `Prof. ${cleaned}`;
}

type UserLike = {
  name?: string | null;
  display_name?: string | null;
  email?: string | null;
  user_type?: string | number | null;
};

/** The user's name as shown in the UI (with Prof. for faculty), or "" when no real name is known. */
export function formatPersonName(user: UserLike | null | undefined): string {
  if (!user) return "";
  return cleanPersonName(user.display_name) || applyFacultyNamePrefix(user.name, user.user_type);
}

/** Preferred label for a user-like object in the UI. */
export function formatUserDisplayName(user: UserLike | null | undefined, fallback = "User"): string {
  if (!user) return fallback;
  return formatPersonName(user) || (user.email || "").trim() || fallback;
}

/** Format a bare name when user_type is known separately (e.g. table rows). */
export function formatNamedPerson(
  name: string | null | undefined,
  userType?: string | number | null,
  email?: string | null,
  fallback = "—"
): string {
  const withPrefix = applyFacultyNamePrefix(name, userType);
  if (withPrefix) return withPrefix;
  return (email || "").trim() || fallback;
}

/** "Welcome, Prof. Ravi Saini." — or "Welcome." when no name is known. Never doubles the final period. */
export function formatWelcomeGreeting(name: string | null | undefined): string {
  const cleaned = cleanPersonName(name);
  if (!cleaned) return "Welcome.";
  return /[.!?]$/.test(cleaned) ? `Welcome, ${cleaned}` : `Welcome, ${cleaned}.`;
}

/** "Signed in as <name>", falling back to the email; "" when neither is known. */
export function formatSignedInAs(name: string | null | undefined, email?: string | null): string {
  const who = cleanPersonName(name) || (email || "").trim();
  return who ? `Signed in as ${who}` : "";
}

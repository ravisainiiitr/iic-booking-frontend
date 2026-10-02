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
  /** Backend effective faculty flag (same rule the user guide uses to pick the faculty guide). */
  is_faculty?: boolean | null;
};

/** IIT Roorkee faculty account: user type "faculty" or the backend `is_faculty` flag. */
export function isFacultyUser(user: Pick<UserLike, "user_type" | "is_faculty"> | null | undefined): boolean {
  if (!user) return false;
  return normalizeUserTypeCode(user.user_type) === "faculty" || user.is_faculty === true;
}

/**
 * The user's name as shown in the UI (with Prof. for faculty), or "" when no real name is known.
 * The Prof. prefix is applied to `display_name` as well, so a cached user saved before the server
 * added the prefix still gets it; the server's email fallback in `display_name` is not a name.
 */
export function formatPersonName(user: UserLike | null | undefined): string {
  if (!user) return "";
  const userType = isFacultyUser(user) ? "faculty" : user.user_type;
  const display = (user.display_name || "").includes("@") ? "" : user.display_name;
  return applyFacultyNamePrefix(display, userType) || applyFacultyNamePrefix(user.name, userType);
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

const NAME_HONORIFIC =
  "(?:professor|prof|dr|mrs|mr|ms|miss|shri|smt|er|श्रीमती|श्री|सुश्री|डॉ|डा|प्रोफेसर|प्रो)";
const LEADING_HONORIFICS_RE = new RegExp(String.raw`^(?:${NAME_HONORIFIC}(?:\.\s*|,\s*|\s+|$))+`, "iu");
const LEADING_NON_LETTERS_RE = /^[^\p{L}\p{N}]+/u;

/** Drops leading honorifics ("Prof.", "Dr", "Prof. Dr.", "Mrs.", "श्री", ...) so only the person's own name remains. */
export function stripHonorifics(name: string | null | undefined): string {
  return (name || "").replace(/\s+/g, " ").trim().replace(LEADING_HONORIFICS_RE, "").trim();
}

type GraphemeSegmenter = { segment(text: string): Iterable<{ segment: string }> };
const SegmenterCtor = (Intl as unknown as {
  Segmenter?: new (locale?: string, options?: { granularity: "grapheme" }) => GraphemeSegmenter;
}).Segmenter;
const graphemeSegmenter = SegmenterCtor ? new SegmenterCtor(undefined, { granularity: "grapheme" }) : null;

function firstGrapheme(word: string): string {
  const text = word.replace(LEADING_NON_LETTERS_RE, "");
  if (!text) return "";
  const first = graphemeSegmenter
    ? graphemeSegmenter.segment(text)[Symbol.iterator]().next().value?.segment
    : Array.from(text)[0];
  return (first || "").toUpperCase();
}

/**
 * Avatar initials from a person's name, ignoring honorifics: "Prof. Ravi Saini" → "R" (or "RS" with max 2).
 * Falls back to the email's first letter, then `fallback`, when no name is known.
 */
export function getInitials(
  name: string | null | undefined,
  options: { email?: string | null; max?: 1 | 2; fallback?: string } = {}
): string {
  const { email, max = 1, fallback = "?" } = options;
  const words = stripHonorifics(name)
    .split(" ")
    .filter((word) => firstGrapheme(word));
  if (words.length) {
    const first = firstGrapheme(words[0]);
    return max === 2 && words.length > 1 ? first + firstGrapheme(words[words.length - 1]) : first;
  }
  return firstGrapheme((email || "").trim()) || fallback;
}

/** Single avatar letter for a person: first letter of the actual name, not of a "Prof."/"Dr." title. */
export function getNameInitial(name: string | null | undefined, email?: string | null, fallback = "?"): string {
  return getInitials(name, { email, fallback });
}

/** "Signed in as <name>", falling back to the email; "" when neither is known. */
export function formatSignedInAs(name: string | null | undefined, email?: string | null): string {
  const who = cleanPersonName(name) || (email || "").trim();
  return who ? `Signed in as ${who}` : "";
}

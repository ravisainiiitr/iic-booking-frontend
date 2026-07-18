import { normalizeUserTypeCode } from "@/lib/userTypes";

/**
 * Apply "Prof." prefix for faculty display names (idempotent).
 */
export function applyFacultyNamePrefix(
  name: string | null | undefined,
  userType?: string | number | null
): string {
  const cleaned = (name || "").trim();
  if (!cleaned) return cleaned;
  const code = normalizeUserTypeCode(userType);
  if (code !== "faculty") return cleaned;
  const lower = cleaned.toLowerCase();
  if (lower.startsWith("prof.") || lower.startsWith("professor")) return cleaned;
  return `Prof. ${cleaned}`;
}

/** Preferred label for a user-like object in the UI. */
export function formatUserDisplayName(
  user: {
    name?: string | null;
    display_name?: string | null;
    email?: string | null;
    user_type?: string | number | null;
  } | null | undefined,
  fallback = "User"
): string {
  if (!user) return fallback;
  if (user.display_name?.trim()) return user.display_name.trim();
  const withPrefix = applyFacultyNamePrefix(user.name, user.user_type);
  if (withPrefix) return withPrefix;
  return (user.email || "").trim() || fallback;
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

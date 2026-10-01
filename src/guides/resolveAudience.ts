import { normalizeUserTypeCode } from "@/lib/userTypes";
import type { GuideAudienceId } from "./types";

const PROJECT_STAFF_ALIAS_HINTS = [
  "research associate",
  "research associates",
  "post doctoral",
  "post-doctoral",
  "postdoc",
  "project",
];

const STARTUP_ALIAS_HINTS = ["startup", "startups", "start-up"];

/** Fields of the signed-in user that decide which guide they get. */
export interface GuideUserLike {
  user_type?: string | number | null;
  user_type_alias?: string | null;
  user_type_display?: string | null;
  is_faculty?: boolean | null;
}

const squash = (v: unknown) =>
  String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

/** Same rule as the dashboard: Accounts In Charge can be signalled by code, display name or alias. */
function isAccountsInCharge(code: string, user: GuideUserLike): boolean {
  const blob = `${squash(code)}|${squash(user.user_type_display)}|${squash(user.user_type_alias)}`;
  return blob.includes("finance") || blob.includes("accountsincharge") || blob.includes("accountincharge");
}

/**
 * Map the signed-in user to exactly one guide audience. Staff roles win over end-user roles;
 * `is_faculty` (backend effective faculty flag) maps to the faculty guide.
 */
export function resolveGuideAudienceForUser(user: GuideUserLike | null | undefined): GuideAudienceId | null {
  if (!user) return null;
  const code = normalizeUserTypeCode(user.user_type ?? null);
  if (!code) return null;
  const alias = (user.user_type_alias || "").toLowerCase();

  if (code === "admin") return "admin";
  if (code === "manager") return "oic";
  if (code === "operator") return "operator";
  if (code === "dept_admin") return "dept_admin";
  if (code === "external_relations") return "external_relations";
  if (code === "finance" || isAccountsInCharge(code, user)) return "finance";

  if (code === "faculty" || user.is_faculty === true) return "faculty";

  if (code === "startup_incubated_iitr" || code === "external_startup_msme") return "startup";
  if (code === "individual_student" && STARTUP_ALIAS_HINTS.some((h) => alias.includes(h))) return "startup";

  if (code === "student" || code === "individual_student") {
    return PROJECT_STAFF_ALIAS_HINTS.some((h) => alias.includes(h)) ? "project_staff" : "student";
  }

  if (code === "external" || code === "rnd" || code === "industry" || code === "other") return "external";

  return null;
}

/** Backwards-compatible form used where only the type code and alias are known. */
export function resolveGuideAudience(
  userType: string | number | null | undefined,
  userTypeAlias?: string | null
): GuideAudienceId | null {
  return resolveGuideAudienceForUser({ user_type: userType, user_type_alias: userTypeAlias });
}

export function shouldAutoShowUserGuide(opts: {
  user: GuideUserLike | null | undefined;
  /** If already acknowledged on the server, do not auto-open. */
  userGuideViewed?: boolean | null;
}): boolean {
  if (opts.userGuideViewed === true) return false;
  return resolveGuideAudienceForUser(opts.user) != null;
}

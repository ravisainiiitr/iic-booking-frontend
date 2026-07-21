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

/**
 * Map portal user_type (+ optional alias) to a published guide audience.
 */
export function resolveGuideAudience(
  userType: string | number | null | undefined,
  userTypeAlias?: string | null
): GuideAudienceId | null {
  const code = normalizeUserTypeCode(userType);
  if (!code) return null;

  const alias = (userTypeAlias || "").toLowerCase();

  if (code === "admin") return "admin";
  if (code === "manager") return "oic";
  if (code === "operator") return "operator";
  if (code === "dept_admin") return "dept_admin";
  if (code === "finance") return "finance";
  if (code === "external_relations") return "external_relations";

  if (code === "startup_incubated_iitr" || code === "external_startup_msme") {
    return "startup";
  }

  if (code === "individual_student" && STARTUP_ALIAS_HINTS.some((h) => alias.includes(h))) {
    return "startup";
  }

  if (
    (code === "student" || code === "individual_student") &&
    PROJECT_STAFF_ALIAS_HINTS.some((h) => alias.includes(h))
  ) {
    return "project_staff";
  }

  if (code === "faculty") return "faculty";
  if (code === "student" || code === "individual_student") return "student";

  if (
    code === "external" ||
    code === "rnd" ||
    code === "industry" ||
    code === "other"
  ) {
    return "external";
  }

  return null;
}

export function shouldAutoShowUserGuide(opts: {
  userType: string | number | null | undefined;
  userTypeAlias?: string | null;
  userGuideViewed?: boolean | null;
}): boolean {
  if (opts.userGuideViewed) return false;
  return resolveGuideAudience(opts.userType, opts.userTypeAlias) != null;
}

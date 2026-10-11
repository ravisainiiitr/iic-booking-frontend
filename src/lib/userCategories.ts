/**
 * Report-facing user categories: one mapping from raw user-type codes (and booking `user_type_snapshot` values) to
 * the names shown in reports, dashboards and exports. Mirrors backend `iic_booking.users.user_categories`; prefer a
 * `*_label` sent by the API and fall back to these helpers.
 */

export type UserCategory =
  | "iitr_student"
  | "iitr_faculty"
  | "iitr_staff"
  | "iitr_startup"
  | "external_academic"
  | "external_industry"
  | "government_rnd"
  | "external_startup"
  | "other";

export const USER_CATEGORY_LABELS: Record<UserCategory, string> = {
  iitr_student: "IITR Students",
  iitr_faculty: "IITR Faculty",
  iitr_staff: "IITR Staff",
  iitr_startup: "IITR Startups",
  external_academic: "External – Educational / Academic",
  external_industry: "External – Industry",
  government_rnd: "External – Govt R&D",
  external_startup: "External – Startup / MSME",
  other: "External – Other",
};

export const INTERNAL_USER_CATEGORIES: readonly UserCategory[] = [
  "iitr_student",
  "iitr_faculty",
  "iitr_staff",
  "iitr_startup",
];

const CODE_TO_CATEGORY: Record<string, UserCategory> = {
  student: "iitr_student",
  individual_student: "iitr_student",
  faculty: "iitr_faculty",
  startup_incubated_iitr: "iitr_startup",
  admin: "iitr_staff",
  dept_admin: "iitr_staff",
  manager: "iitr_staff",
  operator: "iitr_staff",
  finance: "iitr_staff",
  oc_stores: "iitr_staff",
  hod: "iitr_staff",
  external_relations: "iitr_staff",
  org_admin: "iitr_staff",
  external: "external_academic",
  industry: "external_industry",
  rnd: "government_rnd",
  external_startup_msme: "external_startup",
  other: "other",
};

/** Category of a user-type code (case-insensitive); unknown or empty codes are "other". */
export function userCategoryOf(code: string | null | undefined): UserCategory {
  const key = String(code ?? "").trim().toLowerCase();
  return CODE_TO_CATEGORY[key] ?? "other";
}

/** "student" → "IITR Students", "RND" → "External – Govt R&D"; empty → "Not recorded". */
export function userCategoryLabel(code: string | null | undefined): string {
  if (!String(code ?? "").trim()) return "Not recorded";
  const key = String(code).trim().toLowerCase();
  if (key in USER_CATEGORY_LABELS) return USER_CATEGORY_LABELS[key as UserCategory];
  return USER_CATEGORY_LABELS[userCategoryOf(code)];
}

export function isInternalUserCategory(code: string | null | undefined): boolean {
  return INTERNAL_USER_CATEGORIES.includes(userCategoryOf(code));
}

/** User types that follow external booking rules (reserved slots, booking window, GST, etc.). */
export const EXTERNAL_BOOKING_USER_TYPE_CODES = [
  "external",
  "rnd",
  "industry",
  "other",
  "external_startup_msme",
] as const;

export function normalizeUserTypeCode(userType: string | number | null | undefined): string | null {
  if (userType === null || userType === undefined) return null;
  if (typeof userType === "string") return userType.toLowerCase();
  if (typeof userType === "number") {
    const typeMap: Record<number, string> = {
      1: "student",
      2: "faculty",
    };
    return typeMap[userType] || String(userType).toLowerCase();
  }
  return null;
}

/** Account types that sign in with Channel i (backend UserType.get_omniport_codes). */
export const CHANNEL_I_USER_TYPE_CODES = [
  "student",
  "individual_student",
  "faculty",
  "dept_admin",
  "manager",
  "operator",
  "finance",
] as const;

export function isChannelIUserType(userType: string | number | null | undefined): boolean {
  const normalized = normalizeUserTypeCode(userType);
  if (!normalized) return false;
  return (CHANNEL_I_USER_TYPE_CODES as readonly string[]).includes(normalized);
}

export function isExternalBookingUserType(userType: string | number | null | undefined): boolean {
  const normalized = normalizeUserTypeCode(userType);
  if (!normalized) return false;
  return (EXTERNAL_BOOKING_USER_TYPE_CODES as readonly string[]).includes(normalized);
}

export const USER_TYPE_DISPLAY_NAMES: Record<string, string> = {
  admin: "Admin",
  dept_admin: "Department Administrator",
  manager: "Officer In Charge",
  operator: "Lab Operator",
  finance: "Accounts In Charge",
  org_admin: "Organization Administrator",
  external_relations: "External Relations Administrator",
  oc_stores: "Officer In Charge Stores",
  hod: "Head of Department",
  student: "IIT Roorkee Students",
  individual_student: "Individual Student",
  faculty: "IIT Roorkee Faculty",
  external: "Educational Institute",
  rnd: "Govt R&D Organizations",
  industry: "Industry",
  startup_incubated_iitr: "IITR Startup",
  external_startup_msme: "External Startup/MSME",
  other: "Other",
};

/**
 * End-user / customer types that use department wallets and pay for bookings.
 * Staff types (admin, OIC, lab/accounts incharge) are excluded.
 */
export const END_USER_BOOKING_TYPE_CODES = [
  "student",
  "individual_student",
  "faculty",
  "external",
  "rnd",
  "industry",
  "startup_incubated_iitr",
  "external_startup_msme",
] as const;

export function isEndUserBookingType(userType: string | number | null | undefined): boolean {
  const normalized = normalizeUserTypeCode(userType);
  if (!normalized) return false;
  return (END_USER_BOOKING_TYPE_CODES as readonly string[]).includes(normalized);
}

/** Fixed user types for public charge estimate (calculate mode). */
export const CHARGE_ESTIMATE_USER_TYPE_OPTIONS: ReadonlyArray<{ code: string; label: string }> = [
  { code: "student", label: "IIT Roorkee Students" },
  { code: "faculty", label: "IIT Roorkee Faculty" },
  { code: "external", label: "Educational Institute" },
  { code: "rnd", label: "Govt R&D Organizations" },
  { code: "industry", label: "Industry" },
  { code: "startup_incubated_iitr", label: "IITR Startup" },
  { code: "external_startup_msme", label: "External Startup/MSME" },
];

/** IIT Roorkee internal rate categories (hidden from anonymous and external viewers). */
export const INTERNAL_RATE_USER_TYPE_CODES = [
  "student",
  "individual_student",
  "faculty",
  "startup_incubated_iitr",
] as const;

const STAFF_USER_TYPE_CODES = [
  "admin",
  "dept_admin",
  "manager",
  "operator",
  "finance",
  "org_admin",
  "external_relations",
] as const;

export function isInternalRateUserType(userType: string | number | null | undefined): boolean {
  const normalized = normalizeUserTypeCode(userType);
  if (!normalized) return false;
  return (INTERNAL_RATE_USER_TYPE_CODES as readonly string[]).includes(normalized);
}

/** Mirrors backend `viewer_may_see_internal_rates`: internal IITR users and staff only. */
export function viewerMaySeeInternalRates(
  user: { user_type?: string | number | null; department_type?: string | null } | null | undefined,
): boolean {
  if (!user) return false;
  const t = normalizeUserTypeCode(user.user_type ?? null);
  if (!t) return false;
  if ((STAFF_USER_TYPE_CODES as readonly string[]).includes(t)) return true;
  if (!isInternalRateUserType(t)) return false;
  return String(user.department_type ?? "").toLowerCase() !== "external";
}

/** Mirrors backend `is_calendar_sync_eligible`: internal and external booking users; staff roles are excluded. */
export function isCalendarSyncUserType(userType: string | number | null | undefined): boolean {
  return isInternalRateUserType(userType) || isExternalBookingUserType(userType);
}

export function chargeEstimateUserTypeOptionsFor(
  maySeeInternal: boolean,
): ReadonlyArray<{ code: string; label: string }> {
  return maySeeInternal
    ? CHARGE_ESTIMATE_USER_TYPE_OPTIONS
    : CHARGE_ESTIMATE_USER_TYPE_OPTIONS.filter((o) => !isInternalRateUserType(o.code));
}

export function getChargeEstimateUserTypeLabel(userType: string | null | undefined): string {
  const key = normalizeUserTypeCode(userType);
  if (!key) return String(userType ?? "");
  const fixed = CHARGE_ESTIMATE_USER_TYPE_OPTIONS.find((o) => o.code === key);
  return fixed?.label ?? USER_TYPE_DISPLAY_NAMES[key] ?? String(userType);
}

export function getUserTypeDisplayName(userType: string | null | undefined): string {
  const key = normalizeUserTypeCode(userType);
  if (!key) return String(userType ?? "");
  return USER_TYPE_DISPLAY_NAMES[key] || String(userType);
}

/** Programme / employment end date of IITR students, post-docs, research associates and IITR Startups. */

import type { RegistrationExtension, RegistrationPerson } from "@/lib/registrationApprovalTypes";

export const ACCOUNT_SUSPENDED_CODE = "account_suspended";
export const ACCOUNT_SUSPENDED_EVENT = "iic:account-suspended";

export type LifecycleCategory = "iitr_student" | "iitr_postdoc" | "iitr_research_associate" | "iitr_startup";
export type EndDateSource = "graduation_date" | "derived_from_joining" | "user_provided" | "extended" | "missing";
export type LifecycleState = "active" | "ending_soon" | "ended" | "suspended" | "end_date_missing";

/** Compact status sent with /auth/user/ (null for users the end-date rules do not apply to). */
export interface AccountLifecycleCompact {
  category: LifecycleCategory;
  category_label: string;
  programme_end_date: string | null;
  end_date_source: EndDateSource;
  state: LifecycleState;
  suspended: boolean;
  enforcement_enabled: boolean;
  days_left: number | null;
  end_date_required: boolean;
}

export interface AccountLifecycleStatus extends AccountLifecycleCompact {
  degree_name: string;
  degree_code: string;
  degree_label: string;
  degree_years: number | null;
  joining_date: string | null;
  graduation_date: string | null;
  base_end_date: string | null;
  extended_until: string | null;
  end_date_source_note: string;
  supervisor: RegistrationPerson | null;
  can_request_extension: boolean;
  extension_block_reason: string;
  extension_max_until: string | null;
  extension_max_months: number;
  pending_extension: RegistrationExtension | null;
  request_window_days: number;
}

export type MyAccountLifecycle = ({ in_scope: true } & AccountLifecycleStatus) | { in_scope: false };

export interface SupervisedUserRow {
  user: RegistrationPerson;
  category_label: string;
  degree_name: string;
  programme_end_date: string;
  end_date_source: EndDateSource;
  end_date_source_note: string;
  days_left: number;
  suspended: boolean;
}

export interface SupervisorLifecycleOverview {
  enforcement_enabled: boolean;
  pending_extensions: RegistrationExtension[];
  users: SupervisedUserRow[];
  nearing_days: number;
}

export interface ExtensionDecisionItem extends RegistrationExtension {
  faculty_name: string;
  degree_name: string;
  end_date_source_note: string;
  category_label: string;
}

export interface LifecycleReport {
  today: string;
  enforcement_enabled: boolean;
  by_category: Record<string, Record<string, number>>;
  iitr_students_by_degree: Record<string, Record<string, number>>;
  would_suspend_now_total: number;
  would_suspend_now_with_future_bookings: number;
  would_suspend_now_without_resolvable_supervisor: number;
  missing_end_date_total: number;
  degree_names_top?: Array<{ degree_name: string; maps_to: string; users: number }>;
  degree_names_distinct: number;
}

export const EXTENSION_BLOCK_REASON: Record<string, string> = {
  not_in_scope: "Extensions apply to IITR students, post-docs, research associates and IITR Startups.",
  no_end_date: "No programme / employment end date is recorded for your account yet.",
  not_approved: "You can request an extension once your account is approved.",
  enforcement_off: "End dates are not enforced yet, so no extension is needed now.",
  too_early: "You can ask for an extension from 30 days before your end date.",
};

export const SUSPENDED_ACTION_TOOLTIP =
  "Your account is suspended because your programme / employment end date has passed. Request an extension from your supervisor to book or upload again.";

export function lifecycleOf(user: { account_lifecycle?: AccountLifecycleCompact | null } | null | undefined) {
  return user?.account_lifecycle ?? null;
}

export function isAccountSuspended(user: { account_lifecycle?: AccountLifecycleCompact | null } | null | undefined): boolean {
  return Boolean(user?.account_lifecycle?.suspended);
}

export function isSuspendedBody(body: unknown): body is { code: string; error?: string; detail?: string } {
  return Boolean(body && typeof body === "object" && (body as { code?: unknown }).code === ACCOUNT_SUSPENDED_CODE);
}

export function notifyAccountSuspended(message: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<{ message: string }>(ACCOUNT_SUSPENDED_EVENT, { detail: { message } }));
}

const SOURCE_LABEL: Record<EndDateSource, string> = {
  graduation_date: "Graduation date",
  derived_from_joining: "Derived from joining date",
  user_provided: "Given at registration",
  extended: "Extended by supervisor",
  missing: "Not available",
};

export function endDateSourceLabel(source: EndDateSource | string | null | undefined): string {
  return (source && SOURCE_LABEL[source as EndDateSource]) || "";
}

export type BannerKind = "suspended" | "ending_soon" | "end_date_missing" | null;

/** Which global banner to show: suspended always; the others only while enforcement is on / data is needed. */
export function bannerKind(status: AccountLifecycleCompact | null | undefined): BannerKind {
  if (!status) return null;
  if (status.suspended) return "suspended";
  if (status.end_date_required) return "end_date_missing";
  if (status.enforcement_enabled && status.state === "ending_soon") return "ending_soon";
  return null;
}

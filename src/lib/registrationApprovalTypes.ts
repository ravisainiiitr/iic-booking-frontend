export type RegistrationRequestStatus =
  | "unverified"
  | "pending_faculty"
  | "pending_admin"
  | "approved"
  | "rejected"
  | "expired"
  | "disabled";

export interface RegistrationPerson {
  id: number;
  name: string;
  email: string;
  department: string;
}

export interface RegistrationRequestRow {
  user_id: number;
  name: string;
  email: string;
  user_type: string;
  user_type_label: string;
  department: string;
  department_id: number | null;
  claims_iitr: boolean;
  faculty: RegistrationPerson | null;
  faculty_missing: boolean;
  status: RegistrationRequestStatus;
  registered_at: string | null;
  programme_validity: string | null;
  email_verified: boolean;
  forwarded_at: string | null;
  reminder_count: number;
  decided_at: string | null;
  decided_role: string;
  decision_deadline?: string | null;
}

export interface RegistrationEvent {
  id: number;
  at: string;
  action: string;
  action_label: string;
  user_id: number | null;
  user_email: string;
  user_name: string;
  actor_email: string;
  actor_name: string;
  actor_role: string;
  channel: string;
  ip_address: string | null;
  details: Record<string, unknown>;
  extension_id: number | null;
}

export type RegistrationExtensionStatus = "pending" | "approved" | "denied" | "cancelled";

export interface RegistrationExtension {
  id: number;
  kind: "extension";
  user: RegistrationPerson;
  user_type_label: string;
  status: RegistrationExtensionStatus;
  faculty: RegistrationPerson | null;
  previous_end_date: string | null;
  max_until: string | null;
  approved_until: string | null;
  user_reason: string;
  requested_channel: string;
  created_at: string | null;
  decided_at: string | null;
  decided_role: string;
  decided_by: string;
  decision_reason: string;
  disclaimer_text: string;
  max_months: number;
  disclaimer_template?: string;
  disclaimer_version?: string;
}

export interface RegistrationFutureBooking {
  booking_id: number;
  display_id: string;
  equipment: string;
  status: string;
  starts_at: string | null;
}

export interface RegistrationDocument {
  id: number;
  document_type: string;
  description: string;
  url: string;
  uploaded_at: string | null;
}

export interface RegistrationRequestDetail extends RegistrationRequestRow {
  phone: string;
  employee_id: string;
  gender: string;
  programme_start: string | null;
  access_on_hold: boolean;
  admin_approved: boolean;
  supervisor_approved: boolean;
  needs_supervisor_approval: boolean;
  is_active: boolean;
  force_inactive: boolean;
  documents: RegistrationDocument[];
  approval: null | {
    status: string;
    faculty: RegistrationPerson | null;
    forward_count: number;
    forwarded_at: string | null;
    last_reminder_at: string | null;
    first_viewed_at: string | null;
    decided_at: string | null;
    decided_by: string;
    decided_role: string;
    decision_reason: string;
    decision_channel: string;
    disclaimer_text: string;
    disclaimer_version: string;
    expiry_disabled_at: string | null;
    expiry_set_force_inactive: boolean;
    decision_deadline?: string | null;
  };
  extensions: RegistrationExtension[];
  extension_max_until: string | null;
  future_bookings: RegistrationFutureBooking[];
  timeline: RegistrationEvent[];
}

export interface RegistrationSummary {
  by_status: Record<RegistrationRequestStatus, number>;
  iitr_pending: number;
  iitr_pending_missing_faculty: number;
  bulk_forward_candidates: number;
  pending_extensions: number;
  automation_enabled: boolean;
  decision_window_hours?: number;
}

export interface RegistrationRequestList {
  count: number;
  page: number;
  page_size: number;
  results: RegistrationRequestRow[];
  summary: RegistrationSummary;
}

export interface RegistrationRequestFilters {
  status?: string;
  claims_iitr?: "" | "yes" | "no";
  faculty?: string;
  department?: string;
  faculty_missing?: boolean;
  date_from?: string;
  date_to?: string;
  q?: string;
  page?: number;
  page_size?: number;
}

export interface RegistrationLogFilters {
  action?: string;
  actor_role?: string;
  channel?: string;
  user_id?: number;
  date_from?: string;
  date_to?: string;
  q?: string;
  page?: number;
  page_size?: number;
}

export interface RegistrationLogPage {
  count: number;
  page: number;
  page_size: number;
  results: RegistrationEvent[];
  actions: Array<{ value: string; label: string }>;
  channels: Array<{ value: string; label: string }>;
}

export interface RegistrationDryRunRow {
  user_id: number;
  name: string;
  email: string;
  programme_validity: string | null;
  faculty: string;
  future_bookings: number;
  days?: number;
}

export interface RegistrationAutomationStatus {
  enabled: boolean;
  enabled_at: string | null;
  warning_days: number[];
  token_valid_days: number;
  extension_max_months: number;
  dry_run: {
    automation_enabled: boolean;
    today: string;
    warning_days: number[];
    would_warn: RegistrationDryRunRow[];
    would_disable: RegistrationDryRunRow[];
    counts: { would_warn: number; would_disable: number };
  };
  disabled_with_future_bookings: Array<{
    user_id: number;
    name: string;
    email: string;
    bookings: RegistrationFutureBooking[];
  }>;
}

export interface FacultyRegistrationRequest {
  id: number;
  kind: "registration";
  status: string;
  user: RegistrationPerson;
  user_type_label: string;
  employee_id: string;
  phone: string;
  programme_start: string | null;
  programme_validity: string | null;
  registered_at: string | null;
  forwarded_at: string | null;
  decision_deadline?: string | null;
  decided_at: string | null;
  decision_reason: string;
  disclaimer_text: string;
  disclaimer_template?: string;
  disclaimer_version?: string;
  account_removed?: boolean;
}

/** Request shown on the page opened from the Approve / Decline buttons in the faculty email. */
export interface EmailDecisionItem extends FacultyRegistrationRequest {
  faculty_name: string;
  department: string;
  decision_deadline_display: string;
  window_hours: number;
}

export type EmailDecisionErrorCode =
  | "timed_out"
  | "already_decided"
  | "request_closed"
  | "token_invalid"
  | "token_used"
  | "token_expired"
  | "wrong_faculty"
  | "not_pending"
  | "schema_pending";

export interface EmailDecisionResult {
  decision: "approved" | "declined";
  message: string;
  account_removed: boolean;
}

export interface FacultyApprovalsOverview {
  registrations: FacultyRegistrationRequest[];
  extensions: RegistrationExtension[];
  recent_registrations: FacultyRegistrationRequest[];
  recent_extensions: RegistrationExtension[];
  extension_max_months: number;
}

export type FacultyReviewItem =
  | { kind: "registration"; item: FacultyRegistrationRequest }
  | { kind: "extension"; item: RegistrationExtension };

export interface FacultyDecisionInput {
  decision: "approve" | "disapprove";
  reason?: string;
  disclaimer_accepted?: boolean;
  disclaimer_version?: string;
  token?: string;
  until?: string;
}

export interface ProgrammeValidity {
  name: string;
  programme_validity: string | null;
  expired: boolean;
  days_left: number | null;
  faculty: RegistrationPerson | null;
  can_request_extension: boolean;
  extension_max_until: string | null;
  extension_max_months: number;
  pending_extension: RegistrationExtension | null;
}

export const REGISTRATION_STATUS_LABEL: Record<RegistrationRequestStatus, string> = {
  unverified: "Email not verified",
  pending_faculty: "Pending faculty",
  pending_admin: "Pending admin",
  approved: "Approved",
  rejected: "Rejected",
  expired: "Expired",
  disabled: "Disabled",
};

export const REGISTRATION_ROLE_LABEL: Record<string, string> = {
  main_admin: "Main Administrator",
  faculty: "Faculty",
  user: "User",
  system: "System",
};

export const REGISTRATION_CHANNEL_LABEL: Record<string, string> = {
  portal: "Portal",
  email_link: "Email link",
  login: "Sign-in page",
  system: "Automatic",
};

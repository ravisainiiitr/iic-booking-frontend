export type TrainingMenuKey =
  | "training_events"
  | "my_trainings"
  | "training_workspace"
  | "training_attendance"
  | "training_policy_settings";

export interface TrainingRoles {
  admin: boolean;
  faculty: boolean;
  student: boolean;
  oic: boolean;
  operator: boolean;
  dept_admin: boolean;
}

export type TrainingAudience = "TEST_ACCOUNTS" | "EVERYONE";

export interface TrainingBootstrap {
  enabled: boolean;
  audience?: TrainingAudience;
  pilot: boolean;
  pilot_equipment_count: number;
  can_manage_module?: boolean;
  roles: TrainingRoles;
  menus: Record<TrainingMenuKey, boolean>;
}

export interface TrainingModuleEquipment {
  equipment_id: number;
  code: string;
  name: string;
  department?: string | null;
  status: string;
  enabled: boolean;
  env_pilot: boolean;
  training_active: boolean;
}

export interface TrainingModuleState {
  module_enabled: boolean;
  db_module_enabled: boolean;
  env_module_enabled: boolean;
  audience: TrainingAudience;
  audience_label: string;
  audience_choices: Array<{ value: TrainingAudience; label: string }>;
  /** Off (default): course/curricular demonstrations are charged at the internal IITR rate like any other. */
  course_demos_free?: boolean;
  env_pilot_equipment_codes: string[];
  pilot_oic_count: number;
  all_equipment_in_scope: boolean;
  enabled_equipment: TrainingModuleEquipment[];
  updated_at: string | null;
  updated_by: string | null;
}

export interface TrainingEquipmentRef {
  equipment_id: number;
  code: string;
  name: string;
  department?: string | null;
}

/** Policy terms shown on the demonstration form (equipment-specific once equipment is chosen). */
export interface DemoTerms {
  demo_max_minutes: number | null;
  demo_refund_full_days: number | null;
  demo_refund_half_days: number | null;
  course_demos_free?: boolean;
  charged_at_internal_rate?: boolean;
}

export interface TrainingEquipmentDetail extends TrainingEquipmentRef, DemoTerms {
  can_manage: boolean;
}

export interface TrainingEquipmentDepartment {
  id: number;
  name: string;
  equipment_count: number;
}

export interface TrainingEquipmentList {
  results: TrainingEquipmentRef[];
  departments?: TrainingEquipmentDepartment[];
  demo_terms?: DemoTerms;
}

/** Estimated demonstration charge at the equipment's internal IITR rate. */
export interface DemoQuote {
  purpose: DemoPurpose;
  minutes: number;
  chargeable: boolean;
  rate_available: boolean;
  rate_per_hour: string | null;
  amount: string | null;
  basis: string;
  course_demos_free: boolean;
  wallet_label: string;
  wallet_balance?: string | null;
  balance_error: string | null;
  demo_max_minutes: number | null;
  over_max: boolean;
}

export interface TrainingWindow {
  start: string;
  end: string;
  [key: string]: unknown;
}

export interface TrainingUserRef {
  id: number;
  name: string;
  email?: string | null;
  department?: string | null;
  user_type?: string | null;
}

export type DemoStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "PROPOSED_ALTERNATIVE"
  | "APPROVED"
  | "SCHEDULED"
  | "COMPLETED"
  | "REJECTED"
  | "WITHDRAWN"
  | "CANCELLED"
  | "EXPIRED"
  | "NO_SHOW";

export type DemoPurpose = "COURSE" | "RESEARCH_INDUCTION" | "OTHER";
export type CurtailReasonCode = "INSTRUMENT_TIME" | "SAMPLE_CONSUMABLE" | "SAFETY_CAPACITY" | "POLICY_MAX" | "OTHER";
export type DemoChargeMode = "FREE" | "WALLET" | "WAIVED";

/** Minimum length of the reason the OIC must give to waive a demonstration charge. */
export const WAIVER_REASON_MIN_CHARS = 10;

export interface DemoPermissions {
  withdraw: boolean;
  respond: boolean;
  counter: boolean;
  decide: boolean;
  schedule: boolean;
  cancel: boolean;
  attendance: boolean;
  complete: boolean;
  /** OIC / temporary OIC / Main Admin may waive the charge of this decided request. */
  waive?: boolean;
}

export interface DemoChargeWaiver {
  by: string;
  by_id: number | null;
  at: string | null;
  reason: string;
  amount: string;
  refunded: string;
}

export interface DemoRevision {
  action: string;
  from_status: string | null;
  to_status: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason_code: string | null;
  reason: string | null;
  actor: TrainingUserRef | string | null;
  created_at: string;
}

export interface DemoRequest {
  id: number;
  reference: string;
  status: DemoStatus;
  status_label: string;
  requester: TrainingUserRef;
  equipment: TrainingEquipmentRef;
  purpose: DemoPurpose;
  purpose_label: string;
  course_code: string;
  course_name: string;
  participants_requested: number;
  requested_duration_minutes: number;
  preferred_windows: TrainingWindow[];
  notes: string;
  approved_duration_minutes: number | null;
  approved_participants: number | null;
  approved_start_at: string | null;
  approved_end_at: string | null;
  curtailed: boolean;
  curtail_reason_code: CurtailReasonCode | "" | null;
  curtail_reason_label: string | null;
  oic_remarks: string;
  proposed_start_at: string | null;
  proposed_end_at: string | null;
  proposal_expires_at: string | null;
  counter_used: boolean;
  faculty_response: string | null;
  charge_mode: DemoChargeMode | "" | null;
  rate_per_hour: string | null;
  charge_amount: string | null;
  charged: boolean;
  charge_text?: string;
  charge_waiver?: DemoChargeWaiver | null;
  refund_amount: string | null;
  cancelled_by_side: string | null;
  cancel_reason: string | null;
  attended_count: number | null;
  submitted_at: string | null;
  decided_at: string | null;
  decided_by: TrainingUserRef | string | null;
  sla_escalated: boolean;
  event_id: number | null;
  permissions: DemoPermissions;
  participants?: TrainingUserRef[];
  participant_list_text?: string;
  revisions?: DemoRevision[];
}

export interface CreateDemoRequestInput {
  equipment_id: number;
  purpose: DemoPurpose;
  course_code: string;
  course_name: string;
  participants_requested: number;
  requested_duration_minutes: number;
  preferred_windows: Array<{ start: string; end: string }>;
  notes: string;
  participant_user_ids?: number[];
  participant_list_text?: string;
  charge_acknowledged?: boolean;
}

export interface DemoDecisionInput {
  action: "approve" | "propose" | "reject";
  approved_duration_minutes?: number;
  approved_participants?: number;
  reason_code?: CurtailReasonCode;
  remarks?: string;
  charge_mode?: DemoChargeMode;
  rate_per_hour?: string;
  waive_charge?: boolean;
  waiver_reason?: string;
  start_at?: string;
}

export interface TrainingCaps {
  per_faculty_cap: number | null;
  per_department_pct: number | null;
  reserved_pct: number | null;
  tie_window?: number | null;
}

export type CallStatus = "OPEN" | "CLOSED" | "PUBLISHED" | "CANCELLED";

export interface NominationCall {
  id: number;
  reference: string;
  title: string;
  equipment: TrainingEquipmentRef;
  event_id: number | null;
  seats: number;
  deadline: string;
  status: CallStatus;
  status_label: string;
  accepting: boolean;
  notes: string;
  eligibility: unknown;
  caps: TrainingCaps;
  policy_version: number | null;
  nominations_count: number;
  confirmed_interest_count: number;
  my_nominations_count: number;
  opened_at: string | null;
  published_run_id: number | null;
  appeal_deadline: string | null;
  can_manage: boolean;
  event?: TrainingEvent | null;
}

export type NeedCategory = "THESIS_CRITICAL" | "FUNDED_PROJECT" | "EXPLORATORY";

export type NominationStatus =
  | "SUBMITTED"
  | "ELIGIBLE"
  | "INELIGIBLE"
  | "WITHDRAWN"
  | "SELECTED"
  | "WAITLISTED"
  | "NOT_SELECTED"
  | "CONFIRMED"
  | "DECLINED"
  | "EXPIRED";

export interface TrainingAppeal {
  id: number;
  status: string;
  reason: string;
  decision_note: string | null;
  created_at: string;
}

export interface NominationResult {
  entry_id: number;
  outcome: string;
  outcome_label: string;
  rank: number | null;
  score_total: number | string | null;
  score_breakdown: Record<string, number | string | null> | null;
  waitlist_position: number | null;
  seat_type: string;
  note: string | null;
  appeals: TrainingAppeal[];
}

export interface Nomination {
  id: number;
  call: {
    id: number;
    reference: string;
    title: string;
    deadline: string;
    status: CallStatus;
    equipment: TrainingEquipmentRef;
    event_id: number | null;
  };
  student: TrainingUserRef;
  nominator: TrainingUserRef | null;
  need_category: NeedCategory;
  need_category_label: string;
  justification: string;
  expected_hours_month: number | null;
  status: NominationStatus;
  status_label: string;
  student_confirmed_at: string | null;
  confirm_deadline: string | null;
  confirmed_at: string | null;
  ineligible_reason: string | null;
  flags: string[];
  need_adjustment: number | null;
  need_adjust_reason: string | null;
  selected_on_appeal: boolean;
  promoted_from_waitlist: boolean;
  result: NominationResult | null;
  permissions: {
    withdraw: boolean;
    confirm_interest: boolean;
    accept_seat: boolean;
    decline_seat: boolean;
    appeal: boolean;
  };
}

export interface CreateNominationInput {
  call_id: number;
  student_id: number;
  need_category: NeedCategory;
  justification: string;
  expected_hours_month?: number;
}

export type ScoreBreakdown = Partial<
  Record<
    | "first_time_equipment"
    | "never_trained_anywhere"
    | "research_need"
    | "demand"
    | "tenure"
    | "department_underrepresentation"
    | "group_no_certified"
    | "cooldown"
    | "prior_no_show",
    number | string | null
  >
> &
  Record<string, number | string | null | undefined>;

export type SeatType = "RESERVED" | "GENERAL" | "RELAXED" | "OVERRIDE" | "";
export type OverrideOutcome = "SELECTED" | "WAITLISTED" | "NOT_SELECTED" | "CLEAR";

export interface ShortlistEntry {
  entry_id: number;
  nomination_id: number;
  student: TrainingUserRef;
  nominator: TrainingUserRef | null;
  department_key: string;
  department_name: string;
  need_category: NeedCategory;
  justification: string;
  flags: string[];
  ineligible_reasons: string[];
  factors: Record<string, unknown>;
  outcome: string;
  outcome_label: string;
  rank: number | null;
  score_total: number | string | null;
  score_breakdown: ScoreBreakdown | null;
  waitlist_position: number | null;
  seat_type: SeatType;
  note: string | null;
  tie_group: number | string | null;
  lottery_key: string | null;
  overridden: boolean;
  override_outcome: string | null;
  override_reason: string | null;
  nomination_status: NominationStatus;
  appeals: TrainingAppeal[];
}

export interface ShortlistRun {
  id: number;
  call_id: number;
  status: "DRAFT" | "PUBLISHED" | "SUPERSEDED";
  seed: string | null;
  seed_timestamp: string | null;
  seed_public_input: string | null;
  run_at: string | null;
  published_at: string | null;
  appeal_deadline: string | null;
  seats: number;
  caps: TrainingCaps;
  underrepresented_departments: string[];
  department_gaps: Record<string, unknown>;
  weights: Record<string, number>;
  entries: ShortlistEntry[];
}

export interface PublishedResultEntry {
  rank: number | null;
  student_name: string;
  department_name: string;
  score_total: number | string | null;
  outcome: string;
  outcome_label: string;
  waitlist_position: number | null;
  seat_type: SeatType;
  tie_group: number | string | null;
  overridden: boolean;
}

export interface PublishedResults {
  id: number;
  published_at: string;
  appeal_deadline: string | null;
  seed: string | null;
  seed_timestamp: string | null;
  seed_public_input: string | null;
  entries: PublishedResultEntry[];
}

export interface RunVerification {
  reproducible: boolean;
  seed_matches: boolean;
  mismatched_nomination_ids: number[];
}

export interface AppealRow {
  id: number;
  status: string;
  reason: string;
  decision_note: string | null;
  created_at: string;
  decided_at: string | null;
  submitted_by: TrainingUserRef | null;
  decided_by: TrainingUserRef | null;
  call: { id: number; reference: string; title: string; equipment: TrainingEquipmentRef };
  student: TrainingUserRef;
  entry: Partial<ShortlistEntry> | null;
  can_decide: boolean;
}

export type SessionType = "THEORY" | "DEMO" | "HANDS_ON" | "PRACTICE" | "ASSESSMENT";
export type SessionStatus = "PLANNED" | "SCHEDULED" | "COMPLETED" | "CANCELLED";

export interface TrainingSession {
  id: number;
  event_id: number;
  seq: number;
  title: string;
  session_type: SessionType;
  start_at: string;
  end_at: string;
  location: string;
  status: SessionStatus;
  status_label: string;
  slots_reserved: boolean;
  attendance_marked_at: string | null;
}

export interface TrainingEvent {
  id: number;
  title: string;
  kind: string;
  kind_label: string;
  status: string;
  status_label: string;
  equipment: TrainingEquipmentRef;
  level: string;
  capacity: number | null;
  venue: string;
  description: string;
  registration_closes_at: string | null;
  completed_at: string | null;
  cancelled_reason: string | null;
  registrations: number;
  sessions: TrainingSession[];
  registration_status?: string;
}

export interface SessionInput {
  start_at?: string;
  end_at?: string;
  title?: string;
  session_type?: SessionType;
  location?: string;
  notes?: string;
  reserve_slots?: boolean;
}

export type AttendanceStatus = "PRESENT" | "LATE" | "ABSENT" | "EXCUSED";

export interface AttendanceRosterRow {
  registration_id: number;
  user_id: number;
  name: string;
  email: string;
  department: string | null;
  registration_status: string;
  attendance: AttendanceStatus | null;
  remarks: string | null;
}

export interface SessionAttendance {
  session: TrainingSession;
  event: Partial<TrainingEvent>;
  roster: AttendanceRosterRow[];
}

export interface AttendanceSaveResult extends SessionAttendance {
  saved: number;
  awarded_user_ids: number[];
}

export interface AttendanceSessionRow extends TrainingSession {
  event: { id: number; title: string; kind: string; equipment: TrainingEquipmentRef };
  needs_attendance: boolean;
  demo_request_id: number | null;
}

export interface TrainingAward {
  id: number;
  user: TrainingUserRef;
  equipment: TrainingEquipmentRef;
  level: string;
  level_name: string;
  status: string;
  awarded_at: string;
  valid_until: string | null;
  source_event_id: number | null;
}

export interface TrainingBadge {
  code: string;
  name: string;
  color: string;
  icon: string;
  equipment_id: number;
  equipment_code: string;
  equipment_name: string;
  level: string;
  awarded_at: string;
  valid_until: string | null;
}

export interface FacultyStudentTrainings {
  student: TrainingUserRef;
  certifications: TrainingAward[];
  nominations: Array<{
    id: number;
    call_title: string;
    equipment: TrainingEquipmentRef;
    status: NominationStatus;
    status_label: string;
    mine: boolean;
  }>;
  badges: TrainingBadge[];
}

export interface MyTrainings {
  nominations: Nomination[];
  events: TrainingEvent[];
  certifications: TrainingAward[];
  badges: TrainingBadge[];
}

export interface WorkspaceSummary {
  roles: TrainingRoles;
  demo_open: number;
  demo_to_schedule: number;
  calls_open: number;
  calls_to_publish: number;
  appeals_pending: number;
  attendance_due: number;
  certified_active: number;
  can_manage: boolean;
}

export type PolicyScope = "GLOBAL" | "DEPARTMENT" | "EQUIPMENT";

export interface TrainingPolicyFields {
  per_faculty_cap: number | null;
  per_department_pct: number | null;
  reserved_pct: number | null;
  underrepresented_override_department_ids: number[];
  scoring_weights: Record<string, number>;
  cooldown_months: number | null;
  min_tenure_months_after_training: number | null;
  suspension_lookback_months: number | null;
  trained_validity_months: number | null;
  dormancy_months: number | null;
  seat_confirm_hours: number | null;
  appeal_working_days: number | null;
  proposal_expiry_working_days: number | null;
  review_sla_working_days: number | null;
  demo_rate_per_hour: string | null;
  demo_max_minutes: number | null;
  demo_refund_full_days: number | null;
  demo_refund_half_days: number | null;
  notes: string;
}

export interface TrainingPolicy extends TrainingPolicyFields {
  id: number;
  scope: PolicyScope;
  department_id: number | null;
  department_name: string | null;
  equipment: TrainingEquipmentRef | null;
  version: number;
  is_active: boolean;
  published_at: string | null;
  created_by: TrainingUserRef | string | null;
  effective_weights: Record<string, number>;
}

export interface TrainingLevel {
  code: string;
  name: string;
  rank: number;
  is_active: boolean;
  default_validity_months: number | null;
}

export interface TrainingPolicyOverview {
  module_enabled: boolean;
  audience?: TrainingAudience;
  can_manage_module?: boolean;
  pilot_equipment_codes: string[];
  pilot_oic_count: number;
  can_edit_global: boolean;
  department_id: number | null;
  default_weights: Record<string, number>;
  policies: TrainingPolicy[];
  levels: TrainingLevel[];
}

export type PublishPolicyInput = Partial<TrainingPolicyFields> & {
  scope: PolicyScope;
  department_id?: number | null;
  equipment_id?: number | null;
};

export interface ReservationConflict {
  slot_id: number;
  equipment_id?: number | null;
  start: string | null;
  end: string | null;
  status: string;
  booked?: boolean;
  label: string;
}

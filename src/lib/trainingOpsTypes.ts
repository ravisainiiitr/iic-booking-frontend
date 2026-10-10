import type { TrainingAward, TrainingEquipmentRef, TrainingUserRef } from "@/lib/trainingTypes";

/* ---------------------------------------------------------------------------
 * Certification levels, competency checklist and assessments
 * ------------------------------------------------------------------------- */
export interface CertificationLevelInfo {
  code: string;
  name: string;
  rank: number;
  description: string;
  default_validity_months: number | null;
  operator: boolean;
}

export interface ChecklistItem {
  key: string;
  label: string;
  critical: boolean;
}

export interface CompetencyChecklist {
  equipment_id: number | null;
  is_default: boolean;
  items: ChecklistItem[];
  theory_pass_pct: number;
  practical_pass_pct: number;
  updated_at: string | null;
}

export interface PracticalMark {
  key: string;
  passed: boolean;
  label?: string;
  critical?: boolean;
  note?: string;
}

export type AssessmentResult = "PASS" | "RETAKE" | "FAIL";

export interface Assessment {
  id: number;
  user: TrainingUserRef;
  equipment: TrainingEquipmentRef;
  event_id: number | null;
  registration_id: number | null;
  target_level: string;
  target_level_name: string;
  assessor: TrainingUserRef | null;
  theory_score_pct: string | null;
  practical_items: PracticalMark[];
  practical_score_pct: string | null;
  result: AssessmentResult;
  result_label: string;
  scope_note: string;
  remarks: string;
  validity_months: number | null;
  prerequisite_waiver_reason: string;
  award_id: number | null;
  certificate_no: string;
  signed_off_by: TrainingUserRef | null;
  signed_off_at: string | null;
  awaiting_sign_off: boolean;
  assessed_at: string;
}

export interface AssessmentInput {
  equipment_id: number;
  user_id: number;
  target_level: string;
  theory_score_pct?: number | null;
  practical_items: Array<{ key: string; passed: boolean; note?: string }>;
  scope_note?: string;
  remarks?: string;
  validity_months?: number | null;
  prerequisite_waiver_reason?: string;
  registration_id?: number | null;
  issue_award?: boolean;
}

export interface AssessmentCandidate {
  user: TrainingUserRef;
  reasons: string[];
  current_award: TrainingAward | null;
  awaiting_sign_off: boolean;
}

export interface CertificationHistoryRow {
  action: string;
  at: string;
  by: TrainingUserRef | null;
  note: string;
}

export interface CertificationDetail extends TrainingAward {
  can_manage: boolean;
  assessments: Assessment[];
  history: CertificationHistoryRow[];
}

export type CertificationAction = "suspend" | "reinstate" | "revoke" | "renew";

export interface PublicCertificate {
  certificate_no: string;
  holder: string;
  equipment: { code: string; name: string };
  level: { code: string; name: string };
  status: string;
  status_label: string;
  valid: boolean;
  awarded_at: string;
  valid_until: string | null;
  scope: string;
  issuer: string;
}

/* ---------------------------------------------------------------------------
 * Operator roster
 * ------------------------------------------------------------------------- */
export type RosterSource = "AWARD" | "LEGACY_TA" | "MANUAL";
export type RosterStatus = "ACTIVE" | "PAUSED" | "REMOVED";

export interface RosterEntry {
  id: number;
  equipment: TrainingEquipmentRef;
  user: TrainingUserRef;
  source: RosterSource;
  source_label: string;
  status: RosterStatus;
  status_label: string;
  status_reason: string;
  eligible: boolean;
  basis: string;
  award: TrainingAward | null;
  faculty: TrainingUserRef | null;
  department_name: string;
  max_hours_week: number | null;
  note: string;
  created_at: string;
}

/* ---------------------------------------------------------------------------
 * Duty allocation
 * ------------------------------------------------------------------------- */
export type DutyMode = "slots" | "range" | "recurring";

export interface DutyPlanInput {
  equipment_id: number;
  mode: DutyMode;
  slot_ids?: number[];
  date_from?: string;
  date_to?: string;
  time_from?: string;
  time_to?: string;
  weekdays?: number[];
  operator_id?: number | null;
}

export interface DutyCreateInput extends DutyPlanInput {
  operator_id: number;
  requires_confirmation?: boolean;
  confirm_by?: string | null;
  override_reason?: string;
  title?: string;
  note?: string;
}

export interface DutyConflict {
  code: string;
  severity: "block" | "warn";
  message: string;
}

export interface PlannedShift {
  start: string;
  end: string;
  minutes: number;
  slot_ids: number[];
  conflicts: DutyConflict[];
}

export interface FairnessMetrics {
  term_hours: number;
  average_term_hours: number;
  days_since_last_duty: number | null;
  allocations_term: number;
  faculty_hours_share?: number | null;
  faculty_member_share?: number | null;
  department_hours_share?: number | null;
  department_member_share?: number | null;
}

export interface FairnessRow {
  user_id: number;
  roster_entry_id: number;
  name: string;
  email: string;
  faculty_name: string;
  department_name: string;
  source: RosterSource;
  basis: string;
  rank: number | null;
  priority: number | null;
  eligible: boolean;
  blocked: string[];
  hard_blocked: string[];
  reasons: string[];
  breakdown: Record<string, number>;
  metrics: Partial<FairnessMetrics>;
  cooling_until: string | null;
  last_duty_end: string | null;
}

export interface DutyPolicyInputs {
  weights: Record<string, number>;
  max_hours_week: number;
  max_hours_term: number;
  cooling_days: number;
}

export interface DutyPlan {
  equipment_id: number;
  operator_id: number | null;
  shifts: PlannedShift[];
  skipped: Array<{ date: string; reason: string }>;
  total_hours: number;
  blocking: DutyConflict[];
  needs_reason: string[];
  chosen: FairnessRow | null;
  ranking: FairnessRow[];
  term: { label: string; start: string; end: string };
  policy: DutyPolicyInputs;
  requires_confirmation_default: boolean;
  hourly_rate: string;
}

export type DutyStatus = "PENDING" | "CONFIRMED" | "DECLINED" | "EXPIRED" | "CANCELLED" | "COMPLETED";
export type ShiftStatus = "SCHEDULED" | "CHECKED_IN" | "COMPLETED" | "MISSED" | "RELEASED" | "CANCELLED";
export type HoursSource = "CHECKIN" | "BOOKING" | "OIC" | "";

export interface DutyShift {
  id: number;
  allocation_id: number;
  start_at: string;
  end_at: string;
  planned_minutes: number;
  daily_slot_ids: number[];
  status: ShiftStatus;
  status_label: string;
  check_in_at: string | null;
  check_out_at: string | null;
  operated_minutes: number | null;
  hours_source: HoursSource;
  hours_source_label: string;
  verified_by: TrainingUserRef | null;
  verified_at: string | null;
  remarks: string;
}

export interface DutyAllocation {
  id: number;
  reference: string;
  equipment: TrainingEquipmentRef;
  operator: TrainingUserRef;
  status: DutyStatus;
  status_label: string;
  requires_confirmation: boolean;
  confirm_by: string | null;
  responded_at: string | null;
  response_channel: string;
  decline_reason: string;
  reminder_sent_at: string | null;
  escalated_at: string | null;
  title: string;
  note: string;
  suggested_rank: number | null;
  override_reason: string;
  academic_year: string;
  hourly_rate: string;
  planned_minutes: number;
  allocated_by: TrainingUserRef | null;
  created_at: string;
  cancelled_at: string | null;
  cancel_reason: string;
  completed_at: string | null;
  first_start: string | null;
  last_end: string | null;
  operated_minutes: number;
  shift_count: number;
  can_manage: boolean;
  can_respond: boolean;
  shifts?: DutyShift[];
  fairness_snapshot?: {
    generated_at?: string;
    term?: { label: string };
    policy?: DutyPolicyInputs;
    proposal_hours?: number;
    chosen?: FairnessRow;
    ranking?: FairnessRow[];
    needs_reason?: string[];
  };
}

export type ShiftAction = "check-in" | "check-out" | "verify" | "missed";

export interface CalendarSlot {
  id: number;
  start_at: string;
  end_at: string;
  status: string;
  booked: boolean;
}

export interface CalendarShift extends DutyShift {
  operator: TrainingUserRef;
  allocation_status: DutyStatus;
  reference: string;
}

export interface DutyCalendar {
  equipment: TrainingEquipmentRef;
  date_from: string;
  date_to: string;
  slots: CalendarSlot[];
  shifts: CalendarShift[];
}

export interface PublicDuty {
  reference: string;
  equipment: { code: string; name: string };
  operator_name: string;
  status: DutyStatus;
  status_label: string;
  confirm_by: string | null;
  title: string;
  note: string;
  planned_minutes: number;
  shifts: Array<{ start_at: string; end_at: string; status: ShiftStatus }>;
  can_respond: boolean;
}

/* ---------------------------------------------------------------------------
 * Hours accounting
 * ------------------------------------------------------------------------- */
export type AccountingGroup = "operator" | "equipment" | "department" | "faculty" | "month";

export interface HoursFigures {
  allocated_hours: number;
  confirmed_hours: number;
  operated_hours: number;
  pending_hours: number;
  upcoming_hours: number;
  missed_hours: number;
  released_hours: number;
  legacy_ta_hours: number;
  honorarium: string;
  utilisation_pct: number | null;
}

export interface HoursRow extends HoursFigures {
  key: string;
  label: string;
  shifts: number;
  operators: number;
}

export interface HoursSummary {
  period: { label: string; start: string; end: string };
  group_by: AccountingGroup;
  totals: HoursFigures & { operators: number; allocations: number };
  rows: HoursRow[];
}

export interface AccountingQuery {
  group_by?: AccountingGroup;
  academic_year?: string;
  month?: string;
  date_from?: string;
  date_to?: string;
  equipment_id?: number;
  operator_id?: number;
  department_id?: number;
}

export interface ShiftLine {
  shift_id: number;
  allocation_id: number;
  reference: string;
  date: string;
  start: string;
  end: string;
  equipment_id: number;
  equipment_name: string;
  operator_id: number;
  operator_name: string;
  status: ShiftStatus;
  status_label: string;
  allocation_status: DutyStatus;
  planned_hours: number;
  operated_hours: number | null;
  pending: boolean;
  hours_source: HoursSource;
  check_in_at: string | null;
  check_out_at: string | null;
  verified_by: string;
  remarks: string;
  hourly_rate: string;
  amount: string;
  checked_in?: boolean;
}

export interface DutyStatement {
  operator: { id: number; name: string; email: string };
  period: HoursSummary["period"];
  totals: HoursSummary["totals"];
  by_equipment: HoursRow[];
  lines: ShiftLine[];
  legacy_logs: Array<{ id: number; date: string; equipment_name: string; hours: number; remarks: string }>;
}

export interface DutyLive {
  now: string;
  on_duty: ShiftLine[];
  later_today: ShiftLine[];
  pending_verification: ShiftLine[];
  pending_verification_count: number;
  awaiting_confirmation_count: number;
  due_within_24h_count: number;
}

export interface MyDutyShift extends DutyShift {
  equipment: TrainingEquipmentRef;
  reference: string;
  can_check_in: boolean;
  can_check_out: boolean;
}

export interface MyDuty {
  pending: DutyAllocation[];
  active: DutyAllocation[];
  recent: DutyAllocation[];
  upcoming_shifts: MyDutyShift[];
  roster: RosterEntry[];
  hours: HoursSummary;
}

/* ---------------------------------------------------------------------------
 * Operator policy
 * ------------------------------------------------------------------------- */
export interface OperatorPolicyFields {
  selection_cooldown_days: number;
  selection_cooldown_blocks: boolean;
  group_repeat_penalty: number;
  duty_confirmation_required: boolean;
  duty_confirm_hours: number;
  duty_reminder_hours: number;
  duty_max_hours_week: number;
  duty_max_hours_term: number;
  duty_cooling_days: number;
  duty_fairness_weights: Record<string, number>;
  duty_hourly_rate: string;
  expiry_reminder_days: number;
  notes: string;
}

export interface OperatorPolicy extends OperatorPolicyFields {
  id: number | null;
  scope: "GLOBAL" | "DEPARTMENT" | "EQUIPMENT";
  department: { id: number; name: string } | null;
  equipment: TrainingEquipmentRef | null;
  version: number;
  is_active: boolean;
  operator_policy_id?: number | null;
  operator_policy_version?: number;
  published_at: string | null;
  created_by: string | null;
}

export interface OperatorPolicyOverview {
  can_edit_global: boolean;
  department_id: number | null;
  oic_equipment_ids: number[];
  defaults: OperatorPolicy;
  policies: OperatorPolicy[];
  effective: OperatorPolicy | null;
}

export type OperatorPolicyInput = Partial<OperatorPolicyFields> & {
  scope: "GLOBAL" | "DEPARTMENT" | "EQUIPMENT";
  department_id?: number;
  equipment_id?: number;
};

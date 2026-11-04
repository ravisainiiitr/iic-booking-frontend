import type { TrainingAudience, TrainingAward, TrainingEquipmentRef, TrainingUserRef } from "@/lib/trainingTypes";

/** Booking API error code when the equipment needs authorisation the user does not hold. */
export const AUTHORISATION_GATE_CODE = "AUTHORISATION_REQUIRED";
/** Booking API error code when a Beginner books without an eligible supervisor. */
export const SUPERVISION_REQUIRED_CODE = "SUPERVISION_REQUIRED";

/** Beginner / Expert competency stage on a two-level equipment. */
export type CompetencyStage =
  | "NOT_TRAINED"
  | "TRAINING_REQUESTED"
  | "TRAINING_SCHEDULED"
  | "BEGINNER"
  | "ASSESSMENT_PENDING"
  | "EXPERT"
  | "GRACE"
  | "EXPIRED"
  | "SUSPENDED"
  | "REVOKED";

export interface SupervisorOption extends TrainingUserRef {
  role: "Staff" | "Trainer";
}

export type AuthorisationStatusCode =
  | "NOT_REQUIRED"
  | "AUTHORISED"
  | "EXPIRING"
  | "GRACE"
  | "EXPIRED"
  | "SUSPENDED"
  | "REVOKED"
  | "NOT_AUTHORISED";

export type AuthorisationAppliesTo = "INTERNAL" | "ALL";

export type AuthorisationRequestStatus = "PENDING" | "SCHEDULED" | "APPROVED" | "REJECTED" | "WITHDRAWN";

export type AuthorisationRequestKind = "TRAINING" | "ASSESSMENT";

export interface AuthorisationRequestBrief {
  id: number;
  reference: string;
  /** TRAINING (induction) or ASSESSMENT (Expert assessment on a two-level equipment). */
  kind?: AuthorisationRequestKind;
  kind_label?: string;
  status: AuthorisationRequestStatus;
  status_label: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  location: string;
  created_at: string | null;
}

/** One user's authorisation status on one equipment. */
export interface AuthorisationStatus {
  equipment_id: number;
  required: boolean;
  status: AuthorisationStatusCode;
  status_label: string;
  /** May book now (not required, authorised, expiring or allowed on past bookings). */
  allowed: boolean;
  valid_until: string | null;
  award_id: number | null;
  certificate_no: string;
  level_name: string;
  applies_to?: AuthorisationAppliesTo;
  open_request: AuthorisationRequestBrief | null;
  can_request: boolean;
  message: string;
  /** Staff booking for someone else: the gate is bypassed and recorded. */
  staff_bypass?: boolean;
  /** Beginner (supervised) / Expert (independent) levels apply on this equipment. */
  two_level?: boolean;
  stage?: CompetencyStage;
  stage_label?: string;
  independent?: boolean;
  /** Beginner: may book only with a supervisor chosen from ``supervisors``. */
  supervised_only?: boolean;
  beginner_since?: string | null;
  /** Beginner status ends here; induction must then be renewed or repeated. */
  beginner_valid_until?: string | null;
  /** Completed supervised sessions since becoming Beginner, and how many the Expert assessment needs. */
  supervised_sessions_done?: number;
  supervised_sessions_required?: number;
  can_request_assessment?: boolean;
  supervisors?: SupervisorOption[];
}

export interface AuthorisationRequest extends AuthorisationRequestBrief {
  user: TrainingUserRef;
  supervisor: TrainingUserRef | null;
  equipment: TrainingEquipmentRef;
  message: string;
  staff_note: string;
  decision_reason: string;
  decided_by: TrainingUserRef | null;
  decided_at: string | null;
  award_id: number | null;
  /** Staff only: the requester's completed bookings on this equipment in the last 12 months. */
  history: { completed_bookings_12m: number } | null;
  can_handle: boolean;
  can_withdraw: boolean;
}

export type AuthorisationRequestAction = "schedule" | "approve" | "reject" | "withdraw";

export interface AuthorisationSetting {
  equipment: TrainingEquipmentRef;
  required: boolean;
  /** Required, module on and the equipment in Training scope: bookings are checked now. */
  live: boolean;
  module_enabled: boolean;
  in_training_scope: boolean;
  audience: TrainingAudience;
  applies_to: AuthorisationAppliesTo;
  applies_to_choices: Array<{ value: AuthorisationAppliesTo; label: string }>;
  min_level_code: string;
  min_level_name: string;
  validity_months: number;
  grace_completed_bookings: number;
  grace_months: number;
  /** Beginner (supervised) then Expert (independent) levels. */
  competency_levels?: boolean;
  beginner_supervised_allowed?: boolean;
  expert_requires_oic_approval?: boolean;
  /** Supervised sessions a Beginner must complete before asking for the Expert assessment (0 = none). */
  min_supervised_sessions?: number;
  /** How long Beginner status lasts, in months. */
  beginner_validity_months?: number;
  note: string;
  updated_at: string | null;
  updated_by: string | null;
  can_configure?: boolean;
}

export interface ManagedAuthorisationEquipment extends AuthorisationSetting {
  open_requests: number;
  can_configure: boolean;
}

export type AuthorisationSettingInput = Partial<
  Pick<
    AuthorisationSetting,
    | "required"
    | "applies_to"
    | "min_level_code"
    | "validity_months"
    | "grace_completed_bookings"
    | "grace_months"
    | "competency_levels"
    | "beginner_supervised_allowed"
    | "expert_requires_oic_approval"
    | "min_supervised_sessions"
    | "beginner_validity_months"
    | "note"
  >
> & { reason?: string };

export interface AuthorisedUser extends TrainingAward {
  expiring: boolean;
  supervisor: TrainingUserRef | null;
  /** manual, bulk, request, grandfathered, assessment or certificate */
  source: string;
  awarded_by: TrainingUserRef | null;
}

export interface BulkGrantResult {
  granted: number;
  renewed: number;
  skipped: Array<{ user_id: number; reason: string }>;
}

export interface GrandfatherCandidate {
  user: TrainingUserRef;
  completed_bookings: number;
  last_completed: string | null;
  already_authorised: boolean;
}

export interface GrandfatherResult {
  dry_run: boolean;
  min_bookings: number;
  months: number;
  candidates: GrandfatherCandidate[];
  would_authorise: number;
  already_authorised: number;
  granted?: number;
}

export interface MyAuthorisationEquipment extends AuthorisationStatus {
  equipment: TrainingEquipmentRef;
}

export interface SupervisorAuthorisationCell {
  equipment_id: number;
  status: AuthorisationStatusCode;
  status_label: string;
  valid_until: string | null;
  required: boolean;
  open_request: AuthorisationRequestBrief | null;
}

export interface SupervisorAuthorisations {
  equipment: TrainingEquipmentRef[];
  students: Array<{ student: TrainingUserRef; equipment: SupervisorAuthorisationCell[] }>;
}

export interface MyAuthorisations {
  equipment: MyAuthorisationEquipment[];
  certifications: TrainingAward[];
  requests: AuthorisationRequest[];
  supervisor: SupervisorAuthorisations | null;
}

export interface EquipmentTrainerRow {
  id: number;
  user: TrainingUserRef;
  is_active: boolean;
  /** Active and the trainer still holds valid Expert authorisation. */
  valid: boolean;
  authorisation_valid_until: string | null;
  designated_by: string | null;
  designated_at: string | null;
  removed_at: string | null;
  remove_reason: string;
  note: string;
}

export interface EquipmentTrainers {
  results: EquipmentTrainerRow[];
  staff: SupervisorOption[];
  can_configure: boolean;
}

export type SupervisionStatus = "REQUESTED" | "CONFIRMED" | "DECLINED" | "ATTENDED" | "NO_SHOW" | "CANCELLED";
export type SupervisionAction = "confirm" | "decline" | "attended" | "no_show";
export type SupervisionScope = "mine" | "supervising" | "equipment";

export interface SupervisedSession {
  id: number;
  booking_id: number;
  booking_reference: string;
  equipment: TrainingEquipmentRef;
  student: TrainingUserRef;
  supervisor: TrainingUserRef;
  status: SupervisionStatus;
  status_label: string;
  start: string | null;
  end: string | null;
  response_note: string;
  remarks: string;
  recorded_by: string | null;
  recorded_at: string | null;
  can_respond: boolean;
  can_record: boolean;
}

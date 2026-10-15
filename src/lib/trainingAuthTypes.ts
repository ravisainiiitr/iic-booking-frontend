import type { TrainingAudience, TrainingAward, TrainingEquipmentRef, TrainingUserRef } from "@/lib/trainingTypes";

/** Booking API error code when the equipment needs authorisation the user does not hold. */
export const AUTHORISATION_GATE_CODE = "AUTHORISATION_REQUIRED";

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

export interface AuthorisationRequestBrief {
  id: number;
  reference: string;
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
    "required" | "applies_to" | "min_level_code" | "validity_months" | "grace_completed_bookings" | "grace_months" | "note"
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

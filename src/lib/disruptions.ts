/**
 * Disruption log: types, labels and reason categories shared by the slot-status dialogs, the equipment
 * status dialog and the Disruption history page. Reason categories mirror the backend
 * (`iic_booking/equipment/disruption_service.py` REASON_CATEGORIES).
 */

export type DisruptionType = "UNDER_MAINTENANCE" | "OPERATOR_ABSENT" | "SCHEDULED_MAINTENANCE" | "OTHER";

export interface ReasonCategoryOption {
  value: string;
  label: string;
}

export const DISRUPTION_TYPE_LABELS: Record<DisruptionType, string> = {
  UNDER_MAINTENANCE: "Under Maintenance",
  OPERATOR_ABSENT: "Operator Absent",
  SCHEDULED_MAINTENANCE: "Scheduled Maintenance",
  OTHER: "Other Reasons",
};

export const DISRUPTION_REASON_CATEGORIES: Record<DisruptionType, ReasonCategoryOption[]> = {
  UNDER_MAINTENANCE: [
    { value: "BREAKDOWN", label: "Breakdown" },
    { value: "CALIBRATION", label: "Calibration" },
    { value: "CONSUMABLES", label: "Consumables / spares" },
    { value: "UTILITIES", label: "Utilities / power" },
    { value: "SOFTWARE", label: "Software / computer" },
    { value: "OTHER", label: "Other" },
  ],
  SCHEDULED_MAINTENANCE: [
    { value: "PREVENTIVE", label: "Preventive maintenance" },
    { value: "CALIBRATION", label: "Calibration" },
    { value: "AMC_VISIT", label: "AMC / service visit" },
    { value: "UPGRADE", label: "Upgrade / installation" },
    { value: "OTHER", label: "Other" },
  ],
  OPERATOR_ABSENT: [
    { value: "LEAVE", label: "Leave" },
    { value: "TRAINING", label: "Training" },
    { value: "ILLNESS", label: "Illness" },
    { value: "OFFICIAL_DUTY", label: "Official duty" },
    { value: "OTHER", label: "Other" },
  ],
  OTHER: [
    { value: "UTILITIES", label: "Utilities / power" },
    { value: "SAMPLE_ISSUE", label: "Sample / consumable issue" },
    { value: "SAFETY", label: "Safety" },
    { value: "ADMINISTRATIVE", label: "Administrative" },
    { value: "OTHER", label: "Other" },
  ],
};

/** Slot status value → disruption type. Slot statuses not listed here are not disruptions. */
export function disruptionTypeForSlotStatus(status: string | null | undefined): DisruptionType | null {
  switch (String(status || "").toUpperCase()) {
    case "UNDER_MAINTENANCE":
      return "UNDER_MAINTENANCE";
    case "OPERATOR_ABSENT":
      return "OPERATOR_ABSENT";
    case "SCHEDULED_MAINT":
      return "SCHEDULED_MAINTENANCE";
    case "BLOCKED":
      return "OTHER";
    default:
      return null;
  }
}

export const SERVICE_REPORT_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx";
export const SERVICE_REPORT_MAX_MB = 20;

/** Client-side check before upload (the server validates again, including file content). */
export function serviceReportFileError(file: File | null | undefined): string | null {
  if (!file) return null;
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!["pdf", "jpg", "jpeg", "png", "webp", "doc", "docx"].includes(ext)) {
    return "Upload a PDF, image (JPG, PNG, WebP) or Word document.";
  }
  if (file.size <= 0) return "The file is empty.";
  if (file.size > SERVICE_REPORT_MAX_MB * 1024 * 1024) return `The file is larger than ${SERVICE_REPORT_MAX_MB} MB.`;
  return null;
}

/** What the reason / resolution dialogs return; all fields optional. */
export interface DisruptionDialogValues {
  reason: string;
  reasonCategory: string;
  actionTaken: string;
  serviceReport: File | null;
}

export interface DisruptionEventIds {
  opened?: number[];
  extended?: number[];
  closed?: number[];
  resumed?: number[];
}

export interface DisruptionEventBrief {
  id: number;
  disruption_type: DisruptionType;
  scope: "EQUIPMENT" | "SLOTS";
  start_at: string | null;
  end_at: string | null;
  reason: string;
  reason_category: string;
  action_taken: string;
  equipment_id: number;
}

export interface SlotStatusPreview {
  slot_count: number;
  first_start: string | null;
  last_end: string | null;
  dates: string[];
  bookings_affected: number;
  is_disruption: boolean;
  disruption_type: DisruptionType | null;
  reason_categories: ReasonCategoryOption[];
  open_events: DisruptionEventBrief[];
  resumes: boolean;
  skipped_booked: number;
  equipment_id?: number;
  equipment_name?: string;
  new_status?: string;
}

export interface DisruptionServiceReport {
  id: number;
  name: string;
  size_bytes: number;
  uploaded_at: string;
  url: string;
}

export interface DisruptionRecord {
  id: number;
  s_no?: number;
  equipment_id: number;
  equipment_name: string;
  equipment_code: string;
  department_id: number | null;
  department_name: string;
  disruption_type: DisruptionType;
  disruption_type_display: string;
  scope: "EQUIPMENT" | "SLOTS";
  scope_display: string;
  source: string;
  source_display: string;
  start_at: string | null;
  end_at: string | null;
  duration_hours: number;
  slots_affected: number | null;
  bookings_affected: number;
  reason: string;
  reason_category: string;
  reason_category_display: string;
  reason_missing: boolean;
  action_taken: string;
  action_missing: boolean;
  started_at: string | null;
  started_by_name: string;
  ended_at: string | null;
  ended_by_name: string;
  status: "OPEN" | "CLOSED";
  backfilled: boolean;
  service_reports: DisruptionServiceReport[];
}

export interface DisruptionDetail extends DisruptionRecord {
  slots: { start_datetime: string; end_datetime: string; released_at: string | null }[];
  timeline: { kind: string; field: string; old_value: string; new_value: string; note: string; by: string; at: string }[];
  reason_categories: ReasonCategoryOption[];
}

export interface DisruptionSummary {
  total: number;
  total_hours: number;
  open_now: number;
  reason_missing: number;
  by_type: { type: DisruptionType; label: string; count: number; hours: number }[];
}

export interface DisruptionListResponse {
  count: number;
  page: number;
  page_size: number;
  results: DisruptionRecord[];
  types: ReasonCategoryOption[];
  sources: ReasonCategoryOption[];
  reason_categories: Record<string, ReasonCategoryOption[]>;
  can_filter_department: boolean;
  summary?: DisruptionSummary;
}

export interface DisruptionListParams {
  date_from?: string;
  date_to?: string;
  equipment?: string;
  department?: string;
  type?: string;
  status?: string;
  reason_missing?: boolean;
  action_missing?: boolean;
  source?: string;
  search?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
}

export interface DisruptionAttention {
  enabled: boolean;
  open_now: number;
  reason_missing: number;
}

/** Fields the backend reads from slot-status / booking / equipment requests (all optional). */
export function disruptionRequestFields(values: DisruptionDialogValues | null | undefined): {
  disruption_reason?: string;
  disruption_reason_category?: string;
  resolution_action?: string;
} {
  if (!values) return {};
  const out: { disruption_reason?: string; disruption_reason_category?: string; resolution_action?: string } = {};
  if (values.reason.trim()) out.disruption_reason = values.reason.trim();
  if (values.reasonCategory) out.disruption_reason_category = values.reasonCategory;
  if (values.actionTaken.trim()) out.resolution_action = values.actionTaken.trim();
  return out;
}

/** Event ids that a service report uploaded at resume time should be attached to. */
export function resumedEventIds(events: DisruptionEventIds | null | undefined): number[] {
  if (!events) return [];
  const ids = [...(events.closed ?? []), ...(events.resumed ?? [])];
  return [...new Set(ids)];
}

/** Roles that can open the Disruption history page and upload service reports. */
export function canViewDisruptions(userType: string | null | undefined): boolean {
  return ["ADMIN", "MANAGER", "DEPT_ADMIN"].includes(String(userType || "").toUpperCase());
}

export function formatDurationHours(hours: number | null | undefined): string {
  const h = Number(hours || 0);
  if (!Number.isFinite(h) || h <= 0) return "0";
  return h >= 100 ? h.toFixed(0) : h.toFixed(h < 10 ? 2 : 1);
}

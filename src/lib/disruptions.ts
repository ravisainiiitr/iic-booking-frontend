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
  /** `datetime-local` value; "" = recovery date not known. Disrupt mode only. */
  expectedRecovery?: string;
  /** Resume mode: items the service person recommended, raised as a Procurement & Assets request. */
  procurement?: ProcurementRequestDraft | null;
  /** Resume mode: record the repair / service in the equipment's maintenance history. */
  maintenance?: MaintenanceDraft | null;
}

export interface DisruptionRequestFields {
  disruption_reason?: string;
  disruption_reason_category?: string;
  resolution_action?: string;
  expected_recovery_at?: string;
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
  started_by_role?: string;
  started_by_role_display?: string;
  ended_at: string | null;
  ended_by_name: string;
  ended_by_role?: string;
  ended_by_role_display?: string;
  status: "OPEN" | "CLOSED";
  backfilled: boolean;
  service_reports: DisruptionServiceReport[];
  expected_recovery_at?: string | null;
  /** Only while the event is open: UNKNOWN, EXPECTED or DELAYED. */
  recovery_status?: RecoveryStatus | "";
  recovery_text?: string;
  procurement_requests?: DisruptionProcurementLink[];
  /** Present only on rows listed with `show_deleted` (Main Administrator). */
  is_deleted?: boolean;
  deleted_at?: string | null;
  deleted_by_name?: string;
  delete_reason?: string;
}

export interface DisruptionDetail extends DisruptionRecord {
  slots: { start_datetime: string; end_datetime: string; released_at: string | null }[];
  timeline: { kind: string; field: string; old_value: string; new_value: string; note: string; by: string; at: string }[];
  reason_categories: ReasonCategoryOption[];
  procurement?: ProcurementOptions;
}

export type RecoveryStatus = "UNKNOWN" | "EXPECTED" | "DELAYED";

export interface DisruptionProcurementLink {
  id: number;
  number: string;
  status: string;
  status_display: string;
}

/** Whether the OIC can raise a Procurement & Assets request for an equipment (module on for its department). */
export interface ProcurementOptions {
  available: boolean;
  categories: ReasonCategoryOption[];
  reason?: string;
  department_id?: number;
  /** Equipment-linked consumables can be suggested from inventory. */
  inventory_suggestions?: boolean;
  can_record_maintenance?: boolean;
  maintenance_kinds?: ReasonCategoryOption[];
  /** Set by the client: the equipment the options were loaded for. */
  equipment_id?: number;
}

export interface ProcurementItemDraft {
  /** Inventory item master entry when picked from the equipment's linked items. */
  item_id?: number | null;
  name: string;
  quantity: string;
  estimated_cost: string;
  recommended_by_service_person: boolean;
  notes: string;
}

export const EMPTY_PROCUREMENT_ITEM: ProcurementItemDraft = {
  name: "",
  quantity: "1",
  estimated_cost: "",
  recommended_by_service_person: true,
  notes: "",
};

/** Filled in the resume dialog's "Service person recommended items?" step. */
export interface ProcurementRequestDraft {
  category: string;
  items: ProcurementItemDraft[];
  notes: string;
}

/** Body for POST equipments/disruptions/<id>/procurement-request/; null when nothing usable was entered. */
export function procurementRequestBody(draft: ProcurementRequestDraft | null | undefined): {
  category: string;
  notes: string;
  items: ProcurementRequestItemBody[];
} | null {
  if (!draft || !draft.category) return null;
  const items = draft.items
    .filter((i) => i.name.trim())
    .map((i) => ({
      name: i.name.trim(),
      quantity: Number(i.quantity) > 0 ? Number(i.quantity) : 1,
      estimated_cost: Number(i.estimated_cost) >= 0 ? Number(i.estimated_cost) || 0 : 0,
      recommended_by_service_person: i.recommended_by_service_person,
      notes: i.notes.trim(),
      ...(i.item_id ? { item_id: i.item_id } : {}),
    }));
  if (items.length === 0) return null;
  return { category: draft.category, notes: draft.notes.trim(), items };
}

export interface ProcurementRequestItemBody {
  name: string;
  quantity: number;
  estimated_cost: number;
  recommended_by_service_person: boolean;
  notes: string;
  item_id?: number;
}

/** Maintenance history entry recorded while marking equipment back to functional. */
export interface MaintenanceDraft {
  kind: string;
  service_provider: string;
  service_cost: string;
  other_cost: string;
  under_warranty_or_amc: boolean;
  remarks: string;
}

export const EMPTY_MAINTENANCE_DRAFT: MaintenanceDraft = {
  kind: "BREAKDOWN",
  service_provider: "",
  service_cost: "",
  other_cost: "",
  under_warranty_or_amc: false,
  remarks: "",
};

export interface MaintenanceBody {
  kind: string;
  service_provider: string;
  service_cost: string;
  other_cost: string;
  under_warranty_or_amc: boolean;
  remarks: string;
}

/** Downtime, cause and action are copied from the disruption by the server. */
export function maintenanceBody(draft: MaintenanceDraft | null | undefined): MaintenanceBody | null {
  if (!draft || !draft.kind) return null;
  const money = (v: string) => (Number(v) > 0 ? String(Number(v)) : "0");
  return {
    kind: draft.kind,
    service_provider: draft.service_provider.trim(),
    service_cost: money(draft.service_cost),
    other_cost: money(draft.other_cost),
    under_warranty_or_amc: draft.under_warranty_or_amc,
    remarks: draft.remarks.trim(),
  };
}

/** What everyone (including students and signed-out visitors) sees when hovering a disrupted slot. */
export interface PublicDisruptionInfo {
  type: DisruptionType;
  label: string;
  reason: string;
  expected_recovery_at: string | null;
  recovery_status: RecoveryStatus | null;
  recovery_text: string;
}

/** Equipment page / card notice for equipment that is not operational. */
export interface EquipmentDisruptionNotice extends PublicDisruptionInfo {
  since: string | null;
  message: string;
}

export const RECOVERY_UNKNOWN_TEXT = "Recovery date not yet announced";
export const RECOVERY_DELAYED_TEXT = "Recovery delayed — update awaited";

/** "Mon 13 Oct, 10:00" in the browser's time zone (matches the backend wording). */
export function formatRecoveryTime(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const day = d.toLocaleDateString("en-GB", { weekday: "short" });
  const month = d.toLocaleDateString("en-GB", { month: "short" });
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${d.getDate()} ${month}, ${hh}:${mm}`;
}

/** Recovery wording for an open disruption; a passed date reads as delayed (the status never changes on its own). */
export function recoveryWording(expectedAt: string | null | undefined, now: Date = new Date()): string {
  if (!expectedAt) return RECOVERY_UNKNOWN_TEXT;
  const d = new Date(expectedAt);
  if (Number.isNaN(d.getTime())) return RECOVERY_UNKNOWN_TEXT;
  if (d.getTime() <= now.getTime()) return RECOVERY_DELAYED_TEXT;
  return `Expected back: ${formatRecoveryTime(d)}`;
}

/** Hover lines for a disrupted slot: type, reason (or default wording) and expected recovery. */
export function publicDisruptionLines(info: PublicDisruptionInfo | null | undefined): string[] {
  if (!info) return [];
  const lines = [info.label || DISRUPTION_TYPE_LABELS[info.type] || "Not available"];
  if (info.reason) lines.push(info.reason);
  if (info.recovery_text) lines.push(info.recovery_text);
  return lines;
}

/** `datetime-local` value (local time) for an ISO timestamp. */
export function toDateTimeLocal(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** ISO timestamp for a `datetime-local` value; "" when empty (= recovery not known). */
export function fromDateTimeLocal(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

/** "Name (Role)" for the Started by / Ended by columns. */
export function personWithRole(name: string | null | undefined, role: string | null | undefined): string {
  const n = (name || "").trim();
  const r = (role || "").trim();
  if (!n) return r;
  return r ? `${n} (${r})` : n;
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
  can_delete?: boolean;
  can_view_deleted?: boolean;
  show_deleted?: boolean;
  summary?: DisruptionSummary;
  /** Present when requested with `with_options`. */
  equipment_options?: { id: number; name: string; code: string; department_id: number | null }[];
  department_options?: { id: number; name: string }[];
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
  with_options?: boolean;
}

/** Filter state of the Disruption history page; also the export parameters. */
export interface DisruptionFilters {
  date_from: string;
  date_to: string;
  equipment: string;
  department: string;
  type: string;
  status: string;
  source: string;
  reason_missing: boolean;
  action_missing: boolean;
  search: string;
}

export const EMPTY_DISRUPTION_FILTERS: DisruptionFilters = {
  date_from: "",
  date_to: "",
  equipment: "",
  department: "",
  type: "",
  status: "",
  source: "",
  reason_missing: false,
  action_missing: false,
  search: "",
};

/** Query parameters for the list / export: empty values are dropped, booleans become "1". */
export function disruptionFilterParams(filters: DisruptionFilters, ordering?: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value === "" || value === false || value == null) continue;
    out[key] = value === true ? "1" : String(value).trim();
  }
  if (ordering) out.ordering = ordering;
  return out;
}

export function filtersFromSearchParams(params: URLSearchParams): DisruptionFilters {
  const flag = (k: string) => ["1", "true", "yes"].includes(String(params.get(k) || "").toLowerCase());
  return {
    ...EMPTY_DISRUPTION_FILTERS,
    date_from: params.get("date_from") || "",
    date_to: params.get("date_to") || "",
    equipment: params.get("equipment") || "",
    department: params.get("department") || "",
    type: params.get("type") || "",
    status: params.get("status") || "",
    source: params.get("source") || "",
    search: params.get("search") || "",
    reason_missing: flag("reason_missing"),
    action_missing: flag("action_missing"),
  };
}

export interface DisruptionAttention {
  enabled: boolean;
  open_now: number;
  reason_missing: number;
}

/** Fields the backend reads from slot-status / booking / equipment requests (all optional). */
export function disruptionRequestFields(values: DisruptionDialogValues | null | undefined): DisruptionRequestFields {
  if (!values) return {};
  const out: DisruptionRequestFields = {};
  if (values.reason.trim()) out.disruption_reason = values.reason.trim();
  if (values.reasonCategory) out.disruption_reason_category = values.reasonCategory;
  if (values.actionTaken.trim()) out.resolution_action = values.actionTaken.trim();
  const recovery = fromDateTimeLocal(values.expectedRecovery ?? "");
  if (recovery) out.expected_recovery_at = recovery;
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

const BANNER_DISMISS_KEY = "disruption-reason-banner-dismissed";

/** The dashboard "disruptions need a reason" banner stays hidden for the rest of the browser session. */
export function isDisruptionBannerDismissed(): boolean {
  try {
    return window.sessionStorage.getItem(BANNER_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissDisruptionBanner(): void {
  try {
    window.sessionStorage.setItem(BANNER_DISMISS_KEY, "1");
  } catch {
    /* storage unavailable: the banner just comes back on reload */
  }
}

export const DISRUPTIONS_CHANGED_EVENT = "disruptions:changed";

/** Lets the dashboard refresh its "needs a reason" count after a disruption is recorded or edited. */
export function notifyDisruptionsChanged(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(DISRUPTIONS_CHANGED_EVENT));
}

export function formatDurationHours(hours: number | null | undefined): string {
  const h = Number(hours || 0);
  if (!Number.isFinite(h) || h <= 0) return "0";
  return h >= 100 ? h.toFixed(0) : h.toFixed(h < 10 ? 2 : 1);
}

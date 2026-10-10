import { API_BASE_URL, apiClient } from "@/lib/api";

/** Procurement & Assets API (`/api/v1/procurement/`). Errors arrive as `{detail, code, ...extra}`. */
export const PM_BASE = `${API_BASE_URL}/v1/procurement`;

/** Department selected in the Procurement & Assets module (remembered per browser). */
export const PM_DEPT_STORAGE_KEY = "iic:procurement:department";

export function rememberProcurementDepartment(id: number | null | undefined) {
  if (id) window.localStorage.setItem(PM_DEPT_STORAGE_KEY, String(id));
}

export class ProcurementApiError extends Error {
  status: number;
  code: string;
  body: Record<string, unknown>;

  constructor(status: number, body: Record<string, unknown>) {
    super(typeof body.detail === "string" && body.detail ? body.detail : `Request failed (${status})`);
    this.status = status;
    this.code = typeof body.code === "string" ? body.code : "";
    this.body = body;
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

export function pmUrl(path: string, query?: Query): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const s = qs.toString();
  return `${PM_BASE}/${path.replace(/^\/+/, "")}${s ? `?${s}` : ""}`;
}

function authHeaders(): Record<string, string> {
  const token = apiClient.getToken();
  return token ? { Authorization: `Token ${token}` } : {};
}

export async function pmRequest<T>(
  path: string,
  opts: { method?: string; query?: Query; json?: unknown; form?: FormData } = {},
): Promise<T> {
  const headers: Record<string, string> = { ...authHeaders() };
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.json);
  }
  const res = await fetch(pmUrl(path, opts.query), {
    method: opts.method ?? (body ? "POST" : "GET"),
    headers,
    body,
    credentials: "omit",
  });
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new ProcurementApiError(res.status, data);
  return data as T;
}

export const pmGet = <T>(path: string, query?: Query) => pmRequest<T>(path, { query });
export const pmPost = <T>(path: string, json: unknown = {}) => pmRequest<T>(path, { method: "POST", json });
export const pmPatch = <T>(path: string, json: unknown) => pmRequest<T>(path, { method: "PATCH", json });
export const pmForm = <T>(path: string, form: FormData) => pmRequest<T>(path, { method: "POST", form });

/** JSON payload plus files in one multipart call (bills, contracts, mobile capture). */
export function payloadForm(payload: unknown, files: File[] = []): FormData {
  const form = new FormData();
  form.append("payload", JSON.stringify(payload));
  for (const f of files) form.append("files", f);
  return form;
}

/** Authenticated download (documents are private; no public URLs). */
export async function pmDownload(path: string, query?: Query, fallbackName = "download"): Promise<void> {
  const res = await fetch(pmUrl(path, query), { headers: authHeaders(), credentials: "omit" });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    throw new ProcurementApiError(res.status, data);
  }
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") ?? "";
  const match = /filename="?([^";]+)"?/i.exec(cd);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = match?.[1] ?? fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function errorMessage(e: unknown): string {
  if (e instanceof ProcurementApiError) {
    const field = typeof e.body.field === "string" ? ` (${e.body.field})` : "";
    return `${e.message}${field}`;
  }
  return e instanceof Error ? e.message : "Something went wrong.";
}

// ---------------------------------------------------------------------------
// Types (only the fields the UI uses)
// ---------------------------------------------------------------------------
export interface Page<T> {
  count: number;
  page: number;
  page_size: number;
  results: T[];
}

export interface Brief {
  id: number;
  name: string;
  code?: string;
}
export interface UserBrief {
  id: number;
  name: string;
  email: string;
}
export interface LabBrief {
  id: string;
  name: string;
  code: string;
}

export type PmMenus = Partial<
  Record<
    | "dashboard"
    | "my_requests"
    | "requirements"
    | "procurement"
    | "small_purchases"
    | "consumables"
    | "assets"
    | "amc"
    | "approvals"
    | "consolidation"
    | "reports"
    | "configuration"
    | "registers"
    | "register_import"
    | "verification"
    | "maintenance"
    | "accounts"
    | "item_links",
    boolean
  >
>;

export interface PmDepartment {
  department: Brief;
  roles: string[];
  permissions: string[];
  features: Record<string, boolean>;
  small_purchase_threshold: string;
  hod_approval_mode: string;
  menus: PmMenus;
}

export interface PmEquipment extends Brief {
  department_id: number;
  is_oic: boolean;
}

export interface PmBootstrap {
  enabled: boolean;
  can_configure: boolean;
  departments: PmDepartment[];
  menus: PmMenus;
  oic_equipment_ids: number[];
  operator_equipment_ids: number[];
  incharge_equipment_ids?: number[];
  equipment: PmEquipment[];
}

export interface PmCategory {
  id: number;
  code: string;
  name: string;
  nature: string;
  is_asset: boolean;
  tracks_stock: boolean;
  small_purchase_allowed: boolean;
  active: boolean;
}

export interface PmRequestType {
  id: number;
  code: string;
  name: string;
  active: boolean;
  default_nature?: string;
}

export interface PmVendor {
  id: number;
  code: string;
  name: string;
  gstin: string;
  pan: string;
  state: string;
  phone: string;
  email: string;
  active: boolean;
}

export interface PmItem {
  id: number;
  code: string;
  name: string;
  uom: string;
  hsn_sac: string;
  category: { id: number; name: string } | null;
  specification?: string;
  part_number?: string;
  tracks_batch?: boolean;
}

export interface PmGstRate {
  id: number;
  name: string;
  rate: string;
  cgst_rate: string;
  sgst_rate: string;
  igst_rate: string;
  active: boolean;
}

export interface PmDocument {
  id: number;
  doc_type: string;
  original_name: string;
  content_type: string;
  size_bytes: number;
  description: string;
  page_group: string | null;
  page_number: number;
  uploaded_by: UserBrief | null;
  uploaded_at: string;
  download_url: string;
}

export interface PmApprovalAction {
  id: number;
  stage: string;
  action: string;
  from_status: string;
  to_status: string;
  actor: UserBrief | null;
  actor_role: string;
  comments: string;
  amount: string | null;
  is_offline: boolean;
  offline_approver_name: string;
  offline_approver_designation: string;
  offline_approval_date: string | null;
  created_at: string;
}

export interface PmRequestLine {
  id: number;
  item_id: number | null;
  description: string;
  specification: string;
  quantity: string;
  uom: string;
  estimated_unit_price: string;
  gst_rate: string;
  line_total: string;
  issued_quantity: string;
  fulfilment?: "" | "STOCK" | "PROCURE";
  store_note?: string;
  store_original?: Partial<Record<"item_id" | "description" | "quantity" | "uom" | "estimated_unit_price" | "gst_rate", string | number | null>>;
  added_by_stores?: boolean;
}

export interface PmRequest {
  id: number;
  number: string;
  title: string;
  department: Brief;
  laboratory: LabBrief | null;
  equipment: Brief | null;
  request_type: { id: number; code: string; name: string };
  category: { id: number; name: string; nature: string } | null;
  funding_type: string;
  financial_year: string;
  priority: string;
  status: string;
  status_label: string;
  current_stage: string;
  approval_route: string[];
  route_index: number;
  requested_by: UserBrief;
  raised_as_role: string;
  estimated_total: string;
  approved_amount: string | null;
  is_small_purchase: boolean;
  hod_required: boolean;
  last_reason: string;
  submitted_at: string | null;
  created_at: string;
  justification?: string;
  specification?: string;
  lines?: PmRequestLine[];
  documents?: PmDocument[];
  history?: PmApprovalAction[];
  procurement_record_ids?: number[];
  available_actions?: string[];
  stage_entered_at?: string | null;
  stage_age_days?: number | null;
  maintenance_record_id?: number | null;
  disruption_event_id?: number | null;
}

export interface PmInvoice {
  id: number;
  procurement_record_id: number;
  vendor: { id: number; name: string } | null;
  vendor_name: string;
  invoice_number: string;
  invoice_date: string;
  taxable_amount: string;
  cgst_amount: string;
  sgst_amount: string;
  igst_amount: string;
  total_amount: string;
  approved_amount: string | null;
  variance_amount: string;
  variance_percent: string;
  variance_status: string;
  paid_amount: string;
  payment_status: string;
  documents?: PmDocument[];
  forwarded_to_accounts_at?: string | null;
  forwarded_by?: UserBrief | null;
  forward_note?: string;
  procurement_record?: { id: number; number: string; title: string };
}

export interface PmQuotation {
  id: number;
  vendor: { id: number; name: string; gstin: string };
  quotation_reference: string;
  amount: string;
  gst_amount: string;
  total_amount: string;
  compliance: string;
  is_selected: boolean;
}

export interface PmRecord {
  id: number;
  number: string;
  title: string;
  department: Brief;
  equipment: Brief | null;
  purchase_request: { id: number; number: string } | null;
  category: { id: number; name: string; is_asset: boolean } | null;
  origin: string;
  funding_type: string;
  financial_year: string;
  is_small_purchase: boolean;
  status: string;
  required_steps: string[];
  completed_steps: string[];
  approved_amount: string | null;
  po_amount: string | null;
  selected_vendor: { id: number; name: string } | null;
  payment_status: string;
  paid_amount: string;
  created_at: string;
  purchase_mode?: string;
  purchase_mode_reason?: string;
  gem_reference?: string;
  invoices?: PmInvoice[];
  quotations?: PmQuotation[];
  documents?: PmDocument[];
  assets?: { id: number; number: string; description: string; status: string }[];
  blockers?: string[];
  [step: string]: unknown;
}

export interface PmRequirement {
  id: number;
  number: string;
  department: Brief;
  equipment: Brief | null;
  financial_year: string;
  funding_type: string;
  description: string;
  quantity: string;
  uom: string;
  estimated_unit_cost: string;
  estimated_total: string;
  approved_amount: string | null;
  priority: string;
  status: string;
  raised_by: UserBrief;
  added_by_office: boolean;
  proposal_id: number | null;
  original_values?: Record<string, string>;
  changes?: { id: number; change_type: string; field: string; old_value: string; new_value: string; reason: string; changed_by: UserBrief; changed_at: string }[];
}

export interface PmProposal {
  id: number;
  number: string;
  department: Brief;
  financial_year: string;
  funding_type: string;
  title: string;
  status: string;
  total_amount: string;
  approved_amount: string | null;
  created_by: UserBrief;
  created_at: string;
  requirements?: PmRequirement[];
  history?: PmApprovalAction[];
}

export interface PmAsset {
  id: number;
  number: string;
  department: Brief;
  equipment: Brief | null;
  category: { id: number; name: string; nature: string };
  description: string;
  make: string;
  model_number: string;
  serial_number: string;
  asset_tag: string;
  procurement_record: { id: number; number: string } | null;
  vendor: { id: number; name: string } | null;
  purchase_date: string | null;
  cost: string;
  location: string;
  custodian: UserBrief | null;
  status: string;
  status_label: string;
  warranty_until: string | null;
  status_history?: { from_status: string; to_status: string; reason: string; changed_by: UserBrief; changed_at: string }[];
  transfers?: PmTransfer[];
  laboratory?: LabBrief | null;
  funding_type?: string;
  financial_year?: string;
  is_capitalized?: boolean;
  remarks?: string;
  register?: PmRegisterBrief | null;
  register_page?: number | null;
  register_serial?: string;
  register_entry_date?: string | null;
  register_ref?: string;
  legacy_ref?: string;
  parent?: { id: number; number: string; description: string; asset_tag: string } | null;
  quantity?: number;
  supplier_name?: string;
  po_number?: string;
  po_date?: string | null;
  invoice_number?: string;
  invoice_date?: string | null;
  funding_source?: string;
  project_code?: string;
  installation_date?: string | null;
  amc_until?: string | null;
  condition?: string;
  useful_life_years?: number | null;
  depreciation_rate?: string | null;
  last_verified_on?: string | null;
  last_verification_result?: string;
  accessories?: { id: number; number: string; description: string; asset_tag: string; register_ref: string; status: string; cost: string }[];
  verifications?: PmVerification[];
  disposals?: PmDisposal[];
  maintenance_records?: { id: number; number: string; kind: string; downtime_start: string | null; downtime_end: string | null; total_cost: string }[];
  can_verify?: boolean;
  open_campaigns?: { id: number; number: string; title: string }[];
}

export interface PmRegisterBrief {
  id: number;
  code: string;
  name: string;
  register_type: string;
  volume: string;
}

export interface PmRegister extends PmRegisterBrief {
  department: Brief;
  register_type_label: string;
  laboratory: LabBrief | null;
  custodian: UserBrief | null;
  opened_on: string | null;
  closed_on: string | null;
  total_pages: number | null;
  remarks: string;
  active: boolean;
  entry_count: number | null;
  pages_used?: number[];
  next_free?: { page: number; serial: string };
}

export interface PmVerification {
  id: number;
  asset_id: number;
  campaign: { id: number; number: string; title: string } | null;
  verified_on: string;
  verified_by: UserBrief;
  result: string;
  result_label: string;
  condition: string;
  quantity_found: number | null;
  location_seen: string;
  remarks: string;
  method: string;
  asset?: { id: number; number: string; description: string; asset_tag: string; register_ref: string };
}

export interface PmCampaign {
  id: number;
  number: string;
  title: string;
  financial_year: string;
  register: PmRegisterBrief | null;
  laboratory: LabBrief | null;
  committee: string;
  status: string;
  started_on: string;
  closed_on: string | null;
  remarks: string;
  created_by: UserBrief;
  stats: { total?: number; verified?: number; pending?: number; by_result?: Record<string, number> };
}

export interface PmDisposal {
  id: number;
  number: string;
  action: string;
  action_label: string;
  mode: string;
  board_reference: string;
  sanction_reference: string;
  sanction_date: string | null;
  book_value: string | null;
  realised_value: string | null;
  from_status: string;
  to_status: string;
  remarks: string;
  recorded_by: UserBrief;
  recorded_at: string;
}

export interface PmImportRow {
  row: number;
  status: "OK" | "WARNING" | "ERROR" | "DUPLICATE";
  errors: string[];
  warnings: string[];
  duplicate_of: { row?: number; asset_id?: number; asset_number?: string; description?: string } | null;
  register_ref: string;
  description: string;
  asset_tag: string;
  equipment_code: string;
  cost: string;
}

export interface PmImportPreview {
  department_id: number;
  total: number;
  counts: Record<PmImportRow["status"], number>;
  importable: number;
  new_registers: string[];
  rows: PmImportRow[];
}

export interface PmImportResult {
  created: number;
  skipped: number;
  skipped_rows: PmImportRow[];
  registers_created: string[];
}

export interface PmItemLink {
  id: number;
  item: { id: number; code: string; name: string; uom: string; part_number: string };
  equipment: Brief;
  usage: string;
  typical_quantity: string;
  notes: string;
  active: boolean;
}

export interface PmSuggestedLine {
  item_id: number;
  code: string;
  name: string;
  uom: string;
  part_number: string;
  category: { id: number; name: string; nature: string };
  usage: string;
  source: "link" | "legacy";
  typical_quantity: string;
  notes: string;
  central_stock: string;
  lab_stock: string;
  reorder_level: string;
  reorder_due: boolean;
  below_min: boolean;
  available_for_typical: boolean;
  last_unit_price: string | null;
  gst_rate: string | null;
  suggested_quantity: string;
}

export interface PmMaintenance {
  id: number;
  number: string;
  department: Brief;
  equipment: Brief;
  asset: { id: number; number: string; description: string } | null;
  disruption_event_id: number | null;
  kind: string;
  kind_label: string;
  downtime_start: string | null;
  downtime_end: string | null;
  downtime_hours: number | null;
  cause: string;
  action_taken: string;
  vendor: { id: number; name: string } | null;
  service_provider: string;
  service_report_reference: string;
  service_cost: string;
  other_cost: string;
  parts_cost: string;
  total_cost: string;
  under_warranty_or_amc: boolean;
  remarks: string;
  recorded_by: UserBrief;
  created_at: string;
  parts_used?: PmStockTx[];
  requests?: { id: number; number: string; title: string; status: string; estimated_total: string }[];
  can_edit?: boolean;
}

export interface PmEquipmentOverview {
  equipment: Brief;
  department_id: number;
  can_record_maintenance: boolean;
  can_raise_request: boolean;
  assets: PmAsset[];
  maintenance: PmMaintenance[];
  maintenance_totals: { count: number; downtime_hours: number; cost: string };
  open_requests: { id: number; number: string; title: string; status: string; status_label: string; estimated_total: string }[];
}

export interface PmPurchaseModeSuggestion {
  amount: string;
  suggested: string;
  reason: string;
  gem_note: string;
  thresholds: Record<string, string>;
  options: { value: string; label: string }[];
}

export interface PmAgeing {
  buckets: Record<"0-3" | "4-7" | "8-15" | ">15", number>;
  oldest_days: number | null;
}

export interface PmTransfer {
  id: number;
  number: string;
  asset: { id: number; number: string; description: string };
  transfer_type: string;
  status: string;
  to_equipment: Brief | null;
  to_location: string;
  reason: string;
  expected_return_date: string | null;
  requested_by: UserBrief;
  decision_note: string;
  created_at: string;
}

export interface PmStockBalance {
  id: number;
  laboratory: LabBrief | null;
  item: { id: number; code: string; name: string; uom: string };
  quantity: string;
  min_level: string;
  reorder_level: string;
  below_min: boolean;
  reorder_due: boolean;
}

export interface PmStockTx {
  id: number;
  number: string;
  item: { id: number; code: string; name: string; uom: string };
  tx_type: string;
  signed_quantity: string;
  balance_after: string;
  transaction_date: string;
  reference_type: string;
  reference_number: string;
  remarks: string;
  performed_by: UserBrief;
  batch_number?: string;
  expiry_date?: string | null;
  reason_code?: string;
  equipment_id?: number | null;
  maintenance_record_id?: number | null;
}

export interface PmAmc {
  id: number;
  number: string;
  equipment: Brief;
  vendor: { id: number; name: string } | null;
  contract_type: string;
  contract_reference: string;
  start_date: string;
  end_date: string;
  days_left: number;
  total_value: string;
  status: string;
  renewed_from_id: number | null;
}

export interface PmBudgetRow {
  funding_type: string;
  budget: string;
  approved: string;
  committed: string;
  purchased: string;
  paid: string;
  balance: string;
  utilisation_percent: string | null;
}

export interface PmBudgetSummary {
  financial_year: string;
  rows: PmBudgetRow[];
  total: PmBudgetRow;
}

export interface PmDashboard {
  department: Brief;
  financial_year: string;
  roles: string[];
  my_requests: Record<string, number>;
  pending_approvals: number;
  amc_expiring?: number;
  my_requirements?: Record<string, number>;
  requests_by_status?: Record<string, number>;
  records_by_status?: Record<string, number>;
  small_purchases?: { count: number; total: string };
  open_variance?: number;
  unpaid_bills?: { count: number; amount: string };
  requirements_by_status?: Record<string, number>;
  low_stock?: number;
  assets_by_status?: Record<string, number>;
  open_transfers?: number;
  budget?: PmBudgetSummary;
  my_queue_ageing?: PmAgeing;
  pending_ageing?: PmAgeing;
  pending_for_me?: { id: number; number: string; title: string; status: string; status_label: string; stage_age_days: number | null; estimated_total: string }[];
  maintenance?: { this_year: number; open_downtime: number; downtime_hours: number; cost: string };
  registers?: { count: number; by_type: Record<string, number>; entries: number; unregistered: number };
  verification?: { total: number; verified: number; pending: number; discrepancies: number; open_campaigns: number };
  my_assets?: { count: number; not_verified_this_year: number };
  linked_low_stock?: number;
  stores?: { pending_review: number; to_issue: number; bills_to_forward: number };
  accounts?: { bills_pending: number; amount_pending: string; budget_checks_pending: number };
}

export interface PmReport {
  title: string;
  subtitle: string;
  headers: string[];
  rows: (string | number)[][];
  count: number;
}

export interface PmSmallPurchaseCheck {
  eligible: boolean;
  reason: string;
  threshold: string;
}

export interface PmConfig {
  department: Brief;
  module_enabled: boolean;
  pilot_mode: boolean;
  pilot_users: UserBrief[];
  small_purchase_threshold: string;
  hod_approval_threshold: string;
  comparative_quotation_threshold: string;
  variance_tolerance_percent: string;
  variance_action: string;
  hod_approval_mode: string;
  current_financial_year: string;
  amc_reminder_days: number;
  [key: string]: unknown;
}

export interface PmRoleAssignment {
  id: number;
  user: UserBrief;
  role: string;
  permissions: string[];
  equipment_ids?: number[];
  active: boolean;
}

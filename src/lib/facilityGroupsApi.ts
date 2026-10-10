import { API_BASE_URL, apiClient } from "@/lib/api";

/**
 * User groups & group email (Main Administrator): `/api/v1/admin/facility-groups/`.
 * Automatic groups (equipment, category, equipment group, lab, all booking users) fill up from bookings;
 * custom groups are managed by hand. Errors arrive as `{detail, code, field?}`.
 */
export const FG_BASE = `${API_BASE_URL}/v1/admin/facility-groups`;

export type GroupKind = "all" | "lab" | "category" | "equipment_group" | "equipment" | "custom";
export type Audience = "" | "internal" | "external";
export type MemberRole = "booker" | "supervisor" | "manual";
export type CcMode = "summary" | "each";
export type CampaignStatus = "queued" | "sending" | "sent" | "partial" | "failed" | "cancelled";
export type RecipientStatus = "pending" | "sending" | "sent" | "failed" | "skipped";

export interface Option {
  value: string;
  label: string;
}

export interface DepartmentOption {
  id: number;
  name: string;
  code: string | null;
  department_type: "internal" | "external" | string;
}

export interface GroupsOptions {
  departments: DepartmentOption[];
  user_types: Option[];
  all_user_types: Option[];
  kinds: Option[];
  cc_modes: Option[];
  limits: {
    max_recipients: number;
    each_mode_max_recipients: number;
    max_cc: number;
    max_attachments: number;
    max_attachment_mb: number;
    max_total_attachment_mb: number;
  };
}

export interface FacilityGroup {
  id: number;
  name: string;
  kind: GroupKind;
  kind_label: string;
  description: string;
  is_automatic: boolean;
  is_archived: boolean;
  scope: { type: string; id?: number; code?: string };
  member_count: number | null;
  supervisor_count: number | null;
  last_booked_at: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface EquipmentBooked {
  id: number;
  name: string;
  code: string;
  count: number;
}

export interface GroupMember {
  user_id: number;
  name: string;
  email: string;
  mobile: string;
  emp_id: string;
  user_type: string;
  user_type_label: string;
  audience: "internal" | "external";
  department_id: number | null;
  department_name: string;
  department_type: string;
  is_active: boolean;
  role: MemberRole;
  added_manually: boolean;
  booking_count: number;
  supervised_booking_count: number;
  first_booked_at: string | null;
  last_booked_at: string | null;
  last_supervised_at: string | null;
  equipment: EquipmentBooked[];
}

export interface AudienceFilters {
  department_ids: number[];
  user_types: string[];
  audience: Audience;
  booked_from: string;
  booked_to: string;
  include_supervisors: boolean;
  include_inactive: boolean;
  include_test_accounts: boolean;
  search: string;
}

export const EMPTY_FILTERS: AudienceFilters = {
  department_ids: [],
  user_types: [],
  audience: "",
  booked_from: "",
  booked_to: "",
  include_supervisors: false,
  include_inactive: false,
  include_test_accounts: false,
  search: "",
};

export type MemberOrdering =
  | "name"
  | "-name"
  | "last_booked"
  | "-last_booked"
  | "bookings"
  | "-bookings"
  | "department"
  | "-department";

export interface MembersPage {
  group: FacilityGroup;
  count: number;
  page: number;
  page_size: number;
  results: GroupMember[];
}

export interface DepartmentCount {
  department_id: number;
  department_name: string;
  department_type?: string;
  total: number;
  internal: number;
  external: number;
}

export interface DepartmentBreakdown {
  total: number;
  internal: number;
  external: number;
  departments: DepartmentCount[];
}

export interface RecipientRow {
  user_id: number;
  name: string;
  email: string;
  department_id: number | null;
  department_name: string;
  audience: "internal" | "external";
  user_type: string;
  user_type_label: string;
}

export interface RecipientPreview {
  total: number;
  without_email: number;
  internal: number;
  external: number;
  departments: DepartmentCount[];
  recipients: RecipientRow[];
  groups: { id: number; name: string; kind: GroupKind }[];
  max_recipients: number;
}

export interface Campaign {
  id: number;
  subject: string;
  group_names: string[];
  status: CampaignStatus;
  status_label: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
  cc: string[];
  bcc: string[];
  cc_mode: CcMode;
  reply_to: string;
  summary_sent_at: string | null;
  last_error: string;
  created_by: string | null;
  created_at: string | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface CampaignRecipient {
  id: number;
  name: string;
  email: string;
  department_name: string;
  status: RecipientStatus;
  error: string;
  attempts: number;
  sent_at: string | null;
}

export interface CampaignDetail extends Campaign {
  body_html: string;
  filters: Partial<AudienceFilters>;
  groups: { id: number; name: string }[];
  attachments: { id: number; filename: string; size: number; content_type: string }[];
  status_counts: Record<RecipientStatus, number>;
  recipients: { count: number; page: number; page_size: number; results: CampaignRecipient[] };
}

export interface EmailDraft {
  subject: string;
  body_html: string;
  cc: string[];
  bcc: string[];
  cc_mode: CcMode;
  reply_to: string;
}

export interface SendRequest extends EmailDraft {
  group_ids: number[];
  filters: Partial<AudienceFilters>;
  idempotency_key: string;
  expected_recipients?: number;
}

export interface UserHit {
  id: number;
  name: string;
  email: string;
  user_type_label: string;
  department_name: string;
  is_active: boolean;
}

export class FacilityGroupsApiError extends Error {
  status: number;
  code: string;
  field: string;
  body: Record<string, unknown>;

  constructor(status: number, body: Record<string, unknown>) {
    super(typeof body.detail === "string" && body.detail ? body.detail : `Request failed (${status})`);
    this.status = status;
    this.code = typeof body.code === "string" ? body.code : "";
    this.field = typeof body.field === "string" ? body.field : "";
    this.body = body;
  }
}

function authHeaders(): Record<string, string> {
  const token = apiClient.getToken();
  return token ? { Authorization: `Token ${token}` } : {};
}

async function request<T>(url: string, opts: { method?: string; json?: unknown; form?: FormData } = {}): Promise<T> {
  const headers = authHeaders();
  let body: BodyInit | undefined;
  if (opts.form) {
    body = opts.form;
  } else if (opts.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.json);
  }
  const res = await fetch(url, { method: opts.method ?? "GET", headers, body, credentials: "omit" });
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new FacilityGroupsApiError(res.status, data);
  return data as T;
}

/** Only the filters that differ from the defaults, as query parameters (lists comma-joined). */
export function filtersToParams(filters: Partial<AudienceFilters>, extra: Record<string, string | number | undefined> = {}): URLSearchParams {
  const qs = new URLSearchParams();
  const f = { ...EMPTY_FILTERS, ...filters };
  if (f.department_ids.length) qs.set("department_ids", f.department_ids.join(","));
  if (f.user_types.length) qs.set("user_types", f.user_types.join(","));
  if (f.audience) qs.set("audience", f.audience);
  if (f.booked_from) qs.set("booked_from", f.booked_from);
  if (f.booked_to) qs.set("booked_to", f.booked_to);
  if (f.include_supervisors) qs.set("include_supervisors", "true");
  if (f.include_inactive) qs.set("include_inactive", "true");
  if (f.include_test_accounts) qs.set("include_test_accounts", "true");
  if (f.search.trim()) qs.set("search", f.search.trim());
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined && value !== "") qs.set(key, String(value));
  }
  return qs;
}

/** Filters for JSON bodies: empty values dropped so the server applies its defaults. */
export function filtersToJson(filters: Partial<AudienceFilters>): Partial<AudienceFilters> {
  const out: Partial<AudienceFilters> = {};
  const f = { ...EMPTY_FILTERS, ...filters };
  if (f.department_ids.length) out.department_ids = f.department_ids;
  if (f.user_types.length) out.user_types = f.user_types;
  if (f.audience) out.audience = f.audience;
  if (f.booked_from) out.booked_from = f.booked_from;
  if (f.booked_to) out.booked_to = f.booked_to;
  if (f.include_supervisors) out.include_supervisors = true;
  if (f.include_inactive) out.include_inactive = true;
  if (f.include_test_accounts) out.include_test_accounts = true;
  return out;
}

export function activeFilterCount(filters: Partial<AudienceFilters>): number {
  const f = { ...EMPTY_FILTERS, ...filters };
  return (
    (f.department_ids.length ? 1 : 0) +
    (f.user_types.length ? 1 : 0) +
    (f.audience ? 1 : 0) +
    (f.booked_from || f.booked_to ? 1 : 0) +
    (f.include_supervisors ? 1 : 0) +
    (f.include_inactive ? 1 : 0) +
    (f.include_test_accounts ? 1 : 0)
  );
}

const EMAIL_RE = /^[^\s@<>(),;:]+@[^\s@<>(),;:]+\.[^\s@<>(),;:]+$/;

/** Split pasted CC / BCC text (commas, semicolons, spaces or new lines) into unique addresses. */
export function parseAddresses(text: string): { valid: string[]; invalid: string[] } {
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const raw of text.split(/[,;\s]+/)) {
    const addr = raw.trim().replace(/^<|>$/g, "").toLowerCase();
    if (!addr) continue;
    if (!EMAIL_RE.test(addr)) {
      if (!invalid.includes(addr)) invalid.push(addr);
    } else if (!valid.includes(addr)) {
      valid.push(addr);
    }
  }
  return { valid, invalid };
}

export function newIdempotencyKey(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID().replace(/-/g, "");
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`;
}

export function isActiveCampaign(status: CampaignStatus): boolean {
  return status === "queued" || status === "sending";
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function draftForm(payload: object, files: File[]): FormData {
  const form = new FormData();
  form.append("payload", JSON.stringify(payload));
  for (const file of files) form.append("attachments", file, file.name);
  return form;
}

async function download(url: string, fallbackName: string): Promise<void> {
  const res = await fetch(url, { headers: authHeaders(), credentials: "omit" });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    throw new FacilityGroupsApiError(res.status, data);
  }
  const blob = await res.blob();
  const name = res.headers.get("Content-Disposition")?.match(/filename="?([^";]+)"?/i)?.[1] || fallbackName;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export const facilityGroupsApi = {
  options: () => request<GroupsOptions>(`${FG_BASE}/options/`),
  list: (params: { kind?: GroupKind | ""; q?: string; include_archived?: boolean } = {}) => {
    const qs = new URLSearchParams();
    if (params.kind) qs.set("kind", params.kind);
    if (params.q?.trim()) qs.set("q", params.q.trim());
    if (params.include_archived) qs.set("include_archived", "true");
    const s = qs.toString();
    return request<{ results: FacilityGroup[]; kinds: Option[] }>(`${FG_BASE}/${s ? `?${s}` : ""}`);
  },
  create: (body: { name: string; description?: string }) => request<FacilityGroup>(`${FG_BASE}/`, { method: "POST", json: body }),
  update: (id: number, body: Partial<Pick<FacilityGroup, "name" | "description" | "is_archived">>) =>
    request<FacilityGroup>(`${FG_BASE}/${id}/`, { method: "PATCH", json: body }),
  remove: (id: number) => request<{ archived?: boolean; detail?: string } | undefined>(`${FG_BASE}/${id}/`, { method: "DELETE" }),
  members: (id: number, filters: Partial<AudienceFilters>, opts: { page?: number; page_size?: number; ordering?: MemberOrdering } = {}) =>
    request<MembersPage>(`${FG_BASE}/${id}/members/?${filtersToParams(filters, opts).toString()}`),
  departments: (id: number, filters: Partial<AudienceFilters>) =>
    request<DepartmentBreakdown>(`${FG_BASE}/${id}/departments/?${filtersToParams(filters).toString()}`),
  exportMembers: (id: number, filters: Partial<AudienceFilters>) =>
    download(`${FG_BASE}/${id}/members/export/?${filtersToParams(filters).toString()}`, `group-${id}-members.csv`),
  addMembers: (id: number, body: { user_ids?: number[]; filters?: Partial<AudienceFilters>; source_group_ids?: number[] }) =>
    request<{ added: number; already_members: number }>(`${FG_BASE}/${id}/members/add/`, { method: "POST", json: body }),
  removeMembers: (id: number, userIds: number[]) =>
    request<{ removed: number }>(`${FG_BASE}/${id}/members/remove/`, { method: "POST", json: { user_ids: userIds } }),
  searchUsers: (q: string) => request<{ results: UserHit[] }>(`${FG_BASE}/users/search/?q=${encodeURIComponent(q)}`),

  preview: (groupIds: number[], filters: Partial<AudienceFilters>) =>
    request<RecipientPreview>(`${FG_BASE}/email/preview/`, {
      method: "POST",
      json: { group_ids: groupIds, filters: filtersToJson(filters) },
    }),
  render: (draft: Pick<EmailDraft, "subject" | "body_html">) =>
    request<{ subject: string; html: string }>(`${FG_BASE}/email/render/`, { method: "POST", json: draft }),
  sendTest: (draft: EmailDraft, files: File[] = []) =>
    files.length
      ? request<{ sent_to: string }>(`${FG_BASE}/email/test/`, { method: "POST", form: draftForm(draft, files) })
      : request<{ sent_to: string }>(`${FG_BASE}/email/test/`, { method: "POST", json: draft }),
  send: (body: SendRequest, files: File[] = []) =>
    files.length
      ? request<{ campaign: Campaign; created: boolean }>(`${FG_BASE}/email/send/`, { method: "POST", form: draftForm(body, files) })
      : request<{ campaign: Campaign; created: boolean }>(`${FG_BASE}/email/send/`, { method: "POST", json: body }),
  campaigns: (params: { page?: number; status?: CampaignStatus | ""; q?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.status) qs.set("status", params.status);
    if (params.q?.trim()) qs.set("q", params.q.trim());
    const s = qs.toString();
    return request<{ count: number; page: number; page_size: number; results: Campaign[] }>(`${FG_BASE}/email/campaigns/${s ? `?${s}` : ""}`);
  },
  campaign: (id: number, params: { page?: number; status?: RecipientStatus | ""; q?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.status) qs.set("status", params.status);
    if (params.q?.trim()) qs.set("q", params.q.trim());
    const s = qs.toString();
    return request<CampaignDetail>(`${FG_BASE}/email/campaigns/${id}/${s ? `?${s}` : ""}`);
  },
  resume: (id: number, retryFailed = true) =>
    request<Campaign>(`${FG_BASE}/email/campaigns/${id}/resume/`, { method: "POST", json: { retry_failed: retryFailed } }),
  cancel: (id: number) => request<Campaign>(`${FG_BASE}/email/campaigns/${id}/cancel/`, { method: "POST", json: {} }),
};

import { API_BASE_URL, apiClient } from "@/lib/api";

/**
 * Courier tracking / sample arrival: `/api/v1/courier-tracking/`.
 * Errors arrive as `{error, code?, fields?}`; `fields` maps an input name to messages.
 * The courier list is the provider's authoritative list, cached by the server; never invent entries client-side.
 */
// Resolved per request, not at import: the booking card imports this module, and pages that load the card in tests
// mock "@/lib/api" without API_BASE_URL.
const ctBase = () => `${API_BASE_URL}/v1/courier-tracking`;

export type ArrivalMode = "MANUAL" | "COURIER";

export interface Courier {
  slug: string;
  name: string;
}

export interface Checkpoint {
  activity: string;
  state: string;
  status: string;
  courier_name: string;
  date: string;
  time: string;
  location: string;
}

export interface Arrival {
  id: number;
  booking_id: number;
  booking_reference: string;
  booking_status: string;
  equipment: { id: number; name: string; code: string };
  department: { id: number; name: string } | null;
  arrival_mode: ArrivalMode;
  is_active: boolean;
  superseded_at: string | null;
  sample_identifiers: string;
  dispatch_date: string | null;
  expected_arrival_date: string | null;
  notes: string;
  created_at: string;
  courier?: Courier;
  tracking_number?: string;
  email_updates?: boolean;
  status?: string;
  status_label?: string;
  provider_state?: string;
  provider_status_label?: string;
  is_terminal?: boolean;
  delivery_reported?: boolean;
  delivery_reported_at?: string | null;
  delivery_event_at?: string;
  latest_checkpoint?: Checkpoint | null;
  checkpoints?: Checkpoint[] | null;
  last_synced_at?: string | null;
  last_webhook_at?: string | null;
  next_check_at?: string | null;
  needs_attention?: boolean;
  problem?: string;
  receipt_note?: string;
  submitted_by?: { id: number; name: string; email: string };
  lookup_count?: number;
}

export interface ArrivalEligibility {
  may_declare: boolean;
  manual_allowed: boolean;
  courier_allowed: boolean;
  is_external: boolean;
  department_enabled: boolean;
  default_mode: ArrivalMode;
  reasons: string[];
  courier_reason: string;
}

export interface BookingArrival {
  booking_id: number;
  eligibility: ArrivalEligibility;
  active: Arrival | null;
  history: Arrival[];
}

export interface ArrivalInput {
  arrival_mode: ArrivalMode;
  courier_slug?: string;
  tracking_number?: string;
  sample_identifiers?: string;
  dispatch_date?: string | null;
  expected_arrival_date?: string | null;
  notes?: string;
  email_updates?: boolean;
}

export interface QuotaStatus {
  period: string;
  quota: number;
  quota_source: "provider" | "configured";
  used: number;
  local_consumed: number;
  provider_used: number | null;
  in_flight: number;
  remaining: number;
  reserve: number;
  blocked_outcome: string;
  plan: string;
  provider_seen_at: string | null;
  percent: number;
}

export interface CourierSettings {
  monthly_quota_fallback: number;
  safety_reserve: number;
  alert_threshold_percent: number;
  scheduled_interval_hours: number;
  priority_interval_hours: number;
  user_refresh_interval_hours: number;
  user_refresh_daily_limit: number;
  max_lookups_per_shipment: number;
  scheduled_lookups_enabled: boolean;
  arrival_reminder_after_days: number;
  stalled_after_days: number;
  reminder_interval_days: number;
  reminder_max_count: number;
  user_status_emails_enabled: boolean;
  staff_delivery_in_app: boolean;
  catalog_refreshed_at: string | null;
  updated_at: string | null;
}

export interface AdminOverview {
  configured: boolean;
  webhooks_configured: boolean;
  quota: QuotaStatus;
  settings: CourierSettings;
  departments_enabled: number[];
  counts: { active_courier: number; in_flight: number; delivery_reported_unconfirmed: number; manual: number };
  unresolved: Arrival[];
  recent_failures: { at: string; outcome: string; code: string; trigger: string; arrival_id: number | null }[];
  alerts: { id: number; kind: string; message: string; created_at: string; arrival_id: number | null }[];
  webhook_events: Record<string, number>;
  audit: { id: number; created_at: string; department: string; action: string; reason: string; actor: string | null }[];
}

export interface ShipmentPage {
  count: number;
  page: number;
  page_size: number;
  results: Arrival[];
}

export class CourierTrackingApiError extends Error {
  status: number;
  code: string;
  fields: Record<string, string[]>;

  constructor(status: number, body: Record<string, unknown>) {
    super(typeof body.error === "string" && body.error ? body.error : `Request failed (${status})`);
    this.status = status;
    this.code = typeof body.code === "string" ? body.code : "";
    this.fields = (body.fields && typeof body.fields === "object" ? body.fields : {}) as Record<string, string[]>;
  }
}

async function request<T>(url: string, opts: { method?: string; json?: unknown } = {}): Promise<T> {
  const token = apiClient.getToken();
  const headers: Record<string, string> = token ? { Authorization: `Token ${token}` } : {};
  let body: string | undefined;
  if (opts.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.json);
  }
  const res = await fetch(url, { method: opts.method ?? "GET", headers, body, credentials: "omit" });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new CourierTrackingApiError(res.status, data);
  return data as T;
}

export type ShipmentFilters = Partial<
  Record<
    | "view"
    | "q"
    | "department"
    | "equipment"
    | "booking"
    | "user"
    | "courier"
    | "status"
    | "arrival_mode"
    | "sample"
    | "expected_from"
    | "expected_to"
    | "synced_before"
    | "overdue"
    | "include_inactive"
    | "page",
    string
  >
>;

export const courierTrackingApi = {
  couriers: () => request<{ couriers: Courier[]; count: number; fresh: boolean }>(`${ctBase()}/couriers/`),
  bookingArrival: (bookingId: number) => request<BookingArrival>(`${ctBase()}/bookings/${bookingId}/arrival/`),
  declareArrival: (bookingId: number, input: ArrivalInput) =>
    request<{ message: string; arrival: Arrival }>(`${ctBase()}/bookings/${bookingId}/arrival/`, {
      method: "POST",
      json: input,
    }),
  shipments: (filters: ShipmentFilters = {}) => {
    const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v !== undefined && v !== "") as string[][]);
    const s = qs.toString();
    return request<ShipmentPage>(`${ctBase()}/shipments/${s ? `?${s}` : ""}`);
  },
  shipment: (id: number) => request<Arrival>(`${ctBase()}/shipments/${id}/`),
  refresh: async (id: number) => {
    // 429 (checked recently / daily limit) still carries the current record and a message.
    const token = apiClient.getToken();
    const res = await fetch(`${ctBase()}/shipments/${id}/refresh/`, {
      method: "POST",
      headers: token ? { Authorization: `Token ${token}` } : {},
      credentials: "omit",
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok && res.status !== 429) throw new CourierTrackingApiError(res.status, data);
    return data as { arrival: Arrival; checked: boolean; message: string };
  },
  adminOverview: () => request<AdminOverview>(`${ctBase()}/admin/overview/`),
  updateSettings: (changes: Partial<CourierSettings> & { reason: string }) =>
    request<{ settings: CourierSettings; message: string }>(`${ctBase()}/admin/settings/`, {
      method: "PATCH",
      json: changes,
    }),
  resolveAlert: (id: number) => request<{ resolved: boolean }>(`${ctBase()}/admin/alerts/${id}/resolve/`, { method: "POST" }),
  clearBlock: (reason: string) =>
    request<{ cleared: boolean }>(`${ctBase()}/admin/clear-block/`, { method: "POST", json: { reason } }),
  refreshCatalog: () => request<{ refreshed: boolean }>(`${ctBase()}/admin/refresh-catalog/`, { method: "POST" }),
};

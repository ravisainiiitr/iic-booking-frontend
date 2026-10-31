import { API_BASE_URL, apiClient } from "@/lib/api";

/**
 * Sample arrival: `/api/v1/courier-tracking/`. Courier details are entered by hand; there is no automatic tracking.
 * Errors arrive as `{error, code?, fields?}`; `fields` maps an input name to messages.
 * The courier list comes from the server; never invent entries client-side.
 */
// Resolved per request, not at import: the booking card imports this module, and pages that load the card in tests
// mock "@/lib/api" without API_BASE_URL.
const ctBase = () => `${API_BASE_URL}/v1/courier-tracking`;

export type ArrivalMode = "MANUAL" | "COURIER";

export interface Courier {
  slug: string;
  name: string;
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
  receipt_note?: string;
  submitted_by?: { id: number; name: string; email: string };
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
    | "arrival_mode"
    | "sample"
    | "expected_from"
    | "expected_to"
    | "overdue"
    | "include_inactive"
    | "page",
    string
  >
>;

export const courierTrackingApi = {
  couriers: () => request<{ couriers: Courier[]; count: number }>(`${ctBase()}/couriers/`),
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
};

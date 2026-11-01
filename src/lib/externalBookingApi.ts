import { API_BASE_URL, apiClient } from "@/lib/api";

/**
 * External-user services: central external booking window, special booking requests with payment deadlines, GST
 * invoice requests to SRIC, printed copies, sample labels and refunds. The server enforces every rule; this
 * client only reflects what it returns.
 */
/** Base URLs are built when used (not at import), so screens that merely include these components import nothing
 * eagerly from the API module. */
export const extBase = () => `${API_BASE_URL}/v1/external-booking`;
export const extAdminBase = () => `${API_BASE_URL}/v1/admin/external-booking`;

export class ExternalBookingApiError extends Error {
  status: number;
  code: string;
  field: string;
  body: Record<string, unknown>;

  constructor(status: number, body: Record<string, unknown>) {
    const message =
      (typeof body.error === "string" && body.error) ||
      (typeof body.detail === "string" && body.detail) ||
      `Request failed (${status})`;
    super(message);
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
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new ExternalBookingApiError(res.status, data);
  return data as T;
}

/** Fetch a PDF with the user's token and save it (the server never hands out storage URLs). */
async function downloadPdf(url: string, fallbackName: string, opts: { method?: string; json?: unknown } = {}) {
  const headers = authHeaders();
  let body: string | undefined;
  if (opts.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.json);
  }
  const res = await fetch(url, { method: opts.method ?? "GET", headers, body, credentials: "omit" });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    throw new ExternalBookingApiError(res.status, data);
  }
  const blob = await res.blob();
  const name = res.headers.get("Content-Disposition")?.match(/filename="?([^";]+)"?/i)?.[1] || fallbackName;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

// --- window ---------------------------------------------------------------------------------------------------------

export interface ExternalWindow {
  enabled: boolean;
  is_open: boolean;
  first_date: string | null;
  last_date: string | null;
  opens_at: string | null;
  next_expansion_at: string | null;
  next_week_start: string | null;
  next_week_end: string | null;
  timezone: string;
  applies_to_you?: boolean;
  date?: { date: string; open: boolean | null; opens_at: string | null };
}

export interface WindowConfig {
  enabled: boolean;
  initial_open_at: string | null;
  first_week_start: string | null;
  initial_weeks: number;
  auto_expand: boolean;
  expansion_weekday: number;
  expansion_time: string | null;
  materialized_expansions: number;
  counting_from: string | null;
  manual_weeks: number;
  min_lead_days: number;
  updated_at: string | null;
}

export interface WindowRange {
  enabled?: boolean;
  is_open: boolean;
  first_date: string | null;
  last_date: string | null;
  next_expansion_at?: string | null;
}

export interface WindowHistoryEntry {
  id: number;
  action: string;
  action_label: string;
  actor: string | null;
  reason: string;
  range_before: WindowRange;
  range_after: WindowRange;
  created_at: string;
}

export interface WindowAdminPayload {
  config: WindowConfig;
  window: ExternalWindow;
  window_if_enabled: ExternalWindow;
  openings: Array<{ week_start: string; recorded_at: string; slots_prepared_at: string | null; quota_prepared_at: string | null }>;
  history: WindowHistoryEntry[];
}

export type WindowChange = Partial<
  Pick<WindowConfig, "enabled" | "initial_open_at" | "first_week_start" | "initial_weeks" | "auto_expand" | "expansion_weekday" | "expansion_time" | "min_lead_days">
> & { reason: string; confirm_reduction?: boolean };

// --- special requests -----------------------------------------------------------------------------------------------

export interface PolicyTextInfo {
  key: string;
  version: number;
  text: string;
  approved: boolean;
  approval_note: string;
  sha256: string;
}

export interface SpecialPolicy {
  enabled: boolean;
  available_to_you: boolean;
  short_notice_days: number;
  payment_window_hours: number;
  max_open_special_requests: number;
  short_notice_policy: PolicyTextInfo | null;
  notice: string;
}

export interface SpecialAllocationInfo {
  booking_id: number;
  booking_reference: string;
  booking_status: string;
  state: "awaiting_payment" | "paid" | "expired" | "cancelled";
  state_label: string;
  approved_at: string;
  slot_start: string;
  slots: Array<{ start: string; end: string }>;
  payment_deadline_at: string;
  amount: string | null;
  amount_due: string | null;
  short_notice: boolean;
  short_notice_acknowledged_at: string | null;
  paid_at: string | null;
  expired_at: string | null;
  expiry_reason: string;
  late_payment_at: string | null;
}

export interface SpecialRequest {
  id: number;
  status: "PENDING" | "CLARIFICATION" | "APPROVED" | "REJECTED" | "EXPIRED";
  status_label: string;
  equipment: { id: number; name: string; code: string };
  requested_at: string;
  number_of_samples: number;
  required_minutes: number | null;
  required_slots: number;
  estimated_total: string | null;
  estimated_breakdown: Array<{ description: string; amount: number }>;
  input_values: Record<string, unknown>;
  decided_at: string | null;
  decision_note: string;
  preferred_start?: string;
  preferred_end?: string;
  alternatives?: Array<{ start: string; end: string }>;
  sample_description?: string;
  remarks?: string;
  short_notice?: boolean;
  short_notice_acknowledged_at?: string | null;
  clarification_message?: string;
  clarification_requested_at?: string | null;
  clarification_response?: string;
  clarification_responded_at?: string | null;
  withdrawn_at?: string | null;
  allocation?: SpecialAllocationInfo;
  user?: { id: number; name: string; email: string; user_type: string };
  history?: Array<{ action: string; action_label: string; reason: string; actor: string | null; at: string }>;
  warnings?: string[];
}

export interface SpecialRequestInput {
  equipment_id: number;
  input_values: Record<string, unknown>;
  number_of_samples: number;
  preferred_start: string;
  preferred_end: string;
  alternatives: Array<{ start: string; end: string }>;
  sample_description: string;
  remarks: string;
  short_notice_ack_version?: number;
}

export interface SpecialPreview {
  quote: {
    required_minutes: number;
    required_slots: number;
    estimated_total: string;
    gst_percent: number;
    gst_amount: string;
    charge_breakdown: Array<{ description: string; amount: number }>;
    is_estimate: boolean;
  };
  short_notice: boolean;
  short_notice_policy: PolicyTextInfo | null;
  short_notice_days: number;
}

export interface CandidateSlot {
  id: number;
  date: string | null;
  start: string | null;
  end: string | null;
  status: string;
  taken: boolean;
  past: boolean;
  notes: string[];
}

// --- invoices and logistics ------------------------------------------------------------------------------------------

export interface InvoiceStatus {
  booking_id: number;
  enabled: boolean;
  is_external: boolean;
  early_allowed: boolean;
  early_policy: PolicyTextInfo | null;
  preference: { option: "early" | "after_analysis"; label: string; chosen_at: string; acknowledged_at: string | null } | null;
  payment_realised: boolean;
  request: { id: number; status: string; status_label: string; trigger: string; queued_at: string; sent_at: string | null; updated_at: string } | null;
  document: { id: number; invoice_number: string; uploaded_at: string; download_url: string } | null;
  stage: "invoice_available" | "waiting_for_analysis" | "not_requested" | "request_queued" | "with_sric" | "action_required";
  next_step: string;
  provisional_invoice_url: string;
}

export interface PostalAddress {
  id?: number;
  label?: string;
  recipient_name: string;
  organisation?: string;
  line1: string;
  line2?: string;
  city: string;
  district?: string;
  state: string;
  postal_code: string;
  country?: string;
  phone?: string;
  is_default?: boolean;
}

export interface CopyRequest {
  id: number;
  invoice_request_id: number;
  booking_id: number;
  booking_reference: string;
  status: "waiting_invoice" | "requested" | "prepared" | "dispatched" | "cancelled";
  status_label: string;
  address: PostalAddress;
  requested_at: string;
  prepared_at: string | null;
  dispatched_at: string | null;
  dispatch_date: string | null;
  speed_post_reference: string;
  fbr_number?: string;
  events?: Array<{ action: string; detail: string; at: string }>;
}

export interface StaffInvoiceRequest {
  id: number;
  booking_id: number;
  status: string;
  status_label: string;
  trigger: string;
  early_requested: boolean;
  booking_reference: string;
  fbr_number: string;
  billing_name: string;
  user_email: string;
  equipment: string;
  queued_at: string;
  sent_at: string | null;
  attempts: number;
  last_error: string;
  document: { id: number; uploaded_at: string } | null;
}

/** What a scanned sample label shows its holder (no personal details): may courier details still be given? */
export type ScanOutcome ="received_at_office" | "received_at_lab" | "payment_pending" | "awaiting_office" | "details";

/** A scanned label as the server processed it for the signed-in staff member. */
export interface ServicesSettings {
  special_requests_enabled: boolean;
  special_request_surcharge: boolean;
  invoice_requests_enabled: boolean;
  early_invoice_allowed: boolean;
  auto_request_without_preference: boolean;
  physical_copies_enabled: boolean;
  sample_labels_enabled: boolean;
  max_open_special_requests: number;
  short_notice_days: number;
  payment_window_hours: number;
  sric_dispatch_mode: "off" | "test" | "live";
  sric_recipient_email: string;
  sric_test_recipient_email: string;
  iic_postal_address: string;
  cancellation_policy_enabled?: boolean;
  cancellation_free_hours?: number;
  cancellation_half_hours?: number;
  cancellation_half_penalty_percent?: number;
}

export type CheckoutChoice = "full_gateway" | "wallet_plus_gateway" | "full_wallet";
export type CheckoutState = "quoted" | "awaiting_payment" | "confirmed" | "paid_not_confirmed" | "cancelled" | "expired";

export interface CheckoutOption {
  choice: CheckoutChoice;
  label: string;
  wallet_amount: string;
  gateway_amount: string;
  gateway_fee: string;
  gateway_total: string;
  wallet_after: string;
}

export interface BookingCheckout {
  id: string;
  state: CheckoutState;
  state_label: string;
  summary: {
    equipment_id: number;
    equipment_name: string;
    equipment_code: string;
    slots: { start: string; end: string }[];
    number_of_samples: number | string;
    total_time_minutes: number | null;
    charge_breakdown: { description: string; amount: string }[];
    total: string;
  };
  total_amount: string;
  choice: CheckoutChoice | null;
  wallet_amount: string;
  gateway_amount: string;
  /** End of the slot hold (one minute after pay_by: grace for a payment finished a little late). */
  expires_at: string | null;
  /** The deadline shown to the user: 5 minutes after the online payment was chosen. */
  pay_by?: string | null;
  created_at: string | null;
  confirmed_at: string | null;
  slot_held: boolean;
  wallet_balance?: string;
  options?: CheckoutOption[];
  payment?: {
    order_status: string;
    gateway_total: string;
    convenience_fee: string;
    fee_gst: string;
    razorpay_order_id: string;
    razorpay_payment_id: string | null;
    method: string | null;
    paid_at: string | null;
  };
  booking?: { id: number; reference: string; status: string };
  message?: string;
}

export interface CheckoutGatewayOrder {
  order_id: string;
  amount: number;
  currency: string;
  key: string;
  breakup: { base_amount: string; convenience_fee: string; fee_gst: string; total_amount: string };
}

export const externalBookingApi = {
  // booking checkout (payment choice; nothing is held before payment)
  startCheckout: (equipmentId: number, body: Record<string, unknown>) =>
    request<BookingCheckout>(`${extBase()}/checkouts/`, { method: "POST", json: { ...body, equipment_id: equipmentId } }),
  checkout: (id: string) => request<BookingCheckout>(`${extBase()}/checkouts/${encodeURIComponent(id)}/`),
  payCheckout: (id: string, choice: CheckoutChoice) =>
    request<{ checkout: BookingCheckout; order: CheckoutGatewayOrder | null }>(`${extBase()}/checkouts/${encodeURIComponent(id)}/pay/`, {
      method: "POST",
      json: { choice },
    }),
  cancelCheckout: (id: string) =>
    request<BookingCheckout>(`${extBase()}/checkouts/${encodeURIComponent(id)}/cancel/`, { method: "POST", json: {} }),
  // cancellation and refunds (31 Oct 2026 policy)
  cancellationQuote: (bookingId: number) =>
    request<CancellationQuote>(`${extBase()}/bookings/${bookingId}/cancellation-quote/`),
  cancelWithRefund: (
    bookingId: number,
    body: { destination: "wallet" | "bank"; bank_account_id?: number; notes?: string; expected_refund?: string },
  ) =>
    request<{ refund: ExternalRefund; booking_status: string }>(`${extBase()}/bookings/${bookingId}/cancel/`, {
      method: "POST",
      json: body,
    }),
  labFailureQuote: (bookingId: number, portion = 100) =>
    request<LabFailureQuote>(`${extBase()}/bookings/${bookingId}/lab-failure-refund/?portion=${portion}`),
  refundLabFailure: (
    bookingId: number,
    body: { kind: LabFailureKind; reason: string; portion_percent: number; expected_refund: string },
  ) =>
    request<{ refund: ExternalRefund; booking_status: string }>(`${extBase()}/bookings/${bookingId}/lab-failure-refund/`, {
      method: "POST",
      json: body,
    }),
  refundAccounts: () => request<{ accounts: RefundBankAccount[] }>(`${extBase()}/refund-accounts/`),
  addRefundAccount: (body: RefundBankAccountInput) =>
    request<RefundBankAccount>(`${extBase()}/refund-accounts/`, { method: "POST", json: body }),
  myRefunds: () => request<{ refunds: ExternalRefund[] }>(`${extBase()}/refunds/`),
  staffRefunds: (params: { status?: string; q?: string } = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as string[][]).toString();
    return request<{ refunds: ExternalRefund[]; count: number }>(`${extBase()}/staff/refunds/${qs ? `?${qs}` : ""}`);
  },
  closeRefund: (id: number, body: { utr?: string; note?: string }) =>
    request<ExternalRefund>(`${extBase()}/staff/refunds/${id}/close/`, { method: "POST", json: body }),
  // window
  window: (date?: string) => request<ExternalWindow>(`${extBase()}/window/${date ? `?date=${encodeURIComponent(date)}` : ""}`),
  adminWindow: () => request<WindowAdminPayload>(`${extAdminBase()}/window/`),
  updateWindow: (change: WindowChange) => request<WindowAdminPayload>(`${extAdminBase()}/window/`, { method: "PATCH", json: change }),
  previewWindow: (change: Partial<WindowChange>) =>
    request<{ range_before: WindowRange; range_after: WindowRange; range_if_enabled: WindowRange }>(`${extAdminBase()}/window/preview/`, {
      method: "POST",
      json: change,
    }),
  pauseWindow: (reason: string) => request<WindowAdminPayload>(`${extAdminBase()}/window/pause/`, { method: "POST", json: { reason } }),
  resumeWindow: (reason: string) => request<WindowAdminPayload>(`${extAdminBase()}/window/resume/`, { method: "POST", json: { reason } }),
  advanceWindow: (weeks: number, reason: string) =>
    request<WindowAdminPayload>(`${extAdminBase()}/window/advance/`, { method: "POST", json: { weeks, reason } }),
  // settings and wording
  settings: () => request<{ settings: ServicesSettings; policies: Record<string, PolicyTextInfo[]> }>(`${extAdminBase()}/settings/`),
  updateSettings: (change: Partial<ServicesSettings> & { reason: string }) =>
    request<{ settings: ServicesSettings; policies: Record<string, PolicyTextInfo[]> }>(`${extAdminBase()}/settings/`, { method: "PATCH", json: change }),
  addPolicy: (key: string, text: string, approved: boolean, approval_note: string) =>
    request<PolicyTextInfo>(`${extAdminBase()}/policies/`, { method: "POST", json: { key, text, approved, approval_note } }),
  // special requests (user)
  specialPolicy: () => request<SpecialPolicy>(`${extBase()}/special-requests/policy/`),
  previewSpecial: (input: SpecialRequestInput) => request<SpecialPreview>(`${extBase()}/special-requests/preview/`, { method: "POST", json: input }),
  createSpecial: (input: SpecialRequestInput) => request<SpecialRequest>(`${extBase()}/special-requests/`, { method: "POST", json: input }),
  mySpecial: () => request<{ requests: SpecialRequest[] }>(`${extBase()}/special-requests/`),
  special: (id: number) => request<SpecialRequest>(`${extBase()}/special-requests/${id}/`),
  respondSpecial: (id: number, message: string) =>
    request<SpecialRequest>(`${extBase()}/special-requests/${id}/respond/`, { method: "POST", json: { message } }),
  withdrawSpecial: (id: number, reason: string) =>
    request<SpecialRequest>(`${extBase()}/special-requests/${id}/withdraw/`, { method: "POST", json: { reason } }),
  acknowledgeShortNotice: (id: number, version: number) =>
    request<SpecialRequest>(`${extBase()}/special-requests/${id}/acknowledge-short-notice/`, {
      method: "POST",
      json: { short_notice_ack_version: version },
    }),
  downloadSpecialEstimate: (id: number) => downloadPdf(`${extBase()}/special-requests/${id}/provisional-invoice/`, `provisional_estimate_${id}.pdf`),
  // special requests (staff)
  staffSpecial: (status = "") => request<{ requests: SpecialRequest[] }>(`${extBase()}/staff/special-requests/${status ? `?status=${status}` : ""}`),
  staffSpecialDetail: (id: number) => request<SpecialRequest>(`${extBase()}/staff/special-requests/${id}/`),
  clarifySpecial: (id: number, message: string) =>
    request<SpecialRequest>(`${extBase()}/staff/special-requests/${id}/clarify/`, { method: "POST", json: { message } }),
  rejectSpecial: (id: number, reason: string) =>
    request<SpecialRequest>(`${extBase()}/staff/special-requests/${id}/reject/`, { method: "POST", json: { reason } }),
  candidateSlots: (id: number, start: string, days = 7) =>
    request<{ request: SpecialRequest; slots: CandidateSlot[]; required_slots: number }>(
      `${extBase()}/staff/special-requests/${id}/slots/?start=${encodeURIComponent(start)}&days=${days}`,
    ),
  allocateSpecial: (id: number, slotIds: number[], expectedTotal: string | null, note: string) =>
    request<SpecialRequest>(`${extBase()}/staff/special-requests/${id}/allocate/`, {
      method: "POST",
      json: { slot_ids: slotIds, expected_total: expectedTotal, note },
    }),
  // invoices (user)
  invoice: (bookingId: number) => request<InvoiceStatus>(`${extBase()}/bookings/${bookingId}/invoice/`),
  setInvoicePreference: (bookingId: number, option: "early" | "after_analysis", ackVersion?: number) =>
    request<InvoiceStatus>(`${extBase()}/bookings/${bookingId}/invoice/`, {
      method: "POST",
      json: { option, early_invoice_ack_version: ackVersion },
    }),
  requestEarlyInvoice: (bookingId: number) =>
    request<InvoiceStatus>(`${extBase()}/bookings/${bookingId}/invoice/request-early/`, { method: "POST" }),
  downloadProvisional: (bookingId: number) =>
    downloadPdf(`${extBase()}/bookings/${bookingId}/provisional-invoice/`, `provisional_invoice_${bookingId}.pdf`),
  downloadInvoice: (documentId: number) =>
    downloadPdf(`${extBase()}/invoices/documents/${documentId}/download/`, `GST_invoice_${documentId}.pdf`),
  // addresses and copies (user)
  addresses: () =>
    request<{ addresses: PostalAddress[]; last_label_address_id?: number | null; sample_labels_enabled?: boolean }>(`${extBase()}/addresses/`),
  saveAddress: (address: PostalAddress) =>
    address.id
      ? request<PostalAddress>(`${extBase()}/addresses/${address.id}/`, { method: "PATCH", json: address })
      : request<PostalAddress>(`${extBase()}/addresses/`, { method: "POST", json: address }),
  removeAddress: (id: number) => request<{ result: string }>(`${extBase()}/addresses/${id}/`, { method: "DELETE" }),
  requestCopy: (bookingId: number, body: { address_id?: number; address?: PostalAddress; save_address?: boolean }) =>
    request<CopyRequest>(`${extBase()}/bookings/${bookingId}/invoice/copy/`, { method: "POST", json: body }),
  myCopies: () => request<{ copies: CopyRequest[] }>(`${extBase()}/invoice-copies/`),
  cancelCopy: (id: number) => request<CopyRequest>(`${extBase()}/invoice-copies/${id}/cancel/`, { method: "POST" }),
  /** The sample label (no QR code since 31 Oct 2026) as PDF bytes, to be combined with the requisition form. */
  sampleLabelBytes: async (
    bookingId: number,
    body: { sample_count: number; description: string; address_id?: number; sender?: PostalAddress },
  ): Promise<ArrayBuffer> => {
    const headers = authHeaders();
    headers["Content-Type"] = "application/json";
    const res = await fetch(`${extBase()}/bookings/${bookingId}/sample-label/`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      credentials: "omit",
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      throw new ExternalBookingApiError(res.status, data);
    }
    return res.arrayBuffer();
  },
  // accounts in charge
  staffInvoiceRequests: (params: { status?: string; q?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.q) qs.set("q", params.q);
    const s = qs.toString();
    return request<{ requests: StaffInvoiceRequest[] }>(`${extBase()}/staff/invoice-requests/${s ? `?${s}` : ""}`);
  },
  uploadInvoice: (requestId: number, data: { file: File; booking_reference: string; invoice_number: string; replace?: boolean; replacement_reason?: string }) => {
    const form = new FormData();
    form.append("file", data.file, data.file.name);
    form.append("booking_reference", data.booking_reference);
    form.append("invoice_number", data.invoice_number);
    if (data.replace) {
      form.append("replace", "true");
      form.append("replacement_reason", data.replacement_reason ?? "");
    }
    return request<{ document_id: number }>(`${extBase()}/staff/invoice-requests/${requestId}/upload/`, { method: "POST", form });
  },
  resolveInvoiceRequest: (requestId: number, action: "confirm_sent" | "resend", note: string) =>
    request<{ id: number; status: string }>(`${extBase()}/staff/invoice-requests/${requestId}/resolve/`, {
      method: "POST",
      json: { action, note },
    }),
  staffCopies: (status = "") => request<{ copies: CopyRequest[] }>(`${extBase()}/staff/invoice-copies/${status ? `?status=${status}` : ""}`),
  markCopyPrepared: (id: number) => request<CopyRequest>(`${extBase()}/staff/invoice-copies/${id}/prepared/`, { method: "POST" }),
  markCopyDispatched: (id: number, dispatchDate: string, reference: string) =>
    request<CopyRequest>(`${extBase()}/staff/invoice-copies/${id}/dispatched/`, {
      method: "POST",
      json: { dispatch_date: dispatchDate, speed_post_reference: reference },
    }),
  downloadEnvelope: (id: number) => downloadPdf(`${extBase()}/staff/invoice-copies/${id}/envelope/`, `envelope_${id}.pdf`),
};

// --- presentation helpers (pure; unit-tested) -------------------------------------------------------------------------

const IST: Intl.DateTimeFormatOptions = { timeZone: "Asia/Kolkata" };

/** "Mon 9 Nov 2026" for a YYYY-MM-DD date (calendar dates are IST dates; no time-zone shift). */
export function formatDay(isoDate: string | null | undefined): string {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return dt.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** "Wed 28 Oct 2026, 9:00 pm IST" for an instant. */
export function formatInstant(iso: string | null | undefined): string {
  if (!iso) return "";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  const text = dt.toLocaleString("en-IN", {
    ...IST,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return `${text} IST`;
}

/** "Wed, 11 Nov 2026, 9:00 am – 10:00 am" in IST (one slot, start and end on the same day). */
export function formatSlotRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return `${startIso} – ${endIso}`;
  const day = start.toLocaleDateString("en-IN", { ...IST, weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const time = (d: Date) => d.toLocaleTimeString("en-IN", { ...IST, hour: "numeric", minute: "2-digit" });
  return `${day}, ${time(start)} – ${time(end)}`;
}

/** Human summary of the window for an external user. */
export function describeWindow(w: ExternalWindow | null | undefined): string {
  if (!w || !w.enabled) return "";
  if (!w.is_open) {
    return w.opens_at ? `External bookings open on ${formatInstant(w.opens_at)}.` : "External bookings are not open yet.";
  }
  const range = `You can book dates from ${formatDay(w.first_date)} to ${formatDay(w.last_date)}.`;
  if (w.next_expansion_at && w.next_week_start) {
    return `${range} The week of ${formatDay(w.next_week_start)} opens on ${formatInstant(w.next_expansion_at)}.`;
  }
  return range;
}

/** Remaining time until a deadline, e.g. "5 h 12 min left"; "Deadline passed" after it. */
export function timeLeft(deadlineIso: string, now: Date = new Date()): string {
  const ms = new Date(deadlineIso).getTime() - now.getTime();
  if (Number.isNaN(ms)) return "";
  if (ms <= 0) return "Deadline passed";
  const minutes = Math.floor(ms / 60000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days} d ${hours} h left`;
  if (hours > 0) return `${hours} h ${mins} min left`;
  return `${mins} min left`;
}

/** Whether a start time is short notice (fewer than ``days`` x 24 h away). Mirrors the server; the server decides. */
export function isShortNotice(startIso: string, days: number, now: Date = new Date()): boolean {
  const start = new Date(startIso).getTime();
  if (Number.isNaN(start)) return false;
  return start - now.getTime() < days * 24 * 3600 * 1000;
}

/** 31 Oct 2026 cancellation policy: what cancelling now would refund, shown before the user confirms. */
export interface RefundBankAccount {
  id: number;
  account_holder_name: string;
  bank_name: string;
  ifsc: string;
  branch: string;
  /** Masked (XXXX1234) except for the Accounts In Charge. */
  account_number: string;
  is_default: boolean;
  created_at: string | null;
}

export interface RefundBankAccountInput {
  account_holder_name: string;
  bank_name: string;
  account_number: string;
  account_number_confirm: string;
  ifsc: string;
  branch?: string;
}

export type RefundTier = "free" | "half" | "full" | "disruption";

export interface CancellationQuote {
  applies: boolean;
  disruption?: boolean;
  bank_refund_allowed?: boolean;
  tier?: RefundTier;
  penalty_percent?: number;
  paid?: string;
  gst_paid?: string;
  return_shipping?: string;
  refundable_base?: string;
  gst_refunded?: boolean;
  refund_base?: string;
  refund_gst?: string;
  refund?: string;
  /** Return shipping given back when the lab is at fault (base, plus GST only when no invoice was requested). */
  shipping_refunded?: string;
  /** Share of the service charges refunded. */
  portion_percent?: number;
  first_slot_start?: string | null;
  free_until?: string | null;
  half_until?: string | null;
  rules?: { free_hours: number; half_hours: number; half_penalty_percent: number };
  accounts?: RefundBankAccount[];
}

export type LabFailureKind = "equipment_failure" | "analysis_unsuccessful";

/** Refund the lab would make for equipment failure / analysis not possible (server-computed). */
export interface LabFailureQuote {
  paid: string;
  gst_paid: string;
  return_shipping: string;
  refundable_base: string;
  refund_base: string;
  refund_gst: string;
  refund: string;
  gst_refunded: boolean;
  invoice_requested: boolean;
  shipping_refunded: string;
  portion_percent: number;
  /** Service charges refunded, before GST. */
  service_refunded: string;
  tier: string;
  kinds: Record<LabFailureKind, string>;
}

export type RefundStatus = "queued" | "sent" | "failed" | "closed";

export interface ExternalRefund {
  id: number;
  booking_id: number;
  booking_reference: string;
  origin: "cancellation" | "disruption";
  destination: "wallet" | "bank";
  tier: RefundTier;
  penalty_percent: number;
  paid_amount: string;
  return_shipping: string;
  refund_base: string;
  refund_gst: string;
  refund_amount: string;
  gst_refunded: boolean;
  status: RefundStatus;
  status_label: string;
  created_at: string;
  sent_at: string | null;
  closed_at: string | null;
  close_note: string;
  bank: (Partial<RefundBankAccount> & { account_number?: string }) | null;
  user?: { id: number; name: string; email: string };
  equipment?: string;
  utr?: string;
}

/** Indian PIN code check used for inline validation (the server validates again). */
export function isValidIndianPin(pin: string): boolean {
  return /^[1-9][0-9]{5}$/.test(pin.trim());
}

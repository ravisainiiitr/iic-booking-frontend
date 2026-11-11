import { API_BASE_URL, apiClient } from "@/lib/api";

/**
 * Portal GST invoices of facility charges (Dean SRIC proposal, Nov 2026). SANDBOX ONLY on the server: B2B invoices get
 * an IRN from the NIC e-invoice sandbox (or the simulated mock), B2C invoices are signed with an SRIC signatory's DSC
 * on the signatory's own computer (the SRIC Invoice Signer utility). The server enforces every rule.
 */
export const gstBase = () => `${API_BASE_URL}/v1/gst-einvoice`;

export class GstApiError extends Error {
  status: number;
  code: string;
  field: string;

  constructor(status: number, body: Record<string, unknown>) {
    super((typeof body.error === "string" && body.error) || (typeof body.detail === "string" && body.detail) || `Request failed (${status})`);
    this.status = status;
    this.code = typeof body.code === "string" ? body.code : "";
    this.field = typeof body.field === "string" ? body.field : "";
  }
}

function authHeaders(): Record<string, string> {
  const token = apiClient.getToken();
  return token ? { Authorization: `Token ${token}` } : {};
}

async function request<T>(url: string, opts: { method?: string; json?: unknown; form?: FormData } = {}): Promise<T> {
  const headers = authHeaders();
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.json);
  }
  const res = await fetch(url, { method: opts.method ?? "GET", headers, body, credentials: "omit" });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new GstApiError(res.status, data);
  return data as T;
}

async function download(url: string, fallbackName: string) {
  const res = await fetch(url, { headers: authHeaders(), credentials: "omit" });
  if (!res.ok) throw new GstApiError(res.status, (await res.json().catch(() => ({}))) as Record<string, unknown>);
  const blob = await res.blob();
  const name = res.headers.get("Content-Disposition")?.match(/filename="?([^";]+)"?/i)?.[1] || fallbackName;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export type GstInvoiceStatus =
  | "pending_review"
  | "rejected"
  | "submitting"
  | "submission_failed"
  | "submission_uncertain"
  | "irn_generated"
  | "awaiting_signature"
  | "signed";

export interface TaxRule {
  id: number;
  key: string;
  label: string;
  sac_code: string;
  description: string;
  gst_rate: string;
  is_default: boolean;
  illustrative: boolean;
  is_active: boolean;
}

export interface GstStatus {
  enabled: boolean;
  mode: string;
  provider: string;
  provider_label: string;
  simulated: boolean;
  sandbox_host: string;
  problem: string;
  production_available: false;
  credentials_missing?: string[];
  nic_options?: { appkey_bytes: number; client_id_header: string; vital_prefix: string; core_prefix: string };
  can_review: boolean;
  can_administer: boolean;
  is_signatory: boolean;
  settings?: {
    supplier_legal_name: string;
    supplier_gstin: string;
    supplier_pan: string;
    supplier_state_code: string;
    review_above_amount: string;
    auto_issue: boolean;
    approver_emails: string;
  };
  tax_rules?: TaxRule[];
  counts?: Record<GstInvoiceStatus, number>;
}

export interface GstInvoice {
  id: number;
  number: string;
  invoice_number: string;
  invoice_date: string | null;
  status: GstInvoiceStatus;
  status_label: string;
  supply_type: "B2B" | "B2C";
  supply_type_label: string;
  mode: string;
  provider: string;
  simulated: boolean;
  is_demo: boolean;
  review_reasons: string[];
  buyer: {
    name: string;
    gstin: string;
    gstin_status: string;
    gstin_status_label: string;
    state_code: string;
    state: string;
    location: string;
    legal_name?: string;
    trade_name?: string;
    address1?: string;
    address2?: string;
    pincode?: string;
    email?: string;
  };
  booking_id: number | null;
  booking_reference: string;
  fbr_number: string;
  sric_request_id: number | null;
  receipt_number: string;
  equipment: string;
  facility: string;
  place_of_supply: string;
  inter_state: boolean;
  taxable_value: string;
  cgst: string;
  sgst: string;
  igst: string;
  round_off: string;
  total: string;
  portal_total: string | null;
  irn: string;
  ack_number: string;
  ack_date: string | null;
  signed_at: string | null;
  signed_by: string;
  delivered_at: string | null;
  created_at: string;
  has_pdf: boolean;
  has_signed_pdf: boolean;
  pdf_url: string | null;
  lines?: Array<{ sl_no: number; description: string; detail: string; sac_code: string; quantity: string; taxable_value: string; gst_rate: string; cgst: string; sgst: string; igst: string; total: string }>;
  events?: Array<{ action: string; from: string; to: string; by: string; note: string; at: string }>;
  attempts?: Array<{ operation: string; outcome: string; provider: string; simulated: boolean; error_code: string; error_message: string; http_status: number | null; duration_ms: number | null; at: string }>;
  signer_certificate?: { subject: string; fingerprint: string; is_test: boolean } | null;
  pdf_sha256?: string;
  signed_pdf_sha256?: string;
  review_remarks?: string;
}

export interface RegisterRow {
  invoice_number: string;
  invoice_date: string;
  status: GstInvoiceStatus;
  status_label: string;
  supply_type: "B2B" | "B2C";
  buyer: string;
  buyer_gstin: string;
  place_of_supply: string;
  irn: string;
  ack_number: string;
  receipt_number: string;
  booking_reference: string;
  taxable_value: string;
  cgst: string;
  sgst: string;
  igst: string;
  total: string;
  signed_by: string;
  simulated: boolean;
}

export interface GstRegister {
  year: number;
  month: number;
  mode: string;
  rows: RegisterRow[];
  series: Array<{ series: string; from: string; to: string; count: number }>;
  totals: { taxable_value: string; cgst: string; sgst: string; igst: string; total: string };
  counts: { b2b: number; b2c: number; not_yet_issued: number };
}

export interface SignerCertificate {
  id: number;
  user: { id: number; name: string; email: string };
  label: string;
  subject: string;
  issuer: string;
  serial_number: string;
  fingerprint: string;
  not_before: string;
  not_after: string;
  is_test: boolean;
  is_active: boolean;
  registered_at: string;
  deactivation_reason: string;
}

export interface SignerDevice {
  id: number;
  name: string;
  token_hint: string;
  created_at: string;
  last_seen_at: string | null;
  revoked_at: string | null;
  token?: string;
  note?: string;
}

export interface BuyerGstInvoice {
  number: string;
  status: GstInvoiceStatus;
  status_label: string;
  supply_type: "B2B" | "B2C";
  issued: boolean;
  mode: string;
  simulated: boolean;
  invoice_date: string | null;
  irn: string;
  ack_number: string;
  total: string;
  receipt_number: string;
  signed_at: string | null;
  download_url: string | null;
  next_step: string;
}

export interface Gstr1Month {
  fp: string;
  from: string;
  to: string;
  summary: {
    b2c_invoices: number;
    b2cl_invoices: number;
    b2cs_rows: number;
    credit_notes: number;
    credit_notes_available: boolean;
    taxable_value: string;
    tax: string;
    documents_issued: number;
    unsigned_excluded: number;
  };
  warnings: string[];
}

export interface DemoInvoiceInput {
  legal_name: string;
  gstin?: string;
  address1: string;
  location: string;
  pincode: string;
  state_code?: string;
  email?: string;
  amount: string;
  description?: string;
  equipment?: string;
  receipt_number?: string;
  po_number?: string;
  notes?: string;
}

const json = (method: string, body: unknown) => ({ method, json: body });

export const gstEinvoiceApi = {
  status: () => request<GstStatus>(`${gstBase()}/status/`),
  updateSettings: (body: Partial<{ review_above_amount: string; auto_issue: boolean; approver_emails: string }>) =>
    request<{ ok: true }>(`${gstBase()}/settings/`, json("PATCH", body)),
  updateTaxRule: (id: number, body: Partial<{ sac_code: string; gst_rate: string; label: string; description: string }>) =>
    request<{ ok: true }>(`${gstBase()}/tax-rules/${id}/`, json("PATCH", body)),
  invoices: (params: { status?: string; supply?: string; q?: string } = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as string[][]).toString();
    return request<{ results: GstInvoice[] }>(`${gstBase()}/invoices/${qs ? `?${qs}` : ""}`);
  },
  invoice: (id: number) => request<GstInvoice>(`${gstBase()}/invoices/${id}/`),
  createDemo: (body: DemoInvoiceInput) => request<GstInvoice>(`${gstBase()}/invoices/demo/`, json("POST", body)),
  fromRequest: (requestId: number) => request<GstInvoice>(`${gstBase()}/invoices/from-request/${requestId}/`, json("POST", {})),
  approve: (id: number, remarks: string) => request<GstInvoice>(`${gstBase()}/invoices/${id}/approve/`, json("POST", { remarks })),
  reject: (id: number, remarks: string) => request<GstInvoice>(`${gstBase()}/invoices/${id}/reject/`, json("POST", { remarks })),
  submit: (id: number) => request<GstInvoice>(`${gstBase()}/invoices/${id}/submit/`, json("POST", {})),
  checkGstin: (id: number) => request<GstInvoice>(`${gstBase()}/invoices/${id}/check-gstin/`, json("POST", {})),
  updateBuyer: (id: number, body: Record<string, string>) => request<GstInvoice>(`${gstBase()}/invoices/${id}/buyer/`, json("POST", body)),
  downloadPdf: (inv: Pick<GstInvoice, "id" | "number">) =>
    download(`${gstBase()}/invoices/${inv.id}/pdf/`, `tax-invoice-${inv.number.replace(/\//g, "-")}.pdf`),
  register: (month: string) => request<GstRegister>(`${gstBase()}/register/?month=${encodeURIComponent(month)}`),
  downloadRegister: (month: string) => download(`${gstBase()}/register/?month=${encodeURIComponent(month)}&export=csv`, `gst-invoice-register-${month}-sandbox.csv`),
  gstr1Preview: (from: string, to: string) =>
    request<{ months: Gstr1Month[]; b2cl_limit: string }>(`${gstBase()}/gstr1/?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  downloadGstr1: (from: string, to: string, kind: "json" | "xlsx") =>
    download(`${gstBase()}/gstr1/?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&kind=${kind}`, `GSTR1-B2C-${from}-${to}.${kind}`),
  certificates: () => request<{ results: SignerCertificate[] }>(`${gstBase()}/certificates/`),
  registerCertificate: (data: { user_email: string; file: File; label?: string; is_test?: boolean }) => {
    const form = new FormData();
    form.append("user_email", data.user_email);
    form.append("file", data.file);
    if (data.label) form.append("label", data.label);
    if (data.is_test) form.append("is_test", "true");
    return request<SignerCertificate>(`${gstBase()}/certificates/`, { method: "POST", form });
  },
  deactivateCertificate: (id: number, reason: string) =>
    request<SignerCertificate>(`${gstBase()}/certificates/${id}/deactivate/`, json("POST", { reason })),
  devices: () => request<{ results: SignerDevice[] }>(`${gstBase()}/signer/devices/`),
  linkDevice: (name: string) => request<SignerDevice>(`${gstBase()}/signer/devices/`, json("POST", { name })),
  revokeDevice: (id: number) => request<SignerDevice>(`${gstBase()}/signer/devices/${id}/revoke/`, json("POST", {})),
  myBooking: (bookingId: number) =>
    request<{ enabled: boolean; invoice: BuyerGstInvoice | null }>(`${gstBase()}/my/bookings/${bookingId}/`),
};

export function rupees(value: string | number | null | undefined): string {
  const n = Number(value || 0);
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const STATUS_TONE: Record<GstInvoiceStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pending_review: "secondary",
  rejected: "outline",
  submitting: "secondary",
  submission_failed: "destructive",
  submission_uncertain: "destructive",
  irn_generated: "default",
  awaiting_signature: "secondary",
  signed: "default",
};

/** External users: wallet recharge against an offline payment (NEFT/RTGS/IMPS/UPI/DD/cheque) with a receipt. */

export type OfflineRechargeState = "pending" | "approved" | "reconciled" | "mismatch" | "rejected" | "cancelled";

export interface OfflineRechargeAudit {
  action: string;
  from_status: string;
  to_status: string;
  actor: string;
  message: string;
  at: string;
}

export interface OfflineRecharge {
  id: number;
  reference: string;
  state: OfflineRechargeState;
  state_label: string;
  status: string;
  department: { id: number | null; name: string };
  claimed_amount: string;
  approved_amount: string | null;
  payment_date: string;
  payment_mode: string;
  payment_mode_label: string;
  payment_mode_other: string;
  transaction_reference: string;
  payer_bank: string;
  payer_account_name: string;
  paid_into: string;
  remarks: string;
  receipt_url: string | null;
  receipt_name: string;
  decision_note: string;
  decided_at: string | null;
  decided_by: string;
  wallet_transaction_id: number | null;
  reconciliation_status: string;
  reconciled_reference: string;
  reconciled_credit_date: string | null;
  reconciliation_note: string;
  reconciled_at: string | null;
  created_at: string;
  user: { id: number; name: string; email: string; organisation: string };
  can_decide?: boolean;
  can_reconcile?: boolean;
  can_cancel?: boolean;
  audit?: OfflineRechargeAudit[];
}

export interface OfflineRechargeListResponse {
  available: boolean;
  payment_modes: { value: string; label: string }[];
  max_receipt_mb: number;
  requests: OfflineRecharge[];
}

export interface OfflineRechargeQueueResponse {
  role: "main_admin" | "dept_admin" | "accounts";
  state: string;
  counts: Record<"pending" | "approved" | "mismatch" | "reconciled" | "rejected", number>;
  requests: OfflineRecharge[];
}

export const OFFLINE_RECHARGES_ADMIN_PATH = "/admin-settings/offline-recharges";

export const OFFLINE_PAYMENT_MODES: { value: string; label: string }[] = [
  { value: "NEFT", label: "NEFT" },
  { value: "RTGS", label: "RTGS" },
  { value: "IMPS", label: "IMPS" },
  { value: "UPI", label: "UPI" },
  { value: "DD", label: "Demand draft" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "OTHER", label: "Other" },
];

export const RECEIPT_ACCEPT = "application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif";
const RECEIPT_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"];
export const DEFAULT_MAX_RECEIPT_MB = 10;

export const STATE_TONE: Record<OfflineRechargeState, string> = {
  pending: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
  approved: "bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200",
  reconciled: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200",
  mismatch: "bg-orange-100 text-orange-900 dark:bg-orange-950/50 dark:text-orange-200",
  rejected: "bg-rose-100 text-rose-900 dark:bg-rose-950/50 dark:text-rose-200",
  cancelled: "bg-muted text-muted-foreground",
};

export interface OfflineRechargeForm {
  department_id: string;
  amount: string;
  payment_date: string;
  payment_mode: string;
  payment_mode_other: string;
  transaction_reference: string;
  payer_bank: string;
  payer_account_name: string;
  paid_into: string;
  remarks: string;
}

export const EMPTY_FORM: OfflineRechargeForm = {
  department_id: "",
  amount: "",
  payment_date: "",
  payment_mode: "",
  payment_mode_other: "",
  transaction_reference: "",
  payer_bank: "",
  payer_account_name: "",
  paid_into: "",
  remarks: "",
};

export function todayIso(now: Date = new Date()): string {
  const tz = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tz).toISOString().slice(0, 10);
}

export function receiptProblem(file: File | null, maxMb = DEFAULT_MAX_RECEIPT_MB): string | null {
  if (!file) return "Attach the transaction receipt (photo or PDF).";
  const name = file.name.toLowerCase();
  const typeOk = file.type === "application/pdf" || file.type.startsWith("image/");
  const extOk = RECEIPT_EXTENSIONS.some((ext) => name.endsWith(ext));
  if (!typeOk && !extOk) return "The receipt must be a PDF or an image (JPG, PNG, WEBP, HEIC).";
  if (file.size <= 0) return "The receipt file is empty.";
  if (file.size > maxMb * 1024 * 1024) return `The receipt must be ${maxMb} MB or smaller.`;
  return null;
}

/** Field errors before sending; the server checks the same rules again. */
export function validateOfflineRecharge(
  form: OfflineRechargeForm,
  file: File | null,
  opts: { today?: string; maxMb?: number } = {},
): Partial<Record<keyof OfflineRechargeForm | "receipt_file", string>> {
  const errors: Partial<Record<keyof OfflineRechargeForm | "receipt_file", string>> = {};
  const today = opts.today ?? todayIso();
  if (!form.department_id) errors.department_id = "Choose the department to credit.";
  const amount = Number(String(form.amount).replace(/,/g, ""));
  if (!form.amount.trim() || !Number.isFinite(amount) || amount < 1) errors.amount = "Enter the amount you paid.";
  else if (!/^\d+(\.\d{1,2})?$/.test(String(form.amount).replace(/,/g, "").trim()))
    errors.amount = "Use rupees with at most two decimals.";
  if (!form.payment_date) errors.payment_date = "Enter the date of payment.";
  else if (form.payment_date > today) errors.payment_date = "The date of payment cannot be in the future.";
  if (!form.payment_mode) errors.payment_mode = "Choose the payment mode.";
  if (form.payment_mode === "OTHER" && !form.payment_mode_other.trim())
    errors.payment_mode_other = "Say which mode you used.";
  if (form.transaction_reference.replace(/\s+/g, "").length < 4)
    errors.transaction_reference = "Enter the full UTR / transaction reference.";
  if (!form.payer_bank.trim()) errors.payer_bank = "Enter the bank you paid from.";
  if (!form.payer_account_name.trim()) errors.payer_account_name = "Enter the name on the paying account.";
  const receipt = receiptProblem(file, opts.maxMb);
  if (receipt) errors.receipt_file = receipt;
  return errors;
}

export function newClientRequestId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `orc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function buildOfflineRechargeFormData(form: OfflineRechargeForm, file: File, clientRequestId: string): FormData {
  const fd = new FormData();
  (Object.keys(form) as (keyof OfflineRechargeForm)[]).forEach((key) => {
    const value = String(form[key] ?? "").trim();
    if (value) fd.append(key, key === "amount" ? value.replace(/,/g, "") : value);
  });
  fd.append("client_request_id", clientRequestId);
  fd.append("receipt_file", file, file.name);
  return fd;
}

export function formatRupees(value: string | number | null | undefined): string {
  const n = Number(value ?? 0);
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const ACTION_LABELS: Record<string, string> = {
  offline_payment_submitted: "Submitted",
  approved: "Approved and credited",
  offline_payment_amount_changed: "Amount changed on approval",
  rejected: "Rejected",
  cancelled: "Cancelled",
  offline_payment_mismatch: "Mismatch flagged",
  fund_receipt_verified: "Funds confirmed",
  offline_payment_reconciled: "Reconciled",
};

export function auditActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/_/g, " ");
}

export type OfflineRechargeMode = "project_grant" | "direct_cash_deposit";

export type RechargeProject = {
  id: number;
  name: string;
  project_code: string;
  agency: string;
  start_date?: string | null;
  end_date?: string | null;
  is_active: boolean;
  is_expired?: boolean;
};

export type ProjectFormValues = {
  name: string;
  project_code: string;
  agency: string;
  start_date: string;
  end_date: string;
};

export type ProjectFormField = keyof ProjectFormValues;
export type ProjectFormErrors = Partial<Record<ProjectFormField | "form", string>>;

export const EMPTY_PROJECT_FORM: ProjectFormValues = {
  name: "",
  project_code: "",
  agency: "",
  start_date: "",
  end_date: "",
};

export const MIN_OFFLINE_RECHARGE_AMOUNT = 100;
/** Upper bound of the backend amount column (10 digits, 2 decimals). */
export const MAX_RECHARGE_AMOUNT = 99_999_999.99;
export const PROJECT_SEARCH_THRESHOLD = 5;

export const PROJECT_GRANT_UNDERTAKING =
  "I hereby undertake that the project code selected above is correct to the best of my knowledge and that sufficient funds are available under the project to meet the requested recharge amount.";
export const CASH_UNDERTAKING_IITR_STUDENT =
  "I undertake that no project funds are currently available to fund this recharge and that I have sufficient personal funds to meet the requested recharge amount.";
export const CASH_UNDERTAKING_IITR_FACULTY =
  "I undertake that no project funds are currently available to fund this recharge, or that I have already availed the applicable temporary credit facility.";
export const CASH_UNDERTAKING_DEFAULT =
  "This option should be used only when no active project grant is available for funding the requested recharge. Direct Cash Deposit / Bank Transfer should be chosen only in such situations.";

export function cashUndertakingText(userType: unknown, isFaculty: boolean): string {
  if (String(userType ?? "").toLowerCase() === "student") return CASH_UNDERTAKING_IITR_STUDENT;
  if (isFaculty) return CASH_UNDERTAKING_IITR_FACULTY;
  return CASH_UNDERTAKING_DEFAULT;
}

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(value: string | number | null | undefined): string {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(/,/g, ""));
  return inrFormatter.format(Number.isFinite(n) ? n : 0);
}

/** Returns an error message, or null when the amount is acceptable for an offline request. */
export function validateRechargeAmount(raw: string, min = MIN_OFFLINE_RECHARGE_AMOUNT): string | null {
  const value = raw.trim();
  if (!value) return "Enter an amount.";
  if (!/^\d+(\.\d+)?$/.test(value)) return "Enter a valid amount in rupees.";
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return "Amount can have at most 2 decimal places.";
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "Enter a valid amount in rupees.";
  if (n < min) return `Enter an amount of at least ${formatMoney(min).replace(/\.00$/, "")}.`;
  if (n > MAX_RECHARGE_AMOUNT) return `The amount cannot exceed ${formatMoney(MAX_RECHARGE_AMOUNT)}.`;
  return null;
}

/** Projects the backend reports as usable (active flag set server-side and not past end date). */
export function activeRechargeProjects<T extends RechargeProject>(projects: T[]): T[] {
  return projects.filter((p) => p.is_active && !p.is_expired);
}

export function filterProjects<T extends RechargeProject>(projects: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return projects;
  return projects.filter((p) =>
    [p.name, p.project_code, p.agency].some((v) => String(v || "").toLowerCase().includes(q)),
  );
}

export function formatProjectValidity(endDate?: string | null): string {
  if (!endDate) return "No end date";
  const d = new Date(`${endDate.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "No end date";
  return `Valid until ${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;
}

export function validateProjectForm(values: ProjectFormValues): ProjectFormErrors {
  const errors: ProjectFormErrors = {};
  if (!values.name.trim()) errors.name = "Project name is required.";
  if (!values.project_code.trim()) errors.project_code = "Project code is required.";
  if (!values.agency.trim()) errors.agency = "Funding agency is required.";
  if (values.start_date && values.end_date && values.end_date < values.start_date) {
    errors.end_date = "End date cannot be earlier than the start date.";
  }
  return errors;
}

const FIELD_LABELS: Record<ProjectFormField, string> = {
  name: "Project name",
  project_code: "Project code",
  agency: "Funding agency",
  start_date: "Start date",
  end_date: "End date",
};

function firstMessage(value: unknown): string {
  if (Array.isArray(value)) return firstMessage(value[0]);
  return typeof value === "string" ? value.trim() : "";
}

function friendlyFieldMessage(field: ProjectFormField, message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("required") || lower.includes("blank") || lower.includes("may not be null")) {
    return `${FIELD_LABELS[field]} is required.`;
  }
  if (lower.includes("date has wrong format") || lower.includes("valid date")) {
    return `Enter a valid ${FIELD_LABELS[field].toLowerCase()}.`;
  }
  if (lower.includes("no more than")) {
    return `${FIELD_LABELS[field]} is too long.`;
  }
  return message;
}

const GENERIC_PROJECT_ERROR = "The project could not be saved. Please check the details and try again.";

/** Maps an API error response from project creation to inline form errors (never raw server output). */
export function mapProjectApiErrors(res: {
  error?: string;
  status?: number;
  fieldErrors?: Record<string, string[] | string>;
}): ProjectFormErrors {
  const errors: ProjectFormErrors = {};
  const fields = res.fieldErrors || {};
  for (const field of Object.keys(FIELD_LABELS) as ProjectFormField[]) {
    const msg = firstMessage(fields[field]);
    if (msg) errors[field] = friendlyFieldMessage(field, msg);
  }
  const general = firstMessage(fields.non_field_errors);
  if (general) {
    if (/end date/i.test(general)) errors.end_date = "End date cannot be earlier than the start date.";
    else errors.form = general;
  }
  if (Object.keys(errors).length === 0) {
    const status = res.status ?? 0;
    if (status === 403) errors.form = "Only faculty members can add projects.";
    else if (status >= 400 && status < 500 && res.error && !/HTTP error|<|status:/i.test(res.error)) {
      errors.form = res.error;
    } else errors.form = GENERIC_PROJECT_ERROR;
  }
  return errors;
}

export type RechargeFormState = {
  isFaculty: boolean;
  mode: OfflineRechargeMode;
  departmentId: number | null;
  amount: string;
  projectId: number | null;
  undertakingAccepted: boolean;
};

export function rechargeFormBlocker(state: RechargeFormState): string | null {
  if (state.mode === "project_grant") {
    if (!state.isFaculty) return "Project Grant recharge is available only to faculty.";
    if (!state.projectId) return "Select a project.";
  }
  if (!state.departmentId) return "Select the department sub-wallet to credit.";
  const amountError = validateRechargeAmount(state.amount);
  if (amountError) return amountError;
  if (!state.undertakingAccepted) return "Accept the undertaking to continue.";
  return null;
}

export function canSendRechargeOtp(state: RechargeFormState): boolean {
  return rechargeFormBlocker(state) === null;
}

export function isProjectFormDirty(values: ProjectFormValues): boolean {
  return Object.values(values).some((v) => v.trim() !== "");
}

export type RechargeDraftSnapshot = {
  amount: string;
  projectId: number | null;
  undertakingAccepted: boolean;
  projectForm: ProjectFormValues | null;
  otpStep: "form" | "otp" | "sric" | "done";
  receiptSelected: boolean;
};

/** True when closing would lose something the user typed or chose. */
export function isRechargeDraftDirty(s: RechargeDraftSnapshot): boolean {
  if (s.otpStep === "done" || s.otpStep === "sric") return false;
  if (s.otpStep === "otp") return true;
  return Boolean(
    s.amount.trim() ||
      s.projectId ||
      s.undertakingAccepted ||
      s.receiptSelected ||
      (s.projectForm && isProjectFormDirty(s.projectForm)),
  );
}

export function rechargeModeLabel(mode: string | null | undefined): string {
  const m = String(mode || "").toLowerCase();
  if (m === "project_grant") return "Project Grant";
  if (m === "direct_cash_deposit") return "Cash / Bank transfer";
  if (m) return m.replace(/_/g, " ");
  return "—";
}

export type RechargeRequestLike = {
  status: string;
  user_otp_verified?: boolean;
  cancellation_source?: string | null;
  decline_credit_outstanding?: string | number | null;
  wallet_credit_pending?: boolean | null;
};

export function isSricDeclined(r: { status?: string; cancellation_source?: string | null }): boolean {
  return String(r.status || "").toUpperCase() === "CANCELLED" && r.cancellation_source === "sric_declined";
}

/** Approved by SRIC while a credit was running: wallet is credited only after the SRIC fund receipt. */
export function isAwaitingFundReceipt(r: { status?: string; wallet_credit_pending?: boolean | null }): boolean {
  return String(r.status || "").toUpperCase() === "APPROVED" && Boolean(r.wallet_credit_pending);
}

export type SricDeclineOutcome = "credit_outstanding" | "credit_recovered" | "no_new_credit";

export function sricDeclineOutcome(r: {
  decline_credit_amount?: string | number | null;
  decline_credit_outstanding?: string | number | null;
}): SricDeclineOutcome {
  if (!(Number(r.decline_credit_amount || 0) > 0)) return "no_new_credit";
  return Number(r.decline_credit_outstanding || 0) > 0 ? "credit_outstanding" : "credit_recovered";
}

export const DECLINE_REASON_LABELS: Record<string, string> = {
  wrong_project_grant: "Wrong Project Code",
  insufficient_balance: "Insufficient Funds in the Project",
  mismatch_user_info: "Mismatch in User Information",
  other: "Other",
};

export function summarizeRechargeRequests(requests: RechargeRequestLike[]) {
  const summary = {
    pending: 0,
    approved: 0,
    rejected: 0,
    awaitingOtp: 0,
    declinedToCredit: 0,
    creditOutstanding: 0,
    awaitingFunds: 0,
  };
  for (const r of requests) {
    const status = String(r.status || "").toUpperCase();
    if (status === "PENDING") {
      if (r.user_otp_verified === false) summary.awaitingOtp += 1;
      else summary.pending += 1;
    } else if (status === "APPROVED") {
      summary.approved += 1;
      if (isAwaitingFundReceipt(r)) summary.awaitingFunds += 1;
    }
    else if (status === "REJECTED") summary.rejected += 1;
    else if (isSricDeclined(r)) summary.declinedToCredit += 1;
    const outstanding = Number(r.decline_credit_outstanding || 0);
    if (Number.isFinite(outstanding) && outstanding > 0) summary.creditOutstanding += outstanding;
  }
  summary.creditOutstanding = Math.round(summary.creditOutstanding * 100) / 100;
  return summary;
}

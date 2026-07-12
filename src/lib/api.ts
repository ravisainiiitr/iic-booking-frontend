import { type BookingRef } from "@/lib/bookingRef";

// API client for Django REST API
// Support runtime configuration via window.__RUNTIME_CONFIG__ (for Docker/production)
// Falls back to VITE_API_URL env var (for build-time) or default
const getApiBaseUrl = (): string => {
  // Check for runtime config (injected by Docker entrypoint)
  if (typeof window !== 'undefined' && (window as any).__RUNTIME_CONFIG__?.VITE_API_URL) {
    return (window as any).__RUNTIME_CONFIG__.VITE_API_URL;
  }
  // Check for build-time env var
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // In browser (e.g. Vite dev): use relative /api so the dev server proxy is used (avoids CORS and "Failed to fetch")
  if (typeof window !== 'undefined') {
    return '/api';
  }
  return 'http://127.0.0.1:8000/api';
};

const API_BASE_URL = getApiBaseUrl();

export interface PrintMaterial {
  id: number;
  code: string;
  name: string;
  density_g_per_cm3: string;
  price_per_gram: string;
  user_type?: string | null;
  is_active: boolean;
  display_order: number;
}

export interface PrintAnalysisResult {
  id: string;
  batch_id?: string | null;
  sequence?: number;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  analysis_method?: string;
  weight_grams?: string | number | null;
  actual_weight_grams?: string | number | null;
  volume_cm3?: string | number | null;
  estimated_time_minutes?: number | null;
  actual_time_minutes?: number | null;
  bounding_box?: Record<string, unknown>;
  warnings?: string[];
  error_message?: string;
  material_code_snapshot?: string;
  price_per_gram_snapshot?: string | number | null;
  material_name?: string;
  stl_filename?: string;
  stl_download_url?: string | null;
  cancelled_at?: string | null;
  slicer_settings?: {
    layer_height_mm?: number;
    infill_percent?: number;
    density_percent?: number;
    [key: string]: unknown;
  };
}

export interface PrintAnalysisBatchResult {
  id: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "PARTIAL";
  original_filename?: string;
  slicer_settings?: PrintAnalysisResult["slicer_settings"];
  error_message?: string;
  items: PrintAnalysisResult[];
  total_weight_grams?: number;
  total_estimated_time_minutes?: number;
  material_code_snapshot?: string;
}

type NullableBookingRef = Omit<BookingRef, "booking_id"> & { booking_id: BookingRef["booking_id"] | null };

/** Base URL for Django Admin (same origin as API, path /admin/). Used for admin dashboard links. */
export const getAdminBaseUrl = (): string => {
  const base =
    (typeof window !== "undefined" && (window as any).__RUNTIME_CONFIG__?.VITE_API_URL)
      ? (window as any).__RUNTIME_CONFIG__.VITE_API_URL
      : import.meta.env.VITE_API_URL || (typeof window !== "undefined" ? "/api" : "http://127.0.0.1:8000/api");

  // In local frontend dev, API base is often relative (/api) and served from Vite origin (e.g. :8080),
  // but Django admin is on backend server (typically :8000).
  // Use explicit backend origin in this case to avoid /admin 404 on frontend dev server.
  let origin: string;
  if (base.startsWith("/")) {
    origin = "http://127.0.0.1:8000";
  } else {
    origin = base.replace(/\/api\/?$/, "");
  }
  return `${origin}/admin/`;
};

/** Backend API origin (scheme://host:port), used to build absolute download URLs. */
export const getApiOrigin = (): string => {
  const base =
    (typeof window !== "undefined" && (window as any).__RUNTIME_CONFIG__?.VITE_API_URL)
      ? (window as any).__RUNTIME_CONFIG__.VITE_API_URL
      : import.meta.env.VITE_API_URL || (typeof window !== "undefined" ? "/api" : "http://127.0.0.1:8000/api");
  if (base.startsWith("/")) return "http://127.0.0.1:8000";
  return base.replace(/\/api\/?$/, "");
};

/** Backend admin API endpoint path (no leading/trailing slash). Used for frontend admin CRUD. */
export const ADMIN_SECTION_ENDPOINTS: Record<string, string> = {
  // Equipment
  bookings: 'admin/bookings',
  dailySlots: 'admin/daily-slots',
  equipment: 'admin/equipment',
  equipmentCategories: 'admin/equipment-categories',
  equipmentGroups: 'admin/equipment-groups',
  holidays: 'admin/holidays',
  repeatSampleRequests: 'admin/repeat-sample-requests',
  // Users
  departments: 'admin/departments',
  organizationRequests: 'admin/organization-requests',
  projects: 'admin/projects',
  subWalletTransactions: 'admin/sub-wallet-transactions',
  subWallets: 'admin/sub-wallets',
  userDocuments: 'admin/user-documents',
  userGroupMembers: 'admin/user-group-members',
  userGroups: 'admin/user-groups',
  users: 'admin/users',
  walletRazorpayOrders: 'admin/wallet-razorpay-orders',
  walletRechargeRequests: 'admin/wallet-recharge-requests',
  wallets: 'admin/wallets',
  // CMS
  cmsMenu: 'admin/cms-menu',
  cmsHome: 'admin/cms-home',
  cmsPages: 'admin/cms-pages',
  cmsHeroSlides: 'admin/cms-hero-slides',
  communicationTemplates: 'admin/communication-templates',
  communicationLogs: 'admin/communication-logs',
  notices: 'admin/notices',
  calendarColors: 'admin/calendar-colors',
  internalSlotWindow: 'admin/internal-slot-window',
  equipmentReports: 'admin/equipment-reports',
};

/** Response from GET /wallet/faculty-expense-report/ (IITR Faculty only). */
export interface FacultyWalletExpenseReportData {
  date_from: string;
  date_to: string;
  current_balance: string;
  sub_wallets: Array<{ department_id: number; department_name: string; balance: string }>;
  linked_students: Array<{ user_id: number; name: string; email: string; user_type: string }>;
  member_user_ids: number[];
  period_wallet_movements: {
    total_debits: string;
    total_credits: string;
    recharges_and_similar_credits: string;
    refund_credits: string;
    internal_transfer_credits: string;
    withdrawal_reversal_credits: string;
  };
  period_booking_spend: { total: string; booking_count: number };
  by_member: Array<{
    user_id: number;
    name: string;
    email: string;
    user_type: string;
    is_wallet_owner: boolean;
    role_label: string;
    total_spend: string;
    booking_count: number;
    share_of_period_spend_percent: number;
    by_equipment: Array<{
      equipment_id: number;
      equipment_code: string;
      equipment_name: string;
      total_spend: string;
      booking_count: number;
    }>;
  }>;
  by_equipment: Array<{
    equipment_id: number;
    equipment_code: string;
    equipment_name: string;
    total_spend: string;
    booking_count: number;
  }>;
  equipment_filter_id: number | null;
  /** Accounts-team approved recharges in the report date range (offline / SRIC flow). */
  approved_recharges: Array<{
    id: number;
    amount: string;
    department_name: string;
    project_name: string;
    project_code: string;
    project_agency: string;
    project_details_legacy: string;
    project_head_name: string;
    project_head_email: string;
    requested_by_name: string;
    requested_by_email: string;
    created_at: string | null;
    responded_at: string | null;
    approved_by_email: string;
    response_message: string;
  }>;
}

interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string[] | string>; // For field-specific errors like {"email": ["..."]}
  // Booking waitlist extras (may be returned with non-2xx responses).
  waitlist_position?: number;
  waitlist_code?: string;
  waitlist_full?: boolean;
  /** JSON from X-Booking-Perf (server phase timings) when backend exposes it. */
  bookingPerf?: string;
  /** Machine-readable error code from JSON body (e.g. istem_fbr_not_executed). */
  errorCode?: string;
  istem_portal_url?: string;
}

interface User {
  id: number;
  email: string;
  name: string;
  user_type: number; // Changed from string to number
  emp_id?: string | null;
  phone_number?: string | null;
  secondary_phone_number?: string | null;
  profile_picture?: string | null;
  department?: number;
  department_code?: string;
  can_have_wallet?: boolean;
  // Optional fields that may be present in some responses
  department_name?: string;
  supervisor?: number | null;
  uses_admin_panel?: boolean;
  uses_react_app?: boolean;
  uses_omniport_auth?: boolean;
  uses_email_auth?: boolean;
  url?: string;
  is_active?: boolean;
  email_verified?: boolean;
  admin_approved?: boolean;
  date_of_birth?: string | null;
  branch_name?: string | null;
  degree_name?: string | null;
  designation?: string | null;
  date_joined?: string | null;
  last_login?: string | null;
  auto_slot_selection?: boolean;
  is_staff?: boolean;
  /** External users: must confirm I-STEM portal registration before booking. */
  istem_portal_acknowledged?: boolean;
}

/** Student equipment operating nomination (semester-wise, supervisor nominates). */
export interface EquipmentNomination {
  id: number;
  student_id: number;
  student_name: string;
  student_email: string;
  student_branch_name?: string;
  student_degree_name?: string;
  student_department_name?: string;
  supervisor_id: number;
  supervisor_name: string;
  equipment_id: number;
  equipment_code: string;
  equipment_name: string;
  semester_id: number;
  semester_code: string;
  semester_name: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  remarks: string | null;
  nominated_at: string | null;
  approved_at: string | null;
  approved_by_id: number | null;
  approved_by_name?: string | null;
  outcome_summary?: string;
  ta_call_id?: number | null;
  resume_submitted_at?: string | null;
  resume_filename?: string | null;
  has_resume?: boolean;
}

/** TA nomination call initiated by OIC/Admin; email sent to all Faculty. */
export interface TANominationCall {
  id: number;
  equipment_id: number;
  equipment_code: string;
  equipment_name: string;
  semester_id: number;
  semester_code: string;
  semester_name: string;
  number_of_operators_required: number;
  eligibility_criteria: string;
  expected_duty_hours: string;
  expected_duty_time: string;
  benefits: string;
  nomination_deadline: string | null;
  status: 'OPEN' | 'CLOSED';
  created_by_id: number | null;
  created_at: string | null;
  email_sent_at: string | null;
}

export interface TAAssignment {
  id: number;
  nomination: number;
  booking: number;
  /** Display booking ref (virtual_booking_id or code-id); from API. */
  booking_display_id?: string;
  /** Local date/time range for booked slot(s), e.g. "2025-03-24 09:30–11:30". */
  booking_slot_summary?: string;
  ta_student: number;
  ta_student_name?: string;
  ta_student_email?: string;
  equipment: number;
  equipment_code?: string;
  equipment_name?: string;
  semester: number;
  semester_name?: string;
  status: "ALLOCATED" | "ACCEPTED" | "DECLINED" | "CANCELLED";
  allocation_notes?: string | null;
  expected_hours?: string | null;
  allocated_by?: number | null;
  allocated_by_name?: string | null;
  allocated_at?: string | null;
  responded_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface TADutyLog {
  id: number;
  nomination: number;
  student: number;
  student_name?: string;
  student_email?: string;
  equipment: number;
  equipment_code?: string;
  equipment_name?: string;
  booking?: number | null;
  assignment?: number | null;
  assignment_status?: string;
  duty_date: string;
  hours_spent: string;
  samples_processed: number;
  remarks?: string | null;
  status: "PENDING" | "VERIFIED" | "REJECTED";
  /** Present when status is VERIFIED: points credited for this duty log (linked booking). */
  reward_points_earned?: string | null;
  verified_by?: number | null;
  verified_by_name?: string | null;
  verified_at?: string | null;
  created_by?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface AuthResponse {
  token: string;
  user: User;
}

/** CMS menu item (tree from public API). */
export interface CmsMenuItem {
  id: number;
  label: string;
  link_type: string;
  url: string;
  /** Set when link_type is "document" and a PDF/file is uploaded. */
  document_url?: string | null;
  /** Set when link_type is "page" – use for href /page/{page_slug}. */
  page_slug?: string | null;
  priority: number;
  open_in_new_tab: boolean;
  children: CmsMenuItem[];
}

/** Block types for CMS page content (WordPress-style blocks). */
export type CmsPageBlockType =
  | 'heading'
  | 'paragraph'
  | 'image'
  | 'list'
  | 'quote'
  | 'divider'
  | 'button'
  | 'spacer'
  | 'embed'
  | 'html'
  | 'callout'
  | 'columns'
  | 'id_card';

/** Single block (no columns). */
export interface CmsPageBlockBase {
  type: Exclude<CmsPageBlockType, 'columns'>;
  id?: string;
  /** heading: level 1-4, text */
  level?: number;
  text?: string;
  /** image: url, alt, caption */
  url?: string;
  alt?: string;
  caption?: string;
  /** list: ordered, items */
  ordered?: boolean;
  items?: string[];
  /** paragraph: optional HTML content */
  content?: string;
  /** button */
  buttonText?: string;
  openInNewTab?: boolean;
  /** spacer: height in px */
  height?: number;
  /** embed: url, embedType youtube | iframe */
  embedType?: 'youtube' | 'iframe';
  /** html: raw HTML (use with care) */
  html?: string;
  /** callout: variant */
  variant?: 'info' | 'warning' | 'success' | 'default';
  /** id_card */
  name?: string;
  designation?: string;
  email?: string;
  location?: string;
  contactNumber?: string;
  role?: string;
  /** Resume: URL (from upload or hyperlink). Clicking image or name opens this. */
  resumeUrl?: string;
  /** Card width for alignment (e.g. "320px", "20rem"). Container matches this width. */
  cardWidth?: string;
  /** Card height (e.g. "200px", "16rem"). Container matches this height. */
  cardHeight?: string;
}

/** Columns block: nested blocks per column. */
export interface ColumnsBlock {
  type: 'columns';
  columnCount: 2 | 3;
  columns: CmsPageBlock[][];
}

/** Recursive: columns contain nested blocks. */
export type CmsPageBlock = CmsPageBlockBase | ColumnsBlock;

export interface CmsPagePublic {
  id: number;
  title: string;
  slug: string;
  content: CmsPageBlock[];
}

export interface CmsPageAdmin {
  id: number;
  title: string;
  slug: string;
  content: CmsPageBlock[];
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserGroupSummary {
  id: number;
  name: string;
  code: string;
  description: string;
  member_count: number;
  equipment_count: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface UserGroupMember {
  id: number;
  user_id: number;
  email: string;
  name: string;
  created_at: string | null;
}

export interface UserGroupDetail extends UserGroupSummary {
  members: UserGroupMember[];
  equipment_ids: number[];
}

interface RegisterResponse {
  message?: string;
  token: string | null;
  user: User;
}

interface EmailVerificationError {
  error: string;
  message: string;
  email_verified: boolean;
  admin_approved: boolean;
}

interface BookingEvent {
  event_id: number;
  booking: number;
  event_type: string;
  event_type_display: string;
  previous_status: string | null;
  previous_status_display: string | null;
  new_status: string | null;
  new_status_display: string | null;
  comment: string | null;
  created_by: number | null;
  created_by_name: string | null;
  metadata: Record<string, any>;
  notification_sent: boolean;
  created_at: string;
}

export type SampleTraceStatus =
  | 'SAMPLE_SENT'
  | 'HELD_AT_OFFICE'
  | 'FORWARDED_TO_LAB'
  | 'SAMPLE_ACCEPTED'
  | 'SAMPLE_REJECTED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'RETURNED'
  | 'ARCHIVED'
  | 'DISPOSED';

export interface SampleTraceReplyAttachment {
  id: number;
  file_url: string;
  name: string;
}

export interface SampleTraceEvent {
  id: number;
  status: string;
  status_display: string;
  sample_identifiers: string;
  tracking_id?: string;
  reason?: string;
  user_reply?: string;
  reply_attachments?: SampleTraceReplyAttachment[];
  created_at: string;
  created_by: number | null;
  created_by_name: string | null;
}

/** One row from wallet recharge file parse API (date, receipt_no, amount, matched user, processed). */
export interface WalletRechargeParseRow {
  /** Present for rows loaded from server (stored parse entries). */
  id?: number;
  date: string | null;
  receipt_no: string;
  name: string;
  emp_no: string;
  department: string;
  amount: string;
  payment: string;
  processed?: boolean;
  matched_user: {
    id: number;
    email: string;
    name: string;
    emp_id: string;
    /** Internal department name when user is matched by employee ID (from database). */
    department_name?: string;
  } | null;
  /** IMAP mailbox UID of the message this row was imported from (if any). */
  source_imap_uid?: string;
}

/** Legacy wallet balance lookup (direct MySQL by emp_id). */
export interface LegacyWalletLookupResult {
  emp_id_input: string;
  emp_id_normalized: string;
  legacy_mysql_configured: boolean;
  connection_source?: 'request' | 'environment';
  legacy_mysql_host?: string;
  legacy_mysql_database?: string;
  status:
    | 'ready'
    | 'not_found'
    | 'invalid_emp_id'
    | 'invalid_balance'
    | 'zero_balance'
    | 'unmatched_new_system'
    | 'already_imported'
    | 'not_configured'
    | 'connection_error';
  error?: string;
  legacy?: {
    legacy_user_id: number;
    emp_id: string;
    email: string;
    balance: string;
    balance_valid: boolean;
  } | null;
  new_system?: {
    user_id: number;
    user_email: string;
    user_name: string;
    emp_id: string | null;
    department: string | null;
  } | null;
}

export interface LegacyWalletBalanceRow {
  legacy_user_id: number;
  emp_id: string;
  name: string;
  email: string;
  balance: string;
}

export interface LegacyWalletBalanceListResult {
  row_count: number;
  total_balance: string;
  legacy_mysql_host?: string;
  legacy_mysql_database?: string;
  rows: LegacyWalletBalanceRow[];
  status?: 'not_configured' | 'connection_error';
  error?: string;
}

class ApiClient {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    // Load token from localStorage on initialization
    this.token = localStorage.getItem('auth_token');
  }

  /** Called when the API returns 401 (e.g. session expired or invalidated). Set by AuthProvider to logout and redirect. */
  onUnauthorized: (() => void) | null = null;

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    exposeHeaders?: string[],
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    const isFormDataBody =
      typeof FormData !== "undefined" && options.body instanceof FormData;
    const headers: HeadersInit = {
      ...(isFormDataBody ? {} : { "Content-Type": "application/json" }),
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Token ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        // 401: session expired or invalidated (e.g. single session login elsewhere, or inactivity)
        if (response.status === 401) {
          this.setToken(null);
          localStorage.removeItem('user');
          if (this.onUnauthorized) {
            this.onUnauthorized();
          }
        }
        // Handle field-specific errors (e.g., {"email": ["A user with this email already exists."]})
        const fieldErrors: Record<string, string[] | string> = {};
        let hasFieldErrors = false;
        
        if (typeof data === 'object' && data !== null) {
          for (const [field, messages] of Object.entries(data)) {
            // Skip common error fields that are not field-specific, but include email_verified and admin_approved
            if (field === 'detail' || (field === 'message' && !data.email_verified)) {
              continue;
            }
            
            // Handle email verification error structure
            if (field === 'email_verified' || field === 'admin_approved') {
              fieldErrors[field] = String(messages);
              hasFieldErrors = true;
            } else if (Array.isArray(messages) && messages.length > 0) {
              fieldErrors[field] = messages;
              hasFieldErrors = true;
            } else if (typeof messages === 'string') {
              fieldErrors[field] = messages;
              hasFieldErrors = true;
            }
          }
        }
        
        // If we have field-specific errors, return them
        if (hasFieldErrors) {
          // Check if we have email_verified or admin_approved fields - these need special handling
          const errorData = data as any;
          if (fieldErrors.email_verified || fieldErrors.admin_approved) {
            // For email verification/pending approval errors, use the error or message field
            return {
              error: errorData.error || errorData.message || `HTTP error! status: ${response.status}`,
              fieldErrors: {
                ...fieldErrors,
                email_verified: String(errorData.email_verified ?? ''),
                admin_approved: String(errorData.admin_approved ?? ''),
                message: errorData.message || errorData.error,
              },
            };
          }
          
          // Get the first error message from field errors
          const firstFieldError = Object.values(fieldErrors)[0];
          const firstErrorMessage = Array.isArray(firstFieldError) 
            ? firstFieldError[0] 
            : firstFieldError;
          
          return {
            error: firstErrorMessage || `HTTP error! status: ${response.status}`,
            fieldErrors: fieldErrors,
          };
        }
        
        // Otherwise, return standard error
        // Check if it's an email verification or pending approval error with structured response
        const errorData = data as any;
        if (errorData.error && (
          errorData.email_verified === false || 
          errorData.error.includes("Email not verified") ||
          errorData.error.includes("pending approval") ||
          errorData.error.includes("Account pending approval") ||
          (errorData.email_verified === true && errorData.admin_approved === false)
        )) {
          return {
            error: errorData.error || errorData.message || `HTTP error! status: ${response.status}`,
            fieldErrors: {
              ...fieldErrors,
              email_verified: String(errorData.email_verified ?? ''),
              admin_approved: String(errorData.admin_approved ?? ''),
              message: errorData.message || errorData.error,
            },
          };
        }
        
        const maybeWaitlist = (data as any) || {};
        return {
          error: maybeWaitlist.detail || maybeWaitlist.message || maybeWaitlist.error || `HTTP error! status: ${response.status}`,
          // Preserve waitlist info from backend error responses so UI can show WL number.
          waitlist_position: maybeWaitlist.waitlist_position,
          waitlist_code: maybeWaitlist.waitlist_code,
          waitlist_full: maybeWaitlist.waitlist_full,
          errorCode: typeof maybeWaitlist.code === "string" ? maybeWaitlist.code : undefined,
          istem_portal_url: typeof maybeWaitlist.istem_portal_url === "string" ? maybeWaitlist.istem_portal_url : undefined,
          fieldErrors: Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined,
        };
      }

      const out: ApiResponse<T> = { data: data as T };
      if (exposeHeaders?.length) {
        for (const h of exposeHeaders) {
          const v = response.headers.get(h);
          if (v != null && v !== "" && h.toLowerCase() === "x-booking-perf") {
            out.bookingPerf = v;
          }
        }
      }
      return out;
    } catch (error: any) {
      return {
        error: error.message || 'Network error occurred',
      };
    }
  }

  /** Lab operator: submit a leave request (optional attachment). */
  async createOperatorLeaveRequest(input: {
    equipment_id?: number;
    start_date: string; // YYYY-MM-DD
    end_date: string; // YYYY-MM-DD
    start_session?: "FN" | "AN";
    end_session?: "FN" | "AN";
    reason: string;
    attachment?: File | null;
  }) {
    const fd = new FormData();
    if (input.equipment_id != null) fd.set("equipment_id", String(input.equipment_id));
    fd.set("start_date", input.start_date);
    fd.set("end_date", input.end_date);
    if (input.start_session) fd.set("start_session", input.start_session);
    if (input.end_session) fd.set("end_session", input.end_session);
    fd.set("reason", input.reason);
    if (input.attachment) fd.set("attachment", input.attachment);
    return this.request<{ id: number; status: string }>("/operator/leave/requests/", {
      method: "POST",
      body: fd,
    });
  }

  /** Operator/OIC: resume duty — shortens leave per 10:00 local rule or vacates leave if before 10:00 on first day. */
  async resumeOperatorLeaveRequest(leaveId: number) {
    return this.request<{
      message: string;
      status?: string;
      end_date?: string;
      end_session?: string;
      ended_coverages?: number;
      updated_coverages?: number;
    }>(`/operator/leave/requests/${leaveId}/resume/`, {
      method: "POST",
    });
  }

  async getOperatorLeaveSummary(opts: { year: number }) {
    const p = new URLSearchParams();
    p.set("year", String(opts.year));
    return this.request<{ approved_days_this_year: number }>(`/operator/leave/summary/?${p.toString()}`);
  }

  async listOperatorLeaveRequests(opts?: { year?: number }) {
    const p = new URLSearchParams();
    if (opts?.year != null) p.set("year", String(opts.year));
    const qs = p.toString();
    return this.request<{ leaves: any[] }>(`/operator/leave/requests/${qs ? `?${qs}` : ""}`);
  }

  async getTeamCalendarDepartment(opts: { month: string; department_id?: number }) {
    const p = new URLSearchParams();
    p.set("month", opts.month);
    if (opts.department_id != null) p.set("department_id", String(opts.department_id));
    return this.request<{
      month: string;
      date_start: string;
      date_end: string;
      members: Array<{ id: number; name: string; email: string; user_type: string }>;
      leaves: Array<{
        id: number;
        operator_id: number;
        operator_name: string;
        start_date: string;
        start_session: "FN" | "AN";
        end_date: string;
        end_session: "FN" | "AN";
        status: string;
        reason: string;
        rejection_reason?: string | null;
      }>;
      holidays?: Record<string, { reason: string; color: string }>;
    }>(`/team-calendar/department/?${p.toString()}`);
  }

  /** OIC/Admin: list pending leave requests in their department. */
  async listPendingLeaveRequestsForOic() {
    return this.request<{ leaves: any[] }>(`/oic/leave/requests/pending/`);
  }

  /** OIC/Admin: list approved leave requests in their department. */
  async listApprovedLeaveRequestsForOic() {
    return this.request<{ leaves: any[] }>(`/oic/leave/requests/approved/`);
  }

  /** OIC/Admin: approve leave request. */
  async approveLeaveRequestAsOic(leaveId: number) {
    return this.request<{ id: number; status: string }>(`/oic/leave/requests/${leaveId}/approve/`, {
      method: "POST",
    });
  }

  /** OIC/Admin: coverage options for approving operator leave request. */
  async getOicLeaveCoverageOptions(leaveId: number) {
    return this.request<{
      leave: {
        id: number;
        operator_id: number;
        operator_name?: string | null;
        operator_email?: string | null;
        start_date: string;
        start_session: "FN" | "AN";
        end_date: string;
        end_session: "FN" | "AN";
      };
      equipments: Array<{ equipment_id: number; equipment_code: string; equipment_name: string }>;
      eligible_operators: Array<{ id: number; name: string; email: string }>;
      modes: string[];
    }>(`/oic/leave/requests/${leaveId}/coverage-options/`);
  }

  /** OIC/Admin: read existing coverages for a leave request. */
  async getOicLeaveCoverages(leaveId: number) {
    return this.request<{
      coverages: Array<{
        id: number;
        equipment_id: number;
        mode: "SECONDARY_OPERATOR" | "OIC_SELF_OPERATE" | "OPERATOR_ON_LEAVE";
        acting_operator_id: number | null;
        acting_operator_email?: string | null;
        ended_early_at?: string | null;
      }>;
    }>(`/oic/leave/requests/${leaveId}/coverages/`);
  }

  /** OIC/Admin: set/replace coverages for an approved leave request. */
  async setOicLeaveCoverages(
    leaveId: number,
    input: {
      coverages: Array<{
        equipment_id: number;
        mode: "SECONDARY_OPERATOR" | "OIC_SELF_OPERATE" | "OPERATOR_ON_LEAVE";
        acting_operator_id?: number | null;
      }>;
    },
  ) {
    return this.request<{ coverage_ids: number[] }>(`/oic/leave/requests/${leaveId}/set-coverages/`, {
      method: "POST",
      body: JSON.stringify(input),
      headers: { "Content-Type": "application/json" },
    });
  }

  /** OIC/Admin: approve leave and attach per-equipment coverage decisions. */
  async approveLeaveRequestAsOicWithCoverage(
    leaveId: number,
    input: {
      coverages: Array<{
        equipment_id: number;
        mode: "SECONDARY_OPERATOR" | "OIC_SELF_OPERATE" | "OPERATOR_ON_LEAVE";
        acting_operator_id?: number | null;
      }>;
    },
  ) {
    return this.request<{ id: number; status: string; coverage_ids: number[] }>(
      `/oic/leave/requests/${leaveId}/approve-with-coverage/`,
      {
        method: "POST",
        body: JSON.stringify(input),
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  /** OIC/Admin: resume duty for operator — same leave-shortening rules as operator self-resume. */
  async resumeLeaveRequestAsOic(leaveId: number) {
    return this.request<{
      message: string;
      status?: string;
      end_date?: string;
      end_session?: string;
      ended_coverages?: number;
      updated_coverages?: number;
    }>(`/oic/leave/requests/${leaveId}/resume/`, {
      method: "POST",
    });
  }

  /** OIC/Admin: reject leave request (requires rejection_reason). */
  async rejectLeaveRequestAsOic(leaveId: number, rejection_reason: string) {
    return this.request<{ id: number; status: string }>(`/oic/leave/requests/${leaveId}/reject/`, {
      method: "POST",
      body: JSON.stringify({ rejection_reason }),
      headers: { "Content-Type": "application/json" },
    });
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  getToken(): string | null {
    // Always check localStorage to ensure we have the latest token
    // This handles cases where token was set directly in localStorage
    const storedToken = localStorage.getItem('auth_token');
    if (storedToken !== this.token) {
      this.token = storedToken;
    }
    return this.token;
  }

  // Auth endpoints
  // Omniport OAuth
  async getOmniportAuthUrl() {
    // Remove trailing slash from baseURL if present, then add the endpoint
    const baseUrl = this.baseURL.endsWith('/') ? this.baseURL.slice(0, -1) : this.baseURL;
    // Django REST framework typically uses trailing slashes
    const url = `${baseUrl}/auth/omniport/authorize/`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        redirect: 'manual', // Don't automatically follow redirects
      });

      // Check if response is a redirect (3xx status)
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('Location');
        return {
          error: `Backend returned a redirect (${response.status}) to ${location || 'unknown location'}. The backend should return JSON, not redirect. Please check backend configuration.`,
        };
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          error: data.detail || data.message || `HTTP error! status: ${response.status}`,
        };
      }

      // Validate that auth_url is present and is not pointing to the Django backend
      if (!data.auth_url) {
        return {
          error: 'Backend did not return auth_url in response',
        };
      }

      // Check if auth_url is pointing to Django backend instead of Omniport
      if (data.auth_url.includes('127.0.0.1:8000') || data.auth_url.includes('localhost:8000')) {
        console.error('Backend returned Django URL instead of Omniport URL:', data.auth_url);
        return {
          error: 'Backend configuration error: auth_url points to Django backend instead of Omniport',
        };
      }

      return { data: data as { auth_url: string; state: string } };
    } catch (error: any) {
      return {
        error: error.message || 'Network error occurred',
      };
    }
  }

  async exchangeOmniportCode(code: string, state: string) {
    const response = await this.request<AuthResponse>('/auth/omniport/callback/', {
      method: 'POST',
      body: JSON.stringify({ code, state }),
    });

    if (response.data?.token) {
      this.setToken(response.data.token);
      // Store user data if provided
      if (response.data.user) {
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
    }

    return response;
  }

  async signUp(
    email: string, 
    password: string,
    password_confirm: string,
    name: string,
    user_type: string,
    emp_id: string,
    phone_number: string | undefined,
    department: number | null,
    documents?: File[],
    document_types?: string[],
    profile_picture?: File | null,
    user_type_alias?: string | null,
    supervisor?: number | null,
    program_end_date?: string,
    program_start_date?: string | null,
    gender?: string | null,
    organization_request_id?: number | null
  ) {
    const url = `${this.baseURL}/auth/register/`;
    const formData = new FormData();
    
    formData.append('email', email);
    formData.append('password', password);
    formData.append('password_confirm', password_confirm);
    formData.append('name', name);
    formData.append('user_type', user_type);
    formData.append('emp_id', emp_id);
    if (gender && gender.trim()) {
      formData.append('gender', gender.trim());
    }
    if (program_end_date && program_end_date.trim()) {
      formData.append('program_end_date', program_end_date.trim());
    }
    if (program_start_date && program_start_date.trim()) {
      formData.append('program_start_date', program_start_date.trim());
    }
    if (user_type_alias && user_type_alias.trim()) {
      formData.append('user_type_alias', user_type_alias.trim());
    }
    if (supervisor != null && supervisor !== undefined) {
      formData.append('supervisor', supervisor.toString());
    }
    if (phone_number) {
      formData.append('phone_number', phone_number);
    }
    if (organization_request_id != null && organization_request_id !== undefined) {
      formData.append('organization_request', organization_request_id.toString());
    }
    if (department != null && department !== undefined && department !== 0) {
      formData.append('department', department.toString());
    }
    
    // Append profile picture if provided
    if (profile_picture) {
      formData.append('profile_picture', profile_picture);
    }
    
    // Append documents if provided (Optional)
    if (documents && documents.length > 0) {
      documents.forEach((file, index) => {
        formData.append(`documents[]`, file);
      });
    }
    
    // Append document_types if provided (Optional, must match documents array length)
    if (document_types && document_types.length > 0) {
      document_types.forEach((docType, index) => {
        if (docType && docType.trim() !== "") {
          formData.append(`document_types[]`, docType);
        }
      });
    }

    const headers: HeadersInit = {};
    if (this.token) {
      headers['Authorization'] = `Token ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        // Handle field-specific errors
        const fieldErrors: Record<string, string[] | string> = {};
        let hasFieldErrors = false;
        
        if (typeof data === 'object' && data !== null) {
          for (const [field, messages] of Object.entries(data)) {
            if (field === 'detail' || field === 'message') {
              continue;
            }
            
            if (Array.isArray(messages) && messages.length > 0) {
              fieldErrors[field] = messages;
              hasFieldErrors = true;
            } else if (typeof messages === 'string') {
              fieldErrors[field] = messages;
              hasFieldErrors = true;
            }
          }
        }
        
        if (hasFieldErrors) {
          const firstFieldError = Object.values(fieldErrors)[0];
          const firstErrorMessage = Array.isArray(firstFieldError) 
            ? firstFieldError[0] 
            : firstFieldError;
          
          return {
            error: firstErrorMessage || `HTTP error! status: ${response.status}`,
            fieldErrors: fieldErrors,
          };
        }
        
        return {
          error: data.detail || data.message || data.error || `HTTP error! status: ${response.status}`,
          fieldErrors: Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined,
        };
      }

      const result: ApiResponse<RegisterResponse> = { data: data as RegisterResponse };
      
      if (result.data?.token) {
        this.setToken(result.data.token);
        // Store user data if provided
        if (result.data.user) {
          localStorage.setItem('user', JSON.stringify(result.data.user));
        }
      }

      return result;
    } catch (error: any) {
      return {
        error: error.message || 'Network error occurred',
      };
    }
  }

  async signIn(email: string, password: string) {
    const response = await this.request<AuthResponse>('/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.data?.token) {
      this.setToken(response.data.token);
      // Store user data if provided
      if (response.data.user) {
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
    }

    return response;
  }

  async resendVerificationEmail(email: string) {
    const response = await this.request<{ message: string }>('/auth/resend-verification/', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });

    return response;
  }

  /** Self-verification (external non-public email): get user details to show Accept/Reject page. */
  async getSelfVerifyDetails(uidb64: string, token: string) {
    return this.request<{ name: string; email: string; department_name: string | null; user_type_display: string }>(
      `/auth/self-verify/${encodeURIComponent(uidb64)}/${encodeURIComponent(token)}/`,
      { method: 'GET' }
    );
  }

  /** Self-verification: accept (activate account) or reject (remove registration). */
  async selfVerifyAction(uidb64: string, token: string, action: 'accept' | 'reject') {
    return this.request<{ message: string; email_verified?: boolean; admin_approved?: boolean }>(
      `/auth/self-verify/${encodeURIComponent(uidb64)}/${encodeURIComponent(token)}/`,
      { method: 'POST', body: JSON.stringify({ action }) }
    );
  }

  /** Request OTP for login (sent to user's email). Active, verified, approved users only. */
  async requestLoginOtp(email: string) {
    return this.request<{ message: string }>('/auth/login/request-otp/', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
  }

  /** Verify login OTP and get token + user. */
  async verifyLoginOtp(email: string, otp: string) {
    const response = await this.request<AuthResponse>('/auth/login/verify-otp/', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim().toLowerCase(), otp: otp.replace(/\s/g, '') }),
    });
    if (response.data?.token) {
      this.setToken(response.data.token);
      if (response.data.user) {
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
    }
    return response;
  }

  /** Request OTP for forgot password (sent to user's email). */
  async requestForgotPasswordOtp(email: string) {
    return this.request<{ message: string }>('/auth/forgot-password/request-otp/', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
  }

  /** Verify forgot-password OTP and set new password. */
  async verifyForgotPasswordOtpAndSetPassword(
    email: string,
    otp: string,
    newPassword: string,
    newPasswordConfirm: string
  ) {
    return this.request<{ message: string }>('/auth/forgot-password/verify-otp-and-set-password/', {
      method: 'POST',
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        otp: otp.replace(/\s/g, ''),
        new_password: newPassword,
        new_password_confirm: newPasswordConfirm,
      }),
    });
  }

  async signOut() {
    try {
      // Call the logout API endpoint
      const response = await this.request<{ message: string }>('/auth/logout/', {
        method: 'POST',
      });

      // Clear token and user data regardless of API response
      // This ensures local state is cleared even if API call fails
      this.setToken(null);
      localStorage.removeItem('user');

      return response;
    } catch (error: any) {
      // Even if API call fails, clear local storage
      this.setToken(null);
      localStorage.removeItem('user');
      
      return {
        error: error.message || 'Failed to logout',
      };
    }
  }

  async getCurrentUser() {
    return this.request<User>('/auth/user/');
  }

  /** Admin only: get auth settings (global + per user type timeout in seconds). */
  async getAuthSettings() {
    return this.request<{
      global_inactivity_timeout_seconds: number;
      by_user_type: Record<string, number>;
      user_type_choices: Array<{ code: string; name: string }>;
    }>('/auth/settings/');
  }

  /** Admin only: update auth settings (global and/or by_user_type). */
  async updateAuthSettings(data: {
    global_inactivity_timeout_seconds?: number;
    by_user_type?: Record<string, number | null>;
  }) {
    return this.request<{
      global_inactivity_timeout_seconds: number;
      by_user_type: Record<string, number>;
    }>('/auth/settings/', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Profile endpoints
  async getProfileMe() {
    return this.request<User>('/profiles/me/');
  }

  // External user billing profile (for invoice/shipping label)
  async getExternalBillingProfileMe() {
    return this.request<{
      billing_name: string;
      gstin: string;
      billing_address_line1: string;
      billing_address_line2: string;
      billing_city: string;
      billing_state: string;
      billing_pincode: string;
      billing_country: string;
      shipping_same_as_billing: boolean;
      shipping_name: string;
      shipping_phone: string;
      shipping_address_line1: string;
      shipping_address_line2: string;
      shipping_city: string;
      shipping_state: string;
      shipping_pincode: string;
      shipping_country: string;
    }>('/profiles/me/external-billing/');
  }

  async updateExternalBillingProfileMe(data: Partial<{
    billing_name: string;
    gstin: string;
    billing_address_line1: string;
    billing_address_line2: string;
    billing_city: string;
    billing_state: string;
    billing_pincode: string;
    billing_country: string;
    shipping_same_as_billing: boolean;
    shipping_name: string;
    shipping_phone: string;
    shipping_address_line1: string;
    shipping_address_line2: string;
    shipping_city: string;
    shipping_state: string;
    shipping_pincode: string;
    shipping_country: string;
  }>) {
    return this.request<{
      billing_name: string;
      gstin: string;
      billing_address_line1: string;
      billing_address_line2: string;
      billing_city: string;
      billing_state: string;
      billing_pincode: string;
      billing_country: string;
      shipping_same_as_billing: boolean;
      shipping_name: string;
      shipping_phone: string;
      shipping_address_line1: string;
      shipping_address_line2: string;
      shipping_city: string;
      shipping_state: string;
      shipping_pincode: string;
      shipping_country: string;
    }>('/profiles/me/external-billing/', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getBookingInvoicePdfBlob(bookingId: number): Promise<{ blob?: Blob; error?: string }> {
    const token = this.getToken();
    const url = `${this.baseURL}/bookings/${bookingId}/invoice.pdf`;
    const headers: HeadersInit = { ...(token ? { Authorization: `Token ${token}` } : {}) };
    const res = await fetch(url, { method: 'GET', headers });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { error: (data as { error?: string }).error || `HTTP error! status: ${res.status}` };
    }
    const blob = await res.blob();
    return { blob };
  }

  async getBookingShippingLabelPdfBlob(bookingId: number): Promise<{ blob?: Blob; error?: string }> {
    const token = this.getToken();
    const url = `${this.baseURL}/bookings/${bookingId}/shipping-label.pdf`;
    const headers: HeadersInit = { ...(token ? { Authorization: `Token ${token}` } : {}) };
    const res = await fetch(url, { method: 'GET', headers });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { error: (data as { error?: string }).error || `HTTP error! status: ${res.status}` };
    }
    const blob = await res.blob();
    return { blob };
  }

  async getBookingReturnShippingLabelPdfBlob(bookingId: number): Promise<{ blob?: Blob; error?: string }> {
    const token = this.getToken();
    const url = `${this.baseURL}/bookings/${bookingId}/return-shipping-label.pdf`;
    const headers: HeadersInit = { ...(token ? { Authorization: `Token ${token}` } : {}) };
    const res = await fetch(url, { method: 'GET', headers });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { error: (data as { error?: string }).error || `HTTP error! status: ${res.status}` };
    }
    const blob = await res.blob();
    return { blob };
  }

  async setBookingReturnShippingTracking(
    bookingId: number,
    payload: {
      shipping_company: string;
      other_company_name?: string;
      tracking_number: string;
    }
  ) {
    return this.request<{ message?: string }>(`/bookings/${bookingId}/return-shipping-tracking/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getEquipmentProformaInvoicePdfBlob(equipmentId: number, data: { base_charge: number | string; description?: string }) {
    const token = this.getToken();
    const url = `${this.baseURL}/equipments/${equipmentId}/proforma-invoice.pdf`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Token ${token}` } : {}),
    };
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(data) });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return { error: (d as { error?: string }).error || `HTTP error! status: ${res.status}` };
    }
    const blob = await res.blob();
    return { blob };
  }

  /** Upload profile picture (multipart form key: avatar). Returns profile_picture and avatar_url. */
  async uploadProfileAvatar(file: File) {
    const formData = new FormData();
    formData.append('avatar', file);
    const url = `${this.baseURL.replace(/\/$/, '')}/profiles/me/avatar/`;
    const headers: HeadersInit = { ...(this.getToken() ? { Authorization: `Token ${this.getToken()}` } : {}) };
    const res = await fetch(url, { method: 'POST', headers, body: formData });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { error: (data as any).error || 'Failed to upload avatar', data: null };
    }
    return { data: data as { profile_picture: string | null; avatar_url?: string | null }, error: undefined };
  }

  /**
   * Returns stable proxy URL for a user's profile picture (redirects to fresh S3 signed URL).
   * Use as img src so avatars do not expire when API responses are cached.
   * Prefer this over using profile_picture from API when you have the user id.
   */
  getProfilePictureUrl(userId: number | string | null | undefined): string {
    if (userId == null || userId === '') return '';
    const base = this.baseURL.replace(/\/$/, '');
    return `${base}/users/${userId}/profile-picture/`;
  }

  /**
   * Proxy URL for the current user's profile picture (redirects to fresh S3 signed URL).
   * Use when displaying the logged-in user's avatar and you have their id.
   */
  getCurrentUserProfilePictureUrl(): string {
    const base = this.baseURL.replace(/\/$/, '');
    return `${base}/profiles/me/avatar/`;
  }

  // Note: getProfile is deprecated, use getCurrentUser() or getProfileMe() instead
  // Keeping for backward compatibility but redirects to getCurrentUser
  async getProfile(userId?: string) {
    if (userId) {
      // For other users, use users endpoint
      return this.request<User>(`/users/${userId}/`);
    }
    // For current user, use profiles/me endpoint
    return this.getProfileMe();
  }

  async updateProfile(data: {
    name?: string;
    gender?: string | null;
    user_type?: number | string;
    emp_id?: string;
    phone_number?: string;
    profile_picture?: string;
    department?: number | null;
    auto_slot_selection?: boolean;
    wallet_low_balance_alert_enabled?: boolean;
    wallet_low_balance_alert_threshold?: number | null;
    istem_portal_acknowledged?: boolean;
  }) {
    // Get current user ID first
    const userResponse = await this.getCurrentUser();
    if (userResponse.error || !userResponse.data?.id) {
      return { error: 'Unable to get user ID' };
    }
    
    // Use /api/users/{user_id}/ for PATCH
    return this.request<User>(`/users/${userResponse.data.id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Equipment endpoints
  /** @deprecated Use getEquipments() - backend uses /equipments/ not /equipment/ */
  async getEquipment() {
    return this.request<any[]>('/equipment/');
  }

  async getEquipments(
    search?: string,
    status?: string,
    scope?: string,
    includeRatings?: boolean,
    internalDepartmentId?: number | 'all',
  ) {
    const params = new URLSearchParams();
    if (search) {
      params.append('search', search);
    }
    if (status) {
      params.append('status', status);
    }
    if (scope) {
      params.append('scope', scope);
    }
    if (includeRatings) {
      params.append('include_ratings', '1');
    }
    if (internalDepartmentId != null && internalDepartmentId !== 'all') {
      params.append('internal_department_id', String(internalDepartmentId));
    }
    const queryString = params.toString();
    const endpoint = queryString ? `/equipments/?${queryString}` : '/equipments/';
    
    return this.request<{
      equipments: Array<{
        equipment_id: number;
        code: string;
        name: string;
        profile_type: string;
        profile_type_display: string;
        status: string;
        status_display: string;
        location: string;
        image_url: string;
        video_url?: string | null;
        category?: number | null;
        category_name?: string | null;
        category_code?: string | null;
        internal_department?: number | null;
        internal_department_name?: string | null;
        internal_department_code?: string | null;
        created_at: string;
        updated_at: string;
      }>;
      count: number;
    }>(endpoint);
  }

  async getCatalogDepartments() {
    return this.request<{
      departments: Array<{
        id: number;
        name: string;
        code: string;
        equipment_count: number;
      }>;
      unassigned_count: number;
    }>('/equipments/catalog-departments/');
  }

  // CMS (public read-only for main page and menu)
  async getCmsMenu() {
    return this.request<CmsMenuItem[]>('/cms/menu/');
  }

  async getCmsHome() {
    return this.request<{ content: Record<string, string>; font_sizes: Record<string, string> }>('/cms/home/');
  }

  /** Public hero stats: operational equipment (public catalog) and active users. */
  async getCmsSiteStats() {
    return this.request<{ equipment_count: number; active_users_count: number; total_bookings_count: number }>('/cms/site-stats/');
  }

  /** Hero carousel background images (multiple, with autoscroll on frontend). */
  async getCmsHeroSlides() {
    return this.request<Array<{ id: number; order: number; image_url: string; alt_text: string }>>('/cms/hero-slides/');
  }

  /** Public: get published CMS page by slug. */
  async getCmsPageBySlug(slug: string) {
    return this.request<CmsPagePublic>(`/cms/pages/${encodeURIComponent(slug)}/`);
  }

  async getEquipmentById(id: string) {
    return this.request<any>(`/equipment/${id}/`);
  }

  async getEquipmentDetailById(id: number | string) {
    return this.request<{
      equipment_id: number;
      code: string;
      name: string;
      description: string;
      profile_type: string;
      profile_type_display: string;
      status: string;
      status_display: string;
      location: string;
      image_url: string;
      slot_duration_minutes: number;
      slots_per_day: number;
      /** Nullable override; when null, UI should use user's preference. */
      auto_slot_selection_default?: boolean | null;
      results_base_location?: string | null;
      internal_weekly_quota: number;
      external_weekly_quota: number;
      internal_monthly_quota: number;
      external_monthly_quota: number;
      specifications: Array<{
        equipment_specification_id: number;
        spec_key: string;
        spec_value: string;
        created_at: string;
      }>;
      accessories: Array<any>;
      additional_accessories: Array<{
        equipment_additional_accessory_id: number;
        additional_accessory_name: string;
        additional_accessory_description: string;
        is_optional: boolean;
        created_at: string;
      }>;
      input_fields: Array<{
        field_key: string;
        field_label: string;
        field_type: string;
        is_required: boolean;
        default_value: string;
        options: Array<any>;
        help_text: string;
        created_at: string;
        updated_at: string;
      }>;
      charge_profiles: Array<{
        equipment: number;
        user_type: string;
        is_active: boolean;
        primary_unit_charge: string;
        secondary_unit_charge: string;
        breakpoint: string;
        time_formula: string | null;
        created_at: string;
        updated_at: string;
      }>;
      slot_options: Array<any>;
      slot_masters: Array<{
        slot_number: number;
        slot_name: string;
        open_time: string;
        close_time: string;
        is_active: boolean;
        created_at: string;
        updated_at: string;
      }>;
      /** When 'SLOT_ID', weekly grid shows slot number/name on vertical axis; when 'TIME', shows time. */
      weekly_view_display?: 'TIME' | 'SLOT_ID';
      daily_slots?: Array<{
        id: number;
        slot_master: number;
        slot_number: number;
        slot_name: string;
        equipment_code: string;
        date: string;
        start_datetime: string;
        end_datetime: string;
        status: string;
        created_at: string;
        updated_at: string;
      }>;
      created_at: string;
      updated_at: string;
    }>(`/equipments/${id}/`);
  }

  async updateEquipment(id: string, data: any) {
    return this.request<any>(`/equipments/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /** Update equipment status. Admin/OIC only. */
  async updateEquipmentStatus(equipmentId: number, status: 'ACTIVE' | 'MAINTENANCE' | 'REPAIR' | 'INACTIVE' | 'DISPOSED' | 'OTHER') {
    return this.updateEquipment(String(equipmentId), { status });
  }

  async calculateEquipmentCharge(
    equipmentId: number | string,
    fieldValues: Record<string, string | boolean | string[]>,
    options?: {
      user_id?: number | string;
      reward_points_to_redeem?: number | string;
      sample_return_after_analysis?: boolean;
      print_analysis_id?: string;
      print_analysis_batch_id?: string;
      /** Estimate charges for this user type (standard charge profile). */
      user_type?: string;
    }
  ) {
    // Convert field values to query parameters
    const params = new URLSearchParams();
    Object.entries(fieldValues).forEach(([key, value]) => {
      // Handle arrays (for MULTI_SELECT fields) - convert to comma-separated string
      if (Array.isArray(value)) {
        params.append(key, value.join(","));
      } else {
        params.append(key, String(value));
      }
    });
    if (options?.user_id != null) {
      params.append('user_id', String(options.user_id));
    }
    if (options?.reward_points_to_redeem != null) {
      params.append('reward_points_to_redeem', String(options.reward_points_to_redeem));
    }
    if (options?.sample_return_after_analysis != null) {
      params.append('sample_return_after_analysis', options.sample_return_after_analysis ? 'true' : 'false');
    }
    if (options?.print_analysis_id) {
      params.append('print_analysis_id', options.print_analysis_id);
    }
    if (options?.print_analysis_batch_id) {
      params.append('print_analysis_batch_id', options.print_analysis_batch_id);
    }
    if (options?.user_type) {
      params.append('user_type', String(options.user_type));
    }
    const queryString = params.toString();
    const endpoint = queryString
      ? `/equipments/${equipmentId}/calculate/?${queryString}`
      : `/equipments/${equipmentId}/calculate/`;
    
    return this.request<{
      equipment_id: number;
      equipment_code: string;
      equipment_name: string;
      user_type: string;
      profile_type: string;
      input_values: Record<string, number | string>;
      total_time_minutes: number;
      base_charge: string;
      gst_percent: number;
      gst_amount: string;
      total_charge: string;
      charge_breakdown: Array<{
        description: string;
        amount: number;
      }>;
      reward?: {
        points_balance: string;
        requested_points: string;
        points_applied: string;
        discount_amount: string;
        final_payable: string;
        message: string | null;
      };
    }>(endpoint);
  }

  async getEquipmentPrintMaterials(equipmentId: number | string, options?: { user_type?: string }) {
    const params = new URLSearchParams();
    if (options?.user_type) {
      params.append("user_type", options.user_type);
    }
    const qs = params.toString();
    const endpoint = qs
      ? `/equipments/${equipmentId}/print-materials/?${qs}`
      : `/equipments/${equipmentId}/print-materials/`;
    return this.request<{ materials: PrintMaterial[] }>(endpoint);
  }

  async analyzeEquipmentStl(
    equipmentId: number | string,
    params: {
      file: File;
      material_id: string | number;
      density_percent?: number;
      /** @deprecated use density_percent */
      infill_percent?: number;
    },
  ) {
    const formData = new FormData();
    formData.append("file", params.file);
    formData.append("material_id", String(params.material_id));
    const density = params.density_percent ?? params.infill_percent;
    if (density != null) formData.append("density_percent", String(density));
    const url = `${this.baseURL.replace(/\/$/, "")}/equipments/${equipmentId}/analyze-stl/`;
    const headers: HeadersInit = {
      ...(this.getToken() ? { Authorization: `Token ${this.getToken()}` } : {}),
    };
    const res = await fetch(url, { method: "POST", headers, body: formData });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { error: (data as { error?: string }).error || `HTTP ${res.status}` };
    }
    if (Array.isArray((data as PrintAnalysisBatchResult).items)) {
      return { data: data as PrintAnalysisBatchResult };
    }
    return { data: data as PrintAnalysisResult };
  }

  async getPrintAnalysisBatch(batchId: string) {
    return this.request<PrintAnalysisBatchResult>(`/print-analysis-batches/${batchId}/`);
  }

  async recalculatePrintAnalysisBatch(
    batchId: string,
    params: {
      material_id: string | number;
      density_percent?: number;
      infill_percent?: number;
    },
  ) {
    const density = params.density_percent ?? params.infill_percent;
    return this.request<PrintAnalysisBatchResult>(`/print-analysis-batches/${batchId}/recalculate/`, {
      method: 'PATCH',
      body: JSON.stringify({
        material_id: params.material_id,
        density_percent: density,
      }),
    });
  }

  async getPrintAnalysis(analysisId: string) {
    return this.request<PrintAnalysisResult>(`/print-analyses/${analysisId}/`);
  }

  async getPrintAnalysisStlPresign(analysisId: string) {
    return this.request<{ url: string }>(`/print-analyses/${analysisId}/stl-presign/`);
  }

  async recalculatePrintAnalysis(
    analysisId: string,
    params: {
      material_id: string | number;
      density_percent?: number;
      infill_percent?: number;
    },
  ) {
    const density = params.density_percent ?? params.infill_percent;
    return this.request<PrintAnalysisResult>(`/print-analyses/${analysisId}/recalculate/`, {
      method: 'PATCH',
      body: JSON.stringify({
        material_id: params.material_id,
        density_percent: density,
      }),
    });
  }

  /** Download proforma invoice PDF (IIT Roorkee letterhead, user details, date/time, disclaimer). */
  async proformaInvoiceDownloadPdf(payload: {
    line_items: Array<{
      equipment_id: number;
      equipment_code: string;
      equipment_name: string;
      input_values: Record<string, number | string>;
      input_labels_and_values?: Record<string, string | number>;
      charge_breakdown: Array<{ description: string; amount: number }>;
      base_charge: string;
      gst_amount: string;
      total_charge: string;
    }>;
    subtotal: string;
    total_gst: string;
    total_amount: string;
  }): Promise<{ blob?: Blob; error?: string }> {
    const token = this.getToken();
    const url = `${this.baseURL.replace(/\/$/, '')}/proforma-invoice/download.pdf`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Token ${token}` } : {}),
    };
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { error: (data as { error?: string }).error || `HTTP ${res.status}` };
    }
    const blob = await res.blob();
    return { blob };
  }

  /** Calculate proforma invoice for multiple equipments (samples/slots/elements). Charge is based on logged-in user type. */
  async proformaInvoiceCalculate(items: Array<{ equipment_id: number; input_values: Record<string, number | string> }>) {
    return this.request<{
      user_type: string;
      line_items: Array<{
        equipment_id: number;
        equipment_code: string;
        equipment_name: string;
        profile_type: string;
        input_values: Record<string, number | string>;
        total_time_minutes: number;
        charge_breakdown: Array<{ description: string; amount: number }>;
        base_charge: string;
        gst_percent: number;
        gst_amount: string;
        total_charge: string;
      }>;
      subtotal: string;
      total_gst: string;
      total_amount: string;
    }>('/proforma-invoice/calculate/', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  }

  async getEquipmentSlots(
    equipmentId: number | string, 
    startDate?: string,
    endDate?: string,
    options?: {
      urgentWeekExtension?: boolean;
      maintenanceExtraWeekBookingId?: number;
      /**
       * Enforce Equipment.weekly_view_time_from/to on the slots payload.
       * Used by Lab operator + OIC dashboard weekly calendar to restrict the visible time axis.
       */
      applyWeeklyViewTimeFilter?: boolean;
    }
  ) {
    const params = new URLSearchParams();

    if (startDate) {
      const dateOnly = startDate.includes('T') ? startDate.split('T')[0] : startDate;
      params.append('start_date', dateOnly);
    }
    if (endDate) {
      const dateOnly = endDate.includes('T') ? endDate.split('T')[0] : endDate;
      params.append('end_date', dateOnly);
    }
    if (options?.urgentWeekExtension) {
      params.append('urgent_week_extension', '1');
    }
    if (options?.maintenanceExtraWeekBookingId != null) {
      params.append('maintenance_extra_week_booking_id', String(options.maintenanceExtraWeekBookingId));
    }
    if (options?.applyWeeklyViewTimeFilter) {
      params.append('apply_weekly_view_time_filter', '1');
    }
    // Prevent stale weekly-slot responses after slot-status updates.
    params.append('_ts', String(Date.now()));
    
    const queryString = params.toString();
    const endpoint = queryString 
      ? `/equipments/${equipmentId}/slots/?${queryString}`
      : `/equipments/${equipmentId}/slots/`;
    
    return this.request<{
      equipment_id: number;
      equipment_code: string;
      start_date: string;
      end_date: string;
      slots: Array<{
        id: number;
        slot_master: number;
        slot_number: number;
        slot_name: string;
        equipment_code: string;
        date: string;
        start_datetime: string;
        end_datetime: string;
        status: string;
        status_display?: string;
        booking_id?: number | string | null;
        real_booking_id?: number | null;
        booking_status?: string | null;
        booking_status_display?: string | null;
        booking_user_name?: string | null;
        booking_user_department_code?: string | null;
        created_at: string;
        updated_at: string;
      }>;
      count: number;
      total_time_minutes?: number;
      holidays?: Record<string, string>;
      /** User-defined slot window start (HH:mm or HH:mm:ss). Used for calendar time axis. */
      slot_start_time?: string | null;
      /** User-defined slot window end (HH:mm or HH:mm:ss). Used for calendar time axis. */
      slot_end_time?: string | null;
      slot_duration_minutes?: number;
      /** Actual Slot Master open_time values (HH:mm:ss) - use these for calendar time axis to match user-defined timings. */
      slot_master_times?: string[];
      /** Admin-configurable colors for weekly calendar: slot statuses + holiday default. */
      calendar_colors?: {
        slot_colors: Record<string, string>;
        holiday_default: string;
        saturday_color?: string;
        sunday_color?: string;
      };
      /** Weekly view time filter (from equipment settings). Only slots within this window are returned. */
      weekly_view_time_from?: string | null;
      weekly_view_time_to?: string | null;
      weekly_view_max_rows?: number | null;
      weekly_view_default_days?: number | null;
      /** First date (YYYY-MM-DD) of visible window for internal users; null = no restriction. */
      slot_window_min_date?: string | null;
      /** Last date (YYYY-MM-DD) of visible window for internal users; null = no restriction. */
      slot_window_max_date?: string | null;
      /** Weekday (0=Mon … 6=Sun) when next week opens; only when slot window is set. */
      slot_window_reference_weekday?: number | null;
      /** Time (HH:mm) when next week opens; only when slot window is set. */
      slot_window_reference_time?: string | null;
    }>(endpoint);
  }

  // Wallet endpoints
  async getWallet() {
    return this.request<{
      balance: string;
      transactions: Array<{
        id: number;
        transaction_type: "credit" | "debit";
        amount: string;
        description: string;
        created_at: string;
      }>;
      sub_wallets?: Array<{
        id: number;
        department_id: number;
        department_name: string;
        department_code: string | null;
        balance: string;
        created_at: string;
        updated_at: string;
      }>;
      is_shared?: boolean;
      wallet_owner?: {
        name?: string | null;
        email?: string | null;
        phone?: string | null;
        profile_picture?: string | null;
      } | null;
    }>('/wallet/');
  }

  async getWalletBankDetails() {
    return this.request<{
      bank_details: {
        account_holder_name: string;
        bank_name: string;
        account_number: string;
        masked_account_number: string;
        ifsc_code: string;
        branch_name: string;
        account_type: string;
        upi_id: string;
        updated_at: string;
      } | null;
    }>("/wallet/bank-details/");
  }

  async upsertWalletBankDetails(payload: {
    account_holder_name: string;
    bank_name: string;
    account_number: string;
    ifsc_code: string;
    branch_name?: string;
    account_type?: string;
    upi_id?: string;
  }) {
    return this.request<{
      bank_details: {
        account_holder_name: string;
        bank_name: string;
        account_number: string;
        masked_account_number: string;
        ifsc_code: string;
        branch_name: string;
        account_type: string;
        upi_id: string;
        updated_at: string;
      };
    }>("/wallet/bank-details/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async createWalletWithdrawalRequest(amount: number, user_note?: string) {
    return this.request<{
      request: any;
    }>("/wallet/withdrawal-request/", {
      method: "POST",
      body: JSON.stringify({ amount, user_note }),
    });
  }

  async getWalletWithdrawalRequests() {
    return this.request<{
      requests: any[];
      count: number;
    }>("/wallet/withdrawal-requests/");
  }

  async cancelWalletWithdrawalRequest(requestId: number) {
    return this.request<{
      request: any;
      message: string;
    }>(`/wallet/withdrawal-requests/${requestId}/cancel/`, {
      method: "POST",
    });
  }

  async getWalletBalance() {
    return this.request<{ balance: string }>('/wallet/balance/');
  }

  /** Sub-wallet balance for equipment's department (booking debit target). Admin may pass userId. */
  async getEquipmentDepartmentWalletBalance(
    equipmentId: number | string,
    userId?: number | string | null,
  ) {
    const q = new URLSearchParams({ equipment_id: String(equipmentId) });
    if (userId != null && String(userId).trim() !== '') {
      q.set('user_id', String(userId));
    }
    return this.request<{
      balance: string;
      has_wallet: boolean;
      department_id: number | null;
      department_name: string;
      department_code: string | null;
      is_zero: boolean;
    }>(`/wallet/equipment-department-balance/?${q.toString()}`);
  }

  /** IITR Faculty: shared-wallet spend / recharges by linked students (optional date + equipment filter). */
  async getFacultyWalletExpenseReport(params: {
    date_from?: string;
    date_to?: string;
    equipment_id?: number;
  }) {
    const q = new URLSearchParams();
    if (params.date_from) q.set('date_from', params.date_from);
    if (params.date_to) q.set('date_to', params.date_to);
    if (params.equipment_id != null) q.set('equipment_id', String(params.equipment_id));
    const qs = q.toString();
    return this.request<FacultyWalletExpenseReportData>(
      `/wallet/faculty-expense-report/${qs ? `?${qs}` : ""}`,
    );
  }

  async creditWallet(amount: number, description?: string) {
    return this.request<{
      wallet: {
        id: number;
        user: number;
        balance: string;
        created_at: string;
        updated_at: string;
      };
      transaction: any;
    }>('/wallet/credit/', {
      method: 'POST',
      body: JSON.stringify({ amount, description }),
    });
  }

  async debitWallet(amount: number, description?: string) {
    return this.request<{
      wallet: {
        id: number;
        user: number;
        balance: string;
        created_at: string;
        updated_at: string;
      };
      transaction: any;
    }>('/wallets/debit/', {
      method: 'POST',
      body: JSON.stringify({ amount, description }),
    });
  }

  async getWalletTransactions() {
    return this.request<{
      transactions: any[];
      count: number;
      total_count: number;
      limit: number;
      offset: number;
    }>('/wallet/transactions/');
  }

  /** Get transactions for a specific sub-wallet (department). */
  async getSubWalletTransactions(departmentId: number, limit = 50, offset = 0) {
    return this.request<{
      sub_wallet: {
        id: number;
        department_id: number;
        department_name: string;
        department_code: string | null;
        balance: string;
      };
      transactions: Array<{
        id: number;
        transaction_type: 'credit' | 'debit';
        amount: string;
        description: string;
        created_at: string;
      }>;
      count: number;
      limit: number;
      offset: number;
    }>(`/wallet/sub-wallets/${departmentId}/transactions/?limit=${limit}&offset=${offset}`);
  }

  /** Departments that have equipment (valid for sub-wallet recharge). */
  async getDepartmentsForRecharge() {
    return this.request<{
      departments: Array<{ id: number; name: string; code: string | null; department_type: string }>;
    }>('/wallet/departments-for-recharge/');
  }

  async createRazorpayOrder(amount: number, departmentId: number) {
    return this.request<{
      order_id: string;
      amount: number;
      currency: string;
      key: string;
      wallet_id: number;
      department_id?: number;
    }>('/wallet/razorpay/create-order/', {
      method: 'POST',
      body: JSON.stringify({ amount, department_id: departmentId }),
    });
  }

  async verifyRazorpayPayment(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
    amount: number
  ) {
    return this.request<{
      wallet: {
        balance: string;
        transactions: any[];
      };
      transaction: any;
      message: string;
    }>('/wallet/razorpay/verify-payment/', {
      method: 'POST',
      body: JSON.stringify({
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: razorpaySignature,
        amount: amount,
      }),
    });
  }

  /** SBIePay: initiate wallet recharge or booking shortfall payment. */
  async initiateSbiepayPayment(payload: {
    purpose: 'WALLET_RECHARGE' | 'BOOKING_SHORTFALL';
    amount: number | string;
    department_id: number;
    booking_id?: number;
  }) {
    return this.request<{
      gateway_url: string;
      encrypt_trans: string;
      merchant_order_ref: string;
      form_method: string;
      form_fields: Record<string, string>;
    }>('/payments/sbiepay/initiate/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getSbiepayTransactionStatus(ref: string) {
    return this.request<{
      merchant_order_ref: string;
      status: string;
      amount: string;
      purpose: string;
      booking_id: number | null;
      verified_at: string | null;
    }>(`/payments/sbiepay/status/?ref=${encodeURIComponent(ref)}`);
  }

  async submitPaymentUtr(payload: {
    utr_reference: string;
    amount: number | string;
    department_id: number;
    purpose: 'WALLET_RECHARGE' | 'BOOKING_SHORTFALL';
    booking_id?: number;
    recharge_request_id?: number;
    payment_date?: string;
  }) {
    return this.request<{ message: string; receipt: unknown }>('/payments/utr/submit/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getFinancePaymentReceipts(params?: { status?: string; department_id?: number }) {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.department_id != null) qs.set('department_id', String(params.department_id));
    const q = qs.toString();
    const endpoint = q ? `/finance/payment-receipts/?${q}` : "/finance/payment-receipts/";
    return this.request<{ receipts: unknown[]; count: number }>(endpoint);
  }

  async processFinancePaymentReceipt(receiptId: number, remarks?: string) {
    return this.request<{ message: string; receipt: unknown }>(
      `/finance/payment-receipts/${receiptId}/process/`,
      { method: 'POST', body: JSON.stringify({ remarks: remarks || '' }) },
    );
  }

  /** Open SBIePay in a new window via auto-submitting POST form. */
  submitSbiepayForm(payload: {
    gateway_url: string;
    form_fields: Record<string, string>;
  }) {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = payload.gateway_url;
    form.target = '_self';
    Object.entries(payload.form_fields).forEach(([k, v]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = k;
      input.value = v;
      form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
  }

  // User roles endpoints
  /** Returns true if user_type is one of admin, manager, operator, finance (matches backend get_admin_panel_codes). */
  isAdminPanelUser(userType: string | number | undefined | null): boolean {
    if (userType == null || userType === undefined) return false;
    const s = String(userType).toLowerCase();
    return ['admin', 'manager', 'operator', 'finance'].includes(s);
  }

  async getUserRoles(userId?: string) {
    const endpoint = userId ? `/user-roles/?user_id=${userId}` : '/user-roles/';
    return this.request<any[]>(endpoint);
  }

  async checkAdminRole(userId: string) {
    return this.request<{ is_admin: boolean }>(`/user-roles/check-admin/?user_id=${encodeURIComponent(userId)}`);
  }

  // User management endpoints (admin only)
  async getUsers() {
    return this.request<any[]>('/users/');
  }

  // User groups (equipment visibility) - admin/manager/operator only
  async getUserGroups() {
    return this.request<{ user_groups: UserGroupSummary[]; count: number }>('/user-groups/');
  }

  async createUserGroup(data: { name: string; code: string; description?: string }) {
    return this.request<UserGroupSummary>('/user-groups/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getUserGroup(id: number) {
    return this.request<UserGroupDetail>(`/user-groups/${id}/`);
  }

  async updateUserGroup(id: number, data: { name?: string; code?: string; description?: string }) {
    return this.request<UserGroupSummary>(`/user-groups/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteUserGroup(id: number) {
    return this.request<{ message: string }>(`/user-groups/${id}/`, {
      method: 'DELETE',
    });
  }

  async getUserGroupMembers(groupId: number) {
    return this.request<{ members: UserGroupMember[]; count: number }>(`/user-groups/${groupId}/members/`);
  }

  async addUserGroupMember(groupId: number, userId: number) {
    return this.request<UserGroupMember>(`/user-groups/${groupId}/members/`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    });
  }

  async removeUserGroupMember(groupId: number, userId: number) {
    return this.request<{ message: string }>(`/user-groups/${groupId}/members/`, {
      method: 'DELETE',
      body: JSON.stringify({ user_id: userId }),
    });
  }

  async getUserGroupEquipment(groupId: number) {
    return this.request<{ equipment: Array<{ equipment_id: number; code: string; name: string; status: string }>; count: number }>(`/user-groups/${groupId}/equipment/`);
  }

  async assignEquipmentToUserGroup(groupId: number, equipmentIds: number[]) {
    return this.request<{ message: string; assigned_count: number }>(`/user-groups/${groupId}/equipment/`, {
      method: 'POST',
      body: JSON.stringify({ equipment_ids: equipmentIds }),
    });
  }

  async unassignEquipmentFromUserGroup(groupId: number, equipmentIds: number[]) {
    return this.request<{ message: string; unassigned_count: number }>(`/user-groups/${groupId}/equipment/`, {
      method: 'DELETE',
      body: JSON.stringify({ equipment_ids: equipmentIds }),
    });
  }

  // Department endpoints
  async getDepartments(
    type?: string,
    groupByType: boolean = false,
    externalSubcategory?: string,
    state?: string,
    internalSubcategory?: string
  ) {
    const params = new URLSearchParams();
    if (type) {
      params.append('type', type);
    }
    if (groupByType) {
      params.append('group_by_type', 'true');
    }
    if (externalSubcategory) {
      params.append('external_subcategory', externalSubcategory);
    }
    if (state) {
      params.append('state', state);
    }
    if (internalSubcategory) {
      params.append('internal_subcategory', internalSubcategory);
    }
    const queryString = params.toString();
    const url = queryString ? `/departments/?${queryString}` : '/departments/';
    return this.request<{ 
      departments: Array<{ 
        id: number; 
        name: string; 
        code: string; 
        department_type: string;
        department_type_display: string;
        verified?: boolean;
      }>; 
      count: number;
      pending_organization_requests?: Array<{ id: number; name: string; verified: boolean }>;
      grouped?: {
        internal: Array<{ id: number; name: string; code: string; department_type: string; department_type_display: string }>;
        external: Array<{ id: number; name: string; code: string; department_type: string; department_type_display: string }>;
      };
    }>(url);
  }

  /**
   * Get separate lists for Educational Institute, Govt R&D, and Industry for a given State/UT.
   * Use this when you need all three lists for one state (e.g. admin or reporting).
   */
  async getDepartmentsBySubcategoryForState(state: string) {
    const params = new URLSearchParams({
      type: 'external',
      state,
      group_by_subcategory: 'true',
    });
    return this.request<{
      state: string;
      by_subcategory: {
        educational_institute: {
          departments: Array<{ id: number; name: string; code: string; verified?: boolean }>;
          pending_organization_requests: Array<{ id: number; name: string; verified: boolean }>;
          count: number;
        };
        govt_rnd: {
          departments: Array<{ id: number; name: string; code: string; verified?: boolean }>;
          pending_organization_requests: Array<{ id: number; name: string; verified: boolean }>;
          count: number;
        };
        industries: {
          departments: Array<{ id: number; name: string; code: string; verified?: boolean }>;
          pending_organization_requests: Array<{ id: number; name: string; verified: boolean }>;
          count: number;
        };
      };
    }>(`/departments/?${params.toString()}`);
  }

  /** Request addition of a new external organization (e.g. Govt R&D) when not found in dropdown. */
  async requestOrganization(payload: {
    name: string;
    state: string;
    external_subcategory?: string;
    email?: string;
    requester_name?: string;
    web_page?: string;
    notes?: string;
  }) {
    return this.request<{ id: number; message: string }>('/departments/request-organization/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // User type endpoints
  async getUserTypes() {
    return this.request<{ user_types: Array<{ code: string; name: string; description: string }> }>('/auth/register/user-types/');
  }

  /** Search IITR Internal Faculty (faculty with internal department) for supervisor selection during signup (public, no auth). Returns name, email, department for verification. */
  async searchFacultyForSignup(query: string, limit: number = 20) {
    return this.request<{
      results: Array<NullableBookingRef & {
        id: number;
        name: string;
        email: string;
        department: string | null;
      }>;
    }>(`/auth/register/search-faculty/?q=${encodeURIComponent(query)}&limit=${limit}`);
  }

  /** Get Indian states and union territories for signup State/UT dropdown (public, no auth). */
  async getIndianStates() {
    return this.request<{ states: Array<{ value: string; label: string; type?: "state" | "union_territory" }> }>('/auth/register/indian-states/');
  }

  async createUser(data: {
    email: string;
    password: string;
    full_name: string;
    role: string;
    department?: number | null;
  }) {
    const body: Record<string, string | number | null> = {
      email: data.email,
      password: data.password,
      full_name: data.full_name,
      role: data.role,
    };
    if (data.department !== undefined && data.department !== null) {
      body.department = data.department;
    }
    return this.request<any>('/users/', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async updateUser(id: string, data: { full_name?: string; name?: string; role?: string; department?: number | null }) {
    const body: Record<string, string | number | null> = {};
    if (data.full_name !== undefined) body.name = data.full_name;
    if (data.name !== undefined) body.name = data.name;
    if (data.role !== undefined) body.user_type = data.role;
    if (data.department !== undefined) body.department = data.department;
    return this.request<any>(`/users/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  async approveUser(userId: string) {
    return this.request<{ message: string; user: any }>(`/users/${userId}/approve/`, {
      method: 'POST',
    });
  }

  async rejectUser(userId: string) {
    return this.request<{ message: string; user: any }>(`/users/${userId}/reject/`, {
      method: 'POST',
    });
  }

  // Notification endpoints
  async getNotifications() {
    return this.request<Array<{
      id: number;
      title: string;
      message: string;
      type: "booking" | "system" | "warning" | "info";
      read: boolean;
      created_at: string;
      link?: string;
    }>>('/notifications/');
  }

  async markNotificationAsRead(id: number) {
    return this.request<any>(`/notifications/${id}/mark-read/`, {
      method: 'POST',
    });
  }

  async markAllNotificationsAsRead() {
    return this.request<any>('/notifications/mark-all-read/', {
      method: 'POST',
    });
  }

  async deleteNotification(id: number) {
    return this.request<any>(`/notifications/${id}/`, {
      method: 'DELETE',
    });
  }

  /** List IMAP folders with message counts (staff only). */
  async listInboxFolders() {
    return this.request<{ folders: Array<{ name: string; count: number }> }>('/inbox-folders/');
  }

  /** Fetch inbox emails via IMAP (staff only). Optional: mailbox, max_count, since. */
  async fetchInboxEmails(params?: { mailbox?: string; max_count?: number; since?: string }) {
    const p: Record<string, string> = {};
    if (params?.mailbox) p.mailbox = params.mailbox;
    if (params?.max_count != null) p.max_count = String(params.max_count);
    if (params?.since) p.since = params.since;
    const q = Object.keys(p).length ? `?${new URLSearchParams(p).toString()}` : '';
    return this.request<{
      emails: Array<{
        uid: string;
        subject: string;
        from: string;
        date: string | null;
        date_raw: string;
        body_plain: string;
        body_html: string;
      }>;
      count: number;
      mailbox_total?: number;
    }>(`/inbox-emails/${q}`);
  }

  /** Parse wallet recharge file (admin users only). POST multipart with key 'file'. Returns { rows, count } with matched user per row. */
  async parseWalletRechargeFile(file: File): Promise<{
    data?: { rows: WalletRechargeParseRow[]; count: number; message?: string };
    error?: string;
  }> {
    const formData = new FormData();
    formData.append('file', file);
    const url = `${this.baseURL.replace(/\/$/, '')}/wallet/parse-recharge-file/`;
    const headers: HeadersInit = { ...(this.getToken() ? { Authorization: `Token ${this.getToken()}` } : {}) };
    const res = await fetch(url, { method: 'POST', headers, body: formData });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { error: (data as any).error || 'Failed to parse file', data: undefined };
    }
    return { data: data as { rows: WalletRechargeParseRow[]; count: number; message?: string }, error: undefined };
  }

  /** Fetch legacy wallet balance for emp_id from legacy MySQL (admin). Uses server LEGACY_MYSQL_* env. */
  async lookupLegacyWalletBalance(
    empId: string,
    options?: {
      batchId?: string;
      department?: 'general' | 'user';
      departmentId?: number | null;
    },
  ): Promise<{ data?: LegacyWalletLookupResult; error?: string }> {
    const url = `${this.baseURL.replace(/\/$/, '')}/wallet/legacy-wallet/balance/`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.getToken() ? { Authorization: `Token ${this.getToken()}` } : {}),
    };
    const body: Record<string, unknown> = {
      emp_id: empId,
      department: options?.department ?? 'general',
    };
    if (options?.batchId) body.batch_id = options.batchId;
    if (options?.departmentId != null) body.department_id = options.departmentId;
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    const payload = data as LegacyWalletLookupResult & { error?: string };
    if (payload.status === 'connection_error' || payload.status === 'not_configured') {
      return { data: payload, error: payload.error };
    }
    if (!res.ok) {
      return { error: payload.error || `HTTP error! status: ${res.status}`, data: undefined };
    }
    return { data: payload, error: undefined };
  }

  /** List all legacy users with non-zero wallet balance (admin). Uses server LEGACY_MYSQL_* env. */
  async listLegacyWalletBalances(): Promise<{ data?: LegacyWalletBalanceListResult; error?: string }> {
    const url = `${this.baseURL.replace(/\/$/, '')}/wallet/legacy-wallet/balances/`;
    const headers: HeadersInit = {
      ...(this.getToken() ? { Authorization: `Token ${this.getToken()}` } : {}),
    };
    const res = await fetch(url, { method: 'GET', headers });
    const data = await res.json().catch(() => ({}));
    const payload = data as LegacyWalletBalanceListResult & { error?: string; status?: string };
    if (payload.status === 'connection_error' || payload.status === 'not_configured') {
      return { data: payload, error: payload.error };
    }
    if (!res.ok) {
      return { error: payload.error || `HTTP error! status: ${res.status}`, data: undefined };
    }
    return { data: payload, error: undefined };
  }

  /** Process (credit) selected parsed recharge rows. Admin only. Credits wallet, sends email to owner, marks processed. */
  async processWalletRechargeRows(rows: WalletRechargeParseRow[], defaultDepartmentId?: number | null): Promise<{
    data?: { credited: number; skipped: number; errors: string[]; processed_receipts: string[] };
    error?: string;
  }> {
    const url = `${this.baseURL.replace(/\/$/, '')}/wallet/process-recharge-rows/`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.getToken() ? { Authorization: `Token ${this.getToken()}` } : {}),
    };
    const body = JSON.stringify({
      rows: rows.map((r) => ({
        date: r.date,
        receipt_no: r.receipt_no,
        name: r.name,
        emp_no: r.emp_no,
        department: r.department,
        amount: r.amount,
        payment: r.payment,
      })),
      default_department_id: defaultDepartmentId ?? null,
    });
    const res = await fetch(url, { method: 'POST', headers, body });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { error: (data as any).error || 'Failed to process rows', data: undefined };
    }
    return {
      data: data as { credited: number; skipped: number; errors: string[]; processed_receipts: string[] },
      error: undefined,
    };
  }

  /** Faculty recharge pipeline (OTP-verified). Admin or accounts-in-charge. filter: all | pending | unmatched_no_parse */
  async getWalletRechargePipelineRequests(
    filter?: "all" | "pending" | "unmatched_no_parse"
  ): Promise<{
    data?: { requests: Record<string, unknown>[]; count: number; filter: string };
    error?: string;
  }> {
    const q =
      filter && filter !== "all" ? `?filter=${encodeURIComponent(filter)}` : "";
    const url = `${this.baseURL.replace(/\/$/, "")}/wallet/recharge-requests/pipeline${q}`;
    const headers: HeadersInit = {
      ...(this.getToken() ? { Authorization: `Token ${this.getToken()}` } : {}),
    };
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 120_000);
    let res: Response;
    try {
      res = await fetch(url, { method: "GET", headers, signal: controller.signal });
    } catch (e) {
      window.clearTimeout(timeoutId);
      const name = e instanceof Error ? e.name : "";
      if (name === "AbortError") {
        return {
          error:
            "Pipeline request timed out or was cancelled. Try again; if it persists, use filter “All” or check the server.",
          data: undefined,
        };
      }
      return {
        error: e instanceof Error ? e.message : "Failed to load pipeline",
        data: undefined,
      };
    }
    window.clearTimeout(timeoutId);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { error: (data as { error?: string }).error || "Failed to load pipeline", data: undefined };
    }
    return {
      data: data as { requests: Record<string, unknown>[]; count: number; filter: string },
      error: undefined,
    };
  }

  /** Get stored recharge parse entries (shared across devices). Admin only. */
  async getWalletRechargeParseEntries(): Promise<{
    data?: { rows: WalletRechargeParseRow[]; count: number };
    error?: string;
  }> {
    const url = `${this.baseURL.replace(/\/$/, '')}/wallet/recharge-parse-entries/`;
    const headers: HeadersInit = {
      ...(this.getToken() ? { Authorization: `Token ${this.getToken()}` } : {}),
    };
    const res = await fetch(url, { method: 'GET', headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { error: (data as { error?: string }).error || 'Failed to load parse entries', data: undefined };
    }
    return { data: data as { rows: WalletRechargeParseRow[]; count: number }, error: undefined };
  }

  /** Merge rows into stored parse entries (upsert by date, receipt_no, emp_no). Admin only. Returns full list. */
  async saveWalletRechargeParseEntries(rows: WalletRechargeParseRow[]): Promise<{
    data?: { rows: WalletRechargeParseRow[]; count: number };
    error?: string;
  }> {
    const url = `${this.baseURL.replace(/\/$/, '')}/wallet/recharge-parse-entries/`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.getToken() ? { Authorization: `Token ${this.getToken()}` } : {}),
    };
    const body = JSON.stringify({
      rows: rows.map((r) => {
        const row: Record<string, unknown> = {
          date: r.date,
          receipt_no: r.receipt_no,
          name: r.name,
          emp_no: r.emp_no,
          department: r.department,
          amount: r.amount,
          payment: r.payment,
        };
        if (typeof r.source_imap_uid === 'string' && r.source_imap_uid.trim() !== '') {
          row.source_imap_uid = r.source_imap_uid.trim();
        }
        return row;
      }),
    });
    const res = await fetch(url, { method: 'POST', headers, body });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { error: (data as { error?: string }).error || 'Failed to save parse entries', data: undefined };
    }
    return { data: data as { rows: WalletRechargeParseRow[]; count: number }, error: undefined };
  }

  /** IMAP: delete message by UID if all parse rows tagged with that UID are processed. Admin only. */
  async walletImapDeleteEmailIfProcessed(params: {
    email: string;
    password: string;
    email_uid: string;
    host?: string;
    port?: number;
    use_ssl?: boolean;
    folder?: string;
  }): Promise<{ data?: { deleted: boolean; email_uid: string }; error?: string }> {
    const url = `${this.baseURL.replace(/\/$/, '')}/wallet/imap-delete-email-if-processed/`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.getToken() ? { Authorization: `Token ${this.getToken()}` } : {}),
    };
    const body = JSON.stringify({
      email: params.email,
      password: params.password,
      email_uid: params.email_uid,
      host: params.host ?? 'imap.gmail.com',
      port: params.port ?? 993,
      use_ssl: params.use_ssl ?? true,
      folder: params.folder ?? 'INBOX',
    });
    const res = await fetch(url, { method: 'POST', headers, body });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { error: (data as { error?: string }).error || 'Failed to delete email', data: undefined };
    }
    return {
      data: data as { deleted: boolean; email_uid: string },
      error: undefined,
    };
  }

  /** Update one stored parse row and, if it matches a user and is unprocessed, credit like process-recharge-rows. Admin only. */
  async applyWalletRechargeParseEntry(payload: {
    id: number;
    date: string | null;
    receipt_no: string;
    name: string;
    emp_no: string;
    department: string;
    amount: string;
    payment: string;
    default_department_id?: number | null;
  }): Promise<{
    data?: {
      row: WalletRechargeParseRow;
      credited: number;
      skipped: number;
      errors: string[];
      processed_receipts: string[];
      matched_recharge_requests: number;
    };
    error?: string;
  }> {
    const url = `${this.baseURL.replace(/\/$/, '')}/wallet/recharge-parse-entry-apply/`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.getToken() ? { Authorization: `Token ${this.getToken()}` } : {}),
    };
    const body = JSON.stringify({
      id: payload.id,
      date: payload.date,
      receipt_no: payload.receipt_no,
      name: payload.name,
      emp_no: payload.emp_no,
      department: payload.department,
      amount: payload.amount,
      payment: payload.payment,
      default_department_id: payload.default_department_id ?? null,
    });
    const res = await fetch(url, { method: 'POST', headers, body });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { error: (data as { error?: string }).error || 'Failed to apply row', data: undefined };
    }
    return {
      data: data as {
        row: WalletRechargeParseRow;
        credited: number;
        skipped: number;
        errors: string[];
        processed_receipts: string[];
        matched_recharge_requests: number;
      },
      error: undefined,
    };
  }

  /** Admin/finance: active projects for a faculty user (manual recharge request from unmatched parse row). */
  async getWalletRechargeTargetUserProjects(userId: number): Promise<{
    data?: { projects: Array<{ id: number; name: string; project_code: string; agency: string }> };
    error?: string;
  }> {
    const url = `${this.baseURL.replace(/\/$/, '')}/wallet/recharge-target-user-projects/?user_id=${encodeURIComponent(String(userId))}`;
    const headers: HeadersInit = {
      ...(this.getToken() ? { Authorization: `Token ${this.getToken()}` } : {}),
    };
    const res = await fetch(url, { method: 'GET', headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { error: (data as { error?: string }).error || 'Failed to load projects', data: undefined };
    }
    return {
      data: data as { projects: Array<{ id: number; name: string; project_code: string; agency: string }> },
      error: undefined,
    };
  }

  /**
   * Admin/finance: unmatched Wallet Recharge History row — create pending recharge request for selected user,
   * notify faculty and accounts (same as post–faculty-OTP flow).
   */
  async createWalletRechargeRequestFromUnmatchedParseRow(payload: {
    parse_entry_id: number;
    user_id: number;
    department_id: number;
    project_id?: number | null;
    note?: string;
  }): Promise<{
    data?: { request: Record<string, unknown>; message: string };
    error?: string;
  }> {
    const url = `${this.baseURL.replace(/\/$/, '')}/wallet/recharge-request-from-unmatched-parse-row/`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.getToken() ? { Authorization: `Token ${this.getToken()}` } : {}),
    };
    const body = JSON.stringify({
      parse_entry_id: payload.parse_entry_id,
      user_id: payload.user_id,
      department_id: payload.department_id,
      project_id: payload.project_id ?? null,
      note: payload.note?.trim() || '',
    });
    const res = await fetch(url, { method: 'POST', headers, body });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        error: (data as { error?: string }).error || 'Failed to create recharge request',
        data: undefined,
      };
    }
    return {
      data: data as { request: Record<string, unknown>; message: string },
      error: undefined,
    };
  }

  /** Admin: users eligible for an individual wallet (for manual recharge). */
  async adminWalletEligibleUsers(search?: string): Promise<{
    data?: { users: Array<{
      id: number;
      name: string;
      email: string;
      emp_id: string;
      user_type: string;
      department_name: string | null;
      department_id: number | null;
      phone_number?: string | null;
      secondary_phone_number?: string | null;
      contact_number?: string | null;
    }>; count: number };
    error?: string;
  }> {
    const q = search != null && search !== '' ? `?search=${encodeURIComponent(search)}` : '';
    const url = `${this.baseURL.replace(/\/$/, '')}/wallet/admin-eligible-users/${q}`;
    const headers: HeadersInit = {
      ...(this.getToken() ? { Authorization: `Token ${this.getToken()}` } : {}),
    };
    const res = await fetch(url, { method: 'GET', headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { error: (data as { error?: string }).error || 'Failed to list users', data: undefined };
    }
    return { data: data as { users: Array<{
      id: number;
      name: string;
      email: string;
      emp_id: string;
      user_type: string;
      department_name: string | null;
      department_id: number | null;
      phone_number?: string | null;
      secondary_phone_number?: string | null;
      contact_number?: string | null;
    }>; count: number }, error: undefined };
  }

  /** Admin: credit wallet manually; creates import + parse rows; emails user (CC office). */
  async adminManualWalletRecharge(payload: {
    user_id: number;
    amount: string;
    department_id: number;
    receipt_no: string;
    date?: string | null;
    payment?: string;
    name?: string;
  }): Promise<{
    data?: { message?: string; rows?: WalletRechargeParseRow[]; processed_receipts?: string[]; errors?: string[] };
    error?: string;
  }> {
    const url = `${this.baseURL.replace(/\/$/, '')}/wallet/admin-manual-recharge/`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.getToken() ? { Authorization: `Token ${this.getToken()}` } : {}),
    };
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { error: (data as { error?: string }).error || 'Manual recharge failed', data: undefined };
    }
    return { data: data as { message?: string; rows?: WalletRechargeParseRow[]; processed_receipts?: string[]; errors?: string[] }, error: undefined };
  }

  /** Clear all stored parse entries. Admin only. */
  async clearWalletRechargeParseEntries(): Promise<{
    data?: { deleted: number; rows: WalletRechargeParseRow[]; count: number };
    error?: string;
  }> {
    const url = `${this.baseURL.replace(/\/$/, '')}/wallet/recharge-parse-entries/`;
    const headers: HeadersInit = {
      ...(this.getToken() ? { Authorization: `Token ${this.getToken()}` } : {}),
    };
    const res = await fetch(url, { method: 'DELETE', headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { error: (data as { error?: string }).error || 'Failed to clear parse entries', data: undefined };
    }
    return { data: data as { deleted: number; rows: WalletRechargeParseRow[]; count: number }, error: undefined };
  }

  /** IMAP: List last 50 emails (or filtered by sender/subject). Admin only. */
  async walletImapListEmails(params: {
    email: string;
    password: string;
    host?: string;
    port?: number;
    use_ssl?: boolean;
    folder?: string;
    sender_filter?: string;
    subject_filter?: string;
  }): Promise<{
    data?: { emails: Array<{ uid: string; subject: string; from_addr: string; date: string }>; count: number };
    error?: string;
  }> {
    const url = `${this.baseURL.replace(/\/$/, '')}/wallet/imap-list-emails/`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.getToken() ? { Authorization: `Token ${this.getToken()}` } : {}),
    };
    const body = JSON.stringify({
      email: params.email,
      password: params.password,
      host: params.host ?? 'imap.gmail.com',
      port: params.port ?? 993,
      use_ssl: params.use_ssl ?? true,
      folder: params.folder ?? 'INBOX',
      sender_filter: params.sender_filter || undefined,
      subject_filter: params.subject_filter || undefined,
    });
    const res = await fetch(url, { method: 'POST', headers, body });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { error: (data as { error?: string }).error || 'Failed to list emails', data: undefined };
    }
    return { data: data as { emails: Array<{ uid: string; subject: string; from_addr: string; date: string }>; count: number }, error: undefined };
  }

  /** IMAP: Fetch email by UID, parse first or specified attachment, return rows. Admin only. */
  async walletImapFetchAndParse(params: {
    email: string;
    password: string;
    email_uid: string;
    attachment_index?: number;
    host?: string;
    port?: number;
    use_ssl?: boolean;
    folder?: string;
  }): Promise<{
    data?: { rows: WalletRechargeParseRow[]; count: number; attachment_name?: string; message?: string };
    error?: string;
  }> {
    const url = `${this.baseURL.replace(/\/$/, '')}/wallet/imap-fetch-and-parse/`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.getToken() ? { Authorization: `Token ${this.getToken()}` } : {}),
    };
    const body = JSON.stringify({
      email: params.email,
      password: params.password,
      email_uid: params.email_uid,
      attachment_index: params.attachment_index,
      host: params.host ?? 'imap.gmail.com',
      port: params.port ?? 993,
      use_ssl: params.use_ssl ?? true,
      folder: params.folder ?? 'INBOX',
    });
    const res = await fetch(url, { method: 'POST', headers, body });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { error: (data as { error?: string }).error || 'Failed to fetch and parse', data: undefined };
    }
    return {
      data: data as { rows: WalletRechargeParseRow[]; count: number; attachment_name?: string; message?: string },
      error: undefined,
    };
  }

  /** IMAP: List attachments for one email by UID. Admin only. */
  async walletImapEmailAttachments(params: {
    email: string;
    password: string;
    email_uid: string;
    host?: string;
    port?: number;
    use_ssl?: boolean;
    folder?: string;
  }): Promise<{
    data?: { attachments: Array<{ index: number; filename: string; size?: number }>; count: number };
    error?: string;
  }> {
    const url = `${this.baseURL.replace(/\/$/, '')}/wallet/imap-email-attachments/`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.getToken() ? { Authorization: `Token ${this.getToken()}` } : {}),
    };
    const body = JSON.stringify({
      email: params.email,
      password: params.password,
      email_uid: params.email_uid,
      host: params.host ?? 'imap.gmail.com',
      port: params.port ?? 993,
      use_ssl: params.use_ssl ?? true,
      folder: params.folder ?? 'INBOX',
    });
    const res = await fetch(url, { method: 'POST', headers, body });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { error: (data as { error?: string }).error || 'Failed to list attachments', data: undefined };
    }
    return {
      data: data as { attachments: Array<{ index: number; filename: string; size?: number }>; count: number },
      error: undefined,
    };
  }

  /** IMAP: Download one attachment by UID and index. Returns base64 content and filename. Admin only. */
  async walletImapDownloadAttachment(params: {
    email: string;
    password: string;
    email_uid: string;
    attachment_index: number;
    host?: string;
    port?: number;
    use_ssl?: boolean;
    folder?: string;
  }): Promise<{
    data?: { content_base64: string; filename: string };
    error?: string;
  }> {
    const url = `${this.baseURL.replace(/\/$/, '')}/wallet/imap-download-attachment/`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.getToken() ? { Authorization: `Token ${this.getToken()}` } : {}),
    };
    const body = JSON.stringify({
      email: params.email,
      password: params.password,
      email_uid: params.email_uid,
      attachment_index: params.attachment_index,
      host: params.host ?? 'imap.gmail.com',
      port: params.port ?? 993,
      use_ssl: params.use_ssl ?? true,
      folder: params.folder ?? 'INBOX',
    });
    const res = await fetch(url, { method: 'POST', headers, body });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { error: (data as { error?: string }).error || 'Failed to download', data: undefined };
    }
    return {
      data: data as { content_base64: string; filename: string },
      error: undefined,
    };
  }

  // Wallet join request endpoints
  async searchFacultyByName(query: string, limit: number = 10) {
    return this.request<{
      results: Array<{
        id: number;
        name: string;
        email: string;
        phone?: string | null;
        profile_picture?: string | null;
        has_wallet: boolean;
        department?: string | null;
        emp_id?: string | null;
      }>;
    }>(`/wallet/search-faculty/?q=${encodeURIComponent(query)}&limit=${limit}`);
  }

  async getFacultyByEmail(email: string) {
    return this.request<{
      faculty: {
        id: number;
        name: string;
        email: string;
        phone?: string | null;
        profile_picture?: string | null;
      };
      has_wallet: boolean;
    }>(`/wallet/faculty-by-email/?email=${encodeURIComponent(email)}`);
  }

  async requestWalletJoin(facultyEmail: string, message?: string) {
    return this.request<{ message: string }>('/wallet/join-request/', {
      method: 'POST',
      body: JSON.stringify({ faculty_email: facultyEmail, message }),
    });
  }

  async getWalletJoinRequests() {
    return this.request<{
      requests: Array<{
        id: number;
        student: number;
        student_name: string;
        student_email: string;
        student_phone?: string | null;
        student_profile_picture?: string | null;
        faculty: number;
        faculty_name: string;
        faculty_email: string;
        faculty_phone?: string | null;
        faculty_profile_picture?: string | null;
        wallet: number;
        status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
        status_display: string;
        message?: string;
        faculty_response?: string;
        created_at: string;
        updated_at: string;
        responded_at: string | null;
      }>;
      count: number;
    }>('/wallet/join-requests/');
  }

  async approveWalletJoinRequest(requestId: number) {
    return this.request<{ message: string }>(`/wallet/join-requests/${requestId}/approve/`, {
      method: 'POST',
    });
  }

  async rejectWalletJoinRequest(requestId: number) {
    return this.request<{ message: string }>(`/wallet/join-requests/${requestId}/reject/`, {
      method: 'POST',
    });
  }

  async cancelWalletJoinRequest(requestId: number) {
    return this.request<{ message: string }>(`/wallet/join-requests/${requestId}/cancel/`, {
      method: 'POST',
    });
  }

  async resendWalletJoinRequestNotification(requestId: number) {
    return this.request<{ message: string }>(`/wallet/join-requests/${requestId}/resend-notification/`, {
      method: 'POST',
    });
  }

  async removeStudentFromWallet(requestId: number, responseMessage?: string) {
    return this.request<{ message: string }>(`/wallet/join-requests/${requestId}/remove/`, {
      method: 'POST',
      body: JSON.stringify({ response_message: responseMessage }),
    });
  }

  /** Faculty only: permanently remove a cancelled join request from the list. */
  async deleteWalletJoinRequest(requestId: number) {
    return this.request<{ message: string }>(`/wallet/join-requests/${requestId}/delete/`, {
      method: 'POST',
    });
  }

  /** Faculty only: permanently remove multiple cancelled join requests at once. */
  async deleteWalletJoinRequestsBulk(requestIds: number[]) {
    return this.request<{
      message: string;
      deleted_count: number;
      requested_count: number;
    }>('/wallet/join-requests/bulk-delete/', {
      method: 'POST',
      body: JSON.stringify({ request_ids: requestIds }),
    });
  }

  // Wallet recharge request endpoints
  async getWalletCreditFacilitySettings() {
    return this.request<{
      balance_threshold_inr: string;
      credit_window_days: number;
      max_credit_inr: string;
    }>('/wallet/credit-facility/settings/', { method: 'GET' });
  }

  /** Faculty offline recharge: server decides if credit-facility popup should appear before send-otp. */
  async getWalletCreditFacilityOfferForRecharge(departmentId: number) {
    const q = new URLSearchParams({ department_id: String(departmentId) });
    return this.request<{
      show_offer: boolean;
      /** False when a temporary credit line is already active for this department (cannot stack). */
      can_activate_new_credit?: boolean;
      balance_threshold_inr: string;
      credit_window_days: number;
      max_credit_inr: string;
      sub_wallet_balance: string;
      reason: string;
    }>(`/wallet/credit-facility/offer-for-recharge/?${q.toString()}`, { method: 'GET' });
  }

  async getWalletCreditFacilityMyStatus() {
    return this.request<{
      items: Array<{
        request_id: number;
        department_id: number | null;
        department_name: string;
        amount: string;
        credit_limit_inr: string | null;
        credit_window_ends_at: string | null;
        credit_facility_status: string;
        sub_wallet_balance: string;
        bookings_blocked: boolean;
      }>;
      /** Departments with a pending recharge that already opted into credit (suppress new credit popup). */
      pending_credit_opt_in_department_ids?: number[];
    }>('/wallet/credit-facility/my-status/', { method: 'GET' });
  }

  async sendUserOtpForRecharge(
    amount: number,
    departmentId: number,
    projectId?: number | null,
    creditFacilityOptedIn?: boolean
  ) {
    return this.request<{
      request_id: number;
      message: string;
    }>('/wallet/recharge-request/send-otp/', {
      method: 'POST',
      body: JSON.stringify({
        amount,
        department_id: departmentId,
        project_id: projectId || null,
        credit_facility_opted_in: Boolean(creditFacilityOptedIn),
      }),
    });
  }

  async createWalletRechargeRequest(requestId: number, userOtp: string) {
    return this.request<{
      request: {
        id: number;
        user: number;
        user_name: string;
        user_email: string;
        wallet: number;
        amount: string;
        project_details?: string;
        status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
        status_display: string;
        user_otp_verified?: boolean;
        sric_notification_sent?: boolean;
        approved_by_email?: string;
        response_message?: string;
        created_at: string;
        updated_at: string;
        responded_at: string | null;
      };
      message: string;
    }>('/wallet/recharge-request/', {
      method: 'POST',
      body: JSON.stringify({ request_id: requestId, user_otp: userOtp }),
    });
  }

  async getWalletRechargeRequests() {
    return this.request<{
      requests: Array<{
        id: number;
        user: number;
        user_name: string;
        user_email: string;
        wallet: number;
        department?: number | null;
        department_id?: number | null;
        department_name?: string | null;
        amount: string;
        project_id?: number | null;
        project_name?: string | null;
        project_code?: string | null;
        project_details?: string;
        status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
        status_display: string;
        user_otp_verified?: boolean;
        sric_notification_sent?: boolean;
        approved_by_email?: string;
        response_message?: string;
        created_at: string;
        updated_at: string;
        responded_at: string | null;
      }>;
      count: number;
    }>('/wallet/recharge-requests/');
  }

  async cancelWalletRechargeRequest(requestId: number) {
    return this.request<{
      message: string;
      deleted_id: number;
    }>(`/wallet/recharge-requests/${requestId}/cancel/`, {
      method: 'POST',
    });
  }

  async resendWalletRechargeNotification(requestId: number) {
    return this.request<{
      message: string;
    }>(`/wallet/recharge-requests/${requestId}/resend-notification/`, {
      method: 'POST',
    });
  }

  /** Faculty: send SRIC Office notification email for a pending recharge (after OTP verified). */
  async sendSricWalletRechargeNotification(requestId: number) {
    return this.request<{
      message: string;
      request: {
        id: number;
        sric_notification_sent?: boolean;
        user_otp_verified?: boolean;
        status: string;
      };
    }>(`/wallet/recharge-requests/${requestId}/send-sric/`, {
      method: 'POST',
    });
  }

  async approveWalletRechargeRequest(requestId: number, responseMessage?: string) {
    return this.request<{
      request: any;
      transaction?: any;
      message: string;
    }>(`/wallet/recharge-requests/${requestId}/approve/`, {
      method: 'POST',
      body: JSON.stringify({
        response_message: responseMessage || undefined,
      }),
    });
  }

  async rejectWalletRechargeRequest(requestId: number, responseMessage: string) {
    return this.request<{
      request: any;
      message: string;
    }>(`/wallet/recharge-requests/${requestId}/reject/`, {
      method: 'POST',
      body: JSON.stringify({
        response_message: responseMessage,
      }),
    });
  }

  // Booking endpoints
  // Booking action endpoints (operator/manager only)
  async completeBooking(bookingId: number, resultFiles?: File[]) {
    if (resultFiles && resultFiles.length > 0) {
      const form = new FormData();
      resultFiles.forEach((file) => form.append('results', file));
      const url = `${this.baseURL}/bookings/${bookingId}/complete/`;
      const headers: HeadersInit = { ...(this.token ? { Authorization: `Token ${this.token}` } : {}) };
      const res = await fetch(url, { method: 'POST', headers, body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { error: (data as { error?: string }).error || `HTTP ${res.status}` };
      }
      return {
        data: data as { message: string; booking: any; uploaded_files?: string[] },
      };
    }
    return this.request<{
      message: string;
      booking: any;
      uploaded_files?: string[];
    }>(`/bookings/${bookingId}/complete/`, {
      method: 'POST',
    });
  }

  async refundBooking(bookingId: number, notes?: string) {
    return this.request<{
      message: string;
      booking: any;
      refund_amount?: string;
      wallet_balance?: string;
    }>(`/bookings/${bookingId}/refund/`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  }

  async markBookingNotUtilized(bookingId: number, sendEmailToWalletOwner: boolean = true) {
    return this.request<{
      message: string;
      booking: any;
    }>(`/bookings/${bookingId}/mark-not-utilized/`, {
      method: 'POST',
      body: JSON.stringify({ send_email_to_wallet_owner: sendEmailToWalletOwner }),
    });
  }

  async absentBooking(bookingId: number, notes?: string) {
    return this.request<{
      message: string;
      booking: any;
    }>(`/bookings/${bookingId}/absent/`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  }

  /** Admin/OIC: flag booking for under-maintenance disruption (no refund; user may reschedule per policy). */
  async bookingMaintenanceDisruption(bookingId: number, notes?: string) {
    return this.request<{
      message: string;
      booking: any;
    }>(`/bookings/${bookingId}/maintenance-disruption/`, {
      method: 'POST',
      body: JSON.stringify({ notes: notes ?? '' }),
    });
  }

  /** Admin/OIC: flag booking for "Other Disruption" (requires reason; emailed to user). */
  async bookingOtherDisruption(bookingId: number, reason: string) {
    return this.request<{
      message: string;
      booking: any;
    }>(`/bookings/${bookingId}/other-disruption/`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  }

  async rescheduleBooking(bookingId: number, startTime: string, endTime: string) {
    return this.request<{
      message: string;
      booking: any;
    }>(`/bookings/${bookingId}/reschedule/`, {
      method: 'POST',
      body: JSON.stringify({ start_time: startTime, end_time: endTime }),
    });
  }

  async cancelBooking(
    bookingId: number,
    refund: boolean = false,
    notes?: string,
    slotIds?: number[],
    reducedInputValues?: Record<string, number | string>
  ) {
    return this.request<{
      message: string;
      booking: any;
      refund_amount?: string;
      partial_cancellation?: boolean;
    }>(`/bookings/${bookingId}/cancel/`, {
      method: 'POST',
      body: JSON.stringify({
        refund,
        notes,
        ...(slotIds && slotIds.length > 0 ? { slot_ids: slotIds } : {}),
        ...(reducedInputValues && Object.keys(reducedInputValues).length > 0
          ? { reduced_input_values: reducedInputValues }
          : {}),
      }),
    });
  }

  async userCancelBooking(
    bookingId: number,
    refund: boolean = false,
    notes?: string,
    slotIds?: number[],
    reducedInputValues?: Record<string, number | string>,
    printAnalysisIds?: string[],
  ) {
    return this.request<{
      message: string;
      booking: any;
      refund_amount?: string;
      partial_cancellation?: boolean;
    }>(`/bookings/${bookingId}/user-cancel/`, {
      method: 'POST',
      body: JSON.stringify({
        refund,
        notes,
        ...(slotIds && slotIds.length > 0 ? { slot_ids: slotIds } : {}),
        ...(reducedInputValues && Object.keys(reducedInputValues).length > 0
          ? { reduced_input_values: reducedInputValues }
          : {}),
        ...(printAnalysisIds && printAnalysisIds.length > 0
          ? { print_analysis_ids: printAnalysisIds }
          : {}),
      }),
    });
  }

  async partialCancelPreview(
    bookingId: number,
    payload: {
      slot_ids?: number[];
      reduced_input_values?: Record<string, number | string>;
      print_analysis_ids?: string[];
    }
  ) {
    return this.request<{
      refund_amount: string;
      new_charge: string;
      new_total_time_minutes: number;
      new_input_values: Record<string, string | boolean | string[] | number>;
      slots_to_release: Array<{ id: number; start_datetime: string | null; end_datetime: string | null }>;
      slots_to_keep_count: number;
      slots_to_release_count: number;
      partial_cancel_mode: "input_reduction" | "slot_selection" | "print_items";
      reduction_field_key: string | null;
      reduction_field_label: string | null;
      current_input_values: Record<string, string | boolean | string[] | number>;
      equipment_profile_type: string | null;
      print_analysis_ids_to_cancel?: string[];
    }>(`/bookings/${bookingId}/partial-cancel-preview/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async userRescheduleBooking(bookingId: number, startTime: string, endTime: string) {
    return this.request<{
      message: string;
      booking: any;
    }>(`/bookings/${bookingId}/user-reschedule/`, {
      method: 'POST',
      body: JSON.stringify({ start_time: startTime, end_time: endTime }),
    });
  }

  async getBookingEvents(bookingId: number) {
    return this.request<{
      booking_id: BookingRef["booking_id"];
      real_booking_id?: BookingRef["real_booking_id"];
      events: BookingEvent[];
      count: number;
    }>(`/bookings/${bookingId}/events/`);
  }

  /** List result files for a booking from S3 Results/{virtual_booking_id}/. Returns exists and presigned download URLs. */
  async getBookingResults(bookingId: number) {
    return this.request<{
      exists: boolean;
      virtual_booking_id: string | null;
      files: Array<{ key: string; name: string; download_url: string }>;
      error?: string;
      code?: string;
      istem_portal_url?: string;
    }>(`/bookings/${bookingId}/results/`);
  }

  async updateBookingIstemFbr(bookingId: number, istem_fbr_number: string) {
    return this.request<{ message: string; booking: unknown }>(`/bookings/${bookingId}/istem-fbr/`, {
      method: "PATCH",
      body: JSON.stringify({ istem_fbr_number }),
    });
  }

  async reviewBookingIstemFbr(bookingId: number, action: "execute" | "invalidate", reason?: string) {
    return this.request<{ message: string; booking: unknown }>(`/bookings/${bookingId}/istem-fbr/review/`, {
      method: "POST",
      body: JSON.stringify({ action, ...(reason != null && reason !== "" ? { reason } : {}) }),
    });
  }

  /** Download all result files for a booking as a single ZIP (folder named with booking ID). Triggers browser download. */
  async downloadBookingResultsZip(
    bookingId: number,
    filename?: string,
    onProgress?: (percent: number) => void
  ): Promise<{ error?: string; errorCode?: string; istem_portal_url?: string }> {
    const token = this.getToken();
    if (!token) return { error: 'Not authenticated' };
    let progress = 3;
    const emitProgress = (value: number) => {
      progress = Math.max(progress, Math.min(99, Math.round(value)));
      onProgress?.(progress);
    };
    onProgress?.(progress);
    const progressTimer = window.setInterval(() => {
      if (progress < 30) progress += 3;
      else if (progress < 65) progress += 2;
      else if (progress < 88) progress += 1;
      else if (progress < 97) progress += 0.35;
      else if (progress < 99) progress += 0.12;
      emitProgress(progress);
    }, 180);
    const base = this.baseURL.endsWith('/') ? this.baseURL.slice(0, -1) : this.baseURL;
    const url = `${base}/bookings/${bookingId}/results/download/`;
    let res: Response;
    try {
      res = await fetch(url, { headers: { Authorization: `Token ${token}` } });
    } catch (error: any) {
      window.clearInterval(progressTimer);
      return { error: error?.message || 'Download failed' };
    }
    if (!res.ok) {
      window.clearInterval(progressTimer);
      const text = await res.text();
      try {
        const j = JSON.parse(text) as { error?: string; code?: string; istem_portal_url?: string };
        return {
          error: j.error || res.statusText,
          errorCode: j.code,
          istem_portal_url: j.istem_portal_url,
        };
      } catch {
        return { error: text || res.statusText };
      }
    }
    let blob: Blob;
    const totalBytes = Number(res.headers.get('Content-Length') || '0');
    if (res.body && totalBytes > 0) {
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          received += value.byteLength;
          const percent = Math.min(99, 10 + Math.round((received / totalBytes) * 89));
          emitProgress(percent);
        }
      }
      blob = new Blob(chunks, { type: res.headers.get('Content-Type') || 'application/zip' });
    } else {
      // When content length is unavailable, keep showing smooth progress via timer above.
      blob = await res.blob();
    }
    window.clearInterval(progressTimer);
    emitProgress(99);
    const name = filename || res.headers.get('Content-Disposition')?.match(/filename="?([^";]+)"?/)?.[1] || `Results_${bookingId}.zip`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    onProgress?.(100);
    window.setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return {};
  }

  async createBookingEventComment(bookingId: number, comment: string, sendNotification: boolean = true) {
    return this.request<{
      message: string;
      event: BookingEvent;
    }>(`/bookings/${bookingId}/events/comment/`, {
      method: 'POST',
      body: JSON.stringify({ comment, send_notification: sendNotification }),
    });
  }

  /** Get sample/slot tracing timeline for a booking. */
  async getBookingSampleTrace(bookingId: number) {
    return this.request<{ sample_trace: SampleTraceEvent[] }>(`/bookings/${bookingId}/sample-trace/`);
  }

  /** Set sample-trace status. Sample Sent: student/faculty/external (booking user); others: admin/OIC/lab only. */
  async setBookingSampleStatus(bookingId: number, status: SampleTraceStatus, sampleIdentifiers?: string, trackingId?: string, reason?: string) {
    const body: Record<string, string> = { status, sample_identifiers: sampleIdentifiers ?? '' };
    if (trackingId !== undefined) body.tracking_id = trackingId;
    if (reason !== undefined) body.reason = reason;
    return this.request<{ message: string; sample_trace: SampleTraceEvent[] }>(
      `/bookings/${bookingId}/sample-trace/set/`,
      { method: 'POST', body: JSON.stringify(body) }
    );
  }

  /** Set booking user reply (text and optional files) to a Sample Rejected or Held at Office event. Only the booking user can set. */
  async setSampleTraceEventReply(bookingId: number, eventId: number, reply: string, files?: File[]): Promise<ApiResponse<{ message: string; sample_trace: SampleTraceEvent[] }>> {
    const endpoint = `/bookings/${bookingId}/sample-trace/${eventId}/reply/`;
    if (files?.length) {
      const form = new FormData();
      form.append('reply', reply);
      files.forEach((f) => form.append('files', f));
      const url = `${this.baseURL.replace(/\/$/, '')}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
      const headers: HeadersInit = { ...(this.getToken() ? { Authorization: `Token ${this.getToken()}` } : {}) };
      const res = await fetch(url, { method: 'POST', headers, body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { error: (data as { error?: string }).error || 'Failed to save reply.', data: null };
      return { error: null, data: data as { message: string; sample_trace: SampleTraceEvent[] } };
    }
    return this.request<{ message: string; sample_trace: SampleTraceEvent[] }>(
      endpoint,
      { method: 'PATCH', body: JSON.stringify({ reply }) }
    );
  }

  async getBooking(bookingId: number) {
    const res = await this.getBookings({ booking_id: bookingId, limit: 1 });
    if (res.error) return { error: res.error };
    const list = (res.data as any)?.bookings ?? [];
    if (!list.length) return { error: "Booking not found." };
    return { data: list[0] };
  }

  async getBookings(params?: {
    user_id?: string | number;
    equipment_id?: string | number;
    booking_id?: number;
    status?: string;
    start_date?: string;
    end_date?: string;
    search?: string;
    user_name?: string;
    supervisor_name?: string;
    /** "internal" (students/faculty) or "external" */
    user_type_filter?: string;
    /** Filter by rating: "unrated", "2_and_below", "3_and_below", "4_and_below", or "5" (admin/OIC/lab only) */
    rating?: string;
    /** Filter I-STEM FBR seal: "verified" or "unverified" (admin/OIC only) */
    istem_fbr?: string;
    ordering?: string;
    limit?: number;
    offset?: number;
    /** Request lightweight list response (table view); omit for full detail */
    list_view?: boolean;
  }) {
    const queryParams = new URLSearchParams();
    
    if (params?.user_id) {
      queryParams.append('user_id', String(params.user_id));
    }
    if (params?.equipment_id) {
      queryParams.append('equipment_id', String(params.equipment_id));
    }
    if (params?.booking_id != null) {
      queryParams.append('booking_id', String(params.booking_id));
    }
    if (params?.status) {
      queryParams.append('status', params.status);
    }
    if (params?.start_date) {
      queryParams.append('start_date', params.start_date);
    }
    if (params?.end_date) {
      queryParams.append('end_date', params.end_date);
    }
    if (params?.search && params.search.trim()) {
      queryParams.append('search', params.search.trim());
    }
    if (params?.user_name && params.user_name.trim()) {
      queryParams.append('user_name', params.user_name.trim());
    }
    if (params?.supervisor_name && params.supervisor_name.trim()) {
      queryParams.append('supervisor_name', params.supervisor_name.trim());
    }
    if (params?.user_type_filter && ['internal', 'external'].includes(params.user_type_filter)) {
      queryParams.append('user_type_filter', params.user_type_filter);
    }
    if (params?.rating && (params.rating === 'unrated' || ['2_and_below', '3_and_below', '4_and_below', '5'].includes(params.rating))) {
      queryParams.append('rating', params.rating);
    }
    if (params?.istem_fbr && ['verified', 'unverified'].includes(params.istem_fbr)) {
      queryParams.append('istem_fbr', params.istem_fbr);
    }
    if (params?.ordering) {
      queryParams.append('ordering', params.ordering);
    }
    if (params?.limit != null) {
      queryParams.append('limit', String(params.limit));
    }
    if (params?.offset != null) {
      queryParams.append('offset', String(params.offset));
    }
    if (params?.list_view === true) {
      queryParams.append('list_view', '1');
    }
    
    const queryString = queryParams.toString();
    const endpoint = queryString ? `/bookings/?${queryString}` : '/bookings/';
    
    return this.request<{
      bookings: Array<BookingRef & {
        user: number;
        user_email: string;
        user_name: string;
        equipment: number;
        equipment_code: string;
        equipment_name: string;
        charge_profile: number;
        user_type_snapshot: string;
        user_type_snapshot_display?: string | null;
        total_time_minutes: number;
        total_hours: number;
        total_charge: string;
        input_values: Record<string, string | boolean | string[]>;
        selected_parameters: any;
        charge_breakdown: Array<{
          amount: number;
          description: string;
        }>;
        status: string;
        status_display: string;
        notes: string;
        start_time: string;
        end_time: string;
        daily_slots: Array<{
          id: number;
          slot_master: number;
          slot_number: number;
          slot_name: string;
          equipment_code: string;
          date: string;
          start_datetime: string;
          end_datetime: string;
          status: string;
          booking: number;
          booking_id: BookingRef["booking_id"];
          real_booking_id?: BookingRef["real_booking_id"];
          created_at: string;
          updated_at: string;
        }>;
        sample_trace?: SampleTraceEvent[];
        created_at: string;
        updated_at: string;
      }>;
      count: number;
      total_count?: number;
      limit?: number;
      offset?: number;
    }>(endpoint);
  }

  async getBookingStats() {
    return this.request<{
      total_bookings: number;
      total_spent: number;
      total_hours: number;
      status_counts: Record<string, number>;
    }>('/bookings/stats/');
  }

  /** Lab Incharge (operator) and OIC (manager) dashboard: filtered booking totals, week view, follow-up queues. */
  async getLabOperatorDashboard(opts?: {
    weekStart?: string;
    period?: 'today' | 'week' | 'month' | 'year' | 'custom';
    dateFrom?: string;
    dateTo?: string;
    /** Scope metrics & week grids to one assigned / OIC-managed equipment. */
    equipmentId?: number;
  }) {
    const p = new URLSearchParams();
    if (opts?.weekStart?.trim()) p.set('week_start', opts.weekStart.trim());
    if (opts?.period) p.set('period', opts.period);
    if (opts?.dateFrom?.trim()) p.set('date_from', opts.dateFrom.trim());
    if (opts?.dateTo?.trim()) p.set('date_to', opts.dateTo.trim());
    if (opts?.equipmentId != null && opts.equipmentId > 0) {
      p.set('equipment_id', String(opts.equipmentId));
    }
    const q = p.toString() ? `?${p.toString()}` : '';
    return this.request<{
      today: string;
      week_start: string;
      week_end: string;
      filter_period: string;
      filter_date_start: string;
      filter_date_end: string;
      overall_booking_total: number;
      overall_booking_booked_total: number;
      overall_booking_completed: number;
      overall_booking_rows: Array<{
        booking_id: number;
        booking_ref: string;
        virtual_booking_id: string;
        equipment_code: string;
        equipment_name: string;
        user_name: string;
        status: string;
        status_display: string;
        start_time: string | null;
        end_time: string | null;
      }>;
      external_booking_total: number;
      external_booking_booked_total: number;
      external_booking_completed: number;
      external_booking_rows: Array<{
        booking_id: number;
        booking_ref: string;
        virtual_booking_id: string;
        equipment_code: string;
        equipment_name: string;
        user_name: string;
        status: string;
        status_display: string;
        start_time: string | null;
        end_time: string | null;
      }>;
      not_utilized_marked_total: number;
      not_utilized_available_total: number;
      not_utilized_focus_booking_id: number | null;
      sample_returned_done_total: number;
      sample_available_to_return_total: number;
      sample_return_focus_booking_id: number | null;
      sample_disposed_done_total: number;
      sample_available_to_dispose_total: number;
      sample_dispose_focus_booking_id: number | null;
      days: Array<{
        date: string;
        is_today: boolean;
        bookings: Array<{
          booking_id: number;
          booking_ref: string;
          equipment_code: string;
          equipment_name: string;
          user_name: string;
          status: string;
          start_time: string | null;
          end_time: string | null;
        }>;
      }>;
      pending_sample_returned_count: number;
      pending_sample_returned_bookings: Array<{
        booking_id: number;
        booking_ref: string;
        equipment_code: string;
        equipment_name: string;
        user_name: string;
        status: string;
        start_time: string | null;
        end_time: string | null;
      }>;
      pending_dispose_count: number;
      pending_dispose_bookings: Array<{
        booking_id: number;
        booking_ref: string;
        equipment_code: string;
        equipment_name: string;
        user_name: string;
        status: string;
        start_time: string | null;
        end_time: string | null;
      }>;
      equipment_ids: number[];
      equipment_summaries: Array<{
        equipment_id: number;
        equipment_code: string;
        equipment_name: string;
      }>;
      pending_not_utilized_count: number;
      pending_not_utilized_bookings: Array<{
        booking_id: number;
        booking_ref: string;
        equipment_code: string;
        equipment_name: string;
        user_name: string;
        status: string;
        start_time: string | null;
        end_time: string | null;
      }>;
      not_utilized_marked_bookings: Array<{
        booking_id: number;
        booking_ref: string;
        virtual_booking_id: string;
        equipment_code: string;
        equipment_name: string;
        user_name: string;
        status: string;
        status_display: string;
        start_time: string | null;
        end_time: string | null;
      }>;
      sample_returned_done_bookings: Array<{
        booking_id: number;
        booking_ref: string;
        virtual_booking_id: string;
        equipment_code: string;
        equipment_name: string;
        user_name: string;
        status: string;
        status_display: string;
        start_time: string | null;
        end_time: string | null;
      }>;
      sample_disposed_done_bookings: Array<{
        booking_id: number;
        booking_ref: string;
        virtual_booking_id: string;
        equipment_code: string;
        equipment_name: string;
        user_name: string;
        status: string;
        status_display: string;
        start_time: string | null;
        end_time: string | null;
      }>;
    }>(`/bookings/lab-operator-dashboard/${q}`);
  }

  async createBooking(data: {
    equipment_id: string | number;
    start_time: string;
    end_time: string;
    total_hours: number;
    total_cost: number;
    status?: string;
    input_values?: Record<string, string | boolean | string[]>;
  }) {
    return this.request<{
      id: number;
      equipment_id: number | string;
      user: number;
      start_time: string;
      end_time: string;
      total_hours: number;
      total_cost: string;
      status: string;
      status_display: string;
      created_at: string;
      updated_at: string;
    }>('/bookings/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async bookEquipment(equipmentId: string | number, data: {
    start_time?: string;
    end_time?: string;
    total_hours?: number;
    total_cost?: number;
    status?: string;
    input_values?: Record<string, string | boolean | string[]>;
    /** Admin only: book on behalf of this user id */
    user_id?: number | string;
    /** When provided, create one booking for exactly these slot IDs (faster, single entry in My Bookings) */
    slot_ids?: number[];
    /** When true, create booking in HOLD status (no wallet debit); used for urgent request "Select Slot" flow */
    create_as_hold?: boolean;
    /** When true and slot_ids are taken, backend may allocate any other available slots (e.g. distributed) for the same duration */
    book_any_available_slots?: boolean;
    /** When book_any_available_slots is true: restrict alternative slots to this week (YYYY-MM-DD, Monday). */
    visible_week_start?: string;
    /** When book_any_available_slots is true: restrict alternative slots to this week (YYYY-MM-DD, Sunday). */
    visible_week_end?: string;
    /** When true with book_any_available_slots, if no alternatives: try reduce requirement to 1 slot (adjust A/B by profile) and book one slot if available. */
    book_even_if_single_slot_available?: boolean;
    /** Explicitly request waitlist push when no slot is selected/available in current weekly window. */
    request_waitlist_without_slot_selection?: boolean;
    /** When false, backend will not push failed booking attempts to waitlist queue. */
    waitlist_on_failure?: boolean;
    /** Optional TA reward points to redeem against this booking charge. */
    reward_points_to_redeem?: number | string;
    /** 3D print: STL analysis id from analyze-stl endpoint */
    print_analysis_id?: string;
    /** 3D print: ZIP batch id when multiple STL files were uploaded */
    print_analysis_batch_id?: string;
  }) {
    return this.request<{
      id: number;
      equipment_id: number | string;
      user: number;
      start_time: string;
      end_time: string;
      total_hours: number;
      total_cost: string;
      status: string;
      status_display: string;
      created_at: string;
      updated_at: string;
      reward?: {
        points_used: string;
        discount_amount: string;
      };
    }>(`/equipments/${equipmentId}/book/`, {
      method: 'POST',
      body: JSON.stringify(data),
    }, ['X-Booking-Perf']);
  }

  async updateBooking(bookingId: number | string, data: {
    status?: string;
    start_time?: string;
    end_time?: string;
  }) {
    return this.request<any>(`/bookings/${bookingId}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /** Update user input values for a booking (only fields marked editing_required, until status is Complete). */
  async updateBookingInputValues(
    bookingId: number,
    inputValues: Record<string, string | number | boolean | string[]>
  ) {
    return this.request<{
      message: string;
      booking: any;
      charge_recalculation_summary?: {
        previous_charge: string;
        new_charge: string;
        refund_amount: string | null;
        extra_amount: string | null;
      };
    }>(
      `/bookings/${bookingId}/input-values/`,
      { method: 'PATCH', body: JSON.stringify({ input_values: inputValues }) }
    );
  }

  /** Admin/OIC: set post-print actual weight and time on a 3D print booking. */
  async updateBookingPrintActuals(
    bookingId: number,
    data: { actual_weight_grams?: number; actual_time_minutes?: number }
  ) {
    return this.request<{
      message: string;
      booking: any;
      print_analysis?: PrintAnalysisResult;
      charge_recalculation_summary?: {
        previous_charge: string;
        new_charge: string;
        refund_amount: string | null;
        extra_amount: string | null;
      };
    }>(`/bookings/${bookingId}/print-actuals/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /** Process pending refund after charge recalculation (credit wallet). */
  async processChargeRecalculationRefund(bookingId: number) {
    return this.request<{ message: string; booking: any }>(
      `/bookings/${bookingId}/process-charge-recalculation-refund/`,
      { method: 'POST' }
    );
  }

  /** Process extra amount to pay after charge recalculation (debit wallet). */
  async processChargeRecalculationPayNow(bookingId: number) {
    return this.request<{ message: string; booking: any }>(
      `/bookings/${bookingId}/process-charge-recalculation-pay-now/`,
      { method: 'POST' }
    );
  }

  /** Submit rating for a booking. Only the booking user can rate. */
  async rateBooking(
    bookingId: number,
    payload:
      | { rating: number; feedback?: string }
      | {
          on_time_operator_availability: boolean;
          laboratory_cleanliness_organization: boolean;
          sample_handling_care: boolean;
          operator_behaviour_professionalism: boolean;
          compliance_booking_request_parameters: boolean;
          feedback?: string;
        }
  ) {
    return this.request<{ message: string; booking: any }>(`/bookings/${bookingId}/rate/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getEquipmentRatings(equipmentId: number, offset = 0, limit = 20) {
    const params = new URLSearchParams();
    params.set('offset', String(offset));
    params.set('limit', String(limit));
    return this.request<{
      equipment_id: number;
      avg_rating: number | null;
      rating_count: number;
      distribution: Record<string, number>;
      reviews: Array<{
        booking_id: BookingRef["booking_id"];
        real_booking_id?: BookingRef["real_booking_id"];
        rating: number;
        feedback: string;
        rated_at: string | null;
        user_id: number;
        user_name: string;
        rating_removed?: boolean;
        rating_removed_at?: string | null;
        rating_removed_reason?: string | null;
      }>;
      total_reviews: number;
      offset: number;
      limit: number;
      is_admin_panel_user: boolean;
    }>(`/equipments/${equipmentId}/ratings/?${params.toString()}`);
  }

  async removeBookingRating(bookingId: number, reason?: string) {
    return this.request<{ message: string; booking_id: BookingRef["booking_id"]; real_booking_id?: BookingRef["real_booking_id"] }>(`/bookings/${bookingId}/rating/remove/`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason ?? '' }),
    });
  }

  async getIcpmsMinStandardsCover(elements: string[]) {
    return this.request<{
      count: number;
      standards: Array<{ id: number; s_no: string; name_of_std: string; list_of_elements?: string }>;
      elements?: string[];
      uncovered?: string[];
      error?: string;
    }>(`/icpms/standards/min-cover/`, {
      method: "POST",
      body: JSON.stringify({ elements }),
    });
  }

  async getIcpmsAvailableStandards(elements?: string[]) {
    return this.request<{
      count: number;
      standards: Array<{
        id: number;
        s_no: string;
        name_of_std: string;
        list_of_elements?: string;
      }>;
    }>(`/icpms/standards/available/`, {
      method: "POST",
      body: JSON.stringify({ elements: elements ?? [] }),
    });
  }

  /** Full ICPMS standards table (all DB columns). */
  async getIcpmsStandardsFullList() {
    return this.request<{
      count: number;
      standards: Array<{
        id: number;
        s_no: string;
        part_no: string;
        name_of_std: string;
        list_of_elements: string;
        concentration: string;
        status: number;
        created_at: string | null;
        updated_at: string | null;
      }>;
    }>(`/icpms/standards/full/`, { method: "GET" });
  }

  /** Get repeat sample eligibility (new flow): can_create_repeat, reason. */
  async getRepeatSampleEligibility(bookingId: number) {
    return this.request<{ can_create_repeat: boolean; reason: string | null }>(
      `/bookings/${bookingId}/repeat-sample-eligibility/`
    );
  }

  /** Create repeat booking (replica of completed booking). Only when enabled by admin/OIC. Pass slot_ids to use chosen slots; omit to use first-available (legacy). */
  async createRepeatBooking(bookingId: number, slotIds?: number[]) {
    const body: { slot_ids?: number[] } = {};
    if (slotIds != null && slotIds.length > 0) body.slot_ids = slotIds;
    return this.request<{ message: string; booking: any; virtual_booking_id: string }>(
      `/bookings/${bookingId}/create-repeat-booking/`,
      { method: 'POST', body: JSON.stringify(body) }
    );
  }

  /** Enable repeat sample for a completed booking. Admin/OIC only. */
  async enableRepeatSample(bookingId: number) {
    return this.request<{ message: string; repeat_sample_enabled: boolean }>(
      `/bookings/${bookingId}/enable-repeat-sample/`,
      { method: 'POST' }
    );
  }

  /** Get repeat sample info for a completed booking: can_request, disclaimer, days_left. (Legacy.) */
  async getRepeatSampleInfo(bookingId: number) {
    return this.request<{
      can_request: boolean;
      disclaimer: string;
      days_left: number | null;
      reason: string | null;
    }>(`/bookings/${bookingId}/repeat-sample-info/`);
  }

  /** Request a repeat sample for a completed booking. Only the booking user. Show disclaimer in UI first. */
  async requestRepeatSample(bookingId: number, userNotes?: string) {
    return this.request<{ message: string; repeat_sample_request: any }>(
      `/bookings/${bookingId}/request-repeat-sample/`,
      { method: 'POST', body: JSON.stringify({ user_notes: userNotes ?? '' }) }
    );
  }

  /** List repeat sample requests (admin/OIC only). */
  async listRepeatSampleRequests(params?: { status?: string }) {
    const sp = new URLSearchParams();
    if (params?.status) sp.append('status', params.status);
    const q = sp.toString();
    return this.request<{ repeat_sample_requests: any[] }>(
      q ? `/repeat-sample-requests/?${q}` : '/repeat-sample-requests/'
    );
  }

  /** Approve repeat sample request – creates free booking and notifies user (admin/OIC only). */
  async approveRepeatSampleRequest(requestId: number) {
    return this.request<{ message: string; repeat_sample_request: any; new_booking: any }>(
      `/repeat-sample-requests/${requestId}/approve/`,
      { method: 'POST' }
    );
  }

  /** Reject repeat sample request (admin/OIC only). */
  async rejectRepeatSampleRequest(requestId: number, adminNotes?: string) {
    return this.request<{ message: string; repeat_sample_request: any }>(
      `/repeat-sample-requests/${requestId}/reject/`,
      { method: 'POST', body: JSON.stringify({ admin_notes: adminNotes ?? '' }) }
    );
  }

  /** Log that the user attempted to book but no slot was allocated (internal users). Used for urgent request eligibility. */
  async logNoSlotAllocation(data: {
    equipment_id: number;
    number_of_samples?: number;
    slots_requested?: number;
    duration_minutes?: number;
  }) {
    return this.request<{ message: string }>('/no-slot-allocation/log/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /** Log every booking submit attempt (success or failure). Comprehensive log for admin/OIC. */
  async logBookingAttempt(data: {
    equipment_id: number;
    outcome: 'SUCCESS' | 'FAILED';
    failure_reason?: string;
    booking_id?: number;
    number_of_samples?: number;
    slots_requested?: number;
    duration_minutes?: number;
  }) {
    return this.request<{ message: string }>('/booking-attempt-logs/log/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /** List booking attempt logs (admin/OIC only). OIC sees only their equipments. */
  async listBookingAttemptLogs(params?: {
    equipment_id?: number;
    user_id?: number;
    department_id?: number;
    outcome?: 'SUCCESS' | 'FAILED';
    date_from?: string;
    date_to?: string;
    failure_reason_contains?: string;
    limit?: number;
    offset?: number;
  }) {
    const sp = new URLSearchParams();
    if (params?.equipment_id != null) sp.append('equipment_id', String(params.equipment_id));
    if (params?.user_id != null) sp.append('user_id', String(params.user_id));
    if (params?.department_id != null) sp.append('department_id', String(params.department_id));
    if (params?.outcome) sp.append('outcome', params.outcome);
    if (params?.date_from) sp.append('date_from', params.date_from);
    if (params?.date_to) sp.append('date_to', params.date_to);
    if (params?.failure_reason_contains) sp.append('failure_reason_contains', params.failure_reason_contains);
    if (params?.limit != null) sp.append('limit', String(params.limit));
    if (params?.offset != null) sp.append('offset', String(params.offset));
    const q = sp.toString();
    const path = q ? `/booking-attempt-logs/?${q}` : '/booking-attempt-logs/';
    return this.request<{
      results: Array<{
        id: number;
        user_id: number;
        user_name: string;
        user_email: string;
        equipment_id: number;
        equipment_code: string;
        equipment_name: string;
        requested_at: string | null;
        outcome: string;
        failure_reason: string;
        number_of_samples: number;
        slots_requested: number;
        duration_minutes: number | null;
        display_booking_id?: string | null;
      }>;
      total_count: number;
      limit: number;
      offset: number;
    }>(path, { method: 'GET' });
  }

  /** Delete a booking attempt log entry (admin/OIC only). */
  async deleteBookingAttemptLog(logId: number) {
    return this.request<void>(`/booking-attempt-logs/${logId}/`, { method: 'DELETE' });
  }

  /** Get quota calculation breakdown for a failed log (quota check failed). Admin/OIC only. */
  async getBookingAttemptLogQuotaBreakdown(logId: number) {
    return this.request<{
      period_start: string;
      period_end: string;
      quota_type: string;
      quota_scope: string;
      limit_minutes: number;
      total_minutes: number;
      summary_message: string;
      events: Array<{
        date: string;
        booking_id: BookingRef["booking_id"];
        real_booking_id?: BookingRef["real_booking_id"];
        equipment_name: string;
        equipment_code: string;
        display_booking_id?: string;
        total_time_minutes: number;
        user_name: string;
      }>;
    }>(`/booking-attempt-logs/${logId}/quota-breakdown/`, { method: 'GET' });
  }

  /** Current user's unsuccessful (FAILED) booking attempts for an equipment in the past 2 weeks (for Request urgent booking popup). */
  async getMyUnsuccessfulBookingAttempts(equipmentId: number) {
    return this.request<{
      entries: Array<{
        id: number;
        requested_at: string | null;
        outcome: string;
        failure_reason: string;
        number_of_samples: number;
        slots_requested: number;
        duration_minutes: number | null;
      }>;
      equipment_id: number;
    }>(`/booking-attempt-logs/my-unsuccessful/?equipment_id=${encodeURIComponent(equipmentId)}`);
  }

  /** Current user's active waitlist entries (shown in My Bookings history). */
  async getMyWaitlistEntries() {
    return this.request<{
      entries: Array<{
        booking_id: BookingRef["booking_id"];
        real_booking_id?: BookingRef["real_booking_id"];
        virtual_booking_id: string;
        user: number;
        user_email: string;
        user_name: string;
        equipment: number;
        equipment_code: string;
        equipment_name: string;
        total_time_minutes: number;
        total_hours: number;
        total_charge: string;
        input_values: Record<string, unknown>;
        selected_parameters: unknown[];
        charge_breakdown: Array<{ amount: number; description: string }>;
        status: "WAITLISTED";
        status_display: "Waitlisted";
        notes: string;
        start_time: string;
        end_time: string;
        daily_slots: unknown[];
        created_at: string | null;
        updated_at: string | null;
        waitlist_entry_id: number;
        waitlist_position: number;
        waitlist_code: string;
        is_waitlist_entry: true;
      }>;
      count: number;
    }>("/waitlist/my/", { method: "GET" });
  }

  /** Cancel current user's waitlist entry by id. */
  async cancelMyWaitlistEntry(entryId: number) {
    return this.request<{ message: string }>(`/waitlist/${entryId}/cancel/`, {
      method: "POST",
    });
  }

  /** Create an urgent booking request (internal users). request_type: NO_SLOT | REVIEWER_URGENT. For REVIEWER_URGENT pass evidence_file. Optional hold_booking_id from "Select Slot" flow. */
  async createUrgentBookingRequest(data: {
    equipment_id: number;
    request_type: 'NO_SLOT' | 'REVIEWER_URGENT';
    disclaimer_accepted: boolean;
    number_of_samples?: number;
    slots_requested?: number;
    duration_minutes?: number;
    evidence_file?: File;
    evidence_original_name?: string;
    /** Faculty narrative for REVIEWER_URGENT (required by API when submitting evidence). */
    reviewer_comment?: string;
    /** When user selected a slot via "Select Slot", pass the hold booking id returned by the hold booking API. */
    hold_booking_id?: number;
  }) {
    const isReviewerUrgent = data.request_type === 'REVIEWER_URGENT' && data.evidence_file;
    if (isReviewerUrgent) {
      const form = new FormData();
      form.append('equipment_id', String(data.equipment_id));
      form.append('request_type', data.request_type);
      form.append('disclaimer_accepted', 'true');
      form.append('number_of_samples', String(data.number_of_samples ?? 1));
      form.append('slots_requested', String(data.slots_requested ?? 1));
      if (data.duration_minutes != null) form.append('duration_minutes', String(data.duration_minutes));
      form.append('evidence_file', data.evidence_file);
      if (data.reviewer_comment != null && data.reviewer_comment !== '') {
        form.append('reviewer_comment', data.reviewer_comment);
      }
      if (data.evidence_original_name) form.append('evidence_original_name', data.evidence_original_name);
      if (data.hold_booking_id != null) form.append('hold_booking_id', String(data.hold_booking_id));
      const url = `${this.baseURL}/urgent-booking-requests/create/`;
      const headers: HeadersInit = { ...(this.token ? { Authorization: `Token ${this.token}` } : {}) };
      const res = await fetch(url, { method: 'POST', headers, body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return { error: (json as { error?: string }).error || `HTTP ${res.status}` };
      return { data: json as { message: string; id: number } };
    }
    return this.request<{ message: string; id: number }>('/urgent-booking-requests/create/', {
      method: 'POST',
      body: JSON.stringify({
        equipment_id: data.equipment_id,
        request_type: data.request_type,
        disclaimer_accepted: data.disclaimer_accepted,
        number_of_samples: data.number_of_samples ?? 1,
        slots_requested: data.slots_requested ?? 1,
        duration_minutes: data.duration_minutes,
        hold_booking_id: data.hold_booking_id,
      }),
    });
  }

  /** List urgent booking requests (admin/OIC only). */
  async listUrgentBookingRequests(params?: { status?: string; limit?: number; offset?: number }) {
    const sp = new URLSearchParams();
    if (params?.status) sp.append('status', params.status);
    if (params?.limit != null) sp.append('limit', String(params.limit));
    if (params?.offset != null) sp.append('offset', String(params.offset));
    const q = sp.toString();
    return this.request<{
      urgent_requests: Array<{
        id: number;
        request_type: string;
        user_id: number;
        user_name: string;
        user_email: string;
        equipment_id: number;
        equipment_code: string;
        equipment_name: string;
        requested_at: string;
        disclaimer_accepted: boolean;
        number_of_samples: number;
        slots_requested: number;
        duration_minutes: number | null;
        evidence_file_url: string | null;
        evidence_original_name: string;
        reviewer_comment?: string;
        wallet_approved_at: string | null;
        wallet_approved_by_name: string | null;
        wallet_notes: string;
        pending_wallet_approval: boolean;
        status: string;
        admin_notes: string;
        decided_at: string | null;
        decided_by_name: string | null;
        expiry_at?: string | null;
        requester_approved_urgent_last_6_months?: Array<{ id: number; requested_at: string | null; decided_at: string | null }>;
        no_slot_log_count: number;
        no_slot_log_entries: Array<{ requested_at: string; number_of_samples: number; slots_requested: number; duration_minutes: number | null }>;
        hold_booking_id: number | null;
        hold_booking_summary: {
          booking_id: BookingRef["booking_id"];
          real_booking_id?: BookingRef["real_booking_id"];
          total_charge: string | null;
          total_time_minutes: number;
          slot_times: Array<{ start: string | null; end: string | null; label?: string | null }>;
          input_values: Record<string, unknown>;
          charge_breakdown?: Array<{ description: string; amount: number }> | null;
        } | null;
      }>;
      total_count: number;
      limit: number;
      offset: number;
    }>(q ? `/urgent-booking-requests/?${q}` : '/urgent-booking-requests/');
  }

  /** Current user's approved urgent requests for an equipment in the past 6 months (for raising/approving decisions). */
  async getApprovedUrgentHistory(equipmentId: number) {
    return this.request<{
      approved_requests: Array<{ id: number; requested_at: string | null; decided_at: string | null }>;
      count: number;
    }>(`/urgent-booking-requests/approved-history/?equipment_id=${encodeURIComponent(equipmentId)}`);
  }

  /** Get single urgent request detail (admin/OIC or supervisor). Same shape as one item from listUrgentBookingRequests. */
  async getUrgentRequestDetail(requestId: number) {
    return this.request<{
      id: number;
      request_type: string;
      user_id: number;
      user_name: string;
      user_email: string;
      equipment_id: number;
      equipment_code: string;
      equipment_name: string;
      requested_at: string;
      disclaimer_accepted: boolean;
      number_of_samples: number;
      slots_requested: number;
      duration_minutes: number | null;
      evidence_file_url: string | null;
      evidence_original_name: string;
      reviewer_comment?: string;
      wallet_approved_at: string | null;
      wallet_approved_by_name: string | null;
      wallet_notes: string;
      pending_wallet_approval: boolean;
      status: string;
      admin_notes: string;
      decided_at: string | null;
      decided_by_name: string | null;
      expiry_at?: string | null;
      requester_approved_urgent_last_6_months?: Array<{ id: number; requested_at: string | null; decided_at: string | null }>;
      no_slot_log_count: number;
      no_slot_log_entries: Array<{ requested_at: string; number_of_samples: number; slots_requested: number; duration_minutes: number | null }>;
      hold_booking_id: number | null;
      hold_booking_summary: {
        booking_id: BookingRef["booking_id"];
        real_booking_id?: BookingRef["real_booking_id"];
        total_charge: string | null;
        total_time_minutes: number;
        slot_times: Array<{ start: string | null; end: string | null; label?: string | null }>;
        input_values: Record<string, unknown>;
        charge_breakdown?: Array<{ description: string; amount: number }> | null;
      } | null;
    }>(`/urgent-booking-requests/${requestId}/detail/`);
  }

  /** List current user's own urgent booking requests (IIT Students / internal users). For dashboard and status view. */
  async listMyUrgentBookingRequests(params?: { status?: string; limit?: number; offset?: number }) {
    const sp = new URLSearchParams();
    if (params?.status != null && params.status !== '') sp.append('status', params.status);
    if (params?.limit != null) sp.append('limit', String(params.limit));
    if (params?.offset != null) sp.append('offset', String(params.offset));
    const q = sp.toString();
    return this.request<{
      urgent_requests: Array<{
        id: number;
        equipment_id: number;
        equipment_code: string;
        equipment_name: string;
        request_type: string;
        status: string;
        requested_at: string | null;
        decided_at: string | null;
        expiry_at: string | null;
        pending_wallet_approval: boolean;
      }>;
      total_count: number;
      limit: number;
      offset: number;
    }>(q ? `/urgent-booking-requests/my/?${q}` : '/urgent-booking-requests/my/');
  }

  /** List urgent requests pending supervisor approval (supervisor only). */
  async listUrgentRequestsWalletPending(params?: { limit?: number; offset?: number }) {
    const sp = new URLSearchParams();
    if (params?.limit != null) sp.append('limit', String(params.limit));
    if (params?.offset != null) sp.append('offset', String(params.offset));
    const q = sp.toString();
    return this.request<{
      urgent_requests: Array<{
        id: number;
        user_name: string;
        user_email: string;
        equipment_name: string;
        equipment_code: string;
        requested_at: string;
        evidence_file_url: string | null;
        evidence_original_name: string;
      }>;
      total_count: number;
      limit: number;
      offset: number;
    }>(q ? `/urgent-booking-requests/wallet-pending/?${q}` : '/urgent-booking-requests/wallet-pending/');
  }

  /** Supervisor: list all urgent requests (pending, approved, rejected). status: pending | approved | rejected | all */
  async listUrgentRequestsWallet(params?: { status?: 'pending' | 'approved' | 'rejected' | 'all'; limit?: number; offset?: number }) {
    const sp = new URLSearchParams();
    if (params?.status != null && params.status !== 'all') sp.append('status', params.status);
    if (params?.limit != null) sp.append('limit', String(params.limit));
    if (params?.offset != null) sp.append('offset', String(params.offset));
    const q = sp.toString();
    return this.request<{
      urgent_requests: Array<{
        id: number;
        user_name: string;
        user_email: string;
        equipment_name: string;
        equipment_code: string;
        requested_at: string;
        status: string;
        wallet_status: 'pending' | 'approved' | 'rejected';
        wallet_approved_at: string | null;
        wallet_approved_by_name: string | null;
        wallet_notes: string;
        evidence_file_url: string | null;
        evidence_original_name: string;
      }>;
      total_count: number;
      limit: number;
      offset: number;
    }>(q ? `/urgent-booking-requests/wallet/?${q}` : '/urgent-booking-requests/wallet/');
  }

  /** Supervisor: approve or reject an urgent request (REVIEWER_URGENT). */
  async walletApproveUrgentBookingRequest(requestId: number, data: { action: 'APPROVE' | 'REJECT'; wallet_notes?: string }) {
    return this.request<{ message: string; id: number; status: string }>(
      `/urgent-booking-requests/${requestId}/wallet-approve/`,
      { method: 'POST', body: JSON.stringify(data) }
    );
  }

  /** URL to view/download evidence file (admin/OIC or Supervisor). */
  getUrgentRequestEvidenceUrl(requestId: number): string {
    const base = this.baseURL.replace(/\/$/, '');
    return `${base}/urgent-booking-requests/${requestId}/evidence/`;
  }

  /** Fetch urgent request evidence with auth and return a blob URL for viewing (admin/OIC or Supervisor). */
  async fetchUrgentRequestEvidenceBlobUrl(requestId: number): Promise<string> {
    const url = this.getUrgentRequestEvidenceUrl(requestId);
    const token = this.getToken();
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        ...(token ? { Authorization: `Token ${token}` } : {}),
        Accept: 'application/pdf,application/octet-stream,*/*',
      },
      credentials: 'omit',
    });
    if (!res.ok) {
      let message = `Failed to load evidence: ${res.status}`;
      try {
        const body = await res.json();
        if (body && typeof body.error === 'string') message = body.error;
      } catch {
        /* ignore */
      }
      throw new Error(message);
    }
    const ct = res.headers.get('content-type')?.split(';')[0]?.trim() || 'application/octet-stream';
    const buf = await res.arrayBuffer();
    const blob = new Blob([buf], { type: ct });
    return URL.createObjectURL(blob);
  }

  /** Get no-slot allocation log for a user (admin/OIC only). */
  async getNoSlotLogForUser(userId: number, equipmentId?: number) {
    const endpoint = equipmentId != null ? `/users/${userId}/no-slot-log/?equipment_id=${equipmentId}` : `/users/${userId}/no-slot-log/`;
    return this.request<{ user_id: number; user_name: string; entries: Array<{ id: number; requested_at: string; equipment_id: number; number_of_samples: number; slots_requested: number; duration_minutes: number | null }> }>(endpoint);
  }

  /** Update urgent booking request status/notes (admin/OIC only). */
  async updateUrgentBookingRequest(requestId: number, data: { status?: 'APPROVED' | 'REJECTED'; admin_notes?: string }) {
    return this.request<{ message: string; id: number; status: string }>(
      `/urgent-booking-requests/${requestId}/`,
      { method: 'PATCH', body: JSON.stringify(data) }
    );
  }

  /** Admin/OIC: delete an urgent booking request (releases hold if still PENDING with hold). */
  async deleteUrgentBookingRequest(requestId: number) {
    return this.request<void>(`/urgent-booking-requests/${requestId}/`, { method: 'DELETE' });
  }

  /** Admin/OIC: get urgent booking validity config (days). Single setting: request valid for this many days. */
  async getUrgentHoldExpiryConfig() {
    return this.request<{ urgent_booking_validity_days: number }>('/urgent-booking-requests/hold-expiry-config/');
  }

  /** Admin/OIC: update urgent booking validity (days). Min 1. */
  async updateUrgentHoldExpiryConfig(data: { urgent_booking_validity_days: number }) {
    return this.request<{ urgent_booking_validity_days: number }>('/urgent-booking-requests/hold-expiry-config/', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // ----- Student equipment operating nominations (semester-wise, supervisor nominates) -----

  /** List semesters for dropdowns. Optional active_only=1 to restrict to active. */
  async getSemesters(params?: { active_only?: boolean }) {
    const sp = new URLSearchParams();
    if (params?.active_only) sp.append('active_only', '1');
    const q = sp.toString();
    return this.request<{
      semesters: Array<{
        id: number;
        code: string;
        name: string;
        start_date: string | null;
        end_date: string | null;
        is_active: boolean;
      }>;
    }>(q ? `/semesters/?${q}` : '/semesters/');
  }

  /** Supervisor: create nomination (student must be their supervised user). Optional ta_call_id to link to an open TA call. */
  async createEquipmentNomination(data: { student_id: number; equipment_id: number; semester_id: number; remarks?: string; ta_call_id?: number }) {
    return this.request<{ nomination: EquipmentNomination }>('/equipment-nominations/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /** Supervisor: list nominations created by current user. Optional filters: semester_id, status. */
  async listMyNominationsAsSupervisor(params?: { semester_id?: number; status?: 'PENDING' | 'APPROVED' | 'REJECTED' }) {
    const sp = new URLSearchParams();
    if (params?.semester_id != null) sp.append('semester_id', String(params.semester_id));
    if (params?.status) sp.append('status', params.status);
    const q = sp.toString();
    return this.request<{ nominations: EquipmentNomination[] }>(
      q ? `/equipment-nominations/my-as-supervisor/?${q}` : '/equipment-nominations/my-as-supervisor/'
    );
  }

  /** Student: list nominations where current user is the student. */
  async listMyNominationsAsStudent() {
    return this.request<{ nominations: EquipmentNomination[] }>('/equipment-nominations/my-as-student/');
  }

  /** Student: submit/upload resume for a nomination (multipart form key: resume or file). */
  async submitNominationResume(nominationId: number, file: File) {
    const formData = new FormData();
    formData.append('resume', file);
    const token = this.getToken();
    const url = `${this.baseURL}/equipment-nominations/${nominationId}/submit-resume/`;
    const headers: HeadersInit = { ...(token ? { Authorization: `Token ${token}` } : {}) };
    const res = await fetch(url, { method: 'POST', body: formData, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { error: (data as { error?: string }).error || `HTTP error! status: ${res.status}` };
    }
    return { data: data as { nomination: EquipmentNomination } };
  }

  /** Download resume for a nomination (student, supervisor, or Admin/OIC). Returns blob for download. */
  async getNominationResumeBlob(nominationId: number): Promise<{ blob?: Blob; error?: string }> {
    const token = this.getToken();
    const url = `${this.baseURL}/equipment-nominations/${nominationId}/resume/`;
    const headers: HeadersInit = { ...(token ? { Authorization: `Token ${token}` } : {}) };
    const res = await fetch(url, { method: 'GET', headers });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { error: (data as { error?: string }).error || `HTTP error! status: ${res.status}` };
    }
    const blob = await res.blob();
    return { blob };
  }

  /** Supervisor: revoke (delete) a PENDING nomination they created. */
  async revokeEquipmentNomination(nominationId: number) {
    return this.request<{ message: string }>(`/equipment-nominations/${nominationId}/revoke/`, { method: 'DELETE' });
  }

  /** Admin/OIC: list all nominations. Filters: semester_id, equipment_id, supervisor_id, status, ta_call_id. OIC sees only their equipment. */
  async listEquipmentNominationsAdmin(params?: {
    semester_id?: number;
    equipment_id?: number;
    supervisor_id?: number;
    status?: 'PENDING' | 'APPROVED' | 'REJECTED';
    ta_call_id?: number;
  }) {
    const sp = new URLSearchParams();
    if (params?.semester_id != null) sp.append('semester_id', String(params.semester_id));
    if (params?.equipment_id != null) sp.append('equipment_id', String(params.equipment_id));
    if (params?.supervisor_id != null) sp.append('supervisor_id', String(params.supervisor_id));
    if (params?.status) sp.append('status', params.status);
    if (params?.ta_call_id != null) sp.append('ta_call_id', String(params.ta_call_id));
    const q = sp.toString();
    return this.request<{ nominations: EquipmentNomination[] }>(
      q ? `/equipment-nominations/admin/?${q}` : '/equipment-nominations/admin/'
    );
  }

  /** Admin/OIC: approve a PENDING nomination. */
  async approveEquipmentNomination(nominationId: number) {
    return this.request<{ nomination: EquipmentNomination }>(`/equipment-nominations/${nominationId}/approve/`, {
      method: 'POST',
    });
  }

  /** Admin/OIC: reject a PENDING nomination. Optional body: { remarks: string }. */
  async rejectEquipmentNomination(nominationId: number, data?: { remarks?: string }) {
    return this.request<{ nomination: EquipmentNomination }>(`/equipment-nominations/${nominationId}/reject/`, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // ----- TA nomination call (OIC/Admin initiates; email to all Faculty) -----

  /** OIC/Admin: create a TA nomination call. OIC only for their equipment; Admin any. Sends email to all Faculty. */
  async createTANominationCall(data: {
    equipment_id: number;
    semester_id: number;
    number_of_operators_required: number;
    eligibility_criteria?: string;
    expected_duty_hours?: string;
    expected_duty_time?: string;
    benefits?: string;
    nomination_deadline: string;
  }) {
    return this.request<{
      ta_call: TANominationCall;
      message: string;
      emails_sent_count: number;
    }>('/ta-nomination-calls/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /** OIC/Admin: list TA nomination calls. Optional filters: semester_id, equipment_id, status. */
  async listTANominationCalls(params?: {
    semester_id?: number;
    equipment_id?: number;
    status?: 'OPEN' | 'CLOSED';
  }) {
    const sp = new URLSearchParams();
    if (params?.semester_id != null) sp.append('semester_id', String(params.semester_id));
    if (params?.equipment_id != null) sp.append('equipment_id', String(params.equipment_id));
    if (params?.status) sp.append('status', params.status);
    const q = sp.toString();
    return this.request<{ ta_calls: TANominationCall[] }>(
      q ? `/ta-nomination-calls/list/?${q}` : '/ta-nomination-calls/list/'
    );
  }

  /** Faculty: list TA nomination calls that are open for nomination (OPEN, deadline not passed). */
  async getOpenTANominationCallsForFaculty() {
    return this.request<{ ta_calls: TANominationCall[] }>('/ta-nomination-calls/open-for-faculty/');
  }

  /** Student: reward points summary (balance + config). */
  async getMyRewardSummary() {
    return this.request<{
      student_id: number;
      points_balance: string;
      currency_per_point: string;
      currency_value_balance: string;
      lifetime_earned_points: string;
      lifetime_redeemed_points: string;
      config: {
        is_enabled: boolean;
        max_redeem_percent_per_booking: string;
        max_redeem_points_per_booking: number;
        min_booking_amount_for_redeem: string;
      };
    }>('/rewards/me/summary/');
  }

  /** Student: reward points ledger/history. */
  async getMyRewardLedger(params?: { entry_type?: string; source_type?: string }) {
    const sp = new URLSearchParams();
    if (params?.entry_type) sp.append('entry_type', params.entry_type);
    if (params?.source_type) sp.append('source_type', params.source_type);
    const q = sp.toString();
    return this.request<{
      count: number;
      entries: Array<{
        id: number;
        entry_type: string;
        points: string;
        currency_value: string;
        source_type: string;
        source_id: number | null;
        description: string | null;
        expires_at: string | null;
        is_expired: boolean;
        created_at: string;
      }>;
    }>(q ? `/rewards/me/ledger/?${q}` : '/rewards/me/ledger/');
  }

  /** Admin/OIC/Operator: list or get per-equipment reward config(s). */
  async getAdminRewardConfigs(equipmentId?: number | string) {
    const q = equipmentId != null ? `?equipment_id=${encodeURIComponent(String(equipmentId))}` : "";
    return this.request<{
      config?: {
        id?: number;
        equipment?: number | null;
        equipment_code?: string;
        equipment_name?: string;
        is_enabled: boolean;
        points_per_duty_hour: string;
        points_per_sample: string;
        currency_per_point: string;
        max_redeem_percent_per_booking: string;
        max_redeem_points_per_booking: number;
        min_booking_amount_for_redeem: string;
        expiry_days: number | null;
        allow_stack_with_other_discounts: boolean;
      };
      configs?: Array<{
        id?: number;
        equipment?: number | null;
        equipment_code?: string;
        equipment_name?: string;
        is_enabled: boolean;
        points_per_duty_hour: string;
        points_per_sample: string;
        currency_per_point: string;
        max_redeem_percent_per_booking: string;
        max_redeem_points_per_booking: number;
        min_booking_amount_for_redeem: string;
        expiry_days: number | null;
        allow_stack_with_other_discounts: boolean;
      }>;
      manageable_equipments?: Array<{
        equipment_id: number;
        equipment_code: string;
        equipment_name: string;
        config_exists: boolean;
      }>;
    }>(`/admin/rewards/config/${q}`);
  }

  /** Admin/OIC/Operator: create or update per-equipment reward config. */
  async updateAdminRewardConfig(
    equipmentId: number | string,
    data: {
      is_enabled?: boolean;
      points_per_duty_hour?: string | number;
      points_per_sample?: string | number;
      currency_per_point?: string | number;
      max_redeem_percent_per_booking?: string | number;
      max_redeem_points_per_booking?: number;
      min_booking_amount_for_redeem?: string | number;
      expiry_days?: number | null;
      allow_stack_with_other_discounts?: boolean;
    }
  ) {
    return this.request<{
      config: {
        id?: number;
        equipment?: number | null;
        equipment_code?: string;
        equipment_name?: string;
        is_enabled: boolean;
        points_per_duty_hour: string;
        points_per_sample: string;
        currency_per_point: string;
        max_redeem_percent_per_booking: string;
        max_redeem_points_per_booking: number;
        min_booking_amount_for_redeem: string;
        expiry_days: number | null;
        allow_stack_with_other_discounts: boolean;
      };
    }>(`/admin/rewards/config/?equipment_id=${encodeURIComponent(String(equipmentId))}`, {
      method: "PATCH",
      body: JSON.stringify({ equipment_id: Number(equipmentId), ...data }),
    });
  }

  /** Admin/OIC: allocate a booking duty to an approved TA nomination. */
  async allocateTAAssignment(data: {
    nomination_id: number;
    booking_id: number;
    expected_hours?: string | number;
    allocation_notes?: string;
  }) {
    return this.request<{ assignment: TAAssignment }>('/ta-assignments/allocate/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /** List TA assignments for current user role (admin/oic/ta student). */
  async listTAAssignments(params?: { status?: string; equipment_id?: number; booking_id?: number }) {
    const sp = new URLSearchParams();
    if (params?.status) sp.append('status', params.status);
    if (params?.equipment_id != null) sp.append('equipment_id', String(params.equipment_id));
    if (params?.booking_id != null) sp.append('booking_id', String(params.booking_id));
    const q = sp.toString();
    return this.request<{ count: number; assignments: TAAssignment[] }>(
      q ? `/ta-assignments/list/?${q}` : '/ta-assignments/list/'
    );
  }

  /** TA student: accept or decline a duty assignment. */
  async respondTAAssignment(assignmentId: number, data: { action: "ACCEPT" | "DECLINE"; remarks?: string }) {
    return this.request<{ assignment: TAAssignment }>(`/ta-assignments/${assignmentId}/respond/`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /** Admin/OIC: cancel an ALLOCATED or ACCEPTED assignment. */
  async cancelTAAssignment(assignmentId: number) {
    return this.request<{ assignment: TAAssignment }>(`/ta-assignments/${assignmentId}/cancel/`, {
      method: 'POST',
    });
  }

  /** Create TA duty log against an accepted assignment. */
  async createTADutyLog(data: {
    assignment_id: number;
    duty_date: string;
    hours_spent?: string | number;
    samples_processed?: number;
    remarks?: string;
  }) {
    return this.request<{ duty_log: TADutyLog }>('/ta-duty-logs/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /** List TA duty logs (role-scoped by backend). */
  async listTADutyLogs(params?: { status?: string; student_id?: number; equipment_id?: number; assignment_id?: number }) {
    const sp = new URLSearchParams();
    if (params?.status) sp.append('status', params.status);
    if (params?.student_id != null) sp.append('student_id', String(params.student_id));
    if (params?.equipment_id != null) sp.append('equipment_id', String(params.equipment_id));
    if (params?.assignment_id != null) sp.append('assignment_id', String(params.assignment_id));
    const q = sp.toString();
    return this.request<{ count: number; duty_logs: TADutyLog[] }>(
      q ? `/ta-duty-logs/list/?${q}` : '/ta-duty-logs/list/'
    );
  }

  /** Admin/OIC/Operator: verify TA duty log and credit rewards. Optional fields amend TA-submitted values before approving. */
  async verifyTADutyLog(
    dutyLogId: number,
    data?: {
      remarks?: string;
      duty_date?: string;
      hours_spent?: string | number;
      samples_processed?: number;
    }
  ) {
    return this.request<{ duty_log: TADutyLog }>(`/ta-duty-logs/${dutyLogId}/verify/`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  }

  /** Admin/OIC/Operator: reject TA duty log. */
  async rejectTADutyLog(dutyLogId: number, data?: { remarks?: string }) {
    return this.request<{ duty_log: TADutyLog }>(`/ta-duty-logs/${dutyLogId}/reject/`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  }

  // Notice Board endpoints (public)
  async getPublicNotices(limit?: number) {
    const params = new URLSearchParams();
    if (limit) {
      params.append('limit', limit.toString());
    }
    params.append('is_active', 'true'); // Only get active notices
    const queryString = params.toString();
    const endpoint = queryString ? `/notices/?${queryString}` : '/notices/';
    
    return this.request<{
      notices: Array<{
        notice_id: number;
        title: string;
        description: string;
        content?: string;
        notice_type: string;
        is_active: boolean;
        priority?: number;
        expiry_date?: string | null;
        created_at: string;
        updated_at: string;
        created_by?: number;
        created_by_name?: string;
      }>;
      count: number;
    }>(endpoint);
  }

  // Notice Board endpoints (admin - requires authentication)
  async createNotice(data: {
    title: string;
    description: string;
    content?: string;
    notice_type?: "info" | "warning" | "urgent";
    is_active?: boolean;
    priority?: number;
  }) {
    return this.request<{
      notice_id: number;
      title: string;
      description: string;
      notice_type: string;
      is_active: boolean;
      created_at: string;
    }>('/notices/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateNotice(noticeId: number | string, data: {
    title?: string;
    description?: string;
    content?: string;
    notice_type?: "info" | "warning" | "urgent";
    is_active?: boolean;
    priority?: number;
  }) {
    return this.request<any>(`/notices/${noticeId}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteNotice(noticeId: number | string) {
    return this.request<{ message: string }>(`/notices/${noticeId}/`, {
      method: 'DELETE',
    });
  }

  // Ticket endpoints
  async getTickets(params?: {
    status?: string;
    ticket_type?: string;
    priority?: string;
    user_id?: string | number;
    assigned_to?: string | number;
  }) {
    const queryParams = new URLSearchParams();
    
    if (params?.status) {
      queryParams.append('status', params.status);
    }
    if (params?.ticket_type) {
      queryParams.append('ticket_type', params.ticket_type);
    }
    if (params?.priority) {
      queryParams.append('priority', params.priority);
    }
    if (params?.user_id) {
      queryParams.append('user_id', String(params.user_id));
    }
    if (params?.assigned_to) {
      queryParams.append('assigned_to', String(params.assigned_to));
    }
    
    const queryString = queryParams.toString();
    const endpoint = queryString ? `/tickets/?${queryString}` : '/tickets/';
    
    return this.request<{
      tickets: Array<{
        ticket_id: number;
        user: number | null;
        user_name: string | null;
        user_email: string | null;
        public_name: string | null;
        public_email: string | null;
        public_phone: string | null;
        ticket_type: string;
        ticket_type_display: string;
        subject: string;
        description: string;
        related_equipment: number | null;
        related_equipment_name: string | null;
        related_equipment_code: string | null;
        related_booking: number | null;
        related_booking_id: number | null;
        status: string;
        status_display: string;
        priority: string;
        priority_display: string;
        assigned_to: number | null;
        assigned_to_name: string | null;
        assigned_to_email: string | null;
        resolution_notes: string | null;
        created_at: string;
        updated_at: string;
        resolved_at: string | null;
        closed_at: string | null;
        comments: Array<{
          comment_id: number;
          ticket: number;
          user: number | null;
          user_name: string | null;
          user_email: string | null;
          comment: string;
          is_internal: boolean;
          created_at: string;
          updated_at: string;
        }>;
        comments_count: number;
      }>;
      count: number;
    }>(endpoint);
  }

  async createTicket(data: {
    public_name?: string;
    public_email?: string;
    public_phone?: string;
    ticket_type: string;
    subject: string;
    description: string;
    related_equipment?: number | null;
    related_booking?: number | null;
  }, attachment?: File | null) {
    if (attachment) {
      const form = new FormData();
      Object.entries(data).forEach(([k, v]) => {
        if (v === undefined || v === null) return;
        form.append(k, String(v));
      });
      form.append('attachment', attachment);

      const url = `${this.baseURL}/tickets/`;
      const headers: HeadersInit = { ...(this.token ? { Authorization: `Token ${this.token}` } : {}) };
      const res = await fetch(url, { method: 'POST', headers, body: form });
      const resData = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Best-effort surface error messages
        const err = (resData as any).error || (resData as any).detail;
        return { error: err || `HTTP ${res.status}` };
      }
      return { data: resData as any };
    }
    return this.request<{
      ticket_id: number;
      user: number | null;
      user_name: string | null;
      user_email: string | null;
      public_name: string | null;
      public_email: string | null;
      public_phone: string | null;
      ticket_type: string;
      ticket_type_display: string;
      subject: string;
      description: string;
      status: string;
      status_display: string;
      priority: string;
      priority_display: string;
      attachment_url?: string | null;
      created_at: string;
    }>('/tickets/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getTicket(ticketId: number | string) {
    return this.request<{
      ticket_id: number;
      user: number | null;
      user_name: string | null;
      user_email: string | null;
      public_name: string | null;
      public_email: string | null;
      public_phone: string | null;
      ticket_type: string;
      ticket_type_display: string;
      subject: string;
      description: string;
      related_equipment: number | null;
      related_equipment_name: string | null;
      related_equipment_code: string | null;
      related_booking: number | null;
      related_booking_id: number | null;
      status: string;
      status_display: string;
      priority: string;
      priority_display: string;
      assigned_to: number | null;
      assigned_to_name: string | null;
      assigned_to_email: string | null;
      resolution_notes: string | null;
      created_at: string;
      updated_at: string;
      resolved_at: string | null;
      closed_at: string | null;
      comments: Array<{
        comment_id: number;
        ticket: number;
        user: number | null;
        user_name: string | null;
        user_email: string | null;
        comment: string;
        is_internal: boolean;
        created_at: string;
        updated_at: string;
      }>;
      comments_count: number;
    }>(`/tickets/${ticketId}/`);
  }

  async updateTicket(ticketId: number | string, data: {
    status?: string;
    priority?: string;
    assigned_to?: number | null;
    resolution_notes?: string;
    description?: string;
  }) {
    return this.request<any>(`/tickets/${ticketId}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getTicketComments(ticketId: number | string) {
    return this.request<{
      comments: Array<{
        comment_id: number;
        ticket: number;
        user: number | null;
        user_name: string | null;
        user_email: string | null;
        comment: string;
        is_internal: boolean;
        created_at: string;
        updated_at: string;
      }>;
      count: number;
    }>(`/tickets/${ticketId}/comments/`);
  }

  async createTicketComment(ticketId: number | string, comment: string, isInternal: boolean = false) {
    return this.request<{
      comment_id: number;
      ticket: number;
      user: number | null;
      user_name: string | null;
      user_email: string | null;
      comment: string;
      is_internal: boolean;
      created_at: string;
      updated_at: string;
    }>(`/tickets/${ticketId}/comments/create/`, {
      method: 'POST',
      body: JSON.stringify({ comment, is_internal: isInternal }),
    });
  }

  // Ticket Type endpoints (returns constants)
  async getTicketTypes() {
    return this.request<{
      ticket_types: Array<{
        code: string;
        name: string;
      }>;
      count: number;
    }>('/ticket-types/');
  }

  /** Virtual chat agent: send message, get reply; complex queries create a support ticket. */
  async chatAgent(params: {
    message: string;
    public_name?: string;
    public_email?: string;
  }) {
    return this.request<{ reply: string; ticket_id: number | null }>('/chat-agent/', {
      method: 'POST',
      body: JSON.stringify({
        message: params.message,
        ...(params.public_name != null && { public_name: params.public_name }),
        ...(params.public_email != null && { public_email: params.public_email }),
      }),
    });
  }

  // Project endpoints
  async getProjects() {
    return this.request<{
      projects: Array<{
        id: number;
        name: string;
        project_code: string;
        agency: string;
        start_date: string | null;
        end_date: string | null;
        is_active: boolean;
        is_expired: boolean;
        faculty: number;
        created_at: string;
        updated_at: string;
      }>;
      count: number;
    }>('/projects/');
  }

  async getProject(projectId: number | string) {
    return this.request<{
      id: number;
      name: string;
      project_code: string;
      agency: string;
      start_date: string | null;
      end_date: string | null;
      is_active: boolean;
      is_expired: boolean;
      faculty: number;
      created_at: string;
      updated_at: string;
    }>(`/projects/${projectId}/`);
  }

  async createProject(data: {
    name: string;
    project_code: string;
    agency: string;
    start_date?: string | null;
    end_date?: string | null;
  }) {
    return this.request<{
      id: number;
      name: string;
      project_code: string;
      agency: string;
      start_date: string | null;
      end_date: string | null;
      is_active: boolean;
      is_expired: boolean;
      faculty: number;
      created_at: string;
      updated_at: string;
    }>('/projects/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProject(projectId: number | string, data: {
    name?: string;
    project_code?: string;
    agency?: string;
    start_date?: string | null;
    end_date?: string | null;
    is_active?: boolean;
  }) {
    return this.request<{
      id: number;
      name: string;
      project_code: string;
      agency: string;
      start_date: string | null;
      end_date: string | null;
      is_active: boolean;
      is_expired: boolean;
      faculty: number;
      created_at: string;
      updated_at: string;
    }>(`/projects/${projectId}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteProject(projectId: number | string) {
    return this.request<void>(`/projects/${projectId}/delete/`, {
      method: 'DELETE',
    });
  }

  // Inventory APIs
  async getInventoryItems(activeOnly = true) {
    const q = new URLSearchParams();
    q.set("active_only", activeOnly ? "1" : "0");
    return this.request<{
      items: Array<{
        item_id: number;
        item_code: string;
        name: string;
        category: "MAS" | "MIA_LLTA" | "CS";
        uom: string;
        specification: string;
        active: boolean;
      }>;
    }>(`/inventory/items/?${q.toString()}`, { method: "GET" });
  }

  async createInventoryItem(payload: {
    name: string;
    category: "MAS" | "MIA_LLTA" | "CS";
    uom: string;
    specification?: string;
    active?: boolean;
  }) {
    return this.request<{
      item_id: number;
      item_code: string;
      name: string;
      category: "MAS" | "MIA_LLTA" | "CS";
      uom: string;
      specification: string;
      active: boolean;
    }>("/inventory/items/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getInventoryEquipmentStock(equipmentId: number | string) {
    return this.request<{
      equipment_id: number;
      configured_items: Array<Record<string, unknown>>;
      stock: Array<{
        id: number;
        equipment: number;
        item: {
          item_id: number;
          item_code: string;
          name: string;
          category: string;
          uom: string;
        };
        current_qty: string;
        updated_at: string;
      }>;
    }>(`/inventory/equipments/${equipmentId}/stock/`, { method: "GET" });
  }

  async addInventoryStock(payload: {
    equipment: number;
    item: number;
    quantity: string;
    unit_cost?: string;
    remarks?: string;
  }) {
    return this.request<Record<string, unknown>>("/inventory/stock/add/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getInventoryRequests(params?: { equipment_id?: number | string; status?: string }) {
    const q = new URLSearchParams();
    if (params?.equipment_id != null) q.set("equipment_id", String(params.equipment_id));
    if (params?.status) q.set("status", params.status);
    return this.request<{
      requests: Array<{
        request_id: number;
        request_no: string;
        equipment: number;
        requested_by: number;
        request_type: "CONSUMABLE" | "NON_CONSUMABLE" | "MIXED";
        status: string;
        justification: string;
        required_by_date: string | null;
        lines: Array<{
          id: number;
          item: number;
          item_detail?: { item_id: number; item_code: string; name: string; uom: string };
          requested_qty: string;
          approved_qty: string;
          issued_qty: string;
          remarks?: string;
        }>;
      }>;
    }>(`/inventory/requests/${q.toString() ? `?${q.toString()}` : ""}`, { method: "GET" });
  }

  async createInventoryRequest(payload: {
    equipment: number;
    request_type: "CONSUMABLE" | "NON_CONSUMABLE" | "MIXED";
    status?: "DRAFT" | "SUBMITTED";
    justification?: string;
    required_by_date?: string;
    lines: Array<{
      item: number;
      requested_qty: string;
      approved_qty?: string;
      issued_qty?: string;
      estimated_unit_cost?: string;
      remarks?: string;
    }>;
  }) {
    return this.request<Record<string, unknown>>("/inventory/requests/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async decideInventoryRequest(requestId: number | string, payload: { action: "APPROVE" | "REJECT"; decision_note?: string }) {
    return this.request<Record<string, unknown>>(`/inventory/requests/${requestId}/decide/`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async issueInventoryRequest(
    requestId: number | string,
    payload: { lines: Array<{ line_id: number; issue_qty: string; remarks?: string; serial_no?: string; issued_to?: number; condition_on_issue?: string }> },
  ) {
    return this.request<Record<string, unknown>>(`/inventory/requests/${requestId}/issue/`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  // Procurement workflow APIs
  async getProcurementRequests(params?: { equipment_id?: number | string; status?: string }) {
    const q = new URLSearchParams();
    if (params?.equipment_id != null) q.set("equipment_id", String(params.equipment_id));
    if (params?.status) q.set("status", params.status);
    return this.request<{ requests: Array<Record<string, unknown>> }>(
      `/procurement/requests/${q.toString() ? `?${q.toString()}` : ""}`,
      { method: "GET" },
    );
  }

  async createProcurementRequest(payload: {
    equipment: number;
    remarks?: string;
    lines: Array<{
      item_master?: number;
      manual_item_name?: string;
      classification: "MAS" | "MIA_LLTA" | "CS";
      quantity: string;
      tentative_unit_cost: string;
    }>;
  }) {
    return this.request<Record<string, unknown>>("/procurement/requests/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async officeVerifyProcurementRequest(
    requestId: number | string,
    payload: { decision: "VERIFY" | "REJECT"; comments?: string; line_corrections?: Array<Record<string, unknown>> },
  ) {
    return this.request<Record<string, unknown>>(`/procurement/requests/${requestId}/office-verify/`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async storeApproveProcurementRequest(
    requestId: number | string,
    payload: { decision: "APPROVE" | "REJECT"; head_approval_mode?: "OFFLINE" | "EMAIL" | "NOT_REQUIRED"; comments?: string },
  ) {
    return this.request<Record<string, unknown>>(`/procurement/requests/${requestId}/store-approve/`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async headApproveProcurementRequest(requestId: number | string, payload: { decision: "APPROVE" | "REJECT"; comments?: string }) {
    return this.request<Record<string, unknown>>(`/procurement/requests/${requestId}/head-approve/`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async markProcurementPurchaseComplete(requestId: number | string, payload: { comments?: string; invoice_file?: File | null }) {
    const token = this.getToken();
    if (!token) return { error: "Not authenticated" };
    const formData = new FormData();
    if (payload.comments) formData.append("comments", payload.comments);
    if (payload.invoice_file) formData.append("invoice_file", payload.invoice_file);
    const url = `${this.baseURL}/procurement/requests/${requestId}/purchase-complete/`;
    const res = await fetch(url, { method: "POST", headers: { Authorization: `Token ${token}` }, body: formData });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: (data as any).error || `HTTP ${res.status}` };
    return { data };
  }

  async markProcurementOfficeSeen(requestId: number | string, payload?: { comments?: string }) {
    return this.request<Record<string, unknown>>(`/procurement/requests/${requestId}/office-seen/`, {
      method: "POST",
      body: JSON.stringify(payload || {}),
    });
  }

  async oicEndorseProcurementRequest(
    requestId: number | string,
    payload: { decision?: "ENDORSE" | "REJECT"; comments?: string },
  ) {
    return this.request<Record<string, unknown>>(`/procurement/requests/${requestId}/oic-endorse/`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getEquipmentLifecycleEquipmentChoices() {
    return this.request<{ equipments: Array<{ equipment_id: number; code?: string; name?: string }> }>(
      "/equipment/lifecycle/equipment-choices/",
      { method: "GET" },
    );
  }

  async getEquipmentLifecycle(equipmentId: number | string) {
    return this.request<Record<string, unknown>>(`/equipment/${equipmentId}/lifecycle/`, { method: "GET" });
  }

  async patchEquipmentLifecycle(equipmentId: number | string, payload: Record<string, unknown>) {
    return this.request<Record<string, unknown>>(`/equipment/${equipmentId}/lifecycle/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async createEquipmentAmcContract(equipmentId: number | string, formData: FormData) {
    const token = this.getToken();
    if (!token) return { error: "Not authenticated" };
    const url = `${this.baseURL}/equipment/${equipmentId}/amc-contracts/`;
    const res = await fetch(url, { method: "POST", headers: { Authorization: `Token ${token}` }, body: formData });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: (data as { error?: string }).error || `HTTP ${res.status}` };
    return { data };
  }

  async createEquipmentExpense(equipmentId: number | string, payload: Record<string, unknown>) {
    return this.request<Record<string, unknown>>(`/equipment/${equipmentId}/expenses/`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getEquipmentWriteOffRequests(params?: { equipment_id?: number | string; status?: string }) {
    const q = new URLSearchParams();
    if (params?.equipment_id != null) q.set("equipment_id", String(params.equipment_id));
    if (params?.status) q.set("status", params.status);
    return this.request<{ requests: Array<Record<string, unknown>> }>(
      `/equipment/write-off-requests/${q.toString() ? `?${q.toString()}` : ""}`,
      { method: "GET" },
    );
  }

  async createEquipmentWriteOffRequest(payload: {
    equipment: number;
    reason: string;
    asset_classification?: string;
    estimated_residual_value?: string | null;
  }) {
    return this.request<Record<string, unknown>>("/equipment/write-off-requests/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async equipmentWriteOffOfficeAction(writeOffId: number | string, payload: { decision?: "FORWARD" | "REJECT"; comments?: string }) {
    return this.request<Record<string, unknown>>(`/equipment/write-off-requests/${writeOffId}/office-action/`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async equipmentWriteOffStoreAction(writeOffId: number | string, payload: { decision?: "FORWARD" | "REJECT"; comments?: string }) {
    return this.request<Record<string, unknown>>(`/equipment/write-off-requests/${writeOffId}/store-action/`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async equipmentWriteOffHeadAction(writeOffId: number | string, payload: { decision?: "APPROVE" | "REJECT"; comments?: string }) {
    return this.request<Record<string, unknown>>(`/equipment/write-off-requests/${writeOffId}/head-action/`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async equipmentWriteOffExecute(writeOffId: number | string, payload?: { comments?: string }) {
    return this.request<Record<string, unknown>>(`/equipment/write-off-requests/${writeOffId}/execute/`, {
      method: "POST",
      body: JSON.stringify(payload || {}),
    });
  }

  // Admin dashboard CRUD (admin-only API; no Django Admin login required)
  getAdminEndpoint(section: string): string {
    const path = ADMIN_SECTION_ENDPOINTS[section];
    if (!path) throw new Error(`Unknown admin section: ${section}`);
    return `/${path}/`;
  }

  async adminList<T = unknown>(section: string, params?: Record<string, string>) {
    const endpoint = this.getAdminEndpoint(section);
    const q = params && Object.keys(params).length ? `?${new URLSearchParams(params).toString()}` : '';
    return this.request<T[]>(`${endpoint}${q}`, { method: 'GET' });
  }

  /** Admin: list equipment with optional search and filters (mirrors Django admin list filters). */
  async adminEquipmentList(params?: { search?: string; status?: string; profile_type?: string; category?: string; equipment_group?: string }) {
    const p: Record<string, string> = {};
    if (params?.search) p.search = params.search;
    if (params?.status) p.status = params.status;
    if (params?.profile_type) p.profile_type = params.profile_type;
    if (params?.category) p.category = params.category;
    if (params?.equipment_group) p.equipment_group = params.equipment_group;
    return this.adminList<Record<string, unknown>>('equipment', p);
  }

  async adminGet<T = unknown>(section: string, id: number | string) {
    const endpoint = this.getAdminEndpoint(section);
    return this.request<T>(`${endpoint}${id}/`, { method: 'GET' });
  }

  async adminPatch<T = unknown>(section: string, id: number | string, data: Record<string, unknown>) {
    const endpoint = this.getAdminEndpoint(section);
    return this.request<T>(`${endpoint}${id}/`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  /** Admin: list organization requests + standalone external departments (admin-added, status Approved). */
  async listOrganizationRequests(): Promise<ApiResponse<{
    results?: Array<{
      id: number;
      name: string;
      approved_name: string;
      state: string;
      state_display: string;
      external_subcategory: string;
      email: string | null;
      requester_name?: string;
      web_page?: string;
      notes: string;
      status: string;
      status_display: string;
      created_department: number | null;
      approved_by: number | null;
      created_at: string;
      updated_at: string;
    }>;
    standalone_departments?: Array<{
      id: string;
      type: 'standalone_department';
      department_id: number;
      name: string;
      approved_name: string;
      state: string;
      state_display: string;
      external_subcategory: string;
      email: null;
      requester_name?: string;
      web_page?: string;
      notes: string;
      status: string;
      status_display: string;
      created_department: number;
      approved_by: null;
      created_at: string | null;
      updated_at: string | null;
    }>;
  }>> {
    return this.adminList('organizationRequests') as Promise<ApiResponse<{
      results?: Array<{
        id: number;
        name: string;
        approved_name: string;
        state: string;
        state_display: string;
        external_subcategory: string;
        email: string | null;
        requester_name?: string;
        web_page?: string;
        notes: string;
        status: string;
        status_display: string;
        created_department: number | null;
        approved_by: number | null;
        created_at: string;
        updated_at: string;
      }>;
      standalone_departments?: Array<{
        id: string;
        type: 'standalone_department';
        department_id: number;
        name: string;
        approved_name: string;
        state: string;
        state_display: string;
        external_subcategory: string;
        email: null;
        requester_name?: string;
        web_page?: string;
        notes: string;
        status: string;
        status_display: string;
        created_department: number;
        approved_by: null;
        created_at: string | null;
        updated_at: string | null;
      }>;
    }>>;
  }

  /** Admin: update organization request name (name or approved_name). */
  async updateOrganizationRequest(id: number, data: { name?: string; approved_name?: string }) {
    return this.adminPatch<unknown>('organizationRequests', id, data);
  }

  /** Admin: approve organization request (creates external department and links users). */
  async approveOrganizationRequest(id: number) {
    const endpoint = this.getAdminEndpoint('organizationRequests');
    return this.request<{ detail: string; created_department_id?: number }>(`${endpoint}${id}/approve/`, { method: 'POST' });
  }

  /** Admin: reject organization request. */
  async rejectOrganizationRequest(id: number) {
    const endpoint = this.getAdminEndpoint('organizationRequests');
    return this.request<{ detail: string }>(`${endpoint}${id}/reject/`, { method: 'POST' });
  }

  /** Admin: create external department (name + state + type). Department is approved (no OrganizationRequest). */
  async createExternalDepartment(data: { name: string; state: string; external_subcategory: string }) {
    return this.adminCreate<{ id: number; name: string }>('departments', {
      name: data.name.trim(),
      department_type: 'external',
      state: data.state || null,
      external_subcategory: data.external_subcategory || null,
    });
  }

  /** Admin: bulk upload external departments via Excel (.xlsx). Returns created count and per-row errors. */
  async bulkUploadExternalDepartments(file: File): Promise<ApiResponse<{
    created: number;
    errors: Array<{ row: number; message: string }>;
    message: string;
  }>> {
    const endpoint = `${this.getAdminEndpoint('departments')}bulk-upload-external/`;
    const formData = new FormData();
    formData.append('file', file);
    const url = `${this.baseURL}${endpoint}`;
    const headers: HeadersInit = { ...(this.getToken() ? { Authorization: `Token ${this.getToken()}` } : {}) };
    const res = await fetch(url, { method: 'POST', headers, body: formData });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { error: (data as { error?: string }).error || `HTTP ${res.status}`, data: undefined as never };
    }
    return { data: data as { created: number; errors: Array<{ row: number; message: string }>; message: string } };
  }

  /** Admin: download Excel template for bulk upload of external departments. Triggers browser download. */
  async downloadExternalDepartmentsTemplate(): Promise<{ error?: string }> {
    const token = this.getToken();
    if (!token) return { error: 'Not authenticated' };
    const endpoint = `${this.getAdminEndpoint('departments')}bulk-upload-external-template/`;
    const url = `${this.baseURL}${endpoint}`;
    const res = await fetch(url, { method: 'GET', headers: { Authorization: `Token ${token}` } });
    if (!res.ok) {
      const text = await res.text();
      try {
        const j = JSON.parse(text);
        return { error: (j as { error?: string }).error || `HTTP ${res.status}` };
      } catch {
        return { error: `HTTP ${res.status}` };
      }
    }
    const blob = await res.blob();
    const name = res.headers.get('Content-Disposition')?.match(/filename="?([^";]+)"?/)?.[1] || 'external-departments-template.xlsx';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
    return {};
  }

  /** Admin: get calendar colors for weekly window (slot states + holiday + weekend). */
  async getAdminCalendarColors() {
    const endpoint = this.getAdminEndpoint('calendarColors');
    return this.request<{
      slot_colors: Record<string, string>;
      holiday_default: string;
      saturday_color?: string;
      sunday_color?: string;
      external_gst_percent?: number;
    }>(endpoint, { method: 'GET' });
  }

  /** Admin: update calendar colors for weekly window. */
  async updateAdminCalendarColors(payload: {
    slot_colors?: Record<string, string>;
    holiday_default?: string;
    saturday_color?: string;
    sunday_color?: string;
    external_gst_percent?: number;
  }) {
    const endpoint = this.getAdminEndpoint('calendarColors');
    return this.request<{
      slot_colors: Record<string, string>;
      holiday_default: string;
      saturday_color?: string;
      sunday_color?: string;
      external_gst_percent?: number;
    }>(`${endpoint}update/`, { method: 'PATCH', body: JSON.stringify(payload) });
  }

  /** Admin: get internal user slot window setting (common for all equipment). */
  async getInternalSlotWindow() {
    const endpoint = this.getAdminEndpoint('internalSlotWindow');
    return this.request<{ reference_weekday: number | null; reference_time: string | null }>(endpoint, { method: 'GET' });
  }

  /** Admin: update internal user slot window setting. */
  async updateInternalSlotWindow(payload: { reference_weekday?: number | null; reference_time?: string | null }) {
    const endpoint = this.getAdminEndpoint('internalSlotWindow');
    return this.request<{ reference_weekday: number | null; reference_time: string | null }>(`${endpoint}update/`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  /** Admin: equipment utilization report data (date range + optional equipment filter). */
  async getEquipmentReportData(params?: { date_from?: string; date_to?: string; equipment_id?: number[] }) {
    const q = new URLSearchParams();
    if (params?.date_from) q.set('date_from', params.date_from);
    if (params?.date_to) q.set('date_to', params.date_to);
    if (params?.equipment_id?.length) params.equipment_id.forEach((id) => q.append('equipment_id', String(id)));
    const endpoint = this.getAdminEndpoint('equipmentReports');
    return this.request<{
      date_from: string;
      date_to: string;
      report_header?: {
        institute_name?: string;
        organization?: string;
        report_title?: string;
        period_display?: string;
        month_year?: string;
      };
      equipment: Array<{
        equipment_id: number;
        name: string;
        code: string;
        status?: string;
        status_display?: string;
        officers_in_charge?: Array<{ id: number; name: string; email: string }>;
        lab_operators?: Array<{ id: number; name: string; email: string }>;
        slot_window_display?: string;
        distinct_users_served?: number;
        distinct_users_internal?: number;
        distinct_users_external?: number;
        total_samples?: number;
        samples_internal?: number;
        samples_external?: number;
        total_booking_hours?: number;
        booking_hours_internal?: number;
        booking_hours_external?: number;
        available_hours_working_window?: number;
        available_hours_weekend_or_holiday?: number;
        completed_slot_hours_working_window?: number;
        utilization_vs_working_capacity?: number;
        blocked_hours?: number;
        other_disruption_hours?: number;
        total_bookings_in_period: number;
        completed_in_period: number;
        overall_bookings: number;
        overall_current_bookings: number;
        under_maintenance_slots: number;
        under_maintenance_hours: number;
        operator_absent_slots: number;
        operator_absent_hours: number;
        booking_not_utilized_slots: number;
        booking_not_utilized_hours: number;
        no_booking_slots: number;
        no_booking_hours: number;
        booked_slots: number;
        booked_hours: number;
        user_ratings?: {
          ratings_submitted_count?: number;
          overall_rating_avg?: number | null;
          criteria?: Record<
            string,
            { yes?: number; no?: number; unanswered?: number }
          >;
        };
      }>;
      utilization_pie: Array<{ name: string; value: number; hours: number }>;
      summary: {
        total_equipment: number;
        total_hours?: number;
        utilized_hours?: number;
        downtime_hours?: number;
        utilization_factor?: number;
        revenue_total?: number;
        revenue_internal?: number;
        revenue_external?: number;
        available_hours_working_window?: number;
        completed_hours_in_working_window?: number;
        utilization_vs_working_capacity?: number;
      };
      financial?: {
        revenue_by_user_type?: Array<{ user_type_snapshot: string; total: string | number; count: number }>;
        revenue_by_department?: Array<{ user__department__name: string | null; total: string | number; count: number }>;
        revenue_by_user?: Array<{ user_id: number; user__name: string | null; user__email: string | null; total: string | number; count: number }>;
        revenue_by_equipment?: Array<{ equipment_id: number; equipment__code: string | null; equipment__name: string | null; total: string | number; count: number }>;
        revenue_by_external_category?: Array<{ user_type_snapshot: string; total: string | number; count: number }>;
      };
    }>(`${endpoint}${q.toString() ? `?${q.toString()}` : ''}`, { method: 'GET' });
  }

  /** Admin: download equipment report as PDF. Triggers browser download. */
  async downloadEquipmentReportPdf(params?: { date_from?: string; date_to?: string; equipment_id?: number[] }): Promise<{ error?: string }> {
    const token = this.getToken();
    if (!token) return { error: 'Not authenticated' };
    const q = new URLSearchParams();
    if (params?.date_from) q.set('date_from', params.date_from);
    if (params?.date_to) q.set('date_to', params.date_to);
    if (params?.equipment_id?.length) params.equipment_id.forEach((id) => q.append('equipment_id', String(id)));
    const base = this.baseURL.endsWith('/') ? this.baseURL.slice(0, -1) : this.baseURL;
    const url = `${base}/admin/equipment-reports/download-pdf/${q.toString() ? `?${q.toString()}` : ''}`;
    const res = await fetch(url, { headers: { Authorization: `Token ${token}` } });
    if (!res.ok) {
      const text = await res.text();
      try {
        const j = JSON.parse(text);
        return { error: (j as { error?: string }).error || res.statusText };
      } catch {
        return { error: text || res.statusText };
      }
    }
    const blob = await res.blob();
    const name = res.headers.get('Content-Disposition')?.match(/filename="?([^";]+)"?/)?.[1] || 'equipment-report.pdf';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
    return {};
  }

  /** Admin: download equipment report as Excel. Triggers browser download. */
  async downloadEquipmentReportExcel(params?: { date_from?: string; date_to?: string; equipment_id?: number[] }): Promise<{ error?: string }> {
    const token = this.getToken();
    if (!token) return { error: 'Not authenticated' };
    const q = new URLSearchParams();
    if (params?.date_from) q.set('date_from', params.date_from);
    if (params?.date_to) q.set('date_to', params.date_to);
    if (params?.equipment_id?.length) params.equipment_id.forEach((id) => q.append('equipment_id', String(id)));
    const base = this.baseURL.endsWith('/') ? this.baseURL.slice(0, -1) : this.baseURL;
    const url = `${base}/admin/equipment-reports/download-excel/${q.toString() ? `?${q.toString()}` : ''}`;
    const res = await fetch(url, { headers: { Authorization: `Token ${token}` } });
    if (!res.ok) {
      const text = await res.text();
      try {
        const j = JSON.parse(text);
        return { error: (j as { error?: string }).error || res.statusText };
      } catch {
        return { error: text || res.statusText };
      }
    }
    const blob = await res.blob();
    const name = res.headers.get('Content-Disposition')?.match(/filename="?([^";]+)"?/)?.[1] || 'equipment-report.xlsx';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
    return {};
  }

  /** Admin: set user password (mirrors Django admin /admin/users/user/[id]/password/). */
  async adminUserSetPassword(userId: number | string, data: { password: string; password_confirm: string }) {
    const endpoint = this.getAdminEndpoint('users');
    return this.request<{ detail: string }>(`${endpoint}${userId}/set-password/`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /** Admin: credit sub-wallet (mirrors Django admin /admin/users/subwallet/<id>/credit/). */
  async adminSubWalletCredit(subWalletId: number | string, data: { amount: string | number; description?: string }) {
    const endpoint = this.getAdminEndpoint('subWallets');
    return this.request<{ detail: string; transaction: Record<string, unknown>; sub_wallet: Record<string, unknown> }>(
      `${endpoint}${subWalletId}/credit/`,
      { method: 'POST', body: JSON.stringify({ amount: String(data.amount), description: data.description ?? '' }) }
    );
  }

  /** Admin: debit sub-wallet (mirrors Django admin /admin/users/subwallet/<id>/debit/). */
  async adminSubWalletDebit(subWalletId: number | string, data: { amount: string | number; description?: string }) {
    const endpoint = this.getAdminEndpoint('subWallets');
    return this.request<{ detail: string; transaction: Record<string, unknown>; sub_wallet: Record<string, unknown> }>(
      `${endpoint}${subWalletId}/debit/`,
      { method: 'POST', body: JSON.stringify({ amount: String(data.amount), description: data.description ?? '' }) }
    );
  }

  /** Admin: get user booking info (email, department, Supervisor, balance) for "Book slots for user". */
  async getAdminUserBookingInfo(userId: number | string) {
    const endpoint = this.getAdminEndpoint('users');
    return this.request<{
      email: string;
      department_name: string;
      wallet_faculty_owner: { name: string; email: string } | null;
      wallet_balance: string;
    }>(`${endpoint}${userId}/booking-info/`, { method: 'GET' });
  }

  /** Admin/OIC: get transaction history for a user (e.g. to verify debit after booking for user). */
  async getAdminUserTransactionHistory(userId: number | string, limit = 50, offset = 0) {
    const endpoint = this.getAdminEndpoint('users');
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    return this.request<{
      user_id: number;
      user_email: string;
      transactions: Array<{
        id: number;
        transaction_type: 'credit' | 'debit';
        amount: string;
        description: string;
        created_at: string;
        balance_after: string | null;
        equipment_name: string | null;
        department_name: string | null;
        department_code: string | null;
      }>;
      count: number;
      limit: number;
      offset: number;
    }>(`${endpoint}${userId}/transaction-history/?${params}`, { method: 'GET' });
  }

  /** Admin: list students on a faculty's wallet (for wallet-owner bulk actions). */
  async adminWalletStudentsList(facultyId: number | string) {
    const endpoint = this.getAdminEndpoint('users');
    return this.request<{ students: Array<{ id: number; email: string; name: string; user_type: string; use_discounted_charge_profile: boolean }> }>(
      `${endpoint}${facultyId}/wallet-students/`,
      { method: 'GET' }
    );
  }

  /** Admin: bulk update discounted charge profile for students on a faculty wallet. */
  async adminApplyDiscountedChargeProfileToWalletStudents(
    facultyId: number | string,
    payload: {
      apply_all?: boolean;
      use_discounted_charge_profile?: boolean;
      student_updates?: Array<{ student_id: number; use_discounted_charge_profile: boolean }>;
      apply_all_equipment?: boolean;
      equipment_ids?: number[];
    },
  ) {
    const endpoint = this.getAdminEndpoint('users');
    return this.request<{ detail: string; updated_count: number }>(
      `${endpoint}${facultyId}/apply-discounted-charge-profile-to-wallet-students/`,
      { method: 'POST', body: JSON.stringify(payload) }
    );
  }

  /** Admin: lightweight equipment list for multi-select scopes. */
  async adminEquipmentSimpleList() {
    const endpoint = this.getAdminEndpoint('equipment');
    return this.request<Array<{ equipment_id: number; code: string; name: string }>>(
      `${endpoint}simple-list/`,
      { method: 'GET' }
    );
  }

  /** Admin: get per-user discounted charge equipment scope. */
  async adminGetDiscountedChargeEquipment(userId: number | string) {
    const endpoint = this.getAdminEndpoint('users');
    return this.request<{
      use_discounted_charge_profile: boolean;
      apply_all_equipment: boolean;
      equipment_ids: number[];
    }>(`${endpoint}${userId}/discounted-charge-equipment/`, { method: 'GET' });
  }

  /** Admin: set per-user discounted charge equipment scope. */
  async adminSetDiscountedChargeEquipment(
    userId: number | string,
    payload: { use_discounted_charge_profile: boolean; apply_all_equipment: boolean; equipment_ids: number[] },
  ) {
    const endpoint = this.getAdminEndpoint('users');
    return this.request<{ detail?: string }>(`${endpoint}${userId}/set-discounted-charge-equipment/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async adminCreate<T = unknown>(section: string, data: Record<string, unknown>) {
    const endpoint = this.getAdminEndpoint(section);
    return this.request<T>(endpoint, { method: 'POST', body: JSON.stringify(data) });
  }

  async adminUpdate<T = unknown>(section: string, id: number | string, data: Record<string, unknown>) {
    const endpoint = this.getAdminEndpoint(section);
    return this.request<T>(`${endpoint}${id}/`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  async adminDelete(section: string, id: number | string) {
    const endpoint = this.getAdminEndpoint(section);
    return this.request<void>(`${endpoint}${id}/`, { method: 'DELETE' });
  }

  /** Admin: approve repeat sample request (creates free re-book). */
  async adminRepeatSampleRequestApprove(id: number | string) {
    const endpoint = this.getAdminEndpoint('repeatSampleRequests');
    return this.request<{ message: string; repeat_sample_request: unknown; new_booking?: unknown }>(
      `${endpoint}${id}/approve/`,
      { method: 'POST' }
    );
  }

  /** Admin: reject repeat sample request with optional admin notes. */
  async adminRepeatSampleRequestReject(id: number | string, adminNotes?: string) {
    const endpoint = this.getAdminEndpoint('repeatSampleRequests');
    return this.request<{ message: string; repeat_sample_request: unknown }>(
      `${endpoint}${id}/reject/`,
      { method: 'POST', body: JSON.stringify({ admin_notes: adminNotes ?? '' }) }
    );
  }

  /** Admin: fetch Indian central government gazetted holidays and add new ones. */
  async adminHolidaysFetchGazetted(options?: { year?: number; years?: number[] }) {
    const endpoint = `${this.getAdminEndpoint('holidays')}fetch-gazetted/`;
    const body: Record<string, unknown> = {};
    if (options?.years?.length) body.years = options.years;
    else if (options?.year != null) body.year = options.year;
    return this.request<{ added: number; skipped: number; years: number[]; holidays: Record<string, unknown>[] }>(
      endpoint,
      { method: 'POST', body: JSON.stringify(body) }
    );
  }

  /** Admin: fetch holidays from a user-defined URL (HTML table with Holidays and Date columns). */
  async adminHolidaysFetchFromUrl(url: string) {
    const endpoint = `${this.getAdminEndpoint('holidays')}fetch-from-url/`;
    return this.request<{
      added: number;
      skipped: number;
      errors?: string[];
      holidays: Record<string, unknown>[];
    }>(endpoint, { method: 'POST', body: JSON.stringify({ url }) });
  }

  /** Admin: list communication templates with optional filters (admin user only). */
  async adminCommunicationTemplatesList(params?: { search?: string; communication_type?: string; is_active?: string }) {
    const p: Record<string, string> = {};
    if (params?.search) p.search = params.search;
    if (params?.communication_type) p.communication_type = params.communication_type;
    if (params?.is_active !== undefined && params?.is_active !== '') p.is_active = params.is_active;
    const q = Object.keys(p).length ? `?${new URLSearchParams(p).toString()}` : '';
    return this.request<Array<Record<string, unknown>>>(`${this.getAdminEndpoint('communicationTemplates')}${q}`, { method: 'GET' });
  }

  /** Admin: get/create/update/delete communication template (admin user only). */
  async adminCommunicationTemplateGet(id: number | string) {
    return this.request<Record<string, unknown>>(`${this.getAdminEndpoint('communicationTemplates')}${id}/`, { method: 'GET' });
  }

  async adminCommunicationTemplateCreate(data: Record<string, unknown>) {
    return this.request<Record<string, unknown>>(this.getAdminEndpoint('communicationTemplates'), {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async adminCommunicationTemplateUpdate(id: number | string, data: Record<string, unknown>) {
    return this.request<Record<string, unknown>>(`${this.getAdminEndpoint('communicationTemplates')}${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async adminCommunicationTemplateDelete(id: number | string) {
    return this.request<void>(`${this.getAdminEndpoint('communicationTemplates')}${id}/`, { method: 'DELETE' });
  }

  /** Admin: list communication logs with optional filters (admin user only). */
  async adminCommunicationLogsList(params?: { search?: string; communication_type?: string; status?: string; date_from?: string; date_to?: string }) {
    const p: Record<string, string> = {};
    if (params?.search) p.search = params.search;
    if (params?.communication_type) p.communication_type = params.communication_type;
    if (params?.status) p.status = params.status;
    if (params?.date_from) p.date_from = params.date_from;
    if (params?.date_to) p.date_to = params.date_to;
    const q = Object.keys(p).length ? `?${new URLSearchParams(p).toString()}` : '';
    return this.request<Array<Record<string, unknown>>>(`${this.getAdminEndpoint('communicationLogs')}${q}`, { method: 'GET' });
  }

  async adminCommunicationLogGet(id: number | string) {
    return this.request<Record<string, unknown>>(`${this.getAdminEndpoint('communicationLogs')}${id}/`, { method: 'GET' });
  }

  /** Admin: list notices with optional filters (admin user only). */
  async adminNoticesList(params?: { search?: string; notice_type?: string; is_active?: string }) {
    const p: Record<string, string> = {};
    if (params?.search) p.search = params.search;
    if (params?.notice_type) p.notice_type = params.notice_type;
    if (params?.is_active !== undefined && params?.is_active !== '') p.is_active = params.is_active;
    const q = Object.keys(p).length ? `?${new URLSearchParams(p).toString()}` : '';
    return this.request<Array<Record<string, unknown>>>(`${this.getAdminEndpoint('notices')}${q}`, { method: 'GET' });
  }

  async adminNoticeGet(id: number | string) {
    return this.request<Record<string, unknown>>(`${this.getAdminEndpoint('notices')}${id}/`, { method: 'GET' });
  }

  async adminNoticeCreate(data: Record<string, unknown>) {
    return this.request<Record<string, unknown>>(this.getAdminEndpoint('notices'), {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async adminNoticeUpdate(id: number | string, data: Record<string, unknown>) {
    return this.request<Record<string, unknown>>(`${this.getAdminEndpoint('notices')}${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async adminNoticeDelete(id: number | string) {
    return this.request<void>(`${this.getAdminEndpoint('notices')}${id}/`, { method: 'DELETE' });
  }

  /** Create CMS menu item, optionally with document (PDF) upload via multipart. */
  async adminCmsMenuCreate(data: Record<string, unknown>, documentFile?: File | null) {
    const endpoint = this.getAdminEndpoint('cmsMenu');
    if (documentFile) {
      const form = new FormData();
      form.append('label', String(data.label ?? ''));
      form.append('link_type', String(data.link_type ?? 'internal_anchor'));
      form.append('url', String(data.url ?? ''));
      if (data.parent !== undefined && data.parent !== null && data.parent !== '') form.append('parent', String(data.parent));
      form.append('priority', String(data.priority ?? 0));
      form.append('is_active', data.is_active === true || data.is_active === 'true' ? 'true' : 'false');
      form.append('open_in_new_tab', data.open_in_new_tab === true || data.open_in_new_tab === 'true' ? 'true' : 'false');
      form.append('document', documentFile);
      const url = `${this.baseURL}${endpoint}`;
      const headers: HeadersInit = { ...(this.token ? { Authorization: `Token ${this.token}` } : {}) };
      const res = await fetch(url, { method: 'POST', headers, body: form });
      const resData = await res.json().catch(() => ({}));
      if (!res.ok) return { error: (resData as { detail?: string; document?: string[] }).detail || (Array.isArray((resData as { document?: string[] }).document) ? (resData as { document: string[] }).document.join(', ') : undefined) || `HTTP ${res.status}` };
      return { data: resData };
    }
    return this.adminCreate('cmsMenu', data);
  }

  /** Update CMS menu item, optionally with document (PDF) upload via multipart. */
  async adminCmsMenuUpdate(id: number | string, data: Record<string, unknown>, documentFile?: File | null) {
    const endpoint = this.getAdminEndpoint('cmsMenu');
    const url = `${this.baseURL}${endpoint}${id}/`;
    if (documentFile) {
      const form = new FormData();
      if (data.label !== undefined) form.append('label', String(data.label));
      if (data.link_type !== undefined) form.append('link_type', String(data.link_type));
      if (data.url !== undefined) form.append('url', String(data.url));
      if (data.parent !== undefined) form.append('parent', data.parent === null || data.parent === '' ? '' : String(data.parent));
      if (data.priority !== undefined) form.append('priority', String(data.priority));
      if (data.is_active !== undefined) form.append('is_active', data.is_active === true || data.is_active === 'true' ? 'true' : 'false');
      if (data.open_in_new_tab !== undefined) form.append('open_in_new_tab', data.open_in_new_tab === true || data.open_in_new_tab === 'true' ? 'true' : 'false');
      form.append('document', documentFile);
      const headers: HeadersInit = { ...(this.token ? { Authorization: `Token ${this.token}` } : {}) };
      const res = await fetch(url, { method: 'PATCH', headers, body: form });
      const resData = await res.json().catch(() => ({}));
      if (!res.ok) return { error: (resData as { detail?: string }).detail || `HTTP ${res.status}` };
      return { data: resData };
    }
    return this.adminUpdate('cmsMenu', id, data);
  }

  /** Admin: create hero slide (multipart; image required). */
  async adminCmsHeroSlideCreate(data: { order: number; alt_text: string; is_active: boolean }, imageFile: File) {
    const endpoint = this.getAdminEndpoint('cmsHeroSlides');
    const form = new FormData();
    form.append('order', String(data.order));
    form.append('alt_text', data.alt_text);
    form.append('is_active', data.is_active ? 'true' : 'false');
    form.append('image', imageFile);
    const url = `${this.baseURL}${endpoint}`;
    const headers: HeadersInit = { ...(this.token ? { Authorization: `Token ${this.token}` } : {}) };
    const res = await fetch(url, { method: 'POST', headers, body: form });
    const resData = await res.json().catch(() => ({}));
    if (!res.ok) return { error: (resData as { detail?: string; image?: string[] }).detail || (Array.isArray((resData as { image?: string[] }).image) ? (resData as { image: string[] }).image.join(', ') : undefined) || `HTTP ${res.status}` };
    return { data: resData };
  }

  /** Admin: update hero slide (multipart; image optional). */
  async adminCmsHeroSlideUpdate(id: number | string, data: { order?: number; alt_text?: string; is_active?: boolean }, imageFile?: File | null) {
    const endpoint = this.getAdminEndpoint('cmsHeroSlides');
    const url = `${this.baseURL}${endpoint}${id}/`;
    if (imageFile) {
      const form = new FormData();
      if (data.order !== undefined) form.append('order', String(data.order));
      if (data.alt_text !== undefined) form.append('alt_text', data.alt_text);
      if (data.is_active !== undefined) form.append('is_active', data.is_active ? 'true' : 'false');
      form.append('image', imageFile);
      const headers: HeadersInit = { ...(this.token ? { Authorization: `Token ${this.token}` } : {}) };
      const res = await fetch(url, { method: 'PATCH', headers, body: form });
      const resData = await res.json().catch(() => ({}));
      if (!res.ok) return { error: (resData as { detail?: string }).detail || `HTTP ${res.status}` };
      return { data: resData };
    }
    return this.adminUpdate('cmsHeroSlides', id, data as Record<string, unknown>);
  }

  /** Options for admin equipment add/edit form (categories, departments, user groups, etc.). */
  async getEquipmentFormChoices() {
    return this.request<{
      categories: Array<{ id: number; name: string; code?: string | null }>;
      equipment_groups: Array<{ equipment_group_id: number; name: string; code: string }>;
      internal_departments: Array<{ id: number; name: string; code: string }>;
      user_groups: Array<{ id: number; name: string; code: string }>;
      managers: Array<{ id: number; name: string; email: string }>;
      operators: Array<{ id: number; name: string; email: string }>;
      profile_type_choices: Array<{ value: string; label: string }>;
      status_choices: Array<{ value: string; label: string }>;
      dynamic_input_field_type_choices: Array<{ value: string; label: string }>;
      user_type_choices: Array<{ value: string; label: string }>;
    }>('/admin/equipment-form-choices/', { method: 'GET' });
  }

  /** Admin: get unique email recipients for given booked slot IDs (for bulk email). */
  async getBulkEmailRecipients(slotIds: number[]) {
    return this.request<{ recipients: Array<{ email: string; name: string }> }>('/admin/bulk-email-recipients/', {
      method: 'POST',
      body: JSON.stringify({ slot_ids: slotIds }),
    });
  }

  /** Admin: send the same email to multiple recipients. */
  async sendBulkEmail(recipientEmails: string[], subject: string, body: string) {
    return this.request<{ message: string; sent_count: number; failed_count: number; failed?: Array<{ email: string; error: string }> }>(
      '/admin/send-bulk-email/',
      { method: 'POST', body: JSON.stringify({ recipient_emails: recipientEmails, subject, body }) }
    );
  }

  /** Admin/OIC: list equipment "booking requesters" group recipients for an equipment. */
  async adminEquipmentBookingRequesters(equipmentId: number | string) {
    const endpoint = this.getAdminEndpoint('equipment');
    return this.request<{
      equipment_id: number;
      equipment_code: string;
      equipment_name: string;
      group_code: string | null;
      group_name: string | null;
      recipients: Array<{ user_id?: number | null; email: string; name: string }>;
      count: number;
    }>(`${endpoint}${equipmentId}/booking-requesters/`, { method: 'GET' });
  }

  /** Path for the equipment image proxy (no query token — use with Authorization header). */
  getEquipmentImageProxyPath(equipmentId: number): string {
    const base = this.baseURL.replace(/\/$/, '');
    return `${base}/equipments/${equipmentId}/image/`;
  }

  /** Stable API URL that streams the equipment image from storage (no expiring signed URLs). Use as img src. */
  getEquipmentImageUrl(equipmentId: number): string {
    const url = this.getEquipmentImageProxyPath(equipmentId);
    const token = this.getToken();
    if (token) {
      return `${url}?token=${encodeURIComponent(token)}`;
    }
    return url;
  }

  /** Upload equipment image (admin). */
  async uploadEquipmentImage(equipmentId: number, file: File) {
    const base = this.baseURL.replace(/\/$/, "");
    const path = `admin/equipment/${equipmentId}/upload-image/`;
    const url = `${base}/${path}`;
    const formData = new FormData();
    formData.append("image", file);
    const headers: HeadersInit = { ...(this.token ? { Authorization: `Token ${this.token}` } : {}) };
    const res = await fetch(url, { method: "POST", headers, body: formData });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: (data as { error?: string }).error || `HTTP ${res.status}` };
    return { data };
  }

  /** Upload equipment video (admin). */
  async uploadEquipmentVideo(equipmentId: number, file: File) {
    const base = this.baseURL.replace(/\/$/, "");
    const path = `admin/equipment/${equipmentId}/upload-video/`;
    const url = `${base}/${path}`;
    const formData = new FormData();
    formData.append("video", file);
    const headers: HeadersInit = { ...(this.token ? { Authorization: `Token ${this.token}` } : {}) };
    const res = await fetch(url, { method: "POST", headers, body: formData });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: (data as { error?: string }).error || `HTTP ${res.status}` };
    return { data };
  }

  /** Admin: bulk set slot status for an equipment by dates or by slot_ids. */
  async adminEquipmentBulkSlotStatus(
    equipmentId: number | string,
    payload: {
      dates?: string[];
      start_date?: string;
      end_date?: string;
      slot_ids?: number[];
      status: string;
      blocked_label?: string | null;
      send_email_to_wallet_owner?: boolean;
    }
  ) {
    const endpoint = this.getAdminEndpoint('equipment');
    return this.request<{ updated: number; message: string }>(
      `${endpoint}${equipmentId}/bulk-slot-status/`,
      { method: 'POST', body: JSON.stringify(payload) }
    );
  }

  /** Admin/OIC: bulk mark slots as Reserved for External Users (or unmark). Same slot selection as bulk-slot-status. */
  async adminEquipmentBulkReserveExternal(
    equipmentId: number | string,
    payload: {
      reserved_for_external: boolean;
      dates?: string[];
      start_date?: string;
      end_date?: string;
      slot_ids?: number[];
    }
  ) {
    const endpoint = this.getAdminEndpoint('equipment');
    return this.request<{ updated: number; message: string }>(
      `${endpoint}${equipmentId}/bulk-reserve-external/`,
      { method: 'POST', body: JSON.stringify(payload) }
    );
  }

  /** Admin/OIC: get waitlist for an equipment. */
  async getEquipmentWaitlist(equipmentId: number) {
    const endpoint = this.getAdminEndpoint('equipment');
    return this.request<{
      equipment_id: number;
      equipment_code: string;
      equipment_name: string;
      waitlist_queue_depth: number;
      entries: Array<{
        id: number;
        position: number;
        user_id: number;
        user_email: string;
        user_name: string;
        created_at: string | null;
        status?: string | null;
        cannot_fulfill_remark?: string | null;
        marked_cannot_fulfill_at?: string | null;
        booking_attempt_requested_at?: string | null;
        booking_attempt_failure_reason?: string | null;
        booking_attempt_number_of_samples?: number | null;
        booking_attempt_slots_requested?: number | null;
        booking_attempt_duration_minutes?: number | null;
        booking_attempt_additional_info?: any;
      }>;
      count: number;
      active_count?: number;
      cannot_fulfill_count?: number;
    }>(`${endpoint}${equipmentId}/waitlist/`, { method: 'GET' });
  }

  /** Admin/OIC: clear waitlist for an equipment. */
  async clearEquipmentWaitlist(equipmentId: number) {
    const endpoint = this.getAdminEndpoint('equipment');
    return this.request<{ message: string; deleted: number }>(
      `${endpoint}${equipmentId}/waitlist-clear/`,
      { method: 'POST' }
    );
  }

  /** OIC: list other OIC users for temporary OIC dropdown (excludes current user). Optional search by name/email. */
  async getTemporaryOicOicUsers(search?: string) {
    const params = new URLSearchParams();
    if (search != null && search.trim() !== "") params.set("search", search.trim());
    const q = params.toString();
    return this.request<{ oic_users: Array<{ id: number; name: string; email: string }> }>(
      q ? `/equipments/temporary-oic/oic-users/?${q}` : '/equipments/temporary-oic/oic-users/',
      { method: 'GET' }
    );
  }

  /** OIC: list equipments for which current user is primary OIC. */
  async getTemporaryOicMyEquipments() {
    return this.request<{ equipments: Array<{ id: number; code: string; name: string }> }>(
      '/equipments/temporary-oic/my-equipments/',
      { method: 'GET' }
    );
  }

  /** OIC: create temporary OIC delegation. */
  async createTemporaryOic(equipmentId: number, temporaryOicId: number, resumeAt: string) {
    return this.request<{
      id: number;
      equipment_id: number;
      equipment_code: string;
      temporary_oic_id: number;
      temporary_oic_name: string;
      resume_at: string;
      message: string;
    }>('/equipments/temporary-oic/', {
      method: 'POST',
      body: JSON.stringify({
        equipment_id: equipmentId,
        temporary_oic_id: temporaryOicId,
        resume_at: resumeAt,
      }),
    });
  }

  /** OIC: list my active temporary OIC delegations. */
  async getTemporaryOicMine() {
    return this.request<{
      delegations: Array<{
        id: number;
        equipment_id: number;
        equipment_code: string;
        equipment_name: string;
        temporary_oic_id: number;
        temporary_oic_name: string;
        temporary_oic_email: string;
        resume_at: string;
        created_at: string;
      }>;
    }>('/equipments/temporary-oic/mine/', { method: 'GET' });
  }

  /** OIC: update a temporary OIC delegation's resume date/time (only primary OIC). */
  async updateTemporaryOic(delegationId: number, resumeAt: string) {
    return this.request<{
      message: string;
      id: number;
      resume_at: string;
      equipment_code: string;
      temporary_oic_name: string;
    }>(`/equipments/temporary-oic/${delegationId}/`, {
      method: 'PATCH',
      body: JSON.stringify({ resume_at: resumeAt }),
    });
  }

  /** OIC: cancel a temporary OIC delegation (only primary OIC). */
  async cancelTemporaryOic(delegationId: number) {
    return this.request<{ message: string }>(
      `/equipments/temporary-oic/${delegationId}/cancel/`,
      { method: 'DELETE' }
    );
  }

  /** Upload image for CMS page block (admin). Returns { url } for use in image block. */
  async uploadCmsPageImage(file: File) {
    const endpoint = this.getAdminEndpoint('cmsPages');
    const formData = new FormData();
    formData.append('image', file);
    const url = `${this.baseURL}${endpoint}upload-image/`;
    const headers: HeadersInit = { ...(this.token ? { Authorization: `Token ${this.token}` } : {}) };
    const res = await fetch(url, { method: 'POST', headers, body: formData });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: (data as { error?: string }).error || `HTTP ${res.status}` };
    return { data: data as { url: string } };
  }

  /** Upload document (e.g. resume PDF) for CMS page block (admin). Returns { url }. */
  async uploadCmsPageDocument(file: File) {
    const endpoint = this.getAdminEndpoint('cmsPages');
    const formData = new FormData();
    formData.append('document', file);
    const url = `${this.baseURL}${endpoint}upload-document/`;
    const headers: HeadersInit = { ...(this.token ? { Authorization: `Token ${this.token}` } : {}) };
    const res = await fetch(url, { method: 'POST', headers, body: formData });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: (data as { error?: string }).error || `HTTP ${res.status}` };
    return { data: data as { url: string } };
  }
}

export const apiClient = new ApiClient(API_BASE_URL);


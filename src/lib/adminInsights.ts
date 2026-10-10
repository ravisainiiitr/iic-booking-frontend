/** Pages opened from the administration overview cards: equipment, users and cancellations. */

export type InsightParams = Record<string, string | number | boolean | null | undefined>;

export interface InsightPage<T> {
  scope: "institute" | "department";
  department: { id: number; name: string } | null;
  generated_at: string;
  results: T[];
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface Breakdown {
  key: string;
  label: string;
  count: number;
}

export interface Option {
  value: string;
  label: string;
}

export interface NamedOption {
  id: number;
  name: string;
}

/* ------------------------------------------------------------------ equipment */

export interface EquipmentInsightRow {
  equipment_id: number;
  name: string;
  code: string;
  status: string;
  status_display: string;
  status_group: "operational" | "under_maintenance" | "other" | "disposed";
  status_group_display: string;
  profile_type: string;
  profile_type_display: string;
  category: NamedOption | null;
  department: NamedOption | null;
  parent_equipment: NamedOption | null;
  test_only: boolean;
  officers_in_charge: Array<{ id: number; name: string; email: string }>;
  down_since: string | null;
  downtime_hours: number | null;
  last_status_change: string | null;
  upcoming_bookings: number;
  next_booking_at: string | null;
  /**
   * Utilization factor over the last 30 days (from portal go-live, till now): booked ÷ available slot hours inside
   * the weekly view window on working days (0–1); null when there are no available hours, for modes (counted on the
   * parent's row, `utilisation_counted_under`) and for test equipment.
   */
  utilisation: number | null;
  booked_hours_30d: number;
  /** Available slot hours (the utilisation's denominator). */
  slot_hours_30d: number;
  utilisation_counted_under?: number | null;
  utilisation_test_excluded?: boolean;
}

export interface EquipmentInsights extends InsightPage<EquipmentInsightRow> {
  card: { total: number; operational: number; under_maintenance: number; disposed: number; other: number };
  summary: {
    total: number;
    by_status: Breakdown[];
    by_category: Breakdown[];
    by_department: Breakdown[];
    by_profile_type: Breakdown[];
    by_oic: Breakdown[];
    test_only: number;
    upcoming_bookings: number;
    utilisation: number | null;
    utilisation_days: number;
    utilisation_booked_hours?: number;
    utilisation_available_hours?: number;
    utilisation_formula?: string;
    utilisation_period_from?: string | null;
    utilisation_period_to?: string | null;
    utilisation_period_display?: string;
    utilisation_period_note?: string;
  };
  options?: {
    statuses: Option[];
    categories: NamedOption[];
    oics: NamedOption[];
    profile_types: Option[];
    departments: NamedOption[];
  };
}

export interface EquipmentFilters {
  status: string;
  category: string;
  oic: string;
  profile_type: string;
  department: string;
  search: string;
}

export const EMPTY_EQUIPMENT_FILTERS: EquipmentFilters = {
  status: "",
  category: "",
  oic: "",
  profile_type: "",
  department: "",
  search: "",
};

/* ------------------------------------------------------------------ users */

/**
 * A user's supervisor: the profile supervisor, else the owner of the wallet they joined, else the faculty member who
 * approved their registration; then unconfirmed links (`pending`); then the wallet charged for their latest booking.
 * `id` is null for an invited supervisor who is not on the portal yet.
 */
export interface ResolvedSupervisor {
  id: number | null;
  name: string;
  email: string;
  department: string;
  source: string;
  source_display: string;
  pending: boolean;
}

export interface UserInsightRow {
  id: number;
  name: string;
  email: string;
  phone: string;
  category: string;
  category_display: string;
  user_type_display: string;
  programme: string | null;
  programme_display: string;
  department: { id: number; name: string; type: string } | null;
  date_joined: string | null;
  is_active: boolean;
  bookings_count: number;
  last_booking_at: string | null;
  /** Wallet ledger owner (own wallet, or the supervisor's for IITR Students); Main Administrator only. */
  wallet_owner_id: number | null;
  supervisor?: ResolvedSupervisor | null;
}

export interface UserInsights extends InsightPage<UserInsightRow> {
  card: { active: number; new_last_7_days: number; new_last_30_days: number };
  definitions: Record<string, string>;
  summary: {
    total: number;
    active: number;
    inactive: number;
    internal: number;
    external: number;
    new_last_30_days: number;
    by_category: Array<Breakdown & { segment: "internal" | "external" }>;
    by_programme: Breakdown[];
    internal_by_department: Array<{
      id: number | null;
      name: string;
      faculty: number;
      students: number;
      staff: number;
      startups: number;
      total: number;
    }>;
    external_by_organisation: Array<{ id: number | null; name: string; type: string; state: string; count: number }>;
    external_by_state: Breakdown[];
    trend: {
      granularity: "week" | "month";
      series: Array<{ period: string; internal: number; external: number; total: number }>;
    };
  };
  options?: {
    categories: Array<Option & { segment: string }>;
    programmes: Option[];
    departments: Array<NamedOption & { type: string }>;
  };
}

export interface UserFilters {
  status: string;
  segment: string;
  category: string;
  programme: string;
  department: string;
  organisation: string;
  joined_from: string;
  joined_to: string;
  booked_from: string;
  booked_to: string;
  /** With a booked range: users who did not book in it. */
  not_booked: boolean;
  search: string;
}

export const EMPTY_USER_FILTERS: UserFilters = {
  status: "active",
  segment: "",
  category: "",
  programme: "",
  department: "",
  organisation: "",
  joined_from: "",
  joined_to: "",
  booked_from: "",
  booked_to: "",
  not_booked: false,
  search: "",
};

/* ------------------------------------------------------------------ cancellations */

export interface CancellationRow {
  id: number;
  booking: { pk: number; display_id: string; status: string; status_display: string };
  user: { id: number; name: string; category: string; category_display: string; department: string };
  equipment: { id: number; name: string; code: string };
  slot_start: string | null;
  slot_end: string | null;
  cancelled_at: string | null;
  actor_role: string;
  actor_role_display: string;
  cancelled_by: string;
  reason: string;
  reason_display: string;
  note: string;
  lead_minutes: number | null;
  late: boolean;
  charge: number;
  refund: number | null;
  refund_estimated: boolean;
  data_quality: "RECORDED" | "FROM_HISTORY" | "INFERRED";
  data_quality_display: string;
  refill: "waitlist" | "rebooked" | "not_refilled" | "unknown";
  refill_display: string;
}

export interface CancellationBreakdown extends Breakdown {
  late: number;
  refund: number;
}

export interface NamedCount {
  id: number | null;
  label: string;
  count: number;
  late: number;
  code?: string;
}

export interface CancellationInsights extends InsightPage<CancellationRow> {
  date_from: string;
  date_to: string;
  include_no_shows: boolean;
  late_minutes: number;
  summary: {
    total: number;
    late: number;
    late_share: number | null;
    charge_total: number;
    refund_total: number;
    retained_total: number;
    refunded_count: number;
    refund_unknown: number;
    refund_estimated: number;
    bookings_created: number;
    rate: number | null;
    previous: { date_from: string; date_to: string; total: number; late: number; bookings_created: number; rate: number | null };
    change: number;
    by_role: CancellationBreakdown[];
    by_reason: CancellationBreakdown[];
    by_lead_time: CancellationBreakdown[];
    by_category: CancellationBreakdown[];
    by_data_quality: CancellationBreakdown[];
    by_equipment: NamedCount[];
    by_department: NamedCount[];
    by_oic: NamedCount[];
    refills: Breakdown[];
    trend: { granularity: "day" | "week"; series: Array<{ period: string; count: number; late: number }> };
  };
  options?: {
    equipment: Array<NamedOption & { code: string }>;
    roles: Option[];
    reasons: Option[];
    data_qualities: Option[];
    categories: Option[];
    departments: NamedOption[];
    oics: NamedOption[];
  };
}

export interface CancellationFilters {
  date_from: string;
  date_to: string;
  equipment: string;
  role: string;
  reason: string;
  department: string;
  category: string;
  oic: string;
  data_quality: string;
  late_only: boolean;
  include_no_shows: boolean;
  search: string;
}

export const EMPTY_CANCELLATION_FILTERS: CancellationFilters = {
  date_from: "",
  date_to: "",
  equipment: "",
  role: "",
  reason: "",
  department: "",
  category: "",
  oic: "",
  data_quality: "",
  late_only: false,
  include_no_shows: false,
  search: "",
};

/* ------------------------------------------------------------------ refund requests */

export type RefundSource = "self_service" | "request" | "partial";
export type RefundStatus = "refunded" | "no_refund" | "pending" | "approved" | "rejected" | "withdrawn";

export interface RefundUser {
  id: number;
  name: string;
  email: string;
  category: string;
  category_display: string;
  department: string;
}

export interface RefundRequestRow {
  id: string;
  source: RefundSource;
  source_display: string;
  booking: { pk: number; display_id: string; status: string; status_display: string };
  user: RefundUser;
  equipment: { id: number; name: string; code: string };
  requested_at: string | null;
  slot_start: string | null;
  lead_minutes: number | null;
  /** The equipment's cancel / reschedule hours (default 48). */
  window_hours: number;
  /** Requested at least ``window_hours`` before the slot; null when the slot time is not known. */
  within_window: boolean | null;
  status: RefundStatus;
  status_display: string;
  responded_at: string | null;
  refund: number | null;
  wallet_transaction: {
    id: number;
    amount: number;
    created_at: string | null;
    description: string;
    /** Wallet ledger owner (Main Administrator only). */
    wallet_owner_id: number | null;
  } | null;
  note: string;
}

export interface RepeatRefunder {
  user: RefundUser;
  count: number;
  within_window: number;
  bookings: number;
  refund_total: number;
  last_requested_at: string | null;
}

export interface RefundRequestInsights extends InsightPage<RefundRequestRow> {
  date_from: string;
  date_to: string;
  default_window_hours: number;
  repeat_min: number;
  summary: {
    total: number;
    bookings_created: number;
    rate: number | null;
    within_window: number;
    unique_users: number;
    unique_users_within_window: number;
    repeat_refunders: number;
    refund_total: number;
    by_source: Breakdown[];
    by_status: Breakdown[];
    by_window: Breakdown[];
    by_equipment: Array<{ id: number; label: string; code: string; count: number }>;
    repeaters: RepeatRefunder[];
    previous: { date_from: string; date_to: string; total: number; unique_users: number };
    change: number;
  };
  options?: {
    equipment: Array<NamedOption & { code: string }>;
    categories: Option[];
    departments: NamedOption[];
    sources: Option[];
    statuses: Option[];
    windows: Option[];
  };
}

export interface RefundFilters {
  date_from: string;
  date_to: string;
  equipment: string;
  source: string;
  status: string;
  window: string;
  category: string;
  department: string;
  user: string;
  search: string;
}

export const EMPTY_REFUND_FILTERS: RefundFilters = {
  date_from: "",
  date_to: "",
  equipment: "",
  source: "",
  status: "",
  window: "",
  category: "",
  department: "",
  user: "",
  search: "",
};

/* ------------------------------------------------------------------ user card */

export interface UserCardBooking {
  pk: number;
  display_id: string;
  equipment: { id: number; name: string; code: string };
  user: { id: number; name: string };
  slot_start: string | null;
  status: string;
  status_display: string;
  charge: number;
  created_at: string | null;
}

export interface UserCard {
  profile: {
    id: number;
    name: string;
    email: string;
    phone: string;
    profile_picture_url: string | null;
    user_type_display: string;
    category: string;
    category_display: string;
    programme_display: string;
    employee_id: string;
    designation: string;
    degree_name: string;
    department: { id: number; name: string; type: string } | null;
    supervisor: ResolvedSupervisor | null;
    is_active: boolean;
    is_test_account: boolean;
    date_joined: string | null;
    last_login: string | null;
  };
  /** The wallet the user books from (Main Administrator only). */
  wallet: { owner_id: number; is_owner: boolean; balance: number } | null;
  /** Set when the user owns a wallet: bookings by its linked users are available. */
  linked_wallet: { owner_id: number; linked_users: number } | null;
  certifications: Array<{
    id: number;
    equipment: string;
    level: string;
    status: string;
    status_display: string;
    awarded_at: string | null;
    valid_until: string | null;
    certificate_no: string;
  }>;
  bookings: { total: number; charged: number; cancelled: number; recent: UserCardBooking[] };
}

export interface WalletMember {
  id: number;
  name: string;
  email: string;
  is_owner: boolean;
}

export interface WalletBookings {
  owner: { id: number; name: string };
  summary: {
    linked_users: number;
    bookings: number;
    charged: number;
    cancelled: number;
    by_member: Array<WalletMember & { bookings: number; charged: number; cancelled: number }>;
  };
  results: UserCardBooking[];
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
  options?: { members: WalletMember[]; equipment: Array<NamedOption & { code: string }>; statuses: Option[] };
}

export interface WalletBookingFilters {
  member: string;
  equipment: string;
  status: string;
  date_from: string;
  date_to: string;
  search: string;
}

export const EMPTY_WALLET_BOOKING_FILTERS: WalletBookingFilters = {
  member: "",
  equipment: "",
  status: "",
  date_from: "",
  date_to: "",
  search: "",
};

/** Booking Management with the user's email as the search and every status. */
export function userBookingsPath(email: string): string {
  return `/booking-management?${new URLSearchParams({ search: email, status: "all" }).toString()}`;
}

/* ------------------------------------------------------------------ helpers */

/** Query parameters with empty values dropped (``false`` too, so unchecked boxes are not sent). */
export function insightParams(filters: object, extra: InsightParams = {}): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries({ ...filters, ...extra })) {
    if (value == null || value === "" || value === false) continue;
    out[key] = typeof value === "string" ? value.trim() : (value as number | boolean);
  }
  return out;
}

export function insightQuery(params: InsightParams): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "" || value === false) continue;
    q.set(key, value === true ? "1" : String(value));
  }
  const qs = q.toString();
  return qs ? `?${qs}` : "";
}

/** Filters given on the page URL (e.g. a link from the overview) on top of the defaults. */
export function filtersFromSearch<T extends object>(defaults: T, search: URLSearchParams): T {
  const out: Record<string, unknown> = { ...(defaults as Record<string, unknown>) };
  for (const [key, value] of Object.entries(defaults)) {
    const raw = search.get(key);
    if (raw == null) continue;
    out[key] = typeof value === "boolean" ? ["1", "true", "yes"].includes(raw.toLowerCase()) : raw;
  }
  return out as unknown as T;
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

/** "3 d 4 h", "5 h", "45 min" — for downtime and cancellation lead times. */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes)) return "—";
  const sign = minutes < 0 ? "−" : "";
  const total = Math.abs(Math.round(minutes));
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const mins = total % 60;
  if (days > 0) return `${sign}${days} d${hours ? ` ${hours} h` : ""}`;
  if (hours > 0) return `${sign}${hours} h${mins && hours < 6 ? ` ${mins} min` : ""}`;
  return `${sign}${mins} min`;
}

export const CHART_COLORS = [
  "hsl(var(--primary))",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#0ea5e9",
  "#ec4899",
  "#64748b",
  "#14b8a6",
  "#a3a3a3",
];

export const INSIGHT_PATHS = {
  equipment: "/admin/insights/equipment",
  users: "/admin/insights/users",
  cancellations: "/admin/insights/cancellations",
} as const;

/**
 * "View bookings counted": which bookings use up a weekly / monthly booking limit
 * (GET /bookings/quota-breakdown/). Shared by the booking page, Edit inputs, reschedule and the Booking Attempt Log.
 */
import type { BookingQuotaPeriod, MyBookingQuota } from "@/lib/bookingQuota";
import { quotaLimitIsEffectivelyUnlimited, visibleQuota } from "@/lib/bookingQuota";

export type QuotaPeriod = "WEEKLY" | "MONTHLY";
/** group = faculty limit shared by the research group; individual = one user; pool = older per-equipment limits. */
export type QuotaScopeKind = "group" | "individual" | "pool";

/** `quota` in a 400 response when a booking, reschedule or input edit goes over a minutes limit. */
export type QuotaFailure = {
  scope: QuotaScopeKind;
  scope_label: string;
  period: QuotaPeriod;
  period_start: string | null;
  period_end: string | null;
  period_label?: string | null;
  limit_minutes: number;
  used_minutes: number;
  requested_minutes: number;
  remaining_minutes: number;
  over_by_minutes: number;
  members_count: number;
  equipment_id: number;
  equipment_name?: string;
  user_id?: number | null;
  /** yyyy-MM-dd (IST), a day inside the period. */
  date?: string | null;
  booking_id?: number | null;
  message?: string;
};

export type QuotaBreakdownRow = {
  /** Only set when the viewer may open the booking. */
  booking_id: number | null;
  display_booking_id: string | null;
  equipment_id: number;
  equipment_name: string;
  equipment_code: string;
  slot_start: string | null;
  slot_end: string | null;
  minutes: number;
  counted: boolean;
  status: string;
  status_label: string;
  user_id: number | null;
  user_name: string;
  /** The row user's supervisor (faculty wallet owner, else their supervisor); null when none or hidden. */
  supervisor_id?: number | null;
  supervisor_name?: string | null;
  note: string | null;
  is_viewer: boolean;
  can_open: boolean;
};

/** Email and employee ID are only sent to staff and the group owner. */
export type QuotaPerson = {
  id: number;
  name: string;
  email: string | null;
  department_name: string | null;
  department_code: string | null;
  id_number: string | null;
};

export type QuotaBreakdownMember = {
  user_id: number;
  name: string;
  minutes: number;
  bookings: number;
  is_viewer: boolean;
};

export type QuotaAttemptNotes = {
  attempted_at: string;
  /** requested_slot: the slot asked for; matched_usage: period whose usage matches the log; attempt_time: fallback. */
  period_source: "requested_slot" | "matched_usage" | "attempt_time";
  logged_used_minutes: number | null;
  logged_limit_minutes: number | null;
  logged_requested_minutes: number | null;
  limit_changed: boolean;
  usage_changed: boolean;
};

export type QuotaBreakdown = {
  equipment: { id: number; name: string; code: string };
  equipment_group_name: string | null;
  scope: QuotaScopeKind;
  scope_label: string;
  period: QuotaPeriod;
  period_start: string;
  period_end: string;
  period_label: string;
  limit_minutes: number;
  used_minutes: number;
  requested_minutes: number;
  remaining_minutes: number;
  over_by_minutes: number;
  effectively_unlimited: boolean;
  subject: { id: number; name: string };
  /** Supervisor of the person whose limit this is; the group head for group limits. */
  supervisor?: QuotaPerson | null;
  group_owner: (Pick<QuotaPerson, "id" | "name"> & Partial<QuotaPerson>) | null;
  /** The requested minutes alone are more than the limit. */
  request_exceeds_limit?: boolean;
  group_members_count: number | null;
  excluded_booking_id: number | null;
  counted: QuotaBreakdownRow[];
  not_counted: QuotaBreakdownRow[];
  not_counted_truncated: boolean;
  members: QuotaBreakdownMember[];
  viewer_access: "staff" | "owner" | "self";
  full_details: boolean;
  computed_at: string;
  historical: boolean;
  attempt?: QuotaAttemptNotes;
};

/** What to show: either a limit (equipment + period + day) or a failed Booking Attempt Log entry (`logId`). */
export type QuotaBreakdownRequest = {
  equipment?: number;
  period?: QuotaPeriod;
  scope?: QuotaScopeKind;
  /** yyyy-MM-dd, any day in the period. */
  date?: string | null;
  userId?: number | null;
  /** Edit inputs / reschedule: that booking's owner, without the booking itself. */
  bookingId?: number | null;
  requested?: number | null;
  logId?: number;
};

export function quotaBreakdownQuery(req: QuotaBreakdownRequest): string {
  const params = new URLSearchParams();
  if (req.logId != null) {
    params.set("log_id", String(req.logId));
  } else {
    if (req.equipment != null) params.set("equipment", String(req.equipment));
    if (req.period) params.set("period", req.period === "MONTHLY" ? "month" : "week");
    if (req.scope) params.set("scope", req.scope);
    if (req.date) params.set("date", req.date.slice(0, 10));
    if (req.userId != null) params.set("user_id", String(req.userId));
    if (req.bookingId != null) params.set("booking_id", String(req.bookingId));
  }
  if (req.requested != null && req.requested > 0) params.set("requested", String(Math.round(req.requested)));
  return params.toString();
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/** The structured quota failure from an API error response (`res.data.quota`) or a thrown error (`err.quota`). */
export function quotaFailureFrom(source: unknown): QuotaFailure | null {
  if (!isRecord(source)) return null;
  const candidates = [isRecord(source.data) ? source.data.quota : undefined, source.quota];
  for (const q of candidates) {
    if (isRecord(q) && (q.period === "WEEKLY" || q.period === "MONTHLY") && typeof q.equipment_id === "number") {
      return q as unknown as QuotaFailure;
    }
  }
  return null;
}

export function quotaBreakdownRequestFromFailure(q: QuotaFailure): QuotaBreakdownRequest {
  return {
    equipment: q.equipment_id,
    period: q.period,
    scope: q.scope,
    date: q.date ?? q.period_start?.slice(0, 10) ?? null,
    userId: q.user_id ?? null,
    bookingId: q.booking_id ?? null,
    requested: q.requested_minutes,
  };
}

function minutes(n: number): string {
  return `${Math.max(0, Math.round(n)).toLocaleString("en-IN")} min`;
}

/** "Your research group's weekly limit (shared by 4 people) is 300 min: 240 min are already booked …". */
export function quotaFailureSummary(q: QuotaFailure): string {
  const when = q.period === "MONTHLY" ? "monthly" : "weekly";
  if (requestAloneExceedsLimit(q.requested_minutes, q.limit_minutes)) {
    return requestAloneText(q.requested_minutes, q.limit_minutes, q.period);
  }
  const owner =
    q.scope === "group"
      ? `Your research group's ${when} limit${q.members_count > 1 ? ` (shared by ${q.members_count} people)` : ""}`
      : `Your ${when} limit`;
  const period = q.period_label ? ` for ${q.period_label.replace(/^Week of/, "the week of")}` : "";
  const need = q.requested_minutes > 0 ? ` and this needs ${minutes(q.requested_minutes)}` : "";
  const over = q.over_by_minutes > 0 ? ` (${minutes(q.over_by_minutes)} over)` : "";
  return `${owner} is ${minutes(q.limit_minutes)}. ${minutes(q.used_minutes)} are already booked${period}${need}${over}.`;
}

export function requestAloneExceedsLimit(requested: number, limit: number): boolean {
  return limit > 0 && requested > limit;
}

/** "This request alone (270 min) exceeds the weekly limit (200 min)." */
export function requestAloneText(requested: number, limit: number, period: QuotaPeriod): string {
  const when = period === "MONTHLY" ? "monthly" : "weekly";
  return `This request alone (${minutes(requested)}) exceeds the ${when} limit (${minutes(limit)}).`;
}

export const NEAR_LIMIT_SHARE = 0.8;

/** The limit to explain next to the usage line: the binding one once 80% of it is used (null otherwise). */
export function nearLimitPeriod(quota: MyBookingQuota | null | undefined): BookingQuotaPeriod | null {
  const q = visibleQuota(quota);
  const b = q?.applies ? q.binding : null;
  if (!b || b.limit_minutes <= 0 || quotaLimitIsEffectivelyUnlimited(b.period, b.limit_minutes)) return null;
  return b.used_minutes >= b.limit_minutes * NEAR_LIMIT_SHARE ? b : null;
}

export function quotaBreakdownRequestFromPeriod(
  equipmentId: number,
  p: BookingQuotaPeriod,
  userId?: number | null,
): QuotaBreakdownRequest {
  return {
    equipment: equipmentId,
    period: p.period,
    scope: p.shared ? "group" : "individual",
    date: p.period_start?.slice(0, 10) || null,
    userId: userId ?? null,
  };
}

export type QuotaBreakdownOpenOptions = {
  /** Opens a booking in place (staff pages); otherwise rows link to My Bookings. */
  onOpenBooking?: (bookingId: number) => void;
};

type Listener = (req: QuotaBreakdownRequest, opts: QuotaBreakdownOpenOptions) => void;
const listeners = new Set<Listener>();

/** Opens the breakdown dialog (mounted once by QuotaBreakdownHost). */
export function openQuotaBreakdown(req: QuotaBreakdownRequest, opts: QuotaBreakdownOpenOptions = {}): void {
  listeners.forEach((l) => l(req, opts));
}

export function subscribeQuotaBreakdown(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

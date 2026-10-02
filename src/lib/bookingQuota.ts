/** Weekly / monthly minutes quota shown before slot selection (from /equipments/<id>/my-booking-quota/). */

export type BookingQuotaPeriod = {
  period: "WEEKLY" | "MONTHLY";
  scope: string;
  shared: boolean;
  limit_minutes: number;
  used_minutes: number;
  remaining_minutes: number;
  period_start: string;
  period_end: string;
};

export type MyBookingQuota = {
  equipment_id: number;
  equipment_name: string;
  equipment_group_name: string | null;
  reference_date: string;
  applies: boolean;
  reason?: string | null;
  periods: BookingQuotaPeriod[];
  remaining_minutes: number | null;
  binding: BookingQuotaPeriod | null;
};

/**
 * Same thresholds as the backend (quota_utils.EFFECTIVELY_UNLIMITED_QUOTA_MINUTES): ~90% of the 10,080 min in a
 * week / 44,640 in a 31-day month. Nobody can use that up, so such limits (e.g. 10075/week) mean "no limit".
 */
export const EFFECTIVELY_UNLIMITED_QUOTA_MINUTES: Record<BookingQuotaPeriod["period"], number> = {
  WEEKLY: 9000,
  MONTHLY: 40000,
};

export function quotaLimitIsEffectivelyUnlimited(period: string | null | undefined, limitMinutes: unknown): boolean {
  const threshold = EFFECTIVELY_UNLIMITED_QUOTA_MINUTES[String(period ?? "").toUpperCase() as BookingQuotaPeriod["period"]];
  const limit = Number(limitMinutes);
  return threshold != null && Number.isFinite(limit) && limit >= threshold;
}

const QUOTA_CONFIG_MINUTE_KEYS = [
  "internal_individual_quota_minutes",
  "internal_faculty_quota_minutes",
  "external_individual_quota_minutes",
  "external_faculty_quota_minutes",
] as const;

/** Admin/OIC quota form note when an entered weekly/monthly limit is more than can ever be booked. */
export function unlimitedQuotaConfigHint(rows: ReadonlyArray<Record<string, unknown>> | null | undefined): string | null {
  const notes: string[] = [];
  for (const period of ["WEEKLY", "MONTHLY"] as const) {
    const row = (rows ?? []).find((r) => String(r.quota_type ?? "").toUpperCase() === period);
    if (!row || !QUOTA_CONFIG_MINUTE_KEYS.some((k) => quotaLimitIsEffectivelyUnlimited(period, row[k]))) continue;
    notes.push(
      period === "WEEKLY"
        ? "Weekly limits of 9,000 min or more are more than can be booked in a week (10,080 min), so they are treated as no limit."
        : "Monthly limits of 40,000 min or more are more than can be booked in a month (44,640 min at most), so they are treated as no limit.",
    );
  }
  return notes.length ? `${notes.join(" ")} Users won't see a usage message for them.` : null;
}

/** The quota without limits nobody can reach; `applies` is false when only such limits are configured. */
export function visibleQuota(q: MyBookingQuota | null | undefined): MyBookingQuota | null {
  if (!q) return null;
  if (!q.applies) return q;
  const all = q.periods?.length ? q.periods : q.binding ? [q.binding] : [];
  const periods = all.filter((p) => !quotaLimitIsEffectivelyUnlimited(p.period, p.limit_minutes));
  if (periods.length === all.length) return q;
  if (!periods.length) return { ...q, applies: false, periods: [], binding: null, remaining_minutes: null };
  const binding = periods.reduce((min, p) => (p.remaining_minutes < min.remaining_minutes ? p : min));
  return { ...q, periods, binding, remaining_minutes: binding.remaining_minutes };
}

/** @param todayIso yyyy-MM-dd; a period starting after today is "next week" / "next month". */
export function quotaPeriodWord(p: Pick<BookingQuotaPeriod, "period" | "period_start">, todayIso?: string): string {
  const upcoming = !!todayIso && !!p.period_start && p.period_start > todayIso;
  if (p.period === "MONTHLY") return upcoming ? "next month" : "this month";
  return upcoming ? "next week" : "this week";
}

/** "You've used 120 of 240 min on XPS this week (120 min left)." */
export function quotaSummaryText(quota: MyBookingQuota | null | undefined, todayIso?: string): string | null {
  const q = visibleQuota(quota);
  if (!q || !q.applies || !q.binding) return null;
  const b = q.binding;
  const target = b.shared && q.equipment_group_name ? q.equipment_group_name : q.equipment_name;
  const used = Math.max(0, Math.round(b.used_minutes));
  const limit = Math.max(0, Math.round(b.limit_minutes));
  const left = Math.max(0, Math.round(b.remaining_minutes));
  return `You've used ${used} of ${limit} min on ${target} ${quotaPeriodWord(b, todayIso)} (${left} min left).`;
}

/** True when this booking needs more minutes than the quota still allows. */
export function quotaBlocksBooking(quota: MyBookingQuota | null | undefined, requiredMinutes: number | null | undefined): boolean {
  const q = visibleQuota(quota);
  if (!q || !q.applies || q.remaining_minutes == null) return false;
  const need = Number(requiredMinutes);
  if (!Number.isFinite(need) || need <= 0) return q.remaining_minutes <= 0;
  return need > q.remaining_minutes;
}

export function quotaBlockReason(
  quota: MyBookingQuota | null | undefined,
  requiredMinutes: number | null | undefined,
  todayIso?: string,
): string | null {
  const q = visibleQuota(quota);
  if (!quotaBlocksBooking(q, requiredMinutes) || !q?.binding) return null;
  const left = Math.max(0, Math.round(q.binding.remaining_minutes));
  const when = q.binding.period === "MONTHLY" ? "month" : "week";
  const period = quotaPeriodWord(q.binding, todayIso);
  if (left <= 0) {
    return `You've used all your booking time for ${period}. Pick a slot in another ${when}.`;
  }
  const need = Math.round(Number(requiredMinutes) || 0);
  return `This booking needs ${need} min but you only have ${left} min left ${period}. Reduce the samples in Step 1 or pick a slot in another ${when}.`;
}

/** Monday (yyyy-MM-dd) of the visible week is the reference date sent to the quota endpoint. */
export function quotaReferenceDate(weekStart: Date): string {
  const y = weekStart.getFullYear();
  const m = String(weekStart.getMonth() + 1).padStart(2, "0");
  const d = String(weekStart.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

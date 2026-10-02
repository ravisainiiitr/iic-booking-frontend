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

/** @param todayIso yyyy-MM-dd; a period starting after today is "next week" / "next month". */
export function quotaPeriodWord(p: Pick<BookingQuotaPeriod, "period" | "period_start">, todayIso?: string): string {
  const upcoming = !!todayIso && !!p.period_start && p.period_start > todayIso;
  if (p.period === "MONTHLY") return upcoming ? "next month" : "this month";
  return upcoming ? "next week" : "this week";
}

/** "You've used 120 of 240 min on XPS this week (120 min left)." */
export function quotaSummaryText(q: MyBookingQuota | null | undefined, todayIso?: string): string | null {
  if (!q || !q.applies || !q.binding) return null;
  const b = q.binding;
  const target = b.shared && q.equipment_group_name ? q.equipment_group_name : q.equipment_name;
  const used = Math.max(0, Math.round(b.used_minutes));
  const limit = Math.max(0, Math.round(b.limit_minutes));
  const left = Math.max(0, Math.round(b.remaining_minutes));
  return `You've used ${used} of ${limit} min on ${target} ${quotaPeriodWord(b, todayIso)} (${left} min left).`;
}

/** True when this booking needs more minutes than the quota still allows. */
export function quotaBlocksBooking(q: MyBookingQuota | null | undefined, requiredMinutes: number | null | undefined): boolean {
  if (!q || !q.applies || q.remaining_minutes == null) return false;
  const need = Number(requiredMinutes);
  if (!Number.isFinite(need) || need <= 0) return q.remaining_minutes <= 0;
  return need > q.remaining_minutes;
}

export function quotaBlockReason(
  q: MyBookingQuota | null | undefined,
  requiredMinutes: number | null | undefined,
  todayIso?: string,
): string | null {
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

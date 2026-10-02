export interface AttentionItem {
  key: string;
  label: string;
  count: number;
  link: string;
  description: string;
  details?: string[];
  /** From the signed-in user's own pending actions (its link is always valid for them). */
  fromPendingActions?: boolean;
}

/**
 * The signed-in user's pending actions first (they carry per-user detail), then scope-wide items
 * from the dashboard summary that are not already listed. Zero counts are dropped.
 */
export function mergeAttentionItems(summaryItems: AttentionItem[], pendingItems: AttentionItem[]): AttentionItem[] {
  const seen = new Set<string>();
  const merged: AttentionItem[] = [];
  for (const item of pendingItems) {
    if (!item.count || seen.has(item.key)) continue;
    seen.add(item.key);
    merged.push({ ...item, fromPendingActions: true });
  }
  for (const item of summaryItems) {
    if (!item.count || seen.has(item.key)) continue;
    seen.add(item.key);
    merged.push({ ...item, fromPendingActions: false });
  }
  return merged;
}

const IST_OFFSET_MS = 330 * 60_000;
const WEEKLY_OPENING_DAY = 3; // Wednesday
const WEEKLY_OPENING_HOUR = 21;

/** Next weekly booking opening (Wednesday 9 pm IST) strictly after `nowMs`; used when the peak window is not configured. */
export function nextWeeklyOpening(nowMs: number): Date {
  const ist = new Date(nowMs + IST_OFFSET_MS);
  const daysAhead = (WEEKLY_OPENING_DAY - ist.getUTCDay() + 7) % 7;
  let target = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + daysAhead, WEEKLY_OPENING_HOUR);
  if (target <= ist.getTime()) target += 7 * 24 * 60 * 60_000;
  return new Date(target - IST_OFFSET_MS);
}

/** "2d 4h", "3h 12m" or "12m" (at least one minute). */
export function formatCountdown(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

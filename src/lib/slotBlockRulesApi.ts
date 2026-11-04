import { addDays, addMonths, endOfMonth, format, parseISO } from "date-fns";

import { API_BASE_URL, apiClient } from "@/lib/api";

/**
 * Repeat block (recurring slot block rules) on the Change slot status page:
 * `/api/admin/equipment/<id>/slot-block-rules/`. Main Administrator and the equipment's OIC only.
 * Weekdays are 0 = Monday … 6 = Sunday; slot times are local "HH:MM" start times.
 * Errors arrive as `{detail, code, field?}`.
 */
export const slotBlockRulesBase = (equipmentId: number | string) =>
  `${API_BASE_URL}/admin/equipment/${equipmentId}/slot-block-rules`;

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Statuses a repeat block may give (empty slots only), in the order of the Select operation list. */
export interface RuleStatusOption {
  value: string;
  label: string;
}

export const RULE_STATUS_OPTIONS: RuleStatusOption[] = [
  { value: "BLOCKED", label: "Other Reasons" },
  { value: "UNDER_MAINTENANCE", label: "Under Maintenance" },
  { value: "SCHEDULED_MAINT", label: "Scheduled Maintenance" },
  { value: "OPERATOR_ABSENT", label: "Operator Absent" },
  { value: "NOT_AVAILABLE", label: "Not Available" },
  { value: "RESERVED_EXTERNAL", label: "Reserved for External" },
];

/** Statuses recorded as a disruption: the label is kept as its reason. */
export const RULE_DISRUPTION_STATUSES = new Set(["UNDER_MAINTENANCE", "SCHEDULED_MAINT", "OPERATOR_ABSENT"]);

export function ruleStatusLabel(value: string | null | undefined, options: RuleStatusOption[] = RULE_STATUS_OPTIONS) {
  const v = value || "BLOCKED";
  return options.find((o) => o.value === v)?.label ?? RULE_STATUS_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

export interface SlotTimeOption {
  time: string;
  end_time: string;
  name: string;
}

export interface SkippedBookedSlot {
  slot_id: number;
  date: string;
  weekday: string;
  start_time: string;
  end_time: string;
  booking_id: number | null;
  booking_reference: string;
  booking_status: string;
  user_name: string;
}

export interface SkippedOtherSlot {
  slot_id: number;
  date: string;
  weekday: string;
  start_time: string;
  end_time: string;
  status: string;
  reason: string;
  blocked_label: string;
}

export interface RulePlanSummary {
  matched_count: number;
  to_block_count: number;
  skipped_booked_count: number;
  skipped_booked: SkippedBookedSlot[];
  skipped_other_count: number;
  skipped_other: SkippedOtherSlot[];
  already_blocked_by_rule_count: number;
  future_slots_count: number;
  slots_exist_until?: string | null;
  list_limit: number;
  /** Present after create. */
  blocked_count?: number;
}

export interface RemovalPreview {
  will_unblock_count: number;
  kept_by_other_rule_count: number;
  unchanged_count: number;
}

export interface RemovalResult {
  unblocked_count: number;
  kept_by_other_rule_count: number;
  unchanged_count: number;
  restored_status: string;
}

export interface SlotBlockRule {
  id: number;
  equipment_id: number;
  weekdays: number[];
  weekday_labels: string[];
  slot_times: string[];
  start_date: string;
  end_date: string;
  label: string;
  /** Status the rule gives its slots; BLOCKED = Other Reasons. */
  slot_status?: string;
  slot_status_display?: string;
  is_active: boolean;
  created_at: string | null;
  created_by_name: string;
  removed_at: string | null;
  removed_by_name: string;
  summary: Partial<RulePlanSummary>;
  removal_summary: Partial<RemovalResult>;
  blocked_now_count: number;
  generated_count: number;
  removal_preview?: RemovalPreview;
}

export interface SlotBlockRuleList {
  equipment: { id: number; code: string; name: string };
  slot_times: SlotTimeOption[];
  status_options?: RuleStatusOption[];
  rules: SlotBlockRule[];
  removed_rules?: SlotBlockRule[];
}

export interface SlotBlockRuleInput {
  weekdays: number[];
  slot_times: string[];
  start_date: string;
  end_date: string;
  label: string;
  /** Default BLOCKED (Other Reasons). */
  slot_status?: string;
}

export class SlotBlockRulesApiError extends Error {
  status: number;
  code: string;
  field: string;

  constructor(status: number, body: Record<string, unknown>) {
    super(typeof body.detail === "string" && body.detail ? body.detail : `Request failed (${status})`);
    this.status = status;
    this.code = typeof body.code === "string" ? body.code : "";
    this.field = typeof body.field === "string" ? body.field : "";
  }
}

async function request<T>(url: string, opts: { method?: string; json?: unknown } = {}): Promise<T> {
  const token = apiClient.getToken();
  const headers: Record<string, string> = token ? { Authorization: `Token ${token}` } : {};
  let body: string | undefined;
  if (opts.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.json);
  }
  const res = await fetch(url, { method: opts.method ?? "GET", headers, body, credentials: "omit" });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new SlotBlockRulesApiError(res.status, data);
  return data as T;
}

export const slotBlockRulesApi = {
  list: (equipmentId: number | string) => request<SlotBlockRuleList>(`${slotBlockRulesBase(equipmentId)}/`),
  preview: (equipmentId: number | string, input: SlotBlockRuleInput) =>
    request<{ preview: RulePlanSummary }>(`${slotBlockRulesBase(equipmentId)}/preview/`, {
      method: "POST",
      json: input,
    }),
  create: (equipmentId: number | string, input: SlotBlockRuleInput) =>
    request<{ rule: SlotBlockRule; result: RulePlanSummary }>(`${slotBlockRulesBase(equipmentId)}/`, {
      method: "POST",
      json: input,
    }),
  get: (equipmentId: number | string, ruleId: number) =>
    request<{ rule: SlotBlockRule }>(`${slotBlockRulesBase(equipmentId)}/${ruleId}/`),
  remove: (equipmentId: number | string, ruleId: number) =>
    request<{ rule: SlotBlockRule; result: RemovalResult }>(`${slotBlockRulesBase(equipmentId)}/${ruleId}/remove/`, {
      method: "POST",
      json: {},
    }),
};

export type RangePreset = "rest_of_month" | "next_12_months" | "custom";

const ymd = (d: Date) => format(d, "yyyy-MM-dd");

/** Start/end dates (inclusive, YYYY-MM-DD) for a range preset, starting today. */
export function presetRange(preset: Exclude<RangePreset, "custom">, today: Date): { start: string; end: string } {
  if (preset === "rest_of_month") return { start: ymd(today), end: ymd(endOfMonth(today)) };
  return { start: ymd(today), end: ymd(addDays(addMonths(today, 12), -1)) };
}

function joinWithAnd(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} & ${items[items.length - 1]}`;
}

export function formatRuleDate(iso: string): string {
  return format(parseISO(iso), "d MMM yyyy");
}

/** e.g. "Every Mon & Thu at 10:00, 14:00 · 5 Oct 2026 – 31 Oct 2026". */
export function describeRule(rule: Pick<SlotBlockRule, "weekdays" | "slot_times" | "start_date" | "end_date">): string {
  const days = [...rule.weekdays].sort((a, b) => a - b).map((d) => WEEKDAY_LABELS[d] ?? String(d));
  const everyDay = days.length === 7 ? "Every day" : `Every ${joinWithAnd(days)}`;
  const times = [...rule.slot_times].sort().join(", ");
  return `${everyDay} at ${times} · ${formatRuleDate(rule.start_date)} – ${formatRuleDate(rule.end_date)}`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

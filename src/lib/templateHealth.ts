import type { BookingTemplate, TemplateHealth, TemplateHealthIssue } from "@/lib/api";
import { editTemplateUrl } from "@/lib/bookingTemplates";
import { SAMPLE_SETS_KEY } from "@/lib/sampleSets";

/** Errors the user cannot fix by editing the template (the card already says why it cannot be booked). */
const UNFIXABLE = new Set(["equipment_not_operational", "not_allowed", "no_charge_profile"]);

/**
 * Server findings worth repeating when a template is applied on the booking page. Removed inputs, choices no
 * longer offered, dropped sample sets and the preferred slot are already reported by the page itself.
 */
const APPLY_NOTICE_CODES = new Set([
  "required_missing",
  "table_invalid",
  "table_incomplete",
  "too_many_sample_sets",
  "combined_max",
  "quota_over_limit",
  "quota_low",
  "wallet_low",
  "no_wallet",
]);
const MAX_NOTICE_ITEMS = 3;
/** Numbers outside their limits (also inside advanced tables): the server refuses to save a template with one. */
const SAVE_BLOCKING_CODES = new Set(["numeric_min", "numeric_max", "numeric_formula_max", "table_invalid"]);

export type TemplateHealthBadge = { tone: "attention" | "advice"; label: string; issue: TemplateHealthIssue; count: number };

/** "Needs attention" when booking would fail for a reason the user can fix, "Advice" for warnings. */
export function templateHealthBadge(health: TemplateHealth | null | undefined): TemplateHealthBadge | null {
  const issues = health?.issues ?? [];
  const fixable = issues.filter((i) => i.severity === "error" && !UNFIXABLE.has(i.code));
  if (fixable.length) return { tone: "attention", label: "Needs attention", issue: fixable[0], count: fixable.length };
  const advice = issues.filter((i) => i.severity === "warning" || (i.severity === "error" && i.code === "no_charge_profile"));
  if (advice.length) return { tone: "advice", label: "Advice", issue: advice[0], count: advice.length };
  return null;
}

/** The first number outside its limits, which must be changed before the template can be saved. */
export function templateSaveBlocker(health: TemplateHealth | null | undefined): TemplateHealthIssue | null {
  return (health?.issues ?? []).find((i) => i.severity === "error" && SAVE_BLOCKING_CODES.has(i.code)) ?? null;
}

/** Template editor opened at the input (or preferred slot) the issue is about. */
export function fixTemplateUrl(
  t: Pick<BookingTemplate, "id" | "equipment">,
  issue: Pick<TemplateHealthIssue, "field"> | null,
  returnTo?: string
) {
  const url = editTemplateUrl(t, returnTo);
  return issue?.field ? `${url}&fix=${encodeURIComponent(issue.field)}` : url;
}

export type TemplateAdjustment = { field: string; label: string; set: number; from: number | null; to: number };

/**
 * Values over a maximum or under a minimum set to that limit, as the number inputs do when edited.
 * Only issues the server marked ``fix: "clamp"`` are applied.
 */
export function clampTemplateValues(
  values: Record<string, unknown>,
  issues: TemplateHealthIssue[] | null | undefined
): { values: Record<string, unknown>; adjusted: TemplateAdjustment[] } {
  const clamps = (issues ?? []).filter((i) => i.fix === "clamp" && i.field && typeof i.limit === "number");
  if (!clamps.length) return { values, adjusted: [] };
  const next: Record<string, unknown> = { ...values };
  const rawSets = Array.isArray(values[SAMPLE_SETS_KEY]) ? (values[SAMPLE_SETS_KEY] as unknown[]) : [];
  const sets = rawSets.map((s) => (s && typeof s === "object" && !Array.isArray(s) ? { ...(s as Record<string, unknown>) } : s));
  const setObjects = sets.filter((s): s is Record<string, unknown> => !!s && typeof s === "object" && !Array.isArray(s));
  const adjusted: TemplateAdjustment[] = [];
  for (const issue of clamps) {
    const setNo = issue.set && issue.set > 1 ? issue.set : 1;
    const target = setNo === 1 ? next : setObjects[setNo - 2];
    const field = issue.field as string;
    if (!target || !(field in target)) continue;
    const before = Number(target[field]);
    target[field] = String(issue.limit);
    adjusted.push({
      field,
      label: issue.label || field,
      set: setNo,
      from: Number.isFinite(before) ? before : null,
      to: issue.limit as number,
    });
  }
  if (rawSets.length) next[SAMPLE_SETS_KEY] = sets;
  return { values: next, adjusted };
}

/** One message for everything changed or still to fix when a template is applied, or null when nothing. */
export function templateApplyNotice(
  name: string,
  parts: { adjusted?: TemplateAdjustment[]; dropped?: string[]; setsDropped?: boolean; health?: TemplateHealth | null }
): { message: string; tone: "warning" | "info" } | null {
  const changed: string[] = [];
  for (const a of parts.adjusted ?? []) {
    const where = a.set > 1 ? ` (sample set ${a.set})` : "";
    changed.push(`${a.label}${where} ${a.from != null ? `${a.from} → ` : "set to "}${a.to}`);
  }
  if (parts.dropped?.length) changed.push(`reset: ${parts.dropped.join(", ")}`);
  if (parts.setsDropped) changed.push("only sample set 1 loaded");
  const todo = (parts.health?.issues ?? [])
    .filter((i) => APPLY_NOTICE_CODES.has(i.code))
    .slice(0, MAX_NOTICE_ITEMS)
    .map((i) => i.message);
  if (!changed.length && !todo.length) return null;
  const sentences = [
    changed.length ? `Template "${name}" applied with changes: ${changed.join("; ")}.` : `Template "${name}" applied.`,
    ...(todo.length ? [`Before booking: ${todo.join(" ")}`] : []),
  ];
  return { message: sentences.join(" "), tone: todo.length || parts.adjusted?.length ? "warning" : "info" };
}

import { formatBookingDateTime, parseBookingDate } from "@/lib/bookingDates";
import type { DemoPurpose, TrainingBadge } from "@/lib/trainingTypes";

export type StatusTone = "neutral" | "info" | "warning" | "success" | "danger" | "muted" | "accent";

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
  info: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-200",
  warning: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200",
  danger: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-200",
  muted: "border-border bg-muted text-muted-foreground",
  accent: "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/60 dark:text-violet-200",
};

export function toneClass(tone: StatusTone): string {
  return TONE_CLASSES[tone];
}

export type StatusKind = "demo" | "nomination" | "call" | "session" | "event" | "outcome" | "appeal" | "run" | "award";

const STATUS_META: Record<StatusKind, Record<string, { label: string; tone: StatusTone }>> = {
  demo: {
    SUBMITTED: { label: "Submitted", tone: "info" },
    UNDER_REVIEW: { label: "Under review", tone: "info" },
    PROPOSED_ALTERNATIVE: { label: "New time proposed", tone: "warning" },
    APPROVED: { label: "Approved", tone: "success" },
    SCHEDULED: { label: "Scheduled", tone: "accent" },
    COMPLETED: { label: "Completed", tone: "success" },
    REJECTED: { label: "Rejected", tone: "danger" },
    WITHDRAWN: { label: "Withdrawn", tone: "muted" },
    CANCELLED: { label: "Cancelled", tone: "muted" },
    EXPIRED: { label: "Expired", tone: "muted" },
    NO_SHOW: { label: "No-show", tone: "danger" },
  },
  nomination: {
    SUBMITTED: { label: "Submitted", tone: "info" },
    ELIGIBLE: { label: "Eligible", tone: "info" },
    INELIGIBLE: { label: "Ineligible", tone: "danger" },
    WITHDRAWN: { label: "Withdrawn", tone: "muted" },
    SELECTED: { label: "Selected", tone: "success" },
    WAITLISTED: { label: "Waitlisted", tone: "warning" },
    NOT_SELECTED: { label: "Not selected", tone: "neutral" },
    CONFIRMED: { label: "Seat confirmed", tone: "success" },
    DECLINED: { label: "Declined", tone: "muted" },
    EXPIRED: { label: "Expired", tone: "muted" },
  },
  call: {
    OPEN: { label: "Open", tone: "success" },
    CLOSED: { label: "Closed", tone: "warning" },
    PUBLISHED: { label: "Results published", tone: "accent" },
    CANCELLED: { label: "Cancelled", tone: "muted" },
  },
  session: {
    PLANNED: { label: "Planned", tone: "neutral" },
    SCHEDULED: { label: "Scheduled", tone: "accent" },
    COMPLETED: { label: "Completed", tone: "success" },
    CANCELLED: { label: "Cancelled", tone: "muted" },
  },
  event: {
    DRAFT: { label: "Draft", tone: "neutral" },
    PLANNED: { label: "Planned", tone: "neutral" },
    OPEN: { label: "Open", tone: "info" },
    SCHEDULED: { label: "Scheduled", tone: "accent" },
    IN_PROGRESS: { label: "In progress", tone: "info" },
    COMPLETED: { label: "Completed", tone: "success" },
    CANCELLED: { label: "Cancelled", tone: "muted" },
  },
  outcome: {
    SELECTED: { label: "Selected", tone: "success" },
    WAITLISTED: { label: "Waitlisted", tone: "warning" },
    NOT_SELECTED: { label: "Not selected", tone: "neutral" },
    INELIGIBLE: { label: "Ineligible", tone: "danger" },
  },
  appeal: {
    PENDING: { label: "Pending", tone: "warning" },
    UPHELD: { label: "Upheld", tone: "neutral" },
    OVERTURNED: { label: "Overturned", tone: "success" },
  },
  run: {
    DRAFT: { label: "Preview (draft)", tone: "warning" },
    PUBLISHED: { label: "Published", tone: "success" },
    SUPERSEDED: { label: "Superseded", tone: "muted" },
  },
  award: {
    ACTIVE: { label: "Active", tone: "success" },
    EXPIRED: { label: "Expired", tone: "muted" },
    DORMANT: { label: "Dormant", tone: "warning" },
    SUSPENDED: { label: "Suspended", tone: "danger" },
    REVOKED: { label: "Revoked", tone: "danger" },
  },
};

export function humanizeCode(code: string | null | undefined): string {
  if (!code) return "";
  const text = String(code).replace(/[_-]+/g, " ").trim().toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Label + tone for a status code; the server label wins when given. */
export function statusMeta(
  kind: StatusKind,
  status: string | null | undefined,
  serverLabel?: string | null,
): { label: string; tone: StatusTone } {
  const key = String(status ?? "").toUpperCase();
  const known = STATUS_META[kind][key];
  return {
    label: serverLabel?.trim() || known?.label || humanizeCode(key) || "—",
    tone: known?.tone ?? "neutral",
  };
}

export const OPEN_DEMO_STATUSES = ["SUBMITTED", "UNDER_REVIEW", "PROPOSED_ALTERNATIVE", "APPROVED", "SCHEDULED"];

export const PURPOSE_OPTIONS: Array<{ value: DemoPurpose; label: string }> = [
  { value: "COURSE", label: "Course / curricular" },
  { value: "RESEARCH_INDUCTION", label: "Research induction" },
  { value: "OTHER", label: "Other" },
];

export const CURTAIL_REASON_OPTIONS = [
  { value: "INSTRUMENT_TIME", label: "Instrument time not available" },
  { value: "SAMPLE_CONSUMABLE", label: "Sample / consumable limits" },
  { value: "SAFETY_CAPACITY", label: "Safety / room capacity" },
  { value: "POLICY_MAX", label: "Policy maximum" },
  { value: "OTHER", label: "Other" },
] as const;

export const NEED_CATEGORY_OPTIONS = [
  { value: "THESIS_CRITICAL", label: "Thesis-critical" },
  { value: "FUNDED_PROJECT", label: "Funded project" },
  { value: "EXPLORATORY", label: "Exploratory" },
] as const;

export const SESSION_TYPE_OPTIONS = [
  { value: "THEORY", label: "Theory" },
  { value: "DEMO", label: "Demonstration" },
  { value: "HANDS_ON", label: "Hands-on" },
  { value: "PRACTICE", label: "Practice" },
  { value: "ASSESSMENT", label: "Assessment" },
] as const;

export const SCORE_FACTOR_LABELS: Record<string, string> = {
  first_time_equipment: "First time on this equipment",
  never_trained_anywhere: "Never trained on any equipment",
  research_need: "Research need",
  demand: "Equipment demand",
  tenure: "Remaining tenure",
  department_underrepresentation: "Department under-represented",
  group_no_certified: "No certified user in group",
  cooldown: "Recent training cooldown",
  prior_no_show: "Prior no-show",
};

export const SCORE_FACTOR_ORDER = Object.keys(SCORE_FACTOR_LABELS);

export function scoreFactorLabel(key: string): string {
  return SCORE_FACTOR_LABELS[key] ?? humanizeCode(key);
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Score breakdown rows in a stable order: known factors first, then any extra keys from the server. */
export function scoreBreakdownRows(
  breakdown: Record<string, unknown> | null | undefined,
): Array<{ key: string; label: string; value: number }> {
  if (!breakdown) return [];
  const keys = [
    ...SCORE_FACTOR_ORDER.filter((k) => k in breakdown),
    ...Object.keys(breakdown).filter((k) => !SCORE_FACTOR_ORDER.includes(k)),
  ];
  const rows: Array<{ key: string; label: string; value: number }> = [];
  for (const key of keys) {
    const value = toNumber(breakdown[key]);
    if (value === null) continue;
    rows.push({ key, label: scoreFactorLabel(key), value });
  }
  return rows;
}

export function formatScore(value: unknown): string {
  const n = toNumber(value);
  if (n === null) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export interface CurtailInput {
  duration?: number | null;
  participants?: number | null;
}

/** True when the approval gives less duration or fewer participants than requested. */
export function isCurtailed(requested: CurtailInput, approved: CurtailInput): boolean {
  const less = (req?: number | null, appr?: number | null) =>
    req != null && appr != null && Number.isFinite(req) && Number.isFinite(appr) && appr < req;
  return less(requested.duration, approved.duration) || less(requested.participants, approved.participants);
}

export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
};

export function formatDateTime(value: string | null | undefined): string {
  return formatBookingDateTime(value, DATE_TIME_OPTIONS, "en-IN");
}

export function formatDate(value: string | null | undefined): string {
  return formatBookingDateTime(value, { day: "2-digit", month: "short", year: "numeric" }, "en-IN");
}

export function formatWindow(start: string | null | undefined, end: string | null | undefined): string {
  const s = parseBookingDate(start);
  const e = parseBookingDate(end);
  if (!s) return "—";
  if (!e) return formatDateTime(start);
  const sameDay = s.toDateString() === e.toDateString();
  const endText = sameDay
    ? e.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
    : formatDateTime(end);
  return `${formatDateTime(start)} – ${endText}`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO → value for <input type="datetime-local"> in local time. */
export function toLocalInputValue(value: string | Date | null | undefined): string {
  const d = value instanceof Date ? value : parseBookingDate(value ?? null);
  if (!d) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** <input type="datetime-local"> value (local time) → ISO string, or "" when empty/invalid. */
export function fromLocalInputValue(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

export function toDateInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addMinutesIso(iso: string, minutes: number): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() + minutes * 60_000).toISOString();
}

/** "2 d 4 h left" style countdown text for seat/confirmation deadlines. */
export function deadlineCountdown(deadline: string | null | undefined, now: Date = new Date()): string {
  const d = parseBookingDate(deadline);
  if (!d) return "";
  const ms = d.getTime() - now.getTime();
  if (ms <= 0) return "Deadline passed";
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days} d ${hours} h left`;
  if (hours > 0) return `${hours} h ${minutes} min left`;
  return `${Math.max(minutes, 1)} min left`;
}

export function parseRate(rate: string | number | null | undefined): number {
  const n = typeof rate === "number" ? rate : Number(rate ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Demo charge applies only for non-course purposes on equipment with a positive rate. */
export function isChargeable(purpose: DemoPurpose, rate: string | number | null | undefined): boolean {
  return purpose !== "COURSE" && parseRate(rate) > 0;
}

export function estimateCharge(rate: string | number | null | undefined, minutes: number | null | undefined): number {
  if (!minutes || minutes <= 0) return 0;
  return Math.round(parseRate(rate) * (minutes / 60) * 100) / 100;
}

/** "1, 2 3" → [1, 2, 3]; ignores anything that is not a positive integer. */
export function parseIdList(text: string): number[] {
  const out: number[] = [];
  for (const part of text.split(/[\s,;]+/)) {
    if (!/^\d+$/.test(part)) continue;
    const n = Number(part);
    if (n > 0 && !out.includes(n)) out.push(n);
  }
  return out;
}

export function trainingBadgeLabel(badge: Pick<TrainingBadge, "level" | "name" | "equipment_code" | "equipment_name">): string {
  const level = String(badge.level || "").toUpperCase();
  const prefix = !level || level === "TRAINED" ? "Trained" : badge.name || humanizeCode(level);
  const equipment = badge.equipment_code || badge.equipment_name;
  return equipment ? `${prefix} · ${equipment}` : prefix;
}

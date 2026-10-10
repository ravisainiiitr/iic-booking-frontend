import { academicStartYear, academicYearLabel } from "@/lib/academicYears";
import type { AccountingQuery, CalendarSlot, DutyMode, DutyPlanInput, FairnessRow, ShiftLine } from "@/lib/trainingOpsTypes";

const CHECKIN_EARLY_MS = 30 * 60_000;

/** Check-in/out the OIC can do on the operator's behalf right now (same window as the server). */
export function liveShiftAction(
  line: Pick<ShiftLine, "status" | "allocation_status" | "start" | "end">,
  now: Date = new Date(),
): "check-in" | "check-out" | null {
  if (line.status === "CHECKED_IN") return "check-out";
  if (line.status !== "SCHEDULED" || line.allocation_status !== "CONFIRMED") return null;
  const t = now.getTime();
  return t >= new Date(line.start).getTime() - CHECKIN_EARLY_MS && t <= new Date(line.end).getTime() ? "check-in" : null;
}

export const WEEKDAYS = [
  { value: 0, short: "Mon", label: "Monday" },
  { value: 1, short: "Tue", label: "Tuesday" },
  { value: 2, short: "Wed", label: "Wednesday" },
  { value: 3, short: "Thu", label: "Thursday" },
  { value: 4, short: "Fri", label: "Friday" },
  { value: 5, short: "Sat", label: "Saturday" },
  { value: 6, short: "Sun", label: "Sunday" },
] as const;

export const FAIRNESS_FACTOR_LABELS: Record<string, string> = {
  load: "Hours already done this term",
  rotation: "Waiting time since last duty",
  faculty_share: "Faculty group over its fair share",
  department_share: "Department over its fair share",
  repeat: "Duty blocks already given this term",
};

/** "3.5 h", "45 min", "0 h". */
export function formatHours(hours: number | null | undefined): string {
  const h = Number(hours ?? 0);
  if (!Number.isFinite(h) || h === 0) return "0 h";
  if (Math.abs(h) < 1) return `${Math.round(h * 60)} min`;
  return `${Number.isInteger(h) ? h : h.toFixed(h * 10 === Math.round(h * 10) ? 1 : 2)} h`;
}

export function minutesToHours(minutes: number | null | undefined): number {
  return Math.round((Number(minutes ?? 0) / 60) * 100) / 100;
}

/** Local calendar day key YYYY-MM-DD for an ISO date-time. */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function groupSlotsByDay<T extends { start_at: string }>(slots: T[]): Array<{ day: string; slots: T[] }> {
  const map = new Map<string, T[]>();
  for (const s of [...slots].sort((a, b) => a.start_at.localeCompare(b.start_at))) {
    const key = dayKey(s.start_at);
    const list = map.get(key);
    if (list) list.push(s);
    else map.set(key, [s]);
  }
  return [...map.entries()].map(([day, list]) => ({ day, slots: list }));
}

/** Contiguous selected slots become one shift (same rule as the server). */
export function mergeSelectedSlots(slots: CalendarSlot[], selected: Set<number>): Array<{ start: string; end: string; slotIds: number[] }> {
  const chosen = slots.filter((s) => selected.has(s.id)).sort((a, b) => a.start_at.localeCompare(b.start_at));
  const out: Array<{ start: string; end: string; slotIds: number[] }> = [];
  for (const s of chosen) {
    const last = out[out.length - 1];
    if (last && new Date(last.end).getTime() === new Date(s.start_at).getTime()) {
      last.end = s.end_at;
      last.slotIds.push(s.id);
    } else {
      out.push({ start: s.start_at, end: s.end_at, slotIds: [s.id] });
    }
  }
  return out;
}

/** Slots that cannot sensibly be staffed (past, maintenance, not available). */
export function slotSelectable(slot: CalendarSlot, now: Date = new Date()): boolean {
  if (new Date(slot.start_at).getTime() < now.getTime()) return false;
  return !["UNDER_MAINTENANCE", "SCHEDULED_MAINT", "NOT_AVAILABLE"].includes(slot.status);
}

export interface DutyFormState {
  mode: DutyMode;
  slotIds: number[];
  dateFrom: string;
  dateTo: string;
  timeFrom: string;
  timeTo: string;
  weekdays: number[];
}

export function planPayload(equipmentId: number, form: DutyFormState, operatorId?: number | null): DutyPlanInput {
  const base: DutyPlanInput = { equipment_id: equipmentId, mode: form.mode, operator_id: operatorId ?? undefined };
  if (form.mode === "slots") return { ...base, slot_ids: form.slotIds };
  return {
    ...base,
    date_from: form.dateFrom,
    date_to: form.mode === "range" || form.dateTo ? form.dateTo || form.dateFrom : form.dateFrom,
    time_from: form.timeFrom,
    time_to: form.timeTo,
    weekdays: form.weekdays,
  };
}

/** Why the form cannot be planned yet (empty string = ready). */
export function dutyFormProblem(form: DutyFormState): string {
  if (form.mode === "slots") return form.slotIds.length ? "" : "Pick at least one slot on the calendar.";
  if (!form.dateFrom) return "Choose the start date.";
  if (form.dateTo && form.dateTo < form.dateFrom) return "The end date is before the start date.";
  if (!form.timeFrom || !form.timeTo) return "Choose the daily time window.";
  if (form.timeTo <= form.timeFrom) return "The daily window must end after it starts.";
  if (!form.weekdays.length) return "Choose at least one weekday.";
  return "";
}

/** Last `count` months as {value: YYYY-MM, label: "Oct 2026"}, newest first. */
export function recentMonths(count = 12, today: Date = new Date()): Array<{ value: string; label: string }> {
  const out: Array<{ value: string; label: string }> = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ value, label: d.toLocaleDateString("en-IN", { month: "short", year: "numeric" }) });
  }
  return out;
}

/** Current and previous academic years, newest first ("2026-27", "2025-26", …). */
export function academicYearChoices(count = 3, today: Date = new Date()): string[] {
  const start = academicStartYear(today);
  return Array.from({ length: count }, (_, i) => academicYearLabel(start - i));
}

/** Period selector value ("ay:2026-27" or "m:2026-10") → accounting query. */
export function periodQuery(value: string): Pick<AccountingQuery, "academic_year" | "month"> {
  if (value.startsWith("m:")) return { month: value.slice(2) };
  if (value.startsWith("ay:")) return { academic_year: value.slice(3) };
  return {};
}

/** One line telling the OIC who to pick and why. */
export function nextInRotation(ranking: FairnessRow[]): string {
  const top = ranking.find((r) => r.rank === 1);
  if (!top) return ranking.length ? "Nobody is free within the caps and cooling period; choosing someone needs a reason." : "";
  return `${top.name} is next in the fair rotation${top.reasons.length > 1 ? ` — ${top.reasons.slice(1, 3).join("; ").toLowerCase()}` : ""}.`;
}

export function shareLabel(hours: number | null | undefined, members: number | null | undefined): string {
  if (hours == null || members == null) return "";
  return `${Math.round(hours * 100)}% of hours for ${Math.round(members * 100)}% of operators`;
}

export function absoluteUrl(path: string): string {
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.origin).toString();
}

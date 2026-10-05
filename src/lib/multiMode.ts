/** Multi-mode equipment page: API shapes and pure calendar helpers. */

export type ModeAvailability = "ALWAYS" | "SCHEDULED_ONLY";
export type ModeBehavior = "PARALLEL" | "EXCLUSIVE";

export type MultiModeChild = {
  equipment_id: number;
  code: string;
  name: string;
  status?: string | null;
  mode_availability?: ModeAvailability;
  can_manage?: boolean;
};

export type MultiModeSchedule = {
  id: number;
  parent_equipment_id: number;
  mode_equipment_id: number;
  mode_equipment_code?: string | null;
  mode_equipment_name?: string | null;
  start_date: string;
  end_date: string;
  start_time?: string | null;
  end_time?: string | null;
  /** 0 = Monday … 6 = Sunday; empty = every day. */
  weekdays?: number[];
  behavior: ModeBehavior | string;
  behavior_display?: string;
  unavailable_label?: string;
  unavailable_color?: string;
  exclusive_blocked_label?: string;
  exclusive_blocked_color?: string;
};

export type MultiModeFamily = {
  parent_equipment_id: number;
  parent_code: string;
  parent_name: string;
  parent_status?: string | null;
  department_id?: number | null;
  department_name?: string | null;
  children: MultiModeChild[];
  schedules: MultiModeSchedule[];
};

export type MultiModeEquipmentRow = {
  equipment_id: number;
  code: string;
  name: string;
  status?: string | null;
  department_id?: number | null;
  department_name?: string | null;
};

export type MultiModeOverview = {
  scope: "admin" | "oic" | "dept_admin";
  department_id: number | null;
  departments: Array<{ id: number; name: string }>;
  families: MultiModeFamily[];
  base_candidates: MultiModeEquipmentRow[];
  availability_choices?: Array<{ value: ModeAvailability; label: string }>;
};

export type MultiModeCandidate = {
  equipment_id: number;
  code: string;
  name: string;
  is_mode: boolean;
  mode_availability?: ModeAvailability;
  locked?: boolean;
};

export type MultiModeFamilyDetail = {
  family: MultiModeFamily;
  candidates: MultiModeCandidate[];
  changes?: { added: number[]; removed: number[]; availability_changed: number[] };
};

export type MultiModeSchedulePayload = {
  parent_equipment_id?: number;
  mode_equipment_id: number;
  start_date: string;
  end_date: string;
  weekdays: number[];
  start_time: string | null;
  end_time: string | null;
  behavior: ModeBehavior;
  unavailable_label?: string;
  unavailable_color?: string;
  exclusive_blocked_label?: string;
  exclusive_blocked_color?: string;
};

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const DEFAULT_UNAVAILABLE_LABEL = "Mode not scheduled";
export const DEFAULT_EXCLUSIVE_LABEL = "Alternate mode active";
export const DEFAULT_GREY = "#9ca3af";

const MODE_PALETTE = ["#2563eb", "#16a34a", "#d97706", "#9333ea", "#db2777", "#0891b2", "#65a30d", "#dc2626"];

/** Stable colour per mode, by its position in the family. */
export function modeColor(modeIds: number[], modeId: number): string {
  const idx = modeIds.indexOf(modeId);
  return MODE_PALETTE[(idx >= 0 ? idx : modeIds.length) % MODE_PALETTE.length];
}

export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Python-style weekday (Monday = 0) for a YYYY-MM-DD string, independent of the browser time zone. */
export function weekdayOf(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return (new Date(y, m - 1, d).getDay() + 6) % 7;
}

export function scheduleCoversDate(s: Pick<MultiModeSchedule, "start_date" | "end_date" | "weekdays">, iso: string): boolean {
  if (iso < s.start_date || iso > s.end_date) return false;
  const days = s.weekdays ?? [];
  return days.length === 0 || days.includes(weekdayOf(iso));
}

/** Weeks (Mon–Sun) covering the month; days outside the month are null. */
export function monthGrid(year: number, month: number): Array<Array<string | null>> {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<string | null> = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(isoDate(new Date(year, month, d)));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: Array<Array<string | null>> = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function describeWeekdays(days: number[] | undefined): string {
  if (!days || days.length === 0 || days.length === 7) return "Every day";
  return [...days].sort((a, b) => a - b).map((d) => WEEKDAY_LABELS[d]).join(", ");
}

export function describeHours(start?: string | null, end?: string | null): string {
  if (!start || !end) return "All day";
  return `${start.slice(0, 5)}–${end.slice(0, 5)}`;
}

/** Multi-mode equipment availability (equipment page section and catalog cards): API shapes and pure helpers. */

import { modeColor } from "@/lib/multiMode";

export type ModeDayStatus =
  | "available"
  | "full"
  | "not_available"
  | "holiday"
  | "closed"
  | "maintenance"
  | "not_open"
  | "not_running"
  | "past";

export type ModeState = "available" | "full" | "not_open" | "not_running" | "maintenance";

export type ModeAvailabilityMode = {
  equipment_id: number;
  code: string;
  name: string;
  role: "base" | "mode";
  operational: boolean;
  /** 0 = Monday … 6 = Sunday: days this mode runs in the next four weeks. */
  weekdays: number[];
  /** Daily hours of the mode's schedules ("09:00–13:00") when limited. */
  hours: string[];
  state: ModeState;
  next_available: { date: string; free_slots: number; first_slot_at?: string } | null;
  next_opening: { date: string; opens_at: string } | null;
  mode_availability?: string | null;
  window?: { min_date: string; max_date: string };
};

export type ModeDayCell = {
  equipment_id: number;
  status: ModeDayStatus;
  label: string;
  free_slots?: number;
  total_slots?: number;
  first_slot_at?: string;
  opens_at?: string;
  partial?: boolean;
  blocked_by?: number | null;
};

export type ModeAvailabilityDay = {
  date: string;
  weekday: number;
  is_today: boolean;
  is_past: boolean;
  holiday: string | null;
  weekend: boolean;
  modes: ModeDayCell[];
};

export type ModeAvailabilitySummary = {
  multi_mode: true;
  equipment_id: number;
  parent_equipment_id: number;
  generated_at: string;
  today: string;
  start_date: string;
  end_date: string;
  modes: ModeAvailabilityMode[];
  days: ModeAvailabilityDay[];
};

export type ModeAvailabilityResponse = ModeAvailabilitySummary | { multi_mode: false; equipment_id: number };

/** Compact catalog-card variant (``mode_availability`` on equipment list rows). */
export type CardModeAvailability = {
  parent_equipment_id: number;
  today?: string;
  modes: Array<
    Pick<
      ModeAvailabilityMode,
      "equipment_id" | "code" | "name" | "role" | "operational" | "weekdays" | "hours" | "state" | "next_opening"
    > & { next_available: { date: string; free_slots: number } | null }
  >;
};

export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const WEEKDAY_LETTER = ["M", "T", "W", "T", "F", "S", "S"] as const;
export const BASE_MODE_COLOR = "#475569";

/** Colour per family member: the base is slate; modes use the Multi-mode equipment page palette. */
export function familyColors(modes: Array<Pick<ModeAvailabilityMode, "equipment_id" | "role">>): Map<number, string> {
  const childIds = modes.filter((m) => m.role === "mode").map((m) => m.equipment_id);
  const out = new Map<number, string>();
  for (const m of modes) out.set(m.equipment_id, m.role === "base" ? BASE_MODE_COLOR : modeColor(childIds, m.equipment_id));
  return out;
}

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Thu, 10 Oct" for a YYYY-MM-DD string (no time-zone shift). */
export function formatDay(iso: string): string {
  const d = parseIsoDate(iso);
  return `${WEEKDAY_SHORT[(d.getDay() + 6) % 7]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "Wed, 15 Oct, 9:00 PM" for an ISO datetime, in the browser's local time. */
export function formatOpensAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const h = d.getHours();
  const time = `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  return `${WEEKDAY_SHORT[(d.getDay() + 6) % 7]}, ${d.getDate()} ${MONTHS[d.getMonth()]}, ${time}`;
}

/** Short status text for a calendar cell (the full label goes in the tooltip). */
export function shortStatus(cell: Pick<ModeDayCell, "status" | "free_slots" | "opens_at" | "label">): string {
  switch (cell.status) {
    case "available":
      return `${cell.free_slots ?? 0} free`;
    case "full":
      return "Full";
    case "holiday":
      return "Holiday";
    case "closed":
      return "Closed";
    case "maintenance":
      return "Maintenance";
    case "not_open": {
      const d = cell.opens_at ? new Date(cell.opens_at) : null;
      return d && !Number.isNaN(d.getTime()) ? `Opens ${d.getDate()} ${MONTHS[d.getMonth()]}` : "Not open yet";
    }
    case "not_running":
      return "Not running";
    case "past":
      return "";
    default:
      return cell.label === "No more slots today" ? "Done today" : "Unavailable";
  }
}

/** One-line state for a mode, used by the legend and the catalog card. */
export function modeHeadline(m: Pick<ModeAvailabilityMode, "state" | "next_available" | "next_opening">): string {
  if (m.state === "maintenance") return "Under maintenance";
  if (m.next_available) return `Next available: ${formatDay(m.next_available.date)}`;
  if (m.state === "full") {
    return m.next_opening
      ? `Fully booked for now · more from ${formatDay(m.next_opening.date)}`
      : "Fully booked for now";
  }
  if (m.next_opening) return `Next runs ${formatDay(m.next_opening.date)} · booking opens ${formatOpensAt(m.next_opening.opens_at)}`;
  return "Not running in the next 4 weeks";
}

/** Shorter state for catalog cards; ``compact`` drops the prefix for per-mode rows. */
export function cardHeadline(
  m: Pick<ModeAvailabilityMode, "state" | "next_available" | "next_opening">,
  compact = false,
): string {
  if (m.state === "maintenance") return compact ? "Maintenance" : "Under maintenance";
  if (m.next_available) return compact ? formatDay(m.next_available.date) : `Next available: ${formatDay(m.next_available.date)}`;
  if (m.state === "full") return compact ? "Fully booked" : "Fully booked for now";
  if (m.next_opening) {
    return compact
      ? `Opens ${formatDay(m.next_opening.opens_at.slice(0, 10))}`
      : `Booking opens ${formatOpensAt(m.next_opening.opens_at)}`;
  }
  return "Not running soon";
}

export function describeModeWeekdays(days: number[]): string {
  if (days.length === 0) return "No running days in the next 4 weeks";
  if (days.length === 7) return "Runs every day";
  return `Runs ${days.map((d) => WEEKDAY_SHORT[d]).join(", ")}`;
}

/** Days in calendar weeks (Mon–Sun rows). */
export function weeksOf<T extends { weekday: number }>(days: T[]): T[][] {
  const weeks: T[][] = [];
  for (const day of days) {
    if (day.weekday === 0 || weeks.length === 0) weeks.push([]);
    weeks[weeks.length - 1].push(day);
  }
  return weeks;
}

/** Booking page link for a mode, opened at the week of ``date``. */
export function bookingPathFor(equipmentId: number, date?: string | null, bookOnBehalf = false): string {
  const q = new URLSearchParams({ equipment_id: String(equipmentId) });
  if (bookOnBehalf) q.set("mode", "book");
  if (date) q.set("date", date);
  return `/book-equipment?${q.toString()}`;
}

/** Equipment that belongs to a multi-mode family (base with modes, or a mode). */
export function isMultiModeEquipment(eq: { parent_equipment?: unknown; enable_multi_mode?: boolean | null } | null | undefined): boolean {
  if (!eq) return false;
  return Boolean(eq.enable_multi_mode) || (eq.parent_equipment != null && eq.parent_equipment !== "");
}

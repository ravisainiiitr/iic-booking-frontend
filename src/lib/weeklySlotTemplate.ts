import { slotsNeededForAnalysisTime } from "@/lib/slotAllocation";
import { WEEKDAY_NAMES, type PreferredSlotDraft } from "@/lib/templatePreferredSlot";

/** One row of the weekly slot template (same for every bookable weekday; times are local wall-clock). */
export interface WeeklySlotRow {
  /** "HH:MM" start time; also the value saved as the preferred slot's start_time. */
  key: string;
  /** Minutes from midnight. `end` may exceed 1440 when the slot ends at or after midnight. */
  start: number;
  end: number;
  /** Row label for the vertical axis: "09:00 – 10:30", or "Slot 2" when the equipment hides times. */
  label: string;
  /** "09:00 – 10:30" even when `label` is a slot position. */
  timeRange: string;
}

export interface WeeklySlotTemplateSource {
  slot_masters?: Array<{ open_time?: string | null; close_time?: string | null; is_active?: boolean | null }> | null;
  slot_master_times?: string[] | null;
  slot_start_time?: string | null;
  slot_end_time?: string | null;
  slot_duration_minutes?: number | null;
  weekly_view_time_from?: string | null;
  weekly_view_time_to?: string | null;
  weekly_view_display?: "TIME" | "SLOT_ID" | null;
}

/** Bookable weekdays (0 = Monday). Saturdays and Sundays are always holidays in the backend. */
export const PREFERRED_SLOT_WEEKDAYS = [0, 1, 2, 3, 4] as const;

export const toMinutes = (raw: string | null | undefined): number | null => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(raw ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
};

export const minutesToKey = (total: number): string => {
  const wrapped = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
};

export const formatDurationMinutes = (minutes: number): string => {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest} min`;
  const hours = `${h} hour${h === 1 ? "" : "s"}`;
  return rest === 0 ? hours : `${hours} ${rest} min`;
};

/**
 * Weekly slot rows from the equipment settings, using the same sources as the booking page grid:
 * active Slot Masters (open/close time), else their open times plus the slot duration, else the
 * equipment's slot window split by the slot duration. Regular users only see slots that lie fully
 * inside the weekly view window (as the slots API filters them), so `applyVisibilityWindow` drops the rest.
 */
export function buildWeeklySlotRows(
  source: WeeklySlotTemplateSource | null | undefined,
  opts: { applyVisibilityWindow?: boolean; hideTimes?: boolean } = {}
): WeeklySlotRow[] {
  if (!source) return [];
  const duration = Math.max(1, Math.round(Number(source.slot_duration_minutes) || 60));
  const spans: Array<{ start: number; end: number }> = [];

  const masters = (source.slot_masters ?? []).filter((m) => m && m.is_active !== false);
  for (const m of masters) {
    const start = toMinutes(m.open_time);
    if (start == null) continue;
    const close = toMinutes(m.close_time);
    let end = close == null ? start + duration : close;
    if (end <= start) end += 1440;
    spans.push({ start, end });
  }
  if (spans.length === 0) {
    for (const t of source.slot_master_times ?? []) {
      const start = toMinutes(t);
      if (start != null) spans.push({ start, end: start + duration });
    }
  }
  if (spans.length === 0) {
    const from = toMinutes(source.slot_start_time);
    const to = toMinutes(source.slot_end_time);
    if (from != null && to != null && to > from) {
      for (let m = from; m + duration <= to; m += duration) spans.push({ start: m, end: m + duration });
    }
  }

  const byStart = new Map<number, { start: number; end: number }>();
  for (const s of spans.sort((a, b) => a.start - b.start)) {
    if (!byStart.has(s.start)) byStart.set(s.start, s);
  }
  let rows = [...byStart.values()];

  if (opts.applyVisibilityWindow) {
    const from = toMinutes(source.weekly_view_time_from);
    const to = toMinutes(source.weekly_view_time_to);
    rows = rows.filter((r) => {
      if (from != null && r.start < from) return false;
      // Mirrors the slots API, which compares wall-clock end times (a slot ending at midnight reads as 00:00).
      if (to != null && r.end % 1440 > to) return false;
      return true;
    });
  }

  return rows.map((r, i) => {
    const timeRange = `${minutesToKey(r.start)} – ${minutesToKey(r.end)}`;
    return {
      key: minutesToKey(r.start),
      start: r.start,
      end: r.end,
      timeRange,
      label: opts.hideTimes ? `Slot ${i + 1}` : timeRange,
    };
  });
}

export type RunCheck =
  | { ok: true; rows: WeeklySlotRow[]; minutes: number }
  | { ok: false; reason: "past_end"; available: number }
  | { ok: false; reason: "break"; breakAfter: WeeklySlotRow; breakBefore: WeeklySlotRow };

/** The `count` back-to-back slots starting at row `startIndex`, or why they cannot be booked as one run. */
export function consecutiveRun(rows: readonly WeeklySlotRow[], startIndex: number, count: number): RunCheck {
  const n = Math.max(1, Math.floor(count));
  if (startIndex < 0 || startIndex >= rows.length || startIndex + n > rows.length) {
    return { ok: false, reason: "past_end", available: Math.max(0, rows.length - Math.max(0, startIndex)) };
  }
  const run = rows.slice(startIndex, startIndex + n);
  for (let i = 0; i < run.length - 1; i += 1) {
    if (run[i].end !== run[i + 1].start) {
      return { ok: false, reason: "break", breakAfter: run[i], breakBefore: run[i + 1] };
    }
  }
  return { ok: true, rows: run, minutes: run.reduce((sum, r) => sum + (r.end - r.start), 0) };
}

/** Start rows from which `count` consecutive slots fit. */
export function validRunStarts(rows: readonly WeeklySlotRow[], count: number): Set<number> {
  const ok = new Set<number>();
  rows.forEach((_, i) => {
    if (consecutiveRun(rows, i, count).ok) ok.add(i);
  });
  return ok;
}

export function runProblemMessage(check: RunCheck, count: number, hideTimes = false): string | null {
  if (check.ok === true) return null;
  const problem = check as Exclude<RunCheck, { ok: true }>;
  const slots = `${count} slot${count === 1 ? "" : "s"}`;
  if (problem.reason === "past_end") {
    return `${slots} starting here would run past the last slot of the day. Choose an earlier start.`;
  }
  const where = hideTimes ? "" : ` at ${minutesToKey(problem.breakAfter.end)}`;
  return `${slots} starting here would cross a break${where}; booked slots must be back to back. Choose another start.`;
}

/** Same count the booking page requires for these inputs: analysis time vs. slot duration and tolerance. */
export function slotsRequiredForMinutes(
  totalMinutes: number | null | undefined,
  equipment: { slot_duration_minutes?: number | null; slot_tolerance_minutes?: number | null } | null | undefined
): number | null {
  if (totalMinutes == null || !Number.isFinite(Number(totalMinutes))) return null;
  const oneSlot = Number(equipment?.slot_duration_minutes) || 60;
  const tolerance = Math.max(0, Number(equipment?.slot_tolerance_minutes ?? 0) || 0);
  const needed = slotsNeededForAnalysisTime(Number(totalMinutes), oneSlot, tolerance);
  return needed >= 1 ? needed : null;
}

export const rowIndexForStart = (rows: readonly WeeklySlotRow[], startTime: string | null | undefined): number => {
  const m = toMinutes(startTime);
  return m == null ? -1 : rows.findIndex((r) => r.start === m);
};

/** e.g. "Every Wednesday, 10:00–13:00 (2 slots)", or "Every Wednesday, Slot 2 – Slot 3 (2 slots)" when times are hidden. */
export function describeWeeklySelection(weekday: number, run: readonly WeeklySlotRow[], hideTimes = false): string {
  if (run.length === 0) return "";
  const first = run[0];
  const last = run[run.length - 1];
  const span = hideTimes
    ? run.length === 1
      ? first.label
      : `${first.label} – ${last.label}`
    : `${minutesToKey(first.start)}–${minutesToKey(last.end)}`;
  return `Every ${WEEKDAY_NAMES[weekday] ?? "?"}, ${span} (${run.length} slot${run.length === 1 ? "" : "s"})`;
}

/** Why an enabled preferred slot cannot be saved as it stands, or null when it can (or is off). */
export function preferredSlotDraftProblem(
  draft: Pick<PreferredSlotDraft, "enabled" | "weekday" | "startTime" | "slotCount">,
  rows: readonly WeeklySlotRow[]
): string | null {
  if (!draft.enabled) return null;
  if (!draft.startTime) return "Choose your preferred slot in the calendar, or turn Preferred slot off.";
  if (rows.length === 0) return null;
  const idx = rowIndexForStart(rows, draft.startTime);
  const weekdayOk = (PREFERRED_SLOT_WEEKDAYS as readonly number[]).includes(draft.weekday);
  if (idx < 0 || !weekdayOk || !consecutiveRun(rows, idx, draft.slotCount).ok) {
    return "Your preferred slot no longer matches this equipment's slot timings. Choose it again in the calendar, or turn Preferred slot off.";
  }
  return null;
}

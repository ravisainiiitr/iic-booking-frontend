/**
 * Sample submission policy derived from equipment configuration (mirrors the backend rules in
 * sample_submission_deadline_reminders / sample_lifecycle_policy):
 * - deadline = slot start − the equipment's sample lead time, moved to the same time on the
 *   previous working day when it falls on a weekend or institute holiday;
 * - lead time 0 = no advance deadline: the sample is brought at the start of the slot;
 * - lead time 0 and no collect deadline = walk-in: the user also takes the sample back.
 */

import { format } from "date-fns";

export const formatSlotTime = (value: string | Date) => format(new Date(value), "EEE d MMM, h:mm a");

export type SamplePolicyEquipment = {
  equipment_id: number;
  code: string;
  name: string;
  status?: string | null;
  parent_equipment?: number | null;
  sample_submission_lead_hours?: number | null;
  sample_collect_deadline_hours?: number | null;
};

const hours = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : null;

/** Lead time in hours, or null when the payload does not carry it. */
export function sampleLeadHours(eq: SamplePolicyEquipment | null | undefined): number | null {
  return eq ? hours(eq.sample_submission_lead_hours) : null;
}

export function bringsSampleToSlot(eq: SamplePolicyEquipment | null | undefined): boolean {
  return sampleLeadHours(eq) === 0;
}

export function isWalkInSampleEquipment(eq: SamplePolicyEquipment | null | undefined): boolean {
  return bringsSampleToSlot(eq) && hours(eq?.sample_collect_deadline_hours) === 0;
}

export function sampleAtSlotEquipment<T extends SamplePolicyEquipment>(rows: readonly T[]): T[] {
  return rows.filter(bringsSampleToSlot).sort((a, b) => a.name.localeCompare(b.name));
}

/** "Field Emission Scanning Electron Microscope (FE-SEM)-APREO" → "FE-SEM"; falls back to the code. */
export function shortEquipmentLabel(eq: Pick<SamplePolicyEquipment, "name" | "code">): string {
  const abbr = /\(([^()]{2,12})\)/.exec(eq.name)?.[1]?.trim();
  return abbr || eq.code || eq.name;
}

export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Short names of top-level equipment where the sample is brought to the slot, e.g. "FE-SEM, SPM and TEM". */
export function sampleAtSlotShortList(rows: readonly SamplePolicyEquipment[], max = 4): string {
  const labels = [
    ...new Set(sampleAtSlotEquipment(rows.filter((r) => r.parent_equipment == null)).map(shortEquipmentLabel)),
  ].sort((a, b) => a.localeCompare(b));
  return joinNames(labels.slice(0, max));
}

/** Most common lead time among equipment that have one (for the illustrative example). */
export function typicalSampleLeadHours(rows: readonly SamplePolicyEquipment[]): number | null {
  const counts = new Map<number, number>();
  for (const r of rows) {
    const h = sampleLeadHours(r);
    if (h && h > 0) counts.set(h, (counts.get(h) ?? 0) + 1);
  }
  let best: number | null = null;
  for (const [h, n] of counts) if (best == null || n > (counts.get(best) ?? 0) || (n === counts.get(best) && h < best)) best = h;
  return best;
}

/**
 * slot start − lead time, moved back over Saturdays and Sundays keeping the clock time.
 * Institute holidays are only known to the server, so callers say the booking shows the exact deadline.
 */
export function estimateSampleDeadline(start: Date, leadHours: number): { deadline: Date; movedFromWeekend: boolean } {
  const deadline = new Date(start.getTime() - leadHours * 3_600_000);
  let moved = false;
  while (deadline.getDay() === 0 || deadline.getDay() === 6) {
    deadline.setDate(deadline.getDate() - 1);
    moved = true;
  }
  return { deadline, movedFromWeekend: moved };
}

export type BookingSampleDeadline =
  | { kind: "at-slot"; walkIn: boolean }
  /** Reported by the server (exact, holidays included). */
  | { kind: "deadline"; deadlineAt: string; leadHours: number | null }
  /** Estimated from the lead time; holidays may move it a day earlier. */
  | { kind: "estimate"; deadline: Date; leadHours: number; movedFromWeekend: boolean }
  | { kind: "unknown" };

export function bookingSampleDeadline(
  booking: { equipmentId?: number | null; startTime: string; deadlineAt?: string | null; leadHours?: number | null },
  rows: readonly SamplePolicyEquipment[]
): BookingSampleDeadline {
  const eq = booking.equipmentId != null ? rows.find((r) => r.equipment_id === booking.equipmentId) : undefined;
  if (eq && bringsSampleToSlot(eq)) return { kind: "at-slot", walkIn: isWalkInSampleEquipment(eq) };
  if (booking.deadlineAt) return { kind: "deadline", deadlineAt: booking.deadlineAt, leadHours: booking.leadHours ?? null };
  const lead = sampleLeadHours(eq);
  const start = new Date(booking.startTime);
  if (lead && lead > 0 && !Number.isNaN(start.getTime())) {
    const { deadline, movedFromWeekend } = estimateSampleDeadline(start, lead);
    return { kind: "estimate", deadline, leadHours: lead, movedFromWeekend };
  }
  return { kind: "unknown" };
}

export function hoursLabel(h: number): string {
  return h === 1 ? "1 hour" : `${h} hours`;
}

/** Next day (after `from`) with the given weekday at 10:00 local time, for the illustrative example. */
export function nextWeekdayAt10(from: Date, weekday: number): Date {
  const d = new Date(from);
  d.setHours(10, 0, 0, 0);
  do d.setDate(d.getDate() + 1);
  while (d.getDay() !== weekday);
  return d;
}

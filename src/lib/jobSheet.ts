/** Helpers for the Lab Operator job sheet (booking details as the instrument operator reads them). */
import { parseBookingDate } from "@/lib/bookingDates";

export type JobSheetSlot = {
  slot_name?: string | null;
  date?: string | null;
  start_datetime: string;
  end_datetime: string;
};

export type JobSheetSlotDay = {
  /** e.g. "Tue, 6 Oct 2026" */
  dateLabel: string;
  /** Contiguous slots merged: ["10:00 am – 12:00 pm"]; slot names instead when the equipment hides times. */
  ranges: string[];
  slotCount: number;
};

const dateFmt = (d: Date) =>
  d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const timeFmt = (d: Date) => d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** Booked slots grouped by day, back-to-back slots shown as one time range. */
export function groupSlotsByDay(
  slots: JobSheetSlot[] | null | undefined,
  options: { hideTimes?: boolean } = {},
): JobSheetSlotDay[] {
  const parsed = (slots ?? [])
    .map((s) => ({ slot: s, start: parseBookingDate(s.start_datetime), end: parseBookingDate(s.end_datetime) }))
    .filter((s): s is { slot: JobSheetSlot; start: Date; end: Date } => s.start != null && s.end != null)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const days: JobSheetSlotDay[] = [];
  let currentKey = "";
  let runStart: Date | null = null;
  let runEnd: Date | null = null;
  const flush = () => {
    if (runStart && runEnd && !options.hideTimes) days[days.length - 1].ranges.push(`${timeFmt(runStart)} – ${timeFmt(runEnd)}`);
    runStart = null;
    runEnd = null;
  };
  for (const { slot, start, end } of parsed) {
    const key = dayKey(start);
    if (key !== currentKey) {
      flush();
      currentKey = key;
      days.push({ dateLabel: dateFmt(start), ranges: [], slotCount: 0 });
    }
    const day = days[days.length - 1];
    day.slotCount += 1;
    if (options.hideTimes) {
      day.ranges.push(String(slot.slot_name || `Slot ${day.slotCount}`));
      continue;
    }
    if (runEnd && start.getTime() === runEnd.getTime()) {
      runEnd = end;
    } else {
      flush();
      runStart = start;
      runEnd = end;
    }
  }
  flush();
  return days;
}

/** "2 h", "1 h 30 min", "45 min"; "" when unknown. */
export function formatDurationMinutes(minutes: number | string | null | undefined): string {
  const total = Math.round(Number(minutes));
  if (!Number.isFinite(total) || total <= 0) return "";
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h} h ${m} min`;
  return h ? `${h} h` : `${m} min`;
}

type TraceEvent = { status: string; status_display?: string | null; created_at: string };

/** Latest sample lifecycle step (e.g. "Sample Accepted"), or null before the sample is sent. */
export function latestSampleStage(trace: TraceEvent[] | null | undefined): TraceEvent | null {
  const events = [...(trace ?? [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  return events.length > 0 ? events[events.length - 1] : null;
}

const SAFETY_LABEL_RE = /hazard|safety|toxic|flammab|corrosiv|explosiv|radioactiv|biohazard|precaution|msds|sds\b/i;

/** Inputs whose label suggests safety information the operator must not miss. */
export function isSafetyRelatedLabel(label: string | null | undefined): boolean {
  return SAFETY_LABEL_RE.test(String(label || ""));
}

export function telHref(phone: string | null | undefined): string | null {
  const digits = String(phone || "").replace(/[^\d+]/g, "");
  return digits.length >= 6 ? `tel:${digits}` : null;
}

/** Print only `node` (a clone in a top-level container), so long pages leave no blank sheets and the app shell is hidden. */
export function printElement(node: HTMLElement | null): void {
  if (!node) {
    window.print();
    return;
  }
  const doc = document;
  doc.getElementById("jobsheet-print-portal")?.remove();
  const portal = doc.createElement("div");
  portal.id = "jobsheet-print-portal";
  portal.appendChild(node.cloneNode(true));
  doc.body.appendChild(portal);
  doc.documentElement.classList.add("print-jobsheet");
  const cleanup = () => {
    doc.documentElement.classList.remove("print-jobsheet");
    portal.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
}

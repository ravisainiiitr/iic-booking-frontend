/**
 * How a booking reads in the app: its tab, the colour of its status and its progress timeline. This only presents what
 * the server reports. The wording of a status stays the server's own, and no rule is decided here.
 */

export type BookingTab = "upcoming" | "pending" | "past" | "cancelled";
export type BookingTone = "neutral" | "info" | "success" | "warning" | "danger";

type JourneyBooking = {
  status?: string | null;
  list_status?: string | null;
  start_time?: string | null;
  end_time?: string | null;
};

const statusOf = (b: JourneyBooking) => String(b.status ?? "").toUpperCase();

/** Bookings that need something to happen before they are settled, whatever their date. */
const NEEDS_ACTION = new Set(["PENDING", "PENDING_PAYMENT", "WAITLISTED", "HOLD", "DISRUPTION_PENDING", "UNDER_MAINTENANCE", "OTHER_DISRUPTION"]);
const CLOSED = new Set(["CANCELLED", "REFUNDED"]);
const FINISHED = new Set(["COMPLETED", "ABSENT", "BOOKING_NOT_UTILIZED"]);

export function bookingTab(b: JourneyBooking, now: Date = new Date()): BookingTab {
  const status = statusOf(b);
  if (CLOSED.has(status)) return "cancelled";
  if (FINISHED.has(status)) return "past";
  if (NEEDS_ACTION.has(status)) return "pending";
  if (status === "PROCESSING") return "pending"; // the analysis is done; results are still to come
  const end = b.end_time ? new Date(b.end_time) : null;
  return end && !Number.isNaN(end.getTime()) && end < now ? "past" : "upcoming";
}

const TONES: Record<string, BookingTone> = {
  PENDING: "warning",
  PENDING_PAYMENT: "warning",
  WAITLISTED: "info",
  HOLD: "warning",
  DISRUPTION_PENDING: "danger",
  UNDER_MAINTENANCE: "danger",
  OTHER_DISRUPTION: "danger",
  BOOKED: "info",
  PROCESSING: "info",
  COMPLETED: "success",
  CANCELLED: "neutral",
  REFUNDED: "neutral",
  ABSENT: "danger",
  BOOKING_NOT_UTILIZED: "neutral",
  SAMPLE_REJECTED: "danger",
  FABRICATION_REJECTED: "danger",
};

export function bookingTone(status: unknown): BookingTone {
  return TONES[String(status ?? "").toUpperCase()] ?? "neutral";
}

export type TimelineStep = { key: string; label: string; state: "done" | "current" | "todo" };

const ORDER = ["requested", "confirmed", "analysis", "results"] as const;
const LABELS: Record<(typeof ORDER)[number], string> = {
  requested: "Requested",
  confirmed: "Confirmed",
  analysis: "Analysis",
  results: "Results ready",
};

/** Where the booking stands on its way to results, or null for one that left that path (cancelled, refunded…). */
export function bookingTimeline(b: JourneyBooking, now: Date = new Date()): TimelineStep[] | null {
  const status = statusOf(b);
  if (CLOSED.has(status) || status === "ABSENT" || status === "BOOKING_NOT_UTILIZED") return null;
  let current: number;
  if (status === "COMPLETED") current = ORDER.length;
  else if (status === "PROCESSING") current = 2;
  else if (status === "BOOKED") {
    const start = b.start_time ? new Date(b.start_time) : null;
    current = start && !Number.isNaN(start.getTime()) && start <= now ? 2 : 1;
  } else current = 0;
  return ORDER.map((key, i) => ({
    key,
    label: LABELS[key],
    state: i < current ? "done" : i === current ? "current" : "todo",
  }));
}

const IST_DAY = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
const IST_TIME = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });

/** Slot times are institute (India) wall-clock times, whatever the phone's time zone. */
export function slotWhen(start?: string | null, end?: string | null): string {
  if (!start) return "";
  const from = new Date(start);
  if (Number.isNaN(from.getTime())) return "";
  const to = end ? new Date(end) : null;
  const span = to && !Number.isNaN(to.getTime()) ? `${IST_TIME.format(from)} – ${IST_TIME.format(to)}` : IST_TIME.format(from);
  return `${IST_DAY.format(from)}, ${span}`;
}

/** "In 2 hours", "Tomorrow", "In 5 days" for the next booking; empty once it has started. */
export function timeUntil(start?: string | null, now: Date = new Date()): string {
  if (!start) return "";
  const from = new Date(start);
  const ms = from.getTime() - now.getTime();
  if (Number.isNaN(ms) || ms <= 0) return "";
  const hours = ms / 3_600_000;
  if (hours < 1) return `In ${Math.max(1, Math.round(ms / 60_000))} min`;
  if (hours < 12) return `In ${Math.round(hours)} hour${Math.round(hours) === 1 ? "" : "s"}`;
  const dayKey = (d: Date) => Math.floor(new Date(d.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })).setHours(0, 0, 0, 0) / 86_400_000);
  const days = dayKey(from) - dayKey(now);
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

import { resolveGuideAudienceForUser, type GuideUserLike } from "@/guides/resolveAudience";
import { getRealBookingId, type BookingRef } from "@/lib/bookingRef";

/** Fields of the signed-in user that decide which tips apply. */
export type LoginTipUser = GuideUserLike & {
  id?: number | null;
  department_type?: string | null;
};

export interface LoginTip {
  id: string;
  /** Short label above the title. */
  eyebrow: string;
  title: string;
  body: string;
  /** Sample tip: the brought-to-the-slot note, the user's next booking and the policy dialog behind "More information". */
  samplePolicy?: boolean;
  appliesTo: (user: LoginTipUser) => boolean;
}

/** IIT Roorkee students and project staff (student accounts); not startups, external users, faculty or staff roles. */
export function isIitrStudentUser(user: LoginTipUser | null | undefined): boolean {
  if (!user) return false;
  if (String(user.department_type ?? "").toLowerCase() === "external") return false;
  const audience = resolveGuideAudienceForUser(user);
  return audience === "student" || audience === "project_staff";
}

/** Shown once per sign-in, first matching tip only. */
export const LOGIN_TIPS: readonly LoginTip[] = [
  {
    id: "sample-on-time",
    eyebrow: "Tip of the day",
    title: "Submit your sample before the deadline",
    body:
      "Please submit your sample to the laboratory before the sample deadline of your booking, which is set for each equipment ahead of the slot start time, " +
      "and request the Lab Operator to record its receipt in the portal. If receipt is not recorded, the booking is treated as Not Utilized and the charges are not refunded. " +
      "The time for results counts only from the receipt (or from the end of the slot, if the sample was received before it).",
    samplePolicy: true,
    appliesTo: isIitrStudentUser,
  },
];

export function pickLoginTip(user: LoginTipUser | null | undefined, tips: readonly LoginTip[] = LOGIN_TIPS): LoginTip | null {
  if (!user) return null;
  return tips.find((t) => t.appliesTo(user)) ?? null;
}

// ---- Per-login bookkeeping (sessionStorage: one browser tab or one app session) ----

const KEY_PREFIX = "iic_login_tip_dismissed_";

function key(userId: number, tipId: string) {
  return `${KEY_PREFIX}${userId}_${tipId}`;
}

export function isLoginTipDismissed(userId: number, tipId: string): boolean {
  try {
    return sessionStorage.getItem(key(userId, tipId)) === "1";
  } catch {
    return false;
  }
}

export function dismissLoginTip(userId: number, tipId: string) {
  try {
    sessionStorage.setItem(key(userId, tipId), "1");
  } catch {
    /* ignore quota / private mode */
  }
}

/** Call on sign-out / session expiry so the next sign-in shows the tip again. */
export function clearLoginTipsThisLogin() {
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k?.startsWith(KEY_PREFIX)) sessionStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

// ---- Next booking that still needs a sample ----

/** Booked but sample not yet accepted (Processing / In progress mean the lab has it). */
const AWAITING_SAMPLE_STATUSES = new Set(["BOOKED", "CONFIRMED", "APPROVED"]);

export type SampleReminderBooking = BookingRef & {
  equipment?: number | null;
  equipment_name: string;
  status: string;
  start_time: string;
};

export type SampleDeadlineItem = {
  booking_id: number;
  virtual_booking_id?: string | null;
  deadline_at: string | null;
  lead_hours?: number | null;
};

export interface NextSampleReminder {
  equipmentId?: number | null;
  equipmentName: string;
  startTime: string;
  /** Present only when the portal already reported this booking's sample deadline. */
  deadlineAt: string | null;
  leadHours: number | null;
}

/** Earliest future booking still awaiting its sample, with its deadline when already known (no extra request). */
export function pickNextSampleReminder(
  bookings: readonly SampleReminderBooking[],
  deadlines: readonly SampleDeadlineItem[] = [],
  now: Date = new Date()
): NextSampleReminder | null {
  const next = bookings
    .filter((b) => AWAITING_SAMPLE_STATUSES.has(String(b.status || "").toUpperCase()))
    .filter((b) => new Date(b.start_time).getTime() > now.getTime())
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0];
  if (!next) return null;
  const realId = getRealBookingId(next);
  const match = deadlines.find(
    (d) => (realId != null && d.booking_id === realId) || (d.virtual_booking_id && d.virtual_booking_id === String(next.booking_id))
  );
  const deadlineAt = match?.deadline_at && new Date(match.deadline_at).getTime() > now.getTime() ? match.deadline_at : null;
  return {
    equipmentId: typeof next.equipment === "number" ? next.equipment : null,
    equipmentName: next.equipment_name,
    startTime: next.start_time,
    deadlineAt,
    leadHours: deadlineAt && match?.lead_hours ? match.lead_hours : null,
  };
}

/** Helpers for the faculty decision window on registration requests (24 hours by default). */

const IST_FORMAT = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/** "05 Oct 2026, 3:30 pm IST", or "" when there is no deadline. */
export function formatDeadlineIst(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${IST_FORMAT.format(date)} IST`;
}

export interface DeadlineRemaining {
  expired: boolean;
  /** Under three hours left. */
  urgent: boolean;
  label: string;
}

/** Time left until the deadline, e.g. "5 h 12 min left" or "Timed out". */
export function deadlineRemaining(iso: string | null | undefined, now: Date = new Date()): DeadlineRemaining | null {
  if (!iso) return null;
  const end = new Date(iso).getTime();
  if (Number.isNaN(end)) return null;
  const ms = end - now.getTime();
  if (ms <= 0) return { expired: true, urgent: true, label: "Timed out" };
  const totalMinutes = Math.max(1, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const label = hours > 0 ? `${hours} h ${minutes} min left` : `${minutes} min left`;
  return { expired: false, urgent: ms < 3 * 3600 * 1000, label };
}

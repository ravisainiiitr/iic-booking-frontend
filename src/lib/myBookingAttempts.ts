/** "My booking attempts": the signed-in user's own attempts (GET /booking-attempt-logs/mine/). */

export type MyBookingAttemptSlot = {
  id: number | null;
  slot_name: string | null;
  date: string | null;
  start_datetime: string | null;
  end_datetime: string | null;
};

export type MyBookingAttempt = {
  id: number;
  requested_at: string | null;
  equipment_id: number;
  equipment_code: string;
  equipment_name: string;
  outcome: "SUCCESS" | "FAILED";
  failure_title: string;
  failure_summary: string;
  failure_code: string;
  slots_requested: number;
  duration_minutes: number | null;
  requested_slots: MyBookingAttemptSlot[];
  /** Set when staff or a supervisor submitted the attempt for the user. */
  booked_by_name: string | null;
  /** Set when the user submitted it for someone else (a supervisor booking for a student). */
  booked_for_name: string | null;
  /** Refused by a weekly / monthly minutes limit: the calculation can be opened. */
  can_view_calculation: boolean;
};

export type MyBookingAttemptsPage = {
  results: MyBookingAttempt[];
  total_count: number;
  limit: number;
  offset: number;
};

export type MyBookingAttemptsQuery = {
  outcome?: "FAILED" | "SUCCESS" | "ALL";
  /** yyyy-MM-dd (IST) */
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
};

export function myBookingAttemptsQuery(params: MyBookingAttemptsQuery): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") sp.append(key, String(value));
  }
  return sp.toString();
}

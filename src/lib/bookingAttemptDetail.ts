import type { BookingInputFieldDef, BookingInputValues } from "@/lib/bookingInputDisplay";
import type { JobSheetSlot } from "@/lib/jobSheet";

export type BookingAttemptPerson = {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  user_type?: string | null;
  user_type_label?: string | null;
  department_name?: string | null;
  department_code?: string | null;
  id_number?: string | null;
  designation?: string | null;
  supervisor_name?: string | null;
  wallet_owner_name?: string | null;
};

export type BookingAttemptSlot = JobSheetSlot & { id?: number | null };

export type BookingAttemptOutcomeDetails = {
  status: "SUCCESS" | "FAILED" | string;
  /** e.g. "Weekly booking limit reached" or "Booking created: XPS202600012" */
  title: string;
  /** Plain-language sentence. */
  message: string;
  /** Fallbacks used (alternative slots, waitlist, alternative equipment). */
  notes?: string[];
  /** The message the booking API produced, shown under "Technical details". */
  technical?: string;
  code?: string;
};

/** GET /booking-attempt-logs/<id>/ */
export type BookingAttemptDetail = {
  id: number;
  requested_at: string | null;
  outcome: string;
  equipment_id: number;
  equipment_code: string;
  equipment_name: string;
  real_booking_id?: number | null;
  display_booking_id?: string | null;
  number_of_samples?: number | null;
  slots_requested?: number | null;
  duration_minutes?: number | null;
  /** Person the booking is for. */
  user: BookingAttemptPerson | null;
  /** Admin / OIC who submitted it on the user's behalf, when different. */
  requested_by?: BookingAttemptPerson | null;
  requested_slots: BookingAttemptSlot[];
  booked_slots?: BookingAttemptSlot[];
  input_fields: BookingInputFieldDef[];
  input_values: BookingInputValues;
  comments?: string;
  /** Names of the slot options chosen (multi-parameter equipment). */
  selected_parameters?: string[];
  outcome_details: BookingAttemptOutcomeDetails;
};

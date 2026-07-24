/** Slot row as returned by GET /equipments/:id/slots/ (aligned with booking Step 3). */
export interface LabCalendarSlot {
  id: number;
  slot_master: number;
  slot_number: number;
  slot_name: string;
  equipment_code: string;
  date: string;
  start_datetime: string;
  end_datetime: string;
  status: string;
  status_display?: string;
  /** Display reference (may be virtual id or "CODE-n"); use `real_booking_id` for API booking PK. */
  booking_id?: number | string | null;
  real_booking_id?: number | null;
  booking_status?: string | null;
  booking_status_display?: string | null;
  /** When BOOKED: display name of the user who booked (from booking.user). */
  booking_user_name?: string | null;
  /** When BOOKED: department code of the user (second line, optional). */
  booking_user_department_code?: string | null;
  booking_user_department_name?: string | null;
  /** Staff-only (Admin / OIC / Operator) contact fields. */
  booking_user_email?: string | null;
  booking_user_phone?: string | null;
  /** Booker user type code (e.g. student, external). */
  booking_user_type?: string | null;
  /** True when the booker is an external user type. */
  booking_is_external?: boolean | null;
  /** When BOOKED: latest sample-trace status display (staff calendars). */
  booking_sample_status_display?: string | null;
  slot_open_time?: string | null;
  blocked_label?: string | null;
}

export interface LabWeekCalendarSlotsPayload {
  equipment_id: number;
  equipment_code: string;
  slots: LabCalendarSlot[];
  slot_master_times?: string[];
  slot_start_time?: string | null;
  slot_end_time?: string | null;
  slot_duration_minutes?: number;
  calendar_colors?: {
    slot_colors: Record<string, string>;
    holiday_default: string;
    saturday_color?: string;
    sunday_color?: string;
  };
  holidays?: Record<string, string | { label?: string; color?: string }>;
}

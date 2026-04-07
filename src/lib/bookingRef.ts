export type BookingRef = {
  booking_id: string | number;
  real_booking_id?: number | null;
};

/** Stable React/cache key for booking references. */
export function getBookingKey(booking: BookingRef | null | undefined): string {
  if (!booking) return "";
  return String(booking.booking_id);
}

/** Numeric backend PK for endpoints that still require /bookings/{id}/ paths. */
export function getRealBookingId(booking: BookingRef | null | undefined): number | null {
  if (!booking) return null;
  if (typeof booking.real_booking_id === "number") return booking.real_booking_id;
  if (typeof booking.booking_id === "number") return booking.booking_id;
  // Some payloads only expose string booking_id; accept pure digits.
  if (typeof booking.booking_id === "string" && /^\d+$/.test(booking.booking_id.trim())) {
    return parseInt(booking.booking_id.trim(), 10);
  }
  return null;
}

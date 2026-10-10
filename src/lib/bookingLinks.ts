const BOOKING_MANAGEMENT_USER_TYPES = new Set(["operator", "manager", "admin", "dept_admin"]);

/** Staff open bookings on View Booking (Booking Management); everyone else on My Bookings. */
export function opensBookingManagement(userType: unknown): boolean {
  return BOOKING_MANAGEMENT_USER_TYPES.has(String(userType ?? "").toLowerCase());
}

/** Portal path of a booking's details; ``expand`` takes the booking pk or its display ID. */
export function bookingDetailPath({
  pk,
  displayId,
  staff,
}: {
  pk?: number | string | null;
  displayId?: string | number | null;
  staff: boolean;
}): string {
  const display = String(displayId ?? "").trim();
  const id = pk != null && String(pk).trim() !== "" ? String(pk).trim() : "";
  if (staff) {
    const key = id || display;
    return key ? `/booking-management?expand=${encodeURIComponent(key)}` : "";
  }
  const key = display || id;
  return key ? `/my-bookings?booking=${encodeURIComponent(key)}` : "";
}

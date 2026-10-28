/** Booker fields a slot carries when the server lets the viewer see who booked it. */
export interface SlotBookerFields {
  status?: string | null;
  booking_user_name?: string | null;
  booking_user_department_name?: string | null;
  booking_user_department_code?: string | null;
  booking_user_email?: string | null;
  booking_user_phone?: string | null;
  booking_user_type?: string | null;
  booking_id?: number | string | null;
}

/** The slot still belongs to a booking whose booker the viewer may see. */
export function slotHoldsBooking(slot: SlotBookerFields | null | undefined): boolean {
  if (!slot) return false;
  if (!String(slot.booking_user_name || "").trim()) return false;
  return String(slot.status || "").toUpperCase() !== "AVAILABLE";
}

/** Hover lines for a booked slot: name first, then department, contact, booking reference and an optional hint. */
export function bookerHoverLines(slot: SlotBookerFields, hint?: string | null): string[] {
  const clean = (v: unknown) => String(v ?? "").trim();
  const dept = [clean(slot.booking_user_department_name), clean(slot.booking_user_department_code)]
    .filter(Boolean)
    .filter((v, i, all) => all.indexOf(v) === i)
    .join(" / ");
  return [
    `Booked by ${clean(slot.booking_user_name)}`,
    dept ? `Department: ${dept}` : "",
    clean(slot.booking_user_email) ? `Email: ${clean(slot.booking_user_email)}` : "",
    clean(slot.booking_user_phone) ? `Mobile: ${clean(slot.booking_user_phone)}` : "",
    clean(slot.booking_id) ? `Booking: ${clean(slot.booking_id)}` : "",
    clean(hint),
  ].filter(Boolean);
}

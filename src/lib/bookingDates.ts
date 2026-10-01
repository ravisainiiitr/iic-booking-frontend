const EMPTY = "—";

/**
 * Parse a booking start/end value. Null, empty, unparsable and epoch-or-earlier values
 * (``new Date(null)`` / ``new Date(0)``, which would print 01/01/1970) return null.
 */
export function parseBookingDate(value: string | number | Date | null | undefined): Date | null {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  const ms = d.getTime();
  if (Number.isNaN(ms) || ms <= 0) return null;
  return d;
}

/** Locale date + time (e.g. booking details card), or "—" when the booking has no time. */
export function formatBookingDateTime(
  value: string | number | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions,
  locale?: string,
): string {
  const d = parseBookingDate(value);
  return d ? d.toLocaleString(locale, options) : EMPTY;
}

/** dd/mm/yy hh:mm am/pm used in booking lists, or "—" when the booking has no time. */
export function formatBookingDateTimeShort(value: string | number | Date | null | undefined): string {
  const d = parseBookingDate(value);
  if (!d) return EMPTY;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  const time = d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return `${dd}/${mm}/${yy} ${time}`;
}

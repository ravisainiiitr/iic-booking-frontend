/** Format INR amounts as whole rupees (nearest integer). */
export function formatRupees(value: string | number | null | undefined): string {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(/,/g, ""));
  if (!Number.isFinite(n)) return "0";
  return String(Math.round(n));
}

/** Format with ₹ prefix as whole rupees. */
export function formatINR(value: string | number | null | undefined): string {
  return `₹${formatRupees(value)}`;
}

/**
 * Booking-page price: ₹ prefix and Indian digit grouping, paise only when the amount has them
 * (₹1,200 and ₹1,200.50). Amounts are rounded to the paisa first.
 */
export function formatINRAmount(value: string | number | null | undefined): string {
  const raw = typeof value === "number" ? value : Number(String(value ?? "").replace(/,/g, ""));
  const n = Number.isFinite(raw) ? Math.round(raw * 100) / 100 : 0;
  const digits = Number.isInteger(n) ? 0 : 2;
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

/** Format with ₹ prefix, Indian digit grouping and paise (e.g. ₹1,25,000.50). */
export function formatINRWithPaise(value: string | number | null | undefined): string {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(/,/g, ""));
  return `₹${(Number.isFinite(n) ? n : 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

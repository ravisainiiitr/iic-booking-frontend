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

/** Format with ₹ prefix, Indian digit grouping and paise (e.g. ₹1,25,000.50). */
export function formatINRWithPaise(value: string | number | null | undefined): string {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(/,/g, ""));
  return `₹${(Number.isFinite(n) ? n : 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

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

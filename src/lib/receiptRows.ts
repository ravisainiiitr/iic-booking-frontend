import type { PaymentReceipt } from "@/lib/api";

/** How the payment was made, with its references: from the server's payment details, else the stored reference. */
export function paymentRows(r: PaymentReceipt): [string, string][] {
  const rows: [string, string][] = [["Payment mode", r.payment_mode || (r.method || "Online").toUpperCase()]];
  if (r.payment_details?.length) rows.push(...r.payment_details);
  else rows.push(["Bank reference (RRN / UTR)", r.bank_reference || "Not provided by the bank for this payment method"]);
  rows.push(["Razorpay payment ID", r.razorpay_payment_id], ["Razorpay order ID", r.razorpay_order_id]);
  if (r.settlement_utr) rows.push(["Settlement UTR (to the institute)", r.settlement_utr]);
  rows.push(["Payment status", r.status]);
  return rows;
}

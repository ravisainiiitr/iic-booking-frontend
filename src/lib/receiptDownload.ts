import { apiClient, type PaymentReceipt } from "@/lib/api";
import { mergePdfs, saveBlob } from "@/lib/dispatchPack";
import { generatePaymentReceiptPdf, receiptFileName } from "@/lib/paymentReceiptPdf";

/** The receipt PDF for one confirmed online payment, built from the server's receipt data. */
export async function receiptPdfFor(paymentId: string): Promise<{ blob: Blob; receipt: PaymentReceipt }> {
  const res = await apiClient.getPaymentReceipt(paymentId);
  if (res.error || !res.data) throw new Error(res.error || "The receipt is not available.");
  return { blob: await generatePaymentReceiptPdf(res.data), receipt: res.data };
}

/** Download one payment's receipt as a PDF. */
export async function downloadReceipt(paymentId: string): Promise<void> {
  const { blob, receipt } = await receiptPdfFor(paymentId);
  saveBlob(blob, receiptFileName(receipt));
}

/** Every online-payment receipt of a booking (usually one), as PDFs in payment order. */
export async function bookingReceiptPdfs(bookingId: number): Promise<Blob[]> {
  const res = await apiClient.getBookingPaymentReceipts(bookingId);
  if (res.error || !res.data) throw new Error(res.error || "The receipts are not available.");
  const ids = res.data.results.map((r) => r.razorpay_payment_id).reverse();
  return Promise.all(ids.map(async (id) => (await receiptPdfFor(id)).blob));
}

/** A booking's receipts in one PDF. */
export async function downloadBookingReceipts(bookingId: number, bookingReference: string): Promise<void> {
  const parts = await bookingReceiptPdfs(bookingId);
  if (!parts.length) throw new Error("This booking has no online payment, so there is no payment receipt.");
  const safe = String(bookingReference).replace(/[^A-Za-z0-9_-]+/g, "_");
  saveBlob(parts.length === 1 ? parts[0] : await mergePdfs(parts), `payment_receipt_${safe}.pdf`);
}

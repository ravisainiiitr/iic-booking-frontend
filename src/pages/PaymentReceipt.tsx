import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, Printer } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { Button } from "@/components/ui/button";
import { apiClient, type PaymentReceipt as Receipt } from "@/lib/api";
import { formatInstant } from "@/lib/externalBookingApi";
import { INSTITUTION, POLICY_LINKS } from "@/lib/institutionIdentity";
import { formatINRWithPaise } from "@/lib/money";

/** Receipt for a confirmed online payment: shown and printable (Print, or Save as PDF). Never a GST tax invoice. */
export default function PaymentReceipt() {
  const { paymentId = "" } = useParams<{ paymentId: string }>();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    void apiClient.getPaymentReceipt(paymentId).then((res) => {
      if (!live) return;
      if (res.error || !res.data) setError(res.error || "Receipt not available.");
      else setReceipt(res.data);
    });
    return () => {
      live = false;
    };
  }, [paymentId]);

  const r = receipt;
  const rows: Array<[string, string]> = r
    ? [
        ["Receipt number", r.receipt_number],
        ["Paid by", r.payer_name || "—"],
        ["For", r.description],
        ...(r.booking_reference ? ([["Booking reference", r.booking_reference]] as Array<[string, string]>) : []),
        ["Payment reference (Razorpay)", r.razorpay_payment_id],
        ["Order reference (Razorpay)", r.razorpay_order_id],
        ["Payment method", r.method || "—"],
        ["Paid on", formatInstant(r.paid_at)],
        ["Payment status", r.status],
      ]
    : [];

  return (
    <div className="page-shell bg-slate-50">
      <div className="no-print">
        <DashboardHeader />
      </div>
      <main className="container max-w-2xl space-y-4 py-5">
        {error ? (
          <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
            {error}
          </p>
        ) : !r ? (
          <p className="py-8 text-center text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="no-print flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-medium text-emerald-800">
                <CheckCircle2 className="h-5 w-5" aria-hidden /> Payment confirmed by the payment gateway
              </p>
              <Button onClick={() => window.print()} className="bg-[#1e4d8c] hover:bg-[#173d70]">
                <Printer className="mr-2 h-4 w-4" aria-hidden /> Print or save as PDF
              </Button>
            </div>
            <article className="payment-receipt-print-area relative space-y-5 rounded-xl border border-slate-200 bg-white p-6 text-slate-900" data-testid="payment-receipt">
              {r.test_mode ? (
                <p className="rounded-md border-2 border-amber-500 bg-amber-50 p-2 text-center text-sm font-bold uppercase tracking-wide text-amber-900">
                  Test mode — sample only, no real money was collected
                </p>
              ) : null}
              <header className="flex items-center gap-4 border-b border-slate-200 pb-4">
                <img src={INSTITUTION.logoPath} alt={INSTITUTION.logoAlt} width={72} height={72} className="h-[72px] w-[72px] shrink-0 object-contain" />
                <div className="min-w-0">
                  <p className="text-lg font-bold uppercase tracking-wide text-[#1e4d8c]">{r.institution}</p>
                  <p className="text-sm text-slate-700">{r.service_name}</p>
                  <p className="text-xs text-slate-600">{INSTITUTION.addressLines.join(", ")}</p>
                </div>
              </header>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h1 className="text-xl font-semibold">{r.title}</h1>
                <p className="text-sm text-slate-600">
                  Collected by <span className="font-semibold text-slate-900">{r.collected_by}</span>
                </p>
              </div>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
                {rows.map(([label, value]) => (
                  <div key={label} className="contents">
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="break-all font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-200">
                  {r.booking_total ? (
                    <tr className="text-slate-600">
                      <td className="py-1.5">
                        Booking charge{r.booking_gst ? ", including GST" : ""}
                        {r.booking_gst ? <span className="block text-xs">of which GST {formatINRWithPaise(r.booking_gst)}</span> : null}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{formatINRWithPaise(r.booking_total)}</td>
                    </tr>
                  ) : null}
                  <tr>
                    <td className="py-1.5">{r.booking_total ? "Paid online for this booking" : "Amount"}</td>
                    <td className="py-1.5 text-right tabular-nums">{formatINRWithPaise(r.base_amount)}</td>
                  </tr>
                  {Number(r.convenience_fee) > 0 ? (
                    <>
                      <tr>
                        <td className="py-1.5">Payment gateway convenience fee</td>
                        <td className="py-1.5 text-right tabular-nums">{formatINRWithPaise(r.convenience_fee)}</td>
                      </tr>
                      <tr>
                        <td className="py-1.5">GST on the convenience fee ({Number(r.gst_on_fee_percent)}%)</td>
                        <td className="py-1.5 text-right tabular-nums">{formatINRWithPaise(r.gst_on_fee)}</td>
                      </tr>
                    </>
                  ) : null}
                  <tr className="font-semibold">
                    <td className="py-2">Total paid ({r.currency})</td>
                    <td className="py-2 text-right tabular-nums" data-testid="receipt-total">{formatINRWithPaise(r.total_paid)}</td>
                  </tr>
                </tbody>
              </table>
              <footer className="space-y-1 border-t border-slate-200 pt-3 text-xs text-slate-600">
                <p>{r.not_a_tax_invoice}</p>
                <p>
                  Payment questions: <a href={`mailto:${INSTITUTION.email}`} className="text-[#1e4d8c] underline">{INSTITUTION.email}</a>.
                  Cancellations and refunds follow the{" "}
                  <a href={POLICY_LINKS.refund} className="text-[#1e4d8c] underline">Cancellation and Refund Policy</a>.
                </p>
              </footer>
            </article>
            <p className="no-print text-sm">
              <Link to="/my-bookings" className="text-[#1e4d8c] underline">My bookings</Link>
              {" · "}
              <Link to="/wallet" className="text-[#1e4d8c] underline">Wallet</Link>
            </p>
          </>
        )}
      </main>
    </div>
  );
}

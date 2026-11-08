import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowRight, CheckCircle2, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import DashboardHeader from "@/components/DashboardHeader";
import { Button } from "@/components/ui/button";
import { apiClient, type PaymentReceipt as Receipt } from "@/lib/api";
import { saveBlob } from "@/lib/dispatchPack";
import { formatInstant } from "@/lib/externalBookingApi";
import { INSTITUTION, POLICY_LINKS } from "@/lib/institutionIdentity";
import { formatINRWithPaise } from "@/lib/money";
import { generatePaymentReceiptPdf, receiptFileName } from "@/lib/paymentReceiptPdf";
import { paymentRows } from "@/lib/receiptRows";
import { rupeesInWords } from "@/lib/amountInWords";

/** Only paths inside the portal may be used as the "continue" target (no open redirect). */
function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "";
}

/**
 * A confirmed online payment: what was paid, every reference, and the receipt as a one-page PDF. Opened straight after
 * a payment (with ``?next=`` to continue) and from the booking, the confirmation page or the Wallet page later.
 */
export default function PaymentReceipt() {
  const { paymentId = "" } = useParams<{ paymentId: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get("next"));
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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

  const download = async () => {
    if (!receipt || busy) return;
    setBusy(true);
    try {
      saveBlob(await generatePaymentReceiptPdf(receipt), receiptFileName(receipt));
    } catch {
      toast.error("The receipt could not be prepared. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const r = receipt;
  const rows: Array<[string, string]> = r
    ? [
        ["Receipt no.", r.receipt_number],
        ["Received from", [r.payer_name || "—", r.payer_organisation].filter(Boolean).join(", ")],
        ["Payment for", r.description],
        ...(r.booking_reference ? ([["Booking ID", r.booking_reference]] as Array<[string, string]>) : []),
        ["Collected by", `${r.collected_by}, ${r.institution}`],
        ["Paid on", formatInstant(r.paid_at)],
        ...paymentRows(r),
      ]
    : [];

  return (
    <div className="page-shell bg-slate-50">
      <DashboardHeader />
      <main className="container max-w-2xl space-y-4 py-5">
        {error ? (
          <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
            {error}
          </p>
        ) : !r ? (
          <p className="py-8 text-center text-muted-foreground">Loading…</p>
        ) : (
          <>
            <section className="rounded-xl border border-emerald-300 bg-emerald-50 p-4" data-testid="receipt-prompt">
              <p className="flex items-center gap-2 text-base font-semibold text-emerald-900">
                <CheckCircle2 className="h-5 w-5" aria-hidden /> Payment confirmed: {formatINRWithPaise(r.total_paid)}
              </p>
              <p className="mt-1 text-sm text-emerald-900">
                Download your receipt now and keep it for your records. You can download it again any time from the booking
                or from your Wallet page.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={() => void download()} disabled={busy} className="bg-[#1e4d8c] hover:bg-[#173d70]">
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Download className="mr-2 h-4 w-4" aria-hidden />}
                  Download receipt (PDF)
                </Button>
                {next ? (
                  <Button variant="outline" onClick={() => navigate(next)}>
                    Continue <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                  </Button>
                ) : null}
              </div>
            </section>

            <article className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 text-slate-900" data-testid="payment-receipt">
              {r.test_mode ? (
                <p className="rounded-md border-2 border-amber-500 bg-amber-50 p-2 text-center text-sm font-bold uppercase tracking-wide text-amber-900">
                  Test mode — sample only, no real money was collected
                </p>
              ) : null}
              <header className="flex items-center gap-4 border-b border-slate-200 pb-4">
                <img src={INSTITUTION.logoPath} alt={INSTITUTION.logoAlt} width={64} height={64} className="h-16 w-16 shrink-0 object-contain" />
                <div className="min-w-0">
                  <p className="text-lg font-bold uppercase tracking-wide text-[#1e4d8c]">{r.institution}</p>
                  <p className="text-sm font-medium text-slate-700">{r.office || INSTITUTION.unit}</p>
                  <p className="text-xs text-slate-500">GSTIN {r.institute_gstin || INSTITUTION.gstin} · {r.service_name}</p>
                </div>
              </header>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-[max-content_1fr]">
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
              <p className="rounded-md bg-slate-50 px-3 py-2 text-sm italic text-slate-700" data-testid="receipt-words">
                ({rupeesInWords(r.total_paid)})
              </p>
              <footer className="space-y-1 border-t border-slate-200 pt-3 text-xs text-slate-600">
                <p className="font-semibold text-slate-800">
                  {r.computer_generated || "This is a computer-generated receipt and does not require a signature."}
                </p>
                <p>{r.not_a_tax_invoice}</p>
                <p>
                  Payment questions: <a href={`mailto:${INSTITUTION.email}`} className="text-[#1e4d8c] underline">{INSTITUTION.email}</a>.
                  Cancellations and refunds follow the{" "}
                  <a href={POLICY_LINKS.refund} className="text-[#1e4d8c] underline">Cancellation and Refund Policy</a>.
                </p>
              </footer>
            </article>
            <p className="text-sm">
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

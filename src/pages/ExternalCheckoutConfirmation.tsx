import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, Clock, XCircle, AlertTriangle } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { CheckoutSummary } from "@/components/external/CheckoutSummary";
import { InstitutionBanner } from "@/components/external/InstitutionBanner";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";
import { externalBookingApi, formatInstant, type BookingCheckout } from "@/lib/externalBookingApi";
import { formatINRWithPaise } from "@/lib/money";

/** The header shows the wallet balance from a cache; tell it the new balance (same event the Wallet page sends). */
async function refreshHeaderBalance() {
  const res = await apiClient.getWallet();
  if (res.data && res.data.balance !== undefined) {
    window.dispatchEvent(new CustomEvent("walletBalanceUpdated", { detail: { balance: Number(res.data.balance) } }));
  }
}

const POLL_MS = 3000;
const POLL_LIMIT = 20; // about a minute; the webhook normally confirms within seconds

/** Outcome of an external booking checkout, exactly as the server verified it (never from the browser callback). */
export default function ExternalCheckoutConfirmation() {
  const { checkoutId = "" } = useParams<{ checkoutId: string }>();
  const navigate = useNavigate();
  const [checkout, setCheckout] = useState<BookingCheckout | null>(null);
  const [error, setError] = useState("");
  const [polls, setPolls] = useState(0);
  const timer = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await externalBookingApi.checkout(checkoutId);
      setCheckout(next);
      setError("");
      if (next.state === "confirmed" && Number(next.wallet_amount) > 0) void refreshHeaderBalance();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the payment status.");
    }
  }, [checkoutId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (checkout?.state !== "awaiting_payment" || polls >= POLL_LIMIT) return;
    timer.current = window.setTimeout(() => {
      setPolls((n) => n + 1);
      void load();
    }, POLL_MS);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [checkout?.state, polls, load]);

  const c = checkout;
  const walletOnly = c?.choice === "full_wallet";
  const paidOnline = Boolean(c?.payment?.razorpay_payment_id);
  const head = !c
    ? null
    : c.state === "confirmed"
      ? { icon: <CheckCircle2 className="h-7 w-7 text-emerald-600" />, title: "Booking confirmed", tone: "border-emerald-300 bg-emerald-50 text-emerald-950" }
      : c.state === "paid_not_confirmed"
        ? { icon: <AlertTriangle className="h-7 w-7 text-amber-600" />, title: "Payment received — booking not confirmed", tone: "border-amber-300 bg-amber-50 text-amber-950" }
        : c.state === "awaiting_payment"
          ? { icon: <Clock className="h-7 w-7 text-[#1e4d8c]" />, title: polls >= POLL_LIMIT ? "Payment not confirmed yet" : "Confirming your payment…", tone: "border-[#1e4d8c]/30 bg-white text-slate-900" }
          : { icon: <XCircle className="h-7 w-7 text-slate-500" />, title: "No payment was completed", tone: "border-slate-300 bg-white text-slate-900" };

  return (
    <div className="page-shell bg-slate-50">
      <DashboardHeader />
      <main className="container max-w-3xl space-y-5 py-5">
        <InstitutionBanner />
        {error && !c ? (
          <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error}</p>
        ) : null}
        {!c || !head ? (
          !error && <p className="py-8 text-center text-muted-foreground">Loading…</p>
        ) : (
          <>
            <section className={`flex items-start gap-3 rounded-xl border p-4 ${head.tone}`} data-testid="confirmation-status">
              {head.icon}
              <div className="space-y-1 text-sm">
                <h1 className="text-xl font-semibold">{head.title}</h1>
                {c.state === "confirmed" && walletOnly ? <p>Paid entirely from your wallet.</p> : null}
                {c.state === "paid_not_confirmed" ? <p>{c.message}</p> : null}
                {c.state === "awaiting_payment" && polls >= POLL_LIMIT ? (
                  <p>
                    We have not received confirmation from the payment gateway yet. If money was deducted, it will be
                    applied automatically when the gateway confirms it; do not pay again. Check again in a few minutes.
                  </p>
                ) : null}
                {["cancelled", "expired", "quoted"].includes(c.state) ? (
                  <p>Nothing was booked. If an amount was deducted, it will be matched and applied or refunded.</p>
                ) : null}
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-900">
              <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                <dt className="text-slate-500">Booking reference</dt>
                <dd className="font-mono font-medium" data-testid="booking-reference">{c.booking?.reference ?? "—"}</dd>
                <dt className="text-slate-500">Booking status</dt>
                <dd>{c.booking?.status ?? c.state_label}</dd>
                <dt className="text-slate-500">Payment status</dt>
                <dd data-testid="payment-status">
                  {walletOnly
                    ? c.state === "confirmed" ? "Paid from wallet" : "Not paid"
                    : paidOnline ? "Paid online (verified)" : c.state === "awaiting_payment" ? "Awaiting gateway confirmation" : "Not paid"}
                </dd>
                <dt className="text-slate-500">Total booking amount</dt>
                <dd className="tabular-nums">{formatINRWithPaise(c.total_amount)}</dd>
                <dt className="text-slate-500">Wallet amount used</dt>
                <dd className="tabular-nums" data-testid="wallet-used">
                  {formatINRWithPaise(c.state === "confirmed" ? c.wallet_amount : "0")}
                </dd>
                <dt className="text-slate-500">Paid online</dt>
                <dd className="tabular-nums" data-testid="online-paid">
                  {paidOnline && c.payment ? formatINRWithPaise(c.payment.gateway_total) : formatINRWithPaise("0")}
                </dd>
                {paidOnline && c.payment && Number(c.payment.convenience_fee) > 0 ? (
                  <>
                    <dt className="text-slate-500">of which gateway fee + GST on fee</dt>
                    <dd className="tabular-nums">
                      {formatINRWithPaise(c.payment.convenience_fee)} + {formatINRWithPaise(c.payment.fee_gst)}
                    </dd>
                  </>
                ) : null}
                {paidOnline && c.payment?.razorpay_payment_id ? (
                  <>
                    <dt className="text-slate-500">Payment reference</dt>
                    <dd className="font-mono text-xs">{c.payment.razorpay_payment_id}</dd>
                  </>
                ) : null}
                <dt className="text-slate-500">Time</dt>
                <dd>{formatInstant(c.confirmed_at || c.payment?.paid_at || c.created_at)}</dd>
              </dl>
            </section>

            <CheckoutSummary checkout={c} />

            <div className="flex flex-col gap-2 sm:flex-row">
              {c.booking ? (
                <Button className="flex-1 bg-[#1e4d8c] hover:bg-[#173d70]" onClick={() => navigate(`/my-bookings?booking=${c.booking?.id}`)}>
                  View booking
                </Button>
              ) : null}
              {c.state === "awaiting_payment" ? (
                <Button variant="outline" onClick={() => { setPolls(0); void load(); }}>
                  Check again
                </Button>
              ) : null}
              <Button variant="outline" onClick={() => navigate("/dashboard")}>
                Back to dashboard
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

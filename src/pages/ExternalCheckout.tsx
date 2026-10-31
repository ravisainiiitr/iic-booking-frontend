import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CreditCard, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import DashboardHeader from "@/components/DashboardHeader";
import { CheckoutSummary } from "@/components/external/CheckoutSummary";
import { InstitutionBanner } from "@/components/external/InstitutionBanner";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";
import {
  ExternalBookingApiError,
  externalBookingApi,
  type BookingCheckout,
  type CheckoutChoice,
  type CheckoutGatewayOrder,
  type CheckoutOption,
} from "@/lib/externalBookingApi";
import { INSTITUTION, institutionLogoUrl } from "@/lib/institutionIdentity";
import { formatINRWithPaise } from "@/lib/money";
import { loadRazorpayScript } from "@/lib/razorpay";

type RazorpayInstance = { open: () => void; on?: (event: string, cb: (resp: unknown) => void) => void };

/** Whole seconds from now until ``iso`` (0 once passed), ticking every second; null without a time. */
function useSecondsLeft(iso: string | null | undefined): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!iso) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [iso]);
  if (!iso) return null;
  return Math.max(0, Math.floor((new Date(iso).getTime() - now) / 1000));
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * Payment choice for an external booking. The booking is made when the payment is confirmed. Once an online payment
 * is chosen the slots are held: the user sees a 5-minute countdown, and the server keeps the hold one minute longer.
 */
export default function ExternalCheckout() {
  const { checkoutId = "" } = useParams<{ checkoutId: string }>();
  const navigate = useNavigate();
  const [checkout, setCheckout] = useState<BookingCheckout | null>(null);
  const [loading, setLoading] = useState(true);
  const [choice, setChoice] = useState<CheckoutChoice | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const busyRef = useRef(false);
  const payByLeft = useSecondsLeft(checkout?.state === "awaiting_payment" ? (checkout.pay_by ?? checkout.expires_at) : null);
  const holdLeft = useSecondsLeft(checkout?.state === "awaiting_payment" ? checkout.expires_at : null);

  const toConfirmation = useCallback(
    () => navigate(`/external-checkout/${encodeURIComponent(checkoutId)}/confirmation`, { replace: true }),
    [checkoutId, navigate],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const c = await externalBookingApi.checkout(checkoutId);
      if (c.state === "confirmed" || c.state === "paid_not_confirmed") {
        toConfirmation();
        return;
      }
      setCheckout(c);
      setChoice((prev) => prev ?? c.choice ?? c.options?.[0]?.choice ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load this checkout.");
    } finally {
      setLoading(false);
    }
  }, [checkoutId, toConfirmation]);

  useEffect(() => {
    void load();
  }, [load]);

  const release = () => {
    busyRef.current = false;
    setBusy(false);
  };

  const openGateway = async (order: CheckoutGatewayOrder, c: BookingCheckout) => {
    const ok = await loadRazorpayScript();
    if (!ok || !window.Razorpay) {
      setError("Online payment could not be loaded. Check your connection and try again. Nothing was charged.");
      release();
      return;
    }
    // Standard Checkout options only: order, merchant name, description, logo and brand colour.
    const rzp = new window.Razorpay({
      key: order.key,
      amount: order.amount,
      currency: order.currency || "INR",
      order_id: order.order_id,
      name: INSTITUTION.checkoutName,
      description: "IIC equipment booking",
      image: institutionLogoUrl(),
      theme: { color: INSTITUTION.themeColor },
      // Close the payment window when the slot hold ends (pay-by time plus one minute of grace).
      ...(c.expires_at
        ? { timeout: Math.max(30, Math.floor((new Date(c.expires_at).getTime() - Date.now()) / 1000)) }
        : {}),
      handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        // The browser callback is not proof of payment: the confirmation page shows what the server verified.
        await apiClient.verifyRazorpayCheckout(response);
        toConfirmation();
      },
      modal: {
        ondismiss: () => {
          toast.info("Payment window closed. Nothing was charged. Your slot stays held until the timer runs out.");
          release();
        },
      },
    }) as RazorpayInstance;
    rzp.on?.("payment.failed", () => {
      setError("The payment did not go through. You can try again; nothing was deducted from your wallet.");
    });
    rzp.open();
  };

  const proceed = async (selected: CheckoutChoice) => {
    if (busyRef.current || !checkout) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const { checkout: next, order } = await externalBookingApi.payCheckout(checkout.id, selected);
      setCheckout(next);
      if (next.state === "confirmed") {
        toConfirmation();
        return;
      }
      if (order) {
        await openGateway(order, next);
        return;
      }
      release();
    } catch (e) {
      if (e instanceof ExternalBookingApiError && e.code === "price_changed") {
        toast.warning(e.message);
        await load();
      } else {
        setError(e instanceof Error ? e.message : "Payment could not be started.");
        if (e instanceof ExternalBookingApiError && (e.code === "option_unavailable" || e.code === "checkout_closed")) await load();
      }
      release();
    }
  };

  const cancel = async () => {
    if (busyRef.current || !checkout) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await externalBookingApi.cancelCheckout(checkout.id);
      navigate(`/book-equipment?equipment_id=${checkout.summary.equipment_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cancel.");
      release();
    }
  };

  if (loading) {
    return (
      <div className="page-shell">
        <DashboardHeader />
        <main className="container py-12 text-center text-muted-foreground">Loading…</main>
      </div>
    );
  }

  const options = checkout?.options ?? [];
  const awaiting = checkout?.state === "awaiting_payment";
  const closed = checkout && !["quoted", "awaiting_payment"].includes(checkout.state);
  const selected: CheckoutOption | undefined = options.find((o) => o.choice === choice);
  const onlyGateway = options.length === 1 && options[0].choice === "full_gateway";

  return (
    <div className="page-shell bg-slate-50">
      <DashboardHeader />
      <main className="container max-w-3xl space-y-5 py-5">
        <InstitutionBanner />
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Review and pay</h1>
        {!checkout ? (
          <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
            {error || "Checkout not found."}
          </p>
        ) : (
          <>
            <CheckoutSummary checkout={checkout} />
            {closed ? (
              <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                This checkout is {checkout.state_label.toLowerCase()}. Start the booking again to pay.
              </p>
            ) : awaiting ? (
              <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-sm">
                <p className="font-semibold">Online payment pending</p>
                {payByLeft !== null ? (
                  <p
                    role="timer"
                    aria-live="off"
                    data-testid="pay-countdown"
                    className={`rounded-lg border p-3 ${
                      payByLeft > 60
                        ? "border-blue-200 bg-blue-50 text-blue-950"
                        : "border-amber-300 bg-amber-50 text-amber-950"
                    }`}
                  >
                    {payByLeft > 0 ? (
                      <>
                        Your slot is held for you. Please complete the payment within{" "}
                        <strong className="tabular-nums">{mmss(payByLeft)}</strong>.
                      </>
                    ) : holdLeft ? (
                      <>Time is almost up: finish the payment now to keep this slot.</>
                    ) : (
                      <>The hold has ended. If you have already paid, check the status; otherwise start again.</>
                    )}
                  </p>
                ) : null}
                <p className="text-slate-700">
                  Wallet: {formatINRWithPaise(checkout.wallet_amount)} · Online: {formatINRWithPaise(checkout.gateway_amount)}
                  {checkout.payment ? ` (${formatINRWithPaise(checkout.payment.gateway_total)} with the gateway fee)` : ""}
                </p>
                <Button className="w-full bg-[#1e4d8c] hover:bg-[#173d70]" disabled={busy} onClick={() => checkout.choice && void proceed(checkout.choice)}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                  Complete online payment
                </Button>
                <Button variant="outline" className="w-full" disabled={busy} onClick={() => void toConfirmation()}>
                  I have paid — check status
                </Button>
              </section>
            ) : (
              <section className="space-y-3" aria-labelledby="pay-options">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 id="pay-options" className="text-lg font-semibold text-slate-900">
                    {onlyGateway ? "Payment" : "Choose how to pay"}
                  </h2>
                  <p className="text-sm text-slate-600" data-testid="wallet-balance">
                    Available wallet balance: <strong>{formatINRWithPaise(checkout.wallet_balance ?? "0")}</strong>
                  </p>
                </div>
                <div role={onlyGateway ? undefined : "radiogroup"} className="grid gap-3">
                  {options.map((o) => {
                    const active = o.choice === choice;
                    return (
                      <button
                        key={o.choice}
                        type="button"
                        role={onlyGateway ? undefined : "radio"}
                        aria-checked={onlyGateway ? undefined : active}
                        data-testid={`option-${o.choice}`}
                        onClick={() => setChoice(o.choice)}
                        disabled={busy}
                        className={`rounded-xl border-2 bg-white p-4 text-left text-sm transition ${
                          active ? "border-[#1e4d8c] ring-2 ring-[#1e4d8c]/20" : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <span className="flex items-center gap-2 font-semibold text-slate-900">
                          {o.choice === "full_gateway" ? <CreditCard className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
                          {onlyGateway ? "Pay online" : o.label}
                        </span>
                        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 tabular-nums sm:grid-cols-4">
                          {Number(o.wallet_amount) > 0 ? (
                            <>
                              <dt className="text-slate-500">Wallet</dt>
                              <dd className="font-medium">{formatINRWithPaise(o.wallet_amount)}</dd>
                            </>
                          ) : null}
                          {Number(o.gateway_amount) > 0 ? (
                            <>
                              <dt className="text-slate-500">
                                Online{Number(o.gateway_fee) > 0 ? " (incl. gateway fee)" : ""}
                              </dt>
                              <dd className="font-medium">{formatINRWithPaise(o.gateway_total)}</dd>
                            </>
                          ) : null}
                          {Number(o.wallet_amount) > 0 ? (
                            <>
                              <dt className="text-slate-500">Wallet after</dt>
                              <dd>{formatINRWithPaise(o.wallet_after)}</dd>
                            </>
                          ) : null}
                        </dl>
                      </button>
                    );
                  })}
                </div>
                {error ? (
                  <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
                    {error}
                  </p>
                ) : null}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    className="flex-1 bg-[#1e4d8c] hover:bg-[#173d70]"
                    disabled={busy || !selected}
                    onClick={() => selected && void proceed(selected.choice)}
                    data-testid="pay-button"
                  >
                    {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {!selected
                      ? "Choose an option"
                      : selected.choice === "full_wallet"
                        ? `Pay ${formatINRWithPaise(selected.wallet_amount)} from wallet`
                        : `Pay ${formatINRWithPaise(selected.gateway_total)} online`}
                  </Button>
                  <Button variant="outline" disabled={busy} onClick={() => void cancel()}>
                    Cancel
                  </Button>
                </div>
              </section>
            )}
            {awaiting && error ? (
              <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
                {error}
              </p>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}

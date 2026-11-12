import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient, type ReceiptCheck } from "@/lib/api";
import { cn } from "@/lib/utils";

const money = (v: string | undefined, currency = "INR") => {
  const n = Number(v || 0);
  return `${currency === "INR" ? "Rs." : currency} ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const when = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) + " IST"
    : "-";

function Row({ label, children }: { label: string; children: ReactNode }) {
  if (children === "" || children == null) return null;
  return (
    <div className="grid gap-0.5 py-2.5 sm:grid-cols-[13rem_1fr] sm:gap-4">
      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-900 dark:text-slate-100">{children}</dd>
    </div>
  );
}

/**
 * Public page reached from the QR code on a payment receipt (or by typing the receipt number and code). It shows the
 * institute's own record of the payment, so Finance can tell a genuine receipt from an altered or made-up one.
 */
export default function VerifyReceipt() {
  const [params] = useSearchParams();
  const [number, setNumber] = useState(params.get("n") || "");
  const [code, setCode] = useState(params.get("c") || "");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ReceiptCheck | null>(null);
  const [error, setError] = useState("");

  const run = async (n: string, c: string) => {
    if (!n.trim() || !c.trim()) {
      setError("Enter the receipt number and the verification code printed on the receipt.");
      return;
    }
    setBusy(true);
    setError("");
    setResult(null);
    const res = await apiClient.verifyReceipt(n.trim(), c.trim());
    setBusy(false);
    if (res.error || !res.data) {
      setError(res.error || "The check could not be completed. Please try again.");
      return;
    }
    setResult(res.data);
  };

  useEffect(() => {
    const prev = document.title;
    document.title = "Verify a payment receipt | IIT Roorkee";
    const n = params.get("n");
    const c = params.get("c");
    if (n && c) void run(n, c);
    return () => {
      document.title = prev;
    };
    // Only on arrival from a QR code.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(number, code);
  };

  const ok = result?.valid === true;
  // Amber when the money may have gone back: the payment was refunded, or the booking was later cancelled or refunded.
  const refunded = ok && (result.status === "refunded" || result.status === "partly_refunded" || Boolean(result.booking_undone));

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-white px-4 py-10 text-slate-900 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:text-slate-100">
      <main className="mx-auto max-w-2xl space-y-6">
        <header className="text-center">
          <Link to="/" className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 hover:underline dark:text-sky-300">
            IIT Roorkee · Equipment Booking Portal
          </Link>
          <h1 className="mt-2 flex items-center justify-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
            <ShieldCheck className="h-7 w-7 text-sky-700 dark:text-sky-300" aria-hidden /> Verify a payment receipt
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600 dark:text-slate-300">
            Enter the receipt number and verification code printed at the bottom of the receipt, or scan its QR code.
            The result comes from the institute's own payment records.
          </p>
        </header>

        <form onSubmit={submit} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-white/10 dark:bg-slate-900">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="vr-number">Receipt no.</Label>
              <Input id="vr-number" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="IITR/IIC/2026/00001" autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vr-code">Verification code</Label>
              <Input id="vr-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="K7Q2M-9XWPD" autoComplete="off" className="font-mono uppercase" />
            </div>
          </div>
          <Button type="submit" disabled={busy} className="w-full gap-2 sm:w-auto">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ShieldCheck className="h-4 w-4" aria-hidden />}
            Verify
          </Button>
          {error ? <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p> : null}
        </form>

        {result && !ok ? (
          <section role="status" data-testid="receipt-invalid" className="flex gap-3 rounded-3xl border border-rose-200 bg-rose-50 p-5 dark:border-rose-500/30 dark:bg-rose-500/10">
            <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-rose-600 dark:text-rose-300" aria-hidden />
            <div>
              <p className="font-semibold text-rose-900 dark:text-rose-100">No matching receipt</p>
              <p className="mt-1 text-sm text-rose-800 dark:text-rose-200">
                This receipt number and code do not match any payment in the institute's records. Check both for typing
                mistakes. If they are typed exactly as printed, do not accept the receipt.
              </p>
            </div>
          </section>
        ) : null}

        {ok ? (
          <section role="status" data-testid="receipt-valid" className="overflow-hidden rounded-3xl border border-emerald-200 bg-white shadow-sm dark:border-emerald-500/30 dark:bg-slate-900">
            <div className={cn("flex items-start gap-3 p-5", refunded ? "bg-amber-50 dark:bg-amber-500/10" : "bg-emerald-50 dark:bg-emerald-500/10")}>
              {refunded ? (
                <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden />
              ) : (
                <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-300" aria-hidden />
              )}
              <div>
                <p className={cn("font-semibold", refunded ? "text-amber-900 dark:text-amber-100" : "text-emerald-900 dark:text-emerald-100")}>
                  Genuine receipt · {result.status_label}
                  {result.booking_status_label ? ` · Booking ${result.booking_status_label.toLowerCase()}` : ""}
                </p>
                {result.booking_undone ? (
                  <p className="mt-1 text-sm font-medium text-amber-900 dark:text-amber-100" data-testid="booking-undone">
                    This booking was {result.booking_status_label?.toLowerCase()} after the payment. Do not accept this receipt for
                    reimbursement without confirmation from the department&apos;s Accounts In Charge.
                  </p>
                ) : null}
                <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                  Compare the details below with the receipt you were given. They must be the same.
                </p>
                {result.test_mode ? (
                  <p className="mt-2 rounded-lg bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-500/20 dark:text-amber-100">
                    Test-mode payment: no real money was collected. Not valid for reimbursement.
                  </p>
                ) : null}
              </div>
            </div>
            <dl className="divide-y divide-slate-100 px-5 dark:divide-white/5">
              <Row label="Receipt no.">{result.receipt_number}</Row>
              <Row label="Booking status">
                {result.booking_status_label ? (
                  <span
                    data-testid="booking-status"
                    className={cn(
                      "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
                      result.booking_undone
                        ? "bg-amber-50 text-amber-900 ring-amber-300 dark:bg-amber-500/10 dark:text-amber-100"
                        : result.booking_status === "COMPLETED"
                          ? "bg-emerald-50 text-emerald-800 ring-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-100"
                          : "bg-sky-50 text-sky-800 ring-sky-300 dark:bg-sky-500/10 dark:text-sky-100",
                    )}
                  >
                    {result.booking_status_label}
                  </span>
                ) : (
                  ""
                )}
              </Row>
              <Row label="Date of payment">{when(result.paid_at)}</Row>
              <Row label="Amount received">
                <span className="font-semibold">{money(result.total, result.currency)}</span>
                {result.booking_total ? (
                  <span className="ml-2 text-xs text-slate-500">
                    (booking charge {money(String(Number(result.booking_total) - Number(result.booking_gst || 0)))} + GST {money(result.booking_gst || "0")})
                  </span>
                ) : null}
              </Row>
              <Row label="Received from">
                {result.payer_name}
                {result.payer_organisation ? <span className="block text-xs text-slate-500">{result.payer_organisation}</span> : null}
              </Row>
              <Row label="Purpose">{result.purpose}</Row>
              <Row label="Booking ID">{result.booking_reference}</Row>
              <Row label="Department">{result.department_name}</Row>
              <Row label="Grant code">{result.grant_code}</Row>
              <Row label="Collected by">{result.collected_by}</Row>
              <Row label="Razorpay payment ID"><span className="font-mono">{result.razorpay_payment_id}</span></Row>
              <Row label="Bank reference (UTR / RRN)">{result.bank_reference ? <span className="font-mono">{result.bank_reference}</span> : ""}</Row>
              <Row label="Settlement UTR">{result.settlement_utr ? <span className="font-mono">{result.settlement_utr}</span> : "Not yet settled to the institute"}</Row>
            </dl>
          </section>
        ) : null}

        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          Questions about a payment: the Accounts In Charge of the department named on the receipt.
        </p>
      </main>
    </div>
  );
}

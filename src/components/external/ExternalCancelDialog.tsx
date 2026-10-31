import { useEffect, useState } from "react";
import { Landmark, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
  ExternalBookingApiError,
  externalBookingApi,
  type CancellationQuote,
  type ExternalRefund,
  type RefundBankAccount,
  type RefundBankAccountInput,
} from "@/lib/externalBookingApi";
import { formatINRWithPaise } from "@/lib/money";

const EMPTY_ACCOUNT: RefundBankAccountInput = {
  account_holder_name: "",
  bank_name: "",
  account_number: "",
  account_number_confirm: "",
  ifsc: "",
  branch: "",
};

const when = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "";

/** The headline of the quote: what the user gets back and why. */
function tierText(q: CancellationQuote): string {
  if (q.tier === "disruption") return "The lab could not run this booking, so there is no cancellation penalty.";
  if (q.tier === "free") return `Cancelled more than ${q.rules?.free_hours ?? 48} hours before the booking: no penalty.`;
  if (q.tier === "half")
    return `Cancelled between ${q.rules?.half_hours ?? 24} and ${q.rules?.free_hours ?? 48} hours before the booking: ${q.penalty_percent}% penalty.`;
  return `Cancelled less than ${q.rules?.half_hours ?? 24} hours before the booking: the whole amount is kept (no refund).`;
}

/**
 * Cancellation under the 31 Oct 2026 policy for external users: shows the refund before the user confirms (penalty,
 * non-refundable return shipping, whether GST is refunded) and, after a lab disruption, lets the user choose the
 * wallet or a bank account (saved for next time).
 */
export function ExternalCancelDialog({
  bookingId,
  bookingLabel,
  open,
  onOpenChange,
  onCancelled,
}: {
  bookingId: number;
  bookingLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancelled: (refund: ExternalRefund) => void;
}) {
  const [quote, setQuote] = useState<CancellationQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [destination, setDestination] = useState<"wallet" | "bank">("wallet");
  const [accounts, setAccounts] = useState<RefundBankAccount[]>([]);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<RefundBankAccountInput>(EMPTY_ACCOUNT);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const q = await externalBookingApi.cancellationQuote(bookingId);
      setQuote(q);
      const saved = q.accounts ?? [];
      setAccounts(saved);
      setAccountId(saved.find((a) => a.is_default)?.id ?? saved[0]?.id ?? null);
      setAdding(saved.length === 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The refund could not be worked out.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setDestination("wallet");
    setNotes("");
    setForm(EMPTY_ACCOUNT);
    setFieldErrors({});
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bookingId]);

  const saveAccount = async (): Promise<number | null> => {
    setFieldErrors({});
    try {
      const acc = await externalBookingApi.addRefundAccount(form);
      setAccounts((prev) => [acc, ...prev.filter((a) => a.id !== acc.id).map((a) => ({ ...a, is_default: false }))]);
      setAccountId(acc.id);
      setAdding(false);
      setForm(EMPTY_ACCOUNT);
      return acc.id;
    } catch (e) {
      if (e instanceof ExternalBookingApiError) {
        const fields = (e.body.fields ?? {}) as Record<string, string>;
        setFieldErrors(fields);
        setError(e.message);
      } else {
        setError("The bank account could not be saved.");
      }
      return null;
    }
  };

  const confirm = async () => {
    if (!quote || busy) return;
    setBusy(true);
    setError("");
    try {
      let bankId = accountId;
      if (destination === "bank" && (adding || bankId == null)) {
        bankId = await saveAccount();
        if (bankId == null) return;
      }
      const res = await externalBookingApi.cancelWithRefund(bookingId, {
        destination,
        bank_account_id: destination === "bank" ? (bankId ?? undefined) : undefined,
        notes: notes.trim(),
        expected_refund: quote.refund,
      });
      toast.success(
        Number(res.refund.refund_amount) > 0
          ? destination === "wallet"
            ? `Booking cancelled. ${formatINRWithPaise(res.refund.refund_amount)} credited to your wallet.`
            : `Booking cancelled. ${formatINRWithPaise(res.refund.refund_amount)} will be paid to your bank account through SRIC.`
          : "Booking cancelled. No refund is due.",
      );
      onCancelled(res.refund);
      onOpenChange(false);
    } catch (e) {
      if (e instanceof ExternalBookingApiError && e.code === "quote_changed") {
        await load(); // clears the error, so the explanation is set after it
        setError("The refund amount changed while this window was open (a time limit passed). Please check it again.");
      } else {
        setError(e instanceof Error ? e.message : "The booking could not be cancelled.");
      }
    } finally {
      setBusy(false);
    }
  };

  const field = (key: keyof RefundBankAccountInput, label: string, props: Record<string, unknown> = {}) => (
    <div className="space-y-1">
      <Label htmlFor={`refund-${key}`}>{label}</Label>
      <Input
        id={`refund-${key}`}
        value={form[key] ?? ""}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        aria-invalid={Boolean(fieldErrors[key]) || undefined}
        {...props}
      />
      {fieldErrors[key] ? <p className="text-xs text-destructive">{fieldErrors[key]}</p> : null}
    </div>
  );

  const noRefund = quote ? Number(quote.refund ?? 0) <= 0 : false;

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cancel booking {bookingLabel}</DialogTitle>
          <DialogDescription>Check the refund below before you confirm. Cancelling cannot be undone.</DialogDescription>
        </DialogHeader>

        {loading || !quote ? (
          error ? (
            <p role="alert" className="text-sm text-destructive">{error}</p>
          ) : (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Working out the refund…
            </div>
          )
        ) : (
          <div className="space-y-4 text-sm">
            <p className={noRefund ? "rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-950" : "rounded-md border bg-muted/40 p-3"}>
              {tierText(quote)}
            </p>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 tabular-nums" data-testid="refund-breakdown">
              <dt className="text-muted-foreground">Amount paid</dt>
              <dd>{formatINRWithPaise(quote.paid ?? "0")}</dd>
              {Number(quote.return_shipping ?? 0) > 0 ? (
                <>
                  <dt className="text-muted-foreground">Return shipping (non-refundable)</dt>
                  <dd>− {formatINRWithPaise(quote.return_shipping ?? "0")}</dd>
                </>
              ) : null}
              {quote.penalty_percent ? (
                <>
                  <dt className="text-muted-foreground">Cancellation penalty</dt>
                  <dd>{quote.penalty_percent}%</dd>
                </>
              ) : null}
              <dt className="text-muted-foreground">Refund before GST</dt>
              <dd>{formatINRWithPaise(quote.refund_base ?? "0")}</dd>
              <dt className="text-muted-foreground">GST refunded</dt>
              <dd>{quote.gst_refunded ? formatINRWithPaise(quote.refund_gst ?? "0") : "Not refunded"}</dd>
              <dt className="font-semibold">You get back</dt>
              <dd className="font-semibold" data-testid="refund-total">{formatINRWithPaise(quote.refund ?? "0")}</dd>
            </dl>
            {!quote.gst_refunded ? (
              <p className="text-xs text-muted-foreground">
                A GST invoice has already been requested for this booking, so the GST part is settled by SRIC with the
                invoice and is not refunded here.
              </p>
            ) : null}

            {quote.bank_refund_allowed && !noRefund ? (
              <fieldset className="space-y-2">
                <legend className="font-medium">Where should the refund go?</legend>
                <RadioGroup value={destination} onValueChange={(v) => setDestination(v as "wallet" | "bank")} className="grid gap-2">
                  <Label className="flex cursor-pointer items-start gap-2 rounded-md border p-3 font-normal has-[:checked]:border-primary">
                    <RadioGroupItem value="wallet" className="mt-0.5" />
                    <span>
                      <span className="flex items-center gap-1 font-medium"><Wallet className="h-4 w-4" aria-hidden="true" /> My wallet, now</span>
                      <span className="text-muted-foreground">Credited at once and usable for your next booking.</span>
                    </span>
                  </Label>
                  <Label className="flex cursor-pointer items-start gap-2 rounded-md border p-3 font-normal has-[:checked]:border-primary">
                    <RadioGroupItem value="bank" className="mt-0.5" />
                    <span>
                      <span className="flex items-center gap-1 font-medium"><Landmark className="h-4 w-4" aria-hidden="true" /> My bank account</span>
                      <span className="text-muted-foreground">
                        Sent to SRIC with the weekly batch (first working day of the week). You are told when it is paid.
                      </span>
                    </span>
                  </Label>
                </RadioGroup>
              </fieldset>
            ) : null}

            {destination === "bank" ? (
              <div className="space-y-2 rounded-md border p-3">
                {accounts.length > 0 && !adding ? (
                  <>
                    <Label>Bank account</Label>
                    <RadioGroup value={accountId ? String(accountId) : ""} onValueChange={(v) => setAccountId(Number(v))} className="grid gap-1">
                      {accounts.map((a) => (
                        <Label key={a.id} className="flex cursor-pointer items-center gap-2 font-normal">
                          <RadioGroupItem value={String(a.id)} />
                          {a.bank_name} · {a.account_number} · {a.ifsc} ({a.account_holder_name})
                        </Label>
                      ))}
                    </RadioGroup>
                    <Button type="button" variant="link" className="h-auto p-0" onClick={() => setAdding(true)}>
                      Use another account
                    </Button>
                  </>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="sm:col-span-2">{field("account_holder_name", "Account holder's name")}</div>
                    {field("bank_name", "Bank")}
                    {field("branch", "Branch (optional)")}
                    {field("account_number", "Account number", { inputMode: "numeric", autoComplete: "off" })}
                    {field("account_number_confirm", "Account number again", { inputMode: "numeric", autoComplete: "off" })}
                    {field("ifsc", "IFSC", { autoComplete: "off" })}
                    <p className="text-xs text-muted-foreground sm:col-span-2">
                      Saved for future refunds. Only the last four digits are shown to you later.
                    </p>
                    {accounts.length > 0 ? (
                      <Button type="button" variant="link" className="h-auto justify-start p-0" onClick={() => setAdding(false)}>
                        Use a saved account
                      </Button>
                    ) : null}
                  </div>
                )}
              </div>
            ) : null}

            <div className="space-y-1">
              <Label htmlFor="cancel-notes">Reason (optional)</Label>
              <Textarea id="cancel-notes" rows={2} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
            {quote.free_until && quote.tier !== "disruption" ? (
              <p className="text-xs text-muted-foreground">
                Free cancellation until {when(quote.free_until)}; {quote.rules?.half_penalty_percent ?? 50}% penalty until{" "}
                {when(quote.half_until)}; no refund after that.
              </p>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Keep booking
          </Button>
          <Button variant="destructive" onClick={() => void confirm()} disabled={busy || loading || !quote} data-testid="confirm-cancel">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {noRefund ? "Cancel without refund" : `Cancel and refund ${quote ? formatINRWithPaise(quote.refund ?? "0") : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ExternalCancelDialog;

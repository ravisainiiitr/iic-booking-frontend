import { useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  apiClient,
  type LedgerAdjustment,
  type LedgerAdjustmentPreview,
  type LedgerAdjustmentTarget,
  type LedgerOption,
  type LedgerOwnerDetail,
} from "@/lib/api";
import { AMOUNT_RE, formatLedgerAmount, newLedgerRequestId } from "@/lib/walletLedger";
import { cn } from "@/lib/utils";

type Direction = "credit" | "debit";

const FALLBACK_REASONS: LedgerOption[] = [
  { value: "manual_adjustment", label: "Manual adjustment" },
  { value: "correction", label: "Correction" },
  { value: "refund_outside_system", label: "Refund outside system" },
  { value: "grant_top_up", label: "Grant top-up" },
  { value: "other", label: "Other" },
];

export default function AdjustWalletDialog({
  open,
  onOpenChange,
  direction,
  owner,
  reasons,
  maxAmount,
  initialSubWalletId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  direction: Direction;
  owner: LedgerOwnerDetail;
  reasons?: LedgerOption[];
  maxAmount?: string;
  initialSubWalletId?: number | null;
  onDone: (adjustment: LedgerAdjustment) => void;
}) {
  const credit = direction === "credit";
  const [target, setTarget] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [externalRef, setExternalRef] = useState("");
  const [notify, setNotify] = useState(true);
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [preview, setPreview] = useState<LedgerAdjustmentPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState(newLedgerRequestId);

  const targets = useMemo(() => {
    const existing = owner.sub_wallets
      .filter((s) => credit || Number(s.balance) > 0)
      .map((s) => ({ value: `sw:${s.id}`, label: s.department_name, balance: s.balance as string | null }));
    const fresh = credit
      ? owner.credit_departments.map((d) => ({ value: `dept:${d.value}`, label: `${d.label} (new sub-wallet)`, balance: null }))
      : [];
    return [...existing, ...fresh];
  }, [owner, credit]);

  useEffect(() => {
    if (!open) return;
    const preferred = initialSubWalletId ? `sw:${initialSubWalletId}` : "";
    const fallback = targets.length === 1 || (targets[0] && !targets[0].value.startsWith("dept:")) ? targets[0]?.value ?? "" : "";
    setTarget(targets.some((t) => t.value === preferred) ? preferred : fallback);
    setAmount("");
    setReason("");
    setRemarks("");
    setExternalRef("");
    setNotify(true);
    setStep("form");
    setPreview(null);
    setError(null);
    setBusy(false);
    setRequestId(newLedgerRequestId());
  }, [open, direction]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = targets.find((t) => t.value === target);
  const max = Number(maxAmount || 0);
  const amountNum = Number(amount);
  const amountError = !amount
    ? null
    : !AMOUNT_RE.test(amount)
      ? "Use digits with at most two decimal places."
      : amountNum <= 0
        ? "Amount must be more than zero."
        : max && amountNum > max
          ? `Amount cannot exceed ${formatLedgerAmount(max)}.`
          : !credit && selected?.balance != null && amountNum > Number(selected.balance)
            ? `A debit cannot exceed the available ${formatLedgerAmount(selected.balance)}.`
            : null;
  const canReview = Boolean(target && amount && !amountError && reason && remarks.trim().length >= 3);

  const payload = (): LedgerAdjustmentTarget => {
    const [kind, id] = target.split(":");
    return {
      owner_id: owner.owner_id,
      direction,
      amount,
      sub_wallet_id: kind === "sw" ? Number(id) : null,
      department_id: kind === "dept" ? Number(id) : null,
    };
  };

  const review = async () => {
    if (!canReview) return;
    setBusy(true);
    setError(null);
    const res = await apiClient.previewWalletLedgerAdjustment(payload());
    setBusy(false);
    if (res.error || !res.data) {
      setError(res.error || "Could not check this entry.");
      return;
    }
    setPreview(res.data);
    setStep("confirm");
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await apiClient.createWalletLedgerAdjustment({
      ...payload(),
      client_request_id: requestId,
      reason,
      remarks: remarks.trim(),
      external_reference: externalRef.trim(),
      notify_owner: notify,
    });
    setBusy(false);
    if (res.error || !res.data) {
      setError(res.error || "The entry was not saved. You can try again safely.");
      return;
    }
    const done = res.data;
    toast.success(`${credit ? "Credited" : "Debited"} ${formatLedgerAmount(done.amount)} · ${done.reference}`, {
      description: `${done.department_name} balance is now ${formatLedgerAmount(done.balance_after)}.`,
    });
    onDone(done);
    onOpenChange(false);
  };

  const reasonList = reasons && reasons.length ? reasons : FALLBACK_REASONS;
  const reasonLabel = reasonList.find((r) => r.value === reason)?.label ?? reason;
  const Icon = credit ? ArrowDownLeft : ArrowUpRight;

  return (
    <Dialog open={open} onOpenChange={(v) => (!busy ? onOpenChange(v) : undefined)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-full",
                credit ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
              )}
              aria-hidden
            >
              <Icon className="h-4 w-4" />
            </span>
            {step === "form" ? (credit ? "Credit wallet" : "Debit wallet") : credit ? "Confirm credit" : "Confirm debit"}
          </DialogTitle>
          <DialogDescription>
            {step === "form"
              ? `${owner.name}${owner.department_name ? ` · ${owner.department_name}` : ""}`
              : "Check the details. The entry is posted to the wallet ledger immediately."}
          </DialogDescription>
        </DialogHeader>

        {step === "form" ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="wl-adj-target">Sub-wallet</Label>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger id="wl-adj-target">
                  <SelectValue placeholder="Select the sub-wallet" />
                </SelectTrigger>
                <SelectContent>
                  {targets.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                      {t.balance != null ? ` — ${formatLedgerAmount(t.balance)}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!credit && targets.length === 0 ? (
                <p className="text-xs text-muted-foreground">No sub-wallet has a balance to debit.</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wl-adj-amount">Amount (₹)</Label>
              <Input
                id="wl-adj-amount"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                className="tabular-nums"
                value={amount}
                aria-invalid={Boolean(amountError)}
                aria-describedby={amountError ? "wl-adj-amount-error" : undefined}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
              />
              {amountError ? (
                <p id="wl-adj-amount-error" className="text-xs text-destructive">
                  {amountError}
                </p>
              ) : !credit ? (
                <p className="text-xs text-muted-foreground">A debit cannot take the balance below ₹0.00.</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wl-adj-reason">Reason</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger id="wl-adj-reason">
                  <SelectValue placeholder="Select the reason" />
                </SelectTrigger>
                <SelectContent>
                  {reasonList.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wl-adj-remarks">Remarks</Label>
              <Textarea
                id="wl-adj-remarks"
                rows={3}
                maxLength={2000}
                placeholder="Why is this entry being made? Shown in the ledger and the email."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wl-adj-ref">
                External reference <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="wl-adj-ref"
                maxLength={120}
                placeholder="Receipt number, UTR, file number…"
                value={externalRef}
                onChange={(e) => setExternalRef(e.target.value)}
              />
            </div>

            <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3">
              <Checkbox id="wl-adj-notify" checked={notify} onCheckedChange={(v) => setNotify(v === true)} className="mt-0.5" />
              <Label htmlFor="wl-adj-notify" className="cursor-pointer font-normal leading-snug">
                Notify wallet owner by email
                <span className="block text-xs text-muted-foreground">Also shown in their portal notifications.</span>
              </Label>
            </div>
          </div>
        ) : preview ? (
          <div className="space-y-4">
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {preview.department.name}
                {!preview.sub_wallet_exists ? " · new sub-wallet" : ""}
              </p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Current balance</p>
                  <p className="text-lg font-semibold tabular-nums">{formatLedgerAmount(preview.balance_before)}</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" aria-hidden />
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">New balance</p>
                  <p
                    className={cn(
                      "text-lg font-semibold tabular-nums",
                      credit ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
                    )}
                    data-testid="wl-new-balance"
                  >
                    {formatLedgerAmount(preview.balance_after)}
                  </p>
                </div>
              </div>
            </div>
            <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Wallet owner</dt>
              <dd className="font-medium">{preview.owner.name}</dd>
              <dt className="text-muted-foreground">{credit ? "Credit" : "Debit"}</dt>
              <dd
                className={cn(
                  "font-semibold tabular-nums",
                  credit ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
                )}
              >
                {credit ? "+" : "−"} {formatLedgerAmount(preview.amount)}
              </dd>
              <dt className="text-muted-foreground">Reason</dt>
              <dd>{reasonLabel}</dd>
              <dt className="text-muted-foreground">Remarks</dt>
              <dd className="break-words">{remarks.trim()}</dd>
              {externalRef.trim() ? (
                <>
                  <dt className="text-muted-foreground">Reference</dt>
                  <dd className="break-words">{externalRef.trim()}</dd>
                </>
              ) : null}
              <dt className="text-muted-foreground">Email owner</dt>
              <dd>{notify ? "Yes" : "No"}</dd>
            </dl>
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              Recorded with your name, the time and the reason. Bookings are not changed.
            </p>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === "form" ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={review} disabled={!canReview || busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                Review
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setStep("form");
                  setError(null);
                }}
                disabled={busy}
              >
                Back
              </Button>
              <Button
                onClick={submit}
                disabled={busy}
                className={credit ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-red-600 text-white hover:bg-red-700"}
              >
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                {credit ? `Credit ${formatLedgerAmount(amount)}` : `Debit ${formatLedgerAmount(amount)}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useId, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { externalBookingApi, type LabFailureKind, type LabFailureQuote } from "@/lib/externalBookingApi";
import { formatINRWithPaise } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";

const KINDS: Array<{ value: LabFailureKind; label: string }> = [
  { value: "equipment_failure", label: "Equipment failure" },
  { value: "analysis_unsuccessful", label: "Analysis not possible (laboratory or equipment issue)" },
];

/**
 * OIC / Accounts In Charge / Main Administrator: refund an external booking the lab could not serve. Every figure
 * comes from the server for the chosen share; the amount shown is sent back so a changed amount is never applied.
 */
export default function LabFailureRefundDialog({
  bookingId,
  bookingReference,
  open,
  onOpenChange,
  onDone,
}: {
  bookingId: number;
  bookingReference: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const reasonId = useId();
  const shareId = useId();
  const [kind, setKind] = useState<LabFailureKind>("equipment_failure");
  const [reason, setReason] = useState("");
  const [full, setFull] = useState(true);
  const [share, setShare] = useState(50);
  const [quote, setQuote] = useState<LabFailureQuote | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const portion = full ? 100 : Math.max(1, Math.min(99, Math.round(share) || 1));

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setQuote(null);
    setError("");
    const timer = window.setTimeout(() => {
      externalBookingApi
        .labFailureQuote(bookingId, portion)
        .then((q) => {
          if (!cancelled) setQuote(q);
        })
        .catch((e: unknown) => {
          if (!cancelled) setError(e instanceof Error ? e.message : "Could not work out the refund.");
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, bookingId, portion]);

  const submit = async () => {
    if (!quote) return;
    setSaving(true);
    try {
      await externalBookingApi.refundLabFailure(bookingId, {
        kind,
        reason: reason.trim(),
        portion_percent: portion,
        expected_refund: quote.refund,
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "The refund was not made.");
      return;
    } finally {
      setSaving(false);
    }
    toast.success(`${formatINRWithPaise(quote.refund)} refunded to the user's wallet for booking ${bookingReference}.`);
    onOpenChange(false);
    onDone();
  };

  const tooShort = reason.trim().length < 10;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Refund for lab failure</DialogTitle>
          <DialogDescription>
            Booking {bookingReference}: the refund goes to the user&apos;s wallet and the user is told why.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <fieldset className="space-y-2">
            <legend className="font-medium">What went wrong?</legend>
            <RadioGroup value={kind} onValueChange={(v) => setKind(v as LabFailureKind)} className="grid gap-2">
              {KINDS.map((k) => (
                <Label key={k.value} className="flex cursor-pointer items-center gap-2 rounded-md border p-2.5 font-normal has-[:checked]:border-primary">
                  <RadioGroupItem value={k.value} /> {k.label}
                </Label>
              ))}
            </RadioGroup>
          </fieldset>
          <div className="grid gap-1.5">
            <Label htmlFor={reasonId}>Reason (the user sees this)</Label>
            <Textarea id={reasonId} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. The detector failed during the run; no data could be recorded." />
          </div>
          <fieldset className="space-y-2">
            <legend className="font-medium">How much?</legend>
            <RadioGroup value={full ? "full" : "part"} onValueChange={(v) => setFull(v === "full")} className="grid gap-2">
              <Label className="flex cursor-pointer items-start gap-2 rounded-md border p-2.5 font-normal has-[:checked]:border-primary">
                <RadioGroupItem value="full" className="mt-0.5" />
                <span>
                  <span className="font-medium">Full refund</span>
                  <span className="block text-muted-foreground">Nothing could be done: the booking is closed and the return shipping refunded.</span>
                </span>
              </Label>
              <Label className="flex cursor-pointer items-start gap-2 rounded-md border p-2.5 font-normal has-[:checked]:border-primary">
                <RadioGroupItem value="part" className="mt-0.5" />
                <span>
                  <span className="font-medium">Part of the service charges</span>
                  <span className="block text-muted-foreground">Some of the work was done: the booking stays open.</span>
                </span>
              </Label>
            </RadioGroup>
            {!full ? (
              <div className="flex items-center gap-2 pl-1">
                <Label htmlFor={shareId}>Share refunded</Label>
                <Input id={shareId} type="number" min={1} max={99} className="w-24" value={share} onChange={(e) => setShare(Number(e.target.value))} />
                <span>%</span>
              </div>
            ) : null}
          </fieldset>

          {error ? (
            <p role="alert" className="text-destructive">{error}</p>
          ) : !quote ? (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Working out the refund…
            </p>
          ) : (
            <>
              <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded-md border p-3 tabular-nums" data-testid="lab-failure-breakdown">
                <dt className="text-muted-foreground">Amount paid</dt>
                <dd>{formatINRWithPaise(quote.paid)}</dd>
                <dt className="text-muted-foreground">Service charges refunded ({quote.portion_percent}%)</dt>
                <dd>{formatINRWithPaise(quote.service_refunded)}</dd>
                <dt className="text-muted-foreground">Return shipping refunded</dt>
                <dd>{formatINRWithPaise(quote.shipping_refunded)}</dd>
                <dt className="text-muted-foreground">GST refunded</dt>
                <dd>{quote.gst_refunded ? formatINRWithPaise(quote.refund_gst) : "Not refunded"}</dd>
                <dt className="font-semibold">Refund to the wallet</dt>
                <dd className="font-semibold" data-testid="lab-failure-total">{formatINRWithPaise(quote.refund)}</dd>
              </dl>
              {quote.invoice_requested ? (
                <p className="text-xs text-muted-foreground">
                  A GST invoice has been requested for this booking, so only the base amounts are refunded here; the GST
                  is settled by SRIC with a credit note.
                </p>
              ) : null}
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={!quote || saving || tooShort}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Refund {quote ? formatINRWithPaise(quote.refund) : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

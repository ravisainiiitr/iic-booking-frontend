import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Banknote, PackagePlus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  apiClient,
  type BookingMaterialChargeRow,
  type MaterialChargeOverview,
  type MaterialChargePreview,
} from "@/lib/api";
import { formatINR, formatINRAmount } from "@/lib/money";
import { formatDMYTime } from "@/lib/dateFormat";

export const CHARGE_MATERIAL_ACTION = "Charge for IIC material used";

interface OwnMaterialChargePanelProps {
  bookingId: number;
  profileType: "PRINT_3D" | "LASER_CUT_2D";
  /** Called with the updated booking after a charge or a reversal. */
  onUpdated?: (booking?: unknown) => void;
}

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

function ownMaterialLabel(profileType: OwnMaterialChargePanelProps["profileType"]) {
  return profileType === "LASER_CUT_2D"
    ? "I will bring my own sheet material"
    : "I will bring my own printing material";
}

function chargeStatus(c: BookingMaterialChargeRow): { text: string; className: string } {
  if (c.reversed) return { text: "Reversed", className: "bg-muted text-muted-foreground border-border" };
  if (c.deducted_from_wallet) {
    return { text: "Deducted from wallet", className: "bg-success-subtle text-success-subtle-foreground border-success-border" };
  }
  return { text: "Added to amount to pay", className: "bg-warning-subtle text-warning-subtle-foreground border-warning-border" };
}

export function OwnMaterialChargePanel({ bookingId, profileType, onUpdated }: OwnMaterialChargePanelProps) {
  const [overview, setOverview] = useState<MaterialChargeOverview | null>(null);
  const [hidden, setHidden] = useState(false);

  const [open, setOpen] = useState(false);
  const [materialId, setMaterialId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [override, setOverride] = useState("");
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<MaterialChargePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const [reversing, setReversing] = useState<BookingMaterialChargeRow | null>(null);
  const [reverseReason, setReverseReason] = useState("");

  const load = useCallback(async () => {
    const res = await apiClient.getBookingMaterialCharges(bookingId);
    if (res.error || !res.data) {
      // Not the OIC / Main Admin of this equipment (or the booking is gone): show nothing.
      setHidden(true);
      return;
    }
    setHidden(false);
    setOverview(res.data);
  }, [bookingId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (hidden || !overview) return null;

  const isLaser = profileType === "LASER_CUT_2D";
  const selected = overview.materials.find((m) => String(m.id) === materialId);

  const resetForm = () => {
    setMaterialId(overview.materials.length === 1 ? String(overview.materials[0].id) : "");
    setQuantity("");
    setOverride("");
    setReason("");
    setPreview(null);
    setFormError("");
  };

  const openDialog = () => {
    resetForm();
    setOpen(true);
  };

  const requestBody = () => ({
    material_id: Number(materialId),
    quantity: quantity.trim(),
    ...(overview.can_override_amount && override.trim() ? { override_amount: override.trim() } : {}),
  });

  const handlePreview = async () => {
    if (!materialId) {
      setFormError("Choose the IIC material that was used.");
      return;
    }
    if (!quantity.trim() || !(Number(quantity) > 0)) {
      setFormError(isLaser ? "Enter the number of sheets used." : "Enter the grams used.");
      return;
    }
    if (!reason.trim()) {
      setFormError("Enter the reason, for example: user's sheet was insufficient; 1 IIC MS sheet used.");
      return;
    }
    setFormError("");
    setBusy(true);
    try {
      const res = await apiClient.previewBookingMaterialCharge(bookingId, requestBody());
      if (res.error || !res.data) throw new Error(res.error || "Could not calculate the amount.");
      setPreview(res.data);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not calculate the amount.");
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async () => {
    setBusy(true);
    try {
      const res = await apiClient.createBookingMaterialCharge(bookingId, { ...requestBody(), reason: reason.trim() });
      if (res.error || !res.data) throw new Error(res.error || "Could not charge the material.");
      toast.success(res.data.message);
      setOpen(false);
      onUpdated?.(res.data.booking);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not charge the material.");
    } finally {
      setBusy(false);
    }
  };

  const handleReverse = async () => {
    if (!reversing) return;
    if (!reverseReason.trim()) {
      toast.error("Enter the reason for the reversal.");
      return;
    }
    setBusy(true);
    try {
      const res = await apiClient.reverseBookingMaterialCharge(bookingId, reversing.id, reverseReason.trim());
      if (res.error || !res.data) throw new Error(res.error || "Could not reverse the charge.");
      toast.success(res.data.message);
      setReversing(null);
      onUpdated?.(res.data.booking);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reverse the charge.");
    } finally {
      setBusy(false);
    }
  };

  const unitPriceText = (price: string) => `${formatINRAmount(price)} per ${isLaser ? "sheet" : "g"}`;

  return (
    <div className="mt-4 pt-4 border-t space-y-3" data-testid="own-material-charges">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-base font-medium">IIC material used</p>
          <p className="text-sm text-muted-foreground">
            The user ticked &ldquo;{ownMaterialLabel(profileType)}&rdquo;. If it was not enough and IIC material was used,
            charge it here.
          </p>
        </div>
        {overview.eligible && (
          <Button type="button" size="sm" variant="outline" onClick={openDialog}>
            <PackagePlus className="h-4 w-4 mr-1" />
            {CHARGE_MATERIAL_ACTION}
          </Button>
        )}
      </div>

      {!overview.eligible && overview.ineligible_reason && (
        <p
          className="rounded-md border border-info-border bg-info-subtle px-3 py-2 text-sm text-info-subtle-foreground"
          data-testid="own-material-ineligible"
        >
          {overview.ineligible_reason}
        </p>
      )}

      {overview.charges.length > 0 && (
        <ul className="space-y-2">
          {overview.charges.map((c) => {
            const badge = chargeStatus(c);
            return (
              <li key={c.id} className="rounded-md border px-3 py-2 text-sm space-y-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className={`min-w-0 break-words font-medium ${c.reversed ? "line-through text-muted-foreground" : ""}`}>
                    {c.line}
                  </span>
                  <span className="shrink-0 tabular-nums font-semibold">{formatINR(c.amount)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className={`rounded border px-1.5 py-0.5 ${badge.className}`}>{badge.text}</span>
                  <span>
                    {formatDMYTime(c.created_at)}
                    {c.created_by_name ? ` · ${c.created_by_name}` : ""}
                  </span>
                  <span>
                    {unitPriceText(c.unit_price)}
                    {Number(c.gst_amount) > 0 ? ` · GST ${c.gst_percent}% ${formatINR(c.gst_amount)}` : ""}
                    {c.amount_overridden ? ` · amount set by the Main Administrator (calculated ${formatINR(c.computed_amount)})` : ""}
                  </span>
                </div>
                <p className="text-xs break-words">Reason: {c.reason}</p>
                {c.reversed && (
                  <p className="text-xs text-muted-foreground break-words">
                    Reversed {formatDMYTime(c.reversed_at)}
                    {c.reversed_by_name ? ` by ${c.reversed_by_name}` : ""}: {c.reversal_reason}
                  </p>
                )}
                {!c.reversed && !overview.reversal_blocked_reason && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="px-2"
                    onClick={() => {
                      setReverseReason("");
                      setReversing(c);
                    }}
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Reverse
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{CHARGE_MATERIAL_ACTION}</DialogTitle>
            <DialogDescription>
              Priced like a normal booking: the material&apos;s price from the Fabrication Materials list
              {Number(overview.gst_percent) > 0 ? `, plus GST ${overview.gst_percent}% for this external user` : ""}
              {overview.discounted_profile ? " (this user is on the Discounted Charge Profile, so it is ₹0)" : ""}. The
              amount is deducted from the booking&apos;s wallet, or added to the amount to pay when the balance is not
              enough.
            </DialogDescription>
          </DialogHeader>

          {!preview ? (
            <div className="space-y-4">
              {overview.materials.length === 0 ? (
                <p className="text-sm text-destructive">
                  This equipment has no supported, enabled materials. Add them under Fabrication Materials first.
                </p>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor={`omc-material-${bookingId}`}>IIC material used</Label>
                  <select
                    id={`omc-material-${bookingId}`}
                    className={SELECT_CLASS}
                    value={materialId}
                    onChange={(e) => setMaterialId(e.target.value)}
                    disabled={busy}
                  >
                    <option value="">Choose a material</option>
                    {overview.materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {`${m.name} (${m.code}) — ${unitPriceText(m.unit_price)}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor={`omc-quantity-${bookingId}`}>{isLaser ? "Sheets used" : "Material used (g)"}</Label>
                <Input
                  id={`omc-quantity-${bookingId}`}
                  type="number"
                  inputMode="decimal"
                  min={isLaser ? 0.01 : 1}
                  step={isLaser ? 0.01 : 1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  disabled={busy}
                />
                <p className="text-xs text-muted-foreground">
                  {isLaser
                    ? `Enter part of a sheet as a fraction, for example 0.5 for half a sheet${
                        selected?.sheet_width_mm
                          ? ` (sheet size ${Number(selected.sheet_width_mm)} × ${Number(selected.sheet_height_mm)} mm)`
                          : ""
                      }.`
                    : "Billed in whole grams (rounded up), like the booking estimate."}
                </p>
              </div>
              {overview.can_override_amount && (
                <div className="space-y-2">
                  <Label htmlFor={`omc-override-${bookingId}`}>Amount to charge instead (₹, optional)</Label>
                  <Input
                    id={`omc-override-${bookingId}`}
                    type="number"
                    inputMode="decimal"
                    min={1}
                    step={1}
                    value={override}
                    onChange={(e) => setOverride(e.target.value)}
                    disabled={busy}
                  />
                  <p className="text-xs text-muted-foreground">
                    Main Administrator only. Leave empty to charge the calculated amount. GST is not added to this amount.
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor={`omc-reason-${bookingId}`}>Reason</Label>
                <Textarea
                  id={`omc-reason-${bookingId}`}
                  rows={3}
                  maxLength={1000}
                  placeholder="e.g. User's sheet was insufficient; 1 IIC MS sheet used"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={busy}
                />
                <p className="text-xs text-muted-foreground">The user sees this reason in the booking history.</p>
              </div>
              {formError && (
                <p className="text-sm text-destructive" role="alert">
                  {formError}
                </p>
              )}
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => void handlePreview()}
                  disabled={busy || overview.materials.length === 0}
                >
                  {busy ? "Calculating…" : "Preview amount"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4" data-testid="own-material-preview">
              <div className="rounded-md border bg-muted/30 px-3 py-3 text-sm space-y-1.5">
                <p className="font-medium break-words">{preview.line}</p>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">
                    {preview.quantity} {preview.unit_label} × {unitPriceText(preview.unit_price)}
                  </span>
                  <span className="tabular-nums">{formatINR(preview.base_amount)}</span>
                </div>
                {Number(preview.gst_amount) > 0 && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">GST ({preview.gst_percent}%)</span>
                    <span className="tabular-nums">{formatINR(preview.gst_amount)}</span>
                  </div>
                )}
                {preview.amount_overridden && (
                  <div className="flex justify-between gap-4 text-muted-foreground">
                    <span>Calculated amount</span>
                    <span className="tabular-nums line-through">{formatINR(preview.computed_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between gap-4 border-t pt-1.5 font-semibold text-base">
                  <span>{preview.amount_overridden ? "Amount set by the Main Administrator" : "Amount to charge"}</span>
                  <span className="tabular-nums text-primary">{formatINR(preview.amount)}</span>
                </div>
              </div>
              {preview.collection && (
                <p
                  className={`rounded-md border px-3 py-2 text-sm ${
                    preview.collection.mode === "deduct"
                      ? "bg-info-subtle text-info-subtle-foreground border-info-border"
                      : "bg-warning-subtle text-warning-subtle-foreground border-warning-border"
                  }`}
                >
                  {preview.collection.message}
                </p>
              )}
              {preview.message && <p className="text-sm text-destructive">{preview.message}</p>}
              <p className="text-xs text-muted-foreground break-words">Reason: {reason.trim()}</p>
              <p className="text-xs text-muted-foreground">
                The user (and the supervisor whose wallet pays) receive the wallet debit email and an in-app notice. A
                charge made in error can be reversed; a paid amount then becomes a refund that the Officer In Charge
                confirms.
              </p>
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setPreview(null)} disabled={busy}>
                  Back
                </Button>
                <Button type="button" onClick={() => void handleConfirm()} disabled={busy || !preview.can_confirm}>
                  <Banknote className="h-4 w-4 mr-1" />
                  {busy ? "Charging…" : `Confirm charge of ${formatINR(preview.amount)}`}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={reversing != null} onOpenChange={(v) => !busy && !v && setReversing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reverse IIC material charge</DialogTitle>
            <DialogDescription>
              {reversing ? `${reversing.line}: ${formatINR(reversing.amount)}. ` : ""}
              The booking amount goes down by this charge. If it was already paid, the money becomes a refund that the
              Officer In Charge confirms with Confirm refund; if it was not paid yet, it is removed from the amount to pay.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`omc-reverse-reason-${bookingId}`}>Reason for the reversal</Label>
            <Textarea
              id={`omc-reverse-reason-${bookingId}`}
              rows={3}
              maxLength={1000}
              value={reverseReason}
              onChange={(e) => setReverseReason(e.target.value)}
              disabled={busy}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setReversing(null)} disabled={busy}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={() => void handleReverse()} disabled={busy}>
              {busy ? "Reversing…" : "Reverse charge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

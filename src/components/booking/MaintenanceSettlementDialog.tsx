import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Lock } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiClient, type MaintenanceSettlementBooking, type MaintenanceSettlementOverview } from "@/lib/api";

/** User types that may open the settlement dialog (the server also checks the OIC is assigned to the equipment). */
export const MAINTENANCE_SETTLEMENT_USER_TYPES = new Set(["admin", "manager"]);

function when(row: MaintenanceSettlementBooking): string {
  if (!row.start) return "No slot";
  try {
    const start = parseISO(row.start);
    const end = row.end ? parseISO(row.end) : null;
    return `${format(start, "d MMM yyyy, h:mm a")}${end ? ` – ${format(end, "h:mm a")}` : ""}`;
  } catch {
    return row.start;
  }
}

export interface MaintenanceSettlementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipmentId: number;
  equipmentName?: string;
  /** Show only this booking (opened from a booking's details). */
  onlyBookingId?: number;
  /** When set, the footer offers to continue (e.g. mark the equipment Operational) after settling. */
  continueLabel?: string;
  onContinue?: () => void;
  /** Called after each booking is settled. */
  onSettled?: (bookingId: number) => void;
}

/**
 * OIC of the equipment / Main Administrator: close bookings on hold for an equipment maintenance (whose users have not
 * taken a refund) with a final status before the equipment is marked Operational. A settled booking can no longer be
 * refunded, even if its user had chosen to wait.
 */
export default function MaintenanceSettlementDialog({
  open,
  onOpenChange,
  equipmentId,
  equipmentName,
  onlyBookingId,
  continueLabel,
  onContinue,
  onSettled,
}: MaintenanceSettlementDialogProps) {
  const [overview, setOverview] = useState<MaintenanceSettlementOverview | null>(null);
  const [loadError, setLoadError] = useState("");
  const [activeId, setActiveId] = useState<number | null>(null);
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settled, setSettled] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setLoadError("");
    const res = await apiClient.getMaintenanceSettlement(equipmentId);
    if (res.error || !res.data) {
      setLoadError(res.error || "Could not load the bookings on hold.");
      return;
    }
    setOverview(res.data);
  }, [equipmentId]);

  useEffect(() => {
    if (!open) return;
    setOverview(null);
    setSettled({});
    setActiveId(onlyBookingId ?? null);
    setReason("");
    setNotify(true);
    setTarget("");
    void load();
  }, [open, load, onlyBookingId]);

  useEffect(() => {
    if (overview && !target) setTarget(overview.targets[0]?.value ?? "");
  }, [overview, target]);

  const rows = (overview?.bookings ?? []).filter((r) => onlyBookingId == null || r.booking_id === onlyBookingId);
  const minLength = overview?.reason_min_length ?? 10;
  const trimmed = reason.trim();
  const chosen = overview?.targets.find((t) => t.value === target);
  const canSave = Boolean(activeId != null && chosen && trimmed.length >= minLength && !saving);
  const remaining = rows.filter((r) => !settled[r.booking_id]).length;

  const save = async () => {
    if (!canSave || activeId == null || !chosen) return;
    setSaving(true);
    const res = await apiClient.settleMaintenanceBooking(activeId, {
      status: chosen.value,
      reason: trimmed,
      notify_user: notify,
    });
    setSaving(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not settle the booking.");
      return;
    }
    toast.success(res.data.message);
    setSettled((prev) => ({ ...prev, [activeId]: chosen.label }));
    onSettled?.(activeId);
    setActiveId(null);
    setReason("");
  };

  const name = overview?.equipment_name || equipmentName || "this equipment";

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settle bookings on hold for maintenance</DialogTitle>
          <DialogDescription>
            {name}: bookings whose users have not taken a refund. Settle any the lab has already served (or that were
            not used) before marking the equipment Operational; the rest are rescheduled automatically as usual.
          </DialogDescription>
        </DialogHeader>

        <p className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          A settled booking keeps its charge and can no longer be refunded, even if the user chose to wait.
        </p>

        {loadError ? (
          <p className="flex items-start gap-2 text-sm text-red-700 dark:text-red-400" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {loadError}
          </p>
        ) : !overview ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No bookings are on hold for maintenance on this equipment.</p>
        ) : (
          <ul className="space-y-2" aria-label="Bookings on hold">
            {rows.map((row) => {
              const done = settled[row.booking_id];
              const active = activeId === row.booking_id;
              return (
                <li key={row.booking_id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{row.booking_ref}</p>
                      <p className="text-xs text-muted-foreground break-words">
                        {row.user_name} · {when(row)} · ₹{Number(row.total_charge).toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {row.waiting_for_reschedule ? "Waiting for the automatic reschedule" : "No choice made yet"}
                      </p>
                    </div>
                    {done ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" /> Settled as {done}
                      </span>
                    ) : !active ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setActiveId(row.booking_id);
                          setReason("");
                        }}
                      >
                        Settle
                      </Button>
                    ) : null}
                  </div>

                  {active && !done ? (
                    <div className="mt-3 space-y-3">
                      <RadioGroup value={target} onValueChange={setTarget} className="gap-2">
                        {overview.targets.map((t) => (
                          <label
                            key={t.value}
                            htmlFor={`settle-${row.booking_id}-${t.value}`}
                            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                              target === t.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                            }`}
                          >
                            <RadioGroupItem id={`settle-${row.booking_id}-${t.value}`} value={t.value} className="mt-0.5" />
                            <span>
                              <span className="block text-sm font-medium">{t.label}</span>
                              <span className="block text-xs text-muted-foreground">{t.help}</span>
                            </span>
                          </label>
                        ))}
                      </RadioGroup>
                      <div className="space-y-1.5">
                        <Label htmlFor={`settle-reason-${row.booking_id}`}>Reason</Label>
                        <Textarea
                          id={`settle-reason-${row.booking_id}`}
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          rows={2}
                          placeholder="e.g. Sample was analysed on the booked slot before the breakdown."
                        />
                        <p className="text-xs text-muted-foreground">
                          At least {minLength} characters. The user sees it in the email and the booking history.
                        </p>
                      </div>
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox checked={notify} onCheckedChange={(v) => setNotify(v === true)} />
                        Email the user about the new status
                      </label>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button size="sm" variant="ghost" disabled={saving} onClick={() => setActiveId(null)}>
                          Back
                        </Button>
                        <Button size="sm" disabled={!canSave} onClick={() => void save()}>
                          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                          Settle as {chosen?.label ?? "…"}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
            {onContinue ? "Not now" : "Close"}
          </Button>
          {onContinue ? (
            <Button disabled={saving || (!overview && !loadError)} onClick={onContinue}>
              {continueLabel || "Continue"}
              {overview && remaining > 0 ? ` (${remaining} left on hold)` : ""}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

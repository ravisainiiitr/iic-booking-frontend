import { useEffect, useState } from "react";
import { AlertCircle, Loader2, ShieldCheck } from "lucide-react";
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
import { apiClient, type BookingStatusOverrideOptions } from "@/lib/api";

/** Booking statuses for which the Main Administrator sees "Change status" (the server decides what is allowed). */
export const STATUS_OVERRIDE_SOURCES = new Set([
  "BOOKING_NOT_UTILIZED",
  "DISRUPTION_PENDING",
  "ABSENT",
  "OTHER_DISRUPTION",
  "UNDER_MAINTENANCE",
]);

/** Main Administrator: correct a disruption outcome recorded by mistake, with a reason the user receives by email. */
export default function BookingStatusOverrideDialog({
  bookingId,
  bookingRef,
  onChanged,
}: {
  bookingId: number;
  bookingRef: string;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<BookingStatusOverrideOptions | null>(null);
  const [loadError, setLoadError] = useState("");
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setOptions(null);
    setLoadError("");
    setTarget("");
    setReason("");
    setNotify(true);
    void apiClient.getBookingStatusOverride(bookingId).then((res) => {
      if (cancelled) return;
      if (res.error || !res.data) {
        setLoadError(res.error || "Could not load the status options.");
        return;
      }
      setOptions(res.data);
      setTarget(res.data.targets[0]?.value ?? "");
    });
    return () => {
      cancelled = true;
    };
  }, [open, bookingId]);

  const minLength = options?.reason_min_length ?? 10;
  const trimmed = reason.trim();
  const chosen = options?.targets.find((t) => t.value === target);
  const canSave = Boolean(options?.allowed && chosen && trimmed.length >= minLength && !saving);

  const save = async () => {
    if (!canSave || !chosen) return;
    setSaving(true);
    const res = await apiClient.overrideBookingStatus(bookingId, { status: chosen.value, reason: trimmed, notify_user: notify });
    setSaving(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not change the status.");
      return;
    }
    toast.success(res.data.message);
    setOpen(false);
    onChanged();
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <ShieldCheck className="h-4 w-4 mr-2" />
        Change status
      </Button>
      <Dialog open={open} onOpenChange={(o) => !saving && setOpen(o)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Change booking status</DialogTitle>
            <DialogDescription>
              {bookingRef}
              {options ? (
                <>
                  {" "}· now <span className="font-medium text-foreground">{options.current_status_label}</span>
                </>
              ) : null}
              . Main Administrator only. The change and your reason are kept in the booking history.
            </DialogDescription>
          </DialogHeader>

          {loadError ? (
            <p className="flex items-start gap-2 text-sm text-red-700" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {loadError}
            </p>
          ) : !options ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </p>
          ) : !options.allowed ? (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              {options.refusal}
            </p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>New status</Label>
                <RadioGroup value={target} onValueChange={setTarget} className="gap-2">
                  {options.targets.map((t) => (
                    <label
                      key={t.value}
                      htmlFor={`override-${t.value}`}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                        target === t.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                      }`}
                    >
                      <RadioGroupItem id={`override-${t.value}`} value={t.value} className="mt-0.5" />
                      <span>
                        <span className="block text-sm font-medium">{t.label}</span>
                        <span className="block text-xs text-muted-foreground">{t.help}</span>
                      </span>
                    </label>
                  ))}
                </RadioGroup>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="override-reason">Reason</Label>
                <Textarea
                  id="override-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="e.g. Analysis was done on the booked slot; marked Not Utilized by mistake."
                />
                <p className="text-xs text-muted-foreground">
                  {trimmed.length < minLength
                    ? `At least ${minLength} characters.`
                    : notify
                      ? "The user sees this reason in the email."
                      : "Kept in the booking history."}
                </p>
              </div>
              <label htmlFor="override-notify" className="flex cursor-pointer items-start gap-2 text-sm">
                <Checkbox id="override-notify" checked={notify} onCheckedChange={(v) => setNotify(v === true)} />
                <span>Email the user the updated status (Booking Status Updated)</span>
              </label>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            {options?.allowed ? (
              <Button onClick={save} disabled={!canSave}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {chosen ? `Change to ${chosen.label}` : "Change status"}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

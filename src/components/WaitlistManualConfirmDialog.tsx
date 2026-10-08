import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { slotSpanLabel } from "@/lib/slotTimeRange";
import { Badge } from "@/components/ui/badge";
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
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";

type SlotRow = {
  id: number;
  start_datetime: string | null;
  end_datetime: string | null;
  status: string;
  status_display: string;
  selectable: boolean;
  booked_by: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipmentId: number;
  entry: { id: number; user_name: string; user_email: string; waitlist_code?: string | null } | null;
  onConfirmed: (entryId: number) => void;
};

const STATUS_TONE: Record<string, string> = {
  AVAILABLE: "border-emerald-300 bg-emerald-50 text-emerald-800",
  BOOKED: "border-slate-300 bg-slate-100 text-slate-600",
  NOT_AVAILABLE: "border-amber-300 bg-amber-50 text-amber-800",
  UNDER_MAINTENANCE: "border-orange-300 bg-orange-50 text-orange-800",
  BLOCKED: "border-red-300 bg-red-50 text-red-800",
};

const timeLabel = (iso: string | null) => (iso ? format(new Date(iso), "HH:mm") : "--:--");

export default function WaitlistManualConfirmDialog({ open, onOpenChange, equipmentId, entry, onConfirmed }: Props) {
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [requirement, setRequirement] = useState<{ slots_requested?: number | null; duration_minutes?: number | null }>({});
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !entry || !date) return;
    let cancelled = false;
    setLoading(true);
    setSelected([]);
    apiClient
      .getWaitlistConfirmSlots(equipmentId, date, entry.id)
      .then((res) => {
        if (cancelled) return;
        if (res.error) {
          toast.error(res.error);
          setSlots([]);
          return;
        }
        setSlots(res.data?.slots ?? []);
        setRequirement(res.data?.requirement ?? {});
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, entry, date, equipmentId]);

  const selectedMinutes = useMemo(
    () =>
      slots
        .filter((s) => selected.includes(s.id) && s.start_datetime && s.end_datetime)
        .reduce(
          (sum, s) => sum + Math.round((new Date(s.end_datetime!).getTime() - new Date(s.start_datetime!).getTime()) / 60000),
          0,
        ),
    [slots, selected],
  );

  const [quotaWarning, setQuotaWarning] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    setQuotaWarning(null);
    setPreviewError(null);
    if (!open || !entry || selected.length === 0) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      apiClient.previewWaitlistManualConfirm(equipmentId, entry.id, selected).then((res) => {
        if (cancelled) return;
        if (res.error) setPreviewError(res.error);
        else setQuotaWarning(res.data?.quota_warning ?? null);
      });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, entry, selected, equipmentId]);

  const toggle = (id: number) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleConfirm = async () => {
    if (!entry || selected.length === 0) return;
    setSubmitting(true);
    try {
      const res = await apiClient.confirmWaitlistEntryManually(equipmentId, entry.id, selected);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(res.data?.message ?? "Waitlisted booking confirmed.", {
        description: res.data?.quota_warning ?? undefined,
      });
      onConfirmed(entry.id);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const requirementText = [
    requirement.slots_requested ? `${requirement.slots_requested} slot(s)` : null,
    requirement.duration_minutes ? `${requirement.duration_minutes} min` : null,
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirm waitlisted booking</DialogTitle>
          <DialogDescription>
            {entry ? `${entry.waitlist_code ? `${entry.waitlist_code} · ` : ""}${entry.user_name || entry.user_email}` : ""}
            . Any unbooked slot can be used, including weekends, holidays, closed, blocked and under-maintenance slots.
            The charge is debited from the user&apos;s wallet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="wl-confirm-date">Date</Label>
              <DateInput
                id="wl-confirm-date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-44"
              />
            </div>
            {requirementText ? (
              <p className="pb-2 text-xs text-muted-foreground">Requested: {requirementText}</p>
            ) : null}
          </div>

          <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border p-2">
            {loading ? (
              <div className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading slots…
              </div>
            ) : slots.length === 0 ? (
              <p className="p-2 text-sm text-muted-foreground">No slots configured for this date.</p>
            ) : (
              slots.map((s) => (
                <label
                  key={s.id}
                  className={`flex items-center gap-3 rounded px-2 py-1.5 text-sm ${
                    s.selectable ? "cursor-pointer hover:bg-muted/60" : "cursor-not-allowed opacity-60"
                  }`}
                >
                  <Checkbox
                    checked={selected.includes(s.id)}
                    disabled={!s.selectable}
                    onCheckedChange={() => toggle(s.id)}
                  />
                  <span className="min-w-28 font-medium tabular-nums">
                    {s.start_datetime && s.end_datetime
                      ? slotSpanLabel(s.start_datetime, s.end_datetime)
                      : `${timeLabel(s.start_datetime)} – ${timeLabel(s.end_datetime)}`}
                  </span>
                  <Badge variant="outline" className={STATUS_TONE[s.status] ?? ""}>
                    {s.status_display || s.status}
                  </Badge>
                  {s.booked_by ? <span className="truncate text-xs text-muted-foreground">{s.booked_by}</span> : null}
                </label>
              ))
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Selected: {selected.length} slot(s) • {selectedMinutes} min
          </p>
          {quotaWarning ? (
            <p
              role="alert"
              data-testid="wl-confirm-quota-warning"
              className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900"
            >
              {quotaWarning}
            </p>
          ) : null}
          {previewError ? (
            <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
              {previewError}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={submitting || selected.length === 0}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Confirm booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

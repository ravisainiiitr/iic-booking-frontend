import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  apiClient,
  type UrgentAllocationQuote,
  type UrgentAllocationResult,
  type UrgentAllocationSlot,
  type UrgentRequestRequirement,
} from "@/lib/api";
import { formatINRAmount } from "@/lib/money";
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
import { Textarea } from "@/components/ui/textarea";
import { formatRequiredTime } from "@/components/booking/UrgentTypeBRequestPanel";
import { UrgentRequirementSummary } from "@/components/urgent/UrgentRequirementSummary";

export type UrgentAllocateTarget = {
  id: number;
  user_name: string;
  user_email: string;
  equipment_name: string;
  requirement: UrgentRequestRequirement;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: UrgentAllocateTarget | null;
  onAllocated: (result: UrgentAllocationResult) => void;
};

const STATUS_TONE: Record<string, string> = {
  AVAILABLE: "border-emerald-300 bg-emerald-50 text-emerald-800",
  BOOKED: "border-slate-300 bg-slate-100 text-slate-600",
  NOT_AVAILABLE: "border-amber-300 bg-amber-50 text-amber-800",
  UNDER_MAINTENANCE: "border-orange-300 bg-orange-50 text-orange-800",
  BLOCKED: "border-red-300 bg-red-50 text-red-800",
};

const timeLabel = (iso: string | null) => (iso ? format(new Date(iso), "HH:mm") : "--:--");

/** IDs of the first ``count`` free back-to-back slots of the day (empty when there is no such run). */
export function firstBackToBackRun(slots: UrgentAllocationSlot[], count: number): number[] {
  if (count <= 0) return [];
  let run: UrgentAllocationSlot[] = [];
  for (const s of slots) {
    const prev = run[run.length - 1];
    const joins = prev && prev.end_datetime && s.start_datetime && prev.end_datetime === s.start_datetime;
    if (!s.selectable) {
      run = [];
      continue;
    }
    run = joins ? [...run, s] : [s];
    if (run.length === count) return run.map((r) => r.id);
  }
  return [];
}

/**
 * OIC: approve a Type B urgent request without slots by choosing slots on any day (weekends, holidays,
 * closed or maintenance slots included, with warnings). The amount is worked out again and the
 * requester's wallet is checked before the booking can be allocated.
 */
export default function UrgentAllocateDialog({ open, onOpenChange, request, onAllocated }: Props) {
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [slots, setSlots] = useState<UrgentAllocationSlot[]>([]);
  const [dayInfo, setDayInfo] = useState<{ is_weekend: boolean; holiday: string | null }>({ is_weekend: false, holiday: null });
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [quote, setQuote] = useState<UrgentAllocationQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const quoteSeq = useRef(0);

  const requestId = request?.id ?? null;
  const requiredSlots = request?.requirement.required_slots ?? 0;

  useEffect(() => {
    if (!open) {
      setSelected([]);
      setQuote(null);
      setQuoteError(null);
      setAdminNotes("");
    }
  }, [open]);

  useEffect(() => {
    if (!open || requestId == null || !date) return;
    let cancelled = false;
    setLoading(true);
    setSelected([]);
    apiClient
      .getUrgentAllocationSlots(requestId, date)
      .then((res) => {
        if (cancelled) return;
        if (res.error) {
          toast.error(res.error);
          setSlots([]);
          return;
        }
        setSlots(res.data?.slots ?? []);
        setDayInfo({ is_weekend: !!res.data?.is_weekend, holiday: res.data?.holiday ?? null });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, requestId, date]);

  useEffect(() => {
    if (requestId == null || selected.length === 0) {
      quoteSeq.current += 1;
      setQuoting(false);
      setQuote(null);
      setQuoteError(null);
      return;
    }
    const seq = ++quoteSeq.current;
    setQuoting(true);
    const timer = setTimeout(() => {
      apiClient.quoteUrgentAllocation(requestId, selected).then((res) => {
        if (seq !== quoteSeq.current) return;
        setQuoting(false);
        if (res.error) {
          setQuote(null);
          setQuoteError(res.error);
          return;
        }
        setQuote(res.data ?? null);
        setQuoteError(null);
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [requestId, selected]);

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

  const quoteMatchesSelection =
    !!quote && quote.slot_ids.length === selected.length && quote.slot_ids.every((id) => selected.includes(id));
  const canAllocate = quoteMatchesSelection && !!quote?.can_allocate && !quoting && !submitting;

  const toggle = (id: number) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const autoSelect = () => {
    const ids = firstBackToBackRun(slots, requiredSlots || 1);
    if (ids.length === 0) {
      toast.error(`No ${requiredSlots || 1} free back-to-back slot(s) on this date.`);
      return;
    }
    setSelected(ids);
  };

  const handleAllocate = async () => {
    if (!request || !quote || !canAllocate) return;
    setSubmitting(true);
    try {
      const res = await apiClient.allocateUrgentRequest(request.id, {
        slot_ids: selected,
        expected_total: quote.total_charge,
        admin_notes: adminNotes.trim() || undefined,
      });
      if (res.error) {
        if (res.quote) setQuote(res.quote);
        toast.error(res.error);
        return;
      }
      if (res.data) {
        toast.success(res.data.message);
        onAllocated(res.data);
      }
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const wallet = quote?.wallet;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Approve &amp; allocate</DialogTitle>
          <DialogDescription>
            {request ? `${request.user_name || request.user_email} · ${request.equipment_name}. ` : ""}
            Choose slots on any day, including weekends, holidays, closed, blocked and under-maintenance slots. The
            booking is confirmed, the wallet is charged and the user and the supervisor get the booking confirmation.
          </DialogDescription>
        </DialogHeader>

        {request ? <UrgentRequirementSummary requirement={request.requirement} /> : null}

        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="urgent-alloc-date">Date</Label>
              <DateInput id="urgent-alloc-date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
            </div>
            <Button type="button" variant="outline" size="sm" onClick={autoSelect} disabled={loading || slots.length === 0}>
              Select {requiredSlots || 1} back-to-back slot{requiredSlots === 1 ? "" : "s"}
            </Button>
            {dayInfo.is_weekend || dayInfo.holiday ? (
              <Badge variant="outline" className="mb-1 border-amber-400 bg-amber-50 text-amber-900">
                {[dayInfo.is_weekend ? "Weekend" : null, dayInfo.holiday != null ? `Holiday${dayInfo.holiday ? `: ${dayInfo.holiday}` : ""}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </Badge>
            ) : null}
          </div>

          <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2" data-testid="urgent-alloc-slots">
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
                    aria-label={`Slot ${timeLabel(s.start_datetime)} to ${timeLabel(s.end_datetime)}`}
                  />
                  <span className="w-28 font-medium tabular-nums">
                    {timeLabel(s.start_datetime)} – {timeLabel(s.end_datetime)}
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
            Selected: {selected.length} slot(s) · {formatRequiredTime(selectedMinutes)}
            {request?.requirement.required_minutes ? ` · required ${formatRequiredTime(request.requirement.required_minutes)}` : ""}
          </p>

          {quoting ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking amount and wallet…
            </p>
          ) : quoteError ? (
            <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-800">
              {quoteError}
            </p>
          ) : quote ? (
            <div className="space-y-2 rounded-md border p-3 text-sm" data-testid="urgent-alloc-quote">
              <div className="flex justify-between font-semibold">
                <span>Amount to charge</span>
                <span>{formatINRAmount(quote.total_charge)}</span>
              </div>
              {quote.charge_breakdown.length > 0 && (
                <ul className="space-y-0.5 text-xs text-muted-foreground">
                  {quote.charge_breakdown.map((item, i) => (
                    <li key={i} className="flex justify-between gap-4">
                      <span className="min-w-0 whitespace-pre-line">{item.description}</span>
                      <span className="shrink-0 tabular-nums">{formatINRAmount(item.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {quote.amount_changed && quote.submitted_estimate != null ? (
                <p className="text-xs text-amber-800">
                  The user saw {formatINRAmount(quote.submitted_estimate)} when submitting; rates have changed since.
                </p>
              ) : null}
              {wallet ? (
                <p className="text-xs">
                  Wallet available: <span className="font-medium">{formatINRAmount(wallet.available)}</span>
                </p>
              ) : null}
              {!quote.covers_required_time ? (
                <p role="alert" className="flex items-start gap-2 text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  The chosen slots ({formatRequiredTime(quote.slot_minutes)}) do not cover the required time (
                  {formatRequiredTime(quote.required_minutes)}). Select more slots.
                </p>
              ) : null}
              {wallet && !wallet.sufficient ? (
                <p role="alert" className="flex items-start gap-2 text-red-700" data-testid="urgent-alloc-shortfall">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {wallet.message || "Insufficient wallet balance."}
                  {Number(wallet.shortfall) > 0 ? ` Shortfall: ${formatINRAmount(wallet.shortfall)}.` : ""} The booking
                  cannot be allocated until the wallet is recharged.
                </p>
              ) : null}
              {quote.warnings.map((w, i) => (
                <p key={i} className="flex items-start gap-2 text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {w}
                </p>
              ))}
            </div>
          ) : null}

          <div className="space-y-1">
            <Label htmlFor="urgent-alloc-notes">Note for the user (optional)</Label>
            <Textarea
              id="urgent-alloc-notes"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Allocated on Saturday morning; operator will be available."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleAllocate} disabled={!canAllocate}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Allocate booking
            {quoteMatchesSelection && quote ? ` (${formatINRAmount(quote.total_charge)})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

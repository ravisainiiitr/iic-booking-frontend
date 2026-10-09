import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, addWeeks, format, getMonth, getYear, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { AlertTriangle, CalendarDays, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import {
  apiClient,
  type UrgentAllocationQuote,
  type UrgentAllocationResult,
  type UrgentAllocationSlot,
  type UrgentRequestRequirement,
} from "@/lib/api";
import { formatINRAmount } from "@/lib/money";
import { resolveSlotCell, slotCalendarLegend, slotCalendarPalette } from "@/lib/slotCalendarDisplay";
import { slotSpanLabel } from "@/lib/slotTimeRange";
import {
  SLOT_CELL_CLASS,
  SLOT_CELL_SELECTED_CLASS,
  SLOT_DAY_HEADER_CLASS,
  SlotCalendarLegend,
  SlotDayHeader,
  SlotWeekGrid,
  SlotWeekNav,
  slotCellStyle,
} from "@/components/slot-calendar/SlotWeekGrid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatRequiredTime } from "@/components/booking/UrgentTypeBRequestPanel";
import { UrgentRequirementSummary } from "@/components/urgent/UrgentRequirementSummary";
import { cn } from "@/lib/utils";

export type UrgentAllocateTarget = {
  id: number;
  user_name: string;
  user_email: string;
  equipment_name: string;
  requirement: UrgentRequestRequirement;
  /** e.g. "3 samples", shown in the header. */
  samples?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: UrgentAllocateTarget | null;
  onAllocated: (result: UrgentAllocationResult) => void;
};

const MONTHS = Array.from({ length: 12 }, (_, i) => format(new Date(2000, i, 1), "MMMM"));

const ymd = (d: Date) => format(d, "yyyy-MM-dd");
const mondayOf = (d: Date) => startOfWeek(d, { weekStartsOn: 1 });
const slotDay = (s: UrgentAllocationSlot) => s.date ?? (s.start_datetime ? ymd(parseISO(s.start_datetime)) : "");
const slotTimeKey = (s: UrgentAllocationSlot) => (s.start_datetime ? format(parseISO(s.start_datetime), "HH:mm") : "");
const slotRange = (s: UrgentAllocationSlot) =>
  s.start_datetime && s.end_datetime
    ? slotSpanLabel(s.start_datetime, s.end_datetime)
    : `${s.start_datetime ? format(parseISO(s.start_datetime), "HH:mm") : "--:--"} – --:--`;
const slotMinutes = (s: UrgentAllocationSlot) =>
  s.start_datetime && s.end_datetime
    ? Math.round((parseISO(s.end_datetime).getTime() - parseISO(s.start_datetime).getTime()) / 60000)
    : 0;
const byStart = (a: UrgentAllocationSlot, b: UrgentAllocationSlot) =>
  String(a.start_datetime ?? "").localeCompare(String(b.start_datetime ?? ""));

/** IDs of the first ``count`` free back-to-back slots (empty when there is no such run). */
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

/** Why a chosen slot is outside normal booking (weekend, holiday, closed/maintenance status); empty when it is a normal slot. */
export function slotOverrideReasons(slot: UrgentAllocationSlot, holidays: Record<string, string>): string[] {
  const reasons: string[] = [];
  const day = slotDay(slot);
  if (day) {
    const dow = parseISO(day).getDay();
    if (dow === 0 || dow === 6) reasons.push("Weekend");
    if (day in holidays) reasons.push(holidays[day] ? `Holiday: ${holidays[day]}` : "Holiday");
  }
  if (slot.status !== "AVAILABLE") reasons.push(slot.status_display || slot.status);
  return reasons;
}

/**
 * OIC: approve a Type B urgent request without slots by choosing slots in a weekly calendar. Any day can be used
 * (weekends, holidays, closed, maintenance and weeks not yet open to users) — only slots booked by someone else and
 * past slots are off limits. The amount is worked out again and the requester's wallet is checked before booking.
 */
export default function UrgentAllocateDialog({ open, onOpenChange, request, onAllocated }: Props) {
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [weekSlots, setWeekSlots] = useState<UrgentAllocationSlot[]>([]);
  const [holidays, setHolidays] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<Record<number, UrgentAllocationSlot>>({});
  const [quote, setQuote] = useState<UrgentAllocationQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const quoteSeq = useRef(0);

  const requestId = request?.id ?? null;
  const requiredSlots = request?.requirement.required_slots ?? 0;
  const requiredMinutes = request?.requirement.required_minutes ?? 0;
  const palette = useMemo(() => slotCalendarPalette(), []);

  useEffect(() => {
    if (!open) {
      setPicked({});
      setQuote(null);
      setQuoteError(null);
      setAdminNotes("");
      setWeekStart(mondayOf(new Date()));
    }
  }, [open]);

  useEffect(() => {
    if (!open || requestId == null) return;
    let cancelled = false;
    setLoading(true);
    apiClient
      .getUrgentAllocationSlots(requestId, { start_date: ymd(weekStart), end_date: ymd(addDays(weekStart, 6)) })
      .then((res) => {
        if (cancelled) return;
        if (res.error) {
          toast.error(res.error);
          setWeekSlots([]);
          return;
        }
        setWeekSlots([...(res.data?.slots ?? [])].sort(byStart));
        setHolidays(res.data?.holidays ?? {});
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, requestId, weekStart]);

  const selectedSlots = useMemo(() => Object.values(picked).sort(byStart), [picked]);
  const selectedIds = useMemo(() => selectedSlots.map((s) => s.id), [selectedSlots]);
  const selectedKey = selectedIds.join(",");

  useEffect(() => {
    if (requestId == null || selectedIds.length === 0) {
      quoteSeq.current += 1;
      setQuoting(false);
      setQuote(null);
      setQuoteError(null);
      return;
    }
    const seq = ++quoteSeq.current;
    setQuoting(true);
    const timer = setTimeout(() => {
      apiClient.quoteUrgentAllocation(requestId, selectedIds).then((res) => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId, selectedKey]);

  const selectedMinutes = selectedSlots.reduce((sum, s) => sum + slotMinutes(s), 0);
  const covered = requiredMinutes > 0 && selectedMinutes >= requiredMinutes;
  const coverage = requiredMinutes > 0 ? Math.min(100, Math.round((selectedMinutes / requiredMinutes) * 100)) : 0;

  const quoteMatchesSelection =
    !!quote && quote.slot_ids.length === selectedIds.length && quote.slot_ids.every((id) => selectedIds.includes(id));
  const canAllocate = quoteMatchesSelection && !!quote?.can_allocate && !quoting && !submitting;

  const toggle = (slot: UrgentAllocationSlot) =>
    setPicked((prev) => {
      const next = { ...prev };
      if (next[slot.id]) delete next[slot.id];
      else next[slot.id] = slot;
      return next;
    });

  const autoSelect = () => {
    const ids = firstBackToBackRun(weekSlots, requiredSlots || 1);
    if (ids.length === 0) {
      toast.error(`No ${requiredSlots || 1} free back-to-back slot(s) in this week.`);
      return;
    }
    setPicked(Object.fromEntries(weekSlots.filter((s) => ids.includes(s.id)).map((s) => [s.id, s])));
  };

  const handleAllocate = async () => {
    if (!request || !quote || !canAllocate) return;
    setSubmitting(true);
    try {
      const res = await apiClient.allocateUrgentRequest(request.id, {
        slot_ids: selectedIds,
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

  const slotAt = useMemo(() => {
    const map = new Map<string, UrgentAllocationSlot>();
    for (const s of weekSlots) map.set(`${slotDay(s)}|${slotTimeKey(s)}`, s);
    return map;
  }, [weekSlots]);

  const rows = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of weekSlots) {
      const key = slotTimeKey(s);
      if (key && !seen.has(key)) seen.set(key, slotRange(s));
    }
    return [...seen.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, label]) => ({ key, label }));
  }, [weekSlots]);

  const overrides = selectedSlots
    .map((s) => ({ slot: s, reasons: slotOverrideReasons(s, holidays) }))
    .filter((o) => o.reasons.length > 0);

  const thisYear = getYear(new Date());
  const yearOptions = Array.from(new Set([thisYear - 1, thisYear, thisYear + 1, thisYear + 2, getYear(weekStart)])).sort();
  const jumpTo = (year: number, month: number) => setWeekStart(mondayOf(startOfMonth(new Date(year, month, 1))));
  const wallet = quote?.wallet;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[94dvh] max-w-6xl flex-col gap-0 overflow-hidden p-0" data-testid="urgent-allocate-dialog">
        <DialogHeader className="space-y-1 border-b px-5 pb-3 pt-5 pr-12 text-left sm:px-6">
          <DialogTitle>Approve &amp; allocate</DialogTitle>
          <DialogDescription className="text-left">
            {request ? `${request.user_name || request.user_email} · ${request.equipment_name}${request.samples ? ` · ${request.samples}` : ""}. ` : ""}
            Choose slots on any day — weekends, holidays, closed, Not Available, maintenance and weeks not yet open are all
            allowed. Only slots booked by someone else and past slots cannot be used. The booking is confirmed, the wallet is
            charged and the user, the supervisor and the lab operator are emailed.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden />
                <Select value={String(getYear(weekStart))} onValueChange={(v) => jumpTo(Number(v), getMonth(weekStart))}>
                  <SelectTrigger className="h-8 w-[6.5rem]" aria-label="Year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(getMonth(weekStart))} onValueChange={(v) => jumpTo(getYear(weekStart), Number(v))}>
                  <SelectTrigger className="h-8 w-[8.5rem]" aria-label="Month">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={m} value={String(i)}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => setWeekStart(mondayOf(new Date()))}>
                  This week
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="ml-auto h-8"
                  onClick={autoSelect}
                  disabled={loading || weekSlots.length === 0}
                >
                  Select {requiredSlots || 1} back-to-back slot{requiredSlots === 1 ? "" : "s"}
                </Button>
              </div>

              <SlotWeekNav
                weekStart={weekStart}
                onPrevious={() => setWeekStart((w) => addWeeks(w, -1))}
                onNext={() => setWeekStart((w) => addWeeks(w, 1))}
                subtitle="Click slots to select or clear them · any week can be opened"
              />

              <div data-testid="urgent-alloc-calendar" className="rounded-lg border p-2">
                {loading ? (
                  <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading slots…
                  </div>
                ) : rows.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">No slots configured for this week.</p>
                ) : (
                  <SlotWeekGrid
                    weekStart={weekStart}
                    rows={rows}
                    singleDayOnMobile
                    renderDayHeader={(day) => {
                      const iso = ymd(day);
                      const dow = day.getDay();
                      const note = iso in holidays ? holidays[iso] || "Holiday" : dow === 0 || dow === 6 ? "Weekend" : "";
                      return (
                        <div className={SLOT_DAY_HEADER_CLASS}>
                          <SlotDayHeader day={day} />
                          {note ? (
                            <div className="truncate text-[11px] font-medium text-amber-700 dark:text-amber-300" title={note}>
                              {note}
                            </div>
                          ) : null}
                        </div>
                      );
                    }}
                    renderCell={(day, timeKey) => {
                      const iso = ymd(day);
                      const slot = slotAt.get(`${iso}|${timeKey}`);
                      const display = resolveSlotCell({ slot: slot ?? null, day, holiday: holidays[iso], palette, staffView: true });
                      if (!slot) {
                        return (
                          <div className={cn(SLOT_CELL_CLASS, "opacity-60")} style={slotCellStyle(display)} aria-hidden>
                            {display.label}
                          </div>
                        );
                      }
                      const isSel = !!picked[slot.id];
                      const blockedWhy = slot.selectable ? "" : slot.past ? "Past slot" : slot.booked_by ? "Booked by someone else" : "Not selectable";
                      const reasons = slotOverrideReasons(slot, holidays);
                      const title = [
                        `${format(day, "EEE d MMM")} ${slotRange(slot)}`,
                        `Status: ${slot.status_display || slot.status}`,
                        ...(blockedWhy ? [blockedWhy] : reasons.length ? [`Will be booked anyway (${reasons.join(", ")})`] : []),
                      ].join("\n");
                      return (
                        <button
                          type="button"
                          disabled={!slot.selectable}
                          aria-pressed={isSel}
                          aria-label={`${format(day, "EEEE d MMMM")} ${slotRange(slot)}, ${slot.status_display || slot.status}${blockedWhy ? `, ${blockedWhy.toLowerCase()}` : ""}`}
                          title={title}
                          data-slot-id={slot.id}
                          onClick={() => toggle(slot)}
                          className={cn(
                            SLOT_CELL_CLASS,
                            "transition",
                            isSel && SLOT_CELL_SELECTED_CLASS,
                            slot.selectable ? "cursor-pointer hover:brightness-95" : "cursor-not-allowed opacity-45",
                            slot.selectable && !isSel && reasons.length > 0 && "outline outline-1 outline-dashed outline-amber-600/70",
                          )}
                          style={isSel ? undefined : slotCellStyle(display)}
                        >
                          {isSel ? "Selected" : display.label}
                        </button>
                      );
                    }}
                  />
                )}
                <SlotCalendarLegend
                  items={slotCalendarLegend(palette)}
                  className="mt-3"
                  trailing={
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-sm bg-primary" aria-hidden /> Selected
                    </span>
                  }
                />
              </div>
            </div>

            <aside className="min-w-0 space-y-3">
              {request ? <UrgentRequirementSummary requirement={request.requirement} /> : null}

              <section className="space-y-2 rounded-md border p-3 text-sm" data-testid="urgent-alloc-running-total">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">Selected</span>
                  <span className="tabular-nums">
                    {selectedIds.length} slot{selectedIds.length === 1 ? "" : "s"} · {formatRequiredTime(selectedMinutes)}
                    {requiredMinutes ? ` of ${formatRequiredTime(requiredMinutes)}` : ""}
                  </span>
                </div>
                {requiredMinutes ? (
                  <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={coverage} aria-label="Required time covered">
                    <div className={cn("h-full transition-all", covered ? "bg-emerald-500" : "bg-amber-500")} style={{ width: `${coverage}%` }} />
                  </div>
                ) : null}
                {selectedSlots.length > 0 ? (
                  <ul className="max-h-36 space-y-1 overflow-y-auto">
                    {selectedSlots.map((s) => (
                      <li key={s.id} className="flex items-center justify-between gap-2 rounded bg-muted/50 px-2 py-1 text-xs">
                        <span className="tabular-nums">
                          {slotDay(s) ? format(parseISO(slotDay(s)), "EEE d MMM") : ""} · {slotRange(s)}
                        </span>
                        <button type="button" className="text-muted-foreground hover:text-foreground" aria-label={`Remove ${slotRange(s)}`} onClick={() => toggle(s)}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">Click slots in the calendar. Selections are kept when you change week.</p>
                )}
                {overrides.length > 0 ? (
                  <div role="status" className="space-y-1 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200" data-testid="urgent-alloc-override-warning">
                    <p className="flex items-start gap-1.5 font-medium">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {overrides.length} selected slot{overrides.length === 1 ? " is" : "s are"} outside normal booking and will be booked anyway:
                    </p>
                    <ul className="ml-5 list-disc">
                      {overrides.map(({ slot, reasons }) => (
                        <li key={slot.id}>
                          {slotDay(slot) ? format(parseISO(slotDay(slot)), "EEE d MMM") : ""} {slotRange(slot)} — {reasons.join(", ")}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>

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
                    <p className="flex items-center justify-between text-xs">
                      <span>Wallet available</span>
                      <span className="font-medium">{formatINRAmount(wallet.available)}</span>
                    </p>
                  ) : null}
                  {wallet?.sufficient ? (
                    <Badge variant="outline" className="border-emerald-400 bg-emerald-50 text-emerald-800">
                      Wallet can pay
                    </Badge>
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
                    <p key={i} className="flex items-start gap-2 text-xs text-amber-800">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
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
            </aside>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t bg-muted/30 px-5 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleAllocate} disabled={!canAllocate}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Allocate booking
            {quoteMatchesSelection && quote ? ` (${formatINRAmount(quote.total_charge)})` : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

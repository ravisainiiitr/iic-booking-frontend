import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AlertTriangle, CalendarClock, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MAX_PREFERRED_SLOT_COUNT, WEEKDAY_NAMES } from "@/lib/templatePreferredSlot";
import {
  PREFERRED_SLOT_WEEKDAYS,
  consecutiveRun,
  describeWeeklySelection,
  formatDurationMinutes,
  minutesToKey,
  rowIndexForStart,
  runProblemMessage,
  type WeeklySlotRow,
} from "@/lib/weeklySlotTemplate";

export interface WeeklySlotSelection {
  weekday: number;
  startTime: string;
  slotCount: number;
}

/** "pick" = the user chose a start cell; "resize" = same start, slot count follows the sample details; "clear" = removed. */
export type WeeklySlotChangeReason = "pick" | "resize" | "clear";

const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const clampCount = (n: number) => Math.min(MAX_PREFERRED_SLOT_COUNT, Math.max(1, Math.round(n) || 1));

/**
 * Weekly (Mon–Fri, no dates) slot calendar for a template's preferred slot. Rows are the equipment's
 * slot timings; clicking a cell selects `slotsRequired` back-to-back slots from there on that weekday.
 * Shows no availability: it is a weekly preference that is matched to real slots when the template is loaded.
 */
export function WeeklyPreferredSlotPicker({
  rows,
  hideTimes = false,
  slotsRequired,
  slotsRequiredPending = false,
  slotDurationMinutes,
  requiredBasis = "based on your sample details",
  value,
  onChange,
}: {
  rows: WeeklySlotRow[];
  hideTimes?: boolean;
  /** Slots the sample details need (same rule as the booking page); null while unknown. */
  slotsRequired: number | null;
  slotsRequiredPending?: boolean;
  slotDurationMinutes?: number | null;
  requiredBasis?: string;
  value: WeeklySlotSelection | null;
  onChange: (next: WeeklySlotSelection | null, reason: WeeklySlotChangeReason) => void;
}) {
  const count = clampCount(slotsRequired ?? value?.slotCount ?? 1);
  const [message, setMessage] = useState<{ tone: "info" | "warn"; text: string } | null>(null);
  const [hover, setHover] = useState<{ day: number; row: number } | null>(null);
  const [focusCell, setFocusCell] = useState<{ day: number; row: number } | null>(null);
  const cellRefs = useRef(new Map<string, HTMLButtonElement>());

  const startIndex = value ? rowIndexForStart(rows, value.startTime) : -1;
  const weekdayOk = value != null && (PREFERRED_SLOT_WEEKDAYS as readonly number[]).includes(value.weekday);
  const aligned = value != null && startIndex >= 0 && weekdayOk;
  const selectedRun = useMemo(() => {
    if (!aligned) return null;
    const check = consecutiveRun(rows, startIndex, count);
    return check.ok ? check : null;
  }, [aligned, rows, startIndex, count]);
  // While the required count is known, a run that stops fitting is cleared by the effect below instead.
  const misaligned = value != null && rows.length > 0 && (!aligned || (slotsRequired == null && !selectedRun));

  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Keep the saved slot count equal to what the sample details need; drop the selection if it no longer fits.
  useEffect(() => {
    const current = valueRef.current;
    if (slotsRequired == null || !current || rows.length === 0) return;
    const idx = rowIndexForStart(rows, current.startTime);
    if (idx < 0 || !(PREFERRED_SLOT_WEEKDAYS as readonly number[]).includes(current.weekday)) return;
    const n = clampCount(slotsRequired);
    if (current.slotCount === n) return;
    const check = consecutiveRun(rows, idx, n);
    const where = `${WEEKDAY_NAMES[current.weekday]} ${hideTimes ? rows[idx].label : rows[idx].key}`;
    if (check.ok) {
      onChangeRef.current({ ...current, slotCount: n }, "resize");
      setMessage({ tone: "info", text: `Your sample details need ${n} slot${n === 1 ? "" : "s"}, so the selection from ${where} was updated.` });
    } else {
      onChangeRef.current(null, "clear");
      setMessage({
        tone: "warn",
        text: `Your sample details now need ${n} slot${n === 1 ? "" : "s"}, which do not fit from ${where}. Choose a new start.`,
      });
    }
  }, [slotsRequired, rows, hideTimes]);

  const days = PREFERRED_SLOT_WEEKDAYS;
  const activeCell =
    focusCell ?? (aligned ? { day: days.indexOf(value!.weekday as (typeof days)[number]), row: startIndex } : { day: 0, row: 0 });

  const pick = (dayIdx: number, rowIdx: number) => {
    const weekday = days[dayIdx];
    const check = consecutiveRun(rows, rowIdx, count);
    if (!check.ok) {
      setMessage({ tone: "warn", text: runProblemMessage(check, count, hideTimes) ?? "Choose another start." });
      return;
    }
    setMessage(null);
    onChange({ weekday, startTime: rows[rowIdx].key, slotCount: count }, "pick");
  };

  const focusAt = (day: number, row: number) => {
    const d = Math.max(0, Math.min(days.length - 1, day));
    const r = Math.max(0, Math.min(rows.length - 1, row));
    setFocusCell({ day: d, row: r });
    cellRefs.current.get(`${d}:${r}`)?.focus();
  };

  const onGridKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const { day, row } = activeCell;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [day - 1, row],
      ArrowRight: [day + 1, row],
      ArrowUp: [day, row - 1],
      ArrowDown: [day, row + 1],
      Home: [0, row],
      End: [days.length - 1, row],
    };
    const to = moves[e.key];
    if (!to) return;
    e.preventDefault();
    focusAt(to[0], to[1]);
  };

  const preview = useMemo(() => {
    if (!hover) return null;
    const check = consecutiveRun(rows, hover.row, count);
    return { ...hover, ok: check.ok, end: check.ok ? hover.row + count - 1 : hover.row };
  }, [hover, rows, count]);

  const durationMinutes = selectedRun?.minutes ?? count * (Number(slotDurationMinutes) || 60);
  const gridColumns = { gridTemplateColumns: `minmax(104px, auto) repeat(${days.length}, minmax(84px, 1fr))` };

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border px-3 py-2 text-sm",
          slotsRequired != null
            ? "border-primary/30 bg-primary/5 text-foreground dark:bg-primary/10"
            : "border-border bg-background/60 text-muted-foreground"
        )}
        aria-live="polite"
      >
        <CalendarClock className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        {slotsRequiredPending && slotsRequired == null ? (
          <span className="inline-flex items-center gap-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Calculating slots required…
          </span>
        ) : slotsRequired != null ? (
          <span>
            <strong>Slots required: {count}</strong> ({formatDurationMinutes(durationMinutes)}) — {requiredBasis}
          </span>
        ) : (
          <span>
            Complete the sample details to calculate the slots required. Using{" "}
            <strong className="text-foreground">
              {count} slot{count === 1 ? "" : "s"}
            </strong>{" "}
            for now.
          </span>
        )}
      </div>

      {misaligned && (
        <div className="flex gap-2 rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-50">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            Your saved preferred slot ({WEEKDAY_NAMES[value!.weekday] ?? "?"} {value!.startTime}, {value!.slotCount} slot
            {value!.slotCount === 1 ? "" : "s"}){" "}
            {weekdayOk ? "does not match this equipment's current slot timings" : "is not on a bookable weekday"}. Choose a
            new start in the calendar.
          </p>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
          This equipment has no slot timings set up yet, so a preferred slot cannot be chosen.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border/70 bg-card p-2 sm:p-3">
          <div
            role="grid"
            aria-label={`Preferred weekly slot. Choose a start; ${count} back-to-back slot${count === 1 ? "" : "s"} are selected.`}
            className="min-w-[540px]"
            onKeyDown={onGridKeyDown}
            onMouseLeave={() => setHover(null)}
          >
            <div role="row" className="grid gap-2 mb-2" style={gridColumns}>
              <div role="columnheader" className="sticky left-0 z-10 bg-card p-2 text-sm font-semibold">
                {hideTimes ? "Slot position" : "Time"}
              </div>
              {days.map((d) => (
                <div key={d} role="columnheader" aria-label={WEEKDAY_NAMES[d]} className="p-2 text-center text-sm font-semibold">
                  <span className="lg:hidden">{WEEKDAY_SHORT[d]}</span>
                  <span className="hidden lg:inline">{WEEKDAY_NAMES[d]}</span>
                </div>
              ))}
            </div>
            {rows.map((row, rowIdx) => {
              const breakBefore = rowIdx > 0 && rows[rowIdx - 1].end !== row.start;
              return (
                <div key={row.key} role="row" className={cn("grid gap-2 mb-2", breakBefore && "mt-4")} style={gridColumns}>
                  <div
                    role="rowheader"
                    className="sticky left-0 z-10 flex items-center bg-card p-2 text-sm font-medium tabular-nums"
                    title={hideTimes ? undefined : row.timeRange}
                  >
                    {row.label}
                  </div>
                  {days.map((weekday, dayIdx) => {
                    const inRun =
                      selectedRun != null && value!.weekday === weekday && rowIdx >= startIndex && rowIdx < startIndex + count;
                    const isStart = inRun && rowIdx === startIndex;
                    const check = consecutiveRun(rows, rowIdx, count);
                    const startable = check.ok;
                    const inPreview =
                      !inRun &&
                      preview != null &&
                      preview.ok &&
                      preview.day === dayIdx &&
                      rowIdx >= preview.row &&
                      rowIdx <= preview.end;
                    const isActive = activeCell.day === dayIdx && activeCell.row === rowIdx;
                    const runEnd = check.ok ? check.rows[check.rows.length - 1] : null;
                    const label = `${WEEKDAY_NAMES[weekday]} ${hideTimes ? row.label : row.timeRange}. ${
                      inRun
                        ? isStart
                          ? "Selected start."
                          : "Selected."
                        : startable
                          ? count > 1
                            ? `Start ${count} slots here${hideTimes || !runEnd ? "" : `, until ${minutesToKey(runEnd.end)}`}.`
                            : "Choose this slot."
                          : runProblemMessage(check, count, hideTimes)
                    }`;
                    return (
                      <div key={weekday} role="gridcell" aria-selected={inRun}>
                        <button
                          ref={(el) => {
                            const k = `${dayIdx}:${rowIdx}`;
                            if (el) cellRefs.current.set(k, el);
                            else cellRefs.current.delete(k);
                          }}
                          type="button"
                          tabIndex={isActive ? 0 : -1}
                          aria-label={label}
                          aria-disabled={!startable && !inRun}
                          onFocus={() => setFocusCell({ day: dayIdx, row: rowIdx })}
                          onMouseEnter={() => setHover({ day: dayIdx, row: rowIdx })}
                          onClick={() => pick(dayIdx, rowIdx)}
                          className={cn(
                            "w-full min-h-[44px] rounded-md border-2 p-2 text-sm font-medium shadow-sm transition-all",
                            "flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                            inRun && "border-white/50 bg-primary text-primary-foreground dark:border-primary/40",
                            !inRun && inPreview && "border-primary/60 bg-primary/15 text-primary dark:bg-primary/25",
                            !inRun && !inPreview && startable &&
                              "border-border/70 bg-background text-muted-foreground hover:border-primary/60 hover:bg-primary/10",
                            !inRun && !startable && "cursor-not-allowed border-dashed border-border/60 bg-muted/60 text-muted-foreground/60"
                          )}
                        >
                          {inRun ? (
                            isStart ? "Selected" : "✓"
                          ) : inPreview && preview?.row === rowIdx ? (
                            <span className="text-xs">Start here</span>
                          ) : !startable ? (
                            <span aria-hidden>—</span>
                          ) : null}
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {message && (
        <p
          role="status"
          className={cn(
            "rounded-md px-3 py-2 text-sm",
            message.tone === "warn"
              ? "bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-50"
              : "bg-muted text-foreground"
          )}
        >
          {message.text}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-foreground" aria-live="polite">
          {selectedRun ? (
            <strong>{describeWeeklySelection(value!.weekday, selectedRun.rows, hideTimes)}</strong>
          ) : (
            <span className="text-muted-foreground">
              No slot chosen yet. Click a start in the calendar; {count} back-to-back slot{count === 1 ? " is" : "s are"}{" "}
              selected.
            </span>
          )}
        </p>
        {value && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => {
              setMessage(null);
              onChange(null, "clear");
            }}
          >
            <X className="h-3.5 w-3.5" aria-hidden /> Clear
          </Button>
        )}
      </div>
    </div>
  );
}

export default WeeklyPreferredSlotPicker;

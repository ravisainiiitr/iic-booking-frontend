import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { CalendarClock, Check, Info, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { MAX_PREFERRED_SLOT_COUNT, WEEKDAY_NAMES } from "@/lib/templatePreferredSlot";
import {
  DEFAULT_AVAILABLE_SLOT_COLOR,
  PREFERRED_SLOT_WEEKDAYS,
  consecutiveRun,
  describeWeeklySelection,
  formatDurationMinutes,
  minutesToKey,
  readableTextOn,
  rowIndexForStart,
  runProblemMessage,
  slotsExceedDay,
  slotsExceedDayMessage,
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

const compactRange = (row: WeeklySlotRow) => `${minutesToKey(row.start)}–${minutesToKey(row.end)}`;

/**
 * Weekly (Mon–Fri, no dates) slot calendar for a template's preferred slot, styled like the booking page's
 * weekly grid. Rows are the equipment's slot timings; clicking a cell selects `slotsRequired` consecutive
 * slots from there on that weekday (the next rows of the day, as on the booking page). It shows no live
 * availability: the weekly preference is matched to real slots when the template is loaded.
 */
export function WeeklyPreferredSlotPicker({
  rows,
  hideTimes = false,
  slotsRequired,
  slotsRequiredPending = false,
  slotDurationMinutes,
  requiredBasis = "based on your sample details",
  availableColor,
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
  /** The equipment's "Available" calendar colour (booking page grid); green by default. */
  availableColor?: string | null;
  value: WeeklySlotSelection | null;
  onChange: (next: WeeklySlotSelection | null, reason: WeeklySlotChangeReason) => void;
}) {
  const count = clampCount(slotsRequired ?? value?.slotCount ?? 1);
  const tooManySlots = slotsExceedDay(rows, slotsRequired);
  const [hint, setHint] = useState<string | null>(null);
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
    if (consecutiveRun(rows, idx, n).ok) {
      onChangeRef.current({ ...current, slotCount: n }, "resize");
      setHint(null);
      return;
    }
    onChangeRef.current(null, "clear");
    setHint(
      slotsExceedDay(rows, n)
        ? null
        : `Your sample details now need ${n} slots, which don't fit from ${WEEKDAY_NAMES[current.weekday]} ${
            hideTimes ? rows[idx].label : rows[idx].key
          }. Pick a new start.`
    );
  }, [slotsRequired, rows, hideTimes]);

  const days = PREFERRED_SLOT_WEEKDAYS;
  const activeCell =
    focusCell ?? (aligned ? { day: days.indexOf(value!.weekday as (typeof days)[number]), row: startIndex } : { day: 0, row: 0 });

  const greenBg = availableColor || DEFAULT_AVAILABLE_SLOT_COLOR;
  const availableStyle: CSSProperties = { backgroundColor: greenBg, color: readableTextOn(greenBg) };

  const isInSelectedRun = (weekday: number, rowIdx: number) =>
    selectedRun != null && value!.weekday === weekday && rowIdx >= startIndex && rowIdx < startIndex + count;

  const pick = (dayIdx: number, rowIdx: number) => {
    const weekday = days[dayIdx];
    if (isInSelectedRun(weekday, rowIdx)) {
      setHint(null);
      onChange(null, "clear");
      return;
    }
    const check = consecutiveRun(rows, rowIdx, count);
    if (!check.ok) {
      setHint(runProblemMessage(check, count));
      return;
    }
    setHint(null);
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
    if (!hover || !consecutiveRun(rows, hover.row, count).ok) return null;
    return { day: hover.day, from: hover.row, to: hover.row + count - 1 };
  }, [hover, rows, count]);

  const durationMinutes = selectedRun?.minutes ?? count * (Number(slotDurationMinutes) || 60);
  const gridColumns = { gridTemplateColumns: `minmax(92px, auto) repeat(${days.length}, minmax(76px, 1fr))` };

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" aria-live="polite">
        <CalendarClock className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        {slotsRequiredPending && slotsRequired == null ? (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Calculating slots required…
          </span>
        ) : slotsRequired != null ? (
          <span>
            <strong>
              {count} slot{count === 1 ? "" : "s"} required
            </strong>{" "}
            <span className="text-muted-foreground">
              ({formatDurationMinutes(durationMinutes)}, {requiredBasis})
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground">
            Complete the sample details to calculate the slots required; using{" "}
            <strong className="text-foreground">
              {count} slot{count === 1 ? "" : "s"}
            </strong>{" "}
            for now.
          </span>
        )}
      </div>

      {misaligned && (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Your saved slot ({WEEKDAY_NAMES[value!.weekday] ?? "?"} {value!.startTime}, {value!.slotCount} slot
          {value!.slotCount === 1 ? "" : "s"}){" "}
          {weekdayOk ? "no longer matches this equipment's slot timings" : "is not on a bookable weekday"} — pick a new start.
        </p>
      )}

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
          This equipment has no slot timings set up yet, so a preferred slot cannot be chosen.
        </p>
      ) : tooManySlots ? (
        <p className="flex gap-2 rounded-lg border border-border bg-muted/40 px-3 py-3 text-sm text-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          {slotsExceedDayMessage(rows, count)}
        </p>
      ) : (
        <TooltipProvider delayDuration={200}>
          <div className="overflow-x-auto rounded-lg border border-border/70 bg-card p-2 sm:p-3">
            <div
              role="grid"
              aria-label={`Preferred weekly slot. Click a start; ${count} consecutive slot${count === 1 ? " is" : "s are"} selected.`}
              className="min-w-[480px]"
              onKeyDown={onGridKeyDown}
              onMouseLeave={() => setHover(null)}
            >
              <div role="row" className="mb-2 grid gap-2" style={gridColumns}>
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
              {rows.map((row, rowIdx) => (
                <div key={row.key} role="row" className="mb-2 grid gap-2" style={gridColumns}>
                  <div
                    role="rowheader"
                    className="sticky left-0 z-10 flex items-center bg-card p-2 text-sm font-medium tabular-nums"
                    title={hideTimes ? undefined : row.timeRange}
                  >
                    {row.label}
                  </div>
                  {days.map((weekday, dayIdx) => {
                    const inRun = isInSelectedRun(weekday, rowIdx);
                    const isStart = inRun && rowIdx === startIndex;
                    const check = consecutiveRun(rows, rowIdx, count);
                    const startable = check.ok;
                    const inPreview =
                      !inRun && preview != null && preview.day === dayIdx && rowIdx >= preview.from && rowIdx <= preview.to;
                    const reason = !inRun && !startable ? runProblemMessage(check, count) : null;
                    const isActive = activeCell.day === dayIdx && activeCell.row === rowIdx;
                    const runEnd = check.ok ? check.rows[check.rows.length - 1] : null;
                    const when = `${WEEKDAY_NAMES[weekday]} ${hideTimes ? row.label : row.timeRange}`;
                    const label = inRun
                      ? `${when}. Selected${isStart ? " start" : ""}. Click to clear the selection.`
                      : startable
                        ? `${when}. Available. ${
                            count > 1
                              ? `Select ${count} slots from here${hideTimes || !runEnd ? "" : `, until ${minutesToKey(runEnd.end)}`}.`
                              : "Select this slot."
                          }`
                        : `${when}. ${reason}`;

                    const button = (
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
                        style={inRun || inPreview ? undefined : availableStyle}
                        className={cn(
                          "flex w-full min-h-[52px] flex-col items-center justify-center rounded-md border-2 px-1.5 py-2 text-sm font-medium leading-tight shadow-sm transition-all",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                          inRun && "border-white/50 bg-primary text-primary-foreground dark:border-primary/50",
                          inPreview && "border-primary bg-primary/70 text-primary-foreground",
                          !inRun && !inPreview && startable && "cursor-pointer border-white/50 hover:opacity-90",
                          !inRun && !inPreview && !startable && "cursor-not-allowed border-white/40 opacity-40"
                        )}
                      >
                        {inRun ? (
                          <>
                            <span className="inline-flex items-center gap-1">
                              <Check className="h-3.5 w-3.5" aria-hidden /> Selected
                            </span>
                            <span className="mt-0.5 text-[11px] font-normal tabular-nums opacity-90">
                              {hideTimes ? row.label : compactRange(row)}
                            </span>
                          </>
                        ) : inPreview ? (
                          <>
                            {rowIdx === preview!.from && <span>Select</span>}
                            <span className="mt-0.5 text-[11px] font-normal tabular-nums opacity-90">
                              {hideTimes ? row.label : compactRange(row)}
                            </span>
                          </>
                        ) : (
                          "Available"
                        )}
                      </button>
                    );

                    return (
                      <div key={weekday} role="gridcell" aria-selected={inRun}>
                        {reason ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="h-full w-full">{button}</div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="z-[120] max-w-xs px-3 py-2 text-left">
                              {reason}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          button
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </TooltipProvider>
      )}

      {hint && (
        <p role="status" className="text-xs text-amber-700 dark:text-amber-300">
          {hint}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-foreground" aria-live="polite">
          {selectedRun ? (
            <strong>{describeWeeklySelection(value!.weekday, selectedRun.rows, hideTimes)}</strong>
          ) : tooManySlots ? null : (
            <span className="text-muted-foreground">
              Click a green slot to select {count === 1 ? "it" : `${count} consecutive slots from there`}.
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
              setHint(null);
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

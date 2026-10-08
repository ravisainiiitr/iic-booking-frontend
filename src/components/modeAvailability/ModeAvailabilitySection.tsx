import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarRange, Clock, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import ModeWeekdayChips from "@/components/modeAvailability/ModeWeekdayChips";
import { apiClient } from "@/lib/api";
import {
  WEEKDAY_SHORT,
  describeModeWeekdays,
  familyColors,
  formatDay,
  formatOpensAt,
  modeHeadline,
  shortStatus,
  type ModeAvailabilityDay,
  type ModeAvailabilityMode,
  type ModeAvailabilitySummary,
  type ModeDayCell,
  type ModeDayStatus,
} from "@/lib/modeAvailability";
import { cn } from "@/lib/utils";

const STATUS_CHIP: Record<ModeDayStatus, string> = {
  available: "bg-emerald-50 text-emerald-800 ring-emerald-600/25 dark:bg-emerald-950/50 dark:text-emerald-200",
  full: "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-950/50 dark:text-rose-200",
  not_available: "bg-slate-100 text-slate-600 ring-slate-400/25 dark:bg-slate-800/60 dark:text-slate-300",
  holiday: "bg-amber-50 text-amber-800 ring-amber-500/25 dark:bg-amber-950/40 dark:text-amber-200",
  closed: "bg-slate-100 text-slate-500 ring-slate-400/20 dark:bg-slate-800/60 dark:text-slate-400",
  maintenance: "bg-orange-50 text-orange-800 ring-orange-500/25 dark:bg-orange-950/40 dark:text-orange-200",
  not_open: "bg-sky-50 text-sky-800 ring-sky-500/25 dark:bg-sky-950/40 dark:text-sky-200",
  not_running: "bg-transparent text-muted-foreground ring-border",
  past: "bg-transparent text-muted-foreground ring-transparent",
};

const STATUS_KEY: Array<{ status: ModeDayStatus; text: string }> = [
  { status: "available", text: "Free slots" },
  { status: "full", text: "Fully booked" },
  { status: "not_open", text: "Booking not open yet" },
  { status: "holiday", text: "Holiday / closed" },
  { status: "maintenance", text: "Maintenance" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Props = {
  equipmentId: number;
  /** Book ``modeId`` at the week of ``date`` (shown only on days with free slots). */
  onBook?: (modeId: number, date: string) => void;
  canBook?: boolean;
  className?: string;
};

function cellLongText(cell: ModeDayCell): string {
  if (cell.status === "not_open" && cell.opens_at) return `Booking opens ${formatOpensAt(cell.opens_at)}`;
  if (cell.status === "available" && cell.first_slot_at) {
    const d = new Date(cell.first_slot_at);
    const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    return `${cell.label}, first at ${time}${cell.partial ? " (part of the day)" : ""}`;
  }
  return cell.label || shortStatus(cell);
}

/** Cells a calendar day shows: every running mode on a base page; on a mode page that mode first, the others muted. */
function dayEntries(day: ModeAvailabilityDay, focusId: number | null): ModeDayCell[] {
  const live = day.modes.filter((c) => c.status !== "past");
  if (focusId == null) return live.filter((c) => c.status !== "not_running");
  const focus = live.find((c) => c.equipment_id === focusId);
  const others = live.filter((c) => c.equipment_id !== focusId && c.status !== "not_running");
  return focus ? [focus, ...others] : others;
}

function StatusPill({ cell, className }: { cell: ModeDayCell; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none ring-1 ring-inset",
        STATUS_CHIP[cell.status],
        className,
      )}
    >
      {shortStatus(cell)}
    </span>
  );
}

function LegendCard({
  mode,
  color,
  current,
  muted,
}: {
  mode: ModeAvailabilityMode;
  color: string;
  current: boolean;
  muted: boolean;
}) {
  return (
    <li
      className={cn(
        "flex flex-col gap-2 rounded-lg border bg-background/60 p-3 transition-opacity",
        current ? "border-primary/50 ring-1 ring-primary/30" : "border-border/70",
        muted && "opacity-75",
      )}
      data-testid="mode-legend-item"
      data-current={current ? "true" : "false"}
    >
      <div className="flex min-w-0 items-start gap-2">
        <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-semibold leading-snug text-foreground">
            {current ? (
              <span className="truncate">{mode.name}</span>
            ) : (
              <Link to={`/equipment/${mode.equipment_id}`} className="truncate hover:underline">
                {mode.name}
              </Link>
            )}
            <span className="text-xs font-medium text-muted-foreground">{mode.code}</span>
          </p>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {mode.role === "base" ? "Base instrument" : "Mode"}
            {current ? " · this page" : ""}
          </p>
        </div>
      </div>
      <ModeWeekdayChips weekdays={mode.weekdays} color={color} />
      {mode.hours.length > 0 ? (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" aria-hidden />
          {mode.hours.join(", ")}
        </p>
      ) : null}
      <p
        className={cn(
          "text-xs font-medium",
          mode.state === "available"
            ? "text-emerald-700 dark:text-emerald-300"
            : mode.state === "full"
              ? "text-rose-700 dark:text-rose-300"
              : "text-muted-foreground",
        )}
      >
        {modeHeadline(mode)}
        {mode.next_available ? (
          <span className="font-normal text-muted-foreground">
            {" "}
            · {mode.next_available.free_slots} free slot{mode.next_available.free_slots === 1 ? "" : "s"}
          </span>
        ) : null}
      </p>
    </li>
  );
}

/** Equipment page: which mode of a multi-mode instrument runs on which day, with free slots per day. */
export default function ModeAvailabilitySection({ equipmentId, onBook, canBook = false, className }: Props) {
  const [data, setData] = useState<ModeAvailabilitySummary | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error" | "none">("loading");
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const res = await apiClient.getEquipmentModeAvailability(equipmentId);
      if (res.error || !res.data) {
        setState("error");
        return;
      }
      if (!res.data.multi_mode) {
        setData(null);
        setState("none");
        return;
      }
      setData(res.data);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [equipmentId]);

  useEffect(() => {
    setSelected(null);
    void load();
  }, [load]);

  const colors = useMemo(() => familyColors(data?.modes ?? []), [data]);
  const modesById = useMemo(() => new Map((data?.modes ?? []).map((m) => [m.equipment_id, m])), [data]);
  const focusId = useMemo(() => {
    const self = data?.modes.find((m) => m.equipment_id === data.equipment_id);
    return self?.role === "mode" ? self.equipment_id : null;
  }, [data]);

  if (state === "none") return null;

  const header = (
    <div className="flex flex-col gap-1 border-b border-border/60 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <h2 id="mode-availability-title" className="flex items-center gap-2 text-base font-semibold text-foreground">
          <CalendarRange className="h-4 w-4 text-primary" aria-hidden />
          Availability by mode
        </h2>
        <p className="text-sm text-muted-foreground">
          This instrument runs in more than one mode, and the modes share it. See which mode runs on which day and
          where slots are free before you book.
        </p>
      </div>
      {state === "ready" ? (
        <Button type="button" variant="ghost" size="sm" className="shrink-0 gap-1.5 self-start" onClick={() => void load()}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Refresh
        </Button>
      ) : null}
    </div>
  );

  if (state === "loading" && !data) {
    return (
      <section
        aria-labelledby="mode-availability-title"
        aria-busy="true"
        className={cn("overflow-hidden rounded-xl bg-card ring-1 ring-border/60", className)}
      >
        {header}
        <div className="space-y-3 p-5" data-testid="mode-availability-loading">
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
          <Skeleton className="h-40 w-full" />
          <span className="sr-only">Loading availability…</span>
        </div>
      </section>
    );
  }

  if (state === "error" || !data) {
    return (
      <section
        aria-labelledby="mode-availability-title"
        className={cn("overflow-hidden rounded-xl bg-card ring-1 ring-border/60", className)}
      >
        {header}
        <div className="flex flex-wrap items-center gap-3 px-5 py-6 text-sm text-muted-foreground">
          Availability by mode could not be loaded.
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      </section>
    );
  }

  const selectedDay = selected ? data.days.find((d) => d.date === selected) ?? null : null;
  const otherModes = data.modes.filter((m) => m.equipment_id !== focusId);
  const orderedModes = focusId != null ? [modesById.get(focusId)!, ...otherModes] : data.modes;
  const modeLabel = (id: number) => modesById.get(id)?.code ?? String(id);

  return (
    <section
      aria-labelledby="mode-availability-title"
      className={cn("overflow-hidden rounded-xl bg-card ring-1 ring-border/60", className)}
      data-testid="mode-availability-section"
    >
      {header}
      <div className="space-y-5 p-5">
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Modes of this instrument">
          {orderedModes.map((m) => (
            <LegendCard
              key={m.equipment_id}
              mode={m}
              color={colors.get(m.equipment_id)!}
              current={m.equipment_id === data.equipment_id}
              muted={focusId != null && m.equipment_id !== focusId}
            />
          ))}
        </ul>

        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              Next 4 weeks · {formatDay(data.start_date)} to {formatDay(data.end_date)}
            </h3>
            <ul className="flex flex-wrap gap-1.5" aria-label="Status key">
              {STATUS_KEY.map((k) => (
                <li
                  key={k.status}
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
                    STATUS_CHIP[k.status],
                  )}
                >
                  {k.text}
                </li>
              ))}
            </ul>
          </div>
          <TooltipProvider delayDuration={150}>
            <div className="hidden grid-cols-7 gap-1.5 sm:grid" aria-hidden>
              {WEEKDAY_SHORT.map((w, i) => (
                <div
                  key={w}
                  className={cn(
                    "px-1 text-center text-[11px] font-semibold uppercase tracking-wide",
                    i >= 5 ? "text-muted-foreground/70" : "text-muted-foreground",
                  )}
                >
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-7" role="list" aria-label="Days">
              {data.days.map((day, idx) => {
                const d = new Date(Number(day.date.slice(0, 4)), Number(day.date.slice(5, 7)) - 1, Number(day.date.slice(8, 10)));
                const entries = dayEntries(day, focusId);
                const isSelected = selected === day.date;
                const showMonth = idx === 0 || d.getDate() === 1;
                const aria = day.is_past
                  ? `${formatDay(day.date)}: past`
                  : `${formatDay(day.date)}${day.holiday ? ` (${day.holiday})` : ""}: ${
                      entries.length
                        ? entries.map((c) => `${modesById.get(c.equipment_id)?.name ?? ""} ${cellLongText(c)}`).join("; ")
                        : "no mode runs"
                    }`;
                const body = (
                  <button
                    type="button"
                    disabled={day.is_past}
                    aria-pressed={isSelected}
                    aria-label={aria}
                    onClick={() => setSelected(isSelected ? null : day.date)}
                    data-testid={`mode-day-${day.date}`}
                    data-today={day.is_today ? "true" : "false"}
                    className={cn(
                      "flex w-full min-w-0 flex-col gap-1 rounded-lg border p-1.5 text-left transition-colors sm:min-h-[5.75rem]",
                      day.is_past
                        ? "hidden cursor-default border-transparent bg-muted/20 opacity-50 sm:flex"
                        : "border-border/70 bg-background hover:border-primary/40 hover:bg-primary/[0.03]",
                      day.weekend && !day.is_past && "bg-muted/30",
                      day.is_today && "border-primary ring-1 ring-primary/40",
                      isSelected && "border-primary bg-primary/5 ring-2 ring-primary/50",
                    )}
                  >
                    <span className="flex items-center justify-between gap-1 text-[11px] font-semibold text-foreground">
                      <span className="sm:hidden">{formatDay(day.date)}</span>
                      <span className="hidden sm:inline">
                        {d.getDate()}
                        {showMonth ? ` ${MONTHS[d.getMonth()]}` : ""}
                      </span>
                      {day.is_today ? (
                        <span className="rounded bg-primary px-1 text-[9px] font-bold uppercase tracking-wide text-primary-foreground">
                          Today
                        </span>
                      ) : day.holiday ? (
                        <span className="truncate text-[10px] font-medium text-amber-700 dark:text-amber-300" title={day.holiday}>
                          {day.holiday}
                        </span>
                      ) : null}
                    </span>
                    {day.is_past ? null : entries.length === 0 ? (
                      <span className="text-[10px] text-muted-foreground">No mode runs</span>
                    ) : (
                      entries.map((c) => (
                        <span
                          key={c.equipment_id}
                          className={cn(
                            "flex min-w-0 items-center gap-1",
                            focusId != null && c.equipment_id !== focusId && "opacity-50",
                          )}
                          data-testid="mode-day-entry"
                          data-mode={c.equipment_id}
                          data-status={c.status}
                        >
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: colors.get(c.equipment_id) }}
                            aria-hidden
                          />
                          <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-muted-foreground">
                            {modeLabel(c.equipment_id)}
                          </span>
                          <StatusPill cell={c} className="shrink-0" />
                        </span>
                      ))
                    )}
                  </button>
                );
                if (day.is_past || entries.length === 0) {
                  return (
                    <div key={day.date} role="listitem" className={cn(day.is_past && "hidden sm:block")}>
                      {body}
                    </div>
                  );
                }
                return (
                  <div key={day.date} role="listitem">
                    <Tooltip>
                      <TooltipTrigger asChild>{body}</TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs space-y-1 text-xs">
                        <p className="font-semibold">
                          {formatDay(day.date)}
                          {day.holiday ? ` · ${day.holiday}` : ""}
                        </p>
                        {entries.map((c) => (
                          <p key={c.equipment_id}>
                            <span className="font-medium">{modesById.get(c.equipment_id)?.name}</span>: {cellLongText(c)}
                          </p>
                        ))}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                );
              })}
            </div>
          </TooltipProvider>
        </div>

        {selectedDay ? (
          <div className="rounded-lg border border-primary/30 bg-primary/[0.03] p-4" data-testid="mode-day-details" aria-live="polite">
            <p className="text-sm font-semibold text-foreground">
              {formatDay(selectedDay.date)}
              {selectedDay.holiday ? <span className="font-normal text-muted-foreground"> · {selectedDay.holiday}</span> : null}
            </p>
            <ul className="mt-2 divide-y divide-border/60">
              {orderedModes.map((m) => {
                const c = selectedDay.modes.find((x) => x.equipment_id === m.equipment_id);
                if (!c) return null;
                const blockedBy = c.blocked_by != null ? modesById.get(c.blocked_by) : null;
                return (
                  <li key={m.equipment_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colors.get(m.equipment_id) }} aria-hidden />
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="font-medium text-foreground">{m.name}</span>{" "}
                      <span className="text-muted-foreground">
                        — {cellLongText(c)}
                        {blockedBy ? ` (${blockedBy.name} runs on its own)` : ""}
                      </span>
                    </span>
                    {c.status === "available" && canBook && onBook ? (
                      <Button type="button" size="sm" onClick={() => onBook(m.equipment_id, selectedDay.date)}>
                        Book {m.code}
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Select a day to see every mode's status{canBook ? " and book a free slot" : ""}.</p>
        )}

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Free-slot counts cover the weeks open for booking for your account and refresh about every minute; the
          booking page always has the final word. Later weeks show the regular pattern and when booking opens.
          {state === "loading" ? <Loader2 className="ml-1 inline h-3 w-3 animate-spin" aria-hidden /> : null}
        </p>
        <p className="sr-only">
          {data.modes.map((m) => `${m.name}: ${describeModeWeekdays(m.weekdays)}. ${modeHeadline(m)}.`).join(" ")}
        </p>
      </div>
    </section>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addDays, addWeeks, format, parseISO, startOfWeek } from "date-fns";
import { Loader2, Lock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import RestrictedSlotLegend from "@/components/RestrictedSlotLegend";
import { NextWeekOpeningCountdown } from "@/components/booking/NextWeekOpeningCountdown";
import {
  SLOT_CELL_CLASS,
  SlotCalendarLegend,
  SlotWeekGrid,
  SlotWeekNav,
  slotCellStyle,
} from "@/components/slot-calendar/SlotWeekGrid";
import { SlotHoverCard } from "@/components/slot-calendar/SlotHoverCard";
import { apiClient } from "@/lib/api";
import { publicDisruptionLines } from "@/lib/disruptions";
import { resolveSlotCell, slotCalendarLegend, slotCalendarPalette, type HolidayEntry } from "@/lib/slotCalendarDisplay";
import { isOutsideVisibilityWindow, restrictedSlotHint, restrictedSlotStyle } from "@/lib/slotVisibilityWindow";

type SlotsPayload = NonNullable<Awaited<ReturnType<typeof apiClient.getEquipmentSlots>>["data"]>;
type CalendarSlot = SlotsPayload["slots"][number] & {
  slot_open_time?: string | null;
  blocked_label?: string | null;
  home_department_only?: boolean;
  mode_overlay_color?: string | null;
};

/** Weeks to look ahead for the first week with a free slot when no booking window is returned (staff viewers). */
const MAX_UNBOUNDED_WEEKS_AHEAD = 8;
const INITIAL_SEEK_WEEKS = 4;
const AUTO_REFRESH_MS = 60_000;

function normalizeTimeKey(raw: string | null | undefined): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  const timePart = s.includes("T") ? s.slice(s.indexOf("T") + 1) : s;
  const [h, m] = timePart.split(":");
  const hh = parseInt(h || "0", 10);
  const mm = parseInt((m || "0").replace(/\D/g, "") || "0", 10);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return "";
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function slotTimeKey(slot: CalendarSlot): string {
  return normalizeTimeKey(slot.slot_open_time || slot.start_datetime);
}

function slotDateKey(slot: CalendarSlot): string {
  return String(slot.date || "").slice(0, 10);
}

function isFutureAvailable(slot: CalendarSlot, now: Date): boolean {
  if (String(slot.status || "").toUpperCase() !== "AVAILABLE") return false;
  try {
    return parseISO(slot.start_datetime) > now;
  } catch {
    return false;
  }
}

function formatRowLabel(timeKey: string, durationMinutes: number): string {
  const [h, m] = timeKey.split(":").map((v) => parseInt(v, 10));
  const endM = h * 60 + m + Math.max(1, durationMinutes || 60);
  const end = `${String(Math.floor(endM / 60) % 24).padStart(2, "0")}:${String(endM % 60).padStart(2, "0")}`;
  return `${timeKey} – ${end}`;
}

function buildRowKeys(payload: SlotsPayload): string[] {
  const fromMasters = (payload.slot_master_times ?? []).map(normalizeTimeKey).filter(Boolean);
  if (fromMasters.length > 0) return [...new Set(fromMasters)].sort();
  const fromSlots = (payload.slots as CalendarSlot[]).map(slotTimeKey).filter(Boolean);
  if (fromSlots.length > 0) return [...new Set(fromSlots)].sort();
  const start = normalizeTimeKey(payload.slot_start_time);
  const end = normalizeTimeKey(payload.slot_end_time);
  const step = payload.slot_duration_minutes || 60;
  if (!start || !end || step <= 0) return [];
  const toMin = (t: string) => parseInt(t.slice(0, 2), 10) * 60 + parseInt(t.slice(3, 5), 10);
  const keys: string[] = [];
  for (let m = toMin(start); m < toMin(end); m += step) {
    keys.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return keys;
}

interface Props {
  equipmentId: number | string;
  /** "SLOT_ID" hides times and labels rows "Slot 1, 2…" (equipment setting). */
  weeklyViewDisplay?: "TIME" | "SLOT_ID";
}

/**
 * Read-only weekly availability for one equipment, laid out like the booking slot grid.
 * Opens on the first week (within the viewer's booking window) that has a free future slot.
 */
export default function EquipmentAvailabilityCalendar({ equipmentId, weeklyViewDisplay = "TIME" }: Props) {
  const thisWeek = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 1 }), []);
  const [weekStart, setWeekStart] = useState<Date>(thisWeek);
  const [payload, setPayload] = useState<SlotsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeking, setSeeking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const requestSeq = useRef(0);

  const fetchWeek = useCallback(
    async (start: Date): Promise<SlotsPayload | null> => {
      const res = await apiClient.getEquipmentSlots(
        equipmentId,
        format(start, "yyyy-MM-dd"),
        format(addDays(start, 6), "yyyy-MM-dd")
      );
      if (res.error || !res.data) throw new Error(res.error || "Could not load the availability calendar.");
      return res.data;
    },
    [equipmentId]
  );

  const windowMaxDate = payload?.slot_window_max_date ? parseISO(payload.slot_window_max_date) : null;
  const lastNavigableWeek = windowMaxDate
    ? startOfWeek(windowMaxDate, { weekStartsOn: 1 })
    : addWeeks(thisWeek, MAX_UNBOUNDED_WEEKS_AHEAD);
  const canGoPrev = weekStart > thisWeek;
  const canGoNext = addWeeks(weekStart, 1) <= lastNavigableWeek;

  // Initial load: walk forward from the current week to the first week with a free slot.
  useEffect(() => {
    const seq = ++requestSeq.current;
    let cancelled = false;
    (async () => {
      setSeeking(true);
      setLoading(true);
      setError(null);
      try {
        const now = new Date();
        const first = await fetchWeek(thisWeek);
        if (cancelled || seq !== requestSeq.current) return;
        let chosenStart = thisWeek;
        let chosen = first;
        if (first && !(first.slots as CalendarSlot[]).some((s) => isFutureAvailable(s, now))) {
          const maxStr = first.slot_window_max_date;
          const limit = maxStr
            ? startOfWeek(parseISO(maxStr), { weekStartsOn: 1 })
            : addWeeks(thisWeek, INITIAL_SEEK_WEEKS);
          for (let i = 1; i <= INITIAL_SEEK_WEEKS; i++) {
            const candidate = addWeeks(thisWeek, i);
            if (candidate > limit) break;
            const next = await fetchWeek(candidate);
            if (cancelled || seq !== requestSeq.current) return;
            if (next && (next.slots as CalendarSlot[]).some((s) => isFutureAvailable(s, now))) {
              chosenStart = candidate;
              chosen = next;
              break;
            }
          }
        }
        setWeekStart(chosenStart);
        setPayload(chosen);
        setUpdatedAt(new Date());
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load the availability calendar.");
      } finally {
        if (!cancelled && seq === requestSeq.current) {
          setLoading(false);
          setSeeking(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchWeek, thisWeek]);

  const loadWeek = useCallback(
    async (start: Date, silent = false) => {
      const seq = ++requestSeq.current;
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const data = await fetchWeek(start);
        if (seq !== requestSeq.current) return;
        setPayload(data);
        setUpdatedAt(new Date());
      } catch (e) {
        if (seq === requestSeq.current && !silent) {
          setError(e instanceof Error ? e.message : "Could not load the availability calendar.");
        }
      } finally {
        if (seq === requestSeq.current && !silent) setLoading(false);
      }
    },
    [fetchWeek]
  );

  const goToWeek = (start: Date) => {
    setWeekStart(start);
    void loadWeek(start);
  };

  useEffect(() => {
    if (seeking) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadWeek(weekStart, true);
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [seeking, weekStart, loadWeek]);

  const slotIndex = useMemo(() => {
    const m = new Map<string, CalendarSlot>();
    for (const slot of (payload?.slots ?? []) as CalendarSlot[]) {
      const key = `${slotDateKey(slot)}|${slotTimeKey(slot)}`;
      if (!key.startsWith("|") && !key.endsWith("|")) m.set(key, slot);
    }
    return m;
  }, [payload]);

  const rowKeys = useMemo(() => (payload ? buildRowKeys(payload) : []), [payload]);
  const slotDuration = payload?.slot_duration_minutes || 60;
  const palette = slotCalendarPalette(payload?.calendar_colors);
  const holidays = (payload?.holidays ?? {}) as Record<string, HolidayEntry>;
  const now = new Date();
  const freeThisWeek = ((payload?.slots ?? []) as CalendarSlot[]).filter((s) => isFutureAvailable(s, now)).length;

  const renderCell = (day: Date, timeKey: string) => {
    const dateStr = format(day, "yyyy-MM-dd");
    const slot = slotIndex.get(`${dateStr}|${timeKey}`);
    const display = resolveSlotCell({ slot, day, holiday: holidays[dateStr], palette, now });
    const restrictedToStaff = isOutsideVisibilityWindow(slot);
    const disruptionLines = publicDisruptionLines(slot?.disruption_public);
    const cellEl = (
      <div
        className={SLOT_CELL_CLASS}
        style={restrictedToStaff ? restrictedSlotStyle(slotCellStyle(display)) : slotCellStyle(display)}
        title={
          disruptionLines.length > 0
            ? undefined
            : restrictedToStaff
              ? restrictedSlotHint(payload?.weekly_view_time_from, payload?.weekly_view_time_to)
              : display.hover
        }
        tabIndex={disruptionLines.length > 0 ? 0 : undefined}
        aria-label={disruptionLines.length > 0 ? `${display.label}. ${disruptionLines.join(". ")}` : undefined}
      >
        {restrictedToStaff ? <Lock className="mr-1 h-3.5 w-3.5 shrink-0" aria-label="Visible only to OIC and administrators" /> : null}
        {display.label}
      </div>
    );
    return disruptionLines.length > 0 ? (
      <SlotHoverCard lines={disruptionLines} boldFirst>
        {cellEl}
      </SlotHoverCard>
    ) : (
      cellEl
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Live weekly view of this equipment&apos;s slots. It is for information only — use{" "}
        <span className="font-medium text-foreground">Book this equipment</span> to make a booking.
      </p>

      <SlotWeekNav
        weekStart={weekStart}
        onPrevious={() => goToWeek(addWeeks(weekStart, -1))}
        onNext={() => goToWeek(addWeeks(weekStart, 1))}
        canPrevious={canGoPrev && !loading}
        canNext={canGoNext && !loading}
        subtitle={
          !loading && payload
            ? freeThisWeek > 0
              ? `${freeThisWeek} free slot${freeThisWeek === 1 ? "" : "s"} this week`
              : "No free slots this week"
            : null
        }
        actions={
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => void loadWeek(weekStart)}
            disabled={loading}
            aria-label="Refresh calendar"
            title="Refresh"
          >
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          </Button>
        }
      />

      <NextWeekOpeningCountdown
        equipmentId={equipmentId}
        onOpen={() => void loadWeek(weekStart, true)}
        className="mx-auto flex w-fit"
      />

      {!error && ((payload?.slots ?? []) as CalendarSlot[]).some((s) => isOutsideVisibilityWindow(s)) ? (
        <RestrictedSlotLegend from={payload?.weekly_view_time_from} to={payload?.weekly_view_time_to} />
      ) : null}

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive">
          {error}
        </div>
      ) : loading && !payload ? (
        <div className="flex min-h-[14rem] flex-col items-center justify-center gap-3 rounded-lg border border-dashed">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            {seeking ? "Finding the first week with free slots…" : "Loading slot availability…"}
          </p>
        </div>
      ) : rowKeys.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          No slots are set up for this week. Try another week.
        </div>
      ) : (
        <SlotWeekGrid
          className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}
          weekStart={weekStart}
          timeHeader={weeklyViewDisplay === "SLOT_ID" ? "Slot position" : "Time"}
          rows={rowKeys.map((timeKey, index) => ({
            key: timeKey,
            label: weeklyViewDisplay === "SLOT_ID" ? `Slot ${index + 1}` : formatRowLabel(timeKey, slotDuration),
          }))}
          renderCell={renderCell}
          singleDayOnMobile
          dayHasFreeSlot={(day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            return ((payload?.slots ?? []) as CalendarSlot[]).some(
              (s) => slotDateKey(s) === dateStr && isFutureAvailable(s, now),
            );
          }}
        />
      )}

      <SlotCalendarLegend
        items={slotCalendarLegend(palette)}
        trailing={
          updatedAt ? (
            <span className="ml-auto whitespace-nowrap">Updated {format(updatedAt, "hh:mm a")} · refreshes every minute</span>
          ) : null
        }
      />
    </div>
  );
}

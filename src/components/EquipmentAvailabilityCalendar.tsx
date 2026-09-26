import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { addDays, addWeeks, format, parseISO, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";

type SlotsPayload = NonNullable<Awaited<ReturnType<typeof apiClient.getEquipmentSlots>>["data"]>;
type CalendarSlot = SlotsPayload["slots"][number] & {
  slot_open_time?: string | null;
  blocked_label?: string | null;
  home_department_only?: boolean;
  mode_overlay_color?: string | null;
};

/** Same defaults as the booking weekly grid; admin-configured calendar colours override them. */
const DEFAULT_SLOT_COLORS: Record<string, string> = {
  AVAILABLE: "#22c55e",
  BOOKED: "#ef4444",
  COMPLETED: "#059669",
  BLOCKED: "#64748b",
  UNDER_MAINTENANCE: "#f97316",
  OPERATOR_ABSENT: "#eab308",
  BOOKING_NOT_UTILIZED: "#a855f7",
  HOLD: "#f59e0b",
  HOME_DEPARTMENT_ONLY: "#c4b5fd",
  NON_HOME_RESERVED: "#06b6d4",
  NOT_AVAILABLE: "#e2e8f0",
};
const PAST_SLOT_COLOR = "#94a3b8";
const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Available",
  NOT_AVAILABLE: "Not Available",
  BOOKED: "Booked",
  BOOKING_NOT_UTILIZED: "Booked",
  BLOCKED: "Other Reasons",
  UNDER_MAINTENANCE: "Under Maintenance",
  OPERATOR_ABSENT: "Operator Absent",
  HOLD: "On Hold",
};
/** Weeks to look ahead for the first week with a free slot when no booking window is returned (staff viewers). */
const MAX_UNBOUNDED_WEEKS_AHEAD = 8;
const INITIAL_SEEK_WEEKS = 4;
const AUTO_REFRESH_MS = 60_000;

function getContrastTextColor(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? "#1f2937" : "#ffffff";
}

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
  const slotColors = { ...DEFAULT_SLOT_COLORS, ...(payload?.calendar_colors?.slot_colors || {}) };
  const holidayDefault = payload?.calendar_colors?.holiday_default || "#f59e0b";
  const saturdayColor = payload?.calendar_colors?.saturday_color || "#c7d2fe";
  const sundayColor = payload?.calendar_colors?.sunday_color || "#fbcfe8";
  const holidays = (payload?.holidays ?? {}) as Record<string, string | { label?: string; color?: string }>;
  const now = new Date();
  const freeThisWeek = ((payload?.slots ?? []) as CalendarSlot[]).filter((s) => isFutureAvailable(s, now)).length;

  const renderCell = (day: Date, timeKey: string) => {
    const dateStr = format(day, "yyyy-MM-dd");
    const slot = slotIndex.get(`${dateStr}|${timeKey}`);
    const dow = day.getDay();
    const rawHoliday = holidays[dateStr];
    const holidayName = typeof rawHoliday === "string" ? rawHoliday : rawHoliday?.label;
    const holidayColor = typeof rawHoliday === "object" && rawHoliday?.color ? rawHoliday.color : undefined;
    const closedDayColor = holidayColor || (dow === 6 ? saturdayColor : dow === 0 ? sundayColor : holidayDefault);

    let label: string;
    let bg: string;
    if (!slot) {
      label = holidayName || "—";
      bg = holidayName || dow === 6 || dow === 0 ? closedDayColor : slotColors.NOT_AVAILABLE;
    } else {
      const status = String(slot.status || "").toUpperCase();
      let isPast = false;
      try {
        isPast = parseISO(slot.start_datetime) < now;
      } catch {
        isPast = false;
      }
      if (status === "BOOKED" || status === "BOOKING_NOT_UTILIZED") {
        label = "Booked";
        bg = slotColors.BOOKED;
      } else if (status === "NOT_AVAILABLE" && (holidayName || dow === 6 || dow === 0)) {
        label = holidayName || "Not Available";
        bg = closedDayColor;
      } else if (isPast) {
        label = "Past";
        bg = PAST_SLOT_COLOR;
      } else if (status === "AVAILABLE") {
        const display = slot.status_display || "";
        if (display === "Reserved for other departments" || (slot.home_department_only && !display)) {
          label = display || "Reserved";
          bg = slotColors.NON_HOME_RESERVED;
        } else if (display === "Home department only") {
          label = display;
          bg = slotColors.HOME_DEPARTMENT_ONLY;
        } else {
          label = "Available";
          bg = slot.mode_overlay_color || slotColors.AVAILABLE;
        }
      } else if (status === "BLOCKED") {
        label = slot.blocked_label || STATUS_LABELS.BLOCKED;
        bg = slotColors.BLOCKED;
      } else {
        label = slot.status_display || STATUS_LABELS[status] || "Not Available";
        bg = slotColors[status] || slotColors.NOT_AVAILABLE;
      }
    }
    const style: CSSProperties = { backgroundColor: bg, color: getContrastTextColor(bg) };
    return (
      <div
        key={dateStr}
        className="flex min-h-[48px] w-full items-center justify-center rounded-md border-2 border-white/50 p-2 text-center text-xs font-medium leading-tight shadow-sm sm:text-sm"
        style={style}
      >
        {label}
      </div>
    );
  };

  const legend: Array<{ label: string; color: string }> = [
    { label: "Available", color: slotColors.AVAILABLE },
    { label: "Booked", color: slotColors.BOOKED },
    { label: "Past", color: PAST_SLOT_COLOR },
    { label: "Maintenance", color: slotColors.UNDER_MAINTENANCE },
    { label: "Not available", color: slotColors.NOT_AVAILABLE },
    { label: "Saturday", color: saturdayColor },
    { label: "Sunday", color: sundayColor },
    { label: "Holiday", color: holidayDefault },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Live weekly view of this equipment&apos;s slots. It is for information only — use{" "}
        <span className="font-medium text-foreground">Book this equipment</span> to make a booking.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" size="sm" onClick={() => goToWeek(addWeeks(weekStart, -1))} disabled={!canGoPrev || loading}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Previous Week
        </Button>
        <div className="text-center">
          <div className="font-semibold">
            {format(weekStart, "MMM dd")} - {format(addDays(weekStart, 6), "MMM dd, yyyy")}
          </div>
          {!loading && payload ? (
            <div className="mt-0.5 text-xs text-muted-foreground">
              {freeThisWeek > 0
                ? `${freeThisWeek} free slot${freeThisWeek === 1 ? "" : "s"} this week`
                : "No free slots this week"}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
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
          <Button variant="outline" size="sm" onClick={() => goToWeek(addWeeks(weekStart, 1))} disabled={!canGoNext || loading}>
            Next Week
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>

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
        <div className={loading ? "relative opacity-60 transition-opacity" : "relative transition-opacity"}>
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              <div className="mb-2 grid grid-cols-8 gap-2">
                <div className="p-2 text-sm font-semibold">{weeklyViewDisplay === "SLOT_ID" ? "Slot position" : "Time"}</div>
                {[0, 1, 2, 3, 4, 5, 6].map((offset) => {
                  const day = addDays(weekStart, offset);
                  return (
                    <div key={offset} className="p-2 text-center text-sm font-semibold">
                      <div>{format(day, "EEE")}</div>
                      <div className="text-muted-foreground">{format(day, "MMM dd")}</div>
                    </div>
                  );
                })}
              </div>
              {rowKeys.map((timeKey, index) => (
                <div key={timeKey} className="mb-2 grid grid-cols-8 gap-2">
                  <div className="flex items-center p-2 text-sm font-medium">
                    {weeklyViewDisplay === "SLOT_ID" ? `Slot ${index + 1}` : formatRowLabel(timeKey, slotDuration)}
                  </div>
                  <div className="col-span-7 grid grid-cols-7 gap-2">
                    {[0, 1, 2, 3, 4, 5, 6].map((offset) => renderCell(addDays(weekStart, offset), timeKey))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-3 text-xs text-muted-foreground">
        {legend.map((item) => (
          <span key={item.label} className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border border-black/10" style={{ backgroundColor: item.color }} />
            {item.label}
          </span>
        ))}
        {updatedAt ? (
          <span className="ml-auto whitespace-nowrap">Updated {format(updatedAt, "hh:mm a")} · refreshes every minute</span>
        ) : null}
      </div>
    </div>
  );
}

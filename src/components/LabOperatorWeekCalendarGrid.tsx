import { useMemo, type ReactNode } from "react";
import { Check } from "lucide-react";
import { addDays, format, parseISO, startOfDay } from "date-fns";
import type { LabCalendarSlot, LabWeekCalendarSlotsPayload } from "@/lib/labOperatorCalendarTypes";
import { isExternalBookingUserType } from "@/lib/userTypes";
import { slotRowEndTimes, slotTimeRangeLabel } from "@/lib/slotTimeRange";
import { contrastTextColor, isSlotInPast, resolveSlotCell, slotCalendarPalette } from "@/lib/slotCalendarDisplay";
import { cn } from "@/lib/utils";
import {
  SLOT_CELL_CLASS,
  SLOT_CELL_SELECTED_CLASS,
  SlotWeekGrid,
  slotCellStyle,
} from "@/components/slot-calendar/SlotWeekGrid";

/** Parse "HH:mm" or "HH:mm:ss" to minutes from midnight. */
function parseTimeToMinutes(timeStr: string): number {
  const parts = timeStr.trim().split(":");
  const h = parseInt(parts[0] || "0", 10);
  const m = parseInt(parts[1] || "0", 10);
  return h * 60 + m;
}

function formatTimeForDisplay(timeStr: string): string {
  return timeStr.substring(0, 5);
}

function parseIsoDateAndTime(isoStr: string): { dateStr: string; timeStr: string } {
  if (!isoStr || typeof isoStr !== "string") return { dateStr: "", timeStr: "" };
  const i = isoStr.indexOf("T");
  const dateStr = i >= 0 ? isoStr.substring(0, i) : isoStr.substring(0, 10);
  const timePart = i >= 0 ? isoStr.substring(i + 1) : "";
  const timeStr = timePart.length >= 5 ? timePart.substring(0, 5) : "";
  return { dateStr, timeStr };
}

function normalizeSlotGridTimeKey(raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  const head = s.includes("T") ? parseIsoDateAndTime(s).timeStr : s.split(/\s/)[0] ?? "";
  const base = head.length >= 4 ? head : formatTimeForDisplay(s.length >= 5 ? s : `${s}:00`);
  const parts = base.split(":");
  const h = parseInt(parts[0] || "0", 10);
  const m = parseInt(String(parts[1] ?? "0").replace(/\D/g, "") || "0", 10);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return formatTimeForDisplay(s).slice(0, 5) || s;
  const hh = ((h % 24) + 24) % 24;
  const mm = ((m % 60) + 60) % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function calendarDateStrFromSlot(slot: { date: string }): string {
  if (typeof slot.date === "string") {
    return slot.date.includes("T") ? format(parseISO(slot.date), "yyyy-MM-dd") : slot.date.slice(0, 10);
  }
  return "";
}

function slotWallTimeFromStartDatetime(iso: string | undefined | null): string {
  if (!iso) return "";
  return parseIsoDateAndTime(iso).timeStr;
}

function timeKeyFromDailySlot(slot: LabCalendarSlot): string {
  let k = "";
  if (slot.slot_open_time) k = formatTimeForDisplay(String(slot.slot_open_time));
  else if (slot.start_datetime) k = slotWallTimeFromStartDatetime(slot.start_datetime);
  return normalizeSlotGridTimeKey(k);
}

function getTimeSlotsFromEquipmentWindow(
  slotStartTime: string | null | undefined,
  slotEndTime: string | null | undefined,
  slotDurationMinutes: number
): string[] {
  if (!slotStartTime || !slotEndTime || slotDurationMinutes <= 0) return [];
  const startM = parseTimeToMinutes(slotStartTime);
  const endM = parseTimeToMinutes(slotEndTime);
  if (endM <= startM) return [];
  const slots: string[] = [];
  for (let m = startM; m < endM; m += slotDurationMinutes) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
  }
  return slots;
}

/** Numeric booking PK for detail API (`booking_id` may be a virtual display string). */
function resolveSlotBookingPk(slot: LabCalendarSlot | undefined): number | null {
  if (!slot) return null;
  const rk = slot.real_booking_id;
  if (rk != null && Number.isFinite(Number(rk))) {
    const n = Number(rk);
    if (n > 0) return n;
  }
  const bid = slot.booking_id;
  if (bid != null && typeof bid === "number" && Number.isFinite(bid) && bid > 0) return bid;
  if (typeof bid === "string") {
    const t = bid.trim();
    if (/^\d+$/.test(t)) {
      const n = parseInt(t, 10);
      if (n > 0) return n;
    }
  }
  return null;
}

const DEFAULT_TIME_SLOTS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

/** External bookings keep their own colour on staff calendars; labs can change it under Calendar colours. */
export const EXTERNAL_BOOKED_COLOR = "#2563eb";

export interface LabCalendarSelection {
  selectedIds: ReadonlySet<number>;
  canSelect: (slot: LabCalendarSlot) => boolean;
  onToggle: (slot: LabCalendarSlot) => void;
}

export interface LabOperatorWeekCalendarGridProps {
  weekStartIso: string;
  equipmentTitle: string;
  slotsPayload: LabWeekCalendarSlotsPayload | null;
  onBookedSlotClick: (bookingId: number) => void;
  /** When true, only time rows and weekdays that have at least one BOOKED slot; other cells are muted placeholders. */
  bookedSlotsOnly?: boolean;
  /** Controls shown on the right of the equipment name (stacked under it on narrow screens). */
  headerActions?: ReactNode;
  /** OIC: free slots can be picked to block or open them (Change slot status rules). */
  selection?: LabCalendarSelection;
}

function buildRowKeysAndLabels(slotsPayload: LabWeekCalendarSlotsPayload): { key: string; label: string }[] {
  const dailySlots = slotsPayload.slots ?? [];

  const getTimeSlotsFromDailySlots = (): string[] => {
    const uniqueTimes = new Set<string>();
    dailySlots.forEach((slot) => {
      const tk = timeKeyFromDailySlot(slot);
      if (tk) uniqueTimes.add(tk);
    });
    const sorted = Array.from(uniqueTimes).sort();
    return sorted.length > 0 ? sorted : [];
  };

  const fromSlotMasters =
    slotsPayload.slot_master_times && slotsPayload.slot_master_times.length > 0
      ? [
          ...new Set(
            slotsPayload.slot_master_times.map((t) => normalizeSlotGridTimeKey(formatTimeForDisplay(String(t))))
          ),
        ]
          .filter(Boolean)
          .sort()
      : [];
  const fromSlots = getTimeSlotsFromDailySlots();
  const fromWindow = getTimeSlotsFromEquipmentWindow(
    slotsPayload.slot_start_time,
    slotsPayload.slot_end_time,
    slotsPayload.slot_duration_minutes || 60
  );
  const timeSlots =
    fromSlotMasters.length > 0
      ? fromSlotMasters
      : fromSlots.length > 0
        ? fromSlots
        : fromWindow.length > 0
          ? fromWindow
          : DEFAULT_TIME_SLOTS;
  const endTimes = slotRowEndTimes(dailySlots, timeKeyFromDailySlot, (slot) =>
    normalizeSlotGridTimeKey(slotWallTimeFromStartDatetime(slot.end_datetime))
  );
  return timeSlots.map((t) => ({
    key: t,
    label: slotTimeRangeLabel(t, endTimes.get(t), slotsPayload.slot_duration_minutes),
  }));
}

/**
 * Weekly grid for Lab Operator / OIC dashboards and the staff app, in the same look as the booking screen.
 * Booked cells show the booking ID and user and open the booking; an OIC can also pick free slots.
 */
export function LabOperatorWeekCalendarGrid({
  weekStartIso,
  equipmentTitle,
  slotsPayload,
  onBookedSlotClick,
  bookedSlotsOnly = false,
  headerActions,
  selection,
}: LabOperatorWeekCalendarGridProps) {
  const currentWeekStart = parseISO(weekStartIso.length >= 10 ? weekStartIso.slice(0, 10) : weekStartIso);

  const slotIndex = useMemo(() => {
    const m = new Map<string, LabCalendarSlot>();
    const daily = slotsPayload?.slots ?? [];
    for (const slot of daily) {
      const dateStr = calendarDateStrFromSlot(slot);
      const timeKey = timeKeyFromDailySlot(slot);
      if (!dateStr || !timeKey) continue;
      m.set(`${dateStr}|${timeKey}`, slot);
    }
    return m;
  }, [slotsPayload]);

  const getSlotData = useMemo(() => {
    return (day: Date, timeOrSlotKey: string) => {
      const expectedDateStr = format(startOfDay(day), "yyyy-MM-dd");
      const timeKey = normalizeSlotGridTimeKey(timeOrSlotKey);
      return slotIndex.get(`${expectedDateStr}|${timeKey}`);
    };
  }, [slotIndex]);

  const allRows = useMemo(() => {
    if (!slotsPayload) return [];
    return buildRowKeysAndLabels(slotsPayload);
  }, [slotsPayload]);

  const rowsToRender = useMemo(() => {
    if (!bookedSlotsOnly) return allRows;
    return allRows.filter((row) => {
      for (let d = 0; d < 7; d++) {
        const day = addDays(currentWeekStart, d);
        const s = getSlotData(day, row.key);
        if (s && String(s.status).toUpperCase() === "BOOKED") return true;
      }
      return false;
    });
  }, [bookedSlotsOnly, allRows, currentWeekStart, getSlotData]);

  const visibleDayOffsets = useMemo(() => {
    if (!bookedSlotsOnly) return [0, 1, 2, 3, 4, 5, 6];
    const set = new Set<number>();
    for (const row of rowsToRender) {
      for (let d = 0; d < 7; d++) {
        const day = addDays(currentWeekStart, d);
        const s = getSlotData(day, row.key);
        if (s && String(s.status).toUpperCase() === "BOOKED") set.add(d);
      }
    }
    return [0, 1, 2, 3, 4, 5, 6].filter((i) => set.has(i));
  }, [bookedSlotsOnly, rowsToRender, currentWeekStart, getSlotData]);

  const palette = useMemo(() => slotCalendarPalette(slotsPayload?.calendar_colors), [slotsPayload]);
  const holidays = slotsPayload?.holidays || {};

  const heading = (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <h4 className="min-w-0 text-sm font-semibold tracking-tight text-foreground">{equipmentTitle}</h4>
      {headerActions ? (
        <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">{headerActions}</div>
      ) : null}
    </div>
  );

  const emptyMessage = !slotsPayload
    ? `No slot data for ${equipmentTitle}.`
    : allRows.length === 0
      ? `No time rows for ${equipmentTitle} this week.`
      : bookedSlotsOnly && rowsToRender.length === 0
        ? "No booked slots this week for this equipment."
        : null;

  if (emptyMessage) {
    return (
      <div className="space-y-2">
        {heading}
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{emptyMessage}</div>
      </div>
    );
  }

  const now = new Date();

  const renderCell = (day: Date, rowKey: string, rowLabel: string) => {
    const slotData = getSlotData(day, rowKey);
    const slotStatusUpper = String(slotData?.status ?? "").toUpperCase();
    const dateStr = format(day, "yyyy-MM-dd");

    if (bookedSlotsOnly && slotStatusUpper !== "BOOKED") {
      return (
        <div
          className="flex min-h-[48px] items-center justify-center rounded-md border-2 border-transparent bg-muted/20 p-2 text-sm font-medium text-muted-foreground/35"
          aria-hidden
        >
          —
        </div>
      );
    }

    const display = resolveSlotCell({ slot: slotData, day, holiday: holidays[dateStr], palette, now, staffView: true });
    const bookingPk = resolveSlotBookingPk(slotData);
    const displayRef =
      slotData?.booking_id != null && String(slotData.booking_id).trim() !== ""
        ? String(slotData.booking_id).trim()
        : bookingPk != null
          ? String(bookingPk)
          : "";
    const userName = String(slotData?.booking_user_name || "").trim();
    const isOpenBooking = slotStatusUpper === "BOOKED" && display.kind === "booked";

    let background = display.background;
    let content: ReactNode = display.label;
    if (isOpenBooking && slotData) {
      const bookingSt = String(slotData.booking_status || "").toUpperCase();
      if (bookingSt !== "CANCELLED" && bookingSt !== "REFUNDED") {
        const isExternal = slotData.booking_is_external === true || isExternalBookingUserType(slotData.booking_user_type);
        background = isExternal
          ? palette.slotColors.BOOKED_EXTERNAL || EXTERNAL_BOOKED_COLOR
          : palette.slotColors.BOOKED_INTERNAL || palette.slotColors.BOOKED;
      }
      if (displayRef || userName) {
        content = (
          <span className="flex w-full min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 text-center leading-tight">
            {displayRef ? (
              <span className="w-full truncate text-[11px] font-extrabold tracking-tight sm:text-xs">{displayRef}</span>
            ) : null}
            {userName ? <span className="w-full truncate text-[10px] font-medium opacity-95 sm:text-[11px]">{userName}</span> : null}
          </span>
        );
      }
    }
    const style = slotCellStyle({ background, color: contrastTextColor(background) });

    const canOpenBooking = slotStatusUpper === "BOOKED" && bookingPk != null;
    if (canOpenBooking && slotData) {
      const deptName = String(slotData.booking_user_department_name || slotData.booking_user_department_code || "").trim();
      const bookingStatusText = String(
        slotData.booking_status_display || slotData.booking_status || display.label || ""
      ).trim();
      const sampleStatusText = String(slotData.booking_sample_status_display || "").trim();
      const start = slotData.start_datetime ? parseIsoDateAndTime(slotData.start_datetime).timeStr : rowLabel;
      const end = slotData.end_datetime ? parseIsoDateAndTime(slotData.end_datetime).timeStr : "";
      const slotTimeText = start && end ? `${start} – ${end}` : start || rowLabel || "";
      const tooltipLines = [
        displayRef ? `Booking ID: ${displayRef}` : null,
        userName ? `User: ${userName}` : null,
        deptName ? `Department: ${deptName}` : null,
        bookingStatusText ? `Status: ${bookingStatusText}` : null,
        slotTimeText ? `Slot: ${slotTimeText}` : null,
        sampleStatusText ? `Sample: ${sampleStatusText}` : null,
        equipmentTitle ? `Equipment: ${equipmentTitle}` : null,
      ].filter((line): line is string => Boolean(line));
      return (
        <button
          type="button"
          aria-label={tooltipLines.join(". ")}
          onClick={() => onBookedSlotClick(bookingPk)}
          className={cn(
            SLOT_CELL_CLASS,
            "group relative cursor-pointer transition-all hover:-translate-y-px hover:shadow-md hover:ring-2 hover:ring-primary/35",
          )}
          style={style}
        >
          {content}
          <span
            className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-30 hidden w-max max-w-[16rem] -translate-x-1/2 rounded-lg border border-border/80 bg-card px-3 py-2 text-left text-[11px] font-normal leading-snug text-foreground shadow-lg group-hover:block group-focus-visible:block"
            role="tooltip"
          >
            {tooltipLines.map((line) => (
              <span key={line} className="block whitespace-nowrap">
                {line}
              </span>
            ))}
          </span>
        </button>
      );
    }

    if (selection && slotData && selection.canSelect(slotData)) {
      const selected = selection.selectedIds.has(slotData.id);
      const when = `${format(day, "EEE d MMM")}, ${rowLabel}`;
      return (
        <button
          type="button"
          aria-pressed={selected}
          aria-label={`${when}: ${display.label}${selected ? ", selected" : ""}`}
          title={display.hover}
          onClick={() => selection.onToggle(slotData)}
          className={cn(
            SLOT_CELL_CLASS,
            "cursor-pointer transition-all hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            selected && SLOT_CELL_SELECTED_CLASS,
          )}
          style={selected ? undefined : style}
        >
          {selected ? (
            <>
              <Check className="mr-1 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">Selected</span>
            </>
          ) : (
            content
          )}
        </button>
      );
    }

    return (
      <div className={SLOT_CELL_CLASS} style={style} title={display.hover}>
        {content}
      </div>
    );
  };

  const rowLabels = new Map(rowsToRender.map((row) => [row.key, row.label]));

  return (
    <div className="space-y-2">
      {heading}
      <div className="rounded-xl border border-border/70 bg-card/40 p-2 shadow-sm sm:p-3">
        <SlotWeekGrid
          weekStart={currentWeekStart}
          rows={rowsToRender}
          dayOffsets={visibleDayOffsets}
          renderCell={(day, rowKey) => renderCell(day, rowKey, rowLabels.get(rowKey) ?? rowKey)}
          renderRowLabel={(row) => (
            <div className="sticky left-0 z-10 flex items-center whitespace-nowrap rounded-md bg-muted/90 p-2 text-xs font-medium tabular-nums dark:bg-background/95 sm:text-sm">
              {row.label}
            </div>
          )}
          singleDayOnMobile
          dayHasFreeSlot={(day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            return (slotsPayload?.slots ?? []).some(
              (s) =>
                calendarDateStrFromSlot(s) === dateStr &&
                String(s.status).toUpperCase() === "AVAILABLE" &&
                !isSlotInPast(s, now),
            );
          }}
        />
      </div>
    </div>
  );
}

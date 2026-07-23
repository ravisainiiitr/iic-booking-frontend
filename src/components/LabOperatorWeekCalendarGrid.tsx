import { useMemo, type CSSProperties } from "react";
import { addDays, format, parseISO, startOfDay } from "date-fns";
import type { LabCalendarSlot, LabWeekCalendarSlotsPayload } from "@/lib/labOperatorCalendarTypes";
import { isExternalBookingUserType } from "@/lib/userTypes";

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

function getContrastTextColor(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#1f2937" : "#ffffff";
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

const DEFAULT_SLOT_COLORS: Record<string, string> = {
  AVAILABLE: "#22c55e",
  BOOKED: "#ef4444",
  BOOKED_INTERNAL: "#ef4444",
  BOOKED_EXTERNAL: "#0284c7",
  COMPLETED: "#059669",
  BLOCKED: "#64748b",
  UNDER_MAINTENANCE: "#f97316",
  OPERATOR_ABSENT: "#eab308",
  BOOKING_NOT_UTILIZED: "#a855f7",
  HOLD: "#f59e0b",
  NOT_AVAILABLE: "#e2e8f0",
};

export interface LabOperatorWeekCalendarGridProps {
  weekStartIso: string;
  equipmentTitle: string;
  slotsPayload: LabWeekCalendarSlotsPayload | null;
  onBookedSlotClick: (bookingId: number) => void;
  /** When true, only time rows and weekdays that have at least one BOOKED slot; other cells are muted placeholders. */
  bookedSlotsOnly?: boolean;
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
  return timeSlots.map((t) => ({
    key: t,
    label: t,
  }));
}

/**
 * Read-only weekly grid aligned with Book Equipment Step 3: Select Time Slots (time rows × Mon–Sun).
 */
export function LabOperatorWeekCalendarGrid({
  weekStartIso,
  equipmentTitle,
  slotsPayload,
  onBookedSlotClick,
  bookedSlotsOnly = false,
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

  const slotColors = useMemo(
    () => ({
      ...DEFAULT_SLOT_COLORS,
      ...(slotsPayload?.calendar_colors?.slot_colors || {}),
    }),
    [slotsPayload]
  );
  const holidayDefault = slotsPayload?.calendar_colors?.holiday_default || "#f59e0b";
  const saturdayColor = slotsPayload?.calendar_colors?.saturday_color || "#c7d2fe";
  const sundayColor = slotsPayload?.calendar_colors?.sunday_color || "#fbcfe8";
  const holidays = slotsPayload?.holidays || {};

  const gridColsStyle: CSSProperties = {
    gridTemplateColumns: `minmax(5rem, 6.5rem) repeat(${visibleDayOffsets.length}, minmax(0, 1fr))`,
  };

  if (!slotsPayload) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No slot data for {equipmentTitle}.
      </div>
    );
  }

  if (allRows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No time rows for {equipmentTitle} this week.
      </div>
    );
  }

  if (bookedSlotsOnly && rowsToRender.length === 0) {
    return (
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">{equipmentTitle}</h4>
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No booked slots this week for this equipment.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-foreground">{equipmentTitle}</h4>
      <div className="overflow-x-auto relative">
        <div className={bookedSlotsOnly ? "min-w-[320px]" : "min-w-[800px]"}>
          <div className="grid gap-2 mb-2" style={gridColsStyle}>
            <div className="font-semibold text-sm p-2">Time</div>
            {visibleDayOffsets.map((dayOffset) => {
              const day = addDays(currentWeekStart, dayOffset);
              return (
                <div key={dayOffset} className="font-semibold text-sm p-2 text-center">
                  <div>{format(day, "EEE")}</div>
                  <div className="text-muted-foreground">{format(day, "MMM dd")}</div>
                </div>
              );
            })}
          </div>

          {rowsToRender.map((row) => {
            const rowKey = row.key;
            const rowLabel = row.label;
            return (
              <div key={rowKey} className="grid gap-2 mb-2" style={gridColsStyle}>
                <div className="text-sm p-2 font-medium flex items-center">{rowLabel}</div>
                {visibleDayOffsets.map((dayOffset) => {
                  const day = addDays(currentWeekStart, dayOffset);
                  const slotData = getSlotData(day, rowKey);
                  const slotExists = slotData !== undefined;
                  const slotStatus = slotData?.status ?? "";
                  const slotStatusUpper = String(slotStatus || "").toUpperCase();
                  const dateStr = format(day, "yyyy-MM-dd");
                  const dayOfWeekJs = day.getDay();
                  const rawHoliday = holidays[dateStr];
                  const holidayLabel =
                    typeof rawHoliday === "string"
                      ? rawHoliday
                      : rawHoliday && typeof rawHoliday === "object" && "label" in rawHoliday
                        ? (rawHoliday as { label: string }).label
                        : undefined;
                  const holidayColor =
                    typeof rawHoliday === "object" &&
                    rawHoliday !== null &&
                    "color" in rawHoliday &&
                    (rawHoliday as { color?: string }).color
                      ? (rawHoliday as { color: string }).color
                      : undefined;
                  const holidayName = holidayLabel;
                  const hasBookedStatus = slotStatus === "BOOKED" || slotStatus === "BOOKING_NOT_UTILIZED";
                  const bookingStatusDisplay = hasBookedStatus
                    ? (slotData?.booking_status_display ?? null)
                    : null;
                  const bookingPk = resolveSlotBookingPk(slotData);

                  if (bookedSlotsOnly && slotStatusUpper !== "BOOKED") {
                    return (
                      <div
                        key={dayOffset}
                        className="p-3 rounded-md text-sm min-h-[48px] flex items-center justify-center font-medium border-2 border-transparent text-muted-foreground/35 bg-muted/20"
                        aria-hidden
                      >
                        —
                      </div>
                    );
                  }

                  let rawSlotStatusLabel = slotData?.status_display || "";
                  if (!rawSlotStatusLabel && slotStatus) {
                    const statusMap: Record<string, string> = {
                      AVAILABLE: "Available",
                      NOT_AVAILABLE: "Not Available",
                      BOOKED: "Booked",
                      BLOCKED: "Blocked",
                      UNDER_MAINTENANCE: "Under Maintenance",
                      OPERATOR_ABSENT: "Operator Absent",
                      BOOKING_NOT_UTILIZED: "Booking Not Utilized",
                      HOLD: "Hold",
                    };
                    rawSlotStatusLabel =
                      statusMap[slotStatus] ||
                      slotStatus.charAt(0).toUpperCase() + slotStatus.slice(1).toLowerCase();
                  }
                  let slotStatusLabel = rawSlotStatusLabel;
                  const displayRef =
                    slotData?.booking_id != null && String(slotData.booking_id).trim() !== ""
                      ? String(slotData.booking_id).trim()
                      : bookingPk != null
                        ? String(bookingPk)
                        : "";
                  if (slotStatus === "BOOKED" && displayRef) {
                    slotStatusLabel = `${rawSlotStatusLabel} #${displayRef}`;
                  }
                  if (slotStatus === "BLOCKED") {
                    slotStatusLabel = slotData?.blocked_label || "Blocked";
                  }
                  const slotDisplayLabel = bookingStatusDisplay || slotStatusLabel;

                  let displayStatus = holidayName || "—";
                  const considerBooked = hasBookedStatus;

                  if (slotExists) {
                    if (considerBooked) {
                      // Dashboard requirement: BOOKED cells show the user's name (not booking ref/status).
                      if (slotStatusUpper === "BOOKED" && slotData?.booking_user_name) {
                        const deptCode = String(slotData?.booking_user_department_code || "").trim();
                        displayStatus = deptCode
                          ? (
                              <span className="flex flex-col items-center justify-center leading-tight">
                                <span>{slotData.booking_user_name}</span>
                                <span className="text-[11px] opacity-90">{deptCode}</span>
                              </span>
                            )
                          : slotData.booking_user_name;
                      } else {
                        displayStatus = slotDisplayLabel || slotStatusLabel || "Unavailable";
                      }
                    } else {
                      displayStatus = slotDisplayLabel || slotStatusLabel || "—";
                    }
                  } else {
                    displayStatus = holidayName || "—";
                  }

                  const statusOverridesHolidayBg =
                    slotExists && slotStatusUpper !== "" && slotStatusUpper !== "NOT_AVAILABLE";
                  const useHolidayBg = Boolean(
                    holidayColor && !considerBooked && !statusOverridesHolidayBg
                  );
                  const isWeekendCell = !slotExists && (dayOfWeekJs === 6 || dayOfWeekJs === 0);

                  let cellStyle: CSSProperties | undefined;
                  if (useHolidayBg && holidayColor && !isWeekendCell) {
                    cellStyle = { backgroundColor: holidayColor, color: getContrastTextColor(holidayColor) };
                  } else if (slotExists) {
                    let statusForColor = slotStatus;
                    if (slotStatus === "NOT_AVAILABLE") statusForColor = "NOT_AVAILABLE";
                    else if (slotStatus === "BOOKED" && slotData?.booking_status)
                      statusForColor = String(slotData.booking_status).toUpperCase();
                    // Distinguish internal vs external bookers on booked cells.
                    if (considerBooked && (statusForColor === "BOOKED" || slotStatusUpper === "BOOKED")) {
                      const isExt =
                        slotData?.booking_is_external === true ||
                        isExternalBookingUserType(slotData?.booking_user_type);
                      statusForColor = isExt ? "BOOKED_EXTERNAL" : "BOOKED_INTERNAL";
                    }
                    const st = statusForColor || "AVAILABLE";
                    const bg =
                      slotColors[st] ??
                      (st === "BOOKED_EXTERNAL"
                        ? slotColors.BOOKED_EXTERNAL || DEFAULT_SLOT_COLORS.BOOKED_EXTERNAL
                        : considerBooked
                          ? slotColors.BOOKED
                          : slotColors.AVAILABLE);
                    cellStyle = { backgroundColor: bg, color: getContrastTextColor(bg) };
                  } else {
                    const bg =
                      dayOfWeekJs === 6
                        ? saturdayColor
                        : dayOfWeekJs === 0
                          ? sundayColor
                          : holidayColor || holidayDefault;
                    cellStyle = { backgroundColor: bg, color: getContrastTextColor(bg) };
                  }

                  const canOpenBooking = slotStatusUpper === "BOOKED" && bookingPk != null;
                  const hoverBookingRef =
                    slotStatusUpper === "BOOKED"
                      ? (slotData?.booking_id != null && String(slotData.booking_id).trim() !== ""
                          ? String(slotData.booking_id).trim()
                          : bookingPk != null
                            ? String(bookingPk)
                            : "")
                      : "";
                  const hoverTitle = hoverBookingRef ? `Booking: ${hoverBookingRef}` : undefined;

                  return (
                    <button
                      key={dayOffset}
                      type="button"
                      title={hoverTitle}
                      onClick={() => {
                        if (canOpenBooking) onBookedSlotClick(bookingPk);
                      }}
                      disabled={!canOpenBooking}
                      className={`
                          p-3 rounded-md text-sm transition-all min-h-[48px] flex items-center justify-center font-medium border-2 border-white/50 shadow-sm
                          ${!slotExists ? "cursor-default" : ""}
                          ${canOpenBooking ? "cursor-pointer hover:opacity-90 hover:ring-2 hover:ring-violet-400/60" : ""}
                          ${!canOpenBooking && slotExists ? "cursor-default" : ""}
                        `}
                      style={cellStyle}
                    >
                      {displayStatus}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

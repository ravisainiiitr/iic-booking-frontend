import { format, parseISO } from "date-fns";
import { holidayCellLabel, holidayHoverText, isWeekendLabel } from "@/lib/holidayDisplay";
import { isCompletedSlot, type SlotStatusFields } from "@/lib/slotDisplayStatus";

/**
 * One look for every slot calendar (booking screen, availability, change slot status, dashboards):
 * the booking screen's colours, labels and closed-day rules. Admin-configured calendar colours override the defaults.
 */
export const SLOT_CALENDAR_DEFAULT_COLORS: Record<string, string> = {
  AVAILABLE: "#22c55e",
  BOOKED: "#ef4444",
  COMPLETED: "#059669",
  BLOCKED: "#64748b",
  UNDER_MAINTENANCE: "#f97316",
  SCHEDULED_MAINT: "#fcd34d",
  OPERATOR_ABSENT: "#eab308",
  BOOKING_NOT_UTILIZED: "#a855f7",
  HOLD: "#f59e0b",
  HOME_DEPARTMENT_ONLY: "#c4b5fd",
  NON_HOME_RESERVED: "#06b6d4",
  RESERVED_EXTERNAL: "#f0abfc",
  NOT_AVAILABLE: "#e2e8f0",
};

/** A past slot that was open and nobody booked. */
export const NO_BOOKING_LABEL = "No booking";
export const NO_BOOKING_COLOR = "#94a3b8";

const DEFAULT_HOLIDAY_COLOR = "#f59e0b";
const DEFAULT_SATURDAY_COLOR = "#c7d2fe";
const DEFAULT_SUNDAY_COLOR = "#fbcfe8";

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Available",
  NOT_AVAILABLE: "Not Available",
  BOOKED: "Booked",
  BLOCKED: "Other Reasons",
  UNDER_MAINTENANCE: "Under Maintenance",
  SCHEDULED_MAINT: "Scheduled Maintenance",
  OPERATOR_ABSENT: "Operator Absent",
  BOOKING_NOT_UTILIZED: "Booking Not Utilized",
  HOLD: "On Hold",
  RESERVED_EXTERNAL: "Reserved (External)",
};

export interface CalendarColorsInput {
  slot_colors?: Record<string, string> | null;
  holiday_default?: string | null;
  saturday_color?: string | null;
  sunday_color?: string | null;
}

export interface SlotCalendarPalette {
  slotColors: Record<string, string>;
  holiday: string;
  saturday: string;
  sunday: string;
}

export function slotCalendarPalette(colors?: CalendarColorsInput | null): SlotCalendarPalette {
  return {
    slotColors: { ...SLOT_CALENDAR_DEFAULT_COLORS, ...(colors?.slot_colors || {}) },
    holiday: colors?.holiday_default || DEFAULT_HOLIDAY_COLOR,
    saturday: colors?.saturday_color || DEFAULT_SATURDAY_COLOR,
    sunday: colors?.sunday_color || DEFAULT_SUNDAY_COLOR,
  };
}

/** Dark or white text, whichever reads better on the given hex background. */
export function contrastTextColor(background: string): string {
  let hex = String(background || "").trim().replace(/^#/, "");
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  const n = parseInt(hex.slice(0, 6), 16);
  if (hex.length < 6 || Number.isNaN(n)) return "#1f2937";
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? "#1f2937" : "#ffffff";
}

/** The slots API sends each holiday as its name, or as `{ label, color }`. */
export type HolidayEntry = string | { label?: string | null; color?: string | null } | null | undefined;

export function holidayEntryInfo(raw: HolidayEntry): { name?: string; color?: string } {
  if (!raw) return {};
  if (typeof raw === "string") return raw.trim() ? { name: raw.trim() } : {};
  return {
    name: raw.label?.trim() || undefined,
    color: raw.color?.trim() || undefined,
  };
}

export interface SlotDisplayFields extends SlotStatusFields {
  status_display?: string | null;
  booking_status_display?: string | null;
  blocked_label?: string | null;
  start_datetime?: string | null;
  home_department_only?: boolean | null;
  mode_overlay_color?: string | null;
}

export type SlotCellKind =
  | "available"
  | "reserved"
  | "booked"
  | "completed"
  | "not-utilized"
  | "no-booking"
  | "closed-day"
  | "blocked"
  | "unavailable"
  | "empty";

export interface SlotCellDisplay {
  kind: SlotCellKind;
  label: string;
  background: string;
  color: string;
  /** Plain-language hover text for closed days (holiday name, weekend). */
  hover?: string;
}

export function isSlotInPast(slot: Pick<SlotDisplayFields, "start_datetime"> | null | undefined, now: Date = new Date()): boolean {
  if (!slot?.start_datetime) return false;
  try {
    const start = parseISO(slot.start_datetime);
    return !Number.isNaN(start.getTime()) && start < now;
  } catch {
    return false;
  }
}

/** True for a past slot that was Available and has no booking: it is shown as "No booking". */
export function isPastUnbookedSlot(slot: SlotDisplayFields | null | undefined, now: Date = new Date()): boolean {
  return String(slot?.status || "").toUpperCase() === "AVAILABLE" && isSlotInPast(slot, now);
}

export interface ResolveSlotCellInput {
  slot: SlotDisplayFields | null | undefined;
  day: Date;
  holiday?: HolidayEntry;
  palette: SlotCalendarPalette;
  now?: Date;
  /** Staff calendars name the booking status and "Booking Not Utilized"; user calendars just say Booked. */
  staffView?: boolean;
}

function cell(kind: SlotCellKind, label: string, background: string, hover?: string): SlotCellDisplay {
  return { kind, label, background, color: contrastTextColor(background), hover };
}

/** Label and colours of one calendar cell, following the booking screen's rules. */
export function resolveSlotCell({ slot, day, holiday, palette, now = new Date(), staffView = false }: ResolveSlotCellInput): SlotCellDisplay {
  const colors = palette.slotColors;
  const { name: holidayName, color: holidayColor } = holidayEntryInfo(holiday);
  const dow = day.getDay();
  const isWeekend = dow === 0 || dow === 6;
  const isNamedHoliday = Boolean(holidayName && !isWeekendLabel(holidayName));
  const closedDay = Boolean(holidayName) || isWeekend;
  const closedBg =
    holidayColor ||
    (isNamedHoliday ? palette.holiday : dow === 6 ? palette.saturday : dow === 0 ? palette.sunday : palette.holiday);
  const closedLabel = holidayName ? holidayCellLabel(holidayName) : format(day, "EEEE");
  const closedHover = holidayName ? holidayHoverText(holidayName) : `Weekend (${format(day, "EEEE")})`;

  if (!slot) {
    return closedDay ? cell("closed-day", closedLabel, closedBg, closedHover) : cell("empty", "—", colors.NOT_AVAILABLE);
  }

  const status = String(slot.status || "").toUpperCase();
  if (isCompletedSlot(slot)) return cell("completed", "Completed", colors.COMPLETED);
  if (status === "BOOKED") {
    const bookingStatus = String(slot.booking_status || "").toUpperCase();
    const bg = (bookingStatus && colors[bookingStatus]) || colors.BOOKED;
    return cell("booked", staffView ? slot.booking_status_display || "Booked" : "Booked", bg);
  }
  if (status === "BOOKING_NOT_UTILIZED") {
    return staffView
      ? cell("not-utilized", STATUS_LABELS.BOOKING_NOT_UTILIZED, colors.BOOKING_NOT_UTILIZED)
      : cell("booked", "Booked", colors.BOOKED);
  }
  if (status === "NOT_AVAILABLE" && closedDay) return cell("closed-day", closedLabel, closedBg, closedHover);
  if (status === "AVAILABLE") {
    if (isSlotInPast(slot, now)) return cell("no-booking", NO_BOOKING_LABEL, NO_BOOKING_COLOR);
    const display = slot.status_display || "";
    if (display === "Reserved for other departments" || (slot.home_department_only && !display)) {
      return cell("reserved", display || "Reserved", colors.NON_HOME_RESERVED);
    }
    if (display === "Home department only") return cell("reserved", display, colors.HOME_DEPARTMENT_ONLY);
    return cell("available", "Available", slot.mode_overlay_color || colors.AVAILABLE);
  }
  if (status === "BLOCKED") return cell("blocked", slot.blocked_label || STATUS_LABELS.BLOCKED, colors.BLOCKED);
  return cell(
    "unavailable",
    slot.status_display || STATUS_LABELS[status] || "Not Available",
    colors[status] || colors.NOT_AVAILABLE,
  );
}

export interface SlotLegendItem {
  label: string;
  color: string;
}

/** Legend shared by every slot calendar. */
export function slotCalendarLegend(palette: SlotCalendarPalette): SlotLegendItem[] {
  const c = palette.slotColors;
  return [
    { label: "Available", color: c.AVAILABLE },
    { label: "Booked", color: c.BOOKED },
    { label: "Completed", color: c.COMPLETED },
    { label: NO_BOOKING_LABEL, color: NO_BOOKING_COLOR },
    { label: "Maintenance", color: c.UNDER_MAINTENANCE },
    { label: "Scheduled maintenance", color: c.SCHEDULED_MAINT ?? SLOT_CALENDAR_DEFAULT_COLORS.SCHEDULED_MAINT },
    { label: "Other reasons", color: c.BLOCKED },
    { label: "Reserved (External)", color: c.RESERVED_EXTERNAL ?? SLOT_CALENDAR_DEFAULT_COLORS.RESERVED_EXTERNAL },
    { label: "Not available", color: c.NOT_AVAILABLE },
    { label: "Saturday", color: palette.saturday },
    { label: "Sunday", color: palette.sunday },
    { label: "Holiday", color: palette.holiday },
  ];
}

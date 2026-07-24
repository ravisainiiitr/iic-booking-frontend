import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { flushSync } from "react-dom";
import type { CSSProperties } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiClient, type PrintMaterial } from "@/lib/api";
import { setPostLoginRedirect } from "@/lib/authRedirect";
import {
  classifyEquipmentAccessFailure,
  notifyEquipmentAccessFailure,
} from "@/lib/equipmentAccess";
import {
  readProformaLineItemsFromStorage,
  writeProformaLineItemsToStorage,
  inputValuesForProformaStorage,
  mergeProformaLineIntoInputFieldValues,
  type ProformaLineItemStored,
  type ProformaLineItemField,
} from "@/lib/proformaInvoiceStorage";
import { exportWalletTransactionsExcel, exportWalletTransactionsPdf } from "@/lib/walletTransactionExport";
import {
  formatNumericBound,
  formatStepAttr,
  initialNumericFieldValue,
  isNumericInputDraft,
  isNumericValueWithinBounds,
  nudgeNumericValue,
  numericFieldAllowsNegative,
  resolveNumericFieldBounds,
  roundToStepPrecision,
} from "@/lib/numericFieldLimits";
import { formatINR } from "@/lib/money";
import {
  slotsNeededForAnalysisTime,
} from "@/lib/slotAllocation";
import {
  CHARGE_ESTIMATE_USER_TYPE_OPTIONS,
  getChargeEstimateUserTypeLabel,
  isEndUserBookingType,
  isExternalBookingUserType,
  normalizeUserTypeCode,
  getUserTypeDisplayName,
} from "@/lib/userTypes";
import { Print3DBookingPanel, type Print3DBookingValues, PRINT_3D_TENTATIVE_CHARGE_NOTE } from "@/components/Print3DBookingPanel";
import { EquipmentAccessoriesSection } from "@/components/EquipmentAccessoriesSection";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Check, Circle, Plus, Minus, Trash2, Mail, Receipt, ExternalLink, ShieldCheck, Download, FileSpreadsheet, FileText, ChevronDown, ChevronUp, Wallet, Info } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import EquipmentDepartmentLabel from "@/components/EquipmentDepartmentLabel";
import { BookingDetailCard, type BookingDetailCardBooking } from "@/components/BookingDetailCard";
import RescheduleSlotPicker from "@/components/RescheduleSlotPicker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { periodicTableElements, getCategoryColor, parsePeriodicHelpText, mergePeriodicDisplaySymbols, periodicSelectionChargeSummaryFromHelpText, type Element } from "@/data/periodicTableData";
import { cn } from "@/lib/utils";
import {
  resolveTableColumns,
  resolveTableRowCountSourceKey,
  syncTableRowsToCount,
  applyTableRowSyncToValues,
} from "@/lib/dynamicTableField";
import { normalizeChoiceOption } from "@/lib/dynamicFieldOptions";
import { getRealBookingId, type BookingRef } from "@/lib/bookingRef";
import { hasIncompleteOptionalEditableParams } from "@/lib/bookingInputValues";
import { toast } from "sonner";
import { format, addDays, startOfWeek, addWeeks, subWeeks, isSameDay, parseISO, startOfDay, startOfMonth, endOfMonth, addMonths, subMonths, eachDayOfInterval, isSameMonth, startOfYear, endOfYear, addYears, subYears } from "date-fns";
import { type EquipmentData } from "@/data/equipmentData";

interface Equipment extends EquipmentData {}

function splitCsvElements(raw: string): string[] {
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

/** Map arbitrary element strings (e.g. from standards CSV) to periodic-table symbols. */
function normalizeToPeriodicSymbols(rawSymbols: string[]): string[] {
  const seen = new Set<string>();
  for (const s of rawSymbols) {
    const t = String(s).trim();
    if (!t) continue;
    const el = periodicTableElements.find((e) => e.symbol.toUpperCase() === t.toUpperCase());
    if (el) seen.add(el.symbol);
  }
  return Array.from(seen);
}

interface DailySlot {
  id: number;
  slot_master: number;
  slot_number: number;
  slot_name: string;
  equipment_code: string;
  date: string;
  /** HH:mm:ss from SlotMaster.open_time — same source as slot_master_times; use for grid keys (start_datetime is TZ-aware ISO). */
  slot_open_time?: string | null;
  start_datetime: string;
  end_datetime: string;
  status: string;
  status_display?: string;
  blocked_label?: string | null;
  mode_overlay_color?: string | null;
  mode_overlay?: string | null;
  /** @deprecated Prefer available_for_external / status AVAILABLE; quota replaces reserved-for-external marking. */
  reserved_for_external?: boolean;
  /** True when only the equipment's home-department students/faculty may book (default false = any dept). */
  home_department_only?: boolean;
  /** True when slot is bookable by external users (AVAILABLE under external quota). */
  available_for_external?: boolean;
  /** Display booking id (may be virtual / CODE-pk). Prefer real_booking_id for API calls. */
  booking_id?: number | string | null;
  /** Numeric Booking PK for API paths. */
  real_booking_id?: number | null;
  booking_status?: string | null;
  booking_status_display?: string | null;
  /** Booker’s display name (when BOOKED). */
  booking_user_name?: string | null;
  booking_user_department_code?: string | null;
  booking_user_department_name?: string | null;
  /** Staff-only contact fields from slots API. */
  booking_user_email?: string | null;
  booking_user_phone?: string | null;
  created_at: string;
  updated_at: string;
}

interface EquipmentDetail {
  equipment_id: number;
  code: string;
  name: string;
  description: string;
  profile_type: string;
  profile_type_display: string;
  status: string;
  status_display: string;
  location: string;
  image_url: string;
  slot_duration_minutes?: number;
  /** Minutes of allowed overrun before an extra slot is required (0 = legacy ceil). */
  slot_tolerance_minutes?: number;
  /** User-defined slot window start (HH:mm or HH:mm:ss). Used for calendar time axis. */
  slot_start_time?: string | null;
  /** User-defined slot window end (HH:mm or HH:mm:ss). Used for calendar time axis. */
  slot_end_time?: string | null;
  /** Actual Slot Master open_time values (HH:mm:ss) - use these for calendar time axis to match user-defined timings. */
  slot_master_times?: string[];
  /** When 'SLOT_ID', weekly grid shows slot number/name on vertical axis; when 'TIME', shows time. */
  weekly_view_display?: 'TIME' | 'SLOT_ID';
  /** Slot masters (for SLOT_ID row labels). */
  slot_masters?: Array<{ slot_number: number; slot_name?: string; open_time?: string; close_time?: string; is_active?: boolean }>;
  split_booking_enabled?: boolean;
  daily_slots?: DailySlot[];
  /** Date string (YYYY-MM-DD) -> label string (legacy) or { label, color? } for calendar display */
  weekly_holidays?: Record<string, string | { label: string; color?: string }>;
  /** Admin-configured colors for weekly calendar (from slots API). */
  calendar_colors?: {
    slot_colors: Record<string, string>;
    holiday_default: string;
    saturday_color?: string;
    sunday_color?: string;
  };
  /** First date (YYYY-MM-DD) of visible slot window; null = no restriction. From slots API. */
  slot_window_min_date?: string | null;
  /** Last date (YYYY-MM-DD) of visible slot window; null = no restriction. From slots API. */
  slot_window_max_date?: string | null;
  /** Weekday (0=Mon … 6=Sun) when next week opens; for empty-state message. */
  slot_window_reference_weekday?: number | null;
  /** Time (HH:mm) when next week opens; for empty-state message. */
  slot_window_reference_time?: string | null;
  /** Peak window in minutes after slot window time for urgent log; configurable by Admin/OIC. */
  urgent_peak_window_minutes?: number | null;
  waitlist_queue_depth?: number;
  waitlist_current_count?: number;
  waitlist_has_room?: boolean;
  /** When true, booking UI may offer atmosphere-sensitive sample (submit at slot start). */
  atmosphere_sensitive_sample_enabled?: boolean;
  input_fields?: Array<any>;
  charge_profiles?: Array<any>;
  [key: string]: any;
}

interface TimeSlot {
  date: Date;
  time: string;
  isBooked: boolean;
  slotId?: number;
  slotData?: DailySlot;
}

// Fallback time slots when equipment window is not available (9:00 AM to 5:00 PM)
const DEFAULT_TIME_SLOTS = [
  "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"
];

// User type filter options for admin/OIC "Book for user" (matches backend UserType codes)
const USER_TYPE_FILTER_ALL = "__all__";
/** User types offered when booking on behalf. Staff + Other are intentionally excluded. */
const USER_TYPE_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: USER_TYPE_FILTER_ALL, label: "All types" },
  { value: "student", label: "IIT Roorkee Students" },
  { value: "individual_student", label: "Individual Student" },
  { value: "faculty", label: "IIT Roorkee Faculty" },
  { value: "external", label: "Educational Institute" },
  { value: "RND", label: "Govt R&D Organizations" },
  { value: "Industry", label: "Industry" },
  { value: "startup_incubated_iitr", label: "Startup Incubated at IIT Roorkee" },
  { value: "external_startup_msme", label: "External Startup/MSME" },
  { value: "finance", label: "Accounts In Charge" },
];

/** Parse "HH:mm" or "HH:mm:ss" to total minutes from midnight. */
function parseTimeToMinutes(timeStr: string): number {
  const parts = timeStr.trim().split(":");
  const h = parseInt(parts[0] || "0", 10);
  const m = parseInt(parts[1] || "0", 10);
  return h * 60 + m;
}

/** Convert HH:mm:ss to HH:mm for display. */
function formatTimeForDisplay(timeStr: string): string {
  return timeStr.substring(0, 5); // "09:30:00" -> "09:30"
}

/** Hover lines for booked slots on Change slot status week view (staff). */
function bookedSlotUserDetailLines(slot: DailySlot): string[] {
  if (String(slot.status || "").toUpperCase() !== "BOOKED" && !slot.booking_id) return [];
  const lines: string[] = [];
  const name = String(slot.booking_user_name || "").trim();
  if (name) lines.push(`Name: ${name}`);
  const deptName = String(slot.booking_user_department_name || "").trim();
  const deptCode = String(slot.booking_user_department_code || "").trim();
  if (deptName && deptCode) lines.push(`Department: ${deptName} (${deptCode})`);
  else if (deptName) lines.push(`Department: ${deptName}`);
  else if (deptCode) lines.push(`Department: ${deptCode}`);
  const email = String(slot.booking_user_email || "").trim();
  if (email) lines.push(`Email: ${email}`);
  const phone = String(slot.booking_user_phone || "").trim();
  if (phone) lines.push(`Mobile: ${phone}`);
  if (slot.booking_id != null && String(slot.booking_id).trim() !== "") {
    lines.push(`Booking ID: ${slot.booking_id}`);
  }
  return lines;
}

/** Start–end label for a slot row when weekly view shows time (e.g. "09:00 – 10:00"). */
function formatSlotRowTimeLabel(startTimeKey: string, durationMinutes: number): string {
  const start = normalizeSlotGridTimeKey(startTimeKey);
  if (!start.includes(":")) return start;
  const startM = parseTimeToMinutes(start);
  const duration = Math.max(1, durationMinutes || 60);
  const endM = startM + duration;
  const endH = Math.floor(endM / 60) % 24;
  const endMin = endM % 60;
  const end = `${String(endH).padStart(2, "0")}:${String(endMin).padStart(2, "0")}`;
  return `${start} – ${end}`;
}

/** Normalize grid row keys so "9:00" / "09:00:00" / ISO fragments all match `getSlotData` lookups. */
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

/** Format slot-window reference: weekday 0-6 + time HH:mm -> "Wednesday at 21:00" */
function formatSlotWindowReference(weekday: number, timeStr: string): string {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const day = days[Math.max(0, Math.min(6, weekday))] ?? "";
  const time = (timeStr || "").trim().substring(0, 5) || "";
  return `${day} at ${time}`;
}

/** Monday-start weeks that overlap [minDateStr, maxDateStr] from the slots API. */
function getAllowedWeeksFromSlotWindowBounds(minDateStr: string, maxDateStr: string): Date[] {
  const minDate = startOfDay(parseISO(minDateStr));
  const maxDate = startOfDay(parseISO(maxDateStr));
  const weeks: Date[] = [];
  let w = startOfWeek(minDate, { weekStartsOn: 1 });
  for (let i = 0; i < 52; i++) {
    const weekSunday = addDays(w, 6);
    if (w <= maxDate && weekSunday >= minDate) {
      weeks.push(w);
    }
    w = addWeeks(w, 1);
    if (w > maxDate) break;
  }
  return weeks;
}

/** Default value for a dynamic input field when equipment is loaded or booking form resets. */
function getInitialDynamicInputValue(
  field: any,
  allFields?: any[]
): string | boolean | string[] | number | string[][] {
  const fieldType = String(field.field_type || "").toUpperCase().trim();
  if (fieldType === "TOGGLE") {
    return field.default_value === "true" || field.default_value === true;
  }
  if (fieldType === "MULTI_SELECT") {
    return field.default_value ? field.default_value.split(",") : [];
  }
  if (fieldType === "PERIODIC_TABLE") {
    const count = field.default_value ? parseInt(String(field.default_value), 10) : 0;
    return isNaN(count) ? 0 : count;
  }
  if (fieldType === "ICPMS_STANDARD_COVERAGE") {
    return 0;
  }
  if (fieldType === "TABLE") {
    const sourceKey = resolveTableRowCountSourceKey(field, allFields);
    const { columns, hasSerialColumn } = resolveTableColumns(field.options, {
      rowCountDriven: Boolean(sourceKey),
    });
    const colCount = columns.length;
    if (!colCount) return [];
    if (!sourceKey) {
      const row = Array(colCount).fill("");
      if (hasSerialColumn) row[0] = "1";
      return [row];
    }
    // Row count driven by another field — start empty; sync fills from source value
    return [];
  }
  if (fieldType === "NUMERIC") {
    return initialNumericFieldValue(field);
  }
  if (fieldType === "RADIO" || fieldType === "COMBO") {
    if (field.default_value) return field.default_value;
    const opts = field.options;
    if (Array.isArray(opts) && opts.length > 0) {
      const first = opts[0];
      return String((first && typeof first === "object" && "value" in first) ? first.value : first);
    }
    return "";
  }
  return field.default_value || "";
}

function toFiniteNumber(value: unknown): number | undefined {
  if (value == null) return undefined;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : undefined;
}

function resolveDynamicMaxForFieldA(
  field: any,
  inputFieldValues: Record<string, string | boolean | string[] | number>,
  equipmentDetail?: EquipmentDetail | null,
  /** When true (external booking target), ignore options text / max_formula / options.max for field A. */
  skipConfiguredMax = false
): number | undefined {
  if (skipConfiguredMax) return undefined;
  const rawOptions = field?.options;
  const opts = rawOptions && typeof rawOptions === "object" && !Array.isArray(rawOptions)
    ? rawOptions as Record<string, unknown>
    : undefined;
  const formula = typeof opts?.max_formula === "string"
    ? opts.max_formula.trim()
    : (typeof rawOptions === "string"
      ? rawOptions.trim()
      : (Array.isArray(rawOptions) && rawOptions.length === 1 && typeof rawOptions[0] === "string"
        ? rawOptions[0].trim()
        : ""));
  if (formula) {
    let expr = formula;
    for (const token of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
      const tokenValue = toFiniteNumber(inputFieldValues[token]) ?? 0;
      expr = expr.replace(new RegExp(`\\b${token}\\b`, "g"), String(tokenValue));
    }
    const slotDuration = toFiniteNumber(equipmentDetail?.slot_duration_minutes) ?? 0;
    expr = expr.replace(/\bSLOT_DURATION_MINUTES\b/g, String(slotDuration));
    if (!/^[0-9+\-*/().\s]+$/.test(expr)) return undefined;
    try {
      // eslint-disable-next-line no-new-func
      const result = Function(`"use strict"; return (${expr});`)();
      const parsed = toFiniteNumber(result);
      return parsed !== undefined ? parsed : undefined;
    } catch {
      return undefined;
    }
  }
  return toFiniteNumber(opts?.max);
}

/**
 * True if "Request urgent booking" button should be shown.
 * When current weekday equals slot window (internal users) reference weekday, show only after 30 minutes past that time.
 */
function canShowRequestUrgentBookingButton(
  refWeekday: number | null | undefined,
  refTimeStr: string | null | undefined
): boolean {
  if (refWeekday == null || refTimeStr == null || refTimeStr.trim() === "") return true;
  const now = new Date();
  // JS getDay(): 0=Sun, 1=Mon, ... 6=Sat. Backend: 0=Mon, 1=Tue, ... 6=Sun.
  const jsDay = now.getDay();
  const backendWeekday = jsDay === 0 ? 6 : jsDay - 1;
  if (backendWeekday !== refWeekday) return true;
  const refMinutes = parseTimeToMinutes(refTimeStr);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes >= refMinutes + 30;
}

/** Extract date (yyyy-MM-dd) and time (HH:mm) from an ISO datetime string without timezone conversion. */
function parseIsoDateAndTime(isoStr: string): { dateStr: string; timeStr: string } {
  if (!isoStr || typeof isoStr !== "string") return { dateStr: "", timeStr: "" };
  const i = isoStr.indexOf("T");
  const dateStr = i >= 0 ? isoStr.substring(0, i) : isoStr.substring(0, 10);
  const timePart = i >= 0 ? isoStr.substring(i + 1) : "";
  const timeStr = timePart.length >= 5 ? timePart.substring(0, 5) : ""; // "11:30" from "11:30:00" or "11:30:00Z"
  return { dateStr, timeStr };
}

/** Fallback when `slot_open_time` is missing: naive substring from ISO (wrong for UTC vs slot_master; prefer backend field). */
function slotWallTimeFromStartDatetime(iso: string | undefined | null): string {
  if (!iso) return "";
  return parseIsoDateAndTime(iso).timeStr;
}

/** Business calendar day for a daily slot — always `slot.date`, not derived from UTC start_datetime. */
function calendarDateStrFromSlot(slot: DailySlot): string {
  if (typeof slot.date === "string") {
    return slot.date.includes("T") ? format(parseISO(slot.date), "yyyy-MM-dd") : slot.date.slice(0, 10);
  }
  return "";
}

/** External users: bookable when API sets available_for_external or status is AVAILABLE. */
function slotBookableByExternalUser(slot: DailySlot | undefined | null): boolean {
  if (!slot) return false;
  return (
    slot.available_for_external === true ||
    String(slot.status || "").toUpperCase() === "AVAILABLE"
  );
}

/** Row key HH:mm — matches `slot_master_times` / weekly grid (uses SlotMaster.open_time when API provides it). */
function timeKeyFromDailySlot(slot: DailySlot): string {
  let k = "";
  if (slot.slot_open_time) k = formatTimeForDisplay(String(slot.slot_open_time));
  else if (slot.start_datetime) k = slotWallTimeFromStartDatetime(slot.start_datetime);
  return normalizeSlotGridTimeKey(k);
}

/**
 * Local wall-clock start instant for a slot (business calendar `date` + slot row time).
 * Matches Step 3 grid “past” semantics so waitlist gating does not treat UTC-shifted ISO as still bookable.
 */
function slotWallStartLocalDate(slot: DailySlot): Date | null {
  const dateStr = calendarDateStrFromSlot(slot);
  if (!dateStr || dateStr.length < 10) return null;
  const y = parseInt(dateStr.slice(0, 4), 10);
  const mo = parseInt(dateStr.slice(5, 7), 10);
  const d = parseInt(dateStr.slice(8, 10), 10);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  const tk = timeKeyFromDailySlot(slot);
  if (tk && tk.includes(":")) {
    const parts = tk.split(":");
    const h = parseInt(parts[0] || "0", 10);
    const m = parseInt(String(parts[1] ?? "0").replace(/\D/g, "") || "0", 10);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return slot.start_datetime ? parseISO(slot.start_datetime) : null;
    return new Date(y, mo - 1, d, h, m, 0, 0);
  }
  return slot.start_datetime ? parseISO(slot.start_datetime) : null;
}

function isSlotWallStartInPast(slot: DailySlot): boolean {
  const t = slotWallStartLocalDate(slot);
  if (!t) return true;
  return t.getTime() < Date.now();
}

/** Default colors for slot statuses in Change slot status calendar (hex). */
const DEFAULT_SLOT_STATUS_COLORS: Record<string, string> = {
  AVAILABLE: "#dcfce7",
  NOT_AVAILABLE: "#e5e7eb",
  BOOKED: "#fecaca",
  COMPLETED: "#a7f3d0",
  BLOCKED: "#e5e7eb",
  UNDER_MAINTENANCE: "#fed7aa",
  OPERATOR_ABSENT: "#fde68a",
  BOOKING_NOT_UTILIZED: "#e9d5ff",
  HOLD: "#fef3c7",
  HOME_DEPARTMENT_ONLY: "#c4b5fd",
  NON_HOME_RESERVED: "#67e8f9",
};

const SLOT_STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Available",
  NOT_AVAILABLE: "Not Available",
  BOOKED: "Booked",
  BLOCKED: "Other Reasons",
  UNDER_MAINTENANCE: "Under Maintenance",
  OPERATOR_ABSENT: "Operator Absent",
  BOOKING_NOT_UTILIZED: "Booking Not Utilized",
  HOLD: "Hold",
  HOME_DEPARTMENT_ONLY: "Home department only",
  NON_HOME_RESERVED: "Reserved for other departments",
};

/** Return black or white for readable text on the given hex background. */
function getContrastTextColor(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#1f2937" : "#ffffff";
}

/** Build time slot labels from equipment window (slot_start_time, slot_end_time, slot_duration_minutes). */
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

/**
 * Stages while the book API runs. Only the first three advance on a short timer; the last step
 * stays active for the rest of the wait — the server may still be locking slots, debiting wallet,
 * etc. (see X-Booking-Perf / console timings). A single “building response” label was misleading
 * when the request took ~60s after the fake substeps finished.
 */
const EQUIPMENT_BOOKING_PROGRESS_STEPS = [
  "Validating slots and booking rules",
  "Reserving your time on the calendar",
  "Confirming wallet and charges",
  "Finalising on server (locks, payment, records & confirmation)",
] as const;

function logBookingServerTimings(res: { bookingPerf?: string }) {
  if (!res.bookingPerf) return;
  try {
    const parsed = JSON.parse(res.bookingPerf) as { total_ms?: number; marks?: Array<{ n: string; delta_ms: number; total_ms: number }> };
    console.warn(
      "[book-equipment] Server timings (ms). Largest delta_ms between marks is the slow backend phase.",
      parsed.total_ms,
      parsed.marks,
    );
  } catch {
    console.warn("[book-equipment] Server timings (raw)", res.bookingPerf);
  }
}

type ChargeCalcHashInput = {
  inputFieldValues: Record<string, string | boolean | string[] | number>;
  printAnalysisId: string | null;
  printAnalysisBatchId: string | null;
  sampleReturnAfterAnalysis: boolean;
  chargeEstimateUserType: string | null;
};

function buildChargeCalculationHash(input: ChargeCalcHashInput): string {
  return JSON.stringify({
    inputFieldValues: input.inputFieldValues,
    printAnalysisId: input.printAnalysisId,
    printAnalysisBatchId: input.printAnalysisBatchId,
    sample_return_after_analysis: input.sampleReturnAfterAnalysis,
    charge_estimate_user_type: input.chargeEstimateUserType,
  });
}

function inputsReadyForChargeEstimate(
  equipmentDetail: { input_fields?: Array<{ field_key?: string; field_type?: string; is_required?: boolean }>; profile_type?: string } | null,
  inputFieldValues: Record<string, string | boolean | string[] | number>
): boolean {
  const fields = equipmentDetail?.input_fields;
  if (!fields || fields.length === 0) return true;

  const requiredFields = fields.filter((field) => field.is_required);
  const requiredOk = requiredFields.every((field) => {
    const value = inputFieldValues[field.field_key ?? ""];
    return (
      value !== undefined &&
      value !== null &&
      value !== "" &&
      !(Array.isArray(value) && value.length === 0) &&
      !(typeof value === "number" && value === 0)
    );
  });
  if (!requiredOk) return false;

  if (equipmentDetail?.profile_type === "PRINT_3D") return true;

  for (const key of ["A", "B"]) {
    const field = fields.find((f) => f.field_key === key);
    if (!field) continue;
    const fieldType = String(field.field_type || "").toUpperCase().trim();
    if (fieldType !== "NUMERIC") continue;
    const raw = inputFieldValues[key];
    if (!isNumericValueWithinBounds(raw, field)) {
      return false;
    }
  }
  return true;
}

function shouldPromptCompleteOptionalParams(
  equipmentDetail: {
    input_fields?: Array<{
      field_key?: string;
      field_type?: string;
      is_required?: boolean;
      editing_required?: boolean;
    }>;
  } | null,
  inputFieldValues: Record<string, unknown>,
  serverInputValues?: Record<string, unknown> | null
): boolean {
  const merged = {
    ...inputFieldValues,
    ...(serverInputValues && typeof serverInputValues === "object" ? serverInputValues : {}),
  };
  return hasIncompleteOptionalEditableParams(equipmentDetail?.input_fields, merged);
}

const BookEquipment = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const debugSlots = searchParams.get("debug_slots") === "1";
  /** Build proforma line item from charge step only (no slot booking). */
  const isProformaFlow = searchParams.get("proforma") === "1";
  /** Charge estimate only — inputs + calculation, no slot booking. */
  const isCalculateChargesFlow = searchParams.get("mode") === "calculate";
  const proformaEditLineIndex = useMemo((): number | null => {
    const raw = searchParams.get("proformaLineIndex");
    if (raw == null || raw === "") return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }, [searchParams]);
  const [loadingEquipmentDetail, setLoadingEquipmentDetail] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const selectedEquipmentStatus = String((selectedEquipment as any)?.status || "").trim().toUpperCase();
  const selectedEquipmentIsOperational =
    selectedEquipmentStatus === "ACTIVE" || selectedEquipmentStatus === "OPERATIONAL";
  const [equipmentDetail, setEquipmentDetail] = useState<EquipmentDetail | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userType, setUserType] = useState<string | number | null>(null);
  const [userDepartmentId, setUserDepartmentId] = useState<number | null>(null);
  const [istemPortalAcknowledged, setIstemPortalAcknowledged] = useState(false);
  const [adminTargetIstemAcknowledged, setAdminTargetIstemAcknowledged] = useState<boolean | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedSlots, setSelectedSlots] = useState<TimeSlot[]>([]);
  const [inputFieldValues, setInputFieldValues] = useState<Record<string, string | boolean | string[] | number>>({});
  const [printAnalysisId, setPrintAnalysisId] = useState<string | null>(null);
  const [printAnalysisBatchId, setPrintAnalysisBatchId] = useState<string | null>(null);
  const [print3dAnalyzing, setPrint3dAnalyzing] = useState(false);
  const [chargeProgress, setChargeProgress] = useState(0);
  const [icpmsCoverageByFieldKey, setIcpmsCoverageByFieldKey] = useState<
    Record<
      string,
      | {
          count: number;
          standards: Array<{ id: number; s_no: string; name_of_std: string; list_of_elements?: string }>;
        }
      | null
    >
  >({});
  const [availableIcpmsStandardsDialogOpen, setAvailableIcpmsStandardsDialogOpen] = useState(false);
  const [loadingAvailableIcpmsStandards, setLoadingAvailableIcpmsStandards] = useState(false);
  const [fullIcpmsStandards, setFullIcpmsStandards] = useState<
    Array<{
      id: number;
      s_no: string;
      part_no: string;
      name_of_std: string;
      list_of_elements: string;
      concentration: string;
      status: number;
      created_at: string | null;
      updated_at: string | null;
    }>
  >([]);
  const [selectedIcpmsStandardIds, setSelectedIcpmsStandardIds] = useState<number[]>([]);
  const [periodicTableFieldKey, setPeriodicTableFieldKey] = useState<string | null>(null);
  const [selectedPeriodicSymbols, setSelectedPeriodicSymbols] = useState<Set<string>>(new Set());
  const [chargeCalculated, setChargeCalculated] = useState(false);
  const [calculatedCharge, setCalculatedCharge] = useState<{
    total_charge: string;
    total_time_minutes: number;
    charge_breakdown: Array<{ description: string; amount: number }>;
    show_charge_breakdown?: boolean;
    base_charge?: string;
    gst_percent?: number;
    gst_amount?: string;
    reward?: {
      points_balance: string;
      requested_points: string;
      points_applied: string;
      discount_amount: string;
      final_payable: string;
      message: string | null;
    };
  } | null>(null);
  const [loadingCharge, setLoadingCharge] = useState(false);
  useEffect(() => {
    if (!loadingCharge) {
      setChargeProgress(0);
      return;
    }
    setChargeProgress(12);
    const interval = setInterval(() => {
      setChargeProgress((p) => Math.min(p + 6, 94));
    }, 220);
    return () => clearInterval(interval);
  }, [loadingCharge]);
  const [showSlots, setShowSlots] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [lastFetchedWeek, setLastFetchedWeek] = useState<string | null>(null);
  const proformaEditHydratedRef = useRef<string | null>(null);
  const proformaEditInvalidToastRef = useRef(false);

  /** Week key for Step 3 grid (Mon–Sun range); used to detect stale slot data vs. visible week. */
  const step3WeekKey = useMemo(() => {
    const weekStart = startOfWeek(currentWeekStart, { weekStartsOn: 1 });
    const weekEnd = addDays(weekStart, 6);
    return `${format(weekStart, "yyyy-MM-dd")}_${format(weekEnd, "yyyy-MM-dd")}`;
  }, [currentWeekStart]);

  /**
   * True while the weekly grid must not be trusted: navigating weeks updates `currentWeekStart` before
   * `lastFetchedWeek` / `loadingSlots` catch up, which caused a brief misleading grid. Show full overlay until sync.
   */
  const isSlotsWeekViewLoading = useMemo(
    () => lastFetchedWeek !== step3WeekKey || loadingSlots,
    [lastFetchedWeek, step3WeekKey, loadingSlots]
  );
  const [chargeCalculationFailed, setChargeCalculationFailed] = useState(false);
  const [chargeEstimateUserType, setChargeEstimateUserType] = useState<string>("");
  const [exportingChargePdf, setExportingChargePdf] = useState(false);
  const [autoSlotSelection, setAutoSlotSelection] = useState<boolean>(true);
  const [userAutoSlotSelectionPref, setUserAutoSlotSelectionPref] = useState<boolean>(true);
  const userAutoSlotSelectionPrefRef = useRef<boolean>(true);
  const autoSlotSelectionRef = useRef<boolean>(true);
  const lastCalculatedValuesRef = useRef<string>('');
  const chargeRequestSeqRef = useRef(0);
  // Admin manage-equipment: 'book' = book for user, 'status' = change slot status, null = show mode selector
  const [adminManageMode, setAdminManageMode] = useState<'book' | 'status' | null>(null);
  const [adminBookForUserId, setAdminBookForUserId] = useState<string | null>(null);
  const [rewardPointsToRedeem, setRewardPointsToRedeem] = useState<string>("");
  const [rewardSummary, setRewardSummary] = useState<{
    points_balance: string;
    currency_per_point: string;
    config?: { is_enabled: boolean };
  } | null>(null);
  const [adminBookForUserInfo, setAdminBookForUserInfo] = useState<{
    email: string;
    department_name: string;
    phone_number?: string;
    wallet_faculty_owner: { name: string; email: string } | null;
    wallet_balance: string;
  } | null>(null);
  const [equipmentDeptWalletBalance, setEquipmentDeptWalletBalance] = useState<{
    balance: string;
    is_zero: boolean;
    has_wallet: boolean;
    department_id: number | null;
  } | null>(null);
  const [usersList, setUsersList] = useState<Array<{ id: number; name?: string; email?: string; user_type?: string }>>([]);
  const [adminUserTypeFilter, setAdminUserTypeFilter] = useState<string>(USER_TYPE_FILTER_ALL);
  const [userComboboxOpen, setUserComboboxOpen] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [statusChangeMonthStart, setStatusChangeMonthStart] = useState<Date>(() => startOfMonth(new Date()));
  const [statusChangeSelectedMonths, setStatusChangeSelectedMonths] = useState<string[]>([]); // "yyyy-MM" for year-level selection
  const [selectedDatesForStatus, setSelectedDatesForStatus] = useState<string[]>([]);
  const [statusChangePopupWeekStart, setStatusChangePopupWeekStart] = useState<Date | null>(null);
  const [statusChangeSlots, setStatusChangeSlots] = useState<DailySlot[] | null>(null);
  const [statusChangeSlotMasterTimes, setStatusChangeSlotMasterTimes] = useState<string[]>([]);
  const [statusChangeHolidays, setStatusChangeHolidays] = useState<Record<string, string | { label: string; color?: string }>>({});
  const [loadingStatusSlots, setLoadingStatusSlots] = useState(false);
  const [selectedSlotIdsForStatus, setSelectedSlotIdsForStatus] = useState<number[]>([]);
  /** Last focused time row / day column for week-view bulk scope dropdowns */
  const [statusBulkFocusTime, setStatusBulkFocusTime] = useState<string | null>(null);
  const [statusBulkFocusDayOffset, setStatusBulkFocusDayOffset] = useState<number | null>(null);
  const [newSlotStatus, setNewSlotStatus] = useState<string>('BLOCKED');
  const [blockedLabelForStatus, setBlockedLabelForStatus] = useState<string>('');
  const [sendEmailToWalletOwnerForNotUtilized, setSendEmailToWalletOwnerForNotUtilized] = useState(true);
  const BULK_EMAIL_OPERATION_VALUE = "__bulk_email__";
  const HOME_DEPARTMENT_ONLY_VALUE = "HOME_DEPARTMENT_ONLY";
  const CLEAR_HOME_DEPARTMENT_ONLY_VALUE = "CLEAR_HOME_DEPARTMENT_ONLY";
  const RESCHEDULE_OPERATION_VALUE = "RESCHEDULE";
  const [updatingSlotStatus, setUpdatingSlotStatus] = useState(false);
  const [updatingHomeDepartmentOnly, setUpdatingHomeDepartmentOnly] = useState(false);
  const [statusChangeRescheduleOpen, setStatusChangeRescheduleOpen] = useState(false);
  const [statusChangeRescheduleLoading, setStatusChangeRescheduleLoading] = useState(false);
  const [statusChangeRescheduleBooking, setStatusChangeRescheduleBooking] = useState<{
    booking_id: number;
    equipment: number;
    start_time: string;
    end_time: string;
    daily_slots: Array<{ id: number; start_datetime: string; end_datetime: string; date: string }>;
    maintenance_reschedule_extra_week?: boolean;
    status?: string;
  } | null>(null);
  /** True when current user is external (Educational Institute, RND, Industry, Other). */
  const isExternalUser = useMemo(() => {
    const ut = String(userType ?? "").toLowerCase();
    return isExternalBookingUserType(ut);
  }, [userType]);

  /** True when Step 3 rules should treat the booking target as external (self or admin/OIC booking for external-type user). */
  const bookingAsExternalTarget = useMemo(() => {
    if (isCalculateChargesFlow && chargeEstimateUserType) {
      return isExternalBookingUserType(chargeEstimateUserType);
    }
    if (isExternalUser) return true;
    const actor = String(userType ?? "").toLowerCase();
    if (
      (actor === "admin" || actor === "manager" || actor === "dept_admin") &&
      adminManageMode === "book" &&
      adminBookForUserId
    ) {
      const u = usersList.find((x) => String(x.id) === String(adminBookForUserId));
      const ut = String(u?.user_type || "").toLowerCase();
      return isExternalBookingUserType(ut);
    }
    return false;
  }, [isCalculateChargesFlow, chargeEstimateUserType, isExternalUser, userType, adminManageMode, adminBookForUserId, usersList]);

  /** External logistics: return samples after analysis (adds return shipping fee before GST). */
  const [sampleReturnAfterAnalysis, setSampleReturnAfterAnalysis] = useState<boolean>(false);
  /** Atmosphere-sensitive: sample may be submitted at slot start instead of the lead-time deadline. */
  const [atmosphereSensitiveSample, setAtmosphereSensitiveSample] = useState<boolean>(false);
  const atmosphereSensitiveAllowed = equipmentDetail?.atmosphere_sensitive_sample_enabled === true;
  const atmosphereSensitiveForBooking = atmosphereSensitiveAllowed && atmosphereSensitiveSample;
  // Reset when equipment does not allow the option.
  useEffect(() => {
    if (!atmosphereSensitiveAllowed) {
      setAtmosphereSensitiveSample(false);
    }
  }, [equipmentDetail?.equipment_id, atmosphereSensitiveAllowed]);


  const isDailySlotSelectableForUserBooking = useCallback((slot: DailySlot): boolean => {
    const actor = String(userType ?? "").toLowerCase();
    // Admin, OIC, and Department Administrator may book any non-BOOKED slot (weekend / holiday / past / closed-day statuses).
    if (actor === "admin" || actor === "manager" || actor === "dept_admin") {
      if (adminManageMode === "book" && adminBookForUserId && bookingAsExternalTarget) {
        return slotBookableByExternalUser(slot);
      }
      if (adminManageMode === "book" && adminBookForUserId && !bookingAsExternalTarget) {
        // Internal on-behalf: allow non-BOOKED including NOT_AVAILABLE (weekend/holiday).
        const status = String(slot.status || "").toUpperCase();
        return status !== "BOOKED" && status !== "BOOKING_NOT_UTILIZED";
      }
      const status = String(slot.status || "").toUpperCase();
      return status !== "BOOKED" && status !== "BOOKING_NOT_UTILIZED";
    }
    if (isExternalUser) return slotBookableByExternalUser(slot);
    if (slot.status !== "AVAILABLE") return false;

    // Department reservation: marked = non-home; unmarked = home-only while policy active;
    // marked slots open to all within reschedule_hours_threshold before start.
    const eqDept =
      (equipmentDetail as { internal_department?: number | null } | null)?.internal_department ??
      (selectedEquipment as { internal_department?: number | null } | null)?.internal_department ??
      null;
    if (eqDept == null) return true;

    const isHome =
      userDepartmentId != null && Number(userDepartmentId) === Number(eqDept);
    const weekSlots = (equipmentDetail?.daily_slots || []) as DailySlot[];
    const policyActive =
      Boolean(slot.home_department_only) ||
      weekSlots.some((s) => Boolean(s.home_department_only));
    if (!policyActive) return true;

    if (slot.home_department_only) {
      const startRaw = slot.start_datetime;
      if (startRaw) {
        const startMs = new Date(startRaw).getTime();
        const thresholdHours = Number(
          (equipmentDetail as { reschedule_hours_threshold?: number | null } | null)
            ?.reschedule_hours_threshold ?? 48
        );
        const cutoffMs = startMs - thresholdHours * 60 * 60 * 1000;
        if (Date.now() >= cutoffMs) return true; // open to all departments
      }
      return !isHome; // reserved for non-home
    }
    return isHome; // unmarked → home department only
  }, [
    userType,
    adminManageMode,
    adminBookForUserId,
    bookingAsExternalTarget,
    isExternalUser,
    equipmentDetail,
    selectedEquipment,
    userDepartmentId,
  ]);

  const hasBookableSlotInSelectedWeek = useMemo(() => {
    if (!equipmentDetail?.daily_slots?.length) return false;
    const weekStart = startOfWeek(currentWeekStart, { weekStartsOn: 1 });
    const weekEnd = addDays(weekStart, 6);
    const weekStartMs = startOfDay(weekStart).getTime();
    const weekEndMs = startOfDay(weekEnd).getTime();

    return equipmentDetail.daily_slots.some((slot) => {
      // Past dates/times (local wall clock) do not count as “available” for waitlist UI — same as grid.
      if (isSlotWallStartInPast(slot)) return false;
      const dStr = calendarDateStrFromSlot(slot);
      if (!dStr) return false;
      const dayMs = startOfDay(parseISO(`${dStr.slice(0, 10)}T12:00:00`)).getTime();
      if (dayMs < weekStartMs || dayMs > weekEndMs) return false;
      return isDailySlotSelectableForUserBooking(slot);
    });
  }, [
    equipmentDetail?.daily_slots,
    currentWeekStart,
    isDailySlotSelectableForUserBooking,
  ]);

  const [applyProgressPercent, setApplyProgressPercent] = useState(0);
  const applyProgressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [bulkEmailOpen, setBulkEmailOpen] = useState(false);
  const [bulkEmailRecipients, setBulkEmailRecipients] = useState<Array<{ email: string; name: string }>>([]);
  const [bulkEmailSubject, setBulkEmailSubject] = useState("");
  const [bulkEmailBody, setBulkEmailBody] = useState("");
  const [bulkEmailTemplatesLoading, setBulkEmailTemplatesLoading] = useState(false);
  const [sendingBulkEmail, setSendingBulkEmail] = useState(false);
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [bookingProgressStepIndex, setBookingProgressStepIndex] = useState(0);
  const [bookingSubmitElapsedSec, setBookingSubmitElapsedSec] = useState(0);
  const [bookAnyAvailableSlots, setBookAnyAvailableSlots] = useState(false);
  const [bookEvenIfSingleSlotAvailable, setBookEvenIfSingleSlotAvailable] = useState(false);
  // When enabled, failed booking attempts (e.g. no slots / selected slots already occupied)
  // are pushed to waitlist queue (FCFS) up to configured waitlist depth.
  const [waitlistIntentMode, setWaitlistIntentMode] = useState(true);
  /** External (and admin booking for external): no waitlist — only real slot selection counts. */
  const waitlistIntentEffective = useMemo(
    () => (bookingAsExternalTarget ? false : waitlistIntentMode),
    [bookingAsExternalTarget, waitlistIntentMode]
  );

  useEffect(() => {
    if (!bookingAsExternalTarget) return;
    setWaitlistIntentMode(false);
    setBookAnyAvailableSlots(false);
    setBookEvenIfSingleSlotAvailable(false);
  }, [bookingAsExternalTarget]);

  useEffect(() => {
    // If the selected weekly window has no bookable slots, hide/disable fallback booking strategies.
    // (They can't succeed without at least one AVAILABLE slot.)
    if (bookingAsExternalTarget) return;
    if (hasBookableSlotInSelectedWeek) return;
    setBookAnyAvailableSlots(false);
    setBookEvenIfSingleSlotAvailable(false);
  }, [hasBookableSlotInSelectedWeek, bookingAsExternalTarget]);

  useEffect(() => {
    if (bookingAsExternalTarget) return;
    if (!hasBookableSlotInSelectedWeek) return;
    setWaitlistIntentMode((prev) => (prev ? false : prev));
  }, [hasBookableSlotInSelectedWeek, bookingAsExternalTarget]);

  useEffect(() => {
    if (!isSubmittingBooking) {
      setBookingSubmitElapsedSec(0);
      setBookingProgressStepIndex(0);
      return;
    }
    setBookingSubmitElapsedSec(0);
    setBookingProgressStepIndex(0);
    const maxIdx = EQUIPMENT_BOOKING_PROGRESS_STEPS.length - 1;
    let step = 0;
    let timeoutId: ReturnType<typeof window.setTimeout>;
    const advance = () => {
      if (step >= maxIdx) return;
      step += 1;
      setBookingProgressStepIndex(step);
      if (step < maxIdx) {
        timeoutId = window.setTimeout(advance, 2200);
      }
    };
    timeoutId = window.setTimeout(advance, 2200);
    const elapsedTimer = window.setInterval(() => {
      setBookingSubmitElapsedSec((s) => s + 1);
    }, 1000);
    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(elapsedTimer);
    };
  }, [isSubmittingBooking]);

  const [bookingResultDialog, setBookingResultDialog] = useState<{
    open: boolean;
    success: boolean;
    variant: "success" | "waitlist" | "failure";
    message: string;
    /** Query value for /my-bookings?booking=… (virtual id preferred). */
    bookingViewQuery?: string;
    /** Human-facing booking reference shown on the link. */
    bookingDisplayId?: string;
    /** When true, show stronger copy to complete remaining optional (editable) parameters. */
    promptCompleteOptionalParams?: boolean;
  }>({ open: false, success: false, variant: "failure", message: "" });
  const [userTransactionHistoryDialog, setUserTransactionHistoryDialog] = useState<{ open: boolean; userId: string | null; userDisplayName: string }>({ open: false, userId: null, userDisplayName: "" });
  const [userTransactionHistory, setUserTransactionHistory] = useState<{ loading: boolean; transactions: Array<{ id: number; transaction_type: "credit" | "debit"; amount: string; description: string; description_display?: string; created_at: string; balance_after?: string | null; equipment_name?: string | null; department_name?: string | null; department_code?: string | null; related_user_name?: string | null; related_user_email?: string | null; virtual_booking_id?: string | null }>; error: string | null }>({ loading: false, transactions: [], error: null });
  const [expandedSlotBooking, setExpandedSlotBooking] = useState<BookingDetailCardBooking | null>(null);
  const [expandedSlotBookingLoading, setExpandedSlotBookingLoading] = useState(false);
  const [urgentDialogOpen, setUrgentDialogOpen] = useState(false);
  /** When auto-select is on, manual interaction with the slot calendar or Clear Selection shows this dialog. */
  const [autoSlotGuardDialogOpen, setAutoSlotGuardDialogOpen] = useState(false);
  const [autoSlotGuardPending, setAutoSlotGuardPending] = useState<
    "clear" | "calendar" | null
  >(null);
  const [urgentHoldBookingId, setUrgentHoldBookingId] = useState<number | null>(null);
  /** Slots chosen in urgent flow but not yet submitted: hold is created only when user clicks Submit request in the dialog. */
  const [pendingHoldSelection, setPendingHoldSelection] = useState<{
    slotIds: number[];
    inputValues: Record<string, string | boolean | string[] | number>;
    totalCharge: number;
    totalTimeMinutes: number;
  } | null>(null);
  const [urgentRequestType, setUrgentRequestType] = useState<'NO_SLOT' | 'REVIEWER_URGENT'>('NO_SLOT');
  const [urgentDisclaimerAccepted, setUrgentDisclaimerAccepted] = useState(false);
  const urgentDisclaimerAcceptedRef = useRef(false);
  const [urgentEvidenceFile, setUrgentEvidenceFile] = useState<File | null>(null);
  const [urgentReviewerComment, setUrgentReviewerComment] = useState("");
  const [urgentNumberSamples, setUrgentNumberSamples] = useState(1);
  const [urgentSlotsRequested, setUrgentSlotsRequested] = useState(1);
  const [urgentSubmitting, setUrgentSubmitting] = useState(false);
  /** Unsuccessful booking attempts for current equipment (past 2 weeks), shown when reason is "Unable to get slot despite repeated trials". */
  const [myUnsuccessfulAttempts, setMyUnsuccessfulAttempts] = useState<Array<{
    id: number;
    requested_at: string | null;
    outcome: string;
    failure_reason: string;
    number_of_samples: number;
    slots_requested: number;
    duration_minutes: number | null;
  }>>([]);
  const [myUnsuccessfulAttemptsLoading, setMyUnsuccessfulAttemptsLoading] = useState(false);
  /** True when user came from "Select Slot" in urgent dialog: show "Submit Request" and create hold booking (no debit). */
  const isUrgentHoldMode = searchParams.get('urgent') === '1';
  const [statusChangeSlotColors, setStatusChangeSlotColors] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem("slotStatusColors");
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, string>;
        return { ...DEFAULT_SLOT_STATUS_COLORS, ...parsed };
      }
    } catch {
      /* ignore */
    }
    return { ...DEFAULT_SLOT_STATUS_COLORS };
  });
  const calculationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const statusChangeDateClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusWeekSlotsFetchGenRef = useRef(0);
  const fetchStatusChangeSlotsForWeekRef = useRef<(weekStart: Date) => Promise<void>>(async () => {});
  const fetchingSlotsRef = useRef<boolean>(false);
  /** Stop equipment_id URL fetch retries after access denied / not found. */
  const equipmentAccessBlockedRef = useRef(false);
  const hasCheckedEmptyCurrentWeekRef = useRef<boolean>(false);
  const lastEquipmentIdRef = useRef<number | null>(null);
  const prevShowSlotsRef = useRef<boolean>(false);
  /** Tracks last applied `?mode=` per equipment so URL can switch status ↔ book on the same equipment. */
  const appliedModeUrlKeyRef = useRef<string | null>(null);
  const prevAdminManageModeRef = useRef<'book' | 'status' | null | undefined>(undefined);

  /** When Request urgent booking popup is open with reason "Unable to get slot...", load user's unsuccessful attempts for this equipment (past 2 weeks). */
  useEffect(() => {
    if (!urgentDialogOpen || urgentRequestType !== 'NO_SLOT' || !selectedEquipment?.id) {
      setMyUnsuccessfulAttempts([]);
      return;
    }
    let cancelled = false;
    setMyUnsuccessfulAttemptsLoading(true);
    apiClient.getMyUnsuccessfulBookingAttempts(Number(selectedEquipment.id)).then((res) => {
      if (cancelled) return;
      setMyUnsuccessfulAttemptsLoading(false);
      if (res.data?.entries) setMyUnsuccessfulAttempts(res.data.entries);
      else setMyUnsuccessfulAttempts([]);
    }).catch(() => {
      if (!cancelled) {
        setMyUnsuccessfulAttemptsLoading(false);
        setMyUnsuccessfulAttempts([]);
      }
    });
    return () => { cancelled = true; };
  }, [urgentDialogOpen, urgentRequestType, selectedEquipment?.id]);

  /** When "Unable to get slot despite repeated trials" is selected and no unsuccessful attempts in past 2 weeks, disable Select Slot, I confirm, and Submit. */
  const noSlotWithNoUnsuccessfulAttempts = urgentRequestType === 'NO_SLOT' && !myUnsuccessfulAttemptsLoading && myUnsuccessfulAttempts.length === 0;

  /** When repeatOf is in URL, this holds the source booking for repeat-sample flow (params prefilled, no change allowed, user picks slots). */
  const [repeatSourceBooking, setRepeatSourceBooking] = useState<{
    booking_id: string | number;
    /** Numeric PK for `/bookings/<id>/create-repeat-booking/` (display-only booking_id cannot be used in URL). */
    real_booking_id: number;
    equipment: number;
    virtual_booking_id?: string | null;
    input_values: Record<string, string | boolean | string[] | number>;
    total_charge: string | number;
    total_time_minutes: number;
    charge_breakdown: Array<{ description: string; amount: number }>;
  } | null>(null);
  const [repeatSourceLoading, setRepeatSourceLoading] = useState(false);

  useEffect(() => {
    return () => {
      if (applyProgressIntervalRef.current) {
        clearInterval(applyProgressIntervalRef.current);
        applyProgressIntervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const isGuestCalculateFlow =
      new URLSearchParams(window.location.search).get("mode") === "calculate";

    // Get user ID and type from localStorage (set by DashboardHeader) to avoid duplicate API calls
    const storedUser = localStorage.getItem('user');
    if (isGuestCalculateFlow && !storedUser && !apiClient.getToken()) {
      return;
    }
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setUserId(String(user.id));
        setUserType(user.user_type || null);
        setUserDepartmentId(
          typeof user.department === "number"
            ? user.department
            : user.department?.id != null
              ? Number(user.department.id)
              : user.department_id != null
                ? Number(user.department_id)
                : null
        );
        setIstemPortalAcknowledged(Boolean(user.istem_portal_acknowledged));
        // Initialize auto slot selection from user preference, default to true if not set
        const pref = user.auto_slot_selection !== undefined ? user.auto_slot_selection : true;
        setUserAutoSlotSelectionPref(pref);
        setAutoSlotSelection(pref);
        
        // Set initial week based on user type
        const now = new Date();
        const currentWeek = startOfWeek(now, { weekStartsOn: 1 });
        const userTypeValue: any = user.user_type;
        let normalizedType: string | null = null;
        if (typeof userTypeValue === 'string') {
          normalizedType = userTypeValue.toLowerCase();
        } else if (typeof userTypeValue === 'number') {
          normalizedType = userTypeValue === 1 ? 'student' : userTypeValue === 2 ? 'faculty' : null;
        }
        
        if (
          normalizedType === "admin" ||
          normalizedType === "manager" ||
          normalizedType === "student" ||
          normalizedType === "faculty"
        ) {
          // Admin / OIC / Students / Faculty: Start with current week
          setCurrentWeekStart(currentWeek);
        } else {
          // External (and similar): start with current week; API slot_window_* bounds drive navigation after slots load
          setCurrentWeekStart(currentWeek);
        }
      } catch (e) {
        // If localStorage fails, check auth
        checkAuth();
      }
    } else {
      // If no user in localStorage, check auth
      checkAuth();
    }
  }, []);

  // Admin/OIC/Department Administrator: fetch users list when in "book for user" mode
  useEffect(() => {
    const actor = String(userType ?? "").toLowerCase();
    if (
      (actor !== "admin" && actor !== "manager" && actor !== "dept_admin") ||
      adminManageMode !== "book"
    ) {
      return;
    }
    let cancelled = false;
    (async () => {
      const params: Record<string, string> = {
        lite: "1",
        for_booking: "1",
        is_active: "1",
      };
      if (adminUserTypeFilter !== USER_TYPE_FILTER_ALL) {
        // Backend expects exact UserType codes (e.g. RND / Industry keep original casing).
        params.user_type = adminUserTypeFilter;
      }
      const res = await apiClient.adminList<{ id: number; name?: string; email?: string; user_type?: string }>(
        "users",
        params
      );
      if (cancelled) return;
      if (res.error) {
        setUsersList([]);
        toast.error(typeof res.error === "string" ? res.error : "Failed to load users for booking.");
        return;
      }
      const raw = res.data as unknown;
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray((raw as { results?: unknown })?.results)
          ? ((raw as { results: Array<{ id: number; name?: string; email?: string; user_type?: string }> }).results)
          : [];
      setUsersList(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [adminManageMode, userType, adminUserTypeFilter]);

  // Changing type filter clears prior selection so charge isn't for a user outside the new list
  useEffect(() => {
    if (adminManageMode !== "book") return;
    setAdminBookForUserId(null);
    setAdminBookForUserInfo(null);
  }, [adminUserTypeFilter]);

  // Admin/OIC/Department Administrator: fetch selected user's booking info
  useEffect(() => {
    const actor = String(userType ?? "").toLowerCase();
    if (
      (actor !== "admin" && actor !== "manager" && actor !== "dept_admin") ||
      !adminBookForUserId
    ) {
      setAdminBookForUserInfo(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await apiClient.getAdminUserBookingInfo(adminBookForUserId);
      if (cancelled) return;
      if (res.data) setAdminBookForUserInfo(res.data);
      else setAdminBookForUserInfo(null);
    })();
    return () => { cancelled = true; };
  }, [adminBookForUserId, userType]);

  // Wallet balance for this equipment's internal department (same sub-wallet used at booking).
  // Only end users (student/faculty/external…); OIC/admin/staff are not prompted to recharge.
  useEffect(() => {
    if (isCalculateChargesFlow && !apiClient.getToken()) {
      setEquipmentDeptWalletBalance(null);
      return;
    }
    const equipmentId = equipmentDetail?.equipment_id ?? selectedEquipment?.id;
    const actorType = String(userType ?? "").toLowerCase();
    if (!equipmentId) {
      setEquipmentDeptWalletBalance(null);
      return;
    }
    if (adminManageMode === "status") {
      setEquipmentDeptWalletBalance(null);
      return;
    }
    if (
      (actorType === "admin" || actorType === "dept_admin") &&
      adminManageMode === "book" &&
      !adminBookForUserId
    ) {
      setEquipmentDeptWalletBalance(null);
      return;
    }
    // Staff never need this department-wallet recharge banner (OIC/admin/lab/accounts).
    // Hide whenever manage modes are available — covers stale localStorage edge cases.
    const staffType = String(userType ?? "").toLowerCase();
    if (
      staffType === "admin" ||
      staffType === "dept_admin" ||
      staffType === "manager" ||
      staffType === "operator" ||
      staffType === "finance" ||
      !isEndUserBookingType(userType)
    ) {
      setEquipmentDeptWalletBalance(null);
      return;
    }

    let cancelled = false;
    (async () => {
      const userId =
        (actorType === "admin" || actorType === "manager" || actorType === "dept_admin") &&
        adminManageMode === "book" &&
        adminBookForUserId
          ? adminBookForUserId
          : undefined;
      const res = await apiClient.getEquipmentDepartmentWalletBalance(equipmentId, userId);
      if (cancelled) return;
      if (res.data) {
        setEquipmentDeptWalletBalance({
          balance: res.data.balance,
          is_zero: res.data.is_zero,
          has_wallet: res.data.has_wallet,
          department_id: res.data.department_id ?? null,
        });
      } else {
        setEquipmentDeptWalletBalance(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [equipmentDetail?.equipment_id, selectedEquipment?.id, adminManageMode, adminBookForUserId, userType, isCalculateChargesFlow]);

  useEffect(() => {
    const actor = String(userType ?? "").toLowerCase();
    if (
      (actor !== "admin" && actor !== "manager" && actor !== "dept_admin") ||
      !adminBookForUserId
    ) {
      setAdminTargetIstemAcknowledged(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await apiClient.getProfile(adminBookForUserId);
      if (cancelled) return;
      if (res.data) {
        setAdminTargetIstemAcknowledged(Boolean((res.data as { istem_portal_acknowledged?: boolean }).istem_portal_acknowledged));
      } else {
        setAdminTargetIstemAcknowledged(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adminBookForUserId, userType]);

  // Admin status-change: toggle a single date in selection (month calendar)
  const toggleDateForStatus = (dateStr: string) => {
    setSelectedDatesForStatus((prev) =>
      prev.includes(dateStr) ? prev.filter((d) => d !== dateStr) : [...prev, dateStr].sort()
    );
    // Date-based selection should not accidentally reuse stale slot IDs from week view.
    setSelectedSlotIdsForStatus([]);
  };

  /** Open week grid for per-slot selection. Clears month/year date selection so Apply uses slot_ids (not a single-day dates payload). */
  const openWeekSlotPopup = (day: Date) => {
    if (statusChangeDateClickTimerRef.current) {
      clearTimeout(statusChangeDateClickTimerRef.current);
      statusChangeDateClickTimerRef.current = null;
    }
    setSelectedDatesForStatus([]);
    setStatusChangeSelectedMonths([]);
    setSelectedSlotIdsForStatus([]);
    setStatusBulkFocusTime(null);
    setStatusBulkFocusDayOffset(null);
    const weekStart = startOfWeek(day, { weekStartsOn: 1 });
    setStatusChangePopupWeekStart(weekStart);
    // Always load slots immediately (covers same-week reopen where useEffect may not re-fire).
    void fetchStatusChangeSlotsForWeekRef.current(weekStart);
  };

  // Admin status-change: select the week (Mon–Sun) that contains the given date (for date-based apply)
  const selectWeekForStatus = (date: Date) => {
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    const weekDates: string[] = [];
    for (let i = 0; i < 7; i++) {
      weekDates.push(format(addDays(weekStart, i), "yyyy-MM-dd"));
    }
    setSelectedDatesForStatus((prev) => {
      const set = new Set([...prev, ...weekDates]);
      return Array.from(set).sort();
    });
    setSelectedSlotIdsForStatus([]);
  };

  // Admin status-change: select all days in the displayed month
  const selectMonthForStatus = () => {
    const start = startOfMonth(statusChangeMonthStart);
    const end = endOfMonth(statusChangeMonthStart);
    const days = eachDayOfInterval({ start, end });
    const monthDates = days.map((d) => format(d, "yyyy-MM-dd"));
    setSelectedDatesForStatus((prev) => {
      const set = new Set([...prev, ...monthDates]);
      return Array.from(set).sort();
    });
    setSelectedSlotIdsForStatus([]);
  };

  // Year view: toggle a single month in year-level selection ("yyyy-MM")
  const toggleMonthInYearView = (monthKey: string) => {
    setStatusChangeSelectedMonths((prev) =>
      prev.includes(monthKey) ? prev.filter((m) => m !== monthKey) : [...prev, monthKey].sort()
    );
  };

  // Year view: select entire year (all 12 months)
  const selectYearForStatus = () => {
    const y = statusChangeMonthStart.getFullYear();
    const allMonths = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(y, i, 1);
      return format(d, "yyyy-MM");
    });
    setStatusChangeSelectedMonths(allMonths);
  };

  // Year view: clear year-level selection
  const clearYearSelection = () => {
    setStatusChangeSelectedMonths([]);
  };

  // Expand selected months to date strings for API
  const getEffectiveDatesForStatus = useCallback(() => {
    const dateSet = new Set<string>(selectedDatesForStatus);
    statusChangeSelectedMonths.forEach((monthKey) => {
      const [y, m] = monthKey.split("-").map(Number);
      const start = new Date(y, m - 1, 1);
      const end = endOfMonth(start);
      eachDayOfInterval({ start, end }).forEach((d) => dateSet.add(format(d, "yyyy-MM-dd")));
    });
    return Array.from(dateSet).sort();
  }, [selectedDatesForStatus, statusChangeSelectedMonths]);

  // Admin: fetch slots for status-change mode (optional; month calendar uses bulk API by dates)
  const fetchStatusChangeSlots = useCallback(async () => {
    if (!selectedEquipment?.id || adminManageMode !== 'status') return;
    setLoadingStatusSlots(true);
    try {
      const monthStart = startOfMonth(statusChangeMonthStart);
      const monthEnd = endOfMonth(statusChangeMonthStart);
      const res = await apiClient.getEquipmentSlots(selectedEquipment.id, format(monthStart, 'yyyy-MM-dd'), format(monthEnd, 'yyyy-MM-dd'));
      if ((res as any)?.error) throw new Error((res as any).error);
      const data = (res as { data?: { slots?: DailySlot[]; slot_master_times?: string[]; holidays?: Record<string, string> } }).data;
      if (data?.slots) setStatusChangeSlots(data.slots);
      else setStatusChangeSlots([]);
      const times = data?.slot_master_times && data.slot_master_times.length > 0
        ? data.slot_master_times.map(formatTimeForDisplay).sort()
        : [];
      setStatusChangeSlotMasterTimes(times);
      setStatusChangeHolidays(data?.holidays ?? {});
    } catch {
      toast.error("Could not load status-change slots.");
      setStatusChangeSlots([]);
      setStatusChangeSlotMasterTimes([]);
      setStatusChangeHolidays({});
    } finally {
      setLoadingStatusSlots(false);
    }
  }, [selectedEquipment?.id, adminManageMode, statusChangeMonthStart]);
  useEffect(() => {
    // Month calendar does not require pre-fetching slots; bulk API uses dates only.
  }, [adminManageMode, selectedEquipment?.id]);

  // When week slot popup opens, fetch slots for that week
  const fetchStatusChangeSlotsForWeek = useCallback(async (weekStart: Date) => {
    if (!selectedEquipment?.id) return;
    const fetchGen = ++statusWeekSlotsFetchGenRef.current;
    setLoadingStatusSlots(true);
    setStatusChangeSlots(null);
    try {
      const weekEnd = addDays(weekStart, 6);
      const res = await apiClient.getEquipmentSlots(
        selectedEquipment.id,
        format(weekStart, "yyyy-MM-dd"),
        format(weekEnd, "yyyy-MM-dd")
      );
      if (fetchGen !== statusWeekSlotsFetchGenRef.current) return;
      if (res.error) throw new Error(res.error);
      const data = res.data;
      const slots = Array.isArray(data?.slots) ? data.slots : [];
      setStatusChangeSlots(slots);
      let times =
        data?.slot_master_times && data.slot_master_times.length > 0
          ? data.slot_master_times.map((t) => formatTimeForDisplay(String(t)))
          : [];
      // Fallback: derive from returned slots, then from equipment detail masters
      if (times.length === 0 && slots.length > 0) {
        const fromSlots = new Set<string>();
        slots.forEach((s) => {
          if (s.start_datetime || (s as DailySlot).slot_open_time) {
            fromSlots.add(timeKeyFromDailySlot(s as DailySlot));
          }
        });
        times = Array.from(fromSlots);
      }
      if (times.length === 0) {
        const detailTimes = (equipmentDetail as { slot_master_times?: string[] } | null)?.slot_master_times;
        if (Array.isArray(detailTimes) && detailTimes.length > 0) {
          times = detailTimes.map((t) => formatTimeForDisplay(String(t)));
        }
      }
      times = [...new Set(times.map((t) => normalizeSlotGridTimeKey(t)).filter(Boolean))].sort();
      setStatusChangeSlotMasterTimes(times);
      setStatusChangeHolidays(data?.holidays ?? {});
    } catch {
      if (fetchGen !== statusWeekSlotsFetchGenRef.current) return;
      toast.error("Could not load status-change slots for this week.");
      setStatusChangeSlots([]);
      setStatusChangeSlotMasterTimes([]);
      setStatusChangeHolidays({});
    } finally {
      if (fetchGen === statusWeekSlotsFetchGenRef.current) {
        setLoadingStatusSlots(false);
      }
    }
  }, [
    selectedEquipment?.id,
    // Only the master times fallback — avoid refetch loops on unrelated equipmentDetail identity changes
    Array.isArray((equipmentDetail as { slot_master_times?: string[] } | null)?.slot_master_times)
      ? (equipmentDetail as { slot_master_times?: string[] }).slot_master_times!.join("|")
      : "",
  ]);
  fetchStatusChangeSlotsForWeekRef.current = fetchStatusChangeSlotsForWeek;
  useEffect(() => {
    if (statusChangePopupWeekStart && selectedEquipment?.id) {
      fetchStatusChangeSlotsForWeek(statusChangePopupWeekStart);
    }
  }, [statusChangePopupWeekStart, selectedEquipment?.id, fetchStatusChangeSlotsForWeek]);

  // Admin status-change: get slot at (day, time) for calendar grid
  const getStatusChangeSlotAt = (day: Date, time: string): DailySlot | undefined => {
    if (!statusChangeSlots || statusChangeSlots.length === 0) return undefined;
    const dateStr = format(day, "yyyy-MM-dd");
    return statusChangeSlots.find((slot) => {
      return calendarDateStrFromSlot(slot) === dateStr && timeKeyFromDailySlot(slot) === time;
    });
  };

  const toggleStatusChangeSlotSelection = (slotId: number) => {
    setSelectedSlotIdsForStatus((prev) =>
      prev.includes(slotId) ? prev.filter((id) => id !== slotId) : [...prev, slotId]
    );
  };

  // Select all slots in a time row for the current popup week
  const selectTimeRowForWeek = (time: string) => {
    if (!statusChangeSlots || !statusChangePopupWeekStart) return;
    const weekStartStr = format(statusChangePopupWeekStart, "yyyy-MM-dd");
    const ids: number[] = [];
    const dateStrs: string[] = [];
    statusChangeSlots.forEach((s) => {
      const slotDateStr = calendarDateStrFromSlot(s);
      const slotTime = timeKeyFromDailySlot(s);
      if (slotDateStr >= weekStartStr && slotDateStr < format(addDays(statusChangePopupWeekStart!, 7), "yyyy-MM-dd") && slotTime === time) {
        ids.push(s.id);
        if (slotDateStr) dateStrs.push(slotDateStr);
      }
    });
    setSelectedSlotIdsForStatus((prev) => {
      const set = new Set([...prev, ...ids]);
      return Array.from(set);
    });
    setSelectedDatesForStatus((prev) => {
      const set = new Set([...prev, ...dateStrs]);
      return Array.from(set).sort();
    });
  };

  /** Select all times on one calendar day within the current status week grid. */
  const selectDayColumnForWeek = (dayOffset: number) => {
    if (!statusChangeSlots || !statusChangePopupWeekStart) return;
    const day = addDays(statusChangePopupWeekStart, dayOffset);
    const dateStr = format(day, "yyyy-MM-dd");
    const ids = statusChangeSlots
      .filter((s) => calendarDateStrFromSlot(s) === dateStr)
      .map((s) => s.id);
    setSelectedSlotIdsForStatus((prev) => Array.from(new Set([...prev, ...ids])));
    setSelectedDatesForStatus((prev) => Array.from(new Set([...prev, dateStr])).sort());
    toast.success(`Selected ${ids.length} slot(s) for ${format(day, "EEE MMM d")} (this week).`);
  };

  /** Select all slots on matching weekdays across the displayed status month (e.g. all Fridays). */
  const selectDayColumnForMonth = useCallback(
    async (dayOffset: number) => {
      if (!selectedEquipment?.id || !statusChangePopupWeekStart) return;
      const sampleDay = addDays(statusChangePopupWeekStart, dayOffset);
      const targetDow = sampleDay.getDay(); // 0=Sun … 6=Sat
      const monthStart = startOfMonth(statusChangeMonthStart);
      const monthEnd = endOfMonth(statusChangeMonthStart);
      try {
        const res = await apiClient.getEquipmentSlots(
          selectedEquipment.id,
          format(monthStart, "yyyy-MM-dd"),
          format(monthEnd, "yyyy-MM-dd")
        );
        const data = (res as { data?: { slots?: DailySlot[] } }).data;
        const monthSlots = data?.slots ?? [];
        const matching = monthSlots.filter((s) => {
          const dStr = calendarDateStrFromSlot(s);
          if (!dStr) return false;
          const d = parseISO(`${dStr.slice(0, 10)}T12:00:00`);
          return d.getDay() === targetDow;
        });
        const ids = matching.map((s) => s.id);
        const datesToAdd = [
          ...new Set(
            matching
              .map((s) => calendarDateStrFromSlot(s))
              .filter(Boolean) as string[]
          ),
        ].sort();
        setSelectedSlotIdsForStatus((prev) => Array.from(new Set([...prev, ...ids])));
        setSelectedDatesForStatus((prev) => Array.from(new Set([...prev, ...datesToAdd])).sort());
        toast.success(
          `Selected ${ids.length} slot(s) for all ${format(sampleDay, "EEEE")}s in ${format(monthStart, "MMMM yyyy")}.`
        );
      } catch {
        toast.error("Failed to load month slots.");
      }
    },
    [selectedEquipment?.id, statusChangePopupWeekStart, statusChangeMonthStart]
  );

  /** Select all slots on matching weekdays across the displayed status year (e.g. all Fridays). */
  const selectDayColumnForYear = useCallback(
    async (dayOffset: number) => {
      if (!selectedEquipment?.id || !statusChangePopupWeekStart) return;
      const sampleDay = addDays(statusChangePopupWeekStart, dayOffset);
      const targetDow = sampleDay.getDay();
      const y = statusChangeMonthStart.getFullYear();
      const yearStart = startOfYear(statusChangeMonthStart);
      const yearEnd = endOfYear(statusChangeMonthStart);
      try {
        const res = await apiClient.getEquipmentSlots(
          selectedEquipment.id,
          format(yearStart, "yyyy-MM-dd"),
          format(yearEnd, "yyyy-MM-dd")
        );
        const data = (res as { data?: { slots?: DailySlot[] } }).data;
        const yearSlots = data?.slots ?? [];
        const matching = yearSlots.filter((s) => {
          const dStr = calendarDateStrFromSlot(s);
          if (!dStr) return false;
          const d = parseISO(`${dStr.slice(0, 10)}T12:00:00`);
          return d.getDay() === targetDow;
        });
        const ids = matching.map((s) => s.id);
        const datesToAdd = [
          ...new Set(
            matching
              .map((s) => calendarDateStrFromSlot(s))
              .filter(Boolean) as string[]
          ),
        ].sort();
        const monthsToAdd = [...new Set(datesToAdd.map((d) => d.slice(0, 7)))].sort();
        setSelectedSlotIdsForStatus((prev) => Array.from(new Set([...prev, ...ids])));
        setSelectedDatesForStatus((prev) => Array.from(new Set([...prev, ...datesToAdd])).sort());
        setStatusChangeSelectedMonths((prev) => Array.from(new Set([...prev, ...monthsToAdd])).sort());
        toast.success(
          `Selected ${ids.length} slot(s) for all ${format(sampleDay, "EEEE")}s in ${y}.`
        );
      } catch {
        toast.error("Failed to load year slots.");
      }
    },
    [selectedEquipment?.id, statusChangePopupWeekStart, statusChangeMonthStart]
  );

  // Week popup: select all slots in this week that are AVAILABLE
  const selectAllAvailableSlotsInPopup = () => {
    if (!statusChangeSlots || statusChangeSlots.length === 0) return;
    const ids = statusChangeSlots.filter((s) => s.status === "AVAILABLE").map((s) => s.id);
    if (ids.length === 0) return;
    setSelectedSlotIdsForStatus((prev) => {
      const set = new Set([...prev, ...ids]);
      return Array.from(set);
    });
  };

  // Week popup: select all slots in this week except BOOKED+COMPLETED
  const selectAllNonCompletedSlotsInPopup = () => {
    if (!statusChangeSlots || statusChangeSlots.length === 0) return;
    const ids = statusChangeSlots
      .filter((s) => {
        if (s.status === "BOOKED" && (String(s.booking_status || "").toUpperCase() === "COMPLETED")) return false;
        return true;
      })
      .map((s) => s.id);
    if (ids.length === 0) return;
    setSelectedSlotIdsForStatus((prev) => {
      const set = new Set([...prev, ...ids]);
      return Array.from(set);
    });
  };

  // Week popup: select all BOOKED slots in this window (excluding completed)
  const selectAllBookedSlotsInPopup = () => {
    if (!statusChangeSlots || statusChangeSlots.length === 0) return;
    const ids = statusChangeSlots
      .filter((s) => s.status === "BOOKED" && String(s.booking_status || "").toUpperCase() !== "COMPLETED")
      .map((s) => s.id);
    if (ids.length === 0) return;
    setSelectedSlotIdsForStatus((prev) => {
      const set = new Set([...prev, ...ids]);
      return Array.from(set);
    });
  };

  // Week popup: clear selection for slots that belong to this popup week only
  const clearPopupWeekSelection = () => {
    if (!statusChangeSlots || statusChangeSlots.length === 0) return;
    const weekIds = new Set(statusChangeSlots.map((s) => s.id));
    setSelectedSlotIdsForStatus((prev) => prev.filter((id) => !weekIds.has(id)));
  };

  const statusChangeCanSelectSlot = (s: DailySlot | null | undefined) => {
    if (!s) return false;
    if (newSlotStatus === "BOOKING_NOT_UTILIZED" || newSlotStatus === RESCHEDULE_OPERATION_VALUE)
      return s.status === "BOOKED" && (s.booking_status || "").toUpperCase() !== "COMPLETED";
    if (s.status === "BOOKED" && (s.booking_status || "").toUpperCase() === "COMPLETED") return false;
    return true;
  };

  const selectEntireWeekInPopup = () => {
    if (!statusChangeSlots?.length) return;
    const ids = statusChangeSlots.filter((s) => statusChangeCanSelectSlot(s)).map((s) => s.id);
    if (ids.length === 0) return;
    setSelectedSlotIdsForStatus((prev) => Array.from(new Set([...prev, ...ids])));
    toast.success(`Selected ${ids.length} slot(s) for this week.`);
  };

  const selectWeekdaysInPopup = () => {
    if (!statusChangeSlots?.length || !statusChangePopupWeekStart) return;
    const ids = statusChangeSlots
      .filter((s) => {
        const dStr = calendarDateStrFromSlot(s);
        if (!dStr) return false;
        const dow = parseISO(`${dStr}T12:00:00`).getDay();
        return dow >= 1 && dow <= 5 && statusChangeCanSelectSlot(s);
      })
      .map((s) => s.id);
    if (ids.length === 0) return;
    setSelectedSlotIdsForStatus((prev) => Array.from(new Set([...prev, ...ids])));
    toast.success(`Selected ${ids.length} weekday slot(s).`);
  };

  const selectWeekendsInPopup = () => {
    if (!statusChangeSlots?.length) return;
    const ids = statusChangeSlots
      .filter((s) => {
        const dStr = calendarDateStrFromSlot(s);
        if (!dStr) return false;
        const dow = parseISO(`${dStr}T12:00:00`).getDay();
        return (dow === 0 || dow === 6) && statusChangeCanSelectSlot(s);
      })
      .map((s) => s.id);
    if (ids.length === 0) return;
    setSelectedSlotIdsForStatus((prev) => Array.from(new Set([...prev, ...ids])));
    toast.success(`Selected ${ids.length} weekend slot(s).`);
  };

  const slotTimeHour = (time: string) => {
    const m = time.match(/^(\d{1,2}):(\d{2})/);
    return m ? Number(m[1]) : 12;
  };

  const selectMorningSlotsInPopup = () => {
    if (!statusChangeSlots?.length) return;
    const ids = statusChangeSlots
      .filter((s) => slotTimeHour(timeKeyFromDailySlot(s)) < 12 && statusChangeCanSelectSlot(s))
      .map((s) => s.id);
    if (ids.length === 0) return;
    setSelectedSlotIdsForStatus((prev) => Array.from(new Set([...prev, ...ids])));
    toast.success(`Selected ${ids.length} morning slot(s).`);
  };

  const selectAfternoonSlotsInPopup = () => {
    if (!statusChangeSlots?.length) return;
    const ids = statusChangeSlots
      .filter((s) => slotTimeHour(timeKeyFromDailySlot(s)) >= 12 && statusChangeCanSelectSlot(s))
      .map((s) => s.id);
    if (ids.length === 0) return;
    setSelectedSlotIdsForStatus((prev) => Array.from(new Set([...prev, ...ids])));
    toast.success(`Selected ${ids.length} afternoon slot(s).`);
  };

  const invertSelectionInPopup = () => {
    if (!statusChangeSlots?.length) return;
    const selectableIds = statusChangeSlots.filter((s) => statusChangeCanSelectSlot(s)).map((s) => s.id);
    setSelectedSlotIdsForStatus((prev) => {
      const prevSet = new Set(prev);
      const next = new Set(prev);
      selectableIds.forEach((id) => {
        if (prevSet.has(id)) next.delete(id);
        else next.add(id);
      });
      return Array.from(next);
    });
    toast.success("Selection inverted for this week.");
  };

  // Week popup: navigate to previous/next week
  const goToPrevWeekInPopup = () => {
    if (statusChangePopupWeekStart) setStatusChangePopupWeekStart(subWeeks(statusChangePopupWeekStart, 1));
  };
  const goToNextWeekInPopup = () => {
    if (statusChangePopupWeekStart) setStatusChangePopupWeekStart(addWeeks(statusChangePopupWeekStart, 1));
  };

  // Change slot status card: open bulk email dialog for selected slots (or slots on selected dates)
  const openBulkEmailFromStatusCard = useCallback(async () => {
    if (!selectedEquipment?.id) return;
    let slotIds: number[] = [];
    if (selectedSlotIdsForStatus.length > 0) {
      slotIds = selectedSlotIdsForStatus;
    } else {
      const effectiveDates = selectedDatesForStatus.length > 0 || statusChangeSelectedMonths.length > 0
        ? (() => {
            const dateSet = new Set<string>(selectedDatesForStatus);
            statusChangeSelectedMonths.forEach((monthKey) => {
              const [y, m] = monthKey.split("-").map(Number);
              const start = new Date(y, m - 1, 1);
              const end = endOfMonth(start);
              eachDayOfInterval({ start, end }).forEach((d) => dateSet.add(format(d, "yyyy-MM-dd")));
            });
            return Array.from(dateSet).sort();
          })()
        : [];
      if (effectiveDates.length > 0) {
        try {
          const start = effectiveDates[0];
          const end = effectiveDates[effectiveDates.length - 1];
          const res = await apiClient.getEquipmentSlots(selectedEquipment.id, start, end);
          const data = (res as { data?: { slots?: DailySlot[] } }).data;
          const slots = data?.slots ?? [];
          const dateSet = new Set(effectiveDates);
          slotIds = slots.filter((s) => s.date && dateSet.has(s.date.slice(0, 10))).map((s) => s.id);
        } catch (e) {
          toast.error("Failed to load slots for selected dates.");
          return;
        }
      }
    }
    if (slotIds.length === 0) {
      toast.info("Select slots (Week view) or dates/months first, then click Bulk email.");
      return;
    }
    setBulkEmailTemplatesLoading(true);
    setBulkEmailOpen(true);
    setBulkEmailRecipients([]);
    setBulkEmailSubject("");
    setBulkEmailBody("");
    try {
      const res = await apiClient.getBulkEmailRecipients(slotIds);
      const data = (res as { data?: { recipients?: Array<{ email: string; name: string }> } }).data;
      const recipients = data?.recipients ?? [];
      setBulkEmailRecipients(recipients);
      if (recipients.length === 0) {
        toast.info("No booked slots in selection (recipients are from booked, non-completed slots).");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load recipients or templates");
    } finally {
      setBulkEmailTemplatesLoading(false);
    }
  }, [selectedEquipment?.id, selectedSlotIdsForStatus, selectedDatesForStatus, statusChangeSelectedMonths]);

  const sendBulkEmailFromDialog = async () => {
    const emails = bulkEmailRecipients.map((r) => r.email).filter(Boolean);
    if (!emails.length) {
      toast.error("No recipients.");
      return;
    }
    if (!bulkEmailSubject.trim()) {
      toast.error("Subject is required.");
      return;
    }
    if (!bulkEmailBody.trim()) {
      toast.error("Body is required.");
      return;
    }
    setSendingBulkEmail(true);
    try {
      const res = await apiClient.sendBulkEmail(emails, bulkEmailSubject.trim(), bulkEmailBody.trim());
      const data = res.data as { message?: string; sent_count?: number; failed_count?: number; failed?: Array<{ email: string; error: string }> } | undefined;
      toast.success(data?.message ?? "Emails sent.");
      if (data?.failed_count && data.failed?.length) {
        data.failed.slice(0, 3).forEach((f) => toast.error(`${f.email}: ${f.error}`));
      }
      setBulkEmailOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send emails");
    } finally {
      setSendingBulkEmail(false);
    }
  };

  // Select all slots at this time for the entire displayed month (fetch month slots then filter by time)
  const selectTimeRowForMonth = useCallback(async (time: string) => {
    if (!selectedEquipment?.id) return;
    const monthStart = startOfMonth(statusChangeMonthStart);
    const monthEnd = endOfMonth(statusChangeMonthStart);
    try {
      const res = await apiClient.getEquipmentSlots(selectedEquipment.id, format(monthStart, "yyyy-MM-dd"), format(monthEnd, "yyyy-MM-dd"));
      const data = (res as { data?: { slots?: DailySlot[] } }).data;
      const monthSlots = data?.slots ?? [];
      const matchingSlots = monthSlots.filter((s) => timeKeyFromDailySlot(s) === time);
      const ids = matchingSlots.map((s) => s.id);
      const datesToAdd = [...new Set(matchingSlots.map((s) => {
        if (!s.date) return "";
        return s.date.includes("T") ? format(parseISO(s.date), "yyyy-MM-dd") : s.date.slice(0, 10);
      }).filter(Boolean))].sort();
      setSelectedSlotIdsForStatus((prev) => {
        const set = new Set([...prev, ...ids]);
        return Array.from(set);
      });
      setSelectedDatesForStatus((prev) => {
        const set = new Set([...prev, ...datesToAdd]);
        return Array.from(set).sort();
      });
      toast.success(`Added ${ids.length} slot(s) at ${time} for the month.`);
    } catch {
      toast.error("Failed to load month slots.");
    }
  }, [selectedEquipment?.id, statusChangeMonthStart]);

  // Select all slots at this time for the entire displayed year (fetch year slots then filter by time)
  const selectTimeRowForYear = useCallback(async (time: string) => {
    if (!selectedEquipment?.id) return;
    const y = statusChangeMonthStart.getFullYear();
    const yearStart = startOfYear(statusChangeMonthStart);
    const yearEnd = endOfYear(statusChangeMonthStart);
    try {
      const res = await apiClient.getEquipmentSlots(selectedEquipment.id, format(yearStart, "yyyy-MM-dd"), format(yearEnd, "yyyy-MM-dd"));
      const data = (res as { data?: { slots?: DailySlot[] } }).data;
      const yearSlots = data?.slots ?? [];
      const matchingSlots = yearSlots.filter((s) => timeKeyFromDailySlot(s) === time);
      const ids = matchingSlots.map((s) => s.id);
      const datesToAdd = [...new Set(matchingSlots.map((s) => {
        if (!s.date) return "";
        return s.date.includes("T") ? format(parseISO(s.date), "yyyy-MM-dd") : s.date.slice(0, 10);
      }).filter(Boolean))].sort();
      setSelectedSlotIdsForStatus((prev) => {
        const set = new Set([...prev, ...ids]);
        return Array.from(set);
      });
      setSelectedDatesForStatus((prev) => {
        const set = new Set([...prev, ...datesToAdd]);
        return Array.from(set).sort();
      });
      // Also add those months to year-level selection so the year calendar highlights
      const monthsToAdd = [...new Set(datesToAdd.map((d) => d.slice(0, 7)))].sort();
      setStatusChangeSelectedMonths((prev) => {
        const set = new Set([...prev, ...monthsToAdd]);
        return Array.from(set).sort();
      });
      toast.success(`Added ${ids.length} slot(s) at ${time} for ${y}.`);
    } catch {
      toast.error("Failed to load year slots.");
    }
  }, [selectedEquipment?.id, statusChangeMonthStart]);

  const setStatusChangeSlotColor = (status: string, hex: string) => {
    setStatusChangeSlotColors((prev) => {
      const next = { ...prev, [status]: hex };
      try {
        localStorage.setItem("slotStatusColors", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const fetchEquipmentDetail = useCallback(async (equipmentId: number | string) => {
    if (equipmentAccessBlockedRef.current) return;
    try {
      setLoadingEquipmentDetail(true);
      const response = await apiClient.getEquipmentDetailById(equipmentId);
      
      if (response.error) {
        const kind = classifyEquipmentAccessFailure(response);
        if (kind === "forbidden" || kind === "not_found") {
          equipmentAccessBlockedRef.current = true;
          notifyEquipmentAccessFailure(kind, response.error);
          setLoadingEquipmentDetail(false);
          navigate("/dashboard", { replace: true });
          return;
        }
        toast.error(response.error || "Failed to load equipment details", {
          id: "equipment-load-error",
        });
        setLoadingEquipmentDetail(false);
        return;
      }

      if (!response.data) {
        equipmentAccessBlockedRef.current = true;
        notifyEquipmentAccessFailure("not_found");
        setLoadingEquipmentDetail(false);
        navigate("/dashboard", { replace: true });
        return;
      }

      const eq = response.data;
      
      // Store full equipment detail for slot processing
      // But don't process slots yet - wait for charge calculation
      setEquipmentDetail(eq);
      
      // Reset charge calculation state when equipment changes
      setChargeCalculated(false);
      setCalculatedCharge(null);
      setShowSlots(false);
      setSelectedSlots([]);
      setLastFetchedWeek(null);
      setChargeCalculationFailed(false);
      lastCalculatedValuesRef.current = '';
      fetchingSlotsRef.current = false;

      // Per-equipment default for auto-slot-selection (falls back to user's preference).
      // Note: selection itself only happens after charge is calculated, so it's safe even when Step 1 has required fields.
      const eqDefault = (eq as any)?.auto_slot_selection_default;
      if (eqDefault === true || eqDefault === false) {
        setAutoSlotSelection(eqDefault);
      } else {
        setAutoSlotSelection(userAutoSlotSelectionPrefRef.current);
      }

      // Internal users: default to current week when switching equipment (before ref = last+current, after ref = current+next)
      const uVal: any = userType;
      let nType: string | null = null;
      if (typeof uVal === 'string') nType = uVal.toLowerCase();
      else if (typeof uVal === 'number') nType = uVal === 1 ? 'student' : uVal === 2 ? 'faculty' : null;
      if (nType === 'student' || nType === 'faculty') {
        setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
      }
      
      // Initialize input field values with default values
      if (eq.input_fields && eq.input_fields.length > 0) {
        
        const initialValues: Record<string, string | boolean | string[] | number | string[][]> = {};
        eq.input_fields.forEach((field: any) => {
          const fieldType = String(field.field_type || '').toUpperCase().trim();
          if (fieldType === 'PERIODIC_TABLE') {
            const { preselected } = parsePeriodicHelpText(field.help_text);
            const fromOptions =
              field.options && Array.isArray(field.options)
                ? field.options.map((s: string) => String(s).trim()).filter(Boolean)
                : [];
            const { all, billable } = mergePeriodicDisplaySymbols(
              [...fromOptions, ...Array.from(preselected)],
              field.help_text
            );
            initialValues[field.field_key] = billable.length;
            initialValues[field.field_key + '_elements'] = all.join(',');
          } else {
            initialValues[field.field_key] = getInitialDynamicInputValue(field, eq.input_fields);
          }
        });
        applyTableRowSyncToValues(initialValues as Record<string, unknown>, eq.input_fields);
        setInputFieldValues(initialValues);
        setIcpmsCoverageByFieldKey({});
      }
      
      // Get pricing from charge_profiles (use first active profile or student profile)
      const studentProfile = eq.charge_profiles?.find(
        (p: any) => p.user_type === "student" && p.is_active
      );
      const firstActiveProfile = eq.charge_profiles?.find((p: any) => p.is_active);
      const pricingProfile = studentProfile || firstActiveProfile;
      
      // Transform API response to match EquipmentData interface
      const transformedEquipment: Equipment = {
        id: eq.equipment_id,
        name: eq.name,
        category: eq.category_name || "",
        description: eq.description || eq.name,
        image: eq.image_url ? apiClient.getEquipmentImageProxyPath(eq.equipment_id) : "/placeholder.svg",
        video: "", // API doesn't provide video_url in detail response
        available: eq.status === "ACTIVE",
        address: eq.location || "",
        technicalPerson: "", // API doesn't provide technical_contact in detail response
        contactNumber: "", // API doesn't provide this separately
        internalRate: pricingProfile ? parseFloat(pricingProfile.primary_unit_charge || "0") : 0,
        externalRate: pricingProfile ? parseFloat(pricingProfile.secondary_unit_charge || "0") : 0,
        // Keep canonical backend status for booking enable/disable checks.
        status: eq.status,
        status_display: eq.status_display,
      };

      setSelectedEquipment(transformedEquipment);
    } catch (error: any) {
      toast.error(error.message || "Failed to load equipment details", {
        id: "equipment-load-error",
      });
    } finally {
      setLoadingEquipmentDetail(false);
    }
  }, [navigate]);

  const handleEquipmentSelect = useCallback((equipmentId: number | string) => {
    fetchEquipmentDetail(equipmentId);
  }, [fetchEquipmentDetail]);

  // Handle equipment_id from URL query parameters
  useEffect(() => {
    const equipmentId = searchParams.get('equipment_id');

    // If no equipment_id, redirect to equipment listing
    if (!equipmentId && !selectedEquipment) {
      navigate('/equipments');
      return;
    }

    // New equipment deep-link: allow a fresh fetch attempt.
    if (equipmentId && selectedEquipment && String(selectedEquipment.id) !== String(equipmentId)) {
      equipmentAccessBlockedRef.current = false;
    }

    if (equipmentAccessBlockedRef.current) {
      return;
    }

    // Auto-select equipment if equipment_id is provided in URL
    if (equipmentId && !selectedEquipment && !loadingEquipmentDetail) {
      handleEquipmentSelect(equipmentId);
    }
  }, [searchParams, selectedEquipment, loadingEquipmentDetail, handleEquipmentSelect, navigate]);

  useEffect(() => {
    if (isCalculateChargesFlow && !apiClient.getToken()) return;
    apiClient.getMyRewardSummary().then((res) => {
      if (res.data) setRewardSummary(res.data as { points_balance: string; currency_per_point: string; config?: { is_enabled: boolean } });
    }).catch(() => setRewardSummary(null));
  }, [selectedEquipment?.id, isCalculateChargesFlow]);

  // Repeat-sample flow: when repeatOf is in URL, load that booking and prefill form (read-only params, zero charge, user picks slots)
  useEffect(() => {
    const repeatOfRaw = (searchParams.get("repeatOf") || "").trim();
    if (!repeatOfRaw || !selectedEquipment) {
      setRepeatSourceBooking(null);
      return;
    }
    let cancelled = false;
    setRepeatSourceLoading(true);
    setRepeatSourceBooking(null);
    (async () => {
      let bid: number | null = null;
      if (/^\d+$/.test(repeatOfRaw)) {
        bid = parseInt(repeatOfRaw, 10);
      } else {
        const searchRes = await apiClient.getBookings({ search: repeatOfRaw, limit: 1 });
        const row = searchRes.data?.bookings?.[0] as BookingRef | undefined;
        if (!searchRes.error && row) bid = getRealBookingId(row);
      }
      if (bid == null) {
        if (!cancelled) {
          setRepeatSourceLoading(false);
          toast.error("Repeat source booking not found.");
        }
        return;
      }
      const [bookingsRes, eligibilityRes] = await Promise.all([
        apiClient.getBookings({ booking_id: bid, limit: 1 }),
        apiClient.getRepeatSampleEligibility(bid),
      ]);
      if (cancelled) return;
      setRepeatSourceLoading(false);
      if (bookingsRes.error || !bookingsRes.data?.bookings?.length) {
        toast.error("Repeat source booking not found.");
        return;
      }
      const b = bookingsRes.data.bookings[0];
      if (Number(b.equipment) !== Number(selectedEquipment.id)) {
        toast.error("Repeat booking must be for the same equipment.");
        return;
      }
      if (!eligibilityRes.data?.can_create_repeat) {
        toast.error(eligibilityRes.data?.reason || "You cannot create a repeat for this booking.");
        return;
      }
      const zeroBreakdown = [{ description: "Repeat sample (complimentary — no charge)", amount: 0 }];
      setRepeatSourceBooking({
        booking_id: b.booking_id,
        /** Backend URLs use numeric PK only (not virtual/display id). */
        real_booking_id: bid,
        equipment: b.equipment,
        virtual_booking_id: b.virtual_booking_id,
        input_values: b.input_values || {},
        total_charge: 0,
        total_time_minutes: b.total_time_minutes || 0,
        charge_breakdown: zeroBreakdown,
      });
      setInputFieldValues(b.input_values || {});
      setChargeCalculated(true);
      setCalculatedCharge({
        total_charge: "0",
        total_time_minutes: b.total_time_minutes || 0,
        charge_breakdown: zeroBreakdown,
        base_charge: "0",
        gst_percent: 0,
        gst_amount: "0",
      });
      setShowSlots(true);
      setChargeCalculationFailed(false);
      setSelectedSlots([]);
      setAutoSlotSelection(false);
    })();
    return () => { cancelled = true; };
  }, [searchParams, selectedEquipment?.id]);

  // When landing with mode=status or mode=book, sync manage mode from URL (including switching mode on same equipment)
  useEffect(() => {
    const mode = searchParams.get('mode');
    if (!mode || !selectedEquipment || !canAccessManageEquipmentModes()) return;
    const urlKey = `${selectedEquipment.id}:${mode}`;
    if (appliedModeUrlKeyRef.current === urlKey) return;
    appliedModeUrlKeyRef.current = urlKey;
    if (mode === 'status' && canChangeSlotStatus()) setAdminManageMode('status');
    else if (mode === 'book' && canBookForOtherUsers()) setAdminManageMode('book');
  }, [searchParams, selectedEquipment]);

  // Optional ?month=YYYY-MM focuses Change slot status calendar on that month (e.g. from multi-mode schedules)
  useEffect(() => {
    if (adminManageMode !== "status") return;
    const monthParam = (searchParams.get("month") || "").trim();
    const m = monthParam.match(/^(\d{4})-(\d{2})$/);
    if (!m) return;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    if (!y || mo < 1 || mo > 12) return;
    const next = startOfMonth(new Date(y, mo - 1, 1));
    setStatusChangeMonthStart((prev) => (isSameMonth(prev, next) ? prev : next));
  }, [adminManageMode, searchParams]);

  // Reset input field values when equipment changes
  useEffect(() => {
    if (!equipmentDetail) {
      setInputFieldValues({});
      setChargeCalculated(false);
      setCalculatedCharge(null);
      setShowSlots(false);
    }
  }, [equipmentDetail]);

  useEffect(() => {
    if (!isCalculateChargesFlow || !equipmentDetail) return;
    const codes = CHARGE_ESTIMATE_USER_TYPE_OPTIONS.map((o) => o.code);
    const loggedInType = normalizeUserTypeCode(userType);
    const initial =
      loggedInType && codes.includes(loggedInType) ? loggedInType : codes[0];
    setChargeEstimateUserType((prev) => (prev && codes.includes(prev) ? prev : initial));
  }, [isCalculateChargesFlow, equipmentDetail, userType]);

  // Calculate charge based on input fields
  const calculateCharge = useCallback(async () => {
    if (!selectedEquipment || !equipmentDetail) {
      return;
    }
    if (repeatSourceBooking) {
      return;
    }

    if (isCalculateChargesFlow && !chargeEstimateUserType) {
      return;
    }

    if (equipmentDetail.profile_type === "PRINT_3D" && !printAnalysisId && !printAnalysisBatchId) {
      return;
    }

    // Skip if already loading to prevent concurrent calls (booking flow only; estimate re-queues)
    if (loadingCharge && !isCalculateChargesFlow) {
      return;
    }

    const sampleReturnFlag = bookingAsExternalTarget ? sampleReturnAfterAnalysis : false;
    const currentValuesHash = buildChargeCalculationHash({
      inputFieldValues,
      printAnalysisId,
      printAnalysisBatchId,
      sampleReturnAfterAnalysis: sampleReturnFlag,
      chargeEstimateUserType: isCalculateChargesFlow ? chargeEstimateUserType : null,
    });
    if (lastCalculatedValuesRef.current === currentValuesHash) {
      return; // Already calculated for these values
    }

    // Validate required input fields before calculating (only if input fields exist)
    // Note: This validation is already done in the useEffect, but keeping as a safety check
    if (equipmentDetail.input_fields && equipmentDetail.input_fields.length > 0) {
      const requiredFields = equipmentDetail.input_fields.filter((field: any) => field.is_required);
      for (const field of requiredFields) {
        const value = inputFieldValues[field.field_key];
        if (value === undefined || value === null || value === '' || 
            (Array.isArray(value) && value.length === 0)) {
          // Don't show error toast for auto-calculation, just return
          return;
        }
      }
      // Parameters A and B (when present): NUMERIC must be within configured min/max; RADIO/COMBO must have a selection.
      if (equipmentDetail.profile_type !== "PRINT_3D") {
        const abKeys = ['A', 'B'];
        for (const key of abKeys) {
        const field = equipmentDetail.input_fields.find((f: any) => f.field_key === key);
        if (field) {
          const fieldType = String(field.field_type || '').toUpperCase().trim();
          const raw = inputFieldValues[key];
          const label = field.field_label || key;
          if (fieldType === 'RADIO' || fieldType === 'COMBO') {
            if (raw === undefined || raw === null || raw === '') {
              if (!isCalculateChargesFlow) toast.error(`Please select "${label}".`);
              return;
            }
            continue;
          }
          if (fieldType === 'PERIODIC_TABLE') {
            // Billable count may be 0 when only locked preselected elements (`/C`) are set.
            continue;
          }
          if (fieldType === 'NUMERIC') {
            const formulaMax =
              key === "A" && !bookingAsExternalTarget
                ? resolveDynamicMaxForFieldA(field, inputFieldValues, equipmentDetail, false)
                : undefined;
            const bounds = resolveNumericFieldBounds(field, formulaMax);
            if (!isNumericValueWithinBounds(raw, field, formulaMax)) {
              if (!isCalculateChargesFlow) {
                toast.error(
                  `"${label}" must be between ${formatNumericBound(bounds.min)} and ${formatNumericBound(bounds.max)}.`
                );
              }
              return;
            }
          }
        }
        }
      }
    }

    // If no input fields, we still need to call the API with empty values
    // This ensures slots only appear after successful charge calculation

    const requestSeq = ++chargeRequestSeqRef.current;

    try {
      setLoadingCharge(true);
      const response = await apiClient.calculateEquipmentCharge(
        selectedEquipment.id,
        inputFieldValues,
        {
          ...(isCalculateChargesFlow && chargeEstimateUserType
            ? { user_type: chargeEstimateUserType }
            : isAdminOrOIC() && adminBookForUserId
              ? { user_id: adminBookForUserId }
              : {}),
          ...(rewardPointsToRedeem.trim() && !isCalculateChargesFlow ? { reward_points_to_redeem: rewardPointsToRedeem.trim() } : {}),
          ...(bookingAsExternalTarget ? { sample_return_after_analysis: sampleReturnAfterAnalysis } : {}),
          ...(equipmentDetail.profile_type === "PRINT_3D" && printAnalysisBatchId
            ? { print_analysis_batch_id: printAnalysisBatchId }
            : equipmentDetail.profile_type === "PRINT_3D" && printAnalysisId
              ? { print_analysis_id: printAnalysisId }
              : {}),
        }
      );

      if (response.error) {
        if (requestSeq !== chargeRequestSeqRef.current) return;
        setChargeCalculationFailed(true);
        setChargeCalculated(false);
        setCalculatedCharge(null);
        setShowSlots(false);
        lastCalculatedValuesRef.current = currentValuesHash;
        // Always surface errors for staff (Coming Soon UI is hidden for admin).
        if (isAdminOrOIC() || isCalculateChargesFlow) {
          toast.error(response.error);
        }
        return;
      }

      if (response.data) {
        if (requestSeq !== chargeRequestSeqRef.current) return;
        const totalMinutes = response.data.total_time_minutes ?? 0;
        const abFields = equipmentDetail.input_fields?.filter(
          (f: any) => f.field_key === 'A' || f.field_key === 'B'
        ) ?? [];
        // PRINT_3D uses A=weight, B=material, C=time — do not treat low time as invalid A/B samples.
        if (
          equipmentDetail.profile_type !== "PRINT_3D" &&
          abFields.length > 0 &&
          totalMinutes < 1
        ) {
          const labels = abFields.map((f: any) => f.field_label || f.field_key).join(' and ');
          toast.error(`"${labels}" must be at least 1. Please update Step 1 and recalculate charge.`);
          setChargeCalculationFailed(true);
          setChargeCalculated(false);
          setCalculatedCharge(null);
          setShowSlots(false);
          lastCalculatedValuesRef.current = '';
          return;
        }
        setCalculatedCharge({
          total_charge: response.data.total_charge,
          total_time_minutes: response.data.total_time_minutes,
          charge_breakdown: response.data.charge_breakdown || [],
          show_charge_breakdown: response.data.show_charge_breakdown !== false,
          base_charge: response.data.base_charge,
          gst_percent: response.data.gst_percent ?? 0,
          gst_amount: response.data.gst_amount ?? "0",
          reward: response.data.reward,
        });
        setChargeCalculated(true);
        setShowSlots(!isProformaFlow && !isCalculateChargesFlow);
        setChargeCalculationFailed(false); // Reset failed state on success
        // When charge is (re)calculated, deselect all slots and turn off auto-select
        const wasAutoSelectOn = autoSlotSelectionRef.current;
        setSelectedSlots([]);
        setAutoSlotSelection(false);
        // If auto-select was on, turn it back on after state settles so the effect re-runs and selects the new desired number of slots
        if (wasAutoSelectOn) {
          setTimeout(() => setAutoSlotSelection(true), 0);
        }
        // Store the hash of values we just calculated for
        lastCalculatedValuesRef.current = currentValuesHash;
      }
    } catch (error: any) {
      if (requestSeq !== chargeRequestSeqRef.current) return;
      // Set failed state to show "coming soon" message
      setChargeCalculationFailed(true);
      setChargeCalculated(false);
      setCalculatedCharge(null);
      setShowSlots(false);
      // Store the hash even on failure to prevent retrying with same values
      lastCalculatedValuesRef.current = currentValuesHash;
      // Don't show error toast, just show "coming soon" message
    } finally {
      if (requestSeq === chargeRequestSeqRef.current) {
        setLoadingCharge(false);
      }
    }
  }, [selectedEquipment, equipmentDetail, inputFieldValues, loadingCharge, adminBookForUserId, repeatSourceBooking, searchParams, bookingAsExternalTarget, sampleReturnAfterAnalysis, rewardPointsToRedeem, printAnalysisId, printAnalysisBatchId, isCalculateChargesFlow, chargeEstimateUserType, isProformaFlow]);

  const handleExportChargeEstimatePdf = useCallback(async () => {
    if (!selectedEquipment || !equipmentDetail || !chargeCalculated || !calculatedCharge || chargeCalculationFailed) {
      toast.error("Complete the inputs and wait for charge calculation first.");
      return;
    }
    setExportingChargePdf(true);
    try {
      const labelMap: Record<string, string> = {};
      equipmentDetail.input_fields?.forEach((f: { field_key?: string; field_label?: string }) => {
        if (f.field_key) labelMap[f.field_key] = f.field_label || f.field_key;
      });
      const input_labels_and_values: Record<string, string | number> = {};
      Object.entries(inputFieldValues).forEach(([k, v]) => {
        if (v === "" || v === undefined || v === null) return;
        if (k.endsWith("_elements")) return;
        if (Array.isArray(v)) {
          input_labels_and_values[labelMap[k] ?? k] = v.join(", ");
          return;
        }
        input_labels_and_values[labelMap[k] ?? k] = typeof v === "boolean" ? (v ? "Yes" : "No") : v;
      });
      if (isCalculateChargesFlow && chargeEstimateUserType) {
        input_labels_and_values["User type"] = getChargeEstimateUserTypeLabel(chargeEstimateUserType);
      }
      const base = calculatedCharge.base_charge ?? calculatedCharge.total_charge;
      const gst = calculatedCharge.gst_amount ?? "0";
      const res = await apiClient.proformaInvoiceDownloadPdf({
        line_items: [
          {
            equipment_id: selectedEquipment.id,
            equipment_code: equipmentDetail.code ?? "",
            equipment_name: equipmentDetail.name ?? selectedEquipment.name,
            input_values: inputValuesForProformaStorage(inputFieldValues),
            input_labels_and_values,
            charge_breakdown: calculatedCharge.charge_breakdown,
            base_charge: String(base),
            gst_amount: String(gst),
            total_charge: calculatedCharge.total_charge,
          },
        ],
        subtotal: String(base),
        total_gst: String(gst),
        total_amount: calculatedCharge.total_charge,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      if (res.blob) {
        const url = URL.createObjectURL(res.blob);
        const a = document.createElement("a");
        a.href = url;
        const code = equipmentDetail.code || `equipment_${selectedEquipment.id}`;
        a.download = `charge_estimate_${code}_${new Date().toISOString().slice(0, 10)}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Charge estimate downloaded.");
      }
    } finally {
      setExportingChargePdf(false);
    }
  }, [
    selectedEquipment,
    equipmentDetail,
    chargeCalculated,
    calculatedCharge,
    chargeCalculationFailed,
    inputFieldValues,
    isCalculateChargesFlow,
    chargeEstimateUserType,
  ]);

  const handleProformaAddToInvoice = useCallback(() => {
    if (!selectedEquipment || !equipmentDetail || !chargeCalculated || !calculatedCharge || chargeCalculationFailed) {
      toast.error("Complete Step 1 and wait for charge calculation first.");
      return;
    }
    const existing = readProformaLineItemsFromStorage();
    const editing =
      proformaEditLineIndex != null &&
      existing[proformaEditLineIndex] &&
      Number(existing[proformaEditLineIndex].equipment_id) === Number(selectedEquipment.id);
    if (
      !editing &&
      existing.some((i) => i.equipment_id === selectedEquipment.id)
    ) {
      toast.error("This equipment is already in your proforma. Remove it on the proforma page to add again.");
      return;
    }
    const input_fields: ProformaLineItemField[] =
      Array.isArray(equipmentDetail.input_fields) && equipmentDetail.input_fields.length > 0
        ? equipmentDetail.input_fields.map((f: { field_key?: string; field_label?: string; field_type?: string; is_required?: boolean; default_value?: string; options?: ProformaLineItemField["options"]; help_text?: string }) => ({
            field_key: String(f.field_key ?? ""),
            field_label: String(f.field_label ?? f.field_key ?? ""),
            field_type: String(f.field_type ?? "NUMERIC"),
            is_required: f.is_required === true,
            default_value: String(f.default_value ?? ""),
            options: f.options ?? [],
            help_text: String(f.help_text ?? ""),
          }))
        : [
            { field_key: "A", field_label: "A (e.g. no. of samples)", field_type: "NUMERIC", default_value: "1" },
            { field_key: "B", field_label: "B (e.g. slots / elements)", field_type: "NUMERIC", default_value: "1" },
          ];
    const input_values = inputValuesForProformaStorage(inputFieldValues);
    const entry: ProformaLineItemStored = {
      equipment_id: selectedEquipment.id,
      equipment_code: equipmentDetail.code ?? "",
      equipment_name: equipmentDetail.name ?? selectedEquipment.name,
      profile_type: equipmentDetail.profile_type ?? "",
      input_fields,
      input_values,
    };
    const next: ProformaLineItemStored[] =
      editing && proformaEditLineIndex != null
        ? existing.map((row, i) => (i === proformaEditLineIndex ? entry : row))
        : [...existing, entry];
    writeProformaLineItemsToStorage(next);
    toast.success(editing ? "Proforma line updated." : "Equipment added to proforma.");
    navigate("/proforma-invoice");
  }, [
    selectedEquipment,
    equipmentDetail,
    chargeCalculated,
    calculatedCharge,
    chargeCalculationFailed,
    inputFieldValues,
    navigate,
    proformaEditLineIndex,
  ]);

  useEffect(() => {
    proformaEditHydratedRef.current = null;
  }, [selectedEquipment?.id]);

  useEffect(() => {
    if (!isProformaFlow || proformaEditLineIndex == null) {
      proformaEditInvalidToastRef.current = false;
      return;
    }
    if (loadingEquipmentDetail || !selectedEquipment || !equipmentDetail) return;
    if (Number(equipmentDetail.equipment_id) !== Number(selectedEquipment.id)) return;

    const items = readProformaLineItemsFromStorage();
    const line = items[proformaEditLineIndex];
    if (!line || Number(line.equipment_id) !== Number(selectedEquipment.id)) {
      if (!proformaEditInvalidToastRef.current) {
        proformaEditInvalidToastRef.current = true;
        toast.error("Could not load saved parameters for this line. Return to the proforma page and try Edit again.");
      }
      return;
    }
    proformaEditInvalidToastRef.current = false;

    const hydrateKey = `${selectedEquipment.id}:${proformaEditLineIndex}`;
    if (proformaEditHydratedRef.current === hydrateKey) return;
    proformaEditHydratedRef.current = hydrateKey;

    const merged = mergeProformaLineIntoInputFieldValues(line, equipmentDetail);
    setInputFieldValues(merged);
    lastCalculatedValuesRef.current = "";
    setChargeCalculated(false);
    setCalculatedCharge(null);
    setShowSlots(false);
    setChargeCalculationFailed(false);
  }, [
    isProformaFlow,
    proformaEditLineIndex,
    loadingEquipmentDetail,
    selectedEquipment?.id,
    equipmentDetail,
  ]);

  // Auto-calculate charge when input fields change
  useEffect(() => {
    // Clear any existing timeout
    if (calculationTimeoutRef.current) {
      clearTimeout(calculationTimeoutRef.current);
    }

    // Don't calculate if equipment is not loaded
    if (!selectedEquipment || !equipmentDetail) {
      return;
    }

    // Repeat-sample URL: wait until repeat booking is loaded (avoids full charge flashing before repeat state applies)
    if (searchParams.get("repeatOf")?.trim() && repeatSourceLoading) {
      return;
    }

    // Admin/OIC in "book for user" mode: require a selected user before calculating
    if (!isCalculateChargesFlow && isAdminOrOIC() && adminManageMode === 'book' && !adminBookForUserId) {
      return;
    }

    if (isCalculateChargesFlow && !chargeEstimateUserType) {
      return;
    }

    // Repeat-sample: charge is already set to 0 with discount; do not recalculate
    if (repeatSourceBooking) {
      return;
    }

    if (equipmentDetail.profile_type === "PRINT_3D" && !printAnalysisId && !printAnalysisBatchId) {
      if (chargeCalculated || chargeCalculationFailed) {
        setChargeCalculated(false);
        setCalculatedCharge(null);
        setShowSlots(false);
        setChargeCalculationFailed(false);
        lastCalculatedValuesRef.current = '';
      }
      return;
    }

    // Skip if already loading (booking flow only; estimate mode re-queues below)
    if (loadingCharge && !isCalculateChargesFlow) {
      return;
    }

    const sampleReturnFlag = bookingAsExternalTarget ? sampleReturnAfterAnalysis : false;
    const hasInputFields = equipmentDetail.input_fields && equipmentDetail.input_fields.length > 0;
    let allRequiredFilled = true;

    if (hasInputFields) {
      const requiredFields = equipmentDetail.input_fields.filter((field: any) => field.is_required);
      allRequiredFilled = requiredFields.every((field: any) => {
        const value = inputFieldValues[field.field_key];
        return value !== undefined && value !== null && value !== '' &&
               !(Array.isArray(value) && value.length === 0) &&
               !(typeof value === "number" && value === 0);
      });
    }

    const readyToCalculate = isCalculateChargesFlow
      ? Boolean(chargeEstimateUserType) && inputsReadyForChargeEstimate(equipmentDetail, inputFieldValues)
      : (!hasInputFields || allRequiredFilled);

    // Calculate charge when inputs are sufficient
    if (readyToCalculate) {
      const currentValuesHash = buildChargeCalculationHash({
        inputFieldValues,
        printAnalysisId,
        printAnalysisBatchId,
        sampleReturnAfterAnalysis: sampleReturnFlag,
        chargeEstimateUserType: isCalculateChargesFlow ? chargeEstimateUserType : null,
      });
      
      // Skip if we already calculated (or failed) for these exact values
      if (lastCalculatedValuesRef.current === currentValuesHash) {
        return;
      }

      // If previous calculation failed, reset the failed state when values change
      if (chargeCalculationFailed && lastCalculatedValuesRef.current !== currentValuesHash) {
        setChargeCalculationFailed(false);
      }

      // Admin booking for user with no input fields: run immediately so charge/slots/confirm populate
      const isAdminBookForUserNoInputs = isAdminOrOIC() && adminManageMode === "book" && adminBookForUserId && !hasInputFields;
      const debounceMs = isCalculateChargesFlow ? 250 : isAdminBookForUserNoInputs ? 0 : 500;

      calculationTimeoutRef.current = setTimeout(() => {
        calculateCharge();
      }, debounceMs);

      return () => {
        if (calculationTimeoutRef.current) {
          clearTimeout(calculationTimeoutRef.current);
        }
      };
    } else {
      // Reset charge calculation if required fields are not filled
      if (chargeCalculated || chargeCalculationFailed) {
        setChargeCalculated(false);
        setCalculatedCharge(null);
        setShowSlots(false);
        setChargeCalculationFailed(false);
        lastCalculatedValuesRef.current = ''; // Reset the hash
      }
    }
  }, [inputFieldValues, selectedEquipment, equipmentDetail, loadingCharge, chargeCalculated, chargeCalculationFailed, calculateCharge, adminManageMode, adminBookForUserId, repeatSourceBooking, repeatSourceLoading, searchParams, bookingAsExternalTarget, sampleReturnAfterAnalysis, printAnalysisId, printAnalysisBatchId, isCalculateChargesFlow, chargeEstimateUserType]);

  // Fetch slots for the current week (forceRefetch = true skips cache so Step 3 calendar shows updated statuses after Change slot status).
  // Optional weekStartOverride: use after Change slot status so booking Step 3 loads the same Mon–Sun week as the status week grid (avoids stale currentWeekStart).
  const fetchSlotsForWeek = useCallback(async (forceRefetch?: boolean, weekStartOverride?: Date) => {
    if (!selectedEquipment) return;

    const anchor = weekStartOverride ?? currentWeekStart;
    const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
    // Sync week before slot data applies so Step 3 columns (currentWeekStart) match daily_slots dates (avoids "no change" after Change slot status).
    if (weekStartOverride) {
      flushSync(() => {
        setCurrentWeekStart(weekStart);
      });
    }
    const weekEnd = addDays(weekStart, 6);
    const startDateStr = format(weekStart, "yyyy-MM-dd");
    const endDateStr = format(weekEnd, "yyyy-MM-dd");
    const weekKey = `${startDateStr}_${endDateStr}`;

    if (!forceRefetch && (fetchingSlotsRef.current || loadingSlots)) return;
    if (!forceRefetch && lastFetchedWeek === weekKey) return;

    try {
      fetchingSlotsRef.current = true;
      setLoadingSlots(true);
      const slotsResponse = await apiClient.getEquipmentSlots(
        selectedEquipment.id,
        startDateStr,
        endDateStr,
        { urgentWeekExtension: isUrgentHoldMode }
      );

      if ((slotsResponse as any)?.error) {
        throw new Error((slotsResponse as any).error);
      }
      if (slotsResponse.data) {
        const data = slotsResponse.data;
        const newSlots = data.slots ?? [];
        setEquipmentDetail(prev => {
          if (!prev) return prev;
          const newHolidays = data.holidays ?? {};
          const currentSlots = prev.daily_slots || [];
          const slotWindow = {
            ...(data.slot_start_time != null && { slot_start_time: data.slot_start_time }),
            ...(data.slot_end_time != null && { slot_end_time: data.slot_end_time }),
            ...(data.slot_duration_minutes != null && { slot_duration_minutes: data.slot_duration_minutes }),
            ...(data.slot_tolerance_minutes != null && {
              slot_tolerance_minutes: Math.max(0, Number(data.slot_tolerance_minutes) || 0),
            }),
            ...(data.slot_master_times && Array.isArray(data.slot_master_times) && { slot_master_times: data.slot_master_times }),
            ...(data.weekly_view_time_from != null && { weekly_view_time_from: data.weekly_view_time_from }),
            ...(data.weekly_view_time_to != null && { weekly_view_time_to: data.weekly_view_time_to }),
            ...(data.weekly_view_max_rows != null && { weekly_view_max_rows: data.weekly_view_max_rows }),
            ...(data.weekly_view_default_days != null && { weekly_view_default_days: data.weekly_view_default_days }),
            ...(data.slot_window_min_date != null && { slot_window_min_date: data.slot_window_min_date }),
            ...(data.slot_window_max_date != null && { slot_window_max_date: data.slot_window_max_date }),
            ...(data.slot_window_reference_weekday != null && { slot_window_reference_weekday: data.slot_window_reference_weekday }),
            ...(data.slot_window_reference_time != null && { slot_window_reference_time: data.slot_window_reference_time }),
            ...(typeof (data as { waitlist_queue_depth?: number }).waitlist_queue_depth === "number" && {
              waitlist_queue_depth: (data as { waitlist_queue_depth: number }).waitlist_queue_depth,
            }),
            ...(typeof (data as { waitlist_current_count?: number }).waitlist_current_count === "number" && {
              waitlist_current_count: (data as { waitlist_current_count: number }).waitlist_current_count,
            }),
            ...(typeof (data as { waitlist_has_room?: boolean }).waitlist_has_room === "boolean" && {
              waitlist_has_room: (data as { waitlist_has_room: boolean }).waitlist_has_room,
            }),
            ...(data.calendar_colors && typeof data.calendar_colors === 'object'
              ? {
                  calendar_colors: {
                    slot_colors: {
                      AVAILABLE: "#22c55e",
                      BOOKED: "#ef4444",
                      BLOCKED: "#64748b",
                      UNDER_MAINTENANCE: "#f97316",
                      OPERATOR_ABSENT: "#eab308",
                      BOOKING_NOT_UTILIZED: "#a855f7",
                      ...(data.calendar_colors.slot_colors || {}),
                    },
                    holiday_default: data.calendar_colors.holiday_default || '#f59e0b',
                    saturday_color: data.calendar_colors.saturday_color || '#c7d2fe',
                    sunday_color: data.calendar_colors.sunday_color || '#fbcfe8',
                  },
                }
              : {
                  calendar_colors: {
                    slot_colors: {
                      AVAILABLE: "#22c55e",
                      BOOKED: "#ef4444",
                      BLOCKED: "#64748b",
                      UNDER_MAINTENANCE: "#f97316",
                      OPERATOR_ABSENT: "#eab308",
                      BOOKING_NOT_UTILIZED: "#a855f7",
                    },
                    holiday_default: '#f59e0b',
                    saturday_color: '#c7d2fe',
                    sunday_color: '#fbcfe8',
                  },
                }),
          };
          if (!forceRefetch && JSON.stringify(currentSlots) === JSON.stringify(newSlots) && JSON.stringify(prev.weekly_holidays ?? {}) === JSON.stringify(newHolidays)) {
            return { ...prev, ...slotWindow };
          }
          return {
            ...prev,
            daily_slots: newSlots,
            weekly_holidays: newHolidays,
            ...slotWindow,
          };
        });
        setLastFetchedWeek(weekKey);
      } else {
        toast.error("Slots API returned no data for this week.");
        setLastFetchedWeek(weekKey);
        setEquipmentDetail((prev) => (prev ? { ...prev, daily_slots: [] } : prev));
      }
    } catch (error: any) {
      console.error("Error fetching slots:", error);
      toast.error(error?.message || "Could not load slots for this week. Please try again or pick another week.");
      setEquipmentDetail((prev) => (prev ? { ...prev, daily_slots: [] } : prev));
    } finally {
      setLoadingSlots(false);
      fetchingSlotsRef.current = false;
    }
  }, [selectedEquipment, currentWeekStart, loadingSlots, lastFetchedWeek, isUrgentHoldMode]);

  // After changing slots in mode=status, switching to booking (mode=book or UI) must reload Step 3 slot data
  useEffect(() => {
    const prev = prevAdminManageModeRef.current;
    prevAdminManageModeRef.current = adminManageMode;
    if (prev !== 'status' || adminManageMode !== 'book') return;
    if (!selectedEquipment || !showSlots || !chargeCalculated) return;
    fetchSlotsForWeek(true);
  }, [adminManageMode, selectedEquipment, showSlots, chargeCalculated, fetchSlotsForWeek]);

  const processDailySlots = useCallback(() => {
    if (!equipmentDetail?.daily_slots) {
      return;
    }

    // Check if current week is allowed for this user
    if (!isWeekAllowed(currentWeekStart)) {
      return;
    }

    const weekEnd = addDays(currentWeekStart, 7);

    equipmentDetail.daily_slots.forEach((slot) => {
      try {
        // Parse the date string (format: "2026-01-05")
        const slotDate = startOfDay(parseISO(slot.date));
        const startDate = parseISO(slot.start_datetime);
        const weekStart = startOfDay(currentWeekStart);
        const weekEndDate = startOfDay(weekEnd);
        
        // Only include slots within the current week view (compare dates only, not times)
        // Check if slot date is within the week range (inclusive start, exclusive end)
        const slotTime = slotDate.getTime();
        const weekStartTime = weekStart.getTime();
        const weekEndTime = weekEndDate.getTime();
        
        if (slotTime >= weekStartTime && slotTime < weekEndTime) {
          // Use slot.status to determine if it's booked or not
          const isBooked = slot.status !== "AVAILABLE";
        }
      } catch (error) {
        console.error("Error processing slot:", error, slot);
      }
    });
  }, [equipmentDetail, currentWeekStart]);

  useEffect(() => {
    // Only process slots if charge has been calculated and slots should be shown
    if (selectedEquipment && equipmentDetail && showSlots && chargeCalculated) {
      if (equipmentDetail.profile_type === "HOUR" && equipmentDetail.daily_slots && equipmentDetail.daily_slots.length > 0) {
        // Use daily_slots from API response
        processDailySlots();
      } else {
        // No daily slots available, clear booked slots
      }
    }
  }, [selectedEquipment, currentWeekStart, equipmentDetail, processDailySlots, showSlots, chargeCalculated]);

  // Safety check: keep only slots that fit within total (each slot counts as min(slotDuration, remaining))
  useEffect(() => {
    if (calculatedCharge && selectedSlots.length > 0) {
      const totalLimit = calculatedCharge.total_time_minutes;
      const abFields = equipmentDetail?.input_fields?.filter(
        (f: any) => f.field_key === 'A' || f.field_key === 'B'
      ) ?? [];
      const hasABFields = abFields.length > 0;
      let currentTotal = 0;
      let fitCount = 0;
      for (const slot of selectedSlots) {
        const slotDuration = getSlotDurationMinutes(slot);
        const contribution = Math.min(slotDuration, totalLimit - currentTotal);
        if (contribution <= 0) break;
        fitCount += 1;
        currentTotal += contribution;
      }
      if (fitCount < selectedSlots.length) {
        setSelectedSlots(prev => {
          let total = 0;
          const validSlots: TimeSlot[] = [];
          for (const slot of prev) {
            const slotDuration = getSlotDurationMinutes(slot);
            const contribution = Math.min(slotDuration, totalLimit - total);
            if (contribution <= 0) break;
            validSlots.push(slot);
            total += contribution;
          }
          if (totalLimit === 0 && hasABFields) {
            const labels = abFields.map((f: any) => f.field_label || f.field_key).join(' and ');
            toast.error(
              `"${labels}" must be at least 1. Please update Step 1 and recalculate charge.`
            );
          } else {
            toast.error(
              `Selected slots exceeded the limit. Reduced to ${validSlots.length} slot(s) (${total} minutes / ${totalLimit} minutes).`
            );
          }
          return validSlots;
        });
      }
    }
  }, [selectedSlots, calculatedCharge, equipmentDetail?.input_fields]);

  // Keep ref updated when Step 3 is shown (used elsewhere). Do not reset calendar week here so that after booking reset + recalculate the same week stays visible.
  useEffect(() => {
    prevShowSlotsRef.current = !!showSlots;
  }, [showSlots]);

  // Fetch slots when charge is calculated and slots should be shown, or when week changes
  useEffect(() => {
    // Only fetch if slots should be shown and charge is calculated
    if (!showSlots || !chargeCalculated || !selectedEquipment || loadingSlots || fetchingSlotsRef.current) {
      return;
    }

    // Check if current week is allowed for this user
    if (!isWeekAllowed(currentWeekStart)) {
      return;
    }

    // Get the current week key
    const weekStart = startOfWeek(currentWeekStart, { weekStartsOn: 1 });
    const weekEnd = addDays(weekStart, 6);
    const startDateStr = format(weekStart, "yyyy-MM-dd");
    const endDateStr = format(weekEnd, "yyyy-MM-dd");
    const weekKey = `${startDateStr}_${endDateStr}`;
    
    // Skip if we already fetched for this week
    if (lastFetchedWeek === weekKey) {
      return;
    }

    // Fetch slots
    fetchSlotsForWeek();
  }, [
    showSlots,
    chargeCalculated,
    selectedEquipment,
    currentWeekStart,
    loadingSlots,
    lastFetchedWeek,
    fetchSlotsForWeek,
    userType,
    isUrgentHoldMode,
    equipmentDetail?.slot_window_min_date,
    equipmentDetail?.slot_window_max_date,
  ]);

  // When Step 3 slot grid is visible, refetch on focus/visibility so slot status updates elsewhere are reflected
  useEffect(() => {
    if (!showSlots || !chargeCalculated || !selectedEquipment) return;
    const refetch = () => {
      fetchSlotsForWeek(true);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refetch();
    };
    window.addEventListener('focus', refetch);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', refetch);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [showSlots, chargeCalculated, selectedEquipment, fetchSlotsForWeek]);

  // When current week has no available slots, switch to next week by default (once per flow)
  useEffect(() => {
    if (hasCheckedEmptyCurrentWeekRef.current || !userType || !equipmentDetail?.daily_slots || !lastFetchedWeek) {
      return;
    }
    // Internal users: always show current week first; do not auto-switch to next week
    const nType = normalizeUserType(userType);
    if (nType === 'student' || nType === 'faculty') {
      return;
    }
    const allowedWeeks = getAllowedWeeks();
    if (allowedWeeks.length < 2) return;

    const firstWeekStart = startOfWeek(allowedWeeks[0], { weekStartsOn: 1 });
    const firstWeekEnd = addDays(firstWeekStart, 6);
    const firstWeekKey = `${format(firstWeekStart, "yyyy-MM-dd")}_${format(firstWeekEnd, "yyyy-MM-dd")}`;
    if (lastFetchedWeek !== firstWeekKey) return;

    const now = new Date();
    const weekStartTime = firstWeekStart.getTime();
    const weekEndTime = firstWeekEnd.getTime();
    const hasAnyAvailableSlot = equipmentDetail.daily_slots.some(slot => {
      if (isAdminUser()) {
        if (slot.status !== "AVAILABLE") return false;
      } else if (!isDailySlotSelectableForUserBooking(slot)) {
        return false;
      }
      const slotDate = typeof slot.date === "string"
        ? (slot.date.includes("T") ? parseISO(slot.date) : new Date(slot.date + "T00:00:00"))
        : null;
      if (!slotDate || !slot.start_datetime) return false;
      const slotDayTime = startOfDay(slotDate).getTime();
      if (slotDayTime < weekStartTime || slotDayTime >= weekEndTime) return false;
      const slotStart = parseISO(slot.start_datetime);
      return slotStart.getTime() >= now.getTime();
    });

    if (!hasAnyAvailableSlot) {
      hasCheckedEmptyCurrentWeekRef.current = true;
      setCurrentWeekStart(allowedWeeks[1]);
      setSelectedSlots([]);
    }
  }, [equipmentDetail?.daily_slots, lastFetchedWeek, userType, bookingAsExternalTarget, adminManageMode, adminBookForUserId]);

  // Auto-select slots when charge is calculated and auto slot selection is enabled
  useEffect(() => {
    // Only auto-select if:
    // 1. Charge is calculated
    // 2. Slots are shown
    // 3. Auto slot selection is enabled (from toggle on page)
    // 4. No slots are currently selected
    // 5. Equipment detail and daily slots are loaded (and not empty)
    // 6. Not currently loading slots
    if (!chargeCalculated || !showSlots || !autoSlotSelection || selectedSlots.length > 0 || 
        !equipmentDetail || !equipmentDetail.daily_slots || equipmentDetail.daily_slots.length === 0 || 
        loadingSlots || !calculatedCharge) {
      return;
    }
    

    const requiredMinutes = calculatedCharge.total_time_minutes;
    const slotDuration = equipmentDetail.slot_duration_minutes || 60;
    const oneSlot = slotDuration;
    const tolerance = Math.max(0, Number(equipmentDetail.slot_tolerance_minutes ?? 0) || 0);
    const tenPercentSlot = 0.1 * oneSlot;
    // Configured tolerance replaces the legacy 10% soft slack when > 0 (0 keeps legacy behaviour).
    const softSlackMinutes = tolerance > 0 ? tolerance : tenPercentSlot;
    const minSlotsNeeded = slotsNeededForAnalysisTime(requiredMinutes, oneSlot, tolerance);

    // If only one slot is needed (including tolerance), select only one slot
    if (minSlotsNeeded <= 1) {
      // Find the first available slot (admin: allow past and non-BOOKED)
      const availableSlot = equipmentDetail.daily_slots.find(slot => {
        const isBookedSlot = slot.status === "BOOKED" || !!slot.booking_id;
        if (isAdminUser()) {
          if (isBookedSlot) return false;
        } else {
          if (!isDailySlotSelectableForUserBooking(slot)) return false;
        }
        const slotDate = startOfDay(parseISO(slot.date));
        const slotTime = timeKeyFromDailySlot(slot);
        const slotDateTime = new Date(slotDate);
        const [hours, minutes] = slotTime.split(':').map(Number);
        slotDateTime.setHours(hours, minutes || 0, 0, 0);
        return (isAdminUser() || slotDateTime >= new Date()) && !isSlotBooked(slotDate, slotTime);
      });

      if (availableSlot) {
        const slotDate = startOfDay(parseISO(availableSlot.date));
        const slotTime = timeKeyFromDailySlot(availableSlot);
        const slot: TimeSlot = {
          date: slotDate,
          time: slotTime,
          isBooked: false,
          slotId: availableSlot.id,
          slotData: availableSlot,
        };
        setSelectedSlots([slot]);
      }
      return;
    }

    // For required time needing more than one slot, find consecutive slots
    const minTimeNeeded = minSlotsNeeded * oneSlot;

    // Sort slots by start_datetime so we try earlier slots first and get consistent results
    const sortedDailySlots = [...equipmentDetail.daily_slots].sort((a, b) =>
      parseISO(a.start_datetime).getTime() - parseISO(b.start_datetime).getTime()
    );

    // Find an available slot that has enough consecutive slots following it
    let bestStartingSlot: TimeSlot | null = null;
    let bestSlotChain: TimeSlot[] = [];
    let bestTotalMinutes = 0;

    // Try each available slot as a potential starting point (in chronological order). Admin: allow past and non-BOOKED.
    for (const slot of sortedDailySlots) {
      const isBookedSlot = slot.status === "BOOKED" || !!slot.booking_id;
      if (isAdminUser()) {
        if (isBookedSlot) continue;
      } else {
        if (!isDailySlotSelectableForUserBooking(slot)) continue;
      }
      const slotDate = startOfDay(parseISO(slot.date));
      const slotTime = timeKeyFromDailySlot(slot);
      const slotDateTime = new Date(slotDate);
      const [hours, minutes] = slotTime.split(':').map(Number);
      slotDateTime.setHours(hours, minutes || 0, 0, 0);
      if (!isAdminUser() && slotDateTime < new Date()) continue;
      if (isSlotBooked(slotDate, slotTime)) continue;
      
      // Try building consecutive slots from this starting slot
      const testSlot: TimeSlot = {
        date: slotDate,
        time: slotTime,
        isBooked: false,
        slotId: slot.id,
        slotData: slot,
      };
      
      const chain: TimeSlot[] = [testSlot];
      let currentSlot = testSlot;
      let chainTotalMinutes = getSlotDurationMinutes(currentSlot);
      
      // Build consecutive chain from this slot
      // Continue until we can't find more consecutive slots OR we've covered the required time
      while (true) {
        // If we've covered the required time, we can stop
        if (chainTotalMinutes >= requiredMinutes - softSlackMinutes && chain.length >= minSlotsNeeded) {
          break;
        }
        
        const nextSlot = findNextConsecutiveSlot([currentSlot]);
        if (!nextSlot) {
          break; // No more consecutive slots
        }
        chain.push(nextSlot);
        chainTotalMinutes += getSlotDurationMinutes(nextSlot);
        currentSlot = nextSlot;
      }
      
      // Check if this chain is better than what we have
      const hasEnough = chain.length >= minSlotsNeeded || chainTotalMinutes >= requiredMinutes - softSlackMinutes;
      
      // Keep the best chain (prefer chains that have enough, but also keep the longest chain even if it doesn't have enough)
      if (hasEnough) {
        // This chain has enough slots - use it if it's better than what we have
        if (!bestStartingSlot || chain.length > bestSlotChain.length || 
            (chain.length === bestSlotChain.length && chainTotalMinutes > bestTotalMinutes)) {
          bestStartingSlot = testSlot;
          bestSlotChain = chain;
          bestTotalMinutes = chainTotalMinutes;
          // If we found a perfect match, use it immediately
          if (chain.length >= minSlotsNeeded && chainTotalMinutes >= requiredMinutes - softSlackMinutes) {
            break;
          }
        }
      } else {
        // This chain doesn't have enough, but keep it if it's the longest we've found so far
        if (!bestStartingSlot || chain.length > bestSlotChain.length) {
          bestStartingSlot = testSlot;
          bestSlotChain = chain;
          bestTotalMinutes = chainTotalMinutes;
        }
      }
    }

    if (!bestStartingSlot || bestSlotChain.length === 0) {
      
      // If split booking is enabled, try random slots
      if (equipmentDetail.split_booking_enabled) {
        const randomSlots = findRandomAvailableSlots(requiredMinutes, []);
        if (randomSlots.length > 0) {
          setSelectedSlots(randomSlots);
          return;
        }
      }
      
      // No slots found - show message to user
      toast.warning(
        `Unable to auto-select slots. Required time is ${requiredMinutes} minutes (${slotsNeededForAnalysisTime(requiredMinutes, oneSlot, tolerance)} slots), but no consecutive slots are available. ` +
        `Please reduce the number of samples/inputs.`
      );
      return;
    }

    const autoSelectedSlots = bestSlotChain;
    const totalMinutes = bestTotalMinutes;

    // Check if we have enough consecutive slots
    // We have enough if:
    // 1. We have at least minSlotsNeeded slots (which should cover required time), OR
    // 2. Total minutes covers required time (within 10% variance)
    const hasEnoughConsecutiveSlots = autoSelectedSlots.length >= minSlotsNeeded || 
                                      totalMinutes >= requiredMinutes - softSlackMinutes;

    if (hasEnoughConsecutiveSlots && autoSelectedSlots.length > 0) {
      // We found enough consecutive slots, use them
      setSelectedSlots(autoSelectedSlots);
    } else if (equipmentDetail.split_booking_enabled) {
      // Consecutive slots not available, but split booking is enabled
      // Try to find random available slots
      const randomSlots = findRandomAvailableSlots(requiredMinutes, []);
      if (randomSlots.length > 0) {
        // Use random slots if found
        setSelectedSlots(randomSlots);
      } else {
        // No random slots available either
        toast.warning(
          `Unable to auto-select slots. Required time is ${requiredMinutes} minutes (${slotsNeededForAnalysisTime(requiredMinutes, oneSlot, tolerance)} slots), but no available slots found. ` +
          `Please reduce the number of samples/inputs.`
        );
      }
    } else {
      // Consecutive slots not available and split booking is disabled
      // Only consecutive slots are allowed, so don't auto-select anything
      // Show message to user suggesting to reduce inputs
      const foundSlots = autoSelectedSlots.length;
      const foundMinutes = totalMinutes;
      const slotsShort = minSlotsNeeded - foundSlots;
      const minutesShort = requiredMinutes - foundMinutes;
      
      toast.warning(
        `Unable to auto-select enough consecutive slots. ` +
        `Required: ${requiredMinutes} minutes (${minSlotsNeeded} slots), ` +
        `Found: ${foundMinutes} minutes (${foundSlots} slots). ` +
        `Please reduce the number of samples/inputs to reduce the required time.`
      );
    }
  }, [chargeCalculated, showSlots, autoSlotSelection, selectedSlots.length, equipmentDetail, calculatedCharge, loadingSlots, bookingAsExternalTarget, adminManageMode, adminBookForUserId]);

  // Keep ref in sync so async charge recalculation can read current value
  useEffect(() => {
    autoSlotSelectionRef.current = autoSlotSelection;
  }, [autoSlotSelection]);

  useEffect(() => {
    userAutoSlotSelectionPrefRef.current = userAutoSlotSelectionPref;
  }, [userAutoSlotSelectionPref]);

  const checkAuth = async () => {
    const isGuestCalculateFlow = searchParams.get("mode") === "calculate";
    const token = apiClient.getToken();
    if (!token) {
      if (isGuestCalculateFlow) return;
      const returnPath = `${window.location.pathname}${window.location.search}`;
      setPostLoginRedirect(returnPath);
      navigate("/auth");
      return;
    }

    const userResponse = await apiClient.getCurrentUser();
    if (userResponse.error || !userResponse.data) {
      if (isGuestCalculateFlow) return;
      const returnPath = `${window.location.pathname}${window.location.search}`;
      setPostLoginRedirect(returnPath);
      navigate("/auth");
      return;
    }

    setUserId(String(userResponse.data.id));
    setUserType(userResponse.data.user_type || null);
    setIstemPortalAcknowledged(Boolean((userResponse.data as { istem_portal_acknowledged?: boolean }).istem_portal_acknowledged));
    // Initialize auto slot selection from user preference, default to true if not set
    const pref = userResponse.data.auto_slot_selection !== undefined ? userResponse.data.auto_slot_selection : true;
    setUserAutoSlotSelectionPref(pref);
    setAutoSlotSelection(pref);
    
    // Set initial week based on user type
    const now = new Date();
    const currentWeek = startOfWeek(now, { weekStartsOn: 1 });
    const userTypeValue: any = userResponse.data.user_type;
    let normalizedType: string | null = null;
    if (typeof userTypeValue === 'string') {
      normalizedType = userTypeValue.toLowerCase();
    } else if (typeof userTypeValue === 'number') {
      normalizedType = userTypeValue === 1 ? 'student' : userTypeValue === 2 ? 'faculty' : null;
    }
    
    if (
      normalizedType === "admin" ||
      normalizedType === "manager" ||
      normalizedType === "student" ||
      normalizedType === "faculty"
    ) {
      // Admin / OIC / Students / Faculty: Start with current week
      setCurrentWeekStart(currentWeek);
    } else {
      // External (and similar): start with current week; API slot_window_* bounds drive navigation after slots load
      setCurrentWeekStart(currentWeek);
    }
  };


  const isSlotBooked = (date: Date, time: string): boolean => {
    const slotData = getSlotData(date, time);
    if (!slotData) return false;
    const slotStatus = String(slotData.status || "").toUpperCase();
    const hasBookedStatus = slotStatus === "BOOKED" || slotStatus === "BOOKING_NOT_UTILIZED";
    // Admin/OIC booking for external target: same bookability as external (AVAILABLE / available_for_external)
    if (isAdminOrOIC()) {
      if (adminManageMode === "book" && adminBookForUserId && bookingAsExternalTarget) {
        return hasBookedStatus || !slotBookableByExternalUser(slotData);
      }
      // Admin/OIC may select weekend/holiday/past (any non-BOOKED status).
      return hasBookedStatus;
    }
    if (isExternalUser) return !slotBookableByExternalUser(slotData);
    // Internal users: AVAILABLE slots are selectable
    return slotData.status !== "AVAILABLE";
  };

  const isSlotSelected = (date: Date, time: string): boolean => {
    return selectedSlots.some(slot => 
      isSameDay(slot.date, date) && slot.time === time
    );
  };

  const getSlotData = (date: Date, timeOrSlotKey: string): DailySlot | undefined => {
    if (!equipmentDetail?.daily_slots) return undefined;
    
    const normalizedDate = startOfDay(date);
    const expectedDateStr = format(normalizedDate, "yyyy-MM-dd");
    const timeKey = normalizeSlotGridTimeKey(timeOrSlotKey);
    
    return equipmentDetail.daily_slots.find(slot => {
      return calendarDateStrFromSlot(slot) === expectedDateStr && timeKeyFromDailySlot(slot) === timeKey;
    });
  };

  // Calculate slot duration in minutes from slot data
  const getSlotDurationMinutes = (slot: TimeSlot): number => {
    if (slot.slotData?.start_datetime && slot.slotData?.end_datetime) {
      try {
        const start = parseISO(slot.slotData.start_datetime);
        const end = parseISO(slot.slotData.end_datetime);
        return Math.round((end.getTime() - start.getTime()) / (1000 * 60)); // Convert to minutes
      } catch (error) {
        console.error("Error calculating slot duration:", error);
      }
    }
    // Fallback to equipment slot_duration_minutes if slot data not available
    return equipmentDetail?.slot_duration_minutes || 60;
  };

  // Calculate total selected minutes from actual slot durations
  const getTotalSelectedMinutes = (): number => {
    if (selectedSlots.length === 0) return 0;
    return selectedSlots.reduce((total, slot) => {
      return total + getSlotDurationMinutes(slot);
    }, 0);
  };

  // Effective selected minutes capped at total (e.g. one 60-min slot for 7-min total counts as 7)
  const getEffectiveSelectedMinutes = (): number => {
    const raw = getTotalSelectedMinutes();
    if (!calculatedCharge) return raw;
    return Math.min(raw, calculatedCharge.total_time_minutes);
  };

  // Get remaining minutes that can be selected
  const getRemainingMinutes = (): number => {
    if (!calculatedCharge) return 0;
    return Math.max(0, calculatedCharge.total_time_minutes - getEffectiveSelectedMinutes());
  };

  // Get representative slot duration (from first selected slot, or equipment default)
  const getOneSlotDurationMinutes = (slotOrNull?: TimeSlot | null): number => {
    if (slotOrNull?.slotData?.start_datetime && slotOrNull.slotData?.end_datetime) {
      try {
        const start = parseISO(slotOrNull.slotData.start_datetime);
        const end = parseISO(slotOrNull.slotData.end_datetime);
        return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
      } catch {
        // fall through to equipment
      }
    }
    if (selectedSlots.length > 0) {
      const d = getSlotDurationMinutes(selectedSlots[0]);
      if (d > 0) return d;
    }
    return equipmentDetail?.slot_duration_minutes || 60;
  };

  // Check if current selection is valid for booking per business rules:
  // a) Required <= one slot → exactly one slot allowed.
  // b) Required > one slot → multiple slots until required covered.
  // c) Remaining time < 10% of one slot → allow booking (partial tail).
  // d) If remaining time > 10% of one slot, allow minimum slots needed even if exceeds by more than 10%.
  const isSelectionValidForBooking = (): boolean => {
    if (!calculatedCharge || selectedSlots.length === 0) return false;
    const required = calculatedCharge.total_time_minutes;
    const selected = getTotalSelectedMinutes();
    const oneSlot = getOneSlotDurationMinutes(selectedSlots[0]);
    const tolerance = Math.max(0, Number(equipmentDetail?.slot_tolerance_minutes ?? 0) || 0);
    const tenPercentSlot = 0.1 * oneSlot;
    const softSlackMinutes = tolerance > 0 ? tolerance : tenPercentSlot;
    const minSlotsNeeded = slotsNeededForAnalysisTime(required, oneSlot, tolerance);
    if (minSlotsNeeded <= 1) {
      return selectedSlots.length === 1;
    }
    // Check if selection covers required time within soft slack / tolerance
    if (selected >= required - softSlackMinutes && selected <= required + tenPercentSlot) {
      return true;
    }
    const minTimeNeeded = minSlotsNeeded * oneSlot;
    // Allow if selected time is the minimum needed to cover required time
    if (selected >= minTimeNeeded && selectedSlots.length === minSlotsNeeded) {
      return true;
    }
    return false;
  };

  // Check if a slot is consecutive to selected slots (using API date+time strings to avoid timezone issues)
  const isConsecutiveSlot = (newSlot: TimeSlot, selectedSlots: TimeSlot[]): boolean => {
    if (selectedSlots.length === 0) return true; // First slot is always allowed
    
    if (!newSlot.slotData?.start_datetime || !newSlot.slotData?.end_datetime) {
      return false;
    }
    
    const newStart = parseIsoDateAndTime(newSlot.slotData.start_datetime);
    const newEnd = parseIsoDateAndTime(newSlot.slotData.end_datetime);
    
    // Sort selected slots by start datetime string order
    const sortedSlots = [...selectedSlots].sort((a, b) => {
      if (!a.slotData?.start_datetime || !b.slotData?.start_datetime) return 0;
      const aStr = a.slotData.start_datetime;
      const bStr = b.slotData.start_datetime;
      return aStr.localeCompare(bStr);
    });
    
    const firstSlot = sortedSlots[0];
    const lastSlot = sortedSlots[sortedSlots.length - 1];
    
    if (!firstSlot.slotData?.start_datetime || !firstSlot.slotData?.end_datetime ||
        !lastSlot.slotData?.start_datetime || !lastSlot.slotData?.end_datetime) {
      return false;
    }
    
    const firstStart = parseIsoDateAndTime(firstSlot.slotData.start_datetime);
    const firstEnd = parseIsoDateAndTime(firstSlot.slotData.end_datetime);
    const lastStart = parseIsoDateAndTime(lastSlot.slotData.start_datetime);
    const lastEnd = parseIsoDateAndTime(lastSlot.slotData.end_datetime);
    
    // New slot is immediately before the first (consecutive at the start)
    const isBeforeFirst = newEnd.dateStr === firstStart.dateStr && newEnd.timeStr === firstStart.timeStr;
    // New slot is immediately after the last (consecutive at the end)
    const isAfterLast = newStart.dateStr === lastEnd.dateStr && newStart.timeStr === lastEnd.timeStr;

    return isBeforeFirst || isAfterLast;
  };

  // Find the next consecutive slot after the last selected slot.
  // Uses (1) date+time string match, then (2) "next in sorted list" so it works regardless of API datetime format.
  const findNextConsecutiveSlot = (selectedSlots: TimeSlot[]): TimeSlot | null => {
    if (selectedSlots.length === 0 || !equipmentDetail?.daily_slots) return null;

    const sortedSlots = [...selectedSlots].sort((a, b) => {
      if (!a.slotData?.start_datetime || !b.slotData?.start_datetime) return 0;
      return a.slotData.start_datetime.localeCompare(b.slotData.start_datetime);
    });

    const lastSlot = sortedSlots[sortedSlots.length - 1];
    if (!lastSlot.slotData?.end_datetime || !lastSlot.slotData?.start_datetime) return null;

    const lastSlotId = lastSlot.slotId ?? lastSlot.slotData?.id;
    const lastEnd = parseIsoDateAndTime(lastSlot.slotData.end_datetime);
    const sortedByStart = [...equipmentDetail.daily_slots].sort((a, b) =>
      (a.start_datetime || "").localeCompare(b.start_datetime || "")
    );

    const matchByDateTime = (slot: DailySlot): boolean => {
      const isBookedSlot = slot.status === "BOOKED" || !!slot.booking_id;
      if (isAdminUser()) {
        if (isBookedSlot || (lastSlotId != null && slot.id === lastSlotId)) return false;
      } else {
        if (!isDailySlotSelectableForUserBooking(slot) || (lastSlotId != null && slot.id === lastSlotId)) return false;
      }
      const slotDateStr = typeof slot.date === "string"
        ? (slot.date.includes("T") ? parseIsoDateAndTime(slot.date).dateStr : slot.date.slice(0, 10))
        : "";
      const slotStartTimeStr = slot.start_datetime ? parseIsoDateAndTime(slot.start_datetime).timeStr : "";
      if (slotDateStr !== lastEnd.dateStr || slotStartTimeStr !== lastEnd.timeStr) return false;
      if (!isAdminUser()) {
        const slotStart = parseISO(slot.start_datetime);
        if (slotStart.getTime() < new Date().getTime()) return false;
      }
      const slotDate = startOfDay(parseISO(slot.date));
      const slotTime = timeKeyFromDailySlot(slot);
      return !isSlotBooked(slotDate, slotTime);
    };

    // 1) Try match by end date/time string
    let nextSlotData = equipmentDetail.daily_slots.find(matchByDateTime);

    // 2) Fallback: next slot in sorted list (API orders by date + start_datetime, so next row is next in time)
    if (!nextSlotData) {
      const currentIndex = sortedByStart.findIndex(s => s.id === lastSlotId);
      if (currentIndex >= 0 && currentIndex + 1 < sortedByStart.length) {
        const candidate = sortedByStart[currentIndex + 1];
        const candidateBooked = candidate.status === "BOOKED" || !!candidate.booking_id;
        const candidateOk = isAdminUser()
          ? !candidateBooked
          : isDailySlotSelectableForUserBooking(candidate);
        if (candidateOk && candidate.id !== lastSlotId) {
          const slotStart = parseISO(candidate.start_datetime);
          const slotDate = startOfDay(parseISO(candidate.date));
          const slotTime = timeKeyFromDailySlot(candidate);
          if (isAdminUser() || slotStart.getTime() >= new Date().getTime()) {
            if (!isSlotBooked(slotDate, slotTime)) nextSlotData = candidate;
          }
        }
      }
    }

    if (!nextSlotData) return null;

    const slotDate = startOfDay(parseISO(nextSlotData.date));
    const slotTime = timeKeyFromDailySlot(nextSlotData);

    return {
      date: slotDate,
      time: slotTime,
      isBooked: false,
      slotId: nextSlotData.id,
      slotData: nextSlotData,
    };
  };

  // Find all required consecutive slots starting from a given slot
  // If consecutive slots aren't available and split booking is enabled, find random slots
  const findAllRequiredConsecutiveSlots = (firstSlot: TimeSlot, requiredMinutes: number): TimeSlot[] => {
    if (!equipmentDetail?.daily_slots || !calculatedCharge) return [firstSlot];
    
    const slotDuration = getSlotDurationMinutes(firstSlot);
    const oneSlot = slotDuration;
    const tolerance = Math.max(0, Number(equipmentDetail.slot_tolerance_minutes ?? 0) || 0);
    const tenPercentSlot = 0.1 * oneSlot;
    const softSlackMinutes = tolerance > 0 ? tolerance : tenPercentSlot;
    const minSlotsNeeded = slotsNeededForAnalysisTime(requiredMinutes, oneSlot, tolerance);
    
    // If only one slot is needed (including tolerance), return only the first slot
    if (minSlotsNeeded <= 1) {
      return [firstSlot];
    }
    
    // Build consecutive slots starting from the first slot
    const allSlots: TimeSlot[] = [firstSlot];
    let currentSlot = firstSlot;
    let totalMinutes = getSlotDurationMinutes(currentSlot);
    
    // Continue selecting consecutive slots until we've covered the minimum required time
    while (allSlots.length < minSlotsNeeded) {
      const nextSlot = findNextConsecutiveSlot([currentSlot]);
      if (!nextSlot || isSlotBooked(nextSlot.date, nextSlot.time)) {
        // No more consecutive slots available
        break;
      }
      allSlots.push(nextSlot);
      totalMinutes += getSlotDurationMinutes(nextSlot);
      currentSlot = nextSlot;
      
      // If we've covered the required time (within tolerance / soft slack), we can stop
      if (totalMinutes >= requiredMinutes - softSlackMinutes) {
        break;
      }
    }
    
    // Check if we have enough consecutive slots
    const hasEnoughConsecutiveSlots = allSlots.length >= minSlotsNeeded && 
                                      totalMinutes >= requiredMinutes - softSlackMinutes;
    
    if (hasEnoughConsecutiveSlots) {
      // We found enough consecutive slots, return them
      return allSlots;
    } else if (equipmentDetail.split_booking_enabled) {
      // Consecutive slots not available, but split booking is enabled
      // Try to find random available slots (including the first slot)
      const randomSlots = findRandomAvailableSlots(requiredMinutes, []);
      if (randomSlots.length > 0) {
        // Use random slots if found
        return randomSlots;
      }
      // If random slots also not available, return what we have (partial consecutive slots)
      return allSlots;
    } else {
      // Consecutive slots not available and split booking is disabled
      // Only contiguous slots in required quantity are allowed - do not allow partial selection
      return [];
    }
  };

  // Check if continuous slots are available for the required time starting from a given slot
  const checkContinuousSlotsAvailable = (startSlot: TimeSlot, requiredMinutes: number): boolean => {
    if (!equipmentDetail?.daily_slots || !startSlot.slotData) return false;
    
    let currentSlot = startSlot;
    let totalMinutes = getSlotDurationMinutes(currentSlot);
    
    while (totalMinutes < requiredMinutes) {
      const nextSlot = findNextConsecutiveSlot([currentSlot]);
      if (!nextSlot || isSlotBooked(nextSlot.date, nextSlot.time)) {
        return false; // No more consecutive slots available
      }
      totalMinutes += getSlotDurationMinutes(nextSlot);
      currentSlot = nextSlot;
    }
    
    return true; // Continuous slots are available
  };

  // Find random available slots (non-consecutive) when consecutive slots aren't available
  const findRandomAvailableSlots = (requiredMinutes: number, excludeSlots: TimeSlot[] = []): TimeSlot[] => {
    if (!equipmentDetail?.daily_slots) return [];
    
    const slotDuration = equipmentDetail.slot_duration_minutes || 60;
    const oneSlot = slotDuration;
    const tolerance = Math.max(0, Number(equipmentDetail.slot_tolerance_minutes ?? 0) || 0);
    const minSlotsNeeded = slotsNeededForAnalysisTime(requiredMinutes, oneSlot, tolerance);
    const tenPercentSlot = 0.1 * oneSlot;
    const softSlackMinutes = tolerance > 0 ? tolerance : tenPercentSlot;
    
    // Get all available slots, excluding already selected ones
    const availableSlots: TimeSlot[] = [];
    const excludeSlotIds = new Set(excludeSlots.map(s => s.slotId));
    
    equipmentDetail.daily_slots.forEach(slot => {
      const isBookedSlot = slot.status === "BOOKED" || !!slot.booking_id;
      if (isAdminUser()) {
        if (isBookedSlot || excludeSlotIds.has(slot.id)) return;
      } else {
        if (!isDailySlotSelectableForUserBooking(slot) || excludeSlotIds.has(slot.id)) return;
      }
      const slotDate = startOfDay(parseISO(slot.date));
      const slotTime = timeKeyFromDailySlot(slot);
      const slotDateTime = new Date(slotDate);
      const [hours, minutes] = slotTime.split(':').map(Number);
      slotDateTime.setHours(hours, minutes || 0, 0, 0);
      if ((isAdminUser() || slotDateTime >= new Date()) && !isSlotBooked(slotDate, slotTime)) {
        availableSlots.push({
          date: slotDate,
          time: slotTime,
          isBooked: false,
          slotId: slot.id,
          slotData: slot,
        });
      }
    });
    
    // Sort by datetime to get a consistent order
    availableSlots.sort((a, b) => {
      if (!a.slotData?.start_datetime || !b.slotData?.start_datetime) return 0;
      return parseISO(a.slotData.start_datetime).getTime() - parseISO(b.slotData.start_datetime).getTime();
    });
    
    // Select slots until we have enough to cover required time
    const selectedSlots: TimeSlot[] = [];
    let totalMinutes = 0;
    
    for (const slot of availableSlots) {
      if (selectedSlots.length >= minSlotsNeeded) break;
      
      selectedSlots.push(slot);
      totalMinutes += getSlotDurationMinutes(slot);
      
      // If we've covered the required time (within 10% variance), we can stop
      if (totalMinutes >= requiredMinutes - softSlackMinutes) {
        break;
      }
    }
    
    // Only return if we have enough slots to cover the required time
    if (selectedSlots.length > 0 && totalMinutes >= requiredMinutes - softSlackMinutes) {
      return selectedSlots;
    }
    
    return [];
  };

  const toggleSlot = (date: Date, time: string) => {
    if (isSlotBooked(date, time)) return;

    const slotData = getSlotData(date, time);
    const slot: TimeSlot = { 
      date, 
      time, 
      isBooked: false,
      slotId: slotData?.id,
      slotData: slotData,
    };
    
    // Use functional update to ensure we're working with the latest state
    setSelectedSlots(prev => {
      // Check if slot is already selected using current state
      const isAlreadySelected = prev.some(s => 
        isSameDay(s.date, date) && s.time === time
      );
      
      if (isAlreadySelected) {
        // Deselecting is always allowed
        return prev.filter(s => 
          !(isSameDay(s.date, date) && s.time === time)
        );
      } else {
        // Check if slot is consecutive to already selected slots
        if (prev.length > 0 && !isConsecutiveSlot(slot, prev)) {
          // If split booking is NOT enabled, strictly enforce consecutive-only selection
          if (!equipmentDetail?.split_booking_enabled) {
            toast.error("Please select consecutive slots only. You can select slots that are immediately before or after your current selection.");
            return prev; // Return previous state without changes
          }
          
          // Split booking is enabled - allow non-consecutive slots only if continuous slots aren't available
          if (equipmentDetail?.split_booking_enabled && calculatedCharge) {
            const required = calculatedCharge.total_time_minutes;
            const currentSelectedMinutes = prev.reduce((total, s) => total + getSlotDurationMinutes(s), 0);
            const remaining = required - currentSelectedMinutes;
            
            // Check if continuous slots are available from the last selected slot
            const lastSlot = prev[prev.length - 1];
            const continuousAvailable = checkContinuousSlotsAvailable(lastSlot, remaining);
            
            if (continuousAvailable) {
              toast.error("Please select consecutive slots only. Continuous slots are available for your booking.");
              return prev;
            }
            // If continuous slots aren't available, allow non-consecutive selection
          }
        }
        
        // Slot selection rules: (a) required <= one slot → single slot; (b) required > one slot → multiple until covered; (c) allow tail < 10% of one slot
        if (calculatedCharge) {
          const required = calculatedCharge.total_time_minutes;
          const slotDuration = getSlotDurationMinutes(slot);
          const currentSelectedMinutes = prev.reduce((total, s) => total + getSlotDurationMinutes(s), 0);
          const newTotalMinutes = currentSelectedMinutes + slotDuration;
          const oneSlotRef = prev.length > 0 ? getSlotDurationMinutes(prev[0]) : slotDuration;
          const tolerance = Math.max(0, Number(equipmentDetail?.slot_tolerance_minutes ?? 0) || 0);
          const tenPercentSlot = 0.1 * oneSlotRef;
          const softSlackMinutes = tolerance > 0 ? tolerance : tenPercentSlot;
          const minSlotsForRequired = slotsNeededForAnalysisTime(required, oneSlotRef, tolerance);

          // (a) If only one slot is needed (including tolerance): allow only a single slot
          if (minSlotsForRequired <= 1) {
            if (prev.length >= 1) {
              toast.error(`Only one slot is allowed when required time (${required} min) fits within a single slot (tolerance ${tolerance} min).`);
              return prev;
            }
            // For single slot requirement, just return the selected slot
            return [...prev, slot];
          }

          // (b) Required needs multiple slots: allow until covered (with soft slack / tolerance)
          if (currentSelectedMinutes >= required) {
            toast.error(`You have already covered the required time (${required} minutes).`);
            return prev;
          }
          // Calculate remaining time
          const remaining = Math.max(0, required - currentSelectedMinutes);
          // Allow selecting another slot if remaining time exceeds soft slack
          if (remaining <= softSlackMinutes) {
            toast.error(
              `Cannot add this slot. Required time is ${required} minutes; only ${remaining} minutes remaining (within tolerance/slack).`
            );
            return prev;
          }
          
          // If this is the first slot selection, auto-select ALL required consecutive slots
          if (prev.length === 0) {
            const allRequiredSlots = findAllRequiredConsecutiveSlots(slot, required);
            const minSlotsNeeded = minSlotsForRequired;
            // When splitting not allowed, require full consecutive block; don't accept partial
            if (!equipmentDetail?.split_booking_enabled && (minSlotsNeeded > 1 && allRequiredSlots.length < minSlotsNeeded)) {
              toast.error(
                `Could not find enough consecutive slots from this slot. Need ${minSlotsNeeded} slot(s) (${required} min). ` +
                `Try a different starting slot or reduce required time.`
              );
              return prev;
            }
            if (allRequiredSlots.length === 0) {
              toast.error("No consecutive slots available for the required time. Try another slot or reduce required time.");
              return prev;
            }
            return allRequiredSlots;
          }
          
          // For subsequent slot selections, just add the selected slot
          return [...prev, slot];
        } else {
          // If charge not calculated, don't allow slot selection
          toast.error("Please wait for charge calculation to complete before selecting slots.");
          return prev; // Return previous state without changes
        }
      }
    });
  };

  // Use weekly slots from API whenever we have daily_slots (any profile type: HOUR, SAMPLE, etc.)
  const useWeeklySlots = (): boolean => {
    return equipmentDetail?.daily_slots !== undefined && equipmentDetail.daily_slots.length > 0;
  };

  // Get unique time slots from daily_slots (TIME mode)
  const getTimeSlotsFromDailySlots = (): string[] => {
    if (!equipmentDetail?.daily_slots || equipmentDetail.daily_slots.length === 0) {
      return []; // Return empty array if no daily_slots
    }
    
    const uniqueTimes = new Set<string>();
    equipmentDetail.daily_slots.forEach(slot => {
      try {
        const timeStr = timeKeyFromDailySlot(slot);
        if (timeStr) uniqueTimes.add(timeStr);
      } catch (error) {
        console.error("Error parsing slot time:", error, slot);
      }
    });
    
    const sortedTimes = Array.from(uniqueTimes).sort();
    // If we have slots, return them; otherwise fallback to default
    return sortedTimes.length > 0 ? sortedTimes : [];
  };

  // Row keys and labels for weekly grid. TIME = show time on vertical axis; SLOT_ID = hide time and show slot position (1, 2, 3...). Admin/OIC always see TIME.
  const getWeeklyRowKeysAndLabels = (): { key: string; label: string }[] => {
    const hideTime = getEffectiveWeeklyViewDisplay() === "SLOT_ID";
    const fromSlotMasters = equipmentDetail?.slot_master_times && equipmentDetail.slot_master_times.length > 0
      ? [...new Set(equipmentDetail.slot_master_times.map((t) => normalizeSlotGridTimeKey(formatTimeForDisplay(String(t)))))]
          .filter(Boolean)
          .sort()
      : [];
    const fromSlots = getTimeSlotsFromDailySlots();
    const fromWindow = getTimeSlotsFromEquipmentWindow(
      equipmentDetail?.slot_start_time,
      equipmentDetail?.slot_end_time,
      equipmentDetail?.slot_duration_minutes || 60
    );
    const timeSlots = fromSlotMasters.length > 0
      ? fromSlotMasters
      : fromSlots.length > 0
        ? fromSlots
        : fromWindow.length > 0
          ? fromWindow
          : DEFAULT_TIME_SLOTS;
    const slotDuration = equipmentDetail?.slot_duration_minutes || 60;
    return timeSlots.map((t, index) => ({
      key: t,
      label: hideTime ? `Slot ${index + 1}` : formatSlotRowTimeLabel(t, slotDuration),
    }));
  };

  const calculateTotalCost = (): number => {
    if (!selectedEquipment || selectedSlots.length === 0) return 0;
    // Use calculated charge if available
    if (calculatedCharge) {
      // Calculate cost per minute based on total charge and time
      const costPerMinute = Number(calculatedCharge.total_charge) / calculatedCharge.total_time_minutes;
      const selectedMinutes = getTotalSelectedMinutes(); // Use actual selected minutes
      return selectedMinutes * costPerMinute;
    }
    // Fallback: assume 1 hour per slot if charge not calculated
    return selectedSlots.length * Number(selectedEquipment.internalRate);
  };

  // Normalize user type to string for comparison
  const normalizeUserType = (type: string | number | null): string | null => normalizeUserTypeCode(type);

  /** Normalized types that use the external booking window (API slot_window_min/max_date). */
  const isExternalUserTypeNormalized = (normalizedType: string | null): boolean =>
    normalizedType != null && isExternalBookingUserType(normalizedType);

  const isAdminUser = (): boolean => {
    if (!userType) return false;
    return String(userType).toLowerCase() === 'admin';
  };

  const isAdminOrOIC = (): boolean => {
    if (!userType) return false;
    const t = String(userType).toLowerCase();
    // Department Administrator books on behalf like Admin/OIC (equipment scoped on API).
    return t === 'admin' || t === 'manager' || t === 'dept_admin';
  };

  /** Admin / OIC / Department Administrator may book slots for another user. */
  const canBookForOtherUsers = (): boolean => isAdminOrOIC();

  /** Admin / OIC / Lab In-charge may change slot status (not Department Administrator). */
  const canChangeSlotStatus = (): boolean => {
    if (!userType) return false;
    const t = String(userType).toLowerCase();
    return t === 'admin' || t === 'manager' || t === 'operator';
  };

  /** For Admin and OIC the weekly view display setting has no effect: they always see time on the vertical axis. */
  const getEffectiveWeeklyViewDisplay = (): 'TIME' | 'SLOT_ID' => {
    if (isAdminOrOIC()) return 'TIME';
    return equipmentDetail?.weekly_view_display ?? 'TIME';
  };

  const canAccessManageEquipmentModes = (): boolean => {
    return canBookForOtherUsers() || canChangeSlotStatus();
  };

  /** Institute Admin and Department Administrator must pick "Book slots for a user" before the booking form. */
  const requiresBookModeBeforeForm = (): boolean => {
    if (!userType) return false;
    const t = String(userType).toLowerCase();
    return t === 'admin' || t === 'dept_admin';
  };

  const isInternalUser = (): boolean => {
    if (!userType) return false;
    const t = String(userType).toLowerCase();
    return t === 'student' || t === 'faculty' || t === 'individual_student';
  };

  // Check if a week is allowed (must align with getAllowedWeeks() so slot fetch runs for every navigable week, including urgent extension)
  const isWeekAllowed = (weekStart: Date): boolean => {
    // Admin and OIC may navigate any week when booking for users (no slot-window restriction).
    if (isAdminOrOIC()) return true;
    if (!userType) return false;

    const normalizedType = normalizeUserType(userType);
    if (!normalizedType) return false;

    const now = new Date();
    const currentWeek = startOfWeek(now, { weekStartsOn: 1 });
    const nextWeek = addWeeks(currentWeek, 1);

    const weekStartNormalized = startOfWeek(weekStart, { weekStartsOn: 1 });
    const currentWeekNormalized = startOfWeek(currentWeek, { weekStartsOn: 1 });
    const nextWeekNormalized = startOfWeek(nextWeek, { weekStartsOn: 1 });

    if (normalizedType === "student" || normalizedType === "faculty" || isExternalUserTypeNormalized(normalizedType)) {
      const minDateStr = equipmentDetail?.slot_window_min_date ?? null;
      const maxDateStr = equipmentDetail?.slot_window_max_date ?? null;
      if (!minDateStr || !maxDateStr) {
        if (isUrgentHoldMode) {
          const weekAfterNext = addWeeks(nextWeek, 1);
          return (
            weekStartNormalized.getTime() === currentWeekNormalized.getTime() ||
            weekStartNormalized.getTime() === nextWeekNormalized.getTime() ||
            weekStartNormalized.getTime() === startOfWeek(weekAfterNext, { weekStartsOn: 1 }).getTime()
          );
        }
        return (
          weekStartNormalized.getTime() === currentWeekNormalized.getTime() ||
          weekStartNormalized.getTime() === nextWeekNormalized.getTime()
        );
      }
      const minDate = parseISO(minDateStr);
      const maxDate = parseISO(maxDateStr);
      const weekSunday = addDays(weekStartNormalized, 6);
      return weekSunday >= minDate && weekStartNormalized <= maxDate;
    }

    if (isUrgentHoldMode) {
      const weekAfterNext = addWeeks(nextWeek, 1);
      return (
        weekStartNormalized.getTime() === currentWeekNormalized.getTime() ||
        weekStartNormalized.getTime() === nextWeekNormalized.getTime() ||
        weekStartNormalized.getTime() === startOfWeek(weekAfterNext, { weekStartsOn: 1 }).getTime()
      );
    }
    return weekStartNormalized.getTime() === currentWeekNormalized.getTime();
  };

  // Get allowed weeks for navigation (admin/OIC or repeat-sample: any week; others restricted)
  const getAllowedWeeks = (): Date[] => {
    if (!userType) return [];
    if (repeatSourceBooking) {
      const now = new Date();
      const currentWeek = startOfWeek(now, { weekStartsOn: 1 });
      const weeks: Date[] = [];
      for (let i = -4; i <= 52; i++) {
        weeks.push(i === 0 ? currentWeek : i < 0 ? subWeeks(currentWeek, -i) : addWeeks(currentWeek, i));
      }
      return weeks;
    }
    if (isAdminOrOIC()) {
      const now = new Date();
      const currentWeek = startOfWeek(now, { weekStartsOn: 1 });
      const weeks: Date[] = [];
      for (let i = -52; i <= 52; i++) {
        weeks.push(i === 0 ? currentWeek : i < 0 ? subWeeks(currentWeek, -i) : addWeeks(currentWeek, i));
      }
      return weeks;
    }
    const normalizedType = normalizeUserType(userType);
    if (!normalizedType) return [];
    const now = new Date();
    const currentWeek = startOfWeek(now, { weekStartsOn: 1 });
    const nextWeek = addWeeks(currentWeek, 1);
    if (normalizedType === 'student' || normalizedType === 'faculty' || isExternalUserTypeNormalized(normalizedType)) {
      const minDateStr = equipmentDetail?.slot_window_min_date ?? null;
      const maxDateStr = equipmentDetail?.slot_window_max_date ?? null;
      if (!minDateStr || !maxDateStr) {
        if (isUrgentHoldMode) {
          return [currentWeek, nextWeek, addWeeks(nextWeek, 1)];
        }
        return [currentWeek, nextWeek];
      }
      const minDate = parseISO(minDateStr);
      const maxDate = parseISO(maxDateStr);
      if (isUrgentHoldMode) {
        const previousWeek = subWeeks(currentWeek, 1);
        const candidateWeeks = [previousWeek, currentWeek, nextWeek, addWeeks(nextWeek, 1)];
        const weeks: Date[] = [];
        for (const weekStart of candidateWeeks) {
          const weekSunday = addDays(weekStart, 6);
          if (weekSunday >= minDate && weekStart <= maxDate) {
            weeks.push(weekStart);
          }
        }
        return weeks;
      }
      return getAllowedWeeksFromSlotWindowBounds(minDateStr, maxDateStr);
    }
    if (isUrgentHoldMode) {
      return [currentWeek, nextWeek, addWeeks(nextWeek, 1)];
    }
    return [currentWeek];
  };

  const goToPreviousWeek = () => {
    const allowedWeeks = getAllowedWeeks();
    const currentIndex = allowedWeeks.findIndex(week => 
      startOfWeek(week, { weekStartsOn: 1 }).getTime() === startOfWeek(currentWeekStart, { weekStartsOn: 1 }).getTime()
    );
    
    if (currentIndex > 0) {
      setCurrentWeekStart(allowedWeeks[currentIndex - 1]);
      setSelectedSlots([]);
    }
  };

  const goToNextWeek = () => {
    const allowedWeeks = getAllowedWeeks();
    const currentIndex = allowedWeeks.findIndex(week => 
      startOfWeek(week, { weekStartsOn: 1 }).getTime() === startOfWeek(currentWeekStart, { weekStartsOn: 1 }).getTime()
    );
    
    if (currentIndex < allowedWeeks.length - 1) {
      setCurrentWeekStart(allowedWeeks[currentIndex + 1]);
      setSelectedSlots([]);
    }
  };

  const canGoToPreviousWeek = (): boolean => {
    const allowedWeeks = getAllowedWeeks();
    const currentIndex = allowedWeeks.findIndex(week => 
      startOfWeek(week, { weekStartsOn: 1 }).getTime() === startOfWeek(currentWeekStart, { weekStartsOn: 1 }).getTime()
    );
    return currentIndex > 0;
  };

  const canGoToNextWeek = (): boolean => {
    const allowedWeeks = getAllowedWeeks();
    const currentIndex = allowedWeeks.findIndex(week => 
      startOfWeek(week, { weekStartsOn: 1 }).getTime() === startOfWeek(currentWeekStart, { weekStartsOn: 1 }).getTime()
    );
    return currentIndex < allowedWeeks.length - 1;
  };

  // Internal and external users with slot window: snap to an allowed week when selected week is outside bounds
  useEffect(() => {
    const nType = userType != null ? normalizeUserType(userType) : null;
    if (nType !== 'student' && nType !== 'faculty' && !isExternalUserTypeNormalized(nType)) return;
    const allowed = getAllowedWeeks();
    if (allowed.length === 0) return;
    const selected = startOfWeek(currentWeekStart, { weekStartsOn: 1 });
    const isAllowed = allowed.some(w => startOfWeek(w, { weekStartsOn: 1 }).getTime() === selected.getTime());
    if (!isAllowed) {
      setCurrentWeekStart(startOfWeek(allowed[0], { weekStartsOn: 1 }));
    }
  }, [equipmentDetail?.slot_window_min_date, equipmentDetail?.slot_window_max_date, userType, currentWeekStart, isUrgentHoldMode]);

  // Default to current week whenever an equipment is selected for booking (internal / external users)
  useEffect(() => {
    if (!selectedEquipment) return;
    const nType = userType != null ? normalizeUserType(userType) : null;
    if (nType === 'student' || nType === 'faculty' || isExternalUserTypeNormalized(nType)) {
      setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
    }
  }, [selectedEquipment?.id, userType]);

  // When current week has no available slots, switch to next week by default (once per flow per equipment)
  useEffect(() => {
    const equipmentId = selectedEquipment?.id ?? null;
    const idNum = equipmentId != null ? Number(equipmentId) : null;
    if (idNum !== lastEquipmentIdRef.current) {
      lastEquipmentIdRef.current = idNum;
      hasCheckedEmptyCurrentWeekRef.current = false;
    }
    if (hasCheckedEmptyCurrentWeekRef.current || !userType || !equipmentDetail?.daily_slots || !lastFetchedWeek) {
      return;
    }
    const allowedWeeks = getAllowedWeeks();
    if (allowedWeeks.length < 2) return;

    const firstWeekStart = startOfWeek(allowedWeeks[0], { weekStartsOn: 1 });
    const firstWeekEnd = addDays(firstWeekStart, 6);
    const firstWeekKey = `${format(firstWeekStart, "yyyy-MM-dd")}_${format(firstWeekEnd, "yyyy-MM-dd")}`;
    if (lastFetchedWeek !== firstWeekKey) return;

    const now = new Date();
    const weekStartTime = firstWeekStart.getTime();
    const weekEndTime = firstWeekEnd.getTime();
    const hasAnyAvailableSlot = equipmentDetail.daily_slots.some(slot => {
      if (isAdminUser()) {
        if (slot.status !== "AVAILABLE") return false;
      } else if (!isDailySlotSelectableForUserBooking(slot)) {
        return false;
      }
      const slotDate = typeof slot.date === "string"
        ? (slot.date.includes("T") ? parseISO(slot.date) : new Date(slot.date + "T00:00:00"))
        : null;
      if (!slotDate || !slot.start_datetime) return false;
      const slotDayTime = startOfDay(slotDate).getTime();
      if (slotDayTime < weekStartTime || slotDayTime >= weekEndTime) return false;
      const slotStart = parseISO(slot.start_datetime);
      return slotStart.getTime() >= now.getTime();
    });

    if (!hasAnyAvailableSlot) {
      hasCheckedEmptyCurrentWeekRef.current = true;
      setCurrentWeekStart(allowedWeeks[1]);
      setSelectedSlots([]);
    }
  }, [equipmentDetail?.daily_slots, lastFetchedWeek, userType, selectedEquipment?.id, bookingAsExternalTarget, adminManageMode, adminBookForUserId]);

  // Handle input field changes - charge will auto-calculate via useEffect
  const handleInputFieldChange = (fieldKey: string, value: string | boolean | string[] | number) => {
    if (repeatSourceBooking) return;
    const changedField = equipmentDetail?.input_fields?.find(
      (f: any) => String(f?.field_key || "").toUpperCase() === String(fieldKey || "").toUpperCase()
    );
    const changedFieldType = String(changedField?.field_type || "").toUpperCase().trim();
    // NUMERIC: clamp to resolved min/max (help_text / options / defaults 0–100)
    // Allow intermediate signed drafts ("-", "-.") when negatives are configured.
    if (changedFieldType === "NUMERIC") {
      if (typeof value === "string" && isNumericInputDraft(value)) {
        const draftBounds = resolveNumericFieldBounds(changedField);
        if (value.trim().startsWith("-") && !numericFieldAllowsNegative(draftBounds)) {
          value = String(draftBounds.min);
        } else {
          setInputFieldValues((prev) => {
            const next: Record<string, unknown> = { ...prev, [fieldKey]: value };
            applyTableRowSyncToValues(next, equipmentDetail?.input_fields, fieldKey);
            return next as typeof prev;
          });
          if (searchParams.get("mode") === "calculate") {
            lastCalculatedValuesRef.current = "";
          }
          return;
        }
      }
      const formulaMax =
        String(fieldKey || "").toUpperCase() === "A" && !bookingAsExternalTarget
          ? resolveDynamicMaxForFieldA(
              changedField,
              { ...inputFieldValues, [fieldKey]: value },
              equipmentDetail,
              false
            )
          : undefined;
      const { min, max } = resolveNumericFieldBounds(changedField, formulaMax);
      const numericValue =
        typeof value === "number"
          ? value
          : typeof value === "string" && value.trim() !== ""
            ? Number(value)
            : undefined;
      if (numericValue !== undefined && Number.isFinite(numericValue)) {
        if (numericValue < min) {
          value = typeof value === "number" ? min : String(min);
        } else if (numericValue > max) {
          toast.error(
            `${changedField?.field_label || fieldKey}: cannot be greater than ${formatNumericBound(max)}`
          );
          value = typeof value === "number" ? max : String(max);
        }
      }
    }
    setInputFieldValues((prev) => {
      const next: Record<string, unknown> = { ...prev, [fieldKey]: value };
      applyTableRowSyncToValues(next, equipmentDetail?.input_fields, fieldKey);
      return next as typeof prev;
    });
    if (searchParams.get("mode") === "calculate") {
      lastCalculatedValuesRef.current = "";
    }
  };

  /** Keep TABLE rows in sync when linked numeric values change (initial load / external updates). */
  useEffect(() => {
    const fields = equipmentDetail?.input_fields;
    if (!Array.isArray(fields) || fields.length === 0) return;
    setInputFieldValues((prev) => {
      const next: Record<string, unknown> = { ...prev };
      const changed = applyTableRowSyncToValues(next, fields);
      return changed ? (next as typeof prev) : prev;
    });
  }, [equipmentDetail?.input_fields, inputFieldValues]);

  const handlePrint3DReady = useCallback((values: Print3DBookingValues | null) => {
    if (!values) {
      setPrintAnalysisId(null);
      setPrintAnalysisBatchId(null);
      lastCalculatedValuesRef.current = '';
      setChargeCalculated(false);
      setCalculatedCharge(null);
      setShowSlots(false);
      setChargeCalculationFailed(false);
      return;
    }
    setPrintAnalysisId(values.batchId ? null : values.analysisId ?? null);
    setPrintAnalysisBatchId(values.batchId ?? null);
    lastCalculatedValuesRef.current = '';
    setInputFieldValues((prev) => ({
      ...prev,
      A: values.weightGrams,
      B: values.materialCode,
      C: values.timeMinutes,
    }));
  }, []);

  /** Prefer admin-configured source; otherwise first PERIODIC_TABLE field on this equipment. */
  const resolvePeriodicFieldKey = useCallback(
    (explicitSourceKey: string) => {
      const ex = String(explicitSourceKey || "").trim();
      if (ex) return ex;
      const pf = (equipmentDetail?.input_fields ?? []).find(
        (f: any) => String(f.field_type || "").toUpperCase().trim() === "PERIODIC_TABLE"
      );
      return String(pf?.field_key ?? "").trim();
    },
    [equipmentDetail?.input_fields]
  );

  /** Same logic as "Apply" in the periodic-table dialog; used by both that dialog and the ICPMS standards picker. */
  const applyPeriodicSelectionFromElementSymbols = useCallback(
    async (
      periodicFieldKeyParam: string,
      rawSymbols: string[],
      options?: { openPeriodicDialogAfter?: boolean }
    ) => {
      const field = equipmentDetail?.input_fields?.find((f: { field_key?: string }) => f.field_key === periodicFieldKeyParam);
      const { disabled: disabledSet, preselected: preselectedSet } = parsePeriodicHelpText(field?.help_text);
      const merged = mergePeriodicDisplaySymbols(
        [...rawSymbols, ...Array.from(preselectedSet)],
        field?.help_text
      );
      let allowed = merged.all.filter((s) => !disabledSet.has(s));

      const icpmsAllCoverageFields = (equipmentDetail?.input_fields ?? []).filter((f: any) => {
        const ft = String(f?.field_type || "").toUpperCase().trim();
        return ft === "ICPMS_STANDARD_COVERAGE";
      });

      const icpmsMatchingCoverageFields = icpmsAllCoverageFields.filter((f: any) => {
        const sourceKey = String(f?.source_element_field_key || "").trim();
        return sourceKey === periodicFieldKeyParam && !!sourceKey;
      });

      const icpmsCoverageFields =
        icpmsMatchingCoverageFields.length > 0 ? icpmsMatchingCoverageFields : icpmsAllCoverageFields;

      const nextInputUpdates: Record<string, string | boolean | string[] | number> = {};

      const syncCountsFromAllowed = (symbols: string[]) => {
        const nextMerged = mergePeriodicDisplaySymbols(symbols, field?.help_text);
        const nextAll = nextMerged.all.filter((s) => !disabledSet.has(s));
        const nextBillable = nextMerged.billable;
        const countFor = (k: string) =>
          k === "A" || k === "B"
            ? nextBillable.length > 0
              ? Math.max(1, nextBillable.length)
              : 0
            : nextBillable.length;
        nextInputUpdates[periodicFieldKeyParam] = countFor(periodicFieldKeyParam);
        nextInputUpdates[periodicFieldKeyParam + "_elements"] = nextAll.join(",");
        for (const f of icpmsCoverageFields) {
          const srcKey = String(f?.source_element_field_key || "").trim();
          if (!srcKey) continue;
          nextInputUpdates[srcKey] = countFor(srcKey);
          nextInputUpdates[srcKey + "_elements"] = nextAll.join(",");
        }
        return nextAll;
      };

      allowed = syncCountsFromAllowed(allowed);
      setSelectedPeriodicSymbols(new Set(allowed));

      if (icpmsCoverageFields.length > 0) {
        if (allowed.length > 0) {
          try {
            let minCount = 0;
            let standards: Array<{ id: number; s_no: string; name_of_std: string }> = [];

            while (allowed.length > 0) {
              const res = await apiClient.getIcpmsMinStandardsCover(allowed);
              const data = (res as any)?.data;
              const uncovered = Array.isArray(data?.uncovered) ? data?.uncovered : [];

              if (uncovered.length > 0) {
                const uncoveredStr = uncovered.join(", ");
                const exclude = window.confirm(
                  `Some selected elements cannot be covered by available standards.\n\nUncovered elements:\n${uncoveredStr}\n\nDo you want to exclude these elements and recalculate?`
                );

                if (!exclude) {
                  // Keep locked preselected elements; clear only user-billable picks.
                  allowed = syncCountsFromAllowed(Array.from(preselectedSet));
                  setSelectedPeriodicSymbols(new Set(allowed));

                  for (const f of icpmsCoverageFields) {
                    nextInputUpdates[f.field_key] = 0;
                  }

                  setIcpmsCoverageByFieldKey((prev) => {
                    const next = { ...prev };
                    for (const f of icpmsCoverageFields) {
                      next[f.field_key] = null;
                    }
                    return next;
                  });

                  setInputFieldValues((prev) => ({ ...prev, ...nextInputUpdates }));
                  setPeriodicTableFieldKey(null);
                  return;
                }

                const uncoveredSet = new Set(uncovered.map((u: string) => String(u).toUpperCase()));
                // Never drop locked preselected elements when excluding uncovered.
                allowed = allowed.filter(
                  (s) => preselectedSet.has(s) || !uncoveredSet.has(String(s).toUpperCase())
                );
                allowed = syncCountsFromAllowed(allowed);
                setSelectedPeriodicSymbols(new Set(allowed));

                if (allowed.length === 0) {
                  for (const f of icpmsCoverageFields) {
                    nextInputUpdates[f.field_key] = 0;
                  }
                  setIcpmsCoverageByFieldKey((prev) => {
                    const next = { ...prev };
                    for (const f of icpmsCoverageFields) {
                      next[f.field_key] = null;
                    }
                    return next;
                  });
                  setInputFieldValues((prev) => ({ ...prev, ...nextInputUpdates }));
                  setPeriodicTableFieldKey(null);
                  return;
                }

                continue;
              }

              minCount = data?.count ?? 0;
              standards = Array.isArray(data?.standards) ? data.standards : [];
              break;
            }

            for (const f of icpmsCoverageFields) {
              nextInputUpdates[f.field_key] = minCount;
            }

            setIcpmsCoverageByFieldKey((prev) => {
              const next = { ...prev };
              for (const f of icpmsCoverageFields) {
                next[f.field_key] = { count: minCount, standards };
              }
              return next;
            });
          } catch {
            for (const f of icpmsCoverageFields) {
              nextInputUpdates[f.field_key] = 0;
            }
            setIcpmsCoverageByFieldKey((prev) => {
              const next = { ...prev };
              for (const f of icpmsCoverageFields) {
                next[f.field_key] = null;
              }
              return next;
            });
          }
        } else {
          for (const f of icpmsCoverageFields) {
            nextInputUpdates[f.field_key] = 0;
          }
          setIcpmsCoverageByFieldKey((prev) => {
            const next = { ...prev };
            for (const f of icpmsCoverageFields) {
              next[f.field_key] = null;
            }
            return next;
          });
        }
      }

      setInputFieldValues((prev) => ({ ...prev, ...nextInputUpdates }));
      lastCalculatedValuesRef.current = "";
      if (options?.openPeriodicDialogAfter) {
        setPeriodicTableFieldKey(periodicFieldKeyParam);
      } else {
        setPeriodicTableFieldKey(null);
      }
    },
    [equipmentDetail]
  );

  // Recompute ICPMS Standard Coverage (field C) whenever source element field (e.g. B) changes
  useEffect(() => {
    const fields = equipmentDetail?.input_fields;
    if (!fields?.length) return;
    const icpmsFields = fields.filter(
      (f: any) => String(f.field_type || '').toUpperCase().trim() === 'ICPMS_STANDARD_COVERAGE'
    );
    if (icpmsFields.length === 0) return;

    let cancelled = false;
    icpmsFields.forEach((field: any) => {
      let sourceKey = (field.source_element_field_key || '').trim();
      if (!sourceKey) {
        const pf = fields.find(
          (x: any) => String(x.field_type || '').toUpperCase().trim() === 'PERIODIC_TABLE'
        );
        sourceKey = (pf?.field_key || '').trim();
      }
      if (!sourceKey) return;

      const elementsStr = (inputFieldValues[sourceKey + '_elements'] as string) ?? '';
      const elements = elementsStr ? elementsStr.split(',').map((s: string) => s.trim()).filter(Boolean) : [];

      if (elements.length === 0) {
        setInputFieldValues(prev => (prev[field.field_key] === 0 ? prev : { ...prev, [field.field_key]: 0 }));
        setIcpmsCoverageByFieldKey(prev => (prev[field.field_key] === null ? prev : { ...prev, [field.field_key]: null }));
        return;
      }

      apiClient.getIcpmsMinStandardsCover(elements).then((res) => {
        if (cancelled) return;
        const count = res?.data?.count ?? 0;
        const standards = res?.data?.standards ?? [];
        setInputFieldValues(prev => (prev[field.field_key] === count ? prev : { ...prev, [field.field_key]: count }));
        setIcpmsCoverageByFieldKey(prev => ({
          ...prev,
          [field.field_key]: { count, standards },
        }));
      }).catch(() => {
        if (cancelled) return;
        setInputFieldValues(prev => (prev[field.field_key] === 0 ? prev : { ...prev, [field.field_key]: 0 }));
        setIcpmsCoverageByFieldKey(prev => (prev[field.field_key] === null ? prev : { ...prev, [field.field_key]: null }));
      });
    });

    return () => { cancelled = true; };
  }, [equipmentDetail?.input_fields, inputFieldValues]);

  /** Reset booking page to default state (slots cleared, auto-select off, charge cleared, input fields to defaults, booking options unchecked). Calendar week is left unchanged (same as at time of confirming booking). Call after booking success or failure. */
  const resetBookingPageToDefaults = useCallback(() => {
    setSelectedSlots([]);
    setAutoSlotSelection(false);
    setChargeCalculated(false);
    setCalculatedCharge(null);
    setShowSlots(false);
    lastCalculatedValuesRef.current = '';
    setBookAnyAvailableSlots(false);
    setBookEvenIfSingleSlotAvailable(false);
    if (equipmentDetail?.input_fields && equipmentDetail.input_fields.length > 0) {
      const initialValues: Record<string, string | boolean | string[] | number | string[][]> = {};
      equipmentDetail.input_fields.forEach((field: any) => {
        const fieldType = String(field.field_type || '').toUpperCase().trim();
        if (fieldType === 'PERIODIC_TABLE') {
          initialValues[field.field_key] = getInitialDynamicInputValue(field, equipmentDetail.input_fields);
          initialValues[field.field_key + '_elements'] = (field.options && Array.isArray(field.options) ? field.options.join(',') : '') || '';
        } else {
          initialValues[field.field_key] = getInitialDynamicInputValue(field, equipmentDetail.input_fields);
        }
      });
      applyTableRowSyncToValues(initialValues as Record<string, unknown>, equipmentDetail.input_fields);
      setInputFieldValues(initialValues);
      setIcpmsCoverageByFieldKey({});
    }
  }, [equipmentDetail?.input_fields]);

  const handleBooking = async () => {
    if (!userId || !selectedEquipment || (selectedSlots.length === 0 && !waitlistIntentEffective)) {
      toast.error("Please select at least one time slot");
      return;
    }

    if (bookingAsExternalTarget) {
      if (isExternalUser && !istemPortalAcknowledged) {
        toast.error(
          "Confirm I-STEM portal registration in your Profile before booking (Profile → I-STEM confirmation → Save)."
        );
        return;
      }
      if (
        String(userType ?? "").toLowerCase() === "admin" &&
        adminManageMode === "book" &&
        adminBookForUserId &&
        adminTargetIstemAcknowledged !== true
      ) {
        toast.error(
          "The selected user has not confirmed I-STEM portal registration on their profile. They must update Profile before you can book for them."
        );
        return;
      }
    }

    // Repeat-sample flow: create repeat booking with user-selected slots (no charge, excluded from quota)
    if (repeatSourceBooking) {
      const slotIds = selectedSlots
        .map((s) => s.slotData?.id)
        .filter((id): id is number => typeof id === "number");
      if (slotIds.length !== selectedSlots.length || slotIds.length === 0) {
        toast.error("Please select valid time slots");
        return;
      }
      setIsSubmittingBooking(true);
      try {
        const res = await apiClient.createRepeatBooking(repeatSourceBooking.real_booking_id, slotIds);
        if (res.error) {
          toast.error(res.error);
          return;
        }
        toast.success((res.data as { message?: string })?.message || "Repeat booking created successfully.");
        resetBookingPageToDefaults();
        const repeatData = res.data as {
          virtual_booking_id?: string;
          booking?: { virtual_booking_id?: string; booking_id?: number; real_booking_id?: number };
        } | undefined;
        const repeatView =
          repeatData?.virtual_booking_id ||
          repeatData?.booking?.virtual_booking_id ||
          (repeatData?.booking?.real_booking_id != null
            ? String(repeatData.booking.real_booking_id)
            : repeatData?.booking?.booking_id != null
              ? String(repeatData.booking.booking_id)
              : undefined);
        setBookingResultDialog({
          open: true,
          success: true,
          variant: "success",
          message: "Repeat booking created. This booking does not count toward your weekly or monthly limit.",
          bookingViewQuery: repeatView,
          bookingDisplayId: repeatView,
        });
        setRepeatSourceBooking(null);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to create repeat booking");
        resetBookingPageToDefaults();
        setBookingResultDialog({ open: true, success: false, variant: "failure", message: e instanceof Error ? e.message : "Failed to create repeat booking" });
      } finally {
        setIsSubmittingBooking(false);
      }
      return;
    }

    // Validate selection per business rules (skip this for explicit waitlist mode)
    if (!waitlistIntentEffective && calculatedCharge && !isSelectionValidForBooking()) {
      const required = calculatedCharge.total_time_minutes;
      const selected = getTotalSelectedMinutes();
      const oneSlot = getOneSlotDurationMinutes(selectedSlots[0]);
      if (required <= oneSlot && selectedSlots.length !== 1) {
        toast.error("Please select exactly one slot when required time is within a single slot.");
      } else {
        toast.error(
          `Selection does not match required time (${required} minutes). ` +
          `Selected: ${selected} minutes. Select slots that cover the required time (within 10% of one slot).`
        );
      }
      return;
    }

    if (equipmentDetail?.input_fields) {
      const requiredFields = equipmentDetail.input_fields.filter((field: any) => field.is_required);
      for (const field of requiredFields) {
        const value = inputFieldValues[field.field_key];
        const isEmpty = value === undefined || value === null || value === '' ||
            (Array.isArray(value) && value.length === 0) ||
            (typeof value === 'number' && value === 0);
        if (isEmpty) {
          toast.error(`Please fill in the required field: ${field.field_label}`);
          return;
        }
      }
    }

    const slotIds = selectedSlots
      .map((s) => s.slotData?.id)
      .filter((id): id is number => typeof id === "number");
    const canUseSlotIds = slotIds.length === selectedSlots.length && slotIds.length > 0;

    if (isUrgentHoldMode && !canUseSlotIds) {
      toast.error("Please select one or more slots from the grid for your urgent request.");
      return;
    }

    if (equipmentDetail?.profile_type === "PRINT_3D" && !printAnalysisId && !printAnalysisBatchId) {
      toast.error("Upload and analyze STL file(s) before booking.");
      return;
    }

    const print3dBookExtras =
      equipmentDetail?.profile_type === "PRINT_3D"
        ? printAnalysisBatchId
          ? { print_analysis_batch_id: printAnalysisBatchId }
          : printAnalysisId
            ? { print_analysis_id: printAnalysisId }
            : {}
        : {};

    setIsSubmittingBooking(true);

    try {
      // No-slots visible flow: user explicitly confirmed waitlist booking.
      if (waitlistIntentEffective && !canUseSlotIds) {
        const res = await apiClient.bookEquipment(selectedEquipment.id, {
          input_values: inputFieldValues,
          ...(bookingAsExternalTarget ? { sample_return_after_analysis: sampleReturnAfterAnalysis } : {}),
          atmosphere_sensitive_sample: atmosphereSensitiveForBooking,
          status: "pending",
          waitlist_on_failure: waitlistIntentEffective,
          request_waitlist_without_slot_selection: true,
          ...(rewardPointsToRedeem.trim() ? { reward_points_to_redeem: rewardPointsToRedeem.trim() } : {}),
          ...(isAdminOrOIC() && adminBookForUserId ? { user_id: Number(adminBookForUserId) } : {}),
          ...print3dBookExtras,
        });
        const errRes = res as { error?: string; waitlist_position?: number; waitlist_code?: string };
        if (res.error || errRes.waitlist_position != null || errRes.waitlist_code) {
          const waitlistLabel = errRes.waitlist_code || (errRes.waitlist_position != null ? `WL${errRes.waitlist_position}` : null);
          const backendSaysWaitlisted = String(errRes.error || "").toLowerCase().includes("booking waitlisted");
          const msg = waitlistLabel
            ? `Booking Waitlisted. You have been added to the waitlist at position ${waitlistLabel}.`
            : (errRes.error || "Booking unsuccessful.");
          toast.error(msg);
          resetBookingPageToDefaults();
          setBookingResultDialog({
            open: true,
            success: false,
            variant: (waitlistLabel || backendSaysWaitlisted) ? "waitlist" : "failure",
            message: msg,
          });
          return;
        }
        logBookingServerTimings(res);
      }

      // Backend resolves "book any available slots" / single-slot fallback; avoid an extra getEquipmentSlots round-trip here.
      const finalSlotIds = slotIds;
      const totalHours = calculatedCharge ? calculatedCharge.total_time_minutes / 60 : 0;
      const totalCost = calculatedCharge ? Number(calculatedCharge.total_charge) : 0;

      if (canUseSlotIds) {
        if (isUrgentHoldMode) {
          const rt = searchParams.get("return_to");
          const returnToPage =
            rt === "my-urgent-requests" || rt === "urgent-requests-wallet" || rt === "dashboard";
          if (returnToPage) {
            // Create hold and redirect to dashboard to complete urgent request form
            const weekStart = startOfWeek(currentWeekStart, { weekStartsOn: 1 });
            const weekEnd = addDays(weekStart, 6);
            const res = await apiClient.bookEquipment(selectedEquipment.id, {
              slot_ids: finalSlotIds,
              total_hours: totalHours,
              total_cost: totalCost,
              status: "pending",
              input_values: inputFieldValues,
              ...(bookingAsExternalTarget ? { sample_return_after_analysis: sampleReturnAfterAnalysis } : {}),
          atmosphere_sensitive_sample: atmosphereSensitiveForBooking,
              ...(rewardPointsToRedeem.trim() ? { reward_points_to_redeem: rewardPointsToRedeem.trim() } : {}),
              create_as_hold: true,
              waitlist_on_failure: waitlistIntentEffective,
              book_any_available_slots: bookingAsExternalTarget ? false : bookAnyAvailableSlots,
              book_even_if_single_slot_available: bookingAsExternalTarget ? false : bookEvenIfSingleSlotAvailable,
              ...(bookAnyAvailableSlots && !bookingAsExternalTarget ? { visible_week_start: format(weekStart, "yyyy-MM-dd"), visible_week_end: format(weekEnd, "yyyy-MM-dd") } : {}),
              ...print3dBookExtras,
            });
            if (res.error) {
              toast.error((res as { error: string }).error);
              return;
            }
            logBookingServerTimings(res);
            const resData = (res as { data?: { booking_id?: number; id?: number; virtual_booking_id?: string | null } }).data;
            const holdId = resData?.booking_id ?? resData?.id;
            const holdVirtualId = resData?.virtual_booking_id ?? null;
            setSelectedSlots([]);
            if (holdId != null) {
              const qs = new URLSearchParams({
                urgent_equipment_id: String(selectedEquipment.id),
                hold_booking_id: String(holdId),
              });
              if (holdVirtualId) qs.set("hold_virtual_booking_id", holdVirtualId);
              const returnPath = rt === "urgent-requests-wallet" ? "/urgent-requests-wallet" : "/my-urgent-requests";
              navigate(`${returnPath}?${qs.toString()}`, { replace: true });
              toast.success("Slots held. Complete and submit your urgent request on the page.");
            } else {
              toast.error("Could not create hold.");
            }
            return;
          }
          // Legacy: store selection and open urgent dialog (when not coming from dashboard)
          setPendingHoldSelection({
            slotIds: finalSlotIds,
            inputValues: { ...inputFieldValues },
            totalCharge: totalCost,
            totalTimeMinutes: Math.round(totalHours * 60),
          });
          setSearchParams((prev) => {
            const p = new URLSearchParams(prev);
            p.delete("urgent");
            return p;
          });
          setSelectedSlots([]);
          setUrgentDialogOpen(true);
          toast.success("Slot selection saved. Complete and submit your urgent request below to hold the slots. If you close without submitting, slots stay available.");
          return;
        }
        const weekStart = startOfWeek(currentWeekStart, { weekStartsOn: 1 });
        const weekEnd = addDays(weekStart, 6);
        const res = await apiClient.bookEquipment(selectedEquipment.id, {
          slot_ids: finalSlotIds,
          total_hours: totalHours,
          total_cost: totalCost,
          status: "pending",
          input_values: inputFieldValues,
          ...(bookingAsExternalTarget ? { sample_return_after_analysis: sampleReturnAfterAnalysis } : {}),
          atmosphere_sensitive_sample: atmosphereSensitiveForBooking,
          ...(rewardPointsToRedeem.trim() ? { reward_points_to_redeem: rewardPointsToRedeem.trim() } : {}),
          waitlist_on_failure: waitlistIntentEffective,
          book_any_available_slots: bookingAsExternalTarget ? false : bookAnyAvailableSlots,
          book_even_if_single_slot_available: bookingAsExternalTarget ? false : bookEvenIfSingleSlotAvailable,
          ...(bookAnyAvailableSlots && !bookingAsExternalTarget ? { visible_week_start: format(weekStart, "yyyy-MM-dd"), visible_week_end: format(weekEnd, "yyyy-MM-dd") } : {}),
          ...(isAdminOrOIC() && adminBookForUserId ? { user_id: Number(adminBookForUserId) } : {}),
          ...print3dBookExtras,
        });
        if (res.error) {
          const errRes = res as { error: string; waitlist_position?: number; waitlist_code?: string };
          const waitlistLabel = errRes.waitlist_code || (errRes.waitlist_position != null ? `WL${errRes.waitlist_position}` : null);
          const backendSaysWaitlisted = String(errRes.error || "").toLowerCase().includes("booking waitlisted");
          const msg = waitlistLabel
            ? `Booking Waitlisted. You have been added to the waitlist at position ${waitlistLabel}. You will be notified by email about your queue status and booking confirmation/failure.`
            : errRes.error;
          toast.error(msg);
          resetBookingPageToDefaults();
          setBookingResultDialog({
            open: true,
            success: false,
            variant: (waitlistLabel || backendSaysWaitlisted) ? "waitlist" : "failure",
            message: msg,
          });
          return;
        }
        logBookingServerTimings(res);
        const resData = (res as {
          data?: {
            booking_id?: number;
            real_booking_id?: number;
            id?: number;
            virtual_booking_id?: string;
            booking_id?: string | number;
            daily_slots?: DailySlot[];
            payment_required?: boolean;
            amount_due?: string;
            input_values_adjusted?: boolean;
            input_values?: Record<string, string | boolean | string[] | number>;
            require_istem_fbr?: boolean;
            istem_portal_url?: string;
            istem_fbr_status?: string | null;
            reward?: {
              points_used?: string;
              discount_amount?: string;
            };
          };
        }).data;
        const realId = resData?.real_booking_id ?? (typeof resData?.id === "number" ? resData.id : undefined);
        const bookingViewQuery =
          (typeof resData?.virtual_booking_id === "string" && resData.virtual_booking_id.trim()) ||
          (typeof resData?.booking_id === "string" && resData.booking_id.trim()) ||
          (realId != null ? String(realId) : undefined);
        if (resData?.payment_required && realId != null && bookingAsExternalTarget) {
          resetBookingPageToDefaults();
          navigate(`/bookings/${realId}/payment`);
          toast.info(`Booking reserved. Please pay ₹${Number(resData.amount_due || 0).toFixed(2)} to confirm.`);
          return;
        }
        // Success: API returns { data: { booking_id, daily_slots, input_values_adjusted?, input_values? } }
        // Merge returned slots into equipment detail so grid shows booked state immediately
        const updatedSlots = resData?.daily_slots;
        if (equipmentDetail && updatedSlots && Array.isArray(updatedSlots) && updatedSlots.length > 0) {
          const byId = new Map((equipmentDetail.daily_slots || []).map((s) => [s.id, s]));
          updatedSlots.forEach((s) => byId.set(s.id, s));
          setEquipmentDetail({
            ...equipmentDetail,
            daily_slots: Array.from(byId.values()).sort((a, b) => (a.id ?? 0) - (b.id ?? 0)),
          });
        }
        if (resData?.input_values_adjusted && resData?.input_values && typeof resData.input_values === "object") {
          setInputFieldValues((prev) => ({ ...prev, ...resData.input_values }));
          toast.info("Booking created with reduced parameters (1 slot) as requested. Input values have been updated.");
        }
        if (realId != null && !resData?.payment_required) {
          const needsIstemNextSteps =
            resData?.require_istem_fbr === true ||
            resData?.istem_fbr_status != null;
          if (needsIstemNextSteps) {
            resetBookingPageToDefaults();
            navigate(`/bookings/${realId}/next-steps`);
            toast.success("Booking confirmed. Complete I-STEM steps on the next page.");
            return;
          }
        }
        resetBookingPageToDefaults();
        setBookingResultDialog({
          open: true,
          success: true,
          variant: "success",
          bookingViewQuery,
          bookingDisplayId: bookingViewQuery,
          promptCompleteOptionalParams: shouldPromptCompleteOptionalParams(
            equipmentDetail,
            inputFieldValues,
            resData?.input_values ?? null
          ),
          message: (() => {
            const baseMsg = resData?.input_values_adjusted
              ? "Booking created successfully with reduced parameters (1 slot) as requested."
              : "Booking created successfully!";
            const pointsUsed = Number(resData?.reward?.points_used ?? 0);
            const discountAmount = resData?.reward?.discount_amount;
            if (pointsUsed > 0 && discountAmount) {
              return `${baseMsg} Reward applied: ${pointsUsed.toFixed(2)} points (₹${discountAmount}).`;
            }
            return baseMsg;
          })(),
        });
        return;
      }

      // Fallback: group consecutive slots into multiple bookings
      const sortedSlots = [...selectedSlots].sort((a, b) => {
        const aStart = a.slotData?.start_datetime ? parseISO(a.slotData.start_datetime).getTime() : a.date.getTime();
        const bStart = b.slotData?.start_datetime ? parseISO(b.slotData.start_datetime).getTime() : b.date.getTime();
        return aStart - bStart;
      });
      
      // Group consecutive slots into bookings using actual slot start/end times
      const bookings: Array<{start: Date, end: Date}> = [];
      let currentBooking: {start: Date, end: Date} | null = null;

      sortedSlots.forEach((slot, index) => {
        // Use actual slot start/end times from API if available
        let slotStart: Date;
        let slotEnd: Date;
        
        if (slot.slotData?.start_datetime && slot.slotData?.end_datetime) {
          slotStart = parseISO(slot.slotData.start_datetime);
          slotEnd = parseISO(slot.slotData.end_datetime);
        } else {
          // Fallback to date + time parsing
          const slotDateTime = new Date(slot.date);
          const [hours, minutes] = slot.time.split(':');
          slotDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
          slotStart = slotDateTime;
          slotEnd = new Date(slotDateTime.getTime() + 60 * 60 * 1000); // Default 1 hour
        }

        if (!currentBooking) {
          currentBooking = {
            start: slotStart,
            end: slotEnd
          };
        } else {
          // Check if this slot is consecutive (starts exactly when previous ends)
          if (slotStart.getTime() === currentBooking.end.getTime()) {
            // Extend the booking to include this slot
            currentBooking.end = slotEnd;
          } else {
            // Start a new booking
            bookings.push(currentBooking);
            currentBooking = {
              start: slotStart,
              end: slotEnd
            };
          }
        }

        if (index === sortedSlots.length - 1 && currentBooking) {
          bookings.push(currentBooking);
        }
      });

      // Calculate cost per minute from calculated charge
      let costPerMinute = 0;
      if (calculatedCharge && calculatedCharge.total_time_minutes > 0) {
        costPerMinute = Number(calculatedCharge.total_charge) / calculatedCharge.total_time_minutes;
      } else if (selectedEquipment.internalRate) {
        // Fallback to internal rate per hour, convert to per minute
        costPerMinute = Number(selectedEquipment.internalRate) / 60;
      }

      // Create all bookings using the equipment-specific booking endpoint
      const bookingPromises = bookings.map(booking => {
        // Calculate actual minutes for this booking
        const minutes = (booking.end.getTime() - booking.start.getTime()) / (1000 * 60);
        const hours = minutes / 60;
        const totalCost = minutes * costPerMinute;
        
        return apiClient.bookEquipment(selectedEquipment.id, {
          start_time: booking.start.toISOString(),
          end_time: booking.end.toISOString(),
          total_hours: hours,
          total_cost: totalCost,
          status: "pending",
          input_values: inputFieldValues,
          ...(bookingAsExternalTarget ? { sample_return_after_analysis: sampleReturnAfterAnalysis } : {}),
          atmosphere_sensitive_sample: atmosphereSensitiveForBooking,
          ...(rewardPointsToRedeem.trim() ? { reward_points_to_redeem: rewardPointsToRedeem.trim() } : {}),
          ...(isAdminOrOIC() && adminBookForUserId ? { user_id: Number(adminBookForUserId) } : {}),
          ...print3dBookExtras,
        });
      });

      const results = await Promise.all(bookingPromises);
      results.forEach((r) => logBookingServerTimings(r));
      const errors = results.filter((r): r is typeof r & { error: string } => !!r.error);

      if (errors.length > 0) {
        const message = errors[0].error || "Failed to create some bookings";
        throw new Error(message);
      }

      const firstData = (results[0] as {
        data?: {
          virtual_booking_id?: string;
          booking_id?: string | number;
          real_booking_id?: number;
          id?: number;
        };
      })?.data;
      const multiViewQuery =
        (typeof firstData?.virtual_booking_id === "string" && firstData.virtual_booking_id.trim()) ||
        (typeof firstData?.booking_id === "string" && firstData.booking_id.trim()) ||
        (firstData?.real_booking_id != null
          ? String(firstData.real_booking_id)
          : firstData?.id != null
            ? String(firstData.id)
            : undefined);
      // Success is logged server-side per booking; no need to call logBookingAttempt here
      resetBookingPageToDefaults();
      setBookingResultDialog({
        open: true,
        success: true,
        variant: "success",
        message: `${bookings.length} booking(s) created successfully!`,
        bookingViewQuery: multiViewQuery,
        bookingDisplayId: multiViewQuery,
        promptCompleteOptionalParams: shouldPromptCompleteOptionalParams(
          equipmentDetail,
          inputFieldValues
        ),
      });
    } catch (error: any) {
      const errMsg = error.message || "Failed to create booking";
      toast.error(errMsg);
      resetBookingPageToDefaults();
      setBookingResultDialog({ open: true, success: false, variant: "failure", message: errMsg });
      // Failure is already logged server-side in submit_booking / book_equipment; do not call logBookingAttempt here to avoid duplicate entries.
      // No-slot log for internal users (urgent request eligibility)
      if (selectedEquipment && isInternalUser() && !isAdminUser()) {
        const slotCount = selectedSlots.length || 0;
        const duration = calculatedCharge?.total_time_minutes ?? undefined;
        apiClient.logNoSlotAllocation({
          equipment_id: selectedEquipment.id,
          number_of_samples: 1,
          slots_requested: slotCount || 1,
          duration_minutes: duration,
        }).catch(() => {});
      }
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  if (!selectedEquipment || !equipmentDetail) {
    const equipmentIdFromUrl = searchParams.get("equipment_id");
    const isLoadingFromUrl = Boolean(equipmentIdFromUrl) && (loadingEquipmentDetail || !selectedEquipment);

    return (
      <div className="page-shell">
        <DashboardHeader />
        <main className="w-full max-w-[1800px] mx-auto px-4 md:px-6 py-8">
          <Card className="rounded-2xl shadow-[var(--shadow-card)]">
            <CardContent className="py-12 text-center">
              {isLoadingFromUrl ? (
                <>
                  <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">Loading equipment…</p>
                </>
              ) : (
                <>
                  <p className="text-muted-foreground mb-4">No equipment selected for booking</p>
                  <Button className="bg-primary hover:bg-primary/90" onClick={() => navigate("/equipments")}>
                    Browse Equipment
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="page-shell relative">
      {(loadingEquipmentDetail || repeatSourceLoading) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-2xl flex flex-col items-center gap-4 shadow-xl border">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="text-sm text-muted-foreground">{repeatSourceLoading ? "Loading repeat booking..." : "Loading equipment details..."}</p>
          </div>
        </div>
      )}
      <DashboardHeader />
      <main className="w-full max-w-[1800px] mx-auto px-4 md:px-6 py-8">
        <div className="max-w-6xl mx-auto mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-3xl font-semibold tracking-tight">
                {isCalculateChargesFlow
                  ? `Calculate Charges — ${selectedEquipment.name}`
                  : canAccessManageEquipmentModes()
                    ? `Manage ${selectedEquipment.name}`
                    : selectedEquipment.name}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-3">
                <EquipmentDepartmentLabel
                  name={(equipmentDetail as any)?.internal_department_name}
                />
                {equipmentDeptWalletBalance?.is_zero &&
                  isEndUserBookingType(userType) &&
                  !canAccessManageEquipmentModes() && (
                  <div className="inline-flex flex-wrap items-center gap-3">
                    <span className="text-base md:text-lg font-bold text-red-600 dark:text-red-500 animate-pulse">
                      Wallet balance for this department is ₹0 — please recharge before booking.
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      className="shrink-0 font-semibold"
                      onClick={() => {
                        const equipmentId = equipmentDetail?.equipment_id ?? selectedEquipment?.id;
                        const params = new URLSearchParams({ recharge: "1" });
                        const deptId = equipmentDeptWalletBalance?.department_id;
                        if (deptId != null) {
                          params.set("department_id", String(deptId));
                        }
                        if (equipmentId != null) {
                          sessionStorage.setItem(
                            "returnToBookEquipment",
                            `/book-equipment?equipment_id=${equipmentId}`,
                          );
                        }
                        navigate(`/wallet?${params.toString()}`);
                      }}
                    >
                      <Wallet className="h-4 w-4 mr-2" />
                      Recharge Wallet
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Admin: mode selector (Manage this Equipment) */}
        {canAccessManageEquipmentModes() && adminManageMode === null && !isCalculateChargesFlow && (
          <div className="max-w-2xl mx-auto mb-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {canBookForOtherUsers() && (
              <Card
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => setAdminManageMode('book')}
              >
                <CardHeader>
                  <CardTitle className="text-lg">Book slots for a user</CardTitle>
                  <CardDescription>
                    Select a user and book slots on their behalf. Charge is calculated for the selected user.
                    {String(userType ?? "").toLowerCase() === "dept_admin"
                      ? " Limited to equipment in your assigned department."
                      : ""}
                  </CardDescription>
                </CardHeader>
              </Card>
            )}
            {canChangeSlotStatus() && (
              <Card
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => setAdminManageMode('status')}
              >
                <CardHeader>
                  <CardTitle className="text-lg">Change slot status</CardTitle>
                  <CardDescription>
                    Mark slots as Other Reasons, Under Maintenance, or Operator Absent.
                  </CardDescription>
                </CardHeader>
              </Card>
            )}
          </div>
        )}

        {/* Admin: slot status change UI – month calendar with day/week/month selection */}
        {canAccessManageEquipmentModes() && adminManageMode === 'status' && selectedEquipment && !isCalculateChargesFlow && (
          <Card className="w-full max-w-none mx-auto mb-8 overflow-hidden border-2 border-primary/20 shadow-xl bg-gradient-to-b from-card to-card/95">
            <div className="bg-gradient-to-r from-primary via-primary to-accent px-6 py-5 text-white">
              <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Change slot status</h2>
                  <p className="text-white/90 mt-1 text-base md:text-lg max-w-3xl">
                    Select one or more dates in the month calendar (click individual days, or use &quot;Select week&quot; / &quot;Select entire month&quot;), then choose the desired status and click Apply. For &quot;Booking Not Utilized&quot; use Week view to select only booked slots; no refund is issued and emails are sent to the user and Supervisor. Other Reasons, Under Maintenance, or Operator Absent will cancel any bookings on those slots and refund users.
                  </p>
                </div>
                <Button variant="secondary" size="default" className="bg-white/20 hover:bg-white/30 text-white border-0 shrink-0" onClick={() => navigate('/equipments')}>
                  <ArrowLeft className="h-5 w-5 mr-2" />
                  Back
                </Button>
              </div>
            </div>
            <CardContent className="space-y-6 p-6 md:p-8">
              {/* Year calendar */}
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Button variant="outline" size="default" className="h-11 px-4 text-base" onClick={() => setStatusChangeMonthStart(prev => subYears(prev, 1))}>
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <span className="font-bold text-xl md:text-2xl min-w-[120px] text-center text-foreground">
                      {statusChangeMonthStart.getFullYear()}
                    </span>
                    <Button variant="outline" size="default" className="h-11 px-4 text-base" onClick={() => setStatusChangeMonthStart(prev => addYears(prev, 1))}>
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button variant="outline" size="default" className="h-11 px-4 text-base font-medium bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-900/30 border-amber-200 dark:border-amber-800" onClick={selectYearForStatus}>
                      Select entire year
                    </Button>
                    <div className="text-sm md:text-base text-muted-foreground font-medium px-2">
                      Double-click a month to open Month view below
                    </div>
                    <Button variant="outline" size="default" className="h-11 px-4 text-base font-medium" onClick={clearYearSelection} disabled={statusChangeSelectedMonths.length === 0}>
                      Clear selection
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-2">
                  {Array.from({ length: 12 }, (_, i) => {
                    const d = new Date(statusChangeMonthStart.getFullYear(), i, 1);
                    const monthKey = format(d, "yyyy-MM");
                    const isSelected = statusChangeSelectedMonths.includes(monthKey);
                    const isCurrentMonth = isSameMonth(d, statusChangeMonthStart);
                    return (
                      <button
                        key={monthKey}
                        type="button"
                        onClick={() => toggleMonthInYearView(monthKey)}
                        onDoubleClick={(e) => {
                          e.preventDefault();
                          setStatusChangeMonthStart(startOfMonth(d));
                        }}
                        className={cn(
                          "min-h-[52px] md:min-h-[60px] p-2 md:p-3 text-base md:text-lg font-semibold rounded-xl border-2 transition-all duration-200",
                          "bg-background hover:bg-primary/10 hover:border-primary/30 border-muted/50",
                          isSelected && "bg-primary text-primary-foreground hover:bg-primary/90 ring-2 ring-primary ring-offset-2 shadow-lg border-primary",
                          isCurrentMonth && !isSelected && "border-primary/50 bg-primary/5"
                        )}
                      >
                        {format(d, "MMM")}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Month navigation */}
              <div className="flex flex-wrap items-center justify-between gap-6">
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="default" className="h-11 px-4 text-base" onClick={() => setStatusChangeMonthStart(prev => subMonths(prev, 1))}>
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <span className="font-bold text-xl md:text-2xl min-w-[200px] text-center text-foreground">
                    {format(statusChangeMonthStart, "MMMM yyyy")}
                  </span>
                  <Button variant="outline" size="default" className="h-11 px-4 text-base" onClick={() => setStatusChangeMonthStart(prev => addMonths(prev, 1))}>
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="outline"
                    size="default"
                    className="h-11 px-4 text-base font-medium"
                    disabled={selectedDatesForStatus.length === 0}
                    onClick={() => {
                      if (selectedDatesForStatus.length > 0) {
                        const day = parseISO(selectedDatesForStatus[0]);
                        selectWeekForStatus(day);
                      }
                    }}
                  >
                    Select selected week
                  </Button>
                  <Button variant="outline" size="default" className="h-11 px-4 text-base font-medium bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-900/30 border-amber-200 dark:border-amber-800" onClick={selectMonthForStatus}>
                    Select entire month
                  </Button>
                  <div className="text-sm md:text-base text-muted-foreground font-medium px-2">
                    Tip: double-click a date to open Week view
                  </div>
                  <Button
                    variant="outline"
                    size="default"
                    className="h-11 px-4 text-base font-medium"
                    onClick={() => { setSelectedDatesForStatus([]); setStatusChangePopupWeekStart(null); setStatusChangeSelectedMonths([]); }}
                    disabled={selectedDatesForStatus.length === 0 && selectedSlotIdsForStatus.length === 0 && statusChangeSelectedMonths.length === 0}
                  >
                    Clear selection
                  </Button>
                </div>
              </div>

              {/* Month calendar grid: Mon–Sun, 6 rows */}
              <div className="rounded-xl border-2 border-primary/10 overflow-hidden shadow-inner bg-muted/20">
                <div className="grid grid-cols-7 bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                    <div key={d} className="p-3 text-center text-base md:text-lg font-bold text-slate-700 dark:text-slate-200">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 bg-card">
                  {(() => {
                    const monthStart = startOfMonth(statusChangeMonthStart);
                    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
                    const days: Date[] = [];
                    for (let i = 0; i < 42; i++) days.push(addDays(calendarStart, i));
                    const effectiveDates = getEffectiveDatesForStatus();
                    return days.map((day) => {
                      const dateStr = format(day, "yyyy-MM-dd");
                      const inMonth = isSameMonth(day, statusChangeMonthStart);
                      const isSelected = effectiveDates.includes(dateStr);
                      return (
                        <button
                          key={dateStr}
                          type="button"
                          onClick={(e) => {
                            if (!inMonth) return;
                            // Second click of a double-click: do not schedule single-click (avoids racing week open).
                            if (e.detail >= 2) {
                              if (statusChangeDateClickTimerRef.current) {
                                clearTimeout(statusChangeDateClickTimerRef.current);
                                statusChangeDateClickTimerRef.current = null;
                              }
                              return;
                            }
                            if (statusChangeDateClickTimerRef.current) {
                              clearTimeout(statusChangeDateClickTimerRef.current);
                            }
                            statusChangeDateClickTimerRef.current = setTimeout(() => {
                              statusChangeDateClickTimerRef.current = null;
                              toggleDateForStatus(dateStr);
                              // Do not close the week grid when toggling date selection — week view is independent.
                            }, 280);
                          }}
                          onDoubleClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!inMonth) return;
                            if (statusChangeDateClickTimerRef.current) {
                              clearTimeout(statusChangeDateClickTimerRef.current);
                              statusChangeDateClickTimerRef.current = null;
                            }
                            openWeekSlotPopup(day);
                          }}
                          className={cn(
                            "min-h-[52px] md:min-h-[60px] p-2 md:p-3 text-base md:text-lg font-semibold border-b border-r border-muted/50 transition-all duration-200",
                            inMonth ? "bg-background hover:bg-primary/10 hover:border-primary/30" : "bg-muted/30 text-muted-foreground",
                            isSelected && "bg-primary text-primary-foreground hover:bg-primary/90 ring-2 ring-primary ring-offset-2 shadow-lg"
                          )}
                        >
                          {format(day, "d")}
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Selection summary */}
              {(selectedDatesForStatus.length > 0 || selectedSlotIdsForStatus.length > 0 || statusChangeSelectedMonths.length > 0) && (
                <div className="rounded-xl border-2 border-primary/20 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4 md:p-5">
                  <h4 className="text-base md:text-lg font-bold text-foreground mb-2">Selection summary</h4>
                  <ul className="space-y-1 text-sm md:text-base text-foreground/90">
                    {statusChangeSelectedMonths.length > 0 && (
                      <li>
                        <strong>{statusChangeSelectedMonths.length}</strong> month(s) selected at year level
                        <span className="ml-1 text-muted-foreground">
                          ({statusChangeSelectedMonths.map((m) => format(parseISO(m + "-01"), "MMM yyyy")).join(", ")})
                        </span>
                      </li>
                    )}
                    {selectedSlotIdsForStatus.length > 0 && (
                      <li>
                        <strong>{selectedSlotIdsForStatus.length}</strong> slot(s) selected
                      </li>
                    )}
                    {(selectedDatesForStatus.length > 0 || statusChangeSelectedMonths.length > 0) && (
                      <li>
                        <strong>{getEffectiveDatesForStatus().length}</strong> date(s) total
                        {getEffectiveDatesForStatus().length <= 10 ? (
                          <span className="ml-1 text-muted-foreground">
                            ({getEffectiveDatesForStatus().map((d) => format(parseISO(d), "MMM d")).join(", ")})
                          </span>
                        ) : (
                          <span className="ml-1 text-muted-foreground">
                            ({format(parseISO(getEffectiveDatesForStatus()[0]), "MMM d")} – {format(parseISO(getEffectiveDatesForStatus()[getEffectiveDatesForStatus().length - 1]), "MMM d")})
                          </span>
                        )}
                      </li>
                    )}
                  </ul>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Open week view for slot-level selection, then choose an operation in the panel below the calendar.
                  </p>
                </div>
              )}

            </CardContent>
          </Card>
        )}

        {/* Inline week view (pick by time) */}
        {canAccessManageEquipmentModes() && adminManageMode === 'status' && selectedEquipment && statusChangePopupWeekStart && (
          <div className="w-full max-w-none mx-auto mb-6 rounded-xl overflow-hidden border border-border/60 shadow-md">
            {/* Compact week header */}
            <div className="sticky top-0 z-20 bg-gradient-to-r from-primary via-primary to-accent px-3 py-2 text-white">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="icon" className="h-8 w-8 bg-white/20 hover:bg-white/30 border-0 text-white" onClick={goToPrevWeekInPopup} aria-label="Previous week">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="text-center min-w-[200px]">
                    <h3 className="text-sm md:text-base font-semibold leading-tight">
                      Week of {format(statusChangePopupWeekStart, "MMM d")} – {format(addDays(statusChangePopupWeekStart, 6), "MMM d, yyyy")}
                    </h3>
                    <p className="text-white/80 text-[11px] mt-0.5">Click slots · time labels select rows · day headers select columns</p>
                  </div>
                  <Button variant="secondary" size="icon" className="h-8 w-8 bg-white/20 hover:bg-white/30 border-0 text-white" onClick={goToNextWeekInPopup} aria-label="Next week">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-white/20 hover:bg-white/30 border-0 text-white h-8 px-3 text-xs font-medium"
                  onClick={() => { setStatusChangePopupWeekStart(null); }}
                >
                  Hide week view
                </Button>
              </div>
            </div>

            {/* Sticky selection toolbar */}
            <div className="sticky top-[52px] z-20 border-b border-border/60 bg-card/95 backdrop-blur-sm px-3 py-2 shadow-sm">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary" className="h-7 px-2.5 text-xs font-semibold tabular-nums">
                  {selectedSlotIdsForStatus.length} selected
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setSelectedSlotIdsForStatus([])}
                  disabled={selectedSlotIdsForStatus.length === 0}
                >
                  Clear
                </Button>
                <div className="h-4 w-px bg-border mx-0.5" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs gap-1" disabled={!statusChangeSlots?.length}>
                      Select…
                      <ChevronDown className="h-3 w-3 opacity-70" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-52">
                    <DropdownMenuItem onClick={selectEntireWeekInPopup}>Entire week</DropdownMenuItem>
                    <DropdownMenuItem onClick={selectWeekdaysInPopup}>Weekdays</DropdownMenuItem>
                    <DropdownMenuItem onClick={selectWeekendsInPopup}>Weekends</DropdownMenuItem>
                    <DropdownMenuItem onClick={selectMorningSlotsInPopup}>Morning</DropdownMenuItem>
                    <DropdownMenuItem onClick={selectAfternoonSlotsInPopup}>Afternoon</DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!statusBulkFocusTime}
                      onClick={() => {
                        if (statusBulkFocusTime) selectTimeRowForWeek(statusBulkFocusTime);
                      }}
                    >
                      This time row{statusBulkFocusTime ? ` (${statusBulkFocusTime})` : ""}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={statusBulkFocusDayOffset == null}
                      onClick={() => {
                        if (statusBulkFocusDayOffset != null) selectDayColumnForWeek(statusBulkFocusDayOffset);
                      }}
                    >
                      This day column
                      {statusBulkFocusDayOffset != null
                        ? ` (${format(addDays(statusChangePopupWeekStart, statusBulkFocusDayOffset), "EEE")})`
                        : ""}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!statusChangeSlots?.length || newSlotStatus === "BOOKING_NOT_UTILIZED"}
                      onClick={selectAllAvailableSlotsInPopup}
                    >
                      All available
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={selectAllBookedSlotsInPopup}>All booked</DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!statusChangeSlots?.length || newSlotStatus === "BOOKING_NOT_UTILIZED"}
                      onClick={selectAllNonCompletedSlotsInPopup}
                    >
                      Excl. completed
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={invertSelectionInPopup}>Invert</DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={selectedSlotIdsForStatus.length === 0}
                      onClick={clearPopupWeekSelection}
                    >
                      Clear week selection
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2.5 text-xs gap-1"
                      disabled={!statusBulkFocusTime || !statusChangeSlots?.length}
                      title={statusBulkFocusTime ? `Row: ${statusBulkFocusTime}` : "Click a time label first"}
                    >
                      Row scope
                      {statusBulkFocusTime ? `: ${statusBulkFocusTime}` : ""}
                      <ChevronDown className="h-3 w-3 opacity-70" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem
                      onClick={() => {
                        if (statusBulkFocusTime) selectTimeRowForWeek(statusBulkFocusTime);
                      }}
                    >
                      Week
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        if (statusBulkFocusTime) void selectTimeRowForMonth(statusBulkFocusTime);
                      }}
                    >
                      Month
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        if (statusBulkFocusTime) void selectTimeRowForYear(statusBulkFocusTime);
                      }}
                    >
                      Year
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2.5 text-xs gap-1"
                      disabled={statusBulkFocusDayOffset == null || !statusChangeSlots?.length}
                      title={
                        statusBulkFocusDayOffset != null
                          ? `Column: ${format(addDays(statusChangePopupWeekStart, statusBulkFocusDayOffset), "EEE MMM d")}`
                          : "Click a day header first"
                      }
                    >
                      Column scope
                      {statusBulkFocusDayOffset != null
                        ? `: ${format(addDays(statusChangePopupWeekStart, statusBulkFocusDayOffset), "EEE")}`
                        : ""}
                      <ChevronDown className="h-3 w-3 opacity-70" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem
                      onClick={() => {
                        if (statusBulkFocusDayOffset != null) selectDayColumnForWeek(statusBulkFocusDayOffset);
                      }}
                    >
                      Week
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        if (statusBulkFocusDayOffset != null) void selectDayColumnForMonth(statusBulkFocusDayOffset);
                      }}
                    >
                      Month
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        if (statusBulkFocusDayOffset != null) void selectDayColumnForYear(statusBulkFocusDayOffset);
                      }}
                    >
                      Year
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <span className="text-[11px] text-muted-foreground ml-auto hidden sm:inline">
                  Scroll down to apply status changes
                </span>
              </div>
            </div>

            <div className="overflow-auto max-h-[min(70vh,720px)] p-2 md:p-3 bg-gradient-to-b from-background to-primary/5 dark:to-primary/10">
              {loadingStatusSlots ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                  <span className="animate-pulse">Loading slots…</span>
                </div>
              ) : (
                <TooltipProvider delayDuration={200}>
                <div className="min-w-[640px] rounded-lg border border-border/60 bg-card overflow-hidden shadow-sm">
                  <div className="grid gap-0 bg-muted/40 sticky top-0 z-20 border-b border-border/60" style={{ gridTemplateColumns: "80px repeat(7, minmax(0, 1fr))" }}>
                    <div className="font-semibold text-[11px] uppercase tracking-wide text-muted-foreground px-1.5 py-1.5 border-r border-border/50 bg-background/95 backdrop-blur-sm sticky left-0 z-30 flex items-center">Time</div>
                    {[0, 1, 2, 3, 4, 5, 6].map((dayOffset) => {
                      const day = addDays(statusChangePopupWeekStart, dayOffset);
                      const dateStr = format(day, "yyyy-MM-dd");
                      const rawH = statusChangeHolidays[dateStr];
                      const holidayLabel = typeof rawH === "string" ? rawH : (rawH && typeof rawH === "object" && "label" in rawH ? (rawH as { label: string }).label : undefined);
                      const holidayColor = typeof rawH === "object" && rawH !== null && "color" in rawH ? (rawH as { color?: string }).color : undefined;
                      const dow = day.getDay();
                      const isSatHeader = dow === 6;
                      const isSunHeader = dow === 0;
                      const adminSat = equipmentDetail?.calendar_colors?.saturday_color ?? "#c7d2fe";
                      const adminSun = equipmentDetail?.calendar_colors?.sunday_color ?? "#fbcfe8";
                      const adminHolDefault = equipmentDetail?.calendar_colors?.holiday_default ?? "#f59e0b";
                      const isDayFocused = statusBulkFocusDayOffset === dayOffset;
                      const headerBadge =
                        holidayLabel != null && holidayLabel !== "" ? (
                          <div
                            className="text-[9px] truncate mt-0.5 leading-tight"
                            style={{
                              backgroundColor: holidayColor ?? adminHolDefault,
                              color: getContrastTextColor(holidayColor ?? adminHolDefault),
                              padding: "1px 4px",
                              borderRadius: 3,
                            }}
                          >
                            {holidayLabel}
                          </div>
                        ) : isSatHeader ? (
                          <div
                            className="text-[9px] font-medium truncate mt-0.5 leading-tight"
                            style={{
                              backgroundColor: adminSat,
                              color: getContrastTextColor(adminSat),
                              padding: "1px 4px",
                              borderRadius: 3,
                            }}
                          >
                            Sat
                          </div>
                        ) : isSunHeader ? (
                          <div
                            className="text-[9px] font-medium truncate mt-0.5 leading-tight"
                            style={{
                              backgroundColor: adminSun,
                              color: getContrastTextColor(adminSun),
                              padding: "1px 4px",
                              borderRadius: 3,
                            }}
                          >
                            Sun
                          </div>
                        ) : null;
                      return (
                        <button
                          key={dayOffset}
                          type="button"
                          title={`Select all slots on ${format(day, "EEE MMM d")} (this week)`}
                          onClick={() => {
                            setStatusBulkFocusDayOffset(dayOffset);
                            selectDayColumnForWeek(dayOffset);
                          }}
                          className={cn(
                            "px-1 py-1.5 text-center border-r border-border/50 last:border-r-0 bg-background/95 backdrop-blur-sm hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors cursor-pointer",
                            isSatHeader && "bg-indigo-50/80 dark:bg-indigo-950/25",
                            isSunHeader && "bg-rose-50/80 dark:bg-rose-950/25",
                            isDayFocused && "ring-2 ring-inset ring-primary",
                          )}
                        >
                          <div className="text-[11px] font-bold text-foreground leading-none">{format(day, "EEE")}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5 leading-none">{format(day, "MMM d")}</div>
                          {headerBadge}
                        </button>
                      );
                    })}
                  </div>
                  {(() => {
                    const timeSlots = statusChangeSlotMasterTimes.length > 0
                      ? statusChangeSlotMasterTimes
                      : (() => {
                          const fromSlots = new Set<string>();
                          statusChangeSlots?.forEach((s) => {
                            if (s.start_datetime || s.slot_open_time) fromSlots.add(timeKeyFromDailySlot(s));
                          });
                          return Array.from(fromSlots).sort();
                        })();
                    const statusLabel = (slot: DailySlot) => {
                      if (slot.status === "BOOKED") return slot.booking_status_display || "Booked";
                      if (slot.status === "BLOCKED") return slot.blocked_label || "Other Reasons";
                      if (slot.status === "BOOKING_NOT_UTILIZED") return "Booking Not Utilized";
                      return slot.status_display || slot.status || "—";
                    };
                    const adminSaturdayColor = equipmentDetail?.calendar_colors?.saturday_color ?? "#c7d2fe";
                    const adminSundayColor = equipmentDetail?.calendar_colors?.sunday_color ?? "#fbcfe8";
                    const adminHolidayDefaultColor = equipmentDetail?.calendar_colors?.holiday_default ?? "#f59e0b";
                    const canSelectSlot = statusChangeCanSelectSlot;
                    if (timeSlots.length === 0) {
                      return (
                        <div className="p-6 text-center text-muted-foreground text-sm">
                          No slots for this week.
                        </div>
                      );
                    }
                    return timeSlots.map((time) => (
                      <div key={time} className="grid gap-0 border-b border-border/40 last:border-b-0" style={{ gridTemplateColumns: "80px repeat(7, minmax(0, 1fr))" }}>
                        <button
                          type="button"
                          title={`Select all slots at ${time} (this week)`}
                          onClick={() => {
                            setStatusBulkFocusTime(time);
                            selectTimeRowForWeek(time);
                          }}
                          className={cn(
                            "flex items-center justify-center px-1 py-0.5 border-r border-border/50 bg-muted/20 sticky left-0 z-10 hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors cursor-pointer",
                            statusBulkFocusTime === time && "ring-2 ring-inset ring-primary bg-primary/5 dark:bg-primary/15",
                          )}
                        >
                          <span className="font-semibold text-[11px] tabular-nums leading-none">{time}</span>
                        </button>
                        {[0, 1, 2, 3, 4, 5, 6].map((dayOffset) => {
                          const day = addDays(statusChangePopupWeekStart, dayOffset);
                          const slot = getStatusChangeSlotAt(day, time);
                          const slotSelectable = canSelectSlot(slot);
                          const isSelected = slot ? selectedSlotIdsForStatus.includes(slot.id) : false;
                          const dateStr = format(day, "yyyy-MM-dd");
                          const rawHoliday = statusChangeHolidays[dateStr];
                          const holidayName = typeof rawHoliday === "string" ? rawHoliday : (rawHoliday && typeof rawHoliday === "object" && "label" in rawHoliday ? (rawHoliday as { label: string }).label : undefined);
                          const holidayColorCell = typeof rawHoliday === "object" && rawHoliday !== null && "color" in rawHoliday ? (rawHoliday as { color?: string }).color : undefined;
                          const dayJs = day.getDay();
                          const isSaturdayCol = dayJs === 6;
                          const isSundayCol = dayJs === 0;
                          const isCalendarAccentDay = isSaturdayCol || isSundayCol || Boolean(holidayName);
                          const slotStatusUpper = String(slot?.status ?? "").toUpperCase();
                          /** Until staff changes the slot, Sat/Sun/holidays show admin calendar names+colors; any other status uses slot styling. */
                          const useCalendarDayStyling =
                            isCalendarAccentDay &&
                            (!slot ||
                              slotStatusUpper === "NOT_AVAILABLE" ||
                              slotStatusUpper === "AVAILABLE");
                          const calendarDayLabel =
                            holidayName && holidayName !== ""
                              ? holidayName
                              : isSaturdayCol
                                ? "Sat"
                                : isSundayCol
                                  ? "Sun"
                                  : "—";
                          const calendarDayBg =
                            (holidayName && (holidayColorCell ?? adminHolidayDefaultColor)) ||
                            (isSaturdayCol ? adminSaturdayColor : isSundayCol ? adminSundayColor : adminHolidayDefaultColor);
                          // Use calendar-colors (from equipment detail / admin settings) first, then localStorage overrides, then defaults
                          const calendarSlotColors = equipmentDetail?.calendar_colors?.slot_colors;
                          let statusForColor = String(slot?.booking_status ?? slot?.status ?? "").toUpperCase();
                          if (slot?.status === "AVAILABLE") {
                            if (slot.status_display === "Reserved for other departments" || slot.home_department_only) {
                              statusForColor =
                                slot.status_display === "Available (all departments)"
                                  ? "AVAILABLE"
                                  : "NON_HOME_RESERVED";
                            } else if (slot.status_display === "Home department only") {
                              statusForColor = "HOME_DEPARTMENT_ONLY";
                            }
                          }
                          const statusBgResolved =
                            calendarSlotColors?.[statusForColor] ??
                            statusChangeSlotColors[statusForColor] ??
                            DEFAULT_SLOT_STATUS_COLORS[statusForColor];
                          const slotBgStatusOnly = statusBgResolved ?? "#e5e7eb";
                          const displayBg = useCalendarDayStyling ? calendarDayBg : slotBgStatusOnly;
                          const displayLabel = slot && useCalendarDayStyling ? calendarDayLabel : slot ? statusLabel(slot) : calendarDayLabel;
                          const emptyCellBg =
                            (holidayName && (holidayColorCell ?? adminHolidayDefaultColor)) ||
                            (isSaturdayCol ? adminSaturdayColor : isSundayCol ? adminSundayColor : undefined);
                          const cell3dStyle: CSSProperties = {
                            boxShadow: "0 1px 2px rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,0.3)",
                            border: "1px solid rgba(148,163,184,0.3)",
                            borderRadius: "4px",
                          };
                          return (
                            <div key={dayOffset} className="min-h-[32px] p-0.5 border-r border-border/30 last:border-r-0">
                              {slot ? (
                                (() => {
                                  const userDetailLines = bookedSlotUserDetailLines(slot);
                                  const cellInner = (
                                    <div className="w-full h-full min-h-[28px] relative flex items-stretch">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setStatusBulkFocusTime(time);
                                          setStatusBulkFocusDayOffset(dayOffset);
                                          if (slotSelectable) toggleStatusChangeSlotSelection(slot.id);
                                        }}
                                        disabled={!slotSelectable}
                                        className={cn(
                                          "flex-1 min-h-[28px] px-1 py-0.5 text-[10px] font-medium text-left transition-all flex items-center justify-center rounded truncate",
                                          !slotSelectable && "cursor-not-allowed opacity-70",
                                          slotSelectable && !isSelected && "hover:brightness-[0.97]",
                                          isSelected && "ring-2 ring-primary ring-offset-1 bg-primary text-white hover:bg-primary/90"
                                        )}
                                        style={
                                          !isSelected && slot
                                            ? {
                                                ...cell3dStyle,
                                                backgroundColor: displayBg,
                                                color: getContrastTextColor(displayBg),
                                              }
                                            : isSelected ? cell3dStyle : undefined
                                        }
                                      >
                                        {isSelected ? "✓" : displayLabel}
                                      </button>
                                      {slot.status === "BOOKED" && slot.booking_id && (
                                        <button
                                          type="button"
                                          aria-label="View booking details"
                                          className="absolute top-0 right-0 p-0.5 rounded opacity-80 hover:opacity-100 focus:outline-none focus:ring-1 focus:ring-ring"
                                          style={{ color: getContrastTextColor(displayBg) }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            setExpandedSlotBooking(null);
                                            setExpandedSlotBookingLoading(true);
                                            apiClient
                                              .getBookings({
                                                booking_id:
                                                  (typeof slot.real_booking_id === "number"
                                                    ? slot.real_booking_id
                                                    : getRealBookingId({
                                                        booking_id: slot.booking_id as string | number,
                                                        real_booking_id: slot.real_booking_id,
                                                      })) ?? undefined,
                                                limit: 1,
                                              })
                                              .then((res) => {
                                                const b = res.data?.bookings?.[0];
                                                if (b) setExpandedSlotBooking(b as BookingDetailCardBooking);
                                              })
                                              .catch(() => toast.error("Failed to load booking details"))
                                              .finally(() => setExpandedSlotBookingLoading(false));
                                          }}
                                        >
                                          <ExternalLink className="h-3 w-3" />
                                        </button>
                                      )}
                                    </div>
                                  );
                                  if (userDetailLines.length === 0) return cellInner;
                                  return (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="w-full h-full">{cellInner}</div>
                                      </TooltipTrigger>
                                      <TooltipContent
                                        side="top"
                                        className="z-[120] max-w-xs whitespace-pre-line text-left px-3 py-2"
                                      >
                                        {userDetailLines.join("\n")}
                                      </TooltipContent>
                                    </Tooltip>
                                  );
                                })()
                              ) : (
                                <div
                                  className="w-full min-h-[28px] px-1 py-0.5 rounded text-[10px] font-medium flex items-center justify-center truncate"
                                  style={
                                    emptyCellBg
                                      ? {
                                          ...cell3dStyle,
                                          backgroundColor: emptyCellBg,
                                          color: getContrastTextColor(emptyCellBg),
                                        }
                                      : { ...cell3dStyle, color: "var(--muted-foreground)" }
                                  }
                                >
                                  {calendarDayLabel}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ));
                  })()}
                </div>
                </TooltipProvider>
              )}

              {/* Inline booking details – shown when user clicks ExternalLink on a booked slot */}
              {expandedSlotBookingLoading && (
                <div className="flex items-center justify-center py-12 border-t">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}
              {!expandedSlotBookingLoading && expandedSlotBooking && (
                <div className="border-t pt-6 mt-4">
                  <BookingDetailCard
                    booking={expandedSlotBooking}
                    onClose={() => setExpandedSlotBooking(null)}
                    onUpdated={() => {
                      if (statusChangePopupWeekStart) fetchStatusChangeSlotsForWeek(statusChangePopupWeekStart);
                    }}
                    isOperator={String(userType).toLowerCase() === "operator"}
                    isManagerOrAdmin={["admin", "manager"].includes(String(userType).toLowerCase())}
                    currentUserType={String(userType ?? "")}
                    currentUserId={userId ? parseInt(userId, 10) : null}
                    backLabel="Close booking details"
                    showPrintButton={false}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {canAccessManageEquipmentModes() && adminManageMode === 'status' && selectedEquipment && !isCalculateChargesFlow && (
          <div className="sticky bottom-4 z-30 w-full max-w-none mx-auto mb-10 rounded-2xl border border-primary/25 bg-card/95 shadow-xl backdrop-blur-sm">
            <div className="border-b border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5 px-5 py-4 dark:border-primary/40 dark:from-primary/10 dark:to-accent/10">
              <h3 className="text-lg font-semibold text-foreground">Apply changes</h3>
              <p className="text-sm text-muted-foreground mt-1">Select slots or dates above, choose an operation, then apply.</p>
            </div>
            <div className="p-5 md:p-6 space-y-4">
              {(selectedDatesForStatus.length > 0 || selectedSlotIdsForStatus.length > 0 || statusChangeSelectedMonths.length > 0) && (
                <div className="rounded-xl border border-primary/70 bg-primary/5 px-4 py-3 dark:border-primary/50 dark:bg-primary/10">
                  <p className="text-sm font-semibold text-foreground">Selected slots summary</p>
                  <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                    {selectedSlotIdsForStatus.length > 0 && (
                      <li><strong className="text-foreground">{selectedSlotIdsForStatus.length}</strong> slot(s) selected</li>
                    )}
                    {getEffectiveDatesForStatus().length > 0 && (
                      <li><strong className="text-foreground">{getEffectiveDatesForStatus().length}</strong> date(s) in scope</li>
                    )}
                    {statusChangeSelectedMonths.length > 0 && (
                      <li><strong className="text-foreground">{statusChangeSelectedMonths.length}</strong> month(s) at year level</li>
                    )}
                  </ul>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-4">
                                {updatingSlotStatus && (
                                  <div className="w-full space-y-2">
                                    <p className="text-sm font-medium text-muted-foreground">Applying changes…</p>
                                    <Progress value={applyProgressPercent} className="h-2.5 w-full" />
                                  </div>
                                )}
                                <Label className="shrink-0 font-bold text-lg text-foreground">Select Operation</Label>
                                <Select
                                  value={newSlotStatus}
                                  onValueChange={(v) => {
                                    if (v === BULK_EMAIL_OPERATION_VALUE) {
                                      openBulkEmailFromStatusCard();
                                      return;
                                    }
                                    setNewSlotStatus(v);
                                  }}
                                >
                                  <SelectTrigger className="w-[260px] md:w-[280px] h-12 text-base font-medium">
                                    <SelectValue placeholder="Select operation" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="BLOCKED" className="text-base">Other Reasons</SelectItem>
                                    <SelectItem value="UNDER_MAINTENANCE" className="text-base">Under Maintenance</SelectItem>
                                    <SelectItem value="OPERATOR_ABSENT" className="text-base">Operator Absent</SelectItem>
                                    <SelectItem value="BOOKING_NOT_UTILIZED" className="text-base">Booking Not Utilized</SelectItem>
                                    <SelectItem value="AVAILABLE" className="text-base">Available</SelectItem>
                                    <SelectItem value="NOT_AVAILABLE" className="text-base">Not Available (closed day)</SelectItem>
                                    <SelectItem value={HOME_DEPARTMENT_ONLY_VALUE} className="text-base">
                                      Reserve for non-home department
                                    </SelectItem>
                                    <SelectItem value={CLEAR_HOME_DEPARTMENT_ONLY_VALUE} className="text-base">
                                      Clear non-home reservation (home dept)
                                    </SelectItem>
                                    <SelectItem value={RESCHEDULE_OPERATION_VALUE} className="text-base">Reschedule</SelectItem>
                                    <SelectItem value={BULK_EMAIL_OPERATION_VALUE} className="text-base">
                                      <span className="flex items-center gap-2">
                                        <Mail className="h-5 w-5" />
                                        Bulk email
                                      </span>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                {newSlotStatus === RESCHEDULE_OPERATION_VALUE && (
                                  <p className="text-sm text-muted-foreground max-w-md">
                                    Open week view, select booked slot(s) from one booking, then Apply to choose new available
                                    slots.
                                  </p>
                                )}
                                {(newSlotStatus === HOME_DEPARTMENT_ONLY_VALUE ||
                                  newSlotStatus === CLEAR_HOME_DEPARTMENT_ONLY_VALUE) && (
                                  <p className="text-sm text-muted-foreground max-w-lg">
                                    Marked slots: reserved for non-home department users. Other slots: home department
                                    only (while any upcoming reserved mark exists). Unbooked reserved slots open to all
                                    departments within the equipment&apos;s Reschedule Hours Threshold before start.
                                    Quotas still apply.
                                  </p>
                                )}
                                {newSlotStatus === "BLOCKED" && (
                                  <Input
                                    placeholder="Other Reasons label (optional)"
                                    value={blockedLabelForStatus}
                                    onChange={(e) => setBlockedLabelForStatus(e.target.value)}
                                    className="max-w-[240px] h-12 text-base"
                                  />
                                )}
                                {newSlotStatus === "BOOKING_NOT_UTILIZED" && isAdminOrOIC() && (
                                  <div className="flex items-center gap-3">
                                    <Checkbox
                                      id="send-email-wallet-owner-not-utilized"
                                      checked={sendEmailToWalletOwnerForNotUtilized}
                                      onCheckedChange={(c) => setSendEmailToWalletOwnerForNotUtilized(c === true)}
                                      className="h-5 w-5"
                                    />
                                    <Label htmlFor="send-email-wallet-owner-not-utilized" className="text-base font-medium cursor-pointer">
                                      Send email to Supervisor
                                    </Label>
                                  </div>
                                )}
                                {newSlotStatus !== BULK_EMAIL_OPERATION_VALUE && (
                                <Button
                                  size="default"
                                  className="h-12 px-6 text-base font-semibold bg-primary hover:bg-primary/90 text-white shadow-md"
                                  disabled={
                                    (selectedSlotIdsForStatus.length === 0 && getEffectiveDatesForStatus().length === 0) ||
                                    updatingSlotStatus ||
                                    updatingHomeDepartmentOnly ||
                                    statusChangeRescheduleLoading ||
                                    (newSlotStatus === "BOOKING_NOT_UTILIZED" && selectedSlotIdsForStatus.length === 0) ||
                                    (newSlotStatus === RESCHEDULE_OPERATION_VALUE && selectedSlotIdsForStatus.length === 0)
                                  }
                                  onClick={async () => {
                                    const effectiveDates = getEffectiveDatesForStatus();
                                    // Week grid: apply by slot_ids only when no month/year/date list is active (avoids sending dates=[one day] while user picked many slots).
                                    const bySlots =
                                      statusChangePopupWeekStart !== null &&
                                      selectedSlotIdsForStatus.length > 0 &&
                                      selectedDatesForStatus.length === 0 &&
                                      statusChangeSelectedMonths.length === 0;
                                    // Reschedule uses selected week-view slots only (do not require bySlots/date mode).
                                    if (
                                      newSlotStatus !== RESCHEDULE_OPERATION_VALUE &&
                                      !bySlots &&
                                      effectiveDates.length === 0
                                    ) {
                                      return;
                                    }
                                    if (newSlotStatus === "BOOKING_NOT_UTILIZED" && !bySlots) {
                                      toast.error("For 'Booking Not Utilized' please use Week view to select booked slots only.");
                                      return;
                                    }
                                    if (newSlotStatus === RESCHEDULE_OPERATION_VALUE) {
                                      if (!selectedEquipment?.id) {
                                        toast.error("Select equipment first.");
                                        return;
                                      }
                                      if (selectedSlotIdsForStatus.length === 0) {
                                        toast.error("For Reschedule, open Week view and select booked slot(s) from one booking.");
                                        return;
                                      }
                                      const selectedSlots =
                                        (statusChangeSlots || []).filter((s) => selectedSlotIdsForStatus.includes(s.id));
                                      const resolveSlotBookingPk = (s: DailySlot): number | null => {
                                        if (typeof s.real_booking_id === "number" && !Number.isNaN(s.real_booking_id)) {
                                          return s.real_booking_id;
                                        }
                                        return getRealBookingId({
                                          booking_id: s.booking_id as string | number,
                                          real_booking_id: s.real_booking_id,
                                        });
                                      };
                                      const booked = selectedSlots.filter(
                                        (s) =>
                                          String(s.status || "").toUpperCase() === "BOOKED" &&
                                          (s.booking_id != null || s.real_booking_id != null) &&
                                          (s.booking_status || "").toUpperCase() !== "COMPLETED"
                                      );
                                      if (booked.length === 0) {
                                        toast.error("Select at least one booked (non-completed) slot to reschedule.");
                                        return;
                                      }
                                      const bookingIds = [
                                        ...new Set(
                                          booked
                                            .map((s) => resolveSlotBookingPk(s))
                                            .filter((id): id is number => id != null && !Number.isNaN(id))
                                        ),
                                      ];
                                      if (bookingIds.length !== 1) {
                                        toast.error(
                                          bookingIds.length === 0
                                            ? "Could not resolve booking id for the selected slots. Try again or open booking details first."
                                            : "Select slots that belong to the same booking only."
                                        );
                                        return;
                                      }
                                      const bookingPk = bookingIds[0];
                                      setStatusChangeRescheduleLoading(true);
                                      try {
                                        let dailySlots: Array<{
                                          id: number;
                                          start_datetime: string;
                                          end_datetime: string;
                                          date: string;
                                        }> = [];
                                        let startTime = "";
                                        let endTime = "";
                                        let equipmentId = selectedEquipment.id;
                                        let maintenanceExtra = false;
                                        let bookingStatus: string | undefined;
                
                                        const res = await apiClient.getBooking(bookingPk);
                                        if (!res.error && res.data) {
                                          const b = res.data as {
                                            booking_id: number | string;
                                            real_booking_id?: number | null;
                                            equipment: number;
                                            start_time: string;
                                            end_time: string;
                                            status?: string;
                                            maintenance_reschedule_extra_week?: boolean;
                                            daily_slots?: Array<{
                                              id: number;
                                              start_datetime: string;
                                              end_datetime: string;
                                              date: string;
                                            }>;
                                          };
                                          dailySlots = (b.daily_slots ?? []).map((s) => ({
                                            id: s.id,
                                            start_datetime: s.start_datetime,
                                            end_datetime: s.end_datetime,
                                            date: s.date,
                                          }));
                                          startTime = b.start_time;
                                          endTime = b.end_time;
                                          equipmentId = b.equipment ?? selectedEquipment.id;
                                          maintenanceExtra = Boolean(b.maintenance_reschedule_extra_week);
                                          bookingStatus = b.status;
                                        }
                
                                        // Fallback: build from week grid slots of the same booking
                                        if (dailySlots.length === 0) {
                                          const sameBooking = (statusChangeSlots || []).filter(
                                            (s) => resolveSlotBookingPk(s) === bookingPk
                                          );
                                          const source = sameBooking.length > 0 ? sameBooking : booked;
                                          dailySlots = [...source]
                                            .sort(
                                              (a, b) =>
                                                new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime()
                                            )
                                            .map((s) => ({
                                              id: s.id,
                                              start_datetime: s.start_datetime,
                                              end_datetime: s.end_datetime,
                                              date: s.date || calendarDateStrFromSlot(s),
                                            }));
                                          if (dailySlots.length > 0) {
                                            startTime = dailySlots[0].start_datetime;
                                            endTime = dailySlots[dailySlots.length - 1].end_datetime;
                                          }
                                        }
                
                                        if (dailySlots.length === 0 || !startTime || !endTime) {
                                          throw new Error(
                                            res.error || "Could not load booking slots for reschedule."
                                          );
                                        }
                
                                        setStatusChangeRescheduleBooking({
                                          booking_id: bookingPk,
                                          equipment: equipmentId,
                                          start_time: startTime,
                                          end_time: endTime,
                                          daily_slots: dailySlots,
                                          maintenance_reschedule_extra_week: maintenanceExtra,
                                          status: bookingStatus,
                                        });
                                        setStatusChangeRescheduleOpen(true);
                                      } catch (e: unknown) {
                                        toast.error(e instanceof Error ? e.message : "Failed to open reschedule.");
                                      } finally {
                                        setStatusChangeRescheduleLoading(false);
                                      }
                                      return;
                                    }
                                    if (
                                      newSlotStatus === HOME_DEPARTMENT_ONLY_VALUE ||
                                      newSlotStatus === CLEAR_HOME_DEPARTMENT_ONLY_VALUE
                                    ) {
                                      setUpdatingHomeDepartmentOnly(true);
                                      try {
                                        const mark = newSlotStatus === HOME_DEPARTMENT_ONLY_VALUE;
                                        const payload: {
                                          home_department_only: boolean;
                                          dates?: string[];
                                          slot_ids?: number[];
                                        } = { home_department_only: mark };
                                        if (bySlots) payload.slot_ids = selectedSlotIdsForStatus;
                                        else payload.dates = effectiveDates;
                                        const res = await apiClient.adminEquipmentBulkHomeDepartmentOnly(
                                          selectedEquipment.id,
                                          payload
                                        );
                                        if ((res as { error?: string }).error) throw new Error((res as { error: string }).error);
                                        const data = (res as { data?: { updated?: number; message?: string } }).data;
                                        toast.success(
                                          data?.message ??
                                            `Marked ${data?.updated ?? 0} slot(s) as ${
                                              mark
                                                ? "Reserved for non-home department"
                                                : "Home department (cleared non-home reservation)"
                                            }.`
                                        );
                                        setSelectedDatesForStatus([]);
                                        setSelectedSlotIdsForStatus([]);
                                        setStatusChangeSelectedMonths([]);
                                        setLastFetchedWeek(null);
                                        if (statusChangePopupWeekStart) {
                                          await fetchSlotsForWeek(true, statusChangePopupWeekStart);
                                        } else if (effectiveDates.length > 0) {
                                          const earliest = [...effectiveDates].sort()[0];
                                          await fetchSlotsForWeek(true, parseISO(earliest));
                                        } else {
                                          await fetchSlotsForWeek(true);
                                        }
                                        if (statusChangePopupWeekStart) await fetchStatusChangeSlotsForWeek(statusChangePopupWeekStart);
                                      } catch (e: unknown) {
                                        toast.error(e instanceof Error ? e.message : "Failed to update home-department marking");
                                      } finally {
                                        setUpdatingHomeDepartmentOnly(false);
                                      }
                                      return;
                                    }
                                    if (applyProgressIntervalRef.current) {
                                      clearInterval(applyProgressIntervalRef.current);
                                      applyProgressIntervalRef.current = null;
                                    }
                                    setApplyProgressPercent(0);
                                    setUpdatingSlotStatus(true);
                                    applyProgressIntervalRef.current = setInterval(() => {
                                      setApplyProgressPercent((p) => (p >= 90 ? 90 : p + Math.random() * 8 + 4));
                                    }, 200);
                                    try {
                                      const payload: { status: string; blocked_label?: string | null; dates?: string[]; slot_ids?: number[]; send_email_to_wallet_owner?: boolean } = {
                                        status: newSlotStatus,
                                      };
                                      if (newSlotStatus === "BLOCKED") payload.blocked_label = blockedLabelForStatus.trim() || null;
                                      if (newSlotStatus === "BOOKING_NOT_UTILIZED") payload.send_email_to_wallet_owner = sendEmailToWalletOwnerForNotUtilized;
                                      if (bySlots) payload.slot_ids = selectedSlotIdsForStatus;
                                      else payload.dates = effectiveDates;
                                      const res = await apiClient.adminEquipmentBulkSlotStatus(selectedEquipment.id, payload);
                                      if ((res as { error?: string }).error) throw new Error((res as { error: string }).error);
                                      const payloadData = (res as { data?: { updated?: number; message?: string } }).data;
                                      toast.success(payloadData?.message ?? `Updated ${payloadData?.updated ?? (bySlots ? selectedSlotIdsForStatus.length : effectiveDates.length)} slot(s).`);
                                      setSelectedDatesForStatus([]);
                                      setSelectedSlotIdsForStatus([]);
                                      setStatusChangeSelectedMonths([]);
                                      setLastFetchedWeek(null);
                                      if (statusChangePopupWeekStart) {
                                        await fetchSlotsForWeek(true, statusChangePopupWeekStart);
                                      } else if (effectiveDates.length > 0) {
                                        const earliest = [...effectiveDates].sort()[0];
                                        await fetchSlotsForWeek(true, parseISO(earliest));
                                      } else {
                                        await fetchSlotsForWeek(true);
                                      }
                                      // Refetch inline week view so the grid shows updated slot statuses
                                      if (statusChangePopupWeekStart) {
                                        await fetchStatusChangeSlotsForWeek(statusChangePopupWeekStart);
                                      }
                                    } catch (e: unknown) {
                                      toast.error(e instanceof Error ? e.message : "Failed to update slots");
                                    } finally {
                                      if (applyProgressIntervalRef.current) {
                                        clearInterval(applyProgressIntervalRef.current);
                                        applyProgressIntervalRef.current = null;
                                      }
                                      setApplyProgressPercent(100);
                                      setTimeout(() => {
                                        setUpdatingSlotStatus(false);
                                        setApplyProgressPercent(0);
                                      }, 400);
                                    }
                                  }}
                                >
                                  {statusChangeRescheduleLoading
                                    ? "Opening reschedule…"
                                    : updatingSlotStatus || updatingHomeDepartmentOnly
                                    ? "Applying…"
                                    : newSlotStatus === RESCHEDULE_OPERATION_VALUE
                                      ? selectedSlotIdsForStatus.length > 0
                                        ? `Reschedule ${selectedSlotIdsForStatus.length} slot(s)ΓÇª`
                                        : "Select booked slots to reschedule"
                                      : selectedSlotIdsForStatus.length > 0
                                      ? `Apply to ${selectedSlotIdsForStatus.length} slot(s)`
                                      : `Apply to ${getEffectiveDatesForStatus().length} date(s)`}
                                </Button>
                                )}
                                <Button
                                  variant="outline"
                                  size="default"
                                  className="h-12 px-5 text-base font-medium"
                                  onClick={() => { setSelectedDatesForStatus([]); setSelectedSlotIdsForStatus([]); setStatusChangeSelectedMonths([]); setStatusChangePopupWeekStart(null); }}
                                  disabled={selectedDatesForStatus.length === 0 && selectedSlotIdsForStatus.length === 0 && statusChangeSelectedMonths.length === 0}
                                >
                                  Clear all selection
                                </Button>
              </div>
            </div>
          </div>
        )}
        <Dialog
          open={statusChangeRescheduleOpen}
          onOpenChange={(open) => {
            setStatusChangeRescheduleOpen(open);
            if (!open) setStatusChangeRescheduleBooking(null);
          }}
        >
          <DialogContent className="sm:max-w-[90vw] max-w-4xl max-h-[90vh] overflow-y-auto z-[100]">
            <DialogHeader>
              <DialogTitle>Reschedule Booking</DialogTitle>
              <DialogDescription>
                Current booking is shown below. Navigate any week (Admin / OIC), select the same number of
                consecutive available slots, then confirm.
              </DialogDescription>
            </DialogHeader>
            {statusChangeRescheduleBooking && selectedEquipment?.id && (
              <RescheduleSlotPicker
                equipmentId={
                  statusChangeRescheduleBooking.equipment || selectedEquipment.id
                }
                maintenanceExtraWeekBookingId={
                  statusChangeRescheduleBooking.maintenance_reschedule_extra_week ||
                  statusChangeRescheduleBooking.status?.toUpperCase() === "DISRUPTION_PENDING"
                    ? statusChangeRescheduleBooking.booking_id
                    : undefined
                }
                booking={statusChangeRescheduleBooking}
                confirmLoading={statusChangeRescheduleLoading}
                onCancel={() => {
                  setStatusChangeRescheduleOpen(false);
                  setStatusChangeRescheduleBooking(null);
                }}
                onConfirm={async (startTimeISO, endTimeISO) => {
                  setStatusChangeRescheduleLoading(true);
                  try {
                    const response = await apiClient.rescheduleBooking(
                      statusChangeRescheduleBooking.booking_id,
                      startTimeISO,
                      endTimeISO
                    );
                    if (response.error) {
                      toast.error(response.error);
                      return;
                    }
                    toast.success(
                      (response.data as { message?: string })?.message ||
                        "Booking rescheduled successfully"
                    );
                    setStatusChangeRescheduleOpen(false);
                    setStatusChangeRescheduleBooking(null);
                    setSelectedSlotIdsForStatus([]);
                    setSelectedDatesForStatus([]);
                    setLastFetchedWeek(null);
                    if (statusChangePopupWeekStart) {
                      await fetchSlotsForWeek(true, statusChangePopupWeekStart);
                      await fetchStatusChangeSlotsForWeek(statusChangePopupWeekStart);
                    } else {
                      await fetchSlotsForWeek(true);
                    }
                  } catch (e: unknown) {
                    toast.error(e instanceof Error ? e.message : "Failed to reschedule booking");
                  } finally {
                    setStatusChangeRescheduleLoading(false);
                  }
                }}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Bulk email popup: selected user emails + write subject and text */}
        <Dialog open={bulkEmailOpen} onOpenChange={setBulkEmailOpen}>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Bulk Email</DialogTitle>
              <DialogDescription>
                Enter the subject and message below. The email will be sent to all selected user emails listed above.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2 overflow-auto min-h-0 flex-1">
              {bulkEmailTemplatesLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading recipients…
                </div>
              ) : (
                <>
                  <div>
                    <Label className="text-sm font-medium">Selected user emails</Label>
                    <div className="rounded-md border bg-muted/30 p-3 mt-2 max-h-[160px] overflow-y-auto text-sm space-y-1.5">
                      {bulkEmailRecipients.length === 0 ? (
                        <p className="text-muted-foreground">No recipients. Select booked slots or dates first, then click Bulk email.</p>
                      ) : (
                        bulkEmailRecipients.map((r, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-muted-foreground tabular-nums">{i + 1}.</span>
                            <span>{r.email}</span>
                            {r.name && r.name !== r.email && <span className="text-muted-foreground text-xs">({r.name})</span>}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="bulk-email-subject">Subject</Label>
                    <Input
                      id="bulk-email-subject"
                      value={bulkEmailSubject}
                      onChange={(e) => setBulkEmailSubject(e.target.value)}
                      placeholder="Email subject"
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="bulk-email-body">Message / Email text</Label>
                    <Textarea
                      id="bulk-email-body"
                      value={bulkEmailBody}
                      onChange={(e) => setBulkEmailBody(e.target.value)}
                      placeholder="Write your email message here…"
                      rows={6}
                      className="mt-2 resize-y"
                    />
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkEmailOpen(false)}>Cancel</Button>
              <Button onClick={sendBulkEmailFromDialog} disabled={sendingBulkEmail || bulkEmailRecipients.length === 0 || !bulkEmailSubject.trim() || !bulkEmailBody.trim()}>
                {sendingBulkEmail ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                Send email
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Booking flow: hide when Admin/Dept Admin and mode not yet chosen or when in status mode */}
        {((!requiresBookModeBeforeForm() || adminManageMode === 'book') || isCalculateChargesFlow) && (
        <div className="max-w-6xl mx-auto">
          <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>{selectedEquipment.name}</CardTitle>
                    <CardDescription>
                      {isCalculateChargesFlow ? (
                        <>Select user type and parameters to estimate charges. No time slots are required.</>
                      ) : (
                        <>
                          {Number(selectedEquipment.internalRate) > 0 && (
                            <>₹{Number(selectedEquipment.internalRate).toFixed(2)}/hour</>
                          )}
                          {equipmentDetail?.slot_duration_minutes && (
                            <>
                              {Number(selectedEquipment.internalRate) > 0 && ' • '}
                              {equipmentDetail.slot_duration_minutes >= 60 ? (
                                <>
                                  Slot Duration: {Math.floor(equipmentDetail.slot_duration_minutes / 60)}h
                                  {equipmentDetail.slot_duration_minutes % 60 > 0 && ` ${equipmentDetail.slot_duration_minutes % 60}m`}
                                </>
                              ) : (
                                <>Slot Duration: {equipmentDetail.slot_duration_minutes} {equipmentDetail.slot_duration_minutes === 1 ? 'minute' : 'minutes'}</>
                              )}
                            </>
                          )}
                          {' - Select your preferred time slots'}
                        </>
                      )}
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (canAccessManageEquipmentModes()) {
                        navigate("/equipments");
                      } else {
                        navigate(`/equipment/${selectedEquipment.id}`);
                      }
                    }}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Accessory availability — informational, before booking steps */}
                {equipmentDetail &&
                  ((Array.isArray(equipmentDetail.accessories) &&
                    equipmentDetail.accessories.length > 0) ||
                    (Array.isArray(equipmentDetail.additional_accessories) &&
                      equipmentDetail.additional_accessories.length > 0)) && (
                    <div className="mb-6">
                      <EquipmentAccessoriesSection
                        compact
                        accessories={(equipmentDetail.accessories || []).map(
                          (accessory: Record<string, unknown>, index: number) => ({
                            id:
                              (accessory.equipment_accessory_id as number | undefined) ??
                              `acc-${index}`,
                            name: String(
                              accessory.accessory_name ||
                                accessory.name ||
                                `Accessory ${index + 1}`
                            ),
                            description:
                              (accessory.notes as string | undefined) ||
                              (accessory.description as string | undefined) ||
                              (accessory.accessory_description as string | undefined) ||
                              null,
                            isEnabled: accessory.is_enabled !== false,
                          })
                        )}
                        additionalAccessories={(
                          equipmentDetail.additional_accessories || []
                        ).map((accessory: Record<string, unknown>) => ({
                          id: accessory.equipment_additional_accessory_id as number,
                          name: String(accessory.additional_accessory_name || ""),
                          description:
                            (accessory.additional_accessory_description as string | undefined) ||
                            null,
                          isEnabled: accessory.is_enabled !== false,
                        }))}
                      />
                    </div>
                  )}

                {/* Admin: select user when booking on behalf (searchable + filter by type) */}
                {canBookForOtherUsers() && adminManageMode === 'book' && !isCalculateChargesFlow && (
                  <div className="mb-6 p-4 rounded-lg border bg-muted/30 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium">User type</Label>
                        <Select value={adminUserTypeFilter} onValueChange={setAdminUserTypeFilter}>
                          <SelectTrigger className="mt-2 max-w-xs">
                            <SelectValue placeholder="All types" />
                          </SelectTrigger>
                          <SelectContent>
                            {USER_TYPE_FILTER_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">Limit list to this type only</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Book slots for user</Label>
                        <Popover open={userComboboxOpen} onOpenChange={setUserComboboxOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={userComboboxOpen}
                              className="mt-2 w-full max-w-md justify-between font-normal"
                            >
                              {adminBookForUserId
                                ? (usersList.find((u) => String(u.id) === adminBookForUserId)?.name ||
                                   usersList.find((u) => String(u.id) === adminBookForUserId)?.email ||
                                   `User #${adminBookForUserId}`)
                                : "Select user…"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                            <Command shouldFilter={false}>
                              <CommandInput
                                placeholder="Search by name or email…"
                                value={userSearchQuery}
                                onValueChange={setUserSearchQuery}
                              />
                              <CommandList>
                                <CommandEmpty>No user found.</CommandEmpty>
                                <CommandGroup>
                                  {usersList
                                    .filter((u) => {
                                      const uTypeNorm = String(u.user_type || "").toLowerCase();
                                      const filterNorm = String(adminUserTypeFilter).toLowerCase();
                                      const typeMatch =
                                        adminUserTypeFilter === USER_TYPE_FILTER_ALL ||
                                        uTypeNorm === filterNorm;
                                      const q = userSearchQuery.trim().toLowerCase();
                                      const nameMatch =
                                        !q ||
                                        (u.name || "").toLowerCase().includes(q) ||
                                        (u.email || "").toLowerCase().includes(q);
                                      return typeMatch && nameMatch;
                                    })
                                    .map((u) => {
                                      const label = u.name || u.email || `User #${u.id}`;
                                      return (
                                        <CommandItem
                                          key={u.id}
                                          value={`${u.id}-${u.email || ""}-${u.name || ""}`}
                                          onSelect={() => {
                                            setAdminBookForUserId(String(u.id));
                                            setAdminBookForUserInfo(null); // Clear until new fetch completes
                                            setChargeCalculated(false);
                                            setCalculatedCharge(null);
                                            setShowSlots(false);
                                            setChargeCalculationFailed(false);
                                            lastCalculatedValuesRef.current = ""; // Force charge recalculation for selected user
                                            setUserComboboxOpen(false);
                                            setUserSearchQuery("");
                                          }}
                                        >
                                          {label}
                                          {u.user_type ? (
                                            <span className="ml-2 text-xs text-muted-foreground">
                                              ({getUserTypeDisplayName(u.user_type) || u.user_type})
                                            </span>
                                          ) : null}
                                        </CommandItem>
                                      );
                                    })}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <p className="text-xs text-muted-foreground mt-2">Charge will be calculated for the selected user.</p>
                      </div>
                    </div>
                    {adminBookForUserInfo && (
                      <div className="w-full mt-4 p-5 rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/10 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-4 border-b border-primary/20">
                          <h4 className="text-sm font-semibold uppercase tracking-wider text-primary">
                            Selected user details
                          </h4>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={async () => {
                              if (!adminBookForUserId) return;
                              const displayName =
                                usersList.find((u) => String(u.id) === adminBookForUserId)?.name ||
                                usersList.find((u) => String(u.id) === adminBookForUserId)?.email ||
                                `User #${adminBookForUserId}`;
                              setUserTransactionHistoryDialog({ open: true, userId: adminBookForUserId, userDisplayName: displayName });
                              setUserTransactionHistory({ loading: true, transactions: [], error: null });
                              try {
                                const res = await apiClient.getAdminUserTransactionHistory(adminBookForUserId, 100, 0);
                                setUserTransactionHistory({ loading: false, transactions: res.data?.transactions ?? [], error: null });
                              } catch (e: unknown) {
                                setUserTransactionHistory({
                                  loading: false,
                                  transactions: [],
                                  error: e instanceof Error ? e.message : "Failed to load transactions",
                                });
                              }
                            }}
                          >
                            <Receipt className="h-4 w-4" />
                            View Transaction History
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-base">
                          <div className="flex flex-col gap-1 p-3 rounded-lg bg-background/80">
                            <span className="text-xs font-semibold uppercase text-muted-foreground">Email</span>
                            <span className="font-medium text-foreground">{adminBookForUserInfo.email || "—"}</span>
                          </div>
                          <div className="flex flex-col gap-1 p-3 rounded-lg bg-background/80">
                            <span className="text-xs font-semibold uppercase text-muted-foreground">Department</span>
                            <span className="font-medium text-foreground">{adminBookForUserInfo.department_name || "—"}</span>
                          </div>
                          <div className="flex flex-col gap-1 p-3 rounded-lg bg-background/80 sm:col-span-2 lg:col-span-1">
                            <span className="text-xs font-semibold uppercase text-muted-foreground">Phone number</span>
                            <span className="font-medium text-foreground">{adminBookForUserInfo.phone_number || "—"}</span>
                          </div>
                          <div className="flex flex-col gap-1 p-3 rounded-lg bg-background/80 sm:col-span-2 lg:col-span-1">
                            <span className="text-xs font-semibold uppercase text-muted-foreground">Supervisor</span>
                            <span className="font-medium text-foreground">
                              {adminBookForUserInfo.wallet_faculty_owner
                                ? `${adminBookForUserInfo.wallet_faculty_owner.name}${adminBookForUserInfo.wallet_faculty_owner.email ? ` (${adminBookForUserInfo.wallet_faculty_owner.email})` : ""}`
                                : "—"}
                            </span>
                          </div>
                          <div className="flex flex-col gap-1 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 sm:col-span-2 lg:col-span-4">
                            <span className="text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-400">Wallet balance</span>
                            <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">₹{adminBookForUserInfo.wallet_balance}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {isCalculateChargesFlow && (
                  <div className="mb-6 p-4 rounded-lg border bg-muted/30 space-y-3">
                    <h3 className="text-lg font-semibold">Select User Type</h3>
                    <p className="text-sm text-muted-foreground">
                      Charges are estimated using the standard rate for the selected user type.
                    </p>
                    <div className="max-w-md space-y-2">
                      <Label htmlFor="charge-estimate-user-type">User type</Label>
                      <Select
                        value={chargeEstimateUserType}
                        onValueChange={(value) => {
                          setChargeEstimateUserType(value);
                          setChargeCalculated(false);
                          setCalculatedCharge(null);
                          setChargeCalculationFailed(false);
                          lastCalculatedValuesRef.current = "";
                        }}
                      >
                        <SelectTrigger id="charge-estimate-user-type">
                          <SelectValue placeholder="Select user type" />
                        </SelectTrigger>
                        <SelectContent>
                          {CHARGE_ESTIMATE_USER_TYPE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.code} value={opt.code}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {!!(equipmentDetail?.important_instruction || "").trim() && (
                  <div
                    className="mb-6 rounded-lg border-2 border-red-500/70 bg-red-50 dark:bg-red-950/40 dark:border-red-500/50 px-4 py-3"
                    role="note"
                  >
                    <p className="text-base md:text-lg font-bold text-red-700 dark:text-red-400 animate-note-blink whitespace-pre-wrap">
                      <span className="uppercase tracking-wide">NOTE:</span>{" "}
                      {(equipmentDetail?.important_instruction || "").trim()}
                    </p>
                  </div>
                )}

                {equipmentDetail?.profile_type === "PRINT_3D" && selectedEquipment && !repeatSourceBooking && (
                  <Print3DBookingPanel
                    equipmentId={selectedEquipment.id}
                    materials={
                      isCalculateChargesFlow
                        ? undefined
                        : (equipmentDetail as { print_materials?: PrintMaterial[] }).print_materials
                    }
                    estimateUserType={isCalculateChargesFlow ? chargeEstimateUserType : undefined}
                    onReady={handlePrint3DReady}
                    onAnalyzingChange={setPrint3dAnalyzing}
                    disabled={!!repeatSourceBooking}
                  />
                )}

                {/* Step 1: Input Fields Section */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-4">Step 1: Sample Information</h3>
                  {repeatSourceBooking && (
                    <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-800 dark:text-amber-200">
                      Repeat sample: parameters are fixed from the original booking and cannot be changed. No charges apply. Choose slots in Step 3. This booking will not count toward your weekly or monthly limit.
                    </div>
                  )}
                  {equipmentDetail?.input_fields && equipmentDetail.input_fields.length > 0 ? (
                    <div className="mb-4 p-4 rounded-lg">
                      <div className="grid grid-cols-1 gap-4">
                        {equipmentDetail.input_fields
                          .filter((field: any) => {
                            if (equipmentDetail?.profile_type !== "PRINT_3D") return true;
                            return !["A", "B", "C"].includes(String(field.field_key || "").toUpperCase());
                          })
                          .map((field: any) => {
                          // Normalize field_type to uppercase for case-insensitive matching
                          const fieldType = String(field.field_type || '').toUpperCase().trim();
                          
                          // Helper function to render the appropriate input component
                          // Only supports: NUMERIC, TEXT, RADIO, COMBO, MULTI_SELECT, TOGGLE
                          const renderInputField = () => {
                            switch (fieldType) {
                              case 'TEXT':
                                return (
                                  <Input
                                    id={field.field_key}
                                    value={inputFieldValues[field.field_key] as string || ''}
                                    onChange={(e) => handleInputFieldChange(field.field_key, e.target.value)}
                                    required={field.is_required}
                                    placeholder={field.default_value || ''}
                                    disabled={!!repeatSourceBooking}
                                  />
                                );
                              
                              case 'NUMERIC': {
                                const formulaMax =
                                  field.field_key === "A" && !bookingAsExternalTarget
                                    ? resolveDynamicMaxForFieldA(
                                        field,
                                        inputFieldValues,
                                        equipmentDetail,
                                        false
                                      )
                                    : undefined;
                                const bounds = resolveNumericFieldBounds(field, formulaMax);
                                const { min: effectiveMin, max: effectiveMax, step: effectiveStep } = bounds;
                                const allowsNegative = numericFieldAllowsNegative(bounds);
                                const stepAttr = formatStepAttr(effectiveStep);
                                const currentRaw = inputFieldValues[field.field_key];
                                const nudge = (direction: 1 | -1) => {
                                  if (repeatSourceBooking) return;
                                  handleInputFieldChange(
                                    field.field_key,
                                    nudgeNumericValue(currentRaw as string | number | undefined, direction, bounds)
                                  );
                                };
                                return (
                                  <div className="space-y-1.5">
                                    <div className="flex items-center gap-1.5">
                                      <Input
                                        id={field.field_key}
                                        type="number"
                                        inputMode={allowsNegative ? "text" : "decimal"}
                                        value={
                                          currentRaw === undefined || currentRaw === null
                                            ? ""
                                            : String(currentRaw)
                                        }
                                        onChange={(e) => handleInputFieldChange(field.field_key, e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === "ArrowUp") {
                                            e.preventDefault();
                                            nudge(1);
                                          } else if (e.key === "ArrowDown") {
                                            e.preventDefault();
                                            nudge(-1);
                                          }
                                        }}
                                        onBlur={(e) => {
                                          const value = e.target.value.trim();
                                          if (value === "" || isNumericInputDraft(value)) {
                                            if (value === "-" || value === "-." || value === "." || value === "") {
                                              return;
                                            }
                                          }
                                          const n = Number(value.replace(",", "."));
                                          if (!Number.isFinite(n)) {
                                            handleInputFieldChange(field.field_key, formatNumericBound(effectiveMin));
                                            return;
                                          }
                                          let next = roundToStepPrecision(n, effectiveStep);
                                          if (next < effectiveMin) next = effectiveMin;
                                          if (next > effectiveMax) {
                                            toast.error(
                                              `${field.field_label || field.field_key}: cannot be greater than ${formatNumericBound(effectiveMax)}`
                                            );
                                            next = effectiveMax;
                                          }
                                          handleInputFieldChange(field.field_key, formatNumericBound(next));
                                        }}
                                        required={field.is_required}
                                        min={effectiveMin}
                                        max={effectiveMax}
                                        step={stepAttr}
                                        placeholder={field.default_value || formatNumericBound(effectiveMin)}
                                        disabled={!!repeatSourceBooking}
                                        className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      />
                                      <div className="flex flex-col shrink-0">
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="icon"
                                          className="h-5 w-8 rounded-b-none border-b-0"
                                          disabled={!!repeatSourceBooking}
                                          aria-label={`Increase by ${stepAttr}`}
                                          onClick={() => nudge(1)}
                                        >
                                          <ChevronUp className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="icon"
                                          className="h-5 w-8 rounded-t-none"
                                          disabled={!!repeatSourceBooking}
                                          aria-label={`Decrease by ${stepAttr}`}
                                          onClick={() => nudge(-1)}
                                        >
                                          <ChevronDown className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              }
                              
                              case 'RADIO':
                                return (
                                  <RadioGroup
                                    value={inputFieldValues[field.field_key] as string || field.default_value || ''}
                                    onValueChange={(value) => handleInputFieldChange(field.field_key, value)}
                                    required={field.is_required}
                                    disabled={!!repeatSourceBooking}
                                  >
                                    {field.options && field.options.length > 0 ? (
                                      field.options.map((option: any, oi: number) => {
                                        const { value: optionValue, label: optionLabel } = normalizeChoiceOption(option, oi);
                                        return (
                                          <div key={`${field.field_key}-${oi}-${optionValue}`} className="flex items-center space-x-2">
                                            <RadioGroupItem value={optionValue} id={`${field.field_key}-${optionValue}`} />
                                            <Label
                                              htmlFor={`${field.field_key}-${optionValue}`}
                                              className="font-normal cursor-pointer"
                                            >
                                              {optionLabel}
                                            </Label>
                                          </div>
                                        );
                                      })
                                    ) : (
                                      <p className="text-sm text-muted-foreground">No options available</p>
                                    )}
                                  </RadioGroup>
                                );
                              
                              case 'COMBO':
                                return (
                                  <Select
                                    value={inputFieldValues[field.field_key] as string || field.default_value || ''}
                                    onValueChange={(value) => handleInputFieldChange(field.field_key, value)}
                                    required={field.is_required}
                                    disabled={!!repeatSourceBooking}
                                  >
                                    <SelectTrigger id={field.field_key} className="w-full">
                                      <SelectValue placeholder="Select an option" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {field.options && field.options.length > 0 ? (
                                        field.options.map((option: any, oi: number) => {
                                          const { value: optionValue, label: optionLabel } = normalizeChoiceOption(option, oi);
                                          return (
                                            <SelectItem key={`${field.field_key}-${oi}-${optionValue}`} value={optionValue}>
                                              {optionLabel}
                                            </SelectItem>
                                          );
                                        })
                                      ) : field.default_value ? (
                                        <SelectItem value={field.default_value}>
                                          {field.default_value}
                                        </SelectItem>
                                      ) : (
                                        <SelectItem value="" disabled>No options available</SelectItem>
                                      )}
                                    </SelectContent>
                                  </Select>
                                );
                              
                              case 'MULTI_SELECT':
                                return (
                                  <div className="space-y-2">
                                    {field.options && field.options.length > 0 ? (
                                      field.options.map((option: any, oi: number) => {
                                        const { value: optionValue, label: optionLabel } = normalizeChoiceOption(option, oi);
                                        const currentValues = (inputFieldValues[field.field_key] as string[]) || [];
                                        const isChecked = currentValues.includes(optionValue);
                                        
                                        return (
                                          <div key={`${field.field_key}-${oi}-${optionValue}`} className="flex items-center space-x-2">
                                            <Checkbox
                                              id={`${field.field_key}-${optionValue}`}
                                              checked={isChecked}
                                              onCheckedChange={(checked) => {
                                                const currentValues = (inputFieldValues[field.field_key] as string[]) || [];
                                                if (checked) {
                                                  handleInputFieldChange(field.field_key, [...currentValues, optionValue]);
                                                } else {
                                                  handleInputFieldChange(field.field_key, currentValues.filter(v => v !== optionValue));
                                                }
                                              }}
                                              disabled={!!repeatSourceBooking}
                                            />
                                            <Label
                                              htmlFor={`${field.field_key}-${optionValue}`}
                                              className="font-normal cursor-pointer"
                                            >
                                              {optionLabel}
                                            </Label>
                                          </div>
                                        );
                                      })
                                    ) : (
                                      <p className="text-sm text-muted-foreground">No options available</p>
                                    )}
                                  </div>
                                );
                              
                              case 'TOGGLE':
                                return (
                                  <div className="flex items-center justify-between">
                                    <Label htmlFor={field.field_key} className="font-normal cursor-pointer">
                                      {field.field_label}
                                    </Label>
                                    <Switch
                                      id={field.field_key}
                                      checked={inputFieldValues[field.field_key] === true || inputFieldValues[field.field_key] === 'true'}
                                      onCheckedChange={(checked) => handleInputFieldChange(field.field_key, checked)}
                                      required={field.is_required}
                                      disabled={!!repeatSourceBooking}
                                    />
                                  </div>
                                );

                              case 'PERIODIC_TABLE': {
                                const count = Number(inputFieldValues[field.field_key]) || 0;
                                const elementsStr = (inputFieldValues[field.field_key + '_elements'] as string) || '';
                                const elementsList = elementsStr ? elementsStr.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
                                const { disabled: disabledSet, preselected: preselectedSet } = parsePeriodicHelpText(field.help_text);
                                const { all: displayList } = mergePeriodicDisplaySymbols(elementsList, field.help_text);
                                const allowedList = displayList.filter((s) => !disabledSet.has(s));
                                return (
                                  <div className="space-y-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      disabled={!!repeatSourceBooking}
                                      onClick={() => {
                                        setPeriodicTableFieldKey(field.field_key);
                                        setSelectedPeriodicSymbols(new Set([...allowedList, ...Array.from(preselectedSet)]));
                                      }}
                                    >
                                      Select elements
                                    </Button>
                                    {(count > 0 || allowedList.length > 0) && (
                                      <p className="text-sm text-muted-foreground">
                                        {periodicSelectionChargeSummaryFromHelpText(allowedList, field.help_text)}
                                        {allowedList.length ? ` Selected: ${allowedList.join(", ")}.` : ""}
                                      </p>
                                    )}
                                  </div>
                                );
                              }

                              case 'ICPMS_STANDARD_COVERAGE': {
                                const value = Number(inputFieldValues[field.field_key]) ?? 0;
                                const coverage = icpmsCoverageByFieldKey[field.field_key];
                                const resolvedPeriodicKey = resolvePeriodicFieldKey(String(field.source_element_field_key || ""));
                                return (
                                  <div className="space-y-2">
                                    <Input
                                      id={field.field_key}
                                      type="number"
                                      value={String(value)}
                                      readOnly
                                      disabled
                                      className="bg-muted font-medium"
                                    />
                                    {field.help_text && (
                                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{field.help_text}</p>
                                    )}
                                    <Button
                                      type="button"
                                      variant="default"
                                      size="sm"
                                      disabled={loadingAvailableIcpmsStandards || !!repeatSourceBooking}
                                      onClick={async () => {
                                        try {
                                          setAvailableIcpmsStandardsDialogOpen(true);
                                          setSelectedIcpmsStandardIds([]);
                                          setLoadingAvailableIcpmsStandards(true);
                                          const res = await apiClient.getIcpmsStandardsFullList();
                                          setFullIcpmsStandards(res?.data?.standards ?? []);
                                        } catch (e) {
                                          toast.error(e instanceof Error ? e.message : "Failed to load standards.");
                                        } finally {
                                          setLoadingAvailableIcpmsStandards(false);
                                        }
                                      }}
                                    >
                                      {loadingAvailableIcpmsStandards ? "Loading..." : "See available standards"}
                                    </Button>
                                    <Dialog
                                      open={availableIcpmsStandardsDialogOpen}
                                      onOpenChange={(open) => {
                                        setAvailableIcpmsStandardsDialogOpen(open);
                                        if (!open) setSelectedIcpmsStandardIds([]);
                                      }}
                                    >
                                      <DialogContent className="max-w-[min(96vw,1200px)] w-full max-h-[90vh] overflow-y-auto flex flex-col">
                                        <DialogHeader>
                                          <DialogTitle>ICPMS standards (database)</DialogTitle>
                                          <DialogDescription>
                                            Select one or more <span className="font-medium text-foreground">Available</span> rows to
                                            apply all elements to &quot;Select elements&quot;. Rows marked Not Available cannot be selected.
                                          </DialogDescription>
                                        </DialogHeader>
                                        {loadingAvailableIcpmsStandards ? (
                                          <div className="text-sm text-muted-foreground py-6">Loading...</div>
                                        ) : (
                                          <div className="rounded-md border overflow-x-auto min-h-0 flex-1">
                                            <table className="w-full text-xs sm:text-sm border-collapse min-w-[800px]">
                                              <thead>
                                                <tr className="bg-muted/50 border-b">
                                                  <th className="text-left font-medium p-2 border-r w-10"> </th>
                                                  <th className="text-left font-medium p-2 border-r">S.NO.</th>
                                                  <th className="text-left font-medium p-2 border-r">Part No.</th>
                                                  <th className="text-left font-medium p-2 border-r">Name of Std</th>
                                                  <th className="text-left font-medium p-2 border-r">List of Element</th>
                                                  <th className="text-left font-medium p-2 border-r">Concentration</th>
                                                  <th className="text-left font-medium p-2 border-r">Availability</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {fullIcpmsStandards.length === 0 ? (
                                                  <tr>
                                                    <td colSpan={7} className="p-3 text-center text-muted-foreground">
                                                      —
                                                    </td>
                                                  </tr>
                                                ) : (
                                                  fullIcpmsStandards.map((row) => {
                                                    const isSelectable = Number(row.status) === 1;
                                                    const availability = isSelectable ? "Available" : "Not Available";
                                                    return (
                                                      <tr
                                                        key={row.id}
                                                        className={cn(
                                                          "border-b last:border-0 bg-background/60",
                                                          !isSelectable && "opacity-70"
                                                        )}
                                                      >
                                                        <td className="p-2 border-r align-middle">
                                                          <Checkbox
                                                            checked={selectedIcpmsStandardIds.includes(row.id)}
                                                            disabled={!isSelectable}
                                                            onCheckedChange={(c) => {
                                                              setSelectedIcpmsStandardIds((prev) => {
                                                                if (c === true) return [...prev, row.id];
                                                                return prev.filter((x) => x !== row.id);
                                                              });
                                                            }}
                                                            aria-label={`Select standard ${row.s_no}`}
                                                          />
                                                        </td>
                                                        <td className="p-2 border-r align-top font-medium text-foreground whitespace-nowrap">
                                                          {row.s_no}
                                                        </td>
                                                        <td className="p-2 border-r align-top">{row.part_no || "—"}</td>
                                                        <td className="p-2 border-r align-top">{row.name_of_std}</td>
                                                        <td className="p-2 border-r align-top break-words max-w-[14rem]">
                                                          {(row.list_of_elements && String(row.list_of_elements).trim()) || "—"}
                                                        </td>
                                                        <td className="p-2 border-r align-top">{row.concentration || "—"}</td>
                                                        <td className="p-2 border-r align-top whitespace-nowrap">
                                                          <span
                                                            className={cn(
                                                              "font-medium",
                                                              isSelectable ? "text-green-700 dark:text-green-400" : "text-muted-foreground"
                                                            )}
                                                          >
                                                            {availability}
                                                          </span>
                                                        </td>
                                                      </tr>
                                                    );
                                                  })
                                                )}
                                              </tbody>
                                            </table>
                                          </div>
                                        )}
                                        <DialogFooter className="gap-2 sm:gap-0 flex-col sm:flex-row sm:justify-end">
                                          <Button variant="outline" onClick={() => setAvailableIcpmsStandardsDialogOpen(false)}>
                                            Close
                                          </Button>
                                          <Button
                                            type="button"
                                            onClick={async () => {
                                              if (!resolvedPeriodicKey) {
                                                toast.error(
                                                  "No periodic table field found on this equipment. Add a Periodic Table input field in equipment settings."
                                                );
                                                return;
                                              }
                                              if (selectedIcpmsStandardIds.length === 0) {
                                                toast.error("Select at least one Available standard.");
                                                return;
                                              }
                                              const merged: string[] = [];
                                              for (const id of selectedIcpmsStandardIds) {
                                                const row = fullIcpmsStandards.find((r) => r.id === id);
                                                if (!row || Number(row.status) !== 1) continue;
                                                merged.push(...splitCsvElements(row.list_of_elements || ""));
                                              }
                                              if (merged.length === 0) {
                                                toast.error("No elements found on the selected standards.");
                                                return;
                                              }
                                              setAvailableIcpmsStandardsDialogOpen(false);
                                              setSelectedIcpmsStandardIds([]);
                                              await applyPeriodicSelectionFromElementSymbols(resolvedPeriodicKey, merged, {
                                                openPeriodicDialogAfter: true,
                                              });
                                              toast.success("Elements applied — review selection in the periodic table.");
                                            }}
                                          >
                                            Apply to element selection
                                          </Button>
                                        </DialogFooter>
                                      </DialogContent>
                                    </Dialog>
                                    {coverage?.standards && coverage.standards.length > 0 && (
                                      <div className="text-sm text-muted-foreground mt-2 space-y-2">
                                        <span className="font-medium text-foreground">Standards covering selected elements</span>
                                        <div className="rounded-md border overflow-x-auto">
                                          <table className="w-full text-sm border-collapse">
                                            <thead>
                                              <tr className="bg-muted/50 border-b">
                                                <th className="text-left font-medium p-2 border-r last:border-r-0">S.NO.</th>
                                                <th className="text-left font-medium p-2 border-r last:border-r-0">Name of Std</th>
                                                <th className="text-left font-medium p-2">List of Element</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {coverage.standards.map((s) => (
                                                <tr key={s.id} className="border-b last:border-0 bg-background/60">
                                                  <td className="p-2 border-r align-top font-medium text-foreground">{s.s_no}</td>
                                                  <td className="p-2 border-r align-top text-foreground">{s.name_of_std}</td>
                                                  <td className="p-2 align-top break-words max-w-[min(100%,28rem)]">
                                                    {(s.list_of_elements && String(s.list_of_elements).trim()) || "—"}
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              }

                              case 'TABLE': {
                                const sourceKey = resolveTableRowCountSourceKey(
                                  field,
                                  equipmentDetail?.input_fields
                                );
                                const rowCountDriven = Boolean(sourceKey);
                                const { columns, hasSerialColumn } = resolveTableColumns(field.options, {
                                  rowCountDriven,
                                });
                                const rows = (inputFieldValues[field.field_key] as string[][] | undefined) || [];
                                const serialLocked = hasSerialColumn;
                                const addRow = () => {
                                  if (rowCountDriven) return;
                                  const newRow = Array(columns.length).fill("");
                                  if (hasSerialColumn) newRow[0] = String(rows.length + 1);
                                  handleInputFieldChange(field.field_key, [...rows, newRow] as any);
                                };
                                const deleteRow = (rowIdx: number) => {
                                  if (rowCountDriven) return;
                                  const next = rows.filter((_, i) => i !== rowIdx);
                                  const renumbered = hasSerialColumn
                                    ? syncTableRowsToCount(next, next.length, columns.length, true)
                                    : next;
                                  handleInputFieldChange(field.field_key, renumbered as any);
                                };
                                const setCell = (rowIdx: number, colIdx: number, val: string) => {
                                  if (serialLocked && colIdx === 0) return;
                                  const next = rows.map((r, i) => (i === rowIdx ? r.slice() : r));
                                  if (!next[rowIdx]) next[rowIdx] = Array(columns.length).fill("");
                                  next[rowIdx][colIdx] = val;
                                  handleInputFieldChange(field.field_key, next as any);
                                };
                                if (columns.length === 0) {
                                  return <p className="text-sm text-muted-foreground">No columns defined for this table.</p>;
                                }
                                return (
                                  <div className="space-y-2">
                                    <div className="rounded-md border overflow-x-auto">
                                      <table className="w-full text-sm border-collapse">
                                        <thead>
                                          <tr className="bg-muted/50 border-b">
                                            {columns.map((header, ci) => (
                                              <th key={ci} className="text-left font-medium p-2 border-r last:border-r-0">
                                                {header}
                                              </th>
                                            ))}
                                            {!rowCountDriven && <th className="w-10 p-2 text-center"> </th>}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {rows.length === 0 ? (
                                            <tr>
                                              <td
                                                colSpan={columns.length + (rowCountDriven ? 0 : 1)}
                                                className="p-2 text-muted-foreground text-center"
                                              >
                                                {rowCountDriven
                                                  ? "No rows yet — set the row-count field above."
                                                  : "No rows. Click + to add."}
                                              </td>
                                            </tr>
                                          ) : (
                                            rows.map((row, ri) => (
                                              <tr key={ri} className="border-b last:border-0">
                                                {columns.map((_, ci) => (
                                                  <td key={ci} className="p-1 border-r last:border-r-0">
                                                    {serialLocked && ci === 0 ? (
                                                      <span className="inline-flex h-8 items-center px-2 text-sm font-medium tabular-nums text-muted-foreground">
                                                        {row[ci] ?? String(ri + 1)}
                                                      </span>
                                                    ) : (
                                                      <Input
                                                        className="h-8 text-sm"
                                                        value={row[ci] ?? ''}
                                                        onChange={(e) => setCell(ri, ci, e.target.value)}
                                                        placeholder=""
                                                        disabled={!!repeatSourceBooking}
                                                      />
                                                    )}
                                                  </td>
                                                ))}
                                                {!rowCountDriven && (
                                                  <td className="p-1 w-10 text-center align-middle">
                                                    <Button
                                                      type="button"
                                                      variant="ghost"
                                                      size="sm"
                                                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                                      onClick={() => deleteRow(ri)}
                                                      title="Delete row"
                                                      disabled={!!repeatSourceBooking}
                                                    >
                                                      <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                  </td>
                                                )}
                                              </tr>
                                            ))
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                    {!rowCountDriven && (
                                      <div className="flex gap-2">
                                        <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={!!repeatSourceBooking}>
                                          <Plus className="h-4 w-4 mr-1" />
                                          Add row
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                              
                              default:
                                // Fallback for unknown field types - show error message
                                console.error(`Unsupported field type "${field.field_type}" (normalized: "${fieldType}") for field "${field.field_key}". Supported types: NUMERIC, TEXT, RADIO, COMBO, MULTI_SELECT, TOGGLE, PERIODIC_TABLE, ICPMS_STANDARD_COVERAGE, TABLE`);
                                return (
                                  <div className="p-3 border border-destructive rounded-md bg-destructive/10">
                                    <p className="text-sm text-destructive font-medium">
                                      Unsupported field type: {field.field_type}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Supported types: NUMERIC, TEXT, RADIO, COMBO, MULTI_SELECT, TOGGLE, PERIODIC_TABLE, ICPMS_STANDARD_COVERAGE, TABLE
                                    </p>
                                  </div>
                                );
                            }
                          };
                          
                          return (
                            <div key={field.field_key} className="space-y-2">
                              <Label htmlFor={field.field_key}>
                                {field.field_label}
                                {field.is_required && <span className="text-destructive ml-1">*</span>}
                              </Label>
                              {renderInputField()}
                              {bookingAsExternalTarget &&
                                !repeatSourceBooking &&
                                String(field.field_label || "").toLowerCase().includes("any other requirements") && (
                                  <div className="mt-4 p-4 rounded-lg border bg-background">
                                    <Label className="text-sm">
                                      Would you like your samples to be sent back once the analysis is complete?
                                    </Label>
                                    <RadioGroup
                                      className="mt-3"
                                      value={sampleReturnAfterAnalysis ? "yes" : "no"}
                                      onValueChange={(v) => {
                                        const next = v === "yes";
                                        setSampleReturnAfterAnalysis(next);
                                        // Force recalculation on next calculateCharge call.
                                        lastCalculatedValuesRef.current = "";
                                      }}
                                    >
                                      <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="yes" id="sample-return-yes" />
                                        <Label htmlFor="sample-return-yes" className="font-normal cursor-pointer">
                                          Yes
                                        </Label>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="no" id="sample-return-no" />
                                        <Label htmlFor="sample-return-no" className="font-normal cursor-pointer">
                                          No
                                        </Label>
                                      </div>
                                    </RadioGroup>
                                    <p className="mt-2 text-xs text-muted-foreground">
                                      If you select Yes, return shipping charges will be added before GST is calculated.
                                    </p>
                                  </div>
                                )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground mb-4">No additional information required for this equipment.</p>
                  )}

                  {!repeatSourceBooking &&
                    !isCalculateChargesFlow &&
                    atmosphereSensitiveAllowed && (
                    <div className="mt-4 p-4 rounded-lg border bg-muted/20 space-y-2">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="atmosphere-sensitive-sample"
                          checked={atmosphereSensitiveSample}
                          onCheckedChange={(c) => setAtmosphereSensitiveSample(c === true)}
                          className="mt-0.5"
                        />
                        <div className="space-y-1">
                          <Label htmlFor="atmosphere-sensitive-sample" className="font-medium cursor-pointer">
                            Atmosphere-sensitive sample (submit at slot start)
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Select if the sample must be brought at the booking start time instead of the normal submission lead time.
                            Lab staff will be notified and should not mark the booking as Not Utilized before the slot begins.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Periodic table element selector dialog */}
                  <Dialog open={!!periodicTableFieldKey} onOpenChange={(open) => !open && setPeriodicTableFieldKey(null)}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Select elements</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        {(() => {
                          const field = equipmentDetail?.input_fields?.find((f: { field_key?: string }) => f.field_key === periodicTableFieldKey);
                          const { disabled: disabledSet, preselected: preselectedSet } = parsePeriodicHelpText(field?.help_text);
                          const toggle = (symbol: string) => {
                            if (disabledSet.has(symbol) || preselectedSet.has(symbol)) return;
                            setSelectedPeriodicSymbols((prev) => {
                              const next = new Set(prev);
                              if (next.has(symbol)) next.delete(symbol);
                              else next.add(symbol);
                              // Always keep locked preselected elements selected.
                              preselectedSet.forEach((s) => next.add(s));
                              return next;
                            });
                          };
                          return (
                            <>
                              <p className="text-sm text-muted-foreground">
                                {periodicSelectionChargeSummaryFromHelpText(
                                  selectedPeriodicSymbols,
                                  field?.help_text
                                )}
                              </p>
                              <div className="overflow-x-auto">
                                <div className="inline-block min-w-max">
                                  <div className="flex flex-col gap-1">
                                    {(() => {
                                      const grid: (Element | null)[][] = Array(7).fill(null).map(() => Array(18).fill(null));
                                      periodicTableElements.forEach((el) => {
                                        if (el.row <= 7 && el.col <= 18) grid[el.row - 1][el.col - 1] = el;
                                      });
                                      const lanthanides = periodicTableElements.filter((el) => el.category === "lanthanide");
                                      const actinides = periodicTableElements.filter((el) => el.category === "actinide");
                                      const elButton = (el: Element) => {
                                        const isDisabled = disabledSet.has(el.symbol);
                                        const isLocked = preselectedSet.has(el.symbol);
                                        const isSelected = selectedPeriodicSymbols.has(el.symbol) || isLocked;
                                        return (
                                          <button
                                            key={el.atomicNumber}
                                            type="button"
                                            onClick={() => toggle(el.symbol)}
                                            disabled={isDisabled || isLocked}
                                            title={
                                              isDisabled
                                                ? `${el.name} (disabled)`
                                                : isLocked
                                                  ? `${el.name} (locked preselected — not charged)`
                                                  : el.name
                                            }
                                            className={cn(
                                              "w-10 h-10 border-2 rounded flex flex-col items-center justify-center text-xs transition-all relative",
                                              getCategoryColor(el.category),
                                              isSelected && "ring-2 ring-primary ring-offset-1 scale-105",
                                              isLocked && "ring-2 ring-sky-500 ring-offset-1",
                                              (isDisabled || isLocked) && "opacity-60 cursor-not-allowed pointer-events-none",
                                              isDisabled && "bg-muted border-dashed"
                                            )}
                                          >
                                            {isSelected && <Check className="w-3 h-3 absolute top-0 right-0" />}
                                            <span className="font-bold">{el.symbol}</span>
                                          </button>
                                        );
                                      };
                                      return (
                                        <>
                                          {grid.map((row, ri) => (
                                            <div key={ri} className="flex gap-1">
                                              {row.map((el, ci) => (
                                                <div key={`${ri}-${ci}`}>
                                                  {el ? (
                                                    elButton(el)
                                                  ) : (
                                                    <div className="w-10 h-10" />
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          ))}
                                          <div className="flex gap-1 mt-1">
                                            <div className="w-10 h-10 flex items-center justify-center text-xs font-semibold">Ln</div>
                                            {lanthanides.map((el) => elButton(el))}
                                          </div>
                                          <div className="flex gap-1 mt-1">
                                            <div className="w-10 h-10 flex items-center justify-center text-xs font-semibold">Ac</div>
                                            {actinides.map((el) => elButton(el))}
                                          </div>
                                        </>
                                      );
                                    })()}
                                  </div>
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setPeriodicTableFieldKey(null)}>Cancel</Button>
                        <Button
                          onClick={async () => {
                            if (!periodicTableFieldKey) return;
                            await applyPeriodicSelectionFromElementSymbols(
                              periodicTableFieldKey,
                              Array.from(selectedPeriodicSymbols)
                            );
                          }}
                        >
                          Apply
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  
                  {/* Progress while STL analysis or charge calculation is running */}
                  {(print3dAnalyzing || loadingCharge) && (
                    <div className="mt-4 space-y-2 rounded-lg border bg-muted/30 p-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {print3dAnalyzing && loadingCharge
                            ? "Analyzing STL and calculating charges…"
                            : print3dAnalyzing
                              ? "Analyzing STL file…"
                              : "Calculating charge and print time…"}
                        </span>
                        <span className="font-medium tabular-nums">
                          {loadingCharge ? `${Math.round(chargeProgress)}%` : "…"}
                        </span>
                      </div>
                      {loadingCharge && <Progress value={chargeProgress} className="h-2" />}
                    </div>
                  )}
                  
                  {/* Charge calculation failed — show for everyone (staff previously had silent failures) */}
                  {chargeCalculationFailed && !loadingCharge && (
                    <div className="mt-6 p-6 bg-muted rounded-lg border-2 border-dashed text-center">
                      <h3 className="text-lg font-semibold mb-2">
                        {isAdminOrOIC() ? "Charge calculation failed" : "Coming Soon"}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {isAdminOrOIC()
                          ? "Could not calculate charges for this 3D print. Check that a user is selected and STL analysis completed, then try again."
                          : "Charge calculation is currently unavailable. Please check back later."}
                      </p>
                    </div>
                  )}
                </div>

                {/* Step 2: Calculated Charge Display (repeat sample: complimentary only) */}
                {chargeCalculated && calculatedCharge && !chargeCalculationFailed && (
                  <div className="mb-6 p-6 bg-primary/10 rounded-lg border-2 border-primary">
                    <h3 className="text-lg font-semibold mb-4">
                      {repeatSourceBooking ? "Step 2: Repeat sample (no charge)" : "Step 2: Charge Calculation"}
                    </h3>
                    {equipmentDetail?.profile_type === "PRINT_3D" && (
                      <p className="text-sm font-bold text-amber-900 mb-4">{PRINT_3D_TENTATIVE_CHARGE_NOTE}</p>
                    )}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Total Time:</span>
                        <span className="text-sm">
                          {Math.floor(calculatedCharge.total_time_minutes / 60)}h {calculatedCharge.total_time_minutes % 60}m
                        </span>
                      </div>
                      {calculatedCharge.show_charge_breakdown !== false &&
                        calculatedCharge.charge_breakdown &&
                        calculatedCharge.charge_breakdown.length > 0 && (
                        <div className="mt-4 space-y-1">
                          <p className="text-sm font-medium mb-2">Charge Breakdown:</p>
                          {calculatedCharge.charge_breakdown.map((item, index) => (
                            <div key={index} className="flex justify-between gap-4 text-sm items-start">
                              <span className="text-muted-foreground whitespace-pre-line shrink min-w-0">{item.description}</span>
                              <span className="shrink-0 tabular-nums">{formatINR(item.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="mt-4 pt-3 border-t space-y-1.5">
                        <div className="flex justify-between font-semibold text-base pt-1">
                          <span>Final amount</span>
                          <span>{formatINR(calculatedCharge.total_charge)}</span>
                        </div>
                      </div>
                      {rewardSummary?.config?.is_enabled && !isCalculateChargesFlow && (
                        <div className="pt-3 border-t space-y-2">
                          <p className="text-xs text-muted-foreground">
                            Available reward points: <span className="font-medium text-foreground">{rewardSummary.points_balance}</span>
                          </p>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              value={rewardPointsToRedeem}
                              onChange={(e) => setRewardPointsToRedeem(e.target.value)}
                              placeholder="Reward points to redeem"
                              className="max-w-[220px]"
                            />
                            <Button type="button" variant="secondary" size="sm" onClick={calculateCharge}>
                              Apply rewards
                            </Button>
                          </div>
                          {calculatedCharge?.reward?.message && (
                            <p className="text-xs text-muted-foreground">{calculatedCharge.reward.message}</p>
                          )}
                          {!!Number(calculatedCharge?.reward?.points_applied ?? 0) && (
                            <p className="text-xs text-emerald-600">
                              Applied {calculatedCharge?.reward?.points_applied} points for discount of ₹{calculatedCharge?.reward?.discount_amount}
                            </p>
                          )}
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-4 border-t">
                        <span className="text-lg font-semibold">Total Charge:</span>
                        <span className="text-2xl font-bold text-primary">
                          ₹{calculatedCharge?.reward?.final_payable ?? calculatedCharge.total_charge}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {isProformaFlow && chargeCalculated && calculatedCharge && !chargeCalculationFailed && (
                  <div className="mb-6 flex flex-wrap gap-3 items-center rounded-lg border border-primary/30 bg-primary/5 p-4">
                    <p className="text-sm text-muted-foreground w-full sm:w-auto sm:flex-1">
                      {proformaEditLineIndex != null
                        ? "Update parameters below, then save to refresh this line in your proforma summary."
                        : "Add this equipment and parameters to your proforma summary. No time slots are required here."}
                    </p>
                    <Button type="button" onClick={handleProformaAddToInvoice}>
                      {proformaEditLineIndex != null ? "Update This Equipment" : "Add This Equipment"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => navigate("/proforma-invoice")}>
                      Back to proforma
                    </Button>
                  </div>
                )}

                {isCalculateChargesFlow && chargeCalculated && calculatedCharge && !chargeCalculationFailed && (
                  <div className="mb-6 flex flex-wrap gap-3 items-center rounded-lg border border-primary/30 bg-primary/5 p-4">
                    <p className="text-sm text-muted-foreground w-full sm:w-auto sm:flex-1">
                      Charge estimate for{" "}
                      <span className="font-medium text-foreground">
                        {getChargeEstimateUserTypeLabel(chargeEstimateUserType)}
                      </span>
                      . Export a PDF or return to the equipment page to book.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={exportingChargePdf}
                      onClick={() => void handleExportChargeEstimatePdf()}
                    >
                      {exportingChargePdf ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Exporting…
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-2" />
                          Export as PDF
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate(`/equipment/${selectedEquipment.id}`)}
                    >
                      Back to equipment
                    </Button>
                  </div>
                )}

                {/* Step 3: Slot Selection (only shown after charge calculation) */}
                {showSlots && chargeCalculated && !isProformaFlow && !isCalculateChargesFlow && (
                  <>
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">Step 3: Select Time Slots</h3>
                        <div className="flex items-center gap-3">
                          <Label htmlFor="auto-slot-selection" className="text-sm font-normal cursor-pointer">
                            Auto-select all required slots
                          </Label>
                          <Switch
                            id="auto-slot-selection"
                            checked={autoSlotSelection}
                            onCheckedChange={(checked) => {
                              setAutoSlotSelection(checked);
                              // If enabling auto selection and no slots are selected, trigger auto-selection
                              if (checked && selectedSlots.length === 0 && calculatedCharge && equipmentDetail?.daily_slots) {
                                // This will be handled by the useEffect that watches autoSlotSelection
                              }
                            }}
                          />
                        </div>
                      </div>
                      {autoSlotSelection && (
                        <p className="text-sm text-muted-foreground mb-2">
                          When enabled, the system will automatically select all required consecutive slots. 
                          {equipmentDetail?.split_booking_enabled 
                            ? " If consecutive slots aren't available, random slots will be selected."
                            : " Only consecutive slots will be selected (non-consecutive selection is not allowed)."}
                        </p>
                      )}
                    </div>

                {/* Week nav + grid: full overlay until API data matches visible week (avoids misleading stale grid when changing weeks, e.g. urgent extension). */}
                <div className="relative rounded-lg border border-border/70 bg-muted/30 dark:bg-muted/10 p-4 sm:p-6 min-h-[min(520px,70vh)]">
                  {isSlotsWeekViewLoading && (
                    <div
                      className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 rounded-lg bg-background/95 dark:bg-background/95 backdrop-blur-sm px-6 py-10"
                      aria-busy="true"
                      aria-live="polite"
                    >
                      <Loader2 className="h-10 w-10 animate-spin text-primary shrink-0" />
                      <p className="text-sm font-medium text-foreground text-center max-w-md">
                        Loading slot availability for this week…
                      </p>
                      <p className="text-xs text-muted-foreground text-center max-w-md">
                        Please wait until all cells show the correct status.
                      </p>
                      <Progress
                        value={100}
                        className="h-2 w-full max-w-md [&>div]:w-full [&>div]:animate-pulse [&>div]:origin-left"
                      />
                    </div>
                  )}

                {debugSlots && (
                  <div className="mb-5 rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
                    <div className="font-semibold mb-1">Slot debug (Step 3)</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                      <div><span className="font-medium">equipment</span>: {selectedEquipment?.id ?? "—"}</div>
                      <div><span className="font-medium">adminManageMode</span>: {adminManageMode ?? "—"}</div>
                      <div><span className="font-medium">currentWeekStart</span>: {format(startOfWeek(currentWeekStart, { weekStartsOn: 1 }), "yyyy-MM-dd")}</div>
                      <div><span className="font-medium">step3WeekKey</span>: {step3WeekKey}</div>
                      <div><span className="font-medium">lastFetchedWeek</span>: {lastFetchedWeek ?? "—"}</div>
                      <div><span className="font-medium">loadingSlots</span>: {String(loadingSlots)}</div>
                      <div><span className="font-medium">daily_slots</span>: {(equipmentDetail?.daily_slots?.length ?? 0)}</div>
                      <div><span className="font-medium">slot_master_times</span>: {(equipmentDetail?.slot_master_times?.length ?? 0)}</div>
                      <div><span className="font-medium">weekly_holidays</span>: {Object.keys(equipmentDetail?.weekly_holidays ?? {}).length}</div>
                      <div><span className="font-medium">slot_window_min/max</span>: {equipmentDetail?.slot_window_min_date ?? "—"} / {equipmentDetail?.slot_window_max_date ?? "—"}</div>
                      <div><span className="font-medium">ref weekday/time</span>: {equipmentDetail?.slot_window_reference_weekday ?? "—"} / {equipmentDetail?.slot_window_reference_time ?? "—"}</div>
                      <div><span className="font-medium">profile_type</span>: {equipmentDetail?.profile_type ?? "—"}</div>
                      <div><span className="font-medium">urgentWeekExtension</span>: {String(isUrgentHoldMode)}</div>
                    </div>
                    <div className="mt-2 text-xs text-amber-900/80 dark:text-amber-100/80">
                      Tip: open with <span className="font-mono">?debug_slots=1</span> to see this panel.
                    </div>
                  </div>
                )}

                {/* Week Navigation */}
                <div className="flex justify-between items-center mb-6">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={goToPreviousWeek}
                    disabled={!canGoToPreviousWeek()}
                  >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Previous Week
                  </Button>
                  <div className="text-center">
                    <span className="font-semibold">
                      {format(currentWeekStart, "MMM dd")} - {format(addDays(currentWeekStart, 6), "MMM dd, yyyy")}
                    </span>
                    {isAdminOrOIC() && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Available: Any week (no restriction)
                      </p>
                    )}
                    {userType && !isAdminOrOIC() && (normalizeUserType(userType) === 'student' || normalizeUserType(userType) === 'faculty') && (() => {
                      const maxStr = equipmentDetail?.slot_window_max_date;
                      const currentWeek = startOfWeek(new Date(), { weekStartsOn: 1 });
                      const nextWeekSun = addDays(addWeeks(currentWeek, 1), 6);
                      const nextWeekAvailable = !maxStr || parseISO(maxStr) >= nextWeekSun;
                      const refWeekday = equipmentDetail?.slot_window_reference_weekday;
                      const refTime = equipmentDetail?.slot_window_reference_time;
                      if (!nextWeekAvailable && refWeekday != null && refTime != null) {
                        const refText = formatSlotWindowReference(Number(refWeekday), String(refTime));
                        return (
                          <p className="text-sm font-semibold text-primary mt-1 bg-primary/10 px-2 py-1.5 rounded-md">
                            Available: Current week only. New slots after {refText}.
                          </p>
                        );
                      }
                      return (
                        <p className="text-sm font-semibold text-primary mt-1 bg-primary/10 px-2 py-1.5 rounded-md">
                          Available: {nextWeekAvailable ? "Current week and next week only" : "Current week only"}
                        </p>
                      );
                    })()}
                    {userType && !isAdminOrOIC() && normalizeUserType(userType) !== 'student' && normalizeUserType(userType) !== 'faculty' && (() => {
                      const minStr = equipmentDetail?.slot_window_min_date;
                      const maxStr = equipmentDetail?.slot_window_max_date;
                      if (minStr && maxStr) {
                        try {
                          return (
                            <p className="text-xs text-muted-foreground mt-1">
                              Available: {format(parseISO(minStr), "MMM d")} – {format(parseISO(maxStr), "MMM d, yyyy")}
                            </p>
                          );
                        } catch {
                          /* fall through */
                        }
                      }
                      return (
                        <p className="text-xs text-muted-foreground mt-1">
                          Available: Dates within the equipment booking window from the server
                        </p>
                      );
                    })()}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={goToNextWeek}
                    disabled={!canGoToNextWeek()}
                  >
                    Next Week
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>

                {/* Slot Grid */}
                {(() => {
                  return (
                <div className="overflow-x-auto relative">
                  <div className="min-w-[800px]">
                    {/* Header with days */}
                    <div className="grid grid-cols-8 gap-2 mb-2">
                      <div className="font-semibold text-sm p-2">
                        {getEffectiveWeeklyViewDisplay() === "SLOT_ID" ? "Slot position" : "Time"}
                      </div>
                      {[0, 1, 2, 3, 4, 5, 6].map((dayOffset) => {
                        const day = addDays(currentWeekStart, dayOffset);
                        return (
                          <div key={dayOffset} className="font-semibold text-sm p-2 text-center">
                            <div>{format(day, "EEE")}</div>
                            <div className="text-muted-foreground">{format(day, "MMM dd")}</div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Time slots - use Slot Master open_time values (user-defined), else derive from slots */}
                    {(() => {
                      const rowKeysAndLabels = getWeeklyRowKeysAndLabels();
                      const rowKeys = rowKeysAndLabels.map((r) => r.key);
                      const hasSlotsFromApi = (equipmentDetail?.daily_slots?.length ?? 0) > 0;
                      const fetchedButEmpty = !loadingSlots && lastFetchedWeek && !hasSlotsFromApi;

                      if (rowKeys.length === 0) {
                        return (
                          <div className="col-span-8 p-4 text-center text-muted-foreground">
                            <p>No time slots available for this equipment.</p>
                            {equipmentDetail?.daily_slots && equipmentDetail.daily_slots.length > 0 && (
                              <p className="text-xs mt-2">
                                Found {equipmentDetail.daily_slots.length} slots in API response.
                                Try navigating to a different week.
                              </p>
                            )}
                          </div>
                        );
                      }

                      const emptyWeekNotice = fetchedButEmpty ? (() => {
                        const waitlistDepth = Number(equipmentDetail?.waitlist_queue_depth || 0);
                        const waitlistCount = Number(equipmentDetail?.waitlist_current_count || 0);
                        const waitlistHasRoom = !!equipmentDetail?.waitlist_has_room;
                        const maxDateStr = equipmentDetail?.slot_window_max_date ?? null;
                        const refWeekday = equipmentDetail?.slot_window_reference_weekday;
                        const refTime = equipmentDetail?.slot_window_reference_time;
                        const now = new Date();
                        const currentWeek = startOfWeek(now, { weekStartsOn: 1 });
                        const nextWeek = addWeeks(currentWeek, 1);
                        const nextWeekSunday = addDays(nextWeek, 6);
                        const nextWeekAvailable = maxDateStr ? parseISO(maxDateStr) >= nextWeekSunday : true;
                        const showStayTuned = !nextWeekAvailable && refWeekday != null && refTime != null;

                        if (showStayTuned) {
                          const refText = formatSlotWindowReference(Number(refWeekday), String(refTime));
                          return (
                            <div className="col-span-8 flex flex-col items-center justify-center py-12 px-4 text-center">
                              <div className="max-w-md space-y-4">
                                <p className="text-muted-foreground text-sm leading-relaxed">
                                  No slots available for this week.
                                </p>
                                <div className="rounded-lg border bg-muted/40 px-5 py-4">
                                  <p className="text-sm font-medium text-foreground">
                                    New slots will be available after {refText}.
                                  </p>
                                  <p className="text-muted-foreground text-sm mt-1">
                                    Till then, stay tuned.
                                  </p>
                                </div>
                                {waitlistDepth > 0 && !hasBookableSlotInSelectedWeek && !bookingAsExternalTarget && (
                                  <div className="rounded-lg border bg-background px-5 py-4">
                                    {waitlistHasRoom ? (
                                      <>
                                        <p className="text-sm text-foreground">No slots are available now. You can place this request in waitlist queue.</p>
                                        <p className="text-xs text-muted-foreground mt-1">Queue: {waitlistCount}/{waitlistDepth}</p>
                                        <Button className="mt-3" size="sm" onClick={() => setWaitlistIntentMode(true)}>Go for Waitlisted Booking</Button>
                                      </>
                                    ) : (
                                      <p className="text-sm font-medium text-destructive">Booking unsuccessful. No more room in the waitlist queue.</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div className="col-span-8 p-4 text-center text-muted-foreground">
                            <p>No slots available for this week.</p>
                            <p className="text-xs mt-2">
                              {nextWeekAvailable
                                ? "Try the next week using the button above."
                                : "Try another week using the buttons above, or contact support if the issue continues."}
                            </p>
                            {Number(equipmentDetail?.waitlist_queue_depth || 0) > 0 && !hasBookableSlotInSelectedWeek && !bookingAsExternalTarget && (
                              <div className="mt-3">
                                {equipmentDetail?.waitlist_has_room ? (
                                  <Button size="sm" onClick={() => setWaitlistIntentMode(true)}>Go for Waitlisted Booking</Button>
                                ) : (
                                  <p className="text-sm font-medium text-destructive">Booking unsuccessful. No more room in the waitlist queue.</p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })() : null;

                      const handleSlotGridGuardPointerDown = (e: React.PointerEvent) => {
                        if (!autoSlotSelection || !chargeCalculated || !showSlots) return;
                        if (loadingSlots || isSlotsWeekViewLoading) return;
                        e.preventDefault();
                        e.stopPropagation();
                        setAutoSlotGuardPending("calendar");
                        setAutoSlotGuardDialogOpen(true);
                      };
                      
                      const rows = rowKeys.map((rowKey, rowIndex) => {
                      const rowLabel = rowKeysAndLabels[rowIndex]?.label ?? rowKey;
                      const time = rowKey;
                      return (
                      <div key={rowKey} className="grid grid-cols-8 gap-2 mb-2">
                        <div className="text-sm p-2 font-medium flex items-center">
                          {rowLabel}
                        </div>
                        <div
                          className="col-span-7 grid grid-cols-7 gap-2"
                          onPointerDownCapture={handleSlotGridGuardPointerDown}
                        >
                        {[0, 1, 2, 3, 4, 5, 6].map((dayOffset) => {
                          const day = addDays(currentWeekStart, dayOffset);
                          const isBooked = isSlotBooked(day, time);
                          const isSelected = isSlotSelected(day, time);
                          
                          // Check if slot exists in daily_slots for this day and row key (time or slot_number)
                          const slotData = useWeeklySlots() ? getSlotData(day, time) : undefined;
                          const slotExists = slotData !== undefined;
                          // Past: use slot start datetime when available; else parse time "HH:mm" for TIME mode
                          const isPast = slotData?.start_datetime
                            ? parseISO(slotData.start_datetime) < new Date()
                            : (time.includes(":")
                              ? (() => { const [h, m] = time.split(":").map(Number); const d = new Date(day); d.setHours(h, m || 0, 0, 0); return d < new Date(); })()
                              : false);
                          
                          // Get slot status from the actual slot data; prefer booking status if booking exists, else slot status (never empty when slot exists)
                          const slotStatus = slotData?.status ?? "";
                          const slotStatusUpper = String(slotStatus || "").toUpperCase();
                          
                          // Only truly bookable/green when API slot status is AVAILABLE.
                          // (Weekend/holiday "NOT_AVAILABLE" rows still exist but must not be treated as available.)
                          const isAvailable = slotExists && !isBooked && !isPast && slotStatusUpper === "AVAILABLE";
                          const isSlotBookedStatus = slotStatus !== "" && slotStatus !== "AVAILABLE";
                          const dateStr = format(day, "yyyy-MM-dd");
                          const dayOfWeekJs = day.getDay();
                          const isSaturdayCol = dayOfWeekJs === 6;
                          const isSundayCol = dayOfWeekJs === 0;
                          const rawHoliday = equipmentDetail?.weekly_holidays?.[dateStr];
                          const holidayLabel = typeof rawHoliday === "string" ? rawHoliday : (rawHoliday && typeof rawHoliday === "object" && "label" in rawHoliday ? (rawHoliday as { label: string }).label : undefined);
                          const holidayColor = typeof rawHoliday === "object" && rawHoliday !== null && "color" in rawHoliday && (rawHoliday as { color?: string }).color
                            ? (rawHoliday as { color: string }).color
                            : undefined;
                          const holidayName = holidayLabel;
                          const hasBookedStatus = slotStatus === "BOOKED" || slotStatus === "BOOKING_NOT_UTILIZED";
                          // Use booking metadata only for genuinely booked slot statuses.
                          const bookingStatusDisplay = hasBookedStatus ? (slotData?.booking_status_display ?? null) : null;
                          const bookingId = hasBookedStatus ? (slotData?.booking_id ?? null) : null;
                          // Admin: only BOOKED slots are non-selectable; other statuses (BLOCKED, weekend/holiday) are bookable
                          const isActuallyBooked = hasBookedStatus;
                          const considerBooked = isAdminOrOIC() ? isActuallyBooked : (isSlotBookedStatus || isBooked || hasBookedStatus);
                          /** External: show real slot status/colors unless the cell is still default closed (NOT_AVAILABLE) on Sat/Sun/holiday. */
                          const externalCalendarAdminOverride =
                            slotBookableByExternalUser(slotData) ||
                            (slotStatusUpper !== "" && slotStatusUpper !== "NOT_AVAILABLE");
                          /** External: Sat/Sun/holidays use admin calendar styling when slot is still “closed” (e.g. NOT_AVAILABLE), not when overridden above. */
                          const externalCalendarDayOverlay =
                            isExternalUser &&
                            slotExists &&
                            !isSelected &&
                            (rawHoliday || isSaturdayCol || isSundayCol) &&
                            !externalCalendarAdminOverride;
                          const blockedLabel = slotData?.blocked_label ?? null;
                          
                          // Build status label with special handling for BLOCKED and BOOKED
                          let rawSlotStatusLabel = slotData?.status_display || "";
                          if (!rawSlotStatusLabel && slotStatus) {
                            const statusMap: Record<string, string> = {
                              "AVAILABLE": "Available",
                              "NOT_AVAILABLE": "Not Available",
                              "BOOKED": "Booked",
                              "BLOCKED": "Other Reasons",
                              "UNDER_MAINTENANCE": "Under Maintenance",
                              "OPERATOR_ABSENT": "Operator Absent",
                              "BOOKING_NOT_UTILIZED": "Booking Not Utilized"
                            };
                            rawSlotStatusLabel = statusMap[slotStatus] || slotStatus.charAt(0).toUpperCase() + slotStatus.slice(1).toLowerCase();
                          }
                          
                          // For BOOKED status, append booking ID if available
                          let slotStatusLabel = rawSlotStatusLabel;
                          if (slotStatus === "BOOKED" && bookingId) {
                            slotStatusLabel = `${rawSlotStatusLabel} #${bookingId}`;
                          }
                          
                          // For BLOCKED status, use blocked_label if available, otherwise show "Other Reasons"
                          if (slotStatus === "BLOCKED") {
                            slotStatusLabel = blockedLabel || "Other Reasons";
                          }
                          
                          const slotDisplayLabel = bookingStatusDisplay || slotStatusLabel;

                          // Slot selection rules: (a) required <= one slot → single slot; (b) required > one slot → multiple until covered; (c) 10% tail allowed
                          const totalMinutes = calculatedCharge?.total_time_minutes ?? 0;
                          const currentSelectedMinutes = calculatedCharge
                            ? selectedSlots.reduce((sum, s) => sum + getSlotDurationMinutes(s), 0)
                            : 0;
                          const thisSlotDuration = slotData?.start_datetime && slotData?.end_datetime
                            ? Math.round((parseISO(slotData.end_datetime).getTime() - parseISO(slotData.start_datetime).getTime()) / (1000 * 60))
                            : (equipmentDetail?.slot_duration_minutes || 60);
                          const oneSlotRef = selectedSlots.length > 0 ? getSlotDurationMinutes(selectedSlots[0]) : thisSlotDuration;
                          const tenPercentSlot = 0.1 * oneSlotRef;

                          const limitReached = calculatedCharge
                            ? (totalMinutes <= oneSlotRef ? selectedSlots.length >= 1 : currentSelectedMinutes >= totalMinutes)
                            : false;
                          // Calculate remaining time to determine if we should allow another slot
                          const remainingMinutes = calculatedCharge 
                            ? Math.max(0, totalMinutes - currentSelectedMinutes)
                            : 0;
                          // Allow selecting another slot if remaining time exceeds 10% of one slot
                          const shouldAllowSlot = calculatedCharge && totalMinutes > oneSlotRef
                            ? remainingMinutes > tenPercentSlot
                            : false;
                          const wouldExceedLimit = calculatedCharge && !isSelected && !isBooked && !isPast && slotExists
                            ? (totalMinutes <= oneSlotRef)
                              ? selectedSlots.length >= 1
                              : !shouldAllowSlot // Disable if remaining time is within 10% variance
                            : false;
                          
                          // Check if slot is consecutive to selected slots
                          const testSlot: TimeSlot = {
                            date: day,
                            time,
                            isBooked: false,
                            slotId: slotData?.id,
                            slotData: slotData,
                          };
                          const isConsecutive = selectedSlots.length === 0 || isConsecutiveSlot(testSlot, selectedSlots);
                          const notConsecutive = selectedSlots.length > 0 && !isSelected && !isConsecutive;
                          
                          // Disable if charge not calculated
                          const chargeNotCalculated = !calculatedCharge;
                          
                          // Determine the actual status to display: booking status > holiday name > slot status (never N/A)
                          // If slot exists on holiday/Saturday/Sunday and has booking, show BOOKED status
                          let displayStatus = holidayName || "—";
                          let isDisabled = true;
                          
                          if (slotExists) {
                            // Priority: Show booking status if slot has booking (even on holidays/Saturday/Sunday). Admin: only BOOKED is non-selectable; admin can book past/weekend/holiday.
                            if (considerBooked) {
                              // Holiday clarity: when the slot is closed due to a holiday/weekend (NOT_AVAILABLE),
                              // show the holiday name instead of the generic status label.
                              if (holidayName && slotStatusUpper === "NOT_AVAILABLE") {
                                displayStatus = holidayName;
                              } else {
                                displayStatus = slotDisplayLabel || slotStatusLabel || "Unavailable";
                              }
                              isDisabled = true;
                            } else if (isSelected) {
                              displayStatus = "Selected";
                              isDisabled = false; // Allow deselecting
                            } else if (isPast) {
                              displayStatus = considerBooked ? (slotDisplayLabel || slotStatusLabel || "Unavailable") : "No Booking";
                              isDisabled = !isAdminOrOIC();
                            } else if (
                              slotData &&
                              !isAdminOrOIC() &&
                              !isDailySlotSelectableForUserBooking(slotData)
                            ) {
                              // Home / non-home department holds: blocked for this user → grey Not Available
                              displayStatus = "Not Available";
                              isDisabled = true;
                            } else if (chargeNotCalculated) {
                              displayStatus = slotDisplayLabel || slotStatusLabel || "—";
                              isDisabled = true;
                            } else if (notConsecutive) {
                              displayStatus = "Available";
                              isDisabled = true;
                            } else if (limitReached || wouldExceedLimit) {
                              displayStatus = "Available";
                              isDisabled = true;
                            } else {
                              displayStatus = "Available";
                              isDisabled = false;
                            }
                          } else {
                            displayStatus = holidayName || "—";
                          }

                          const deptBlockedForUser =
                            Boolean(slotExists) &&
                            Boolean(slotData) &&
                            !isAdminOrOIC() &&
                            !considerBooked &&
                            !isSelected &&
                            !isDailySlotSelectableForUserBooking(slotData!);

                          // Sat/Sun/holidays: use calendar slot-status colors when the cell has a real slot row,
                          // except external users on closed weekend/holiday (NOT_AVAILABLE) — keep admin weekend/holiday styling.
                          const statusOverridesHolidayBg =
                            slotExists &&
                            (!isExternalUser ||
                              (slotData != null && slotBookableByExternalUser(slotData)) ||
                              (isExternalUser
                                ? externalCalendarAdminOverride
                                : slotStatusUpper !== "AVAILABLE"));
                          const useHolidayBg = Boolean(
                            holidayColor &&
                            !isSelected &&
                            !considerBooked &&
                            !statusOverridesHolidayBg &&
                            (!isExternalUser || !slotExists || rawHoliday)
                          );
                          const isWeekendCell = !slotExists && (dayOfWeekJs === 6 || dayOfWeekJs === 0);

                          // Admin-configured calendar colors: merge with full defaults so every slot status has a color
                          const defaultSlotColors: Record<string, string> = {
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
                          const slotColors = {
                            ...defaultSlotColors,
                            ...(equipmentDetail?.calendar_colors?.slot_colors || {}),
                          };
                          // Use exact values from /calendar-colors; only fallback when missing (so weekend matches admin selection)
                          const holidayDefault = equipmentDetail?.calendar_colors?.holiday_default || "#f59e0b";
                          const saturdayColor = equipmentDetail?.calendar_colors?.saturday_color || "#c7d2fe";
                          const sundayColor = equipmentDetail?.calendar_colors?.sunday_color || "#fbcfe8";
                          let cellStyle: CSSProperties | undefined;
                          // Closed calendar days (holiday / Sat / Sun) should always use the calendar-day colors
                          // from `/calendar-colors` when the slot is still the default "closed" NOT_AVAILABLE.
                          const isClosedCalendarDay =
                            !isSelected &&
                            slotExists &&
                            slotStatusUpper === "NOT_AVAILABLE" &&
                            Boolean(rawHoliday || isSaturdayCol || isSundayCol);
                          if (useHolidayBg && holidayColor && !isWeekendCell) {
                            cellStyle = { backgroundColor: holidayColor, color: getContrastTextColor(holidayColor) };
                          } else if (isSelected) {
                            cellStyle = undefined; // use Tailwind primary
                          } else if (isClosedCalendarDay) {
                            const bg =
                              rawHoliday && holidayColor
                                ? holidayColor
                                : (isSaturdayCol ? saturdayColor : isSundayCol ? sundayColor : holidayDefault);
                            cellStyle = { backgroundColor: bg, color: getContrastTextColor(bg) };
                          } else if (slotExists) {
                            // Multi-mode overlay (exclusive parent / child outside schedule)
                            if (slotData?.mode_overlay_color) {
                              const bg = slotData.mode_overlay_color;
                              cellStyle = { backgroundColor: bg, color: getContrastTextColor(bg) };
                            } else {
                            // Use calendar-colors by status_display / status when applicable
                            let statusForColor = slotStatus;
                            if (slotData?.status_display === "Reserved for other departments") {
                              statusForColor = "NON_HOME_RESERVED";
                            } else if (slotData?.status_display === "Home department only") {
                              statusForColor = "HOME_DEPARTMENT_ONLY";
                            } else if (slotData?.status_display === "Available (all departments)") {
                              statusForColor = "AVAILABLE";
                            } else if (slotData?.home_department_only) {
                              statusForColor = "NON_HOME_RESERVED";
                            }
                            else if (slotStatus === "NOT_AVAILABLE") statusForColor = "NOT_AVAILABLE";
                            else if (slotStatus === "BOOKED" && slotData?.booking_status) statusForColor = String(slotData.booking_status).toUpperCase();
                            const status = statusForColor || "AVAILABLE";
                            const bg = slotColors[status] ?? (considerBooked ? slotColors.BOOKED : slotColors.AVAILABLE);
                            if (isPast && !isAdminOrOIC()) {
                              cellStyle = { backgroundColor: "#94a3b8", color: "#ffffff" };
                            } else {
                              cellStyle = { backgroundColor: bg, color: getContrastTextColor(bg) };
                            }
                            }
                          } else {
                            // No slot (weekend/holiday): always use admin-configured weekend colors for Sat/Sun so they match /calendar-colors
                            const bg = dayOfWeekJs === 6 ? saturdayColor : dayOfWeekJs === 0 ? sundayColor : (holidayColor || holidayDefault);
                            cellStyle = { backgroundColor: bg, color: getContrastTextColor(bg) };
                          }

                          if (externalCalendarDayOverlay) {
                            displayStatus =
                              holidayName || (isSaturdayCol ? "Saturday" : isSundayCol ? "Sunday" : "—");
                            isDisabled = true;
                            if (holidayColor) {
                              cellStyle = {
                                backgroundColor: holidayColor,
                                color: getContrastTextColor(holidayColor),
                              };
                            } else if (isSaturdayCol) {
                              cellStyle = {
                                backgroundColor: saturdayColor,
                                color: getContrastTextColor(saturdayColor),
                              };
                            } else if (isSundayCol) {
                              cellStyle = {
                                backgroundColor: sundayColor,
                                color: getContrastTextColor(sundayColor),
                              };
                            } else {
                              cellStyle = {
                                backgroundColor: holidayDefault,
                                color: getContrastTextColor(holidayDefault),
                              };
                            }
                          } else if (deptBlockedForUser) {
                            const naBg = slotColors.NOT_AVAILABLE || "#e2e8f0";
                            displayStatus = "Not Available";
                            isDisabled = true;
                            cellStyle = { backgroundColor: naBg, color: getContrastTextColor(naBg) };
                          }

                          return (
                            <button
                              key={dayOffset}
                              onClick={() => {
                                // Double-check disabled state before allowing toggle
                                if (isDisabled) {
                                  if (notConsecutive) {
                                    toast.error("Please select consecutive slots only. You can select slots that are immediately before or after your current selection.");
                                  } else if (limitReached) {
                                    toast.error(`You have reached the maximum allowed time (${calculatedCharge?.total_time_minutes || 0} minutes).`);
                                  } else if (wouldExceedLimit) {
                                    const remaining = getRemainingMinutes();
                                    toast.error(`Cannot select more slots. Only ${remaining} minutes remaining.`);
                                  }
                                  return;
                                }
                                toggleSlot(day, time);
                              }}
                              disabled={isDisabled}
                              className={`
                                p-3 rounded-md text-sm transition-all min-h-[48px] flex items-center justify-center font-medium border-2 border-white/50 shadow-sm
                                ${!slotExists ? 'cursor-not-allowed' : ''}
                                ${considerBooked ? 'cursor-not-allowed' : ''}
                                ${isPast && !considerBooked && slotExists && !isAdminOrOIC() ? 'cursor-not-allowed' : ''}
                                ${isSelected ? 'bg-primary text-primary-foreground' : ''}
                                ${(isAvailable || (isAdminOrOIC() && slotExists && !considerBooked)) && !isSelected && !isDisabled ? 'cursor-pointer hover:opacity-90' : ''}
                                ${(isAvailable || (isAdminOrOIC() && slotExists && !considerBooked)) && !isSelected && isDisabled ? 'cursor-not-allowed opacity-60' : ''}
                              `}
                              style={cellStyle}
                            >
                              {displayStatus}
                            </button>
                          );
                        })}
                        </div>
                      </div>
                      ); });

                      return emptyWeekNotice ? (
                        <>
                          {emptyWeekNotice}
                          {rows}
                        </>
                      ) : (
                        rows
                      );
                    })()}
                  </div>
                </div>
                  );
                })()}
                </div>

                    {/* Booking Summary */}
                    {selectedSlots.length > 0 && (
                      <div className="mt-6 p-4 bg-muted rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium">Selected Slots: {selectedSlots.length}</span>
                          <span className="text-sm text-muted-foreground">
                            {calculatedCharge ? (
                              <>
                                {getEffectiveSelectedMinutes()} minutes / {calculatedCharge.total_time_minutes} minutes
                              </>
                            ) : (
                              <>Total Hours: {selectedSlots.length}</>
                            )}
                          </span>
                        </div>
                        {calculatedCharge && (
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-muted-foreground">Remaining:</span>
                            <span className={`text-sm font-medium ${getRemainingMinutes() === 0 ? 'text-destructive' : ''}`}>
                              {getRemainingMinutes()} minutes
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Total Cost</span>
                          <span className="text-2xl font-bold">
                            {formatINR(
                              calculatedCharge
                                ? calculatedCharge.total_charge
                                : calculateTotalCost()
                            )}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Booking options — internal users only; external users book selected slots or get an unsuccessful result (no waitlist). */}
                    {!bookingAsExternalTarget && (
                    <div className="mt-6 rounded-xl border border-border/80 bg-muted/30 dark:bg-muted/20 p-4 space-y-4">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-muted-foreground shrink-0" />
                        <p className="text-sm font-medium text-foreground">Booking options</p>
                      </div>
                      <div className="space-y-3">
                        {Number(equipmentDetail?.waitlist_queue_depth || 0) > 0 && !hasBookableSlotInSelectedWeek ? (
                          <>
                            <label className="flex items-start gap-3 cursor-pointer group rounded-lg p-3 border border-transparent hover:bg-background/50 hover:border-border/60 transition-colors">
                              <Checkbox
                                id="waitlisted-booking"
                                checked={waitlistIntentMode}
                                onCheckedChange={(c) => setWaitlistIntentMode(c === true)}
                                className="mt-0.5 h-4 w-4"
                              />
                              <span className="text-sm text-foreground group-hover:text-foreground">
                                Waitlisted Booking
                              </span>
                            </label>
                            <p className="text-xs text-muted-foreground pl-7">
                              Shown only when no bookable slots exist in the selected week for your user type. If your booking cannot be completed, your request can be added to the waitlist queue (if space is available). Turn off to see booking failure without waitlisting.
                            </p>
                          </>
                        ) : null}
                        {hasBookableSlotInSelectedWeek ? (
                          <>
                            <label className="flex items-start gap-3 cursor-pointer group rounded-lg p-3 border border-transparent hover:bg-background/50 hover:border-border/60 transition-colors">
                              <Checkbox
                                id="book-any-available-slots"
                                checked={bookAnyAvailableSlots}
                                onCheckedChange={(c) => {
                                  const v = c === true;
                                  setBookAnyAvailableSlots(v);
                                  if (!v) setBookEvenIfSingleSlotAvailable(false);
                                }}
                                className="mt-0.5 h-4 w-4"
                              />
                              <span className="text-sm text-foreground group-hover:text-foreground">
                                Book any available slots
                              </span>
                            </label>
                            <p className="text-xs text-muted-foreground pl-7">First priority: book your required slots and duration. If selected slots are unavailable, the system will auto-select available slots in this window (in time order, even if not consecutive) until your required duration is covered.</p>
                            {bookAnyAvailableSlots && (
                              <>
                                <label className="flex items-start gap-3 cursor-pointer group rounded-lg p-3 border border-transparent hover:bg-background/50 hover:border-border/60 transition-colors">
                                  <Checkbox
                                    id="book-even-if-single-slot-available"
                                    checked={bookEvenIfSingleSlotAvailable}
                                    onCheckedChange={(c) => setBookEvenIfSingleSlotAvailable(c === true)}
                                    className="mt-0.5 h-4 w-4"
                                  />
                                  <span className="text-sm text-foreground group-hover:text-foreground">
                                    Book even if single slot is available
                                  </span>
                                </label>
                                <p className="text-xs text-muted-foreground pl-7">If required duration cannot be met, book a single available slot and charge accordingly (number of slots/samples adjusted).</p>
                              </>
                            )}
                          </>
                        ) : null}
                      </div>
                    </div>
                    )}

                    {/* Action Buttons */}
                    <div className="mt-6 flex flex-wrap gap-4">
                      {bookingAsExternalTarget &&
                        ((isExternalUser && !istemPortalAcknowledged) ||
                          (isAdminOrOIC() &&
                            adminManageMode === "book" &&
                            Boolean(adminBookForUserId) &&
                            adminTargetIstemAcknowledged !== true)) && (
                        <div className="w-full rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-950 dark:text-amber-100 space-y-2">
                          <p className="font-medium">I-STEM portal registration required</p>
                          <p>
                            External bookings must be aligned with the national I-STEM portal (
                            <a
                              href="https://www.istem.gov.in/"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline font-medium text-primary"
                            >
                              https://www.istem.gov.in/
                            </a>
                            ). The booking user must open <strong>Profile</strong>, confirm they are registered on I-STEM, and save — then booking can proceed.
                          </p>
                        </div>
                      )}
                      {!selectedEquipmentIsOperational && selectedEquipment ? (
                        <div className="w-full rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-900 dark:text-amber-100">
                          Booking is disabled while equipment is{" "}
                          <span className="font-semibold">
                            {String((selectedEquipment as any)?.status_display || (selectedEquipment as any)?.status || "Not Operational")}
                          </span>
                          .
                        </div>
                      ) : null}
                      <Button
                        variant="outline"
                        className="flex-1 min-w-[140px]"
                        onClick={() => {
                          if (autoSlotSelection && selectedSlots.length > 0) {
                            setAutoSlotGuardPending("clear");
                            setAutoSlotGuardDialogOpen(true);
                            return;
                          }
                          setSelectedSlots([]);
                        }}
                        disabled={selectedSlots.length === 0 && !waitlistIntentEffective}
                      >
                        Clear Selection
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 min-w-[140px]"
                        onClick={() => navigate("/equipments")}
                      >
                        Book another equipment
                      </Button>
                      <Button
                        className="flex-1 min-w-[140px]"
                        onClick={handleBooking}
                        disabled={!selectedEquipmentIsOperational || (selectedSlots.length === 0 && !waitlistIntentEffective) || isSubmittingBooking}
                      >
                        {isSubmittingBooking ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Confirming…
                          </>
                        ) : (
                          <>
                            {isUrgentHoldMode
                              ? ((["my-urgent-requests", "urgent-requests-wallet", "dashboard"].includes(
                                    searchParams.get("return_to") || ""
                                  ))
                                  ? <>Hold slots and return ({selectedSlots.length} slot{selectedSlots.length !== 1 ? "s" : ""})</>
                                  : <>Submit Request ({selectedSlots.length} slot{selectedSlots.length !== 1 ? "s" : ""})</>)
                              : (waitlistIntentEffective && selectedSlots.length === 0
                                  ? <>Confirm Waitlisted Booking</>
                                  : <>Confirm Booking ({selectedSlots.length} slot{selectedSlots.length !== 1 ? "s" : ""})</>)}
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Urgent booking request dialog (internal users) */}
        <Dialog
          open={autoSlotGuardDialogOpen}
          onOpenChange={(open) => {
            setAutoSlotGuardDialogOpen(open);
            if (!open) setAutoSlotGuardPending(null);
          }}
        >
          <DialogContent className="sm:max-w-md" onPointerDown={(ev) => ev.stopPropagation()}>
            <DialogHeader>
              <DialogTitle>Auto-select is on</DialogTitle>
              <DialogDescription className="text-left space-y-2">
                <span className="block">
                  &quot;Auto-select all required slots&quot; is enabled, so the calendar in <span className="font-medium text-foreground">Select Time Slots</span> is filled automatically for your required duration.
                </span>
                <span className="block">
                  To clear your selection or tap the calendar yourself, turn off auto-select first.
                </span>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAutoSlotGuardDialogOpen(false);
                  setAutoSlotGuardPending(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  const pending = autoSlotGuardPending;
                  setAutoSlotSelection(false);
                  setAutoSlotGuardDialogOpen(false);
                  setAutoSlotGuardPending(null);
                  if (pending === "clear") {
                    setSelectedSlots([]);
                  }
                }}
              >
                Turn off auto-select
                {autoSlotGuardPending === "clear" ? " and clear" : ""}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={urgentDialogOpen} onOpenChange={(open) => {
          setUrgentDialogOpen(open);
          if (!open) {
            setPendingHoldSelection(null);
            setUrgentRequestType('NO_SLOT');
            setUrgentDisclaimerAccepted(false);
            urgentDisclaimerAcceptedRef.current = false;
            setUrgentEvidenceFile(null);
            setUrgentReviewerComment("");
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col text-base">
            {(() => {
              const noSlotNoAttempts = urgentRequestType === 'NO_SLOT' && !myUnsuccessfulAttemptsLoading && myUnsuccessfulAttempts.length === 0;
              return (
            <>
            <DialogHeader className="shrink-0 pb-2">
              <DialogTitle className="text-xl font-semibold tracking-tight">Request urgent booking</DialogTitle>
              <DialogDescription className="text-base text-muted-foreground">
                Choose the reason. Your request will be reviewed as per the process.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-5 py-3 overflow-y-auto min-h-0 flex-1">
              <div className="space-y-3">
                <Label className="text-base font-medium">Reason</Label>
                <RadioGroup
                  value={urgentRequestType}
                  onValueChange={(v) => { setUrgentRequestType(v as 'NO_SLOT' | 'REVIEWER_URGENT'); setUrgentDisclaimerAccepted(false); urgentDisclaimerAcceptedRef.current = false; setUrgentEvidenceFile(null); setUrgentReviewerComment(""); }}
                  className="flex flex-col gap-3"
                >
                  <div className="flex items-center space-x-4 rounded-lg border-2 border-border/80 p-4 hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="NO_SLOT" id="urgent-no-slot" className="h-5 w-5" />
                    <Label htmlFor="urgent-no-slot" className="flex-1 cursor-pointer">
                      <span className="font-medium text-base">Unable to get slot despite repeated trials</span>
                      <span className="text-muted-foreground text-sm block mt-0.5">Reviewed by Admin/OIC.</span>
                    </Label>
                  </div>
                  {normalizeUserType(userType) === "faculty" && (
                    <div className="flex items-center space-x-4 rounded-lg border-2 border-border/80 p-4 hover:bg-muted/50 transition-colors">
                      <RadioGroupItem value="REVIEWER_URGENT" id="urgent-reviewer" className="h-5 w-5" />
                      <Label htmlFor="urgent-reviewer" className="flex-1 cursor-pointer">
                        <span className="font-medium text-base">Urgent comment from reviewer</span>
                        <span className="text-muted-foreground text-sm block mt-0.5">Upload evidence; Supervisor then Admin/OIC.</span>
                      </Label>
                    </div>
                  )}
                </RadioGroup>
              </div>

              {selectedEquipment && (
                <div className="flex flex-col gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="default"
                    className="w-full h-10 text-base"
                    disabled={urgentHoldBookingId != null || pendingHoldSelection != null || noSlotNoAttempts}
                    onClick={() => {
                      if (urgentHoldBookingId != null || pendingHoldSelection != null) return;
                      setSearchParams((prev) => {
                        const p = new URLSearchParams(prev);
                        p.set('urgent', '1');
                        return p;
                      });
                      setUrgentDialogOpen(false);
                    }}
                  >
                    Select Slot
                  </Button>
                  <p className="text-sm text-muted-foreground">Pick slot(s) on the calendar, then return here. Slots are held only when you submit below.</p>
                  {urgentHoldBookingId != null && (
                    <p className="text-sm text-green-600 dark:text-green-500 font-medium">Slot held (Booking #{urgentHoldBookingId}).</p>
                  )}
                  {pendingHoldSelection != null && urgentHoldBookingId == null && (
                    <p className="text-sm text-green-600 dark:text-green-500 font-medium">{pendingHoldSelection.slotIds.length} slot(s) selected. Submit below to hold.</p>
                  )}
                </div>
              )}

              {urgentRequestType === 'NO_SLOT' && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-4 border border-border/60">I am unable to get any booking despite repeated trials and my requirement is genuine and urgent.</p>
                  <div className="flex items-center space-x-3">
                    <Checkbox id="urgent-disclaimer" checked={urgentDisclaimerAccepted} onCheckedChange={(c) => { const v = c === true; setUrgentDisclaimerAccepted(v); urgentDisclaimerAcceptedRef.current = v; }} className="h-5 w-5" disabled={noSlotNoAttempts} />
                    <Label htmlFor="urgent-disclaimer" className={`text-base cursor-pointer ${noSlotNoAttempts ? "cursor-not-allowed opacity-60" : ""}`}>I confirm the above.</Label>
                  </div>
                  {selectedEquipment && (
                    <div className="space-y-3 mt-4">
                      <p className="text-base font-medium text-foreground">Your unsuccessful booking attempts for this equipment (past 2 weeks)</p>
                      <p className="text-sm text-muted-foreground">This log is for your reference only. Admin/OIC will review it when processing your request. Submitting an urgent request does not guarantee approval.</p>
                      {myUnsuccessfulAttemptsLoading ? (
                        <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
                      ) : myUnsuccessfulAttempts.length > 0 ? (
                        <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/50 sticky top-0">
                              <tr>
                                <th className="text-left p-3 font-medium">Date</th>
                                <th className="text-left p-3 font-medium">Time</th>
                                <th className="text-left p-3 font-medium">Samples</th>
                                <th className="text-left p-3 font-medium">Slots</th>
                                <th className="text-left p-3 font-medium">Reason</th>
                              </tr>
                            </thead>
                            <tbody>
                              {myUnsuccessfulAttempts.map((e) => {
                                const d = e.requested_at ? new Date(e.requested_at) : null;
                                return (
                                  <tr key={e.id} className="border-t border-border/50">
                                    <td className="p-3">{d ? format(d, "dd MMM yyyy") : "—"}</td>
                                    <td className="p-3">{d ? format(d, "HH:mm:ss") : "—"}</td>
                                    <td className="p-3">{e.number_of_samples}</td>
                                    <td className="p-3">{e.slots_requested}</td>
                                    <td className="p-3 text-muted-foreground max-w-[140px] truncate" title={e.failure_reason}>{e.failure_reason || "—"}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">No unsuccessful attempts recorded in the past 2 weeks.</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {urgentRequestType === 'REVIEWER_URGENT' && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground border border-amber-200 dark:border-amber-800 rounded-lg p-4 bg-amber-50/50 dark:bg-amber-950/20">
                    Enter a reviewer comment and upload documentary evidence. Your supervisor reviews first, then Admin/OIC. Misuse may result in action.
                  </p>
                  <div className="flex items-center space-x-3">
                    <Checkbox id="urgent-disclaimer-reviewer" checked={urgentDisclaimerAccepted} onCheckedChange={(c) => { const v = c === true; setUrgentDisclaimerAccepted(v); urgentDisclaimerAcceptedRef.current = v; }} className="h-5 w-5" />
                    <Label htmlFor="urgent-disclaimer-reviewer" className="text-base cursor-pointer">I have read the above and confirm my comment and evidence are genuine.</Label>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="urgent-reviewer-comment-be" className="text-base">Reviewer comment (required)</Label>
                    <Textarea
                      id="urgent-reviewer-comment-be"
                      value={urgentReviewerComment}
                      onChange={(e) => setUrgentReviewerComment(e.target.value)}
                      placeholder="Summarize reviewer feedback or urgency (min. 10 characters)."
                      rows={3}
                      className="text-base"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="urgent-evidence" className="text-base">Evidence (required) *</Label>
                    <Input
                      id="urgent-evidence"
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
                      className="h-10 text-base"
                      onChange={(e) => setUrgentEvidenceFile(e.target.files?.[0] ?? null)}
                    />
                    {urgentEvidenceFile && <p className="text-sm text-muted-foreground">Selected: {urgentEvidenceFile.name}</p>}
                  </div>
                </div>
              )}

            </div>
            <DialogFooter className="shrink-0 border-t pt-4 mt-2 gap-3">
              <Button variant="outline" onClick={() => setUrgentDialogOpen(false)} className="text-base">Cancel</Button>
              <Button
                disabled={
                  (!urgentDisclaimerAccepted && !urgentDisclaimerAcceptedRef.current) ||
                  urgentSubmitting ||
                  (urgentRequestType === 'REVIEWER_URGENT' && (!urgentEvidenceFile || urgentReviewerComment.trim().length < 10)) ||
                  (urgentHoldBookingId == null && pendingHoldSelection == null) ||
                  noSlotNoAttempts
                }
                onClick={async () => {
                  if (!selectedEquipment) return;
                  if (urgentRequestType === 'REVIEWER_URGENT' && !urgentEvidenceFile) {
                    toast.error("Please upload documentary evidence.");
                    return;
                  }
                  if (urgentRequestType === 'REVIEWER_URGENT' && urgentReviewerComment.trim().length < 10) {
                    toast.error("Reviewer comment must be at least 10 characters.");
                    return;
                  }
                  setUrgentSubmitting(true);
                  try {
                    let holdBookingId: number | undefined = urgentHoldBookingId ?? undefined;
                    if (pendingHoldSelection != null) {
                      const res = await apiClient.bookEquipment(selectedEquipment.id, {
                        slot_ids: pendingHoldSelection.slotIds,
                        total_hours: pendingHoldSelection.totalTimeMinutes / 60,
                        total_cost: pendingHoldSelection.totalCharge,
                        status: "pending",
                        input_values: pendingHoldSelection.inputValues as Record<string, string | boolean | string[]>,
                        create_as_hold: true,
                        atmosphere_sensitive_sample: atmosphereSensitiveForBooking,
                        ...(rewardPointsToRedeem.trim() ? { reward_points_to_redeem: rewardPointsToRedeem.trim() } : {}),
                      });
                      if (res.error) {
                        toast.error(res.error);
                        return;
                      }
                      logBookingServerTimings(res);
                      const resData = (res as { data?: { booking_id?: number; id?: number } }).data;
                      holdBookingId = resData?.booking_id ?? resData?.id;
                      if (holdBookingId == null) {
                        toast.error("Could not create hold booking.");
                        return;
                      }
                      setPendingHoldSelection(null);
                    }
                    const res = await apiClient.createUrgentBookingRequest({
                      equipment_id: selectedEquipment.id,
                      request_type: urgentRequestType,
                      disclaimer_accepted: true,
                      number_of_samples: pendingHoldSelection ? 1 : urgentNumberSamples,
                      slots_requested: pendingHoldSelection ? pendingHoldSelection.slotIds.length : (urgentSlotsRequested || 1),
                      duration_minutes: calculatedCharge?.total_time_minutes ?? undefined,
                      evidence_file: urgentRequestType === 'REVIEWER_URGENT' ? urgentEvidenceFile ?? undefined : undefined,
                      evidence_original_name: urgentEvidenceFile?.name,
                      reviewer_comment: urgentRequestType === 'REVIEWER_URGENT' ? urgentReviewerComment.trim() : undefined,
                      hold_booking_id: holdBookingId,
                    });
                    if (res.error) {
                      toast.error(res.error);
                      return;
                    }
                    toast.success(res.data?.message || "Urgent request submitted.");
                    setUrgentHoldBookingId(null);
                    setUrgentDialogOpen(false);
                    setUrgentRequestType('NO_SLOT');
                    setUrgentDisclaimerAccepted(false);
                    urgentDisclaimerAcceptedRef.current = false;
                    setUrgentEvidenceFile(null);
                    setUrgentReviewerComment("");
                  } catch (e: any) {
                    toast.error(e.message || "Failed to submit request.");
                  } finally {
                    setUrgentSubmitting(false);
                  }
                }}
              >
                {urgentSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Submit request
              </Button>
            </DialogFooter>
            </>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* Staged progress while the booking API runs (clear steps + elapsed time, like common railway booking UIs). */}
        <Dialog open={isSubmittingBooking} onOpenChange={() => {}}>
          <DialogContent
            className="max-w-md border-2 border-primary/20 shadow-lg"
            onPointerDownOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
          >
            <div className="py-2 px-1">
              <DialogTitle className="text-lg font-semibold text-center mb-1">Booking in progress</DialogTitle>
              <DialogDescription asChild>
                <p className="text-sm text-muted-foreground text-center">
                  Your request is being processed on the server. The last step below may stay active for most of the wait —
                  that is normal; work includes database locks and payment, not only “building the response”.
                  {" "}
                  <span className="block mt-1 text-xs">
                    After completion, open the browser console (F12) — server phase timings appear as{" "}
                    <span className="font-mono text-[11px]">[book-equipment] Server timings</span> when the API exposes them.
                  </span>
                </p>
              </DialogDescription>
              <div className="mt-5 space-y-3">
                <Progress
                  value={Math.min(
                    88,
                    (bookingProgressStepIndex /
                      Math.max(1, EQUIPMENT_BOOKING_PROGRESS_STEPS.length - 1)) *
                      85
                  )}
                  className="h-2"
                />
                <ul className="space-y-2.5 text-left" aria-live="polite">
                  {EQUIPMENT_BOOKING_PROGRESS_STEPS.map((label, i) => {
                    const done = i < bookingProgressStepIndex;
                    const active = i === bookingProgressStepIndex;
                    return (
                      <li key={label} className="flex items-start gap-2.5 text-sm">
                        {done ? (
                          <Check className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-500 mt-0.5" aria-hidden />
                        ) : active ? (
                          <Loader2
                            className="h-5 w-5 shrink-0 animate-spin text-primary mt-0.5"
                            aria-hidden
                          />
                        ) : (
                          <Circle className="h-5 w-5 shrink-0 text-muted-foreground/35 mt-0.5" aria-hidden />
                        )}
                        <span
                          className={cn(
                            "leading-snug",
                            active && "font-medium text-foreground",
                            done && "text-muted-foreground",
                            !active && !done && "text-muted-foreground/70"
                          )}
                        >
                          {label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-5">
                Elapsed: {bookingSubmitElapsedSec}s
                {bookingSubmitElapsedSec >= 12 ? (
                  <span className="block mt-1.5 text-amber-700 dark:text-amber-500/90">
                    Server is still working — please keep this tab open. Avoid refreshing or going back.
                  </span>
                ) : (
                  <span className="block mt-1.5">Please keep this tab open until you see the result.</span>
                )}
              </p>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={bookingResultDialog.open} onOpenChange={(open) => !open && setBookingResultDialog((p) => ({ ...p, open: false }))}>
          <DialogContent className="max-w-md sm:max-w-lg overflow-hidden">
            <DialogHeader>
              <DialogTitle
                className={
                  bookingResultDialog.variant === "success"
                    ? "text-green-600 dark:text-green-500"
                    : bookingResultDialog.variant === "waitlist"
                      ? "text-amber-600 dark:text-amber-500"
                      : "text-destructive"
                }
              >
                {bookingResultDialog.variant === "success"
                  ? "Booking Confirmed Successfully"
                  : bookingResultDialog.variant === "waitlist"
                    ? "Booking Waitlisted"
                    : "Booking unsuccessful"}
              </DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-3">
                  <p className="text-base text-foreground">{bookingResultDialog.message}</p>
                  {bookingResultDialog.variant === "success" && (
                    <p className="text-sm text-muted-foreground rounded-lg border bg-primary/5 dark:bg-primary/10 border-primary/25 dark:border-primary/40 px-3 py-2">
                      Confirmation email and notifications are being sent in the background — your booking is already saved.
                    </p>
                  )}
                  {bookingResultDialog.success && bookingResultDialog.variant === "success" ? (
                    <div className="rounded-lg border border-sky-200 bg-sky-50 px-3.5 py-3 text-sky-950 dark:border-sky-800/60 dark:bg-sky-950/40 dark:text-sky-50">
                      <div className="flex gap-2.5">
                        <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-600 dark:text-sky-300" aria-hidden />
                        <div className="min-w-0 space-y-1.5">
                          <p className="text-sm font-semibold leading-snug">
                            {bookingResultDialog.promptCompleteOptionalParams
                              ? "Complete remaining booking parameters"
                              : "Edit or complete booking parameters"}
                          </p>
                          <p className="text-sm leading-relaxed text-sky-900/90 dark:text-sky-100/90">
                            {bookingResultDialog.promptCompleteOptionalParams
                              ? "To help the laboratory prepare for your sample and avoid delays, please complete all remaining booking parameters as soon as possible."
                              : "Use Complete Booking Details to open Edit User Inputs for this booking and update sample or parameter information."}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <p className="text-foreground font-medium">Do you want to book another equipment or continue booking current equipment?</p>
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex !flex-col gap-2 pt-4 sm:!flex-col sm:space-x-0 sm:justify-stretch">
              {bookingResultDialog.success &&
                bookingResultDialog.variant === "success" &&
                bookingResultDialog.bookingViewQuery && (
                  <Button
                    className="w-full gap-2 bg-primary text-white hover:bg-primary/90"
                    onClick={() => {
                      const q = bookingResultDialog.bookingViewQuery!;
                      setBookingResultDialog((p) => ({ ...p, open: false }));
                      navigate(
                        `/my-bookings?booking=${encodeURIComponent(q)}&edit_inputs=1`
                      );
                    }}
                  >
                    Complete Booking Details
                  </Button>
                )}
              {bookingResultDialog.success && bookingResultDialog.bookingViewQuery && (
                <Button
                  variant="secondary"
                  className="w-full gap-2"
                  onClick={() => {
                    const q = bookingResultDialog.bookingViewQuery!;
                    setBookingResultDialog((p) => ({ ...p, open: false }));
                    navigate(`/my-bookings?booking=${encodeURIComponent(q)}`);
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                  {bookingResultDialog.bookingDisplayId
                    ? `View booking ${bookingResultDialog.bookingDisplayId}`
                    : "View booking"}
                </Button>
              )}
              {bookingResultDialog.success && adminBookForUserId && (
                <Button
                  variant="secondary"
                  className="w-full gap-2"
                  onClick={async () => {
                    const displayName = usersList.find((u) => String(u.id) === adminBookForUserId)?.name ||
                      usersList.find((u) => String(u.id) === adminBookForUserId)?.email ||
                      `User #${adminBookForUserId}`;
                    setUserTransactionHistoryDialog({ open: true, userId: adminBookForUserId, userDisplayName: displayName });
                    setUserTransactionHistory({ loading: true, transactions: [], error: null });
                    try {
                      const res = await apiClient.getAdminUserTransactionHistory(adminBookForUserId, 100, 0);
                      setUserTransactionHistory({ loading: false, transactions: res.data?.transactions ?? [], error: null });
                    } catch (e: any) {
                      setUserTransactionHistory({ loading: false, transactions: [], error: e?.message ?? "Failed to load transactions" });
                    }
                  }}
                >
                  <Receipt className="h-4 w-4" />
                  View transaction history
                </Button>
              )}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setBookingResultDialog((p) => ({ ...p, open: false }));
                }}
              >
                Continue booking current equipment
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setBookingResultDialog((p) => ({ ...p, open: false }));
                  navigate("/equipments");
                }}
              >
                Book another equipment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={userTransactionHistoryDialog.open} onOpenChange={(open) => !open && setUserTransactionHistoryDialog((p) => ({ ...p, open: false }))}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <div className="flex flex-wrap items-start justify-between gap-2 pr-8">
                <div className="space-y-1.5 min-w-0">
                  <DialogTitle>Transaction history — {userTransactionHistoryDialog.userDisplayName}</DialogTitle>
                  <DialogDescription>
                    Verify that the correct amount was debited from the user&apos;s wallet after the booking.
                  </DialogDescription>
                </div>
                {!userTransactionHistory.loading && userTransactionHistory.transactions.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="shrink-0 gap-2">
                        <Download className="h-4 w-4" />
                        Download
                        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          exportWalletTransactionsExcel(userTransactionHistory.transactions, {
                            sheetTitle: "Transactions",
                          });
                          toast.success("Excel file downloaded.");
                        }}
                      >
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Excel (.xlsx)
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          exportWalletTransactionsPdf(userTransactionHistory.transactions, {
                            title: `Transaction history — ${userTransactionHistoryDialog.userDisplayName}`,
                          });
                          toast.success("PDF downloaded.");
                        }}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        PDF
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </DialogHeader>
            <div className="flex-1 overflow-auto rounded-xl border border-border/80">
              {userTransactionHistory.loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
                </div>
              ) : userTransactionHistory.error ? (
                <p className="text-center text-destructive py-8">{userTransactionHistory.error}</p>
              ) : userTransactionHistory.transactions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No transactions found.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50 border-b border-border">
                      <TableHead className="font-semibold text-foreground w-[120px]">Equipment</TableHead>
                      <TableHead className="font-semibold text-foreground min-w-[120px]">Booked by</TableHead>
                      <TableHead className="font-semibold text-foreground w-[150px]">Date &amp; Time</TableHead>
                      <TableHead className="font-semibold text-foreground w-[90px]">Type</TableHead>
                      <TableHead className="font-semibold text-foreground min-w-[200px]">Description</TableHead>
                      <TableHead className="font-semibold text-foreground text-right w-[100px]">Amount</TableHead>
                      <TableHead className="font-semibold text-foreground text-right w-[120px]">Balance Remaining</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userTransactionHistory.transactions.map((tx) => (
                      <TableRow key={tx.id} className="border-b border-border/60 last:border-b-0">
                        <TableCell className="text-sm text-muted-foreground">
                          {tx.equipment_name ? <span className="font-medium text-foreground">{tx.equipment_name}</span> : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {tx.related_user_name ? (
                            <span className="text-foreground" title={tx.related_user_email || undefined}>{tx.related_user_name}</span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {new Date(tx.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                        </TableCell>
                        <TableCell>
                          {tx.transaction_type === "credit" ? (
                            <Badge variant="default" className="bg-emerald-600 gap-1">
                              <Plus className="h-3 w-3" /> Credit
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1">
                              <Minus className="h-3 w-3" /> Debit
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm max-w-[300px]">
                          <span className="line-clamp-2" title={(tx.description_display || tx.description) || ""}>{tx.description_display || tx.description || "—"}</span>
                          {tx.department_name && (
                            <span className="text-xs text-muted-foreground block mt-0.5">
                              {tx.department_name}{tx.department_code ? ` (${tx.department_code})` : ""}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {tx.transaction_type === "credit" ? (
                            <span className="text-emerald-600 dark:text-emerald-400">+₹{Number(tx.amount).toFixed(2)}</span>
                          ) : (
                            <span className="text-red-600 dark:text-red-400">−₹{Number(tx.amount).toFixed(2)}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {tx.balance_after != null && String(tx.balance_after) !== "" ? `₹${Number(tx.balance_after).toFixed(2)}` : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUserTransactionHistoryDialog((p) => ({ ...p, open: false }))}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default BookEquipment;

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { flushSync } from "react-dom";
import type { CSSProperties } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  apiClient,
  type BookingTemplate,
  type BookingTemplateOptions,
  type GroupAllocatedAlternative,
  type GroupAlternative,
  type GroupAlternativesPayload,
  type PrintMaterial,
  type TemplateIfSlotTaken,
  type TemplatePreferredSlotResolution,
  type TemplateSlotAlternative,
  type TemplateHealth,
  type TemplateSlotFallback,
} from "@/lib/api";
import { GroupAlternativesDialog } from "@/components/GroupAlternativesDialog";
import { PreferredSlotBanner } from "@/components/PreferredSlotBanner";
import { TemplateSlotSettings } from "@/components/booking-templates/TemplateSlotSettings";
import { TemplateHealthAdvice, focusTemplateField } from "@/components/booking-templates/TemplateHealthAdvice";
import { clampTemplateValues, templateApplyNotice, templateHealthBadge } from "@/lib/templateHealth";
import { BookingAttemptFollowUp, type BookingAttemptSnapshot } from "@/components/BookingAttemptFollowUp";
import {
  draftFromTemplate,
  draftNeedsConsent,
  draftToBody,
  emptyPreferredSlotDraft,
  preferredSlotFromSlots,
  type PreferredSlotDraft,
} from "@/lib/templatePreferredSlot";
import { buildWeeklySlotRows, preferredSlotDraftProblem, slotsRequiredForMinutes } from "@/lib/weeklySlotTemplate";
import {
  fallbackForMode,
  flagsForFallback,
  isTemplateFallback,
  normaliseTemplateSlotOptions,
  slotFallbackFrom,
  type SlotChoice,
  type SlotFallback,
} from "@/lib/slotOptions";
import { SlotChoiceOptions } from "@/components/booking/SlotChoiceOptions";
import { useShowServerClockInHeader } from "@/lib/serverClockHeader";
import { offerAssistantHelp } from "@/lib/assistantHelp";
import { ResearchWorkspacePicker } from "@/components/my-research/ResearchWorkspacePicker";
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
  isNumericInputDraft,
  isNumericValueWithinBounds,
  numericFieldAllowsNegative,
  formulaFallbackValues,
  numericMaxFormula,
  resolveFormulaMax,
  resolveNumericFieldBounds,
} from "@/lib/numericFieldLimits";
import { NumericFieldInput } from "@/components/NumericFieldInput";
import { formatINRAmount } from "@/lib/money";
import { holidayCellLabel, holidayHoverText } from "@/lib/holidayDisplay";
import { isOutsideVisibilityWindow, restrictedSlotHint, restrictedSlotStyle } from "@/lib/slotVisibilityWindow";
import RestrictedSlotLegend, { SlotVisibilityScopeToggle, type SlotVisibilityScope } from "@/components/RestrictedSlotLegend";
import { buildChargeCategoryPresentation } from "@/lib/chargeCategoryPresentation";
import { buildChargeCategorySummaryRows } from "@/lib/chargeCategorySummary";
import {
  ChargeCategoryLegacyTable,
  ChargeCategoryMultiParamTable,
  ChargeCategorySimplifiedTable,
} from "@/components/ChargeCategoryRatesPanel";
import {
  slotsNeededForAnalysisTime,
} from "@/lib/slotAllocation";
import {
  chargeEstimateUserTypeOptionsFor,
  viewerMaySeeInternalRates,
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
import { CalendarIcon, CalendarPlus, FlaskConical, MousePointerClick } from "lucide-react";
import { RichTextContent } from "@/components/RichTextContent";
import { looksLikeRichHtml } from "@/lib/richText";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Check, Circle, Plus, Minus, Trash2, Mail, Receipt, ExternalLink, Download, FileSpreadsheet, FileText, ChevronDown, ChevronUp, Wallet, Info, Lock, BookmarkCheck, Save } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { useEmbeddedMode } from "@/contexts/EmbeddedModeContext";
import EquipmentDepartmentLabel from "@/components/EquipmentDepartmentLabel";
import { MySpendingLimitNotice } from "@/components/wallet/MySpendingLimitNotice";
import type { BookingDetailCardBooking } from "@/components/BookingDetailCard";
import type { RescheduleBookingHolder } from "@/components/RescheduleSlotPicker";
import { BookingDetailCard, PortalFeedbackForm, RescheduleSlotPicker } from "@/components/booking/lazyBookingExtras";
import { publishWorkspaceTitle } from "@/lib/workspaceTitle";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { periodicTableElements, parsePeriodicHelpText, mergePeriodicDisplaySymbols, periodicSelectionChargeSummaryFromHelpText } from "@/data/periodicTableData";
import PeriodicElementsDialog from "@/components/PeriodicElementsDialog";
import { cn } from "@/lib/utils";
import { slotRowEndTimes, slotTimeRangeLabel } from "@/lib/slotTimeRange";
import {
  resolveTableColumns,
  resolveTableRowCountSourceKey,
  syncTableRowsToCount,
  applyTableRowSyncToValues,
} from "@/lib/dynamicTableField";
import { normalizeChoiceOption } from "@/lib/dynamicFieldOptions";
import SampleSetsEditor, { type SampleSetField } from "@/components/SampleSetsEditor";
import { DynamicFieldRow } from "@/components/DynamicFieldRow";
import { dynamicFieldControlWidth } from "@/lib/dynamicFieldLayout";
import {
  readSampleSets,
  sampleSetsAllowedFor,
  withSampleSets,
  withoutSampleSets,
  type SampleSetValues,
} from "@/lib/sampleSets";
import { buildInitialInputValues, getInitialDynamicInputValue } from "@/lib/dynamicFieldDefaults";
import {
  boundsWithCombinedMax,
  combinedLimitError,
  combinedLimits,
  maxForPrimarySet,
  sampleSetFieldLimitError,
} from "@/lib/sampleSetLimits";
import { getRealBookingId, type BookingRef } from "@/lib/bookingRef";
import { readStashedRebookPrefill, sanitizeRebookInputValues, type RebookPrefill } from "@/lib/rebookPrefill";
import { takeBookingAssistantPrefill } from "@/lib/bookingAssistantPrefill";
import { hasIncompleteOptionalEditableParams } from "@/lib/bookingInputValues";
import {
  bookingDraftAllowed,
  clearBookingDraft,
  draftInputsForFields,
  draftMatchesDefaults,
  loadBookingDraft,
  saveBookingDraft,
  type BookingDraft,
} from "@/lib/bookingDraft";
import { classifyBookingFailure, droppedSlotsNotice, partitionSelectionAfterRefresh } from "@/lib/bookingFailure";
import { bookingWalletStatus, insufficientFundsMessage, type EquipmentWalletBalance } from "@/lib/bookingWalletStatus";
import { saveReturnToBooking } from "@/lib/rechargeReturn";
import { focusBookingField, missingRequiredFields } from "@/lib/missingFieldsHint";
import { friendlyChargeError } from "@/lib/chargeErrorText";
import { quotaBlockReason, quotaReferenceDate, quotaSummaryText, type MyBookingQuota } from "@/lib/bookingQuota";
import {
  WAITLIST_FOLLOW_UP,
  WAITLIST_FULL_MESSAGE,
  isWaitlistedResponse,
  waitlistPositionFrom,
  waitlistQueueMessage,
} from "@/lib/waitlistMessage";
import { shortSlotReason, slotAccessibleLabel, unavailableBookingSlotReason } from "@/lib/slotReason";
import { BookingStepIndicator } from "@/components/booking/BookingStepIndicator";
import { SlotOpeningCountdown } from "@/components/booking/SlotOpeningCountdown";
import { WalletLinkBanner } from "@/components/booking/WalletLinkBanner";
import { QuotaRemainingNotice } from "@/components/booking/QuotaRemainingNotice";
import { MissingFieldsHint } from "@/components/booking/MissingFieldsHint";
import { SlotReasonPopover, type SlotReasonTarget } from "@/components/booking/SlotReasonPopover";
import { RestoredDraftNotice } from "@/components/booking/RestoredDraftNotice";
import { ChargeErrorNotice } from "@/components/booking/ChargeErrorNotice";
import { BookingFallbackOptions, NO_SLOT_ALTERNATE_HINT } from "@/components/booking/BookingFallbackOptions";
import { PeakCollapsible } from "@/components/booking/PeakCollapsible";
import { ClampedNote } from "@/components/booking/ClampedNote";
import { BookingActionBar } from "@/components/booking/BookingActionBar";
import { InfoTip } from "@/components/booking/InfoTip";
import { usePeakWindow } from "@/hooks/use-peak-window";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { format, addDays, startOfWeek, endOfWeek, addWeeks, subWeeks, isSameDay, parseISO, startOfDay, startOfMonth, endOfMonth, addMonths, subMonths, eachDayOfInterval, isSameMonth, startOfYear, endOfYear, addYears, subYears } from "date-fns";
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
  /** Staff views only: outside the equipment's weekly visibility window (hidden from regular users). */
  outside_visibility_window?: boolean;
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

function describeGroupSlotWindow(start: string, end: string): string {
  try {
    return `${format(parseISO(start), "EEE d MMM yyyy, HH:mm")} – ${format(parseISO(end), "HH:mm")}`;
  } catch {
    return `${start} – ${end}`;
  }
}

/** sessionStorage handoff when the user opens the booking form for a same-group alternative. */
const GROUP_ALT_PREFILL_KEY = "iic_group_alternative_prefill";
const NO_TEMPLATE_VALUE = "__none__";

type GroupAltPrefill = {
  equipment_id: number;
  from_equipment_id: number;
  from_name: string;
  input_values: Record<string, string | boolean | string[]>;
  date: string;
};

interface EquipmentDetail {
  equipment_id: number;
  code: string;
  name: string;
  /** Equipment Group alternatives active for this equipment (env flag + group switch). */
  group_alternatives_enabled?: boolean;
  /** Initial state of "Automatically search and allocate alternate equipment" (off = ask the user first). */
  auto_allocate_alternative_default?: boolean;
  group_cross_reschedule_enabled?: boolean;
  description: string;
  profile_type: string;
  profile_type_display: string;
  /** Calculation type for the current user (from their charge profile); prefer over profile_type when set. */
  viewer_profile_type?: string | null;
  viewer_profile_type_display?: string | null;
  /** OIC viewing equipment they are not assigned to: charges only, no slot or booking management. */
  viewer_catalog_only?: boolean;
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
  /** Regular-user visibility window (HH:mm); staff see slots outside it hatched. */
  weekly_view_time_from?: string | null;
  weekly_view_time_to?: string | null;
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
  /** Main-admin switch: false hides "Add sample with different parameters" for this equipment. */
  allow_multiple_sample_sets?: boolean;
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

const SLOT_STATUS_HOVER_LABELS: Record<string, string> = {
  NOT_AVAILABLE: "Not Available",
  BOOKED: "Booked",
  BLOCKED: "Blocked (other reasons)",
  UNDER_MAINTENANCE: "Under Maintenance",
  OPERATOR_ABSENT: "Operator Absent",
  BOOKING_NOT_UTILIZED: "Booking Not Utilized",
  HOLD: "On hold",
  COMPLETED: "Completed",
};

/**
 * Staff hover lines for any slot whose status is not plain Available: status, time range,
 * reason (blocked label / holiday / weekend / mode) and, for booked slots, who booked it.
 * Returns [] for Available slots.
 */
function slotStatusHoverLines(
  slot: DailySlot | null | undefined,
  opts: { holidayName?: string; isWeekend?: boolean } = {},
): string[] {
  if (!slot) return [];
  const status = String(slot.status || "").toUpperCase();
  const statusDisplay = String(slot.status_display || "").trim();
  const reservedDisplay = status === "AVAILABLE" && statusDisplay !== "" && !statusDisplay.startsWith("Available");
  const hasBooking = slot.booking_id != null && String(slot.booking_id).trim() !== "";
  if (status === "AVAILABLE" && !reservedDisplay && !slot.mode_overlay && !hasBooking) return [];

  const lines: string[] = [];
  const label =
    (hasBooking && String(slot.booking_status_display || "").trim()) ||
    statusDisplay ||
    SLOT_STATUS_HOVER_LABELS[status] ||
    status.replace(/_/g, " ");
  lines.push(`Status: ${label}`);
  if (slot.start_datetime && slot.end_datetime) {
    lines.push(`Time: ${describeGroupSlotWindow(slot.start_datetime, slot.end_datetime)}`);
  }
  const blockedLabel = String(slot.blocked_label || "").trim();
  if (blockedLabel) lines.push(`Reason: ${blockedLabel}`);
  if (opts.holidayName) {
    lines.push(`Holiday: ${opts.holidayName}`);
  } else if (!blockedLabel && status === "NOT_AVAILABLE" && opts.isWeekend) {
    lines.push("Reason: Weekend");
  }
  if (slot.mode_overlay) lines.push(`Mode: ${slot.mode_overlay}`);
  if (hasBooking || status === "BOOKED") lines.push(...bookedSlotUserDetailLines(slot));
  return lines;
}

function SlotHoverLines({ lines }: { lines: string[] }) {
  return (
    <div className="space-y-0.5 text-xs">
      {lines.map((line, i) => (
        <div key={i} className={i === 0 ? "font-semibold" : undefined}>
          {line}
        </div>
      ))}
    </div>
  );
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

/** Format HH:mm / HH:mm:ss as a friendly 12-hour clock, e.g. "9 PM" or "9:30 PM". */
function formatClock12h(timeStr: string): string {
  const raw = (timeStr || "").trim();
  const [hPart, mPart = "0"] = raw.split(":");
  let h = parseInt(hPart || "0", 10);
  const m = parseInt(String(mPart).substring(0, 2) || "0", 10) || 0;
  if (Number.isNaN(h)) h = 0;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** Weekday 0–6 (Mon–Sun) + time → "every Wednesday from 9 PM". */
function formatSlotReleaseSchedule(weekday: number, timeStr: string): string {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const day = days[Math.max(0, Math.min(6, weekday))] ?? "";
  return `every ${day} from ${formatClock12h(timeStr)}`;
}

/** Human-readable charge column labels from equipment profile_type. */
function getChargeUnitColumnLabels(profileType?: string | null): {
  primary: string;
  secondary: string;
  rateSuffix: string;
} {
  const t = String(profileType || "").toUpperCase();
  if (t === "HOUR") {
    return { primary: "Per hour", secondary: "Per hour (after breakpoint)", rateSuffix: "/hour" };
  }
  if (t === "SAMPLE" || t === "SAMPLE_ELEMENT" || t === "MULTI_PARAM") {
    return { primary: "Per sample", secondary: "Additional per sample", rateSuffix: "/sample" };
  }
  if (t === "PRINT_3D") {
    return { primary: "Base charge", secondary: "Additional charge", rateSuffix: "" };
  }
  return { primary: "Unit charge", secondary: "Additional charge", rateSuffix: "" };
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

function toFiniteNumber(value: unknown): number | undefined {
  if (value == null) return undefined;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : undefined;
}

/** Max from a NUMERIC field's max_formula (any field, every user type), worked out with `inputFieldValues`. */
function resolveDynamicFormulaMax(
  field: any,
  inputFieldValues: Record<string, unknown>,
  equipmentDetail?: EquipmentDetail | null,
): number | undefined {
  return resolveFormulaMax(
    field,
    inputFieldValues,
    toFiniteNumber(equipmentDetail?.slot_duration_minutes),
    formulaFallbackValues(equipmentDetail?.input_fields),
  );
}

/**
 * True if "Request urgent booking" button should be shown.
 * When current weekday equals slot window (internal users) reference weekday, show only after 30 minutes past that time.
 */
/** Must match RUSH_RELIEF_MIN_PEAK_FAILED_ATTEMPTS in backend api_views. */
const RUSH_RELIEF_MIN_PEAK_ATTEMPTS = 2;

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
  urgent?: boolean;
  sampleSets?: SampleSetValues[];
};

function buildChargeCalculationHash(input: ChargeCalcHashInput): string {
  return JSON.stringify({
    inputFieldValues: input.inputFieldValues,
    sampleSets: input.sampleSets ?? [],
    printAnalysisId: input.printAnalysisId,
    printAnalysisBatchId: input.printAnalysisBatchId,
    sample_return_after_analysis: input.sampleReturnAfterAnalysis,
    charge_estimate_user_type: input.chargeEstimateUserType,
    urgent: Boolean(input.urgent),
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

/** Toolbar row: one line from md up (the tip chip shrinks and wraps its text instead). */
const STATUS_TOOLBAR_CLASS = "flex flex-wrap items-center gap-2 md:flex-nowrap";
const STATUS_TIP_CHIP_CLASS =
  "inline-flex min-w-0 items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium leading-tight text-blue-900 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100";
const STATUS_ACTION_BUTTON_CLASS = "h-8 whitespace-nowrap px-2.5 text-xs font-medium";
const STATUS_PRIMARY_ACTION_CLASS =
  "border-amber-200 bg-amber-50 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:hover:bg-amber-900/30";

const FORMULA_LETTER_RE = /(?<![A-Za-z0-9_])[A-Z](?![A-Za-z0-9_])/g;

function formulaLetters(formula: unknown, allowed = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"): string[] {
  const found = String(formula ?? "").match(FORMULA_LETTER_RE) ?? [];
  return found.filter((letter) => allowed.includes(letter));
}

function isLegacyHourSlotFormula(timeFormula: unknown): boolean {
  const normalized = String(timeFormula ?? "").replace(/\s+/g, "").toUpperCase();
  return ["", "B", "B*SLOT_DURATION", "SLOT_DURATION*B", "B*SLOTDURATION", "SLOTDURATION*B"].includes(normalized);
}

/**
 * Input keys the backend charge/time engines read for the charge profile(s) of `userType`
 * (mirrors calculators.py), plus keys those fields' max formulas depend on.
 * Returns null when the profile type is not understood, so callers show every field.
 */
function chargeAffectingInputKeys(
  equipmentDetail: {
    profile_type?: string;
    charge_profiles?: Array<Record<string, unknown>>;
    input_fields?: Array<Record<string, unknown>>;
  } | null,
  userType: string
): Set<string> | null {
  const profiles = (equipmentDetail?.charge_profiles ?? []).filter(
    (p) =>
      p && p.is_active !== false && (!userType || String(p.user_type || "").toLowerCase() === userType.toLowerCase())
  );
  if (profiles.length === 0) return null;
  const keys = new Set<string>();
  for (const profile of profiles) {
    const type = String(profile.profile_type || equipmentDetail?.profile_type || "").toUpperCase().trim();
    const timeLetters = formulaLetters(profile.time_formula, "ABCDEFG");
    if (type === "SAMPLE") {
      ["A", ...timeLetters].forEach((k) => keys.add(k));
    } else if (type === "SAMPLE_ELEMENT") {
      ["A", "B", "C", ...timeLetters].forEach((k) => keys.add(k));
    } else if (type === "HOUR") {
      (isLegacyHourSlotFormula(profile.time_formula) ? ["B", "C"] : timeLetters).forEach((k) => keys.add(k));
    } else if (type === "GENERIC") {
      [...formulaLetters(profile.time_formula), ...formulaLetters(profile.charge_formula)].forEach((k) => keys.add(k));
    } else if (type === "MULTI_PARAM") {
      ["A", "B"].forEach((k) => keys.add(k));
    } else {
      return null;
    }
  }
  const fields = equipmentDetail?.input_fields ?? [];
  let grew = true;
  while (grew) {
    grew = false;
    for (const field of fields) {
      const key = String(field?.field_key || "").trim();
      if (!keys.has(key)) continue;
      const maxFormula =
        String(field?.field_type || "").toUpperCase().trim() === "NUMERIC" ? numericMaxFormula(field?.options) : "";
      for (const dep of formulaLetters(maxFormula)) {
        if (!keys.has(dep)) {
          keys.add(dep);
          grew = true;
        }
      }
    }
  }
  return keys;
}

/** Fields that only capture notes / free text and do not drive charge formulas. */
function isNonChargeAffectingInputField(field: {
  field_key?: string | null;
  field_label?: string | null;
  field_type?: string | null;
  is_required?: boolean | null;
}): boolean {
  const key = String(field.field_key || "").trim().toLowerCase();
  const label = String(field.field_label || "").trim().toLowerCase();
  const fieldType = String(field.field_type || "").toUpperCase().trim();
  if (
    key === "comments" ||
    key === "comment" ||
    key === "remarks" ||
    key === "remark" ||
    key === "notes" ||
    key === "note"
  ) {
    return true;
  }
  if (fieldType === "TEXT" && /\b(comment|remark|note)s?\b/.test(label)) {
    return true;
  }
  if (
    fieldType === "TEXT" &&
    !field.is_required &&
    /\b(any other|additional|other)\b/.test(label) &&
    /\b(requirement|request|instruction|detail)s?\b/.test(label)
  ) {
    return true;
  }
  return false;
}

const BookEquipment = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const embedded = useEmbeddedMode();
  const debugSlots = searchParams.get("debug_slots") === "1";
  /** Build proforma line item from charge step only (no slot booking). */
  const isProformaFlow = searchParams.get("proforma") === "1";
  /** Charge estimate only — inputs + calculation, no slot booking. */
  const isCalculateChargesFlow = searchParams.get("mode") === "calculate";
  /** Embedded in equipment profile / dashboard workspace — omit full-page chrome. */
  const isEmbedFlow = embedded || searchParams.get("embed") === "1";
  /** Create / edit a booking template: the full booking form, saved under a name instead of booking slots. */
  const isTemplateFlow = searchParams.get("mode") === "template";
  const editTemplateId = isTemplateFlow ? Number(searchParams.get("template_id")) || null : null;
  const templateParam = isTemplateFlow ? searchParams.get("template_id") : searchParams.get("template");
  const templateReturnTo = (() => {
    const raw = isTemplateFlow ? searchParams.get("return_to") || "" : "";
    return raw === "/booking-templates" || raw.startsWith("/booking-templates?") ? raw : null;
  })();
  useShowServerClockInHeader(!isCalculateChargesFlow && !isProformaFlow && !isTemplateFlow);
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
  const equipmentCatalogOnly = Boolean(equipmentDetail?.viewer_catalog_only);
  const [userId, setUserId] = useState<string | null>(null);
  const [userType, setUserType] = useState<string | number | null>(null);
  const [userDepartmentType, setUserDepartmentType] = useState<string | null>(null);
  const chargeEstimateOptions = useMemo(
    () =>
      chargeEstimateUserTypeOptionsFor(
        viewerMaySeeInternalRates({ user_type: userType, department_type: userDepartmentType }),
      ),
    [userType, userDepartmentType],
  );
  const [userDepartmentId, setUserDepartmentId] = useState<number | null>(null);
  const [istemPortalAcknowledged, setIstemPortalAcknowledged] = useState(false);
  const [adminTargetIstemAcknowledged, setAdminTargetIstemAcknowledged] = useState<boolean | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedSlots, setSelectedSlots] = useState<TimeSlot[]>([]);
  const [inputFieldValues, setInputFieldValues] = useState<Record<string, string | boolean | string[] | number>>({});
  /** Additional samples with their own parameters in the same booking (sample set 1 = inputFieldValues). */
  const [sampleSets, setSampleSets] = useState<SampleSetValues[]>([]);
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
    pricing_profile?: string;
    applied_profile?: string;
    normal_charge?: string | null;
    applied_charge?: string;
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
  /** Standalone "Calculate charges": inputs that cannot change the estimate are hidden (and not required). */
  const calculateHiddenFieldKeys = useMemo(() => {
    const hidden = new Set<string>();
    const fields = equipmentDetail?.input_fields;
    if (!isCalculateChargesFlow || !fields?.length || equipmentDetail?.profile_type === "PRINT_3D") return hidden;
    const chargeKeys = chargeAffectingInputKeys(equipmentDetail, chargeEstimateUserType);
    for (const field of fields) {
      const key = String(field?.field_key || "").trim();
      if (!key) continue;
      const type = String(field?.field_type || "").toUpperCase().trim();
      if (type === "PERIODIC_TABLE" || type === "ICPMS_STANDARD_COVERAGE") continue;
      // The calculate endpoint only reads single-letter keys (A–Z).
      if (isNonChargeAffectingInputField(field) || !/^[A-Z]$/.test(key) || (chargeKeys && !chargeKeys.has(key))) {
        hidden.add(key);
      }
    }
    return hidden;
  }, [isCalculateChargesFlow, equipmentDetail, chargeEstimateUserType]);
  /** Field A / B maximums apply to all sample sets combined; the editor shows the error inline. */
  const sampleSetLimitError = useMemo(
    () =>
      equipmentDetail?.profile_type === "PRINT_3D"
        ? null
        : combinedLimitError(equipmentDetail?.input_fields, inputFieldValues, sampleSets),
    [equipmentDetail, inputFieldValues, sampleSets]
  );
  const primaryCombinedLimits = useMemo(
    () => (equipmentDetail?.profile_type === "PRINT_3D" ? [] : combinedLimits(equipmentDetail?.input_fields)),
    [equipmentDetail]
  );
  /** After charge calc / slots shown, Sample + Charge sections collapse so Step 3 is visible sooner. */
  const [sampleInfoExpanded, setSampleInfoExpanded] = useState(true);
  const [chargeCalcExpanded, setChargeCalcExpanded] = useState(true);
  const [exportingChargePdf, setExportingChargePdf] = useState(false);
  const [autoSlotSelection, setAutoSlotSelection] = useState<boolean>(true);
  const [userAutoSlotSelectionPref, setUserAutoSlotSelectionPref] = useState<boolean>(true);
  const userAutoSlotSelectionPrefRef = useRef<boolean>(true);
  const autoSlotSelectionRef = useRef<boolean>(true);
  const lastCalculatedValuesRef = useRef<string>('');
  const chargeRequestSeqRef = useRef(0);
  // Admin manage-equipment: 'book' = book for user, 'status' = change slot status, null = show mode selector
  const [adminManageMode, setAdminManageMode] = useState<'book' | 'status' | null>(null);
  useEffect(() => {
    if (equipmentCatalogOnly) setAdminManageMode(null);
  }, [equipmentCatalogOnly]);
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
    user_type?: string;
    wallet_faculty_owner: { name: string; email: string } | null;
    wallet_balance: string;
  } | null>(null);
  const adminBookForUserWalletBalance = (() => {
    const raw = (adminBookForUserInfo?.wallet_balance ?? "").trim();
    return raw && Number.isFinite(Number(raw.replace(/,/g, ""))) ? formatINRAmount(raw) : null;
  })();
  const [adminBookForUserInfoLoading, setAdminBookForUserInfoLoading] = useState(false);
  const [adminBookForUserInfoError, setAdminBookForUserInfoError] = useState<string | null>(null);
  const [equipmentDeptWalletBalance, setEquipmentDeptWalletBalance] = useState<EquipmentWalletBalance | null>(null);
  const [walletBalanceRefreshTick, setWalletBalanceRefreshTick] = useState(0);
  const [bookingQuota, setBookingQuota] = useState<MyBookingQuota | null>(null);
  const [quotaRefreshTick, setQuotaRefreshTick] = useState(0);
  const [restoredDraft, setRestoredDraft] = useState<BookingDraft | null>(null);
  /** Slots that were in the user's selection but got booked by someone else during a failed submit. */
  const [takenSlotIds, setTakenSlotIds] = useState<Set<number>>(() => new Set());
  const [slotReasonTarget, setSlotReasonTarget] = useState<SlotReasonTarget | null>(null);
  /** Raw charge-calculation error (shown in plain language instead of "Coming Soon"). */
  const [chargeErrorRaw, setChargeErrorRaw] = useState<{ message: string; network: boolean } | null>(null);
  /** Phone layout: which day of the week the slot grid shows. */
  const [mobileSlotDayOffset, setMobileSlotDayOffset] = useState<number | null>(null);
  const isMobileViewport = useIsMobile();
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
  /** OIC / admin: show every slot, or only the slots regular users can see (booking + change slot status grids). */
  const [slotVisibilityScope, setSlotVisibilityScope] = useState<SlotVisibilityScope>("all");
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
  const CREATE_BOOKING_OPERATION_VALUE = "__create_booking__";
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
    holder?: RescheduleBookingHolder;
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

  /** First shown NUMERIC field holding a value outside its limits (e.g. a 0 from an older template). */
  const numericInputLimitError = useMemo(() => {
    const fields = equipmentDetail?.input_fields;
    if (!fields?.length || equipmentDetail?.profile_type === "PRINT_3D") return null;
    for (const field of fields) {
      if (String(field?.field_type || "").toUpperCase().trim() !== "NUMERIC") continue;
      const key = String(field?.field_key || "").trim();
      if (!key || calculateHiddenFieldKeys.has(key)) continue;
      if (isProformaFlow && isNonChargeAffectingInputField(field)) continue;
      const raw = inputFieldValues[key];
      if (raw === undefined || raw === null || raw === "" || (typeof raw === "string" && isNumericInputDraft(raw))) {
        continue;
      }
      const formulaMax = resolveDynamicFormulaMax(field, inputFieldValues, equipmentDetail);
      if (!isNumericValueWithinBounds(raw, field, formulaMax)) {
        const { min, max } = resolveNumericFieldBounds(field, formulaMax);
        return `"${field.field_label || key}" must be between ${formatNumericBound(min)} and ${formatNumericBound(max)}.`;
      }
    }
    return null;
  }, [equipmentDetail, inputFieldValues, calculateHiddenFieldKeys, isProformaFlow]);

  const sampleSetFields = useMemo(
    () =>
      ((equipmentDetail?.input_fields ?? []) as SampleSetField[]).filter(
        (field) => !calculateHiddenFieldKeys.has(String(field.field_key || "").trim())
      ),
    [equipmentDetail, calculateHiddenFieldKeys]
  );
  /** Extra sample sets: each field against its own set's limits (A <= B*4 uses that set's B), as Step 1 does. */
  const sampleSetFieldError = useMemo(
    () =>
      equipmentDetail?.profile_type === "PRINT_3D"
        ? null
        : sampleSetFieldLimitError(
            sampleSetFields.filter((field) => !(isProformaFlow && isNonChargeAffectingInputField(field))),
            sampleSets,
            {
              slotDurationMinutes: toFiniteNumber(equipmentDetail?.slot_duration_minutes),
              fallbacks: formulaFallbackValues(equipmentDetail?.input_fields),
            }
          ),
    [equipmentDetail, sampleSetFields, sampleSets, isProformaFlow]
  );

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
  const researchWorkspaceFromUrl = searchParams.get("research_workspace");
  const [researchWorkspaceId, setResearchWorkspaceId] = useState<string | null>(researchWorkspaceFromUrl);
  const researchFolderId =
    researchWorkspaceId && researchWorkspaceId === researchWorkspaceFromUrl ? searchParams.get("research_folder") : null;
  const researchFolderLabel = researchFolderId ? searchParams.get("research_folder_name") : null;
  const researchReturnPath = (() => {
    const raw = searchParams.get("research_return") || "";
    return raw.startsWith("/my-research/") ? raw : null;
  })();
  const bookingForAnotherUser = adminManageMode === "book" && Boolean(adminBookForUserId);
  /** Separate call after the booking succeeded; never affects the booking itself. */
  const linkBookingToResearchWorkspace = (realBookingIds: number | number[]) => {
    const workspaceId = researchWorkspaceId;
    const ids = (Array.isArray(realBookingIds) ? realBookingIds : [realBookingIds]).filter((id) => Number.isFinite(id));
    if (!workspaceId || bookingForAnotherUser || ids.length === 0) return;
    void apiClient.linkResearchBookings(workspaceId, ids, researchFolderId).then((res) => {
      if (res.error) {
        toast.warning("Booking confirmed, but it could not be added to your research workspace. You can add it from My Research.");
      }
    });
  };
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

  const workspaceEquipmentTitle =
    String(equipmentDetail?.name || selectedEquipment?.name || "").trim() ||
    String(equipmentDetail?.code || "").trim();

  useEffect(() => {
    if (!isEmbedFlow || !workspaceEquipmentTitle) return;
    publishWorkspaceTitle(
      isTemplateFlow
        ? `${editTemplateId ? "Edit" : "Create"} booking template — ${workspaceEquipmentTitle}`
        : workspaceEquipmentTitle
    );
    return () => publishWorkspaceTitle(null);
  }, [isEmbedFlow, workspaceEquipmentTitle, isTemplateFlow, editTemplateId]);

  useEffect(() => {
    if (!bookingAsExternalTarget) return;
    setWaitlistIntentMode(false);
    setBookAnyAvailableSlots(false);
    setBookEvenIfSingleSlotAvailable(false);
  }, [bookingAsExternalTarget]);

  useEffect(() => {
    // If the selected weekly window has no bookable slots, hide/disable fallback booking strategies.
    // (They can't succeed without at least one AVAILABLE slot.)
    if (bookingAsExternalTarget || isTemplateFlow) return;
    if (hasBookableSlotInSelectedWeek) return;
    setBookAnyAvailableSlots(false);
    setBookEvenIfSingleSlotAvailable(false);
  }, [hasBookableSlotInSelectedWeek, bookingAsExternalTarget, isTemplateFlow]);

  useEffect(() => {
    if (bookingAsExternalTarget || isTemplateFlow) return;
    if (!hasBookableSlotInSelectedWeek) return;
    setWaitlistIntentMode((prev) => (prev ? false : prev));
  }, [hasBookableSlotInSelectedWeek, bookingAsExternalTarget, isTemplateFlow]);

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
    /** Failure only: the form was kept so the user can fix and retry. */
    formKept?: boolean;
  }>({ open: false, success: false, variant: "failure", message: "" });

  /** Equipment Group: alternatives offered after a slot-unavailable failure (409 GROUP_ALTERNATIVES_AVAILABLE). */
  const [groupAlternatives, setGroupAlternatives] = useState<{
    payload: GroupAlternativesPayload;
    /** Body of the original book request, reused for "Book this" / "Continue to waitlist". */
    requestBody: Parameters<typeof apiClient.bookEquipment>[1];
    originalEquipmentId: number;
  } | null>(null);
  const [groupAltBookingId, setGroupAltBookingId] = useState<number | null>(null);
  const [groupAltWaitlistBusy, setGroupAltWaitlistBusy] = useState(false);
  /** Banner shown when the form was opened for an alternative ("Alternative for …"). */
  const [alternativeOf, setAlternativeOf] = useState<{
    equipmentId: number;
    name: string;
    /** Equipment the form was opened for; the banner/audit only apply while it is selected. */
    forEquipmentId: number;
  } | null>(null);

  const [userTransactionHistoryDialog, setUserTransactionHistoryDialog] = useState<{ open: boolean; userId: string | null; userDisplayName: string }>({ open: false, userId: null, userDisplayName: "" });
  const [userTransactionHistory, setUserTransactionHistory] = useState<{ loading: boolean; transactions: Array<{ id: number; transaction_type: "credit" | "debit"; amount: string; description: string; description_display?: string; created_at: string; balance_after?: string | null; equipment_name?: string | null; department_name?: string | null; department_code?: string | null; related_user_name?: string | null; related_user_email?: string | null; virtual_booking_id?: string | null }>; error: string | null; scopedDepartmentNames?: string[] | null }>({ loading: false, transactions: [], error: null });
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
  /** Type A rush relief: book advance week at normal rates (no hold, no urgent surcharge). */
  const isRushReliefMode = searchParams.get("rush_relief") === "1";
  const allowUrgentWeekExtension = isUrgentHoldMode || isRushReliefMode;
  /** Type B: hold slots for OIC/Admin review with 50% surcharge. */
  const isUrgentTypeBHoldMode = isUrgentHoldMode && !isRushReliefMode;
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
  const noSlotWithNoUnsuccessfulAttempts = urgentRequestType === 'NO_SLOT' && !myUnsuccessfulAttemptsLoading && myUnsuccessfulAttempts.length < RUSH_RELIEF_MIN_PEAK_ATTEMPTS;

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
    /** Approved repeat request: slots must start at or after this instant (approval + 48h). */
    bookable_from?: string | null;
    extra_week_granted?: boolean;
    /** OIC/Admin marking another user's booking as repeat and booking it for them. */
    booked_by_staff?: boolean;
    user_label?: string | null;
  } | null>(null);
  const [repeatSourceLoading, setRepeatSourceLoading] = useState(false);
  /** The equipment's "Allow samples with different parameters" switch (on unless the main admin turned it off). */
  const sampleSetsAllowed = sampleSetsAllowedFor(equipmentDetail);
  /** A saved template keeps its sets after the switch is turned off: they can be changed or removed, not added to. */
  const keepExistingSampleSets = isTemplateFlow && equipmentDetail?.profile_type !== "PRINT_3D";
  const sampleSetsOffered =
    (sampleSetsAllowed || (keepExistingSampleSets && sampleSets.length > 0)) &&
    !repeatSourceBooking &&
    !isProformaFlow &&
    (equipmentDetail?.input_fields?.length ?? 0) > 0;
  const showSampleSetOneHeader = sampleSetsOffered && sampleSets.length > 0;
  useEffect(() => {
    if (!sampleSetsAllowed && !keepExistingSampleSets && sampleSets.length > 0) setSampleSets([]);
  }, [sampleSetsAllowed, keepExistingSampleSets, sampleSets.length]);
  /** Booking option: book the first free equipment of the group automatically (else ask before booking it). */
  const [autoAllocateAlternative, setAutoAllocateAlternative] = useState(false);
  const groupAlternativeOption =
    !!equipmentDetail?.group_alternatives_enabled &&
    equipmentDetail?.profile_type !== "PRINT_3D" &&
    !isUrgentTypeBHoldMode &&
    !isRushReliefMode &&
    !repeatSourceBooking;
  /** No free slot this week on the chosen equipment: the request itself asks for the group's earliest slot. */
  const groupAlternativeSearchWithoutSlots =
    groupAlternativeOption && !hasBookableSlotInSelectedWeek && selectedSlots.length === 0;
  const canSubmitWithoutSlots = waitlistIntentEffective || groupAlternativeSearchWithoutSlots;

  const bookingDebitAmount = calculatedCharge
    ? Number(calculatedCharge.reward?.final_payable ?? calculatedCharge.total_charge)
    : null;
  const walletStatus = useMemo(
    () => bookingWalletStatus(equipmentDeptWalletBalance, Number.isFinite(bookingDebitAmount) ? bookingDebitAmount : null),
    [equipmentDeptWalletBalance, bookingDebitAmount],
  );
  const walletLinkRequired = walletStatus.kind === "needs_link" || walletStatus.kind === "link_pending";
  const todayIso = format(new Date(), "yyyy-MM-dd");
  const quotaSummary = quotaSummaryText(bookingQuota, todayIso);
  const quotaBlock = repeatSourceBooking
    ? null
    : quotaBlockReason(bookingQuota, calculatedCharge?.total_time_minutes ?? null, todayIso);
  const missingStep1Fields = useMemo(
    () =>
      missingRequiredFields(
        equipmentDetail?.input_fields as Array<{ field_key?: string; field_label?: string; is_required?: boolean }> | undefined,
        inputFieldValues,
        calculateHiddenFieldKeys,
      ),
    [equipmentDetail?.input_fields, inputFieldValues, calculateHiddenFieldKeys],
  );

  const isRegularBookingFlow = !isCalculateChargesFlow && !isTemplateFlow && !isProformaFlow && adminManageMode !== "status";
  const bookingStepIndex = !chargeCalculated
    ? loadingCharge
      ? 1
      : 0
    : selectedSlots.length > 0 || (canSubmitWithoutSlots && !hasBookableSlotInSelectedWeek)
      ? 3
      : 2;
  /** Peak booking window: optional panels start collapsed so the slot grid and Confirm need less scrolling. */
  const peakCompact = usePeakWindow().active && isRegularBookingFlow;

  const bookingReturnPath = () => {
    const equipmentId = equipmentDetail?.equipment_id ?? selectedEquipment?.id;
    return equipmentId != null ? `/book-equipment?equipment_id=${equipmentId}` : null;
  };

  const goToWalletRecharge = (amount?: number) => {
    const params = new URLSearchParams({ recharge: "1" });
    const deptId = equipmentDeptWalletBalance?.department_id;
    if (deptId != null) params.set("department_id", String(deptId));
    if (amount != null && amount > 0) params.set("amount", String(Math.ceil(amount)));
    const path = bookingReturnPath();
    if (path) {
      saveReturnToBooking({ path, equipmentName: equipmentDetail?.name || selectedEquipment?.name || null, reason: "recharge" });
    }
    navigate(`/wallet?${params.toString()}`);
  };

  const goToWalletLink = (opts?: { invite?: boolean }) => {
    const path = bookingReturnPath();
    if (path) {
      saveReturnToBooking({ path, equipmentName: equipmentDetail?.name || selectedEquipment?.name || null, reason: "wallet_link" });
    }
    navigate(opts?.invite ? "/wallet#invite-supervisor" : "/wallet");
  };
  const repeatBookableFromMs = useMemo(() => {
    const iso = repeatSourceBooking?.bookable_from;
    if (!iso) return null;
    const ms = new Date(iso).getTime();
    return Number.isNaN(ms) ? null : ms;
  }, [repeatSourceBooking?.bookable_from]);

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
        setUserDepartmentType(user.department_type ?? null);
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
      setAdminBookForUserInfoLoading(false);
      setAdminBookForUserInfoError(null);
      return;
    }
    let cancelled = false;
    setAdminBookForUserInfoLoading(true);
    setAdminBookForUserInfoError(null);
    (async () => {
      const equipmentId = equipmentDetail?.equipment_id ?? selectedEquipment?.id;
      const listed = usersList.find((u) => String(u.id) === String(adminBookForUserId));

      // Prefer equipment-scoped endpoint (same auth as book-on-behalf; no Users admin module).
      let res =
        equipmentId != null
          ? await apiClient.getEquipmentBookForUserInfo(equipmentId, adminBookForUserId)
          : { data: undefined as undefined, error: "missing_equipment" as string | undefined };

      // Fallback to admin booking-info if equipment endpoint unavailable.
      if (res.error || !(res.data && typeof res.data === "object" && "wallet_balance" in res.data)) {
        res = await apiClient.getAdminUserBookingInfo(adminBookForUserId, {
          equipmentId: equipmentId ?? undefined,
        });
      }
      if (cancelled) return;

      const payload = res.data;
      const looksValid =
        !res.error &&
        payload &&
        typeof payload === "object" &&
        "wallet_balance" in payload &&
        typeof (payload as { wallet_balance?: unknown }).wallet_balance === "string";

      if (looksValid) {
        setAdminBookForUserInfo(payload as {
          email: string;
          department_name: string;
          phone_number?: string;
          user_type?: string;
          wallet_faculty_owner: { name: string; email: string } | null;
          wallet_balance: string;
        });
        setAdminBookForUserInfoError(null);
        setAdminBookForUserInfoLoading(false);
        return;
      }

      // Keep list email visible, but surface the real API error.
      setAdminBookForUserInfo({
        email: listed?.email || "",
        department_name: "",
        phone_number: "",
        user_type: listed?.user_type || "",
        wallet_faculty_owner: null,
        wallet_balance: "—",
      });
      const errMsg =
        typeof res.error === "string"
          ? res.error
          : "Could not load selected user details (email, department, wallet).";
      setAdminBookForUserInfoError(errMsg);
      setAdminBookForUserInfoLoading(false);
      toast.error(errMsg);
    })();
    return () => {
      cancelled = true;
    };
    // usersList used only for error fallback; omit from deps to avoid toast spam on list refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminBookForUserId, userType, equipmentDetail?.equipment_id, selectedEquipment?.id]);

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
        setEquipmentDeptWalletBalance({ ...res.data, department_id: res.data.department_id ?? null });
      } else {
        setEquipmentDeptWalletBalance(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [equipmentDetail?.equipment_id, selectedEquipment?.id, adminManageMode, adminBookForUserId, userType, isCalculateChargesFlow, walletBalanceRefreshTick]);

  // Recharge or wallet-link approval may happen in another tab: re-check the wallet when the user comes back.
  useEffect(() => {
    let last = Date.now();
    const onFocus = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < 30_000) return;
      last = Date.now();
      setWalletBalanceRefreshTick((t) => t + 1);
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  // Weekly / monthly minutes quota for the visible week (end users, or staff booking for a selected user).
  const quotaWeekKey = format(startOfWeek(currentWeekStart, { weekStartsOn: 1 }), "yyyy-MM-dd");
  useEffect(() => {
    const equipmentId = equipmentDetail?.equipment_id ?? selectedEquipment?.id;
    const staffBookingForUser = adminManageMode === "book" && !!adminBookForUserId;
    const quotaApplicable =
      !!equipmentId &&
      !!apiClient.getToken() &&
      !isCalculateChargesFlow &&
      !isTemplateFlow &&
      !isProformaFlow &&
      !repeatSourceBooking &&
      (isEndUserBookingType(userType) || staffBookingForUser);
    if (!quotaApplicable) {
      setBookingQuota(null);
      return;
    }
    let cancelled = false;
    void apiClient
      .getMyBookingQuota(equipmentId!, quotaReferenceDate(startOfWeek(currentWeekStart, { weekStartsOn: 1 })), staffBookingForUser ? adminBookForUserId : undefined)
      .then((res) => {
        if (!cancelled) setBookingQuota(res.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setBookingQuota(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipmentDetail?.equipment_id, selectedEquipment?.id, quotaWeekKey, userType, adminManageMode, adminBookForUserId, isCalculateChargesFlow, isTemplateFlow, isProformaFlow, !!repeatSourceBooking, quotaRefreshTick]);

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

  // Change slot status opens on the current week; afterwards only a double-click / double-tap changes the week.
  const statusDefaultWeekAppliedRef = useRef<string | null>(null);
  useEffect(() => {
    if (adminManageMode !== "status" || !selectedEquipment?.id) {
      statusDefaultWeekAppliedRef.current = null;
      return;
    }
    const key = String(selectedEquipment.id);
    if (statusDefaultWeekAppliedRef.current === key) return;
    statusDefaultWeekAppliedRef.current = key;
    setStatusChangePopupWeekStart((prev) => prev ?? startOfWeek(new Date(), { weekStartsOn: 1 }));
  }, [adminManageMode, selectedEquipment?.id]);

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
    if (slotVisibilityScope === "user" && isOutsideVisibilityWindow(s)) return false;
    if (newSlotStatus === "BOOKING_NOT_UTILIZED" || newSlotStatus === RESCHEDULE_OPERATION_VALUE)
      return s.status === "BOOKED" && (s.booking_status || "").toUpperCase() !== "COMPLETED";
    if (s.status === "BOOKED" && (s.booking_status || "").toUpperCase() === "COMPLETED") return false;
    return true;
  };

  /** Time rows of the change-slot-status week grid; in "Visible to users" mode rows entirely outside the user window are dropped. */
  const getStatusChangeWeekTimeRows = (): string[] => {
    const base =
      statusChangeSlotMasterTimes.length > 0
        ? statusChangeSlotMasterTimes
        : Array.from(
            new Set(
              (statusChangeSlots ?? [])
                .filter((s) => s.start_datetime || s.slot_open_time)
                .map((s) => timeKeyFromDailySlot(s))
            )
          ).sort();
    if (slotVisibilityScope !== "user" || !statusChangeSlots?.length) return base;
    return base.filter((time) => {
      const rowSlots = statusChangeSlots.filter((s) => timeKeyFromDailySlot(s) === time);
      return rowSlots.length === 0 || rowSlots.some((s) => !isOutsideVisibilityWindow(s));
    });
  };

  type StatusDragState =
    | { kind: "date"; anchor: string; mode: "add" | "remove"; base: string[]; moved: boolean }
    | { kind: "slot"; anchorDay: number; anchorRow: number; mode: "add" | "remove"; base: number[]; moved: boolean };
  const statusDragRef = useRef<StatusDragState | null>(null);
  /** Swallows the click that the browser fires after a drag ends, so it does not toggle the last cell back. */
  const statusDragSuppressClickRef = useRef(false);

  useEffect(() => {
    const endDrag = () => {
      const drag = statusDragRef.current;
      if (!drag) return;
      statusDragRef.current = null;
      if (drag.moved) {
        statusDragSuppressClickRef.current = true;
        window.setTimeout(() => {
          statusDragSuppressClickRef.current = false;
        }, 0);
      }
    };
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    return () => {
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, []);

  const statusDragTargetAt = (e: React.PointerEvent, selector: string): HTMLElement | null => {
    const hit = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    return hit?.closest<HTMLElement>(selector) ?? null;
  };

  const beginStatusDateDrag = (e: React.PointerEvent, dateStr: string) => {
    if (e.button !== 0 || e.pointerType === "touch") return;
    statusDragRef.current = {
      kind: "date",
      anchor: dateStr,
      mode: selectedDatesForStatus.includes(dateStr) ? "remove" : "add",
      base: selectedDatesForStatus,
      moved: false,
    };
  };

  const extendStatusDateDrag = (e: React.PointerEvent) => {
    const drag = statusDragRef.current;
    if (!drag || drag.kind !== "date" || (e.buttons & 1) === 0) return;
    const target = statusDragTargetAt(e, "[data-status-date]")?.dataset.statusDate;
    if (!target || (!drag.moved && target === drag.anchor)) return;
    if (!drag.moved) {
      drag.moved = true;
      if (statusChangeDateClickTimerRef.current) {
        clearTimeout(statusChangeDateClickTimerRef.current);
        statusChangeDateClickTimerRef.current = null;
      }
    }
    const [from, to] = drag.anchor <= target ? [drag.anchor, target] : [target, drag.anchor];
    const next = new Set(drag.base);
    eachDayOfInterval({ start: parseISO(from), end: parseISO(to) }).forEach((d) => {
      if (!isSameMonth(d, statusChangeMonthStart)) return;
      const ds = format(d, "yyyy-MM-dd");
      if (drag.mode === "add") next.add(ds);
      else next.delete(ds);
    });
    setSelectedDatesForStatus(Array.from(next).sort());
    setSelectedSlotIdsForStatus([]);
  };

  const beginStatusSlotDrag = (e: React.PointerEvent, dayOffset: number, rowIndex: number, slot?: DailySlot) => {
    if (e.button !== 0 || e.pointerType === "touch") return;
    statusDragRef.current = {
      kind: "slot",
      anchorDay: dayOffset,
      anchorRow: rowIndex,
      mode: slot && selectedSlotIdsForStatus.includes(slot.id) ? "remove" : "add",
      base: selectedSlotIdsForStatus,
      moved: false,
    };
  };

  const extendStatusSlotDrag = (e: React.PointerEvent) => {
    const drag = statusDragRef.current;
    if (!drag || drag.kind !== "slot" || (e.buttons & 1) === 0 || !statusChangePopupWeekStart) return;
    const cell = statusDragTargetAt(e, "[data-status-slot-cell]");
    if (!cell) return;
    const day = Number(cell.dataset.day);
    const row = Number(cell.dataset.row);
    if (Number.isNaN(day) || Number.isNaN(row)) return;
    if (!drag.moved && day === drag.anchorDay && row === drag.anchorRow) return;
    drag.moved = true;
    const rows = getStatusChangeWeekTimeRows();
    const next = new Set(drag.base);
    for (let r = Math.min(row, drag.anchorRow); r <= Math.max(row, drag.anchorRow); r++) {
      const time = rows[r];
      if (!time) continue;
      for (let d = Math.min(day, drag.anchorDay); d <= Math.max(day, drag.anchorDay); d++) {
        const slot = getStatusChangeSlotAt(addDays(statusChangePopupWeekStart, d), time);
        if (!slot || !statusChangeCanSelectSlot(slot)) continue;
        if (drag.mode === "add") next.add(slot.id);
        else next.delete(slot.id);
      }
    }
    setSelectedSlotIdsForStatus(Array.from(next));
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

  const fetchEquipmentDetail = useCallback(async (
    equipmentId: number | string,
    options?: { forUserType?: string | null },
  ) => {
    if (equipmentAccessBlockedRef.current) return;
    try {
      setLoadingEquipmentDetail(true);
      const response = await apiClient.getEquipmentDetailById(equipmentId, {
        forUserType: options?.forUserType || undefined,
      });
      
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
      
      // Store full equipment detail for slot processing.
      // Prefer viewer charge-profile type for booking UI gating (PRINT_3D / HOUR / …).
      setEquipmentDetail({
        ...eq,
        profile_type: String(eq.viewer_profile_type || eq.profile_type || ""),
        profile_type_display: String(
          eq.viewer_profile_type_display || eq.profile_type_display || eq.viewer_profile_type || eq.profile_type || "",
        ),
      });
      
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
      setAutoAllocateAlternative(
        (eq as unknown as { auto_allocate_alternative_default?: boolean }).auto_allocate_alternative_default === true,
      );

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
        setInputFieldValues(buildInitialInputValues(eq.input_fields));
        setSampleSets([]);
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

  // Reload input fields / viewer profile type when book-for-user or charge-estimate user type changes.
  const lastInputFieldsUserTypeRef = useRef<string>("__unset__");
  useEffect(() => {
    const equipmentId = selectedEquipment?.id ?? equipmentDetail?.equipment_id;
    if (equipmentId == null) return;
    let forUserType = "";
    if (isCalculateChargesFlow && chargeEstimateUserType) {
      forUserType = String(chargeEstimateUserType);
    } else if (adminManageMode === "book" && adminBookForUserId) {
      forUserType = String(
        adminBookForUserInfo?.user_type ||
          usersList.find((u) => String(u.id) === String(adminBookForUserId))?.user_type ||
          "",
      );
      // Wait until we know the selected user's type so we don't flash admin fields.
      if (!forUserType) return;
    }
    if (lastInputFieldsUserTypeRef.current === forUserType) return;
    const prev = lastInputFieldsUserTypeRef.current;
    lastInputFieldsUserTypeRef.current = forUserType;
    // Initial unset → empty: equipment just loaded for the logged-in user; skip duplicate fetch.
    if (prev === "__unset__" && !forUserType) return;
    fetchEquipmentDetail(equipmentId, { forUserType: forUserType || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    chargeEstimateUserType,
    isCalculateChargesFlow,
    adminManageMode,
    adminBookForUserId,
    adminBookForUserInfo?.user_type,
    selectedEquipment?.id,
    equipmentDetail?.equipment_id,
  ]);

  // Unsaved-booking draft (per user + equipment, this device). Restored once after the equipment's
  // defaults are applied; never for prefilled flows (template, repeat, rebook, assistant…) or staff.
  const draftEquipmentId = equipmentDetail?.equipment_id != null ? Number(equipmentDetail.equipment_id) : null;
  const draftEnabled =
    !!userId &&
    draftEquipmentId != null &&
    Number(selectedEquipment?.id) === draftEquipmentId &&
    !isTemplateFlow &&
    !isCalculateChargesFlow &&
    !isProformaFlow &&
    !isEmbedFlow &&
    isEndUserBookingType(userType) &&
    bookingDraftAllowed(searchParams, { bookingForAnotherUser: !!adminBookForUserId, staff: false });
  const draftCheckedKeyRef = useRef<string | null>(null);
  const draftBaselineRef = useRef<Record<string, unknown> | null>(null);
  const captureDraftBaselineRef = useRef(false);

  useEffect(() => {
    if (!draftEnabled || loadingEquipmentDetail || !equipmentDetail || !userId || draftEquipmentId == null) return;
    const key = `${userId}:${draftEquipmentId}`;
    if (draftCheckedKeyRef.current === key) return;
    draftCheckedKeyRef.current = key;
    draftBaselineRef.current = { ...inputFieldValues };
    const draft = loadBookingDraft(userId, draftEquipmentId);
    if (!draft) {
      setRestoredDraft(null);
      return;
    }
    const fieldKeys = (equipmentDetail.input_fields ?? []).map((f: any) => String(f.field_key || "")).filter(Boolean);
    const restoredInputs = draftInputsForFields(draft, fieldKeys);
    setInputFieldValues((prev) => ({ ...prev, ...(restoredInputs as Record<string, string | boolean | string[] | number>) }));
    if (sampleSetsAllowedFor(equipmentDetail) && draft.sampleSets.length > 0) {
      setSampleSets(draft.sampleSets as SampleSetValues[]);
    }
    const o = draft.options;
    if (typeof o.auto_slot_selection === "boolean") setAutoSlotSelection(o.auto_slot_selection);
    if (typeof o.book_any_available_slots === "boolean") setBookAnyAvailableSlots(o.book_any_available_slots);
    if (typeof o.book_even_if_single_slot_available === "boolean") setBookEvenIfSingleSlotAvailable(o.book_even_if_single_slot_available);
    if (typeof o.waitlist_on_failure === "boolean") setWaitlistIntentMode(o.waitlist_on_failure);
    if (typeof o.auto_allocate_alternative === "boolean") setAutoAllocateAlternative(o.auto_allocate_alternative);
    if (typeof o.sample_return_after_analysis === "boolean") setSampleReturnAfterAnalysis(o.sample_return_after_analysis);
    if (typeof o.atmosphere_sensitive_sample === "boolean") setAtmosphereSensitiveSample(o.atmosphere_sensitive_sample);
    if (o.research_workspace && !researchWorkspaceFromUrl) setResearchWorkspaceId(o.research_workspace);
    setRestoredDraft(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftEnabled, loadingEquipmentDetail, equipmentDetail?.equipment_id, userId, draftEquipmentId]);

  useEffect(() => {
    if (!draftEnabled || !userId || draftEquipmentId == null) return;
    if (draftCheckedKeyRef.current !== `${userId}:${draftEquipmentId}`) return;
    if (captureDraftBaselineRef.current) {
      captureDraftBaselineRef.current = false;
      draftBaselineRef.current = { ...inputFieldValues };
      return;
    }
    const handle = window.setTimeout(() => {
      const content = {
        inputValues: { ...inputFieldValues },
        sampleSets: sampleSets as Array<Record<string, string | boolean | string[] | number | string[][]>>,
        options: {
          auto_slot_selection: autoSlotSelection,
          book_any_available_slots: bookAnyAvailableSlots,
          book_even_if_single_slot_available: bookEvenIfSingleSlotAvailable,
          waitlist_on_failure: waitlistIntentMode,
          auto_allocate_alternative: autoAllocateAlternative,
          sample_return_after_analysis: sampleReturnAfterAnalysis,
          atmosphere_sensitive_sample: atmosphereSensitiveSample,
          research_workspace: researchWorkspaceId,
        },
      };
      const baseline = (draftBaselineRef.current ?? {}) as Record<string, string | boolean | string[] | number>;
      if (draftMatchesDefaults(content, baseline)) {
        clearBookingDraft(userId, draftEquipmentId);
      } else {
        saveBookingDraft(userId, draftEquipmentId, content);
      }
    }, 600);
    return () => window.clearTimeout(handle);
  }, [
    draftEnabled,
    userId,
    draftEquipmentId,
    inputFieldValues,
    sampleSets,
    autoSlotSelection,
    bookAnyAvailableSlots,
    bookEvenIfSingleSlotAvailable,
    waitlistIntentMode,
    autoAllocateAlternative,
    sampleReturnAfterAnalysis,
    atmosphereSensitiveSample,
    researchWorkspaceId,
  ]);

  const discardRestoredDraft = () => {
    if (userId && draftEquipmentId != null) clearBookingDraft(userId, draftEquipmentId);
    setRestoredDraft(null);
    resetBookingPageToDefaults();
    toast.success("Draft discarded.");
  };

  const handleEquipmentSelect = useCallback((equipmentId: number | string) => {
    lastInputFieldsUserTypeRef.current = "";
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
    if (!userType || !userId) return;
    const viewerType = String(userType).toLowerCase();
    const viewerIsRepeatManager = viewerType === "admin" || viewerType === "manager";
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
      const bookingsRes = await apiClient.getBookings({ booking_id: bid, limit: 1 });
      if (cancelled) return;
      if (bookingsRes.error || !bookingsRes.data?.bookings?.length) {
        setRepeatSourceLoading(false);
        toast.error("Repeat source booking not found.");
        return;
      }
      const b = bookingsRes.data.bookings[0];
      const bookedByStaff = viewerIsRepeatManager && String(b.user) !== String(userId);
      const eligibilityRes = bookedByStaff ? null : await apiClient.getRepeatSampleEligibility(bid);
      if (cancelled) return;
      setRepeatSourceLoading(false);
      if (Number(b.equipment) !== Number(selectedEquipment.id)) {
        toast.error("Repeat booking must be for the same equipment.");
        return;
      }
      if (bookedByStaff) {
        if (String(b.status || "").toUpperCase() !== "COMPLETED") {
          toast.error("Only completed bookings can have a repeat sample.");
          return;
        }
        if ((b as { repeat_booking_already_created?: boolean }).repeat_booking_already_created) {
          toast.error("A repeat booking has already been created for this booking.");
          return;
        }
      } else if (!eligibilityRes?.data?.can_create_repeat) {
        toast.error(
          eligibilityRes?.data?.reason ||
            "Repeat samples are arranged by the Officer In Charge. Please visit the lab.",
        );
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
        bookable_from: eligibilityRes?.data?.bookable_from ?? null,
        extra_week_granted: !!eligibilityRes?.data?.extra_week_granted,
        booked_by_staff: bookedByStaff,
        user_label: bookedByStaff ? String(b.user_name || b.user_email || "").trim() || null : null,
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
      setLastFetchedWeek(null);
    })();
    return () => { cancelled = true; };
  }, [searchParams, selectedEquipment?.id, userType, userId]);

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
      setSampleSets([]);
      setChargeCalculated(false);
      setCalculatedCharge(null);
      setShowSlots(false);
    }
  }, [equipmentDetail]);

  // Equipment Group alternative: once the alternative's detail (and default inputs) are loaded,
  // apply the carried-over inputs and jump to the offered week — exactly once per handoff.
  const altFromParam = searchParams.get("alt_from");
  useEffect(() => {
    if (!altFromParam) {
      setAlternativeOf(null);
      return;
    }
    const eqId = equipmentDetail?.equipment_id;
    if (eqId == null) return;
    let prefill: GroupAltPrefill | null = null;
    try {
      const raw = sessionStorage.getItem(GROUP_ALT_PREFILL_KEY);
      prefill = raw ? (JSON.parse(raw) as GroupAltPrefill) : null;
    } catch {
      prefill = null;
    }
    if (!prefill || Number(prefill.equipment_id) !== Number(eqId)) return;
    try {
      sessionStorage.removeItem(GROUP_ALT_PREFILL_KEY);
    } catch {
      // ignore
    }
    if (String(prefill.from_equipment_id) !== String(altFromParam)) return;
    setInputFieldValues((prev) => ({ ...prev, ...prefill!.input_values }));
    setAlternativeOf({
      equipmentId: Number(prefill.from_equipment_id),
      name: prefill.from_name,
      forEquipmentId: Number(eqId),
    });
    try {
      setCurrentWeekStart(startOfWeek(parseISO(prefill.date), { weekStartsOn: 1 }));
    } catch {
      // keep current week
    }
  }, [altFromParam, equipmentDetail?.equipment_id]);

  // Booking Assistant deep links: `date=YYYY-MM-DD` opens that week, and `from=assistant` fills the
  // inputs the user already gave in chat — once per equipment/date handoff.
  const assistantDateParam = (searchParams.get("date") || "").trim();
  const fromAssistant = searchParams.get("from") === "assistant";
  const appliedAssistantKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const eqId = equipmentDetail?.equipment_id;
    if (eqId == null || altFromParam) return;
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(assistantDateParam);
    if (!validDate && !fromAssistant) return;
    const key = `${eqId}:${assistantDateParam}:${fromAssistant ? 1 : 0}`;
    if (appliedAssistantKeyRef.current === key) return;
    appliedAssistantKeyRef.current = key;
    if (validDate) {
      try {
        setCurrentWeekStart(startOfWeek(parseISO(assistantDateParam), { weekStartsOn: 1 }));
      } catch {
        // keep current week
      }
    }
    if (!fromAssistant) return;
    const prefill = takeBookingAssistantPrefill(Number(eqId));
    if (!prefill) return;
    const fields = equipmentDetail?.input_fields as Array<{ field_key?: string; field_type?: string; options?: unknown }>;
    const { carried, dropped } = sanitizeRebookInputValues(prefill.input_values, fields);
    if (Object.keys(carried).length === 0) return;
    const inputFields = equipmentDetail?.input_fields;
    // Deferred: the input_fields reset effect below runs after this one and would wipe the values.
    window.setTimeout(() => {
      setInputFieldValues((prev) => {
        const next: Record<string, unknown> = { ...prev, ...carried };
        applyTableRowSyncToValues(next, inputFields);
        return next as Record<string, string | boolean | string[] | number>;
      });
      setChargeCalculated(false);
      setCalculatedCharge(null);
      lastCalculatedValuesRef.current = "";
      toast.success("Details from Booking Assistant filled in. Complete the remaining fields and pick your slot.");
      if (dropped.length > 0) {
        toast.info(`Some details no longer match this equipment's options and were reset: ${dropped.join(", ")}.`);
      }
    }, 0);
  }, [assistantDateParam, fromAssistant, altFromParam, equipmentDetail?.equipment_id, equipmentDetail?.input_fields]);

  // One-click rebooking: copy inputs from any of the user's earlier bookings (any status) or
  // waitlist requests on the same equipment. Unlike repeatOf, inputs stay editable and charges
  // are recalculated normally, so the user can go straight to slot selection.
  const rebookOfParam = (searchParams.get("rebookOf") || "").trim();
  const appliedRebookKeyRef = useRef<string | null>(null);
  const [rebookSource, setRebookSource] = useState<{ equipmentId: number; label: string } | null>(null);
  useEffect(() => {
    if (!/^(\d+|wl-\d+)$/.test(rebookOfParam) || searchParams.get("repeatOf")) {
      setRebookSource(null);
      return;
    }
    const eqId = equipmentDetail?.equipment_id;
    if (eqId == null || userId == null) return;
    const key = `${rebookOfParam}:${eqId}`;
    if (appliedRebookKeyRef.current === key) return;
    let cancelled = false;
    (async () => {
      let source: RebookPrefill | null = null;
      if (rebookOfParam.startsWith("wl-")) {
        source = readStashedRebookPrefill(rebookOfParam, Number(eqId));
        if (!source) {
          appliedRebookKeyRef.current = key;
          toast.error("Could not load the waitlist request to book again. Open it from My Bookings and try again.");
          return;
        }
      } else {
        const res = await apiClient.getBookings({ booking_id: Number(rebookOfParam), limit: 1 });
        if (cancelled) return;
        const b = res.data?.bookings?.[0] as
          | {
              equipment: number;
              user: number;
              virtual_booking_id?: string | null;
              input_values?: Record<string, unknown>;
              atmosphere_sensitive_sample?: boolean;
              sample_return_after_analysis?: boolean;
            }
          | undefined;
        if (res.error || !b) {
          appliedRebookKeyRef.current = key;
          toast.error("The booking to book again was not found.");
          return;
        }
        if (Number(b.equipment) !== Number(eqId)) return;
        source = {
          source: rebookOfParam,
          equipment_id: Number(b.equipment),
          user_id: Number(b.user),
          label: (b.virtual_booking_id || "").trim() || `#${rebookOfParam}`,
          input_values: b.input_values || {},
          atmosphere_sensitive_sample: b.atmosphere_sensitive_sample,
          sample_return_after_analysis: b.sample_return_after_analysis,
        };
      }
      if (cancelled) return;
      appliedRebookKeyRef.current = key;
      if (source.user_id != null && Number(source.user_id) !== Number(userId)) {
        toast.error("You can only book again from your own bookings.");
        return;
      }
      const isPrint3d = equipmentDetail?.profile_type === "PRINT_3D";
      const rebookFields = equipmentDetail?.input_fields as Array<{ field_key?: string; field_type?: string; options?: unknown }>;
      const { carried, dropped } = sanitizeRebookInputValues(
        withoutSampleSets(source.input_values),
        rebookFields,
        // 3D print weight/material/time come from a fresh STL analysis, never from the old booking.
        isPrint3d ? { skipKeys: new Set(["A", "B", "C"]) } : undefined
      );
      setInputFieldValues((prev) => {
        const next: Record<string, unknown> = { ...prev, ...carried };
        applyTableRowSyncToValues(next, equipmentDetail?.input_fields);
        return next as Record<string, string | boolean | string[] | number>;
      });
      const rebookSets = isPrint3d
        ? []
        : readSampleSets(source.input_values)
            .map((s) => sanitizeRebookInputValues(s, rebookFields).carried as SampleSetValues)
            .filter((s) => Object.keys(s).length > 0);
      const rebookSetsAllowed = equipmentDetail?.allow_multiple_sample_sets !== false;
      setSampleSets(rebookSetsAllowed ? rebookSets : []);
      setChargeCalculated(false);
      setCalculatedCharge(null);
      lastCalculatedValuesRef.current = "";
      setAtmosphereSensitiveSample(
        source.atmosphere_sensitive_sample === true && equipmentDetail?.atmosphere_sensitive_sample_enabled === true
      );
      if (typeof source.sample_return_after_analysis === "boolean") {
        setSampleReturnAfterAnalysis(source.sample_return_after_analysis);
      }
      const label = source.label;
      setRebookSource({ equipmentId: Number(eqId), label });
      toast.success(
        isPrint3d
          ? `Details copied from ${label}. Upload your STL file(s) again, then choose your slots.`
          : `Details copied from ${label}. Charges are recalculated automatically; review them and choose your slots.`
      );
      if (dropped.length > 0) {
        toast.info(
          `Some inputs from ${label} no longer match this equipment's current options and were reset: ${dropped.join(", ")}.`
        );
      }
      if (!rebookSetsAllowed && rebookSets.length > 0) {
        toast.info(
          `Only sample set 1 from ${label} was copied: this equipment no longer accepts samples with different parameters.`
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    rebookOfParam,
    searchParams,
    equipmentDetail?.equipment_id,
    equipmentDetail?.input_fields,
    equipmentDetail?.profile_type,
    equipmentDetail?.atmosphere_sensitive_sample_enabled,
    equipmentDetail?.allow_multiple_sample_sets,
    userId,
  ]);

  // Booking templates: the user's named inputs + booking options for this equipment.
  const [bookingTemplates, setBookingTemplates] = useState<BookingTemplate[]>([]);
  const [appliedTemplate, setAppliedTemplate] = useState<{
    id: number;
    name: string;
    /** The template's consented "if my slot is taken" auto mode, or "ask". */
    fallbackMode: TemplateIfSlotTaken;
    hasPreferredSlot: boolean;
  } | null>(null);
  /** Booking page: the user kept the template's fallback (false once another fallback is chosen). */
  const [useTemplateFallback, setUseTemplateFallback] = useState(true);
  /** Booking page: slots come from the template's preferred slot (until the user picks or auto-selects instead). */
  const [preferredSlotChosen, setPreferredSlotChosen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  /** Template flow: the server's advice for the details being edited (what would fail or change at booking). */
  const [templateHealth, setTemplateHealth] = useState<TemplateHealth | null>(null);
  const [checkingTemplateHealth, setCheckingTemplateHealth] = useState(false);
  const templatePickerAvailable =
    !isCalculateChargesFlow && !isProformaFlow && !isTemplateFlow && !repeatSourceBooking && userId != null;
  const appliedTemplateOptionsRef = useRef<BookingTemplateOptions | null>(null);
  // Template preferred slot: edited in the template flow; resolved and pre-selected when a template is loaded.
  const [preferredSlotDraft, setPreferredSlotDraft] = useState<PreferredSlotDraft>(emptyPreferredSlotDraft);
  const [preferredSlotResolution, setPreferredSlotResolution] = useState<TemplatePreferredSlotResolution | null>(null);
  const [resolvingPreferredSlot, setResolvingPreferredSlot] = useState(false);
  const [preferredResolveRequest, setPreferredResolveRequest] = useState<{ templateId: number; nonce: number } | null>(null);
  const [pendingPreselect, setPendingPreselect] = useState<{ date: string; slotIds: number[] } | null>(null);
  // Booking-form parameters of the last book attempt, for "save as template" in the result dialog.
  const [attemptSnapshot, setAttemptSnapshot] = useState<BookingAttemptSnapshot | null>(null);
  const [attemptSlotFallback, setAttemptSlotFallback] = useState<TemplateSlotFallback | null>(null);
  const [attemptSlotAlternatives, setAttemptSlotAlternatives] = useState<TemplateSlotAlternative[] | null>(null);

  // The availability effects above reset slot fallbacks / waitlist as the week's free slots change
  // (e.g. none until the booking window opens); re-apply the template's choice once it can apply.
  useEffect(() => {
    const o = appliedTemplateOptionsRef.current;
    if (!o || bookingAsExternalTarget || isTemplateFlow) return;
    if (hasBookableSlotInSelectedWeek) {
      if (typeof o.book_any_available_slots === "boolean") {
        setBookAnyAvailableSlots(o.book_any_available_slots);
        setBookEvenIfSingleSlotAvailable(o.book_any_available_slots && o.book_even_if_single_slot_available === true);
      }
      setWaitlistIntentMode(false);
    } else {
      setBookAnyAvailableSlots(false);
      setBookEvenIfSingleSlotAvailable(false);
      if (typeof o.waitlist_on_failure === "boolean") setWaitlistIntentMode(o.waitlist_on_failure);
    }
  }, [hasBookableSlotInSelectedWeek, bookingAsExternalTarget, isTemplateFlow, appliedTemplate]);

  useEffect(() => {
    const eqId = equipmentDetail?.equipment_id;
    if (!templatePickerAvailable || eqId == null) {
      setBookingTemplates([]);
      return;
    }
    let cancelled = false;
    apiClient.listBookingTemplates(eqId, { health: true }).then((res) => {
      if (!cancelled) setBookingTemplates(res.data?.templates ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [templatePickerAvailable, equipmentDetail?.equipment_id]);

  const applyBookingTemplate = useCallback(
    (template: BookingTemplate, opts?: { resolvePreferredSlot?: boolean }): { dropped: string[]; notified: boolean } => {
      const isPrint3d = equipmentDetail?.profile_type === "PRINT_3D";
      const templateFields = equipmentDetail?.input_fields as Array<{ field_key?: string; field_type?: string; options?: unknown }>;
      const health = isTemplateFlow ? null : template.health ?? null;
      const { values: templateValues, adjusted } = clampTemplateValues(template.input_values || {}, health?.issues);
      const { carried, dropped } = sanitizeRebookInputValues(
        withoutSampleSets(templateValues),
        templateFields,
        isPrint3d ? { skipKeys: new Set(["A", "B", "C"]) } : undefined
      );
      setInputFieldValues((prev) => {
        const next: Record<string, unknown> = { ...prev, ...carried };
        applyTableRowSyncToValues(next, equipmentDetail?.input_fields);
        return next as Record<string, string | boolean | string[] | number>;
      });
      const templateSets = isPrint3d
        ? []
        : readSampleSets(templateValues)
            .map((s) => sanitizeRebookInputValues(s, templateFields).carried as SampleSetValues)
            .filter((s) => Object.keys(s).length > 0);
      const dropTemplateSets =
        equipmentDetail?.allow_multiple_sample_sets === false && !isTemplateFlow && templateSets.length > 0;
      setSampleSets(dropTemplateSets ? [] : templateSets);
      setChargeCalculated(false);
      setCalculatedCharge(null);
      lastCalculatedValuesRef.current = "";
      const { options: o, ifSlotTaken } = normaliseTemplateSlotOptions(template);
      const fallbackMode = ifSlotTaken !== "ask" && template.if_slot_taken_consented_at ? ifSlotTaken : "ask";
      if (template.preferred_slot) setAutoSlotSelection(false);
      else if (typeof o.auto_slot_selection === "boolean") setAutoSlotSelection(o.auto_slot_selection);
      if (typeof o.book_any_available_slots === "boolean") setBookAnyAvailableSlots(o.book_any_available_slots);
      if (typeof o.book_even_if_single_slot_available === "boolean") {
        setBookEvenIfSingleSlotAvailable(o.book_any_available_slots !== false && o.book_even_if_single_slot_available);
      }
      if (typeof o.waitlist_on_failure === "boolean") setWaitlistIntentMode(o.waitlist_on_failure);
      if (typeof o.auto_allocate_alternative === "boolean") setAutoAllocateAlternative(o.auto_allocate_alternative);
      if (typeof o.sample_return_after_analysis === "boolean") setSampleReturnAfterAnalysis(o.sample_return_after_analysis);
      if (typeof o.atmosphere_sensitive_sample === "boolean") {
        setAtmosphereSensitiveSample(
          o.atmosphere_sensitive_sample && equipmentDetail?.atmosphere_sensitive_sample_enabled === true
        );
      }
      // A workspace chosen in the link from My Research wins over the template's.
      if (o.research_workspace !== undefined && !researchWorkspaceFromUrl) {
        setResearchWorkspaceId(o.research_workspace || null);
      }
      appliedTemplateOptionsRef.current = o;
      setAppliedTemplate({
        id: template.id,
        name: template.name,
        fallbackMode,
        hasPreferredSlot: !!template.preferred_slot,
      });
      setUseTemplateFallback(true);
      setPreferredSlotChosen(!!template.preferred_slot);
      setPreferredSlotResolution(null);
      setPendingPreselect(null);
      if (isTemplateFlow) {
        setPreferredSlotDraft(draftFromTemplate({ ...template, if_slot_taken: ifSlotTaken }));
      } else if (template.preferred_slot && opts?.resolvePreferredSlot !== false) {
        setPreferredResolveRequest({ templateId: template.id, nonce: Date.now() });
      } else {
        setPreferredResolveRequest(null);
      }
      const notice = templateApplyNotice(template.name, {
        adjusted: dropTemplateSets ? adjusted.filter((a) => a.set === 1) : adjusted,
        dropped,
        setsDropped: dropTemplateSets,
        health,
      });
      if (notice) {
        (notice.tone === "warning" ? toast.warning : toast.info)(notice.message, { duration: 12000 });
      }
      return { dropped, notified: !!notice };
    },
    [equipmentDetail, researchWorkspaceFromUrl, isTemplateFlow]
  );

  // Once the template's charge is known, ask the server for the next occurrence of its preferred slot.
  useEffect(() => {
    if (!preferredResolveRequest || !chargeCalculated || !calculatedCharge || !equipmentDetail) return;
    if (appliedTemplate?.id !== preferredResolveRequest.templateId) {
      setPreferredResolveRequest(null);
      return;
    }
    const needed = slotsRequiredForMinutes(calculatedCharge.total_time_minutes, equipmentDetail);
    const slotCount = needed != null && needed <= 24 ? needed : undefined;
    const { templateId } = preferredResolveRequest;
    setPreferredResolveRequest(null);
    setResolvingPreferredSlot(true);
    apiClient
      .getBookingTemplatePreferredSlot(templateId, slotCount)
      .then((res) => {
        if (res.error || !res.data) {
          setPreferredSlotResolution(null);
          return;
        }
        const r = res.data;
        setPreferredSlotResolution(r);
        const target = r.status === "available" ? r : r.auto_next;
        if (target?.slot_ids?.length && target.date) {
          setPendingPreselect({ date: target.date, slotIds: target.slot_ids });
        }
      })
      .finally(() => setResolvingPreferredSlot(false));
  }, [preferredResolveRequest, chargeCalculated, calculatedCharge, equipmentDetail, appliedTemplate?.id]);

  // Move to the week of a pre-selected slot run and select it once that week's slots are loaded.
  useEffect(() => {
    if (!pendingPreselect || !equipmentDetail) return;
    const targetWeek = startOfWeek(parseISO(pendingPreselect.date), { weekStartsOn: 1 });
    if (!isSameDay(targetWeek, currentWeekStart)) {
      setCurrentWeekStart(targetWeek);
      return;
    }
    // Charge (re)calculation clears the selection, so select only once it has settled.
    if (isSlotsWeekViewLoading || !chargeCalculated) return;
    const byId = new Map((equipmentDetail.daily_slots || []).map((s) => [s.id, s]));
    const run = pendingPreselect.slotIds.map((id) => byId.get(id));
    setPendingPreselect(null);
    const free = run.every((s) => s && s.status !== "BOOKED" && !s.booking_id);
    if (!free) {
      toast.warning("That slot was taken while the page loaded. Choose another slot or reload the template.");
      return;
    }
    setSelectedSlots(
      run.map((s) => ({
        date: startOfDay(parseISO(s!.date)),
        time: timeKeyFromDailySlot(s!),
        isBooked: false,
        slotId: s!.id,
        slotData: s!,
      }))
    );
  }, [pendingPreselect, equipmentDetail, currentWeekStart, isSlotsWeekViewLoading, chargeCalculated]);

  useEffect(() => {
    if (bookingResultDialog.open) return;
    setAttemptSnapshot(null);
    setAttemptSlotFallback(null);
    setAttemptSlotAlternatives(null);
  }, [bookingResultDialog.open]);

  const pickPreferredAlternative = (alternative: TemplateSlotAlternative) => {
    setPendingPreselect({ date: alternative.date, slotIds: alternative.slot_ids });
  };

  const refreshPreferredSlot = () => {
    if (appliedTemplate) setPreferredResolveRequest({ templateId: appliedTemplate.id, nonce: Date.now() });
  };

  // Booking page: one "how are slots chosen" and one "if they are taken" choice, reflecting the applied template.
  const templateHasPreferredSlot = !isTemplateFlow && !!appliedTemplate?.hasPreferredSlot;
  const bookingSlotChoice: SlotChoice = autoSlotSelection
    ? "auto"
    : templateHasPreferredSlot && preferredSlotChosen
    ? "preferred"
    : "manual";
  const changeBookingSlotChoice = (next: SlotChoice) => {
    const wasPreferred = bookingSlotChoice === "preferred";
    setPreferredSlotChosen(next === "preferred");
    setAutoSlotSelection(next === "auto");
    if (next === "preferred") {
      setSelectedSlots([]);
      refreshPreferredSlot();
    } else if (next === "auto" && wasPreferred) {
      setSelectedSlots([]);
    }
  };
  const templateFallbackMode =
    !isTemplateFlow && appliedTemplate && appliedTemplate.fallbackMode !== "ask" ? appliedTemplate.fallbackMode : null;
  const bookingSlotFallback = slotFallbackFrom({
    bookAny: bookAnyAvailableSlots,
    single: bookEvenIfSingleSlotAvailable,
    templateMode: useTemplateFallback ? templateFallbackMode : null,
  });
  const bookingFallbackChoices: SlotFallback[] = hasBookableSlotInSelectedWeek
    ? [
        "none",
        ...(templateFallbackMode ? [fallbackForMode(templateFallbackMode)] : []),
        ...(bookingAsExternalTarget ? [] : (["any_slots", "any_slots_or_one"] as const)),
      ]
    : ["none"];
  const changeBookingSlotFallback = (next: SlotFallback) => {
    const flags = flagsForFallback(next);
    setBookAnyAvailableSlots(flags.bookAny);
    setBookEvenIfSingleSlotAvailable(flags.single);
    setUseTemplateFallback(isTemplateFallback(next));
  };

  const handleApplyTemplate = (templateId: string) => {
    if (templateId === NO_TEMPLATE_VALUE) {
      resetBookingPageToDefaults();
      toast.info("Template cleared. The form is back to its default values.");
      return;
    }
    const template = bookingTemplates.find((t) => String(t.id) === templateId);
    if (!template) return;
    if (!applyBookingTemplate(template).notified) {
      toast.success(`Template "${template.name}" applied. Charges are recalculated; choose your slots.`);
    }
  };

  // On landing, fill the form from the first template in the list (sorted by name), unless the URL
  // already prefills the form or staff are booking for another user.
  const repeatOfParam = (searchParams.get("repeatOf") || "").trim();
  const autoAppliedTemplateEqRef = useRef<number | null>(null);
  useEffect(() => {
    const eqId = equipmentDetail?.equipment_id;
    if (eqId == null || autoAppliedTemplateEqRef.current === eqId) return;
    if (!templatePickerAvailable || bookingForAnotherUser) return;
    if (templateParam || rebookOfParam || altFromParam || repeatOfParam || fromAssistant) return;
    const first = bookingTemplates.find((t) => Number(t.equipment) === Number(eqId));
    if (!first) return;
    autoAppliedTemplateEqRef.current = eqId;
    if (!applyBookingTemplate(first).notified) {
      toast.success(`Template "${first.name}" applied automatically. Pick another from the list if needed, then choose your slots.`);
    }
  }, [
    bookingTemplates,
    equipmentDetail?.equipment_id,
    templatePickerAvailable,
    bookingForAnotherUser,
    templateParam,
    rebookOfParam,
    altFromParam,
    repeatOfParam,
    fromAssistant,
    applyBookingTemplate,
  ]);

  // ?template=<id> on the booking page (or ?template_id=<id> when editing) fills the form once.
  const appliedTemplateKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const templateId = Number(templateParam);
    const eqId = equipmentDetail?.equipment_id;
    if (!templateId || eqId == null || userId == null) return;
    const key = `${templateId}:${eqId}`;
    if (appliedTemplateKeyRef.current === key) return;
    let cancelled = false;
    (async () => {
      const res = await apiClient.getBookingTemplate(templateId);
      if (cancelled) return;
      appliedTemplateKeyRef.current = key;
      if (res.error || !res.data) {
        toast.error("The booking template was not found.");
        return;
      }
      if (Number(res.data.equipment) !== Number(eqId)) {
        toast.error("This booking template belongs to another equipment.");
        return;
      }
      const { notified } = applyBookingTemplate(res.data);
      if (isTemplateFlow) {
        setTemplateName(res.data.name);
        if (res.data.health) setTemplateHealth(res.data.health);
      } else if (!notified) {
        toast.success(`Template "${res.data.name}" applied. Charges are recalculated; choose your slots.`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [templateParam, equipmentDetail?.equipment_id, userId, isTemplateFlow, applyBookingTemplate]);

  const handleSaveTemplate = async () => {
    const eqId = equipmentDetail?.equipment_id;
    if (eqId == null) return;
    const name = templateName.trim();
    if (!name) {
      toast.error("Give the template a name.");
      return;
    }
    const options: BookingTemplateOptions = {
      auto_slot_selection: autoSlotSelection && !preferredSlotDraft.enabled,
      book_any_available_slots: bookAnyAvailableSlots,
      book_even_if_single_slot_available: bookAnyAvailableSlots && bookEvenIfSingleSlotAvailable,
      waitlist_on_failure: waitlistIntentMode,
      auto_allocate_alternative: autoAllocateAlternative,
      sample_return_after_analysis: sampleReturnAfterAnalysis,
      atmosphere_sensitive_sample: atmosphereSensitiveSample,
      research_workspace: researchWorkspaceId,
    };
    const slotDraft = bookAnyAvailableSlots ? { ...preferredSlotDraft, ifSlotTaken: "ask" as const } : preferredSlotDraft;
    const preferredSlotProblem = preferredSlotDraftProblem(slotDraft, weeklyTemplateSlotRows);
    if (preferredSlotProblem) {
      toast.error(preferredSlotProblem);
      return;
    }
    if (draftNeedsConsent(slotDraft)) {
      toast.error("Tick the consent box to let the portal book the next free time, or choose \"Let me choose again\".");
      return;
    }
    const body = {
      name,
      input_values: withSampleSets({ ...inputFieldValues }, sampleSets),
      options,
      ...draftToBody(slotDraft),
    };
    setSavingTemplate(true);
    try {
      const res = editTemplateId
        ? await apiClient.updateBookingTemplate(editTemplateId, body)
        : await apiClient.createBookingTemplate({ equipment: eqId, ...body });
      if (res.error || !res.data) {
        toast.error(res.error || "Could not save the template.");
        return;
      }
      const saved = templateHealthBadge(res.data.health);
      if (saved?.tone === "attention") {
        toast.warning(`Template "${res.data.name}" saved, but it needs attention before booking: ${saved.issue.message}`, {
          duration: 10000,
        });
      } else {
        toast.success(`Template "${res.data.name}" saved. Choose it on the booking page to fill these details.`);
      }
      navigate(templateReturnTo ?? `/equipment/${eqId}?panel=booking_templates`);
    } finally {
      setSavingTemplate(false);
    }
  };

  // Template flow: re-check the details against the equipment's current limits a moment after each change.
  const templateCheckBody = useMemo(() => {
    const eqId = equipmentDetail?.equipment_id;
    if (!isTemplateFlow || eqId == null) return null;
    return JSON.stringify({
      equipment: eqId,
      input_values: withSampleSets({ ...inputFieldValues }, sampleSets),
      options: { atmosphere_sensitive_sample: atmosphereSensitiveSample, research_workspace: researchWorkspaceId },
      preferred_slot: draftToBody(preferredSlotDraft).preferred_slot ?? null,
    });
  }, [
    isTemplateFlow,
    equipmentDetail?.equipment_id,
    inputFieldValues,
    sampleSets,
    atmosphereSensitiveSample,
    researchWorkspaceId,
    preferredSlotDraft,
  ]);
  useEffect(() => {
    if (!templateCheckBody) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setCheckingTemplateHealth(true);
      apiClient
        .checkBookingTemplate(JSON.parse(templateCheckBody))
        .then((res) => {
          if (!cancelled && res.data) setTemplateHealth(res.data);
        })
        .finally(() => {
          if (!cancelled) setCheckingTemplateHealth(false);
        });
    }, 800);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [templateCheckBody]);

  // Template flow opened from "Fix": go to the input the problem is about once the template is loaded.
  const fixFieldParam = isTemplateFlow ? searchParams.get("fix") : null;
  const fixFocusedRef = useRef(false);
  useEffect(() => {
    if (!fixFieldParam || fixFocusedRef.current || !templateName || !equipmentDetail) return;
    fixFocusedRef.current = true;
    const set = templateHealth?.issues.find((i) => i.field === fixFieldParam)?.set ?? null;
    window.setTimeout(() => focusTemplateField(fixFieldParam, set), 400);
  }, [fixFieldParam, templateName, equipmentDetail, templateHealth]);

  useEffect(() => {
    if (!isCalculateChargesFlow || !equipmentDetail) return;
    const codes = chargeEstimateOptions.map((o) => o.code);
    const loggedInType = normalizeUserTypeCode(userType);
    const initial =
      loggedInType && codes.includes(loggedInType) ? loggedInType : codes[0];
    setChargeEstimateUserType((prev) => (prev && codes.includes(prev) ? prev : initial));
  }, [isCalculateChargesFlow, equipmentDetail, userType, chargeEstimateOptions]);

  const chargeCategorySummaryRows = useMemo(
    () => (isCalculateChargesFlow ? buildChargeCategorySummaryRows(equipmentDetail) : []),
    [isCalculateChargesFlow, equipmentDetail]
  );

  // Collapse Charge Calculation once charges are ready (and when slots appear); Sample Information stays expanded.
  useEffect(() => {
    if (!chargeCalculated) return;
    if (showSlots || isCalculateChargesFlow || isProformaFlow || isTemplateFlow) {
      setChargeCalcExpanded(false);
    }
  }, [chargeCalculated, showSlots, isCalculateChargesFlow, isProformaFlow, isTemplateFlow]);

  // Calculate charge based on input fields
  const calculateCharge = useCallback(async () => {
    if (!selectedEquipment || !equipmentDetail) {
      return;
    }
    if (repeatSourceBooking) {
      return;
    }
    const offerChargeErrorHelp = (message: string, fieldLabels?: string[]) => {
      const missing =
        fieldLabels ??
        missingRequiredFields(
          equipmentDetail.input_fields as Array<{ field_key?: string; field_label?: string; is_required?: boolean }> | undefined,
          inputFieldValues,
          calculateHiddenFieldKeys,
        ).map((f) => f.label);
      offerAssistantHelp({
        code: "charge_error",
        equipmentId: Number(selectedEquipment.id),
        equipmentName: selectedEquipment.name,
        message,
        missingFields: missing,
      });
    };

    if (isCalculateChargesFlow && !chargeEstimateUserType) {
      return;
    }

    if (!isCalculateChargesFlow && (adminManageMode === 'status' || (isAdminOrOIC() && !adminBookForUserId))) {
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
      urgent: isUrgentTypeBHoldMode,
      sampleSets,
    });
    if (lastCalculatedValuesRef.current === currentValuesHash) {
      return; // Already calculated for these values
    }

    // Validate required input fields before calculating (only if input fields exist)
    // Note: This validation is already done in the useEffect, but keeping as a safety check
    if (equipmentDetail.input_fields && equipmentDetail.input_fields.length > 0) {
      const requiredFields = equipmentDetail.input_fields.filter(
        (field: any) => field.is_required && !calculateHiddenFieldKeys.has(String(field.field_key || "").trim())
      );
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
            const formulaMax = resolveDynamicFormulaMax(field, inputFieldValues, equipmentDetail);
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
      // Any other shown number outside its limits: the box itself says what to change.
      if (numericInputLimitError || sampleSetFieldError) return;
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
          ...(isUrgentTypeBHoldMode ? { urgent: true } : {}),
          ...(sampleSets.length > 0 && equipmentDetail.profile_type !== "PRINT_3D" ? { sample_sets: sampleSets } : {}),
        }
      );

      if (response.error) {
        if (requestSeq !== chargeRequestSeqRef.current) return;
        setChargeCalculationFailed(true);
        setChargeCalculated(false);
        setCalculatedCharge(null);
        setShowSlots(false);
        lastCalculatedValuesRef.current = currentValuesHash;
        setChargeErrorRaw({ message: String(response.error), network: false });
        if (isAdminOrOIC() || isCalculateChargesFlow) {
          toast.error(response.error);
        }
        offerChargeErrorHelp(`Charge calculation failed: ${response.error}`);
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
          setChargeErrorRaw({ message: `"${labels}" must be at least 1. Please update Step 1.`, network: false });
          offerChargeErrorHelp(`Charge calculation failed: "${labels}" must be at least 1.`, abFields.map((f: any) => String(f.field_label || f.field_key)));
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
          pricing_profile: response.data.pricing_profile,
          applied_profile: response.data.applied_profile,
          normal_charge: response.data.normal_charge ?? null,
          applied_charge: response.data.applied_charge,
          reward: response.data.reward,
        });
        setChargeCalculated(true);
        setShowSlots(!isProformaFlow && !isCalculateChargesFlow && !isTemplateFlow);
        setChargeCalculationFailed(false); // Reset failed state on success
        setChargeErrorRaw(null);
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
      setChargeCalculationFailed(true);
      setChargeCalculated(false);
      setCalculatedCharge(null);
      setShowSlots(false);
      // Store the hash even on failure to prevent retrying with same values
      lastCalculatedValuesRef.current = currentValuesHash;
      offerChargeErrorHelp("Charge calculation failed");
      setChargeErrorRaw({ message: String(error?.message || ""), network: error instanceof TypeError });
    } finally {
      if (requestSeq === chargeRequestSeqRef.current) {
        setLoadingCharge(false);
      }
    }
  }, [selectedEquipment, equipmentDetail, inputFieldValues, sampleSets, loadingCharge, adminBookForUserId, repeatSourceBooking, searchParams, bookingAsExternalTarget, sampleReturnAfterAnalysis, rewardPointsToRedeem, printAnalysisId, printAnalysisBatchId, isCalculateChargesFlow, chargeEstimateUserType, isProformaFlow, isTemplateFlow, isUrgentTypeBHoldMode, adminManageMode, calculateHiddenFieldKeys, numericInputLimitError, sampleSetFieldError]);

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

    // Staff have no charge profile of their own: price only for a selected user (never in slot-status mode)
    if (!isCalculateChargesFlow && (adminManageMode === 'status' || (isAdminOrOIC() && !adminBookForUserId))) {
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
      ? Boolean(chargeEstimateUserType) &&
        inputsReadyForChargeEstimate(
          {
            ...equipmentDetail,
            input_fields: equipmentDetail.input_fields?.filter(
              (field) => !calculateHiddenFieldKeys.has(String(field?.field_key || "").trim())
            ),
          },
          inputFieldValues
        )
      : (!hasInputFields || allRequiredFilled);

    // Calculate charge when inputs are sufficient
    if (readyToCalculate && !sampleSetLimitError && !numericInputLimitError && !sampleSetFieldError) {
      const currentValuesHash = buildChargeCalculationHash({
        inputFieldValues,
        printAnalysisId,
        printAnalysisBatchId,
        sampleReturnAfterAnalysis: sampleReturnFlag,
        chargeEstimateUserType: isCalculateChargesFlow ? chargeEstimateUserType : null,
        urgent: isUrgentTypeBHoldMode,
        sampleSets,
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
  }, [inputFieldValues, sampleSets, sampleSetLimitError, numericInputLimitError, sampleSetFieldError, selectedEquipment, equipmentDetail, loadingCharge, chargeCalculated, chargeCalculationFailed, calculateCharge, adminManageMode, adminBookForUserId, repeatSourceBooking, repeatSourceLoading, searchParams, bookingAsExternalTarget, sampleReturnAfterAnalysis, printAnalysisId, printAnalysisBatchId, isCalculateChargesFlow, chargeEstimateUserType, calculateHiddenFieldKeys]);

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
        {
          urgentWeekExtension: allowUrgentWeekExtension,
          ...(repeatSourceBooking?.extra_week_granted
            ? { repeatSampleBookingId: repeatSourceBooking.real_booking_id }
            : {}),
        }
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
        toast.error("Could not load slots for this week. Please try again.");
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
  }, [selectedEquipment, currentWeekStart, loadingSlots, lastFetchedWeek, allowUrgentWeekExtension, repeatSourceBooking?.extra_week_granted, repeatSourceBooking?.real_booking_id]);

  // Next week's slots just opened: reload the window. Small random delay so open tabs don't all hit the API in the same second.
  const handleSlotsOpened = useCallback(() => {
    window.setTimeout(() => {
      void fetchSlotsForWeek(true);
    }, 500 + Math.floor(Math.random() * 3500));
  }, [fetchSlotsForWeek]);

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
    allowUrgentWeekExtension,
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
      if (isAdminOrOIC()) {
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
    if (isTemplateFlow || !chargeCalculated || !showSlots || !autoSlotSelection || selectedSlots.length > 0 || 
        !equipmentDetail || !equipmentDetail.daily_slots || equipmentDetail.daily_slots.length === 0 || 
        loadingSlots || !calculatedCharge || pendingPreselect || quotaBlock) {
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
      // Find the first available slot (admin/OIC: allow past and non-BOOKED)
      const availableSlot = equipmentDetail.daily_slots.find(slot => {
        const isBookedSlot = slot.status === "BOOKED" || !!slot.booking_id;
        if (isAdminOrOIC()) {
          if (isBookedSlot) return false;
        } else {
          if (!isDailySlotSelectableForUserBooking(slot)) return false;
        }
        const slotDate = startOfDay(parseISO(slot.date));
        const slotTime = timeKeyFromDailySlot(slot);
        const slotDateTime = new Date(slotDate);
        const [hours, minutes] = slotTime.split(':').map(Number);
        slotDateTime.setHours(hours, minutes || 0, 0, 0);
        return (isAdminOrOIC() || slotDateTime >= new Date()) && !isSlotBooked(slotDate, slotTime);
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

    // Try each available slot as a potential starting point (in chronological order). Admin/OIC: allow past and non-BOOKED.
    for (const slot of sortedDailySlots) {
      const isBookedSlot = slot.status === "BOOKED" || !!slot.booking_id;
      if (isAdminOrOIC()) {
        if (isBookedSlot) continue;
      } else {
        if (!isDailySlotSelectableForUserBooking(slot)) continue;
      }
      const slotDate = startOfDay(parseISO(slot.date));
      const slotTime = timeKeyFromDailySlot(slot);
      const slotDateTime = new Date(slotDate);
      const [hours, minutes] = slotTime.split(':').map(Number);
      slotDateTime.setHours(hours, minutes || 0, 0, 0);
      if (!isAdminOrOIC() && slotDateTime < new Date()) continue;
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
  }, [isTemplateFlow, chargeCalculated, showSlots, autoSlotSelection, selectedSlots.length, equipmentDetail, calculatedCharge, loadingSlots, bookingAsExternalTarget, adminManageMode, adminBookForUserId, pendingPreselect, quotaBlock]);

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
    setUserDepartmentType((userResponse.data as { department_type?: string | null }).department_type ?? null);
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


  const slotStartsBeforeRepeatWindow = (date: Date, time: string, slotData?: DailySlot): boolean => {
    if (repeatBookableFromMs == null) return false;
    let startMs: number | null = null;
    if (slotData?.start_datetime) {
      startMs = parseISO(slotData.start_datetime).getTime();
    } else if (time.includes(":")) {
      const [h, m] = time.split(":").map(Number);
      const d = new Date(date);
      d.setHours(h, m || 0, 0, 0);
      startMs = d.getTime();
    }
    return startMs != null && !Number.isNaN(startMs) && startMs < repeatBookableFromMs;
  };

  const isSlotBooked = (date: Date, time: string): boolean => {
    const slotData = getSlotData(date, time);
    if (!slotData) return false;
    if (slotStartsBeforeRepeatWindow(date, time, slotData)) return true;
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
      if (isAdminOrOIC()) {
        if (isBookedSlot || (lastSlotId != null && slot.id === lastSlotId)) return false;
      } else {
        if (!isDailySlotSelectableForUserBooking(slot) || (lastSlotId != null && slot.id === lastSlotId)) return false;
      }
      const slotDateStr = typeof slot.date === "string"
        ? (slot.date.includes("T") ? parseIsoDateAndTime(slot.date).dateStr : slot.date.slice(0, 10))
        : "";
      const slotStartTimeStr = slot.start_datetime ? parseIsoDateAndTime(slot.start_datetime).timeStr : "";
      if (slotDateStr !== lastEnd.dateStr || slotStartTimeStr !== lastEnd.timeStr) return false;
      if (!isAdminOrOIC()) {
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
        const candidateOk = isAdminOrOIC()
          ? !candidateBooked
          : isDailySlotSelectableForUserBooking(candidate);
        if (candidateOk && candidate.id !== lastSlotId) {
          const slotStart = parseISO(candidate.start_datetime);
          const slotDate = startOfDay(parseISO(candidate.date));
          const slotTime = timeKeyFromDailySlot(candidate);
          if (isAdminOrOIC() || slotStart.getTime() >= new Date().getTime()) {
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
      if (isAdminOrOIC()) {
        if (isBookedSlot || excludeSlotIds.has(slot.id)) return;
      } else {
        if (!isDailySlotSelectableForUserBooking(slot) || excludeSlotIds.has(slot.id)) return;
      }
      const slotDate = startOfDay(parseISO(slot.date));
      const slotTime = timeKeyFromDailySlot(slot);
      const slotDateTime = new Date(slotDate);
      const [hours, minutes] = slotTime.split(':').map(Number);
      slotDateTime.setHours(hours, minutes || 0, 0, 0);
      if ((isAdminOrOIC() || slotDateTime >= new Date()) && !isSlotBooked(slotDate, slotTime)) {
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
              toast.error(`Your analysis time (${required} min) fits in one slot, so only one slot can be selected.`);
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
              `Cannot add this slot. Your selected slots already cover the required ${required} minutes.`
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
    const rowEndTimes = slotRowEndTimes(equipmentDetail?.daily_slots, timeKeyFromDailySlot, (s) =>
      normalizeSlotGridTimeKey(parseIsoDateAndTime(s.end_datetime).timeStr)
    );
    return timeSlots.map((t, index) => ({
      key: t,
      label: hideTime ? `Slot ${index + 1}` : slotTimeRangeLabel(t, rowEndTimes.get(t), slotDuration),
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
  const canBookForOtherUsers = (): boolean => isAdminOrOIC() && !equipmentCatalogOnly;

  /** Admin / OIC / Lab Operator may change slot status (not Department Administrator). */
  const canChangeSlotStatus = (): boolean => {
    if (!userType || equipmentCatalogOnly) return false;
    const t = String(userType).toLowerCase();
    return t === 'admin' || t === 'manager' || t === 'operator';
  };

  /** For Admin and OIC the weekly view display setting has no effect: they always see time on the vertical axis. */
  const getEffectiveWeeklyViewDisplay = (): 'TIME' | 'SLOT_ID' => {
    if (isAdminOrOIC()) return 'TIME';
    return equipmentDetail?.weekly_view_display ?? 'TIME';
  };

  // Weekly slot timings (no dates or availability) for a template's preferred-slot calendar.
  const weeklyRowsHideTimes = getEffectiveWeeklyViewDisplay() === "SLOT_ID";
  const weeklyTemplateSlotRows = useMemo(
    () =>
      buildWeeklySlotRows(
        equipmentDetail && {
          slot_masters: equipmentDetail.slot_masters,
          slot_master_times: equipmentDetail.slot_master_times,
          slot_start_time: equipmentDetail.slot_start_time,
          slot_end_time: equipmentDetail.slot_end_time,
          slot_duration_minutes: equipmentDetail.slot_duration_minutes,
          weekly_view_time_from: equipmentDetail.weekly_view_time_from,
          weekly_view_time_to: equipmentDetail.weekly_view_time_to,
        },
        // Templates are booked by regular users, who only see slots inside the weekly view window (external users see all).
        { applyVisibilityWindow: !isExternalUser, hideTimes: weeklyRowsHideTimes }
      ),
    [equipmentDetail, isExternalUser, weeklyRowsHideTimes]
  );

  // Staff have no charge profile of their own, so the page never calculates charges for them while editing a
  // template; ask for the analysis time under a standard profile so the template's slot count is still known.
  const [templateStaffAnalysis, setTemplateStaffAnalysis] = useState<{ minutes: number | null; loading: boolean }>({
    minutes: null,
    loading: false,
  });
  useEffect(() => {
    if (!isTemplateFlow || !equipmentDetail || !selectedEquipment) return;
    if (!(isAdminOrOIC() || chargeCalculationFailed) || equipmentDetail.profile_type === "PRINT_3D") {
      setTemplateStaffAnalysis({ minutes: null, loading: false });
      return;
    }
    const required = (equipmentDetail.input_fields ?? []).filter((f: { is_required?: boolean }) => f.is_required);
    const missing = required.some((f: { field_key: string }) => {
      const v = inputFieldValues[f.field_key];
      return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
    });
    const profiles = ((equipmentDetail as { charge_profiles?: Array<{ user_type?: string; is_active?: boolean }> })
      .charge_profiles ?? []).filter((p) => p.is_active !== false && p.user_type);
    const profileType =
      ["student", "faculty"].find((t) => profiles.some((p) => p.user_type === t)) ?? profiles[0]?.user_type;
    if (missing || !profileType) {
      setTemplateStaffAnalysis({ minutes: null, loading: false });
      return;
    }
    let cancelled = false;
    setTemplateStaffAnalysis((prev) => ({ ...prev, loading: true }));
    const timer = setTimeout(() => {
      apiClient
        .calculateEquipmentCharge(selectedEquipment.id, inputFieldValues as Record<string, string | boolean | string[]>, {
          user_type: profileType,
          ...(sampleSets.length > 0
            ? { sample_sets: sampleSets as Array<Record<string, string | boolean | string[] | number>> }
            : {}),
        })
        .then((res) => {
          if (cancelled) return;
          const minutes = res.error ? null : Number(res.data?.total_time_minutes);
          setTemplateStaffAnalysis({ minutes: minutes != null && Number.isFinite(minutes) ? minutes : null, loading: false });
        })
        .catch(() => {
          if (!cancelled) setTemplateStaffAnalysis({ minutes: null, loading: false });
        });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // Slot refetches replace equipmentDetail; only the fields read above should re-run the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isTemplateFlow,
    equipmentDetail?.equipment_id,
    equipmentDetail?.input_fields,
    equipmentDetail?.profile_type,
    selectedEquipment?.id,
    inputFieldValues,
    sampleSets,
    chargeCalculationFailed,
    userType,
  ]);

  const templateSlotsRequired = slotsRequiredForMinutes(
    calculatedCharge?.total_time_minutes ?? templateStaffAnalysis.minutes,
    equipmentDetail
  );

  const canAccessManageEquipmentModes = (): boolean => {
    return canBookForOtherUsers() || canChangeSlotStatus();
  };

  /** Institute Admin, OIC and Department Administrator must pick "Book slots for a user" before the booking form. */
  const requiresBookModeBeforeForm = (): boolean => {
    if (!userType) return false;
    const t = String(userType).toLowerCase();
    return t === 'admin' || t === 'manager' || t === 'dept_admin';
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
        if (allowUrgentWeekExtension) {
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
      const maxDate = repeatSourceBooking?.extra_week_granted
        ? addDays(parseISO(maxDateStr), 7)
        : parseISO(maxDateStr);
      const weekSunday = addDays(weekStartNormalized, 6);
      return weekSunday >= minDate && weekStartNormalized <= maxDate;
    }

    if (allowUrgentWeekExtension) {
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
      if (repeatBookableFromMs == null) return weeks;
      const earliestWeek = startOfWeek(new Date(Math.max(repeatBookableFromMs, now.getTime())), { weekStartsOn: 1 });
      const maxDateStr = equipmentDetail?.slot_window_max_date ?? null;
      const maxDate = maxDateStr ? parseISO(maxDateStr) : null;
      const bounded = weeks.filter(
        (w) => w.getTime() >= earliestWeek.getTime() && (!maxDate || w.getTime() <= maxDate.getTime()),
      );
      return bounded.length > 0 ? bounded : [earliestWeek];
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
        if (allowUrgentWeekExtension) {
          return [currentWeek, nextWeek, addWeeks(nextWeek, 1)];
        }
        return [currentWeek, nextWeek];
      }
      const minDate = parseISO(minDateStr);
      const maxDate = parseISO(maxDateStr);
      if (allowUrgentWeekExtension) {
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
  }, [equipmentDetail?.slot_window_min_date, equipmentDetail?.slot_window_max_date, userType, currentWeekStart, allowUrgentWeekExtension, repeatBookableFromMs]);

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
      if (isAdminOrOIC()) {
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
    // NUMERIC: clamp to resolved min/max (help_text / options / defaults 1–100). Typed text below the min
    // is kept until the box loses focus (NumericFieldInput corrects it and says why).
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
      const formulaMax = resolveDynamicFormulaMax(
        changedField,
        { ...inputFieldValues, [fieldKey]: value },
        equipmentDetail
      );
      const { min, max } = resolveNumericFieldBounds(changedField, formulaMax);
      const numericValue =
        typeof value === "number"
          ? value
          : typeof value === "string" && value.trim() !== ""
            ? Number(value)
            : undefined;
      if (numericValue !== undefined && Number.isFinite(numericValue)) {
        if (numericValue < min) {
          if (typeof value === "number") value = min;
        } else if (numericValue > max) {
          value = typeof value === "number" ? max : formatNumericBound(max);
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

  /** A field's max can depend on other fields (options.max_formula, e.g. A <= B*4); lowering B must pull A back within the new max. */
  useEffect(() => {
    const fields = equipmentDetail?.input_fields;
    if (!Array.isArray(fields) || fields.length === 0 || repeatSourceBooking) return;
    const clamps: Array<{ key: string; label: string; value: string | number; max: number }> = [];
    const seen = new Set<string>();
    for (const field of fields) {
      const key = String(field?.field_key || "");
      if (!key || seen.has(key) || String(field?.field_type || "").toUpperCase().trim() !== "NUMERIC") continue;
      seen.add(key);
      const formula = numericMaxFormula(field.options);
      if (!formula) continue;
      const raw = inputFieldValues[key];
      if (raw === undefined || raw === "" || (typeof raw === "string" && isNumericInputDraft(raw))) continue;
      const current = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(current)) continue;
      // Wait while a field used by the formula is being retyped, so A is not clamped against an empty B.
      const referenced = Array.from(new Set(formula.toUpperCase().match(/\b[A-Z]\b/g) ?? []));
      const pending = referenced.some((token) => {
        const v = inputFieldValues[token];
        return v === "" || (typeof v === "string" && isNumericInputDraft(v));
      });
      if (pending) continue;
      const formulaMax = resolveDynamicFormulaMax(field, inputFieldValues, equipmentDetail);
      if (formulaMax === undefined) continue;
      const { min, max } = resolveNumericFieldBounds(field, formulaMax);
      if (!(max >= min) || current <= max) continue;
      clamps.push({
        key,
        label: field.field_label || key,
        value: typeof raw === "number" ? max : formatNumericBound(max),
        max,
      });
    }
    if (clamps.length === 0) return;
    setInputFieldValues((prev) => {
      const next: Record<string, unknown> = { ...prev };
      for (const c of clamps) {
        next[c.key] = c.value;
        applyTableRowSyncToValues(next, fields, c.key);
      }
      return next as typeof prev;
    });
    lastCalculatedValuesRef.current = "";
    for (const c of clamps) {
      toast.info(`${c.label} adjusted to ${formatNumericBound(c.max)} (maximum for the current selection).`);
    }
  }, [equipmentDetail, inputFieldValues, repeatSourceBooking]);

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

  /** Reset booking page to default state (slots cleared, auto-select off, charge cleared, input fields to defaults, booking options unchecked). Calendar week is left unchanged (same as at time of confirming booking). Call after a booking was made or queued; failures keep the form (keepFormAfterFailedBooking). */
  const resetBookingPageToDefaults = useCallback(() => {
    if (userId && equipmentDetail?.equipment_id != null) clearBookingDraft(userId, equipmentDetail.equipment_id);
    captureDraftBaselineRef.current = true;
    setRestoredDraft(null);
    setTakenSlotIds(new Set());
    setSampleSets([]);
    setSelectedSlots([]);
    setAutoSlotSelection(false);
    setChargeCalculated(false);
    setCalculatedCharge(null);
    setShowSlots(false);
    lastCalculatedValuesRef.current = '';
    setBookAnyAvailableSlots(false);
    setBookEvenIfSingleSlotAvailable(false);
    setAutoAllocateAlternative(equipmentDetail?.auto_allocate_alternative_default === true);
    appliedTemplateOptionsRef.current = null;
    setAppliedTemplate(null);
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
  }, [equipmentDetail?.input_fields, equipmentDetail?.equipment_id, userId]);

  /**
   * After a failed submit: keep inputs, sample sets and options; reload the week and drop (and mark)
   * only the selected slots someone else took meanwhile.
   */
  const keepFormAfterFailedBooking = useCallback(async (): Promise<number> => {
    const before = selectedSlots;
    if (!selectedEquipment || before.length === 0) return 0;
    const weekStart = startOfWeek(currentWeekStart, { weekStartsOn: 1 });
    const res = await apiClient.getEquipmentSlots(
      selectedEquipment.id,
      format(weekStart, "yyyy-MM-dd"),
      format(addDays(weekStart, 6), "yyyy-MM-dd"),
      { urgentWeekExtension: allowUrgentWeekExtension },
    );
    const fresh = (res.data?.slots ?? null) as DailySlot[] | null;
    if (!fresh) return 0;
    setEquipmentDetail((prev) => (prev ? { ...prev, daily_slots: fresh } : prev));
    const nowMs = Date.now();
    const { keep, dropped } = partitionSelectionAfterRefresh(before, fresh, (s) => {
      if (!isDailySlotSelectableForUserBooking(s)) return false;
      if (isAdminOrOIC()) return true;
      return !s.start_datetime || parseISO(s.start_datetime).getTime() >= nowMs;
    });
    if (dropped.length > 0) {
      setSelectedSlots(keep as TimeSlot[]);
      setTakenSlotIds(new Set(dropped.map((s) => s.slotData?.id ?? s.slotId).filter((id): id is number => typeof id === "number")));
    }
    return dropped.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSlots, selectedEquipment, currentWeekStart, allowUrgentWeekExtension]);

  useEffect(() => {
    setMobileSlotDayOffset(null);
  }, [currentWeekStart]);

  // Phone grid shows one day: when slots get picked on another day (auto-select), jump to them.
  useEffect(() => {
    if (!isMobileViewport || selectedSlots.length === 0) return;
    const visibleDay = addDays(currentWeekStart, mobileDayOffset);
    if (selectedSlots.some((s) => isSameDay(s.date, visibleDay))) return;
    setMobileSlotDayOffset(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSlots, isMobileViewport]);

  const buildAttemptSnapshot = (): BookingAttemptSnapshot | null => {
    const eqId = equipmentDetail?.equipment_id;
    if (eqId == null || userId == null || adminBookForUserId || isTemplateFlow) return null;
    const template = appliedTemplate ? bookingTemplates.find((t) => t.id === appliedTemplate.id) : undefined;
    return {
      equipmentId: Number(eqId),
      equipmentName: String(equipmentDetail?.name || selectedEquipment?.name || "Equipment"),
      inputValues: withSampleSets({ ...inputFieldValues }, sampleSets),
      options: {
        auto_slot_selection: autoSlotSelection,
        book_any_available_slots: bookAnyAvailableSlots,
        book_even_if_single_slot_available: bookAnyAvailableSlots && bookEvenIfSingleSlotAvailable,
        waitlist_on_failure: waitlistIntentMode,
        auto_allocate_alternative: autoAllocateAlternative,
        sample_return_after_analysis: sampleReturnAfterAnalysis,
        atmosphere_sensitive_sample: atmosphereSensitiveSample,
        research_workspace: researchWorkspaceId,
      },
      preferredSlot: preferredSlotFromSlots(selectedSlots.map((s) => s.slotData)),
      templateId: template?.id ?? null,
      templateName: template?.name ?? null,
      slotRows: weeklyTemplateSlotRows,
      slotRowsHideTimes: weeklyRowsHideTimes,
      slotsRequired: slotsRequiredForMinutes(calculatedCharge?.total_time_minutes, equipmentDetail),
      slotDurationMinutes: equipmentDetail?.slot_duration_minutes ?? null,
      slotAvailableColor: equipmentDetail?.calendar_colors?.slot_colors?.AVAILABLE ?? null,
    };
  };

  /** "Book" again from a nearby free slot offered after a template booking lost its slot. */
  const pickAttemptAlternative = async (alternative: TemplateSlotAlternative) => {
    const templateId = attemptSnapshot?.templateId;
    setBookingResultDialog((d) => ({ ...d, open: false }));
    if (!templateId) return;
    const template =
      bookingTemplates.find((t) => t.id === templateId) ?? (await apiClient.getBookingTemplate(templateId)).data;
    if (!template) {
      toast.error("The booking template was not found.");
      return;
    }
    applyBookingTemplate(template, { resolvePreferredSlot: false });
    setPendingPreselect({ date: alternative.date, slotIds: alternative.slot_ids });
    toast.info(`Template "${template.name}" reloaded with ${alternative.label}. Check the details and click Book.`);
  };

  /**
   * Failed or queued submit. Waitlisted: the request is recorded, so the form is reset like a success.
   * Failed: the form stays as it was, minus slots that are no longer free.
   */
  const reportUnsuccessfulBooking = async (
    errRes: { error?: string | null; waitlist_position?: number | null; waitlist_code?: string | null; waitlist_full?: boolean },
    opts: { attempt: BookingAttemptSnapshot | null; slotAlternatives?: TemplateSlotAlternative[] | null } = { attempt: null },
  ) => {
    setAttemptSnapshot(opts.attempt);
    if (opts.slotAlternatives !== undefined) setAttemptSlotAlternatives(opts.slotAlternatives);
    setWalletBalanceRefreshTick((t) => t + 1);
    setQuotaRefreshTick((t) => t + 1);
    if (isWaitlistedResponse(errRes)) {
      resetBookingPageToDefaults();
      setBookingResultDialog({
        open: true,
        success: false,
        variant: "waitlist",
        message: waitlistQueueMessage(waitlistPositionFrom(errRes)),
      });
      return;
    }
    const raw = String(errRes.error || "Booking unsuccessful.");
    const message = errRes.waitlist_full ? `${raw} ${WAITLIST_FULL_MESSAGE}` : raw;
    const firstSlotDate = selectedSlots[0]?.date ? format(selectedSlots[0].date, "yyyy-MM-dd") : null;
    let dropped = 0;
    try {
      dropped = await keepFormAfterFailedBooking();
    } catch {
      dropped = 0;
    }
    if (selectedEquipment) {
      let code: string = classifyBookingFailure(raw, { waitlist_full: errRes.waitlist_full });
      if (code === "other") {
        if (dropped > 0) code = "slot_taken";
        else if (walletLinkRequired) code = "no_wallet";
        else if (walletStatus.kind === "insufficient") code = "insufficient_funds";
        else if (quotaBlock) code = "quota";
      }
      offerAssistantHelp({
        code,
        equipmentId: Number(selectedEquipment.id),
        equipmentName: selectedEquipment.name,
        message: raw,
        date: firstSlotDate,
      });
    }
    setBookingResultDialog({
      open: true,
      success: false,
      variant: "failure",
      message: dropped > 0 ? `${message}\n\n${droppedSlotsNotice(dropped)}` : message,
      formKept: true,
    });
  };

  const handleBooking = async () => {
    if (!userId || !selectedEquipment || (selectedSlots.length === 0 && !canSubmitWithoutSlots)) {
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
          message: repeatSourceBooking.booked_by_staff
            ? `Repeat booked free of charge${repeatSourceBooking.user_label ? ` for ${repeatSourceBooking.user_label}` : ""}. The original booking is marked as repeated and the user has been emailed a confirmation.`
            : "Repeat booking created. This booking does not count toward your weekly or monthly limit.",
          bookingViewQuery: repeatView,
          bookingDisplayId: repeatView,
        });
        setRepeatSourceBooking(null);
      } catch (e) {
        setBookingResultDialog({
          open: true,
          success: false,
          variant: "failure",
          message: e instanceof Error ? e.message : "Failed to create repeat booking",
          formKept: true,
        });
      } finally {
        setIsSubmittingBooking(false);
      }
      return;
    }

    // Validate selection per business rules (skip this for explicit waitlist mode)
    if (!waitlistIntentEffective && !groupAlternativeSearchWithoutSlots && calculatedCharge && !isSelectionValidForBooking()) {
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

    if (isUrgentTypeBHoldMode && !canUseSlotIds) {
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

    const attemptForFollowUp = buildAttemptSnapshot();
    setAttemptSlotFallback(null);
    setAttemptSlotAlternatives(null);
    setIsSubmittingBooking(true);

    try {
      // No-slots visible flow: waitlist booking and/or a search for alternate equipment in the group.
      if (canSubmitWithoutSlots && !canUseSlotIds) {
        const noSlotBody: Parameters<typeof apiClient.bookEquipment>[1] = {
          input_values: withSampleSets(inputFieldValues, sampleSets),
          ...(bookingAsExternalTarget ? { sample_return_after_analysis: sampleReturnAfterAnalysis } : {}),
          atmosphere_sensitive_sample: atmosphereSensitiveForBooking,
          status: "pending",
          waitlist_on_failure: waitlistIntentEffective,
          request_waitlist_without_slot_selection: true,
          ...(rewardPointsToRedeem.trim() ? { reward_points_to_redeem: rewardPointsToRedeem.trim() } : {}),
          ...(isAdminOrOIC() && adminBookForUserId ? { user_id: Number(adminBookForUserId) } : {}),
          ...print3dBookExtras,
        };
        const res = await apiClient.bookEquipment(selectedEquipment.id, {
          ...noSlotBody,
          ...(groupAlternativeOption
            ? { offer_group_alternatives: true, auto_allocate_alternative: autoAllocateAlternative }
            : {}),
        });
        const noSlotAltPayload = res.data as unknown as GroupAlternativesPayload | undefined;
        if (
          res.error &&
          res.errorCode === "GROUP_ALTERNATIVES_AVAILABLE" &&
          Array.isArray(noSlotAltPayload?.alternatives) &&
          noSlotAltPayload.alternatives.length > 0
        ) {
          setGroupAlternatives({
            payload: noSlotAltPayload,
            requestBody: noSlotBody,
            originalEquipmentId: Number(selectedEquipment.id),
          });
          return;
        }
        const errRes = res as { error?: string; waitlist_position?: number; waitlist_code?: string; waitlist_full?: boolean };
        if (res.error || errRes.waitlist_position != null || errRes.waitlist_code) {
          await reportUnsuccessfulBooking(errRes, { attempt: attemptForFollowUp });
          return;
        }
        logBookingServerTimings(res);
        const allocatedData = res.data as unknown as {
          real_booking_id?: number;
          id?: number;
          virtual_booking_id?: string;
          booking_id?: string | number;
          payment_required?: boolean;
          amount_due?: string;
          require_istem_fbr?: boolean;
          istem_fbr_status?: string | null;
          allocated_alternative?: GroupAllocatedAlternative;
        } | undefined;
        const allocatedRealId =
          allocatedData?.real_booking_id ?? (typeof allocatedData?.id === "number" ? allocatedData.id : undefined);
        if (allocatedRealId != null) linkBookingToResearchWorkspace(allocatedRealId);
        const allocated = allocatedData?.allocated_alternative;
        const allocatedName = allocated?.equipment.name ?? "the alternate equipment";
        resetBookingPageToDefaults();
        if (allocatedData?.payment_required && allocatedRealId != null) {
          navigate(`/bookings/${allocatedRealId}/payment`);
          toast.info(`Booking reserved on ${allocatedName}. Please pay ${formatINRAmount(allocatedData.amount_due || 0)} to confirm.`);
          return;
        }
        if (allocatedRealId != null && (allocatedData?.require_istem_fbr === true || allocatedData?.istem_fbr_status != null)) {
          navigate(`/bookings/${allocatedRealId}/next-steps`);
          toast.success(`Booking confirmed on ${allocatedName}. Complete I-STEM steps on the next page.`);
          return;
        }
        const allocatedView =
          (typeof allocatedData?.virtual_booking_id === "string" && allocatedData.virtual_booking_id.trim()) ||
          (typeof allocatedData?.booking_id === "string" && allocatedData.booking_id.trim()) ||
          (allocatedRealId != null ? String(allocatedRealId) : undefined);
        setAttemptSnapshot(attemptForFollowUp);
        setBookingResultDialog({
          open: true,
          success: true,
          variant: "success",
          bookingViewQuery: allocatedView,
          bookingDisplayId: allocatedView,
          message: allocated
            ? `${allocated.original_equipment.name} had no free slot, so your booking was allocated to ` +
              `${allocated.equipment.name} (same equipment group) for ${describeGroupSlotWindow(allocated.start, allocated.end)}.`
            : "Booking created successfully!",
        });
        return;
      }

      // Backend resolves "book any available slots" / single-slot fallback; avoid an extra getEquipmentSlots round-trip here.
      const finalSlotIds = slotIds;
      const totalHours = calculatedCharge ? calculatedCharge.total_time_minutes / 60 : 0;
      const totalCost = calculatedCharge ? Number(calculatedCharge.total_charge) : 0;

      if (canUseSlotIds) {
        if (isUrgentTypeBHoldMode) {
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
              input_values: withSampleSets(inputFieldValues, sampleSets),
              ...(bookingAsExternalTarget ? { sample_return_after_analysis: sampleReturnAfterAnalysis } : {}),
          atmosphere_sensitive_sample: atmosphereSensitiveForBooking,
              ...(rewardPointsToRedeem.trim() ? { reward_points_to_redeem: rewardPointsToRedeem.trim() } : {}),
              create_as_hold: true,
              waitlist_on_failure: waitlistIntentEffective,
              book_any_available_slots: bookingAsExternalTarget ? false : bookAnyAvailableSlots,
              book_even_if_single_slot_available: bookingAsExternalTarget ? false : bookEvenIfSingleSlotAvailable,
              ...(isRushReliefMode ? { rush_relief: true } : {}),
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
            inputValues: withSampleSets({ ...inputFieldValues }, sampleSets),
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
        const offerGroupAlternatives =
          !!equipmentDetail?.group_alternatives_enabled &&
          equipmentDetail?.profile_type !== "PRINT_3D" &&
          !isRushReliefMode;
        const bookBody: Parameters<typeof apiClient.bookEquipment>[1] = {
          slot_ids: finalSlotIds,
          total_hours: totalHours,
          total_cost: totalCost,
          status: "pending",
          input_values: withSampleSets(inputFieldValues, sampleSets),
          ...(bookingAsExternalTarget ? { sample_return_after_analysis: sampleReturnAfterAnalysis } : {}),
          atmosphere_sensitive_sample: atmosphereSensitiveForBooking,
          ...(rewardPointsToRedeem.trim() ? { reward_points_to_redeem: rewardPointsToRedeem.trim() } : {}),
          waitlist_on_failure: waitlistIntentEffective,
          book_any_available_slots: bookingAsExternalTarget ? false : bookAnyAvailableSlots,
          book_even_if_single_slot_available: bookingAsExternalTarget ? false : bookEvenIfSingleSlotAvailable,
              ...(isRushReliefMode ? { rush_relief: true } : {}),
          ...(bookAnyAvailableSlots && !bookingAsExternalTarget ? { visible_week_start: format(weekStart, "yyyy-MM-dd"), visible_week_end: format(weekEnd, "yyyy-MM-dd") } : {}),
          ...(isAdminOrOIC() && adminBookForUserId ? { user_id: Number(adminBookForUserId) } : {}),
          ...(alternativeOf && alternativeOf.forEquipmentId === Number(selectedEquipment.id)
            ? { alternative_of_equipment_id: alternativeOf.equipmentId }
            : {}),
          ...(attemptForFollowUp?.templateId
            ? {
                booking_template_id: attemptForFollowUp.templateId,
                use_template_slot_fallback: isTemplateFallback(bookingSlotFallback),
              }
            : {}),
          ...print3dBookExtras,
        };
        const res = await apiClient.bookEquipment(selectedEquipment.id, {
          ...bookBody,
          ...(offerGroupAlternatives
            ? { offer_group_alternatives: true, auto_allocate_alternative: autoAllocateAlternative }
            : {}),
        });
        const altPayload = res.data as unknown as GroupAlternativesPayload | undefined;
        if (
          res.error &&
          res.errorCode === "GROUP_ALTERNATIVES_AVAILABLE" &&
          Array.isArray(altPayload?.alternatives) &&
          altPayload.alternatives.length > 0
        ) {
          // Keep the form as-is so Cancel returns the user to their selection.
          setGroupAlternatives({
            payload: altPayload,
            requestBody: bookBody,
            originalEquipmentId: Number(selectedEquipment.id),
          });
          return;
        }
        if (res.error) {
          const errRes = res as { error: string; waitlist_position?: number; waitlist_code?: string; waitlist_full?: boolean };
          const failedBody = res.data as unknown as { slot_alternatives?: TemplateSlotAlternative[] } | undefined;
          await reportUnsuccessfulBooking(errRes, {
            attempt: attemptForFollowUp,
            slotAlternatives: Array.isArray(failedBody?.slot_alternatives) ? failedBody.slot_alternatives : null,
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
            allocated_alternative?: GroupAllocatedAlternative;
            slot_fallback?: TemplateSlotFallback;
          };
        }).data;
        const realId = resData?.real_booking_id ?? (typeof resData?.id === "number" ? resData.id : undefined);
        if (realId != null) linkBookingToResearchWorkspace(realId);
        setAttemptSnapshot(attemptForFollowUp);
        setAttemptSlotFallback(resData?.slot_fallback ?? null);
        const bookingViewQuery =
          (typeof resData?.virtual_booking_id === "string" && resData.virtual_booking_id.trim()) ||
          (typeof resData?.booking_id === "string" && resData.booking_id.trim()) ||
          (realId != null ? String(realId) : undefined);
        if (resData?.payment_required && realId != null && bookingAsExternalTarget) {
          resetBookingPageToDefaults();
          navigate(`/bookings/${realId}/payment`);
          toast.info(`Booking reserved. Please pay ${formatINRAmount(resData.amount_due || 0)} to confirm.`);
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
            const allocated = resData?.allocated_alternative;
            const baseMsg = allocated
              ? `${allocated.original_equipment.name} was not available for your requested slot, so your booking was ` +
                `allocated to ${allocated.equipment.name} (same equipment group) for ${describeGroupSlotWindow(allocated.start, allocated.end)}.`
              : resData?.input_values_adjusted
              ? "Booking created successfully with reduced parameters (1 slot) as requested."
              : "Booking created successfully!";
            const pointsUsed = Number(resData?.reward?.points_used ?? 0);
            const discountAmount = resData?.reward?.discount_amount;
            if (pointsUsed > 0 && discountAmount) {
              return `${baseMsg} Reward applied: ${pointsUsed.toFixed(2)} points (${formatINRAmount(discountAmount)}).`;
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
          input_values: withSampleSets(inputFieldValues, sampleSets),
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

      type MultiRangeData = {
        virtual_booking_id?: string;
        booking_id?: string | number;
        real_booking_id?: number;
        id?: number;
      };
      linkBookingToResearchWorkspace(
        results
          .map((r) => {
            const d = (r as { data?: MultiRangeData }).data;
            return d?.real_booking_id ?? (typeof d?.id === "number" ? d.id : undefined);
          })
          .filter((id): id is number => typeof id === "number"),
      );
      const firstData = (results[0] as { data?: MultiRangeData })?.data;
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
      await reportUnsuccessfulBooking({ error: errMsg }, { attempt: null });
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

  const handleBookGroupAlternative = async (alt: GroupAlternative) => {
    if (!groupAlternatives) return;
    const { requestBody, originalEquipmentId, payload } = groupAlternatives;
    const {
      book_any_available_slots: _anySlots,
      book_even_if_single_slot_available: _singleSlot,
      visible_week_start: _ws,
      visible_week_end: _we,
      total_cost: _cost,
      total_hours: _hours,
      request_waitlist_without_slot_selection: _noSelection,
      ...rest
    } = requestBody;
    setGroupAltBookingId(alt.equipment_id);
    try {
      const res = await apiClient.bookEquipment(alt.equipment_id, {
        ...rest,
        slot_ids: alt.slot_ids,
        input_values: alt.input_values,
        waitlist_on_failure: false,
        alternative_of_equipment_id: originalEquipmentId,
      });
      if (res.error) {
        toast.error(res.error);
        setGroupAlternatives((prev) =>
          prev
            ? {
                ...prev,
                payload: {
                  ...prev.payload,
                  alternatives: prev.payload.alternatives.filter((a) => a.equipment_id !== alt.equipment_id),
                },
              }
            : prev,
        );
        return;
      }
      logBookingServerTimings(res);
      const resData = res.data as unknown as {
        real_booking_id?: number;
        id?: number;
        virtual_booking_id?: string;
        booking_id?: string | number;
        payment_required?: boolean;
        amount_due?: string;
        require_istem_fbr?: boolean;
        istem_fbr_status?: string | null;
      } | undefined;
      setGroupAlternatives(null);
      const realId = resData?.real_booking_id ?? (typeof resData?.id === "number" ? resData.id : undefined);
      if (realId != null) linkBookingToResearchWorkspace(realId);
      const viewQuery =
        (typeof resData?.virtual_booking_id === "string" && resData.virtual_booking_id.trim()) ||
        (typeof resData?.booking_id === "string" && resData.booking_id.trim()) ||
        (realId != null ? String(realId) : undefined);
      if (resData?.payment_required && realId != null) {
        resetBookingPageToDefaults();
        navigate(`/bookings/${realId}/payment`);
        toast.info(`Booking reserved on ${alt.name}. Please pay ${formatINRAmount(resData.amount_due || 0)} to confirm.`);
        return;
      }
      if (realId != null && (resData?.require_istem_fbr === true || resData?.istem_fbr_status != null)) {
        resetBookingPageToDefaults();
        navigate(`/bookings/${realId}/next-steps`);
        toast.success(`Booking confirmed on ${alt.name}. Complete I-STEM steps on the next page.`);
        return;
      }
      resetBookingPageToDefaults();
      setBookingResultDialog({
        open: true,
        success: true,
        variant: "success",
        bookingViewQuery: viewQuery,
        bookingDisplayId: viewQuery,
        message:
          `Booking confirmed on ${alt.name} (alternative to ${payload.original_equipment.name}) for ` +
          `${describeGroupSlotWindow(alt.start, alt.end)}.`,
      });
    } finally {
      setGroupAltBookingId(null);
    }
  };

  const handleGroupAltWaitlist = async () => {
    if (!groupAlternatives) return;
    const { requestBody, originalEquipmentId } = groupAlternatives;
    setGroupAltWaitlistBusy(true);
    try {
      const res = await apiClient.bookEquipment(originalEquipmentId, {
        ...requestBody,
        skip_group_alternatives: true,
      });
      setGroupAlternatives(null);
      if (res.error) {
        await reportUnsuccessfulBooking(res as { error: string; waitlist_position?: number; waitlist_code?: string; waitlist_full?: boolean });
        return;
      }
      resetBookingPageToDefaults();
      const resData = res.data as unknown as { real_booking_id?: number; id?: number; virtual_booking_id?: string } | undefined;
      const viewQuery =
        (typeof resData?.virtual_booking_id === "string" && resData.virtual_booking_id.trim()) ||
        (resData?.real_booking_id != null ? String(resData.real_booking_id) : resData?.id != null ? String(resData.id) : undefined);
      setBookingResultDialog({
        open: true,
        success: true,
        variant: "success",
        bookingViewQuery: viewQuery,
        bookingDisplayId: viewQuery,
        message: "Booking created successfully!",
      });
    } finally {
      setGroupAltWaitlistBusy(false);
    }
  };

  /** Phone grid: a day has a slot this user could pick. */
  const dayHasSelectableSlot = (day: Date): boolean => {
    const dateStr = format(day, "yyyy-MM-dd");
    const nowMs = Date.now();
    return (equipmentDetail?.daily_slots ?? []).some((s) => {
      if (String(s.date || "").slice(0, 10) !== dateStr) return false;
      if (String(s.status || "").toUpperCase() !== "AVAILABLE" || s.booking_id) return false;
      if (!isAdminOrOIC() && !isDailySlotSelectableForUserBooking(s)) return false;
      return !s.start_datetime || parseISO(s.start_datetime).getTime() >= nowMs;
    });
  };

  const defaultMobileDayOffset = (() => {
    const firstSelected = selectedSlots.find((s) => {
      const off = Math.round((startOfDay(s.date).getTime() - startOfDay(currentWeekStart).getTime()) / 86_400_000);
      return off >= 0 && off <= 6;
    });
    if (firstSelected) {
      return Math.round((startOfDay(firstSelected.date).getTime() - startOfDay(currentWeekStart).getTime()) / 86_400_000);
    }
    const todayOffset = Math.round((startOfDay(new Date()).getTime() - startOfDay(currentWeekStart).getTime()) / 86_400_000);
    const from = todayOffset >= 0 && todayOffset <= 6 ? todayOffset : 0;
    for (let i = from; i <= 6; i++) {
      if (dayHasSelectableSlot(addDays(currentWeekStart, i))) return i;
    }
    return from;
  })();
  const mobileDayOffset = mobileSlotDayOffset ?? defaultMobileDayOffset;

  const handleOpenGroupAlternativeForm = (alt: GroupAlternative) => {
    if (!groupAlternatives) return;
    const prefill: GroupAltPrefill = {
      equipment_id: alt.equipment_id,
      from_equipment_id: groupAlternatives.originalEquipmentId,
      from_name: groupAlternatives.payload.original_equipment.name,
      input_values: alt.input_values,
      date: alt.date,
    };
    try {
      sessionStorage.setItem(GROUP_ALT_PREFILL_KEY, JSON.stringify(prefill));
    } catch {
      // Private mode / quota: the form still opens, only without prefilled inputs.
    }
    setGroupAlternatives(null);
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set("equipment_id", String(alt.equipment_id));
      p.set("alt_from", String(prefill.from_equipment_id));
      p.delete("repeatOf");
      return p;
    });
    handleEquipmentSelect(alt.equipment_id);
  };

  if (!selectedEquipment || !equipmentDetail) {
    const equipmentIdFromUrl = searchParams.get("equipment_id");
    const isLoadingFromUrl = Boolean(equipmentIdFromUrl) && (loadingEquipmentDetail || !selectedEquipment);

    return (
      <div className={isEmbedFlow ? "relative" : "page-shell"}>
        {!isEmbedFlow && <DashboardHeader />}
        <main className={isEmbedFlow ? "w-full px-0 py-2" : "w-full max-w-[1800px] mx-auto px-4 md:px-6 py-8"}>
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
                  {!isEmbedFlow && (
                    <Button className="bg-primary hover:bg-primary/90" onClick={() => navigate("/equipments")}>
                      Browse and Book Equipment
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className={isEmbedFlow ? "relative" : "page-shell relative"}>
      {(loadingEquipmentDetail || repeatSourceLoading) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-2xl flex flex-col items-center gap-4 shadow-xl border">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="text-base text-muted-foreground">{repeatSourceLoading ? "Loading repeat booking..." : "Loading equipment details..."}</p>
          </div>
        </div>
      )}
      {!isEmbedFlow && <DashboardHeader />}
      <main className={isEmbedFlow ? "w-full px-0 py-1 text-base leading-relaxed" : "w-full max-w-[1800px] mx-auto px-4 md:px-6 py-4 md:py-6 text-base md:text-lg leading-relaxed"}>
        {!isEmbedFlow && (
        <div className="max-w-6xl mx-auto mb-3 md:mb-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                {isCalculateChargesFlow
                  ? `Calculate charges — ${selectedEquipment.name}`
                  : isTemplateFlow
                  ? `${editTemplateId ? "Edit" : "Create"} booking template — ${selectedEquipment.name}`
                  : canAccessManageEquipmentModes()
                    ? `Manage ${selectedEquipment.name}`
                    : selectedEquipment.name}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-2">
                <EquipmentDepartmentLabel
                  name={(equipmentDetail as any)?.internal_department_name}
                />
                {walletStatus.kind === "zero_balance" &&
                  isEndUserBookingType(userType) &&
                  !canAccessManageEquipmentModes() && (
                  <div className="inline-flex flex-wrap items-center gap-3">
                    <span className="text-base md:text-lg font-bold text-red-600 dark:text-red-500">
                      Wallet balance for this department is ₹0 — please recharge before booking.
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      className="shrink-0 font-semibold"
                      onClick={() => goToWalletRecharge()}
                    >
                      <Wallet className="h-4 w-4 mr-2" />
                      Recharge Wallet
                    </Button>
                  </div>
                )}
                {walletLinkRequired &&
                  isEndUserBookingType(userType) &&
                  !canAccessManageEquipmentModes() &&
                  !isCalculateChargesFlow &&
                  !isTemplateFlow &&
                  !isProformaFlow && (
                  <div className="basis-full">
                    <WalletLinkBanner
                      pending={walletStatus.kind === "link_pending"}
                      supervisorName={walletStatus.kind === "link_pending" ? walletStatus.supervisorName : null}
                      onLink={() => goToWalletLink()}
                      onInvite={() => goToWalletLink({ invite: true })}
                    />
                  </div>
                )}
                {isEndUserBookingType(userType) && !canAccessManageEquipmentModes() && <MySpendingLimitNotice />}
              </div>
            </div>
          </div>
        </div>
        )}

        {equipmentCatalogOnly && !isCalculateChargesFlow && !isProformaFlow && !isTemplateFlow && (
          <Card className="max-w-2xl mx-auto mb-6">
            <CardHeader>
              <CardTitle className="text-lg">View only</CardTitle>
              <CardDescription>
                You can view and calculate charges for this equipment. Slot status and booking for users are
                available only for equipment assigned to you.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setSearchParams((prev) => {
                    const next = new URLSearchParams(prev);
                    next.set("mode", "calculate");
                    return next;
                  })
                }
              >
                Calculate charges
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Admin: mode selector (Manage this Equipment) */}
        {canAccessManageEquipmentModes() && adminManageMode === null && !isCalculateChargesFlow && !isTemplateFlow && (
          <div className="max-w-2xl mx-auto mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <Card className="w-full max-w-none mx-auto mb-4 overflow-hidden border border-primary/20 shadow-sm">
            <CardContent className="space-y-2.5 p-3 md:p-4">
              {/* Year toolbar + month strip */}
              <div className={STATUS_TOOLBAR_CLASS}>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setStatusChangeMonthStart(prev => subYears(prev, 1))} aria-label="Previous year">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="min-w-[56px] text-center text-base font-bold tabular-nums text-foreground">
                    {statusChangeMonthStart.getFullYear()}
                  </span>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setStatusChangeMonthStart(prev => addYears(prev, 1))} aria-label="Next year">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <span className={STATUS_TIP_CHIP_CLASS}>
                  <MousePointerClick className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Double-click a month to open Month view below
                </span>
                <div className="ml-auto flex shrink-0 items-center gap-1.5">
                  <Button variant="outline" size="sm" className={cn(STATUS_ACTION_BUTTON_CLASS, STATUS_PRIMARY_ACTION_CLASS)} onClick={selectYearForStatus}>
                    Select entire year
                  </Button>
                  <Button variant="outline" size="sm" className={STATUS_ACTION_BUTTON_CLASS} onClick={clearYearSelection} disabled={statusChangeSelectedMonths.length === 0}>
                    Clear selection
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-6 gap-1 md:grid-cols-12">
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
                        "h-8 rounded-md border px-1 text-sm font-semibold transition-colors",
                        "border-border/60 bg-background hover:border-primary/30 hover:bg-primary/10",
                        isSelected && "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
                        isCurrentMonth && !isSelected && "border-primary/60 bg-primary/10 text-primary"
                      )}
                    >
                      {format(d, "MMM")}
                    </button>
                  );
                })}
              </div>

              {/* Month toolbar */}
              <div className={cn(STATUS_TOOLBAR_CLASS, "border-t border-border/50 pt-2.5")}>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setStatusChangeMonthStart(prev => subMonths(prev, 1))} aria-label="Previous month">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="min-w-[132px] text-center text-base font-bold text-foreground">
                    {format(statusChangeMonthStart, "MMMM yyyy")}
                  </span>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setStatusChangeMonthStart(prev => addMonths(prev, 1))} aria-label="Next month">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <span className={STATUS_TIP_CHIP_CLASS}>
                  <MousePointerClick className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Tip: double-click a date to open Week view · drag to select several dates
                </span>
                <div className="ml-auto flex shrink-0 items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className={STATUS_ACTION_BUTTON_CLASS}
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
                  <Button variant="outline" size="sm" className={cn(STATUS_ACTION_BUTTON_CLASS, STATUS_PRIMARY_ACTION_CLASS)} onClick={selectMonthForStatus}>
                    Select entire month
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className={STATUS_ACTION_BUTTON_CLASS}
                    onClick={() => { setSelectedDatesForStatus([]); setSelectedSlotIdsForStatus([]); setStatusChangeSelectedMonths([]); }}
                    disabled={selectedDatesForStatus.length === 0 && selectedSlotIdsForStatus.length === 0 && statusChangeSelectedMonths.length === 0}
                  >
                    Clear selection
                  </Button>
                </div>
              </div>

              {/* Month calendar grid: Mon–Sun, only the weeks this month spans */}
              <div className="overflow-hidden rounded-lg border border-border/60">
                <div className="grid grid-cols-7 bg-slate-100 dark:bg-slate-800">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                    <div key={d} className="py-1 text-center text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 bg-card select-none" onPointerMove={extendStatusDateDrag}>
                  {(() => {
                    const monthStart = startOfMonth(statusChangeMonthStart);
                    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
                    const calendarEnd = endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 });
                    const days: Date[] = [];
                    for (let d = calendarStart; d <= calendarEnd; d = addDays(d, 1)) days.push(d);
                    const effectiveDates = getEffectiveDatesForStatus();
                    return days.map((day) => {
                      const dateStr = format(day, "yyyy-MM-dd");
                      const inMonth = isSameMonth(day, statusChangeMonthStart);
                      const isSelected = effectiveDates.includes(dateStr);
                      return (
                        <button
                          key={dateStr}
                          type="button"
                          data-status-date={inMonth ? dateStr : undefined}
                          onPointerDown={(e) => {
                            if (inMonth) beginStatusDateDrag(e, dateStr);
                          }}
                          onClick={(e) => {
                            if (!inMonth) return;
                            if (statusDragSuppressClickRef.current) return;
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
                            "h-8 border-b border-r border-border/40 text-sm font-semibold tabular-nums transition-colors [&:nth-child(7n)]:border-r-0",
                            inMonth ? "bg-background hover:bg-primary/10" : "bg-muted/30 text-muted-foreground/60",
                            isSelected && "bg-primary text-primary-foreground hover:bg-primary/90"
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
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
                  <span className="font-semibold text-foreground">Selection:</span>
                  <ul className="contents text-foreground/90">
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
                  <span className="text-xs text-muted-foreground">
                    Open week view for slot-level selection, then choose an operation below.
                  </span>
                </div>
              )}

            </CardContent>
          </Card>
        )}

        {/* Inline week view (pick by time) */}
        {canAccessManageEquipmentModes() && adminManageMode === 'status' && selectedEquipment && statusChangePopupWeekStart && (
          <div className="w-full max-w-none mx-auto mb-3 rounded-xl overflow-hidden border border-border/60 shadow-md">
            {/* Compact week header */}
            <div className="sticky top-0 z-20 bg-gradient-to-r from-primary via-primary to-accent px-3 py-2 text-white">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8 touch-manipulation bg-white/20 hover:bg-white/30 border-0 text-white"
                    onClick={goToPrevWeekInPopup}
                    aria-label="Previous week"
                    title="Previous week"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="text-center min-w-[220px]">
                    <h3 className="text-base md:text-lg font-bold leading-tight tracking-tight drop-shadow-sm">
                      Week of {format(statusChangePopupWeekStart, "MMM d")} – {format(addDays(statusChangePopupWeekStart, 6), "MMM d, yyyy")}
                    </h3>
                    <p className="text-white/90 text-[11px] mt-0.5">
                      Use the arrows (or double-click a date above) to change week · click slots · time labels select rows · day headers select columns
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8 touch-manipulation bg-white/20 hover:bg-white/30 border-0 text-white"
                    onClick={goToNextWeekInPopup}
                    aria-label="Next week"
                    title="Next week"
                  >
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
            <div className="sticky top-[60px] z-20 border-b border-border/60 bg-card/95 backdrop-blur-sm px-3 py-2 shadow-sm">
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
              <p className="mb-2 text-[11px] text-muted-foreground sm:hidden">
                Swipe sideways to view the full week calendar
              </p>
              {(Boolean(equipmentDetail?.weekly_view_time_from || equipmentDetail?.weekly_view_time_to) ||
                (statusChangeSlots ?? []).some((s) => isOutsideVisibilityWindow(s))) && (
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <SlotVisibilityScopeToggle value={slotVisibilityScope} onChange={setSlotVisibilityScope} />
                  {slotVisibilityScope === "all" && (statusChangeSlots ?? []).some((s) => isOutsideVisibilityWindow(s)) && (
                    <RestrictedSlotLegend
                      from={equipmentDetail?.weekly_view_time_from}
                      to={equipmentDetail?.weekly_view_time_to}
                      className="flex-1 min-w-[260px]"
                    />
                  )}
                </div>
              )}
              {loadingStatusSlots ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                  <span className="animate-pulse">Loading slots…</span>
                </div>
              ) : (
                <TooltipProvider delayDuration={200}>
                <div
                  className="min-w-[640px] rounded-lg border border-border/60 bg-card overflow-hidden shadow-sm select-none"
                  onPointerMove={extendStatusSlotDrag}
                >
                  <div className="grid gap-0 bg-slate-100 dark:bg-slate-800 sticky top-0 z-20 border-b-2 border-primary/30" style={{ gridTemplateColumns: "104px repeat(7, minmax(0, 1fr))" }}>
                    <div className="font-bold text-xs uppercase tracking-wide text-foreground px-1.5 py-2 border-r border-border/60 bg-slate-100 dark:bg-slate-800 sticky left-0 z-30 flex items-center">Time</div>
                    {[0, 1, 2, 3, 4, 5, 6].map((dayOffset) => {
                      const day = addDays(statusChangePopupWeekStart, dayOffset);
                      const dateStr = format(day, "yyyy-MM-dd");
                      const rawH = statusChangeHolidays[dateStr];
                      const holidayLabel = typeof rawH === "string" ? rawH : (rawH && typeof rawH === "object" && "label" in rawH ? (rawH as { label: string }).label : undefined);
                      const dow = day.getDay();
                      const isSatHeader = dow === 6;
                      const isSunHeader = dow === 0;
                      const isDayFocused = statusBulkFocusDayOffset === dayOffset;
                      return (
                        <button
                          key={dayOffset}
                          type="button"
                          title={`Select all slots on ${format(day, "EEE MMM d")} (this week)${holidayLabel ? ` · ${holidayHoverText(holidayLabel)}` : ""}`}
                          onClick={() => {
                            setStatusBulkFocusDayOffset(dayOffset);
                            selectDayColumnForWeek(dayOffset);
                          }}
                          className={cn(
                            "px-1 py-2 text-center border-r border-border/60 last:border-r-0 bg-slate-100 dark:bg-slate-800 hover:bg-primary/10 dark:hover:bg-primary/20 transition-colors cursor-pointer",
                            isSatHeader && "bg-indigo-100 dark:bg-indigo-950/50",
                            isSunHeader && "bg-rose-100 dark:bg-rose-950/50",
                            isDayFocused && "ring-2 ring-inset ring-primary",
                          )}
                        >
                          <div className="text-sm font-extrabold text-foreground leading-none">
                            <span className="xl:hidden">{format(day, "EEE")}</span>
                            <span className="hidden xl:inline">{format(day, "EEEE")}</span>
                          </div>
                          <div className="text-xs font-bold text-foreground/90 mt-1 leading-none tabular-nums">
                            <span className="xl:hidden">{format(day, "d MMM")}</span>
                            <span className="hidden xl:inline">{format(day, "d MMM yyyy")}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {(() => {
                    const timeSlots = getStatusChangeWeekTimeRows();
                    const restrictedHint = restrictedSlotHint(
                      equipmentDetail?.weekly_view_time_from,
                      equipmentDetail?.weekly_view_time_to
                    );
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
                    const rowEndTimes = slotRowEndTimes(statusChangeSlots, timeKeyFromDailySlot, (s) =>
                      normalizeSlotGridTimeKey(parseIsoDateAndTime(s.end_datetime).timeStr)
                    );
                    if (timeSlots.length === 0) {
                      return (
                        <div className="p-6 text-center text-muted-foreground text-sm">
                          No slots for this week.
                        </div>
                      );
                    }
                    return timeSlots.map((time, rowIndex) => {
                      const rowRange = slotTimeRangeLabel(time, rowEndTimes.get(time), equipmentDetail?.slot_duration_minutes);
                      return (
                      <div key={time} className="grid gap-0 border-b border-border/40 last:border-b-0" style={{ gridTemplateColumns: "104px repeat(7, minmax(0, 1fr))" }}>
                        <button
                          type="button"
                          title={`Select all slots at ${rowRange} (this week)`}
                          onClick={() => {
                            setStatusBulkFocusTime(time);
                            selectTimeRowForWeek(time);
                          }}
                          className={cn(
                            "flex items-center justify-center px-1 py-0.5 border-r border-border/50 bg-muted/20 sticky left-0 z-10 hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors cursor-pointer",
                            statusBulkFocusTime === time && "ring-2 ring-inset ring-primary bg-primary/5 dark:bg-primary/15",
                          )}
                        >
                          <span className="font-semibold text-[11px] tabular-nums leading-none whitespace-nowrap">{rowRange}</span>
                        </button>
                        {[0, 1, 2, 3, 4, 5, 6].map((dayOffset) => {
                          const day = addDays(statusChangePopupWeekStart, dayOffset);
                          const rawSlot = getStatusChangeSlotAt(day, time);
                          const slot =
                            slotVisibilityScope === "user" && isOutsideVisibilityWindow(rawSlot) ? null : rawSlot;
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
                              ? holidayCellLabel(holidayName)
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
                          const slotRestricted = isOutsideVisibilityWindow(slot);
                          return (
                            <div
                              key={dayOffset}
                              data-status-slot-cell
                              data-day={dayOffset}
                              data-row={rowIndex}
                              onPointerDown={(e) => beginStatusSlotDrag(e, dayOffset, rowIndex, slot ?? undefined)}
                              className="min-h-[32px] p-0.5 border-r border-border/30 last:border-r-0"
                            >
                              {slot ? (
                                (() => {
                                  const userDetailLines = slotStatusHoverLines(slot, {
                                    holidayName,
                                    isWeekend: isSaturdayCol || isSundayCol,
                                  });
                                  const cellInner = (
                                    <div className="w-full h-full min-h-[28px] relative flex items-stretch">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (statusDragSuppressClickRef.current) return;
                                          setStatusBulkFocusTime(time);
                                          setStatusBulkFocusDayOffset(dayOffset);
                                          if (slotSelectable) toggleStatusChangeSlotSelection(slot.id);
                                        }}
                                        disabled={!slotSelectable}
                                        title={
                                          holidayName && useCalendarDayStyling && userDetailLines.length === 0
                                            ? holidayHoverText(holidayName)
                                            : slotRestricted && userDetailLines.length === 0
                                              ? restrictedHint
                                              : undefined
                                        }
                                        className={cn(
                                          "flex-1 min-h-[28px] px-1 py-0.5 text-[10px] font-medium text-left transition-all flex items-center justify-center rounded truncate",
                                          !slotSelectable && "cursor-not-allowed opacity-70",
                                          slotSelectable && !isSelected && "hover:brightness-[0.97]",
                                          isSelected && "ring-2 ring-primary ring-offset-1 bg-primary text-white hover:bg-primary/90"
                                        )}
                                        style={
                                          !isSelected && slot
                                            ? (() => {
                                                const base: CSSProperties = {
                                                  ...cell3dStyle,
                                                  backgroundColor: displayBg,
                                                  color: getContrastTextColor(displayBg),
                                                };
                                                return slotRestricted ? restrictedSlotStyle(base) : base;
                                              })()
                                            : isSelected ? cell3dStyle : undefined
                                        }
                                      >
                                        {isSelected ? (
                                          "✓"
                                        ) : slotRestricted ? (
                                          <>
                                            <Lock className="mr-0.5 h-3 w-3 shrink-0" aria-label="Not visible to users" />
                                            <span className="truncate">{displayLabel}</span>
                                          </>
                                        ) : (
                                          displayLabel
                                        )}
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
                                        className="z-[120] max-w-xs text-left px-3 py-2"
                                      >
                                        <SlotHoverLines
                                          lines={slotRestricted ? [...userDetailLines, restrictedHint] : userDetailLines}
                                        />
                                      </TooltipContent>
                                    </Tooltip>
                                  );
                                })()
                              ) : (
                                <div
                                  className="w-full min-h-[28px] px-1 py-0.5 rounded text-[10px] font-medium flex items-center justify-center truncate"
                                  title={holidayName ? holidayHoverText(holidayName) : undefined}
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
                      );
                    });
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
          <div className="sticky bottom-2 sm:bottom-3 z-30 w-full max-w-none mx-auto mb-3 rounded-xl border border-primary/25 bg-card/95 shadow-lg backdrop-blur-sm">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-primary/15 bg-primary/5 px-3 py-1.5 dark:border-primary/40 dark:bg-primary/10">
              <h3 className="text-sm font-semibold text-foreground">Apply changes</h3>
              {selectedDatesForStatus.length > 0 || selectedSlotIdsForStatus.length > 0 || statusChangeSelectedMonths.length > 0 ? (
                <ul className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
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
              ) : (
                <p className="text-xs text-muted-foreground">Select slots or dates above, choose an operation, then apply.</p>
              )}
            </div>
            <div className="space-y-2 px-3 py-2.5">
              <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 sm:gap-3">
                                {updatingSlotStatus && (
                                  <div className="w-full space-y-2">
                                    <p className="text-sm font-medium text-muted-foreground">Applying changes…</p>
                                    <Progress value={applyProgressPercent} className="h-2.5 w-full" />
                                  </div>
                                )}
                                <Label className="shrink-0 text-sm font-semibold text-foreground">Select Operation</Label>
                                <Select
                                  value={newSlotStatus}
                                  onValueChange={(v) => {
                                    if (v === BULK_EMAIL_OPERATION_VALUE) {
                                      openBulkEmailFromStatusCard();
                                      return;
                                    }
                                    if (v === CREATE_BOOKING_OPERATION_VALUE) {
                                      setAdminManageMode('book');
                                      setSearchParams((prev) => {
                                        const p = new URLSearchParams(prev);
                                        p.set("mode", "book");
                                        return p;
                                      });
                                      window.scrollTo({ top: 0, behavior: "smooth" });
                                      return;
                                    }
                                    setNewSlotStatus(v);
                                  }}
                                >
                                  <SelectTrigger aria-label="Slot operation" className="h-9 w-full text-sm font-medium sm:w-[260px] md:w-[280px]">
                                    <SelectValue placeholder="Select operation" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {canBookForOtherUsers() && (
                                      <SelectItem value={CREATE_BOOKING_OPERATION_VALUE} className="text-base font-semibold">
                                        <span className="flex items-center gap-2">
                                          <CalendarPlus className="h-5 w-5" />
                                          Create booking (for a user)
                                        </span>
                                      </SelectItem>
                                    )}
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
                                    aria-label="Other Reasons label (optional)"
                                    placeholder="Other Reasons label (optional)"
                                    value={blockedLabelForStatus}
                                    onChange={(e) => setBlockedLabelForStatus(e.target.value)}
                                    className="h-9 max-w-[240px] text-sm"
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
                                    <Label htmlFor="send-email-wallet-owner-not-utilized" className="cursor-pointer text-sm font-medium">
                                      Send email to Supervisor
                                    </Label>
                                  </div>
                                )}
                                {newSlotStatus !== BULK_EMAIL_OPERATION_VALUE && (
                                <Button
                                  size="default"
                                  className="h-9 px-5 text-sm font-semibold bg-primary hover:bg-primary/90 text-white shadow-sm"
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
                                        const firstBooked = booked[0];
                                        let holder: RescheduleBookingHolder = {
                                          user_name: firstBooked?.booking_user_name ?? null,
                                          user_email: firstBooked?.booking_user_email ?? null,
                                          user_phone: firstBooked?.booking_user_phone ?? null,
                                          user_department:
                                            firstBooked?.booking_user_department_name ||
                                            firstBooked?.booking_user_department_code ||
                                            null,
                                          display_booking_id: firstBooked?.booking_id ?? null,
                                        };
                
                                        const res = await apiClient.getBooking(bookingPk);
                                        if (!res.error && res.data) {
                                          const b = res.data as {
                                            booking_id: number | string;
                                            real_booking_id?: number | null;
                                            virtual_booking_id?: string | null;
                                            user_name?: string | null;
                                            user_email?: string | null;
                                            user_phone?: string | null;
                                            user_department?: string | null;
                                            user_type_snapshot_display?: string | null;
                                            wallet_owner_name?: string | null;
                                            status_display?: string | null;
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
                                          holder = {
                                            display_booking_id: b.virtual_booking_id || b.booking_id || holder.display_booking_id,
                                            user_name: b.user_name || holder.user_name,
                                            user_email: b.user_email || holder.user_email,
                                            user_phone: b.user_phone || holder.user_phone,
                                            user_department: b.user_department || holder.user_department,
                                            user_type: b.user_type_snapshot_display ?? null,
                                            supervisor_name: b.wallet_owner_name ?? null,
                                            status: b.status_display || b.status || null,
                                          };
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
                                          holder,
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
                                        ? `Reschedule ${selectedSlotIdsForStatus.length} slot(s)…`
                                        : "Select booked slots to reschedule"
                                      : selectedSlotIdsForStatus.length > 0
                                      ? `Apply to ${selectedSlotIdsForStatus.length} slot(s)`
                                      : `Apply to ${getEffectiveDatesForStatus().length} date(s)`}
                                </Button>
                                )}
                                <Button
                                  variant="outline"
                                  size="default"
                                  className="h-9 px-4 text-sm font-medium"
                                  onClick={() => { setSelectedDatesForStatus([]); setSelectedSlotIdsForStatus([]); setStatusChangeSelectedMonths([]); }}
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
                onConfirm={async (startTimeISO, endTimeISO, targetEquipmentId) => {
                  setStatusChangeRescheduleLoading(true);
                  try {
                    const response = await apiClient.rescheduleBooking(
                      statusChangeRescheduleBooking.booking_id,
                      startTimeISO,
                      endTimeISO,
                      targetEquipmentId
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

        {/* Booking flow: hide when Admin/OIC/Dept Admin and mode not yet chosen or when in status mode */}
        {(((!requiresBookModeBeforeForm() || adminManageMode === 'book') && adminManageMode !== 'status') || isCalculateChargesFlow || isTemplateFlow) && (
        <div className={isEmbedFlow ? "max-w-none mx-auto" : "max-w-6xl mx-auto"}>
          <Card className={isEmbedFlow ? "border-0 shadow-none" : undefined}>
              <CardHeader className={isEmbedFlow ? "px-1 pt-1 pb-2" : "px-4 py-3 md:px-6 md:py-4"}>
                <div className="flex justify-between items-center gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <CardDescription className={isEmbedFlow ? "text-sm" : "text-base md:text-lg"}>
                      {isCalculateChargesFlow ? (
                        <>Select user type and parameters to estimate charges. No time slots are required.</>
                      ) : isTemplateFlow ? (
                        <>Fill the booking details and options once and save them under a name. When booking, choose the template to fill everything in, then just pick your slots.</>
                      ) : (
                        <>
                          {Number(selectedEquipment.internalRate) > 0 && (
                            <>
                              {formatINRAmount(selectedEquipment.internalRate)}
                              {getChargeUnitColumnLabels(equipmentDetail?.profile_type).rateSuffix}
                            </>
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
                          {' — Select your preferred time slots'}
                        </>
                      )}
                    </CardDescription>
                  </div>
                  {!isEmbedFlow && (
                  <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (window.history.length > 1) {
                          navigate(-1);
                          return;
                        }
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
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 md:px-6 md:pb-6">
                {isTemplateFlow && equipmentDetail ? (
                  <TemplateHealthAdvice health={templateHealth} checking={checkingTemplateHealth} />
                ) : null}
                {/* Accessory availability — informational, before booking steps */}
                {equipmentDetail &&
                  !isProformaFlow &&
                  !isCalculateChargesFlow &&
                  ((Array.isArray(equipmentDetail.accessories) &&
                    equipmentDetail.accessories.length > 0) ||
                    (Array.isArray(equipmentDetail.additional_accessories) &&
                      equipmentDetail.additional_accessories.length > 0)) && (
                    <PeakCollapsible
                      id="accessories"
                      collapsible={peakCompact}
                      title="Accessories"
                      summary={`${(equipmentDetail.accessories?.length ?? 0) + (equipmentDetail.additional_accessories?.length ?? 0)} listed`}
                      className="mb-3"
                    >
                    <div className={peakCompact ? undefined : "mb-3"}>
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
                    </PeakCollapsible>
                  )}

                {/* Admin: select user when booking on behalf (searchable + filter by type) */}
                {canBookForOtherUsers() && adminManageMode === 'book' && !isCalculateChargesFlow && (
                  <div className="mb-6 p-4 rounded-lg border bg-muted/30 space-y-4">
                    {canChangeSlotStatus() && (
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setAdminManageMode('status');
                            setSearchParams((prev) => {
                              const p = new URLSearchParams(prev);
                              p.set("mode", "status");
                              return p;
                            });
                          }}
                        >
                          <ArrowLeft className="h-4 w-4 mr-2" />
                          Back to Change slot status
                        </Button>
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium">User type</Label>
                        <Select value={adminUserTypeFilter} onValueChange={setAdminUserTypeFilter}>
                          <SelectTrigger aria-label="User type" className="mt-2 max-w-xs">
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
                                            setAdminBookForUserInfoError(null);
                                            setAdminBookForUserInfoLoading(true);
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
                    {adminBookForUserId && (adminBookForUserInfoLoading || adminBookForUserInfo) && (
                      <div className="w-full mt-4 p-5 rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/10 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-4 border-b border-primary/20">
                          <h4 className="text-sm font-semibold uppercase tracking-wider text-primary">
                            Selected user details
                          </h4>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            disabled={adminBookForUserInfoLoading || !adminBookForUserId}
                            onClick={async () => {
                              if (!adminBookForUserId) return;
                              const displayName =
                                usersList.find((u) => String(u.id) === adminBookForUserId)?.name ||
                                usersList.find((u) => String(u.id) === adminBookForUserId)?.email ||
                                adminBookForUserInfo?.email ||
                                `User #${adminBookForUserId}`;
                              setUserTransactionHistoryDialog({ open: true, userId: adminBookForUserId, userDisplayName: displayName });
                              setUserTransactionHistory({ loading: true, transactions: [], error: null });
                              try {
                                const res = await apiClient.getAdminUserTransactionHistory(adminBookForUserId, 100, 0);
                                if (res.error) {
                                  setUserTransactionHistory({
                                    loading: false,
                                    transactions: [],
                                    error: typeof res.error === "string" ? res.error : "Failed to load transactions",
                                  });
                                  return;
                                }
                                setUserTransactionHistory({
                                  loading: false,
                                  transactions: res.data?.transactions ?? [],
                                  error: null,
                                  scopedDepartmentNames: res.data?.scoped_department_names ?? null,
                                });
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
                        {adminBookForUserInfoLoading ? (
                          <div className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
                            Loading user details…
                          </div>
                        ) : (
                          <>
                            {adminBookForUserInfoError && (
                              <p className="mb-3 text-sm text-destructive">{adminBookForUserInfoError}</p>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-base">
                              <div className="flex flex-col gap-1 p-3 rounded-lg bg-background/80">
                                <span className="text-xs font-semibold uppercase text-muted-foreground">Email</span>
                                <span className="font-medium text-foreground">{adminBookForUserInfo?.email || "—"}</span>
                              </div>
                              <div className="flex flex-col gap-1 p-3 rounded-lg bg-background/80">
                                <span className="text-xs font-semibold uppercase text-muted-foreground">Department</span>
                                <span className="font-medium text-foreground">{adminBookForUserInfo?.department_name || "—"}</span>
                              </div>
                              <div className="flex flex-col gap-1 p-3 rounded-lg bg-background/80 sm:col-span-2 lg:col-span-1">
                                <span className="text-xs font-semibold uppercase text-muted-foreground">Phone number</span>
                                <span className="font-medium text-foreground">{adminBookForUserInfo?.phone_number || "—"}</span>
                              </div>
                              <div className="flex flex-col gap-1 p-3 rounded-lg bg-background/80 sm:col-span-2 lg:col-span-1">
                                <span className="text-xs font-semibold uppercase text-muted-foreground">Supervisor</span>
                                <span className="font-medium text-foreground">
                                  {adminBookForUserInfo?.wallet_faculty_owner
                                    ? `${adminBookForUserInfo.wallet_faculty_owner.name}${adminBookForUserInfo.wallet_faculty_owner.email ? ` (${adminBookForUserInfo.wallet_faculty_owner.email})` : ""}`
                                    : "—"}
                                </span>
                              </div>
                              <div className="flex flex-col gap-1 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 sm:col-span-2 lg:col-span-4">
                                <span className="text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-400">Wallet balance</span>
                                <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                                  {adminBookForUserWalletBalance ?? "—"}
                                </span>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <>
                {isCalculateChargesFlow && (
                  <div className="mb-4 p-4 rounded-lg border bg-muted/30 space-y-2">
                    <h3 className="text-lg font-semibold md:text-xl">Select User Type</h3>
                    <p className="text-base text-muted-foreground">
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
                          {chargeEstimateOptions.map((opt) => (
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
                    className="mb-3 rounded-lg border-2 border-red-500/70 bg-red-50 dark:bg-red-950/40 dark:border-red-500/50 px-3 py-2 md:px-4"
                    role="note"
                    data-testid="important-instruction"
                  >
                    <ClampedNote
                      clamp={peakCompact}
                      className="text-base md:text-lg"
                      buttonClassName="text-red-700 dark:text-red-400"
                    >
                      <RichTextContent
                        value={equipmentDetail?.important_instruction}
                        className={
                          looksLikeRichHtml(equipmentDetail?.important_instruction)
                            ? "text-base md:text-lg text-red-700 dark:text-red-400"
                            : "text-base md:text-lg font-bold text-red-700 dark:text-red-400"
                        }
                      />
                    </ClampedNote>
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

                {templatePickerAvailable && !bookingForAnotherUser && equipmentDetail && (
                  <PeakCollapsible
                    id="template"
                    collapsible={peakCompact}
                    title="Booking template"
                    summary={appliedTemplate ? appliedTemplate.name : bookingTemplates.length > 0 ? `${bookingTemplates.length} saved` : "None saved"}
                    className="mb-3"
                  >
                  <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2", !peakCompact && "mb-3")}>
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <BookmarkCheck className="h-4 w-4 text-primary" aria-hidden />
                      Booking template
                    </div>
                    {bookingTemplates.length > 0 ? (
                      <Select
                        value={appliedTemplate ? String(appliedTemplate.id) : ""}
                        onValueChange={handleApplyTemplate}
                      >
                        <SelectTrigger className="h-9 w-full sm:w-72 bg-background" aria-label="Choose a booking template">
                          <SelectValue placeholder="Choose a template to fill the form" />
                        </SelectTrigger>
                        <SelectContent>
                          {appliedTemplate && (
                            <SelectItem value={NO_TEMPLATE_VALUE} className="text-muted-foreground">
                              No template (default form)
                            </SelectItem>
                          )}
                          {bookingTemplates.map((t) => (
                            <SelectItem key={t.id} value={String(t.id)}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Save your usual inputs and options as a template to book in one step.
                      </span>
                    )}
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto px-0"
                      onClick={() => navigate(`/book-equipment?equipment_id=${equipmentDetail.equipment_id}&mode=template`)}
                    >
                      Create template
                    </Button>
                    {bookingTemplates.length > 0 && (
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="h-auto px-0"
                        onClick={() => navigate(`/equipment/${equipmentDetail.equipment_id}?panel=booking_templates`)}
                      >
                        Manage templates
                      </Button>
                    )}
                  </div>
                  </PeakCollapsible>
                )}
                {templatePickerAvailable && !bookingForAnotherUser && appliedTemplate && (
                  <PreferredSlotBanner
                    resolution={preferredSlotResolution}
                    loading={resolvingPreferredSlot}
                    onPick={pickPreferredAlternative}
                    onRefresh={refreshPreferredSlot}
                    onDismiss={() => setPreferredSlotResolution(null)}
                  />
                )}

                {isRegularBookingFlow && (
                  <BookingStepIndicator current={bookingStepIndex} className="mb-3" />
                )}
                {restoredDraft && (
                  <RestoredDraftNotice savedAt={restoredDraft.savedAt} onDiscard={discardRestoredDraft} />
                )}
                {isRegularBookingFlow && quotaSummary && (
                  <QuotaRemainingNotice summary={quotaSummary} className="mb-3" />
                )}

                {/* Step 1: Input Fields Section */}
                <Collapsible open={sampleInfoExpanded} onOpenChange={setSampleInfoExpanded} className="mb-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h3 className="text-base font-semibold">Step 1: Sample Information</h3>
                    <CollapsibleTrigger asChild>
                      <Button type="button" variant="ghost" size="sm" className="shrink-0 gap-1 text-sm">
                        {sampleInfoExpanded ? (
                          <>
                            <ChevronUp className="h-4 w-4" />
                            Collapse
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4" />
                            Expand
                          </>
                        )}
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                  <CollapsibleContent className="space-y-2">
                  {alternativeOf && alternativeOf.forEquipmentId === Number(selectedEquipment?.id) && (
                    <div className="mb-2 p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sm text-sky-900 dark:text-sky-200">
                      Alternative for <span className="font-medium">{alternativeOf.name}</span> (same equipment group).
                      Compatible inputs were carried over — please review them; charges are recalculated for this equipment.
                    </div>
                  )}
                  {rebookSource && rebookSource.equipmentId === Number(selectedEquipment?.id) && !repeatSourceBooking && (
                    <div className="mb-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20 text-sm text-green-900 dark:text-green-200">
                      Booking again from <span className="font-medium">{rebookSource.label}</span>: inputs were copied
                      from that booking. Review or change them — charges are calculated as for any new booking.
                    </div>
                  )}
                  {repeatSourceBooking && (
                    <div className="mb-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-800 dark:text-amber-200">
                      {repeatSourceBooking.booked_by_staff
                        ? `Repeat sample${repeatSourceBooking.user_label ? ` for ${repeatSourceBooking.user_label}` : ""}: parameters are fixed from the original booking. No charges apply and it does not count toward the user's limits. Choose slots in Step 3; the original booking is marked as repeated and the user is emailed a confirmation.`
                        : "Repeat sample: parameters are fixed from the original booking and cannot be changed. No charges apply. Choose slots in Step 3. This booking will not count toward your weekly or monthly limit."}
                      {repeatBookableFromMs != null && (
                        <div className="mt-1 font-medium">
                          Approved repeat: choose slots starting on or after{" "}
                          {format(new Date(repeatBookableFromMs), "dd MMM yyyy, hh:mm a")} (48 hours after approval).
                          {repeatSourceBooking.extra_week_granted ? " One additional week of slot access has been granted." : ""}
                        </div>
                      )}
                    </div>
                  )}
                  {equipmentDetail?.input_fields && equipmentDetail.input_fields.length > 0 ? (
                    <div
                      className={cn(
                        "mb-2 rounded-lg",
                        showSampleSetOneHeader
                          ? "overflow-hidden border border-border bg-card shadow-sm dark:bg-muted/10"
                          : "p-2"
                      )}
                    >
                      {showSampleSetOneHeader && (
                        <div className="border-b border-border/70 bg-muted/40 px-3 py-2.5 dark:bg-muted/20">
                          <span className="text-sm font-semibold">Sample set 1</span>
                        </div>
                      )}
                      <div className={cn("grid grid-cols-1 gap-3 sm:gap-2.5", showSampleSetOneHeader && "p-3")}>
                        {equipmentDetail.input_fields
                          .filter((field: any) => {
                            if (equipmentDetail?.profile_type === "PRINT_3D") {
                              if (["A", "B", "C"].includes(String(field.field_key || "").toUpperCase())) {
                                return false;
                              }
                            }
                            if (isProformaFlow && isNonChargeAffectingInputField(field)) {
                              return false;
                            }
                            if (calculateHiddenFieldKeys.has(String(field.field_key || "").trim())) {
                              return false;
                            }
                            return true;
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
                                    className={dynamicFieldControlWidth(fieldType, field.field_label)}
                                  />
                                );
                              
                              case 'NUMERIC': {
                                const formulaMax = resolveDynamicFormulaMax(field, inputFieldValues, equipmentDetail);
                                const combinedLimit =
                                  sampleSets.length > 0
                                    ? primaryCombinedLimits.find((l) => l.key === field.field_key)
                                    : undefined;
                                const { bounds, maxHint } = boundsWithCombinedMax(
                                  resolveNumericFieldBounds(field, formulaMax),
                                  combinedLimit,
                                  combinedLimit ? maxForPrimarySet(combinedLimit, sampleSets) : undefined
                                );
                                return (
                                  <NumericFieldInput
                                    id={field.field_key}
                                    value={inputFieldValues[field.field_key]}
                                    bounds={bounds}
                                    maxHint={maxHint}
                                    label={String(field.field_label || field.field_key)}
                                    onValueChange={(next) => handleInputFieldChange(field.field_key, next)}
                                    required={field.is_required}
                                    placeholder={
                                      field.is_required
                                        ? field.default_value || formatNumericBound(bounds.min)
                                        : "Optional"
                                    }
                                    disabled={!!repeatSourceBooking}
                                  />
                                );
                              }
                              
                              case 'RADIO':
                                return (
                                  <RadioGroup
                                    value={inputFieldValues[field.field_key] as string || field.default_value || ''}
                                    onValueChange={(value) => handleInputFieldChange(field.field_key, value)}
                                    required={field.is_required}
                                    disabled={!!repeatSourceBooking}
                                    aria-label={String(field.field_label || field.field_key)}
                                    className="flex flex-wrap items-center gap-x-5 gap-y-2"
                                  >
                                    {field.options && field.options.length > 0 ? (
                                      field.options.map((option: any, oi: number) => {
                                        const { value: optionValue, label: optionLabel } = normalizeChoiceOption(option, oi);
                                        return (
                                          <div key={`${field.field_key}-${oi}-${optionValue}`} className="flex items-center gap-2">
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
                                    <SelectTrigger id={field.field_key} className={dynamicFieldControlWidth(fieldType)}>
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
                                  <div
                                    role="group"
                                    aria-label={String(field.field_label || field.field_key)}
                                    className="flex flex-wrap items-center gap-x-5 gap-y-2"
                                  >
                                    {field.options && field.options.length > 0 ? (
                                      field.options.map((option: any, oi: number) => {
                                        const { value: optionValue, label: optionLabel } = normalizeChoiceOption(option, oi);
                                        const currentValues = (inputFieldValues[field.field_key] as string[]) || [];
                                        const isChecked = currentValues.includes(optionValue);
                                        
                                        return (
                                          <div key={`${field.field_key}-${oi}-${optionValue}`} className="flex items-center gap-2">
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
                                  <Switch
                                    id={field.field_key}
                                    checked={inputFieldValues[field.field_key] === true || inputFieldValues[field.field_key] === 'true'}
                                    onCheckedChange={(checked) => handleInputFieldChange(field.field_key, checked)}
                                    required={field.is_required}
                                    disabled={!!repeatSourceBooking}
                                  />
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
                                const resolvedPeriodicKey = resolvePeriodicFieldKey(String(field.source_element_field_key || ""));
                                return (
                                  <div className="space-y-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Input
                                        id={field.field_key}
                                        type="number"
                                        value={String(value)}
                                        readOnly
                                        disabled
                                        className="w-20 bg-muted font-medium tabular-nums"
                                      />
                                      <Button
                                        type="button"
                                        variant="outline"
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
                                    </div>
                                    {field.help_text && (
                                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{field.help_text}</p>
                                    )}
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
                                                        aria-label={`${columns[ci] || `Column ${ci + 1}`}, row ${ri + 1}`}
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
                                                      aria-label={`Delete row ${ri + 1}`}
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

                          const icpmsCoverage =
                            fieldType === 'ICPMS_STANDARD_COVERAGE' ? icpmsCoverageByFieldKey[field.field_key] : undefined;
                          
                          return (
                            <div key={field.field_key} className="space-y-1.5" data-booking-field={field.field_key}>
                              <DynamicFieldRow
                                fieldType={fieldType}
                                label={field.field_label}
                                htmlFor={field.field_key}
                                required={field.is_required}
                              >
                                <div className="text-base [&_input]:text-base [&_textarea]:text-base [&_button]:text-base">
                                  {renderInputField()}
                                </div>
                              </DynamicFieldRow>
                              {icpmsCoverage?.standards && icpmsCoverage.standards.length > 0 && (
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
                                        {icpmsCoverage.standards.map((s) => (
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
                              {bookingAsExternalTarget &&
                                !repeatSourceBooking &&
                                String(field.field_label || "").toLowerCase().includes("any other requirements") && (
                                  <div className="mt-4 p-4 rounded-lg border bg-background">
                                    <Label className="text-sm">
                                      Would you like your samples to be sent back once the analysis is complete?
                                    </Label>
                                    <RadioGroup
                                      className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2"
                                      aria-label="Send samples back after analysis"
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

                  {sampleSetsOffered && (
                    <div className={cn("mb-2", !showSampleSetOneHeader && "px-2")} data-testid="booking-sample-sets">
                      <SampleSetsEditor
                        fields={sampleSetFields}
                        sets={sampleSets}
                        onChange={setSampleSets}
                        primaryValues={inputFieldValues}
                        allowAdd={sampleSetsAllowed}
                        slotDurationMinutes={toFiniteNumber(equipmentDetail?.slot_duration_minutes)}
                        compact={peakCompact}
                      />
                    </div>
                  )}

                  {!repeatSourceBooking &&
                    !isCalculateChargesFlow &&
                    !isProformaFlow &&
                    atmosphereSensitiveAllowed && (
                    <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="atmosphere-sensitive-sample"
                          checked={atmosphereSensitiveSample}
                          onCheckedChange={(c) => setAtmosphereSensitiveSample(c === true)}
                        />
                        <Label htmlFor="atmosphere-sensitive-sample" className="font-medium cursor-pointer">
                          Atmosphere-sensitive sample (submit at slot start)
                        </Label>
                        <InfoTip label="About atmosphere-sensitive samples">
                          Select if the sample must be brought at the booking start time instead of the normal submission lead time.
                          Lab staff will be notified and should not mark the booking as Not Utilized before the slot begins.
                        </InfoTip>
                      </div>
                    </div>
                  )}

                  {/* Periodic table element selector dialog */}
                  <PeriodicElementsDialog
                    open={!!periodicTableFieldKey}
                    onOpenChange={(open) => !open && setPeriodicTableFieldKey(null)}
                    helpText={
                      equipmentDetail?.input_fields?.find(
                        (f: { field_key?: string }) => f.field_key === periodicTableFieldKey
                      )?.help_text
                    }
                    selected={selectedPeriodicSymbols}
                    onSelectedChange={setSelectedPeriodicSymbols}
                    onApply={async () => {
                      if (!periodicTableFieldKey) return;
                      await applyPeriodicSelectionFromElementSymbols(
                        periodicTableFieldKey,
                        Array.from(selectedPeriodicSymbols)
                      );
                    }}
                  />
                  
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
                  
                  {!chargeCalculated &&
                    !loadingCharge &&
                    !chargeCalculationFailed &&
                    !repeatSourceBooking &&
                    equipmentDetail?.profile_type !== "PRINT_3D" &&
                    missingStep1Fields.length > 0 && (
                    <MissingFieldsHint
                      fields={missingStep1Fields}
                      onFocusField={(key) => {
                        setSampleInfoExpanded(true);
                        window.requestAnimationFrame(() => focusBookingField(key));
                      }}
                    />
                  )}

                  {chargeCalculationFailed && !loadingCharge && (() => {
                    const friendly = friendlyChargeError(chargeErrorRaw?.message, { network: chargeErrorRaw?.network });
                    const staffDetail =
                      isAdminOrOIC() && friendly.kind === "no_profile"
                        ? {
                            ...friendly,
                            title: "No charges set up for this user's category",
                            detail:
                              equipmentDetail?.profile_type === "PRINT_3D"
                                ? "Check that a user is selected and STL analysis completed, then try again."
                                : "Add an active charge profile for this user's type on the equipment, then try again.",
                          }
                        : friendly;
                    return (
                      <ChargeErrorNotice
                        error={staffDetail}
                        onRetry={() => {
                          lastCalculatedValuesRef.current = "";
                          setChargeErrorRaw(null);
                          setChargeCalculationFailed(false);
                        }}
                      />
                    );
                  })()}
                  </CollapsibleContent>
                </Collapsible>

                {/* Step 2: Calculated Charge Display (repeat sample: complimentary only) */}
                {chargeCalculated && calculatedCharge && !chargeCalculationFailed && (
                  <Collapsible open={chargeCalcExpanded} onOpenChange={setChargeCalcExpanded} className="mb-3">
                  <div className="p-3 bg-primary/10 rounded-lg border-2 border-primary">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h3 className="text-base font-semibold">
                        {repeatSourceBooking ? "Step 2: Repeat sample (no charge)" : "Step 2: Charge Calculation"}
                        {!chargeCalcExpanded && (
                          <span className="ml-2 text-sm font-normal text-muted-foreground">
                            ({formatINRAmount(calculatedCharge?.reward?.final_payable ?? calculatedCharge.total_charge)})
                          </span>
                        )}
                      </h3>
                      <CollapsibleTrigger asChild>
                        <Button type="button" variant="ghost" size="sm" className="shrink-0 gap-1 text-sm">
                          {chargeCalcExpanded ? (
                            <>
                              <ChevronUp className="h-4 w-4" />
                              Collapse
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-4 w-4" />
                              Expand
                            </>
                          )}
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent>
                    {equipmentDetail?.profile_type === "PRINT_3D" && (
                      <p className="text-sm font-bold text-amber-900 mb-2">{PRINT_3D_TENTATIVE_CHARGE_NOTE}</p>
                    )}
                    {isUrgentHoldMode && (
                      <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
                        <p className="font-semibold">Urgent booking charges</p>
                        <p className="mt-0.5 leading-relaxed">
                          Type B: selecting slots here holds them at <strong>50% surcharge</strong> — they are not auto-confirmed. Students need their supervisor&apos;s approval first, then the OIC gives final approval; your wallet is charged only after that final approval. Type A rush relief uses advance-week booking at normal rates (no surcharge).
                        </p>
                      </div>
                    )}
                    <div className="space-y-1.5 text-base">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Total Time:</span>
                        <span>
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
                              <span className="shrink-0 tabular-nums">{formatINRAmount(item.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="mt-4 pt-3 border-t space-y-1.5">
                        {calculatedCharge.normal_charge != null &&
                        calculatedCharge.applied_profile &&
                        calculatedCharge.applied_profile !== "Normal" ? (
                          <div className="flex justify-between text-sm text-muted-foreground">
                            <span>Normal Charge</span>
                            <span>{formatINRAmount(calculatedCharge.normal_charge)}</span>
                          </div>
                        ) : null}
                        <div className="flex justify-between font-semibold text-base pt-1">
                          <span>Final amount</span>
                          <span>{formatINRAmount(calculatedCharge.total_charge)}</span>
                        </div>
                      </div>
                      {rewardSummary?.config?.is_enabled && !isCalculateChargesFlow && (
                        <div className="pt-3 border-t space-y-2">
                          <p className="text-xs text-muted-foreground">
                            Available reward points: <span className="font-medium text-foreground">{rewardSummary.points_balance}</span>
                          </p>
                          <div className="flex items-center gap-2">
                            <Input
                              aria-label="Reward points to redeem"
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
                              Applied {calculatedCharge?.reward?.points_applied} points for discount of {formatINRAmount(calculatedCharge?.reward?.discount_amount)}
                            </p>
                          )}
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-3 border-t">
                        <span className="text-base font-semibold">Total Charge:</span>
                        <span className="text-xl font-bold text-primary">
                          {formatINRAmount(calculatedCharge?.reward?.final_payable ?? calculatedCharge.total_charge)}
                        </span>
                      </div>
                    </div>
                    </CollapsibleContent>
                  </div>
                  </Collapsible>
                )}

                {isProformaFlow && chargeCalculated && calculatedCharge && !chargeCalculationFailed && (
                  <div className="mb-3 flex flex-wrap gap-3 items-center rounded-lg border border-primary/30 bg-primary/5 p-3">
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
                  <div className="mb-3 flex flex-wrap gap-3 items-center rounded-lg border border-primary/30 bg-primary/5 p-3">
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
                </>

                {/* Step 3: Slot Selection (only shown after charge calculation) */}
                {showSlots && chargeCalculated && !isProformaFlow && !isCalculateChargesFlow && !isTemplateFlow && (
                  <>
                    <div className="mb-2">
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                        <h3 className="text-base font-semibold">Step 3: Select Time Slots</h3>
                        <SlotChoiceOptions
                          heading="Choose slots:"
                          choices={templateHasPreferredSlot ? ["manual", "auto", "preferred"] : ["manual", "auto"]}
                          value={bookingSlotChoice}
                          onChange={changeBookingSlotChoice}
                          helps={{
                            auto: equipmentDetail?.split_booking_enabled
                              ? "Selects the required consecutive slots for you; if none are consecutive, separate free slots are selected."
                              : "Selects the required consecutive slots for you (only consecutive slots can be booked here).",
                            preferred: "Selects your template's weekly preferred slot in the next week you can book.",
                          }}
                        />
                      </div>
                    </div>

                {quotaBlock && (
                  <QuotaRemainingNotice blockReason={quotaBlock} className="mb-2" />
                )}
                {takenSlotIds.size > 0 && (
                  <p className="mb-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100" role="status">
                    Slots marked <span className="font-semibold">"Just taken"</span> were booked by someone else while you were confirming. Pick other slots and confirm again — your details are kept.
                  </p>
                )}
                {/* Week nav + grid: full overlay until API data matches visible week (avoids misleading stale grid when changing weeks, e.g. urgent extension). */}
                <TooltipProvider delayDuration={200}>
                <div className="relative rounded-lg border border-border/70 bg-muted/30 dark:bg-muted/10 p-3 sm:p-4 min-h-[min(520px,70vh)]">
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
                <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={goToPreviousWeek}
                    disabled={!canGoToPreviousWeek()}
                  >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Previous Week
                  </Button>
                  <div className="text-center order-first basis-full min-w-0 sm:order-none sm:basis-auto sm:flex-1">
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
                        const schedule = formatSlotReleaseSchedule(Number(refWeekday), String(refTime));
                        return (
                          <div className="mt-1 flex flex-col items-center gap-1.5">
                            <p className="text-base font-semibold text-primary bg-primary/10 px-3 py-2 rounded-md">
                              Current week only — new slots open {schedule}.
                            </p>
                            <SlotOpeningCountdown
                              refWeekday={Number(refWeekday)}
                              refTime={String(refTime)}
                              onOpen={handleSlotsOpened}
                            />
                          </div>
                        );
                      }
                      return (
                        <p className="text-base font-semibold text-primary mt-1 bg-primary/10 px-3 py-2 rounded-md">
                          Available: {nextWeekAvailable ? "Current week and next week" : "Current week only"}
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

                {isAdminOrOIC() &&
                  (Boolean(equipmentDetail?.weekly_view_time_from || equipmentDetail?.weekly_view_time_to) ||
                    (equipmentDetail?.daily_slots ?? []).some((s) => isOutsideVisibilityWindow(s))) && (
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <SlotVisibilityScopeToggle value={slotVisibilityScope} onChange={setSlotVisibilityScope} />
                    {slotVisibilityScope === "all" &&
                      (equipmentDetail?.daily_slots ?? []).some((s) => isOutsideVisibilityWindow(s)) && (
                      <RestrictedSlotLegend
                        className="flex-1 min-w-[260px]"
                        from={equipmentDetail?.weekly_view_time_from}
                        to={equipmentDetail?.weekly_view_time_to}
                      />
                    )}
                  </div>
                )}

                {/* Slot Grid */}
                {(() => {
                  const overQuotaForUser = !!quotaBlock && !isAdminOrOIC();
                  const visibleDayOffsets = isMobileViewport ? [mobileDayOffset] : [0, 1, 2, 3, 4, 5, 6];
                  const gridColumnsStyle: CSSProperties | undefined = isMobileViewport
                    ? { gridTemplateColumns: "5.5rem minmax(0, 1fr)" }
                    : undefined;
                  const dayColumnsStyle: CSSProperties | undefined = isMobileViewport
                    ? { gridTemplateColumns: "minmax(0, 1fr)" }
                    : undefined;
                  return (
                <div className="overflow-x-auto relative">
                  {isMobileViewport && (
                    <div className="mb-2 flex gap-1 overflow-x-auto pb-1" role="group" aria-label="Choose a day">
                      {[0, 1, 2, 3, 4, 5, 6].map((dayOffset) => {
                        const day = addDays(currentWeekStart, dayOffset);
                        const active = dayOffset === mobileDayOffset;
                        const hasFree = dayHasSelectableSlot(day);
                        const hasSelected = selectedSlots.some((s) => isSameDay(s.date, day));
                        return (
                          <button
                            key={dayOffset}
                            type="button"
                            aria-pressed={active}
                            aria-label={`${format(day, "EEEE d MMMM")}${hasFree ? ", has free slots" : ", no free slots"}${hasSelected ? ", has selected slots" : ""}`}
                            onClick={() => setMobileSlotDayOffset(dayOffset)}
                            className={cn(
                              "flex min-w-[3.25rem] flex-col items-center rounded-md border px-2 py-1 text-xs",
                              active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background",
                            )}
                          >
                            <span className="font-semibold">{format(day, "EEE")}</span>
                            <span>{format(day, "d")}</span>
                            <span
                              className={cn(
                                "mt-0.5 h-1.5 w-1.5 rounded-full",
                                hasSelected ? "bg-sky-500" : hasFree ? "bg-emerald-500" : "bg-transparent",
                              )}
                              aria-hidden
                            />
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className={isMobileViewport ? undefined : "min-w-[800px]"}>
                    {/* Header with days */}
                    <div className={cn("grid gap-2 mb-2", !isMobileViewport && "grid-cols-8")} style={gridColumnsStyle}>
                      <div className="font-semibold text-sm p-2 sticky left-0 z-10 bg-muted/90 dark:bg-background/95 rounded-md">
                        {getEffectiveWeeklyViewDisplay() === "SLOT_ID" ? "Slot position" : "Time"}
                      </div>
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

                    {/* Time slots - use Slot Master open_time values (user-defined), else derive from slots */}
                    {(() => {
                      const hideStaffOnlySlots = slotVisibilityScope === "user" && isAdminOrOIC();
                      const rowKeysAndLabels = hideStaffOnlySlots
                        ? getWeeklyRowKeysAndLabels().filter(({ key }) => {
                            const rowSlots = [0, 1, 2, 3, 4, 5, 6]
                              .map((d) => getSlotData(addDays(currentWeekStart, d), key))
                              .filter((s): s is NonNullable<typeof s> => s !== undefined);
                            return rowSlots.length === 0 || rowSlots.some((s) => !isOutsideVisibilityWindow(s));
                          })
                        : getWeeklyRowKeysAndLabels();
                      const rowKeys = rowKeysAndLabels.map((r) => r.key);
                      const hasSlotsFromApi = (equipmentDetail?.daily_slots?.length ?? 0) > 0;
                      const fetchedButEmpty = !loadingSlots && lastFetchedWeek && !hasSlotsFromApi;

                      if (rowKeys.length === 0) {
                        return (
                          <div className="col-span-8 p-4 text-center text-muted-foreground">
                            <p>No time slots available for this equipment.</p>
                            {equipmentDetail?.daily_slots && equipmentDetail.daily_slots.length > 0 && (
                              <p className="text-xs mt-2">Try a different week.</p>
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
                          const schedule = formatSlotReleaseSchedule(Number(refWeekday), String(refTime));
                          return (
                            <div className="col-span-8 flex flex-col items-center justify-center py-12 px-4 text-center">
                              <div className="max-w-md space-y-4">
                                <p className="text-muted-foreground text-base leading-relaxed">
                                  No slots available for this week.
                                </p>
                                <div className="rounded-lg border bg-muted/40 px-5 py-4 space-y-2">
                                  <p className="text-base font-medium text-foreground">
                                    New slots open {schedule}.
                                  </p>
                                  <SlotOpeningCountdown
                                    refWeekday={Number(refWeekday)}
                                    refTime={String(refTime)}
                                    onOpen={handleSlotsOpened}
                                  />
                                  {draftEnabled && (
                                    <p className="text-muted-foreground text-sm">
                                      Your details above are saved on this device, so you can come back and confirm quickly.
                                    </p>
                                  )}
                                </div>
                                {waitlistDepth > 0 && !hasBookableSlotInSelectedWeek && !bookingAsExternalTarget && (
                                  <div className="rounded-lg border bg-background px-5 py-4">
                                    {waitlistHasRoom ? (
                                      <>
                                        <p className="text-sm text-foreground">No slots are free right now. Join the queue and we'll book a slot for you if one frees up.</p>
                                        <p className="text-xs text-muted-foreground mt-1">People in the queue: {waitlistCount} of {waitlistDepth}</p>
                                        <Button className="mt-3" size="sm" onClick={() => setWaitlistIntentMode(true)}>Join the queue</Button>
                                      </>
                                    ) : (
                                      <p className="text-sm text-muted-foreground">{WAITLIST_FULL_MESSAGE}</p>
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
                                  <Button size="sm" onClick={() => setWaitlistIntentMode(true)}>Join the queue</Button>
                                ) : (
                                  <p className="text-sm text-muted-foreground">{WAITLIST_FULL_MESSAGE}</p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })() : null;

                      const handleSlotGridGuardPointerDown = (e: React.PointerEvent) => {
                        if (!autoSlotSelection || !chargeCalculated || !showSlots) return;
                        if (loadingSlots || isSlotsWeekViewLoading) return;
                        // Greyed-out cells only explain themselves; they never change the selection.
                        if ((e.target as HTMLElement | null)?.closest?.('[aria-disabled="true"]')) return;
                        e.preventDefault();
                        e.stopPropagation();
                        setAutoSlotGuardPending("calendar");
                        setAutoSlotGuardDialogOpen(true);
                      };
                      
                      const rows = rowKeys.map((rowKey, rowIndex) => {
                      const rowLabel = rowKeysAndLabels[rowIndex]?.label ?? rowKey;
                      const time = rowKey;
                      return (
                      <div key={rowKey} className={cn("grid gap-2 mb-2", !isMobileViewport && "grid-cols-8")} style={gridColumnsStyle}>
                        <div className="text-sm p-2 font-medium flex items-center sticky left-0 z-10 bg-muted/90 dark:bg-background/95 rounded-md">
                          {rowLabel}
                        </div>
                        <div
                          className={cn("grid gap-2", !isMobileViewport && "col-span-7 grid-cols-7")}
                          style={dayColumnsStyle}
                          onPointerDownCapture={handleSlotGridGuardPointerDown}
                        >
                        {visibleDayOffsets.map((dayOffset) => {
                          const day = addDays(currentWeekStart, dayOffset);
                          const isBooked = isSlotBooked(day, time);
                          const isSelected = isSlotSelected(day, time);
                          
                          // Check if slot exists in daily_slots for this day and row key (time or slot_number)
                          const rawSlotData = useWeeklySlots() ? getSlotData(day, time) : undefined;
                          const slotData =
                            hideStaffOnlySlots && isOutsideVisibilityWindow(rawSlotData) ? undefined : rawSlotData;
                          const slotExists = slotData !== undefined;
                          // Past: use slot start datetime when available; else parse time "HH:mm" for TIME mode
                          const isPast = (slotData?.start_datetime
                            ? parseISO(slotData.start_datetime) < new Date()
                            : (time.includes(":")
                              ? (() => { const [h, m] = time.split(":").map(Number); const d = new Date(day); d.setHours(h, m || 0, 0, 0); return d < new Date(); })()
                              : false)) || slotStartsBeforeRepeatWindow(day, time, slotData);
                          
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
                          let displayStatus = holidayName ? holidayCellLabel(holidayName) : "—";
                          let isDisabled = true;
                          
                          if (slotExists) {
                            // Priority: Show booking status if slot has booking (even on holidays/Saturday/Sunday). Admin: only BOOKED is non-selectable; admin can book past/weekend/holiday.
                            if (considerBooked) {
                              // Holiday clarity: when the slot is closed due to a holiday/weekend (NOT_AVAILABLE),
                              // show the holiday name instead of the generic status label.
                              if (holidayName && slotStatusUpper === "NOT_AVAILABLE") {
                                displayStatus = holidayCellLabel(holidayName);
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
                            } else if (overQuotaForUser) {
                              displayStatus = "Over your quota";
                              isDisabled = true;
                            } else {
                              displayStatus = "Available";
                              isDisabled = false;
                            }
                          } else {
                            displayStatus = holidayName ? holidayCellLabel(holidayName) : "—";
                          }
                          const justTaken = considerBooked && slotData?.id != null && takenSlotIds.has(slotData.id);
                          if (justTaken) displayStatus = "Just taken";

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

                          const overQuotaCell = displayStatus === "Over your quota" && !isSelected;
                          if (overQuotaCell) {
                            cellStyle = { backgroundColor: "#e2e8f0", color: "#334155" };
                          }

                          if (externalCalendarDayOverlay) {
                            displayStatus = holidayName
                              ? holidayCellLabel(holidayName)
                              : isSaturdayCol ? "Saturday" : isSundayCol ? "Sunday" : "—";
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

                          const restrictedToStaff = slotExists && isAdminOrOIC() && isOutsideVisibilityWindow(slotData);
                          if (restrictedToStaff) {
                            cellStyle = restrictedSlotStyle(cellStyle);
                          }

                          const slotReason = unavailableBookingSlotReason({
                            slotExists,
                            isDisabled,
                            isSelected,
                            isPast,
                            considerBooked,
                            holidayName,
                            isSaturdayCol,
                            isSundayCol,
                            slotStatusUpper,
                            slotStatusLabel,
                            blockedLabel,
                            bookingId,
                            deptBlockedForUser,
                            statusDisplay: slotData?.status_display,
                            notConsecutive,
                            limitReached,
                            wouldExceedLimit,
                            chargeNotCalculated,
                            isAdminOrOic: isAdminOrOIC(),
                            justTaken,
                            overQuotaReason: overQuotaForUser ? quotaBlock : null,
                          });
                          const unavailableReason = restrictedToStaff
                            ? [
                                restrictedSlotHint(equipmentDetail?.weekly_view_time_from, equipmentDetail?.weekly_view_time_to),
                                slotReason,
                              ].filter(Boolean).join(" ")
                            : slotReason;
                          // OIC/admin: every non-Available slot explains itself on hover, even when still selectable
                          // (staff can book over Blocked / Not Available slots, so those cells are not disabled).
                          const staffStatusLines =
                            isAdminOrOIC() && slotExists && !isSelected
                              ? slotStatusHoverLines(slotData, {
                                  holidayName,
                                  isWeekend: isSaturdayCol || isSundayCol,
                                })
                              : [];
                          const hoverLines = staffStatusLines.length > 0
                            ? [
                                ...staffStatusLines,
                                ...(restrictedToStaff
                                  ? [restrictedSlotHint(equipmentDetail?.weekly_view_time_from, equipmentDetail?.weekly_view_time_to)]
                                  : []),
                                ...(isDisabled && !considerBooked && slotReason && (chargeNotCalculated || notConsecutive || limitReached || wouldExceedLimit)
                                  ? [slotReason]
                                  : []),
                              ]
                            : unavailableReason
                              ? [unavailableReason]
                              : [];

                          const slotStartLabel = slotData?.start_datetime ? format(parseISO(slotData.start_datetime), "HH:mm") : rowLabel;
                          const slotEndLabel = slotData?.end_datetime ? format(parseISO(slotData.end_datetime), "HH:mm") : null;
                          const slotWhen = `${format(day, "EEE d MMM")}, ${slotEndLabel ? `${slotStartLabel}–${slotEndLabel}` : slotStartLabel}`;
                          const accessibleLabel = slotAccessibleLabel({
                            date: day,
                            start: slotStartLabel,
                            end: slotEndLabel,
                            state: isSelected ? "selected" : isDisabled ? "unavailable" : "available",
                            shortReason: isDisabled ? shortSlotReason(unavailableReason) : null,
                          });

                          const cellButton = (
                            <button
                              type="button"
                              onClick={(e) => {
                                if (isDisabled) {
                                  setSlotReasonTarget({
                                    anchor: e.currentTarget,
                                    title: slotWhen,
                                    reason: unavailableReason || "This slot is not available for booking.",
                                  });
                                  return;
                                }
                                toggleSlot(day, time);
                              }}
                              aria-disabled={isDisabled || undefined}
                              aria-pressed={isSelected}
                              aria-label={staffStatusLines.length > 0 ? `${accessibleLabel}. ${hoverLines.join(". ")}` : accessibleLabel}
                              className={`
                                w-full p-3 rounded-md text-sm transition-all min-h-[48px] flex items-center justify-center font-medium border-2 border-white/50 shadow-sm
                                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1
                                ${!slotExists ? 'cursor-help' : ''}
                                ${considerBooked ? 'cursor-help' : ''}
                                ${justTaken ? 'ring-2 ring-amber-500 ring-offset-1' : ''}
                                ${isPast && !considerBooked && slotExists && !isAdminOrOIC() ? 'cursor-help' : ''}
                                ${isSelected ? 'bg-primary text-primary-foreground' : ''}
                                ${(isAvailable || (isAdminOrOIC() && slotExists && !considerBooked)) && !isSelected && !isDisabled ? 'cursor-pointer hover:opacity-90' : ''}
                                ${(isAvailable || (isAdminOrOIC() && slotExists && !considerBooked)) && !isSelected && isDisabled ? (overQuotaCell ? 'cursor-help' : 'cursor-help opacity-60') : ''}
                              `}
                              style={cellStyle}
                            >
                              {restrictedToStaff ? <Lock className="mr-1 h-3.5 w-3.5 shrink-0" aria-label="Visible only to OIC and administrators" /> : null}
                              {displayStatus}
                            </button>
                          );

                          if (staffStatusLines.length === 0) {
                            return <div key={dayOffset}>{cellButton}</div>;
                          }

                          return (
                            <Tooltip key={dayOffset}>
                              <TooltipTrigger asChild>
                                <div className="w-full h-full">{cellButton}</div>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="z-[120] max-w-xs text-left px-3 py-2"
                              >
                                {staffStatusLines.length > 0 ? <SlotHoverLines lines={hoverLines} /> : unavailableReason}
                              </TooltipContent>
                            </Tooltip>
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
                </TooltipProvider>
                <SlotReasonPopover target={slotReasonTarget} onClose={() => setSlotReasonTarget(null)} />

                    {/* Booking Summary */}
                    {selectedSlots.length > 0 && (
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-muted px-3 py-2 text-sm" data-testid="booking-summary">
                        <span className="font-medium">Selected Slots: {selectedSlots.length}</span>
                        <span className="text-muted-foreground">
                          {calculatedCharge ? (
                            <>
                              {getEffectiveSelectedMinutes()} minutes / {calculatedCharge.total_time_minutes} minutes
                            </>
                          ) : (
                            <>Total Hours: {selectedSlots.length}</>
                          )}
                        </span>
                        {calculatedCharge && (
                          <span className="text-muted-foreground">
                            Remaining:{" "}
                            <span className={`font-medium text-foreground ${getRemainingMinutes() === 0 ? '!text-destructive' : ''}`}>
                              {getRemainingMinutes()} minutes
                            </span>
                          </span>
                        )}
                        <span className="ml-auto flex items-baseline gap-2">
                          <span className="text-muted-foreground">Total Cost</span>
                          <span className="text-xl font-bold">
                            {formatINRAmount(
                              calculatedCharge
                                ? calculatedCharge.total_charge
                                : calculateTotalCost()
                            )}
                          </span>
                        </span>
                      </div>
                    )}

                    {/* Waitlist and "any free slots" are internal only; external users only see alternate equipment and a template's own fallback. */}
                    {(!bookingAsExternalTarget || groupAlternativeOption || templateFallbackMode) && (
                      <BookingFallbackOptions
                        className="mt-3"
                        choices={bookingFallbackChoices}
                        value={bookingSlotFallback}
                        onChange={changeBookingSlotFallback}
                        alternate={{
                          show: groupAlternativeOption,
                          checked: autoAllocateAlternative,
                          onChange: setAutoAllocateAlternative,
                        }}
                        waitlist={{
                          show:
                            !bookingAsExternalTarget &&
                            Number(equipmentDetail?.waitlist_queue_depth || 0) > 0 &&
                            !hasBookableSlotInSelectedWeek,
                          checked: waitlistIntentMode,
                          onChange: setWaitlistIntentMode,
                        }}
                        hint={groupAlternativeSearchWithoutSlots ? NO_SLOT_ALTERNATE_HINT : undefined}
                      />
                    )}

                    {!bookingForAnotherUser && (
                      <ResearchWorkspacePicker
                        className="mt-3"
                        value={researchWorkspaceId}
                        onChange={setResearchWorkspaceId}
                        folderLabel={researchFolderLabel}
                        rememberLast
                        collapsible={peakCompact}
                      />
                    )}

                    {isRegularBookingFlow && selectedSlots.length > 0 && (() => {
                      const ordered = [...selectedSlots]
                        .filter((s) => s.slotData?.start_datetime)
                        .sort((a, b) => a.slotData!.start_datetime.localeCompare(b.slotData!.start_datetime));
                      if (ordered.length === 0) return null;
                      const start = parseISO(ordered[0].slotData!.start_datetime);
                      const lastEndIso = ordered[ordered.length - 1].slotData!.end_datetime;
                      const end = lastEndIso ? parseISO(lastEndIso) : null;
                      const when = !end
                        ? format(start, "EEE d MMM, HH:mm")
                        : isSameDay(start, end)
                        ? `${format(start, "EEE d MMM, HH:mm")}–${format(end, "HH:mm")}`
                        : `${format(start, "EEE d MMM HH:mm")} – ${format(end, "EEE d MMM HH:mm")}`;
                      const minutes = calculatedCharge ? getEffectiveSelectedMinutes() : null;
                      const charge = bookingDebitAmount ?? (calculatedCharge ? null : calculateTotalCost());
                      return (
                        <p className="mt-3 text-sm text-foreground" data-testid="booking-review-line">
                          <span className="font-medium">Review: </span>
                          {[
                            workspaceEquipmentTitle || null,
                            `${ordered.length} slot${ordered.length !== 1 ? "s" : ""}, ${when}`,
                            minutes != null ? `${minutes} min` : null,
                            charge != null && Number.isFinite(charge) ? formatINRAmount(charge) : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      );
                    })()}

                    {walletLinkRequired && !bookingForAnotherUser && (
                      <p role="status" className="mt-4 text-sm text-amber-900 dark:text-amber-100">
                        You can pick slots now, but you can confirm only after your supervisor's wallet is linked.{" "}
                        <button type="button" className="font-medium underline underline-offset-2" onClick={() => goToWalletLink()}>
                          {walletStatus.kind === "link_pending" ? "View request" : "Link supervisor's wallet"}
                        </button>
                      </p>
                    )}
                    {walletStatus.kind === "insufficient" && !bookingForAnotherUser && (
                      <div
                        role="alert"
                        className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-300/70 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-50"
                        data-testid="insufficient-funds-warning"
                      >
                        <p className="flex-1 min-w-[12rem]">{insufficientFundsMessage(walletStatus)}</p>
                        <Button size="sm" variant="outline" onClick={() => goToWalletRecharge(walletStatus.shortfall)}>
                          Recharge {formatINRAmount(walletStatus.shortfall)}
                        </Button>
                      </div>
                    )}
                    {walletStatus.kind === "blocked" && !bookingForAnotherUser && (
                      <p role="alert" className="mt-4 rounded-lg border border-amber-300/70 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-50">
                        {walletStatus.message}
                      </p>
                    )}

                    {/* Action Buttons */}
                    <div className="mt-3 space-y-2 empty:hidden">
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
                        <div role="alert" className="w-full rounded-lg border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm font-bold text-amber-950 dark:text-amber-50">
                          Booking is disabled while equipment is{" "}
                          <span>
                            {String((selectedEquipment as any)?.status_display || (selectedEquipment as any)?.status || "Not Operational")}
                          </span>
                          .
                        </div>
                      ) : null}
                    </div>
                    <BookingActionBar
                      summary={(() => {
                        const total = bookingDebitAmount ?? (calculatedCharge ? null : calculateTotalCost());
                        return (
                          <>
                            <span className="font-semibold">
                              {selectedSlots.length} slot{selectedSlots.length !== 1 ? "s" : ""} selected
                            </span>
                            {total != null && Number.isFinite(total) ? (
                              <>
                                <span className="text-muted-foreground"> · Total </span>
                                <span className="font-semibold">{formatINRAmount(total)}</span>
                              </>
                            ) : null}
                          </>
                        );
                      })()}
                    >
                      <Button
                        variant="outline"
                        className="flex-1 sm:flex-none sm:min-w-[140px]"
                        onClick={() => {
                          if (autoSlotSelection && selectedSlots.length > 0) {
                            setAutoSlotGuardPending("clear");
                            setAutoSlotGuardDialogOpen(true);
                            return;
                          }
                          setSelectedSlots([]);
                        }}
                        disabled={selectedSlots.length === 0 && !waitlistIntentEffective}
                        aria-label="Clear Selection"
                      >
                        <span className="sm:hidden" aria-hidden="true">Clear</span>
                        <span className="hidden sm:inline" aria-hidden="true">Clear Selection</span>
                      </Button>
                      <Button
                        variant="outline"
                        className="hidden sm:inline-flex sm:min-w-[140px]"
                        onClick={() => navigate("/equipments")}
                      >
                        Book another equipment
                      </Button>
                      <Button
                        className="flex-[2] sm:flex-none sm:min-w-[200px]"
                        onClick={handleBooking}
                        disabled={
                          !selectedEquipmentIsOperational ||
                          (selectedSlots.length === 0 && !canSubmitWithoutSlots) ||
                          isSubmittingBooking ||
                          (walletLinkRequired && !bookingForAnotherUser)
                        }
                      >
                        {isSubmittingBooking ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Confirming…
                          </>
                        ) : (
                          <>
                            {isRushReliefMode
                              ? "Confirm Type A booking"
                              : isUrgentTypeBHoldMode
                              ? ((["my-urgent-requests", "urgent-requests-wallet", "dashboard"].includes(
                                    searchParams.get("return_to") || ""
                                  ))
                                  ? <>Hold slots and return ({selectedSlots.length} slot{selectedSlots.length !== 1 ? "s" : ""})</>
                                  : <>Submit Request ({selectedSlots.length} slot{selectedSlots.length !== 1 ? "s" : ""})</>)
                              : (waitlistIntentEffective && selectedSlots.length === 0
                                  ? <>Confirm Waitlisted Booking</>
                                  : groupAlternativeSearchWithoutSlots
                                  ? <>Find alternate equipment</>
                                  : <>Confirm Booking ({selectedSlots.length} slot{selectedSlots.length !== 1 ? "s" : ""})</>)}
                          </>
                        )}
                      </Button>
                    </BookingActionBar>
                    <div className="mt-1 sm:hidden">
                      <Button variant="link" size="sm" className="h-auto px-0" onClick={() => navigate("/equipments")}>
                        Book another equipment
                      </Button>
                    </div>
                  </>
                )}

                {isTemplateFlow && equipmentDetail && (
                  <div className="mt-4 space-y-3" data-template-section="preferred-slot">
                    <TemplateSlotSettings
                      autoSlotSelection={autoSlotSelection}
                      onAutoSlotSelectionChange={setAutoSlotSelection}
                      draft={preferredSlotDraft}
                      onDraftChange={setPreferredSlotDraft}
                      bookAny={bookAnyAvailableSlots}
                      single={bookEvenIfSingleSlotAvailable}
                      onFallbackFlagsChange={({ bookAny, single }) => {
                        setBookAnyAvailableSlots(bookAny);
                        setBookEvenIfSingleSlotAvailable(single);
                      }}
                      allowAnySlots={!bookingAsExternalTarget}
                      alternate={{
                        show: groupAlternativeOption,
                        checked: autoAllocateAlternative,
                        onChange: setAutoAllocateAlternative,
                      }}
                      waitlist={{
                        show: !bookingAsExternalTarget,
                        checked: waitlistIntentMode,
                        onChange: setWaitlistIntentMode,
                      }}
                      picker={{
                        slotRows: weeklyTemplateSlotRows,
                        hideTimes: weeklyRowsHideTimes,
                        slotsRequired: templateSlotsRequired,
                        slotsRequiredPending: loadingCharge || templateStaffAnalysis.loading,
                        slotDurationMinutes: equipmentDetail.slot_duration_minutes,
                        availableColor: equipmentDetail.calendar_colors?.slot_colors?.AVAILABLE,
                      }}
                    />

                    <ResearchWorkspacePicker value={researchWorkspaceId} onChange={setResearchWorkspaceId} />

                    <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-3">
                      <Label htmlFor="booking-template-name" className="text-sm font-medium">
                        Template name
                      </Label>
                      <Input
                        id="booking-template-name"
                        value={templateName}
                        maxLength={80}
                        placeholder="e.g. Routine TGA in nitrogen"
                        onChange={(e) => setTemplateName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void handleSaveTemplate();
                          }
                        }}
                      />
                      <div className="flex flex-wrap gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1 min-w-[140px]"
                          onClick={() =>
                            navigate(templateReturnTo ?? `/equipment/${equipmentDetail.equipment_id}?panel=booking_templates`)
                          }
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          className="flex-1 min-w-[140px]"
                          onClick={() => void handleSaveTemplate()}
                          disabled={savingTemplate || !templateName.trim()}
                        >
                          {savingTemplate ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="mr-2 h-4 w-4" />
                          )}
                          {editTemplateId ? "Update template" : "Save template"}
                        </Button>
                      </div>
                    </div>
                  </div>
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
                  &quot;Auto-select&quot; is chosen, so the calendar in <span className="font-medium text-foreground">Select Time Slots</span> is filled automatically for your required duration.
                </span>
                <span className="block">
                  To clear your selection or tap the calendar yourself, switch to &quot;I&apos;ll pick&quot; first.
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
                Pick myself
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
              const noSlotNoAttempts = urgentRequestType === 'NO_SLOT' && !myUnsuccessfulAttemptsLoading && myUnsuccessfulAttempts.length < RUSH_RELIEF_MIN_PEAK_ATTEMPTS;
              return (
            <>
            <DialogHeader className="shrink-0 pb-2">
              <DialogTitle className="text-xl font-semibold tracking-tight">Request urgent booking</DialogTitle>
              <DialogDescription className="text-base text-muted-foreground">
                Choose the type of urgent request that fits your situation.
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
                      <span className="font-medium text-base">Type A — Rush relief (no surcharge)</span>
                      <span className="text-muted-foreground text-sm block mt-0.5">
                        For IIT Roorkee users who tried at least {RUSH_RELIEF_MIN_PEAK_ATTEMPTS} times in the last 14 days and could not get a slot when booking opened. Book a slot in the following week at normal rates. The count starts again after you use it.
                      </span>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-4 rounded-lg border-2 border-border/80 p-4 hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="REVIEWER_URGENT" id="urgent-reviewer" className="h-5 w-5" />
                    <Label htmlFor="urgent-reviewer" className="flex-1 cursor-pointer">
                      <span className="font-medium text-base">Type B — Urgent with reason (50% surcharge)</span>
                      <span className="text-muted-foreground text-sm block mt-0.5">
                        Give a reason; 50% surcharge. Students need their supervisor&apos;s approval first, then the OIC gives final approval (and may reschedule, including weekends). Your wallet is charged only after the OIC&apos;s final approval.
                      </span>
                    </Label>
                  </div>
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
                  <p className="text-sm text-muted-foreground border border-amber-200 dark:border-amber-800 rounded-lg p-4 bg-amber-50/50 dark:bg-amber-950/20">
                    Type A is only for IIT Roorkee users when no slots are available and you have tried at least {RUSH_RELIEF_MIN_PEAK_ATTEMPTS} times without getting a slot when booking opened. You can also use Book advance week from My Urgent Requests. After you use Type A, the 14-day count starts again.
                    {noSlotNoAttempts && " You do not qualify yet — use Type B (urgent with reason) instead."}
                  </p>
                  <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-4 border border-border/60">I am unable to get any booking despite repeated trials and my requirement is genuine and urgent.</p>
                  <div className="flex items-center space-x-3">
                    <Checkbox id="urgent-disclaimer" checked={urgentDisclaimerAccepted} onCheckedChange={(c) => { const v = c === true; setUrgentDisclaimerAccepted(v); urgentDisclaimerAcceptedRef.current = v; }} className="h-5 w-5" disabled={noSlotNoAttempts} />
                    <Label htmlFor="urgent-disclaimer" className={`text-base cursor-pointer ${noSlotNoAttempts ? "cursor-not-allowed opacity-60" : ""}`}>I confirm the above.</Label>
                  </div>
                  {selectedEquipment && (
                    <div className="space-y-3 mt-4">
                      <p className="text-base font-medium text-foreground">Your unsuccessful booking attempts for this equipment (past 2 weeks)</p>
                      <p className="text-sm text-muted-foreground">
                        {myUnsuccessfulAttempts.length} of {RUSH_RELIEF_MIN_PEAK_ATTEMPTS} required attempts recorded. Attempts that failed because you reached your booking limit are not counted.
                      </p>
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
                    Explain why the booking is urgent. A <strong>50% surcharge</strong> applies. Slots are NOT auto-confirmed — OIC/Admin will review and may reschedule (including weekends). After approval, submit your sample at the earliest.
                  </p>
                  <div className="flex items-center space-x-3">
                    <Checkbox id="urgent-disclaimer-reviewer" checked={urgentDisclaimerAccepted} onCheckedChange={(c) => { const v = c === true; setUrgentDisclaimerAccepted(v); urgentDisclaimerAcceptedRef.current = v; }} className="h-5 w-5" />
                    <Label htmlFor="urgent-disclaimer-reviewer" className="text-base cursor-pointer">I confirm my reason is genuine and accept the 50% urgent surcharge.</Label>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="urgent-reviewer-comment-be" className="text-base">Reason (required)</Label>
                    <Textarea
                      id="urgent-reviewer-comment-be"
                      value={urgentReviewerComment}
                      onChange={(e) => setUrgentReviewerComment(e.target.value)}
                      placeholder="Why is this booking urgent? (min. 10 characters)"
                      rows={3}
                      className="text-base"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="urgent-evidence" className="text-base">Supporting document (optional)</Label>
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
                  (urgentRequestType === 'REVIEWER_URGENT' && urgentReviewerComment.trim().length < 10) ||
                  (urgentHoldBookingId == null && pendingHoldSelection == null) ||
                  noSlotNoAttempts
                }
                onClick={async () => {
                  if (!selectedEquipment) return;
                  if (urgentRequestType === 'REVIEWER_URGENT' && urgentReviewerComment.trim().length < 10) {
                    toast.error("Reason must be at least 10 characters.");
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
                  Please wait while we confirm your booking. The last step may take a little longer — this is normal.
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

        <GroupAlternativesDialog
          open={groupAlternatives != null}
          payload={groupAlternatives?.payload ?? null}
          busyEquipmentId={groupAltBookingId}
          waitlistBusy={groupAltWaitlistBusy}
          waitlistAvailable={
            groupAlternatives?.payload.waitlist_available ??
            groupAlternatives?.requestBody.waitlist_on_failure !== false
          }
          onBook={handleBookGroupAlternative}
          onOpenForm={handleOpenGroupAlternativeForm}
          onContinueToWaitlist={handleGroupAltWaitlist}
          onCancel={() => setGroupAlternatives(null)}
        />

        <Dialog open={bookingResultDialog.open} onOpenChange={(open) => !open && setBookingResultDialog((p) => ({ ...p, open: false }))}>
          <DialogContent className="max-w-md sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle
                className={
                  bookingResultDialog.variant === "success"
                    ? "text-green-600 dark:text-green-500"
                    : bookingResultDialog.variant === "waitlist"
                      ? "text-foreground"
                      : "text-destructive"
                }
              >
                {bookingResultDialog.variant === "success"
                  ? "Booking Confirmed Successfully"
                  : bookingResultDialog.variant === "waitlist"
                    ? "You're in the queue"
                    : "Booking unsuccessful"}
              </DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-3">
                  <p className="text-base text-foreground whitespace-pre-line">{bookingResultDialog.message}</p>
                  {bookingResultDialog.variant === "waitlist" && (
                    <p className="text-sm text-muted-foreground rounded-lg border bg-muted/40 px-3 py-2">{WAITLIST_FOLLOW_UP}</p>
                  )}
                  {bookingResultDialog.variant === "failure" && bookingResultDialog.formKept && (
                    <p className="text-sm text-foreground rounded-lg border bg-muted/40 px-3 py-2" data-testid="booking-form-kept-note">
                      Your details are kept — fix the issue and confirm again.
                    </p>
                  )}
                  {bookingResultDialog.variant === "success" && (
                    <p className="text-sm text-muted-foreground rounded-lg border bg-primary/5 dark:bg-primary/10 border-primary/25 dark:border-primary/40 px-3 py-2">
                      Confirmation email and notifications are being sent in the background — your booking is already confirmed.
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
                  {bookingResultDialog.success && bookingResultDialog.variant === "success" && (
                    <PortalFeedbackForm
                      active={bookingResultDialog.open}
                      embedded
                    />
                  )}
                  <p className="text-foreground font-medium">Do you want to book another equipment or continue booking current equipment?</p>
                </div>
              </DialogDescription>
            </DialogHeader>
            <BookingAttemptFollowUp
              snapshot={attemptSnapshot}
              slotFallback={bookingResultDialog.success ? attemptSlotFallback : null}
              slotAlternatives={bookingResultDialog.success ? null : attemptSlotAlternatives}
              onPickAlternative={attemptSnapshot?.templateId ? (a) => void pickAttemptAlternative(a) : undefined}
              onTemplateSaved={(t) => setBookingTemplates((prev) => [...prev.filter((x) => x.id !== t.id), t])}
            />
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
              {bookingResultDialog.success && researchReturnPath && researchWorkspaceId && !bookingForAnotherUser && (
                <Button
                  variant="secondary"
                  className="w-full gap-2"
                  onClick={() => {
                    setBookingResultDialog((p) => ({ ...p, open: false }));
                    navigate(researchReturnPath);
                  }}
                >
                  <FlaskConical className="h-4 w-4" />
                  Back to research workspace
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
                      adminBookForUserInfo?.email ||
                      `User #${adminBookForUserId}`;
                    setUserTransactionHistoryDialog({ open: true, userId: adminBookForUserId, userDisplayName: displayName });
                    setUserTransactionHistory({ loading: true, transactions: [], error: null });
                    try {
                      const res = await apiClient.getAdminUserTransactionHistory(adminBookForUserId, 100, 0);
                      if (res.error) {
                        setUserTransactionHistory({
                          loading: false,
                          transactions: [],
                          error: typeof res.error === "string" ? res.error : "Failed to load transactions",
                        });
                        return;
                      }
                      setUserTransactionHistory({
                        loading: false,
                        transactions: res.data?.transactions ?? [],
                        error: null,
                        scopedDepartmentNames: res.data?.scoped_department_names ?? null,
                      });
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
                  {!userTransactionHistory.loading && (userTransactionHistory.scopedDepartmentNames?.length ?? 0) > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Showing only amounts spent on equipment of{" "}
                      <span className="font-medium text-foreground">
                        {(userTransactionHistory.scopedDepartmentNames ?? []).join(", ")}
                      </span>
                      . Transactions with other departments are not shown.
                    </p>
                  )}
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
                          void exportWalletTransactionsExcel(userTransactionHistory.transactions, {
                            sheetTitle: "Transactions",
                          })
                            .then(() => toast.success("Excel file downloaded."))
                            .catch(() => toast.error("Could not export the Excel file."));
                        }}
                      >
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Excel (.xlsx)
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          void (async () => {
                            try {
                              await exportWalletTransactionsPdf(userTransactionHistory.transactions, {
                                title: `Transaction history — ${userTransactionHistoryDialog.userDisplayName}`,
                              });
                              toast.success("PDF downloaded.");
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : "PDF export failed");
                            }
                          })();
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
                <p className="text-center text-muted-foreground py-8 px-4">
                  No wallet transactions found for this user yet.
                  {adminBookForUserWalletBalance
                    ? ` Current wallet balance shown on the booking page: ${adminBookForUserWalletBalance}.`
                    : " If a booking debit was expected, confirm the booking completed and the user has an accessible wallet."}
                </p>
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
                            <span className="text-emerald-600 dark:text-emerald-400">+{formatINRAmount(tx.amount)}</span>
                          ) : (
                            <span className="text-red-600 dark:text-red-400">−{formatINRAmount(tx.amount)}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {tx.balance_after != null && String(tx.balance_after) !== "" ? formatINRAmount(tx.balance_after) : "—"}
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

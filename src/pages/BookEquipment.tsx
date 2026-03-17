import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import type { CSSProperties } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiClient } from "@/lib/api";
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
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Check, Plus, Minus, Trash2, Mail, Receipt, ExternalLink, Tag, ShieldCheck } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { BookingDetailCard, type BookingDetailCardBooking } from "@/components/BookingDetailCard";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { periodicTableElements, getCategoryColor, parseDisabledElementsFromHelpText, type Element } from "@/data/periodicTableData";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format, addDays, startOfWeek, addWeeks, subWeeks, isSameDay, parseISO, startOfDay, startOfMonth, endOfMonth, addMonths, subMonths, eachDayOfInterval, isSameMonth, startOfYear, endOfYear, addYears, subYears } from "date-fns";
import { type EquipmentData } from "@/data/equipmentData";

interface Equipment extends EquipmentData {}

interface DailySlot {
  id: number;
  slot_master: number;
  slot_number: number;
  slot_name: string;
  equipment_code: string;
  date: string;
  start_datetime: string;
  end_datetime: string;
  status: string;
  status_display?: string;
  blocked_label?: string | null;
  /** When true, slot is shown as Available to external users; only these can be booked by external users. */
  reserved_for_external?: boolean;
  /** True when slot is bookable by external users (reserved_for_external and status AVAILABLE). */
  available_for_external?: boolean;
  booking_id?: number | null;
  booking_status?: string | null;
  booking_status_display?: string | null;
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

// User type filter options for admin "Book for user" (matches backend UserType codes)
const USER_TYPE_FILTER_ALL = "__all__";
const USER_TYPE_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: USER_TYPE_FILTER_ALL, label: "All types" },
  { value: "student", label: "Student" },
  { value: "individual_student", label: "Individual Student" },
  { value: "faculty", label: "Faculty" },
  { value: "external", label: "Educational Institute" },
  { value: "RND", label: "Govt R&D Organizations" },
  { value: "Industry", label: "Industry" },
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Officer In Charge" },
  { value: "operator", label: "Lab Incharge" },
  { value: "finance", label: "Accounts In Charge" },
  { value: "other", label: "Other" },
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

/** Format slot-window reference: weekday 0-6 + time HH:mm -> "Wednesday at 21:00" */
function formatSlotWindowReference(weekday: number, timeStr: string): string {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const day = days[Math.max(0, Math.min(6, weekday))] ?? "";
  const time = (timeStr || "").trim().substring(0, 5) || "";
  return `${day} at ${time}`;
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

/** Default colors for slot statuses in Change slot status calendar (hex). */
const DEFAULT_SLOT_STATUS_COLORS: Record<string, string> = {
  AVAILABLE: "#dcfce7",
  NOT_AVAILABLE: "#e5e7eb",
  BOOKED: "#fecaca",
  BLOCKED: "#e5e7eb",
  UNDER_MAINTENANCE: "#fed7aa",
  OPERATOR_ABSENT: "#fde68a",
  BOOKING_NOT_UTILIZED: "#e9d5ff",
  HOLD: "#fef3c7",
  RESERVED_FOR_EXTERNAL: "#94a3b8",
};

const SLOT_STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Available",
  NOT_AVAILABLE: "Not Available",
  BOOKED: "Booked",
  BLOCKED: "Blocked",
  UNDER_MAINTENANCE: "Under Maintenance",
  OPERATOR_ABSENT: "Operator Absent",
  BOOKING_NOT_UTILIZED: "Booking Not Utilized",
  HOLD: "Hold",
  RESERVED_FOR_EXTERNAL: "Reserved for External User",
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

const BookEquipment = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loadingEquipmentDetail, setLoadingEquipmentDetail] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [equipmentDetail, setEquipmentDetail] = useState<EquipmentDetail | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userType, setUserType] = useState<string | number | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedSlots, setSelectedSlots] = useState<TimeSlot[]>([]);
  const [inputFieldValues, setInputFieldValues] = useState<Record<string, string | boolean | string[] | number>>({});
  const [periodicTableFieldKey, setPeriodicTableFieldKey] = useState<string | null>(null);
  const [selectedPeriodicSymbols, setSelectedPeriodicSymbols] = useState<Set<string>>(new Set());
  const [chargeCalculated, setChargeCalculated] = useState(false);
  const [calculatedCharge, setCalculatedCharge] = useState<{
    total_charge: string;
    total_time_minutes: number;
    charge_breakdown: Array<{ description: string; amount: number }>;
    base_charge?: string;
    gst_percent?: number;
    gst_amount?: string;
  } | null>(null);
  const [loadingCharge, setLoadingCharge] = useState(false);
  const [showSlots, setShowSlots] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [lastFetchedWeek, setLastFetchedWeek] = useState<string | null>(null);
  const [chargeCalculationFailed, setChargeCalculationFailed] = useState(false);
  const [autoSlotSelection, setAutoSlotSelection] = useState<boolean>(true);
  const lastCalculatedValuesRef = useRef<string>('');
  // Admin manage-equipment: 'book' = book for user, 'status' = change slot status, null = show mode selector
  const [adminManageMode, setAdminManageMode] = useState<'book' | 'status' | null>(null);
  const [adminBookForUserId, setAdminBookForUserId] = useState<string | null>(null);
  const [selectedCouponId, setSelectedCouponId] = useState<number | null>(null);
  const [couponCodeInput, setCouponCodeInput] = useState("");
  const [showCouponCodeInput, setShowCouponCodeInput] = useState(false);
  const [validatedCouponFromCode, setValidatedCouponFromCode] = useState<{ id: number; code: string; amount: string } | null>(null);
  const [couponValidatePopup, setCouponValidatePopup] = useState<{ open: boolean; success: boolean; message: string; amount?: string }>({ open: false, success: false, message: "" });
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [myCoupons, setMyCoupons] = useState<Array<{ id: number; code: string; amount: string; balance?: string; valid_until: string | null; is_expired?: boolean }>>([]);
  const hasValidCoupons = myCoupons.some((c) => !c.is_expired && Number(c.balance ?? c.amount) > 0);
  const [adminBookForUserInfo, setAdminBookForUserInfo] = useState<{
    email: string;
    department_name: string;
    phone_number?: string;
    wallet_faculty_owner: { name: string; email: string } | null;
    wallet_balance: string;
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
  const [newSlotStatus, setNewSlotStatus] = useState<string>('BLOCKED');
  const [blockedLabelForStatus, setBlockedLabelForStatus] = useState<string>('');
  const [sendEmailToWalletOwnerForNotUtilized, setSendEmailToWalletOwnerForNotUtilized] = useState(true);
  const BULK_EMAIL_OPERATION_VALUE = "__bulk_email__";
  const RESERVED_FOR_EXTERNAL_VALUE = "RESERVED_FOR_EXTERNAL";
  const [updatingSlotStatus, setUpdatingSlotStatus] = useState(false);
  const [updatingReserveExternal, setUpdatingReserveExternal] = useState(false);
  /** True when current user is external (Educational Institute, RND, Industry, Other). Used to decide if reserved_for_external slots are selectable. */
  const isExternalUser = useMemo(() => {
    const ut = String(userType ?? "").toLowerCase();
    return ["external", "rnd", "industry", "other"].includes(ut);
  }, [userType]);
  const [applyProgressPercent, setApplyProgressPercent] = useState(0);
  const applyProgressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [bulkEmailOpen, setBulkEmailOpen] = useState(false);
  const [bulkEmailRecipients, setBulkEmailRecipients] = useState<Array<{ email: string; name: string }>>([]);
  const [bulkEmailSubject, setBulkEmailSubject] = useState("");
  const [bulkEmailBody, setBulkEmailBody] = useState("");
  const [bulkEmailTemplatesLoading, setBulkEmailTemplatesLoading] = useState(false);
  const [sendingBulkEmail, setSendingBulkEmail] = useState(false);
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [bookAnyAvailableSlots, setBookAnyAvailableSlots] = useState(false);
  const [bookEvenIfSingleSlotAvailable, setBookEvenIfSingleSlotAvailable] = useState(false);
  const [bookingResultDialog, setBookingResultDialog] = useState<{ open: boolean; success: boolean; message: string }>({ open: false, success: false, message: "" });
  const [userTransactionHistoryDialog, setUserTransactionHistoryDialog] = useState<{ open: boolean; userId: string | null; userDisplayName: string }>({ open: false, userId: null, userDisplayName: "" });
  const [userTransactionHistory, setUserTransactionHistory] = useState<{ loading: boolean; transactions: Array<{ id: number; transaction_type: "credit" | "debit"; amount: string; description: string; created_at: string; balance_after?: string | null; equipment_name?: string | null; department_name?: string | null; department_code?: string | null }>; error: string | null }>({ loading: false, transactions: [], error: null });
  const [expandedSlotBooking, setExpandedSlotBooking] = useState<BookingDetailCardBooking | null>(null);
  const [expandedSlotBookingLoading, setExpandedSlotBookingLoading] = useState(false);
  const [urgentDialogOpen, setUrgentDialogOpen] = useState(false);
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
  const fetchingSlotsRef = useRef<boolean>(false);
  const hasCheckedEmptyCurrentWeekRef = useRef<boolean>(false);
  const lastEquipmentIdRef = useRef<number | null>(null);
  const prevShowSlotsRef = useRef<boolean>(false);
  const appliedModeForEquipmentIdRef = useRef<number | null>(null);

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
    booking_id: number;
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
    // Get user ID and type from localStorage (set by DashboardHeader) to avoid duplicate API calls
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setUserId(String(user.id));
        setUserType(user.user_type || null);
        // Initialize auto slot selection from user preference, default to true if not set
        setAutoSlotSelection(user.auto_slot_selection !== undefined ? user.auto_slot_selection : true);
        
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
        
        if (normalizedType === 'admin' || normalizedType === 'student' || normalizedType === 'faculty') {
          // Admin / Students / Faculty: Start with current week
          setCurrentWeekStart(currentWeek);
        } else {
          // Other users: Start with week beginning 15 days from current date
          const fifteenDaysFromNow = addDays(now, 15);
          setCurrentWeekStart(startOfWeek(fifteenDaysFromNow, { weekStartsOn: 1 }));
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

  // Admin: fetch users list when in "book for user" mode
  useEffect(() => {
    if (!isAdminUser() || adminManageMode !== 'book') return;
    let cancelled = false;
    (async () => {
      const res = await apiClient.adminList<{ id: number; name?: string; email?: string; user_type?: string }>('users');
      if (cancelled) return;
      const list = res.error ? [] : (Array.isArray(res.data) ? res.data : []);
      setUsersList(list);
    })();
    return () => { cancelled = true; };
  }, [adminManageMode]);

  // Admin: fetch selected user's booking info (email, department, Supervisor, balance)
  useEffect(() => {
    if (!isAdminUser() || !adminBookForUserId) {
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
  }, [adminBookForUserId]);

  // Admin status-change: toggle a single date in selection (month calendar)
  const toggleDateForStatus = (dateStr: string) => {
    setSelectedDatesForStatus((prev) =>
      prev.includes(dateStr) ? prev.filter((d) => d !== dateStr) : [...prev, dateStr].sort()
    );
  };

  const openWeekSlotPopup = (day: Date) => {
    const dateStr = format(day, "yyyy-MM-dd");
    setSelectedDatesForStatus([dateStr]);
    setSelectedSlotIdsForStatus([]);
    setStatusChangePopupWeekStart(startOfWeek(day, { weekStartsOn: 1 }));
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
      const data = (res as { data?: { slots?: DailySlot[]; slot_master_times?: string[]; holidays?: Record<string, string> } }).data;
      if (data?.slots) setStatusChangeSlots(data.slots);
      else setStatusChangeSlots([]);
      const times = data?.slot_master_times && data.slot_master_times.length > 0
        ? data.slot_master_times.map(formatTimeForDisplay).sort()
        : [];
      setStatusChangeSlotMasterTimes(times);
      setStatusChangeHolidays(data?.holidays ?? {});
    } catch {
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
    setLoadingStatusSlots(true);
    try {
      const weekEnd = addDays(weekStart, 7);
      const res = await apiClient.getEquipmentSlots(selectedEquipment.id, format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd'));
      const data = (res as { data?: { slots?: DailySlot[]; slot_master_times?: string[]; holidays?: Record<string, string> } }).data;
      if (data?.slots) setStatusChangeSlots(data.slots);
      else setStatusChangeSlots([]);
      const times = data?.slot_master_times && data.slot_master_times.length > 0
        ? data.slot_master_times.map(formatTimeForDisplay).sort()
        : [];
      setStatusChangeSlotMasterTimes(times);
      setStatusChangeHolidays(data?.holidays ?? {});
    } catch {
      setStatusChangeSlots([]);
      setStatusChangeSlotMasterTimes([]);
      setStatusChangeHolidays({});
    } finally {
      setLoadingStatusSlots(false);
    }
  }, [selectedEquipment?.id]);
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
      const slotDateStr = typeof slot.date === "string"
        ? (slot.date.includes("T") ? format(parseISO(slot.date), "yyyy-MM-dd") : slot.date.slice(0, 10))
        : "";
      const slotTime = slot.start_datetime ? format(parseISO(slot.start_datetime), "HH:mm") : "";
      return slotDateStr === dateStr && slotTime === time;
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
      const slotDateStr = typeof s.date === "string"
        ? (s.date.includes("T") ? format(parseISO(s.date), "yyyy-MM-dd") : s.date.slice(0, 10))
        : "";
      const slotTime = s.start_datetime ? format(parseISO(s.start_datetime), "HH:mm") : "";
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
      const matchingSlots = monthSlots.filter((s) => s.start_datetime && format(parseISO(s.start_datetime), "HH:mm") === time);
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
      const matchingSlots = yearSlots.filter((s) => s.start_datetime && format(parseISO(s.start_datetime), "HH:mm") === time);
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
    try {
      setLoadingEquipmentDetail(true);
      const response = await apiClient.getEquipmentDetailById(equipmentId);
      
      if (response.error) {
        toast.error(response.error || "Failed to load equipment details");
        setLoadingEquipmentDetail(false);
        return;
      }

      if (!response.data) {
        toast.error("Equipment details not found");
        setLoadingEquipmentDetail(false);
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
        
        const initialValues: Record<string, string | boolean | string[]> = {};
        eq.input_fields.forEach((field: any) => {
          const fieldType = String(field.field_type || '').toUpperCase().trim();
          if (fieldType === 'TOGGLE') {
            initialValues[field.field_key] = field.default_value === 'true' || field.default_value === true;
          } else if (fieldType === 'MULTI_SELECT') {
            initialValues[field.field_key] = field.default_value ? field.default_value.split(',') : [];
          } else if (fieldType === 'PERIODIC_TABLE') {
            const count = field.default_value ? parseInt(String(field.default_value), 10) : 0;
            initialValues[field.field_key] = isNaN(count) ? 0 : count;
            initialValues[field.field_key + '_elements'] = (field.options && Array.isArray(field.options) ? field.options.join(',') : '') || '';
          } else if (fieldType === 'TABLE') {
            const cols = Array.isArray(field.options) ? field.options.length : 0;
            initialValues[field.field_key] = cols ? [Array(cols).fill('')] : [];
          } else {
            // TEXT, NUMERIC, RADIO, COMBO - all use string values
            initialValues[field.field_key] = field.default_value || '';
          }
        });
        setInputFieldValues(initialValues);
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
        image: (eq.image_url || eq.s3_path) ? apiClient.getEquipmentImageUrl(eq.equipment_id) : "/placeholder.svg",
        video: "", // API doesn't provide video_url in detail response
        available: eq.status === "ACTIVE",
        address: eq.location || "",
        technicalPerson: "", // API doesn't provide technical_contact in detail response
        contactNumber: "", // API doesn't provide this separately
        internalRate: pricingProfile ? parseFloat(pricingProfile.primary_unit_charge || "0") : 0,
        externalRate: pricingProfile ? parseFloat(pricingProfile.secondary_unit_charge || "0") : 0,
      };

      setSelectedEquipment(transformedEquipment);
    } catch (error: any) {
      toast.error(error.message || "Failed to load equipment details");
    } finally {
      setLoadingEquipmentDetail(false);
    }
  }, []);

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

    // Auto-select equipment if equipment_id is provided in URL
    if (equipmentId && !selectedEquipment && !loadingEquipmentDetail) {
      handleEquipmentSelect(equipmentId);
    }
  }, [searchParams, selectedEquipment, loadingEquipmentDetail, handleEquipmentSelect, navigate]);

  // Load my coupons when on booking page (for coupon dropdown in Step 2)
  useEffect(() => {
    if (!selectedEquipment?.id) return;
    apiClient.getMyCoupons().then((res) => {
      const out = res as { data?: { coupons?: Array<{ id: number; code: string; amount: string; balance?: string; valid_until: string | null; is_expired?: boolean }> } };
      setMyCoupons(out.data?.coupons ?? []);
    }).catch(() => setMyCoupons([]));
  }, [selectedEquipment?.id]);

  const applyCouponCode = async () => {
    const code = couponCodeInput.trim();
    if (!code) {
      setCouponValidatePopup({ open: true, success: false, message: "Please enter a coupon code." });
      return;
    }
    setValidatingCoupon(true);
    try {
      const res = await apiClient.validateCoupon(code) as { data?: { valid: boolean; message?: string; coupon?: { id: number; code: string; amount: string } }; error?: string };
      const data = res.data;
      const err = res.error;
      if (err || !data) {
        setCouponValidatePopup({ open: true, success: false, message: (data && !data.valid && data.message) ? data.message : (err || "Validation failed.") });
        return;
      }
      if (data.valid && data.coupon) {
        setValidatedCouponFromCode({ id: data.coupon.id, code: data.coupon.code, amount: data.coupon.amount });
        setCouponValidatePopup({ open: true, success: true, message: `Coupon applied. Discount: ₹${data.coupon.amount}`, amount: data.coupon.amount });
      } else {
        setCouponValidatePopup({ open: true, success: false, message: data.message || "Invalid coupon." });
      }
    } catch {
      setCouponValidatePopup({ open: true, success: false, message: "Could not validate coupon. Please try again." });
    } finally {
      setValidatingCoupon(false);
    }
  };

  // Repeat-sample flow: when repeatOf is in URL, load that booking and prefill form (read-only params, zero charge, user picks slots)
  useEffect(() => {
    const repeatOf = searchParams.get("repeatOf");
    if (!repeatOf || !selectedEquipment) {
      setRepeatSourceBooking(null);
      return;
    }
    const bid = parseInt(repeatOf, 10);
    if (Number.isNaN(bid)) {
      setRepeatSourceBooking(null);
      return;
    }
    let cancelled = false;
    setRepeatSourceLoading(true);
    setRepeatSourceBooking(null);
    (async () => {
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
      const origCharge = Number(b.total_charge) || 0;
      const origVid = b.virtual_booking_id || String(b.booking_id);
      const equipCode = selectedEquipment.code || String(selectedEquipment.id);
      const discountRemark = `Repeat of ${origVid} for ${equipCode}`;
      const breakdown = Array.isArray(b.charge_breakdown) ? [...b.charge_breakdown] : [];
      breakdown.push({ description: discountRemark, amount: -origCharge });
      setRepeatSourceBooking({
        booking_id: b.booking_id,
        equipment: b.equipment,
        virtual_booking_id: b.virtual_booking_id,
        input_values: b.input_values || {},
        total_charge: b.total_charge,
        total_time_minutes: b.total_time_minutes || 0,
        charge_breakdown: breakdown,
      });
      setInputFieldValues(b.input_values || {});
      setChargeCalculated(true);
      setCalculatedCharge({
        total_charge: "0",
        total_time_minutes: b.total_time_minutes || 0,
        charge_breakdown: breakdown,
        base_charge: "0",
        gst_percent: 0,
        gst_amount: "0",
      });
      setShowSlots(true);
      setChargeCalculationFailed(false);
    })();
    return () => { cancelled = true; };
  }, [searchParams, selectedEquipment?.id]);

  // When landing with mode=status or mode=book, open that manage mode for admin/OIC/operator (once per equipment)
  useEffect(() => {
    const mode = searchParams.get('mode');
    if (!mode || !selectedEquipment || !canAccessManageEquipmentModes()) return;
    if (appliedModeForEquipmentIdRef.current === selectedEquipment.id) return;
    appliedModeForEquipmentIdRef.current = selectedEquipment.id;
    if (mode === 'status') setAdminManageMode('status');
    else if (mode === 'book') setAdminManageMode('book');
  }, [searchParams, selectedEquipment]);

  // Reset input field values when equipment changes
  useEffect(() => {
    if (!equipmentDetail) {
      setInputFieldValues({});
      setChargeCalculated(false);
      setCalculatedCharge(null);
      setShowSlots(false);
    }
  }, [equipmentDetail]);

  // Calculate charge based on input fields
  const calculateCharge = useCallback(async () => {
    if (!selectedEquipment || !equipmentDetail) {
      return;
    }

    // Skip if already loading to prevent concurrent calls
    if (loadingCharge) {
      return;
    }

    // Create a hash of current input values to check if we already calculated for these values
    const currentValuesHash = JSON.stringify(inputFieldValues);
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
    }
    
    // If no input fields, we still need to call the API with empty values
    // This ensures slots only appear after successful charge calculation

    try {
      setLoadingCharge(true);
      const response = await apiClient.calculateEquipmentCharge(
        selectedEquipment.id,
        inputFieldValues,
        isAdminUser() && adminBookForUserId ? { user_id: adminBookForUserId } : undefined
      );

      if (response.error) {
        // Set failed state to show "coming soon" message
        setChargeCalculationFailed(true);
        setChargeCalculated(false);
        setCalculatedCharge(null);
        setShowSlots(false);
        // Store the hash even on failure to prevent retrying with same values
        lastCalculatedValuesRef.current = currentValuesHash;
        // Only show error toast if it's a critical error, not validation errors
        if (!response.error.includes("required") && !response.error.includes("field")) {
          // Don't show toast, just show "coming soon" message
        }
        return;
      }

      if (response.data) {
        setCalculatedCharge({
          total_charge: response.data.total_charge,
          total_time_minutes: response.data.total_time_minutes,
          charge_breakdown: response.data.charge_breakdown || [],
          base_charge: response.data.base_charge,
          gst_percent: response.data.gst_percent ?? 0,
          gst_amount: response.data.gst_amount ?? "0",
        });
        setChargeCalculated(true);
        setShowSlots(true);
        setChargeCalculationFailed(false); // Reset failed state on success
        // Store the hash of values we just calculated for
        lastCalculatedValuesRef.current = currentValuesHash;
      }
    } catch (error: any) {
      // Set failed state to show "coming soon" message
      setChargeCalculationFailed(true);
      setChargeCalculated(false);
      setCalculatedCharge(null);
      setShowSlots(false);
      // Store the hash even on failure to prevent retrying with same values
      lastCalculatedValuesRef.current = currentValuesHash;
      // Don't show error toast, just show "coming soon" message
    } finally {
      setLoadingCharge(false);
    }
  }, [selectedEquipment, equipmentDetail, inputFieldValues, loadingCharge, adminBookForUserId]);

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

    // Admin in "book for user" mode: require a selected user before calculating
    if (isAdminUser() && adminManageMode === 'book' && !adminBookForUserId) {
      return;
    }

    // Repeat-sample: charge is already set to 0 with discount; do not recalculate
    if (repeatSourceBooking) {
      return;
    }

    // Skip if already loading
    if (loadingCharge) {
      return;
    }

    // Check if all required fields are filled (if there are input fields)
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

    // Calculate charge if:
    // 1. No input fields (always calculate with empty values)
    // 2. Has input fields and all required fields are filled
    if (!hasInputFields || allRequiredFilled) {
      // Create hash of current values
      const currentValuesHash = JSON.stringify(inputFieldValues);
      
      // Skip if we already calculated (or failed) for these exact values
      if (lastCalculatedValuesRef.current === currentValuesHash) {
        return;
      }

      // If previous calculation failed, reset the failed state when values change
      if (chargeCalculationFailed && lastCalculatedValuesRef.current !== currentValuesHash) {
        setChargeCalculationFailed(false);
      }

      // Admin booking for user with no input fields: run immediately so charge/slots/confirm populate
      const isAdminBookForUserNoInputs = isAdminUser() && adminManageMode === "book" && adminBookForUserId && !hasInputFields;
      const debounceMs = isAdminBookForUserNoInputs ? 0 : 500;

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
  }, [inputFieldValues, selectedEquipment, equipmentDetail, loadingCharge, chargeCalculated, chargeCalculationFailed, calculateCharge, adminManageMode, adminBookForUserId, repeatSourceBooking]);

  // Fetch slots for the current week (forceRefetch = true skips cache so Step 3 calendar shows updated statuses after Change slot status)
  const fetchSlotsForWeek = useCallback(async (forceRefetch?: boolean) => {
    if (!selectedEquipment) return;

    const weekStart = startOfWeek(currentWeekStart, { weekStartsOn: 1 });
    const weekEnd = addDays(weekStart, 7);
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
        endDateStr
      );

      if (slotsResponse.data && slotsResponse.data.slots) {
        const data = slotsResponse.data;
        setEquipmentDetail(prev => {
          if (!prev) return prev;
          const newSlots = data.slots;
          const newHolidays = data.holidays ?? {};
          const currentSlots = prev.daily_slots || [];
          const slotWindow = {
            ...(data.slot_start_time != null && { slot_start_time: data.slot_start_time }),
            ...(data.slot_end_time != null && { slot_end_time: data.slot_end_time }),
            ...(data.slot_duration_minutes != null && { slot_duration_minutes: data.slot_duration_minutes }),
            ...(data.slot_master_times && Array.isArray(data.slot_master_times) && { slot_master_times: data.slot_master_times }),
            ...(data.weekly_view_time_from != null && { weekly_view_time_from: data.weekly_view_time_from }),
            ...(data.weekly_view_time_to != null && { weekly_view_time_to: data.weekly_view_time_to }),
            ...(data.weekly_view_max_rows != null && { weekly_view_max_rows: data.weekly_view_max_rows }),
            ...(data.weekly_view_default_days != null && { weekly_view_default_days: data.weekly_view_default_days }),
            ...(data.slot_window_min_date != null && { slot_window_min_date: data.slot_window_min_date }),
            ...(data.slot_window_max_date != null && { slot_window_max_date: data.slot_window_max_date }),
            ...(data.slot_window_reference_weekday != null && { slot_window_reference_weekday: data.slot_window_reference_weekday }),
            ...(data.slot_window_reference_time != null && { slot_window_reference_time: data.slot_window_reference_time }),
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
      }
    } catch (error: any) {
      console.error("Error fetching slots:", error);
    } finally {
      setLoadingSlots(false);
      fetchingSlotsRef.current = false;
    }
  }, [selectedEquipment, currentWeekStart, loadingSlots, lastFetchedWeek]);

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
          toast.error(
            `Selected slots exceeded the limit. Reduced to ${validSlots.length} slot(s) (${total} minutes / ${totalLimit} minutes).`
          );
          return validSlots;
        });
      }
    }
  }, [selectedSlots, calculatedCharge]);

  // When Step 3 (Select Time Slots) is shown, default to current week for internal users
  useEffect(() => {
    const justEnteredStep3 = showSlots && !prevShowSlotsRef.current;
    prevShowSlotsRef.current = !!showSlots;
    if (!justEnteredStep3 || !selectedEquipment) return;
    const nType = userType != null ? normalizeUserType(userType) : null;
    if (nType === 'student' || nType === 'faculty') {
      setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
    }
  }, [showSlots, selectedEquipment, userType]);

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
    const weekEnd = addDays(weekStart, 7);
    const startDateStr = format(weekStart, "yyyy-MM-dd");
    const endDateStr = format(weekEnd, "yyyy-MM-dd");
    const weekKey = `${startDateStr}_${endDateStr}`;
    
    // Skip if we already fetched for this week
    if (lastFetchedWeek === weekKey) {
      return;
    }

    // Fetch slots
    fetchSlotsForWeek();
  }, [showSlots, chargeCalculated, selectedEquipment, currentWeekStart, loadingSlots, lastFetchedWeek, fetchSlotsForWeek, userType]);

  // When Step 3 slot grid is visible, refetch on window focus so status changes (e.g. from another tab) are reflected
  useEffect(() => {
    if (!showSlots || !chargeCalculated || !selectedEquipment) return;
    const onFocus = () => {
      fetchSlotsForWeek(true);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
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
    const firstWeekEnd = addDays(firstWeekStart, 7);
    const firstWeekKey = `${format(firstWeekStart, "yyyy-MM-dd")}_${format(firstWeekEnd, "yyyy-MM-dd")}`;
    if (lastFetchedWeek !== firstWeekKey) return;

    const now = new Date();
    const weekStartTime = firstWeekStart.getTime();
    const weekEndTime = firstWeekEnd.getTime();
    const hasAnyAvailableSlot = equipmentDetail.daily_slots.some(slot => {
      if (slot.status !== "AVAILABLE") return false;
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
  }, [equipmentDetail?.daily_slots, lastFetchedWeek, userType]);

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
    const tenPercentSlot = 0.1 * oneSlot;

    // If required time <= one slot, select only one slot
    if (requiredMinutes <= oneSlot) {
      // Find the first available slot (admin: allow past and non-BOOKED)
      const availableSlot = equipmentDetail.daily_slots.find(slot => {
        const isBookedSlot = slot.status === "BOOKED" || !!slot.booking_id;
        if (isAdminUser()) {
          if (isBookedSlot) return false;
        } else {
          if (slot.status !== "AVAILABLE") return false;
        }
        const slotDate = startOfDay(parseISO(slot.date));
        const slotTime = format(parseISO(slot.start_datetime), "HH:mm");
        const slotDateTime = new Date(slotDate);
        const [hours, minutes] = slotTime.split(':').map(Number);
        slotDateTime.setHours(hours, minutes || 0, 0, 0);
        return (isAdminUser() || slotDateTime >= new Date()) && !isSlotBooked(slotDate, slotTime);
      });

      if (availableSlot) {
        const slotDate = startOfDay(parseISO(availableSlot.date));
        const slotTime = format(parseISO(availableSlot.start_datetime), "HH:mm");
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

    // For required time > one slot, find consecutive slots
    // Calculate minimum number of slots needed to cover required time
    const minSlotsNeeded = Math.ceil(requiredMinutes / oneSlot);
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
        if (slot.status !== "AVAILABLE") continue;
      }
      const slotDate = startOfDay(parseISO(slot.date));
      const slotTime = format(parseISO(slot.start_datetime), "HH:mm");
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
        if (chainTotalMinutes >= requiredMinutes - tenPercentSlot && chain.length >= minSlotsNeeded) {
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
      const hasEnough = chain.length >= minSlotsNeeded || chainTotalMinutes >= requiredMinutes - tenPercentSlot;
      
      // Keep the best chain (prefer chains that have enough, but also keep the longest chain even if it doesn't have enough)
      if (hasEnough) {
        // This chain has enough slots - use it if it's better than what we have
        if (!bestStartingSlot || chain.length > bestSlotChain.length || 
            (chain.length === bestSlotChain.length && chainTotalMinutes > bestTotalMinutes)) {
          bestStartingSlot = testSlot;
          bestSlotChain = chain;
          bestTotalMinutes = chainTotalMinutes;
          // If we found a perfect match, use it immediately
          if (chain.length >= minSlotsNeeded && chainTotalMinutes >= requiredMinutes - tenPercentSlot) {
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
        `Unable to auto-select slots. Required time is ${requiredMinutes} minutes (${Math.ceil(requiredMinutes / oneSlot)} slots), but no consecutive slots are available. ` +
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
                                      totalMinutes >= requiredMinutes - tenPercentSlot;

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
          `Unable to auto-select slots. Required time is ${requiredMinutes} minutes (${Math.ceil(requiredMinutes / oneSlot)} slots), but no available slots found. ` +
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
  }, [chargeCalculated, showSlots, autoSlotSelection, selectedSlots.length, equipmentDetail, calculatedCharge, loadingSlots]);

  const checkAuth = async () => {
    const token = apiClient.getToken();
    if (!token) {
      navigate("/auth");
      return;
    }

    const userResponse = await apiClient.getCurrentUser();
    if (userResponse.error || !userResponse.data) {
      navigate("/auth");
      return;
    }

    setUserId(String(userResponse.data.id));
    setUserType(userResponse.data.user_type || null);
    // Initialize auto slot selection from user preference, default to true if not set
    setAutoSlotSelection(userResponse.data.auto_slot_selection !== undefined ? userResponse.data.auto_slot_selection : true);
    
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
    
    if (normalizedType === 'admin' || normalizedType === 'student' || normalizedType === 'faculty') {
      // Admin / Students / Faculty: Start with current week
      setCurrentWeekStart(currentWeek);
    } else {
      // Other users: Start with week beginning 15 days from current date
      const fifteenDaysFromNow = addDays(now, 15);
      setCurrentWeekStart(startOfWeek(fifteenDaysFromNow, { weekStartsOn: 1 }));
    }
  };


  const isSlotBooked = (date: Date, time: string): boolean => {
    const slotData = getSlotData(date, time);
    if (!slotData) return false;
    // Admin: only BOOKED status (or has booking_id) is considered booked; other statuses and past are selectable
    if (isAdminUser()) return slotData.status === "BOOKED" || !!slotData.booking_id;
    // External users: only AVAILABLE slots (reserved for external) are selectable; all others are not
    if (isExternalUser) return slotData.status !== "AVAILABLE";
    // Internal users: AVAILABLE slots that are NOT reserved for external are selectable; reserved for external are not
    return slotData.status !== "AVAILABLE" || slotData.reserved_for_external === true;
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
    const timeKey = timeOrSlotKey;
    
    return equipmentDetail.daily_slots.find(slot => {
      const slotDateStr = typeof slot.date === "string"
        ? (slot.date.includes("T") ? format(parseISO(slot.date), "yyyy-MM-dd") : slot.date)
        : "";
      const slotTime = slot.start_datetime
        ? format(parseISO(slot.start_datetime), "HH:mm")
        : "";
      return slotDateStr === expectedDateStr && slotTime === timeKey;
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
    const tenPercentSlot = 0.1 * oneSlot;
    if (required <= oneSlot) {
      return selectedSlots.length === 1;
    }
    // Check if selection is within 10% variance (ideal case)
    if (selected >= required - tenPercentSlot && selected <= required + tenPercentSlot) {
      return true;
    }
    // If selection exceeds by more than 10%, check if it's the minimum needed to cover required time
    // Calculate minimum number of slots needed to cover required time
    const minSlotsNeeded = Math.ceil(required / oneSlot);
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
        if (slot.status !== "AVAILABLE" || (lastSlotId != null && slot.id === lastSlotId)) return false;
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
      const slotTime = format(parseISO(slot.start_datetime), "HH:mm");
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
        const candidateOk = isAdminUser() ? !candidateBooked : candidate.status === "AVAILABLE";
        if (candidateOk && candidate.id !== lastSlotId) {
          const slotStart = parseISO(candidate.start_datetime);
          const slotDate = startOfDay(parseISO(candidate.date));
          const slotTime = format(slotStart, "HH:mm");
          if (isAdminUser() || slotStart.getTime() >= new Date().getTime()) {
            if (!isSlotBooked(slotDate, slotTime)) nextSlotData = candidate;
          }
        }
      }
    }

    if (!nextSlotData) return null;

    const slotDate = startOfDay(parseISO(nextSlotData.date));
    const slotTime = format(parseISO(nextSlotData.start_datetime), "HH:mm");

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
    const tenPercentSlot = 0.1 * oneSlot;
    
    // If required time <= one slot, return only the first slot
    if (requiredMinutes <= oneSlot) {
      return [firstSlot];
    }
    
    // Calculate minimum number of slots needed
    const minSlotsNeeded = Math.ceil(requiredMinutes / oneSlot);
    
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
      
      // If we've covered the required time (within 10% variance), we can stop
      if (totalMinutes >= requiredMinutes - tenPercentSlot) {
        break;
      }
    }
    
    // Check if we have enough consecutive slots
    const hasEnoughConsecutiveSlots = allSlots.length >= minSlotsNeeded && 
                                      totalMinutes >= requiredMinutes - tenPercentSlot;
    
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
    const minSlotsNeeded = Math.ceil(requiredMinutes / oneSlot);
    const tenPercentSlot = 0.1 * oneSlot;
    
    // Get all available slots, excluding already selected ones
    const availableSlots: TimeSlot[] = [];
    const excludeSlotIds = new Set(excludeSlots.map(s => s.slotId));
    
    equipmentDetail.daily_slots.forEach(slot => {
      const isBookedSlot = slot.status === "BOOKED" || !!slot.booking_id;
      if (isAdminUser()) {
        if (isBookedSlot || excludeSlotIds.has(slot.id)) return;
      } else {
        if (slot.status !== "AVAILABLE" || excludeSlotIds.has(slot.id)) return;
      }
      const slotDate = startOfDay(parseISO(slot.date));
      const slotTime = format(parseISO(slot.start_datetime), "HH:mm");
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
      if (totalMinutes >= requiredMinutes - tenPercentSlot) {
        break;
      }
    }
    
    // Only return if we have enough slots to cover the required time
    if (selectedSlots.length > 0 && totalMinutes >= requiredMinutes - tenPercentSlot) {
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
          const tenPercentSlot = 0.1 * oneSlotRef;

          // (a) If required time <= one slot duration: allow only a single slot
          if (required <= oneSlotRef) {
            if (prev.length >= 1) {
              toast.error(`Only one slot is allowed when required time (${required} min) is within a single slot.`);
              return prev;
            }
            // For single slot requirement, just return the selected slot
            return [...prev, slot];
          }

          // (b) Required > one slot: allow multiple slots until required is covered (with up to 10% tail)
          if (currentSelectedMinutes >= required) {
            toast.error(`You have already covered the required time (${required} minutes).`);
            return prev;
          }
          // Calculate remaining time
          const remaining = Math.max(0, required - currentSelectedMinutes);
          // Allow selecting another slot if remaining time exceeds 10% of one slot
          // If remaining time is within 10% variance, don't allow selecting another slot
          if (remaining <= tenPercentSlot) {
            toast.error(
              `Cannot add this slot. Required time is ${required} minutes; only ${remaining} minutes remaining (within 10% variance).`
            );
            return prev;
          }
          
          // If this is the first slot selection, auto-select ALL required consecutive slots
          if (prev.length === 0) {
            const allRequiredSlots = findAllRequiredConsecutiveSlots(slot, required);
            const minSlotsNeeded = Math.ceil(required / oneSlotRef);
            // When splitting not allowed, require full consecutive block; don't accept partial
            if (!equipmentDetail?.split_booking_enabled && (required > oneSlotRef && allRequiredSlots.length < minSlotsNeeded)) {
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
        const startDate = parseISO(slot.start_datetime);
        const timeStr = format(startDate, "HH:mm");
        uniqueTimes.add(timeStr);
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
      ? equipmentDetail.slot_master_times.map(formatTimeForDisplay).sort()
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
    return timeSlots.map((t, index) => ({
      key: t,
      label: hideTime ? `Slot ${index + 1}` : t,
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
  const normalizeUserType = (type: string | number | null): string | null => {
    if (type === null || type === undefined) return null;
    if (typeof type === 'string') return type.toLowerCase();
    if (typeof type === 'number') {
      // Map common number codes to strings (adjust based on your backend mapping)
      // Common mappings: 1=student, 2=faculty, etc.
      const typeMap: Record<number, string> = {
        1: 'student',
        2: 'faculty',
        // Add other mappings as needed
      };
      return typeMap[type] || String(type);
    }
    return null;
  };

  const isAdminUser = (): boolean => {
    if (!userType) return false;
    return String(userType).toLowerCase() === 'admin';
  };

  const isAdminOrOIC = (): boolean => {
    if (!userType) return false;
    const t = String(userType).toLowerCase();
    return t === 'admin' || t === 'manager';
  };

  /** For Admin and OIC the weekly view display setting has no effect: they always see time on the vertical axis. */
  const getEffectiveWeeklyViewDisplay = (): 'TIME' | 'SLOT_ID' => {
    if (isAdminOrOIC()) return 'TIME';
    return equipmentDetail?.weekly_view_display ?? 'TIME';
  };

  const canAccessManageEquipmentModes = (): boolean => {
    if (!userType) return false;
    const t = String(userType).toLowerCase();
    return t === 'admin' || t === 'manager' || t === 'operator';
  };

  const isInternalUser = (): boolean => {
    if (!userType) return false;
    const t = String(userType).toLowerCase();
    return t === 'student' || t === 'faculty' || t === 'individual_student';
  };

  // Check if a week is allowed for the current user (admin can pick any week when booking for someone)
  const isWeekAllowed = (weekStart: Date): boolean => {
    if (isAdminUser()) return true;
    if (!userType) return false;
    
    const normalizedType = normalizeUserType(userType);
    if (!normalizedType) return false;
    
    const now = new Date();
    const currentWeek = startOfWeek(now, { weekStartsOn: 1 });
    const nextWeek = addWeeks(currentWeek, 1);
    
    // For other users: 15 days from current date, then one week window
    const fifteenDaysFromNow = addDays(now, 15);
    const allowedWeekStart = startOfWeek(fifteenDaysFromNow, { weekStartsOn: 1 });
    
    // Normalize week starts for comparison
    const weekStartNormalized = startOfWeek(weekStart, { weekStartsOn: 1 });
    const currentWeekNormalized = startOfWeek(currentWeek, { weekStartsOn: 1 });
    const nextWeekNormalized = startOfWeek(nextWeek, { weekStartsOn: 1 });
    const allowedWeekStartNormalized = startOfWeek(allowedWeekStart, { weekStartsOn: 1 });
    
    if (normalizedType === 'student' || normalizedType === 'faculty') {
      // Students/Faculty: Can select current week OR next week only
      return (
        weekStartNormalized.getTime() === currentWeekNormalized.getTime() ||
        weekStartNormalized.getTime() === nextWeekNormalized.getTime()
      );
    } else {
      // Other users: Can select one week window starting 15 days from current date
      return weekStartNormalized.getTime() === allowedWeekStartNormalized.getTime();
    }
  };

  // Get allowed weeks for navigation (admin or repeat-sample: any week; others restricted)
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
    if (isAdminUser()) {
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
    const fifteenDaysFromNow = addDays(now, 15);
    const allowedWeekStart = startOfWeek(fifteenDaysFromNow, { weekStartsOn: 1 });
    if (normalizedType === 'student' || normalizedType === 'faculty') {
      const minDateStr = equipmentDetail?.slot_window_min_date ?? null;
      const maxDateStr = equipmentDetail?.slot_window_max_date ?? null;
      if (!minDateStr || !maxDateStr) {
        return [currentWeek, nextWeek];
      }
      const minDate = parseISO(minDateStr);
      const maxDate = parseISO(maxDateStr);
      const previousWeek = subWeeks(currentWeek, 1);
      const nextWeekSunday = addDays(nextWeek, 6);
      const nextWeekAvailable = nextWeekSunday <= maxDate;
      if (!nextWeekAvailable) {
        return [currentWeek];
      }
      const weeks: Date[] = [];
      for (const weekStart of [previousWeek, currentWeek, nextWeek]) {
        const weekSunday = addDays(weekStart, 6);
        if (weekSunday >= minDate && weekStart <= maxDate) {
          weeks.push(weekStart);
        }
      }
      return weeks;
    }
    return [allowedWeekStart];
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

  // Internal users with slot window: default to current week when selected week is not allowed (snap to current week)
  useEffect(() => {
    const nType = userType != null ? normalizeUserType(userType) : null;
    if (nType !== 'student' && nType !== 'faculty') return;
    const minStr = equipmentDetail?.slot_window_min_date;
    const maxStr = equipmentDetail?.slot_window_max_date;
    if (!minStr || !maxStr) return;
    const minDate = parseISO(minStr);
    const maxDate = parseISO(maxStr);
    const now = new Date();
    const currentWeek = startOfWeek(now, { weekStartsOn: 1 });
    const previousWeek = subWeeks(currentWeek, 1);
    const nextWeek = addWeeks(currentWeek, 1);
    const allowed: Date[] = [];
    for (const weekStart of [previousWeek, currentWeek, nextWeek]) {
      const weekSunday = addDays(weekStart, 6);
      if (weekSunday >= minDate && weekStart <= maxDate) allowed.push(weekStart);
    }
    const selected = startOfWeek(currentWeekStart, { weekStartsOn: 1 });
    const isAllowed = allowed.some(w => startOfWeek(w, { weekStartsOn: 1 }).getTime() === selected.getTime());
    if (!isAllowed) {
      setCurrentWeekStart(currentWeek);
    }
  }, [equipmentDetail?.slot_window_min_date, equipmentDetail?.slot_window_max_date, userType, currentWeekStart]);

  // Default to current week whenever an equipment is selected for booking (internal users)
  useEffect(() => {
    if (!selectedEquipment) return;
    const nType = userType != null ? normalizeUserType(userType) : null;
    if (nType === 'student' || nType === 'faculty') {
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
    const firstWeekEnd = addDays(firstWeekStart, 7);
    const firstWeekKey = `${format(firstWeekStart, "yyyy-MM-dd")}_${format(firstWeekEnd, "yyyy-MM-dd")}`;
    if (lastFetchedWeek !== firstWeekKey) return;

    const now = new Date();
    const weekStartTime = firstWeekStart.getTime();
    const weekEndTime = firstWeekEnd.getTime();
    const hasAnyAvailableSlot = equipmentDetail.daily_slots.some(slot => {
      if (slot.status !== "AVAILABLE") return false;
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
  }, [equipmentDetail?.daily_slots, lastFetchedWeek, userType, selectedEquipment?.id]);

  // Handle input field changes - charge will auto-calculate via useEffect
  const handleInputFieldChange = (fieldKey: string, value: string | boolean | string[] | number) => {
    setInputFieldValues(prev => ({
      ...prev,
      [fieldKey]: value
    }));
  };

  const handleBooking = async () => {
    if (!userId || !selectedEquipment || selectedSlots.length === 0) {
      toast.error("Please select at least one time slot");
      return;
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
        const res = await apiClient.createRepeatBooking(repeatSourceBooking.booking_id, slotIds);
        if (res.error) {
          toast.error(res.error);
          return;
        }
        toast.success((res.data as { message?: string })?.message || "Repeat booking created successfully.");
        setBookingResultDialog({ open: true, success: true, message: "Repeat booking created. This booking does not count toward your weekly or monthly limit." });
        setRepeatSourceBooking(null);
        setSelectedSlots([]);
        setShowSlots(false);
        setChargeCalculated(false);
        setCalculatedCharge(null);
        navigate("/my-bookings");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to create repeat booking");
        setBookingResultDialog({ open: true, success: false, message: e instanceof Error ? e.message : "Failed to create repeat booking" });
      } finally {
        setIsSubmittingBooking(false);
      }
      return;
    }

    // Validate selection per business rules (single slot when required <= one slot; multiple until covered; 10% tail allowed)
    if (calculatedCharge && !isSelectionValidForBooking()) {
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

    try {
      // Validate required input fields
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

      setIsSubmittingBooking(true);

      const slotIds = selectedSlots
        .map((s) => s.slotData?.id)
        .filter((id): id is number => typeof id === "number");
      const canUseSlotIds = slotIds.length === selectedSlots.length && slotIds.length > 0;

      if (isUrgentHoldMode && !canUseSlotIds) {
        toast.error("Please select one or more slots from the grid for your urgent request.");
        return;
      }

      // Resolve final slot IDs and charge: when "Book any available slots" is on, use selected if available else pick any available run in the window
      let finalSlotIds = slotIds;
      let totalHours = calculatedCharge ? calculatedCharge.total_time_minutes / 60 : 0;
      let totalCost = calculatedCharge ? Number(calculatedCharge.total_charge) : 0;
      const requiredMinutes = calculatedCharge?.total_time_minutes ?? 0;

      if (canUseSlotIds && bookAnyAvailableSlots) {
        const dates = selectedSlots.map((s) => {
          if (s.slotData?.start_datetime) return parseISO(s.slotData.start_datetime);
          return s.date;
        });
        const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
        const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));
        const windowStart = startOfWeek(minDate, { weekStartsOn: 1 });
        const windowEnd = addDays(startOfWeek(maxDate, { weekStartsOn: 1 }), 6);
        const startStr = format(windowStart, "yyyy-MM-dd");
        const endStr = format(windowEnd, "yyyy-MM-dd");
        try {
          const res = await apiClient.getEquipmentSlots(selectedEquipment.id, startStr, endStr);
          const slots = (res as { data?: { slots?: Array<{ id: number; status?: string; start_datetime?: string; end_datetime?: string }> } })?.data?.slots ?? [];
          const statusById = new Map(slots.map((s) => [s.id, (s.status || "").toUpperCase()]));
          const allSelectedAvailable = slotIds.every((id) => statusById.get(id) === "AVAILABLE");

          if (allSelectedAvailable) {
            finalSlotIds = slotIds;
          } else {
            const available = slots
              .filter((s) => (s.status || "").toUpperCase() === "AVAILABLE")
              .sort((a, b) => (a.start_datetime || "").localeCompare(b.start_datetime || ""));
            const selected: typeof available = [];
            let runMinutes = 0;
            for (const slot of available) {
              const start = slot.start_datetime ? parseISO(slot.start_datetime).getTime() : 0;
              const end = slot.end_datetime ? parseISO(slot.end_datetime).getTime() : start + 60 * 60 * 1000;
              const mins = (end - start) / (60 * 1000);
              selected.push(slot);
              runMinutes += mins;
              if (runMinutes >= requiredMinutes) break;
            }
            if (selected.length > 0 && runMinutes >= requiredMinutes) {
              finalSlotIds = selected.map((s) => s.id);
              totalHours = runMinutes / 60;
              const rate = calculatedCharge && calculatedCharge.total_time_minutes > 0
                ? Number(calculatedCharge.total_charge) / calculatedCharge.total_time_minutes
                : 0;
              totalCost = rate * runMinutes;
              toast.info("Selected slots were unavailable. Booking with alternative available slots in this window.");
            } else if (bookEvenIfSingleSlotAvailable && available.length > 0) {
              const singleSlot = available[0];
              const start = singleSlot.start_datetime ? parseISO(singleSlot.start_datetime).getTime() : 0;
              const end = singleSlot.end_datetime ? parseISO(singleSlot.end_datetime).getTime() : start + 60 * 60 * 1000;
              const singleMinutes = (end - start) / (60 * 1000);
              finalSlotIds = [singleSlot.id];
              totalHours = singleMinutes / 60;
              const rate = calculatedCharge && calculatedCharge.total_time_minutes > 0
                ? Number(calculatedCharge.total_charge) / calculatedCharge.total_time_minutes
                : 0;
              totalCost = rate * singleMinutes;
              toast.info("Required duration not available. Booking a single slot and charging accordingly.");
            } else {
              toast.error(
                bookEvenIfSingleSlotAvailable
                  ? "No available slots in this window. Please choose another week or try again later."
                  : "No available slots in this window can cover your required duration. Please choose another week or enable \"Book even if single slot is available\" to book one slot."
              );
              return;
            }
          }
        } catch {
          toast.error("Could not verify slot availability. Please try again.");
          return;
        }
      }

      if (canUseSlotIds) {
        if (isUrgentHoldMode) {
          const returnToPage = searchParams.get("return_to") === "my-urgent-requests" || searchParams.get("return_to") === "dashboard";
          if (returnToPage) {
            // Create hold and redirect to dashboard to complete urgent request form
            const res = await apiClient.bookEquipment(selectedEquipment.id, {
              slot_ids: finalSlotIds,
              total_hours: totalHours,
              total_cost: totalCost,
              status: "pending",
              input_values: inputFieldValues,
              create_as_hold: true,
              ...(selectedCouponId != null ? { coupon_id: selectedCouponId } : validatedCouponFromCode ? { coupon_id: validatedCouponFromCode.id } : couponCodeInput.trim() ? { coupon_code: couponCodeInput.trim() } : {}),
            });
            if (res.error) {
              toast.error((res as { error: string }).error);
              return;
            }
            const resData = (res as { data?: { booking_id?: number; id?: number } }).data;
            const holdId = resData?.booking_id ?? resData?.id;
            setSelectedSlots([]);
            if (holdId != null) {
              navigate(`/my-urgent-requests?urgent_equipment_id=${selectedEquipment.id}&hold_booking_id=${holdId}`, { replace: true });
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
        const res = await apiClient.bookEquipment(selectedEquipment.id, {
          slot_ids: finalSlotIds,
          total_hours: totalHours,
          total_cost: totalCost,
          status: "pending",
          input_values: inputFieldValues,
          ...(isAdminUser() && adminBookForUserId ? { user_id: Number(adminBookForUserId) } : {}),
          ...(selectedCouponId != null ? { coupon_id: selectedCouponId } : validatedCouponFromCode ? { coupon_id: validatedCouponFromCode.id } : couponCodeInput.trim() ? { coupon_code: couponCodeInput.trim() } : {}),
        });
        if (res.error) {
          const errRes = res as { error: string; waitlist_position?: number };
          const msg = errRes.waitlist_position != null
            ? `${errRes.error} You have been added to the waitlist at position ${errRes.waitlist_position}. You will be notified by email when slots become available so you can book on a first-come, first-served basis.`
            : errRes.error;
          toast.error(msg);
          setBookingResultDialog({ open: true, success: false, message: msg });
          return;
        }
        // Success: API returns { data: { booking_id, daily_slots, ... } }
        const resData = (res as { data?: { booking_id?: number; id?: number; daily_slots?: DailySlot[] } }).data;
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
        setSelectedSlots([]);
        setBookingResultDialog({ open: true, success: true, message: "Booking created successfully!" });
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
          ...(isAdminUser() && adminBookForUserId ? { user_id: Number(adminBookForUserId) } : {}),
          ...(selectedCouponId != null ? { coupon_id: selectedCouponId } : validatedCouponFromCode ? { coupon_id: validatedCouponFromCode.id } : couponCodeInput.trim() ? { coupon_code: couponCodeInput.trim() } : {}),
        });
      });

      const results = await Promise.all(bookingPromises);
      const errors = results.filter((r): r is typeof r & { error: string } => !!r.error);

      if (errors.length > 0) {
        const message = errors[0].error || "Failed to create some bookings";
        throw new Error(message);
      }

      const firstRes = results[0] as { booking_id?: number; id?: number };
      const firstBookingId = firstRes?.booking_id ?? firstRes?.id;
      // Success is logged server-side per booking; no need to call logBookingAttempt here
      setBookingResultDialog({ open: true, success: true, message: `${bookings.length} booking(s) created successfully!` });
    } catch (error: any) {
      const errMsg = error.message || "Failed to create booking";
      toast.error(errMsg);
      setBookingResultDialog({ open: true, success: false, message: errMsg });
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
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20">
        <DashboardHeader />
        <main className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-12 text-center">
              {isLoadingFromUrl ? (
                <>
                  <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">Loading equipment…</p>
                </>
              ) : (
                <>
                  <p className="text-muted-foreground mb-4">No equipment selected for booking</p>
                  <Button onClick={() => navigate("/equipments")}>
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20 relative">
      {(loadingEquipmentDetail || repeatSourceLoading) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-lg flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="text-sm text-muted-foreground">{repeatSourceLoading ? "Loading repeat booking..." : "Loading equipment details..."}</p>
          </div>
        </div>
      )}
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <h1 className="text-3xl font-bold">
            {canAccessManageEquipmentModes() ? "Manage" : "Book"} {selectedEquipment.name}
          </h1>
        </div>

        {/* Admin: mode selector (Manage this Equipment) */}
        {canAccessManageEquipmentModes() && adminManageMode === null && (
          <div className="max-w-2xl mx-auto mb-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setAdminManageMode('book')}
            >
              <CardHeader>
                <CardTitle className="text-lg">Book slots for a user</CardTitle>
                <CardDescription>
                  Select a user and book slots on their behalf. Charge is calculated for the selected user.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setAdminManageMode('status')}
            >
              <CardHeader>
                <CardTitle className="text-lg">Change slot status</CardTitle>
                <CardDescription>
                  Mark slots as Blocked, Under Maintenance, or Operator Absent.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        )}

        {/* Admin: slot status change UI – month calendar with day/week/month selection */}
        {canAccessManageEquipmentModes() && adminManageMode === 'status' && selectedEquipment && (
          <Card className="max-w-6xl mx-auto mb-8 overflow-hidden border-2 border-primary/20 shadow-xl bg-gradient-to-b from-card to-card/95">
            <div className="bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 px-6 py-5 text-white">
              <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Change slot status</h2>
                  <p className="text-white/90 mt-1 text-base md:text-lg max-w-3xl">
                    Select one or more dates in the month calendar (click individual days, or use &quot;Select week&quot; / &quot;Select entire month&quot;), then choose the desired status and click Apply. For &quot;Booking Not Utilized&quot; use Week view to select only booked slots; no refund is issued and emails are sent to the user and Supervisor. Blocked, Under Maintenance, or Operator Absent will cancel any bookings on those slots and refund users.
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
                          onClick={() => {
                            if (!inMonth) return;
                            if (statusChangeDateClickTimerRef.current) {
                              clearTimeout(statusChangeDateClickTimerRef.current);
                            }
                            const wasSelected = selectedDatesForStatus.includes(dateStr);
                            statusChangeDateClickTimerRef.current = setTimeout(() => {
                              toggleDateForStatus(dateStr);
                              if (wasSelected) setStatusChangePopupWeekStart(null);
                            }, 220);
                          }}
                          onDoubleClick={() => {
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
                    Choose operation below and click Apply to confirm changes.
                  </p>
                </div>
              )}

              {/* Apply status */}
              <div className="flex flex-wrap items-center gap-4 pt-6 border-t-2 border-primary/10">
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
                    <SelectItem value="BLOCKED" className="text-base">Blocked</SelectItem>
                    <SelectItem value="UNDER_MAINTENANCE" className="text-base">Under Maintenance</SelectItem>
                    <SelectItem value="OPERATOR_ABSENT" className="text-base">Operator Absent</SelectItem>
                    <SelectItem value="BOOKING_NOT_UTILIZED" className="text-base">Booking Not Utilized</SelectItem>
                    <SelectItem value="AVAILABLE" className="text-base">Available</SelectItem>
                    <SelectItem value={RESERVED_FOR_EXTERNAL_VALUE} className="text-base">Reserved for External</SelectItem>
                    <SelectItem value={BULK_EMAIL_OPERATION_VALUE} className="text-base">
                      <span className="flex items-center gap-2">
                        <Mail className="h-5 w-5" />
                        Bulk email
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {newSlotStatus === "BLOCKED" && (
                  <Input
                    placeholder="Blocked label (optional)"
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
                  className="h-12 px-6 text-base font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md"
                  disabled={
                    (selectedSlotIdsForStatus.length === 0 && getEffectiveDatesForStatus().length === 0) ||
                    updatingSlotStatus ||
                    updatingReserveExternal ||
                    (newSlotStatus === "BOOKING_NOT_UTILIZED" && selectedSlotIdsForStatus.length === 0)
                  }
                  onClick={async () => {
                    const bySlots = selectedSlotIdsForStatus.length > 0;
                    const effectiveDates = getEffectiveDatesForStatus();
                    if (!bySlots && effectiveDates.length === 0) return;
                    if (newSlotStatus === "BOOKING_NOT_UTILIZED" && !bySlots) {
                      toast.error("For 'Booking Not Utilized' please use Week view to select booked slots only.");
                      return;
                    }
                    if (newSlotStatus === RESERVED_FOR_EXTERNAL_VALUE) {
                      setUpdatingReserveExternal(true);
                      try {
                        const payload: { reserved_for_external: boolean; dates?: string[]; slot_ids?: number[] } = { reserved_for_external: true };
                        if (bySlots) payload.slot_ids = selectedSlotIdsForStatus;
                        else payload.dates = effectiveDates;
                        const res = await apiClient.adminEquipmentBulkReserveExternal(selectedEquipment.id, payload);
                        if ((res as { error?: string }).error) throw new Error((res as { error: string }).error);
                        const data = (res as { data?: { updated?: number; message?: string } }).data;
                        toast.success(data?.message ?? `Marked ${data?.updated ?? 0} slot(s) as Reserved for External.`);
                        setSelectedDatesForStatus([]);
                        setSelectedSlotIdsForStatus([]);
                        setStatusChangeSelectedMonths([]);
                        setLastFetchedWeek(null);
                        await fetchSlotsForWeek(true);
                        if (statusChangePopupWeekStart) await fetchStatusChangeSlotsForWeek(statusChangePopupWeekStart);
                      } catch (e: unknown) {
                        toast.error(e instanceof Error ? e.message : "Failed to update slots");
                      } finally {
                        setUpdatingReserveExternal(false);
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
                      await fetchSlotsForWeek(true);
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
                  {updatingSlotStatus || updatingReserveExternal
                    ? "Applying…"
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
            </CardContent>
          </Card>
        )}

        {/* Inline week view (pick by time) */}
        {canAccessManageEquipmentModes() && adminManageMode === 'status' && selectedEquipment && statusChangePopupWeekStart && (
          <div className="max-w-6xl mx-auto mb-10 rounded-2xl overflow-hidden border-2 border-primary/15 shadow-xl">
            <div className="bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 px-6 py-5 text-white">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                  <Button variant="secondary" size="icon" className="h-12 w-12 bg-white/20 hover:bg-white/30 border-0 text-white" onClick={goToPrevWeekInPopup} aria-label="Previous week">
                    <ChevronLeft className="h-6 w-6" />
                  </Button>
                  <div className="text-center min-w-[280px]">
                    <h3 className="text-xl md:text-2xl font-bold">
                      Week of {format(statusChangePopupWeekStart, "MMM d")} – {format(addDays(statusChangePopupWeekStart, 6), "MMM d, yyyy")}
                    </h3>
                    <p className="text-white/90 text-base mt-1">Week view (pick by time)</p>
                  </div>
                  <Button variant="secondary" size="icon" className="h-12 w-12 bg-white/20 hover:bg-white/30 border-0 text-white" onClick={goToNextWeekInPopup} aria-label="Next week">
                    <ChevronRight className="h-6 w-6" />
                  </Button>
                </div>
                <Button
                  variant="secondary"
                  size="default"
                  className="bg-white/20 hover:bg-white/30 border-0 text-white h-11 px-5 text-base font-medium"
                  onClick={() => { setStatusChangePopupWeekStart(null); }}
                >
                  Hide week view
                </Button>
              </div>
              <p className="text-white/90 text-base mt-3">
                Click a slot to select it for status update. Use row actions to select a time for the whole week or month.
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-4">
                <span className="text-sm font-bold uppercase tracking-wider text-white/90 mr-2">Selection</span>
                <Button variant="secondary" size="default" className="bg-white/20 hover:bg-white/30 border-0 text-white h-10 px-4 text-sm font-medium" onClick={selectAllAvailableSlotsInPopup} disabled={!statusChangeSlots?.length || newSlotStatus === "BOOKING_NOT_UTILIZED"}>
                  Select all available
                </Button>
                <Button variant="secondary" size="default" className="bg-white/20 hover:bg-white/30 border-0 text-white h-10 px-4 text-sm font-medium" onClick={selectAllBookedSlotsInPopup} disabled={!statusChangeSlots?.length}>
                  Select all booked
                </Button>
                <Button variant="secondary" size="default" className="bg-white/20 hover:bg-white/30 border-0 text-white h-10 px-4 text-sm font-medium" onClick={selectAllNonCompletedSlotsInPopup} disabled={!statusChangeSlots?.length || newSlotStatus === "BOOKING_NOT_UTILIZED"}>
                  Select all (excl. completed)
                </Button>
                <Button variant="secondary" size="default" className="bg-white/20 hover:bg-white/30 border-0 text-white h-10 px-4 text-sm font-medium" onClick={clearPopupWeekSelection} disabled={selectedSlotIdsForStatus.length === 0}>
                  Clear selection
                </Button>
              </div>
            </div>

            <div className="overflow-auto p-4 md:p-6 bg-gradient-to-b from-background to-muted/10">
              {loadingStatusSlots ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground text-lg">
                  <span className="animate-pulse">Loading slots…</span>
                </div>
              ) : (
                <div className="min-w-[900px] rounded-xl border-2 border-primary/10 bg-card overflow-hidden shadow-lg">
                  <div className="grid gap-0 bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700" style={{ gridTemplateColumns: "120px 1fr 1fr 1fr 1fr 1fr 1fr 1fr" }}>
                    <div className="font-bold text-base p-4 border-b border-r">Time</div>
                    {[0, 1, 2, 3, 4, 5, 6].map((dayOffset) => {
                      const day = addDays(statusChangePopupWeekStart, dayOffset);
                      const dateStr = format(day, "yyyy-MM-dd");
                      const rawH = statusChangeHolidays[dateStr];
                      const holidayLabel = typeof rawH === "string" ? rawH : (rawH && typeof rawH === "object" && "label" in rawH ? (rawH as { label: string }).label : undefined);
                      const holidayColor = typeof rawH === "object" && rawH !== null && "color" in rawH ? (rawH as { color?: string }).color : undefined;
                      return (
                        <div key={dayOffset} className="font-bold text-base p-4 text-center border-b border-r last:border-r-0 text-slate-700 dark:text-slate-200">
                          <div>{format(day, "EEE")}</div>
                          <div className="text-slate-600 dark:text-slate-400">{format(day, "MMM d")}</div>
                          {holidayLabel && (
                            <div className="text-sm truncate mt-1" style={holidayColor ? { backgroundColor: holidayColor, color: getContrastTextColor(holidayColor), padding: "4px 8px", borderRadius: 6 } : undefined}>
                              {holidayLabel}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {(() => {
                    const timeSlots = statusChangeSlotMasterTimes.length > 0
                      ? statusChangeSlotMasterTimes
                      : (() => {
                          const fromSlots = new Set<string>();
                          statusChangeSlots?.forEach((s) => {
                            if (s.start_datetime) fromSlots.add(format(parseISO(s.start_datetime), "HH:mm"));
                          });
                          return Array.from(fromSlots).sort();
                        })();
                    const statusLabel = (slot: DailySlot) => {
                      if (slot.status === "BOOKED") return slot.booking_status_display || "Booked";
                      if (slot.status === "BLOCKED") return slot.blocked_label || "Blocked";
                      if (slot.status === "BOOKING_NOT_UTILIZED") return "Booking Not Utilized";
                      return slot.status_display || slot.status || "—";
                    };
                    const canSelectSlot = (s: DailySlot | null | undefined) => {
                      if (!s) return false;
                      if (newSlotStatus === "BOOKING_NOT_UTILIZED")
                        return s.status === "BOOKED" && (s.booking_status || "").toUpperCase() !== "COMPLETED";
                      if (s.status === "BOOKED" && (s.booking_status || "").toUpperCase() === "COMPLETED") return false;
                      return true;
                    };
                    if (timeSlots.length === 0) {
                      return (
                        <div className="p-10 text-center text-muted-foreground text-lg">
                          No slots for this week.
                        </div>
                      );
                    }
                    return timeSlots.map((time) => (
                      <div key={time} className="grid gap-0 border-b last:border-b-0" style={{ gridTemplateColumns: "120px 1fr 1fr 1fr 1fr 1fr 1fr 1fr" }}>
                        <div className="flex flex-col gap-2 items-stretch justify-center p-3 border-r bg-muted/30">
                          <span className="font-bold text-base">{time}</span>
                          <div className="flex flex-wrap gap-2">
                            <Button variant="ghost" size="sm" className="text-sm h-8" onClick={() => selectTimeRowForWeek(time)}>
                              Row (week)
                            </Button>
                            <Button variant="ghost" size="sm" className="text-sm h-8" onClick={() => selectTimeRowForMonth(time)}>
                              Month
                            </Button>
                            <Button variant="ghost" size="sm" className="text-sm h-8" onClick={() => selectTimeRowForYear(time)}>
                              Year
                            </Button>
                          </div>
                        </div>
                        {[0, 1, 2, 3, 4, 5, 6].map((dayOffset) => {
                          const day = addDays(statusChangePopupWeekStart, dayOffset);
                          const slot = getStatusChangeSlotAt(day, time);
                          const slotSelectable = canSelectSlot(slot);
                          const isSelected = slot ? selectedSlotIdsForStatus.includes(slot.id) : false;
                          const dateStr = format(day, "yyyy-MM-dd");
                          const rawHoliday = statusChangeHolidays[dateStr];
                          const holidayName = typeof rawHoliday === "string" ? rawHoliday : (rawHoliday && typeof rawHoliday === "object" && "label" in rawHoliday ? (rawHoliday as { label: string }).label : undefined);
                          const holidayColorCell = typeof rawHoliday === "object" && rawHoliday !== null && "color" in rawHoliday ? (rawHoliday as { color?: string }).color : undefined;
                          // Use calendar-colors (from equipment detail / admin settings) first, then localStorage overrides, then defaults
                          const calendarSlotColors = equipmentDetail?.calendar_colors?.slot_colors;
                          const statusForColor = slot?.booking_status ?? slot?.status ?? "";
                          const slotBg = holidayColorCell
                            ?? (calendarSlotColors?.[statusForColor] ?? statusChangeSlotColors[statusForColor] ?? DEFAULT_SLOT_STATUS_COLORS[statusForColor] ?? "#e5e7eb");
                          const emptyCellBg = holidayColorCell ?? (day.getDay() === 6 ? (equipmentDetail?.calendar_colors?.saturday_color ?? "#c7d2fe") : day.getDay() === 0 ? (equipmentDetail?.calendar_colors?.sunday_color ?? "#fbcfe8") : undefined);
                          const cell3dStyle: CSSProperties = {
                            boxShadow: "0 4px 6px -1px rgba(0,0,0,0.14), 0 2px 4px -2px rgba(0,0,0,0.1), inset 0 1px 0 0 rgba(255,255,255,0.28)",
                            border: "2px solid rgba(255,255,255,0.45)",
                            borderRadius: "12px",
                          };
                          return (
                            <div key={dayOffset} className="min-h-[64px] p-2 border-r last:border-r-0">
                              {slot ? (
                                <div className="w-full h-full min-h-[60px] relative flex items-stretch">
                                  <button
                                    type="button"
                                    onClick={() => { if (slotSelectable) toggleStatusChangeSlotSelection(slot.id); }}
                                    disabled={!slotSelectable}
                                    className={cn(
                                      "flex-1 min-h-[60px] p-2 text-sm font-semibold text-left transition-all flex items-center justify-center",
                                      !slotSelectable && "cursor-not-allowed opacity-75",
                                      isSelected && "ring-2 ring-primary ring-offset-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg"
                                    )}
                                    style={
                                      !isSelected && slot
                                        ? {
                                            ...cell3dStyle,
                                            backgroundColor: slotBg,
                                            color: getContrastTextColor(slotBg),
                                          }
                                        : isSelected ? cell3dStyle : undefined
                                    }
                                  >
                                    {isSelected ? "✓" : (holidayName && !slot.booking_id ? holidayName : statusLabel(slot))}
                                  </button>
                                  {slot.status === "BOOKED" && slot.booking_id && (
                                    <button
                                      type="button"
                                      aria-label="View booking details"
                                      className="absolute top-1 right-1 p-1 rounded-md opacity-90 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring"
                                      style={{ color: getContrastTextColor(slotBg) }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        setExpandedSlotBooking(null);
                                        setExpandedSlotBookingLoading(true);
                                        apiClient
                                          .getBookings({ booking_id: slot.booking_id!, limit: 1 })
                                          .then((res) => {
                                            const b = res.data?.bookings?.[0];
                                            if (b) setExpandedSlotBooking(b as BookingDetailCardBooking);
                                          })
                                          .catch(() => toast.error("Failed to load booking details"))
                                          .finally(() => setExpandedSlotBookingLoading(false));
                                      }}
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <div
                                  className="w-full min-h-[60px] p-2 rounded-xl text-sm font-semibold flex items-center justify-center border-2 border-white/40"
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
                                  {holidayName ?? "—"}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ));
                  })()}
                </div>
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
                    currentUserId={userId ? parseInt(userId, 10) : null}
                    backLabel="Close booking details"
                    showPrintButton={false}
                  />
                </div>
              )}
            </div>

            <div className="border-t-2 border-primary/10 px-6 py-4 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center gap-4 flex-wrap">
              <p className="text-base font-semibold text-foreground mr-auto">
                {selectedSlotIdsForStatus.length} slot(s) selected in week view.
              </p>
              <Button variant="outline" size="default" className="h-11 px-5 text-base font-medium" onClick={() => setSelectedSlotIdsForStatus([])} disabled={selectedSlotIdsForStatus.length === 0}>
                Clear selected slots
              </Button>
            </div>
          </div>
        )}

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

        {/* Booking flow: hide when admin and mode not yet chosen or when in status mode */}
        {(!isAdminUser() || adminManageMode === 'book') && (
        <div className="max-w-6xl mx-auto">
          <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Book {selectedEquipment.name}</CardTitle>
                    <CardDescription>
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
                {/* Admin: select user when booking on behalf (searchable + filter by type) */}
                {canAccessManageEquipmentModes() && adminManageMode === 'book' && (
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
                                      const typeMatch = adminUserTypeFilter === USER_TYPE_FILTER_ALL || String(u.user_type || "").toLowerCase() === adminUserTypeFilter.toLowerCase();
                                      const q = userSearchQuery.trim().toLowerCase();
                                      const nameMatch = !q || (u.name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q);
                                      return typeMatch && nameMatch;
                                    })
                                    .map((u) => {
                                      const label = u.name || u.email || `User #${u.id}`;
                                      return (
                                        <CommandItem
                                          key={u.id}
                                          value={String(u.id)}
                                          onSelect={() => {
                                            setAdminBookForUserId(String(u.id));
                                            setSelectedCouponId(null);
                                            setCouponCodeInput("");
                                            setShowCouponCodeInput(false);
                                            setValidatedCouponFromCode(null);
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
                                            <span className="ml-2 text-xs text-muted-foreground">({u.user_type})</span>
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

                {/* Step 1: Input Fields Section */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-4">Step 1: Provide Additional Information</h3>
                  {repeatSourceBooking && (
                    <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-800 dark:text-amber-200">
                      Repeat sample: parameters are fixed from the original booking. Choose slots in Step 3. This booking will not count toward your weekly or monthly limit.
                    </div>
                  )}
                  {equipmentDetail?.input_fields && equipmentDetail.input_fields.length > 0 ? (
                    <div className="mb-4 p-4 rounded-lg">
                      <div className="grid grid-cols-1 gap-4">
                        {equipmentDetail.input_fields.map((field: any) => {
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
                              
                              case 'NUMERIC':
                                return (
                                  <Input
                                    id={field.field_key}
                                    type="number"
                                    value={inputFieldValues[field.field_key] as string || ''}
                                    onChange={(e) => handleInputFieldChange(field.field_key, e.target.value)}
                                    onBlur={(e) => {
                                      const value = e.target.value;
                                      if (value && isNaN(Number(value))) {
                                        handleInputFieldChange(field.field_key, '');
                                      }
                                    }}
                                    required={field.is_required}
                                    min={field.options?.min || undefined}
                                    max={field.options?.max || undefined}
                                    step={field.options?.step || '1'}
                                    placeholder={field.default_value || '0'}
                                    disabled={!!repeatSourceBooking}
                                  />
                                );
                              
                              case 'RADIO':
                                return (
                                  <RadioGroup
                                    value={inputFieldValues[field.field_key] as string || field.default_value || ''}
                                    onValueChange={(value) => handleInputFieldChange(field.field_key, value)}
                                    required={field.is_required}
                                    disabled={!!repeatSourceBooking}
                                  >
                                    {field.options && field.options.length > 0 ? (
                                      field.options.map((option: any) => {
                                        const optionValue = String(option.value || option);
                                        const optionLabel = option.label || option;
                                        return (
                                          <div key={optionValue} className="flex items-center space-x-2">
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
                                        field.options.map((option: any) => {
                                          const optionValue = String(option.value || option);
                                          const optionLabel = option.label || option;
                                          return (
                                            <SelectItem key={optionValue} value={optionValue}>
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
                                      field.options.map((option: any) => {
                                        const optionValue = option.value || option;
                                        const optionLabel = option.label || option;
                                        const currentValues = (inputFieldValues[field.field_key] as string[]) || [];
                                        const isChecked = currentValues.includes(optionValue);
                                        
                                        return (
                                          <div key={optionValue} className="flex items-center space-x-2">
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
                                const disabledSet = parseDisabledElementsFromHelpText(field.help_text);
                                const allowedList = elementsList.filter((s) => !disabledSet.has(s));
                                return (
                                  <div className="space-y-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setPeriodicTableFieldKey(field.field_key);
                                        setSelectedPeriodicSymbols(new Set(allowedList));
                                      }}
                                    >
                                      Select elements
                                    </Button>
                                    {count > 0 && (
                                      <p className="text-sm text-muted-foreground">
                                        {allowedList.length} element(s) selected{allowedList.length ? `: ${allowedList.join(', ')}` : ''}
                                      </p>
                                    )}
                                  </div>
                                );
                              }

                              case 'TABLE': {
                                const columns = Array.isArray(field.options) ? field.options.map((h: any) => String(h?.value ?? h ?? '')) : [];
                                const rows = (inputFieldValues[field.field_key] as string[][] | undefined) || [];
                                const addRow = () => {
                                  const newRow = Array(columns.length).fill('');
                                  handleInputFieldChange(field.field_key, [...rows, newRow] as any);
                                };
                                const deleteRow = (rowIdx: number) => {
                                  const next = rows.filter((_, i) => i !== rowIdx);
                                  handleInputFieldChange(field.field_key, next as any);
                                };
                                const setCell = (rowIdx: number, colIdx: number, val: string) => {
                                  const next = rows.map((r, i) => (i === rowIdx ? r.slice() : r));
                                  if (!next[rowIdx]) next[rowIdx] = Array(columns.length).fill('');
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
                                            <th className="w-10 p-2 text-center"> </th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {rows.length === 0 ? (
                                            <tr>
                                              <td colSpan={columns.length + 1} className="p-2 text-muted-foreground text-center">
                                                No rows. Click + to add.
                                              </td>
                                            </tr>
                                          ) : (
                                            rows.map((row, ri) => (
                                              <tr key={ri} className="border-b last:border-0">
                                                {columns.map((_, ci) => (
                                                  <td key={ci} className="p-1 border-r last:border-r-0">
                                                    <Input
                                                      className="h-8 text-sm"
                                                      value={row[ci] ?? ''}
                                                      onChange={(e) => setCell(ri, ci, e.target.value)}
                                                      placeholder=""
                                                    />
                                                  </td>
                                                ))}
                                                <td className="p-1 w-10 text-center align-middle">
                                                  <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                                    onClick={() => deleteRow(ri)}
                                                    title="Delete row"
                                                  >
                                                    <Trash2 className="h-4 w-4" />
                                                  </Button>
                                                </td>
                                              </tr>
                                            ))
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                    <div className="flex gap-2">
                                      <Button type="button" variant="outline" size="sm" onClick={addRow}>
                                        <Plus className="h-4 w-4 mr-1" />
                                        Add row
                                      </Button>
                                    </div>
                                  </div>
                                );
                              }
                              
                              default:
                                // Fallback for unknown field types - show error message
                                console.error(`Unsupported field type "${field.field_type}" (normalized: "${fieldType}") for field "${field.field_key}". Supported types: NUMERIC, TEXT, RADIO, COMBO, MULTI_SELECT, TOGGLE, PERIODIC_TABLE, TABLE`);
                                return (
                                  <div className="p-3 border border-destructive rounded-md bg-destructive/10">
                                    <p className="text-sm text-destructive font-medium">
                                      Unsupported field type: {field.field_type}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Supported types: NUMERIC, TEXT, RADIO, COMBO, MULTI_SELECT, TOGGLE, PERIODIC_TABLE, TABLE
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
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground mb-4">No additional information required for this equipment.</p>
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
                          const disabledSet = parseDisabledElementsFromHelpText(field?.help_text);
                          const toggle = (symbol: string) => {
                            if (disabledSet.has(symbol)) return;
                            setSelectedPeriodicSymbols((prev) => {
                              const next = new Set(prev);
                              if (next.has(symbol)) next.delete(symbol);
                              else next.add(symbol);
                              return next;
                            });
                          };
                          return (
                            <>
                              <p className="text-sm text-muted-foreground">
                                {selectedPeriodicSymbols.size} element(s) selected. Count is stored for charge calculation.
                                {disabledSet.size > 0 && (
                                  <span className="block mt-1"> Elements listed in Help text (admin) are disabled and cannot be selected.</span>
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
                                        return (
                                          <button
                                            key={el.atomicNumber}
                                            type="button"
                                            onClick={() => toggle(el.symbol)}
                                            disabled={isDisabled}
                                            title={isDisabled ? `${el.name} (disabled)` : el.name}
                                            className={cn(
                                              "w-10 h-10 border-2 rounded flex flex-col items-center justify-center text-xs transition-all relative",
                                              getCategoryColor(el.category),
                                              selectedPeriodicSymbols.has(el.symbol) && "ring-2 ring-primary ring-offset-1 scale-105",
                                              isDisabled && "opacity-60 cursor-not-allowed pointer-events-none bg-muted border-dashed"
                                            )}
                                          >
                                            {selectedPeriodicSymbols.has(el.symbol) && <Check className="w-3 h-3 absolute top-0 right-0" />}
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
                          onClick={() => {
                            if (periodicTableFieldKey) {
                              const field = equipmentDetail?.input_fields?.find((f: { field_key?: string }) => f.field_key === periodicTableFieldKey);
                              const disabledSet = parseDisabledElementsFromHelpText(field?.help_text);
                              const allowed = Array.from(selectedPeriodicSymbols).filter((s) => !disabledSet.has(s));
                              handleInputFieldChange(periodicTableFieldKey, allowed.length);
                              handleInputFieldChange(periodicTableFieldKey + "_elements", allowed.join(","));
                              setPeriodicTableFieldKey(null);
                            }
                          }}
                        >
                          Apply
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  
                  {/* Loading indicator for auto-calculation */}
                  {loadingCharge && (
                    <div className="flex justify-center items-center gap-2 mt-4 text-sm text-muted-foreground">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      Calculating charge...
                    </div>
                  )}
                  
                  {/* Coming Soon message if charge calculation failed (hidden for admin) */}
                  {chargeCalculationFailed && !loadingCharge && !isAdminUser() && (
                    <div className="mt-6 p-6 bg-muted rounded-lg border-2 border-dashed text-center">
                      <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
                      <p className="text-sm text-muted-foreground">
                        Charge calculation is currently unavailable. Please check back later.
                      </p>
                    </div>
                  )}
                </div>

                {/* Step 2: Calculated Charge Display */}
                {chargeCalculated && calculatedCharge && !chargeCalculationFailed && (
                  <div className="mb-6 p-6 bg-primary/10 rounded-lg border-2 border-primary">
                    <h3 className="text-lg font-semibold mb-4">Step 2: Charge Calculation</h3>
                    <div className="space-y-2">
                      {getEffectiveWeeklyViewDisplay() !== 'SLOT_ID' && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Total Time:</span>
                          <span className="text-sm">
                            {Math.floor(calculatedCharge.total_time_minutes / 60)}h {calculatedCharge.total_time_minutes % 60}m
                          </span>
                        </div>
                      )}
                      {calculatedCharge.charge_breakdown && calculatedCharge.charge_breakdown.length > 0 && (
                        <div className="mt-4 space-y-1">
                          <p className="text-sm font-medium mb-2">Charge Breakdown:</p>
                          {calculatedCharge.charge_breakdown.map((item, index) => (
                            <div key={index} className="flex justify-between text-sm">
                              <span className="text-muted-foreground">{item.description}</span>
                              <span>₹{Number(item.amount).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="mt-4 pt-3 border-t space-y-1.5">
                        {calculatedCharge.base_charge != null && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Base amount</span>
                            <span>₹{Number(calculatedCharge.base_charge).toFixed(2)}</span>
                          </div>
                        )}
                        {(calculatedCharge.gst_percent ?? 0) > 0 && (
                          <>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">GST ({calculatedCharge.gst_percent}%)</span>
                              <span>₹{Number(calculatedCharge.gst_amount ?? 0).toFixed(2)}</span>
                            </div>
                          </>
                        )}
                        <div className="flex justify-between font-semibold text-base pt-1">
                          <span>Final amount</span>
                          <span>₹{Number(calculatedCharge.total_charge).toFixed(2)}</span>
                        </div>
                      </div>
                      {canAccessManageEquipmentModes() && adminManageMode === "book" && hasValidCoupons && (
                        <div className="mt-4 rounded-xl border border-amber-200/60 bg-gradient-to-br from-amber-50/80 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/10 p-4 space-y-4">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-400">
                              <Tag className="h-4 w-4" />
                            </div>
                            <div>
                              <Label className="text-sm font-semibold text-foreground">Coupon (optional)</Label>
                              <p className="text-xs text-muted-foreground mt-0.5">Select a coupon for the booking user or enter a code and validate.</p>
                            </div>
                          </div>
                          <div className="grid gap-4 sm:grid-cols-1">
                            <div className="space-y-1.5">
                              <span className="text-xs font-medium text-muted-foreground">Choose from booking user's coupons</span>
                              <Select
                                value={selectedCouponId != null ? String(selectedCouponId) : "none"}
                                onValueChange={(v) => {
                                  if (v === "none") { setSelectedCouponId(null); setCouponCodeInput(""); setValidatedCouponFromCode(null); }
                                  else {
                                    const id = parseInt(v, 10);
                                    const c = myCoupons.find((x) => x.id === id);
                                    setSelectedCouponId(id);
                                    setCouponCodeInput(c?.code ?? "");
                                    setValidatedCouponFromCode(null);
                                  }
                                }}
                              >
                                <SelectTrigger className="w-full max-w-sm border-amber-200/80 bg-background/80">
                                  <SelectValue placeholder="No coupon" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">No coupon</SelectItem>
                                  {myCoupons.filter((c) => !c.is_expired && Number(c.balance ?? c.amount) > 0).map((c) => (
                                    <SelectItem key={c.id} value={String(c.id)}>
                                      {c.code} — Balance ₹{c.balance ?? c.amount}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <span className="text-xs font-medium text-muted-foreground">Or enter coupon code</span>
                              <div className="flex flex-wrap items-center gap-2">
                                <Input
                                  placeholder="Enter coupon code"
                                  value={couponCodeInput}
                                  onChange={(e) => {
                                    setCouponCodeInput(e.target.value);
                                    setValidatedCouponFromCode(null);
                                    if (selectedCouponId != null) setSelectedCouponId(null);
                                  }}
                                  className="max-w-xs font-mono border-amber-200/80 bg-background/80"
                                />
                                <Button type="button" variant="secondary" size="sm" onClick={applyCouponCode} disabled={validatingCoupon} className="shrink-0">
                                  {validatingCoupon ? "Validating…" : "Apply Coupon"}
                                </Button>
                              </div>
                            </div>
                          </div>
                          {(selectedCouponId != null || validatedCouponFromCode) && (() => {
                            const c = selectedCouponId != null ? myCoupons.find((x) => x.id === selectedCouponId) : null;
                            const base = Number(calculatedCharge?.total_charge ?? 0);
                            const amt = c ? Number(c.balance ?? c.amount ?? 0) : validatedCouponFromCode ? Number(validatedCouponFromCode.amount) : 0;
                            const effective = Math.min(amt, base);
                            const isCapped = amt > base;
                            return (
                              <div className="flex items-center justify-between rounded-lg bg-amber-500/10 dark:bg-amber-500/15 px-3 py-2 text-sm">
                                <span className="text-muted-foreground">
                                  Discount{isCapped ? " (capped to charge)" : ""}
                                </span>
                                <span className="font-semibold text-amber-700 dark:text-amber-400">−₹{effective.toFixed(2)}</span>
                              </div>
                            );
                          })()}
                          {couponCodeInput.trim() && selectedCouponId == null && !validatedCouponFromCode && (
                            <p className="text-xs text-muted-foreground">Click Apply Coupon to validate this code.</p>
                          )}
                        </div>
                      )}
                      {!canAccessManageEquipmentModes() && hasValidCoupons && (
                        <div className="mt-4 rounded-xl border border-amber-200/60 bg-gradient-to-br from-amber-50/80 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/10 p-4 space-y-4">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-400">
                              <Tag className="h-4 w-4" />
                            </div>
                            <div>
                              <Label className="text-sm font-semibold text-foreground">Coupon (optional)</Label>
                              <p className="text-xs text-muted-foreground mt-0.5">Select a coupon or enter a code for a discount.</p>
                            </div>
                          </div>
                          <div className="grid gap-4 sm:grid-cols-1">
                            <div className="space-y-1.5">
                              <span className="text-xs font-medium text-muted-foreground">Choose from your coupons</span>
                              <Select
                                value={selectedCouponId != null ? String(selectedCouponId) : "none"}
                                onValueChange={(v) => {
                                  if (v === "none") { setSelectedCouponId(null); setCouponCodeInput(""); setValidatedCouponFromCode(null); }
                                  else {
                                    const id = parseInt(v, 10);
                                    const c = myCoupons.find((x) => x.id === id);
                                    setSelectedCouponId(id);
                                    setCouponCodeInput(c?.code ?? "");
                                    setValidatedCouponFromCode(null);
                                  }
                                }}
                              >
                                <SelectTrigger className="w-full max-w-sm border-amber-200/80 bg-background/80">
                                  <SelectValue placeholder="No coupon" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">No coupon</SelectItem>
                                  {myCoupons.filter((c) => !c.is_expired && Number(c.balance ?? c.amount) > 0).map((c) => (
                                    <SelectItem key={c.id} value={String(c.id)}>
                                      {c.code} — Balance ₹{c.balance ?? c.amount}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <span className="text-xs font-medium text-muted-foreground">Or enter coupon code</span>
                              <div className="flex flex-wrap items-center gap-2">
                                <Input
                                  placeholder="Enter coupon code"
                                  value={couponCodeInput}
                                  onChange={(e) => {
                                    setCouponCodeInput(e.target.value);
                                    setValidatedCouponFromCode(null);
                                    if (selectedCouponId != null) setSelectedCouponId(null);
                                  }}
                                  className="max-w-xs font-mono border-amber-200/80 bg-background/80"
                                />
                                <Button type="button" variant="secondary" size="sm" onClick={applyCouponCode} disabled={validatingCoupon} className="shrink-0">
                                  {validatingCoupon ? "Validating…" : "Apply Coupon"}
                                </Button>
                              </div>
                            </div>
                          </div>
                          {(selectedCouponId != null || validatedCouponFromCode) && (() => {
                            const c = selectedCouponId != null ? myCoupons.find((x) => x.id === selectedCouponId) : null;
                            const base = Number(calculatedCharge?.total_charge ?? 0);
                            const amt = c ? Number(c.balance ?? c.amount ?? 0) : validatedCouponFromCode ? Number(validatedCouponFromCode.amount) : 0;
                            const effective = Math.min(amt, base);
                            const isCapped = amt > base;
                            return (
                              <div className="flex items-center justify-between rounded-lg bg-amber-500/10 dark:bg-amber-500/15 px-3 py-2 text-sm">
                                <span className="text-muted-foreground">
                                  Discount{isCapped ? " (capped to charge)" : ""}
                                </span>
                                <span className="font-semibold text-amber-700 dark:text-amber-400">−₹{effective.toFixed(2)}</span>
                              </div>
                            );
                          })()}
                          {couponCodeInput.trim() && selectedCouponId == null && !validatedCouponFromCode && (
                            <p className="text-xs text-muted-foreground">Click Apply Coupon to validate this code.</p>
                          )}
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-4 border-t">
                        <span className="text-lg font-semibold">Total Charge:</span>
                        <span className="text-2xl font-bold text-primary">
                          ₹{(() => {
                            const base = Number(calculatedCharge.total_charge);
                            const couponAmt = selectedCouponId != null
                              ? Number(myCoupons.find((c) => c.id === selectedCouponId)?.balance ?? myCoupons.find((c) => c.id === selectedCouponId)?.amount ?? 0)
                              : validatedCouponFromCode
                                ? Number(validatedCouponFromCode.amount)
                                : 0;
                            const effectiveDiscount = Math.min(couponAmt, base);
                            return (base - effectiveDiscount).toFixed(2);
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Slot Selection (only shown after charge calculation) */}
                {showSlots && chargeCalculated && (
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

                {/* Show loading while slots are being fetched (avoids grid full of disabled cells) */}
                {loadingSlots && (!equipmentDetail?.daily_slots || equipmentDetail.daily_slots.length === 0) && (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    <span className="animate-pulse">Loading slots for this week…</span>
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
                    {isAdminUser() && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Available: Any week (no restriction)
                      </p>
                    )}
                    {userType && !isAdminUser() && (normalizeUserType(userType) === 'student' || normalizeUserType(userType) === 'faculty') && (() => {
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
                    {userType && !isAdminUser() && normalizeUserType(userType) !== 'student' && normalizeUserType(userType) !== 'faculty' && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Available: One week window starting 15 days from today
                      </p>
                    )}
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

                {/* Slot Grid - show loading overlay when fetching a different week */}
                {(() => {
                  const weekStart = startOfWeek(currentWeekStart, { weekStartsOn: 1 });
                  const weekEnd = addDays(weekStart, 7);
                  const currentWeekKey = `${format(weekStart, "yyyy-MM-dd")}_${format(weekEnd, "yyyy-MM-dd")}`;
                  const isLoadingThisWeek = loadingSlots && (lastFetchedWeek === null || currentWeekKey !== lastFetchedWeek);
                  return (
                <div className="overflow-x-auto relative">
                  {isLoadingThisWeek && (
                    <div className="absolute inset-0 bg-background/80 z-10 flex items-center justify-center rounded-md min-h-[200px]">
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        <p className="text-sm text-muted-foreground">Loading weekly slots…</p>
                      </div>
                    </div>
                  )}
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

                      if (fetchedButEmpty) {
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
                          </div>
                        );
                      }
                      
                      return rowKeys.map((rowKey, rowIndex) => {
                      const rowLabel = rowKeysAndLabels[rowIndex]?.label ?? rowKey;
                      const time = rowKey;
                      return (
                      <div key={rowKey} className="grid grid-cols-8 gap-2 mb-2">
                        <div className="text-sm p-2 font-medium flex items-center">
                          {rowLabel}
                        </div>
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
                          
                          const isAvailable = slotExists && !isBooked && !isPast;
                          
                          // Get slot status from the actual slot data; prefer booking status if booking exists, else slot status (never empty when slot exists)
                          const slotStatus = slotData?.status ?? "";
                          const isSlotBookedStatus = slotStatus !== "" && slotStatus !== "AVAILABLE";
                          const dateStr = format(day, "yyyy-MM-dd");
                          const rawHoliday = equipmentDetail?.weekly_holidays?.[dateStr];
                          const holidayLabel = typeof rawHoliday === "string" ? rawHoliday : (rawHoliday && typeof rawHoliday === "object" && "label" in rawHoliday ? (rawHoliday as { label: string }).label : undefined);
                          const holidayColor = typeof rawHoliday === "object" && rawHoliday !== null && "color" in rawHoliday && (rawHoliday as { color?: string }).color
                            ? (rawHoliday as { color: string }).color
                            : undefined;
                          const holidayName = holidayLabel;
                          const bookingStatusDisplay = slotData?.booking_status_display ?? null;
                          const bookingId = slotData?.booking_id ?? null;
                          // Admin: only BOOKED slots are non-selectable; other statuses (BLOCKED, weekend/holiday) are bookable
                          const isActuallyBooked = (slotStatus === "BOOKED" || slotStatus === "BOOKING_NOT_UTILIZED" || !!bookingId);
                          const considerBooked = isAdminUser() ? isActuallyBooked : (isSlotBookedStatus || isBooked || !!bookingId);
                          const blockedLabel = slotData?.blocked_label ?? null;
                          
                          // Build status label with special handling for BLOCKED and BOOKED
                          let rawSlotStatusLabel = slotData?.status_display || "";
                          if (!rawSlotStatusLabel && slotStatus) {
                            const statusMap: Record<string, string> = {
                              "AVAILABLE": "Available",
                              "NOT_AVAILABLE": "Not Available",
                              "BOOKED": "Booked",
                              "BLOCKED": "Blocked",
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
                          
                          // For BLOCKED status, use blocked_label if available, otherwise show "Blocked"
                          if (slotStatus === "BLOCKED") {
                            slotStatusLabel = blockedLabel || "Blocked";
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
                              displayStatus = slotDisplayLabel || slotStatusLabel || "Unavailable";
                              isDisabled = true;
                            } else if (isSelected) {
                              displayStatus = "Selected";
                              isDisabled = false; // Allow deselecting
                            } else if (isPast) {
                              displayStatus = considerBooked ? (slotDisplayLabel || slotStatusLabel || "Unavailable") : "No Booking";
                              isDisabled = !isAdminUser();
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

                          const useHolidayBg = Boolean(holidayColor && !isSelected && !considerBooked && !(isExternalUser && slotExists));
                          const dayOfWeek = day.getDay();
                          const isWeekendCell = !slotExists && (dayOfWeek === 6 || dayOfWeek === 0);

                          // Admin-configured calendar colors: merge with full defaults so every slot status has a color
                          const defaultSlotColors: Record<string, string> = {
                            AVAILABLE: "#22c55e",
                            BOOKED: "#ef4444",
                            BLOCKED: "#64748b",
                            UNDER_MAINTENANCE: "#f97316",
                            OPERATOR_ABSENT: "#eab308",
                            BOOKING_NOT_UTILIZED: "#a855f7",
                            HOLD: "#f59e0b",
                            RESERVED_FOR_EXTERNAL: "#94a3b8",
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
                          if (useHolidayBg && holidayColor && !isWeekendCell) {
                            cellStyle = { backgroundColor: holidayColor, color: getContrastTextColor(holidayColor) };
                          } else if (isSelected) {
                            cellStyle = undefined; // use Tailwind primary
                          } else if (slotExists) {
                            // Use RESERVED_FOR_EXTERNAL / NOT_AVAILABLE from calendar-colors when applicable
                            let statusForColor = slotStatus;
                            if (slotData?.status_display === "Reserved for External User") statusForColor = "RESERVED_FOR_EXTERNAL";
                            else if (slotStatus === "NOT_AVAILABLE") statusForColor = "NOT_AVAILABLE";
                            else if (slotStatus === "BOOKED" && slotData?.booking_status) statusForColor = String(slotData.booking_status).toUpperCase();
                            const status = statusForColor || "AVAILABLE";
                            const bg = slotColors[status] ?? (considerBooked ? slotColors.BOOKED : slotColors.AVAILABLE);
                            if (isPast && !isAdminUser()) {
                              cellStyle = { backgroundColor: "#94a3b8", color: "#ffffff" };
                            } else {
                              cellStyle = { backgroundColor: bg, color: getContrastTextColor(bg) };
                            }
                          } else {
                            // No slot (weekend/holiday): always use admin-configured weekend colors for Sat/Sun so they match /calendar-colors
                            const bg = dayOfWeek === 6 ? saturdayColor : dayOfWeek === 0 ? sundayColor : (holidayColor || holidayDefault);
                            cellStyle = { backgroundColor: bg, color: getContrastTextColor(bg) };
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
                                ${isPast && !considerBooked && slotExists && !isAdminUser() ? 'cursor-not-allowed' : ''}
                                ${isSelected ? 'bg-primary text-primary-foreground' : ''}
                                ${(isAvailable || (isAdminUser() && slotExists && !considerBooked)) && !isSelected && !isDisabled ? 'cursor-pointer hover:opacity-90' : ''}
                                ${(isAvailable || (isAdminUser() && slotExists && !considerBooked)) && !isSelected && isDisabled ? 'cursor-not-allowed opacity-60' : ''}
                              `}
                              style={cellStyle}
                            >
                              {displayStatus}
                            </button>
                          );
                        })}
                      </div>
                      ); });
                    })()}
                  </div>
                </div>
                  );
                })()}

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
                            ₹{calculatedCharge
                              ? (canAccessManageEquipmentModes() && adminManageMode === "book" && adminDiscountAmount > 0
                                ? Math.max(0, Number(calculatedCharge.total_charge) - adminDiscountAmount).toFixed(2)
                                : Number(calculatedCharge.total_charge).toFixed(2))
                              : calculateTotalCost().toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Booking options */}
                    <div className="mt-6 rounded-xl border border-border/80 bg-muted/30 dark:bg-muted/20 p-4 space-y-4">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-muted-foreground shrink-0" />
                        <p className="text-sm font-medium text-foreground">Booking options</p>
                      </div>
                      <div className="space-y-3">
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
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-6 flex flex-wrap gap-4">
                      <Button
                        variant="outline"
                        className="flex-1 min-w-[140px]"
                        onClick={() => setSelectedSlots([])}
                        disabled={selectedSlots.length === 0}
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
                        disabled={selectedSlots.length === 0 || isSubmittingBooking}
                      >
                        {isSubmittingBooking ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Confirming…
                          </>
                        ) : (
                          <>{isUrgentHoldMode ? ((searchParams.get("return_to") === "my-urgent-requests" || searchParams.get("return_to") === "dashboard") ? <>Hold slots and return ({selectedSlots.length} slot{selectedSlots.length !== 1 ? "s" : ""})</> : <>Submit Request ({selectedSlots.length} slot{selectedSlots.length !== 1 ? "s" : ""})</>) : <>Confirm Booking ({selectedSlots.length} slot{selectedSlots.length !== 1 ? "s" : ""})</>}</>
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
        <Dialog open={urgentDialogOpen} onOpenChange={(open) => {
          setUrgentDialogOpen(open);
          if (!open) {
            setPendingHoldSelection(null);
            setUrgentRequestType('NO_SLOT');
            setUrgentDisclaimerAccepted(false);
            urgentDisclaimerAcceptedRef.current = false;
            setUrgentEvidenceFile(null);
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
                  onValueChange={(v) => { setUrgentRequestType(v as 'NO_SLOT' | 'REVIEWER_URGENT'); setUrgentDisclaimerAccepted(false); urgentDisclaimerAcceptedRef.current = false; setUrgentEvidenceFile(null); }}
                  className="flex flex-col gap-3"
                >
                  <div className="flex items-center space-x-4 rounded-lg border-2 border-border/80 p-4 hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="NO_SLOT" id="urgent-no-slot" className="h-5 w-5" />
                    <Label htmlFor="urgent-no-slot" className="flex-1 cursor-pointer">
                      <span className="font-medium text-base">Unable to get slot despite repeated trials</span>
                      <span className="text-muted-foreground text-sm block mt-0.5">Reviewed by Admin/OIC.</span>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-4 rounded-lg border-2 border-border/80 p-4 hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="REVIEWER_URGENT" id="urgent-reviewer" className="h-5 w-5" />
                    <Label htmlFor="urgent-reviewer" className="flex-1 cursor-pointer">
                      <span className="font-medium text-base">Urgent comment from reviewer</span>
                      <span className="text-muted-foreground text-sm block mt-0.5">Upload evidence; Supervisor then Admin/OIC.</span>
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
                  <p className="text-sm text-muted-foreground border border-amber-200 dark:border-amber-800 rounded-lg p-4 bg-amber-50/50 dark:bg-amber-950/20">Upload documentary evidence. Supervisor approves first, then Admin/OIC. Misuse may result in action.</p>
                  <div className="flex items-center space-x-3">
                    <Checkbox id="urgent-disclaimer-reviewer" checked={urgentDisclaimerAccepted} onCheckedChange={(c) => { const v = c === true; setUrgentDisclaimerAccepted(v); urgentDisclaimerAcceptedRef.current = v; }} className="h-5 w-5" />
                    <Label htmlFor="urgent-disclaimer-reviewer" className="text-base cursor-pointer">I have read and will upload genuine evidence.</Label>
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
                  (urgentRequestType === 'REVIEWER_URGENT' && !urgentEvidenceFile) ||
                  (urgentHoldBookingId == null && pendingHoldSelection == null) ||
                  noSlotNoAttempts
                }
                onClick={async () => {
                  if (!selectedEquipment) return;
                  if (urgentRequestType === 'REVIEWER_URGENT' && !urgentEvidenceFile) {
                    toast.error("Please upload documentary evidence.");
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
                        ...(selectedCouponId != null ? { coupon_id: selectedCouponId } : validatedCouponFromCode ? { coupon_id: validatedCouponFromCode.id } : couponCodeInput.trim() ? { coupon_code: couponCodeInput.trim() } : {}),
                      });
                      if (res.error) {
                        toast.error(res.error);
                        return;
                      }
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

        {/* Immediate feedback while booking is being processed */}
        <Dialog open={isSubmittingBooking} onOpenChange={() => {}}>
          <DialogContent
            className="max-w-sm border-2 border-primary/20 shadow-lg"
            onPointerDownOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
          >
            <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
              <Loader2 className="h-14 w-14 animate-spin text-primary mb-4" />
              <DialogTitle className="text-lg font-semibold mb-1">Confirming your booking</DialogTitle>
              <DialogDescription asChild>
                <p className="text-sm text-muted-foreground">Processing your request. Please wait a moment…</p>
              </DialogDescription>
              <p className="text-xs text-muted-foreground mt-3">Do not close this window.</p>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={couponValidatePopup.open} onOpenChange={(open) => !open && setCouponValidatePopup((p) => ({ ...p, open: false }))}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className={couponValidatePopup.success ? "text-green-600 dark:text-green-500" : "text-destructive"}>
                {couponValidatePopup.success ? "Coupon applied" : "Coupon invalid"}
              </DialogTitle>
              <DialogDescription asChild>
                <p>{couponValidatePopup.message}</p>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setCouponValidatePopup((p) => ({ ...p, open: false }))}>OK</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={bookingResultDialog.open} onOpenChange={(open) => !open && setBookingResultDialog((p) => ({ ...p, open: false }))}>
          <DialogContent className="max-w-2xl min-w-[min(92vw,640px)] sm:min-w-[640px]">
            <DialogHeader>
              <DialogTitle className={bookingResultDialog.success ? "text-green-600 dark:text-green-500" : "text-destructive"}>
                {bookingResultDialog.success ? "Booking successful" : "Booking unsuccessful"}
              </DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-3">
                  <p>{bookingResultDialog.message}</p>
                  <p className="text-foreground font-medium">Do you want to book another equipment or continue booking current equipment?</p>
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-4">
              {bookingResultDialog.success && adminBookForUserId && (
                <Button
                  variant="secondary"
                  className="w-full sm:flex-1 gap-2"
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
                className="w-full sm:flex-1"
                onClick={() => {
                  setBookingResultDialog((p) => ({ ...p, open: false }));
                }}
              >
                Continue booking current equipment
              </Button>
              <Button
                className="w-full sm:flex-1"
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
              <DialogTitle>Transaction history — {userTransactionHistoryDialog.userDisplayName}</DialogTitle>
              <DialogDescription>
                Verify that the correct amount was debited from the user&apos;s wallet after the booking.
              </DialogDescription>
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
                      <TableHead className="font-semibold text-foreground w-[150px]">Date &amp; Time</TableHead>
                      <TableHead className="font-semibold text-foreground w-[90px]">Type</TableHead>
                      <TableHead className="font-semibold text-foreground min-w-[180px]">Description</TableHead>
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
                        <TableCell className="text-sm max-w-[280px]">
                          <span className="line-clamp-2" title={tx.description || ""}>{tx.description || "—"}</span>
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
                          {tx.balance_after != null && tx.balance_after !== "" ? `₹${Number(tx.balance_after).toFixed(2)}` : "—"}
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
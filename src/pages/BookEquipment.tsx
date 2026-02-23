import { useEffect, useState, useCallback, useRef } from "react";
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
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Check, Plus, Trash2 } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { periodicTableElements, getCategoryColor, type Element } from "@/data/periodicTableData";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format, addDays, startOfWeek, addWeeks, subWeeks, isSameDay, parseISO, startOfDay } from "date-fns";
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
  split_booking_enabled?: boolean;
  daily_slots?: DailySlot[];
  weekly_holidays?: Record<string, string>;
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
  { value: "RND", label: "Govt R&D Center" },
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
  BOOKED: "#fecaca",
  BLOCKED: "#e5e7eb",
  UNDER_MAINTENANCE: "#fed7aa",
  OPERATOR_ABSENT: "#fde68a",
};

const SLOT_STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Available",
  BOOKED: "Booked",
  BLOCKED: "Blocked",
  UNDER_MAINTENANCE: "Under Maintenance",
  OPERATOR_ABSENT: "Operator Absent",
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
  const [searchParams] = useSearchParams();
  const [loadingEquipmentDetail, setLoadingEquipmentDetail] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [equipmentDetail, setEquipmentDetail] = useState<EquipmentDetail | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userType, setUserType] = useState<string | number | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [selectedSlots, setSelectedSlots] = useState<TimeSlot[]>([]);
  const [inputFieldValues, setInputFieldValues] = useState<Record<string, string | boolean | string[] | number>>({});
  const [periodicTableFieldKey, setPeriodicTableFieldKey] = useState<string | null>(null);
  const [selectedPeriodicSymbols, setSelectedPeriodicSymbols] = useState<Set<string>>(new Set());
  const [chargeCalculated, setChargeCalculated] = useState(false);
  const [calculatedCharge, setCalculatedCharge] = useState<{
    total_charge: string;
    total_time_minutes: number;
    charge_breakdown: Array<{ description: string; amount: number }>;
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
  const [adminDiscountAmount, setAdminDiscountAmount] = useState<number>(0);
  const [adminDiscountReason, setAdminDiscountReason] = useState<string>("");
  const [adminBookForUserInfo, setAdminBookForUserInfo] = useState<{
    email: string;
    department_name: string;
    wallet_faculty_owner: { name: string; email: string } | null;
    wallet_balance: string;
  } | null>(null);
  const [usersList, setUsersList] = useState<Array<{ id: number; name?: string; email?: string; user_type?: string }>>([]);
  const [adminUserTypeFilter, setAdminUserTypeFilter] = useState<string>(USER_TYPE_FILTER_ALL);
  const [userComboboxOpen, setUserComboboxOpen] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [statusChangeWeekStart, setStatusChangeWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [statusChangeSlots, setStatusChangeSlots] = useState<DailySlot[] | null>(null);
  const [statusChangeSlotMasterTimes, setStatusChangeSlotMasterTimes] = useState<string[]>([]);
  const [statusChangeHolidays, setStatusChangeHolidays] = useState<Record<string, string>>({});
  const [loadingStatusSlots, setLoadingStatusSlots] = useState(false);
  const [selectedSlotIdsForStatus, setSelectedSlotIdsForStatus] = useState<number[]>([]);
  const [newSlotStatus, setNewSlotStatus] = useState<string>('BLOCKED');
  const [blockedLabelForStatus, setBlockedLabelForStatus] = useState<string>('');
  const [updatingSlotStatus, setUpdatingSlotStatus] = useState(false);
  const [bulkEmailOpen, setBulkEmailOpen] = useState(false);
  const [bulkEmailRecipients, setBulkEmailRecipients] = useState<Array<{ email: string; name: string }>>([]);
  const [bulkEmailSubject, setBulkEmailSubject] = useState("");
  const [bulkEmailBody, setBulkEmailBody] = useState("");
  const [sendingBulkEmail, setSendingBulkEmail] = useState(false);
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
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
  const fetchingSlotsRef = useRef<boolean>(false);
  const hasCheckedEmptyCurrentWeekRef = useRef<boolean>(false);
  const lastEquipmentIdRef = useRef<number | null>(null);

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
        const currentWeek = startOfWeek(now, { weekStartsOn: 0 });
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
          setCurrentWeekStart(startOfWeek(fifteenDaysFromNow, { weekStartsOn: 0 }));
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

  // Admin: fetch selected user's booking info (email, department, wallet owner, balance)
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

  // Admin: fetch slots for status-change mode (calendar view)
  const fetchStatusChangeSlots = useCallback(async () => {
    if (!selectedEquipment?.id || adminManageMode !== 'status') return;
    setLoadingStatusSlots(true);
    try {
      const weekStart = startOfWeek(statusChangeWeekStart, { weekStartsOn: 0 });
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
  }, [selectedEquipment?.id, adminManageMode, statusChangeWeekStart]);
  useEffect(() => {
    if (adminManageMode === 'status' && selectedEquipment?.id) fetchStatusChangeSlots();
  }, [adminManageMode, selectedEquipment?.id, statusChangeWeekStart, fetchStatusChangeSlots]);

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
      lastCalculatedValuesRef.current = ''; // Reset the hash
      fetchingSlotsRef.current = false; // Reset fetching flag
      
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
        image: eq.image_url || "/placeholder.svg",
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
  }, [inputFieldValues, selectedEquipment, equipmentDetail, loadingCharge, chargeCalculated, chargeCalculationFailed, calculateCharge, adminManageMode, adminBookForUserId]);

  // Fetch slots for the current week
  const fetchSlotsForWeek = useCallback(async () => {
    if (!selectedEquipment) return;
    
    // Prevent concurrent calls using ref
    if (fetchingSlotsRef.current || loadingSlots) {
      return;
    }

    const weekStart = startOfWeek(currentWeekStart, { weekStartsOn: 0 });
    const weekEnd = addDays(weekStart, 7);
    const startDateStr = format(weekStart, "yyyy-MM-dd");
    const endDateStr = format(weekEnd, "yyyy-MM-dd");
    
    // Check if we already fetched slots for this week
    const weekKey = `${startDateStr}_${endDateStr}`;
    if (lastFetchedWeek === weekKey) {
      return;
    }

    try {
      fetchingSlotsRef.current = true;
      setLoadingSlots(true);
      const slotsResponse = await apiClient.getEquipmentSlots(
        selectedEquipment.id,
        startDateStr,
        endDateStr
      );

      if (slotsResponse.data && slotsResponse.data.slots) {
        // Update equipmentDetail with fetched slots, holidays, and slot window (for calendar time axis)
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
          };
          if (JSON.stringify(currentSlots) === JSON.stringify(newSlots) && JSON.stringify(prev.weekly_holidays ?? {}) === JSON.stringify(newHolidays)) {
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
    const weekStart = startOfWeek(currentWeekStart, { weekStartsOn: 0 });
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

  // When current week has no available slots, switch to next week by default (once per flow)
  useEffect(() => {
    if (hasCheckedEmptyCurrentWeekRef.current || !userType || !equipmentDetail?.daily_slots || !lastFetchedWeek) {
      return;
    }
    const allowedWeeks = getAllowedWeeks();
    if (allowedWeeks.length < 2) return;

    const firstWeekStart = startOfWeek(allowedWeeks[0], { weekStartsOn: 0 });
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
    const currentWeek = startOfWeek(now, { weekStartsOn: 0 });
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
      setCurrentWeekStart(startOfWeek(fifteenDaysFromNow, { weekStartsOn: 0 }));
    }
  };


  const isSlotBooked = (date: Date, time: string): boolean => {
    const slotData = getSlotData(date, time);
    if (!slotData) return false;
    // Admin: only BOOKED status (or has booking_id) is considered booked; other statuses and past are selectable
    if (isAdminUser()) return slotData.status === "BOOKED" || !!slotData.booking_id;
    return slotData.status !== "AVAILABLE";
  };

  const isSlotSelected = (date: Date, time: string): boolean => {
    return selectedSlots.some(slot => 
      isSameDay(slot.date, date) && slot.time === time
    );
  };

  const getSlotData = (date: Date, time: string): DailySlot | undefined => {
    if (!equipmentDetail?.daily_slots) return undefined;
    
    const normalizedDate = startOfDay(date);
    const expectedDateStr = format(normalizedDate, "yyyy-MM-dd");
    
    return equipmentDetail.daily_slots.find(slot => {
      const slotDateStr = typeof slot.date === "string"
        ? (slot.date.includes("T") ? format(parseISO(slot.date), "yyyy-MM-dd") : slot.date)
        : "";
      const slotTime = slot.start_datetime
        ? format(parseISO(slot.start_datetime), "HH:mm")
        : "";
      return slotDateStr === expectedDateStr && slotTime === time;
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

  // Get unique time slots from daily_slots
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

  // Check if a week is allowed for the current user (admin can pick any week when booking for someone)
  const isWeekAllowed = (weekStart: Date): boolean => {
    if (isAdminUser()) return true;
    if (!userType) return false;
    
    const normalizedType = normalizeUserType(userType);
    if (!normalizedType) return false;
    
    const now = new Date();
    const currentWeek = startOfWeek(now, { weekStartsOn: 0 });
    const nextWeek = addWeeks(currentWeek, 1);
    
    // For other users: 15 days from current date, then one week window
    const fifteenDaysFromNow = addDays(now, 15);
    const allowedWeekStart = startOfWeek(fifteenDaysFromNow, { weekStartsOn: 0 });
    
    // Normalize week starts for comparison
    const weekStartNormalized = startOfWeek(weekStart, { weekStartsOn: 0 });
    const currentWeekNormalized = startOfWeek(currentWeek, { weekStartsOn: 0 });
    const nextWeekNormalized = startOfWeek(nextWeek, { weekStartsOn: 0 });
    const allowedWeekStartNormalized = startOfWeek(allowedWeekStart, { weekStartsOn: 0 });
    
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

  // Get allowed weeks for navigation (admin: any week, no restriction)
  const getAllowedWeeks = (): Date[] => {
    if (!userType) return [];
    if (isAdminUser()) {
      const now = new Date();
      const currentWeek = startOfWeek(now, { weekStartsOn: 0 });
      const weeks: Date[] = [];
      for (let i = -52; i <= 52; i++) {
        weeks.push(i === 0 ? currentWeek : i < 0 ? subWeeks(currentWeek, -i) : addWeeks(currentWeek, i));
      }
      return weeks;
    }
    const normalizedType = normalizeUserType(userType);
    if (!normalizedType) return [];
    const now = new Date();
    const currentWeek = startOfWeek(now, { weekStartsOn: 0 });
    const nextWeek = addWeeks(currentWeek, 1);
    const fifteenDaysFromNow = addDays(now, 15);
    const allowedWeekStart = startOfWeek(fifteenDaysFromNow, { weekStartsOn: 0 });
    if (normalizedType === 'student' || normalizedType === 'faculty') {
      return [currentWeek, nextWeek];
    }
    return [allowedWeekStart];
  };

  const goToPreviousWeek = () => {
    const allowedWeeks = getAllowedWeeks();
    const currentIndex = allowedWeeks.findIndex(week => 
      startOfWeek(week, { weekStartsOn: 0 }).getTime() === startOfWeek(currentWeekStart, { weekStartsOn: 0 }).getTime()
    );
    
    if (currentIndex > 0) {
      setCurrentWeekStart(allowedWeeks[currentIndex - 1]);
      setSelectedSlots([]);
    }
  };

  const goToNextWeek = () => {
    const allowedWeeks = getAllowedWeeks();
    const currentIndex = allowedWeeks.findIndex(week => 
      startOfWeek(week, { weekStartsOn: 0 }).getTime() === startOfWeek(currentWeekStart, { weekStartsOn: 0 }).getTime()
    );
    
    if (currentIndex < allowedWeeks.length - 1) {
      setCurrentWeekStart(allowedWeeks[currentIndex + 1]);
      setSelectedSlots([]);
    }
  };

  const canGoToPreviousWeek = (): boolean => {
    const allowedWeeks = getAllowedWeeks();
    const currentIndex = allowedWeeks.findIndex(week => 
      startOfWeek(week, { weekStartsOn: 0 }).getTime() === startOfWeek(currentWeekStart, { weekStartsOn: 0 }).getTime()
    );
    return currentIndex > 0;
  };

  const canGoToNextWeek = (): boolean => {
    const allowedWeeks = getAllowedWeeks();
    const currentIndex = allowedWeeks.findIndex(week => 
      startOfWeek(week, { weekStartsOn: 0 }).getTime() === startOfWeek(currentWeekStart, { weekStartsOn: 0 }).getTime()
    );
    return currentIndex < allowedWeeks.length - 1;
  };

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

    const firstWeekStart = startOfWeek(allowedWeeks[0], { weekStartsOn: 0 });
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

      // Single booking via slot_ids (one API call, one entry in My Bookings)
      const slotIds = selectedSlots
        .map((s) => s.slotData?.id)
        .filter((id): id is number => typeof id === "number");
      const canUseSlotIds = slotIds.length === selectedSlots.length && slotIds.length > 0;

      if (canUseSlotIds) {
        const totalHours = calculatedCharge ? calculatedCharge.total_time_minutes / 60 : 0;
        const totalCost = calculatedCharge ? Number(calculatedCharge.total_charge) : 0;
        const res = await apiClient.bookEquipment(selectedEquipment.id, {
          slot_ids: slotIds,
          total_hours: totalHours,
          total_cost: totalCost,
          status: "pending",
          input_values: inputFieldValues,
          ...(isAdminUser() && adminBookForUserId ? { user_id: Number(adminBookForUserId) } : {}),
          ...(isAdminUser() && adminDiscountAmount > 0 ? { discount_amount: adminDiscountAmount } : {}),
          ...(isAdminUser() && adminDiscountAmount > 0 && adminDiscountReason.trim() ? { discount_reason: adminDiscountReason.trim() } : {}),
        });
        if (res.error) throw new Error(res.error);
        // Real-time update: merge returned slots into equipment detail so grid shows booked state immediately
        const updatedSlots = (res as { daily_slots?: DailySlot[] }).daily_slots;
        if (equipmentDetail && updatedSlots && Array.isArray(updatedSlots) && updatedSlots.length > 0) {
          const byId = new Map((equipmentDetail.daily_slots || []).map((s) => [s.id, s]));
          updatedSlots.forEach((s) => byId.set(s.id, s));
          setEquipmentDetail({
            ...equipmentDetail,
            daily_slots: Array.from(byId.values()).sort((a, b) => (a.id ?? 0) - (b.id ?? 0)),
          });
        }
        setSelectedSlots([]);
        toast.success("Booking created successfully!");
        navigate("/my-bookings");
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
        });
      });

      const results = await Promise.all(bookingPromises);
      const errors = results.filter((r): r is typeof r & { error: string } => !!r.error);

      if (errors.length > 0) {
        const message = errors[0].error || "Failed to create some bookings";
        throw new Error(message);
      }

      toast.success(`${bookings.length} booking(s) created successfully!`);
      navigate("/my-bookings");
    } catch (error: any) {
      toast.error(error.message || "Failed to create booking");
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  if (!selectedEquipment || !equipmentDetail) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20">
        <DashboardHeader />
        <main className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">No equipment selected for booking</p>
              <Button onClick={() => navigate('/equipments')}>
                Browse Equipment
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20 relative">
      {loadingEquipmentDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-lg flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="text-sm text-muted-foreground">Loading equipment details...</p>
          </div>
        </div>
      )}
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">
          {isAdminUser() ? "Manage" : "Book"} {selectedEquipment.name}
        </h1>

        {/* Admin: mode selector (Manage this Equipment) */}
        {isAdminUser() && adminManageMode === null && (
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

        {/* Admin: slot status change UI */}
        {isAdminUser() && adminManageMode === 'status' && selectedEquipment && (
          <Card className="max-w-6xl mx-auto mb-8">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Change slot status</CardTitle>
                <Button variant="outline" size="sm" onClick={() => { setAdminManageMode(null); setSelectedSlotIdsForStatus([]); }}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </div>
              <CardDescription>
                Select slots in the calendar below, then choose the new status and click Update. For Blocked, Under Maintenance, or Operator Absent you may also select booked slots; those bookings will be cancelled, users notified, and refunds issued automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Week navigation and Select All */}
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setStatusChangeWeekStart(prev => addWeeks(prev, -1))}>
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Previous Week
                  </Button>
                  <span className="font-semibold min-w-[200px] text-center">
                    {format(statusChangeWeekStart, "MMM dd")} – {format(addDays(statusChangeWeekStart, 6), "MMM dd, yyyy")}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setStatusChangeWeekStart(prev => addWeeks(prev, 1))}>
                    Next Week
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
                {statusChangeSlots && statusChangeSlots.length > 0 && (() => {
                  const canSelectBooked =
                    newSlotStatus === "BLOCKED" ||
                    newSlotStatus === "UNDER_MAINTENANCE" ||
                    newSlotStatus === "OPERATOR_ABSENT";
                  const availableSlotIds = statusChangeSlots.filter((s) => s.status === "AVAILABLE").map((s) => s.id);
                  const bookableSlotIds = canSelectBooked
                    ? statusChangeSlots
                        .filter(
                          (s) =>
                            s.status === "AVAILABLE" ||
                            (s.status === "BOOKED" && (s.booking_status || "").toUpperCase() !== "COMPLETED")
                        )
                        .map((s) => s.id)
                    : availableSlotIds;
                  const bookedOnlySlotIds = statusChangeSlots
                    .filter(
                      (s) =>
                        s.status === "BOOKED" && (s.booking_status || "").toUpperCase() !== "COMPLETED"
                    )
                    .map((s) => s.id);
                  return (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedSlotIdsForStatus(bookableSlotIds)}
                        disabled={bookableSlotIds.length === 0}
                      >
                        {canSelectBooked ? `Select All Available & Booked (${bookableSlotIds.length})` : `Select All Available (${availableSlotIds.length})`}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedSlotIdsForStatus(bookedOnlySlotIds)}
                        disabled={bookedOnlySlotIds.length === 0}
                      >
                        Select All Booked ({bookedOnlySlotIds.length})
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedSlotIdsForStatus([])}
                        disabled={selectedSlotIdsForStatus.length === 0}
                      >
                        Deselect All
                      </Button>
                    </div>
                  );
                })()}
              </div>

              {/* Slot status colors - color picker per status */}
              <div className="mb-4 p-3 rounded-lg border bg-muted/30">
                <p className="text-sm font-medium mb-2">Slot status colors</p>
                <div className="flex flex-wrap items-center gap-4">
                  {(Object.keys(DEFAULT_SLOT_STATUS_COLORS) as (keyof typeof DEFAULT_SLOT_STATUS_COLORS)[]).map((status) => (
                    <div key={status} className="flex items-center gap-2">
                      <label className="text-xs text-muted-foreground w-32">{SLOT_STATUS_LABELS[status] ?? status}</label>
                      <input
                        type="color"
                        value={statusChangeSlotColors[status] ?? DEFAULT_SLOT_STATUS_COLORS[status]}
                        onChange={(e) => setStatusChangeSlotColor(status, e.target.value)}
                        className="h-8 w-12 cursor-pointer rounded border border-input bg-background"
                        title={`Color for ${SLOT_STATUS_LABELS[status] ?? status}`}
                      />
                      <span className="text-xs text-muted-foreground font-mono">
                        {statusChangeSlotColors[status] ?? DEFAULT_SLOT_STATUS_COLORS[status]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {loadingStatusSlots ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <span className="animate-pulse">Loading slots for this week…</span>
                </div>
              ) : (
                <>
                  {/* Calendar grid - same layout as Step 3 */}
                  <div className="overflow-x-auto">
                    <div className="min-w-[800px]">
                      <div className="grid grid-cols-8 gap-2 mb-2">
                        <div className="font-semibold text-sm p-2">Time</div>
                        {[0, 1, 2, 3, 4, 5, 6].map((dayOffset) => {
                          const day = addDays(statusChangeWeekStart, dayOffset);
                          const dateStr = format(day, "yyyy-MM-dd");
                          const holidayLabel = statusChangeHolidays[dateStr];
                          return (
                            <div key={dayOffset} className="font-semibold text-sm p-2 text-center">
                              <div>{format(day, "EEE")}</div>
                              <div className="text-muted-foreground">{format(day, "MMM dd")}</div>
                              {holidayLabel && <div className="text-xs text-muted-foreground">{holidayLabel}</div>}
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
                        if (timeSlots.length === 0) {
                          return (
                            <div className="p-4 text-center text-muted-foreground col-span-8">
                              No slots for this week.
                            </div>
                          );
                        }

                        const statusLabel = (slot: DailySlot) => {
                          if (slot.status === "BOOKED") return slot.booking_status_display || "Booked";
                          if (slot.status === "BLOCKED") return slot.blocked_label || "Blocked";
                          return slot.status_display || slot.status || "—";
                        };

                        const canSelectBookedSlots =
                          newSlotStatus === "BLOCKED" ||
                          newSlotStatus === "UNDER_MAINTENANCE" ||
                          newSlotStatus === "OPERATOR_ABSENT";
                        // Only AVAILABLE and non-completed BOOKED slots are selectable (exclude BLOCKED, UNDER_MAINTENANCE, OPERATOR_ABSENT, and COMPLETED bookings)
                        const isSlotSelectable = (s: typeof statusChangeSlots[0] | null | undefined) => {
                          if (!s) return false;
                          if (canSelectBookedSlots) {
                            if (s.status === "AVAILABLE") return true;
                            if (s.status === "BOOKED") return (s.booking_status || "").toUpperCase() !== "COMPLETED";
                            return false;
                          }
                          return s.status === "AVAILABLE";
                        };
                        return timeSlots.map((time) => (
                          <div key={time} className="grid grid-cols-8 gap-2 mb-2">
                            <div className="font-medium text-sm p-2 flex items-center">{time}</div>
                            {[0, 1, 2, 3, 4, 5, 6].map((dayOffset) => {
                              const day = addDays(statusChangeWeekStart, dayOffset);
                              const slot = getStatusChangeSlotAt(day, time);
                              const slotSelectable = isSlotSelectable(slot);
                              const isSelected = slot ? selectedSlotIdsForStatus.includes(slot.id) : false;
                              const dateStr = format(day, "yyyy-MM-dd");
                              const holidayName = statusChangeHolidays[dateStr];

                              return (
                                <div key={dayOffset} className="min-h-[48px]">
                                  {slot ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (!slotSelectable) return;
                                        toggleStatusChangeSlotSelection(slot.id);
                                      }}
                                      disabled={!slotSelectable}
                                      className={`
                                        w-full p-3 rounded-md text-sm text-left transition-all min-h-[48px] flex items-center justify-center
                                        ${!slotSelectable ? "cursor-not-allowed" : ""}
                                        ${slotSelectable && isSelected ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2" : ""}
                                        ${slotSelectable && !isSelected ? "hover:opacity-90 border cursor-pointer" : ""}
                                      `}
                                      style={
                                        !isSelected && slot
                                          ? (() => {
                                              const bg = statusChangeSlotColors[slot.status] ?? DEFAULT_SLOT_STATUS_COLORS[slot.status] ?? "#e5e7eb";
                                              return {
                                                backgroundColor: bg,
                                                color: getContrastTextColor(bg),
                                              };
                                            })()
                                          : undefined
                                      }
                                    >
                                      {isSelected ? "Selected" : (holidayName && !slot.booking_id ? holidayName : statusLabel(slot))}
                                    </button>
                                  ) : (
                                    <div className="w-full p-3 rounded-md text-sm min-h-[48px] flex items-center justify-center bg-gray-100 text-gray-400">
                                      —
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ));
                      })()}
                    </div>
                  </div>

                  {/* Actions: new status + update */}
                  <div className="flex flex-wrap items-center gap-4 pt-4 border-t">
                    <Select value={newSlotStatus} onValueChange={setNewSlotStatus}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="New status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BLOCKED">Blocked</SelectItem>
                        <SelectItem value="UNDER_MAINTENANCE">Under Maintenance</SelectItem>
                        <SelectItem value="OPERATOR_ABSENT">Operator Absent</SelectItem>
                        <SelectItem value="AVAILABLE">Available</SelectItem>
                      </SelectContent>
                    </Select>
                    {newSlotStatus === "BLOCKED" && (
                      <Input
                        placeholder="Blocked label (optional)"
                        value={blockedLabelForStatus}
                        onChange={(e) => setBlockedLabelForStatus(e.target.value)}
                        className="max-w-[200px]"
                      />
                    )}
                    <Button
                      disabled={selectedSlotIdsForStatus.length === 0 || updatingSlotStatus}
                      onClick={async () => {
                        if (selectedSlotIdsForStatus.length === 0) return;
                        setUpdatingSlotStatus(true);
                        try {
                          const payload: { status: string; blocked_label?: string | null } = { status: newSlotStatus };
                          if (newSlotStatus === "BLOCKED") payload.blocked_label = blockedLabelForStatus.trim() || null;
                          for (const slotId of selectedSlotIdsForStatus) {
                            const res = await apiClient.adminUpdate("dailySlots", slotId, payload);
                            if ((res as { error?: string }).error) throw new Error((res as { error: string }).error);
                          }
                          toast.success(`Updated ${selectedSlotIdsForStatus.length} slot(s).`);
                          setSelectedSlotIdsForStatus([]);
                          fetchStatusChangeSlots();
                        } catch (e: unknown) {
                          toast.error(e instanceof Error ? e.message : "Failed to update slots");
                        } finally {
                          setUpdatingSlotStatus(false);
                        }
                      }}
                    >
                      {updatingSlotStatus ? "Updating…" : `Update selected slots (${selectedSlotIdsForStatus.length})`}
                    </Button>
                    {(() => {
                      const selectedBookedSlotIds =
                        statusChangeSlots?.filter(
                          (s) =>
                            selectedSlotIdsForStatus.includes(s.id) &&
                            s.status === "BOOKED" &&
                            (s.booking_status || "").toUpperCase() !== "COMPLETED"
                        ).map((s) => s.id) ?? [];
                      return (
                        <Button
                          variant="outline"
                          disabled={selectedBookedSlotIds.length === 0}
                          onClick={async () => {
                            if (selectedBookedSlotIds.length === 0) return;
                            const res = await apiClient.getBulkEmailRecipients(selectedBookedSlotIds);
                            if (res.error || !res.data?.recipients?.length) {
                              toast.error(res.error || "No recipients found for selected booked slots.");
                              return;
                            }
                            setBulkEmailRecipients(res.data.recipients);
                            setBulkEmailSubject("");
                            setBulkEmailBody("");
                            setBulkEmailOpen(true);
                          }}
                        >
                          Send Bulk Email ({selectedBookedSlotIds.length} booked)
                        </Button>
                      );
                    })()}
                  </div>

                  {/* Bulk email compose dialog */}
                  <Dialog open={bulkEmailOpen} onOpenChange={setBulkEmailOpen}>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Compose bulk email</DialogTitle>
                        <DialogDescription>
                          The same email will be sent to each recipient. Recipients are users of the selected booked slots.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">To</label>
                          <div className="rounded-md border bg-muted/40 p-3 text-sm">
                            {bulkEmailRecipients.length === 0
                              ? "No recipients"
                              : bulkEmailRecipients.map((r) => r.email).join(", ")}
                          </div>
                          {bulkEmailRecipients.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {bulkEmailRecipients.length} recipient(s)
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium" htmlFor="bulk-email-subject">Subject</label>
                          <Input
                            id="bulk-email-subject"
                            value={bulkEmailSubject}
                            onChange={(e) => setBulkEmailSubject(e.target.value)}
                            placeholder="Email subject"
                            className="w-full"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium" htmlFor="bulk-email-body">Body</label>
                          <textarea
                            id="bulk-email-body"
                            value={bulkEmailBody}
                            onChange={(e) => setBulkEmailBody(e.target.value)}
                            placeholder="Write your message..."
                            rows={12}
                            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y min-h-[200px]"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setBulkEmailOpen(false)} disabled={sendingBulkEmail}>
                          Cancel
                        </Button>
                        <Button
                          disabled={sendingBulkEmail || !bulkEmailSubject.trim() || !bulkEmailBody.trim() || bulkEmailRecipients.length === 0}
                          onClick={async () => {
                            setSendingBulkEmail(true);
                            try {
                              const emails = bulkEmailRecipients.map((r) => r.email);
                              const res = await apiClient.sendBulkEmail(emails, bulkEmailSubject.trim(), bulkEmailBody.trim());
                              if (res.error) {
                                toast.error(res.error);
                                return;
                              }
                              const data = res.data as { sent_count: number; failed_count: number; failed?: Array<{ email: string; error: string }> };
                              if (data.failed_count > 0 && data.failed?.length) {
                                toast.warning(`Sent to ${data.sent_count}; failed for ${data.failed_count}: ${data.failed.map((f) => f.email).join(", ")}`);
                              } else {
                                toast.success(`Email sent to ${data.sent_count} recipient(s).`);
                              }
                              setBulkEmailOpen(false);
                              setBulkEmailRecipients([]);
                              setBulkEmailSubject("");
                              setBulkEmailBody("");
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : "Failed to send email");
                            } finally {
                              setSendingBulkEmail(false);
                            }
                          }}
                        >
                          {sendingBulkEmail ? "Sending…" : "Send"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </>
              )}
            </CardContent>
          </Card>
        )}

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
                      // Navigate back to equipment detail page
                      navigate(`/equipment/${selectedEquipment.id}`);
                    }}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Admin: select user when booking on behalf (searchable + filter by type) */}
                {isAdminUser() && adminManageMode === 'book' && (
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
                                            setAdminDiscountAmount(0);
                                            setAdminDiscountReason("");
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
                        {adminBookForUserInfo && (
                          <div className="mt-3 p-3 rounded-lg border bg-muted/40 text-sm space-y-1.5">
                            <div><span className="font-medium text-muted-foreground">Email:</span> {adminBookForUserInfo.email || "—"}</div>
                            <div><span className="font-medium text-muted-foreground">Department:</span> {adminBookForUserInfo.department_name || "—"}</div>
                            <div>
                              <span className="font-medium text-muted-foreground">Associated Wallet Faculty Owner:</span>{" "}
                              {adminBookForUserInfo.wallet_faculty_owner
                                ? `${adminBookForUserInfo.wallet_faculty_owner.name}${adminBookForUserInfo.wallet_faculty_owner.email ? ` (${adminBookForUserInfo.wallet_faculty_owner.email})` : ""}`
                                : "—"}
                            </div>
                            <div><span className="font-medium text-muted-foreground">Wallet Balance:</span> ₹{adminBookForUserInfo.wallet_balance}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 1: Input Fields Section */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-4">Step 1: Provide Additional Information</h3>
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
                                    disabled={false}
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
                                  />
                                );
                              
                              case 'RADIO':
                                return (
                                  <RadioGroup
                                    value={inputFieldValues[field.field_key] as string || field.default_value || ''}
                                    onValueChange={(value) => handleInputFieldChange(field.field_key, value)}
                                    required={field.is_required}
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
                                    disabled={false}
                                  >
                                    <SelectTrigger id={field.field_key} className="w-full">
                                      <SelectValue placeholder={field.help_text || "Select an option"} />
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
                                      {field.help_text || field.field_label}
                                    </Label>
                                    <Switch
                                      id={field.field_key}
                                      checked={inputFieldValues[field.field_key] === true || inputFieldValues[field.field_key] === 'true'}
                                      onCheckedChange={(checked) => handleInputFieldChange(field.field_key, checked)}
                                      required={field.is_required}
                                    />
                                  </div>
                                );

                              case 'PERIODIC_TABLE':
                                const count = Number(inputFieldValues[field.field_key]) || 0;
                                const elementsStr = (inputFieldValues[field.field_key + '_elements'] as string) || '';
                                const elementsList = elementsStr ? elementsStr.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
                                return (
                                  <div className="space-y-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setPeriodicTableFieldKey(field.field_key);
                                        setSelectedPeriodicSymbols(
                                          new Set(elementsStr.split(',').map((s: string) => s.trim()).filter(Boolean))
                                        );
                                      }}
                                    >
                                      Select elements
                                    </Button>
                                    {count > 0 && (
                                      <p className="text-sm text-muted-foreground">
                                        {count} element(s) selected{elementsList.length ? `: ${elementsList.join(', ')}` : ''}
                                      </p>
                                    )}
                                  </div>
                                );

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
                              {field.help_text && (
                                <p className="text-xs text-muted-foreground">{field.help_text}</p>
                              )}
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
                        <p className="text-sm text-muted-foreground">
                          {selectedPeriodicSymbols.size} element(s) selected. Count is stored for charge calculation.
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
                                const toggle = (symbol: string) => {
                                  setSelectedPeriodicSymbols((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(symbol)) next.delete(symbol);
                                    else next.add(symbol);
                                    return next;
                                  });
                                };
                                return (
                                  <>
                                    {grid.map((row, ri) => (
                                      <div key={ri} className="flex gap-1">
                                        {row.map((el, ci) => (
                                          <div key={`${ri}-${ci}`}>
                                            {el ? (
                                              <button
                                                type="button"
                                                onClick={() => toggle(el.symbol)}
                                                title={el.name}
                                                className={cn(
                                                  "w-10 h-10 border-2 rounded flex flex-col items-center justify-center text-xs transition-all",
                                                  getCategoryColor(el.category),
                                                  selectedPeriodicSymbols.has(el.symbol) && "ring-2 ring-primary ring-offset-1 scale-105"
                                                )}
                                              >
                                                {selectedPeriodicSymbols.has(el.symbol) && <Check className="w-3 h-3 absolute top-0 right-0" />}
                                                <span className="font-bold">{el.symbol}</span>
                                              </button>
                                            ) : (
                                              <div className="w-10 h-10" />
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    ))}
                                    <div className="flex gap-1 mt-1">
                                      <div className="w-10 h-10 flex items-center justify-center text-xs font-semibold">Ln</div>
                                      {lanthanides.map((el) => (
                                        <button
                                          key={el.atomicNumber}
                                          type="button"
                                          onClick={() => toggle(el.symbol)}
                                          title={el.name}
                                          className={cn(
                                            "w-10 h-10 border-2 rounded flex flex-col items-center justify-center text-xs",
                                            getCategoryColor(el.category),
                                            selectedPeriodicSymbols.has(el.symbol) && "ring-2 ring-primary"
                                          )}
                                        >
                                          <span className="font-bold">{el.symbol}</span>
                                        </button>
                                      ))}
                                    </div>
                                    <div className="flex gap-1 mt-1">
                                      <div className="w-10 h-10 flex items-center justify-center text-xs font-semibold">Ac</div>
                                      {actinides.map((el) => (
                                        <button
                                          key={el.atomicNumber}
                                          type="button"
                                          onClick={() => toggle(el.symbol)}
                                          title={el.name}
                                          className={cn(
                                            "w-10 h-10 border-2 rounded flex flex-col items-center justify-center text-xs",
                                            getCategoryColor(el.category),
                                            selectedPeriodicSymbols.has(el.symbol) && "ring-2 ring-primary"
                                          )}
                                        >
                                          <span className="font-bold">{el.symbol}</span>
                                        </button>
                                      ))}
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setPeriodicTableFieldKey(null)}>Cancel</Button>
                        <Button
                          onClick={() => {
                            if (periodicTableFieldKey) {
                              handleInputFieldChange(periodicTableFieldKey, selectedPeriodicSymbols.size);
                              handleInputFieldChange(periodicTableFieldKey + "_elements", Array.from(selectedPeriodicSymbols).join(","));
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
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Total Time:</span>
                        <span className="text-sm">
                          {Math.floor(calculatedCharge.total_time_minutes / 60)}h {calculatedCharge.total_time_minutes % 60}m
                        </span>
                      </div>
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
                      {isAdminUser() && adminManageMode === "book" && (
                        <div className="mt-4 p-3 rounded-lg border bg-muted/30 space-y-2">
                          <Label htmlFor="admin-discount" className="text-sm font-medium">Discount (₹)</Label>
                          <p className="text-xs text-muted-foreground">Adjust the final charge for this booking. Discount is applied when you confirm (single booking).</p>
                          <Input
                            id="admin-discount"
                            type="number"
                            min={0}
                            step={0.01}
                            value={adminDiscountAmount === 0 ? "" : adminDiscountAmount}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v === "") setAdminDiscountAmount(0);
                              else {
                                const n = parseFloat(v);
                                if (!Number.isNaN(n) && n >= 0) setAdminDiscountAmount(n);
                              }
                            }}
                            placeholder="0"
                            className="max-w-[140px]"
                          />
                          {adminDiscountAmount > 0 && (
                            <div className="space-y-1.5">
                              <Label htmlFor="admin-discount-reason" className="text-sm font-medium">Reason for discount (optional)</Label>
                              <Textarea
                                id="admin-discount-reason"
                                value={adminDiscountReason}
                                onChange={(e) => setAdminDiscountReason(e.target.value)}
                                placeholder="e.g. Promotional offer, damaged sample, collaboration discount"
                                rows={2}
                                className="resize-none"
                              />
                            </div>
                          )}
                          <div className="flex justify-between text-sm text-muted-foreground">
                            <span>Original:</span>
                            <span>₹{Number(calculatedCharge.total_charge).toFixed(2)}</span>
                          </div>
                          {adminDiscountAmount > 0 && (
                            <>
                              <div className="flex justify-between text-sm text-muted-foreground">
                                <span>Discount:</span>
                                <span>-₹{adminDiscountAmount.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between items-center pt-2 border-t">
                                <span className="font-medium">Final charge:</span>
                                <span className="font-bold text-primary">
                                  ₹{Math.max(0, Number(calculatedCharge.total_charge) - adminDiscountAmount).toFixed(2)}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-4 border-t">
                        <span className="text-lg font-semibold">Total Charge:</span>
                        <span className="text-2xl font-bold text-primary">
                          ₹{isAdminUser() && adminManageMode === "book" && adminDiscountAmount > 0
                            ? Math.max(0, Number(calculatedCharge.total_charge) - adminDiscountAmount).toFixed(2)
                            : Number(calculatedCharge.total_charge).toFixed(2)}
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
                    {userType && !isAdminUser() && (normalizeUserType(userType) === 'student' || normalizeUserType(userType) === 'faculty') && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Available: Current week and next week only
                      </p>
                    )}
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

                {/* Slot Grid */}
                <div className="overflow-x-auto">
                  <div className="min-w-[800px]">
                    {/* Header with days */}
                    <div className="grid grid-cols-8 gap-2 mb-2">
                      <div className="font-semibold text-sm p-2">Time</div>
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
                      // First priority: Slot Master open_time values directly from API (exact user-defined times)
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
                      const slotsToDisplay = timeSlots.length > 0 ? timeSlots : DEFAULT_TIME_SLOTS;
                      const hasSlotsFromApi = (equipmentDetail?.daily_slots?.length ?? 0) > 0;
                      const fetchedButEmpty = !loadingSlots && lastFetchedWeek && !hasSlotsFromApi;

                      if (slotsToDisplay.length === 0) {
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
                        return (
                          <div className="col-span-8 p-4 text-center text-muted-foreground">
                            <p>No slots available for this week.</p>
                            <p className="text-xs mt-2">Try another week using the buttons above, or contact support if the issue continues.</p>
                          </div>
                        );
                      }
                      
                      return slotsToDisplay.map((time) => (
                      <div key={time} className="grid grid-cols-8 gap-2 mb-2">
                        <div className="text-sm p-2 font-medium flex items-center">
                          {time}
                        </div>
                        {[0, 1, 2, 3, 4, 5, 6].map((dayOffset) => {
                          const day = addDays(currentWeekStart, dayOffset);
                          const isBooked = isSlotBooked(day, time);
                          const isSelected = isSlotSelected(day, time);
                          
                          // Parse time to get hours and minutes
                          const [hours, minutes] = time.split(':').map(Number);
                          const slotDateTime = new Date(day);
                          slotDateTime.setHours(hours, minutes || 0, 0, 0);
                          const isPast = slotDateTime < new Date();
                          
                          // Check if slot exists in daily_slots for this day and time
                          const slotData = useWeeklySlots() ? getSlotData(day, time) : undefined;
                          const slotExists = slotData !== undefined;
                          const isAvailable = slotExists && !isBooked && !isPast;
                          
                          // Get slot status from the actual slot data; prefer booking status if booking exists, else slot status (never empty when slot exists)
                          const slotStatus = slotData?.status ?? "";
                          const isSlotBookedStatus = slotStatus !== "" && slotStatus !== "AVAILABLE";
                          const dateStr = format(day, "yyyy-MM-dd");
                          const holidayName = equipmentDetail?.weekly_holidays?.[dateStr];
                          const bookingStatusDisplay = slotData?.booking_status_display ?? null;
                          const bookingId = slotData?.booking_id ?? null;
                          // Admin: only BOOKED slots are non-selectable; other statuses (BLOCKED, weekend/holiday) are bookable
                          const isActuallyBooked = (slotStatus === "BOOKED" || !!bookingId);
                          const considerBooked = isAdminUser() ? isActuallyBooked : (isSlotBookedStatus || isBooked || !!bookingId);
                          const blockedLabel = slotData?.blocked_label ?? null;
                          
                          // Build status label with special handling for BLOCKED and BOOKED
                          let rawSlotStatusLabel = slotData?.status_display || "";
                          if (!rawSlotStatusLabel && slotStatus) {
                            const statusMap: Record<string, string> = {
                              "AVAILABLE": "Available",
                              "BOOKED": "Booked",
                              "BLOCKED": "Blocked",
                              "UNDER_MAINTENANCE": "Under Maintenance",
                              "OPERATOR_ABSENT": "Operator Absent"
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
                            } else if (isPast && !isAdminUser()) {
                              displayStatus = slotDisplayLabel || slotStatusLabel || "Available";
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
                                p-3 rounded-md text-sm transition-all min-h-[48px] flex items-center justify-center
                                ${!slotExists ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}
                                ${considerBooked ? 'bg-destructive/20 text-destructive cursor-not-allowed' : ''}
                                ${isPast && !considerBooked && slotExists && !isAdminUser() ? 'bg-muted text-muted-foreground cursor-not-allowed' : ''}
                                ${isSelected ? 'bg-primary text-primary-foreground' : ''}
                                ${(isAvailable || (isAdminUser() && slotExists && !considerBooked)) && !isSelected && !isDisabled ? 'bg-green-100 hover:bg-green-200 text-green-800 cursor-pointer' : ''}
                                ${(isAvailable || (isAdminUser() && slotExists && !considerBooked)) && !isSelected && isDisabled ? 'bg-green-100 text-green-800 cursor-not-allowed opacity-60' : ''}
                              `}
                            >
                              {displayStatus}
                            </button>
                          );
                        })}
                      </div>
                      ));
                    })()}
                  </div>
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
                            ₹{calculatedCharge
                              ? (isAdminUser() && adminManageMode === "book" && adminDiscountAmount > 0
                                ? Math.max(0, Number(calculatedCharge.total_charge) - adminDiscountAmount).toFixed(2)
                                : Number(calculatedCharge.total_charge).toFixed(2))
                              : calculateTotalCost().toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="mt-6 flex gap-4">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setSelectedSlots([])}
                        disabled={selectedSlots.length === 0}
                      >
                        Clear Selection
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={handleBooking}
                        disabled={selectedSlots.length === 0 || isSubmittingBooking}
                      >
                        {isSubmittingBooking ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Confirming…
                          </>
                        ) : (
                          <>Confirm Booking ({selectedSlots.length} slot{selectedSlots.length !== 1 ? 's' : ''})</>
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};

export default BookEquipment;
import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { normalizeUserTypeCode } from "@/lib/userTypes";
import { setPostLoginRedirect } from "@/lib/authRedirect";
import {
  classifyEquipmentAccessFailure,
  notifyEquipmentAccessFailure,
} from "@/lib/equipmentAccess";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ChevronLeft,
  ChevronRight,
  LifeBuoy,
  MapPin,
  Info,
  Calendar,
  Wrench,
  Users,
  UserCog,
  FileText,
  IndianRupee,
  ExternalLink,
  BookOpen,
  FlaskConical,
  ClipboardList,
  LayoutGrid,
  CalendarClock,
  ScrollText,
  Download,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import BookEquipment from "@/pages/BookEquipment";
import { InPanelRoute } from "@/components/InPanelRouter";
import { Badge } from "@/components/ui/badge";
import UserProfile from "@/components/UserProfile";
import { format, startOfWeek, addWeeks, addDays, isSameDay, parseISO, startOfDay, endOfWeek } from "date-fns";
import DashboardHeader from "@/components/DashboardHeader";
import EquipmentDepartmentLabel from "@/components/EquipmentDepartmentLabel";
import EquipmentImage from "@/components/EquipmentImage";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { useEmbeddedMode } from "@/contexts/EmbeddedModeContext";
import { EquipmentAccessoriesSection } from "@/components/EquipmentAccessoriesSection";
import TicketForm from "@/components/TicketForm";
import { cn } from "@/lib/utils";
import { formatINR } from "@/lib/money";
import { buildChargeCategoryPresentation } from "@/lib/chargeCategoryPresentation";
import { buildChargeCategorySummaryRows } from "@/lib/chargeCategorySummary";
import {
  ChargeCategoryLegacyTable,
  ChargeCategoryMultiParamTable,
  ChargeCategorySimplifiedTable,
} from "@/components/ChargeCategoryRatesPanel";
import { exportEquipmentBrochurePdf, partitionSpecifications } from "@/lib/equipmentBrochurePdf";
import { DEFAULT_DEPARTMENT_NAME } from "@/lib/pdfLetterhead";

/** Return black or white for readable text on the given hex background. */
function getContrastTextColor(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  if (Number.isNaN(n)) return "#1f2937";
  const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#1f2937" : "#ffffff";
}

interface EquipmentProfile {
  equipment_id: number;
  code: string;
  name: string;
  description: string;
  profile_type: string;
  profile_type_display: string;
  status: string;
  status_display: string;
  location: string;
  google_maps_url?: string | null;
  internal_department_name?: string | null;
  internal_department_code?: string | null;
  important_instruction?: string | null;
  image_url: string;
  specifications: Array<{
    equipment_specification_id: number;
    spec_key: string;
    spec_value: string;
    created_at: string;
  }>;
  accessories: Array<any>;
  additional_accessories: Array<{
    equipment_additional_accessory_id: number;
    additional_accessory_name: string;
    additional_accessory_description: string;
    is_optional: boolean;
    is_enabled?: boolean;
    created_at: string;
  }>;
  daily_slots?: Array<{
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
  }>;
  operators?: Array<{
    equipment_operator_id: number;
    operator: number;
    operator_name: string;
    operator_email?: string | null;
    operator_phone?: string | null;
    operator_profile_picture?: string | null;
    created_at: string;
  }>;
  managers?: Array<{
    equipment_manager_id: number;
    manager: number;
    manager_name: string;
    manager_email?: string | null;
    manager_phone?: string | null;
    manager_profile_picture?: string | null;
    created_at: string;
  }>;
  publications?: Array<{
    equipment_publication_id: number;
    title: string;
    citation?: string;
    url?: string;
    doi?: string;
    year?: number | null;
    display_order?: number;
    created_at?: string;
  }>;
  publication_count?: number;
  /** When 'SLOT_ID', weekly grid shows slot number/name on vertical axis; when 'TIME', shows time. Admin/OIC always see TIME. */
  weekly_view_display?: 'TIME' | 'SLOT_ID';
}

type ContentPanel =
  | "general"
  | "specifications"
  | "sample_requirements"
  | "view_charges"
  | "calc_charges"
  | "publications"
  | "brochure"
  | "contact";

type SpecItem = {
  equipment_specification_id: number;
  spec_key: string;
  spec_value: string;
  created_at: string;
};

const EquipmentProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const embedded = useEmbeddedMode();
  const { isAuthenticated, user } = useAuth();
  const [equipment, setEquipment] = useState<EquipmentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePanel, setActivePanel] = useState<ContentPanel>("general");
  const [supportOpen, setSupportOpen] = useState(false);
  const [exportingBrochurePdf, setExportingBrochurePdf] = useState(false);
  const userType = user?.user_type ?? null;
  const userTypeNorm = normalizeUserTypeCode(userType);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [apiSlots, setApiSlots] = useState<Array<{
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
  }> | null>(null);
  const [weeklyHolidays, setWeeklyHolidays] = useState<Record<string, string | { label: string; color?: string }>>({});
  const [calendarColors, setCalendarColors] = useState<{
    slot_colors: Record<string, string>;
    holiday_default: string;
    saturday_color?: string;
    sunday_color?: string;
  } | null>(null);
  const [slotWindow, setSlotWindow] = useState<{
    slot_start_time: string | null;
    slot_end_time: string | null;
    slot_duration_minutes: number;
  }>({ slot_start_time: null, slot_end_time: null, slot_duration_minutes: 60 });
  const [slotMasterTimes, setSlotMasterTimes] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [lastFetchedWeek, setLastFetchedWeek] = useState<string | null>(null);
  const fetchingSlotsRef = useRef(false);
  const equipmentAccessBlockedRef = useRef(false);
  const authUserKey = isAuthenticated ? String(user?.id ?? "auth") : "anon";

  const fetchSlotsForWeek = useCallback(async (forceRefetch?: boolean) => {
    if (!equipment || !id || equipmentAccessBlockedRef.current) return;

    const weekStart = startOfWeek(currentWeekStart, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
    const startDateStr = format(weekStart, "yyyy-MM-dd");
    const endDateStr = format(weekEnd, "yyyy-MM-dd");
    const weekKey = `${startDateStr}_${endDateStr}`;

    if (!forceRefetch && fetchingSlotsRef.current) return;
    if (!forceRefetch && lastFetchedWeek === weekKey) return;

    try {
      fetchingSlotsRef.current = true;
      setLoadingSlots(true);
      const slotsResponse = await apiClient.getEquipmentSlots(id, startDateStr, endDateStr);
      if (slotsResponse.error) {
        const kind = classifyEquipmentAccessFailure(slotsResponse);
        if (kind === "forbidden" || kind === "not_found") {
          equipmentAccessBlockedRef.current = true;
          notifyEquipmentAccessFailure(kind, slotsResponse.error);
          setEquipment(null);
          navigate("/dashboard", { replace: true });
          return;
        }
        // Avoid infinite refetch: mark week as attempted even on soft failure.
        setLastFetchedWeek(weekKey);
        toast.error(slotsResponse.error || "Failed to load available slots", {
          id: "equipment-slots-error",
        });
        return;
      }
      if (slotsResponse.data) {
        setApiSlots(slotsResponse.data.slots || []);
        setWeeklyHolidays(slotsResponse.data.holidays ?? {});
        const d = slotsResponse.data;
        if (d.slot_start_time != null || d.slot_end_time != null || d.slot_duration_minutes != null) {
          setSlotWindow({
            slot_start_time: d.slot_start_time ?? null,
            slot_end_time: d.slot_end_time ?? null,
            slot_duration_minutes: d.slot_duration_minutes ?? 60,
          });
        }
        if (d.slot_master_times && Array.isArray(d.slot_master_times)) {
          setSlotMasterTimes(d.slot_master_times);
        }
        if (d.calendar_colors && typeof d.calendar_colors === "object") {
          setCalendarColors({
            slot_colors: d.calendar_colors.slot_colors || {},
            holiday_default: d.calendar_colors.holiday_default || "#f59e0b",
            saturday_color: d.calendar_colors.saturday_color,
            sunday_color: d.calendar_colors.sunday_color,
          });
        }
        setLastFetchedWeek(weekKey);
      } else {
        setLastFetchedWeek(weekKey);
      }
    } catch (error: any) {
      console.error("Error calling slots API:", error);
      setLastFetchedWeek(weekKey);
      toast.error("Failed to load available slots", { id: "equipment-slots-error" });
    } finally {
      setLoadingSlots(false);
      fetchingSlotsRef.current = false;
    }
  }, [equipment, id, currentWeekStart, lastFetchedWeek, navigate]);

  useEffect(() => {
    if (!id) return;
    // Re-validate access when auth identity changes (e.g. login as OIC after anonymous browse).
    equipmentAccessBlockedRef.current = false;
    setEquipment(null);
    setLastFetchedWeek(null);
    fetchEquipmentProfile();
  }, [id, authUserKey]);

  // Dashboard workspace keeps prior scroll after "View details"; reset so Book CTA is visible.
  useEffect(() => {
    const embedded = document.querySelector(".embedded-workspace") as HTMLElement | null;
    if (embedded) embedded.scrollTop = 0;
    window.scrollTo(0, 0);
  }, [id]);

  // Admin-only: true when user_type is admin (for "Manage this Equipment" label and visibility)
  const isAdminUser = (): boolean => userTypeNorm === "admin";

  const isLabInchargeUser = (): boolean => userTypeNorm === "operator";

  // Admin, OIC, Department Administrator: manage / book-for-user on this equipment.
  const canManageEquipment = (): boolean =>
    userTypeNorm === "admin" || userTypeNorm === "manager" || userTypeNorm === "dept_admin";

  /** Admin / OIC / Lab In-charge: change slot status (calendar holds). */
  const canChangeSlotStatus = (): boolean =>
    userTypeNorm === "admin" || userTypeNorm === "manager" || userTypeNorm === "operator";

  const isOicUser = (): boolean => userTypeNorm === "manager";

  // Check if user type is allowed to book equipment
  const canBookEquipment = (): boolean => {
    if (!userTypeNorm) return false;
    if (isAdminUser()) return true;
    const allowedStringTypes = [
      "student",
      "individual_student",
      "faculty",
      "external",
      "rnd",
      "industry",
      "institute",
      "startup_incubated_iitr",
      "external_startup_msme",
      "other",
    ];
    return allowedStringTypes.includes(userTypeNorm);
  };

  const isEquipmentOperational = (): boolean => {
    const st = String((equipment as any)?.status || "").trim().toUpperCase();
    return st === "ACTIVE" || st === "OPERATIONAL";
  };

  /** Show Create Booking / Book CTA in equipment menu. */
  const showCreateOrBookCta = (): boolean => {
    if (isLabInchargeUser() || userTypeNorm === "finance") return false;
    if (canManageEquipment() || isOicUser()) return true;
    if (canBookEquipment()) return true;
    return !isAuthenticated;
  };

  const handleBookOrManageClick = () => {
    if (!equipment) return;
    if (!canManageEquipment() && !isEquipmentOperational()) {
      toast.error("This equipment is not operational and cannot be booked.");
      return;
    }
    const t = String(userType ?? "").toLowerCase();
    const bookOnBehalf = t === "admin" || t === "manager" || t === "dept_admin";
    const bookingUrl = bookOnBehalf
      ? `/book-equipment?equipment_id=${equipment.equipment_id}&mode=book`
      : `/book-equipment?equipment_id=${equipment.equipment_id}`;
    if (!canManageEquipment() && !isAuthenticated) {
      setPostLoginRedirect(bookingUrl);
      navigate("/auth");
      return;
    }
    navigate(bookingUrl);
  };

  const handleChangeSlotStatusClick = () => {
    if (!equipment) return;
    navigate(`/book-equipment?equipment_id=${equipment.equipment_id}&mode=status`);
  };

  const handleCalculateChargesClick = () => {
    if (!equipment) return;
    setActivePanel("calc_charges");
  };

  const fetchEquipmentProfile = async () => {
    if (!id || equipmentAccessBlockedRef.current) return;

    try {
      setLoading(true);
      const response = await apiClient.getEquipmentDetailById(id);

      if (response.error) {
        const kind = classifyEquipmentAccessFailure(response);
        if (kind === "forbidden" || kind === "not_found") {
          equipmentAccessBlockedRef.current = true;
          notifyEquipmentAccessFailure(kind, response.error);
          setEquipment(null);
          navigate("/dashboard", { replace: true });
          return;
        }
        toast.error(response.error || "Failed to load equipment profile", {
          id: "equipment-profile-error",
        });
        navigate("/dashboard", { replace: true });
        return;
      }

      if (!response.data) {
        equipmentAccessBlockedRef.current = true;
        notifyEquipmentAccessFailure("not_found");
        setEquipment(null);
        navigate("/dashboard", { replace: true });
        return;
      }

      setEquipment(response.data);
      setLastFetchedWeek(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to load equipment profile", {
        id: "equipment-profile-error",
      });
      navigate("/dashboard", { replace: true });
    } finally {
      setLoading(false);
    }
  };

  /** Parse "HH:mm" or "HH:mm:ss" to total minutes from midnight. */
  const parseTimeToMinutes = (timeStr: string): number => {
    const parts = timeStr.trim().split(":");
    const h = parseInt(parts[0] || "0", 10);
    const m = parseInt(parts[1] || "0", 10);
    return h * 60 + m;
  };

  /** Build time slot labels from equipment window (user-defined slot_start_time, slot_end_time, slot_duration_minutes). */
  const getTimeSlotsFromEquipmentWindow = (): string[] => {
    const { slot_start_time, slot_end_time, slot_duration_minutes } = slotWindow;
    if (!slot_start_time || !slot_end_time || slot_duration_minutes <= 0) return [];
    const startM = parseTimeToMinutes(slot_start_time);
    const endM = parseTimeToMinutes(slot_end_time);
    if (endM <= startM) return [];
    const slots: string[] = [];
    for (let m = startM; m < endM; m += slot_duration_minutes) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      slots.push(`${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
    }
    return slots;
  };

  const getTimeSlotsFromDailySlots = (): string[] => {
    const slotsToUse = apiSlots;
    
    if (!slotsToUse || slotsToUse.length === 0) {
      return [];
    }
    
    const uniqueTimes = new Set<string>();
    slotsToUse.forEach(slot => {
      try {
        const startDate = parseISO(slot.start_datetime);
        uniqueTimes.add(format(startDate, "HH:mm"));
      } catch (error) {
        console.error("Error parsing slot time:", error, slot);
      }
    });
    
    return Array.from(uniqueTimes).sort();
  };

  /** Convert HH:mm:ss to HH:mm for display. */
  const formatTimeForDisplay = (timeStr: string): string => {
    return timeStr.substring(0, 5); // "09:30:00" -> "09:30"
  };

  const formatSlotRowTimeLabel = (startTimeKey: string, durationMinutes: number): string => {
    const start = startTimeKey.includes(":") ? startTimeKey.substring(0, 5) : startTimeKey;
    if (!start.includes(":")) return start;
    const parts = start.split(":");
    const startM = parseInt(parts[0] || "0", 10) * 60 + parseInt(parts[1] || "0", 10);
    const duration = Math.max(1, durationMinutes || 60);
    const endM = startM + duration;
    const endH = Math.floor(endM / 60) % 24;
    const endMin = endM % 60;
    const end = `${String(endH).padStart(2, "0")}:${String(endMin).padStart(2, "0")}`;
    return `${start} – ${end}`;
  };

  /** Admin, OIC, and Department Administrator always see time on the vertical axis. */
  const isAdminOrOIC = (): boolean =>
    userTypeNorm === "admin" || userTypeNorm === "manager" || userTypeNorm === "dept_admin";

  const getEffectiveWeeklyViewDisplay = (): "TIME" | "SLOT_ID" => {
    if (isAdminOrOIC()) return "TIME";
    return equipment?.weekly_view_display ?? "TIME";
  };

  /** Row keys and labels for weekly grid. TIME = show time on vertical axis; SLOT_ID = hide time and show slot position (1, 2, 3...). Admin/OIC always see TIME. */
  const getWeeklyRowKeysAndLabels = (): { key: string; label: string }[] => {
    const hideTime = getEffectiveWeeklyViewDisplay() === "SLOT_ID";
    const times = getTimeSlotsForGrid();
    const slotDuration = getSlotDuration() || slotWindow.slot_duration_minutes || 60;
    return times.map((t, index) => ({
      key: t,
      label: hideTime ? `Slot ${index + 1}` : formatSlotRowTimeLabel(t, slotDuration),
    }));
  };

  /** Time axis for the weekly grid: use Slot Master open_time values (user-defined), else derive from slots. */
  const getTimeSlotsForGrid = (): string[] => {
    // First priority: use Slot Master open_time values directly from API (exact user-defined times)
    if (slotMasterTimes.length > 0) {
      return slotMasterTimes.map(formatTimeForDisplay).sort();
    }
    // Second priority: actual slot start times from DailySlots (derived from Slot Masters)
    const fromSlots = getTimeSlotsFromDailySlots();
    if (fromSlots.length > 0) return fromSlots;
    // Fallback: window-based grid only if no Slot Master times available
    return getTimeSlotsFromEquipmentWindow();
  };

  const getSlotData = (date: Date, timeKey: string): {
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
  } | undefined => {
    if (!apiSlots || apiSlots.length === 0) return undefined;
    
    const normalizedDate = startOfDay(date);
    return apiSlots.find(slot => {
      const slotDate = startOfDay(parseISO(slot.date));
      const slotTime = format(parseISO(slot.start_datetime), "HH:mm");
      return isSameDay(slotDate, normalizedDate) && slotTime === timeKey;
    });
  };

  // Calculate slot duration: prefer user-defined from API, else from first slot
  const getSlotDuration = (): number => {
    if (slotWindow.slot_duration_minutes > 0) return slotWindow.slot_duration_minutes;
    if (apiSlots && apiSlots.length > 0) {
      const firstSlot = apiSlots[0];
      try {
        const startTime = parseISO(firstSlot.start_datetime);
        const endTime = parseISO(firstSlot.end_datetime);
        const diffMs = endTime.getTime() - startTime.getTime();
        const diffMinutes = Math.round(diffMs / (1000 * 60));
        return diffMinutes > 0 ? diffMinutes : 0;
      } catch (error) {
        console.error("Error calculating slot duration:", error);
      }
    }
    return 0;
  };


  const goToPreviousWeek = () => {
    setCurrentWeekStart((prev) => addWeeks(prev, -1));
  };

  const goToNextWeek = () => {
    setCurrentWeekStart((prev) => addWeeks(prev, 1));
  };

  // Fetch slots when equipment is set or week changes (mirrors Step 3 booking flow)
  useEffect(() => {
    if (!equipment || !id || equipmentAccessBlockedRef.current) return;
    fetchSlotsForWeek();
  }, [equipment, id, currentWeekStart, fetchSlotsForWeek]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!equipment) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Loading equipment…</h2>
          <p className="text-sm text-muted-foreground">If this persists, return to the dashboard.</p>
          <Button className="mt-4" variant="outline" onClick={() => {
            if (window.history.length > 1) navigate(-1);
            else navigate("/dashboard");
          }}>
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 via-background to-background dark:from-background">
      <DashboardHeader />
      <main className={cn("flex-1 container mx-auto", embedded ? "px-2 py-3 sm:px-3" : "px-4 py-8")}>

        {(() => {
          const { sample: sampleSpecs, general: generalSpecs } =
            partitionSpecifications(equipment.specifications);
          const publicationList = Array.isArray(equipment.publications) ? equipment.publications : [];
          const publicationCount =
            typeof equipment.publication_count === "number"
              ? equipment.publication_count
              : publicationList.length;
          const panelMeta: Record<ContentPanel, { title: string; icon: JSX.Element }> = {
            general: { title: "General information", icon: <Info className="h-5 w-5" /> },
            specifications: { title: "Technical specifications", icon: <FileText className="h-5 w-5" /> },
            sample_requirements: { title: "Sample requirements", icon: <FlaskConical className="h-5 w-5" /> },
            view_charges: { title: "View charges", icon: <IndianRupee className="h-5 w-5" /> },
            calc_charges: { title: "Calculate charges", icon: <IndianRupee className="h-5 w-5" /> },
            publications: {
              title:
                publicationCount > 0
                  ? `Publications (${publicationCount})`
                  : "Publications",
              icon: <BookOpen className="h-5 w-5" />,
            },
            brochure: {
              title: "Equipment brochure",
              icon: <ScrollText className="h-5 w-5" />,
            },
            contact: {
              title: "Contact us",
              icon: <UserCog className="h-5 w-5" />,
            },
          };

          const navBtn = (
            key: string,
            label: string,
            opts: {
              icon: JSX.Element;
              onClick: () => void;
              active?: boolean;
              variant?: "action" | "panel" | "primary";
              disabled?: boolean;
            }
          ) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={opts.active || opts.variant === "primary" ? "default" : "outline"}
              disabled={opts.disabled}
              className={cn(
              "w-full max-w-full justify-start gap-2 h-auto min-h-11 lg:min-h-0 py-2.5 lg:py-1.5 px-2.5 text-sm font-medium whitespace-normal text-left leading-snug rounded-md",
                opts.active && "shadow-sm",
                opts.variant === "primary" &&
                  !opts.active &&
                  "bg-primary text-primary-foreground hover:bg-primary/90 border-primary shadow-sm shadow-primary/20",
                opts.variant === "action" &&
                  !opts.active &&
                  "border-primary/25 bg-primary/[0.04] hover:bg-primary/10"
              )}
              onClick={opts.onClick}
            >
              <span className="shrink-0 opacity-90 [&_svg]:h-3.5 [&_svg]:w-3.5">{opts.icon}</span>
              <span className="leading-tight break-words">{label}</span>
            </Button>
          );

          const emptyPanel = (message: string) => (
            <div className="rounded-xl border border-dashed bg-muted/30 px-6 py-12 text-center">
              <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed">{message}</p>
            </div>
          );

          const renderSpecBlocks = (specs: SpecItem[]) => (
            <div className="space-y-6">
              {specs.map((spec) => (
                <div
                  key={spec.equipment_specification_id}
                  className="rounded-xl border bg-muted/20 px-5 py-5 sm:px-7 sm:py-6"
                >
                  <h3 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground mb-3">
                    {spec.spec_key}
                  </h3>
                  <p className="text-lg sm:text-xl text-foreground/90 whitespace-pre-line leading-relaxed">
                    {spec.spec_value}
                  </p>
                </div>
              ))}
            </div>
          );

          const renderContactCards = (
            entries: Array<{
              key: number;
              name?: string | null;
              email?: string | null;
              phone?: string | null;
              profilePicture?: string | null;
              userId?: number | null;
            }>
          ) => (
            <div className="space-y-5">
              {entries.map((entry) => (
                <div
                  key={entry.key}
                  className="rounded-xl border bg-muted/20 px-5 py-5 sm:px-7 sm:py-6"
                >
                  <UserProfile
                    name={entry.name}
                    email={entry.email}
                    phone={entry.phone}
                    profilePicture={
                      entry.profilePicture && entry.userId != null
                        ? apiClient.getProfilePictureUrl(entry.userId)
                        : undefined
                    }
                    size="lg"
                    className="[&_p]:text-xl sm:[&_p]:text-2xl [&_span]:text-base sm:[&_span]:text-lg gap-4"
                  />
                </div>
              ))}
            </div>
          );

          let panelBody: JSX.Element | null = null;
          if (activePanel === "general") {
            panelBody = (
              <div className="space-y-6">
                <div className="relative aspect-video rounded-xl overflow-hidden bg-muted ring-1 ring-border/50">
                  <EquipmentImage
                    equipmentId={equipment.equipment_id}
                    enabled
                    alt={equipment.name}
                    className="w-full h-full object-contain"
                  />
                </div>
                {equipment.important_instruction ? (
                  <div className="rounded-xl border-2 border-amber-500/70 bg-gradient-to-br from-amber-50 to-orange-50/80 dark:from-amber-950/40 dark:to-orange-950/20 dark:border-amber-500/50 p-5 sm:p-6">
                    <p className="text-lg sm:text-xl font-semibold text-amber-900 dark:text-amber-200 mb-2 flex items-center gap-2">
                      <Info className="h-5 w-5 shrink-0" />
                      Important instruction
                    </p>
                    <p className="text-base sm:text-lg text-amber-950/90 dark:text-amber-100/90 whitespace-pre-line leading-relaxed">
                      {equipment.important_instruction}
                    </p>
                  </div>
                ) : null}
                {equipment.description ? (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      About this instrument
                    </p>
                    <p className="text-lg sm:text-xl text-foreground/90 whitespace-pre-line leading-relaxed">
                      {equipment.description}
                    </p>
                  </div>
                ) : (
                  emptyPanel("No general description has been published for this instrument yet.")
                )}
                {(equipment.accessories?.length ?? 0) > 0 || (equipment.additional_accessories?.length ?? 0) > 0 ? (
                <div className="rounded-xl ring-1 ring-border/60 bg-card overflow-hidden">
                  <div className="px-5 pt-4 pb-1 flex items-center gap-2 text-base font-semibold text-foreground">
                    <Wrench className="h-4 w-4 text-primary" />
                    Accessories
                  </div>
                  <div className="px-2 pb-2">
                    <EquipmentAccessoriesSection
                      accessories={(equipment.accessories || []).map((accessory: any, index: number) => ({
                        id: accessory.equipment_accessory_id ?? `acc-${index}`,
                        name:
                          accessory.accessory_name ||
                          accessory.name ||
                          `Accessory ${index + 1}`,
                        description: accessory.notes || accessory.description || accessory.accessory_description || null,
                        isEnabled: accessory.is_enabled !== false,
                      }))}
                      additionalAccessories={(equipment.additional_accessories || []).map((accessory) => ({
                        id: accessory.equipment_additional_accessory_id,
                        name: accessory.additional_accessory_name,
                        description: accessory.additional_accessory_description,
                        isEnabled: (accessory as { is_enabled?: boolean }).is_enabled !== false,
                      }))}
                    />
                  </div>
                </div>
                ) : null}
              </div>
            );
          } else if (activePanel === "specifications") {
            panelBody =
              generalSpecs.length > 0
                ? renderSpecBlocks(generalSpecs)
                : emptyPanel("Specifications have not been published for this instrument yet.");
          } else if (activePanel === "sample_requirements") {
            panelBody =
              sampleSpecs.length > 0
                ? renderSpecBlocks(sampleSpecs)
                : emptyPanel(
                    'Sample requirements have not been published yet. Add a specification named "Sample Requirements" in equipment admin to show it here.'
                  );
          } else if (activePanel === "view_charges" || activePanel === "brochure") {
            const eqAny = equipment as EquipmentProfile & {
              charge_profiles?: Array<Record<string, unknown>>;
              base_charges_by_user_type?: Array<{
                user_type: string;
                user_type_display?: string;
                profile_type_display?: string | null;
                primary_unit_charge?: string;
                secondary_unit_charge?: string;
              }>;
              slot_options?: Array<Record<string, unknown>>;
              param_definitions?: Array<Record<string, unknown>>;
              input_fields?: Array<{ field_key?: string | null; options?: unknown }>;
            };
            const chargeRows = buildChargeCategorySummaryRows(eqAny);
            let chargesBody: JSX.Element;
            if (chargeRows.length === 0) {
              chargesBody = emptyPanel(
                "Rate card is not available for this equipment yet. Use Calculate charges for an estimate."
              );
            } else {
              const presentation = buildChargeCategoryPresentation(eqAny.profile_type, chargeRows, {
                inputFields: eqAny.input_fields,
                slotOptions: Array.isArray(eqAny.slot_options)
                  ? eqAny.slot_options
                  : Array.isArray(eqAny.param_definitions)
                    ? eqAny.param_definitions
                    : [],
              });
              if (presentation.simplified && presentation.mode === "multi_param") {
                chargesBody = <ChargeCategoryMultiParamTable presentation={presentation} />;
              } else if (presentation.simplified) {
                chargesBody = <ChargeCategorySimplifiedTable presentation={presentation} />;
              } else {
                const showSecondary = chargeRows.some((row) => !!row.secondary);
                chargesBody = (
                  <ChargeCategoryLegacyTable
                    subtitle="Standard rates for this equipment, including student and faculty categories."
                    unitLabels={{
                      primary: "Unit charge",
                      secondary: "Additional charge",
                      rateSuffix: "",
                    }}
                    showSecondary={showSecondary}
                    rows={chargeRows}
                    formatAmount={formatINR}
                  />
                );
              }
            }

            if (activePanel === "view_charges") {
              panelBody = chargesBody;
            } else {
              const brochureSection = (title: string, icon: JSX.Element, body: JSX.Element) => (
                <section className="space-y-3">
                  <div className="flex items-center gap-2 border-b pb-2">
                    <span className="text-primary">{icon}</span>
                    <h3 className="text-lg sm:text-xl font-semibold tracking-tight">{title}</h3>
                  </div>
                  {body}
                </section>
              );
              const brochureManagers =
                equipment.managers && equipment.managers.length > 0
                  ? equipment.managers.map((mgr) => ({
                      key: mgr.equipment_manager_id,
                      name: mgr.manager_name,
                      email: mgr.manager_email,
                      phone: mgr.manager_phone,
                      profilePicture: mgr.manager_profile_picture,
                      userId: mgr.manager,
                    }))
                  : [];
              const brochureOperators =
                equipment.operators && equipment.operators.length > 0
                  ? equipment.operators.map((op) => ({
                      key: op.equipment_operator_id + 100000,
                      name: op.operator_name,
                      email: op.operator_email,
                      phone: op.operator_phone,
                      profilePicture: op.operator_profile_picture,
                      userId: op.operator,
                    }))
                  : [];
              const handleExportBrochurePdf = async () => {
                if (exportingBrochurePdf) return;
                setExportingBrochurePdf(true);
                try {
                  const contacts = [
                    ...brochureManagers.map((m) => ({
                      role: "Officer in-charge",
                      name: m.name || "—",
                      email: m.email,
                      phone: m.phone,
                    })),
                    ...brochureOperators.map((o) => ({
                      role: "Lab operator",
                      name: o.name || "—",
                      email: o.email,
                      phone: o.phone,
                    })),
                  ];
                  await exportEquipmentBrochurePdf({
                    equipmentId: equipment.equipment_id,
                    name: equipment.name,
                    code: equipment.code,
                    description: equipment.description,
                    importantInstruction: equipment.important_instruction,
                    location: equipment.location,
                    departmentName:
                      equipment.internal_department_name || DEFAULT_DEPARTMENT_NAME,
                    generalSpecs: generalSpecs.map((s) => ({
                      spec_key: s.spec_key,
                      spec_value: s.spec_value,
                    })),
                    sampleSpecs: sampleSpecs.map((s) => ({
                      spec_key: s.spec_key,
                      spec_value: s.spec_value,
                    })),
                    chargeRows: chargeRows.map((row) => ({
                      category: row.label || row.userType || "Category",
                      primary: row.primary ? formatINR(row.primary) : null,
                      secondary: row.secondary ? formatINR(row.secondary) : null,
                    })),
                    contacts,
                  });
                  toast.success("Brochure PDF downloaded.");
                } catch (err) {
                  console.error(err);
                  toast.error("Could not export brochure PDF. Please try again.");
                } finally {
                  setExportingBrochurePdf(false);
                }
              };
              panelBody = (
                <div className="space-y-10 print:space-y-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between rounded-xl border bg-primary/5 px-5 py-4 sm:px-7">
                    <p className="text-base sm:text-lg text-foreground leading-relaxed">
                      Consolidated brochure for{" "}
                      <span className="font-semibold">{equipment.name}</span>
                      {equipment.code ? (
                        <>
                          {" "}
                          (<span className="font-mono text-sm">({equipment.code})</span>)
                        </>
                      ) : null}
                      .
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-2 self-start"
                      disabled={exportingBrochurePdf}
                      onClick={() => void handleExportBrochurePdf()}
                    >
                      {exportingBrochurePdf ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      {exportingBrochurePdf ? "Exporting…" : "Export PDF"}
                    </Button>
                  </div>
                  <div className="overflow-hidden rounded-xl border bg-muted/10">
                    <EquipmentImage
                      equipmentId={equipment.equipment_id}
                      alt={equipment.name}
                      className="mx-auto max-h-72 w-full object-contain bg-white dark:bg-muted/20"
                    />
                  </div>
                  {brochureSection(
                    "General information",
                    <Info className="h-5 w-5" />,
                    <div className="space-y-4">
                      {equipment.important_instruction ? (
                        <div className="rounded-xl border-2 border-amber-500/70 bg-amber-50/80 dark:bg-amber-950/30 p-4">
                          <p className="font-semibold text-amber-900 dark:text-amber-200 mb-1">
                            Important instruction
                          </p>
                          <p className="whitespace-pre-line text-sm sm:text-base leading-relaxed">
                            {equipment.important_instruction}
                          </p>
                        </div>
                      ) : null}
                      {equipment.description ? (
                        <p className="text-base sm:text-lg whitespace-pre-line leading-relaxed text-foreground/90">
                          {equipment.description}
                        </p>
                      ) : (
                        <p className="text-muted-foreground">No general description published yet.</p>
                      )}
                      {equipment.location ? (
                        <p className="text-sm text-muted-foreground whitespace-pre-line">
                          <span className="font-medium text-foreground">Location: </span>
                          {equipment.location}
                        </p>
                      ) : null}
                    </div>
                  )}
                  {brochureSection(
                    "Technical specifications",
                    <FileText className="h-5 w-5" />,
                    generalSpecs.length > 0
                      ? renderSpecBlocks(generalSpecs)
                      : (
                          <p className="text-muted-foreground">
                            Specifications have not been published for this instrument yet.
                          </p>
                        )
                  )}
                  {brochureSection(
                    "Sample requirements",
                    <FlaskConical className="h-5 w-5" />,
                    sampleSpecs.length > 0
                      ? renderSpecBlocks(sampleSpecs)
                      : (
                          <p className="text-muted-foreground">
                            Sample requirements have not been published yet.
                          </p>
                        )
                  )}
                  {brochureSection(
                    "Charges",
                    <IndianRupee className="h-5 w-5" />,
                    chargesBody
                  )}
                  {brochureSection(
                    "Contact us",
                    <UserCog className="h-5 w-5" />,
                    <div className="space-y-8">
                      <div className="space-y-3">
                        <h4 className="text-base font-semibold text-foreground">Officer in-charge</h4>
                        {brochureManagers.length > 0
                          ? renderContactCards(brochureManagers)
                          : (
                              <p className="text-muted-foreground">
                                No officer in-charge has been assigned to this instrument yet.
                              </p>
                            )}
                      </div>
                      <div className="space-y-3">
                        <h4 className="text-base font-semibold text-foreground">Lab operator</h4>
                        {brochureOperators.length > 0
                          ? renderContactCards(brochureOperators)
                          : (
                              <p className="text-muted-foreground">
                                No lab operator has been assigned to this instrument yet.
                              </p>
                            )}
                      </div>
                    </div>
                  )}
                </div>
              );
            }
          } else if (activePanel === "calc_charges") {
            panelBody = (
              <div className="min-h-[24rem] -mx-1">
                <InPanelRoute
                  initialPath={`/book-equipment?equipment_id=${equipment.equipment_id}&mode=calculate&embed=1`}
                  path="/book-equipment"
                  element={<BookEquipment />}
                  onClose={() => setActivePanel("view_charges")}
                />
              </div>
            );
          } else if (activePanel === "contact") {
            const managerEntries =
              equipment.managers && equipment.managers.length > 0
                ? equipment.managers.map((mgr) => ({
                    key: mgr.equipment_manager_id,
                    name: mgr.manager_name,
                    email: mgr.manager_email,
                    phone: mgr.manager_phone,
                    profilePicture: mgr.manager_profile_picture,
                    userId: mgr.manager,
                  }))
                : [];
            const operatorEntries =
              equipment.operators && equipment.operators.length > 0
                ? equipment.operators.map((op) => ({
                    key: op.equipment_operator_id + 100000,
                    name: op.operator_name,
                    email: op.operator_email,
                    phone: op.operator_phone,
                    profilePicture: op.operator_profile_picture,
                    userId: op.operator,
                  }))
                : [];
            panelBody = (
              <div className="space-y-8">
                <div className="space-y-3">
                  <h3 className="text-base font-semibold text-foreground">Officer in-charge</h3>
                  {managerEntries.length > 0
                    ? renderContactCards(managerEntries)
                    : emptyPanel("No officer in-charge has been assigned to this instrument yet.")}
                </div>
                <div className="space-y-3">
                  <h3 className="text-base font-semibold text-foreground">Lab operator</h3>
                  {operatorEntries.length > 0
                    ? renderContactCards(operatorEntries)
                    : emptyPanel("No lab operator has been assigned to this instrument yet.")}
                </div>
              </div>
            );
          } else if (activePanel === "publications") {
            panelBody =
              publicationList.length > 0 ? (
                <div className="space-y-6">
                  <div className="rounded-xl border bg-primary/5 px-5 py-4 sm:px-7">
                    <p className="text-lg sm:text-xl text-foreground leading-relaxed">
                      This instrument is referenced in{" "}
                      <span className="font-semibold tabular-nums">{publicationCount}</span>{" "}
                      publication{publicationCount === 1 ? "" : "s"}.
                    </p>
                  </div>
                  {publicationList.map((pub) => {
                    const href = (pub.url || (pub.doi ? `https://doi.org/${pub.doi}` : "") || "").trim();
                    const link =
                      href && !/^https?:\/\//i.test(href) ? `https://${href}` : href;
                    return (
                      <div
                        key={pub.equipment_publication_id}
                        className="rounded-xl border bg-muted/20 px-5 py-5 sm:px-7 sm:py-6 space-y-2"
                      >
                        <h3 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
                          {pub.title}
                          {pub.year != null ? (
                            <span className="text-muted-foreground font-normal"> ({pub.year})</span>
                          ) : null}
                        </h3>
                        {pub.citation ? (
                          <p className="text-lg sm:text-xl text-foreground/90 whitespace-pre-line leading-relaxed">
                            {pub.citation}
                          </p>
                        ) : null}
                        {link ? (
                          <a
                            href={link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 text-base sm:text-lg text-primary hover:underline break-all"
                          >
                            {pub.url || (pub.doi ? `https://doi.org/${pub.doi}` : link)}
                            <ExternalLink className="h-4 w-4 shrink-0" />
                          </a>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                emptyPanel(
                  "No publications listed yet. Internal IIT Roorkee users can submit references from Dashboard → My Publications (they appear once submitted if not a duplicate). External users' submissions may need review. Administrators can also add them in Equipment settings."
                )
              );
          }

          return (
            <div className="grid grid-cols-1 lg:grid-cols-[12.5rem_minmax(0,1fr)] gap-3 lg:gap-2.5 items-start">
              <div className="space-y-5 min-w-0 order-2 lg:order-2">
                <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-border/60">
                  <div className="h-1.5 w-full bg-gradient-to-r from-primary via-accent to-primary/50" />
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      {equipment.code ? (
                        <Badge variant="outline" className="font-mono text-xs tracking-wide">
                          {equipment.code}
                        </Badge>
                      ) : null}
                      <Badge
                        className={cn(
                          equipment.status === "ACTIVE"
                            ? "bg-emerald-600 hover:bg-emerald-600"
                            : "bg-slate-500 hover:bg-slate-500"
                        )}
                      >
                        {equipment.status_display}
                      </Badge>
                    </div>
                    <CardTitle className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
                      {equipment.name}
                    </CardTitle>
                    <div className="mt-3">
                      <EquipmentDepartmentLabel name={equipment.internal_department_name} />
                    </div>
                    {equipment.location ? (
                      <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-muted/50 border px-3.5 py-2.5">
                        <MapPin className="h-5 w-5 shrink-0 mt-0.5 text-primary" />
                        <div className="min-w-0">
                          {equipment.google_maps_url ? (
                            <a
                              href={equipment.google_maps_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-start gap-2 text-base font-medium leading-snug text-foreground hover:text-primary"
                            >
                              <span className="whitespace-pre-line">{equipment.location}</span>
                              <ExternalLink className="mt-0.5 h-4 w-4 shrink-0" />
                            </a>
                          ) : (
                            <span className="text-base font-medium whitespace-pre-line leading-snug">
                              {equipment.location}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : null}
                    {publicationCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => setActivePanel("publications")}
                        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/[0.06] px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/[0.1] hover:underline underline-offset-2 transition-colors"
                      >
                        <BookOpen className="h-4 w-4 shrink-0" aria-hidden />
                        {publicationCount === 1 ? "1 Citation" : `${publicationCount} Citations`}
                      </button>
                    ) : null}
                  </CardHeader>
                  <CardContent className="space-y-5 pt-0">
                    <div className="flex items-center gap-2.5 border-b pb-3">
                      <span className="text-primary">{panelMeta[activePanel].icon}</span>
                      <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
                        {panelMeta[activePanel].title}
                      </h2>
                    </div>
                    {panelBody}
                  </CardContent>
                </Card>
              </div>

              <div className="order-1 lg:order-1 min-w-0 w-full">
                <div className="lg:sticky lg:top-6 space-y-2">
                  {showCreateOrBookCta() && (canManageEquipment() || isOicUser() || isEquipmentOperational()) && (
                    <button
                      type="button"
                      onClick={handleBookOrManageClick}
                      className="group relative w-full overflow-hidden rounded-xl border border-emerald-800 bg-emerald-700 px-2 py-3.5 text-center text-white shadow-md shadow-emerald-900/20 transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 min-h-12"
                    >
                      <span className="relative z-10 flex flex-col items-center justify-center gap-1.5">
                        <Calendar className="h-5 w-5 shrink-0" aria-hidden />
                        <span className="text-[13px] font-extrabold leading-tight tracking-wide">
                          {canManageEquipment() || isOicUser() ? "Create booking" : "Book this equipment"}
                        </span>
                      </span>
                    </button>
                  )}
                  <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-border/50">
                    <div className="h-0.5 w-full bg-gradient-to-r from-primary to-accent" />
                    <CardHeader className="pb-1.5 pt-3 px-2.5">
                      <CardTitle className="text-sm font-semibold tracking-tight">Equipment menu</CardTitle>
                      <CardDescription className="text-xs leading-snug">
                        Opens on the right
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-1 px-2 pb-2.5">
                      {canChangeSlotStatus() && (
                        navBtn("slot_status", "Change slot status", {
                          icon: <CalendarClock className="h-3 w-3" />,
                          variant: "action",
                          onClick: handleChangeSlotStatusClick,
                        })
                      )}
                      {navBtn("general", "General information", {
                        icon: <ClipboardList className="h-3 w-3" />,
                        active: activePanel === "general",
                        onClick: () => setActivePanel("general"),
                      })}
                      {navBtn("specifications", "Technical specifications", {
                        icon: <FileText className="h-3 w-3" />,
                        active: activePanel === "specifications",
                        onClick: () => setActivePanel("specifications"),
                      })}
                      {navBtn("sample", "Sample requirements", {
                        icon: <FlaskConical className="h-3 w-3" />,
                        active: activePanel === "sample_requirements",
                        onClick: () => setActivePanel("sample_requirements"),
                      })}
                      {navBtn("view_charges", "View charges", {
                        icon: <IndianRupee className="h-3 w-3" />,
                        active: activePanel === "view_charges",
                        onClick: () => setActivePanel("view_charges"),
                      })}
                      {navBtn("calc_charges", "Calculate charges", {
                        icon: <IndianRupee className="h-3 w-3" />,
                        variant: "action",
                        active: activePanel === "calc_charges",
                        onClick: handleCalculateChargesClick,
                      })}
                      {navBtn(
                        "publications",
                        publicationCount > 0
                          ? `Publications (${publicationCount})`
                          : "Publications",
                        {
                          icon: <BookOpen className="h-3 w-3" />,
                          active: activePanel === "publications",
                          onClick: () => setActivePanel("publications"),
                        }
                      )}
                      {navBtn("brochure", "Equipment brochure", {
                        icon: <ScrollText className="h-3 w-3" />,
                        active: activePanel === "brochure",
                        onClick: () => setActivePanel("brochure"),
                      })}
                      {navBtn("support", "Raise support request", {
                        icon: <LifeBuoy className="h-3 w-3" />,
                        variant: "action",
                        onClick: () => setSupportOpen(true),
                      })}
                      {navBtn("contact", "Contact us", {
                        icon: <UserCog className="h-3 w-3" />,
                        active: activePanel === "contact",
                        onClick: () => setActivePanel("contact"),
                      })}
                      {navBtn("manage_another", "Browse & book another instrument", {
                        icon: <LayoutGrid className="h-3 w-3" />,
                        variant: "action",
                        onClick: () => {
                          if (window.history.length > 1) navigate(-1);
                          else navigate("/equipments");
                        },
                      })}
                      {showCreateOrBookCta() && !canManageEquipment() && !isOicUser() && !isEquipmentOperational() && (
                        <p className="text-[10px] text-amber-600 font-medium pt-1 px-0.5 leading-snug">
                          Booking is disabled while equipment is{" "}
                          {String((equipment as any)?.status_display || (equipment as any)?.status || "Not Operational")}.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                  <TicketForm
                    open={supportOpen}
                    onOpenChange={setSupportOpen}
                    hideTicketType
                    initialValues={{
                      ticket_type: "equipment",
                      related_equipment_id: equipment.equipment_id,
                      subject: `Support request: ${equipment.code} — ${equipment.name}`,
                    }}
                    onSuccess={() => {
                      toast.success("Support request submitted. Our team will follow up shortly.");
                      setSupportOpen(false);
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })()}

      </main>
      <Footer />
    </div>
  );
};

export default EquipmentProfile;


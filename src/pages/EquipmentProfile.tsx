import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { normalizeUserTypeCode } from "@/lib/userTypes";
import { setPostLoginRedirect } from "@/lib/authRedirect";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, LifeBuoy, MapPin, Info, Calendar, Wrench, Users, UserCog, FileText, IndianRupee } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import UserProfile from "@/components/UserProfile";
import { format, startOfWeek, addWeeks, addDays, isSameDay, parseISO, startOfDay, endOfWeek } from "date-fns";
import DashboardHeader from "@/components/DashboardHeader";
import EquipmentDepartmentLabel from "@/components/EquipmentDepartmentLabel";
import EquipmentImage from "@/components/EquipmentImage";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { TruncatableText } from "@/components/TruncatableText";
import { EquipmentAccessoriesSection } from "@/components/EquipmentAccessoriesSection";
import TicketForm from "@/components/TicketForm";
import { cn } from "@/lib/utils";

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
  /** When 'SLOT_ID', weekly grid shows slot number/name on vertical axis; when 'TIME', shows time. Admin/OIC always see TIME. */
  weekly_view_display?: 'TIME' | 'SLOT_ID';
}

const EquipmentProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [equipment, setEquipment] = useState<EquipmentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const userType = user?.user_type ?? null;
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
  const [supportOpen, setSupportOpen] = useState(false);
  const [lastFetchedWeek, setLastFetchedWeek] = useState<string | null>(null);
  const fetchingSlotsRef = useRef(false);

  const fetchSlotsForWeek = useCallback(async (forceRefetch?: boolean) => {
    if (!equipment || !id) return;

    const weekStart = startOfWeek(currentWeekStart, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
    const startDateStr = format(weekStart, "yyyy-MM-dd");
    const endDateStr = format(weekEnd, "yyyy-MM-dd");
    const weekKey = `${startDateStr}_${endDateStr}`;

    if (!forceRefetch && (fetchingSlotsRef.current || loadingSlots)) return;
    if (!forceRefetch && lastFetchedWeek === weekKey) return;

    try {
      fetchingSlotsRef.current = true;
      setLoadingSlots(true);
      const slotsResponse = await apiClient.getEquipmentSlots(id, startDateStr, endDateStr);
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
      }
    } catch (error: any) {
      console.error("Error calling slots API:", error);
      toast.error("Failed to load available slots");
    } finally {
      setLoadingSlots(false);
      fetchingSlotsRef.current = false;
    }
  }, [equipment, id, currentWeekStart, loadingSlots, lastFetchedWeek]);

  useEffect(() => {
    if (id) {
      fetchEquipmentProfile();
    }
  }, [id]);

  // Admin-only: true when user_type is admin (for "Manage this Equipment" label and visibility)
  const isAdminUser = (): boolean => {
    if (!userType) return false;
    return String(userType).toLowerCase() === 'admin';
  };

  // Admin and OIC (manager, operator): can manage equipment – book for user, change slot status, and see "Manage another equipment"
  const canManageEquipment = (): boolean => {
    if (!userType) return false;
    const t = String(userType).toLowerCase();
    return t === 'admin' || t === 'manager' || t === 'operator';
  };

  // Check if user type is allowed to book equipment
  // Allowed types: Student, Faculty, External, RND, Institute (admin sees "Manage this Equipment" instead)
  const canBookEquipment = (): boolean => {
    if (!userType) return false;
    if (isAdminUser()) return true; // Admin can see the button (labeled "Manage this Equipment")

    const allowedStringTypes = ['student', 'faculty', 'external', 'rnd', 'industry', 'startup_incubated_iitr', 'external_startup_msme'];
    
    // Handle string user_type (case-insensitive)
    if (typeof userType === 'string') {
      const userTypeLower = userType.toLowerCase();
      return allowedStringTypes.some(type => userTypeLower.includes(type));
    }
    
    // Handle number user_type
    // Based on common mappings: 1=student, 2=faculty, 3=external
    // Allow numbers 1-5 to cover RND and Institute if they exist
    if (typeof userType === 'number') {
      // Allow student (1), faculty (2), external (3), and potentially RND (4) and Institute (5)
      return userType >= 1 && userType <= 5;
    }
    
    return false;
  };

  const isEquipmentOperational = (): boolean => {
    const st = String((equipment as any)?.status || "").trim().toUpperCase();
    return st === "ACTIVE" || st === "OPERATIONAL";
  };

  const shouldShowBookingCard = (): boolean => {
    if (canManageEquipment() || canBookEquipment()) return true;
    return !isAuthenticated;
  };

  const handleBookOrManageClick = () => {
    if (!equipment) return;
    if (!canManageEquipment() && !isEquipmentOperational()) {
      toast.error("This equipment is not operational and cannot be booked.");
      return;
    }
    const bookingUrl = `/book-equipment?equipment_id=${equipment.equipment_id}`;
    if (!canManageEquipment() && !isAuthenticated) {
      setPostLoginRedirect(bookingUrl);
      navigate("/auth");
      return;
    }
    navigate(bookingUrl);
  };

  const handleCalculateChargesClick = () => {
    if (!equipment) return;
    navigate(`/book-equipment?equipment_id=${equipment.equipment_id}&mode=calculate`);
  };

  const fetchEquipmentProfile = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const response = await apiClient.getEquipmentDetailById(id);

      if (response.error) {
        toast.error(response.error || "Failed to load equipment profile");
        navigate("/equipments");
        return;
      }

      if (!response.data) {
        toast.error("Equipment not found");
        navigate("/equipments");
        return;
      }

      setEquipment(response.data);
    } catch (error: any) {
      toast.error(error.message || "Failed to load equipment profile");
      navigate("/book-equipment");
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

  /** Admin and OIC always see time on the vertical axis; setting has no effect for them. */
  const isAdminOrOIC = (): boolean => {
    if (userType == null) return false;
    const t = String(userType).toLowerCase();
    return t === "admin" || t === "manager";
  };

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
    if (!equipment || !id) return;
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
          <h2 className="text-2xl font-bold mb-4">Equipment not found</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 via-background to-background dark:from-background">
      <DashboardHeader />
      <main className="flex-1 container mx-auto px-4 py-8">

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Left Section - Equipment Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Equipment Header */}
            <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-border/60">
              <div className="h-1.5 w-full bg-gradient-to-r from-teal-600 via-cyan-500 to-teal-500" />
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
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
                      <EquipmentDepartmentLabel
                        name={equipment.internal_department_name}
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {equipment.location ? (
                  <div className="flex items-start gap-2.5 rounded-xl bg-muted/50 border px-3.5 py-2.5">
                    <MapPin className="h-5 w-5 shrink-0 mt-0.5 text-teal-700" />
                    <span className="text-base font-medium whitespace-pre-line leading-snug">
                      {equipment.location}
                    </span>
                  </div>
                ) : null}
                <div className="relative aspect-video rounded-xl overflow-hidden bg-muted ring-1 ring-border/50">
                  <EquipmentImage
                    equipmentId={equipment.equipment_id}
                    enabled
                    alt={equipment.name}
                    className="w-full h-full object-contain"
                  />
                </div>
                {equipment.description ? (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" />
                      About this instrument
                    </p>
                    <p className="text-base text-muted-foreground whitespace-pre-line leading-relaxed">
                      {equipment.description}
                    </p>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {/* Slot Display - Weekly Calendar */}
            {false && (
            <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Available Time Slots
                  </CardTitle>
                  <CardDescription>
                    {getSlotDuration()} minutes per slot - Weekly View
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Week Navigation */}
                  <div className="flex justify-between items-center mb-6">
                    <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
                      <ChevronLeft className="h-4 w-4 mr-2" />
                      Previous Week
                    </Button>
                    <span className="font-semibold">
                      {format(startOfWeek(currentWeekStart, { weekStartsOn: 1 }), "MMM dd")} - {format(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), "MMM dd, yyyy")}
                    </span>
                    <Button variant="outline" size="sm" onClick={goToNextWeek}>
                      Next Week
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>

                  {(() => {
                    const weekStart = startOfWeek(currentWeekStart, { weekStartsOn: 1 });
                    const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
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
                        <div className="font-semibold text-sm p-2">{getEffectiveWeeklyViewDisplay() === "SLOT_ID" ? "Slot position" : "Time"}</div>
                        {[0, 1, 2, 3, 4, 5, 6].map((dayOffset) => {
                          const weekStartMonday = startOfWeek(currentWeekStart, { weekStartsOn: 1 });
                          const day = addDays(weekStartMonday, dayOffset);
                          return (
                            <div key={dayOffset} className="font-semibold text-sm p-2 text-center">
                              <div>{format(day, "EEE")}</div>
                              <div className="text-muted-foreground">{format(day, "MMM dd")}</div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Time slots - use row keys/labels from effective weekly view display (Admin/OIC always see Time) */}
                      {getWeeklyRowKeysAndLabels().length > 0 &&
                        getWeeklyRowKeysAndLabels().map(({ key: rowKey, label: rowLabel }) => (
                          <div key={rowKey} className="grid grid-cols-8 gap-2 mb-2">
                            <div className="text-sm p-2 font-medium flex items-center">
                              {rowLabel}
                            </div>
                            {[0, 1, 2, 3, 4, 5, 6].map((dayOffset) => {
                              const weekStartMonday = startOfWeek(currentWeekStart, { weekStartsOn: 1 });
                              const day = addDays(weekStartMonday, dayOffset);
                              const slotData = getSlotData(day, rowKey);
                              const slotExists = slotData !== undefined;
                              const dateStr = format(day, "yyyy-MM-dd");
                              const isPast = slotData?.start_datetime
                                ? parseISO(slotData.start_datetime) < new Date()
                                : rowKey.includes(":")
                                  ? (() => {
                                      const [h, m] = rowKey.split(":").map(Number);
                                      const d = new Date(day);
                                      d.setHours(h ?? 0, m ?? 0, 0, 0);
                                      return d < new Date();
                                    })()
                                  : false;
                              const isAvailable = slotExists && slotData?.status === "AVAILABLE" && !isPast;
                              const bookingStatusDisplay = slotData?.booking_status_display ?? null;
                              const bookingId = slotData?.booking_id ?? null;
                              const blockedLabel = slotData?.blocked_label ?? null;
                              const slotStatus = slotData?.status ?? "";
                              
                              // Build status label with special handling for BLOCKED and BOOKED
                              let slotStatusLabel = slotData?.status_display || "";
                              if (!slotStatusLabel && slotStatus) {
                                const statusMap: Record<string, string> = {
                                  "AVAILABLE": "Available",
                                  "NOT_AVAILABLE": "Not Available",
                                  "BOOKED": "Booked",
                                  "BLOCKED": "Blocked",
                                  "UNDER_MAINTENANCE": "Under Maintenance",
                                  "OPERATOR_ABSENT": "Operator Absent",
                                  "BOOKING_NOT_UTILIZED": "Booking Not Utilized"
                                };
                                slotStatusLabel = statusMap[slotStatus] || slotStatus.charAt(0).toUpperCase() + slotStatus.slice(1).toLowerCase();
                              }
                              
                              // For BOOKED status, append booking ID if available
                              if (slotStatus === "BOOKED" && bookingId) {
                                slotStatusLabel = `${slotStatusLabel} #${bookingId}`;
                              }
                              
                              // For BLOCKED status, use blocked_label if available, otherwise show "Blocked"
                              if (slotStatus === "BLOCKED") {
                                slotStatusLabel = blockedLabel || "Blocked";
                              }
                              
                              const slotDisplayLabel = bookingStatusDisplay || slotStatusLabel;
                              // If slot exists on holiday/Saturday/Sunday and has booking, show BOOKED status
                              // Priority: booking status > slot status > holiday name
                              const hasBooking = bookingId || slotData?.status === "BOOKED";
                              const rawHoliday = weeklyHolidays[dateStr];
                              const holidayLabel = typeof rawHoliday === "string" ? rawHoliday : (rawHoliday && typeof rawHoliday === "object" && "label" in rawHoliday ? (rawHoliday as { label: string }).label : undefined);
                              const holidayColorProfile = typeof rawHoliday === "object" && rawHoliday !== null && "color" in rawHoliday && (rawHoliday as { color?: string }).color
                                ? (rawHoliday as { color: string }).color
                                : undefined;
                              const displayStatus = slotExists
                                ? (hasBooking || slotData?.status !== "AVAILABLE"
                                    ? (slotDisplayLabel || slotStatusLabel || "Unavailable")
                                    : isPast
                                      ? "No Booking"
                                      : "Available")
                                : (holidayLabel || "—");

                              // Resolve background and text color from admin-configured calendar colors (pronounced styling)
                              const slotColors = calendarColors?.slot_colors ?? {
                                AVAILABLE: "#22c55e",
                                BOOKED: "#ef4444",
                                COMPLETED: "#059669",
                                BLOCKED: "#64748b",
                                UNDER_MAINTENANCE: "#f97316",
                                OPERATOR_ABSENT: "#eab308",
                                BOOKING_NOT_UTILIZED: "#a855f7",
                                HOLD: "#f59e0b",
                                RESERVED_FOR_EXTERNAL: "#94a3b8",
                                NOT_AVAILABLE: "#e2e8f0",
                              };
                              const holidayDefault = calendarColors?.holiday_default || "#f59e0b";
                              const saturdayColor = calendarColors?.saturday_color || "#c7d2fe";
                              const sundayColor = calendarColors?.sunday_color || "#fbcfe8";
                              let cellBg: string | undefined;
                              let cellText: string | undefined;
                              if (!slotExists) {
                                const dayOfWeek = day.getDay();
                                if (dayOfWeek === 6) cellBg = saturdayColor;
                                else if (dayOfWeek === 0) cellBg = sundayColor;
                                else cellBg = holidayColorProfile ?? holidayDefault;
                                cellText = cellBg ? getContrastTextColor(cellBg) : undefined;
                              } else {
                                let statusForColor = (slotData?.status === "BOOKED" && slotData?.booking_status)
                                  ? String(slotData.booking_status).toUpperCase()
                                  : (slotData?.status ?? "AVAILABLE");
                                if (slotData?.status_display === "Reserved for External User") statusForColor = "RESERVED_FOR_EXTERNAL";
                                else if (slotData?.status === "NOT_AVAILABLE") statusForColor = "NOT_AVAILABLE";
                                cellBg =
                                  slotColors[statusForColor] ??
                                  (slotData?.status === "BOOKED" ? slotColors.BOOKED : slotColors.AVAILABLE);
                                cellText = getContrastTextColor(cellBg);
                                if (isPast && statusForColor === "AVAILABLE") {
                                  cellBg = "#94a3b8"; // muted past slot
                                  cellText = "#ffffff";
                                }
                              }

                              return (
                                <div
                                  key={dayOffset}
                                  className="p-3 rounded-md text-sm min-h-[48px] flex items-center justify-center font-medium border-2 border-white/50 shadow-sm"
                                  style={
                                    cellBg
                                      ? { backgroundColor: cellBg, color: cellText ?? getContrastTextColor(cellBg) }
                                      : undefined
                                  }
                                >
                                  {displayStatus}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                    </div>
                  </div>
                    );
                  })()}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Section - Actions & info */}
          <div className="lg:col-span-1 space-y-5">
            <div className="sticky top-6 space-y-5">
              {(shouldShowBookingCard()) && (
                <Card className="overflow-hidden border-0 shadow-md ring-1 ring-border/60">
                  <div className="h-1 w-full bg-gradient-to-r from-teal-600 to-cyan-500" />
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-teal-700" />
                      Booking & charges
                    </CardTitle>
                    <CardDescription>
                      Reserve this instrument or estimate costs for your user category.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 pb-5">
                    <Button
                      className="w-full bg-teal-700 hover:bg-teal-800"
                      size="lg"
                      disabled={!canManageEquipment() && !isEquipmentOperational()}
                      onClick={handleBookOrManageClick}
                    >
                      {canManageEquipment() ? "Manage this Equipment" : "Book This Equipment"}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      size="lg"
                      onClick={handleCalculateChargesClick}
                    >
                      <IndianRupee className="h-4 w-4 mr-1.5" />
                      View and Calculate Charges
                    </Button>
                    {!canManageEquipment() && !isEquipmentOperational() && (
                      <p className="text-sm text-amber-600 font-medium">
                        Booking is disabled while equipment is {String((equipment as any)?.status_display || (equipment as any)?.status || "Not Operational")}.
                      </p>
                    )}
                    {canManageEquipment() && (
                      <Button
                        variant="outline"
                        className="w-full"
                        size="lg"
                        onClick={() => navigate("/equipments")}
                      >
                        Manage another equipment
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}

              <Card className="overflow-hidden border-teal-200/80 shadow-md ring-1 ring-teal-500/10 dark:border-teal-900">
                <div className="h-1 w-full bg-gradient-to-r from-teal-500 to-cyan-500" />
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <LifeBuoy className="h-5 w-5 text-teal-700" />
                    Need help with this equipment?
                  </CardTitle>
                  <CardDescription>
                    Raise a support request linked to this instrument. No login required.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    type="button"
                    className="w-full bg-teal-700 hover:bg-teal-800"
                    size="lg"
                    onClick={() => setSupportOpen(true)}
                  >
                    <LifeBuoy className="h-4 w-4 mr-2" />
                    Raise Support Request
                  </Button>
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
                </CardContent>
              </Card>

              {equipment.important_instruction && (
                <div className="rounded-xl border-2 border-amber-500/70 bg-gradient-to-br from-amber-50 to-orange-50/80 dark:from-amber-950/40 dark:to-orange-950/20 dark:border-amber-500/50 p-4 shadow-sm">
                  <div className="flex items-start gap-2.5">
                    <Info className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-900 dark:text-amber-200 mb-1">
                        Important instruction
                      </p>
                      <TruncatableText
                        text={equipment.important_instruction}
                        className="text-sm text-amber-950/90 dark:text-amber-100/90"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-xl ring-1 ring-border/60 bg-card shadow-sm overflow-hidden">
                <div className="px-4 pt-4 pb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Wrench className="h-4 w-4 text-teal-700" />
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

              {equipment.operators && equipment.operators.length > 0 && (
                <Card className="border-0 shadow-sm ring-1 ring-border/60">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-4 w-4 text-teal-700" />
                      Lab operators
                    </CardTitle>
                    <CardDescription>Contact for day-to-day instrument operation</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {equipment.operators.map((operator) => (
                        <div key={operator.equipment_operator_id} className="rounded-lg border bg-muted/30 p-2.5">
                          <UserProfile
                            name={operator.operator_name}
                            email={operator.operator_email}
                            phone={operator.operator_phone}
                            profilePicture={operator.operator_profile_picture && operator.operator != null ? apiClient.getProfilePictureUrl(operator.operator) : undefined}
                            size="md"
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {equipment.managers && equipment.managers.length > 0 && (
                <Card className="border-0 shadow-sm ring-1 ring-border/60">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <UserCog className="h-4 w-4 text-teal-700" />
                      Officer in-charge
                    </CardTitle>
                    <CardDescription>Scientific / administrative ownership</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {equipment.managers.map((manager) => (
                        <div key={manager.equipment_manager_id} className="rounded-lg border bg-muted/30 p-2.5">
                          <UserProfile
                            name={manager.manager_name}
                            email={manager.manager_email}
                            phone={manager.manager_phone}
                            profilePicture={manager.manager_profile_picture && manager.manager != null ? apiClient.getProfilePictureUrl(manager.manager) : undefined}
                            size="md"
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {equipment.specifications && equipment.specifications.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-0.5">
                    Specifications
                  </p>
                  {equipment.specifications.map((spec) => (
                    <Card key={spec.equipment_specification_id} className="border-0 shadow-sm ring-1 ring-border/60">
                      <CardHeader className="pb-2 pt-4">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 text-teal-700" />
                          {spec.spec_key}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0 pb-4">
                        <TruncatableText
                          text={spec.spec_value}
                          className="text-sm text-muted-foreground"
                        />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default EquipmentProfile;


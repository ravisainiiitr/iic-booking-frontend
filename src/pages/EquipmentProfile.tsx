import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { setPostLoginRedirect } from "@/lib/authRedirect";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import UserProfile from "@/components/UserProfile";
import { MapPin } from "lucide-react";
import { Info } from "lucide-react";
import { Calendar } from "lucide-react";
import { format, startOfWeek, addWeeks, addDays, isSameDay, parseISO, startOfDay, endOfWeek } from "date-fns";
import DashboardHeader from "@/components/DashboardHeader";
import EquipmentDepartmentLabel from "@/components/EquipmentDepartmentLabel";
import EquipmentImage from "@/components/EquipmentImage";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { TruncatableText } from "@/components/TruncatableText";

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

    const allowedStringTypes = ['student', 'faculty', 'external', 'rnd', 'industry'];
    
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
    <div className="min-h-screen flex flex-col">
      <DashboardHeader />
      <main className="flex-1 container mx-auto px-4 py-8">

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Section - Equipment Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Equipment Header */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <CardTitle className="text-3xl">{equipment.name}</CardTitle>
                      <Badge
                        variant={equipment.status === "ACTIVE" ? "default" : "secondary"}
                      >
                        {equipment.status_display}
                      </Badge>
                    </div>
                    <div className="mt-3">
                      <EquipmentDepartmentLabel
                        name={equipment.internal_department_name}
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {equipment.location ? (
                  <div className="flex items-start gap-2 text-lg font-medium text-foreground">
                    <MapPin className="h-5 w-5 shrink-0 mt-0.5 text-primary" />
                    <span className="whitespace-pre-line leading-snug">{equipment.location}</span>
                  </div>
                ) : null}
                <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                  <EquipmentImage
                    equipmentId={equipment.equipment_id}
                    enabled
                    alt={equipment.name}
                    className="w-full h-full object-contain"
                  />
                </div>
                {equipment.description ? (
                  <p className="text-lg text-muted-foreground whitespace-pre-line">{equipment.description}</p>
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

          {/* Right Section - Equipment Details */}
          <div className="lg:col-span-1 space-y-6">
            <div className="sticky top-6 space-y-6">
              {/* Book / Manage Equipment Button */}
              {(shouldShowBookingCard()) && (
                <Card>
                  <CardContent className="pt-6 space-y-3">
                    <Button
                      className="w-full"
                      size="lg"
                      disabled={!canManageEquipment() && !isEquipmentOperational()}
                      onClick={handleBookOrManageClick}
                    >
                      {canManageEquipment() ? "Manage this Equipment" : "Book This Equipment"}
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

              {/* Important Instruction - highlighted above specifications */}
              {equipment.important_instruction && (
                <div className="rounded-lg border-2 border-amber-500/80 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-500/60 p-4 shadow-sm">
                  <div className="flex items-start gap-2">
                    <Info className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-800 dark:text-amber-200 mb-1">Important Instruction</p>
                      <TruncatableText
                        text={equipment.important_instruction}
                        className="text-sm text-amber-900/90 dark:text-amber-100/90"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Operators */}
              {equipment.operators && equipment.operators.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      Lab Operators
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {equipment.operators.map((operator) => (
                        <div key={operator.equipment_operator_id}>
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

              {/* Managers */}
              {equipment.managers && equipment.managers.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      Officers in Charge
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {equipment.managers.map((manager) => (
                        <div key={manager.equipment_manager_id}>
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

              {/* Equipment specifications: one section per spec_key */}
              {equipment.specifications && equipment.specifications.length > 0 &&
                equipment.specifications.map((spec) => (
                  <Card key={spec.equipment_specification_id}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        {spec.spec_key}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <TruncatableText
                        text={spec.spec_value}
                        className="text-base text-muted-foreground"
                      />
                    </CardContent>
                  </Card>
                ))}

              {/* Accessories */}
              {equipment.accessories && equipment.accessories.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Accessories</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {equipment.accessories.map((accessory: any, index: number) => (
                        <div key={index}>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{accessory.name || accessory.accessory_name || `Accessory ${index + 1}`}</span>
                          </div>
                          {accessory.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {accessory.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Additional Accessories */}
              {equipment.additional_accessories && equipment.additional_accessories.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Additional Accessories</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {equipment.additional_accessories.map((accessory) => (
                        <div key={accessory.equipment_additional_accessory_id}>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{accessory.additional_accessory_name}</span>
                            {accessory.is_optional && (
                              <Badge variant="outline" className="text-xs">Optional</Badge>
                            )}
                          </div>
                          {accessory.additional_accessory_description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {accessory.additional_accessory_description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
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


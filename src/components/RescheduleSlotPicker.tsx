import { useEffect, useState, useCallback } from "react";
import { format, addDays, startOfWeek, addWeeks, subWeeks, parseISO, startOfDay } from "date-fns";
import { apiClient } from "@/lib/api";
import { isExternalBookingUserType, normalizeUserTypeCode } from "@/lib/userTypes";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Monday-start weeks that overlap [minDateStr, maxDateStr] (from slots API slot_window bounds). */
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

function isExternalBookingUserType(normalized: string | null): boolean {
  return normalized != null && isExternalBookingUserType(normalized);
}

/** Return black or white for readable text on the given hex background. */
function getContrastTextColor(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  if (Number.isNaN(n)) return "#1f2937";
  const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#1f2937" : "#ffffff";
}

export interface RescheduleSlot {
  id: number;
  date: string;
  start_datetime: string;
  end_datetime: string;
  status: string;
  status_display?: string;
  blocked_label?: string | null;
  booking_id?: number | null;
  booking_status?: string | null;
  booking_status_display?: string | null;
  reserved_for_external?: boolean;
  home_department_only?: boolean;
  available_for_external?: boolean;
  slot_master?: number;
  slot_number?: number;
  slot_name?: string;
  equipment_code?: string;
  created_at?: string;
  updated_at?: string;
}

export interface RescheduleBooking {
  booking_id: number;
  equipment: number;
  start_time: string;
  end_time: string;
  daily_slots: Array<{ id: number; start_datetime: string; end_datetime: string; date: string }>;
}

interface RescheduleSlotPickerProps {
  equipmentId: number;
  booking: RescheduleBooking;
  /** When set, slots API extends internal slot window by one week (maintenance reschedule policy). */
  maintenanceExtraWeekBookingId?: number;
  onConfirm: (startTimeISO: string, endTimeISO: string) => void;
  onCancel: () => void;
  confirmLoading?: boolean;
}

export default function RescheduleSlotPicker({
  equipmentId,
  booking,
  maintenanceExtraWeekBookingId,
  onConfirm,
  onCancel,
  confirmLoading = false,
}: RescheduleSlotPickerProps) {
  /** Same week-nav extension as urgent “Select slot” on BookEquipment (prev / current / next / +1 week when applicable). */
  const useExtendedDisruptionWeekNav = maintenanceExtraWeekBookingId != null;

  const requiredSlotCount = booking.daily_slots?.length ?? 1;
  const currentBookingSlotIds = new Set((booking.daily_slots ?? []).map((s) => s.id));

  const [userType, setUserType] = useState<string | number | null>(null);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [slots, setSlots] = useState<RescheduleSlot[]>([]);
  const [holidays, setHolidays] = useState<Record<string, string | { label: string; color?: string }>>({});
  const [slotWindowMinDate, setSlotWindowMinDate] = useState<string | null>(null);
  const [slotWindowMaxDate, setSlotWindowMaxDate] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [selectedSlots, setSelectedSlots] = useState<RescheduleSlot[]>([]);

  // Fetch user type on mount
  useEffect(() => {
    const fetchUserType = async () => {
      try {
        // First try to get from localStorage
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const user = JSON.parse(storedUser);
          setUserType(user.user_type || null);
          
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
            setWeekStart(currentWeek);
          } else {
            const fifteenDaysFromNow = addDays(now, 15);
            setWeekStart(startOfWeek(fifteenDaysFromNow, { weekStartsOn: 1 }));
          }
        } else {
          const response = await apiClient.getCurrentUser();
          if (response.data) {
            setUserType(response.data.user_type || null);
            const now = new Date();
            const currentWeek = startOfWeek(now, { weekStartsOn: 1 });
            const userTypeValue: any = response.data.user_type;
            let normalizedType: string | null = null;
            if (typeof userTypeValue === 'string') {
              normalizedType = userTypeValue.toLowerCase();
            } else if (typeof userTypeValue === 'number') {
              normalizedType = userTypeValue === 1 ? 'student' : userTypeValue === 2 ? 'faculty' : null;
            }
            if (normalizedType === 'admin' || normalizedType === 'student' || normalizedType === 'faculty') {
              setWeekStart(currentWeek);
            } else {
              const fifteenDaysFromNow = addDays(now, 15);
              setWeekStart(startOfWeek(fifteenDaysFromNow, { weekStartsOn: 1 }));
            }
          }
        }
      } catch (error) {
        console.error("Error fetching user type:", error);
      }
    };
    
    fetchUserType();
  }, []);

  // Normalize user type to string for comparison
  const normalizeUserType = (type: string | number | null): string | null => {
    if (type === null || type === undefined) return null;
    if (typeof type === 'string') return type.toLowerCase();
    if (typeof type === 'number') {
      const typeMap: Record<number, string> = {
        1: 'student',
        2: 'faculty',
      };
      return typeMap[type] || String(type);
    }
    return null;
  };

  const isAdminUser = (): boolean => {
    return normalizeUserType(userType) === 'admin';
  };

  // Check if a week is allowed (align with BookEquipment isWeekAllowed; extended nav mirrors isUrgentHoldMode)
  const isWeekAllowed = (weekStartDate: Date): boolean => {
    if (isAdminUser()) return true;
    if (!userType) return false;
    const normalizedType = normalizeUserType(userType);
    if (!normalizedType) return false;
    const now = new Date();
    const currentWeek = startOfWeek(now, { weekStartsOn: 1 });
    const nextWeek = addWeeks(currentWeek, 1);
    const fifteenDaysFromNow = addDays(now, 15);
    const allowedWeekStart = startOfWeek(fifteenDaysFromNow, { weekStartsOn: 1 });
    const weekStartNormalized = startOfWeek(weekStartDate, { weekStartsOn: 1 });
    const currentWeekNormalized = startOfWeek(currentWeek, { weekStartsOn: 1 });
    const nextWeekNormalized = startOfWeek(nextWeek, { weekStartsOn: 1 });
    const allowedWeekStartNormalized = startOfWeek(allowedWeekStart, { weekStartsOn: 1 });

    if (normalizedType === 'student' || normalizedType === 'faculty') {
      const minDateStr = slotWindowMinDate ?? null;
      const maxDateStr = slotWindowMaxDate ?? null;
      if (minDateStr && maxDateStr) {
        const allowed = getAllowedWeeks();
        return allowed.some(
          (w) => startOfWeek(w, { weekStartsOn: 1 }).getTime() === weekStartNormalized.getTime()
        );
      }
      if (useExtendedDisruptionWeekNav) {
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

    if (isExternalBookingUserType(normalizedType)) {
      const lastNavWeek = useExtendedDisruptionWeekNav ? addWeeks(allowedWeekStart, 1) : allowedWeekStart;
      const lastNorm = startOfWeek(lastNavWeek, { weekStartsOn: 1 }).getTime();
      const firstNorm = currentWeekNormalized.getTime();
      const t = weekStartNormalized.getTime();
      return t >= firstNorm && t <= lastNorm;
    }

    if (useExtendedDisruptionWeekNav) {
      const second = addWeeks(allowedWeekStart, 1);
      return (
        weekStartNormalized.getTime() === allowedWeekStartNormalized.getTime() ||
        weekStartNormalized.getTime() === startOfWeek(second, { weekStartsOn: 1 }).getTime()
      );
    }
    return weekStartNormalized.getTime() === allowedWeekStartNormalized.getTime();
  };

  // Get allowed weeks for navigation (admin: not used; nav has no restriction)
  const getAllowedWeeks = (): Date[] => {
    if (isAdminUser()) return [];
    if (!userType) return [];
    const normalizedType = normalizeUserType(userType);
    if (!normalizedType) return [];
    const now = new Date();
    const currentWeek = startOfWeek(now, { weekStartsOn: 1 });
    const nextWeek = addWeeks(currentWeek, 1);
    const fifteenDaysFromNow = addDays(now, 15);
    const allowedWeekStart = startOfWeek(fifteenDaysFromNow, { weekStartsOn: 1 });
    if (normalizedType === 'student' || normalizedType === 'faculty') {
      const minDateStr = slotWindowMinDate;
      const maxDateStr = slotWindowMaxDate;
      if (!minDateStr || !maxDateStr) {
        if (useExtendedDisruptionWeekNav) {
          return [currentWeek, nextWeek, addWeeks(nextWeek, 1)];
        }
        return [currentWeek, nextWeek];
      }
      if (useExtendedDisruptionWeekNav) {
        const minDate = parseISO(minDateStr);
        const maxDate = parseISO(maxDateStr);
        const previousWeek = subWeeks(currentWeek, 1);
        const nextWeekSunday = addDays(nextWeek, 6);
        const nextWeekAvailable = nextWeekSunday <= maxDate;
        if (!nextWeekAvailable) {
          return getAllowedWeeksFromSlotWindowBounds(minDateStr, maxDateStr);
        }
        const weeks: Date[] = [];
        const candidateWeeks = [previousWeek, currentWeek, nextWeek, addWeeks(nextWeek, 1)];
        for (const w of candidateWeeks) {
          const weekSunday = addDays(w, 6);
          if (weekSunday >= minDate && w <= maxDate) {
            weeks.push(w);
          }
        }
        return weeks;
      }
      return getAllowedWeeksFromSlotWindowBounds(minDateStr, maxDateStr);
    }
    if (isExternalBookingUserType(normalizedType)) {
      const lastNavWeek = useExtendedDisruptionWeekNav ? addWeeks(allowedWeekStart, 1) : allowedWeekStart;
      const weeks: Date[] = [];
      let w = startOfWeek(currentWeek, { weekStartsOn: 1 });
      const endW = startOfWeek(lastNavWeek, { weekStartsOn: 1 });
      while (w.getTime() <= endW.getTime()) {
        weeks.push(w);
        w = startOfWeek(addWeeks(w, 1), { weekStartsOn: 1 });
      }
      return weeks;
    }
    if (useExtendedDisruptionWeekNav) {
      return [allowedWeekStart, addWeeks(allowedWeekStart, 1)];
    }
    return [allowedWeekStart];
  };

  const fetchSlots = useCallback(async () => {
    // Check if current week is allowed for this user
    if (!isWeekAllowed(weekStart)) {
      setSlots([]);
      setHolidays({});
      setLoadingSlots(false);
      return;
    }

    setLoadingSlots(true);
    const weekEnd = addDays(weekStart, 7);
    const startStr = format(weekStart, "yyyy-MM-dd");
    const endStr = format(weekEnd, "yyyy-MM-dd");
    const res = await apiClient.getEquipmentSlots(equipmentId, startStr, endStr, {
      maintenanceExtraWeekBookingId,
    });
    setLoadingSlots(false);
    if (res.data?.slots) {
      setSlots(res.data.slots);
    } else {
      setSlots([]);
    }
    setHolidays(res.data?.holidays ?? {});
    setSlotWindowMinDate(res.data?.slot_window_min_date ?? null);
    setSlotWindowMaxDate(res.data?.slot_window_max_date ?? null);
    setSelectedSlots([]);
  }, [equipmentId, weekStart, userType, maintenanceExtraWeekBookingId]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  // Internal users: snap to an allowed week when the selected week is outside navigable weeks (matches BookEquipment)
  useEffect(() => {
    const nType = userType != null ? normalizeUserType(userType) : null;
    if (nType !== 'student' && nType !== 'faculty') return;
    const allowed = getAllowedWeeks();
    if (allowed.length === 0) return;
    const selected = startOfWeek(weekStart, { weekStartsOn: 1 });
    const isAllowed = allowed.some(
      (w) => startOfWeek(w, { weekStartsOn: 1 }).getTime() === selected.getTime()
    );
    if (!isAllowed) {
      setWeekStart(startOfWeek(allowed[0], { weekStartsOn: 1 }));
    }
  }, [slotWindowMinDate, slotWindowMaxDate, userType, weekStart, useExtendedDisruptionWeekNav, maintenanceExtraWeekBookingId]);

  // External users: snap into [current week … bookable week] (align with BookEquipment).
  useEffect(() => {
    const nType = userType != null ? normalizeUserType(userType) : null;
    if (!isExternalBookingUserType(nType)) return;
    const allowed = getAllowedWeeks();
    if (allowed.length === 0) return;
    const selected = startOfWeek(weekStart, { weekStartsOn: 1 });
    const isAllowed = allowed.some(
      (w) => startOfWeek(w, { weekStartsOn: 1 }).getTime() === selected.getTime()
    );
    if (!isAllowed) {
      setWeekStart(startOfWeek(allowed[allowed.length - 1], { weekStartsOn: 1 }));
    }
  }, [userType, weekStart, useExtendedDisruptionWeekNav, maintenanceExtraWeekBookingId]);

  const getUniqueTimes = (): string[] => {
    const set = new Set<string>();
    slots.forEach((s) => {
      try {
        set.add(format(parseISO(s.start_datetime), "HH:mm"));
      } catch (_) {}
    });
    return Array.from(set).sort();
  };

  const getSlotAt = (day: Date, timeStr: string): RescheduleSlot | undefined => {
    const dateStr = format(startOfDay(day), "yyyy-MM-dd");
    return slots.find((s) => {
      const slotDate = format(startOfDay(parseISO(s.date)), "yyyy-MM-dd");
      const slotTime = format(parseISO(s.start_datetime), "HH:mm");
      return slotDate === dateStr && slotTime === timeStr;
    });
  };

  const isAvailable = (slot: RescheduleSlot): boolean => {
    if (currentBookingSlotIds.has(slot.id)) return true;
    // Admin: can select any slot that is not booked by someone else (including blocked/holiday/maintenance)
    if (isAdminUser()) return slot.status !== "BOOKED";
    // External users: only AVAILABLE (reserved for external) slots are selectable
    const ut = String(userType ?? "").toLowerCase();
    const isExternal = isExternalBookingUserType(ut);
    if (isExternal) return slot.status === "AVAILABLE";
    // Internal users: only AVAILABLE slots that are NOT reserved for external are selectable.
    // home_department_only is enforced by the API using booker.department vs equipment.internal_department.
    return slot.status === "AVAILABLE" && slot.reserved_for_external !== true;
  };

  const isSelected = (slot: RescheduleSlot): boolean =>
    selectedSlots.some((s) => s.id === slot.id);

  const isCurrentBooking = (slot: RescheduleSlot): boolean =>
    currentBookingSlotIds.has(slot.id);

  const isPast = (slot: RescheduleSlot): boolean => {
    if (isAdminUser()) return false; // Admin can select any week/day; no past restriction
    try {
      return parseISO(slot.start_datetime) < new Date();
    } catch {
      return false;
    }
  };

  const timeSlots = getUniqueTimes();

  // Normalize to local (date + minute) so timezone/sub-second differences don't break consecutive check
  const toMinuteKey = (iso: string): string => {
    const d = parseISO(iso);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}-${d.getMinutes()}`;
  };

  const isConsecutive = (newSlot: RescheduleSlot, current: RescheduleSlot[]): boolean => {
    if (current.length === 0) return true;
    const sorted = [...current].sort(
      (a, b) =>
        parseISO(a.start_datetime).getTime() - parseISO(b.start_datetime).getTime()
    );
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const newStartKey = toMinuteKey(newSlot.start_datetime);
    const newEndKey = toMinuteKey(newSlot.end_datetime);
    const firstStartKey = toMinuteKey(first.start_datetime);
    const lastEndKey = toMinuteKey(last.end_datetime);
    // 1) Boundary match: new slot immediately before first, or immediately after last
    const newSlotBeforeFirst = newEndKey === firstStartKey;
    const newSlotAfterLast = newStartKey === lastEndKey;
    if (newSlotBeforeFirst || newSlotAfterLast) return true;
    // 2) Grid-adjacent: same day and new slot is the very next row in the weekly grid (so 16:00 + 17:45 count when there's no 17:30 row)
    const lastStartHHMM = format(parseISO(last.start_datetime), "HH:mm");
    const newStartHHMM = format(parseISO(newSlot.start_datetime), "HH:mm");
    const lastDateStr = format(parseISO(last.start_datetime), "yyyy-MM-dd");
    const newDateStr = format(parseISO(newSlot.start_datetime), "yyyy-MM-dd");
    const lastIdx = timeSlots.indexOf(lastStartHHMM);
    const newIdx = timeSlots.indexOf(newStartHHMM);
    const gridAdjacentSameDay =
      lastDateStr === newDateStr && lastIdx >= 0 && newIdx === lastIdx + 1;
    return gridAdjacentSameDay;
  };

  const toggleSlot = (slot: RescheduleSlot) => {
    if (!isAvailable(slot) || isPast(slot) || isCurrentBooking(slot)) return;

    setSelectedSlots((prev) => {
      const already = prev.find((s) => s.id === slot.id);
      if (already) {
        return prev.filter((s) => s.id !== slot.id);
      }
      if (prev.length >= requiredSlotCount) {
        toast.error(`Select exactly ${requiredSlotCount} consecutive slot(s).`);
        return prev;
      }
      if (!isConsecutive(slot, prev)) {
        toast.error("Please select consecutive slots only.");
        return prev;
      }
      const next = [...prev, slot].sort(
        (a, b) =>
          parseISO(a.start_datetime).getTime() - parseISO(b.start_datetime).getTime()
      );
      if (next.length > requiredSlotCount) {
        toast.error(`Select exactly ${requiredSlotCount} slot(s).`);
        return prev;
      }
      return next;
    });
  };

  const handleConfirm = () => {
    if (selectedSlots.length !== requiredSlotCount) {
      toast.error(`Please select exactly ${requiredSlotCount} consecutive slot(s).`);
      return;
    }
    const sorted = [...selectedSlots].sort(
      (a, b) =>
        parseISO(a.start_datetime).getTime() - parseISO(b.start_datetime).getTime()
    );
    const startISO = parseISO(sorted[0].start_datetime).toISOString();
    const endISO = parseISO(sorted[sorted.length - 1].end_datetime).toISOString();
    onConfirm(startISO, endISO);
  };

  const days = [0, 1, 2, 3, 4, 5, 6].map((d) => addDays(weekStart, d));

  return (
    <div className="space-y-4">
      <div className="rounded-md bg-muted/50 p-3 text-sm">
        <p className="font-medium text-muted-foreground mb-1">Current slot window</p>
        <p className="font-mono">
          {new Date(booking.start_time).toLocaleString(undefined, {
            dateStyle: "short",
            timeStyle: "short",
          })}{" "}
          →{" "}
          {new Date(booking.end_time).toLocaleString(undefined, {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </p>
        <p className="mt-1 text-muted-foreground">
          Select exactly <strong>{requiredSlotCount}</strong> consecutive slot
          {requiredSlotCount !== 1 ? "s" : ""} in the grid below.
        </p>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            if (isAdminUser()) {
              setWeekStart(subWeeks(weekStart, 1));
              setSelectedSlots([]);
            } else {
              const allowedWeeks = getAllowedWeeks();
              const currentIndex = allowedWeeks.findIndex(week =>
                startOfWeek(week, { weekStartsOn: 1 }).getTime() === startOfWeek(weekStart, { weekStartsOn: 1 }).getTime()
              );
              if (currentIndex > 0) {
                setWeekStart(allowedWeeks[currentIndex - 1]);
                setSelectedSlots([]);
              }
            }
          }}
          disabled={!isAdminUser() && (() => {
            const allowedWeeks = getAllowedWeeks();
            const currentIndex = allowedWeeks.findIndex(week =>
              startOfWeek(week, { weekStartsOn: 1 }).getTime() === startOfWeek(weekStart, { weekStartsOn: 1 }).getTime()
            );
            return currentIndex <= 0;
          })()}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous week
        </Button>
        <div className="text-center">
          <Label className="text-sm font-medium shrink-0">
            {format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d, yyyy")}
          </Label>
          {isAdminUser() && (
            <p className="text-xs text-muted-foreground mt-1">
              No week restriction — select any week
            </p>
          )}
          {userType && !isAdminUser() && (normalizeUserType(userType) === 'student' || normalizeUserType(userType) === 'faculty') && (
            <p className="text-xs text-muted-foreground mt-1">
              {slotWindowMinDate && slotWindowMaxDate ? (
                <>
                  Bookable dates: {format(parseISO(slotWindowMinDate), "MMM d")} –{" "}
                  {format(parseISO(slotWindowMaxDate), "MMM d, yyyy")}
                  {maintenanceExtraWeekBookingId != null ? (
                    <span className="block mt-0.5">
                      (Maintenance reschedule may add an extra week when the slot window rules allow.)
                    </span>
                  ) : null}
                </>
              ) : useExtendedDisruptionWeekNav ? (
                "Available: Current week, next week, and one additional week (maintenance / operator-unavailable reschedule)."
              ) : (
                "Available: Current week and next week only"
              )}
            </p>
          )}
          {userType && !isAdminUser() && normalizeUserType(userType) !== 'student' && normalizeUserType(userType) !== 'faculty' && (
            <p className="text-xs text-muted-foreground mt-1">
              Available: One week window starting 15 days from today
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            if (isAdminUser()) {
              setWeekStart(addWeeks(weekStart, 1));
              setSelectedSlots([]);
            } else {
              const allowedWeeks = getAllowedWeeks();
              const currentIndex = allowedWeeks.findIndex(week =>
                startOfWeek(week, { weekStartsOn: 1 }).getTime() === startOfWeek(weekStart, { weekStartsOn: 1 }).getTime()
              );
              if (currentIndex < allowedWeeks.length - 1) {
                setWeekStart(allowedWeeks[currentIndex + 1]);
                setSelectedSlots([]);
              }
            }
          }}
          disabled={!isAdminUser() && (() => {
            const allowedWeeks = getAllowedWeeks();
            const currentIndex = allowedWeeks.findIndex(week =>
              startOfWeek(week, { weekStartsOn: 1 }).getTime() === startOfWeek(weekStart, { weekStartsOn: 1 }).getTime()
            );
            return currentIndex >= allowedWeeks.length - 1;
          })()}
        >
          Next week
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {loadingSlots ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
      ) : timeSlots.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          No slots available for this week. Try another week.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: `60px repeat(7, 1fr)` }}>
              <div />
              {days.map((day) => (
                <div key={day.getTime()} className="text-center text-xs">
                  <div className="font-medium">{format(day, "EEE")}</div>
                  <div className="text-muted-foreground">{format(day, "MM/dd")}</div>
                </div>
              ))}
            </div>
            {timeSlots.map((timeStr) => (
              <div
                key={timeStr}
                className="grid gap-1 mb-1"
                style={{ gridTemplateColumns: `60px repeat(7, 1fr)` }}
              >
                <div className="text-sm flex items-center font-medium">{timeStr}</div>
                {days.map((day) => {
                  const slot = getSlotAt(day, timeStr);
                  const dateStr = format(day, "yyyy-MM-dd");
                  const available = slot && isAvailable(slot) && !isPast(slot);
                  const selected = slot && isSelected(slot);
                  const currentBooking = slot && isCurrentBooking(slot);
                  const booked = slot && !isAvailable(slot);
                  const past = slot && isPast(slot);
                  const disabled =
                    !slot ||
                    past ||
                    currentBooking ||
                    (booked && !currentBookingSlotIds.has(slot.id)) ||
                    (available &&
                      !selected &&
                      (selectedSlots.length >= requiredSlotCount ||
                        (selectedSlots.length > 0 && !isConsecutive(slot, selectedSlots))));

                  let label: string;
                  if (slot) {
                    if (selected) label = "Selected";
                    else if (currentBooking) label = "Current Booking";
                    else if (booked && !currentBookingSlotIds.has(slot.id)) {
                      // Build status label with special handling for BLOCKED and BOOKED
                      let statusLabel = slot.booking_status_display || slot.status_display || "";
                      if (!statusLabel && slot.status) {
                        const statusMap: Record<string, string> = {
                          "AVAILABLE": "Available",
                          "NOT_AVAILABLE": "Not Available",
                          "BOOKED": "Booked",
                          "BLOCKED": "Blocked",
                          "UNDER_MAINTENANCE": "Under Maintenance",
                          "OPERATOR_ABSENT": "Operator Absent",
                          "BOOKING_NOT_UTILIZED": "Booking Not Utilized"
                        };
                        statusLabel = statusMap[slot.status] || slot.status.charAt(0).toUpperCase() + slot.status.slice(1).toLowerCase();
                      }
                      
                      // For BOOKED status, append booking ID if available
                      // For BLOCKED status, use blocked_label if available, otherwise show "Blocked"
                      if (slot.status === "BLOCKED") {
                        statusLabel = slot.blocked_label || "Blocked";
                      }
                      
                      label = statusLabel || "Unavailable";
                    }
                    else if (past) {
                      const hasBooking = slot.status === "BOOKED" || slot.booking_id;
                      if (hasBooking) {
                        let statusLabel = slot.booking_status_display || slot.status_display || "";
                        if (!statusLabel && slot.status) {
                          const statusMap: Record<string, string> = {
                            "AVAILABLE": "Available",
                            "BOOKED": "Booked",
                            "BLOCKED": "Blocked",
                            "UNDER_MAINTENANCE": "Under Maintenance",
                            "OPERATOR_ABSENT": "Operator Absent",
                            "BOOKING_NOT_UTILIZED": "Booking Not Utilized"
                          };
                          statusLabel = statusMap[slot.status] || slot.status.charAt(0).toUpperCase() + slot.status.slice(1).toLowerCase();
                        }
                        if (slot.status === "BLOCKED") {
                          statusLabel = slot.blocked_label || "Blocked";
                        }
                        label = statusLabel || "Unavailable";
                      } else {
                        label = "No Booking";
                      }
                    }
                    else if (available) label = "Available";
                    else {
                      let statusLabel = slot.booking_status_display || slot.status_display || "";
                      if (!statusLabel && slot.status) {
                        const statusMap: Record<string, string> = {
                          "AVAILABLE": "Available",
                          "NOT_AVAILABLE": "Not Available",
                          "BOOKED": "Booked",
                          "BLOCKED": "Blocked",
                          "UNDER_MAINTENANCE": "Under Maintenance",
                          "OPERATOR_ABSENT": "Operator Absent",
                          "BOOKING_NOT_UTILIZED": "Booking Not Utilized"
                        };
                        statusLabel = statusMap[slot.status] || slot.status.charAt(0).toUpperCase() + slot.status.slice(1).toLowerCase();
                      }
                      // For BLOCKED status, use blocked_label if available, otherwise show "Blocked"
                      if (slot.status === "BLOCKED") {
                        statusLabel = slot.blocked_label || "Blocked";
                      }
                      label = statusLabel || "—";
                    }
                  } else {
                    // No slot exists for this date/time - show holiday label if it's a holiday
                    const raw = holidays[dateStr];
                    label = typeof raw === "string" ? raw : (raw && typeof raw === "object" && "label" in raw ? (raw as { label: string }).label : "—");
                  }

                  const rawHoliday = holidays[dateStr];
                  const holidayColorReschedule = typeof rawHoliday === "object" && rawHoliday !== null && "color" in rawHoliday && (rawHoliday as { color?: string }).color
                    ? (rawHoliday as { color: string }).color
                    : undefined;

                  return (
                    <button
                      key={`${day.getTime()}-${timeStr}`}
                      type="button"
                      disabled={disabled}
                      onClick={() => slot && toggleSlot(slot)}
                      className={`
                        p-2 rounded text-xs transition-all min-h-[40px] flex items-center justify-center
                        ${!slot && !holidayColorReschedule ? "bg-muted/50 text-muted-foreground cursor-default" : ""}
                        ${past && slot ? "bg-muted text-muted-foreground cursor-not-allowed" : ""}
                        ${currentBooking && slot ? "bg-blue-200 border-2 border-blue-500 text-blue-900 font-semibold cursor-not-allowed opacity-75" : ""}
                        ${booked && slot && !currentBookingSlotIds.has(slot.id) ? "bg-destructive/20 text-destructive cursor-not-allowed" : ""}
                        ${selected ? "bg-primary text-primary-foreground cursor-pointer" : ""}
                        ${available && !selected && !currentBooking ? "bg-green-100 hover:bg-green-200 text-green-800 cursor-pointer" : ""}
                        ${available && disabled && !selected && !currentBooking ? "bg-green-100/60 text-green-800 cursor-not-allowed opacity-70" : ""}
                      `}
                      style={
                        !slot && holidayColorReschedule
                          ? { backgroundColor: holidayColorReschedule, color: getContrastTextColor(holidayColorReschedule) }
                          : undefined
                      }
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedSlots.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Selected {selectedSlots.length} of {requiredSlotCount} slot
          {requiredSlotCount !== 1 ? "s" : ""}.
          {selectedSlots.length === requiredSlotCount && " You can confirm reschedule."}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={confirmLoading}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleConfirm}
          disabled={confirmLoading || selectedSlots.length !== requiredSlotCount}
        >
          {confirmLoading ? "Rescheduling…" : "Confirm reschedule"}
        </Button>
      </div>
    </div>
  );
}

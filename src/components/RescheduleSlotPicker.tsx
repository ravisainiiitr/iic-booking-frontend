import { useEffect, useState, useCallback } from "react";
import { format, addDays, startOfWeek, addWeeks, isSameDay, parseISO, startOfDay } from "date-fns";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface RescheduleSlot {
  id: number;
  date: string;
  start_datetime: string;
  end_datetime: string;
  status: string;
  status_display?: string;
  booking_id?: number | null;
  booking_status?: string | null;
  booking_status_display?: string | null;
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
  onConfirm: (startTimeISO: string, endTimeISO: string) => void;
  onCancel: () => void;
  confirmLoading?: boolean;
}

export default function RescheduleSlotPicker({
  equipmentId,
  booking,
  onConfirm,
  onCancel,
  confirmLoading = false,
}: RescheduleSlotPickerProps) {
  const requiredSlotCount = booking.daily_slots?.length ?? 1;
  const currentBookingSlotIds = new Set((booking.daily_slots ?? []).map((s) => s.id));

  const [userType, setUserType] = useState<string | number | null>(null);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [slots, setSlots] = useState<RescheduleSlot[]>([]);
  const [holidays, setHolidays] = useState<Record<string, string>>({});
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
          const currentWeek = startOfWeek(now, { weekStartsOn: 0 });
          const userTypeValue: any = user.user_type;
          let normalizedType: string | null = null;
          if (typeof userTypeValue === 'string') {
            normalizedType = userTypeValue.toLowerCase();
          } else if (typeof userTypeValue === 'number') {
            normalizedType = userTypeValue === 1 ? 'student' : userTypeValue === 2 ? 'faculty' : null;
          }
          
          if (normalizedType === 'student' || normalizedType === 'faculty') {
            // Students/Faculty: Start with current week
            setWeekStart(currentWeek);
          } else {
            // Other users: Start with week beginning 15 days from current date
            const fifteenDaysFromNow = addDays(now, 15);
            setWeekStart(startOfWeek(fifteenDaysFromNow, { weekStartsOn: 0 }));
          }
        } else {
          // If not in localStorage, fetch from API
          const response = await apiClient.getCurrentUser();
          if (response.data) {
            setUserType(response.data.user_type || null);
            
            // Set initial week based on user type
            const now = new Date();
            const currentWeek = startOfWeek(now, { weekStartsOn: 0 });
            const userTypeValue: any = response.data.user_type;
            let normalizedType: string | null = null;
            if (typeof userTypeValue === 'string') {
              normalizedType = userTypeValue.toLowerCase();
            } else if (typeof userTypeValue === 'number') {
              normalizedType = userTypeValue === 1 ? 'student' : userTypeValue === 2 ? 'faculty' : null;
            }
            
            if (normalizedType === 'student' || normalizedType === 'faculty') {
              // Students/Faculty: Start with current week
              setWeekStart(currentWeek);
            } else {
              // Other users: Start with week beginning 15 days from current date
              const fifteenDaysFromNow = addDays(now, 15);
              setWeekStart(startOfWeek(fifteenDaysFromNow, { weekStartsOn: 0 }));
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

  // Check if a week is allowed for the current user
  const isWeekAllowed = (weekStartDate: Date): boolean => {
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
    const weekStartNormalized = startOfWeek(weekStartDate, { weekStartsOn: 0 });
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

  // Get allowed weeks for navigation
  const getAllowedWeeks = (): Date[] => {
    if (!userType) return [];
    
    const normalizedType = normalizeUserType(userType);
    if (!normalizedType) return [];
    
    const now = new Date();
    const currentWeek = startOfWeek(now, { weekStartsOn: 0 });
    const nextWeek = addWeeks(currentWeek, 1);
    
    // For other users: 15 days from current date, then one week window
    const fifteenDaysFromNow = addDays(now, 15);
    const allowedWeekStart = startOfWeek(fifteenDaysFromNow, { weekStartsOn: 0 });
    
    if (normalizedType === 'student' || normalizedType === 'faculty') {
      // Students/Faculty: Current week and next week
      return [currentWeek, nextWeek];
    } else {
      // Other users: One week window starting 15 days from current date
      return [allowedWeekStart];
    }
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
    const res = await apiClient.getEquipmentSlots(equipmentId, startStr, endStr);
    setLoadingSlots(false);
    if (res.data?.slots) {
      setSlots(res.data.slots);
    } else {
      setSlots([]);
    }
    setHolidays(res.data?.holidays ?? {});
    setSelectedSlots([]);
  }, [equipmentId, weekStart, userType]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

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
    return slot.status === "AVAILABLE";
  };

  const isSelected = (slot: RescheduleSlot): boolean =>
    selectedSlots.some((s) => s.id === slot.id);

  const isCurrentBooking = (slot: RescheduleSlot): boolean =>
    currentBookingSlotIds.has(slot.id);

  const isPast = (slot: RescheduleSlot): boolean => {
    try {
      return parseISO(slot.start_datetime) < new Date();
    } catch {
      return false;
    }
  };

  const isConsecutive = (newSlot: RescheduleSlot, current: RescheduleSlot[]): boolean => {
    if (current.length === 0) return true;
    const sorted = [...current].sort(
      (a, b) =>
        parseISO(a.start_datetime).getTime() - parseISO(b.start_datetime).getTime()
    );
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const newStart = parseISO(newSlot.start_datetime).getTime();
    const newEnd = parseISO(newSlot.end_datetime).getTime();
    const firstStart = parseISO(first.start_datetime).getTime();
    const lastEnd = parseISO(last.end_datetime).getTime();
    return newEnd === firstStart || newStart === lastEnd;
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

  const timeSlots = getUniqueTimes();
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
            const allowedWeeks = getAllowedWeeks();
            const currentIndex = allowedWeeks.findIndex(week => 
              startOfWeek(week, { weekStartsOn: 0 }).getTime() === startOfWeek(weekStart, { weekStartsOn: 0 }).getTime()
            );
            
            if (currentIndex > 0) {
              setWeekStart(allowedWeeks[currentIndex - 1]);
              setSelectedSlots([]);
            }
          }}
          disabled={(() => {
            const allowedWeeks = getAllowedWeeks();
            const currentIndex = allowedWeeks.findIndex(week => 
              startOfWeek(week, { weekStartsOn: 0 }).getTime() === startOfWeek(weekStart, { weekStartsOn: 0 }).getTime()
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
          {userType && (normalizeUserType(userType) === 'student' || normalizeUserType(userType) === 'faculty') && (
            <p className="text-xs text-muted-foreground mt-1">
              Available: Current week and next week only
            </p>
          )}
          {userType && normalizeUserType(userType) !== 'student' && normalizeUserType(userType) !== 'faculty' && (
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
            const allowedWeeks = getAllowedWeeks();
            const currentIndex = allowedWeeks.findIndex(week => 
              startOfWeek(week, { weekStartsOn: 0 }).getTime() === startOfWeek(weekStart, { weekStartsOn: 0 }).getTime()
            );
            
            if (currentIndex < allowedWeeks.length - 1) {
              setWeekStart(allowedWeeks[currentIndex + 1]);
              setSelectedSlots([]);
            }
          }}
          disabled={(() => {
            const allowedWeeks = getAllowedWeeks();
            const currentIndex = allowedWeeks.findIndex(week => 
              startOfWeek(week, { weekStartsOn: 0 }).getTime() === startOfWeek(weekStart, { weekStartsOn: 0 }).getTime()
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
                    else if (booked && !currentBookingSlotIds.has(slot.id))
                      label = slot.booking_status_display || slot.status_display || (slot.status === "BOOKED" ? "Booked" : "Blocked");
                    else if (past) label = slot.booking_status_display || slot.status_display || slot.status || "Available";
                    else if (available) label = "Available";
                    else label = slot.booking_status_display || slot.status_display || slot.status || "—";
                  } else {
                    label = holidays[dateStr] || "—";
                  }

                  return (
                    <button
                      key={`${day.getTime()}-${timeStr}`}
                      type="button"
                      disabled={disabled}
                      onClick={() => slot && toggleSlot(slot)}
                      className={`
                        p-2 rounded text-xs transition-all min-h-[40px] flex items-center justify-center
                        ${!slot ? "bg-muted/50 text-muted-foreground cursor-default" : ""}
                        ${past && slot ? "bg-muted text-muted-foreground cursor-not-allowed" : ""}
                        ${currentBooking && slot ? "bg-blue-200 border-2 border-blue-500 text-blue-900 font-semibold cursor-not-allowed opacity-75" : ""}
                        ${booked && slot && !currentBookingSlotIds.has(slot.id) ? "bg-destructive/20 text-destructive cursor-not-allowed" : ""}
                        ${selected ? "bg-primary text-primary-foreground cursor-pointer" : ""}
                        ${available && !selected && !currentBooking ? "bg-green-100 hover:bg-green-200 text-green-800 cursor-pointer" : ""}
                        ${available && disabled && !selected && !currentBooking ? "bg-green-100/60 text-green-800 cursor-not-allowed opacity-70" : ""}
                      `}
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

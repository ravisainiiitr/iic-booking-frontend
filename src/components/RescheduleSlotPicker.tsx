import { useEffect, useState, useCallback, type CSSProperties } from "react";
import { format, addDays, startOfWeek, addWeeks, subWeeks, parseISO, startOfDay } from "date-fns";
import { apiClient, type RescheduleEquipmentOption } from "@/lib/api";
import { isExternalBookingUserType, normalizeUserTypeCode } from "@/lib/userTypes";
import { isOutsideVisibilityWindow, restrictedSlotHint, restrictedSlotStyle } from "@/lib/slotVisibilityWindow";
import { slotRowEndTimes, slotTimeRangeLabel } from "@/lib/slotTimeRange";
import {
  resolveSlotCell,
  slotCalendarLegend,
  slotCalendarPalette,
  type CalendarColorsInput,
} from "@/lib/slotCalendarDisplay";
import { cn } from "@/lib/utils";
import RestrictedSlotLegend from "@/components/RestrictedSlotLegend";
import { NextWeekOpeningCountdown } from "@/components/booking/NextWeekOpeningCountdown";
import {
  SLOT_CELL_CLASS,
  SLOT_CELL_SELECTED_CLASS,
  SlotCalendarLegend,
  SlotWeekGrid,
  SlotWeekNav,
  slotCellStyle,
} from "@/components/slot-calendar/SlotWeekGrid";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SlotHoverCard } from "@/components/slot-calendar/SlotHoverCard";
import { toast } from "sonner";
import { Lock } from "lucide-react";

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
  booking_user_name?: string | null;
  booking_user_email?: string | null;
  booking_user_phone?: string | null;
  booking_user_department_name?: string | null;
  booking_user_department_code?: string | null;
  outside_visibility_window?: boolean;
}

/** Booking holder details shown when hovering the current booking. */
export interface RescheduleBookingHolder {
  display_booking_id?: string | number | null;
  user_name?: string | null;
  user_email?: string | null;
  user_phone?: string | null;
  user_department?: string | null;
  user_type?: string | null;
  supervisor_name?: string | null;
  status?: string | null;
}

export interface RescheduleBooking {
  booking_id: number;
  /** Numeric primary key when booking_id is a display value. */
  real_booking_id?: number | null;
  equipment: number;
  start_time: string;
  end_time: string;
  daily_slots: Array<{ id: number; start_datetime: string; end_datetime: string; date: string }>;
  holder?: RescheduleBookingHolder;
}

function formatBookingWindow(startIso: string, endIso: string): string {
  try {
    const s = parseISO(startIso);
    const e = parseISO(endIso);
    const sameDay = format(s, "yyyy-MM-dd") === format(e, "yyyy-MM-dd");
    return sameDay
      ? `${format(s, "EEE, d MMM yyyy, HH:mm")} – ${format(e, "HH:mm")}`
      : `${format(s, "EEE, d MMM yyyy, HH:mm")} – ${format(e, "EEE, d MMM yyyy, HH:mm")}`;
  } catch {
    return "";
  }
}

export function currentBookingDetailLines(booking: RescheduleBooking, slots: RescheduleSlot[]): string[] {
  const own = new Set((booking.daily_slots ?? []).map((s) => s.id));
  const slotInfo = slots.find((s) => own.has(s.id) && (s.booking_user_name || s.booking_user_email));
  const h = booking.holder ?? {};
  const clean = (v: unknown) => String(v ?? "").trim();
  const dept =
    clean(h.user_department) ||
    [clean(slotInfo?.booking_user_department_name), clean(slotInfo?.booking_user_department_code)]
      .filter(Boolean)
      .join(" / ");
  const lines: string[] = [];
  const bookingId = clean(h.display_booking_id) || clean(booking.booking_id);
  if (bookingId) lines.push(`Booking ID: ${bookingId}`);
  const name = clean(h.user_name) || clean(slotInfo?.booking_user_name);
  if (name) lines.push(`Name: ${name}`);
  const email = clean(h.user_email) || clean(slotInfo?.booking_user_email);
  if (email) lines.push(`Email: ${email}`);
  const phone = clean(h.user_phone) || clean(slotInfo?.booking_user_phone);
  if (phone) lines.push(`Mobile: ${phone}`);
  if (dept) lines.push(`Department: ${dept}`);
  if (clean(h.user_type)) lines.push(`User type: ${clean(h.user_type)}`);
  if (clean(h.supervisor_name)) lines.push(`Supervisor: ${clean(h.supervisor_name)}`);
  if (clean(h.status)) lines.push(`Status: ${clean(h.status)}`);
  const when = formatBookingWindow(booking.start_time, booking.end_time);
  if (when) lines.push(`Booked: ${when}`);
  const count = booking.daily_slots?.length ?? 0;
  if (count > 0) lines.push(`Slots: ${count}`);
  return lines;
}

interface RescheduleSlotPickerProps {
  equipmentId: number;
  booking: RescheduleBooking;
  /** When set, slots API extends internal slot window by one week (maintenance reschedule policy). */
  maintenanceExtraWeekBookingId?: number;
  /** targetEquipmentId is set only when the user picked another equipment of the same group. */
  onConfirm: (startTimeISO: string, endTimeISO: string, targetEquipmentId?: number) => void;
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

  /** Same-group equipment offered by the backend (only populated when cross-equipment rescheduling is enabled). */
  const [equipmentOptions, setEquipmentOptions] = useState<RescheduleEquipmentOption[]>([]);
  const [targetEquipmentId, setTargetEquipmentId] = useState<number>(equipmentId);
  const targetOption = equipmentOptions.find((o) => o.equipment_id === targetEquipmentId);
  const isCrossEquipment = targetEquipmentId !== equipmentId;

  const requiredSlotCount = isCrossEquipment && targetOption
    ? Math.max(1, targetOption.required_slots)
    : (booking.daily_slots?.length ?? 1);
  const currentBookingSlotIds = new Set((booking.daily_slots ?? []).map((s) => s.id));

  const optionsBookingId = Number(booking.real_booking_id ?? booking.booking_id);
  useEffect(() => {
    let cancelled = false;
    setTargetEquipmentId(equipmentId);
    setEquipmentOptions([]);
    if (!Number.isFinite(optionsBookingId) || optionsBookingId <= 0) return;
    apiClient
      .getBookingRescheduleOptions(optionsBookingId)
      .then((res) => {
        if (cancelled || !res.data?.cross_rescheduling_enabled) return;
        setEquipmentOptions(res.data.options ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [optionsBookingId, equipmentId]);

  const [userType, setUserType] = useState<string | number | null>(null);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [slots, setSlots] = useState<RescheduleSlot[]>([]);
  const [holidays, setHolidays] = useState<Record<string, string | { label: string; color?: string }>>({});
  const [calendarColors, setCalendarColors] = useState<CalendarColorsInput>(null);
  const [slotWindowMinDate, setSlotWindowMinDate] = useState<string | null>(null);
  const [slotWindowMaxDate, setSlotWindowMaxDate] = useState<string | null>(null);
  const [viewWindow, setViewWindow] = useState<{ from: string | null; to: string | null }>({ from: null, to: null });
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
          
          if (normalizedType === 'admin' || normalizedType === 'manager' || normalizedType === 'operator' || normalizedType === 'student' || normalizedType === 'faculty') {
            setWeekStart(currentWeek);
          } else {
            // External: start current week; API slot_window_* bounds drive navigation after slots load
            setWeekStart(currentWeek);
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
            if (normalizedType === 'admin' || normalizedType === 'manager' || normalizedType === 'operator' || normalizedType === 'student' || normalizedType === 'faculty') {
              setWeekStart(currentWeek);
            } else {
              // External: start current week; API slot_window_* bounds drive navigation after slots load
              setWeekStart(currentWeek);
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

  const isUnrestrictedStaff = (): boolean => {
    const t = normalizeUserType(userType);
    // Admin, OIC (manager), and Lab Operator may navigate any past/future week when rescheduling.
    return t === "admin" || t === "manager" || t === "operator";
  };

  // Check if a week is allowed (align with BookEquipment isWeekAllowed; extended nav mirrors isUrgentHoldMode)
  const isWeekAllowed = (weekStartDate: Date): boolean => {
    if (isUnrestrictedStaff()) return true;
    if (!userType) return false;
    const normalizedType = normalizeUserType(userType);
    if (!normalizedType) return false;
    const now = new Date();
    const currentWeek = startOfWeek(now, { weekStartsOn: 1 });
    const nextWeek = addWeeks(currentWeek, 1);
    const weekStartNormalized = startOfWeek(weekStartDate, { weekStartsOn: 1 });
    const currentWeekNormalized = startOfWeek(currentWeek, { weekStartsOn: 1 });
    const nextWeekNormalized = startOfWeek(nextWeek, { weekStartsOn: 1 });

    if (normalizedType === 'student' || normalizedType === 'faculty' || isExternalBookingUserType(normalizedType)) {
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

    if (useExtendedDisruptionWeekNav) {
      const weekAfterNext = addWeeks(nextWeek, 1);
      return (
        weekStartNormalized.getTime() === currentWeekNormalized.getTime() ||
        weekStartNormalized.getTime() === nextWeekNormalized.getTime() ||
        weekStartNormalized.getTime() === startOfWeek(weekAfterNext, { weekStartsOn: 1 }).getTime()
      );
    }
    return weekStartNormalized.getTime() === currentWeekNormalized.getTime();
  };

  // Get allowed weeks for navigation (staff: not used; nav has no restriction)
  const getAllowedWeeks = (): Date[] => {
    if (isUnrestrictedStaff()) return [];
    if (!userType) return [];
    const normalizedType = normalizeUserType(userType);
    if (!normalizedType) return [];
    const now = new Date();
    const currentWeek = startOfWeek(now, { weekStartsOn: 1 });
    const nextWeek = addWeeks(currentWeek, 1);
    if (normalizedType === 'student' || normalizedType === 'faculty' || isExternalBookingUserType(normalizedType)) {
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
    if (useExtendedDisruptionWeekNav) {
      return [currentWeek, nextWeek, addWeeks(nextWeek, 1)];
    }
    return [currentWeek];
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
    const res = await apiClient.getEquipmentSlots(targetEquipmentId, startStr, endStr, {
      maintenanceExtraWeekBookingId,
    });
    setLoadingSlots(false);
    if (res.data?.slots) {
      setSlots(res.data.slots);
    } else {
      setSlots([]);
    }
    setHolidays(res.data?.holidays ?? {});
    setCalendarColors(res.data?.calendar_colors ?? null);
    setSlotWindowMinDate(res.data?.slot_window_min_date ?? null);
    setSlotWindowMaxDate(res.data?.slot_window_max_date ?? null);
    setViewWindow({ from: res.data?.weekly_view_time_from ?? null, to: res.data?.weekly_view_time_to ?? null });
    setSelectedSlots([]);
  }, [targetEquipmentId, weekStart, userType, maintenanceExtraWeekBookingId]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  // Internal and external users: snap to an allowed week when the selected week is outside navigable weeks (matches BookEquipment)
  useEffect(() => {
    const nType = userType != null ? normalizeUserType(userType) : null;
    if (nType !== 'student' && nType !== 'faculty' && !isExternalBookingUserType(nType)) return;
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
    // Staff (Admin/OIC/Operator): can select any slot that is not booked by someone else
    if (isUnrestrictedStaff()) return slot.status !== "BOOKED";
    // External users: AVAILABLE slots (or available_for_external) are selectable
    const ut = String(userType ?? "").toLowerCase();
    const isExternal = isExternalBookingUserType(ut);
    if (isExternal) {
      return slot.available_for_external === true || slot.status === "AVAILABLE";
    }
    // Internal users: AVAILABLE slots are selectable.
    // Department reservation (home / non-home) is enforced by the API using
    // booker.department vs equipment.internal_department and reschedule_hours_threshold.
    return slot.status === "AVAILABLE";
  };

  const isSelected = (slot: RescheduleSlot): boolean =>
    selectedSlots.some((s) => s.id === slot.id);

  const isCurrentBooking = (slot: RescheduleSlot): boolean =>
    currentBookingSlotIds.has(slot.id);

  const isPast = (slot: RescheduleSlot): boolean => {
    if (isUnrestrictedStaff()) return false; // Staff can select any week/day; no past restriction
    try {
      return parseISO(slot.start_datetime) < new Date();
    } catch {
      return false;
    }
  };

  const timeSlots = getUniqueTimes();
  const rowEndTimes = slotRowEndTimes(
    slots,
    (s) => format(parseISO(s.start_datetime), "HH:mm"),
    (s) => (s.end_datetime ? format(parseISO(s.end_datetime), "HH:mm") : "")
  );

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
    onConfirm(startISO, endISO, isCrossEquipment ? targetEquipmentId : undefined);
  };

  const currentBookingLines = currentBookingDetailLines(booking, slots);
  const staffPicker = isUnrestrictedStaff();
  const palette = slotCalendarPalette(calendarColors);
  const allowedWeeks = getAllowedWeeks();
  const currentWeekIndex = allowedWeeks.findIndex(
    (week) =>
      startOfWeek(week, { weekStartsOn: 1 }).getTime() === startOfWeek(weekStart, { weekStartsOn: 1 }).getTime()
  );
  const goToWeek = (step: -1 | 1) => {
    if (staffPicker) {
      setWeekStart(step < 0 ? subWeeks(weekStart, 1) : addWeeks(weekStart, 1));
      setSelectedSlots([]);
      return;
    }
    const target = allowedWeeks[currentWeekIndex + step];
    if (currentWeekIndex >= 0 && target) {
      setWeekStart(target);
      setSelectedSlots([]);
    }
  };

  return (
    <div className="space-y-4">
      {equipmentOptions.length > 1 && (
        <div className="space-y-1">
          <Label className="text-sm font-medium">Equipment</Label>
          <Select
            value={String(targetEquipmentId)}
            onValueChange={(v) => {
              setTargetEquipmentId(Number(v));
              setSelectedSlots([]);
            }}
            disabled={confirmLoading}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {equipmentOptions.map((o) => (
                <SelectItem key={o.equipment_id} value={String(o.equipment_id)}>
                  {o.name}{o.is_original ? " — current" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isCrossEquipment && targetOption && (
            <p className="text-xs text-muted-foreground">
              Your booking will move to {targetOption.name} (same equipment group). The amount already charged stays
              unchanged.
              {targetOption.charge_differs ? " This equipment has a different tariff; the original charge is kept." : ""}
              {targetOption.dropped_fields && targetOption.dropped_fields.length > 0
                ? ` Not carried over: ${targetOption.dropped_fields.map((f) => f.label).join(", ")}.`
                : ""}
            </p>
          )}
        </div>
      )}
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

      <SlotWeekNav
        weekStart={weekStart}
        onPrevious={() => goToWeek(-1)}
        onNext={() => goToWeek(1)}
        canPrevious={staffPicker || currentWeekIndex > 0}
        canNext={staffPicker || currentWeekIndex < allowedWeeks.length - 1}
        subtitle={
          staffPicker ? (
            "No week restriction — navigate to any past or future week"
          ) : userType && (normalizeUserType(userType) === "student" || normalizeUserType(userType) === "faculty") ? (
            slotWindowMinDate && slotWindowMaxDate ? (
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
            )
          ) : userType ? (
            slotWindowMinDate && slotWindowMaxDate ? (
              <>
                Available: {format(parseISO(slotWindowMinDate), "MMM d")} –{" "}
                {format(parseISO(slotWindowMaxDate), "MMM d, yyyy")}
              </>
            ) : (
              "Available: Dates within the equipment booking window from the server"
            )
          ) : null
        }
      />

      <NextWeekOpeningCountdown equipmentId={targetEquipmentId} className="mx-auto flex w-fit" />

      {!loadingSlots && slots.some((s) => isOutsideVisibilityWindow(s)) && (
        <RestrictedSlotLegend from={viewWindow.from} to={viewWindow.to} />
      )}

      {loadingSlots ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
      ) : timeSlots.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          No slots available for this week. Try another week.
        </p>
      ) : (
        <>
          <SlotWeekGrid
            weekStart={weekStart}
            rows={timeSlots.map((timeStr) => ({
              key: timeStr,
              label: <span className="whitespace-nowrap">{slotTimeRangeLabel(timeStr, rowEndTimes.get(timeStr))}</span>,
            }))}
            singleDayOnMobile
            dayHasFreeSlot={(day) =>
              timeSlots.some((t) => {
                const s = getSlotAt(day, t);
                return Boolean(s && isAvailable(s) && !isPast(s) && !isCurrentBooking(s));
              })
            }
            renderCell={(day, timeStr) => {
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

              const display = resolveSlotCell({
                slot,
                day,
                holiday: holidays[dateStr],
                palette,
                staffView: staffPicker,
              });
              const restrictedToStaff = isOutsideVisibilityWindow(slot);
              const baseStyle: CSSProperties | undefined =
                selected || currentBooking ? undefined : slotCellStyle(display);
              const label = selected ? "Selected" : currentBooking ? "Current Booking" : display.label;
              const cell = (
                <button
                  type="button"
                  disabled={Boolean(disabled)}
                  title={restrictedToStaff ? restrictedSlotHint(viewWindow.from, viewWindow.to) : display.hover}
                  onClick={() => slot && toggleSlot(slot)}
                  className={cn(
                    SLOT_CELL_CLASS,
                    "transition-all",
                    selected && SLOT_CELL_SELECTED_CLASS,
                    currentBooking &&
                      "pointer-events-none border-blue-500 bg-blue-200 font-semibold text-blue-900 dark:bg-blue-900/60 dark:text-blue-100",
                    !disabled && !selected && "cursor-pointer hover:opacity-90 hover:shadow-md",
                    disabled && !currentBooking && "cursor-not-allowed",
                    available && disabled && !selected && !currentBooking && "opacity-70",
                  )}
                  style={restrictedToStaff ? restrictedSlotStyle(baseStyle) : baseStyle}
                >
                  {restrictedToStaff ? <Lock className="mr-1 h-3 w-3 shrink-0" aria-label="Visible only to OIC and administrators" /> : null}
                  {label}
                </button>
              );
              if (!currentBooking || currentBookingLines.length === 0) return cell;
              return (
                <SlotHoverCard lines={["Current booking", ...currentBookingLines]} boldFirst>
                  <div
                    className="grid cursor-help rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    tabIndex={0}
                    aria-label={`Current booking. ${currentBookingLines.join(". ")}`}
                  >
                    {cell}
                  </div>
                </SlotHoverCard>
              );
            }}
          />
          <SlotCalendarLegend items={slotCalendarLegend(palette)} />
        </>
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

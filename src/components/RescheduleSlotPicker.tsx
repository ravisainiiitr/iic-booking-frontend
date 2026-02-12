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

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [slots, setSlots] = useState<RescheduleSlot[]>([]);
  const [holidays, setHolidays] = useState<Record<string, string>>({});
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [selectedSlots, setSelectedSlots] = useState<RescheduleSlot[]>([]);

  const fetchSlots = useCallback(async () => {
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
  }, [equipmentId, weekStart]);

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
    if (!isAvailable(slot) || isPast(slot)) return;

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
          onClick={() => setWeekStart((w) => addWeeks(w, -1))}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous week
        </Button>
        <Label className="text-sm font-medium shrink-0">
          {format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d, yyyy")}
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setWeekStart((w) => addWeeks(w, 1))}
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
                  const booked = slot && !isAvailable(slot);
                  const past = slot && isPast(slot);
                  const disabled =
                    !slot ||
                    past ||
                    (booked && !currentBookingSlotIds.has(slot.id)) ||
                    (available &&
                      !selected &&
                      (selectedSlots.length >= requiredSlotCount ||
                        (selectedSlots.length > 0 && !isConsecutive(slot, selectedSlots))));

                  let label: string;
                  if (slot) {
                    if (selected) label = "Selected";
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
                        ${booked && slot && !currentBookingSlotIds.has(slot.id) ? "bg-destructive/20 text-destructive cursor-not-allowed" : ""}
                        ${selected ? "bg-primary text-primary-foreground cursor-pointer" : ""}
                        ${available && !selected ? "bg-green-100 hover:bg-green-200 text-green-800 cursor-pointer" : ""}
                        ${available && disabled && !selected ? "bg-green-100/60 text-green-800 cursor-not-allowed opacity-70" : ""}
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

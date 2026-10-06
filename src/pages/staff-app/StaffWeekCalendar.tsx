import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addDays, format, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LabOperatorWeekCalendarGrid } from "@/components/LabOperatorWeekCalendarGrid";
import { NextWeekOpeningCountdown } from "@/components/booking/NextWeekOpeningCountdown";
import { apiClient, type StaffAppToday } from "@/lib/api";
import type { LabWeekCalendarSlotsPayload } from "@/lib/labOperatorCalendarTypes";
import { cn } from "@/lib/utils";

type Props = {
  equipment: StaffAppToday["equipment"];
};

function mondayOf(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

/** One instrument at a time, booked slots first; tap a booking to open its job sheet. */
export default function StaffWeekCalendar({ equipment }: Props) {
  const navigate = useNavigate();
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [equipmentId, setEquipmentId] = useState<number | null>(equipment[0]?.equipment_id ?? null);
  const [bookedOnly, setBookedOnly] = useState(true);
  const [payload, setPayload] = useState<LabWeekCalendarSlotsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (equipmentId == null || !equipment.some((e) => e.equipment_id === equipmentId)) {
      setEquipmentId(equipment[0]?.equipment_id ?? null);
    }
  }, [equipment, equipmentId]);

  const weekStartIso = format(weekStart, "yyyy-MM-dd");
  const weekEndIso = format(addDays(weekStart, 6), "yyyy-MM-dd");
  const selected = useMemo(() => equipment.find((e) => e.equipment_id === equipmentId) ?? null, [equipment, equipmentId]);

  useEffect(() => {
    if (equipmentId == null) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    Promise.all([
      apiClient.getEquipmentSlots(equipmentId, weekStartIso, weekEndIso, { applyWeeklyViewTimeFilter: true }),
      apiClient.getLabDashboardCalendarColors(),
    ])
      .then(([slotsRes, prefsRes]) => {
        if (cancelled) return;
        if (!slotsRes.data) {
          setPayload(null);
          setFailed(true);
          return;
        }
        const base = slotsRes.data as LabWeekCalendarSlotsPayload;
        const overrides = prefsRes.data?.by_equipment?.[String(equipmentId)];
        setPayload(
          overrides && Object.keys(overrides).length > 0
            ? {
                ...base,
                calendar_colors: {
                  ...(base.calendar_colors || {}),
                  slot_colors: { ...(base.calendar_colors?.slot_colors || {}), ...overrides },
                  holiday_default: base.calendar_colors?.holiday_default || "#e9d5ff",
                  saturday_color: base.calendar_colors?.saturday_color,
                  sunday_color: base.calendar_colors?.sunday_color,
                },
              }
            : base,
        );
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [equipmentId, weekStartIso, weekEndIso]);

  if (equipment.length === 0) {
    return <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No instruments are assigned to you.</p>;
  }

  const isThisWeek = weekStartIso === format(mondayOf(new Date()), "yyyy-MM-dd");

  return (
    <div className="space-y-3">
      {equipment.length > 1 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Instrument">
          {equipment.map((eq) => (
            <button
              key={eq.equipment_id}
              type="button"
              role="tab"
              aria-selected={eq.equipment_id === equipmentId}
              onClick={() => setEquipmentId(eq.equipment_id)}
              className={cn(
                "min-h-10 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors",
                eq.equipment_id === equipmentId
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:bg-muted",
              )}
            >
              {eq.code || eq.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" className="h-10 w-10" aria-label="Previous week" onClick={() => setWeekStart((d) => addDays(d, -7))}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <button
          type="button"
          className="min-h-10 flex-1 rounded-md text-center text-sm font-medium tabular-nums text-foreground"
          onClick={() => setWeekStart(mondayOf(new Date()))}
          disabled={isThisWeek}
          title="This week"
        >
          {format(weekStart, "d MMM")} – {format(addDays(weekStart, 6), "d MMM yyyy")}
          {!isThisWeek && <span className="block text-xs font-normal text-primary">Back to this week</span>}
        </button>
        <Button variant="outline" size="icon" className="h-10 w-10" aria-label="Next week" onClick={() => setWeekStart((d) => addDays(d, 7))}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <label className="flex min-h-10 items-center gap-2 text-sm text-foreground">
        <input type="checkbox" className="h-5 w-5 accent-[hsl(var(--primary))]" checked={bookedOnly} onChange={(e) => setBookedOnly(e.target.checked)} />
        Booked slots only
      </label>

      {loading && !payload ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed py-10 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" /> Loading calendar…
        </div>
      ) : failed ? (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">The calendar could not be loaded. Pull down or try again.</p>
      ) : (
        <div className={cn("transition-opacity", loading && "opacity-60")}>
          <LabOperatorWeekCalendarGrid
            weekStartIso={weekStartIso}
            equipmentTitle={selected ? selected.name || selected.code : ""}
            slotsPayload={payload}
            bookedSlotsOnly={bookedOnly}
            onBookedSlotClick={(bookingId) => navigate(`/booking-management?expand=${bookingId}`)}
            headerActions={equipmentId != null ? <NextWeekOpeningCountdown equipmentId={equipmentId} audience="staff" /> : undefined}
          />
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, ExternalLink, Loader2, Microscope } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import Footer from "@/components/Footer";
import DepartmentFilter, { type DepartmentFilterValue } from "@/components/DepartmentFilter";
import EquipmentAvailabilityCalendar from "@/components/EquipmentAvailabilityCalendar";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useEmbeddedMode } from "@/contexts/EmbeddedModeContext";
import {
  DEFAULT_CATALOG_DEPARTMENT_NAME,
  loadCatalogEquipment,
  type CatalogEquipmentRow,
} from "@/lib/catalogCache";
import { normalizeUserTypeCode } from "@/lib/userTypes";

type CalendarEquipment = CatalogEquipmentRow & { weekly_view_display?: "TIME" | "SLOT_ID" | null };

/** Weekly availability calendar for any equipment, picked by department then equipment. */
export default function BookingCalendar() {
  const embedded = useEmbeddedMode();
  const { user } = useAuth();
  const userTypeNorm = normalizeUserTypeCode(user?.user_type ?? null);
  const staffSeesTimes = userTypeNorm === "admin" || userTypeNorm === "manager" || userTypeNorm === "dept_admin";

  const [departmentId, setDepartmentId] = useState<DepartmentFilterValue>("all");
  const [departmentReady, setDepartmentReady] = useState(false);
  const [equipment, setEquipment] = useState<CalendarEquipment[]>([]);
  const [loadingEquipment, setLoadingEquipment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    if (!departmentReady) return;
    let cancelled = false;
    setLoadingEquipment(true);
    setError(null);
    loadCatalogEquipment(departmentId, null)
      .then((list) => {
        if (cancelled) return;
        const rows = list as CalendarEquipment[];
        setEquipment(rows);
        setSelectedId((prev) => (prev != null && rows.some((r) => r.equipment_id === prev) ? prev : rows[0]?.equipment_id ?? null));
      })
      .catch((e) => {
        if (cancelled) return;
        setEquipment([]);
        setSelectedId(null);
        setError(e instanceof Error ? e.message : "Could not load equipment.");
      })
      .finally(() => {
        if (!cancelled) setLoadingEquipment(false);
      });
    return () => {
      cancelled = true;
    };
  }, [departmentId, departmentReady]);

  const selected = useMemo(
    () => equipment.find((e) => e.equipment_id === selectedId) ?? null,
    [equipment, selectedId],
  );
  const weeklyViewDisplay: "TIME" | "SLOT_ID" =
    staffSeesTimes ? "TIME" : selected?.weekly_view_display === "SLOT_ID" ? "SLOT_ID" : "TIME";

  const handleDepartment = (value: DepartmentFilterValue) => {
    setDepartmentId(value);
    setDepartmentReady(true);
  };

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className={embedded ? "container mx-auto px-3 py-4" : "container mx-auto px-4 py-8"}>
        {!embedded && (
          <div className="mb-5 rounded-2xl bg-gradient-to-r from-brand via-brand to-brand-accent p-5 text-white shadow-lg">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Booking Calendar</h1>
                <p className="text-white/90 text-sm">Weekly slot availability for any equipment</p>
              </div>
            </div>
          </div>
        )}

        <section className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:gap-6 max-w-5xl">
          <DepartmentFilter
            value={departmentId}
            onChange={handleDepartment}
            onResolved={handleDepartment}
            className="min-w-0 flex-1"
            triggerClassName="h-11 rounded-xl w-full text-sm font-semibold"
            defaultDepartmentName={DEFAULT_CATALOG_DEPARTMENT_NAME}
            disabled={!departmentReady}
          />
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 max-w-md w-full">
            <Label htmlFor="booking-calendar-equipment" className="shrink-0 text-base font-semibold whitespace-nowrap">
              Select Equipment
            </Label>
            <Select
              value={selectedId != null ? String(selectedId) : ""}
              onValueChange={(v) => setSelectedId(parseInt(v, 10))}
              disabled={loadingEquipment || equipment.length === 0}
            >
              <SelectTrigger id="booking-calendar-equipment" className="h-11 rounded-xl w-full text-sm font-semibold">
                <div className="flex items-center gap-2 min-w-0 w-full">
                  {loadingEquipment ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                  ) : (
                    <Microscope className="h-4 w-4 shrink-0 text-primary" />
                  )}
                  <SelectValue placeholder={loadingEquipment ? "Loading equipment…" : "No equipment"} />
                </div>
              </SelectTrigger>
              <SelectContent className="max-w-[min(100vw-2rem,32rem)]">
                {equipment.map((eq) => (
                  <SelectItem key={eq.equipment_id} value={String(eq.equipment_id)} className="py-2">
                    <span className="whitespace-normal break-words leading-snug">
                      {eq.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>

        <section className="rounded-xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
          {!departmentReady || (loadingEquipment && !selected) ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="py-10 text-center text-sm text-destructive">{error}</p>
          ) : !selected ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No equipment is listed for this department.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold leading-tight">{selected.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {[selected.code, selected.internal_department_name, selected.status_display]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <Link
                  to={`/equipment/${selected.equipment_id}`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  Equipment details
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
              <EquipmentAvailabilityCalendar
                key={selected.equipment_id}
                equipmentId={selected.equipment_id}
                weeklyViewDisplay={weeklyViewDisplay}
              />
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}

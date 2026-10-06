import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarClock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiClient, type SlotStatusPickerEquipment, type StaffListFiltersMeta } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import DashboardHeader from "@/components/DashboardHeader";
import { StandaloneOnly } from "@/components/PageShell";
import { StaffListFilterRow, useStaffListFilters } from "@/components/StaffListFilters";
import { StatusChip, type StatusChipTone } from "@/components/StaffListCells";

/** Main Admin and OIC change slot status (the backend limits an OIC to their own and temporary-OIC equipment). */
const CHANGE_SLOT_STATUS_ROLES = ["admin", "manager"];

function changeSlotStatusPath(equipmentId: number): string {
  return `/book-equipment?equipment_id=${equipmentId}&mode=status`;
}

function statusTone(status: string): StatusChipTone {
  const s = (status || "").toUpperCase();
  if (s === "ACTIVE") return "green";
  if (s === "REPAIR" || s === "INACTIVE" || s === "MAINTENANCE") return "amber";
  return "gray";
}

export default function ChangeSlotStatus() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userType = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const canView = CHANGE_SLOT_STATUS_ROLES.includes(userType);

  const filters = useStaffListFilters();
  const { departmentReady, reconcileEquipment } = filters;
  const { departmentId, equipmentId } = filters.query;
  const [equipmentOptions, setEquipmentOptions] = useState<StaffListFiltersMeta["equipment_options"]>([]);
  const [rows, setRows] = useState<SlotStatusPickerEquipment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canView) navigate("/dashboard");
  }, [canView, navigate]);

  const loadSeq = useRef(0);
  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setLoading(true);
    try {
      const res = await apiClient.getSlotStatusPicker({ departmentId, equipmentId });
      if (seq !== loadSeq.current) return;
      if (res.error || !res.data) {
        toast.error(res.error || "Failed to load equipment");
        setRows([]);
        return;
      }
      setRows(res.data.equipment);
      setEquipmentOptions(res.data.filters.equipment_options);
      reconcileEquipment(res.data.filters.equipment_options);
    } catch {
      if (seq === loadSeq.current) {
        toast.error("Failed to load equipment");
        setRows([]);
      }
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [departmentId, equipmentId, reconcileEquipment]);

  useEffect(() => {
    if (!canView || !departmentReady) return;
    void load();
  }, [canView, departmentReady, load]);

  if (!canView) return null;

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto max-w-5xl px-4 py-5">
        <StandaloneOnly>
          <div className="mb-6 rounded-2xl bg-gradient-to-r from-brand via-brand to-brand-accent p-6 text-white shadow-xl">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
              className="-ml-2 mb-3 text-white/90 hover:bg-white/20 hover:text-white"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
            <h1 className="text-2xl font-semibold tracking-tight">Change slot status</h1>
            <p className="mt-2 text-sm text-white/85">
              Pick an equipment to open its slot calendar and mark slots Available, Blocked, Under maintenance and so on.
            </p>
          </div>
        </StandaloneOnly>
        <Card className="mb-20 rounded-xl border-border/70 shadow-sm">
          <CardHeader className="px-4 pb-3 sm:px-5">
            <CardTitle className="text-base">Equipment</CardTitle>
            <CardDescription>
              {filters.showDepartment
                ? "Choose a department and equipment, then open Change slot status."
                : "Equipment you are Officer In-charge of, including equipment you are covering as temporary OIC."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-4 sm:px-5">
            <StaffListFilterRow filters={filters} equipmentOptions={equipmentOptions} />

            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading equipment…
              </div>
            ) : rows.length === 0 ? (
              <p className="text-muted-foreground">No equipment found.</p>
            ) : (
              <ul className="divide-y divide-border/60 rounded-lg border border-border/70" aria-label="Equipment">
                {rows.map((row) => (
                  <li key={row.equipment_id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium" title={row.name}>
                        {row.name}
                        {row.code && !row.name.toLowerCase().includes(row.code.toLowerCase()) ? (
                          <span className="ml-1.5 font-mono text-xs text-muted-foreground">{row.code}</span>
                        ) : null}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <StatusChip tone={statusTone(row.status)}>{row.status_display || row.status || "—"}</StatusChip>
                        {row.temporary_oic ? <StatusChip tone="gray">Temporary OIC</StatusChip> : null}
                        {filters.showDepartment && (row.department_code || row.department_name) ? (
                          <span title={row.department_name}>{row.department_code || row.department_name}</span>
                        ) : null}
                      </div>
                    </div>
                    <Button size="sm" onClick={() => navigate(changeSlotStatusPath(row.equipment_id))}>
                      <CalendarClock className="mr-1.5 h-4 w-4" />
                      Change slot status
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

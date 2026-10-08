import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Package } from "lucide-react";
import { toast } from "sonner";
import { apiClient, type SlotStatusPickerEquipment } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useEmbeddedMode } from "@/contexts/EmbeddedModeContext";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DashboardHeader from "@/components/DashboardHeader";
import DepartmentFilter, { type DepartmentFilterValue } from "@/components/DepartmentFilter";
import { DEFAULT_CATALOG_DEPARTMENT_NAME } from "@/lib/catalogCache";
import { catalogDepartmentFromParam } from "@/lib/equipmentCatalog";

const BookEquipment = lazy(() => import("@/pages/BookEquipment"));

/** Main Admin and OIC change slot status (the backend limits an OIC to their own and temporary-OIC equipment). */
const CHANGE_SLOT_STATUS_ROLES = ["admin", "manager"];

const positiveInt = (raw: string | null): number | null => {
  const n = raw ? Number(raw) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
};

const isOperational = (status: string) => (status || "").toUpperCase() === "ACTIVE";

/**
 * Change slot status: Department (Main Admin only, IIC by default) and Equipment on one row above the
 * equipment's slot calendar. `?equipment_id=` preselects that equipment and its department; otherwise
 * the first equipment of the list opens.
 */
export default function ChangeSlotStatus() {
  const navigate = useNavigate();
  const embedded = useEmbeddedMode();
  const { user } = useAuth();
  const userType = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const canView = CHANGE_SLOT_STATUS_ROLES.includes(userType);
  const showDepartment = userType === "admin";

  const [searchParams, setSearchParams] = useSearchParams();
  const equipmentParam = positiveInt(searchParams.get("equipment_id"));
  const [urlDepartment] = useState(() => catalogDepartmentFromParam(searchParams.get("dept")));
  const [linkedEquipment] = useState(() => equipmentParam);
  const [departmentId, setDepartmentId] = useState<DepartmentFilterValue>(() => urlDepartment ?? "all");
  const [departmentReady, setDepartmentReady] = useState(() => !showDepartment || urlDepartment != null);
  // Main Admin opening a linked equipment: look up its department before the IIC default applies.
  const [departmentLookupDone, setDepartmentLookupDone] = useState(
    () => !showDepartment || urlDepartment != null || linkedEquipment == null,
  );
  const [rows, setRows] = useState<SlotStatusPickerEquipment[] | null>(null);

  useEffect(() => {
    if (!canView) navigate("/dashboard");
  }, [canView, navigate]);

  const writeDepartment = useCallback(
    (value: DepartmentFilterValue, dropEquipment: boolean) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.set("dept", String(value));
          if (dropEquipment) {
            params.delete("equipment_id");
            params.delete("mode");
            params.delete("month");
          }
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    if (!canView || departmentLookupDone || linkedEquipment == null) return;
    let cancelled = false;
    void apiClient
      .getSlotStatusPicker({ equipmentId: linkedEquipment })
      .then((res) => {
        if (cancelled) return;
        const dept = res.data?.equipment.find((r) => r.equipment_id === linkedEquipment)?.department_id;
        if (dept != null) {
          setDepartmentId(dept);
          setDepartmentReady(true);
          writeDepartment(dept, false);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setDepartmentLookupDone(true);
      });
    return () => {
      cancelled = true;
    };
  }, [canView, departmentLookupDone, linkedEquipment, writeDepartment]);

  const loadSeq = useRef(0);
  useEffect(() => {
    if (!canView || !departmentReady) return;
    const seq = ++loadSeq.current;
    setRows(null);
    const query = showDepartment && departmentId !== "all" ? { departmentId } : {};
    void apiClient
      .getSlotStatusPicker(query)
      .then((res) => {
        if (seq !== loadSeq.current) return;
        if (res.error || !res.data) toast.error(res.error || "Failed to load equipment");
        setRows(res.data?.equipment ?? []);
      })
      .catch(() => {
        if (seq !== loadSeq.current) return;
        toast.error("Failed to load equipment");
        setRows([]);
      });
  }, [canView, departmentReady, departmentId, showDepartment]);

  const selectedId = rows && equipmentParam != null && rows.some((r) => r.equipment_id === equipmentParam) ? equipmentParam : null;

  const selectEquipment = useCallback(
    (id: number) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (params.get("equipment_id") !== String(id)) {
            params.delete("mode");
            params.delete("month");
          }
          params.set("equipment_id", String(id));
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // Open the first equipment when none (or one outside the list) is in the URL.
  useEffect(() => {
    if (!rows || selectedId != null) return;
    if (rows.length > 0) selectEquipment(rows[0].equipment_id);
    else if (equipmentParam != null) {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.delete("equipment_id");
          return params;
        },
        { replace: true },
      );
    }
  }, [rows, selectedId, equipmentParam, selectEquipment, setSearchParams]);

  if (!canView) return null;

  const loading = rows == null;
  const filterRow = (
    <div className="flex flex-wrap items-center gap-2" data-testid="slot-status-filters">
      {showDepartment ? (
        departmentLookupDone ? (
          <DepartmentFilter
            value={departmentId}
            onChange={(value) => {
              setDepartmentId(value);
              writeDepartment(value, true);
            }}
            onResolved={(value) => {
              setDepartmentId(value);
              setDepartmentReady(true);
            }}
            defaultDepartmentName={!departmentReady && urlDepartment == null ? DEFAULT_CATALOG_DEPARTMENT_NAME : undefined}
            hideLabel
            compactTrigger
            className="w-full sm:w-auto sm:shrink-0"
            triggerClassName="h-9 min-w-0 w-full gap-2 rounded-lg text-sm font-semibold shadow-sm sm:w-auto sm:min-w-[10rem] [&_span]:whitespace-nowrap"
          />
        ) : (
          <div className="flex h-9 w-full items-center gap-2 rounded-lg border px-3 text-sm text-muted-foreground shadow-sm sm:w-40">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Department…
          </div>
        )
      ) : null}
      <Select
        value={selectedId != null ? String(selectedId) : ""}
        onValueChange={(v) => selectEquipment(Number(v))}
        disabled={loading || rows.length === 0}
      >
        <SelectTrigger
          className="h-9 w-full min-w-0 rounded-lg text-sm font-semibold shadow-sm sm:w-[26rem] sm:max-w-full"
          aria-label="Equipment"
        >
          <div className="flex min-w-0 items-center gap-2">
            {loading ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
            ) : (
              <Package className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            )}
            <SelectValue placeholder={loading ? "Loading equipment…" : "No equipment"} className="truncate" />
          </div>
        </SelectTrigger>
        <SelectContent className="max-w-[min(100vw-2rem,32rem)]">
          {(rows ?? []).map((row) => (
            <SelectItem key={row.equipment_id} value={String(row.equipment_id)}>
              <span className="whitespace-normal break-words">
                {row.name || row.code}
                {!isOperational(row.status) && row.status_display ? (
                  <span className="ml-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">· {row.status_display}</span>
                ) : null}
                {row.temporary_oic ? (
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">· Temporary OIC</span>
                ) : null}
                {showDepartment && departmentId === "all" && row.department_code ? (
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">· {row.department_code}</span>
                ) : null}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const shell = (body: ReactNode) => (
    <div className={embedded ? "relative" : "page-shell"}>
      <DashboardHeader />
      <main className={embedded ? "w-full space-y-3 px-0 py-2" : "mx-auto w-full max-w-[1800px] space-y-3 px-4 py-4 md:px-6 md:py-6"}>
        {filterRow}
        {body}
      </main>
    </div>
  );

  const loadingCard = (
    <Card className="rounded-2xl">
      <CardContent className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        Loading equipment…
      </CardContent>
    </Card>
  );

  if (selectedId == null) {
    if (loading || rows.length > 0) return shell(loadingCard);
    return shell(
      <Card className="rounded-2xl">
        <CardContent className="py-12 text-center text-muted-foreground">
          {showDepartment
            ? "No equipment in this department. Choose another Department/Centre."
            : "You are not Officer In-charge of any equipment right now, including as temporary OIC."}
        </CardContent>
      </Card>,
    );
  }

  return (
    <Suspense fallback={shell(loadingCard)}>
      <BookEquipment key={selectedId} slotStatusFilters={filterRow} />
    </Suspense>
  );
}

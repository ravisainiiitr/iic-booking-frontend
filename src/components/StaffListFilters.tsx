import { useCallback, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Package } from "lucide-react";
import DepartmentFilter, { type DepartmentFilterValue } from "@/components/DepartmentFilter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import type { StaffListFiltersMeta } from "@/lib/api";
import { DEFAULT_CATALOG_DEPARTMENT_NAME } from "@/lib/catalogCache";
import { catalogDepartmentFromParam } from "@/lib/equipmentCatalog";
import { cn } from "@/lib/utils";

export type StaffEquipmentOption = StaffListFiltersMeta["equipment_options"][number];
export type StaffEquipmentFilterValue = "all" | number;

const ALL = "all";

const equipmentFromParam = (raw: string | null): StaffEquipmentFilterValue => {
  const n = raw ? Number(raw) : NaN;
  return Number.isInteger(n) && n > 0 ? n : ALL;
};

/**
 * Department (default IIC) and Equipment (default All) filters for staff lists, kept in the URL as
 * `dept` and `equipment`. Only the Main Admin picks a department: a Department Administrator is
 * mapped to one department and an OIC / Lab Operator to their equipment, so the server already limits
 * their rows and the Department filter is hidden. Query params never widen that server-side scope.
 */
export function useStaffListFilters() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const showDepartment = String(user?.user_type ?? "").toLowerCase() === "admin";
  const [urlDepartment] = useState(() => catalogDepartmentFromParam(searchParams.get("dept")));
  const [departmentId, setDepartmentIdState] = useState<DepartmentFilterValue>(() => urlDepartment ?? ALL);
  const [departmentReady, setDepartmentReady] = useState(() => !showDepartment || urlDepartment != null);
  const equipmentId = equipmentFromParam(searchParams.get("equipment"));

  const setDepartment = useCallback(
    (next: DepartmentFilterValue) => {
      setDepartmentIdState(next);
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.set("dept", String(next));
          params.delete("equipment");
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setEquipment = useCallback(
    (next: StaffEquipmentFilterValue) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next === ALL) params.delete("equipment");
          else params.set("equipment", String(next));
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const onDepartmentResolved = useCallback((value: DepartmentFilterValue) => {
    setDepartmentIdState(value);
    setDepartmentReady(true);
  }, []);

  /** Drop an equipment choice that is not among the options the server returned (e.g. after a department change). */
  const reconcileEquipment = useCallback(
    (options: StaffEquipmentOption[]) => {
      if (equipmentId !== ALL && !options.some((o) => o.equipment_id === equipmentId)) setEquipment(ALL);
    },
    [equipmentId, setEquipment],
  );

  return {
    showDepartment,
    departmentId,
    departmentReady,
    defaultDepartmentName: urlDepartment == null ? DEFAULT_CATALOG_DEPARTMENT_NAME : undefined,
    setDepartment,
    onDepartmentResolved,
    equipmentId,
    setEquipment,
    reconcileEquipment,
    /** Params for the list endpoints. */
    query: {
      departmentId: showDepartment && departmentId !== ALL ? departmentId : undefined,
      equipmentId: equipmentId !== ALL ? equipmentId : undefined,
    },
  };
}

export type StaffListFiltersState = ReturnType<typeof useStaffListFilters>;

type StaffListFilterRowProps = {
  filters: StaffListFiltersState;
  equipmentOptions: StaffEquipmentOption[];
  className?: string;
  /** Extra controls on the same row (e.g. Clear queue). */
  children?: ReactNode;
};

/** Department then Equipment filter on one compact row. */
export function StaffListFilterRow({ filters, equipmentOptions, className, children }: StaffListFilterRowProps) {
  const selected = filters.equipmentId;
  const selectedMissing = selected !== ALL && !equipmentOptions.some((o) => o.equipment_id === selected);
  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center", className)}>
      {filters.showDepartment ? (
        <DepartmentFilter
          value={filters.departmentId}
          onChange={filters.setDepartment}
          onResolved={filters.onDepartmentResolved}
          defaultDepartmentName={filters.defaultDepartmentName}
          hideLabel
          compactTrigger
          className="sm:w-auto sm:shrink-0"
          triggerClassName="h-9 min-w-0 w-full gap-2 rounded-lg text-sm font-semibold shadow-sm sm:w-auto sm:min-w-[10rem] [&_span]:whitespace-nowrap"
          disabled={!filters.departmentReady}
        />
      ) : null}
      <Select
        value={selected === ALL ? ALL : String(selected)}
        onValueChange={(v) => filters.setEquipment(v === ALL ? ALL : Number(v))}
      >
        <SelectTrigger
          className="h-9 w-full min-w-0 rounded-lg text-sm font-semibold shadow-sm sm:w-72 sm:max-w-full"
          aria-label="Filter by equipment"
        >
          <div className="flex min-w-0 items-center gap-2">
            <Package className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <SelectValue placeholder="All equipment" className="truncate" />
          </div>
        </SelectTrigger>
        <SelectContent className="max-w-[min(100vw-2rem,28rem)]">
          <SelectItem value={ALL}>All equipment</SelectItem>
          {selectedMissing ? <SelectItem value={String(selected)}>Selected equipment</SelectItem> : null}
          {equipmentOptions.map((o) => (
            <SelectItem key={o.equipment_id} value={String(o.equipment_id)}>
              {o.name || o.code}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {children}
    </div>
  );
}

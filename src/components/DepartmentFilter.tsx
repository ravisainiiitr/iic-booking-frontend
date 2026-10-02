import { useEffect, useRef, useState } from "react";
import { Building2, Loader2 } from "lucide-react";
import {
  findPreferredDepartment,
  loadCatalogDepartments,
  peekCatalogDepartments,
  type CatalogDepartment,
} from "@/lib/catalogCache";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type DepartmentFilterValue = "all" | number;

export { findPreferredDepartment, type CatalogDepartment };

interface DepartmentFilterProps {
  value: DepartmentFilterValue;
  onChange: (value: DepartmentFilterValue) => void;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  /** When set, auto-select this department once after the catalog loads (if still on "all"). */
  defaultDepartmentName?: string;
  /** Fires once after departments load (and optional default applied). Use to gate first fetch. */
  onResolved?: (value: DepartmentFilterValue) => void;
  /** Keep the label for screen readers only, so the trigger lines up with sibling controls in a filter row. */
  hideLabel?: boolean;
  /**
   * Only list these departments. The default then falls back to the first allowed department when
   * `defaultDepartmentName` is not among them. Leave unset to list every catalog department.
   */
  allowedDepartmentIds?: number[];
  /** Offer the "All departments" option (default true). */
  showAllOption?: boolean;
  /** Counts shown next to each department instead of its catalog equipment count. */
  equipmentCounts?: Record<number, number>;
}

const DepartmentFilter = ({
  value,
  onChange,
  className,
  triggerClassName,
  disabled = false,
  defaultDepartmentName,
  onResolved,
  hideLabel = false,
  allowedDepartmentIds,
  showAllOption = true,
  equipmentCounts,
}: DepartmentFilterProps) => {
  const restrict = (list: CatalogDepartment[]) =>
    allowedDepartmentIds ? list.filter((d) => allowedDepartmentIds.includes(d.id)) : list;
  const [departments, setDepartments] = useState<CatalogDepartment[]>(() => restrict(peekCatalogDepartments() ?? []));
  const [loading, setLoading] = useState(() => peekCatalogDepartments() == null);
  const appliedDefaultRef = useRef(false);
  const resolvedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (peekCatalogDepartments() == null) setLoading(true);
      try {
        const loaded = await loadCatalogDepartments();
        if (cancelled) return;
        if (!loaded) {
          setDepartments([]);
          if (!resolvedRef.current) {
            resolvedRef.current = true;
            onResolved?.(value);
          }
          return;
        }
        const list = restrict(loaded);
        setDepartments(list);

        let nextValue: DepartmentFilterValue = value;
        if (
          (defaultDepartmentName || allowedDepartmentIds) &&
          !appliedDefaultRef.current &&
          value === "all"
        ) {
          const preferred = defaultDepartmentName ? findPreferredDepartment(list, defaultDepartmentName) : undefined;
          const match = preferred ?? (allowedDepartmentIds ? list[0] : undefined);
          if (match) {
            appliedDefaultRef.current = true;
            nextValue = match.id;
            onChange(match.id);
          }
        }
        if (!resolvedRef.current) {
          resolvedRef.current = true;
          onResolved?.(nextValue);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectValue = value === "all" ? "all" : String(value);

  return (
    <div
      className={cn(
        hideLabel ? "min-w-0 w-full" : "flex flex-wrap items-center gap-2 min-w-0 max-w-md w-full",
        className,
      )}
    >
      <Label
        htmlFor="catalog-department-filter"
        className={hideLabel ? "sr-only" : "shrink-0 text-base font-semibold text-foreground whitespace-nowrap"}
      >
        Select Department/Centre
      </Label>
      <Select
        value={selectValue}
        onValueChange={(next) => {
          if (next === "all") {
            onChange("all");
          } else {
            const id = parseInt(next, 10);
            if (!Number.isNaN(id)) onChange(id);
          }
        }}
        disabled={disabled || loading}
      >
        <SelectTrigger
          id="catalog-department-filter"
          title={hideLabel ? "Select Department/Centre" : undefined}
          className={cn(
            "min-w-[12rem] max-w-full w-full h-11 text-base font-semibold text-foreground",
            triggerClassName,
          )}
        >
          <div className="flex items-center gap-2 min-w-0 w-full">
            {loading ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <Building2 className="h-4 w-4 shrink-0 text-primary" />
            )}
            <SelectValue
              placeholder="All departments"
              className="truncate whitespace-nowrap font-semibold text-foreground"
            />
          </div>
        </SelectTrigger>
        <SelectContent className="max-w-[min(100vw-2rem,28rem)]">
          {showAllOption ? (
            <SelectItem value="all" className="text-base font-semibold py-2.5">
              All departments
            </SelectItem>
          ) : null}
          {departments.map((dept) => (
            <SelectItem key={dept.id} value={String(dept.id)} className="text-base font-semibold py-2.5">
              <span className="whitespace-normal break-words leading-snug">
                {`${dept.name}${dept.code ? ` (${dept.code})` : ""} · ${equipmentCounts?.[dept.id] ?? dept.equipment_count}`}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default DepartmentFilter;

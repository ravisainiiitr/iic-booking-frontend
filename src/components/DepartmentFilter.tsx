import { useEffect, useRef, useState } from "react";
import { Building2, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api";
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

export interface CatalogDepartment {
  id: number;
  name: string;
  code: string;
  equipment_count: number;
}

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
}

export function findPreferredDepartment(
  departments: CatalogDepartment[],
  preferredName: string,
): CatalogDepartment | undefined {
  const needle = preferredName.trim().toLowerCase();
  if (!needle) return undefined;
  const byName = departments.find((d) => d.name.toLowerCase() === needle);
  if (byName) return byName;
  const byContains = departments.find((d) => d.name.toLowerCase().includes(needle));
  if (byContains) return byContains;
  if (needle.includes("instrumentation") || needle === "iic") {
    return departments.find((d) => String(d.code || "").toLowerCase() === "iic");
  }
  return undefined;
}

const DepartmentFilter = ({
  value,
  onChange,
  className,
  triggerClassName,
  disabled = false,
  defaultDepartmentName,
  onResolved,
}: DepartmentFilterProps) => {
  const [departments, setDepartments] = useState<CatalogDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const appliedDefaultRef = useRef(false);
  const resolvedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const response = await apiClient.getCatalogDepartments();
        if (cancelled) return;
        if (response.error || !response.data) {
          setDepartments([]);
          if (!resolvedRef.current) {
            resolvedRef.current = true;
            onResolved?.(value);
          }
          return;
        }
        const list = (response.data.departments ?? []).filter((d) => {
          const name = (d.name || "").trim().toLowerCase();
          const code = (d.code || "").trim().toLowerCase();
          return name !== "admin" && code !== "admin";
        });
        setDepartments(list);

        let nextValue: DepartmentFilterValue = value;
        if (
          defaultDepartmentName &&
          !appliedDefaultRef.current &&
          value === "all"
        ) {
          const match = findPreferredDepartment(list, defaultDepartmentName);
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
    <div className={cn("flex flex-wrap items-center gap-2 min-w-0 max-w-md w-full", className)}>
      <Label
        htmlFor="catalog-department-filter"
        className="shrink-0 text-base font-semibold text-foreground whitespace-nowrap"
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
              className="truncate whitespace-nowrap font-semibold text-foreground text-base"
            />
          </div>
        </SelectTrigger>
        <SelectContent className="max-w-[min(100vw-2rem,28rem)]">
          <SelectItem value="all" className="text-base font-semibold py-2.5">
            All departments
          </SelectItem>
          {departments.map((dept) => (
            <SelectItem key={dept.id} value={String(dept.id)} className="text-base font-semibold py-2.5">
              <span className="whitespace-normal break-words leading-snug">
                {`${dept.name}${dept.code ? ` (${dept.code})` : ""} · ${dept.equipment_count}`}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default DepartmentFilter;

import { useEffect, useRef, useState } from "react";
import { Building2, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type DepartmentFilterValue = "all" | number;

interface CatalogDepartment {
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
}

function findPreferredDepartment(
  departments: CatalogDepartment[],
  preferredName: string,
): CatalogDepartment | undefined {
  const needle = preferredName.trim().toLowerCase();
  if (!needle) return undefined;
  const byName = departments.find((d) => d.name.toLowerCase() === needle);
  if (byName) return byName;
  const byContains = departments.find((d) => d.name.toLowerCase().includes(needle));
  if (byContains) return byContains;
  // Common short code for Institute Instrumentation Centre
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
}: DepartmentFilterProps) => {
  const [departments, setDepartments] = useState<CatalogDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const appliedDefaultRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const response = await apiClient.getCatalogDepartments();
        if (cancelled) return;
        if (response.error || !response.data) {
          setDepartments([]);
          return;
        }
        const list = response.data.departments ?? [];
        setDepartments(list);

        if (
          defaultDepartmentName &&
          !appliedDefaultRef.current &&
          value === "all"
        ) {
          const match = findPreferredDepartment(list, defaultDepartmentName);
          if (match) {
            appliedDefaultRef.current = true;
            onChange(match.id);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
    // Intentionally run once on mount to load departments + apply default.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectValue = value === "all" ? "all" : String(value);

  return (
    <div className={className}>
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
        <SelectTrigger className={triggerClassName ?? "h-12 text-base"}>
          <div className="flex items-center gap-2 min-w-0">
            {loading ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <SelectValue placeholder="All departments" />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All departments</SelectItem>
          {departments.map((dept) => (
            <SelectItem key={dept.id} value={String(dept.id)}>
              {`${dept.name}${dept.code ? ` (${dept.code})` : ""} · ${dept.equipment_count}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default DepartmentFilter;

import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import type { DepartmentChoice } from "@/lib/adminInsights";
import { cn } from "@/lib/utils";
import { FilterSelect } from "./InsightParts";

export const DEPT_PARAM = "dept";

/** The department picked on an overview page — ``?dept=<id>`` in the URL, so reloads and shared links keep it. */
export function useDepartmentParam(): [string, (value: string) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get(DEPT_PARAM) ?? "";
  const setDept = useCallback(
    (value: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) next.set(DEPT_PARAM, value);
          else next.delete(DEPT_PARAM);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );
  return [/^\d+$/.test(raw) ? raw : "", setDept];
}

/** ``path`` with the current department kept, for links between the overview pages. */
export function withDepartment(path: string, dept: string): string {
  if (!dept) return path;
  return `${path}${path.includes("?") ? "&" : "?"}${DEPT_PARAM}=${encodeURIComponent(dept)}`;
}

/**
 * Main Administrator only: "All departments" or one department, applied to every card, panel and table on the page.
 * Hidden when there is nothing to pick (a Department Administrator always sees their own department).
 */
export function DepartmentPicker({
  departments,
  value,
  onChange,
  equipmentOwnersOnly = false,
  className,
}: {
  departments: DepartmentChoice[] | undefined;
  value: string;
  onChange: (value: string) => void;
  /** Only departments that own equipment (equipment pages). */
  equipmentOwnersOnly?: boolean;
  className?: string;
}) {
  const choices = (departments ?? []).filter((d) => !equipmentOwnersOnly || d.owns_equipment || String(d.id) === value);
  if (!choices.length) return null;
  return (
    <div className={cn("w-full sm:w-80", className)}>
      <FilterSelect
        id="insight-department"
        label="Department"
        value={value}
        onChange={onChange}
        options={choices.map((d) => ({ value: String(d.id), label: d.code ? `${d.name} (${d.code})` : d.name }))}
        allLabel="All departments"
      />
    </div>
  );
}

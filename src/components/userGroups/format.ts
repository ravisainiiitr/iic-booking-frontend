import type { GroupsOptions } from "@/lib/facilityGroupsApi";
import type { MultiOption } from "./MultiSelect";

export function departmentOptions(options: GroupsOptions | null): MultiOption[] {
  const rows: MultiOption[] = (options?.departments ?? []).map((d) => ({
    value: String(d.id),
    label: d.name,
    hint: d.code ?? undefined,
    group: d.department_type === "external" ? "External organisations" : "IITR departments & centres",
  }));
  return [{ value: "0", label: "No department", group: "Other" }, ...rows];
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}

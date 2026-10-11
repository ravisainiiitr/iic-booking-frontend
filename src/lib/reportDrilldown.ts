import type { ReportDrillParams, ReportDrillSource } from "@/lib/api";

/** Where a Reports & Statistics row was opened from: report, breakdown and the report's own filters. */
export interface DrillTarget {
  source: ReportDrillSource;
  dimension: string;
  value?: string | number | null;
  from?: string;
  to?: string;
  /** Equipment filter of the Equipment Performance Report ("all" or empty for none). */
  equipment?: string;
  /** Finance report preset (this_month, this_quarter, …); explicit dates win when both are set. */
  preset?: string;
  user?: number;
}

/** ``/reports/drilldown?src=…&dim=…`` — also written by the backend into PDF / Excel links. */
export function drilldownPath(t: DrillTarget): string {
  const q = new URLSearchParams({ src: t.source, dim: t.dimension });
  if (t.value !== undefined && t.value !== null && t.value !== "") q.set("val", String(t.value));
  if (t.from) q.set("from", t.from);
  if (t.to) q.set("to", t.to);
  if (t.equipment && t.equipment !== "all") q.set("eq", t.equipment);
  if (t.preset) q.set("preset", t.preset);
  if (t.user) q.set("user", String(t.user));
  return `/reports/drilldown?${q.toString()}`;
}

export function parseDrillTarget(search: URLSearchParams): DrillTarget | null {
  const source = search.get("src");
  const dimension = search.get("dim");
  if ((source !== "performance" && source !== "finance") || !dimension) return null;
  const user = Number(search.get("user") || "");
  return {
    source,
    dimension,
    value: search.get("val") ?? "",
    from: search.get("from") ?? undefined,
    to: search.get("to") ?? undefined,
    equipment: search.get("eq") ?? undefined,
    preset: search.get("preset") ?? undefined,
    user: Number.isInteger(user) && user > 0 ? user : undefined,
  };
}

export function drillApiParams(t: DrillTarget): ReportDrillParams {
  return {
    dimension: t.dimension,
    value: t.value === undefined || t.value === null ? undefined : String(t.value),
    date_from: t.from,
    date_to: t.to,
    equipment_id: t.equipment && t.equipment !== "all" ? t.equipment : undefined,
    preset: t.preset,
    user: t.user,
  };
}

/** Where "back to report" goes, with the filters the row was opened under. */
export function reportPath(t: DrillTarget): string {
  const q = new URLSearchParams();
  if (t.source === "finance") {
    if (t.preset) q.set("preset", t.preset);
    if (t.from) q.set("from", t.from);
    if (t.to) q.set("to", t.to);
  } else {
    if (t.from) q.set("from", t.from);
    if (t.to) q.set("to", t.to);
    if (t.equipment) q.set("eq", t.equipment);
  }
  const s = q.toString();
  return `/reports${s ? `?${s}` : ""}`;
}

export const formatInr = (value: number | string | null | undefined) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

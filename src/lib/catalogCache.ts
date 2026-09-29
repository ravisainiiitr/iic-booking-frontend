import { apiClient } from "@/lib/api";

export type CatalogDepartment = {
  id: number;
  name: string;
  code: string;
  equipment_count: number;
};

export type CatalogDepartmentValue = "all" | number;
export type CatalogScope = "all" | "managed" | null;

type EquipmentsResponse = Awaited<ReturnType<typeof apiClient.getEquipments>>;
export type CatalogEquipmentRow = NonNullable<EquipmentsResponse["data"]>["equipments"][number];

export const DEFAULT_CATALOG_DEPARTMENT_NAME = "Institute Instrumentation Centre";

/** Cached catalog lists are shown immediately; older than this they are refetched in the background. */
export const CATALOG_REVALIDATE_AFTER_MS = 30_000;
/** Beyond this a cached list is not shown at all (the page waits for a fresh one). */
const CATALOG_MAX_AGE_MS = 10 * 60_000;
const DEPARTMENTS_MAX_AGE_MS = 5 * 60_000;

type Entry<T> = { at: number; data: T };

// Keyed by token so a different sign-in in the same tab never sees the previous user's catalog.
const departmentsCache = new Map<string, Entry<CatalogDepartment[]>>();
const departmentsInFlight = new Map<string, Promise<CatalogDepartment[] | null>>();
const equipmentCache = new Map<string, Entry<CatalogEquipmentRow[]>>();
const equipmentInFlight = new Map<string, Promise<CatalogEquipmentRow[]>>();
const equipmentSeq = new Map<string, number>();

const sessionKey = () => apiClient.getToken() ?? "";

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

const isAdminDepartment = (d: CatalogDepartment) =>
  (d.name || "").trim().toLowerCase() === "admin" || (d.code || "").trim().toLowerCase() === "admin";

export function peekCatalogDepartments(): CatalogDepartment[] | null {
  const hit = departmentsCache.get(sessionKey());
  return hit && Date.now() - hit.at < DEPARTMENTS_MAX_AGE_MS ? hit.data : null;
}

/** Catalog departments (Admin excluded); null when the request fails. Concurrent callers share one request. */
export function loadCatalogDepartments(): Promise<CatalogDepartment[] | null> {
  const key = sessionKey();
  const cached = peekCatalogDepartments();
  if (cached) return Promise.resolve(cached);
  const pending = departmentsInFlight.get(key);
  if (pending) return pending;
  const promise = apiClient
    .getCatalogDepartments()
    .then((res) => {
      if (res.error || !res.data) return null;
      const list = (res.data.departments ?? []).filter((d) => !isAdminDepartment(d));
      departmentsCache.set(key, { at: Date.now(), data: list });
      return list;
    })
    .finally(() => departmentsInFlight.delete(key));
  departmentsInFlight.set(key, promise);
  return promise;
}

const equipmentKey = (departmentId: CatalogDepartmentValue, scope: CatalogScope) =>
  `${sessionKey()}|${departmentId}|${scope ?? ""}`;

export function peekCatalogEquipment(
  departmentId: CatalogDepartmentValue,
  scope: CatalogScope,
): { data: CatalogEquipmentRow[]; ageMs: number } | null {
  const hit = equipmentCache.get(equipmentKey(departmentId, scope));
  if (!hit) return null;
  const ageMs = Date.now() - hit.at;
  return ageMs < CATALOG_MAX_AGE_MS ? { data: hit.data, ageMs } : null;
}

/**
 * Catalog cards for the Browse and Book page (with ratings), without a search term.
 * Throws on API errors so callers keep their existing error handling.
 */
export function loadCatalogEquipment(
  departmentId: CatalogDepartmentValue,
  scope: CatalogScope,
  { force = false }: { force?: boolean } = {},
): Promise<CatalogEquipmentRow[]> {
  const key = equipmentKey(departmentId, scope);
  const pending = equipmentInFlight.get(key);
  // A request already in flight may predate a status change, so forced loads never join it.
  if (pending && !force) return pending;
  const seq = (equipmentSeq.get(key) ?? 0) + 1;
  equipmentSeq.set(key, seq);
  const promise = apiClient
    .getEquipments(undefined, undefined, undefined, true, departmentId, scope)
    .then((res) => {
      if (res.error) throw new Error(res.error || "Failed to load equipment");
      const list = Array.isArray(res.data?.equipments) ? res.data.equipments : [];
      if (equipmentSeq.get(key) === seq) equipmentCache.set(key, { at: Date.now(), data: list });
      return list;
    })
    .finally(() => {
      if (equipmentInFlight.get(key) === promise) equipmentInFlight.delete(key);
    });
  equipmentInFlight.set(key, promise);
  return promise;
}

type PrefetchUser = {
  user_type?: unknown;
  department?: unknown;
  department_id?: unknown;
} | null | undefined;

/**
 * Warm the Browse and Book panel: its page code, the department list and the default catalog,
 * using exactly the parameters EquipmentList requests first.
 */
export function prefetchEquipmentCatalog(user: PrefetchUser): void {
  if (!user || !apiClient.getToken()) return;
  void import("@/pages/EquipmentList").catch(() => undefined);
  const type = String(user.user_type ?? "").toLowerCase();
  const scope: CatalogScope = type === "manager" ? "managed" : null;
  if (type === "dept_admin") {
    const dept = Number(user.department ?? user.department_id);
    if (Number.isFinite(dept) && dept > 0 && !peekCatalogEquipment(dept, scope)) {
      void loadCatalogEquipment(dept, scope).catch(() => undefined);
    }
    return;
  }
  void loadCatalogDepartments().then((list) => {
    const preferred = list ? findPreferredDepartment(list, DEFAULT_CATALOG_DEPARTMENT_NAME) : undefined;
    const dept: CatalogDepartmentValue = preferred?.id ?? "all";
    if (!peekCatalogEquipment(dept, scope)) {
      void loadCatalogEquipment(dept, scope).catch(() => undefined);
    }
  });
}

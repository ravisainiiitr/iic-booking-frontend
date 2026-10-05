import { API_BASE_URL, apiClient } from "@/lib/api";

/**
 * Per-department module switches (Main Administrator): `/api/v1/admin/department-modules/`.
 * Per-user availability arrives with the signed-in user (`department_modules` on `/auth/user/`) and from
 * `/api/v1/department-modules/me/`. Errors arrive as `{detail, code, field?}`.
 */
export const DM_ADMIN_BASE = `${API_BASE_URL}/v1/admin/department-modules`;
export const DM_BASE = `${API_BASE_URL}/v1/department-modules`;

export type ModuleKey = "dsa" | "remote_analysis" | "training" | "procurement";

export const MODULE_KEYS: ModuleKey[] = ["dsa", "remote_analysis", "training", "procurement"];

export interface ModuleMeta {
  key: ModuleKey;
  label: string;
  test_users_only_help: string;
  off_help: string;
  usage_label: string;
}

export interface ModuleCell {
  enabled: boolean;
  test_users_only: boolean;
  /**
   * False while no switch was ever saved. A department that existed when the switches were introduced then behaves
   * as before (on); one created later (source "new") is off.
   */
  configured: boolean;
  /** "new": department created after the switches were introduced, off until the Main Administrator turns it on. */
  source: "seed" | "admin" | "new" | "procurement" | null;
  note: string;
  disabled_at: string | null;
  test_only_since: string | null;
  updated_at: string | null;
  updated_by: string | null;
  usage?: number;
  pilot_user_count?: number;
}

export interface DepartmentRow {
  id: number;
  name: string;
  code: string;
  department_type: string;
  equipment_count: number;
  cells: Record<ModuleKey, ModuleCell>;
}

export interface ModuleMatrix {
  modules: ModuleMeta[];
  departments: DepartmentRow[];
}

export interface HistoryEntry {
  id: number;
  created_at: string;
  department_id: number | null;
  department: string;
  module_key: ModuleKey;
  action: string;
  old: Partial<Pick<ModuleCell, "enabled" | "test_users_only" | "configured">>;
  new: Partial<Pick<ModuleCell, "enabled" | "test_users_only" | "configured">>;
  reason: string;
  actor: string | null;
}

export interface ModuleAvailability {
  available: boolean;
  department_enabled: boolean;
  test_users_only: boolean;
  configured: boolean;
}

export interface DepartmentModulesAvailability {
  department_id: number | null;
  is_test_account: boolean;
  can_configure: boolean;
  modules: Record<ModuleKey, ModuleAvailability>;
}

export class DepartmentModulesApiError extends Error {
  status: number;
  code: string;
  field: string;

  constructor(status: number, body: Record<string, unknown>) {
    super(typeof body.detail === "string" && body.detail ? body.detail : `Request failed (${status})`);
    this.status = status;
    this.code = typeof body.code === "string" ? body.code : "";
    this.field = typeof body.field === "string" ? body.field : "";
  }
}

async function request<T>(url: string, opts: { method?: string; json?: unknown } = {}): Promise<T> {
  const token = apiClient.getToken();
  const headers: Record<string, string> = token ? { Authorization: `Token ${token}` } : {};
  let body: string | undefined;
  if (opts.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.json);
  }
  const res = await fetch(url, { method: opts.method ?? "GET", headers, body, credentials: "omit" });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new DepartmentModulesApiError(res.status, data);
  return data as T;
}

export interface CellChange {
  enabled?: boolean;
  test_users_only?: boolean;
  reason: string;
}

export const departmentModulesApi = {
  matrix: () => request<ModuleMatrix>(`${DM_ADMIN_BASE}/`),
  update: (departmentId: number, module: ModuleKey, change: CellChange) =>
    request<{ department_id: number; module_key: ModuleKey; cell: ModuleCell }>(
      `${DM_ADMIN_BASE}/${departmentId}/${module}/`,
      { method: "POST", json: change },
    ),
  history: (filters: { department?: number; module?: ModuleKey; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (filters.department) qs.set("department", String(filters.department));
    if (filters.module) qs.set("module", filters.module);
    if (filters.limit) qs.set("limit", String(filters.limit));
    const s = qs.toString();
    return request<{ results: HistoryEntry[] }>(`${DM_ADMIN_BASE}/history/${s ? `?${s}` : ""}`);
  },
  me: () => request<DepartmentModulesAvailability>(`${DM_BASE}/me/`),
};

/**
 * Whether to show a module's entry points to this user. Unknown (older session data or a failed lookup) counts as
 * available so nothing that shows today disappears; the server enforces the switch either way.
 */
export function moduleAvailable(
  availability: DepartmentModulesAvailability | null | undefined,
  key: ModuleKey,
): boolean {
  const entry = availability?.modules?.[key];
  return entry ? Boolean(entry.available) : true;
}

export type CellState = "on" | "test" | "off";

export function cellState(cell: Pick<ModuleCell, "enabled" | "test_users_only">): CellState {
  if (!cell.enabled) return "off";
  return cell.test_users_only ? "test" : "on";
}

export function stateLabel(module: ModuleKey, cell: Pick<ModuleCell, "enabled" | "test_users_only">): string {
  const state = cellState(cell);
  if (state === "off") return "Off";
  if (state === "test") return module === "procurement" ? "Pilot users only" : "Test users only";
  return "On";
}

export interface PendingChange {
  department: Pick<DepartmentRow, "id" | "name" | "code">;
  module: ModuleMeta;
  change: Omit<CellChange, "reason">;
}

/** Title and impact text for the reason dialog. */
export function describeChange(p: PendingChange): { title: string; detail: string } {
  const { department, module, change } = p;
  const where = department.code ? `${department.name} (${department.code})` : department.name;
  if (change.enabled === false) return { title: `Switch ${module.label} off for ${where}`, detail: module.off_help };
  if (change.enabled === true) return { title: `Switch ${module.label} on for ${where}`, detail: "" };
  if (change.test_users_only === true) {
    const who = module.key === "procurement" ? "pilot users" : "test users";
    return { title: `Limit ${module.label} to ${who} in ${where}`, detail: module.test_users_only_help };
  }
  return { title: `Open ${module.label} to everyone in ${where}`, detail: "" };
}

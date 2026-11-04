import { API_BASE_URL, apiClient } from "@/lib/api";

/**
 * Equipment upkeep (`/api/v1/upkeep/`): maintenance and calibration schedule, uptime / MTBF / MTTR from recorded
 * downtime, the uptime target and early-warning alerts. Staff only (Main Admin, OIC, Lab Operators, Dept Admins).
 */
const BASE = "/v1/upkeep/";

export type PlanState = "OK" | "DUE" | "OVERDUE" | "CLOSED";
export type AlertSeverity = "INFO" | "WARNING" | "CRITICAL";

export interface UpkeepEquipmentRef {
  equipment_id: number;
  name: string;
  code: string;
  status: string;
}

export interface UpkeepPerson {
  id: number;
  name: string;
}

export interface UpkeepListRow {
  equipment: UpkeepEquipmentRef;
  uptime_pct: number;
  target_pct: number;
  below_target: boolean;
  breakdowns: number;
  downtime_hours: number;
  open_alerts: number;
  plans: number;
  next_due_on: string | null;
  can_manage: boolean;
}

export interface UpkeepMetrics {
  days: number;
  from: string;
  to: string;
  uptime_pct: number;
  availability_excl_planned_pct: number;
  target_pct: number;
  below_target: boolean;
  downtime_hours: number;
  breakdown_hours: number;
  planned_hours: number;
  staff_unavailable_hours: number;
  breakdowns: number;
  mttr_hours: number | null;
  mtbf_hours: number | null;
  causes: Array<{ cause: string; count: number; hours: number }>;
}

export interface MaintenancePlan {
  id: number;
  equipment_id: number;
  kind: string;
  kind_label: string;
  title: string;
  instructions: string;
  interval_days: number;
  lead_days: number;
  last_done_on: string | null;
  next_due_on: string;
  state: PlanState;
  responsible: UpkeepPerson | null;
  is_active: boolean;
  closed_reason: string;
  can_record: boolean;
}

export interface PlanCompletion {
  id: number;
  plan_id: number;
  plan_title: string;
  done_on: string;
  done_by: UpkeepPerson | null;
  notes: string;
  report_reference: string;
  next_due_on: string;
}

export interface UpkeepAlert {
  id: number;
  equipment: UpkeepEquipmentRef;
  kind: string;
  kind_label: string;
  severity: AlertSeverity;
  message: string;
  opened_at: string;
  resolved_at: string | null;
  acknowledged_by: UpkeepPerson | null;
  acknowledged_at: string | null;
  acknowledge_note: string;
}

export interface UpkeepSetting {
  uptime_target_pct: number;
  breakdown_alert_count: number;
  breakdown_window_days: number;
}

export interface UpkeepDetail {
  equipment: UpkeepEquipmentRef;
  setting: UpkeepSetting;
  metrics: UpkeepMetrics;
  plans: MaintenancePlan[];
  completions: PlanCompletion[];
  alerts: UpkeepAlert[];
  can_manage: boolean;
  kinds: Array<{ value: string; label: string }>;
}

export interface PlanInput {
  title?: string;
  kind?: string;
  interval_days?: number;
  lead_days?: number;
  next_due_on?: string;
  last_done_on?: string;
  responsible_id?: number | null;
  instructions?: string;
}

export interface UpkeepResult<T> {
  data?: T;
  error?: string;
  code?: string;
  status?: number;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<UpkeepResult<T>> {
  try {
    const token = apiClient.getToken();
    const res = await fetch(`${API_BASE_URL}${BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Token ${token}` } : {}) },
      credentials: "omit",
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const detail = typeof body.detail === "string" ? body.detail : `Request failed (HTTP ${res.status})`;
      return { error: detail, code: typeof body.code === "string" ? body.code : undefined, status: res.status };
    }
    return { data: body as T, status: res.status };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Network error occurred" };
  }
}

const q = (params: Record<string, string | number | boolean | undefined>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "" && v !== false) s.append(k, String(v === true ? 1 : v));
  const out = s.toString();
  return out ? `?${out}` : "";
};
const send = <T>(method: string, path: string, body: unknown = {}) => request<T>(path, { method, body: JSON.stringify(body) });

export const upkeepApi = {
  list: (params: { q?: string; days?: number } = {}) =>
    request<{ results: UpkeepListRow[]; truncated: boolean }>(`equipment/${q(params)}`),
  detail: (equipmentId: number, days?: number) => request<UpkeepDetail>(`equipment/${equipmentId}/${q({ days })}`),
  saveSetting: (equipmentId: number, input: Partial<UpkeepSetting>) => send<UpkeepDetail>("PUT", `equipment/${equipmentId}/`, input),
  createPlan: (equipmentId: number, input: PlanInput) => send<MaintenancePlan>("POST", `equipment/${equipmentId}/plans/`, input),
  updatePlan: (planId: number, input: PlanInput) => send<MaintenancePlan>("PATCH", `plans/${planId}/`, input),
  closePlan: (planId: number, reason: string) => send<MaintenancePlan>("POST", `plans/${planId}/close/`, { reason }),
  completePlan: (planId: number, input: { done_on?: string; notes?: string; report_reference?: string }) =>
    send<{ completion: PlanCompletion; plan: MaintenancePlan }>("POST", `plans/${planId}/complete/`, input),
  alerts: (params: { include_resolved?: boolean; kind?: string } = {}) => request<{ results: UpkeepAlert[] }>(`alerts/${q(params)}`),
  acknowledge: (alertId: number, note: string) => send<UpkeepAlert>("POST", `alerts/${alertId}/acknowledge/`, { note }),
};

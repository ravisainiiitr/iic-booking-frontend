/**
 * Probable publication matches found automatically from open-access acknowledgements, reviewed by the Main
 * Administrator (all) and Department Administrators (their department). The backend enforces who may review what.
 */
import { API_BASE_URL, apiClient } from "@/lib/api";

export type MatchStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface MatchMapping {
  id: number;
  level: "DEPARTMENT" | "EQUIPMENT";
  status: string;
  confidence: number;
  matched_phrases: string[];
  rationale: string;
  department: { id: number; name: string; code: string };
  equipment: { id: number; name: string; code: string } | null;
}

export interface EquipmentChoice {
  id: number;
  name: string;
  code: string;
  department_id: number;
  suggested: boolean;
  confidence: number | null;
}

export interface PublicationMatch {
  id: number;
  review_status: MatchStatus | "NONE";
  paper: { title: string; doi: string; year: number | null; journal: string; authors: string; url: string };
  researcher: { id: number; name: string; department: string; photo_url: string };
  evidence: {
    source_url: string;
    oa_status: string;
    licence: string;
    acknowledgement_snippet: string;
    detail: string;
    checked_at: string | null;
  };
  mappings: MatchMapping[];
  equipment_choices: EquipmentChoice[];
  can_review: boolean;
  review_blocked_reason: string;
  reviewed_by: string;
  reviewed_at: string | null;
  review_note: string;
  claim_id: number | null;
}

type Result<T> = { data?: T; error?: string; code?: string; status?: number };
const BASE = `${API_BASE_URL}/v1/impact/publication-matches/`;

function headers(): Record<string, string> {
  const token = apiClient.getToken();
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Token ${token}` } : {}) };
}

async function call<T>(url: string, init: RequestInit = {}): Promise<Result<T>> {
  try {
    const res = await fetch(url, { ...init, headers: headers(), credentials: "omit" });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return {
        error: typeof body.detail === "string" ? body.detail : `Request failed (HTTP ${res.status})`,
        code: typeof body.code === "string" ? body.code : undefined,
        status: res.status,
      };
    }
    return { data: body as T, status: res.status };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Network error occurred" };
  }
}

export const publicationMatchesApi = {
  list: (params: { status?: MatchStatus; q?: string } = {}) => {
    const s = new URLSearchParams();
    if (params.status) s.set("status", params.status);
    if (params.q) s.set("q", params.q);
    const qs = s.toString();
    return call<{ results: PublicationMatch[]; count: number; pending_count: number }>(`${BASE}${qs ? `?${qs}` : ""}`);
  },
  pendingCount: () => call<{ pending_count: number }>(`${BASE}count/`),
  approve: (id: number, equipmentIds: number[], note = "") =>
    call<PublicationMatch>(`${BASE}${id}/approve/`, { method: "POST", body: JSON.stringify({ equipment_ids: equipmentIds, note }) }),
  reject: (id: number, note = "") => call<PublicationMatch>(`${BASE}${id}/reject/`, { method: "POST", body: JSON.stringify({ note }) }),
};

/** Instruments pre-ticked for approval: those the evidence names strongly enough. */
export function defaultSelection(m: PublicationMatch): number[] {
  return m.equipment_choices.filter((c) => c.suggested && (c.confidence ?? 0) >= 0.7).map((c) => c.id);
}

/** Roles that review matches; the backend enforces the same rule and the department scope. */
export const MATCH_REVIEWER_TYPES = new Set(["admin", "dept_admin"]);

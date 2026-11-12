/**
 * Confirming which OpenAlex author record belongs to a faculty member when the name search found lookalikes.
 * The researcher decides for themself; the Main Administrator for everyone; a Department Administrator for their
 * department's faculty. The backend enforces who may decide what.
 */
import { API_BASE_URL, apiClient } from "@/lib/api";

export type AuthorRecordStatus = "NEEDS_CONFIRMATION" | "AUTO_LINKED" | "CONFIRMED" | "REJECTED";

export interface AuthorRecord {
  id: number;
  openalex_author_id: string;
  openalex_url: string;
  display_name: string;
  orcid: string;
  works_count: number;
  institutions: string[];
  confidence: number;
  rationale: string;
  status: AuthorRecordStatus;
  decided_at: string | null;
}

export interface ResearcherRecords {
  researcher: { id: number; name: string; department: string; department_code: string; orcid: string };
  waiting: AuthorRecord[];
  linked: AuthorRecord[];
  rejected: AuthorRecord[];
  can_decide: boolean;
  scan_started?: boolean;
  /** The signed-in faculty member had no records: a background name search has just started. */
  searching?: boolean;
}

export interface RecentWork {
  title: string;
  year: number | null;
  journal: string;
  doi: string;
}

type Result<T> = { data?: T; error?: string; code?: string; status?: number };
const BASE = `${API_BASE_URL}/v1/impact/author-confirmations/`;
const CANDIDATES = `${API_BASE_URL}/v1/impact/author-candidates/`;

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

export const authorConfirmationsApi = {
  list: (params: { q?: string; unlinked?: boolean } = {}) => {
    const s = new URLSearchParams();
    if (params.q) s.set("q", params.q);
    if (params.unlinked) s.set("unlinked", "1");
    const qs = s.toString();
    return call<{ results: ResearcherRecords[]; count: number; waiting_count: number }>(`${BASE}${qs ? `?${qs}` : ""}`);
  },
  waitingCount: () => call<{ waiting_count: number }>(`${BASE}count/`),
  mine: () => call<ResearcherRecords>(`${BASE}mine/`),
  decide: (userId: number, body: { confirm?: number[]; reject?: number[] }) =>
    call<ResearcherRecords>(`${BASE}${userId}/`, { method: "POST", body: JSON.stringify(body) }),
  recentWorks: (recordId: number) => call<{ results: RecentWork[] }>(`${CANDIDATES}${recordId}/works/`),
};

/** Roles that confirm records for other people; the backend enforces the same rule and the department scope. */
export const AUTHOR_REVIEWER_TYPES = new Set(["admin", "dept_admin"]);

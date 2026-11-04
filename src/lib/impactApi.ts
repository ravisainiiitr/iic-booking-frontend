import { API_BASE_URL, apiClient } from "@/lib/api";

/**
 * Research impact (`/api/v1/impact/`): equipment funding lines, the facility's acknowledgement wording and check,
 * the researcher's ORCID iD with suggested publications (OpenAlex), and the funder impact report.
 */
const BASE = "/v1/impact/";

export interface ImpactResult<T> {
  data?: T;
  error?: string;
  code?: string;
  status?: number;
}

export interface FundingLine {
  id: number;
  equipment: { equipment_id: number; name: string; code: string };
  funder: string;
  scheme: string;
  sanction_reference: string;
  sanction_date: string | null;
  amount: number | null;
  acknowledgement_phrase: string;
  notes: string;
  is_active: boolean;
}

export interface FundingInput {
  equipment_id?: number;
  funder?: string;
  scheme?: string;
  sanction_reference?: string;
  sanction_date?: string;
  amount?: string | number | null;
  acknowledgement_phrase?: string;
  is_active?: boolean;
}

export interface AckPolicy {
  wording: string;
  required_phrases: string[];
  include_equipment_name: boolean;
  updated_at: string | null;
}

export interface AckCheck {
  result: "COMPLETE" | "PARTIAL" | "MISSING";
  found: Array<{ phrase: string; for: string }>;
  missing: Array<{ phrase: string; for: string }>;
  wording: string;
  stored: boolean;
}

export interface MyOrcid {
  orcid: string;
  discovery_enabled: boolean;
  last_checked_at: string | null;
  last_error: string;
}

export interface PublicationSuggestion {
  id: number;
  doi: string;
  title: string;
  journal: string;
  year: number | null;
  authors: string;
  equipment_ids: number[];
  status: string;
  status_label: string;
  source: string;
}

export interface ReportEquipmentRow {
  equipment_id: number;
  name: string;
  code: string;
  bookings: number;
  booking_hours: number;
  users_internal: number;
  users_external: number;
  samples: number;
  revenue: number;
  publications: number;
  impact_factor_sum: number;
  people_authorised: number;
  downtime_hours: number;
}

export interface ReportTotals {
  equipment: number;
  bookings: number;
  booking_hours: number;
  users_internal: number;
  users_external: number;
  samples: number;
  revenue: number;
  publications_unique: number;
  impact_factor_sum: number;
  people_authorised: number;
  sanctioned_amount: number | null;
}

export interface FunderReport {
  date_from: string;
  date_to: string;
  groups: Array<{ funder: string; scheme: string; equipment: ReportEquipmentRow[]; totals: ReportTotals }>;
  totals: Partial<ReportTotals>;
  equipment_count: number;
  notes?: string[];
}

export interface ReportQuery {
  date_from?: string;
  date_to?: string;
  funder?: string;
  scheme?: string;
}

function headers(): Record<string, string> {
  const token = apiClient.getToken();
  return token ? { Authorization: `Token ${token}` } : {};
}

async function request<T>(path: string, init: RequestInit = {}): Promise<ImpactResult<T>> {
  try {
    const res = await fetch(`${API_BASE_URL}${BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...headers() },
      credentials: "omit",
    });
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

const qs = (params: Record<string, string | number | undefined>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") s.append(k, String(v));
  const out = s.toString();
  return out ? `?${out}` : "";
};
const send = <T>(method: string, path: string, body: unknown = {}) => request<T>(path, { method, body: JSON.stringify(body) });

export const impactApi = {
  funding: (params: { equipment_id?: number; include_closed?: string } = {}) =>
    request<{ results: FundingLine[]; funders: Array<{ funder: string; scheme: string }> }>(`funding/${qs(params)}`),
  addFunding: (input: FundingInput) => send<FundingLine>("POST", "funding/", input),
  updateFunding: (id: number, input: FundingInput) => send<FundingLine>("PATCH", `funding/${id}/`, input),
  policy: () => request<AckPolicy>("acknowledgement/"),
  savePolicy: (input: Partial<AckPolicy>) => send<AckPolicy>("PUT", "acknowledgement/", input),
  checkAcknowledgement: (text: string, equipmentIds: number[], claimId?: number) =>
    send<AckCheck>("POST", "acknowledgement/check/", { text, equipment_ids: equipmentIds, ...(claimId ? { claim_id: claimId } : {}) }),
  myOrcid: () => request<MyOrcid>("me/orcid/"),
  setOrcid: (orcid: string) => send<MyOrcid>("PUT", "me/orcid/", { orcid }),
  removeOrcid: () => send<MyOrcid>("DELETE", "me/orcid/"),
  suggestions: () => request<{ results: PublicationSuggestion[] }>("me/suggestions/"),
  checkSuggestions: () => send<{ found: number; added: number }>("POST", "me/suggestions/check/"),
  dismissSuggestion: (id: number) => send<PublicationSuggestion>("POST", `me/suggestions/${id}/dismiss/`),
  report: (query: ReportQuery) => request<FunderReport>(`report/${qs({ ...query })}`),
  /** Download the report as CSV or Excel. */
  downloadReport: async (query: ReportQuery, format: "csv" | "xlsx"): Promise<string | null> => {
    try {
      const res = await fetch(`${API_BASE_URL}${BASE}report/${qs({ ...query, export: format })}`, { headers: headers(), credentials: "omit" });
      if (!res.ok) return `Download failed (HTTP ${res.status})`;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `funder-impact-${query.date_from ?? ""}-to-${query.date_to ?? ""}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "Download failed";
    }
  },
};

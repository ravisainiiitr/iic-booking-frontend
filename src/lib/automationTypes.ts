export interface FinderTechnique {
  key: string;
  label: string;
  summary: string;
  why: string;
  source: "named" | "goal" | "purpose" | "sample" | "synonym" | "ai" | string;
  score: number;
  available: boolean;
}

export interface FinderResult {
  equipment_id: number;
  name: string;
  code?: string;
  department?: string | null;
  location?: string | null;
  status?: string;
  score: number;
  reasons: string[];
  techniques: string[];
  detail_href: string;
  book_href: string;
  [key: string]: unknown;
}

export interface InstrumentFinderResponse {
  enabled: boolean;
  query?: string;
  sample?: string;
  method?: "rules" | "rules+ai" | string;
  techniques: FinderTechnique[];
  results: FinderResult[];
  tips?: string[];
}

export interface SlotSuggestion {
  slot_ids: number[];
  date: string;
  start: string | null;
  end: string | null;
  label: string;
  score: number;
  reasons: string[];
}

export interface SlotAlternative {
  equipment_id: number;
  name: string;
  code: string;
  first_label: string;
  first_date: string;
  href: string;
  reason: string;
}

export interface SlotSuggestionsResponse {
  enabled: boolean;
  equipment_id?: number;
  slot_count?: number;
  window_days?: number;
  suggestions: SlotSuggestion[];
  usual_hours?: number[];
  alternatives: SlotAlternative[];
  message?: string;
}

export interface AutomationSettings {
  instrument_finder_enabled: boolean;
  instrument_finder_llm_enabled: boolean;
  llm_daily_call_limit: number;
  smart_slots_enabled: boolean;
  ticket_triage_enabled: boolean;
  ticket_auto_assign_enabled: boolean;
  oic_alerts_enabled: boolean;
  oic_alert_utilisation_drop_pct: number;
  oic_alert_min_cancellations: number;
  oic_alert_min_disruptions: number;
  no_show_prompts_enabled: boolean;
  no_show_grace_minutes: number;
  updated_at: string | null;
  updated_by: string | null;
  llm_calls_today: number;
  llm_provider: string;
}

export interface OicAlertPreview {
  week: string;
  dry_run: boolean;
  enabled: boolean;
  equipment_flagged: number;
  flags: Record<string, number>;
  recipients: number;
  sent: number;
  skipped: number;
  equipment: {
    equipment_id: number;
    name: string;
    code: string;
    flags: { kind: string; text: string }[];
    metrics: Record<string, number>;
  }[];
}

export interface NoShowPreview {
  dry_run: boolean;
  enabled: boolean;
  bookings: number;
  already_prompted: number;
  recipients: number;
  emails_sent: number;
  booking_ids: number[];
}

export interface TicketTriageSuggestion {
  topic: string;
  category: string;
  priority: string;
  route_role: "oic" | "operator" | "admin" | string;
  equipment: { equipment_id: number; name: string; code: string } | null;
  suggested_assignee: { id: number; name: string } | null;
  confidence: number;
  reasons: string[];
  reply_draft: string;
  draft_sources: { type: string; id: string; title: string }[];
}

export interface TicketTriagePreviewRow extends TicketTriageSuggestion {
  ticket_id: number;
  subject: string;
  current_type: string;
  assigned: boolean;
}

export interface TicketTriagePreview {
  dry_run: boolean;
  count: number;
  results: TicketTriagePreviewRow[];
}

export interface TicketTriageResponse extends Partial<TicketTriageSuggestion> {
  enabled: boolean;
  saved?: boolean;
  status?: "preview" | "suggested" | "accepted" | "dismissed";
  decided_by?: string | null;
  decided_at?: string | null;
}

export interface AutomationLogRow {
  id: number;
  kind: string;
  kind_label: string;
  action: string;
  target_type: string;
  target_id: string;
  recipient: string | null;
  actor: string | null;
  summary: string;
  created_at: string;
}

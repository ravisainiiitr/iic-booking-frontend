import { API_BASE_URL, apiClient } from "@/lib/api";

/**
 * Online learning before hands-on training (`/api/v1/learning/`): modules with reading, video link and SOP PDF,
 * a read-and-understood sign-off, multiple-choice quizzes, the training-request prerequisite, and the booking logbook.
 */
const BASE = "/v1/learning/";

export interface LearningResult<T> {
  data?: T;
  error?: string;
  code?: string;
  status?: number;
}

export interface ModuleProgress {
  viewed_at: string | null;
  acknowledged_at: string | null;
  attempts: number;
  best_score_pct: number | null;
  passed_at: string | null;
  complete: boolean;
}

export interface QuizQuestion {
  id: number;
  text: string;
  options: string[];
  order: number;
  multiple: boolean;
  /** Staff only. */
  correct?: number[];
  explanation?: string;
  is_active?: boolean;
}

export interface LearningModule {
  id: number;
  equipment_id: number;
  title: string;
  summary: string;
  video_url: string;
  document_url: string | null;
  order: number;
  is_required: boolean;
  requires_acknowledgement: boolean;
  acknowledgement_text: string;
  pass_mark_pct: number;
  max_attempts_per_day: number;
  is_published: boolean;
  question_count: number;
  progress: ModuleProgress;
  can_edit: boolean;
  body?: string;
  questions?: QuizQuestion[];
}

export interface EquipmentModules {
  equipment: { equipment_id: number; name: string; code: string };
  results: LearningModule[];
  required_incomplete: string[];
  modules_before_training_request: boolean;
  can_edit: boolean;
  can_configure: boolean;
}

export interface QuizResult {
  score_pct: number;
  passed: boolean;
  pass_mark_pct: number;
  complete: boolean;
  results: Array<{ question_id: number; correct: boolean; correct_options: number[]; explanation: string }>;
}

export interface ModuleInput {
  title?: string;
  summary?: string;
  body?: string;
  video_url?: string;
  is_required?: boolean;
  requires_acknowledgement?: boolean;
  pass_mark_pct?: number;
  is_published?: boolean;
}

export interface LogbookEntry {
  id: number;
  booking_id: number;
  kind: string;
  kind_label: string;
  text: string;
  author: { id: number; name: string } | null;
  created_at: string;
}

function headers(json = true): Record<string, string> {
  const token = apiClient.getToken();
  return { ...(json ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Token ${token}` } : {}) };
}

async function request<T>(path: string, init: RequestInit = {}, json = true): Promise<LearningResult<T>> {
  try {
    const res = await fetch(`${API_BASE_URL}${BASE}${path}`, { ...init, headers: headers(json), credentials: "omit" });
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

const send = <T>(method: string, path: string, body: unknown = {}) => request<T>(path, { method, body: JSON.stringify(body) });

export const learningApi = {
  modules: (equipmentId: number) => request<EquipmentModules>(`equipment/${equipmentId}/modules/`),
  createModule: (equipmentId: number, input: ModuleInput) => send<LearningModule>("POST", `equipment/${equipmentId}/modules/`, input),
  module: (id: number) => request<LearningModule>(`modules/${id}/`),
  updateModule: (id: number, input: ModuleInput) => send<LearningModule>("PATCH", `modules/${id}/`, input),
  uploadDocument: (id: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<LearningModule>(`modules/${id}/document/`, { method: "POST", body: form }, false);
  },
  addQuestion: (id: number, input: { text: string; options: string[]; correct: number[]; explanation?: string }) =>
    send<QuizQuestion>("POST", `modules/${id}/questions/`, input),
  updateQuestion: (id: number, input: Partial<{ text: string; options: string[]; correct: number[]; is_active: boolean }>) =>
    send<QuizQuestion>("PATCH", `questions/${id}/`, input),
  viewed: (id: number) => send<ModuleProgress>("POST", `modules/${id}/viewed/`),
  acknowledge: (id: number) => send<ModuleProgress>("POST", `modules/${id}/acknowledge/`),
  attempt: (id: number, answers: Record<string, number[]>) => send<QuizResult>("POST", `modules/${id}/attempt/`, { answers }),
  saveSetting: (equipmentId: number, modulesBeforeTrainingRequest: boolean) =>
    send<{ modules_before_training_request: boolean }>("PUT", `equipment/${equipmentId}/settings/`, {
      modules_before_training_request: modulesBeforeTrainingRequest,
    }),
  logbook: (bookingId: number) =>
    request<{ results: LogbookEntry[]; kinds: Array<{ value: string; label: string }> }>(`bookings/${bookingId}/logbook/`),
  addLogbookEntry: (bookingId: number, kind: string, text: string) =>
    send<LogbookEntry>("POST", `bookings/${bookingId}/logbook/`, { kind, text }),
};

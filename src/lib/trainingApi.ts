import { API_BASE_URL, apiClient } from "@/lib/api";
import type {
  AppealRow,
  AttendanceSaveResult,
  AttendanceSessionRow,
  AttendanceStatus,
  CreateDemoRequestInput,
  CreateNominationInput,
  DemoDecisionInput,
  DemoPurpose,
  DemoQuote,
  DemoRequest,
  FacultyStudentTrainings,
  MyTrainings,
  Nomination,
  NominationCall,
  OverrideOutcome,
  PublishedResults,
  PublishPolicyInput,
  ReservationConflict,
  RunVerification,
  SessionAttendance,
  SessionInput,
  ShortlistRun,
  TrainingAudience,
  TrainingAward,
  TrainingBadge,
  TrainingBootstrap,
  TrainingEquipmentDetail,
  TrainingEquipmentList,
  TrainingEvent,
  TrainingModuleEquipment,
  TrainingModuleState,
  TrainingPolicy,
  TrainingPolicyOverview,
  TrainingSession,
  TrainingUserRef,
  TrainingWindow,
  WorkspaceSummary,
} from "@/lib/trainingTypes";
import type {
  AccountingQuery,
  Assessment,
  AssessmentCandidate,
  AssessmentInput,
  CertificationAction,
  CertificationDetail,
  CertificationLevelInfo,
  CompetencyChecklist,
  DutyAllocation,
  DutyCalendar,
  DutyCreateInput,
  DutyLive,
  DutyPlan,
  DutyPlanInput,
  DutyShift,
  DutyStatement,
  HoursSummary,
  MyDuty,
  OperatorPolicy,
  OperatorPolicyInput,
  OperatorPolicyOverview,
  PublicCertificate,
  PublicDuty,
  RosterEntry,
  ShiftAction,
} from "@/lib/trainingOpsTypes";

const BASE = "/v1/training/";

export interface TrainingResult<T> {
  data?: T;
  error?: string;
  code?: string;
  status?: number;
  body?: Record<string, unknown>;
}

type Query = Record<string, string | number | boolean | null | undefined>;

function withQuery(path: string, query?: Query): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "" || value === false) continue;
    params.append(key, value === true ? "1" : String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

function errorMessage(body: Record<string, unknown>, status: number): string {
  const detail = body.detail ?? body.error ?? body.message;
  if (typeof detail === "string" && detail.trim()) return detail;
  for (const value of Object.values(body)) {
    if (typeof value === "string" && value.trim()) return value;
    if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  }
  return `Request failed (HTTP ${status})`;
}

function authHeaders(): Record<string, string> {
  const token = apiClient.getToken();
  return token ? { Authorization: `Token ${token}` } : {};
}

function handleUnauthorized(status: number) {
  if (status !== 401) return;
  apiClient.setToken(null);
  localStorage.removeItem("user");
  apiClient.onUnauthorized?.();
}

async function request<T>(path: string, init: RequestInit = {}): Promise<TrainingResult<T>> {
  try {
    const res = await fetch(`${API_BASE_URL}${BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...authHeaders(), ...(init.headers ?? {}) },
      credentials: "omit",
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      handleUnauthorized(res.status);
      return {
        error: errorMessage(body, res.status),
        code: typeof body.code === "string" ? body.code : undefined,
        status: res.status,
        body,
      };
    }
    return { data: body as T, status: res.status };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Network error occurred" };
  }
}

const get = <T>(path: string, query?: Query) => request<T>(withQuery(path, query));
const post = <T>(path: string, body: unknown = {}) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body) });
const patch = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
const put = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "PUT", body: JSON.stringify(body) });

/** Reservation conflicts returned with a 409/400 when instrument slots are taken. */
export function reservationConflicts(res: TrainingResult<unknown>): ReservationConflict[] {
  const body = res.body;
  if (!body) return [];
  const extra = body.extra as Record<string, unknown> | undefined;
  const list = body.conflicts ?? extra?.conflicts;
  return Array.isArray(list) ? (list as ReservationConflict[]) : [];
}

async function downloadFile(path: string, fallbackName: string): Promise<{ error?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}${BASE}${path}`, { method: "GET", headers: authHeaders(), credentials: "omit" });
    if (!res.ok) {
      handleUnauthorized(res.status);
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      return { error: errorMessage(body, res.status) };
    }
    const blob = await res.blob();
    const name = res.headers.get("Content-Disposition")?.match(/filename="?([^";]+)"?/i)?.[1] || fallbackName;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Download failed" };
  }
}

type Results<T> = { results: T[] };

export const trainingApi = {
  bootstrap: () => get<TrainingBootstrap>("bootstrap/"),

  equipment: (query: { q?: string; managed?: boolean; department_id?: number | "all" }) =>
    get<TrainingEquipmentList>("equipment/", query),
  equipmentDetail: (id: number) => get<TrainingEquipmentDetail>(`equipment/${id}/`),
  demoQuote: (id: number, query: { purpose: DemoPurpose; minutes: number; request_id?: number }) =>
    get<DemoQuote>(`equipment/${id}/demo-quote/`, query),
  freeWindows: (id: number, query: { date_from: string; date_to?: string; duration: number }) =>
    get<{ windows: TrainingWindow[] }>(`equipment/${id}/free-windows/`, query),

  demoRequests: (query: { scope?: "mine" | "inbox"; status?: string }) => get<Results<DemoRequest>>("demo-requests/", query),
  createDemoRequest: (input: CreateDemoRequestInput) => post<DemoRequest>("demo-requests/", input),
  demoRequest: (id: number) => get<DemoRequest>(`demo-requests/${id}/`),
  decideDemo: (id: number, input: DemoDecisionInput) => post<DemoRequest>(`demo-requests/${id}/decide/`, input),
  respondDemo: (id: number, input: { response: "accept" | "counter" | "decline"; windows?: Array<{ start: string; end: string }>; note?: string }) =>
    post<DemoRequest>(`demo-requests/${id}/respond/`, input),
  scheduleDemo: (id: number, startAt: string) => post<DemoRequest>(`demo-requests/${id}/schedule/`, { start_at: startAt }),
  cancelDemo: (id: number, reason: string) => post<DemoRequest>(`demo-requests/${id}/cancel/`, { reason }),
  withdrawDemo: (id: number, reason?: string) => post<DemoRequest>(`demo-requests/${id}/withdraw/`, { reason }),
  waiveDemoCharge: (id: number, reason: string) => post<DemoRequest>(`demo-requests/${id}/waive/`, { reason }),
  demoAttendance: (id: number, input: { attended_count?: number; present_user_ids?: number[] }) =>
    post<DemoRequest>(`demo-requests/${id}/attendance/`, input),
  completeDemo: (id: number, input: { no_show?: boolean; attended_count?: number }) =>
    post<DemoRequest>(`demo-requests/${id}/complete/`, input),

  calls: (query: { scope?: "open" | "manage" | "mine"; status?: string }) => get<Results<NominationCall>>("calls/", query),
  createCall: (input: { equipment_id: number; seats: number; deadline: string; title?: string; description?: string; venue?: string; notes?: string }) =>
    post<NominationCall>("calls/", input),
  call: (id: number) => get<NominationCall>(`calls/${id}/`),
  closeCall: (id: number) => post<NominationCall>(`calls/${id}/close/`),
  callNominations: (id: number) => get<Results<Nomination>>(`calls/${id}/nominations/`),
  callShortlist: (id: number) => get<{ run: ShortlistRun | null }>(`calls/${id}/shortlist/`),
  runShortlist: (id: number, publicInput?: string) =>
    post<ShortlistRun>(`calls/${id}/shortlist/`, publicInput ? { public_input: publicInput } : {}),
  callResults: (id: number) => get<PublishedResults>(`calls/${id}/results/`),

  nominations: (query: { active?: boolean } = {}) => get<Results<Nomination>>("nominations/", query),
  createNomination: (input: CreateNominationInput) => post<Nomination>("nominations/", input),
  withdrawNomination: (id: number) => post<Nomination>(`nominations/${id}/withdraw/`),
  confirmInterest: (id: number, sopAcknowledged?: boolean) =>
    post<Nomination>(`nominations/${id}/confirm-interest/`, { sop_acknowledged: sopAcknowledged }),
  acceptSeat: (id: number, sopAcknowledged?: boolean) =>
    post<Nomination>(`nominations/${id}/accept-seat/`, { sop_acknowledged: sopAcknowledged }),
  declineSeat: (id: number) => post<Nomination>(`nominations/${id}/decline-seat/`),
  adjustNeed: (id: number, points: number, reason: string) => post<Nomination>(`nominations/${id}/adjust-need/`, { points, reason }),

  facultyStudents: () => get<Results<FacultyStudentTrainings>>("faculty/students-trainings/"),

  publishRun: (id: number, publicInput: string) => post<ShortlistRun>(`shortlist-runs/${id}/publish/`, { public_input: publicInput }),
  exportRun: (id: number) => downloadFile(`shortlist-runs/${id}/export/`, `shortlist-${id}.csv`),
  verifyRun: (id: number) => get<RunVerification>(`shortlist-runs/${id}/verify/`),
  overrideEntry: (id: number, outcome: OverrideOutcome, reason: string) =>
    post<ShortlistRun>(`shortlist-entries/${id}/override/`, { outcome, reason }),
  appealEntry: (id: number, reason: string) => post<unknown>(`shortlist-entries/${id}/appeal/`, { reason }),

  appeals: (query: { status?: string } = {}) => get<Results<AppealRow>>("appeals/", query),
  decideAppeal: (id: number, decision: "UPHELD" | "OVERTURNED", note: string) =>
    post<AppealRow>(`appeals/${id}/decide/`, { decision, note }),

  events: (query: { status?: string } = {}) => get<Results<TrainingEvent>>("events/", query),
  event: (id: number) => get<TrainingEvent>(`events/${id}/`),
  updateEvent: (id: number, input: { title?: string; description?: string; venue?: string; capacity?: number | null }) =>
    patch<TrainingEvent>(`events/${id}/`, input),
  cancelEvent: (id: number, reason: string) => post<TrainingEvent>(`events/${id}/cancel/`, { reason }),
  addSession: (eventId: number, input: SessionInput) => post<TrainingSession>(`events/${eventId}/sessions/`, input),
  updateSession: (id: number, input: SessionInput) => patch<TrainingSession>(`sessions/${id}/`, input),
  cancelSession: (id: number) => request<TrainingSession>(`sessions/${id}/`, { method: "DELETE" }),
  reserveSession: (id: number) => post<TrainingSession>(`sessions/${id}/reserve/`),
  releaseSession: (id: number) => post<TrainingSession>(`sessions/${id}/release/`),
  sessionAttendance: (id: number) => get<SessionAttendance>(`sessions/${id}/attendance/`),
  saveAttendance: (id: number, rows: Array<{ registration_id: number; status: AttendanceStatus; remarks?: string }>) =>
    post<AttendanceSaveResult>(`sessions/${id}/attendance/`, { rows }),
  attendanceSessions: () => get<Results<AttendanceSessionRow>>("attendance/sessions/"),

  certifications: (query: { equipment_id?: number } = {}) => get<Results<TrainingAward>>("certifications/", query),
  badges: (userIds: number[]) => get<{ results: Record<string, TrainingBadge[]> }>("badges/", { user_ids: userIds.join(",") }),
  meTrainings: () => get<MyTrainings>("me/trainings/"),
  workspaceSummary: () => get<WorkspaceSummary>("workspace/summary/"),

  policy: () => get<TrainingPolicyOverview>("policy/"),
  publishPolicy: (input: PublishPolicyInput) => post<TrainingPolicy>("policy/", input),
  policyHistory: () => get<Results<TrainingPolicy>>("policy/history/"),

  moduleState: () => get<TrainingModuleState>("admin/module/"),
  updateModule: (input: { module_enabled?: boolean; audience?: TrainingAudience; course_demos_free?: boolean }) =>
    post<TrainingModuleState>("admin/module/", input),
  moduleEquipment: (query: { q?: string; enabled?: boolean }) =>
    get<{ count: number; limit: number; results: TrainingModuleEquipment[] }>("admin/equipment/", query),
  setEquipmentEnabled: (equipmentId: number, enabled: boolean) =>
    post<TrainingModuleEquipment>(`admin/equipment/${equipmentId}/`, { enabled }),

  levels: () => get<Results<CertificationLevelInfo>>("levels/"),
  checklist: (equipmentId: number) => get<CompetencyChecklist>(`equipment/${equipmentId}/checklist/`),
  saveChecklist: (equipmentId: number, input: Pick<CompetencyChecklist, "items" | "theory_pass_pct" | "practical_pass_pct">) =>
    put<CompetencyChecklist>(`equipment/${equipmentId}/checklist/`, input),
  assessments: (query: { equipment_id?: number; awaiting_sign_off?: boolean; user_id?: number } = {}) =>
    get<Results<Assessment>>("assessments/", query),
  recordAssessment: (input: AssessmentInput) => post<Assessment>("assessments/", input),
  signOffAssessment: (id: number) => post<Assessment>(`assessments/${id}/sign-off/`),
  assessmentCandidates: (equipmentId: number, q?: string) =>
    get<Results<AssessmentCandidate>>("assessment-candidates/", { equipment_id: equipmentId, q }),
  certification: (id: number) => get<CertificationDetail>(`certifications/${id}/`),
  certificationAction: (id: number, action: CertificationAction, input: { reason: string; until?: string; months?: number }) =>
    post<TrainingAward>(`certifications/${id}/${action}/`, input),
  downloadCertificate: (id: number, certificateNo?: string) =>
    downloadFile(`certifications/${id}/certificate.pdf`, `${certificateNo || `certificate-${id}`}.pdf`),
  verifyCertificate: (token: string) => get<PublicCertificate>(`verify/${encodeURIComponent(token)}/`),

  roster: (query: { equipment_id?: number; include_removed?: boolean } = {}) => get<Results<RosterEntry>>("roster/", query),
  addToRoster: (input: { equipment_id: number; user_id: number; reason: string }) => post<RosterEntry>("roster/", input),
  updateRoster: (id: number, input: { max_hours_week?: number | null; note?: string }) => patch<RosterEntry>(`roster/${id}/`, input),
  rosterAction: (id: number, action: "pause" | "resume" | "remove", reason: string) =>
    post<RosterEntry>(`roster/${id}/${action}/`, { reason }),
  rosterPeople: (equipmentId: number, q: string) => get<Results<TrainingUserRef>>("roster/people/", { equipment_id: equipmentId, q }),

  planDuty: (input: DutyPlanInput) => post<DutyPlan>("duty/plan/", input),
  createDuty: (input: DutyCreateInput) => post<DutyAllocation>("duty/allocations/", input),
  dutyAllocations: (query: { equipment_id?: number; operator_id?: number; status?: string; academic_year?: string } = {}) =>
    get<Results<DutyAllocation>>("duty/allocations/", query),
  dutyAllocation: (id: number) => get<DutyAllocation>(`duty/allocations/${id}/`),
  dutyAction: (id: number, action: "confirm" | "decline" | "cancel" | "remind", reason?: string) =>
    post<DutyAllocation>(`duty/allocations/${id}/${action}/`, reason ? { reason } : {}),
  shiftAction: (id: number, action: ShiftAction, input: { operated_minutes?: number; remarks?: string } = {}) =>
    post<DutyShift>(`duty/shifts/${id}/${action}/`, input),
  dutyCalendar: (equipmentId: number, dateFrom: string, dateTo: string) =>
    get<DutyCalendar>("duty/calendar/", { equipment_id: equipmentId, date_from: dateFrom, date_to: dateTo }),
  myDuty: (academicYear?: string) => get<MyDuty>("duty/me/", { academic_year: academicYear }),
  dutyAccounting: (query: AccountingQuery) => get<HoursSummary>("duty/accounting/", { ...query }),
  exportDutyAccounting: (query: AccountingQuery) =>
    downloadFile(withQuery("duty/accounting/export/", { ...query }), "operator-duty-hours.csv"),
  dutyStatement: (query: AccountingQuery) => get<DutyStatement>("duty/statement/", { ...query }),
  exportDutyStatement: (query: AccountingQuery) =>
    downloadFile(withQuery("duty/statement/", { ...query, format: "csv" }), "duty-statement.csv"),
  dutyLive: () => get<DutyLive>("duty/live/"),
  /** Public: the signed link from the duty email (works without signing in). */
  dutyRespondView: (token: string) => get<PublicDuty>("duty/respond/", { token }),
  dutyRespond: (token: string, action: "confirm" | "decline", reason?: string) =>
    post<PublicDuty>("duty/respond/", { token, action, reason }),

  operatorPolicy: (equipmentId?: number) => get<OperatorPolicyOverview>("operator-policy/", { equipment_id: equipmentId }),
  publishOperatorPolicy: (input: OperatorPolicyInput) => post<OperatorPolicy>("operator-policy/", input),
  operatorPolicyHistory: () => get<Results<OperatorPolicy>>("operator-policy/history/"),
};

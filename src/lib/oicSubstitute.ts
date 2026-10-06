/** OIC Substitute: types shared by the API client and the page, plus pure display helpers. */

export type OicSubstituteStatus = "scheduled" | "active" | "expired" | "cancelled" | "revoked";

export interface OicSubstitutePerson {
  id: number;
  name: string;
  email: string;
}

export interface OicSubstituteEvent {
  id: number;
  action: "created" | "period_changed" | "cancelled" | "revoked" | "expired";
  action_label: string;
  actor_name: string;
  reason: string;
  created_at: string;
}

export interface OicSubstitution {
  id: number;
  batch_id: string | null;
  equipment: { id: number; code: string; name: string };
  primary_oic: OicSubstitutePerson | null;
  substitute: OicSubstitutePerson | null;
  start_at: string;
  resume_at: string;
  start_display: string;
  end_display: string;
  status: OicSubstituteStatus;
  status_label: string;
  reason: string;
  created_at: string;
  created_by: OicSubstitutePerson | null;
  ended_at: string | null;
  ended_by: OicSubstitutePerson | null;
  end_reason: string;
  can_end: boolean;
  events: OicSubstituteEvent[];
}

export interface OicSubstituteEquipment {
  id: number;
  code: string;
  name: string;
}

export interface OicSubstituteOptions {
  role: "oic" | "admin";
  department: { id: number; name: string } | null;
  equipments: OicSubstituteEquipment[];
  max_substitutes?: number;
  max_period_days?: number;
  max_bulk_rows?: number;
  today?: string;
}

/** One row of the bulk request: an equipment, its substitutes and optional own dates (YYYY-MM-DD). */
export interface OicBulkAssignment {
  equipment_id: number;
  substitute_ids: number[];
  start_date?: string;
  end_date?: string;
}

/** A problem with one row of a bulk request (index into `assignments`), or with one id of a bulk end. */
export interface OicBulkRowError {
  index?: number;
  id?: number;
  equipment_id?: number | null;
  substitute_id?: number | null;
  field?: string;
  message: string;
}

/** Page state of one equipment row in the assign form. */
export interface OicAssignRow {
  selected: boolean;
  substitutes: OicSubstitutePerson[];
  customDates: boolean;
  startDate: string;
  endDate: string;
}

export type OicSubstituteTab = "active" | "scheduled" | "past";

export function substitutionTab(status: OicSubstituteStatus): OicSubstituteTab {
  if (status === "active") return "active";
  if (status === "scheduled") return "scheduled";
  return "past";
}

export function groupSubstitutions(items: OicSubstitution[]): Record<OicSubstituteTab, OicSubstitution[]> {
  const groups: Record<OicSubstituteTab, OicSubstitution[]> = { active: [], scheduled: [], past: [] };
  for (const item of items) groups[substitutionTab(item.status)].push(item);
  groups.active.sort((a, b) => a.resume_at.localeCompare(b.resume_at));
  groups.scheduled.sort((a, b) => a.start_at.localeCompare(b.start_at));
  return groups;
}

/** Soft badge classes (semantic tokens) per status; the label is always shown next to the colour. */
export function substitutionStatusClass(status: OicSubstituteStatus): string {
  switch (status) {
    case "active":
      return "bg-success-subtle text-success-subtle-foreground border-success-border";
    case "scheduled":
      return "bg-info-subtle text-info-subtle-foreground border-info-border";
    case "revoked":
    case "cancelled":
      return "bg-destructive-subtle text-destructive-subtle-foreground border-destructive-border";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

/** "Revoke" while access is in force, "Cancel" before it starts. */
export function endActionLabel(status: OicSubstituteStatus): "Revoke" | "Cancel" {
  return status === "scheduled" ? "Cancel" : "Revoke";
}

/** Today's date in IST as YYYY-MM-DD (the backend validates periods in IST). */
export function todayInIst(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** "2026-10-06" -> "06-10-2026"; anything else is returned unchanged. */
export function formatDmy(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate || "");
  return m ? `${m[3]}-${m[2]}-${m[1]}` : isoDate || "";
}

/** IST calendar date (YYYY-MM-DD) of an ISO datetime. */
export function istDateOf(isoDateTime: string): string {
  const d = new Date(isoDateTime);
  return Number.isNaN(d.getTime()) ? "" : todayInIst(d);
}

/** Whole IST days of a substitution: the end is the last day with access (a midnight end counts as the day before). */
export function substitutionDays(item: Pick<OicSubstitution, "start_at" | "resume_at">): { start: string; end: string } {
  const resume = new Date(item.resume_at);
  const lastMoment = Number.isNaN(resume.getTime()) ? resume : new Date(resume.getTime() - 60_000);
  return { start: istDateOf(item.start_at), end: Number.isNaN(lastMoment.getTime()) ? "" : todayInIst(lastMoment) };
}

/** "06-10-2026 to 08-10-2026", or a single date for a one-day period. */
export function periodDmy(start: string, end: string): string {
  if (!start) return "";
  if (!end || end === start) return formatDmy(start);
  return `${formatDmy(start)} to ${formatDmy(end)}`;
}

export function equipmentLabel(eq: Pick<OicSubstituteEquipment, "code" | "name">): string {
  return eq.name || eq.code || "Equipment";
}

export function personName(p: OicSubstitutePerson | null | undefined): string {
  return p ? p.name || p.email || "—" : "—";
}

/** Client-side check of one row against the shared period; "" when fine. */
export function periodProblem(start: string, end: string, today: string): string {
  if (!start || !end) return "Choose the From and Until dates.";
  if (start < today) return "The start date cannot be in the past.";
  if (end < start) return "The end date must be on or after the start date.";
  return "";
}

export interface OicAssignPlanItem {
  equipment: OicSubstituteEquipment;
  substitutes: OicSubstitutePerson[];
  startDate: string;
  endDate: string;
  customDates: boolean;
}

/** Selected rows in equipment order, with the dates that will be sent (own dates or the shared period). */
export function buildAssignPlan(
  equipments: OicSubstituteEquipment[],
  rows: Record<number, OicAssignRow | undefined>,
  shared: { startDate: string; endDate: string },
): OicAssignPlanItem[] {
  const plan: OicAssignPlanItem[] = [];
  for (const equipment of equipments) {
    const row = rows[equipment.id];
    if (!row?.selected) continue;
    const custom = row.customDates;
    plan.push({
      equipment,
      substitutes: row.substitutes,
      startDate: custom ? row.startDate : shared.startDate,
      endDate: custom ? row.endDate : shared.endDate,
      customDates: custom,
    });
  }
  return plan;
}

export function planToAssignments(plan: OicAssignPlanItem[]): OicBulkAssignment[] {
  return plan.map((p) => ({
    equipment_id: p.equipment.id,
    substitute_ids: p.substitutes.map((s) => s.id),
    ...(p.customDates ? { start_date: p.startDate, end_date: p.endDate } : {}),
  }));
}

/** Problems to fix before review, keyed by equipment id. */
export function planProblems(plan: OicAssignPlanItem[], today: string): Record<number, string> {
  const out: Record<number, string> = {};
  for (const p of plan) {
    const problem = p.substitutes.length === 0 ? "Choose a substitute." : periodProblem(p.startDate, p.endDate, today);
    if (problem) out[p.equipment.id] = problem;
  }
  return out;
}

export interface OicPlanBySubstitute {
  substitute: OicSubstitutePerson;
  items: Array<{ equipment: OicSubstituteEquipment; startDate: string; endDate: string }>;
}

/** Review summary: who gets what, one entry per substitute (in name order). */
export function planBySubstitute(plan: OicAssignPlanItem[]): OicPlanBySubstitute[] {
  const map = new Map<number, OicPlanBySubstitute>();
  for (const p of plan) {
    for (const s of p.substitutes) {
      if (!map.has(s.id)) map.set(s.id, { substitute: s, items: [] });
      map.get(s.id)!.items.push({ equipment: p.equipment, startDate: p.startDate, endDate: p.endDate });
    }
  }
  return [...map.values()].sort((a, b) => personName(a.substitute).localeCompare(personName(b.substitute)));
}

/** Server row errors mapped to the equipment of each row, several messages joined. */
export function rowErrorsByEquipment(
  errors: OicBulkRowError[] | undefined,
  assignments: OicBulkAssignment[],
): Record<number, string> {
  const out: Record<number, string> = {};
  for (const e of errors ?? []) {
    const eqId = e.equipment_id ?? (e.index != null ? assignments[e.index]?.equipment_id : undefined);
    if (eqId == null) continue;
    out[eqId] = out[eqId] ? `${out[eqId]} ${e.message}` : e.message;
  }
  return out;
}

export interface OicSubstitutionGroup {
  key: string;
  person: OicSubstitutePerson | null;
  items: OicSubstitution[];
}

/** Group list items by the substitute (or by the granting OIC for "assigned to me"), in name order. */
export function groupByPerson(items: OicSubstitution[], by: "substitute" | "primary_oic"): OicSubstitutionGroup[] {
  const map = new Map<string, OicSubstitutionGroup>();
  for (const item of items) {
    const person = item[by];
    const key = person ? String(person.id) : "none";
    if (!map.has(key)) map.set(key, { key, person, items: [] });
    map.get(key)!.items.push(item);
  }
  return [...map.values()].sort((a, b) => personName(a.person).localeCompare(personName(b.person)));
}

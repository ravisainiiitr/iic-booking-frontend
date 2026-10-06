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

export interface OicSubstituteOptions {
  role: "oic" | "admin";
  department: { id: number; name: string } | null;
  equipments: Array<{ id: number; code: string; name: string }>;
  max_substitutes?: number;
  max_period_days?: number;
  today?: string;
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

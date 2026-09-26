import type {
  GroupActivityPriority,
  GroupActivityStatus,
  GroupEvent,
  GroupMemberType,
  UpdateRequestStatus,
} from "@/lib/researchGroupTypes";

export const MEMBER_TYPE_OPTIONS: Array<{ value: GroupMemberType; label: string }> = [
  { value: "PHD", label: "Ph.D." },
  { value: "MTECH", label: "M.Tech" },
  { value: "BTECH", label: "B.Tech" },
  { value: "RESEARCH_ASSOCIATE", label: "Research Associate" },
  { value: "JRF", label: "JRF" },
  { value: "SRF", label: "SRF" },
  { value: "PROJECT_STAFF", label: "Project Staff" },
  { value: "INTERN", label: "Intern" },
  { value: "OTHER", label: "Other" },
];

export const ACTIVITY_STATUS_OPTIONS: Array<{ value: GroupActivityStatus; label: string }> = [
  { value: "NOT_STARTED", label: "Not started" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "WAITING", label: "Waiting" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "UNDER_REVIEW", label: "Under review" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

/** Statuses a member may set on their own assignment (the server enforces the same list). */
export const ASSIGNEE_STATUS_OPTIONS = ACTIVITY_STATUS_OPTIONS.filter((o) =>
  ["NOT_STARTED", "IN_PROGRESS", "WAITING", "SUBMITTED"].includes(o.value),
);

export const PRIORITY_OPTIONS: Array<{ value: GroupActivityPriority; label: string }> = [
  { value: "LOW", label: "Low" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
];

export const OPEN_ACTIVITY_STATUSES: GroupActivityStatus[] = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "WAITING",
  "SUBMITTED",
  "UNDER_REVIEW",
];

export function activityStatusLabel(status: GroupActivityStatus): string {
  return ACTIVITY_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

export const REQUEST_STATUS_LABEL: Record<UpdateRequestStatus, string> = {
  PENDING: "Pending",
  SUBMITTED: "Submitted",
  REVIEWED: "Reviewed",
  CANCELLED: "Cancelled",
  OVERDUE: "Overdue",
};

export function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function eventSentence(e: GroupEvent): string {
  const verb = e.action_label.toLowerCase();
  const subject = e.subject && e.subject.id !== e.actor?.id ? ` · ${e.subject.name}` : "";
  return `${verb}${e.target_label ? ` “${e.target_label}”` : ""}${subject}`;
}

export function groupPath(groupId: string, tab?: string, extra?: Record<string, string>): string {
  const q = new URLSearchParams();
  if (tab) q.set("tab", tab);
  for (const [k, v] of Object.entries(extra ?? {})) q.set(k, v);
  const qs = q.toString();
  return `/my-research/groups/${groupId}${qs ? `?${qs}` : ""}`;
}

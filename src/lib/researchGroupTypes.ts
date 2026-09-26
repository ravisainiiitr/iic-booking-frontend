import type { ResearchPagination, ResearchPublication, ResearchUserSummary } from "@/lib/myResearchTypes";

export type GroupRole = "OWNER" | "MANAGER" | "MEMBER";
export type GroupStatus = "ACTIVE" | "ARCHIVED";
export type GroupMemberType =
  | "PHD"
  | "MTECH"
  | "BTECH"
  | "RESEARCH_ASSOCIATE"
  | "JRF"
  | "SRF"
  | "PROJECT_STAFF"
  | "INTERN"
  | "OTHER";
export type GroupActivityStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "WAITING"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "COMPLETED"
  | "CANCELLED";
export type GroupActivityPriority = "LOW" | "NORMAL" | "HIGH";
export type UpdateRequestStatus = "PENDING" | "SUBMITTED" | "REVIEWED" | "CANCELLED" | "OVERDUE";
export type UpdatesState = "pending" | "submitted" | "overdue" | "history";

/** Name and department only; shown to every group member. */
export interface GroupPublicUser {
  id: number;
  name: string;
  department: string | null;
}

export interface GroupCategory {
  id: number;
  name: string;
  description: string;
  display_order: number;
  active: boolean;
}

export interface GroupCounts {
  members: number;
  active_activities?: number;
  pending_updates?: number;
  overdue_updates?: number;
  awaiting_review?: number;
  activities_due_this_week?: number;
  my_active_activities?: number;
  my_open_requests?: number;
}

export interface GroupPermissions {
  can_manage: boolean;
  is_owner: boolean;
  can_archive: boolean;
  can_manage_managers: boolean;
}

export interface ResearchGroupCardData {
  id: string;
  name: string;
  short_code: string;
  description: string;
  status: GroupStatus;
  owner: GroupPublicUser;
  my_role: GroupRole;
  created_at: string;
  archived_at: string | null;
  counts: GroupCounts;
  my_membership?: {
    member_type: GroupMemberType;
    member_type_label: string;
    category: GroupCategory | null;
  };
  permissions?: GroupPermissions;
}

export interface GroupEvent {
  id: number;
  action: string;
  action_label: string;
  actor: GroupPublicUser | null;
  subject: GroupPublicUser | null;
  target_type: string;
  target_id: string;
  target_label: string;
  created_at: string;
  group_id?: string;
  group_name?: string;
}

export interface GroupLinkedWorkspace {
  id: string;
  name: string;
  owner: GroupPublicUser | null;
  status: string;
  /** True only when the viewer already has workspace access through workspace sharing. */
  accessible: boolean;
  linked?: boolean;
}

export interface GroupAssignee {
  id: number;
  user: GroupPublicUser;
  status: GroupActivityStatus;
  status_label: string;
  progress_percent: number;
  note: string;
  assigned_at: string;
  updated_at: string;
}

export interface GroupBookingRef {
  booking_id: number;
  display_id: string;
  status_display: string;
  equipment_name: string | null;
  user?: GroupPublicUser;
}

export interface GroupEquipmentRef {
  equipment_id: number;
  name: string;
  code: string;
}

export interface GroupActivity {
  id: string;
  group_id: string;
  group_name: string;
  title: string;
  description: string;
  category: GroupCategory | null;
  status: GroupActivityStatus;
  status_label: string;
  priority: GroupActivityPriority;
  priority_label: string;
  progress_percent: number;
  start_date: string | null;
  due_date: string | null;
  is_overdue: boolean;
  completed_at: string | null;
  created_by: GroupPublicUser | null;
  created_at: string;
  updated_at: string;
  workspace: GroupLinkedWorkspace | null;
  equipment: GroupEquipmentRef | null;
  booking: GroupBookingRef | null;
  assignees: GroupAssignee[];
  assignee_count: number;
  my_assignment: GroupAssignee | null;
  permissions: { can_edit: boolean; can_update_progress: boolean };
}

export interface GroupAttachment {
  id: string;
  name: string;
  size_bytes: number;
  status: string;
  detected_type: string;
  created_at: string;
}

export interface GroupSubmission {
  id: string;
  work_completed: string;
  current_status: string;
  blockers: string;
  next_steps: string;
  progress_percent: number | null;
  expected_completion_date: string | null;
  submitted_at: string;
}

export interface GroupUpdateRequest {
  id: string;
  group_id: string;
  group_name: string;
  activity: { id: string; title: string } | null;
  title: string;
  instructions: string;
  due_date: string | null;
  days_overdue: number;
  status: UpdateRequestStatus;
  status_label: string;
  recurrence: string;
  requested_by: GroupPublicUser | null;
  assigned_to: GroupPublicUser;
  requested_at: string;
  completed_at: string | null;
  reviewed_at: string | null;
  reviewed_by: GroupPublicUser | null;
  review_comment: string;
  submission: GroupSubmission | null;
  attachments: GroupAttachment[];
  permissions: { can_submit: boolean; can_review: boolean; can_cancel: boolean };
}

export interface GroupMember {
  id: number;
  /** Managers receive the full summary (with email); members receive name and department only. */
  user: GroupPublicUser & Partial<Pick<ResearchUserSummary, "email" | "user_type_label">>;
  role: GroupRole;
  role_label: string;
  member_type: GroupMemberType;
  member_type_label: string;
  category: GroupCategory | null;
  status: "ACTIVE" | "LEFT";
  joined_at: string;
  left_at: string | null;
  active_activities?: number | null;
  open_update_requests?: number | null;
}

export interface GroupMemberDetail extends GroupMember {
  activities: GroupActivity[];
  update_requests: GroupUpdateRequest[];
  workspaces: GroupLinkedWorkspace[];
  recent_events: GroupEvent[];
}

export interface GroupNeedsAttention {
  pending_updates: number;
  overdue_updates: number;
  awaiting_review: number;
  activities_due_this_week: number;
  update_requests: GroupUpdateRequest[];
  activities_due: GroupActivity[];
}

export interface GroupMyWork {
  activities: GroupActivity[];
  update_requests: GroupUpdateRequest[];
}

export interface ResearchGroupsHome {
  can_create: boolean;
  is_faculty: boolean;
  managed_groups: ResearchGroupCardData[];
  member_groups: ResearchGroupCardData[];
  needs_attention: GroupNeedsAttention | null;
  my_work: GroupMyWork;
  recent_events: GroupEvent[];
}

export interface ResearchGroupDetail extends ResearchGroupCardData {
  owner_details: GroupPublicUser;
  permissions: GroupPermissions;
  categories: GroupCategory[];
  recent_events: GroupEvent[];
  needs_attention: GroupNeedsAttention | null;
  my_work?: GroupMyWork;
}

export interface GroupActivityInput {
  title?: string;
  description?: string;
  category_id?: number | null;
  status?: GroupActivityStatus;
  priority?: GroupActivityPriority;
  progress_percent?: number;
  start_date?: string | null;
  due_date?: string | null;
  workspace_id?: string | null;
  equipment_id?: number | null;
  booking_id?: number | null;
  assignee_user_ids?: number[];
}

export interface GroupAssigneeInput {
  my_status?: GroupActivityStatus;
  my_progress_percent?: number;
  my_note?: string;
}

export interface GroupUpdateSubmission {
  work_completed: string;
  current_status: string;
  blockers: string;
  next_steps: string;
  progress_percent: number | null;
  expected_completion_date: string | null;
  attachment_ids: string[];
}

export interface GroupAttachmentInitiateResponse {
  attachment: GroupAttachment;
  upload: { method: "PUT"; url: string; headers: Record<string, string>; expires_in: number };
}

export type GroupPaginated<T> = { results: T[]; pagination: ResearchPagination };
export type GroupPublication = ResearchPublication;

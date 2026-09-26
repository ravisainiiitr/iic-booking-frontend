export type ResearchRole = "OWNER" | "VIEWER";
export type ResearchWorkspaceStatus = "ACTIVE" | "ARCHIVED";
export type ResearchFileStatus = "PENDING_UPLOAD" | "AVAILABLE" | "FAILED" | "DELETED";
export type ResearchPreviewKind = "pdf" | "image" | "text" | "csv" | "none";

export interface ResearchUserSummary {
  id: number;
  name: string;
  email: string;
  department: string | null;
  user_type_label: string;
}

export interface MyResearchBootstrap {
  enabled: boolean;
  eligible: boolean;
  available: boolean;
  can_create?: boolean;
  pilot?: boolean;
  storage_configured?: boolean;
  limits?: {
    max_file_size: number;
    multipart_threshold: number;
    download_url_expiry_seconds: number;
    user_storage_quota: number;
    workspace_storage_quota: number;
  };
}

export interface ResearchWorkspaceStats {
  files: number;
  folders: number;
  bookings: number;
  equipment: number;
  publications: number;
  viewers: number;
  storage_bytes: number;
}

export interface ResearchPermissions {
  read_only: boolean;
  can_edit: boolean;
  can_share: boolean;
  can_upload: boolean;
  can_archive: boolean;
  can_restore: boolean;
}

export interface ResearchWorkspaceCard {
  id: string;
  name: string;
  description: string;
  status: ResearchWorkspaceStatus;
  role: ResearchRole;
  owner: ResearchUserSummary;
  created_at: string;
  archived_at: string | null;
  last_activity_at: string;
  stats: ResearchWorkspaceStats;
  permissions?: ResearchPermissions;
}

export interface ResearchActivity {
  id: number;
  action: string;
  action_label: string;
  actor: ResearchUserSummary | null;
  target_type: string;
  target_id: string;
  target_label: string;
  details: Record<string, unknown>;
  created_at: string;
  workspace_id?: string;
  workspace_name?: string;
}

export interface MyResearchHome {
  my_workspaces: ResearchWorkspaceCard[];
  shared_with_me: ResearchWorkspaceCard[];
  recent_activity: ResearchActivity[];
  can_create: boolean;
  storage: { used_bytes: number; quota_bytes: number };
}

export interface ResearchBreadcrumb {
  id: string;
  name: string;
}

export interface ResearchFolder {
  id: string;
  name: string;
  parent_id: string | null;
  has_children: boolean;
  file_count: number | null;
  created_at: string;
  updated_at: string;
  breadcrumbs?: ResearchBreadcrumb[];
  path?: string[];
}

export interface ResearchFileBookingRef {
  booking_id: number;
  display_id: string;
  equipment_id: number | null;
  equipment_name: string | null;
  equipment_code: string | null;
}

export interface ResearchFile {
  id: string;
  workspace_id: string;
  folder_id: string | null;
  name: string;
  original_name: string;
  size_bytes: number;
  status: ResearchFileStatus;
  detected_type: string;
  declared_content_type: string;
  preview_kind: ResearchPreviewKind;
  checksum_verified: boolean;
  uploaded_by: ResearchUserSummary | null;
  created_at: string;
  uploaded_at: string | null;
  booking: ResearchFileBookingRef | null;
  folder_path?: ResearchBreadcrumb[] | string[];
}

export interface ResearchPagination {
  page: number;
  page_size: number;
  total: number;
  has_next: boolean;
}

export interface ResearchBooking {
  booking_id: number;
  display_id: string;
  status: string;
  status_display: string;
  equipment_id: number;
  equipment_code: string;
  equipment_name: string;
  department_name: string | null;
  booking_date: string | null;
  completed_at: string | null;
  file_count?: number;
}

export interface ResearchEquipment {
  equipment_id: number;
  name: string;
  code: string;
  department_name: string | null;
  bookings: number;
  files: number;
}

export interface ResearchPublication {
  claim_id: number;
  title: string;
  authors: string;
  journal: string;
  year: number | null;
  doi: string;
  url: string;
  status: string;
  status_display: string;
  equipment: Array<{ equipment_id: number; name: string; code: string }>;
}

export interface ResearchMember {
  id: number | null;
  role: ResearchRole;
  user: ResearchUserSummary;
  added_at: string;
  added_by: ResearchUserSummary | null;
}

export interface ResearchSearchResult {
  q: string;
  folders: Array<ResearchFolder & { path: string[] }>;
  files: Array<ResearchFile & { folder_path: string[] }>;
  bookings: ResearchBooking[];
  publications: ResearchPublication[];
  min_chars: number;
}

export type ResearchUploadInstruction =
  | { mode: "single"; method: "PUT"; url: string; headers: Record<string, string>; expires_in: number }
  | { mode: "multipart"; part_size: number; part_count: number; expires_in: number };

export interface ResearchUploadInitiateResponse {
  file: ResearchFile;
  upload: ResearchUploadInstruction;
}

export interface ResearchWorkspaceOption {
  id: string;
  name: string;
  booking_linked: boolean;
}

export type AnalysisInputSourceKind = "booking" | "upload";

export interface AnalysisSetupBooking {
  id: number;
  virtual_id: string;
  equipment_name: string;
  equipment_code?: string;
  date: string | null;
  status: string;
}

export interface AnalysisSetupLink {
  link_id: string | number;
  workspace_id: string;
  workspace_name: string;
  folder_id: string | null;
  folder_path: string | null;
  raw_folder_id: string | null;
  processed_folder_id: string | null;
}

export interface AnalysisSetupWorkspaceOption {
  id: string;
  name: string;
  booking_linked: boolean;
}

export interface AnalysisSetupSelectedInput {
  source: AnalysisInputSourceKind;
  booking_id: number | null;
  virtual_id: string | null;
  file_count: number;
}

export interface AnalysisSetup {
  booking: AnalysisSetupBooking;
  my_research: {
    eligible: boolean;
    reason: string | null;
    current_link: AnalysisSetupLink | null;
    workspaces: AnalysisSetupWorkspaceOption[];
    can_create: boolean;
  };
  folders_preview: { root: string; raw: string; processed: string };
  input: {
    default_source: AnalysisInputSourceKind;
    default_booking_id: number | null;
    selected: AnalysisSetupSelectedInput | null;
  };
  output: {
    pc_output_path: string | null;
    destination_label: string;
    auto_delete_after_verify: boolean;
  };
  agent?: { version?: string | null; capabilities?: string[] } | null;
  eligibility?: Record<string, unknown> | null;
}

export interface AnalysisSetupRequest {
  workspace_id: string | null;
  new_workspace_name: string | null;
  input_source: AnalysisInputSourceKind;
  input_booking_id: number | null;
}

export type AnalysisSetupErrorCode =
  | "invalid_workspace"
  | "input_booking_not_owned"
  | "results_locked"
  | "not_eligible";

export interface AnalysisInputSource {
  booking_id: number;
  virtual_id: string;
  equipment_name: string;
  date: string | null;
  status: string | null;
  file_count: number | null;
  is_current: boolean;
  locked_reason: string | null;
}

export interface AnalysisInputSourcePage {
  count: number;
  results: AnalysisInputSource[];
}

export type AnalysisSyncPhase =
  | "idle"
  | "staging_input"
  | "ready"
  | "in_session"
  | "collecting"
  | "copying_to_workspace"
  | "verifying"
  | "cleaning_pc"
  | "done"
  | "failed";

export type AnalysisPcCleanup = "pending" | "done" | "kept" | "not_supported";

export interface AnalysisSyncStatus {
  phase: AnalysisSyncPhase;
  direction: "input" | "output" | null;
  percent: number | null;
  bytes_done: number | null;
  bytes_total: number | null;
  files_done: number | null;
  files_total: number | null;
  current_file: string | null;
  message: string | null;
  verified: boolean;
  pc_cleanup: AnalysisPcCleanup | null;
  kept_files: string[];
  destination: { workspace_id: string | null; folder_id: string | null; path_label: string | null } | null;
  updated_at: string | null;
  poll_after_ms: number | null;
}

export interface AnalysisViewport {
  width: number;
  height: number;
  dpr: number;
}

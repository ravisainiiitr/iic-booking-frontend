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
    /** Where input files appear on the Analysis PC (known once a PC is assigned). */
    pc_input_path?: string | null;
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
  pc_deleted?: number;
  pc_removed_folders?: string[];
  /** The session account's Windows profile was deleted after its files were copied (null: not attempted). */
  pc_profile_wiped?: boolean | null;
  /** Folders chosen at the end of the session, with what the Analysis PC collected from each. */
  extra_folders?: AnalysisExtraFolder[];
  destination: { workspace_id: string | null; folder_id: string | null; path_label: string | null } | null;
  updated_at: string | null;
  poll_after_ms: number | null;
}

export type PcItemKind = "folder" | "file";

/** A folder or single file on the Analysis PC chosen to be copied when the session ends. */
export interface PcChosenItem {
  path: string;
  kind: PcItemKind;
}

export interface AnalysisExtraFolder {
  path: string;
  kind?: PcItemKind;
  alias?: string;
  files?: number;
  bytes?: number;
  error?: string;
  /** Saved automatically from the session account (Desktop, Documents…) when the session ended; not chosen. */
  auto?: boolean;
}

/** Agent capability: result folders can be chosen anywhere on the Analysis PC when the session ends. */
export const PC_FOLDERS_CAPABILITY = "extra_sources_v1";

/** Agent capability: single files can be chosen too (and up to 50 items). */
export const PC_FILES_CAPABILITY = "extra_files_v1";

export interface PcFolderEntry {
  name: string;
  path: string;
  modified?: string | null;
  can_select: boolean;
  reason?: string | null;
}

export interface PcFileEntry {
  name: string;
  /** Sent by agents that let single files be chosen. */
  path?: string;
  size: number;
  modified?: string | null;
  can_select?: boolean;
}

export interface PcFolderListing {
  /** "" for the starting view (places + suggestions). */
  path: string;
  parent: string | null;
  can_select: boolean;
  reason: string | null;
  summary?: { files: number; bytes: number; truncated: boolean } | null;
  places?: { label: string; path: string }[];
  recent?: { path: string; name: string; changed_files: number; modified?: string | null }[];
  folders: PcFolderEntry[];
  files: PcFileEntry[];
  file_count: number;
  truncated: boolean;
}

export type PcBrowseResult =
  | { status: "pending" }
  | { status: "done"; result: PcFolderListing }
  | { status: "failed"; detail: string };

export interface AnalysisViewport {
  width: number;
  height: number;
  dpr: number;
}

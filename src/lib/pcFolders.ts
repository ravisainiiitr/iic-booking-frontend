import type { AnalysisExtraFolder, AnalysisSyncStatus } from "@/lib/analysisSetupTypes";
import { plural } from "@/lib/analysisSync";

export const MAX_RESULT_FOLDERS = 10;
/** With agents that support single files. */
export const MAX_RESULT_ITEMS = 50;

const lower = (path: string) => path.toLowerCase().replace(/[\\/]+$/, "");

export const samePath = (a: string, b: string) => lower(a) === lower(b);

export const folderName = (path: string) => path.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || path;

/** true when `child` is strictly inside `parent` (Windows paths, case-insensitive). */
export function isInside(child: string, parent: string): boolean {
  const c = lower(child);
  const p = lower(parent);
  return c.length > p.length && c.startsWith(p.endsWith("\\") ? p : `${p}\\`);
}

/** "D:\Data\Run1" -> [{D:, D:\}, {Data, D:\Data}, {Run1, D:\Data\Run1}] */
export function breadcrumbs(path: string): { label: string; path: string }[] {
  const parts = path.replace(/[\\/]+$/, "").split(/[\\/]+/).filter(Boolean);
  return parts.map((label, i) => ({
    label,
    path: i === 0 ? `${parts[0]}\\` : parts.slice(0, i + 1).join("\\"),
  }));
}

const PRE_COPY = new Set(["idle", "staging_input", "ready", "in_session", "collecting"]);

/** State of a folder chosen on the Analysis PC: copied, removed from the PC, or why it was skipped. */
export function folderState(
  folder: AnalysisExtraFolder,
  status: AnalysisSyncStatus,
): { label: string; tone: "progress" | "done" | "warn" } {
  if (folder.error) return { label: folder.error, tone: "warn" };
  if (status.phase === "failed") return { label: "Not copied yet", tone: "warn" };
  if (!folder.alias || PRE_COPY.has(status.phase)) return { label: "Waiting to copy", tone: "progress" };
  const removed = (status.pc_removed_folders ?? []).some((p) => samePath(p, folder.path));
  if (removed) return { label: "Copied · removed from the Analysis PC", tone: "done" };
  const alias = folder.alias;
  const keptHere = (status.kept_files ?? []).filter((k) =>
    folder.kind === "file" ? k === alias : k.startsWith(`${alias}/`),
  );
  if (folder.kind === "file" && status.pc_cleanup === "kept" && keptHere.length) {
    return { label: "Copied · left on the PC (changed or in use)", tone: "warn" };
  }
  if (status.pc_cleanup === "kept" && keptHere.length) {
    return { label: `Copied · ${plural(keptHere.length, "file")} left on the PC (changed or in use)`, tone: "warn" };
  }
  if (status.phase === "verifying" || status.phase === "cleaning_pc") return { label: "Copied · cleaning up", tone: "progress" };
  if (status.verified || status.phase === "done" || status.phase === "copying_to_workspace") {
    return { label: status.pc_cleanup === "pending" ? "Copied · removing from the PC" : "Copied", tone: "done" };
  }
  return { label: "Copying…", tone: "progress" };
}

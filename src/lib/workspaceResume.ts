import { useEffect } from "react";

const RESUME_KEY = "iic:workspace-resume";
const RESUME_MAX_AGE_MS = 60_000;

export type OpenWorkspace = { path: string; title?: string };

let openWorkspace: OpenWorkspace | null = null;

function isResumablePath(path: unknown): path is string {
  return (
    typeof path === "string" &&
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !/^\/dashboard(?:[/?#]|$)/.test(path)
  );
}

/**
 * The dashboard records the page shown in its panel. That page is not in the browser URL
 * (it stays /dashboard), so anything that reloads or signs out has to ask here.
 */
export function registerOpenWorkspace(entry: OpenWorkspace): () => void {
  openWorkspace = entry;
  return () => {
    if (openWorkspace === entry) openWorkspace = null;
  };
}

export function currentOpenWorkspace(): OpenWorkspace | null {
  return openWorkspace;
}

/** Call right before a reload so the dashboard reopens the same panel page afterwards. */
export function rememberWorkspaceForReload(): void {
  if (!openWorkspace || !isResumablePath(openWorkspace.path)) return;
  try {
    sessionStorage.setItem(RESUME_KEY, JSON.stringify({ ...openWorkspace, at: Date.now() }));
  } catch {
    /* storage unavailable: the reload just lands on the dashboard */
  }
}

/** The panel page saved by rememberWorkspaceForReload within the last minute; cleared once read. */
export function takeWorkspaceToResume(): OpenWorkspace | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(RESUME_KEY);
    sessionStorage.removeItem(RESUME_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw) as { path?: unknown; title?: unknown; at?: unknown };
    if (!isResumablePath(saved.path)) return null;
    if (typeof saved.at !== "number" || Date.now() - saved.at > RESUME_MAX_AGE_MS) return null;
    return { path: saved.path, ...(typeof saved.title === "string" ? { title: saved.title } : {}) };
  } catch {
    return null;
  }
}

/**
 * Dashboard side of the above: keeps the open panel page registered, and on mount reopens a
 * panel page whose chunk failed to load after a deploy (that failure reloads the tab).
 */
export function useWorkspaceResume({
  workspacePath,
  workspaceCurrentPath,
  workspaceTitle,
  openWorkspace,
}: {
  workspacePath: string | null;
  workspaceCurrentPath: string;
  workspaceTitle: string;
  openWorkspace: (path: string, title?: string) => void;
}): void {
  useEffect(() => {
    if (!workspacePath) return;
    const navigatedWithinPanel =
      !!workspaceCurrentPath && workspaceCurrentPath !== workspacePath.split(/[?#]/)[0];
    return registerOpenWorkspace({
      path: navigatedWithinPanel ? workspaceCurrentPath : workspacePath,
      ...(navigatedWithinPanel ? {} : { title: workspaceTitle }),
    });
  }, [workspacePath, workspaceCurrentPath, workspaceTitle]);

  useEffect(() => {
    const resume = takeWorkspaceToResume();
    if (resume) openWorkspace(resume.path, resume.title);
  }, [openWorkspace]);
}

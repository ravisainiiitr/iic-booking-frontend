import { useEffect, useState } from "react";

const WORKSPACE_TITLE_EVENT = "iic-workspace-title";

/** Lets a page shown inside the dashboard workspace panel replace the panel's generic menu title; pass null to clear. */
export function publishWorkspaceTitle(title: string | null): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<string | null>(WORKSPACE_TITLE_EVENT, { detail: title }));
}

export function useWorkspaceTitleOverride(): string | null {
  const [title, setTitle] = useState<string | null>(null);
  useEffect(() => {
    const onTitle = (event: Event) => {
      const detail = (event as CustomEvent<string | null>).detail;
      setTitle(typeof detail === "string" && detail.trim() ? detail.trim() : null);
    };
    window.addEventListener(WORKSPACE_TITLE_EVENT, onTitle);
    return () => window.removeEventListener(WORKSPACE_TITLE_EVENT, onTitle);
  }, []);
  return title;
}

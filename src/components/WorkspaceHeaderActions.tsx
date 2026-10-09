import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

type WorkspaceChrome = {
  /** Element in the dashboard workspace header, left of Back, that pages can fill with actions. */
  actionsSlot: HTMLElement | null;
  /** The workspace Back button, for pages whose header row is hidden so they show Back themselves. */
  backButton: ReactNode;
  /** Wide strip left of Back on equipment pages (header row hidden), for page announcements. */
  bannerSlot?: HTMLElement | null;
};

const WorkspaceChromeContext = createContext<WorkspaceChrome | null>(null);

export const WorkspaceChromeProvider = WorkspaceChromeContext.Provider;

export function useWorkspaceChrome(): WorkspaceChrome | null {
  return useContext(WorkspaceChromeContext);
}

/**
 * Renders `children` in the dashboard workspace header next to Back. Outside the workspace (page opened
 * on its own) the children are rendered by `fallback`, or inline when no fallback is given. */
export function WorkspaceHeaderActions({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: (children: ReactNode) => ReactNode;
}) {
  const chrome = useWorkspaceChrome();
  if (chrome) return chrome.actionsSlot ? createPortal(children, chrome.actionsSlot) : null;
  return <>{fallback ? fallback(children) : children}</>;
}

/** Renders `children` in the workspace strip left of Back when the page has one, otherwise via `fallback`. */
export function WorkspaceBannerSlot({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback: (children: ReactNode) => ReactNode;
}) {
  const chrome = useWorkspaceChrome();
  if (chrome?.bannerSlot) return createPortal(children, chrome.bannerSlot);
  return <>{fallback(children)}</>;
}

import { cloneElement, isValidElement, type KeyboardEvent, type ReactElement, type ReactNode } from "react";

interface ClickableProps {
  onClick?: unknown;
  role?: string;
  tabIndex?: number;
}

/** Enter / Space activate a non-native button the same way a click does. */
export function activateOnEnterOrSpace(e: KeyboardEvent<HTMLElement>) {
  if (e.target !== e.currentTarget) return;
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    e.currentTarget.click();
  }
}

/**
 * Menu entries render clickable cards whose inner buttons are hidden in the compact menu,
 * so the card itself must be focusable and operable from the keyboard.
 */
export function withMenuItemA11y(node: ReactNode, current: boolean): ReactNode {
  if (!isValidElement<ClickableProps>(node) || typeof node.props.onClick !== "function") return node;
  return cloneElement(node as ReactElement<Record<string, unknown>>, {
    role: node.props.role ?? "button",
    tabIndex: node.props.tabIndex ?? 0,
    "aria-current": current ? "page" : undefined,
    onKeyDown: activateOnEnterOrSpace,
  });
}

function normalizePath(path: string): string {
  return path.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
}

/** The entry whose path is the longest prefix of the open workspace path. */
export function findActiveMenuId(entries: { id: string; path?: string }[], activePath: string | null | undefined): string | null {
  if (!activePath) return null;
  const current = normalizePath(activePath);
  let best: string | null = null;
  let bestLength = -1;
  for (const entry of entries) {
    if (!entry.path) continue;
    const path = normalizePath(entry.path);
    if ((current === path || current.startsWith(`${path}/`)) && path.length > bestLength) {
      best = entry.id;
      bestLength = path.length;
    }
  }
  return best;
}

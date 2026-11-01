import { useEffect } from "react";

/**
 * The signed-in user's own dashboard menu, as search results: everything the menu lets this user open, already
 * filtered by role, department modules and switches. The dashboard publishes it; search reads it. Kept for the
 * browser tab so search works on other pages too.
 */

export interface MenuAction {
  id: string;
  label: string;
  path: string;
}

const KEY = "search_menu_actions";
let current: { userId: number; actions: MenuAction[] } | null = null;

export function publishMenuActions(userId: number, actions: MenuAction[]) {
  current = { userId, actions };
  try {
    sessionStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* storage blocked */
  }
}

export function menuActionsFor(userId: number | null | undefined): MenuAction[] {
  if (userId == null) return [];
  if (!current) {
    try {
      const raw = JSON.parse(sessionStorage.getItem(KEY) || "null");
      if (raw && typeof raw.userId === "number" && Array.isArray(raw.actions)) current = raw;
    } catch {
      /* ignore */
    }
  }
  return current?.userId === userId ? current.actions : [];
}

/** Renders nothing; publishes ``actions`` for ``userId`` whenever they change. */
export function MenuActionsPublisher({ userId, actions }: { userId: number | null | undefined; actions: MenuAction[] }) {
  const key = actions.map((a) => `${a.id}\u0001${a.label}\u0001${a.path}`).join("\u0002");
  useEffect(() => {
    if (userId != null) publishMenuActions(userId, actions);
    // ``key`` stands for ``actions``, which is rebuilt on every dashboard render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, key]);
  return null;
}

import type { DashboardMenuGroup, DashboardMenuLayout } from "@/lib/api";

export const EMPTY_DASHBOARD_MENU_LAYOUT: DashboardMenuLayout = { groups: [] };

/** Visible ids in menu order: `defaultOrder` first, then the remaining ids in their original order. */
export function orderMenuIds(ids: string[], defaultOrder: string[]): string[] {
  const available = new Set(ids);
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const id of defaultOrder) {
    if (available.has(id) && !seen.has(id)) {
      ordered.push(id);
      seen.add(id);
    }
  }
  for (const id of ids) {
    if (!seen.has(id)) {
      ordered.push(id);
      seen.add(id);
    }
  }
  return ordered;
}

export type DashboardMenuNode =
  | { kind: "item"; id: string }
  | { kind: "group"; group: DashboardMenuGroup; items: string[] };

/**
 * Top-level menu nodes. A custom menu sits where its first item would have been, and
 * items not in any custom menu keep their default position.
 */
export function buildMenuTree(orderedIds: string[], layout: DashboardMenuLayout | null | undefined): DashboardMenuNode[] {
  const visible = new Set(orderedIds);
  const groupOf = new Map<string, DashboardMenuGroup>();
  for (const group of layout?.groups ?? []) {
    for (const item of group.items) {
      if (visible.has(item) && !groupOf.has(item)) groupOf.set(item, group);
    }
  }
  const nodes: DashboardMenuNode[] = [];
  const placed = new Set<string>();
  for (const id of orderedIds) {
    const group = groupOf.get(id);
    if (!group) {
      nodes.push({ kind: "item", id });
      continue;
    }
    if (placed.has(group.id)) continue;
    placed.add(group.id);
    nodes.push({
      kind: "group",
      group,
      items: group.items.filter((item) => visible.has(item) && groupOf.get(item) === group),
    });
  }
  return nodes;
}

/** Move `itemId` into `targetGroupId` (before `beforeId` when given), or back to the main menu when null. */
export function moveMenuItem(
  layout: DashboardMenuLayout,
  itemId: string,
  targetGroupId: string | null,
  beforeId?: string | null,
): DashboardMenuLayout {
  const groups = layout.groups.map((g) => ({ ...g, items: g.items.filter((i) => i !== itemId) }));
  if (targetGroupId) {
    const target = groups.find((g) => g.id === targetGroupId);
    if (target) {
      const at = beforeId && beforeId !== itemId ? target.items.indexOf(beforeId) : -1;
      if (at >= 0) target.items.splice(at, 0, itemId);
      else target.items.push(itemId);
    }
  }
  return { groups };
}

export function addMenuGroup(layout: DashboardMenuLayout, name: string, id = newMenuGroupId()): DashboardMenuLayout {
  const clean = name.replace(/\s+/g, " ").trim().slice(0, 60);
  if (!clean) return layout;
  return { groups: [...layout.groups, { id, name: clean, items: [] }] };
}

export function renameMenuGroup(layout: DashboardMenuLayout, groupId: string, name: string): DashboardMenuLayout {
  return {
    groups: layout.groups.map((g) => (g.id === groupId ? { ...g, name: name.replace(/\s+/g, " ").slice(0, 60) } : g)),
  };
}

/** Removing a menu returns its items to their original places. */
export function removeMenuGroup(layout: DashboardMenuLayout, groupId: string): DashboardMenuLayout {
  return { groups: layout.groups.filter((g) => g.id !== groupId) };
}

export function normalizeMenuLayout(raw: unknown): DashboardMenuLayout {
  const groups = (raw as DashboardMenuLayout | null)?.groups;
  if (!Array.isArray(groups)) return EMPTY_DASHBOARD_MENU_LAYOUT;
  return {
    groups: groups
      .filter((g) => g && typeof g.id === "string" && typeof g.name === "string")
      .map((g) => ({ id: g.id, name: g.name, items: Array.isArray(g.items) ? g.items.filter((i) => typeof i === "string") : [] })),
  };
}

export function newMenuGroupId(): string {
  return `g_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

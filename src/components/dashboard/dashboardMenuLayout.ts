import type { DashboardMenuGroup, DashboardMenuLayout } from "@/lib/api";

export const EMPTY_DASHBOARD_MENU_LAYOUT: DashboardMenuLayout = { groups: [], order: [] };

/**
 * IITR Faculty menu order below the Dashboard button. "Shared with me" takes My Research's place
 * while My Research is switched off. Other visible items go after Reports & Statistics.
 */
const FACULTY_DASHBOARD_MENU_HEAD = [
  "browse_equipment",
  "view_bookings",
  "booking_templates",
  "wallet_management",
  "my_research",
  "shared_with_me",
  "student_management",
  "urgent_booking_requests",
  "view_results",
  "proforma_invoice",
  "reports_statistics",
];
const FACULTY_DASHBOARD_MENU_TAIL = ["user_guide", "support_tickets", "rate_your_experience"];
export const FACULTY_DASHBOARD_MENU_ORDER = [...FACULTY_DASHBOARD_MENU_HEAD, ...FACULTY_DASHBOARD_MENU_TAIL];

/** Default order for an IITR Faculty user: the faculty order, with any other visible ids before User guide. */
export function facultyDashboardMenuOrder(ids: string[]): string[] {
  return [
    ...FACULTY_DASHBOARD_MENU_HEAD,
    ...ids.filter((id) => !FACULTY_DASHBOARD_MENU_ORDER.includes(id)),
    ...FACULTY_DASHBOARD_MENU_TAIL,
  ];
}

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

export function menuNodeKey(node: DashboardMenuNode): string {
  return node.kind === "item" ? node.id : `group:${node.group.id}`;
}

/**
 * Sort top-level nodes by the user's priority list. A node missing from the list stays right after
 * the node that precedes it in the default menu, so newly added menu entries still show up sensibly.
 */
function applyMenuOrder(nodes: DashboardMenuNode[], order: string[] | undefined): DashboardMenuNode[] {
  if (!order?.length) return nodes;
  const rank = new Map(order.map((key, i) => [key, i]));
  let lastRank = -1;
  const keyed = nodes.map((node, index) => {
    const r = rank.get(menuNodeKey(node));
    if (r !== undefined) {
      lastRank = r;
      return { node, primary: r, unranked: 0, index };
    }
    return { node, primary: lastRank, unranked: 1, index };
  });
  keyed.sort((a, b) => a.primary - b.primary || a.unranked - b.unranked || a.index - b.index);
  return keyed.map((k) => k.node);
}

/**
 * Top-level menu nodes. A custom menu sits where its first item would have been, and
 * items not in any custom menu keep their default position, unless the user set a priority order.
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
  return applyMenuOrder(nodes, layout?.order);
}

/**
 * Move a top-level entry up (-1) or down (+1). `currentKeys` is the top-level order as shown; keys
 * from the saved order that are not shown right now (hidden entries) are kept at the end.
 */
export function moveMenuNode(
  layout: DashboardMenuLayout,
  currentKeys: string[],
  key: string,
  delta: -1 | 1,
): DashboardMenuLayout {
  const keys = [...currentKeys];
  const from = keys.indexOf(key);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= keys.length) return layout;
  [keys[from], keys[to]] = [keys[to], keys[from]];
  const shown = new Set(keys);
  const hidden = (layout.order ?? []).filter((k) => !shown.has(k));
  return { ...layout, order: [...keys, ...hidden] };
}

/** Move an item up (-1) or down (+1) inside its custom menu, skipping items that are not shown. */
export function moveGroupItem(
  layout: DashboardMenuLayout,
  groupId: string,
  itemId: string,
  delta: -1 | 1,
  visible: Set<string>,
): DashboardMenuLayout {
  return {
    ...layout,
    groups: layout.groups.map((g) => {
      if (g.id !== groupId) return g;
      const items = [...g.items];
      const from = items.indexOf(itemId);
      if (from < 0) return g;
      let to = from + delta;
      while (to >= 0 && to < items.length && !visible.has(items[to])) to += delta;
      if (to < 0 || to >= items.length) return g;
      [items[from], items[to]] = [items[to], items[from]];
      return { ...g, items };
    }),
  };
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
  return { ...layout, groups };
}

export function addMenuGroup(layout: DashboardMenuLayout, name: string, id = newMenuGroupId()): DashboardMenuLayout {
  const clean = name.replace(/\s+/g, " ").trim().slice(0, 60);
  if (!clean) return layout;
  return { ...layout, groups: [...layout.groups, { id, name: clean, items: [] }] };
}

export function renameMenuGroup(layout: DashboardMenuLayout, groupId: string, name: string): DashboardMenuLayout {
  return {
    ...layout,
    groups: layout.groups.map((g) => (g.id === groupId ? { ...g, name: name.replace(/\s+/g, " ").slice(0, 60) } : g)),
  };
}

/** Removing a menu returns its items to their original places. */
export function removeMenuGroup(layout: DashboardMenuLayout, groupId: string): DashboardMenuLayout {
  return {
    ...layout,
    groups: layout.groups.filter((g) => g.id !== groupId),
    order: (layout.order ?? []).filter((k) => k !== `group:${groupId}`),
  };
}

export function normalizeMenuLayout(raw: unknown): DashboardMenuLayout {
  const groups = (raw as DashboardMenuLayout | null)?.groups;
  const order = (raw as DashboardMenuLayout | null)?.order;
  if (!Array.isArray(groups)) return EMPTY_DASHBOARD_MENU_LAYOUT;
  return {
    groups: groups
      .filter((g) => g && typeof g.id === "string" && typeof g.name === "string")
      .map((g) => ({ id: g.id, name: g.name, items: Array.isArray(g.items) ? g.items.filter((i) => typeof i === "string") : [] })),
    order: Array.isArray(order) ? order.filter((k) => typeof k === "string") : [],
  };
}

export function newMenuGroupId(): string {
  return `g_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

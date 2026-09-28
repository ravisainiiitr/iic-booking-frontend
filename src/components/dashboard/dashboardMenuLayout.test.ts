import { describe, expect, it } from "vitest";
import {
  addMenuGroup,
  buildMenuTree,
  moveMenuItem,
  normalizeMenuLayout,
  orderMenuIds,
  removeMenuGroup,
  renameMenuGroup,
} from "./dashboardMenuLayout";

describe("orderMenuIds", () => {
  it("puts the default order first and keeps the rest in their original order", () => {
    expect(orderMenuIds(["a", "b", "c", "d", "admin"], ["c", "a", "missing", "admin"])).toEqual([
      "c",
      "a",
      "admin",
      "b",
      "d",
    ]);
  });

  it("returns the original order when no default order is given", () => {
    expect(orderMenuIds(["x", "y"], [])).toEqual(["x", "y"]);
  });
});

describe("buildMenuTree", () => {
  const ids = ["browse", "booking", "urgent", "reports", "support"];

  it("places a custom menu where its first item was and keeps other items in place", () => {
    const tree = buildMenuTree(ids, { groups: [{ id: "g1", name: "Daily", items: ["reports", "booking"] }] });
    expect(tree.map((n) => (n.kind === "item" ? n.id : `group:${n.group.id}`))).toEqual([
      "browse",
      "group:g1",
      "urgent",
      "support",
    ]);
    const group = tree[1];
    expect(group.kind === "group" && group.items).toEqual(["reports", "booking"]);
  });

  it("skips hidden items and menus with nothing visible", () => {
    const tree = buildMenuTree(["browse", "support"], {
      groups: [
        { id: "g1", name: "Admin", items: ["admin_only"] },
        { id: "g2", name: "Help", items: ["support", "admin_only"] },
      ],
    });
    expect(tree).toEqual([
      { kind: "item", id: "browse" },
      { kind: "group", group: { id: "g2", name: "Help", items: ["support", "admin_only"] }, items: ["support"] },
    ]);
  });
});

describe("layout edits", () => {
  const base = { groups: [{ id: "g1", name: "Daily", items: ["a", "b"] }, { id: "g2", name: "Other", items: [] }] };

  it("moves an item between menus, before a target item, and back to the main menu", () => {
    const moved = moveMenuItem(base, "b", "g2");
    expect(moved.groups.map((g) => g.items)).toEqual([["a"], ["b"]]);
    const before = moveMenuItem(moved, "a", "g2", "b");
    expect(before.groups.map((g) => g.items)).toEqual([[], ["a", "b"]]);
    const back = moveMenuItem(before, "a", null);
    expect(back.groups.map((g) => g.items)).toEqual([[], ["b"]]);
  });

  it("adds, renames and removes menus", () => {
    const added = addMenuGroup(base, "  New   menu ", "g3");
    expect(added.groups[2]).toEqual({ id: "g3", name: "New menu", items: [] });
    expect(addMenuGroup(base, "   ")).toBe(base);
    expect(renameMenuGroup(added, "g3", "Renamed").groups[2].name).toBe("Renamed");
    expect(removeMenuGroup(added, "g1").groups.map((g) => g.id)).toEqual(["g2", "g3"]);
  });

  it("normalizes unexpected server data", () => {
    expect(normalizeMenuLayout(null)).toEqual({ groups: [] });
    expect(
      normalizeMenuLayout({ groups: [{ id: "g", name: "N", items: ["a", 5] }, { id: 1 }] }),
    ).toEqual({ groups: [{ id: "g", name: "N", items: ["a"] }] });
  });
});

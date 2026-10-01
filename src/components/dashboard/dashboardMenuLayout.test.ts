import { describe, expect, it } from "vitest";
import {
  addMenuGroup,
  buildMenuTree,
  facultyDashboardMenuOrder,
  menuNodeKey,
  moveGroupItem,
  moveMenuItem,
  moveMenuNode,
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

describe("facultyDashboardMenuOrder", () => {
  const facultyMenu = [
    "browse_equipment",
    "view_bookings",
    "booking_templates",
    "view_results",
    "my_research",
    "urgent_booking_requests",
    "proforma_invoice",
    "wallet_management",
    "my_publications",
    "reports_statistics",
    "user_guide",
    "student_management",
    "rate_your_experience",
    "support_tickets",
  ];

  it("uses the IITR Faculty order with unlisted items and User guide just before Support tickets", () => {
    expect(orderMenuIds(facultyMenu, facultyDashboardMenuOrder(facultyMenu))).toEqual([
      "browse_equipment",
      "view_bookings",
      "booking_templates",
      "wallet_management",
      "my_research",
      "student_management",
      "urgent_booking_requests",
      "view_results",
      "proforma_invoice",
      "reports_statistics",
      "my_publications",
      "user_guide",
      "support_tickets",
      "rate_your_experience",
    ]);
  });

  it("shows Shared with me in My Research's place when My Research is off", () => {
    const ids = facultyMenu.map((id) => (id === "my_research" ? "shared_with_me" : id));
    const ordered = orderMenuIds(ids, facultyDashboardMenuOrder(ids));
    expect(ordered.slice(3, 6)).toEqual(["wallet_management", "shared_with_me", "student_management"]);
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
    expect(normalizeMenuLayout(null)).toEqual({ groups: [], order: [] });
    expect(
      normalizeMenuLayout({ groups: [{ id: "g", name: "N", items: ["a", 5] }, { id: 1 }], order: ["a", 3] }),
    ).toEqual({ groups: [{ id: "g", name: "N", items: ["a"] }], order: ["a"] });
  });
});

describe("menu priority", () => {
  const ids = ["browse", "booking", "urgent", "reports", "support"];
  const keys = (layout: Parameters<typeof buildMenuTree>[1]) => buildMenuTree(ids, layout).map(menuNodeKey);

  it("sorts top-level entries by the saved order and keeps unlisted entries after their default neighbour", () => {
    expect(keys({ groups: [], order: ["urgent", "browse"] })).toEqual(["urgent", "reports", "support", "browse", "booking"]);
    expect(
      keys({ groups: [{ id: "g1", name: "Daily", items: ["reports"] }], order: ["group:g1", "support", "browse"] }),
    ).toEqual(["group:g1", "support", "browse", "booking", "urgent"]);
  });

  it("moves top-level entries up and down and keeps hidden keys", () => {
    const layout = { groups: [], order: ["hidden_item"] };
    const moved = moveMenuNode(layout, ["browse", "booking", "urgent"], "urgent", -1);
    expect(moved.order).toEqual(["browse", "urgent", "booking", "hidden_item"]);
    expect(moveMenuNode(layout, ["browse", "booking"], "browse", -1)).toBe(layout);
  });

  it("moves items inside a menu, skipping hidden items", () => {
    const layout = { groups: [{ id: "g1", name: "Daily", items: ["a", "hidden", "b"] }] };
    const moved = moveGroupItem(layout, "g1", "b", -1, new Set(["a", "b"]));
    expect(moved.groups[0].items).toEqual(["b", "hidden", "a"]);
  });

  it("drops a removed menu from the order", () => {
    const layout = { groups: [{ id: "g1", name: "Daily", items: ["a"] }], order: ["group:g1", "b"] };
    expect(removeMenuGroup(layout, "g1").order).toEqual(["b"]);
  });
});

import { describe, expect, it } from "vitest";
import {
  LAB_OPERATOR_DASHBOARD_MENU_ORDER,
  addMenuGroup,
  buildMenuTree,
  dedupeMenuEntriesByPath,
  facultyDashboardMenuOrder,
  menuNodeKey,
  moveGroupItem,
  moveMenuItem,
  moveMenuNode,
  normalizeMenuLayout,
  orderMenuIds,
  removeMenuGroup,
  renameMenuGroup,
  sectionMenuOrder,
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

describe("LAB_OPERATOR_DASHBOARD_MENU_ORDER", () => {
  const operatorMenu = ["operator_availability", "support_tickets", "booking_management"];

  it("lists View Booking, Intimate Unavailability, then Support tickets", () => {
    expect(orderMenuIds(operatorMenu, LAB_OPERATOR_DASHBOARD_MENU_ORDER)).toEqual([
      "booking_management",
      "operator_availability",
      "support_tickets",
    ]);
  });

  it("keeps other visible items after the three, in their original order", () => {
    expect(
      orderMenuIds(["user_guide", ...operatorMenu, "rate_your_experience"], LAB_OPERATOR_DASHBOARD_MENU_ORDER),
    ).toEqual(["booking_management", "operator_availability", "support_tickets", "user_guide", "rate_your_experience"]);
  });

  it("still honours a saved custom order", () => {
    const ordered = orderMenuIds(operatorMenu, LAB_OPERATOR_DASHBOARD_MENU_ORDER);
    const saved = { groups: [], order: ["support_tickets", "operator_availability", "booking_management"] };
    expect(buildMenuTree(ordered, saved).map(menuNodeKey)).toEqual([
      "support_tickets",
      "operator_availability",
      "booking_management",
    ]);
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
      "student_management",
      "wallet_management",
      "my_research",
      "booking_templates",
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

  it("reorders the reported IITR Faculty menu into the requested order", () => {
    const reported = [
      "browse_equipment",
      "view_bookings",
      "booking_templates",
      "view_results",
      "my_research",
      "urgent_booking_requests",
      "proforma_invoice",
      "wallet_management",
      "reports_statistics",
      "user_guide",
      "student_management",
      "rate_your_experience",
      "support_tickets",
    ];
    expect(orderMenuIds(reported, facultyDashboardMenuOrder(reported))).toEqual([
      "browse_equipment",
      "view_bookings",
      "student_management",
      "wallet_management",
      "my_research",
      "booking_templates",
      "urgent_booking_requests",
      "view_results",
      "proforma_invoice",
      "reports_statistics",
      "user_guide",
      "support_tickets",
      "rate_your_experience",
    ]);
  });

  it("puts other visible faculty items just before User guide", () => {
    const ids = [...facultyMenu, "nomination_requests", "ta_duty_assignments"];
    expect(orderMenuIds(ids, facultyDashboardMenuOrder(ids)).slice(-6)).toEqual([
      "my_publications",
      "nomination_requests",
      "ta_duty_assignments",
      "user_guide",
      "support_tickets",
      "rate_your_experience",
    ]);
  });

  it("puts Training & Demos right after Student management when it is shown", () => {
    const ids = [...facultyMenu, "training_events"];
    expect(orderMenuIds(ids, facultyDashboardMenuOrder(ids)).slice(0, 5)).toEqual([
      "browse_equipment",
      "view_bookings",
      "student_management",
      "training_events",
      "wallet_management",
    ]);
  });

  it("shows Shared with me in My Research's place when My Research is off", () => {
    const ids = facultyMenu.map((id) => (id === "my_research" ? "shared_with_me" : id));
    const ordered = orderMenuIds(ids, facultyDashboardMenuOrder(ids));
    expect(ordered.slice(3, 6)).toEqual(["wallet_management", "shared_with_me", "booking_templates"]);
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

describe("buildMenuTree with built-in sections", () => {
  const sections = [
    { id: "sec_a", name: "Alpha", items: ["a1", "a2", "a3"] },
    { id: "sec_b", name: "Beta", items: ["b1", "b2"] },
    { id: "sec_more", name: "More", items: [], fallback: true },
  ];
  const ids = ["a1", "a2", "a3", "b1", "b2", "new_item"];
  const shape = (tree: ReturnType<typeof buildMenuTree>) =>
    tree.map((n) => (n.kind === "item" ? n.id : `${menuNodeKey(n)}[${n.items.join(",")}]`));

  it("groups items into sections in order, with unlisted items in the fallback section", () => {
    expect(shape(buildMenuTree(ids, null, sections))).toEqual(["sec_a[a1,a2,a3]", "sec_b[b1,b2]", "sec_more[new_item]"]);
  });

  it("only lists visible items and drops empty sections", () => {
    const tree = buildMenuTree(["a2", "b1"], null, sections);
    expect(shape(tree)).toEqual(["sec_a[a2]", "sec_b[b1]"]);
    const all = tree.flatMap((n) => (n.kind === "item" ? [n.id] : n.items));
    expect(all).toEqual(["a2", "b1"]);
  });

  it("lists each item once even when a section repeats it", () => {
    const dup = [...sections, { id: "sec_c", name: "Gamma", items: ["a1", "b2"] }];
    const all = buildMenuTree(ids, null, dup).flatMap((n) => (n.kind === "item" ? [n.id] : n.items));
    expect(new Set(all).size).toBe(all.length);
    expect(all.sort()).toEqual([...ids].sort());
  });

  it("lets the user's own menus claim items before the built-in sections", () => {
    const tree = buildMenuTree(ids, { groups: [{ id: "g1", name: "Mine", items: ["a2", "b2"] }] }, sections);
    expect(shape(tree)).toEqual(["sec_a[a1,a3]", "group:g1[a2,b2]", "sec_b[b1]", "sec_more[new_item]"]);
  });

  it("applies the saved priority to items inside a section and to the sections themselves", () => {
    const tree = buildMenuTree(ids, { groups: [], order: ["sec_b", "sec_a", "a3", "a1"] }, sections);
    // "sec_more" is unranked, so it stays right after its default neighbour "sec_b".
    expect(shape(tree)).toEqual(["sec_b[b1,b2]", "sec_more[new_item]", "sec_a[a3,a1,a2]"]);
  });

  it("keeps the flat menu when no sections are given", () => {
    expect(buildMenuTree(["a1", "b1"], null).map(menuNodeKey)).toEqual(["a1", "b1"]);
  });
});

describe("sectionMenuOrder and dedupeMenuEntriesByPath", () => {
  it("flattens section items in order", () => {
    expect(sectionMenuOrder([{ id: "s1", name: "S1", items: ["x", "y"] }, { id: "s2", name: "S2", items: ["z"] }])).toEqual([
      "x",
      "y",
      "z",
    ]);
  });

  it("keeps the first entry for each page, ignoring query strings and trailing slashes", () => {
    const entries = [
      { id: "first", path: "/ta-nomination-call" },
      { id: "no_path" },
      { id: "second", path: "/ta-nomination-call/?tab=open" },
      { id: "other", path: "/reports" },
    ];
    expect(dedupeMenuEntriesByPath(entries).map((e) => e.id)).toEqual(["first", "no_path", "other"]);
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

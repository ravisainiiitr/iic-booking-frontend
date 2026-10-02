import { describe, expect, it } from "vitest";
import { ADMIN_MENU_SECTIONS } from "./adminMenuSections";
import { buildMenuTree, sectionMenuOrder } from "./dashboardMenuLayout";

describe("ADMIN_MENU_SECTIONS", () => {
  it("lists every menu item in at most one section", () => {
    const all = sectionMenuOrder(ADMIN_MENU_SECTIONS);
    expect(all.filter((id, i) => all.indexOf(id) !== i)).toEqual([]);
  });

  it("uses ids the saved menu layout accepts as priority keys", () => {
    for (const section of ADMIN_MENU_SECTIONS) {
      expect(section.id).toMatch(/^sec_[A-Za-z0-9_-]{1,60}$/);
    }
    expect(new Set(ADMIN_MENU_SECTIONS.map((s) => s.id)).size).toBe(ADMIN_MENU_SECTIONS.length);
  });

  it("ends with a single catch-all section", () => {
    const fallbacks = ADMIN_MENU_SECTIONS.filter((s) => s.fallback);
    expect(fallbacks.map((s) => s.id)).toEqual(["sec_more"]);
    expect(ADMIN_MENU_SECTIONS[ADMIN_MENU_SECTIONS.length - 1].fallback).toBe(true);
  });

  it("never adds items the role cannot see", () => {
    const deptAdminVisible = ["booking_management", "view_bookings", "wallet_recharge_requests", "user_guide"];
    const tree = buildMenuTree(deptAdminVisible, null, ADMIN_MENU_SECTIONS);
    const shown = tree.flatMap((n) => (n.kind === "item" ? [n.id] : n.items));
    expect(shown.sort()).toEqual([...deptAdminVisible].sort());
    expect(tree.map((n) => (n.kind === "group" ? n.group.name : n.id))).toEqual(["Bookings", "Finance", "Support & feedback"]);
  });

  it("puts menu entries added later into the catch-all section", () => {
    const tree = buildMenuTree(["reports_statistics", "brand_new_tool"], null, ADMIN_MENU_SECTIONS);
    expect(tree.map((n) => (n.kind === "group" ? `${n.group.name}:${n.items.join(",")}` : n.id))).toEqual([
      "Overview:reports_statistics",
      "More:brand_new_tool",
    ]);
  });
});

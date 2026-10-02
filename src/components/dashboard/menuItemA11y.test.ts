import { describe, expect, it } from "vitest";
import { findActiveMenuId } from "./menuItemA11y";

const entries = [
  { id: "catalog", path: "/equipments" },
  { id: "admin", path: "/admin" },
  { id: "wallet_requests", path: "/admin/wallet-recharge-requests" },
  { id: "no_path" },
];

describe("findActiveMenuId", () => {
  it("returns null without an open workspace", () => {
    expect(findActiveMenuId(entries, null)).toBeNull();
    expect(findActiveMenuId(entries, "")).toBeNull();
  });

  it("matches the exact path, ignoring query, hash and trailing slash", () => {
    expect(findActiveMenuId(entries, "/equipments")).toBe("catalog");
    expect(findActiveMenuId(entries, "/equipments/?q=xrd#top")).toBe("catalog");
  });

  it("prefers the longest matching prefix", () => {
    expect(findActiveMenuId(entries, "/admin/wallet-recharge-requests/42")).toBe("wallet_requests");
    expect(findActiveMenuId(entries, "/admin/semesters")).toBe("admin");
  });

  it("does not match on a partial path segment", () => {
    expect(findActiveMenuId(entries, "/administration")).toBeNull();
  });
});

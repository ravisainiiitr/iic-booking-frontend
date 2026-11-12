// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { appAudienceFor, appNavItems, isAppNavPath, markCallsSeen, unseenMissedCalls } from "./appShell";

describe("appAudienceFor", () => {
  it("sorts every role into one of the three app homes", () => {
    expect(appAudienceFor("operator")).toBe("staff");
    expect(appAudienceFor("MANAGER")).toBe("staff");
    expect(appAudienceFor("admin")).toBe("admin");
    expect(appAudienceFor("finance")).toBe("admin");
    expect(appAudienceFor("student")).toBe("user");
    expect(appAudienceFor("faculty")).toBe("user");
    expect(appAudienceFor("external")).toBe("user");
    expect(appAudienceFor(undefined)).toBe("user");
  });
});

describe("appNavItems", () => {
  it("gives every audience five sections, always with Calls and More", () => {
    for (const audience of ["staff", "admin", "user"] as const) {
      const keys = appNavItems(audience).map((i) => i.key);
      expect(keys).toHaveLength(5);
      expect(keys).toContain("calls");
      expect(keys).toContain("more");
    }
  });

  it("keeps the lab staff's own screens", () => {
    expect(appNavItems("staff").map((i) => i.to)).toEqual(["/app", "/booking-management", "/app/calendar", "/app/calls", "/app/more"]);
  });
});

describe("missed-call badge", () => {
  it("counts missed calls until the Calls screen is opened", () => {
    localStorage.clear();
    const calls = ["2026-11-06T06:00:00Z", "2026-11-06T08:00:00Z"];
    expect(unseenMissedCalls(calls)).toBe(2);
    markCallsSeen(new Date("2026-11-06T07:00:00Z").getTime());
    expect(unseenMissedCalls(calls)).toBe(1);
    markCallsSeen(new Date("2026-11-06T09:00:00Z").getTime());
    expect(unseenMissedCalls(calls)).toBe(0);
  });
});

describe("isAppNavPath", () => {
  it("shows the navigation on section pages only", () => {
    expect(isAppNavPath("/app/equipment", "user")).toBe(true);
    expect(isAppNavPath("/app/equipment/", "user")).toBe(true);
    expect(isAppNavPath("/app/equipment/12", "user")).toBe(false); // a detail screen has its own action bar
    expect(isAppNavPath("/book-equipment", "user")).toBe(false); // the booking flow keeps the whole screen
    expect(isAppNavPath("/booking-management", "user")).toBe(false);
    expect(isAppNavPath("/booking-management", "staff")).toBe(true);
  });
});

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(e.name) ? [path] : [];
  });
}

describe("Equipment Configuration menu item", () => {
  const dashboard = readFileSync(join(SRC, "pages", "Dashboard.tsx"), "utf8");

  it("is labelled Equipment Configuration in the dashboard menu and keeps its route", () => {
    expect(dashboard).toMatch(/id: "equipment_settings",\s*label: "Equipment Configuration",\s*path: "\/oic\/equipment-settings"/);
    expect(dashboard).toMatch(/"\/oic\/equipment-settings": \{\s*title: "Equipment Configuration"/);
  });

  it("no longer uses the old name anywhere", () => {
    const stale = sourceFiles(SRC).filter((f) => readFileSync(f, "utf8").includes("Equipment Booking" + " Configuration"));
    expect(stale).toEqual([]);
  }, 30_000);
});

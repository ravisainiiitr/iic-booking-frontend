import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const page = readFileSync(resolve(root, "public/cancellation-refund-policy/index.html"), "utf-8");

describe("Cancellation and Refund Policy page", () => {
  it("states the external users' cancellation tiers the portal applies", () => {
    expect(page).toContain("External users");
    expect(page).toMatch(/More than 48 hours before the first slot[\s\S]*Full refund/);
    expect(page).toMatch(/Between 48 and 24 hours before[\s\S]*50% refund/);
    expect(page).toMatch(/Less than 24 hours before[\s\S]*No refund/);
    expect(page).toContain("credited to your portal wallet");
  });

  it("links only to pages and files that exist", () => {
    const spaRoutes = new Set(["/", "/analysis-charges"]);
    const links = [...page.matchAll(/(?:href|src)="(\/[^"#]*)"/g)].map((m) => m[1]);
    for (const link of links) {
      if (spaRoutes.has(link)) continue;
      const file = link.endsWith("/") ? `${link}index.html` : link;
      expect(existsSync(resolve(root, "public" + file)), link).toBe(true);
    }
  });

  it("is listed under Resources on the main page", () => {
    const footer = readFileSync(resolve(root, "src/components/Footer.tsx"), "utf-8");
    expect(footer).toContain('href="/cancellation-refund-policy/"');
  });
});

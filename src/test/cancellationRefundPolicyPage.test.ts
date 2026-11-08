import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const page = readFileSync(resolve(root, "public/cancellation-refund-policy/index.html"), "utf-8");

describe("Cancellation and Refund Policy page", () => {
  it("states the external users' cancellation tiers the portal applies", () => {
    expect(page).toContain("for external users");
    expect(page).toMatch(/More than 48 hours before the first slot<\/td><td>All of them \(100%\)/);
    expect(page).toMatch(/Between 48 and 24 hours before<\/td><td>Half \(50%\)/);
    expect(page).toMatch(/Less than 24 hours before<\/td><td>None/);
    expect(page).toContain("credited to your wallet <strong>at once</strong>");
  });

  it("explains return shipping and its GST, with a worked example that adds up", () => {
    expect(page).toMatch(/When you cancel<\/strong> \(at any time\): the return shipping charge and the GST on it are\s+<strong>not refunded/);
    expect(page).toMatch(/When the facility cannot carry out your booking<\/strong> \(section 5\): the return shipping charge\s+<strong>is refunded/);
    // 800 + 200 + 18% GST = 1,180; cancelling early refunds 800 + 144 and keeps 200 + 36.
    expect(page).toContain("<strong>Rs. 944</strong> (analysis Rs. 800 + its GST Rs. 144)");
    expect(page).toContain("Rs. 236 (shipping Rs. 200 + its GST Rs. 36)");
  });

  it("sends questions to the department's Accounts In Charge, not a central address", () => {
    expect(page).not.toContain("arsric@iitr.ac.in");
    expect(page).toContain("Accounts In Charge of the department that");
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

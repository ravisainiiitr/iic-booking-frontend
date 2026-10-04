import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { buildGuide, DEFAULT_GUIDE_FLAGS, GUIDE_AUDIENCES, type GuideFeatureFlags } from "@/guides";
import { resolveGuideAudienceForUser, shouldAutoShowUserGuide, type GuideUserLike } from "./resolveAudience";

const ALL_ON = Object.fromEntries(Object.keys(DEFAULT_GUIDE_FLAGS).map((k) => [k, true])) as unknown as GuideFeatureFlags;

/** Every account type that signs in, as the profile API sends it. Test accounts carry their role's type. */
const ACCOUNTS: Array<[string, GuideUserLike & Record<string, unknown>, string]> = [
  ["IITR student", { user_type: "student" }, "student"],
  ["individual student", { user_type: "individual_student" }, "student"],
  ["test student account", { user_type: "student", is_test_account: true }, "student"],
  ["IITR faculty", { user_type: "faculty", is_faculty: true }, "faculty"],
  ["post-doc", { user_type: "individual_student", user_type_alias: "Post Doctoral Fellow" }, "project_staff"],
  ["research associate", { user_type: "student", user_type_alias: "Research Associate" }, "project_staff"],
  ["IITR Startup", { user_type: "startup_incubated_iitr" }, "startup"],
  ["external startup / MSME", { user_type: "external_startup_msme" }, "startup"],
  ["educational institute", { user_type: "external" }, "external"],
  ["industry", { user_type: "industry" }, "external"],
  ["govt R&D", { user_type: "rnd" }, "external"],
  ["Accounts In-charge", { user_type: "finance" }, "finance"],
  ["Accounts In-charge by display name", { user_type: "staff", user_type_display: "Accounts In Charge" }, "finance"],
  ["Officer In Charge (also temporary OIC)", { user_type: "manager" }, "oic"],
  ["Lab Operator", { user_type: "operator" }, "operator"],
  ["Department Administrator", { user_type: "dept_admin" }, "dept_admin"],
  ["Main Administrator", { user_type: "admin" }, "admin"],
  ["test admin account", { user_type: "admin", is_test_account: true }, "admin"],
  ["External Relations", { user_type: "external_relations" }, "external_relations"],
];

describe("What's New and the user guide for every account type", () => {
  it.each(ACCOUNTS)("%s gets its own guide", (_label, user, audience) => {
    expect(resolveGuideAudienceForUser(user)).toBe(audience);
    expect(shouldAutoShowUserGuide({ user })).toBe(true);
  });

  it("ignores the server's legacy user_guide_viewed flag, so nobody is left out", () => {
    const user = { user_type: "manager", user_guide_viewed: true } as GuideUserLike;
    expect(shouldAutoShowUserGuide({ user })).toBe(true);
  });

  it("gives every role 1 to 10 items, each New, Improved or Fixed with a one-line description", () => {
    for (const audience of GUIDE_AUDIENCES) {
      for (const flags of [undefined, ALL_ON]) {
        const { items } = buildGuide({ audience, flags }).whatsNew;
        expect(items.length, audience).toBeGreaterThanOrEqual(1);
        expect(items.length, audience).toBeLessThanOrEqual(10);
        for (const item of items) {
          expect(["new", "improved", "fixed"], item.id).toContain(item.kind);
          expect((item.summary ?? item.benefit).length, `${audience} ${item.id}`).toBeLessThanOrEqual(140);
        }
      }
    }
  });

  it("only links Try it to pages that exist", () => {
    const routes = readFileSync(fileURLToPath(new URL("../routes/AppRoutes.tsx", import.meta.url)), "utf8");
    const paths = new Set([...routes.matchAll(/path="([^"]+)"/g)].map((m) => m[1]));
    for (const audience of GUIDE_AUDIENCES) {
      for (const item of buildGuide({ audience, flags: ALL_ON }).whatsNew.items) {
        if (item.href) expect(paths.has(item.href), `${audience} ${item.id} → ${item.href}`).toBe(true);
      }
    }
  });

  it("keeps staff pages out of end users' Try it links", () => {
    for (const audience of ["student", "project_staff", "faculty", "startup", "external"] as const) {
      const hrefs = buildGuide({ audience, flags: ALL_ON }).whatsNew.items.flatMap((i) => (i.href ? [i.href] : []));
      for (const href of hrefs) expect(href).not.toMatch(/^\/(admin|oic|booking-management|urgent-requests$|equipment-waitlist|booking-attempt-logs)/);
    }
  });

  it("fills the shorter lists for Accounts In-charge and External Relations with portal-wide changes", () => {
    for (const audience of ["finance", "external_relations"] as const) {
      const ids = buildGuide({ audience }).whatsNew.items.map((i) => i.id);
      expect(ids).toEqual(expect.arrayContaining(["whats-new-each-login", "latest-version"]));
    }
    expect(buildGuide({ audience: "student" }).whatsNew.items.map((i) => i.id)).not.toContain("whats-new-each-login");
  });
});

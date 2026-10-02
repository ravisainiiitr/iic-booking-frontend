import { describe, expect, it } from "vitest";

import { buildGuide } from "@/guides";

const ids = (guide: ReturnType<typeof buildGuide>) => guide.whatsNew.items.map((i) => i.id);

describe("What's New", () => {
  it("leads with the newest booking-page items for students", () => {
    const guide = buildGuide({ audience: "student", flags: { assistant: true } });
    expect(ids(guide).slice(0, 3)).toEqual(["slot-options", "form-kept", "wallet-link-student"]);
    expect(ids(guide)).toContain("assistant-need-help");
    expect(guide.whatsNew.items.length).toBeLessThanOrEqual(10);
  });

  it("hides Training & Certification while the module is off", () => {
    for (const audience of ["student", "faculty", "oic", "operator", "admin"] as const) {
      const off = buildGuide({ audience });
      expect(off.sections.map((s) => s.id)).not.toContain("training");
      expect(ids(off).some((id) => id.startsWith("training-"))).toBe(false);

      const on = buildGuide({ audience, flags: { training: true } });
      expect(on.sections.map((s) => s.id)).toContain("training");
      expect(ids(on)).toContain(`training-${audience}`);
    }
  });

  it("shows the peak pause to external users and the settings to admins only", () => {
    expect(ids(buildGuide({ audience: "external", flags: { externalBooking: true } }))).toContain("peak-external");
    expect(ids(buildGuide({ audience: "student" }))).not.toContain("peak-external");
    expect(ids(buildGuide({ audience: "admin" }))).toEqual(expect.arrayContaining(["equipment-form", "peak-admin"]));
  });
});

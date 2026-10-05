import { describe, expect, it } from "vitest";

import { buildGuide } from "@/guides";

const ids = (guide: ReturnType<typeof buildGuide>) => guide.whatsNew.items.map((i) => i.id);

describe("What's New", () => {
  it("leads with the newest booking-page items for students", () => {
    const guide = buildGuide({ audience: "student", flags: { assistant: true } });
    expect(ids(guide).slice(0, 3)).toEqual(["quota-countdown", "slot-options", "form-kept"]);
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
    expect(ids(buildGuide({ audience: "admin" }))).toEqual(expect.arrayContaining(["equipment-form", "wallet-modes-departments"]));
    expect(ids(buildGuide({ audience: "finance" }))).toContain("direct-recharge-finance");
    expect(ids(buildGuide({ audience: "faculty" }))).not.toContain("wallet-modes-departments");
  });

  it("announces waitlist and urgent request limits to Officers In Charge only", () => {
    const oic = buildGuide({ audience: "oic", flags: { training: true } });
    expect(ids(oic)[0]).toBe("booking-depths");
    expect(ids(oic)).toContain("training-oic");
    expect(oic.whatsNew.items.length).toBeLessThanOrEqual(10);
    for (const audience of ["admin", "dept_admin", "operator", "student"] as const) {
      expect(ids(buildGuide({ audience }))).not.toContain("booking-depths");
    }
  });

  it("announces registration approvals to the Main Administrator, faculty and project staff only", () => {
    expect(ids(buildGuide({ audience: "admin" }))[0]).toBe("registration-requests");
    expect(ids(buildGuide({ audience: "faculty" }))).toContain("registration-approvals-faculty");
    expect(ids(buildGuide({ audience: "project_staff" }))).toContain("programme-extension");
    for (const audience of ["student", "oic", "dept_admin", "external"] as const) {
      const got = ids(buildGuide({ audience }));
      expect(got).not.toContain("registration-requests");
      expect(got).not.toContain("registration-approvals-faculty");
    }
  });
});

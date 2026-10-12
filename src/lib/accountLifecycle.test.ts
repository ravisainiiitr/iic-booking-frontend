import { describe, expect, it } from "vitest";
import { bannerKind, endDateSourceLabel, isAccountSuspended, isSuspendedBody, type AccountLifecycleCompact } from "./accountLifecycle";

const base: AccountLifecycleCompact = {
  category: "iitr_student",
  category_label: "IITR Students",
  programme_end_date: "2027-06-30",
  end_date_source: "derived_from_joining",
  state: "active",
  suspended: false,
  enforcement_enabled: true,
  days_left: 200,
  end_date_required: false,
};

describe("account lifecycle helpers", () => {
  it("picks the banner: suspended first, then missing end date, then ending soon only while enforced", () => {
    expect(bannerKind(null)).toBeNull();
    expect(bannerKind(base)).toBeNull();
    expect(bannerKind({ ...base, suspended: true, state: "suspended" })).toBe("suspended");
    expect(bannerKind({ ...base, end_date_required: true, state: "end_date_missing" })).toBe("end_date_missing");
    expect(bannerKind({ ...base, state: "ending_soon", days_left: 10 })).toBe("ending_soon");
    expect(bannerKind({ ...base, state: "ending_soon", days_left: 10, enforcement_enabled: false })).toBeNull();
  });

  it("recognises the server's suspension refusal", () => {
    expect(isSuspendedBody({ code: "account_suspended", error: "Suspended" })).toBe(true);
    expect(isSuspendedBody({ code: "peak_external_paused" })).toBe(false);
    expect(isSuspendedBody(null)).toBe(false);
    expect(isAccountSuspended({ account_lifecycle: { ...base, suspended: true } })).toBe(true);
    expect(isAccountSuspended({ account_lifecycle: null })).toBe(false);
  });

  it("labels how the end date was set", () => {
    expect(endDateSourceLabel("graduation_date")).toBe("Graduation date");
    expect(endDateSourceLabel("derived_from_joining")).toBe("Derived from joining date");
    expect(endDateSourceLabel("unknown")).toBe("");
  });
});

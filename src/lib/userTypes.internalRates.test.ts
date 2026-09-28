import { describe, expect, it } from "vitest";
import { chargeEstimateUserTypeOptionsFor, viewerMaySeeInternalRates } from "./userTypes";

describe("viewerMaySeeInternalRates", () => {
  it("hides internal rates from anonymous and external viewers", () => {
    expect(viewerMaySeeInternalRates(null)).toBe(false);
    expect(viewerMaySeeInternalRates({ user_type: "external" })).toBe(false);
    expect(viewerMaySeeInternalRates({ user_type: "Industry" })).toBe(false);
    expect(viewerMaySeeInternalRates({ user_type: "faculty", department_type: "external" })).toBe(false);
  });

  it("shows internal rates to internal IITR users and staff", () => {
    expect(viewerMaySeeInternalRates({ user_type: "student", department_type: "internal" })).toBe(true);
    expect(viewerMaySeeInternalRates({ user_type: "faculty", department_type: "internal" })).toBe(true);
    expect(viewerMaySeeInternalRates({ user_type: "manager" })).toBe(true);
  });
});

describe("chargeEstimateUserTypeOptionsFor", () => {
  it("drops internal categories when internal rates are hidden", () => {
    const codes = chargeEstimateUserTypeOptionsFor(false).map((o) => o.code);
    expect(codes).not.toContain("student");
    expect(codes).not.toContain("faculty");
    expect(codes).toContain("external");
  });

  it("keeps every category for internal viewers", () => {
    const codes = chargeEstimateUserTypeOptionsFor(true).map((o) => o.code);
    expect(codes).toContain("student");
    expect(codes).toContain("external");
  });
});

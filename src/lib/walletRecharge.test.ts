import { describe, expect, it } from "vitest";

import {
  CASH_UNDERTAKING_DEFAULT,
  CASH_UNDERTAKING_IITR_FACULTY,
  CASH_UNDERTAKING_IITR_STUDENT,
  EMPTY_PROJECT_FORM,
  PROJECT_GRANT_UNDERTAKING,
  activeRechargeProjects,
  canSendRechargeOtp,
  cashUndertakingText,
  filterProjects,
  formatMoney,
  formatProjectValidity,
  isAwaitingFundReceipt,
  isProjectFormDirty,
  isRechargeDraftDirty,
  mapProjectApiErrors,
  rechargeFormBlocker,
  rechargeModeLabel,
  sricDeclineOutcome,
  summarizeRechargeRequests,
  validateProjectForm,
  validateRechargeAmount,
  type RechargeFormState,
  type RechargeProject,
} from "./walletRecharge";

const project = (overrides: Partial<RechargeProject> = {}): RechargeProject => ({
  id: 1,
  name: "Nanomaterials Study",
  project_code: "SRIC-001",
  agency: "DST",
  end_date: "2027-03-31",
  is_active: true,
  is_expired: false,
  ...overrides,
});

const readyProjectGrant: RechargeFormState = {
  isFaculty: true,
  mode: "project_grant",
  departmentId: 7,
  amount: "5000",
  projectId: 1,
  undertakingAccepted: true,
};

describe("undertaking texts", () => {
  it("uses the specified project-grant wording", () => {
    expect(PROJECT_GRANT_UNDERTAKING).toBe(
      "I hereby undertake that the project code selected above is correct to the best of my knowledge and that sufficient funds are available under the project to meet the requested recharge amount.",
    );
    expect(PROJECT_GRANT_UNDERTAKING.toLowerCase()).not.toContain("verified");
  });

  it("picks the cash undertaking by user type", () => {
    expect(cashUndertakingText("student", false)).toBe(CASH_UNDERTAKING_IITR_STUDENT);
    expect(cashUndertakingText("faculty", true)).toBe(CASH_UNDERTAKING_IITR_FACULTY);
    expect(cashUndertakingText("other", false)).toBe(CASH_UNDERTAKING_DEFAULT);
  });
});

describe("formatMoney", () => {
  it("formats rupees with Indian grouping and two decimals", () => {
    expect(formatMoney(95625)).toBe("₹95,625.00");
    expect(formatMoney("1234567.5")).toBe("₹12,34,567.50");
    expect(formatMoney(null)).toBe("₹0.00");
    expect(formatMoney("not a number")).toBe("₹0.00");
  });
});

describe("validateRechargeAmount", () => {
  it("requires a positive amount of at least ₹100", () => {
    expect(validateRechargeAmount("")).toBe("Enter an amount.");
    expect(validateRechargeAmount("abc")).toBe("Enter a valid amount in rupees.");
    expect(validateRechargeAmount("-5")).toBe("Enter a valid amount in rupees.");
    expect(validateRechargeAmount("0")).toBe("Enter a valid amount in rupees.");
    expect(validateRechargeAmount("99.99")).toBe("Enter an amount of at least ₹100.");
    expect(validateRechargeAmount("100")).toBeNull();
    expect(validateRechargeAmount(" 2500.50 ")).toBeNull();
  });

  it("rejects more than two decimals and amounts above the backend limit", () => {
    expect(validateRechargeAmount("100.123")).toBe("Amount can have at most 2 decimal places.");
    expect(validateRechargeAmount("100000000")).toMatch(/cannot exceed/);
    expect(validateRechargeAmount("99999999.99")).toBeNull();
  });
});

describe("project selection helpers", () => {
  it("keeps only projects the backend reports as active and unexpired", () => {
    const list = [
      project({ id: 1 }),
      project({ id: 2, is_active: false }),
      project({ id: 3, is_expired: true }),
      project({ id: 4 }),
    ];
    expect(activeRechargeProjects(list).map((p) => p.id)).toEqual([1, 4]);
  });

  it("searches by name, code and agency, case-insensitively", () => {
    const list = [
      project({ id: 1, name: "Solar Cells", project_code: "SRIC-100", agency: "DST" }),
      project({ id: 2, name: "Water Filters", project_code: "IITR-200", agency: "SERB" }),
    ];
    expect(filterProjects(list, "").map((p) => p.id)).toEqual([1, 2]);
    expect(filterProjects(list, "solar").map((p) => p.id)).toEqual([1]);
    expect(filterProjects(list, "iitr-2").map((p) => p.id)).toEqual([2]);
    expect(filterProjects(list, "serb").map((p) => p.id)).toEqual([2]);
    expect(filterProjects(list, "none")).toEqual([]);
  });

  it("describes project validity", () => {
    expect(formatProjectValidity("2027-03-31")).toBe("Valid until 31 Mar 2027");
    expect(formatProjectValidity(null)).toBe("No end date");
    expect(formatProjectValidity("garbage")).toBe("No end date");
  });
});

describe("inline project form validation", () => {
  it("requires name, code and agency", () => {
    expect(validateProjectForm(EMPTY_PROJECT_FORM)).toEqual({
      name: "Project name is required.",
      project_code: "Project code is required.",
      agency: "Funding agency is required.",
    });
    expect(
      validateProjectForm({ ...EMPTY_PROJECT_FORM, name: "  ", project_code: "X", agency: "DST" }),
    ).toEqual({ name: "Project name is required." });
  });

  it("rejects an end date before the start date", () => {
    const values = { name: "P", project_code: "C", agency: "A", start_date: "2026-05-01", end_date: "2026-04-01" };
    expect(validateProjectForm(values)).toEqual({ end_date: "End date cannot be earlier than the start date." });
    expect(validateProjectForm({ ...values, end_date: "2026-05-01" })).toEqual({});
  });

  it("detects unsaved form input", () => {
    expect(isProjectFormDirty(EMPTY_PROJECT_FORM)).toBe(false);
    expect(isProjectFormDirty({ ...EMPTY_PROJECT_FORM, agency: "DST" })).toBe(true);
  });
});

describe("mapProjectApiErrors", () => {
  it("maps DRF field errors to friendly inline messages", () => {
    const errors = mapProjectApiErrors({
      status: 400,
      error: "name: This field is required.",
      fieldErrors: {
        name: ["This field is required."],
        project_code: ["This field may not be blank."],
        start_date: ["Date has wrong format. Use one of these formats instead: YYYY-MM-DD."],
      },
    });
    expect(errors).toEqual({
      name: "Project name is required.",
      project_code: "Project code is required.",
      start_date: "Enter a valid start date.",
    });
  });

  it("routes the date-order non-field error to the end date field", () => {
    expect(
      mapProjectApiErrors({ status: 400, fieldErrors: { non_field_errors: ["End date must be after start date."] } }),
    ).toEqual({ end_date: "End date cannot be earlier than the start date." });
  });

  it("never surfaces raw server output", () => {
    expect(
      mapProjectApiErrors({ status: 500, error: "<!DOCTYPE html><title>IntegrityError at /api/projects/</title>" }),
    ).toEqual({ form: "The project could not be saved. Please check the details and try again." });
    expect(mapProjectApiErrors({ status: 400, error: "HTTP error! status: 400" })).toEqual({
      form: "The project could not be saved. Please check the details and try again.",
    });
    expect(mapProjectApiErrors({ status: 403, error: "Only faculty members can create projects" })).toEqual({
      form: "Only faculty members can add projects.",
    });
  });

  it("keeps a clean 4xx message from the API", () => {
    expect(mapProjectApiErrors({ status: 400, error: "A project with this code already exists." })).toEqual({
      form: "A project with this code already exists.",
    });
  });
});

describe("recharge form gating", () => {
  it("allows sending the OTP only when everything is complete", () => {
    expect(rechargeFormBlocker(readyProjectGrant)).toBeNull();
    expect(canSendRechargeOtp(readyProjectGrant)).toBe(true);
  });

  it("requires a project in Project Grant mode", () => {
    expect(rechargeFormBlocker({ ...readyProjectGrant, projectId: null })).toBe("Select a project.");
  });

  it("keeps Send OTP disabled until the undertaking is accepted", () => {
    const state = { ...readyProjectGrant, undertakingAccepted: false };
    expect(rechargeFormBlocker(state)).toBe("Accept the undertaking to continue.");
    expect(canSendRechargeOtp(state)).toBe(false);
  });

  it("blocks Project Grant for non-faculty users", () => {
    expect(rechargeFormBlocker({ ...readyProjectGrant, isFaculty: false })).toBe(
      "Project Grant recharge is available only to faculty.",
    );
  });

  it("does not need a project for Direct Cash, but still needs the undertaking", () => {
    const cash: RechargeFormState = { ...readyProjectGrant, mode: "direct_cash_deposit", projectId: null, isFaculty: false };
    expect(rechargeFormBlocker(cash)).toBeNull();
    expect(rechargeFormBlocker({ ...cash, undertakingAccepted: false })).toBe("Accept the undertaking to continue.");
  });

  it("requires a department and a valid amount", () => {
    expect(rechargeFormBlocker({ ...readyProjectGrant, departmentId: null })).toBe(
      "Select the department sub-wallet to credit.",
    );
    expect(rechargeFormBlocker({ ...readyProjectGrant, amount: "50" })).toBe("Enter an amount of at least ₹100.");
  });
});

describe("isRechargeDraftDirty", () => {
  const clean = {
    amount: "",
    projectId: null,
    undertakingAccepted: false,
    projectForm: null,
    otpStep: "form" as const,
  };

  it("is clean for an untouched form and after submission", () => {
    expect(isRechargeDraftDirty(clean)).toBe(false);
    expect(isRechargeDraftDirty({ ...clean, amount: "500", otpStep: "done" })).toBe(false);
    expect(isRechargeDraftDirty({ ...clean, amount: "500", otpStep: "sric" })).toBe(false);
  });

  it("is dirty when anything was entered or while an OTP is pending", () => {
    expect(isRechargeDraftDirty({ ...clean, amount: "500" })).toBe(true);
    expect(isRechargeDraftDirty({ ...clean, projectId: 3 })).toBe(true);
    expect(isRechargeDraftDirty({ ...clean, undertakingAccepted: true })).toBe(true);
    expect(isRechargeDraftDirty({ ...clean, projectForm: { ...EMPTY_PROJECT_FORM, name: "New" } })).toBe(true);
    expect(isRechargeDraftDirty({ ...clean, projectForm: EMPTY_PROJECT_FORM })).toBe(false);
    expect(isRechargeDraftDirty({ ...clean, otpStep: "otp" })).toBe(true);
  });
});

describe("recharge request summary", () => {
  it("counts statuses and separates drafts awaiting OTP", () => {
    expect(
      summarizeRechargeRequests([
        { status: "PENDING", user_otp_verified: true },
        { status: "PENDING" },
        { status: "PENDING", user_otp_verified: false },
        { status: "APPROVED", user_otp_verified: true },
        { status: "REJECTED", user_otp_verified: true },
        { status: "CANCELLED", user_otp_verified: true },
      ]),
    ).toEqual({
      pending: 2,
      approved: 1,
      rejected: 1,
      awaitingOtp: 1,
      declinedToCredit: 0,
      creditOutstanding: 0,
      awaitingFunds: 0,
    });
  });

  it("counts SRIC declines and sums outstanding auto-approved credit", () => {
    expect(
      summarizeRechargeRequests([
        { status: "CANCELLED", cancellation_source: "sric_declined", decline_credit_outstanding: "5000.00" },
        { status: "CANCELLED", cancellation_source: "sric_declined", decline_credit_outstanding: "250.50" },
        { status: "CANCELLED", cancellation_source: "user" },
        { status: "APPROVED", decline_credit_outstanding: "0.00" },
        { status: "APPROVED", wallet_credit_pending: true },
      ]),
    ).toEqual({
      pending: 0,
      approved: 2,
      rejected: 0,
      awaitingOtp: 0,
      declinedToCredit: 2,
      creditOutstanding: 5250.5,
      awaitingFunds: 1,
    });
  });

  it("distinguishes decline outcomes and approvals awaiting fund receipt", () => {
    expect(sricDeclineOutcome({ decline_credit_amount: "1000.00", decline_credit_outstanding: "400.00" })).toBe(
      "credit_outstanding",
    );
    expect(sricDeclineOutcome({ decline_credit_amount: "1000.00", decline_credit_outstanding: "0.00" })).toBe(
      "credit_recovered",
    );
    expect(sricDeclineOutcome({ decline_credit_amount: "0.00" })).toBe("no_new_credit");
    expect(isAwaitingFundReceipt({ status: "APPROVED", wallet_credit_pending: true })).toBe(true);
    expect(isAwaitingFundReceipt({ status: "APPROVED", wallet_credit_pending: false })).toBe(false);
    expect(isAwaitingFundReceipt({ status: "CANCELLED", wallet_credit_pending: true })).toBe(false);
  });

  it("labels recharge modes", () => {
    expect(rechargeModeLabel("project_grant")).toBe("Project Grant");
    expect(rechargeModeLabel("DIRECT_CASH_DEPOSIT")).toBe("Cash / Bank transfer");
    expect(rechargeModeLabel("online_payment")).toBe("online payment");
    expect(rechargeModeLabel(undefined)).toBe("—");
  });
});

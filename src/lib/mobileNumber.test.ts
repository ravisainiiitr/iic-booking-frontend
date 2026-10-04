// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import {
  clearMobilePromptSnooze,
  isMobilePromptExempt,
  isMobilePromptPath,
  isMobilePromptSnoozed,
  normalizeIndianMobile,
  snoozeMobilePrompt,
  userNeedsMobileNumber,
} from "./mobileNumber";

describe("normalizeIndianMobile (same rule as the backend)", () => {
  it.each([
    ["9876543210", "9876543210"],
    ["+91 98765 43210", "9876543210"],
    ["+91-9876543210", "9876543210"],
    ["919876543210", "9876543210"],
    ["09876543210", "9876543210"],
    ["(987) 654-3210", "9876543210"],
  ])("accepts %s", (input, expected) => {
    expect(normalizeIndianMobile(input)).toBe(expected);
  });

  it.each(["", "   ", "0000000000", "12345", "98765", "5876543210", "98765432101", "+1 415 555 0100", "N/A"])(
    "treats %j as missing",
    (input) => {
      expect(normalizeIndianMobile(input)).toBeNull();
    },
  );

  it("treats null and undefined as missing", () => {
    expect(normalizeIndianMobile(null)).toBeNull();
    expect(normalizeIndianMobile(undefined)).toBeNull();
  });
});

const PROMPTED_TYPES = [
  "student",
  "individual_student",
  "startup_incubated_iitr",
  "external",
  "RND",
  "Industry",
  "external_startup_msme",
  "other",
  "operator",
  "finance",
  "dept_admin",
  "admin",
  "org_admin",
  "external_relations",
];

describe("userNeedsMobileNumber by role and number state", () => {
  it.each(PROMPTED_TYPES)("%s without a valid number is prompted; with one is not", (user_type) => {
    for (const phone_number of [null, "", "0000000000", "12345"]) {
      expect(userNeedsMobileNumber({ id: 1, user_type, phone_number })).toBe(true);
    }
    expect(userNeedsMobileNumber({ id: 1, user_type, phone_number: "9876543210" })).toBe(false);
  });

  it.each(["faculty", "Faculty", "manager"])("%s (IITR faculty / Officer In Charge) is never prompted", (user_type) => {
    expect(isMobilePromptExempt({ user_type })).toBe(true);
    expect(userNeedsMobileNumber({ id: 1, user_type, phone_number: null })).toBe(false);
    expect(userNeedsMobileNumber({ id: 1, user_type, phone_number: "", needs_mobile_number: true })).toBe(false);
  });

  it("uses the backend is_faculty flag", () => {
    expect(userNeedsMobileNumber({ id: 1, user_type: "", is_faculty: true, phone_number: null })).toBe(false);
  });

  it("prefers the server flag over the local rule", () => {
    expect(userNeedsMobileNumber({ id: 1, user_type: "student", phone_number: "9876543210", needs_mobile_number: true })).toBe(true);
    expect(userNeedsMobileNumber({ id: 1, user_type: "student", phone_number: null, needs_mobile_number: false })).toBe(false);
  });

  it("no user means no prompt", () => {
    expect(userNeedsMobileNumber(null)).toBe(false);
  });
});

describe("Remind me later", () => {
  beforeEach(() => localStorage.clear());

  it("snoozes for the current sign-in only", () => {
    snoozeMobilePrompt(7, "token-A");
    expect(isMobilePromptSnoozed(7, "token-A")).toBe(true);
    expect(isMobilePromptSnoozed(7, "token-B")).toBe(false);
    expect(isMobilePromptSnoozed(8, "token-A")).toBe(false);
  });

  it("is cleared on sign-out", () => {
    snoozeMobilePrompt(7, "token-A");
    clearMobilePromptSnooze(7);
    expect(isMobilePromptSnoozed(7, "token-A")).toBe(false);
  });

  it("in the Android app, lasts for the app session even as access tokens rotate", () => {
    sessionStorage.clear();
    snoozeMobilePrompt(9, "iicm_first");
    expect(isMobilePromptSnoozed(9, "iicm_rotated")).toBe(true);
    expect(localStorage.length).toBe(0);
    clearMobilePromptSnooze(9);
    expect(isMobilePromptSnoozed(9, "iicm_rotated")).toBe(false);
  });

  it("never snoozes without a token", () => {
    snoozeMobilePrompt(7, null);
    expect(isMobilePromptSnoozed(7, null)).toBe(false);
  });
});

describe("isMobilePromptPath", () => {
  it("opens on the dashboard and the staff app's Today", () => {
    expect(isMobilePromptPath("/dashboard")).toBe(true);
    expect(isMobilePromptPath("/dashboard/")).toBe(true);
    expect(isMobilePromptPath("/app")).toBe(true);
    expect(isMobilePromptPath("/profile")).toBe(false);
    expect(isMobilePromptPath("/app/calendar")).toBe(false);
    expect(isMobilePromptPath("/book/12")).toBe(false);
  });
});

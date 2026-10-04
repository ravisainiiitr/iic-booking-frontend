import { describe, expect, it } from "vitest";
import {
  groupUserTypes,
  iitrDepartmentOptions,
  requirementsFor,
  signupKind,
  validateSignup,
  type RegisterUserType,
  type SignupValues,
} from "./signupForm";

const TYPES: RegisterUserType[] = [
  { code: "external", name: "Educational Institute", description: "" },
  { code: "RND", name: "Govt R&D Organizations", description: "" },
  { code: "startup_incubated_iitr", name: "IITR Startup", description: "", iitr: true },
  { code: "student", name: "IITR Research Associates in Projects", description: "", alias: "IITR Research Associates in Projects", iitr: true },
  { code: "student", name: "IITR Post Doctoral Fellows", description: "", alias: "IITR Post Doctoral Fellows", iitr: true },
];

const base: SignupValues = {
  userType: "student|IITR Post Doctoral Fellows",
  name: "Asha Verma",
  gender: "female",
  phone: "9876543210",
  empId: "PDF-1",
  email: "asha@gmail.com",
  password: "secret123",
  passwordConfirm: "secret123",
  state: "",
  department: "4",
  hasOrganisationRequest: false,
  programEndDate: "2027-01-01",
  supervisorId: 9,
  documentCount: 0,
};

describe("signupKind", () => {
  it("classifies the three IITR types, including the legacy IITR Startups alias", () => {
    expect(signupKind("student|IITR Post Doctoral Fellows")).toBe("iitr_postdoc");
    expect(signupKind("student|IITR Research Associates in Projects")).toBe("iitr_ra");
    expect(signupKind("startup_incubated_iitr")).toBe("iitr_startup");
    expect(signupKind("individual_student|IITR Startups")).toBe("iitr_startup");
    expect(signupKind("RND")).toBe("rnd");
    expect(signupKind("")).toBeNull();
  });
});

describe("groupUserTypes", () => {
  it("lists IIT Roorkee types first in a fixed order, then external ones", () => {
    const { iitr, external } = groupUserTypes(TYPES);
    expect(iitr.map((t) => t.name)).toEqual(["IITR Post Doctoral Fellows", "IITR Research Associates in Projects", "IITR Startup"]);
    expect(external.map((t) => t.name)).toEqual(["Educational Institute", "Govt R&D Organizations"]);
  });
});

describe("requirementsFor", () => {
  it("shows only the chosen type's requirements", () => {
    const iitr = requirementsFor("iitr_startup").map((r) => r.id);
    expect(iitr).toContain("iitr-supervisor");
    expect(iitr).toContain("iitr-documents");
    expect(iitr).not.toContain("external-kyc");
    const educational = requirementsFor("educational").map((r) => r.id);
    expect(educational).toContain("external-kyc");
    expect(educational).not.toContain("iitr-supervisor");
    expect(requirementsFor("industry").map((r) => r.id)).not.toContain("external-kyc");
    expect(requirementsFor(null).length).toBeGreaterThan(4);
  });
});

describe("validateSignup", () => {
  const today = "2026-10-04";

  it("accepts a complete IITR post-doc without a profile picture or documents", () => {
    expect(validateSignup(base, today)).toEqual({});
  });

  it("requires an IIT Roorkee department and a supervisor for all three IITR types", () => {
    for (const userType of ["student|IITR Post Doctoral Fellows", "student|IITR Research Associates in Projects", "startup_incubated_iitr"]) {
      const errors = validateSignup({ ...base, userType, department: "", supervisorId: "" }, today);
      expect(errors.department).toBe("Select your IIT Roorkee department or centre.");
      expect(errors.supervisor).toBeTruthy();
    }
    expect(validateSignup({ ...base, userType: "startup_incubated_iitr", supervisorId: "" }, today).supervisor).toMatch(/mentors your startup/);
  });

  it("keeps the public-email KYC rule for Educational Institute and Govt R&D only", () => {
    const external = { ...base, userType: "external", state: "UK", supervisorId: "" as const };
    expect(validateSignup(external, today).documents).toBeTruthy();
    expect(validateSignup({ ...external, documentCount: 1 }, today).documents).toBeUndefined();
    expect(validateSignup({ ...external, email: "a@college.edu.in" }, today).documents).toBeUndefined();
    expect(validateSignup({ ...external, userType: "Industry" }, today).documents).toBeUndefined();
  });

  it("checks state, iitr.ac.in email, phone, passwords and a past end date", () => {
    const errors = validateSignup(
      { ...base, userType: "Industry", state: "", email: "x@iitr.ac.in", phone: "12345", passwordConfirm: "other", programEndDate: "2026-01-01" },
      today,
    );
    expect(Object.keys(errors).sort()).toEqual(["email", "passwordConfirm", "phone", "programEndDate", "state"]);
  });

  it("lets Govt R&D register with a requested organisation instead of a listed one", () => {
    const rnd = { ...base, userType: "RND", state: "UK", department: "", email: "a@drdo.gov.in", supervisorId: "" as const };
    expect(validateSignup(rnd, today).department).toBeTruthy();
    expect(validateSignup({ ...rnd, hasOrganisationRequest: true }, today).department).toBeUndefined();
  });
});

describe("iitrDepartmentOptions", () => {
  const rows = [
    { id: 1, name: "Physics Department", code: "PH", department_type: "internal", internal_subcategory: null },
    { id: 2, name: "Institute Instrumentation Centre", code: "IIC", department_type: "internal", internal_subcategory: "iit_roorkee_dept_centres" },
    { id: 3, name: "ADMIN", code: "ADMIN", department_type: "internal", internal_subcategory: null },
    { id: 4, name: "Acme Robotics", code: "ACME", department_type: "internal", internal_subcategory: "startups" },
    { id: 5, name: "Delhi University", code: "DU", department_type: "external", internal_subcategory: null },
    { id: 6, name: "architecture and Planning Department", code: null, department_type: "internal" },
    { id: 7, name: "Centre for Nanotechnology", code: "NT", department_type: "internal", internal_subcategory: null },
    { id: 8, name: "Administration Office", code: "admin", department_type: "internal", internal_subcategory: null },
  ];

  it("keeps every internal department or centre, with or without a subcategory, sorted by name", () => {
    expect(iitrDepartmentOptions(rows).map((d) => d.id)).toEqual([6, 7, 2, 1]);
  });

  it("drops external organisations, Startups entries and the ADMIN department", () => {
    const ids = iitrDepartmentOptions(rows).map((d) => d.id);
    expect(ids).not.toContain(3);
    expect(ids).not.toContain(4);
    expect(ids).not.toContain(5);
    expect(ids).not.toContain(8);
  });

  it("does not truncate long lists", () => {
    const many = Array.from({ length: 80 }, (_, i) => ({ id: i + 1, name: `Centre ${String(i).padStart(2, "0")}`, department_type: "internal" }));
    expect(iitrDepartmentOptions(many)).toHaveLength(80);
  });
});

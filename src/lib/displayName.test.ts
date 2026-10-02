import { describe, expect, it } from "vitest";
import {
  applyFacultyNamePrefix,
  cleanPersonName,
  formatNamedPerson,
  formatPersonName,
  formatSignedInAs,
  formatUserDisplayName,
  formatWelcomeGreeting,
} from "./displayName";

describe("applyFacultyNamePrefix", () => {
  it("prefixes faculty names with Prof.", () => {
    expect(applyFacultyNamePrefix("Ravi Saini", "faculty")).toBe("Prof. Ravi Saini");
    expect(applyFacultyNamePrefix("  Ravi   Saini ", 2)).toBe("Prof. Ravi Saini");
  });

  it("never returns a bare title for an empty or title-only name", () => {
    for (const name of ["", "   ", null, undefined, "Prof.", "Prof", "prof. ", "Dr.", "Prof. Dr.", "Prof.."]) {
      expect(applyFacultyNamePrefix(name, "faculty")).toBe("");
    }
  });

  it("does not double an existing academic title", () => {
    expect(applyFacultyNamePrefix("Prof. Ravi Saini", "faculty")).toBe("Prof. Ravi Saini");
    expect(applyFacultyNamePrefix("Professor Ravi Saini", "faculty")).toBe("Professor Ravi Saini");
    expect(applyFacultyNamePrefix("Dr. Ravi Saini", "faculty")).toBe("Dr. Ravi Saini");
    expect(applyFacultyNamePrefix("Prof. Prof. Ravi Saini", "faculty")).toBe("Prof. Ravi Saini");
    expect(applyFacultyNamePrefix("Prof. Dr. Ravi Saini", "faculty")).toBe("Dr. Ravi Saini");
  });

  it("does not mistake names that merely start with the same letters for titles", () => {
    expect(applyFacultyNamePrefix("Drishti Rao", "faculty")).toBe("Prof. Drishti Rao");
    expect(applyFacultyNamePrefix("Profulla Das", "faculty")).toBe("Prof. Profulla Das");
    expect(cleanPersonName("Mrinal Sen")).toBe("Mrinal Sen");
  });

  it.each(["student", "individual_student", "external", "industry", "manager", "operator", "dept_admin", "admin", 1, null])(
    "does not add Prof. for user type %s",
    (userType) => {
      expect(applyFacultyNamePrefix("Aman Kumar", userType)).toBe("Aman Kumar");
    }
  );
});

describe("formatPersonName / formatUserDisplayName", () => {
  it("uses the server display_name when present", () => {
    const user = { name: "Ravi Saini", display_name: "Prof. Ravi Saini", user_type: "faculty", email: "r@iitr.ac.in" };
    expect(formatPersonName(user)).toBe("Prof. Ravi Saini");
    expect(formatUserDisplayName(user)).toBe("Prof. Ravi Saini");
  });

  it("ignores a bare-title display_name and falls back to the name, then the email", () => {
    expect(formatPersonName({ name: "Ravi Saini", display_name: "Prof.", user_type: "faculty" })).toBe("Prof. Ravi Saini");
    const noName = { name: "", display_name: "Prof. ", user_type: "faculty", email: "ravi@iitr.ac.in" };
    expect(formatPersonName(noName)).toBe("");
    expect(formatUserDisplayName(noName)).toBe("ravi@iitr.ac.in");
  });

  it("falls back to the given label when nothing is known", () => {
    expect(formatUserDisplayName(null)).toBe("User");
    expect(formatUserDisplayName({ name: "", user_type: "faculty" })).toBe("User");
    expect(formatNamedPerson("", "faculty", null)).toBe("—");
  });
});

describe("guide welcome and header text", () => {
  const guideTexts = (user: Parameters<typeof formatPersonName>[0] & { email?: string | null }) => {
    const name = formatPersonName(user);
    return { greeting: formatWelcomeGreeting(name), signedInAs: formatSignedInAs(name, user?.email) };
  };

  it("faculty with a full name", () => {
    expect(guideTexts({ name: "Ravi Saini", user_type: "faculty", email: "ravi@iitr.ac.in" })).toEqual({
      greeting: "Welcome, Prof. Ravi Saini.",
      signedInAs: "Signed in as Prof. Ravi Saini",
    });
  });

  it("faculty with an empty name never shows a bare Prof.", () => {
    expect(guideTexts({ name: "", display_name: "", user_type: "faculty", email: "ravi@iitr.ac.in" })).toEqual({
      greeting: "Welcome.",
      signedInAs: "Signed in as ravi@iitr.ac.in",
    });
  });

  it("student", () => {
    expect(guideTexts({ name: "Aman Kumar", display_name: "Aman Kumar", user_type: "student", email: "a@iitr.ac.in" })).toEqual({
      greeting: "Welcome, Aman Kumar.",
      signedInAs: "Signed in as Aman Kumar",
    });
  });

  it("user with only an email", () => {
    expect(guideTexts({ name: "", user_type: "industry", email: "ops@acme.example" })).toEqual({
      greeting: "Welcome.",
      signedInAs: "Signed in as ops@acme.example",
    });
  });

  it("nothing known at all", () => {
    expect(guideTexts({ name: "", user_type: "operator", email: "" })).toEqual({ greeting: "Welcome.", signedInAs: "" });
  });

  it("names already starting with Prof. or Dr. are not doubled", () => {
    expect(guideTexts({ name: "Prof. Ravi Saini", user_type: "faculty" }).greeting).toBe("Welcome, Prof. Ravi Saini.");
    expect(guideTexts({ name: "Dr. Neha Gupta", user_type: "faculty" }).greeting).toBe("Welcome, Dr. Neha Gupta.");
    expect(guideTexts({ name: "Dr. Neha Gupta", user_type: "manager" }).signedInAs).toBe("Signed in as Dr. Neha Gupta");
  });

  it("does not add a second period when the name already ends with one", () => {
    expect(formatWelcomeGreeting("Prof. R. K. Jr.")).toBe("Welcome, Prof. R. K. Jr.");
    expect(formatWelcomeGreeting("Prof.")).toBe("Welcome.");
    expect(formatSignedInAs("Prof.", null)).toBe("");
  });
});

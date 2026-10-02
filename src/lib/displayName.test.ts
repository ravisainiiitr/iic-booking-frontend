import { describe, expect, it } from "vitest";
import {
  applyFacultyNamePrefix,
  cleanPersonName,
  formatNamedPerson,
  formatPersonName,
  formatSignedInAs,
  formatUserDisplayName,
  formatWelcomeGreeting,
  getInitials,
  getNameInitial,
  stripHonorifics,
} from "./displayName";

describe("getNameInitial / getInitials", () => {
  it.each([
    ["Prof. Ravi Saini", "R"],
    ["Dr. Kalpana", "K"],
    ["Prof. Dr. Shriniwas Yadav", "S"],
    ["Mrs. Anita", "A"],
    ["prof ravi", "R"],
    ["PROF.RAVI SAINI", "R"],
    ["Professor Neha Gupta", "N"],
    ["Mr Aman Kumar", "A"],
    ["Ms. Priya", "P"],
    ["Miss Riya", "R"],
    ["Shri Mohan Lal", "M"],
    ["Smt. Kamla Devi", "K"],
    ["Er. Vikas Jain", "V"],
    ["Dr.Kalpana", "K"],
    ["Ravi Saini", "R"],
    ["  ravi   saini ", "R"],
  ])("%s gives %s", (name, initial) => {
    expect(getNameInitial(name)).toBe(initial);
  });

  it("keeps names that merely start like a title", () => {
    expect(getNameInitial("Drishti Rao")).toBe("D");
    expect(getNameInitial("Profulla Das")).toBe("P");
    expect(getNameInitial("Mrinal Sen")).toBe("M");
    expect(getNameInitial("Shriniwas Yadav")).toBe("S");
    expect(getNameInitial("Eran Cohen")).toBe("E");
  });

  it("gives two initials (first + last) after dropping titles", () => {
    expect(getInitials("Ravi Saini", { max: 2 })).toBe("RS");
    expect(getInitials("Prof. Ravi Kumar Saini", { max: 2 })).toBe("RS");
    expect(getInitials("Prof. Dr. Shriniwas Yadav", { max: 2 })).toBe("SY");
    expect(getInitials("Prof. Kalpana", { max: 2 })).toBe("K");
  });

  it("falls back to the email, then the fallback", () => {
    expect(getNameInitial("", "ravi@iitr.ac.in")).toBe("R");
    expect(getNameInitial("Prof.", "neha@iitr.ac.in")).toBe("N");
    expect(getNameInitial(null, null)).toBe("?");
    expect(getNameInitial("", "", "U")).toBe("U");
    expect(getInitials(undefined, { email: "ops@acme.example", max: 2 })).toBe("O");
  });

  it("handles Devanagari names and honorifics", () => {
    expect(getNameInitial("रवि सैनी")).toBe("र");
    expect(getNameInitial("डॉ. रवि सैनी")).toBe("र");
    expect(getNameInitial("श्री मोहन लाल")).toBe("मो");
    expect(getInitials("प्रो. रवि सैनी", { max: 2 })).toBe("रसै");
  });

  it("stripHonorifics leaves only the name", () => {
    expect(stripHonorifics("Prof. Dr. Shriniwas Yadav")).toBe("Shriniwas Yadav");
    expect(stripHonorifics("Prof.")).toBe("");
  });
});

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

  it("adds Prof. for IITR faculty even when a cached display_name lacks it", () => {
    expect(formatPersonName({ name: "Ravi Saini", display_name: "Ravi Saini", user_type: "faculty" })).toBe("Prof. Ravi Saini");
    expect(formatPersonName({ name: "Ravi Saini", user_type: "faculty" })).toBe("Prof. Ravi Saini");
    expect(formatPersonName({ name: "Ravi Saini", display_name: "Ravi Saini", user_type: 2 })).toBe("Prof. Ravi Saini");
    expect(formatPersonName({ name: "Ravi Saini", user_type: "FACULTY" })).toBe("Prof. Ravi Saini");
  });

  it("uses the backend is_faculty flag like the guide audience does", () => {
    expect(formatPersonName({ name: "Ravi Saini", user_type: "", is_faculty: true })).toBe("Prof. Ravi Saini");
    expect(formatPersonName({ name: "Ravi Saini", user_type: "student", is_faculty: false })).toBe("Ravi Saini");
  });

  it("does not double titles for faculty", () => {
    expect(formatPersonName({ name: "Dr. Neha Gupta", display_name: "Prof. Dr. Neha Gupta", user_type: "faculty" })).toBe("Dr. Neha Gupta");
    expect(formatPersonName({ name: "Neha Gupta", display_name: "Dr. Neha Gupta", user_type: "faculty" })).toBe("Dr. Neha Gupta");
    expect(formatPersonName({ name: "Prof. Ravi Saini", display_name: "Prof. Ravi Saini", user_type: "faculty" })).toBe("Prof. Ravi Saini");
  });

  it.each(["student", "manager", "operator", "dept_admin", "admin", "finance", "external", "industry", "individual_student"])(
    "never adds Prof. for %s, even from a cached object",
    (userType) => {
      expect(formatPersonName({ name: "Aman Kumar", display_name: "Aman Kumar", user_type: userType })).toBe("Aman Kumar");
      expect(formatPersonName({ name: "Aman Kumar", user_type: userType })).toBe("Aman Kumar");
    }
  );

  it("treats the server's email fallback in display_name as no name", () => {
    expect(formatPersonName({ name: "", display_name: "ravi@iitr.ac.in", user_type: "faculty", email: "ravi@iitr.ac.in" })).toBe("");
    expect(formatUserDisplayName({ name: "", display_name: "ravi@iitr.ac.in", user_type: "faculty", email: "ravi@iitr.ac.in" })).toBe(
      "ravi@iitr.ac.in"
    );
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

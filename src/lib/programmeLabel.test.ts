import { describe, expect, it } from "vitest";
import { formatProgramme } from "./programmeLabel";

describe("formatProgramme", () => {
  it.each([
    ["Ph.D. - Doctor of Philosophy", "Ph.D. Physics", "Ph.D. Physics"],
    ["Ph.D. - Doctor of Philosophy", "Physics", "Ph.D. Physics"],
    ["PhD - Doctor of Philosophy", "Ph.D. Chemistry", "Ph.D. Chemistry"],
    ["M.Tech. - Master of Technology", "Computer Science (M.Tech.)", "Computer Science (M.Tech.)"],
    ["M.Tech", "Chemical Engineering", "M.Tech Chemical Engineering"],
    ["MA - Master of Arts", "Mathematics", "MA Mathematics"],
    ["Ph.D. – Doctor of Philosophy", "", "Ph.D."],
    ["", "Ph.D. Physics", "Ph.D. Physics"],
    [null, undefined, ""],
  ])("formats %s + %s as %s", (degree, branch, expected) => {
    expect(formatProgramme(degree, branch)).toBe(expected);
  });
});

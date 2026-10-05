import { describe, expect, it } from "vitest";
import { formatIst, istInputToIso, istInputValue } from "./facultyWalletSyncDeadline";

describe("faculty wallet sync deadline helpers", () => {
  it("formats an instant in IST regardless of the source offset", () => {
    expect(formatIst("2026-10-31T23:59:59+05:30")).toMatch(/31 Oct 2026.*11:59:59.*pm IST/i);
    expect(formatIst("2026-10-31T18:29:59Z")).toMatch(/31 Oct 2026.*11:59:59.*pm IST/i);
    expect(formatIst(null)).toBe("—");
  });

  it("shows the IST wall clock in the datetime-local input", () => {
    expect(istInputValue("2026-10-31T23:59:59+05:30")).toBe("2026-10-31T23:59:59");
    expect(istInputValue("2026-10-03T18:30:00Z")).toBe("2026-10-04T00:00:00");
    expect(istInputValue("")).toBe("");
  });

  it("turns an IST input into an ISO string with the +05:30 offset", () => {
    expect(istInputToIso("2026-10-31T23:59:59")).toBe("2026-10-31T23:59:59+05:30");
    expect(istInputToIso("2026-10-31T23:59")).toBe("2026-10-31T23:59:00+05:30");
    expect(istInputToIso("2026-10-31T23:59:59.000")).toBe("2026-10-31T23:59:59+05:30");
    expect(istInputToIso("")).toBeNull();
    expect(istInputToIso("31/10/2026 23:59")).toBeNull();
    expect(istInputToIso("2026-02-30T10:00")).toBeNull();
  });

  it("round-trips the server value", () => {
    const iso = "2026-10-31T23:59:59+05:30";
    expect(istInputToIso(istInputValue(iso))).toBe(iso);
  });
});

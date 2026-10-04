import { describe, expect, it } from "vitest";
import { deadlineRemaining, formatDeadlineIst } from "./registrationDeadline";

describe("registration decision deadline", () => {
  it("formats the deadline in IST", () => {
    expect(formatDeadlineIst("2026-10-05T10:00:00Z")).toMatch(/05 Oct 2026, 3:30\s?pm IST/i);
    expect(formatDeadlineIst(null)).toBe("");
  });

  it("counts down and flags the last three hours and expiry", () => {
    const now = new Date("2026-10-05T00:00:00Z");
    expect(deadlineRemaining("2026-10-05T05:12:30Z", now)).toEqual({ expired: false, urgent: false, label: "5 h 12 min left" });
    expect(deadlineRemaining("2026-10-05T00:40:00Z", now)).toEqual({ expired: false, urgent: true, label: "40 min left" });
    expect(deadlineRemaining("2026-10-04T23:59:00Z", now)).toEqual({ expired: true, urgent: true, label: "Timed out" });
    expect(deadlineRemaining(undefined, now)).toBeNull();
  });
});

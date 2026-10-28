import { describe, expect, it } from "vitest";
import { wallDate, wallTime, wallWindowLabel } from "./slotWallClock";

describe("slot wall clock", () => {
  it("reads lab time from the server timestamp, not the browser zone", () => {
    expect(wallDate("2026-10-21T23:30:00+05:30")).toBe("2026-10-21");
    expect(wallTime("2026-10-21T23:30:00+05:30")).toBe("23:30");
  });

  it("keeps plain dates", () => {
    expect(wallDate("2026-10-21")).toBe("2026-10-21");
    expect(wallTime("2026-10-21")).toBe("");
  });

  it("labels same-day and multi-day windows", () => {
    expect(wallWindowLabel("2026-10-21T09:30:00+05:30", "2026-10-21T17:30:00+05:30")).toBe(
      "Wed, 21 Oct 2026, 09:30 – 17:30",
    );
    expect(wallWindowLabel("2026-10-21T09:30:00+05:30", "2026-10-22T12:00:00+05:30")).toBe(
      "Wed, 21 Oct 2026, 09:30 – Thu, 22 Oct 2026, 12:00",
    );
  });
});

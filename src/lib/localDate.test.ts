import { describe, expect, it } from "vitest";
import { localDateStamp, localDateTimeStamp } from "./localDate";

describe("localDate", () => {
  it("uses the local calendar day just after midnight", () => {
    const justAfterMidnight = new Date(2026, 9, 5, 0, 30);
    expect(localDateStamp(justAfterMidnight)).toBe("2026-10-05");
    expect(localDateTimeStamp(justAfterMidnight)).toBe("2026-10-05T00:30");
    if (justAfterMidnight.getTimezoneOffset() < 0) {
      // East of UTC (e.g. IST) the UTC date is still the previous day.
      expect(justAfterMidnight.toISOString().slice(0, 10)).toBe("2026-10-04");
    }
  });

  it("uses the local calendar day just before midnight", () => {
    const lateEvening = new Date(2026, 9, 5, 23, 45);
    expect(localDateStamp(lateEvening)).toBe("2026-10-05");
    expect(localDateTimeStamp(lateEvening)).toBe("2026-10-05T23:45");
  });
});

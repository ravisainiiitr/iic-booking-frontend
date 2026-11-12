import { describe, expect, it } from "vitest";
import { madeFilterLabel } from "./madeFilter";

describe("madeFilterLabel", () => {
  it("names the day the bookings were made", () => {
    expect(madeFilterLabel("2026-11-09", "2026-11-09", "2026-11-09")).toBe("Made today");
    expect(madeFilterLabel("2026-11-03", "2026-11-03", "2026-11-09")).toBe("Made on 3 Nov 2026");
    expect(madeFilterLabel("2026-11-01", "2026-11-09", "2026-11-09")).toBe("Made 1 Nov 2026 – 9 Nov 2026");
    expect(madeFilterLabel("2026-11-01", "", "2026-11-09")).toBe("Made since 1 Nov 2026");
  });
});

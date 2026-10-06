import { describe, expect, it } from "vitest";
import { dateFromIso, formatDMY, formatDMYTime, isoFromDate, maskDMY, parseDMY } from "./dateFormat";

describe("dateFormat", () => {
  it("formats ISO dates, Dates and empty values as DD-MM-YYYY", () => {
    expect(formatDMY("2026-10-06")).toBe("06-10-2026");
    expect(formatDMY("2026-10-06T09:30:00")).toBe("06-10-2026");
    expect(formatDMY(new Date(2026, 0, 2))).toBe("02-01-2026");
    expect(formatDMY("")).toBe("");
    expect(formatDMY(null)).toBe("");
    expect(formatDMY("not a date")).toBe("");
  });

  it("formats date and time in 24 h", () => {
    expect(formatDMYTime(new Date(2026, 9, 6, 14, 5))).toBe("06-10-2026 14:05");
    expect(formatDMYTime("")).toBe("");
  });

  it("parses typed DD-MM-YYYY with common separators and rejects impossible dates", () => {
    expect(parseDMY("06-10-2026")).toBe("2026-10-06");
    expect(parseDMY("6/10/2026")).toBe("2026-10-06");
    expect(parseDMY("06.10.2026")).toBe("2026-10-06");
    expect(parseDMY("2026-10-06")).toBe("2026-10-06");
    expect(parseDMY("31-02-2026")).toBeNull();
    expect(parseDMY("29-02-2028")).toBe("2028-02-29");
    expect(parseDMY("06-10")).toBeNull();
    expect(parseDMY("")).toBeNull();
  });

  it("inserts dashes while typing digits", () => {
    expect(maskDMY("06")).toBe("06");
    expect(maskDMY("0610")).toBe("06-10");
    expect(maskDMY("06102026")).toBe("06-10-2026");
    expect(maskDMY("06-102026")).toBe("06-10-2026");
    expect(maskDMY("06-10-2026")).toBe("06-10-2026");
  });

  it("round-trips local dates without time-zone shifts", () => {
    const d = dateFromIso("2026-03-29");
    expect(d?.getDate()).toBe(29);
    expect(isoFromDate(d as Date)).toBe("2026-03-29");
    expect(dateFromIso("2026-13-01")).toBeNull();
  });
});

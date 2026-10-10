import { describe, expect, it } from "vitest";
import { academicStartYear, academicYearLabel, academicYearOptions, labelFromSemester } from "@/lib/academicYears";

describe("academic years", () => {
  it("runs July to June", () => {
    expect(academicStartYear(new Date(2026, 5, 30))).toBe(2025);
    expect(academicStartYear(new Date(2026, 6, 1))).toBe(2026);
    expect(academicYearLabel(2026)).toBe("2026-27");
    expect(academicYearLabel(2099)).toBe("2099-00");
  });

  it("reads labels from semester codes and names", () => {
    expect(labelFromSemester({ id: 1, code: "AY-2025-26", name: "" })).toBe("2025-26");
    expect(labelFromSemester({ id: 1, code: "X", name: "2025-2026 Autumn" })).toBe("2025-26");
    expect(labelFromSemester({ id: 1, code: "X", name: "Autumn" })).toBeNull();
  });

  it("offers current and next year when there are no semesters at all", () => {
    const options = academicYearOptions(undefined, [], new Date(2026, 9, 10));
    expect(options.map((o) => o.label)).toEqual(["2026-27", "2027-28"]);
    expect(options[0]).toMatchObject({ is_current: true, semester_id: null, available: true });
  });

  it("maps existing semesters and keeps extra years", () => {
    const options = academicYearOptions(
      [],
      [
        { id: 3, code: "2026-27-ODD", name: "2026-27 Odd" },
        { id: 5, code: "2026-27-EVEN", name: "2026-27 Even" },
        { id: 2, code: "2025-26", name: "Old" },
      ],
      new Date(2026, 9, 10),
    );
    expect(options.map((o) => o.label)).toEqual(["2026-27", "2027-28", "2025-26"]);
    expect(options[0].semester_id).toBe(5);
  });

  it("prefers the server list", () => {
    const server = [
      { label: "2026-27", semester_id: 9, start_date: "2026-07-01", end_date: "2027-06-30", is_current: true, available: true },
    ];
    expect(academicYearOptions(server, [{ id: 1, code: "2020-21", name: "" }])).toBe(server);
  });
});

import { describe, expect, it, vi } from "vitest";
import {
  openRepeatSampleBooking,
  repeatChangesSummary,
  repeatInputPayload,
  repeatParamsEditable,
  repeatParamsLocked,
  repeatSampleBookPath,
} from "./repeatSample";

describe("repeat sample helpers", () => {
  it("opens the book-on-behalf page in repeat mode", () => {
    expect(repeatSampleBookPath(3, 501)).toBe("/book-equipment?equipment_id=3&mode=book&repeatOf=501");
  });

  it("never sends staff through the Book slots / Change slot status chooser", () => {
    const navigate = vi.fn();
    openRepeatSampleBooking(navigate, "/booking-management", 3, 501);
    expect(navigate.mock.calls).toEqual([
      ["/booking-management?expand=501", { replace: true }],
      ["/book-equipment?equipment_id=3&mode=book&repeatOf=501"],
    ]);
  });

  it("lets OIC / Admin edit a repeat's parameters but keeps a user's own repeat fixed", () => {
    const staff = { booked_by_staff: true };
    const self = { booked_by_staff: false };
    expect(repeatParamsEditable(staff)).toBe(true);
    expect(repeatParamsLocked(staff)).toBe(false);
    expect(repeatParamsEditable(self)).toBe(false);
    expect(repeatParamsLocked(self)).toBe(true);
    expect(repeatParamsLocked(null)).toBe(false);
    expect(repeatParamsEditable(null)).toBe(false);
  });

  it("always sends the sample sets, replacing any stale copy in the values", () => {
    expect(repeatInputPayload({ A: 2, _sample_sets: [{ A: 9 }] }, [])).toEqual({ A: 2, _sample_sets: [] });
    expect(repeatInputPayload({ A: 2 }, [{ A: 3 }])).toEqual({ A: 2, _sample_sets: [{ A: 3 }] });
  });

  it("summarises what changed from the original booking", () => {
    expect(
      repeatChangesSummary([
        { key: "A", label: "No. of Samples", old: "2", new: "3" },
        { key: "_sample_sets", label: "Sample sets", old: "1", new: "2" },
      ]),
    ).toBe("No. of Samples: 2 → 3; Sample sets: 1 → 2");
  });
});

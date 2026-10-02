import { describe, expect, it } from "vitest";

import {
  BOOKING_DRAFT_TTL_MS,
  bookingDraftAllowed,
  bookingDraftKey,
  clearBookingDraft,
  draftInputsForFields,
  draftMatchesDefaults,
  loadBookingDraft,
  saveBookingDraft,
} from "./bookingDraft";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

const content = {
  inputValues: { A: 3, B: "powder" },
  sampleSets: [{ A: 2 }],
  options: { auto_slot_selection: true, waitlist_on_failure: true },
};

describe("booking draft", () => {
  it("saves and restores per user and equipment", () => {
    const s = memoryStorage();
    saveBookingDraft(7, 42, content, 1_000, s);
    expect(s.map.has(bookingDraftKey(7, 42))).toBe(true);
    const d = loadBookingDraft(7, 42, 2_000, s);
    expect(d?.inputValues).toEqual({ A: 3, B: "powder" });
    expect(d?.sampleSets).toEqual([{ A: 2 }]);
    expect(d?.options.auto_slot_selection).toBe(true);
    expect(loadBookingDraft(7, 43, 2_000, s)).toBeNull();
    expect(loadBookingDraft(8, 42, 2_000, s)).toBeNull();
  });

  it("expires after 7 days and removes the stale entry", () => {
    const s = memoryStorage();
    saveBookingDraft(1, 1, content, 0, s);
    expect(loadBookingDraft(1, 1, BOOKING_DRAFT_TTL_MS - 1, s)).not.toBeNull();
    expect(loadBookingDraft(1, 1, BOOKING_DRAFT_TTL_MS + 1, s)).toBeNull();
    expect(s.map.size).toBe(0);
  });

  it("drops corrupt or other-version drafts", () => {
    const s = memoryStorage();
    s.setItem(bookingDraftKey(1, 1), "{not json");
    expect(loadBookingDraft(1, 1, 0, s)).toBeNull();
    s.setItem(bookingDraftKey(1, 1), JSON.stringify({ v: 99, savedAt: 0, inputValues: {}, sampleSets: [], options: {} }));
    expect(loadBookingDraft(1, 1, 0, s)).toBeNull();
    expect(s.map.size).toBe(0);
  });

  it("clears on success", () => {
    const s = memoryStorage();
    saveBookingDraft(1, 1, content, 0, s);
    clearBookingDraft(1, 1, s);
    expect(loadBookingDraft(1, 1, 0, s)).toBeNull();
  });

  it("treats an untouched form as nothing to save", () => {
    expect(draftMatchesDefaults({ inputValues: { B: "x", A: 1 }, sampleSets: [] }, { A: 1, B: "x" })).toBe(true);
    expect(draftMatchesDefaults({ inputValues: { A: 2, B: "x" }, sampleSets: [] }, { A: 1, B: "x" })).toBe(false);
    expect(draftMatchesDefaults({ inputValues: { A: 1 }, sampleSets: [{ A: 1 }] }, { A: 1 })).toBe(false);
  });

  it("restores only fields the equipment still has", () => {
    expect(
      draftInputsForFields({ inputValues: { A: 1, OLD: 2, P: "Fe", P_elements: "Fe,Cu" } }, ["A", "P"]),
    ).toEqual({ A: 1, P: "Fe", P_elements: "Fe,Cu" });
  });

  it("is skipped when the form is prefilled from elsewhere or booked for someone else", () => {
    const base = { bookingForAnotherUser: false, staff: false };
    expect(bookingDraftAllowed(new URLSearchParams("equipment_id=5"), base)).toBe(true);
    expect(bookingDraftAllowed(new URLSearchParams("equipment_id=5&mode=book"), base)).toBe(true);
    for (const q of ["template=3", "repeatOf=9", "rebookOf=9", "alt_from=2", "from=assistant", "date=2026-10-08", "proforma=1", "urgent=1", "rush_relief=1", "mode=calculate", "mode=template"]) {
      expect(bookingDraftAllowed(new URLSearchParams(`equipment_id=5&${q}`), base)).toBe(false);
    }
    expect(bookingDraftAllowed(new URLSearchParams("equipment_id=5"), { ...base, staff: true })).toBe(false);
    expect(bookingDraftAllowed(new URLSearchParams("equipment_id=5"), { ...base, bookingForAnotherUser: true })).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  fallbackForMode,
  flagsForFallback,
  modeForFallback,
  normaliseTemplateSlotOptions,
  slotChoiceFrom,
  slotFallbackFrom,
  slotFallbackSummary,
} from "./slotOptions";
import { templateSlotSummary } from "./bookingTemplates";

const PREF = { weekday: 3, start_time: "09:00", slot_count: 2 };

describe("slotOptions", () => {
  it("derives one fallback; 'any free slots' wins over a template's preferred-slot fallback, as on the server", () => {
    expect(slotFallbackFrom({ bookAny: false, single: false })).toBe("none");
    expect(slotFallbackFrom({ bookAny: false, single: true })).toBe("none");
    expect(slotFallbackFrom({ bookAny: true, single: false })).toBe("any_slots");
    expect(slotFallbackFrom({ bookAny: true, single: true })).toBe("any_slots_or_one");
    expect(slotFallbackFrom({ bookAny: false, single: false, templateMode: "next_available_any" })).toBe("any_day");
    expect(slotFallbackFrom({ bookAny: true, single: false, templateMode: "next_available_same_day" })).toBe("any_slots");
  });

  it("round-trips fallbacks to flags and template modes", () => {
    expect(flagsForFallback("any_slots_or_one")).toEqual({ bookAny: true, single: true });
    expect(flagsForFallback("same_day")).toEqual({ bookAny: false, single: false });
    expect(modeForFallback("same_day")).toBe("next_available_same_day");
    expect(modeForFallback("any_slots")).toBe("ask");
    expect(fallbackForMode("next_available_any")).toBe("any_day");
    expect(fallbackForMode("ask")).toBe("none");
  });

  it("picks one way to choose slots; the preferred slot wins over auto-select", () => {
    expect(slotChoiceFrom({ preferred: true, auto: true })).toBe("preferred");
    expect(slotChoiceFrom({ preferred: false, auto: true })).toBe("auto");
    expect(slotChoiceFrom({ preferred: false, auto: false })).toBe("manual");
  });

  it("normalises legacy templates saved with contradictory options", () => {
    const legacy = normaliseTemplateSlotOptions({
      options: { auto_slot_selection: true, book_any_available_slots: true, book_even_if_single_slot_available: true, waitlist_on_failure: true },
      preferred_slot: PREF,
      if_slot_taken: "next_available_same_day",
    });
    expect(legacy.options).toEqual({
      auto_slot_selection: false,
      book_any_available_slots: true,
      book_even_if_single_slot_available: true,
      waitlist_on_failure: true,
    });
    expect(legacy.ifSlotTaken).toBe("ask");

    const single = normaliseTemplateSlotOptions({ options: { book_even_if_single_slot_available: true }, preferred_slot: null });
    expect(single.options.book_even_if_single_slot_available).toBe(false);
    expect(single.ifSlotTaken).toBe("ask");

    const kept = normaliseTemplateSlotOptions({ options: {}, preferred_slot: PREF, if_slot_taken: "next_available_any" });
    expect(kept.ifSlotTaken).toBe("next_available_any");
  });

  it("summarises a template's slot choice and fallback for cards", () => {
    expect(
      templateSlotSummary({ options: { auto_slot_selection: true }, preferred_slot: null, if_slot_taken: "ask", if_slot_taken_consented_at: null }),
    ).toMatchObject({ choice: "Auto-select slots", fallback: "none", autoBooks: false });
    expect(
      templateSlotSummary({
        options: {},
        preferred_slot: PREF,
        if_slot_taken: "next_available_same_day",
        if_slot_taken_consented_at: "2026-10-01T10:00:00+05:30",
      }),
    ).toMatchObject({ choice: null, fallback: "same_day", autoBooks: true });
    expect(slotFallbackSummary("any_slots")).toBe("If taken: any free slots this week");
    expect(slotFallbackSummary("none")).toBe("If taken: you choose again");
  });
});

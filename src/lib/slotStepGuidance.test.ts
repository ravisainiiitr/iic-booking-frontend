import { describe, expect, it } from "vitest";
import { formatSlotMinutes, slotStepGuidance } from "./slotStepGuidance";

describe("formatSlotMinutes", () => {
  it("formats minutes and hours", () => {
    expect(formatSlotMinutes(30)).toBe("30 min");
    expect(formatSlotMinutes(60)).toBe("1 h");
    expect(formatSlotMinutes(90)).toBe("1 h 30 min");
  });
});

describe("slotStepGuidance", () => {
  it("tells a manual picker how many slots they need and that one click selects them all", () => {
    expect(slotStepGuidance({ slotCount: 3, requiredMinutes: 90, choice: "manual", selectedCount: 0 })).toBe(
      "You need 3 slots (1 h 30 min). Click a green Available slot to start — we'll select 3 back-to-back slots from there.",
    );
    expect(slotStepGuidance({ slotCount: 1, requiredMinutes: 20, choice: "manual", selectedCount: 0 })).toBe(
      "You need 1 slot (20 min). Click a green Available slot to select it.",
    );
  });

  it("follows the selection", () => {
    expect(slotStepGuidance({ slotCount: 3, requiredMinutes: 90, choice: "manual", selectedCount: 2 })).toBe(
      "2 of 3 slots selected. Click a green slot next to your selection to add the rest.",
    );
    expect(slotStepGuidance({ slotCount: 3, requiredMinutes: 90, choice: "manual", selectedCount: 3 })).toBe(
      "All 3 slots selected. Check the time below, then confirm.",
    );
    expect(slotStepGuidance({ slotCount: 3, requiredMinutes: 90, choice: "auto", selectedCount: 3 })).toContain(
      "We selected 3 slots for you",
    );
  });

  it("stays quiet when the count is unknown or a preferred slot is used", () => {
    expect(slotStepGuidance({ slotCount: 0, requiredMinutes: 90, choice: "manual", selectedCount: 0 })).toBeNull();
    expect(slotStepGuidance({ slotCount: 2, requiredMinutes: 60, choice: "preferred", selectedCount: 0 })).toBeNull();
  });
});

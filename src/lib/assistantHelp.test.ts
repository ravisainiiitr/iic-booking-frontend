// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ASSISTANT_OFFER_HELP_EVENT,
  classifyBookingFailure,
  helpAction,
  helpPromptText,
  helpUtterance,
  normalizeHelpCode,
  offerAssistantHelp,
  offerAssistantHelpForError,
  type AssistantHelpDetail,
} from "./assistantHelp";

describe("classifyBookingFailure", () => {
  it.each([
    ["The selected slot is no longer available. Please select another available slot.", "slot_taken"],
    ["Slot not available", "slot_taken"],
    ["No available slots for the selected date.", "no_slots"],
    [
      "Individual Weekly quota exceeded: current usage 240 min + requested 120 min = 360 min; configured limit 300 min; remaining before this request 60 min.",
      "quota_exceeded",
    ],
    ["You don't have access to any wallet. Please link to your supervisor's wallet.", "no_wallet"],
    ["Insufficient wallet balance for this booking.", "insufficient_funds"],
    ["Charge calculation failed", "charge_error"],
    ["Something unexpected", "booking_failed"],
    ["", "booking_failed"],
  ])("%s -> %s", (message, code) => {
    expect(classifyBookingFailure(message)).toBe(code);
  });
});

describe("normalizeHelpCode", () => {
  it("accepts the booking page's own failure kinds", () => {
    expect(normalizeHelpCode("quota")).toBe("quota_exceeded");
    expect(normalizeHelpCode("waitlist_full")).toBe("no_slots");
    expect(normalizeHelpCode("other")).toBe("booking_failed");
    expect(normalizeHelpCode("slot_taken")).toBe("slot_taken");
    expect(normalizeHelpCode("nonsense")).toBe("booking_failed");
  });
});

describe("helpAction", () => {
  it("builds the ba_help payload the backend schema accepts", () => {
    const detail: AssistantHelpDetail = {
      code: "charge_error",
      equipmentId: 12,
      equipmentName: "XRD",
      message: "  Charge \n calculation   failed ",
      missingFields: ["Sample type", "", "No. of samples"],
      date: "2026-10-09",
    };
    expect(helpAction(detail)).toEqual({
      type: "ba_help",
      payload: {
        code: "charge_error",
        equipment_id: 12,
        message: "Charge calculation failed",
        missing_fields: ["Sample type", "No. of samples"],
        date: "2026-10-09",
      },
    });
  });

  it("drops invalid values and truncates long ones", () => {
    const out = helpAction({
      code: "booking_failed",
      equipmentId: Number.NaN,
      message: "x".repeat(600),
      missingFields: Array.from({ length: 20 }, (_, i) => `Field ${i} ${"y".repeat(100)}`),
      date: "tomorrow",
    });
    expect(out.payload.equipment_id).toBeUndefined();
    expect(out.payload.date).toBeUndefined();
    expect(String(out.payload.message)).toHaveLength(400);
    const fields = out.payload.missing_fields as string[];
    expect(fields).toHaveLength(12);
    expect(fields.every((f) => f.length <= 80)).toBe(true);
  });
});

describe("prompt and utterance text", () => {
  it("is specific to the failure", () => {
    expect(helpPromptText("slot_taken")).toMatch(/another free slot/);
    expect(helpPromptText("quota_exceeded")).toMatch(/resets/);
    expect(helpPromptText("no_wallet")).toMatch(/supervisor's wallet/);
    expect(helpUtterance({ code: "slot_taken", equipmentName: "FESEM" })).toBe(
      "That slot was taken — help me find another one. (FESEM)",
    );
  });
});

describe("offerAssistantHelp", () => {
  afterEach(() => vi.restoreAllMocks());

  it("dispatches the window event with a normalized code", () => {
    const seen: AssistantHelpDetail[] = [];
    const onEvent = (e: Event) => seen.push((e as CustomEvent<AssistantHelpDetail>).detail);
    window.addEventListener(ASSISTANT_OFFER_HELP_EVENT, onEvent);
    offerAssistantHelp({ code: "quota", equipmentId: 3 });
    offerAssistantHelpForError("The selected slot is no longer available.", { equipmentId: 4, equipmentName: "TEM" });
    window.removeEventListener(ASSISTANT_OFFER_HELP_EVENT, onEvent);
    expect(seen).toEqual([
      { code: "quota_exceeded", equipmentId: 3 },
      { code: "slot_taken", equipmentId: 4, equipmentName: "TEM", message: "The selected slot is no longer available." },
    ]);
  });
});

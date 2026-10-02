import { describe, expect, it } from "vitest";

import { friendlyChargeError } from "./chargeErrorText";
import { isRequiredValueMissing, missingFieldsSentence, missingRequiredFields } from "./missingFieldsHint";
import { isWaitlistedResponse, waitlistPositionFrom, waitlistQueueMessage } from "./waitlistMessage";

describe("missing required fields hint", () => {
  const fields = [
    { field_key: "A", field_label: "Number of samples", is_required: true },
    { field_key: "B", field_label: "Sample type", is_required: true },
    { field_key: "C", field_label: "Notes", is_required: false },
    { field_key: "D", field_label: "Hidden", is_required: true },
  ];

  it("lists only empty required fields, skipping hidden ones", () => {
    expect(missingRequiredFields(fields, { A: 0, B: "", C: "" }, new Set(["D"]))).toEqual([
      { key: "A", label: "Number of samples" },
      { key: "B", label: "Sample type" },
    ]);
    expect(missingRequiredFields(fields, { A: 2, B: "powder", D: "x" })).toEqual([]);
  });

  it("uses the same emptiness rule as the charge calculation", () => {
    expect(isRequiredValueMissing(0)).toBe(true);
    expect(isRequiredValueMissing([])).toBe(true);
    expect(isRequiredValueMissing(false)).toBe(false);
    expect(isRequiredValueMissing("0")).toBe(false);
  });

  it("builds a readable sentence", () => {
    expect(missingFieldsSentence([])).toBe("");
    expect(missingFieldsSentence(["Number of samples"])).toBe("Fill in Number of samples to see charges and available slots.");
    expect(missingFieldsSentence(["A", "B", "C"])).toBe("Fill in A, B and C to see charges and available slots.");
  });
});

describe("charge calculation errors in plain language", () => {
  it("explains a missing charge profile without jargon", () => {
    const e = friendlyChargeError("No active charge profile found for equipment 12 and user type student.");
    expect(e.kind).toBe("no_profile");
    expect(e.title).not.toMatch(/coming soon/i);
    expect(e.detail).toMatch(/Officer in Charge/);
    expect(e.detail).not.toMatch(/profile found/);
  });

  it("explains calculation failures from bad values", () => {
    expect(friendlyChargeError("Error calculating time: division by zero").kind).toBe("values");
    expect(friendlyChargeError("Error calculating charge: x").detail).not.toMatch(/division/);
  });

  it("treats connection problems as retryable", () => {
    const e = friendlyChargeError("Failed to fetch");
    expect(e.kind).toBe("network");
    expect(e.retryable).toBe(true);
    expect(friendlyChargeError(undefined, { network: true }).kind).toBe("network");
  });

  it("passes through messages that are already plain", () => {
    expect(friendlyChargeError("Number of samples cannot exceed 10.").detail).toBe("Number of samples cannot exceed 10.");
    expect(friendlyChargeError("").title).toBe("Charges couldn't be calculated");
  });
});

describe("waitlist message", () => {
  it("reads the queue position from the response", () => {
    expect(waitlistPositionFrom({ waitlist_position: 3 })).toBe(3);
    expect(waitlistPositionFrom({ waitlist_code: "WL4" })).toBe(4);
    expect(waitlistPositionFrom({ error: "Booking Waitlisted. Current position in queue: WL7." })).toBe(7);
    expect(waitlistPositionFrom({ error: "Slots are not available" })).toBeNull();
  });

  it("is friendly and neutral", () => {
    expect(waitlistQueueMessage(2)).toBe("You're #2 in the queue — we'll notify you if a slot frees up.");
    expect(waitlistQueueMessage(null)).toBe("You're in the queue — we'll notify you if a slot frees up.");
    expect(isWaitlistedResponse({ error: "Booking Waitlisted." })).toBe(true);
    expect(isWaitlistedResponse({ error: "Booking unsuccessful. All slots are occupied." })).toBe(false);
  });
});

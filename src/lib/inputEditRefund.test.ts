import { describe, expect, it } from "vitest";
import {
  formatRefundDeadline,
  inputEditRefundNotice,
  inputEditSavedMessage,
  isInstantRefundOpen,
} from "./inputEditRefund";

const DEADLINE = "2026-10-05T04:30:00Z";
const BEFORE = Date.parse("2026-10-04T04:30:00Z");
const AFTER = Date.parse("2026-10-05T04:31:00Z");

describe("isInstantRefundOpen", () => {
  it("follows the deadline when there is one", () => {
    expect(isInstantRefundOpen({ deadline: DEADLINE, instantOpen: false }, BEFORE)).toBe(true);
    expect(isInstantRefundOpen({ deadline: DEADLINE, instantOpen: true }, AFTER)).toBe(false);
    expect(isInstantRefundOpen({ deadline: DEADLINE }, Date.parse(DEADLINE))).toBe(true);
  });

  it("falls back to the server flag without a deadline", () => {
    expect(isInstantRefundOpen({ deadline: null, instantOpen: true })).toBe(true);
    expect(isInstantRefundOpen({ deadline: null, instantOpen: false })).toBe(false);
    expect(isInstantRefundOpen({})).toBe(false);
  });
});

describe("inputEditRefundNotice", () => {
  it("tells the booking user the refund is instant before the deadline and shows it", () => {
    const text = inputEditRefundNotice({ deadline: DEADLINE }, "owner", BEFORE);
    expect(text).toContain("refunded to your wallet straight away");
    expect(text).toContain(formatRefundDeadline(DEADLINE));
    expect(text).toContain("Officer In Charge's approval");
  });

  it("tells the booking user approval is needed after the deadline", () => {
    const text = inputEditRefundNotice({ deadline: DEADLINE }, "owner", AFTER);
    expect(text).toContain("has passed");
    expect(text).toContain("after the Officer In Charge approves");
    expect(text).not.toContain("straight away");
  });

  it("covers bookings without a deadline", () => {
    expect(inputEditRefundNotice({ instantOpen: true }, "owner")).toBe(
      "If the new charge is lower, the difference is refunded to your wallet straight away."
    );
    expect(inputEditRefundNotice({ instantOpen: false }, "owner")).toContain("after the Officer In Charge approves");
  });

  it("explains the staff side", () => {
    expect(inputEditRefundNotice({ deadline: DEADLINE }, "oic", BEFORE)).toContain("Confirm refund");
    expect(inputEditRefundNotice({ deadline: DEADLINE }, "staff", BEFORE)).toContain("user's wallet");
  });
});

describe("inputEditSavedMessage", () => {
  it("says whether the refund was done or is waiting", () => {
    expect(inputEditSavedMessage({ refund_amount: "120.00", refund_status: "refunded" }, "owner")).toBe(
      "Your changes are saved. The new charge is lower, so ₹120 has been refunded to your wallet."
    );
    expect(
      inputEditSavedMessage({ refund_amount: "120", refund_status: "awaiting_oic_confirmation" }, "owner")
    ).toContain("after the Officer In Charge approves it");
    expect(
      inputEditSavedMessage({ refund_amount: "120", refund_status: "awaiting_oic_confirmation" }, "oic")
    ).toContain("Confirm refund");
  });

  it("returns null when there is no refund", () => {
    expect(inputEditSavedMessage({ refund_amount: null, refund_status: null }, "owner")).toBeNull();
    expect(inputEditSavedMessage(undefined, "owner")).toBeNull();
  });
});

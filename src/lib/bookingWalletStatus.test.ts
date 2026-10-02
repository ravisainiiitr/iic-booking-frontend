import { describe, expect, it } from "vitest";

import { bookingWalletStatus, insufficientFundsMessage } from "./bookingWalletStatus";

const base = {
  balance: "500.00",
  has_wallet: true,
  department_id: 3,
  department_name: "Physics",
  is_zero: false,
  needs_wallet_link: false,
  pending_link_request: false,
  spendable: "500.00",
  booking_block_message: null,
  pays_remainder_separately: false,
};

describe("bookingWalletStatus", () => {
  it("asks a student without a supervisor wallet to link one (not to recharge)", () => {
    const s = bookingWalletStatus({ ...base, has_wallet: false, is_zero: true, balance: "0.00", spendable: "0.00", needs_wallet_link: true }, null);
    expect(s.kind).toBe("needs_link");
  });

  it("says the link request is pending", () => {
    const s = bookingWalletStatus(
      { ...base, has_wallet: false, needs_wallet_link: true, pending_link_request: true, pending_link_supervisor_name: "Dr. Rao" },
      100,
    );
    expect(s).toEqual({ kind: "link_pending", supervisorName: "Dr. Rao" });
  });

  it("flags a charge above the spendable balance", () => {
    const s = bookingWalletStatus({ ...base, spendable: "300.00" }, 450);
    expect(s).toEqual({ kind: "insufficient", spendable: 300, charge: 450, shortfall: 150 });
    if (s.kind === "insufficient") {
      expect(insufficientFundsMessage(s)).toContain("₹150.00");
    }
  });

  it("is fine when the balance covers the charge", () => {
    expect(bookingWalletStatus(base, 500).kind).toBe("ok");
    expect(bookingWalletStatus(base, 499.99).kind).toBe("ok");
  });

  it("never blocks external users, who pay any remainder at checkout", () => {
    expect(bookingWalletStatus({ ...base, spendable: "0.00", pays_remainder_separately: true }, 1000).kind).toBe("ok");
  });

  it("shows a wallet hold message", () => {
    expect(bookingWalletStatus({ ...base, booking_block_message: "Credit hold expired" }, 10)).toEqual({
      kind: "blocked",
      message: "Credit hold expired",
    });
  });

  it("falls back to the zero-balance hint before charges are known", () => {
    expect(bookingWalletStatus({ ...base, balance: "0.00", spendable: "0.00", is_zero: true }, null).kind).toBe("zero_balance");
    expect(bookingWalletStatus(null, 10).kind).toBe("unknown");
  });

  it("works with older backends that lack the new fields", () => {
    expect(bookingWalletStatus({ balance: "50", has_wallet: true, department_id: 1, is_zero: false }, 80).kind).toBe("insufficient");
  });
});

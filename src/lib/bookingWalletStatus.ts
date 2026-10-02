/** What the booking page should say about the wallet before the user fills in the form or confirms. */

import { formatINRAmount } from "@/lib/money";

export type EquipmentWalletBalance = {
  balance: string;
  has_wallet: boolean;
  department_id: number | null;
  department_name?: string;
  department_code?: string | null;
  is_zero: boolean;
  needs_wallet_link?: boolean;
  pending_link_request?: boolean;
  pending_link_supervisor_name?: string | null;
  spendable?: string;
  booking_block_message?: string | null;
  pays_remainder_separately?: boolean;
};

export type BookingWalletStatus =
  | { kind: "unknown" }
  | { kind: "needs_link" }
  | { kind: "link_pending"; supervisorName: string | null }
  | { kind: "blocked"; message: string }
  | { kind: "zero_balance"; departmentName: string }
  | { kind: "insufficient"; spendable: number; charge: number; shortfall: number }
  | { kind: "ok" };

function money(value: string | number | null | undefined): number | null {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * @param charge amount this booking will debit (after rewards); null until charges are calculated
 */
export function bookingWalletStatus(wallet: EquipmentWalletBalance | null | undefined, charge: number | null | undefined): BookingWalletStatus {
  if (!wallet) return { kind: "unknown" };
  if (wallet.needs_wallet_link) {
    return wallet.pending_link_request
      ? { kind: "link_pending", supervisorName: wallet.pending_link_supervisor_name ?? null }
      : { kind: "needs_link" };
  }
  // External users pay any shortfall at checkout, so a low wallet is never a blocker for them.
  if (wallet.pays_remainder_separately) return { kind: "ok" };
  if (wallet.booking_block_message) return { kind: "blocked", message: wallet.booking_block_message };

  const spendable = money(wallet.spendable) ?? money(wallet.balance) ?? 0;
  const due = money(charge ?? null);
  if (due != null && due > 0) {
    if (due > spendable + 0.005) {
      return { kind: "insufficient", spendable, charge: due, shortfall: Math.round((due - spendable) * 100) / 100 };
    }
    return { kind: "ok" };
  }
  if (wallet.has_wallet && wallet.is_zero && spendable <= 0) {
    return { kind: "zero_balance", departmentName: wallet.department_name || "this department" };
  }
  return { kind: "ok" };
}

export function insufficientFundsMessage(s: Extract<BookingWalletStatus, { kind: "insufficient" }>): string {
  return `This booking costs ${formatINRAmount(s.charge)} but your wallet can cover ${formatINRAmount(s.spendable)}. Recharge at least ${formatINRAmount(s.shortfall)} before you confirm, or the booking will fail.`;
}

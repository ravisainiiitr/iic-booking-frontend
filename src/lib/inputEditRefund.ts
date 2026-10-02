import { formatINR } from "@/lib/money";

/**
 * How a lower charge after "Edit User Inputs" is refunded.
 *
 * The booking user's own edit saved before the cancellation deadline (the same deadline as for
 * cancelling or rescheduling) is refunded to the wallet at once; later edits and edits by lab staff
 * wait for the Officer In Charge's approval (Confirm refund).
 */

/** Who is editing: the booking user, the Officer In Charge / admin, or other lab staff. */
export type InputEditRefundViewer = "owner" | "oic" | "staff";

export interface InputEditRefundWindow {
  /** ISO time of the cancellation deadline (booking field input_edit_refund_deadline). */
  deadline?: string | null;
  /** Server's view when the booking was loaded (booking field input_edit_instant_refund_open). */
  instantOpen?: boolean | null;
}

export interface InputEditChargeSummary {
  refund_amount?: string | null;
  refund_status?: "refunded" | "awaiting_oic_confirmation" | null;
}

export function formatRefundDeadline(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function isInstantRefundOpen(win: InputEditRefundWindow, now: number = Date.now()): boolean {
  if (win.deadline) {
    const t = Date.parse(win.deadline);
    if (!Number.isNaN(t)) return now <= t;
  }
  return Boolean(win.instantOpen);
}

/** Plain-language note shown in the edit dialog before saving. */
export function inputEditRefundNotice(
  win: InputEditRefundWindow,
  viewer: InputEditRefundViewer,
  now: number = Date.now()
): string {
  if (viewer === "oic") {
    return "If the new charge is lower, the difference is not refunded automatically. Use Confirm refund on the booking to credit it to the user's wallet.";
  }
  if (viewer === "staff") {
    return "If the new charge is lower, the difference reaches the user's wallet after the Officer In Charge approves the refund.";
  }
  const deadlineText = win.deadline ? formatRefundDeadline(win.deadline) : "";
  if (isInstantRefundOpen(win, now)) {
    if (deadlineText) {
      return `If the new charge is lower, the difference is refunded to your wallet straight away, because you are editing before the cancellation deadline (${deadlineText}). After that deadline, a refund needs the Officer In Charge's approval.`;
    }
    return "If the new charge is lower, the difference is refunded to your wallet straight away.";
  }
  if (deadlineText) {
    return `The cancellation deadline (${deadlineText}) has passed. If the new charge is lower, the difference reaches your wallet after the Officer In Charge approves the refund.`;
  }
  return "If the new charge is lower, the difference reaches your wallet after the Officer In Charge approves the refund.";
}

/** Success message after saving an edit; null when the charge did not go down. */
export function inputEditSavedMessage(
  summary: InputEditChargeSummary | null | undefined,
  viewer: InputEditRefundViewer
): string | null {
  if (!summary?.refund_amount || !summary.refund_status) return null;
  const amount = formatINR(summary.refund_amount);
  if (summary.refund_status === "refunded") {
    return `Your changes are saved. The new charge is lower, so ${amount} has been refunded to your wallet.`;
  }
  if (viewer === "oic") {
    return `Changes saved. The new charge is ${amount} lower. Use Confirm refund to credit it to the user's wallet.`;
  }
  if (viewer === "staff") {
    return `Changes saved. The new charge is ${amount} lower; the refund reaches the user's wallet after the Officer In Charge approves it.`;
  }
  return `Your changes are saved. The new charge is lower; the refund of ${amount} reaches your wallet after the Officer In Charge approves it.`;
}

/** Why a booking-grid slot can't be picked, and how it is announced to screen readers. */

export type SlotReasonInput = {
  slotExists: boolean;
  isDisabled: boolean;
  isSelected: boolean;
  isPast: boolean;
  considerBooked: boolean;
  holidayName?: string;
  isSaturdayCol: boolean;
  isSundayCol: boolean;
  slotStatusUpper: string;
  slotStatusLabel: string;
  blockedLabel?: string | null;
  bookingId?: number | string | null;
  deptBlockedForUser: boolean;
  statusDisplay?: string | null;
  notConsecutive: boolean;
  limitReached: boolean;
  wouldExceedLimit: boolean;
  chargeNotCalculated: boolean;
  isAdminOrOic: boolean;
  /** Was in the user's selection but someone else booked it first. */
  justTaken?: boolean;
  /** Over the weekly / monthly booking quota; carries the explanation to show. */
  overQuotaReason?: string | null;
  /** Wallet must be linked before any slot can be booked. */
  walletLinkRequired?: boolean;
};

export function unavailableBookingSlotReason(opts: SlotReasonInput): string | null {
  const {
    slotExists,
    isDisabled,
    isSelected,
    isPast,
    considerBooked,
    holidayName,
    isSaturdayCol,
    isSundayCol,
    slotStatusUpper,
    slotStatusLabel,
    blockedLabel,
    bookingId,
    deptBlockedForUser,
    statusDisplay,
    notConsecutive,
    limitReached,
    wouldExceedLimit,
    chargeNotCalculated,
    isAdminOrOic,
  } = opts;
  if (!isDisabled || isSelected) return null;
  if (!slotExists) {
    if (holidayName) return `Holiday (${holidayName}). This day has no bookable slots.`;
    if (isSaturdayCol) return "Saturday — no booking slots on this day.";
    if (isSundayCol) return "Sunday — no booking slots on this day.";
    return "There is no booking slot at this time.";
  }
  if (holidayName && slotStatusUpper === "NOT_AVAILABLE") {
    return `Holiday (${holidayName}). This slot is not available for booking.`;
  }
  if (isPast && !isAdminOrOic) {
    return "This time has already passed.";
  }
  if (opts.justTaken && considerBooked) {
    return "Someone else booked this slot just before you. Please pick another one.";
  }
  if (considerBooked) {
    return bookingId ? `Already booked (#${bookingId}).` : "Already booked by someone else.";
  }
  if (deptBlockedForUser) {
    return statusDisplay || "This slot is reserved for another department.";
  }
  if (slotStatusUpper === "BLOCKED") {
    return blockedLabel ? `Blocked: ${blockedLabel}` : "Blocked by the lab — not open for booking.";
  }
  if (slotStatusUpper === "UNDER_MAINTENANCE") {
    return "The equipment is under maintenance at this time.";
  }
  if (slotStatusUpper === "OPERATOR_ABSENT") {
    return "The operator is not available at this time.";
  }
  if (slotStatusUpper === "NOT_AVAILABLE") {
    if (isSaturdayCol || isSundayCol) return "Weekend — this slot is not available for booking.";
    return slotStatusLabel || "Not open for booking.";
  }
  if (opts.walletLinkRequired) {
    return "Link your supervisor's wallet first — then you can pick slots.";
  }
  if (chargeNotCalculated) {
    return "Fill in Step 1 first so we know how much time you need.";
  }
  if (opts.overQuotaReason) {
    return opts.overQuotaReason;
  }
  if (notConsecutive) {
    return "Slots must be back-to-back: pick one right before or after your current selection.";
  }
  if (limitReached || wouldExceedLimit) {
    return "You've already selected enough time for this booking. Clear a slot to choose a different one.";
  }
  if (slotStatusUpper && slotStatusUpper !== "AVAILABLE") {
    return slotStatusLabel || `Not bookable (${slotStatusUpper.replace(/_/g, " ").toLowerCase()}).`;
  }
  return "This slot is not available for booking.";
}

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Wed 8 Oct, 10:00–11:30, available" */
export function slotAccessibleLabel(opts: {
  date: Date;
  start: string;
  end?: string | null;
  state: "available" | "selected" | "unavailable";
  shortReason?: string | null;
}): string {
  const d = opts.date;
  const day = `${DAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
  const time = opts.end ? `${opts.start}–${opts.end}` : opts.start;
  const state =
    opts.state === "unavailable" && opts.shortReason
      ? `unavailable: ${opts.shortReason}`
      : opts.state;
  return `${day}, ${time}, ${state}`;
}

/** A few words for the aria-label; the full sentence goes in the popover. */
export function shortSlotReason(reason: string | null | undefined): string | null {
  if (!reason) return null;
  const r = reason.toLowerCase();
  if (r.startsWith("someone else booked")) return "just taken";
  if (r.startsWith("already booked")) return "booked";
  if (r.includes("holiday")) return "holiday";
  if (r.includes("weekend") || r.startsWith("saturday") || r.startsWith("sunday")) return "weekend";
  if (r.includes("maintenance")) return "maintenance";
  if (r.includes("operator")) return "operator away";
  if (r.includes("already passed")) return "in the past";
  if (r.includes("another department")) return "reserved";
  if (r.startsWith("blocked")) return "blocked";
  if (r.includes("min left") || r.includes("booking time for this")) return "over your quota";
  if (r.includes("back-to-back")) return "not next to your selection";
  if (r.includes("enough time")) return "enough time selected";
  if (r.includes("step 1")) return "fill in step 1 first";
  if (r.includes("wallet")) return "link wallet first";
  return "not available";
}

export interface BookingStatusLegendEntry {
  status: string;
  /** Matches the backend `status_display` shown on the badge. */
  label: string;
  meaning: string;
  badgeClass: string;
}

const BLUE = "border-transparent bg-blue-600 text-white hover:bg-blue-600";
const GREEN = "border-transparent bg-green-700 text-white hover:bg-green-700";
const RED = "border-transparent bg-red-600 text-white hover:bg-red-600";

/**
 * Badge colours keyed by booking status. Class names must stay literal so Tailwind can find them.
 * Every entry pairs a background with an explicit text colour of at least 4.5:1 contrast in light
 * and dark mode; never use white text on yellow/amber-400/500.
 */
const STATUS_BADGE_CLASSES: Record<string, string> = {
  PENDING:
    "border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-100 dark:hover:bg-amber-900/40",
  PENDING_PAYMENT:
    "border-orange-300 bg-orange-100 text-orange-900 hover:bg-orange-100 dark:border-orange-700 dark:bg-orange-900/40 dark:text-orange-100 dark:hover:bg-orange-900/40",
  WAITLISTED:
    "border-sky-300 bg-sky-100 text-sky-900 hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-900/40 dark:text-sky-100 dark:hover:bg-sky-900/40",
  HOLD:
    "border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-800",
  UNDER_MAINTENANCE:
    "border-yellow-300 bg-yellow-100 text-yellow-900 hover:bg-yellow-100 dark:border-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-100 dark:hover:bg-yellow-900/40",
  OTHER_DISRUPTION:
    "border-rose-300 bg-rose-100 text-rose-900 hover:bg-rose-100 dark:border-rose-700 dark:bg-rose-900/40 dark:text-rose-100 dark:hover:bg-rose-900/40",
  BOOKED: BLUE,
  CONFIRMED: BLUE,
  APPROVED: BLUE,
  DISRUPTION_PENDING: "border-transparent bg-amber-700 text-white hover:bg-amber-700",
  FABRICATION_REJECTED: "border-transparent bg-rose-700 text-white hover:bg-rose-700",
  PROCESSING: "border-transparent bg-indigo-600 text-white hover:bg-indigo-600",
  IN_PROGRESS: GREEN,
  COMPLETED: GREEN,
  CANCELLED: RED,
  REJECTED: RED,
  ABSENT: "border-transparent bg-orange-700 text-white hover:bg-orange-700",
  REFUNDED: "border-transparent bg-purple-600 text-white hover:bg-purple-600",
  BOOKING_NOT_UTILIZED: "border-transparent bg-stone-600 text-white hover:bg-stone-600",
};

const DEFAULT_BADGE_CLASS = "border-transparent bg-gray-600 text-white hover:bg-gray-600";

export function bookingStatusBadgeClass(status: string | null | undefined): string {
  return STATUS_BADGE_CLASSES[String(status || "").toUpperCase()] ?? DEFAULT_BADGE_CLASS;
}

/** Status key for the badge colour: a 3D print / laser booking rejected by the lab stays Booked but shows as rejected. */
export function bookingBadgeStatus(booking: {
  status?: string | null;
  fabrication_rejected_at?: string | null;
  fabrication_workflow?: { rejected?: boolean } | null;
}): string {
  const status = String(booking.status || "").toUpperCase();
  const rejected = !!booking.fabrication_rejected_at || !!booking.fabrication_workflow?.rejected;
  return status === "BOOKED" && rejected ? "FABRICATION_REJECTED" : status;
}

const LEGEND: Array<Omit<BookingStatusLegendEntry, "badgeClass">> = [
  { status: "PENDING", label: "Pending", meaning: "Request received; waiting for the lab / Officer in Charge to confirm." },
  { status: "PENDING_PAYMENT", label: "Awaiting payment", meaning: "Pay the amount due to confirm the booking." },
  { status: "BOOKED", label: "Booked", meaning: "Slot confirmed. Bring or send your sample on time." },
  { status: "WAITLISTED", label: "Waitlisted", meaning: "You are in the queue. You will be notified if a slot frees up." },
  { status: "HOLD", label: "Hold", meaning: "Slots are held for an urgent request awaiting approval." },
  {
    status: "FABRICATION_REJECTED",
    label: "Rejected – waiting for new files",
    meaning:
      "3D printing / laser cutting: the lab cannot make the parts from your files. Upload new files before the deadline, or the booking is cancelled and refunded.",
  },
  {
    status: "DISRUPTION_PENDING",
    label: "Awaiting your choice (disruption)",
    meaning: "The equipment had an issue. Choose to reschedule or get a refund.",
  },
  {
    status: "UNDER_MAINTENANCE",
    label: "Under Maintenance",
    meaning: "The equipment is under maintenance. The lab will contact you about next steps.",
  },
  { status: "COMPLETED", label: "Completed", meaning: "Analysis is done. Results appear here once uploaded." },
  { status: "CANCELLED", label: "Cancelled", meaning: "The booking was cancelled." },
  { status: "ABSENT", label: "Operator Unavailable", meaning: "The operator was unavailable for this slot." },
  { status: "REFUNDED", label: "Refunded", meaning: "The booking amount was refunded." },
  { status: "BOOKING_NOT_UTILIZED", label: "Booking Not Utilized", meaning: "The slot passed without the booking being used." },
];

export const BOOKING_STATUS_LEGEND: readonly BookingStatusLegendEntry[] = LEGEND.map((entry) => ({
  ...entry,
  badgeClass: bookingStatusBadgeClass(entry.status),
}));

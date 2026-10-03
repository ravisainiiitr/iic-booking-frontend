/** What's New (October 2026): one catalog, filtered per role and feature flags, at most 10 items. */

import { BOOKERS, WALLET_MEMBERS, type Gate } from "../gate";
import type { GuideAudienceId, GuideFeatureFlags, GuideSection, WhatsNewItem } from "../types";

export const WHATS_NEW_DATE = "October 2026";
const MAX_ITEMS = 10;
/** Faculty get student and wallet items instead of these, to stay within MAX_ITEMS. */
const NON_FACULTY_BOOKERS = BOOKERS.filter((r) => r !== "faculty");

type CatalogItem = WhatsNewItem & {
  roles: GuideAudienceId[];
  when?: (f: GuideFeatureFlags) => boolean;
  /** Per-role override of the chapter opened by Learn more. */
  sectionFor?: Partial<Record<GuideAudienceId, string>>;
};

const ALL_ROLES: GuideAudienceId[] = [...BOOKERS, "oic", "operator", "dept_admin", "admin", "finance", "external_relations"];

/** Items are taken in order until MAX_ITEMS, so the newest come first. */
const CATALOG: CatalogItem[] = [
  // Newest: booking page, My Bookings and catalog
  { id: "slot-options", roles: BOOKERS, theme: "booking", icon: "calendar", title: "Simpler slot options", benefit: "Pick one way to choose slots (I'll pick, Auto-select or My preferred slot) and one answer to If your slots are taken, on the booking page and in templates.", sectionId: "book" },
  { id: "form-kept", roles: BOOKERS, theme: "booking", icon: "shield", title: "Failed booking? Form kept", benefit: "Only taken slots are dropped, and an unsaved booking comes back on your next visit.", sectionId: "book" },
  { id: "wallet-link-student", roles: ["student"], theme: "wallet", icon: "mail", title: "Link or invite your supervisor", benefit: "The booking page asks you to link your supervisor's wallet first, or invite them by email if they are not on the portal.", sectionId: "wallet" },
  { id: "wallet-link-staff", roles: ["project_staff"], theme: "wallet", icon: "mail", title: "Link or invite your PI", benefit: "The booking page asks you to link your PI's wallet first, or invite them by email if they are not on the portal.", sectionId: "wallet" },
  { id: "invited-requests", roles: ["faculty"], theme: "students", icon: "mail", title: "Students can invite you", benefit: "A student can invite you by email; after you sign in, their request waits for your Approve.", sectionId: "students" },
  { id: "edit-inputs", roles: BOOKERS, theme: "booking", icon: "pencil", title: "Edit inputs after booking", benefit: "Change inputs until completion; pay any extra within 1 minute. A lower charge is refunded straight away if you edit before the cancellation deadline.", sectionId: "inputs" },
  { id: "quota-countdown", roles: BOOKERS, theme: "booking", icon: "clock", title: "Quota left and opening countdown", benefit: "See how much weekly quota you have left and a live countdown to the next slot opening.", sectionId: "book" },
  { id: "slot-picker", roles: BOOKERS, theme: "booking", icon: "calendar", title: "Easier slot picking", benefit: "Tap a greyed slot to see why, pick slots on a phone, and check the Review line before Confirm.", sectionId: "book" },
  { id: "deadlines", roles: BOOKERS, theme: "booking", icon: "list", title: "Deadlines in My Bookings", benefit: "Each booking shows its cancel/reschedule deadline, and a legend explains every status.", sectionId: "my-bookings" },
  { id: "sample-sets", roles: BOOKERS, theme: "booking", icon: "layers", title: "Sample sets and number limits", benefit: "New sample sets start from the equipment's defaults; number boxes start at 1 and show Max N allowed.", sectionId: "inputs" },
  { id: "catalog", roles: BOOKERS, theme: "booking", icon: "search", title: "Catalog prices and Book now", benefit: "Equipment cards show a From price and a Book now button; filter by category.", sectionId: "book" },
  { id: "peak-external", roles: ["startup", "external"], when: (f) => f.externalBooking, theme: "booking", icon: "clock", title: "Paused at slot opening", benefit: "External access pauses 8:55–9:15 pm on Wednesdays so IIT Roorkee users can book new slots.", sectionId: "book" },
  { id: "assistant-need-help", roles: BOOKERS, when: (f) => f.assistant, theme: "assistant", icon: "bot", title: "Need help? after a failed booking", benefit: "The Booking Assistant explains what went wrong; rate answers with Was this helpful?", sectionId: "assistant" },
  { id: "training-faculty", roles: ["faculty"], when: (f) => f.training, theme: "students", icon: "star", title: "Training & Demos", benefit: "Request equipment demonstrations by department, charged at internal IITR rates from your wallet, and nominate students for hands-on training.", sectionId: "training" },
  { id: "training-student", roles: ["student"], when: (f) => f.training, theme: "booking", icon: "star", title: "My Trainings", benefit: "Follow your training applications and sessions, and earn Trained badges.", sectionId: "training" },

  // Newest: lab and administration
  { id: "operator-job-sheet", roles: ["operator"], theme: "lab", icon: "flask", title: "Job sheet for every booking", benefit: "Booking details show the user's sample requirements as a table, one row per sample set, with their instructions and Print job sheet.", sectionId: "view-booking" },
  { id: "typed-table", roles: ["admin"], theme: "admin", icon: "settings", title: "Advanced tables", benefit: "A table input whose columns each have their own type and limits; rows are added by users or follow a field such as No. of samples.", sectionId: "administration" },
  { id: "admin-overview", roles: ["admin", "dept_admin"], theme: "admin", icon: "list", title: "Administration overview", benefit: "Your dashboard opens with today's sessions, bookings, charges, equipment, waitlist and what needs your attention.", sectionId: "getting-started" },
  { id: "admin-menu-sections", roles: ["admin", "dept_admin"], theme: "admin", icon: "search", title: "Grouped dashboard menu", benefit: "Menu items sit in sections such as Bookings and Finance, with a Search menu box. Deployment Center opens as its own page.", sectionId: "getting-started" },
  { id: "instruction-per-type", roles: ["oic"], theme: "lab", icon: "settings", title: "Richer important instruction", benefit: "Write it per user type, with fonts, point sizes and subscript/superscript.", sectionId: "equipment-config" },
  { id: "charges", roles: ["oic"], theme: "lab", icon: "receipt", title: "Input edits and charges", benefit: "Lower charges from user edits before the deadline are refunded automatically; otherwise Confirm refund or Deduct Money.", sectionId: "charges" },
  { id: "training-oic", roles: ["oic"], when: (f) => f.training, theme: "lab", icon: "star", title: "Training workspace", benefit: "Answer demonstration requests, select trainees fairly, schedule sessions and certify.", sectionId: "training" },
  { id: "training-operator", roles: ["operator"], when: (f) => f.training, theme: "lab", icon: "star", title: "Training attendance", benefit: "Mark who attended training sessions on your equipment.", sectionId: "training" },
  { id: "equipment-form", roles: ["admin"], theme: "admin", icon: "settings", title: "Titles and sample sets switch", benefit: "Pick Dr., Prof. or another title for OICs and Lab Operators, and turn sample sets on or off per equipment.", sectionId: "administration" },
  { id: "peak-admin", roles: ["admin"], theme: "admin", icon: "clock", title: "Peak booking window", benefit: "Pause external users around the weekly slot opening; internal users go straight to booking.", sectionId: "administration" },
  { id: "training-admin", roles: ["admin"], when: (f) => f.training, theme: "admin", icon: "star", title: "Training per equipment", benefit: "In Training Policy, turn Training on for each equipment and choose Test accounts only or Everyone eligible.", sectionId: "training" },

  // Booking
  { id: "templates", roles: BOOKERS, theme: "booking", icon: "template", title: "Booking templates", benefit: "Save an instrument's form and preferred weekly slot, then book in one click.", sectionId: "templates" },
  { id: "my-bookings", roles: NON_FACULTY_BOOKERS, theme: "booking", icon: "list", title: "Easier My Bookings", benefit: "Filter by status, date and equipment; cancelled bookings keep their dates.", sectionId: "my-bookings" },
  { id: "calendar-sync", roles: NON_FACULTY_BOOKERS, theme: "booking", icon: "calendar", title: "Sync to calendar", benefit: "See your bookings in Google Calendar, Outlook or Apple Calendar.", sectionId: "my-bookings" },
  { id: "urgent-types", roles: WALLET_MEMBERS, theme: "booking", icon: "alert", title: "Urgent booking: Type A or B", benefit: "Rush relief without surcharge after repeated tries, or urgent with a reason.", sectionId: "urgent" },
  { id: "instruction-for-you", roles: ["startup", "external"], theme: "booking", icon: "shield", title: "Instructions for your user type", benefit: "Labs can show a note written for your user type on the booking page.", sectionId: "book" },
  { id: "server-clock", roles: ["student", "project_staff", "startup", "external"], theme: "booking", icon: "clock", title: "Server clock", benefit: "Booking windows open by the portal clock shown on the booking page.", sectionId: "book" },

  // Wallet
  { id: "member-limit", roles: WALLET_MEMBERS, theme: "wallet", icon: "wallet", title: "Supervisor spending limit", benefit: "See your weekly and monthly limit and usage before you book.", sectionId: "wallet" },
  { id: "wallet-buttons", roles: ["faculty"], when: (f) => f.peerTransfer || f.creditFacility, theme: "wallet", icon: "wallet", title: "Wallet actions together", benefit: "Transfer, Credit Facility and Recharge Wallet sit side by side at the top.", sectionId: "wallet" },
  { id: "project-grant", roles: ["faculty"], when: (f) => f.projectGrant, theme: "wallet", icon: "receipt", title: "Recharge from a Project Grant", benefit: "Fund your wallet from a sponsored project and see any decline reason.", sectionId: "wallet" },

  // Your students
  { id: "spending-limits", roles: ["faculty"], theme: "students", icon: "users", title: "Spending limits per student", benefit: "Cap what each student can spend from your wallet per week or month.", sectionId: "students" },
  { id: "student-card", roles: ["faculty"], theme: "students", icon: "users", title: "ID card and Linked toggle", benefit: "Open a student's identity card, or delink them in one click.", sectionId: "students" },
  { id: "supervisor-email", roles: ["faculty"], theme: "students", icon: "mail", title: "One email per student booking", benefit: "Get the same booking email as your student, with a Booked by row.", sectionId: "students" },
  { id: "approve-urgent", roles: ["faculty"], theme: "students", icon: "alert", title: "Approve urgent requests", benefit: "Your students' Type B requests reach you before the Officer In Charge.", sectionId: "urgent" },

  // Lab operations
  { id: "staff-view-booking", roles: ["oic", "operator", "dept_admin", "admin"], theme: "lab", icon: "list", title: "View Booking upgrades", benefit: "S.No., sorting on every column and More filters on one line.", sectionId: "view-booking" },
  { id: "hover-details", roles: ["operator", "dept_admin"], theme: "lab", icon: "search", title: "Who booked this slot?", benefit: "Hover a booked slot to see the user's name, contact and booking ID.", sectionId: "view-booking" },
  { id: "urgent-final", roles: ["oic", "admin"], theme: "lab", icon: "alert", title: "Final approval for urgent bookings", benefit: "Approve Type B requests after the supervisor, and reschedule if needed.", sectionId: "urgent-approvals" },
  { id: "confirm-manually", roles: ["oic", "admin"], theme: "lab", icon: "clock", title: "Confirm waitlist manually", benefit: "Place a waitlisted user into any unbooked slot, even at weekends.", sectionId: "waitlist-confirm" },
  { id: "slot-status-week", roles: ["oic", "admin"], theme: "lab", icon: "calendar", title: "Quicker Change slot status", benefit: "Opens on the current week; one click on an arrow changes the week.", sectionId: "slot-status" },
  { id: "awaiting-completion", roles: ["oic", "operator"], theme: "lab", icon: "clock", title: "Bookings awaiting completion", benefit: "A dashboard card and a daily 9:00 AM reminder until runs are completed.", sectionId: "view-booking" },
  { id: "tickets-marked", roles: ["oic"], theme: "lab", icon: "ticket", title: "Tickets marked to me", benefit: "See tickets assigned to you or raised for your equipment.", sectionId: "tickets" },
  { id: "walk-in", roles: ["oic"], theme: "lab", icon: "flask", title: "Walk-in equipment", benefit: "Set both sample timings to 0 to stop sample emails and auto Not Utilized.", sectionId: "equipment-config" },
  { id: "operator-rename", roles: ["operator"], theme: "lab", icon: "users", title: "Now called Lab Operator", benefit: "The Lab In-charge role has a new name across the portal and emails.", sectionId: "getting-started" },
  { id: "operator-tickets", roles: ["operator"], theme: "lab", icon: "ticket", title: "Support tickets on your dashboard", benefit: "Raise and follow your own tickets, and see tickets marked to you.", sectionId: "tickets" },
  { id: "intimate", roles: ["operator"], theme: "lab", icon: "clock", title: "Unavailability without approval", benefit: "Intimate Unavailability is recorded at once and your OIC is emailed.", sectionId: "unavailability" },

  // Administration and accounts
  { id: "decline-closed", roles: ["dept_admin", "finance"], theme: "wallet", icon: "receipt", title: "Project Already Closed", benefit: "A new decline reason for Project Grant recharges, shown to the requester.", sectionId: "recharge-requests" },
  { id: "sric-credit", roles: ["dept_admin"], theme: "wallet", icon: "credit", title: "Declined by SRIC becomes credit", benefit: "The amount stays as credit and is recovered from the next approved recharge.", sectionId: "recharge-requests" },
  { id: "wallet-modes", roles: ["admin"], theme: "admin", icon: "wallet", title: "Wallet payment modes", benefit: "Switch each recharge, transfer and credit option on or off.", sectionId: "recharge-requests" },
  { id: "approver-named", roles: ["admin"], theme: "admin", icon: "mail", title: "Clearer recharge outcomes", benefit: "New Project Already Closed decline reason; SRIC emails name the approver.", sectionId: "recharge-requests" },
  { id: "ratings", roles: ["admin"], theme: "admin", icon: "star", title: "Experience ratings", benefit: "Read Rate your experience responses, sort them and Export CSV.", sectionId: "support-admin" },
  { id: "ticket-alerts", roles: ["admin"], theme: "admin", icon: "mail", title: "New ticket email alerts", benefit: "Choose who is emailed about every new support ticket.", sectionId: "support-admin" },
  { id: "assistant-knowledge", roles: ["admin"], theme: "admin", icon: "bot", title: "Booking Assistant Knowledge", benefit: "Manage the verified answers the assistant uses and review its replies.", sectionId: "assistant-admin" },
  { id: "verify-fund", roles: ["finance"], theme: "wallet", icon: "receipt", title: "Verify Fund Receipt", benefit: "Confirm funds arrived before a recharge is credited.", sectionId: "recharge-requests" },
  { id: "unmatched-alert", roles: ["finance"], theme: "wallet", icon: "alert", title: "Unmatched funds alert", benefit: "A dashboard alert lists recharges whose funds are not yet matched.", sectionId: "recharge-requests" },

  // Assistant & tools
  { id: "assistant-guided", roles: BOOKERS, when: (f) => f.assistant && f.inChatBooking, theme: "assistant", icon: "bot", title: "Guided Booking Assistant", benefit: "Book step by step from department to slot and get a virtual booking ID.", sectionId: "assistant" },
  { id: "assistant-help", roles: BOOKERS, when: (f) => f.assistant && !f.inChatBooking, theme: "assistant", icon: "bot", title: "Guided Booking Assistant", benefit: "Step-by-step help from department to slot, then finish on the booking page.", sectionId: "assistant" },
  { id: "assistant-staff", roles: ["oic", "admin"], when: (f) => f.assistant, theme: "assistant", icon: "bot", title: "Booking Assistant", benefit: "Ask about equipment, slots, charges and bookings in plain language.", sectionId: "assistant" },
  { id: "back-button", roles: ["finance", "external_relations"], theme: "assistant", icon: "rocket", title: "Back button on every page", benefit: "Return to where you came from without the browser's back button.", sectionId: "getting-started" },
  { id: "keyboard", roles: ALL_ROLES, theme: "assistant", icon: "help", title: "Keyboard-friendly menus", benefit: "Dashboard menus open with Tab and Enter, and buttons are labelled for screen readers.", sectionId: "help" },
];

export function buildWhatsNew(g: Gate, sections: GuideSection[]): { date: string; items: WhatsNewItem[] } {
  const ids = new Set(sections.map((s) => s.id));
  const items: WhatsNewItem[] = [];
  for (const c of CATALOG) {
    if (!c.roles.includes(g.audience)) continue;
    if (c.when && !c.when(g.flags)) continue;
    const sectionId = c.sectionFor?.[g.audience] ?? c.sectionId;
    if (!ids.has(sectionId)) continue;
    items.push({ id: c.id, theme: c.theme, icon: c.icon, title: c.title, benefit: c.benefit, sectionId });
    if (items.length >= MAX_ITEMS) break;
  }
  return { date: WHATS_NEW_DATE, items };
}

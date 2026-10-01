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

const CATALOG: CatalogItem[] = [
  // Booking
  { id: "templates", roles: BOOKERS, theme: "booking", icon: "template", title: "Booking templates", benefit: "Save an instrument's form and preferred weekly slot, then book in one click.", sectionId: "templates" },
  { id: "sample-sets", roles: BOOKERS, theme: "booking", icon: "layers", title: "Samples with different parameters", benefit: "Book several sample sets, each with its own inputs, in one booking.", sectionId: "inputs" },
  { id: "edit-inputs", roles: BOOKERS, theme: "booking", icon: "pencil", title: "Edit inputs after booking", benefit: "Change inputs until completion; pay any difference within 1 minute.", sectionId: "inputs" },
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
  { id: "instruction-per-type", roles: ["oic"], theme: "lab", icon: "settings", title: "Instructions per user type", benefit: "Write a formatted important instruction for each user type.", sectionId: "equipment-config" },
  { id: "walk-in", roles: ["oic"], theme: "lab", icon: "flask", title: "Walk-in equipment", benefit: "Set both sample timings to 0 to stop sample emails and auto Not Utilized.", sectionId: "equipment-config" },
  { id: "charges", roles: ["oic"], theme: "lab", icon: "receipt", title: "Input edits and charges", benefit: "Confirm refund or Deduct Money after edits; calculate charges on any equipment.", sectionId: "charges" },
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

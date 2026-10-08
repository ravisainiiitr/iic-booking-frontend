/** What's New (October 2026): one catalog, filtered per role and feature flags, at most 10 items. */

import { BOOKERS, WALLET_MEMBERS, type Gate } from "../gate";
import type { GuideAudienceId, GuideFeatureFlags, GuideSection, WhatsNewItem } from "../types";

export const WHATS_NEW_DATE = "October 2026";
const MAX_ITEMS = 10;
/** Faculty get student and wallet items instead of these, to stay within MAX_ITEMS. */
const NON_FACULTY_BOOKERS = BOOKERS.filter((r) => r !== "faculty");

type CatalogItem = Omit<WhatsNewItem, "href"> & {
  roles: GuideAudienceId[];
  when?: (f: GuideFeatureFlags) => boolean;
  /** Per-role override of the chapter opened by Learn more. */
  sectionFor?: Partial<Record<GuideAudienceId, string>>;
  /** Page opened by Try it for every listed role. */
  href?: string;
  /** Per-role Try it page; null hides Try it for that role. */
  hrefFor?: Partial<Record<GuideAudienceId, string | null>>;
};

const ALL_ROLES: GuideAudienceId[] = [...BOOKERS, "oic", "operator", "dept_admin", "admin", "finance", "external_relations"];

/** Items are taken in order until MAX_ITEMS, so the newest come first. */
const CATALOG: CatalogItem[] = [
  // Newest: registration decisions by email
  { id: "registration-approvals-faculty", roles: ["faculty"], kind: "new", theme: "students", icon: "mail", title: "Approve or decline from the email", summary: "Approve or decline a post-doc, research associate or IITR Startup registration straight from the email, within 24 hours.", benefit: "When a post-doc, research associate or IITR Startup names you at registration, the email has Approve and Decline buttons; no sign-in is needed. Please respond within 24 hours: after that the request is treated as declined and they can register again.", sectionId: "students" },

  // Booking page, My Bookings and catalog
  { id: "quota-countdown", roles: BOOKERS, kind: "new", theme: "booking", icon: "clock", title: "Quota left and what used it", summary: "See the weekly quota you have left, a countdown to the next slot opening and which bookings used a limit.", benefit: "See your weekly quota left and a countdown to the next slot opening. View bookings counted lists the bookings that used a limit and when each was requested; Unsuccessful attempts in My Bookings has View calculation for past limit failures.", sectionId: "book", href: "/equipments" },
  { id: "slot-options", roles: BOOKERS, kind: "improved", theme: "booking", icon: "calendar", title: "Simpler slot options", summary: "Choose slots one way (I'll pick, Auto-select or My preferred slot) and say what happens if they are taken.", benefit: "Pick one way to choose slots (I'll pick, Auto-select or My preferred slot) and one answer to If your slots are taken, on the booking page and in templates.", sectionId: "book", href: "/equipments" },
  { id: "form-kept", roles: BOOKERS, kind: "fixed", theme: "booking", icon: "shield", title: "Failed booking? Form kept", benefit: "Only taken slots are dropped, and an unsaved booking comes back on your next visit.", sectionId: "book" },
  { id: "wallet-link-student", roles: ["student"], kind: "new", theme: "wallet", icon: "mail", title: "Link or invite your supervisor", benefit: "The booking page asks you to link your supervisor's wallet first, or invite them by email if they are not on the portal.", sectionId: "wallet", href: "/wallet" },
  { id: "wallet-link-staff", roles: ["project_staff"], kind: "new", theme: "wallet", icon: "mail", title: "Link or invite your PI", benefit: "The booking page asks you to link your PI's wallet first, or invite them by email if they are not on the portal.", sectionId: "wallet", href: "/wallet" },
  { id: "programme-extension", roles: ["project_staff"], kind: "new", theme: "booking", icon: "clock", title: "Extend your programme validity", summary: "Reminders arrive before your validity ends; click Request an extension and your faculty can extend it by up to six months.", benefit: "Reminders arrive 30, 7 and 1 days before your validity ends; click Request an extension and your faculty can extend it by up to six months.", sectionId: "getting-started" },
  { id: "invited-requests", roles: ["faculty"], kind: "new", theme: "students", icon: "mail", title: "Students can invite you", benefit: "A student can invite you by email; after you sign in, their request waits for your Approve.", sectionId: "students", href: "/student-management" },
  { id: "lab-questions-reply", roles: BOOKERS, kind: "new", theme: "booking", icon: "mail", title: "Questions from the lab", summary: "When the lab emails you a reminder or a question, a Reply needed banner on the booking lets you answer right there.", benefit: "When the lab sends a reminder or asks about your booking, you get an email and a Reply needed banner on the booking; reply right there.", sectionId: "my-bookings", href: "/my-bookings" },
  { id: "edit-inputs", roles: BOOKERS, kind: "new", theme: "booking", icon: "pencil", title: "Edit inputs after booking", summary: "Change your inputs until the run is completed; a lower charge is refunded at once before the cancellation deadline.", benefit: "Change inputs until completion; pay any extra within 1 minute. A lower charge is refunded straight away if you edit before the cancellation deadline.", sectionId: "inputs", href: "/my-bookings" },
  { id: "slot-picker", roles: BOOKERS, kind: "improved", theme: "booking", icon: "calendar", title: "Easier slot picking", benefit: "Tap a greyed slot to see why, pick slots on a phone, and check the Review line before Confirm.", sectionId: "book", href: "/equipments" },
  { id: "deadlines", roles: BOOKERS, kind: "improved", theme: "booking", icon: "list", title: "Deadlines in My Bookings", benefit: "Each booking shows its cancel/reschedule deadline, and a legend explains every status.", sectionId: "my-bookings", href: "/my-bookings" },
  { id: "sample-sets", roles: NON_FACULTY_BOOKERS, kind: "fixed", theme: "booking", icon: "layers", title: "Sample sets and number limits", benefit: "New sample sets start from the equipment's defaults; number boxes start at 1 and show Max N allowed.", sectionId: "inputs" },
  { id: "peak-external", roles: ["startup", "external"], when: (f) => f.externalBooking, kind: "new", theme: "booking", icon: "clock", title: "Paused at slot opening", benefit: "External access pauses 8:55–9:15 pm on Wednesdays so IIT Roorkee users can book new slots.", sectionId: "book" },
  { id: "assistant-need-help", roles: BOOKERS, when: (f) => f.assistant, kind: "new", theme: "assistant", icon: "bot", title: "Need help? after a failed booking", benefit: "The Booking Assistant explains what went wrong; rate answers with Was this helpful?", sectionId: "assistant" },
  { id: "training-faculty", roles: ["faculty"], when: (f) => f.training, kind: "new", theme: "students", icon: "star", title: "Training & Demos", summary: "Request equipment demonstrations for your department and nominate students for hands-on training.", benefit: "Request equipment demonstrations by department, charged at internal IITR rates from your wallet, and nominate students for hands-on training.", sectionId: "training", href: "/training/demo-requests" },
  { id: "training-student", roles: ["student"], when: (f) => f.training, kind: "new", theme: "booking", icon: "star", title: "My Trainings", benefit: "Follow your training applications and sessions, and earn Trained badges.", sectionId: "training", href: "/my-trainings" },
  { id: "catalog", roles: BOOKERS, kind: "improved", theme: "booking", icon: "search", title: "Catalog prices and Book now", benefit: "Equipment cards show a From price and a Book now button; filter by category.", sectionId: "book", href: "/equipments" },

  // Newest: lab and administration
  { id: "oic-substitute", roles: ["oic"], kind: "new", theme: "lab", icon: "users", title: "OIC Substitute", summary: "Hand one, several or all of your equipment to OICs of your department for chosen days; revoke any time, with a full history.", benefit: "Open OIC Substitute, tick the equipment (or Select all), choose a substitute per equipment or one for all, set the dates and a reason, review and confirm. Each person gets one email listing their equipment; access ends automatically at 11:59 PM IST on the last day, or earlier if you revoke it.", sectionId: "oic-substitute", href: "/oic-substitute" },
  { id: "booking-depths", roles: ["oic"], kind: "new", theme: "lab", icon: "settings", title: "Waitlist and urgent request limits", summary: "Set how many people can wait in the queue and how many Type A and Type B urgent requests each equipment accepts.", benefit: "In Equipment Booking Configuration, set Waitlist depth, the open urgent requests at a time and the weekly Type A and Type B limits; each shows the current count, such as 3 of 10 in queue. When next week's slots open is now set by the Main Administrator only.", sectionId: "equipment-config", href: "/oic/equipment-settings" },
  { id: "repeat-block", roles: ["oic"], kind: "new", theme: "lab", icon: "calendar", title: "Repeat block on Change slot status", summary: "Block the same weekdays and slot times for a month or a year in one go; slots created later are blocked too.", benefit: "On Change slot status, Repeat block… blocks chosen weekdays and slot times (say every Mon and Thu at 10:00) for the rest of the month, the next 12 months or custom dates, with an optional label. Preview shows what will be blocked; booked slots keep their bookings and are listed. Remove a repeat block to open its future slots again.", sectionId: "slot-status" },
  { id: "results-from-receipt", roles: ["operator"], kind: "improved", theme: "lab", icon: "clock", title: "Results deadline starts at sample receipt", summary: "No results deadline until the sample is accepted; a late sample moves the deadline, and only received bookings await completion.", benefit: "The results deadline now starts only once the sample is marked Sample Accepted, counting from the slot end or the receipt if later. Bookings awaiting completion and the 9:00 AM reminder list only received samples, with a Sample received column.", sectionId: "view-booking", href: "/booking-management" },
  { id: "registration-requests", roles: ["admin"], kind: "improved", theme: "admin", icon: "users", title: "Registration requests", summary: "Faculty now decide registrations from the email within 24 hours; the list shows the time left and closes overdue requests.", benefit: "Faculty now approve or decline from the email within 24 hours; the list shows the time left and overdue requests close automatically. Approve, reject or send again yourself, and follow every step in the Registration log.", sectionId: "registration-requests", href: "/admin/registration-requests" },
  { id: "slot-status-menu", roles: ["oic", "admin"], kind: "new", theme: "lab", icon: "calendar", title: "Change slot status in the menu", summary: "Change slot status is now in the dashboard menu and opens the slot calendar straight away.", benefit: "Change slot status is now in the dashboard menu and opens the slot calendar straight away. Switch equipment with the filter at the top (the Main Administrator also has a Department/Centre filter, IIC by default; an OIC sees their own and temporary-OIC equipment).", sectionId: "slot-status", href: "/change-slot-status" },
  { id: "maintenance-notice-closes", roles: ["oic", "admin"], kind: "fixed", theme: "lab", icon: "shield", title: "Maintenance notices close on Operational", benefit: "When equipment is marked Operational again, from any page or Admin settings, its Under Maintenance notice leaves the notice board.", sectionId: "slot-status" },
  { id: "wallet-modes-departments", roles: ["admin"], kind: "improved", theme: "admin", icon: "wallet", title: "Wallet options per department", summary: "Wallet payment modes has tabs: switch options off per department, set email recipients and allow direct recharges for a set period.", benefit: "Wallet payment modes now has tabs: switch options off for individual departments, choose To and CC recipients per option and department, and let designated persons recharge wallets directly for a set period.", sectionId: "recharge-requests", href: "/admin-settings/wallet-payment-modes" },
  { id: "direct-recharge-finance", roles: ["finance"], kind: "new", theme: "wallet", icon: "wallet", title: "Direct wallet recharge", summary: "With temporary permission from the Main Administrator, add funds received outside the portal straight to a user's wallet.", benefit: "With temporary permission from the Main Administrator, add funds received outside the portal straight to a user's wallet, with a review of the new balance before you confirm.", sectionId: "direct-recharge" },
  { id: "dept-admin-queue-actions", roles: ["dept_admin"], kind: "new", theme: "admin", icon: "shield", title: "Act on your department's queues", summary: "Accept or reject urgent requests, Confirm manually, clear waitlists and mark repeat samples for your department's equipment.", benefit: "Accept, reject or delete urgent requests, Confirm manually or clear waitlists, and mark repeat samples for your department's equipment, as the Officer In Charge can.", sectionId: "department-queues", href: "/urgent-requests" },
  { id: "urgent-requests-admin", roles: ["admin", "dept_admin"], kind: "improved", theme: "admin", icon: "alert", title: "Urgent Requests by department", summary: "Bookings > Urgent Requests lists every urgent request, filtered by Department/Centre and then Equipment.", benefit: "Bookings > Urgent Requests lists every urgent request. It, Equipment waitlist and Repeat samples filter by Department/Centre (IIC first) and then Equipment (All equipment first).", sectionId: "urgent-approvals", sectionFor: { dept_admin: "department-queues" }, href: "/urgent-requests" },
  { id: "queues-all-equipment", roles: ["oic"], kind: "improved", theme: "lab", icon: "clock", title: "Waitlist for all your equipment", summary: "Equipment waitlist and Repeat samples open on All equipment with an Equipment column; pick one to see its queue.", benefit: "Equipment waitlist and Repeat samples open on All equipment with an Equipment column; choose one equipment to see its queue depth or use Clear queue.", sectionId: "waitlist-confirm", href: "/equipment-waitlist" },
  { id: "attempt-details", roles: ["oic", "admin"], kind: "improved", theme: "lab", icon: "search", title: "Clearer booking attempt details", summary: "Click a failure reason in Booking Attempt Log to see the user, the slots, their inputs and the reason in plain words.", benefit: "Click a failure reason in Booking Attempt Log to see the user, the slots picked, their inputs as a table and the reason in plain words; for a limit failure, the bookings that used the limit (with when each was requested) and the user's supervisor are listed after the outcome.", sectionId: "view-booking", href: "/booking-attempt-logs" },
  { id: "results-deadline", roles: ["oic", "admin"], kind: "new", theme: "lab", icon: "clock", title: "Results deadline per equipment", summary: "Set when results are due in working days or hours; it starts at sample receipt (or the slot end, if later).", benefit: "Set results due in working days (holidays skipped) or hours, and choose whether users see it. It starts once the sample is marked Sample Accepted, from the slot end or the receipt if later; only received bookings await completion. It replaces the old operator unavailable and absent timers.", sectionId: "equipment-config", sectionFor: { admin: "administration" }, hrefFor: { oic: "/oic/equipment-settings" } },
  { id: "results-overdue", roles: ["oic", "operator", "admin"], kind: "new", theme: "lab", icon: "alert", title: "Results overdue list", summary: "A dashboard card, a View Booking filter and a red badge show late results; send Results delayed to tell the user.", benefit: "A dashboard card, a count in the Android app, a Results overdue filter in View Booking and a red badge on late bookings; send Results delayed to tell the user.", sectionId: "view-booking", href: "/booking-management" },
  { id: "lab-outreach", roles: ["operator", "admin"], kind: "new", theme: "lab", icon: "mail", title: "Send reminder or Ask user", summary: "Email the user a reminder or a question from a booking's actions; their reply comes back to you.", benefit: "From a booking's actions, email the user a reminder or a question; their reply comes back to you, and Awaiting reply marks open questions.", sectionId: "view-booking", href: "/booking-management" },
  { id: "operator-job-sheet", roles: ["operator"], kind: "new", theme: "lab", icon: "flask", title: "Job sheet for every booking", summary: "Booking details show the user's sample requirements as a table, with their instructions and Print job sheet.", benefit: "Booking details show the user's sample requirements as a table, one row per sample set, with their instructions and Print job sheet.", sectionId: "view-booking", href: "/booking-management" },
  { id: "admin-overview", roles: ["dept_admin"], kind: "new", theme: "admin", icon: "list", title: "Administration overview", benefit: "Your dashboard opens with today's sessions, bookings, charges, equipment, waitlist and what needs your attention.", sectionId: "getting-started" },
  { id: "admin-menu-sections", roles: ["dept_admin"], kind: "improved", theme: "admin", icon: "search", title: "Grouped dashboard menu", benefit: "Menu items sit in sections such as Bookings and Finance, with a Search menu box. Deployment Center opens as its own page.", sectionId: "getting-started" },
  { id: "training-oic", roles: ["oic"], when: (f) => f.training, kind: "new", theme: "lab", icon: "star", title: "Training workspace", benefit: "Answer demonstration requests, select trainees fairly, schedule sessions and certify.", sectionId: "training", href: "/training/oic" },
  { id: "training-operator", roles: ["operator"], when: (f) => f.training, kind: "new", theme: "lab", icon: "star", title: "Training attendance", benefit: "Mark who attended training sessions on your equipment.", sectionId: "training", href: "/training/attendance" },
  { id: "training-admin", roles: ["admin"], when: (f) => f.training, kind: "new", theme: "admin", icon: "star", title: "Training per equipment", benefit: "In Training Policy, turn Training on for each equipment and choose Test accounts only or Everyone eligible.", sectionId: "training", href: "/admin-settings/training" },
  { id: "equipment-form", roles: ["admin"], kind: "improved", theme: "admin", icon: "settings", title: "Titles and sample sets switch", benefit: "Pick Dr., Prof. or another title for OICs and Lab Operators, and turn sample sets on or off per equipment.", sectionId: "administration" },
  { id: "peak-admin", roles: ["admin"], kind: "new", theme: "admin", icon: "clock", title: "Peak booking window", benefit: "Pause external users around the weekly slot opening; internal users go straight to booking.", sectionId: "administration" },

  // Booking
  { id: "templates", roles: BOOKERS, kind: "new", theme: "booking", icon: "template", title: "Booking templates", benefit: "Save an instrument's form and preferred weekly slot, then book in one click.", sectionId: "templates", href: "/booking-templates" },
  { id: "my-bookings", roles: NON_FACULTY_BOOKERS, kind: "improved", theme: "booking", icon: "list", title: "Easier My Bookings", benefit: "Filter by status, date and equipment; cancelled bookings keep their dates.", sectionId: "my-bookings", href: "/my-bookings" },
  { id: "calendar-sync", roles: NON_FACULTY_BOOKERS, kind: "new", theme: "booking", icon: "calendar", title: "Sync to calendar", benefit: "See your bookings in Google Calendar, Outlook or Apple Calendar.", sectionId: "my-bookings", href: "/my-bookings" },
  { id: "urgent-types", roles: WALLET_MEMBERS, kind: "improved", theme: "booking", icon: "alert", title: "Urgent booking: Type A or B", benefit: "Rush relief without surcharge after repeated tries, or urgent with a reason.", sectionId: "urgent", href: "/my-urgent-requests" },
  { id: "instruction-for-you", roles: ["startup", "external"], kind: "new", theme: "booking", icon: "shield", title: "Instructions for your user type", benefit: "Labs can show a note written for your user type on the booking page.", sectionId: "book" },
  { id: "server-clock", roles: ["student", "project_staff", "startup", "external"], kind: "improved", theme: "booking", icon: "clock", title: "Server clock", benefit: "Booking windows open by the portal clock shown on the booking page.", sectionId: "book" },

  // Wallet
  { id: "member-limit", roles: WALLET_MEMBERS, kind: "new", theme: "wallet", icon: "wallet", title: "Supervisor spending limit", benefit: "See your weekly and monthly limit and usage before you book.", sectionId: "wallet", href: "/wallet" },
  { id: "wallet-buttons", roles: ["faculty"], when: (f) => f.peerTransfer || f.creditFacility, kind: "improved", theme: "wallet", icon: "wallet", title: "Wallet actions together", benefit: "Transfer, Credit Facility and Recharge Wallet sit side by side at the top.", sectionId: "wallet", href: "/wallet" },
  { id: "project-grant", roles: ["faculty"], when: (f) => f.projectGrant, kind: "new", theme: "wallet", icon: "receipt", title: "Recharge from a Project Grant", benefit: "Fund your wallet from a sponsored project and see any decline reason.", sectionId: "wallet", href: "/wallet" },

  // Your students
  { id: "spending-limits", roles: ["faculty"], kind: "new", theme: "students", icon: "users", title: "Spending limits per student", benefit: "Cap what each student can spend from your wallet per week or month.", sectionId: "students", href: "/student-management" },
  { id: "student-card", roles: ["faculty"], kind: "new", theme: "students", icon: "users", title: "ID card and Linked toggle", benefit: "Open a student's identity card, or delink them in one click.", sectionId: "students", href: "/student-management" },
  { id: "supervisor-email", roles: ["faculty"], kind: "improved", theme: "students", icon: "mail", title: "One email per student booking", benefit: "Get the same booking email as your student, with a Booked by row.", sectionId: "students" },
  { id: "approve-urgent", roles: ["faculty"], kind: "new", theme: "students", icon: "alert", title: "Approve urgent requests", benefit: "Your students' Type B requests reach you before the Officer In Charge.", sectionId: "urgent" },

  // Lab operations
  { id: "staff-view-booking", roles: ["oic", "operator", "dept_admin", "admin"], kind: "improved", theme: "lab", icon: "list", title: "View Booking upgrades", benefit: "S.No., sorting on every column and More filters on one line.", sectionId: "view-booking", href: "/booking-management" },
  { id: "hover-details", roles: ["operator", "dept_admin"], kind: "new", theme: "lab", icon: "search", title: "Who booked this slot?", benefit: "Hover a booked slot to see the user's name, contact and booking ID.", sectionId: "view-booking", href: "/booking-management" },
  { id: "urgent-final", roles: ["oic", "admin"], kind: "new", theme: "lab", icon: "alert", title: "Final approval for urgent bookings", benefit: "Approve Type B requests after the supervisor, and reschedule if needed.", sectionId: "urgent-approvals", href: "/urgent-requests" },
  { id: "confirm-manually", roles: ["oic", "admin"], kind: "new", theme: "lab", icon: "clock", title: "Confirm waitlist manually", benefit: "Place a waitlisted user into any unbooked slot, even at weekends.", sectionId: "waitlist-confirm", href: "/equipment-waitlist" },
  { id: "slot-status-week", roles: ["oic", "admin"], kind: "improved", theme: "lab", icon: "calendar", title: "Quicker Change slot status", benefit: "Opens on the current week; one click on an arrow changes the week.", sectionId: "slot-status" },
  { id: "awaiting-completion", roles: ["operator"], kind: "new", theme: "lab", icon: "clock", title: "Bookings awaiting completion", benefit: "A dashboard card and a daily 9:00 AM reminder until runs are completed.", sectionId: "view-booking" },
  { id: "tickets-marked", roles: ["oic"], kind: "new", theme: "lab", icon: "ticket", title: "Tickets marked to me", benefit: "See tickets assigned to you or raised for your equipment.", sectionId: "tickets", href: "/tickets" },
  { id: "walk-in", roles: ["oic"], kind: "improved", theme: "lab", icon: "flask", title: "Walk-in equipment", benefit: "Set both sample timings to 0 to stop sample emails and auto Not Utilized.", sectionId: "equipment-config", href: "/oic/equipment-settings" },
  { id: "operator-rename", roles: ["operator"], kind: "improved", theme: "lab", icon: "users", title: "Now called Lab Operator", benefit: "The Lab In-charge role has a new name across the portal and emails.", sectionId: "getting-started" },
  { id: "operator-tickets", roles: ["operator"], kind: "new", theme: "lab", icon: "ticket", title: "Support tickets on your dashboard", benefit: "Raise and follow your own tickets, and see tickets marked to you.", sectionId: "tickets", href: "/tickets" },
  { id: "intimate", roles: ["operator"], kind: "improved", theme: "lab", icon: "clock", title: "Unavailability without approval", benefit: "Intimate Unavailability is recorded at once and your OIC is emailed.", sectionId: "unavailability", href: "/leave-management" },

  // Administration and accounts
  { id: "decline-closed", roles: ["dept_admin", "finance"], kind: "new", theme: "wallet", icon: "receipt", title: "Project Already Closed", benefit: "A new decline reason for Project Grant recharges, shown to the requester.", sectionId: "recharge-requests", href: "/admin-settings/wallet-recharge-requests" },
  { id: "sric-credit", roles: ["dept_admin"], kind: "improved", theme: "wallet", icon: "credit", title: "Declined by SRIC becomes credit", benefit: "The amount stays as credit and is recovered from the next approved recharge.", sectionId: "recharge-requests", href: "/admin-settings/wallet-recharge-requests" },
  { id: "wallet-modes", roles: ["admin"], kind: "new", theme: "admin", icon: "wallet", title: "Wallet payment modes", benefit: "Switch each recharge, transfer and credit option on or off.", sectionId: "recharge-requests", href: "/admin-settings/wallet-payment-modes" },
  { id: "approver-named", roles: ["admin"], kind: "improved", theme: "admin", icon: "mail", title: "Clearer recharge outcomes", benefit: "New Project Already Closed decline reason; SRIC emails name the approver.", sectionId: "recharge-requests", href: "/admin-settings/wallet-recharge-requests" },
  { id: "ratings", roles: ["admin"], kind: "new", theme: "admin", icon: "star", title: "Experience ratings", benefit: "Read Rate your experience responses, sort them and Export CSV.", sectionId: "support-admin", href: "/admin-settings/feedback" },
  { id: "ticket-alerts", roles: ["admin"], kind: "new", theme: "admin", icon: "mail", title: "New ticket email alerts", benefit: "Choose who is emailed about every new support ticket.", sectionId: "support-admin", href: "/admin-settings/support" },
  { id: "assistant-knowledge", roles: ["admin"], kind: "new", theme: "admin", icon: "bot", title: "Booking Assistant Knowledge", benefit: "Manage the verified answers the assistant uses and review its replies.", sectionId: "assistant-admin", href: "/admin-settings/knowledge" },
  { id: "verify-fund", roles: ["finance"], kind: "new", theme: "wallet", icon: "receipt", title: "Verify Fund Receipt", benefit: "Confirm funds arrived before a recharge is credited.", sectionId: "recharge-requests", href: "/admin-settings/wallet-recharge-requests" },
  { id: "unmatched-alert", roles: ["finance"], kind: "new", theme: "wallet", icon: "alert", title: "Unmatched funds alert", benefit: "A dashboard alert lists recharges whose funds are not yet matched.", sectionId: "recharge-requests" },

  // Assistant & tools
  { id: "assistant-guided", roles: BOOKERS, when: (f) => f.assistant && f.inChatBooking, kind: "new", theme: "assistant", icon: "bot", title: "Guided Booking Assistant", benefit: "Book step by step from department to slot and get a virtual booking ID.", sectionId: "assistant" },
  { id: "assistant-help", roles: BOOKERS, when: (f) => f.assistant && !f.inChatBooking, kind: "new", theme: "assistant", icon: "bot", title: "Guided Booking Assistant", benefit: "Step-by-step help from department to slot, then finish on the booking page.", sectionId: "assistant" },
  { id: "assistant-staff", roles: ["oic", "admin"], when: (f) => f.assistant, kind: "new", theme: "assistant", icon: "bot", title: "Booking Assistant", benefit: "Ask about equipment, slots, charges and bookings in plain language.", sectionId: "assistant" },
  { id: "back-button", roles: ["finance", "external_relations"], kind: "new", theme: "assistant", icon: "rocket", title: "Back button on every page", benefit: "Return to where you came from without the browser's back button.", sectionId: "getting-started" },
  { id: "keyboard", roles: ALL_ROLES, kind: "improved", theme: "assistant", icon: "help", title: "Keyboard-friendly menus", benefit: "Dashboard menus open with Tab and Enter, and buttons are labelled for screen readers.", sectionId: "help" },

  // Everyone: only roles with room left under MAX_ITEMS see these.
  { id: "whats-new-each-login", roles: ALL_ROLES, kind: "new", theme: "assistant", icon: "star", title: "What's new in your profile menu", summary: "Open this summary any time from your profile menu > What's new; it no longer pops up after sign-in.", benefit: "A short summary of the changes for your role, with a link to your user guide. Open it any time from your profile menu > What's new; it no longer pops up after sign-in.", sectionId: "help" },
  { id: "latest-version", roles: ALL_ROLES, kind: "fixed", theme: "assistant", icon: "rocket", title: "Always the latest version", benefit: "After an update the portal loads the new version on its own, so you no longer need to clear the browser cache.", sectionId: "help" },
  { id: "avatar-initials", roles: ALL_ROLES, kind: "fixed", theme: "assistant", icon: "users", title: "Correct initials in avatars", benefit: "Avatars without a photo show the first letter of the person's name, not of Prof., Dr. or another title.", sectionId: "help" },
];

function hrefFor(c: CatalogItem, audience: GuideAudienceId): string | undefined {
  if (c.hrefFor && audience in c.hrefFor) return c.hrefFor[audience] ?? undefined;
  return c.href;
}

export function buildWhatsNew(g: Gate, sections: GuideSection[]): { date: string; items: WhatsNewItem[] } {
  const ids = new Set(sections.map((s) => s.id));
  const items: WhatsNewItem[] = [];
  for (const c of CATALOG) {
    if (!c.roles.includes(g.audience)) continue;
    if (c.when && !c.when(g.flags)) continue;
    const sectionId = c.sectionFor?.[g.audience] ?? c.sectionId;
    if (!ids.has(sectionId)) continue;
    const href = hrefFor(c, g.audience);
    items.push({
      id: c.id,
      kind: c.kind,
      theme: c.theme,
      icon: c.icon,
      title: c.title,
      benefit: c.benefit,
      ...(c.summary ? { summary: c.summary } : {}),
      sectionId,
      ...(href ? { href } : {}),
    });
    if (items.length >= MAX_ITEMS) break;
  }
  return { date: WHATS_NEW_DATE, items };
}

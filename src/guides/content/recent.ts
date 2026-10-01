/** Shared chapters for features released in September–October 2026, reused across role guides. */

import type { GuideAudienceId, GuideSection } from "../types";

export const WHATS_NEW_DATE = "October 2026";

const END_USER_NEW = [
  "Booking templates — save the booking form (inputs, sample sets and booking options) as named templates per equipment, with an optional preferred weekly slot. A new Booking Templates page on the dashboard lists all your templates and lets you create, edit, duplicate, delete and book with them. See Booking Templates.",
  "Save these parameters as a template — offered after any booking attempt, whether or not it succeeded.",
  "Samples with different parameters — add more sample sets to one booking; each set has its own inputs, element selection and sample table, and is charged and timed separately.",
  "Edit User Inputs after booking — if the charge goes up you have 1 minute to pay the difference; a lower charge is refunded after the Officer In Charge confirms it.",
  "Booking Assistant — the assistant button at the bottom-right now guides you step by step: Department → Equipment → inputs → slot → summary. It shows each booking's virtual booking ID.",
  "View Booking — the dashboard tile opens your bookings with search, Status, date and equipment filters. Cancelled and refunded bookings keep their original dates.",
  "Sync to calendar — add your bookings to Google Calendar, Outlook or Apple Calendar from the bookings page.",
  "Important instructions — a lab can now show a different instruction to each user type. Read it on the equipment page and the booking page.",
  "Server clock — the booking page header shows portal server time (IST). Booking windows open by this clock.",
  "Smaller changes — a Back button on every page, a larger home icon on the sign-in page, Saturday/Sunday and Holiday labels in calendars, and a login pop-up listing items that need your attention.",
];

const FACULTY_NEW = [
  "Wallet page — Transfer, Credit Facility and Recharge Wallet now sit together as buttons at the top.",
  "Recharge Wallet — choose Project Grant (approved by the SRIC Office) or Direct Cash Deposit / Bank Transfer, confirm with an email OTP, and see the decline reason (including Project Already Closed) on your wallet.",
  "Student management — set weekly and monthly spending limits per student, open a student's identity card, delink a student with the Linked toggle, and nominate students for TA operating calls.",
  "Supervisor booking email — when your student books, you receive one email that matches theirs, with a Booked by row.",
  "Urgent booking requests — approve your students' Type B (urgent with reason) requests before the Officer In Charge gives final approval.",
];

const STUDENT_NEW = [
  "Supervisor spending limit — if your supervisor sets a weekly or monthly limit, the booking page shows it with what you have used this week and month.",
  "Urgent booking request — Type A rush relief (no surcharge) or Type B urgent with reason (50% surcharge, supervisor approval first). See Urgent Booking Policy.",
];

const OIC_NEW = [
  "View Booking (formerly Booking Management) — S.No. column, sorting on every column, More filters, and a hover box with name, department, email, mobile and booking ID on booked slots.",
  "Urgent booking (formerly Urgent Requests) — Type B requests from students reach you after the supervisor approves; you give final approval and may reschedule, including weekends.",
  "Equipment waitlist — opens on your first equipment; Confirm manually places a waitlisted booking into any unbooked slot.",
  "Change slot status — opens on the current week; the week arrows change week on a single click, and double-clicking a date still jumps to that week.",
  "Calculate charges on any catalog equipment — view-only for equipment you are not assigned to.",
  "Support tickets — Tickets marked to me lists tickets assigned to you or raised for equipment you look after.",
  "Bookings awaiting completion — a dashboard card, plus a reminder email every day at 9:00 AM until the booking is marked completed.",
  "Important instruction per user type, with rich text formatting, in Equipment Booking Configuration.",
  "Input edits — Confirm refund or Deduct Money when a user's input edit changes the charge.",
  "Walk-in equipment — set both the sample submission lead time and the sample collect deadline to 0 to turn off sample emails and automatic Not Utilized.",
  "Booking Assistant — the assistant button at the bottom-right answers equipment, slot and booking questions.",
];

const OPERATOR_NEW = [
  "The Lab In-charge role is now called Lab Operator across the portal and emails.",
  "Support tickets now appear on your dashboard so you can raise and follow your own tickets.",
  "View Booking (formerly Booking Management) — S.No. column, sorting on every column, More filters, and a hover box on booked slots.",
  "Bookings awaiting completion — a dashboard card, plus a reminder email every day at 9:00 AM until the booking is marked completed.",
  "Intimate Unavailability is recorded immediately and your OIC is emailed; no approval is needed.",
  "Smaller changes — a Back button on every page and Saturday/Sunday and Holiday labels in calendars.",
];

const DEPT_ADMIN_NEW = [
  "View Booking (formerly Booking Management) — S.No. column, sorting on every column, More filters, and a hover box on booked slots.",
  "Wallet recharge requests — decline reasons now include Project Already Closed, and requesters see the reason on their wallet.",
  "Change slot status — the week arrows change week on a single click; double-clicking a date still jumps to that week.",
  "Equipment waitlist — opens on the first equipment instead of an empty picker.",
];

const ADMIN_NEW = [
  "Wallet payment modes — switch Recharge via Project Grant, Direct Cash Deposit / Bank Transfer, Online payment gateway, Transfer within the same department and Credit Limit on or off.",
  "Wallet recharge requests — decline reasons now include Project Already Closed, and the SRIC office emails name who approved a recharge.",
  "Experience ratings — review Rate your experience responses with sorting and Export CSV.",
  "New ticket email alerts — choose who is emailed about every new support ticket (Admin Settings → Support Tickets).",
  "Booking Assistant Knowledge and Copilot Answers & Console — manage what the Booking Assistant knows and review its answers.",
  "Equipment waitlist — Confirm manually places a waitlisted booking into any unbooked slot, including weekends, holidays and blocked slots.",
  "View Booking — S.No. column, sorting on every column and More filters; cancelled and refunded bookings keep their original dates.",
  "Change slot status — the week arrows change week on a single click; double-clicking a date still jumps to that week.",
  "Booking Assistant — guided Department → Equipment → inputs → slot → summary booking with virtual booking IDs.",
];

const FINANCE_NEW = [
  "Wallet recharge requests — verify physical receipts and cash or bank transfers, review user details, use Verify Fund Receipt, and Approve verified requests.",
  "Student payment receipts — where student recharge is enabled, students upload a receipt; after your verification the funds are added to the supervisor's wallet.",
];

function whatsNewItems(audience: GuideAudienceId): string[] {
  switch (audience) {
    case "faculty":
      return [...FACULTY_NEW, ...END_USER_NEW];
    case "student":
      return [...STUDENT_NEW, ...END_USER_NEW];
    case "project_staff":
    case "startup":
    case "external":
      return END_USER_NEW;
    case "oic":
      return OIC_NEW;
    case "operator":
      return OPERATOR_NEW;
    case "dept_admin":
      return DEPT_ADMIN_NEW;
    case "admin":
      return ADMIN_NEW;
    case "finance":
      return FINANCE_NEW;
    default:
      return [
        "A Back button on every page and a larger home icon on the sign-in page.",
        "Booking Assistant — the assistant button at the bottom-right answers portal questions.",
      ];
  }
}

export function whatsNewSection(audience: GuideAudienceId): GuideSection {
  return {
    id: "whats-new",
    title: `What's New (${WHATS_NEW_DATE})`,
    paragraphs: [
      `Changes released in September and October 2026 that affect your role. Each item is explained in more detail later in this guide.`,
    ],
    bullets: whatsNewItems(audience),
  };
}

/** Booking page inputs: sample sets, element picker, important instruction and editing after booking. */
export function bookingInputsSection(): GuideSection {
  return {
    id: "booking-inputs",
    title: "Booking Inputs, Sample Sets and Edits",
    paragraphs: [
      "The booking page asks for the inputs the lab needs (for example number of samples, analysis type or elements). Charges and the number of slots are calculated from these inputs.",
      "Read the Important instruction box on the equipment page and the booking page before you book. The lab can write a different instruction for each user type, so it may differ from what a colleague sees.",
    ],
    steps: [
      {
        title: "Fill sample set 1",
        body: "The details at the top of the form are sample set 1. Where the equipment asks for elements, click Select elements and pick them on the periodic table.",
      },
      {
        title: "Add samples with different parameters",
        body: "Under Samples with different parameters, click Add sample with different parameters to add Sample set 2, 3 and so on. Each set has the same fields as set 1, including element selection and sample tables. Each set is charged and timed separately and added to the same booking.",
      },
      {
        title: "Duplicate or remove a set",
        body: "Use Duplicate this sample set to copy a set you want to tweak, or Remove this sample set to drop it. The charge and slot count update straight away.",
      },
      {
        title: "Edit inputs after booking",
        body: "Open the booking from View Booking and choose Edit User Inputs. You can change values until the booking is completed. If the new charge is higher, pay the difference with Pay ₹X now within 1 minute, or the edit is cancelled and the previous values are restored. Use Cancel edit to back out. A lower charge is refunded after the Officer In Charge confirms it.",
      },
    ],
    callouts: [
      "Field limits (minimum, maximum and required fields) apply in Edit User Inputs exactly as on the booking form.",
    ],
  };
}

/** Booking templates on the booking page and equipment page. */
export function bookingTemplatesSection(): GuideSection {
  return {
    id: "booking-templates",
    title: "Booking Templates",
    paragraphs: [
      "A booking template saves the booking form for one equipment — inputs, sample sets, booking options and (where available) the research workspace — so you can book the same analysis again without re-typing. Templates never book anything by themselves; you still click Book.",
      "You can keep up to 25 templates per equipment. Templates are private to you, and you can only create them for equipment you are allowed to book.",
    ],
    steps: [
      {
        title: "See all your templates",
        body: "On the dashboard, open Booking Templates (Open templates). The page lists every template grouped by equipment, with its key inputs, number of sample sets, booking options and preferred slot. Use Search template or equipment…, the department and equipment filters, or sort by Group by equipment, Recently updated or Name (A–Z).",
      },
      {
        title: "Create a template",
        body: "On the Booking Templates page click New template, choose a Department, pick the equipment (use Find equipment to search) and click Continue. You can also start from the booking page (Booking template picker → Create template) or from Booking templates on the equipment page. Fill the form as you would for a booking, choose the Booking options you want, enter a Template name and click Save template.",
      },
      {
        title: "Choose booking options",
        body: "Booking options include Auto-select all required slots, Add to the waitlist if the booking cannot be completed, Book any available slots and Book even if single slot is available. Where the lab has linked similar instruments, you may also see Automatically search and allocate alternate equipment.",
      },
      {
        title: "Set a preferred weekly slot (optional)",
        body: "Turn on Preferred slot (optional) and choose the Day, Start time and Number of slots. When you open the booking page with this template, that slot is pre-selected if it is free. Next week's slots open on Wednesday at 9:00 PM.",
      },
      {
        title: "Decide what happens if the slot is taken",
        body: "Under If this slot is already taken when I click Book, choose Ask me (recommended), Book the next free slot later the same day, or Book the next free slot on any day I can book. The two automatic options need you to tick the consent: the portal may book the next free slot of the same length and charge your wallet. Wallet balance, spending limits and booking quotas are still checked.",
      },
      {
        title: "Load a template when booking",
        body: "Open the booking page and pick a template under Booking template (Choose a template to fill the form). Your first template is applied automatically and a message tells you which one; choose No template (default form) to start blank. If your preferred slot is taken, the page shows Nearest free slots of the same length — choosing one reloads the template and selects that slot, then click Book.",
      },
      {
        title: "Book, edit, duplicate or delete",
        body: "On the Booking Templates page, click Book now to open the booking page with the template filled in, or Edit to change it and click Update template. The ⋯ menu on each card also has Duplicate (a copy whose \"if my slot is taken\" choice is reset to Ask me) and Delete (Delete this template? — your bookings are not affected). The same actions are available from Manage templates on the booking page and from Booking templates on the equipment page.",
      },
      {
        title: "Save any booking attempt as a template",
        body: "After a booking attempt — successful or not — click Save these parameters as a template, enter a Template name and click Save template. Tick Pre-select this slot next time to remember the slot you tried.",
      },
    ],
  };
}

/** Booking Assistant guided flow and free-text questions. */
export function bookingAssistantSection(opts?: { staff?: boolean }): GuideSection {
  const staffNote = opts?.staff
    ? [
        "As staff you can use the assistant for equipment, charges, slots and booking look-ups. Booking management actions remain on View Booking and the OIC pages.",
      ]
    : [];
  return {
    id: "booking-assistant",
    title: "Booking Assistant",
    paragraphs: [
      "The Booking Assistant is the round button at the bottom-right of the portal (Open Booking Assistant); it appears when the assistant is enabled for your account. It uses live portal data: free slots, charges, equipment details, contacts and your bookings.",
      "Nothing is booked until you press Confirm booking on the summary card. In-chat booking is being rolled out in stages; if the summary shows Continue on booking page instead, finish the booking on the booking page with your details filled in.",
      ...staffNote,
    ],
    steps: [
      {
        title: "Start a guided booking",
        body: "Open the assistant and choose Book equipment. The cards show Step 1 of 5 and so on.",
      },
      {
        title: "Department, then equipment",
        body: "Pick a department (Choose a department), then the equipment (Choose equipment). Only equipment you are allowed to book is listed; multi-mode equipment shows its modes underneath. Use Back to departments to switch.",
      },
      {
        title: "Enter the booking inputs",
        body: "Fill the same inputs as the booking page, including extra sample sets and element selection. The equipment's important instruction is shown on this card.",
      },
      {
        title: "Pick a slot",
        body: "Tap a free slot. Use Earlier and Later to move between dates.",
      },
      {
        title: "Review the summary and confirm",
        body: "Check the summary (estimated total, wallet charged and balance after). Tick I have read the instructions above, then press Confirm booking. The confirmation shows the virtual booking ID with View Booking, and Open Analysis Workspace only when the equipment has Remote Analysis enabled.",
      },
    ],
    bullets: [
      "Change your mind at any step — use Change slot, Change samples/inputs or Change equipment; the details you already entered are kept. Cancel stops the flow without booking.",
      "Free text still works: try “I need FESEM tomorrow — what are my options?”, “What are the TEM charges?” or “Show my upcoming bookings”.",
      "You can mention a booking by its virtual booking ID in your question.",
      "Typing “confirm” does not book — press the Confirm booking button.",
      "The same portal checks apply as on the booking page: slot length, input limits, wallet balance, quotas and spending limits.",
    ],
  };
}

/** End-user bookings list reached from the View Booking tile. */
export function myBookingsSection(): GuideSection {
  return {
    id: "view-booking",
    title: "View Booking, Results and Calendar Sync",
    paragraphs: [
      "Click View Booking on the dashboard to open your bookings (the page is titled My Bookings). Every booking shows its status, slot dates, charges and sample deadlines.",
    ],
    bullets: [
      "Filters — search, Status, start and end dates and All equipment; More filters shows the rest. Click Apply, or Clear to reset.",
      "Cancelled and refunded bookings keep their original start and end dates so you can still see when they were scheduled.",
      "Book again — opens the booking form for the same equipment with your earlier inputs filled in.",
      "Sync to calendar — add your bookings to Google Calendar, Outlook or Apple Calendar, or copy a private link. Subscribing keeps the calendar updated; a one-time add does not.",
      "View results — published result files appear on the booking and in View results on the dashboard.",
      "Rate your experience — share feedback about the portal from the dashboard tile or after a booking.",
    ],
  };
}

/** Wallet recharge, transfer and credit for faculty. */
export function facultyWalletSection(): GuideSection {
  return {
    id: "wallets",
    title: "Wallet: Recharge, Transfer and Credit",
    paragraphs: [
      "Open Wallet management from the dashboard. Your wallet has a sub-wallet per department; students linked to you book against it. The buttons at the top are Transfer, Credit Facility and Recharge Wallet.",
      "A method or button shown greyed out with Awaiting Competent Authority Approval has been switched off by the Main Administrator.",
    ],
    steps: [
      {
        title: "Recharge Wallet — choose the method",
        body: "Click Recharge Wallet and pick the Recharge method: Project Grant (funds from a sponsored project, approved by the SRIC Office) or Direct Cash Deposit / Bank Transfer.",
      },
      {
        title: "Project and amount",
        body: "For Project Grant, select your project or click Add Project (project name, project code, funding agency and dates). Under Amount choose the department sub-wallet in Credit to and enter Amount (₹) — at least ₹100.",
      },
      {
        title: "Undertaking and OTP",
        body: "Tick I agree to the above undertaking. Click to send the OTP to your registered email (valid for 10 minutes) and enter it to submit.",
      },
      {
        title: "After you submit",
        body: "The screen shows your Transaction ID. A Project Grant request goes to the SRIC Office for approval. For Direct Cash Deposit / Bank Transfer, deposit the cash or complete the transfer at the SRIC Bill Section and share the transaction number with them.",
      },
      {
        title: "Track the request",
        body: "Your wallet lists each request with its status — for example Awaiting OTP, Pending, Approved, Approved · awaiting funds, Declined by SRIC or Rejected — and the decline reason when there is one.",
      },
    ],
    bullets: [
      "Decline reasons — Project Grant: Wrong Project Code, Insufficient Funds in the Project, Project Already Closed or Other. Cash / Bank transfer: Mismatch in User Information or Other.",
      "Declined by SRIC — when the SRIC Office declines a Project Grant request, the amount is treated as an auto-approved credit and shown as outstanding. It is adjusted when the funds of your next approved recharge are received.",
      "Approved · awaiting funds — while a credit is running, an approved Project Grant request is credited only when SRIC confirms the funds have arrived.",
      "Transfer — move balance to another internal user under the same department grant: choose From department (grant), Recipient (same grant), Amount (₹) and optional remarks, then confirm with an email OTP. No admin approval is needed. Past transfers are under Transfer history.",
      "Credit Facility — eligible faculty, staff and HoDs can request wallet credit: choose the Department, enter Requested Amount (₹) and Purpose / Reason, then click Submit Credit Request. The Credit facility rules card shows the minimum, maximum per request, maximum outstanding, duration and reminders. The Main Administrator approves each request, and only one facility can be active at a time. Track it under My Credit Facilities.",
      "Faculty Credit Facility — if your department offers it and you are eligible, use Avail credit on that department's sub-wallet. It is a one-time credit that recharges recover; once closed it cannot be availed again.",
    ],
    callouts: [
      "Recharge methods, transfer and credit can each be switched on or off by the Main Administrator, so you may not see every option.",
    ],
  };
}

/** Faculty: Student management page. */
export function studentManagementSection(): GuideSection {
  return {
    id: "student-management",
    title: "Student Management",
    paragraphs: [
      "Open Student management from the dashboard to see the students linked to your wallet. Students appear here after they send a request to join your wallet and you approve it.",
    ],
    steps: [
      {
        title: "Set a spending limit",
        body: "In the students table, use the Spending limit column. Enter a Weekly limit (₹), a Monthly limit (₹), or both, and click Save. Leave a box empty for no limit. Weeks run Monday–Sunday and months are calendar months (IST). The form shows what the student has used This week and This month.",
      },
      {
        title: "Open a student's identity card",
        body: "Click a student's name to open the Student identity card.",
      },
      {
        title: "Delink a student",
        body: "Turn off the Linked toggle. In Delink student from your wallet? you can add an optional message, or choose Keep linked to cancel.",
      },
      {
        title: "Nominate for TA operating",
        body: "When there is an open call, TA operating nominations lists it. Click Nominate student and choose from your supervised students before the deadline. The Nominations log shows outcomes.",
      },
    ],
    bullets: [
      "What counts towards a limit — bookings the student creates in that week or month, at their current charge. Bookings never charged or fully refunded do not count, and an unpaid input-edit difference is not counted until it is paid.",
      "Bookings made by the lab (OIC or admin) on the student's behalf are not blocked by the limit.",
      "The student sees Supervisor spending limit on the booking page with their usage.",
      "Supervisor booking email — when a linked student books, you receive one email that matches the student's, with a Booked by row.",
    ],
  };
}

/** Student / project-staff: linking a wallet, spending limits, and recharge where enabled. */
export function memberWalletSection(): GuideSection {
  return {
    id: "wallets",
    title: "Wallet, Spending Limits and Recharge",
    paragraphs: [
      "Internal bookings are usually charged to your supervisor's (or PI's) wallet. Open Wallet management, search for your supervisor under Request to Join Wallet and click Send Request. You can book once they approve; use Resend Request if needed.",
    ],
    bullets: [
      "If your supervisor's name is missing, ask them to sign in to the portal once via Channel i.",
      "Supervisor spending limit — your supervisor may set a weekly or monthly limit. The booking page shows Supervisor spending limit with what you have used This week and This month. A booking that would exceed it is blocked.",
      "Recharge — where student recharge is enabled for your account, Recharge Wallet offers Direct Cash Deposit / Bank Transfer and Upload payment receipt (attach the Receipt file and an optional UTR / reference). After the Department Account In-charge verifies it, the funds are added to your supervisor's wallet.",
      "Leaving a wallet removes your access immediately; you can then request to join a different supervisor's wallet.",
    ],
  };
}

/** Booking-page features that affect every booking user. */
export function bookingPageExtrasBullets(): string[] {
  return [
    "The server clock in the booking page header shows portal time (IST). Booking windows open by this clock, not your device clock.",
    "Next week's slots normally open every Wednesday at 9:00 PM. The booking page shows the exact window for your account, for example Current week only — new slots open … or Available: Current week and next week.",
    "Calendar cells show Saturday/Sunday and Holiday labels; hover over a holiday to see its name.",
  ];
}

/** Staff View Booking page (operator, OIC, dept admin, admin). */
export function staffViewBookingSection(): GuideSection {
  return {
    id: "view-booking-staff",
    title: "View Booking",
    paragraphs: [
      "View Booking (formerly Booking Management) lists bookings for the equipment you manage. Open it from the View Booking tile on the dashboard.",
    ],
    bullets: [
      "Columns — S.No., Booking ID, Equipment Name, User Name, Supervisor Name, User Mobile, User Email, Booking Start Date and Duration. Click any column heading to sort.",
      "Filters — search, Status, start and end dates and All equipment on one line; More filters shows the rest. Click Apply, or Clear to reset.",
      "Hover over a booked slot in the week calendar to see the user's name, department, email, mobile and booking ID.",
      "Cancelled and refunded bookings keep their original start and end dates.",
      "Add Comment can notify the booking user, the Officer In Charge and the Lab Operator — tick who should receive it.",
    ],
  };
}

/** OIC (and admin) tools added recently. Ticket scopes and the awaiting-completion card are OIC/Lab Operator only. */
export function oicRecentToolsSection(opts?: { admin?: boolean }): GuideSection {
  const oicOnlyTitles = new Set(["Tickets marked to me", "Bookings awaiting completion"]);
  const section: GuideSection = {
    id: "oic-recent-tools",
    title: opts?.admin
      ? "Waitlist, Urgent Booking and Slot Status"
      : "Waitlist, Urgent Booking, Slot Status and Tickets",
    paragraphs: [
      opts?.admin
        ? "These pages cover day-to-day exceptions. As Admin you can use them on every equipment."
        : "These pages cover the day-to-day exceptions for your equipment.",
    ],
    steps: [
      {
        title: "Urgent booking",
        body: "Open Urgent booking from the dashboard. Type B requests (urgent with reason, 50% surcharge) from students arrive after their supervisor approves. Give the final approval or reject; you may reschedule, including weekends. The user's wallet is charged only after your final approval.",
      },
      {
        title: "Equipment waitlist — Confirm manually",
        body: "Open Equipment waitlist; it opens on your first equipment. Click Confirm manually on an entry to open Confirm waitlisted booking, choose any unbooked slot (including weekends, holidays, closed, blocked and maintenance slots) and click Confirm booking. The charge is debited from the user's wallet. Only OICs and Admins can confirm manually.",
      },
      {
        title: "Change slot status",
        body: "Open the equipment page and choose Change slot status in its menu. Double-click a date (or drag across several) to open the Week view; it opens on the current week. Use the arrows — one click changes the week — or double-click a date to jump to its week. Click slots, time labels (rows) or day headers (columns) to select, then apply the new status.",
      },
      {
        title: "Tickets marked to me",
        body: "In Support tickets, Tickets marked to me lists tickets assigned to you or raised for equipment you look after. My Tickets lists the ones you raised.",
      },
      {
        title: "Bookings awaiting completion",
        body: "The dashboard card Bookings awaiting completion lists bookings whose time is over but are not marked completed. A reminder email is sent every day at 9:00 AM until each one is completed.",
      },
      {
        title: "Input edits that change the charge",
        body: "When a user edits inputs and the charge drops, use Confirm refund on the booking to refund the difference. When the charge goes up and the extra amount is still unpaid, Deduct Money debits it from the user's wallet. You can also edit inputs yourself after completion.",
      },
    ],
    bullets: [
      "Calculate charges works on any catalog equipment; for OICs it is view-only on equipment they are not assigned to, and Book for a user and Change slot status stay limited to their own equipment.",
      "Admins and OICs can see and book slots in any week; other users see the current week, plus next week once it opens.",
    ],
  };
  if (opts?.admin) {
    section.steps = section.steps?.filter((s) => !oicOnlyTitles.has(s.title));
  }
  return section;
}

/** OIC: Equipment Booking Configuration items changed recently. */
export function oicConfigurationBullets(): string[] {
  return [
    "Important instruction — in Equipment Booking Configuration, write the Default (all user types) text with the toolbar (font, size, style and colour). Use Add an instruction for a user type to show a different note to, for example, students or external users. Leave it empty to show nothing.",
    "Sample timings — a sample submission lead time of 0 means no sample deadline. If both the submission lead time and the sample collect deadline are 0, users bring and take back samples in person: no sample emails are sent and the booking is not marked Not Utilized automatically.",
  ];
}

/** Admin: settings pages added recently. */
export function adminRecentSection(): GuideSection {
  return {
    id: "admin-recent",
    title: "Wallet Modes, Ratings, Ticket Alerts and the Booking Assistant",
    paragraphs: [
      "Institute-level switches and review pages released in September–October 2026.",
    ],
    steps: [
      {
        title: "Wallet payment modes",
        body: "Open Wallet payment modes from the dashboard. Switch Recharge via Project Grant, Direct Cash Deposit / Bank Transfer, Online payment gateway, Transfer within the same department and Credit Limit on or off. Users see a switched-off option greyed out with Awaiting Competent Authority Approval.",
      },
      {
        title: "Wallet recharge requests",
        body: "Open Wallet recharge requests to Approve, Decline or Cancel requests and to Verify Fund Receipt. Decline reasons: Project Grant — Wrong Project Code, Insufficient Funds in the Project, Project Already Closed, Other; Cash / Bank transfer — Mismatch in User Information, Other. Approval notices to the SRIC offices name the approver. A Project Grant request declined by SRIC becomes an auto-approved credit, recovered from the next approved recharge.",
      },
      {
        title: "Wallet credit requests",
        body: "Approve or reject Credit Facility requests in Admin Settings → User Management → Wallet Credit Management.",
      },
      {
        title: "Experience ratings",
        body: "Open Experience ratings (dashboard or Admin Settings) to read Rate your experience responses. Sort by any column and use Export CSV.",
      },
      {
        title: "New ticket email alerts",
        body: "In Admin Settings → Support Tickets (Support desk), use New ticket email alerts to choose who is emailed about every new support ticket.",
      },
      {
        title: "Booking Assistant",
        body: "Admin Settings → Booking Assistant Knowledge holds the verified answers and documents the assistant uses. Copilot Answers & Console lets you review answers and feedback.",
      },
      {
        title: "Legacy user sync",
        body: "Legacy user sync maps a user to their old-portal user ID, runs a test sync, then syncs wallet balance and legacy bookings.",
      },
    ],
  };
}

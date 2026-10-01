import {
  type UserGuideContent,
  PRODUCT_NAME,
  bookingStatusSection,
  notificationsSection,
  supportSection,
  bestPracticesSection,
  loginAccountSection,
  troubleshootingSection,
  permissionsSection,
  faqSection,
  purposeSection,
} from "../types";
import { internalOperationalPoliciesSections } from "./policies";
import {
  bookingAssistantSection,
  bookingInputsSection,
  bookingPageExtrasBullets,
  bookingTemplatesSection,
  facultyWalletSection,
  myBookingsSection,
  studentManagementSection,
  whatsNewSection,
} from "./recent";

export const facultyGuide: UserGuideContent = {
  audience: "faculty",
  audienceLabel: "Internal Faculty",
  title: "Faculty User Guide",
  subtitle: `${PRODUCT_NAME}`,
  welcomeHeadline: "Welcome, IIT Roorkee faculty",
  welcomeBody: `Faculty accounts combine personal booking rights with wallet funding and approval tools for students and project staff. This guide explains Channel i login, booking, booking templates, the Booking Assistant, wallet recharge, transfer and credit, student management, and operational policies (waitlist, urgent requests, maintenance, disruptions, samples) on the ${PRODUCT_NAME}.`,
  sections: [
    whatsNewSection("faculty"),
    purposeSection({
      paragraphs: [
        `The ${PRODUCT_NAME} is the institute channel for equipment reservations across participating departments, centres, and laboratories at IIT Roorkee.`,
        "You book for your own work and fund students/project staff through wallets and approvals.",
      ],
      bullets: [
        "Book equipment at faculty/internal rates",
        "Recharge, transfer and request credit for the wallet used by your group",
        "Approve wallet join requests, set student spending limits and approve students' urgent requests",
        "Track bookings, sample deadlines, and published results",
      ],
    }),
    loginAccountSection({
      paragraphs: [
        "Prefer Channel i (Omniport) on the Auth page for a secure campus single sign-on.",
      ],
      bullets: [
        "Sign in with Channel i using your institute credentials.",
        "To also sign in with your email and a portal password, turn on Sign in with email under Sign-in options in My Profile.",
        "Update Profile contact details so booking and wallet emails reach you.",
        "Reopen this guide anytime from the user menu → User Guide.",
      ],
      callouts: [
        "If SSO fails, raise a Support Ticket rather than sharing passwords.",
      ],
    }),
    {
      id: "book-workflow",
      title: "Booking Workflow",
      paragraphs: ["Faculty follow the same live calendar flow as other internal users, with faculty charge profiles where configured."],
      steps: [
        {
          title: "Browse the catalog",
          body: "Open Equipments, filter by department or technique, and open an instrument’s detail page.",
          screenshotCaption: "Equipment catalog",
          screenshotSrc: "/guides/equipment-catalog-search-filters.jpg",
        },
        {
          title: "Check charges and accessories",
          body: "Use Calculate Charges and review sample/accessory requirements before selecting slots.",
          screenshotCaption: "Charges calculator on equipment page",
          screenshotSrc: "/guides/equipment-calculate-charges.png",
        },
        {
          title: "Fill the inputs and reserve slots",
          body: "Read the Important instruction, enter the inputs (or pick a saved template under Booking template), then select consecutive free slots on the weekly calendar and confirm. Complete wallet debit when prompted.",
          screenshotCaption: "Slot selection calendar",
          screenshotSrc: "/guides/booking-weekly-calendar.png",
        },
        {
          title: "Monitor your bookings",
          body: "Open View Booking on the dashboard to track status, sample deadlines, disruptions, and result downloads.",
          screenshotCaption: "Dashboard — My Bookings",
          screenshotSrc: "/guides/my-bookings-dashboard.png",
        },
      ],
      bullets: bookingPageExtrasBullets(),
    },
    bookingInputsSection(),
    bookingTemplatesSection(),
    bookingAssistantSection(),
    myBookingsSection(),
    facultyWalletSection(),
    studentManagementSection(),
    {
      id: "supervisor-urgent",
      title: "Approving Students' Urgent Requests",
      paragraphs: [
        "When a student you supervise submits a Type B urgent request (urgent with reason, 50% surcharge), it waits for your approval before it reaches the Officer In Charge.",
      ],
      steps: [
        {
          title: "Open the queue",
          body: "Click Urgent booking requests on the dashboard (it shows the number of pending requests), then Manage urgent requests.",
        },
        {
          title: "Approve or reject",
          body: "Read the student's reason and any supporting document, then approve or reject. After your approval the OIC gives the final decision and may reschedule. The wallet is charged only after the OIC's final approval.",
        },
      ],
    },
    bookingStatusSection(),
    ...internalOperationalPoliciesSections(),
    notificationsSection([
      "Wallet join and recharge emails — act promptly so students are not blocked from booking.",
      "Supervisor booking email — one email per booking made by a linked student, matching the student's email, with a Booked by row.",
      "Urgent booking requests from your students that need your approval.",
      "Waitlist promotion, maintenance, and disruption notices for your own bookings.",
    ]),
    bestPracticesSection([
      "Approve wallet members before peak experimental periods.",
      "Encourage students to cancel unused slots early so waitlists can promote.",
      "Remind students of sample submission and collection/discard deadlines.",
    ]),
    permissionsSection({
      paragraphs: [
        "Faculty can book and manage group funding within institute rules. Lab operations remain with OIC/operators.",
      ],
      bullets: [
        "You manage your wallets and approvals — not other faculty wallets.",
        "You do not mark bookings complete or set equipment maintenance (OIC/operator roles).",
        "Facility-caused disruptions follow cancel/refund and reschedule rules in the Operational Policies chapters.",
      ],
    }),
    faqSection([
      {
        question: "A student cannot book against my wallet — why?",
        answer:
          "Confirm their join request is approved, the Linked toggle is on in Student management, the wallet has sufficient balance and any spending limit you set has room. Programme dates on their profile must also be valid.",
      },
      {
        question: "Why is my Project Grant recharge shown as Declined by SRIC with credit outstanding?",
        answer:
          "The SRIC Office declined it (the reason is shown). The amount was given as an auto-approved credit and will be adjusted when the funds of your next approved recharge are received.",
      },
      {
        question: "Can I book on behalf of a student?",
        answer:
          "Typically students book themselves using your wallet. Booking-on-behalf is a staff (Admin/OIC) capability, not a standard faculty tool.",
      },
      {
        question: "Where do I reopen this guide?",
        answer: "User menu → User Guide, or the User Guide link in the footer when signed in.",
      },
      {
        question: "Where are waitlist and disruption policies explained?",
        answer:
          "See the Operational Policies chapters in this guide (Waitlist through Sample Collection & Discard) and the Operational Policies FAQ.",
      },
    ]),
    troubleshootingSection([
      "If wallet actions fail, refresh and confirm you are signed in as faculty via Channel i.",
      "For missing recharge emails, check spam and Profile email accuracy.",
      "Slot conflicts usually mean another booking took the slot — reopen the calendar and pick free slots.",
    ]),
    supportSection(),
  ],
};

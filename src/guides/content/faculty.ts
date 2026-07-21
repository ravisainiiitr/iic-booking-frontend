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

export const facultyGuide: UserGuideContent = {
  audience: "faculty",
  audienceLabel: "Internal Faculty",
  title: "Faculty User Guide",
  subtitle: `${PRODUCT_NAME}`,
  welcomeHeadline: "Welcome, IIT Roorkee faculty",
  welcomeBody: `Faculty accounts combine personal booking rights with wallet funding and approval tools for students and project staff. This guide explains Channel i login and the institute-wide features that keep research groups productive on the ${PRODUCT_NAME}.`,
  sections: [
    purposeSection({
      paragraphs: [
        `The ${PRODUCT_NAME} is the institute channel for equipment reservations across participating departments, centres, and laboratories at IIT Roorkee.`,
        "You book for your own work and fund students/project staff through wallets and approvals.",
      ],
      bullets: [
        "Book equipment at faculty/internal rates",
        "Create and manage wallets used by your group",
        "Approve wallet join requests and related student actions",
        "Track bookings, sample deadlines, and published results",
        "If your department enables Faculty Credit Facility and you are eligible, bookings may use a controlled negative department sub-wallet balance until recharges recover it",
      ],
    }),
    loginAccountSection({
      paragraphs: [
        "Prefer Channel i (Omniport) on the Auth page for a secure campus single sign-on.",
      ],
      bullets: [
        "Sign in with Channel i using your institute credentials.",
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
        },
        {
          title: "Check charges and accessories",
          body: "Use Calculate Charges and review sample/accessory requirements before selecting slots.",
          screenshotCaption: "Charges calculator on equipment page",
        },
        {
          title: "Reserve slots",
          body: "Select consecutive free slots on the weekly calendar and confirm. Complete wallet debit when prompted.",
          screenshotCaption: "Slot selection calendar",
        },
        {
          title: "Monitor My Bookings",
          body: "Track status, sample deadlines, disruptions, and result downloads from the Dashboard.",
          screenshotCaption: "Dashboard — My Bookings",
        },
      ],
    },
    {
      id: "wallets",
      title: "Wallets and Student Funding",
      paragraphs: [
        "Most student bookings debit a faculty or department wallet. Keeping wallets funded and members approved avoids last-minute booking failures.",
      ],
      bullets: [
        "Open Wallet from the Dashboard to view balances and transactions.",
        "Approve or reject wallet join requests from students and project staff.",
        "Initiate recharge requests following institute finance instructions shown in the portal.",
        "Confirm the correct wallet is selected when you book personally.",
      ],
      callouts: [
        "Credit facility and recharge rules are configured by institute administrators — follow on-screen guidance.",
      ],
    },
    bookingStatusSection(),
    notificationsSection([
      "Wallet join and recharge emails — act promptly so students are not blocked from booking.",
      "Supervisor queues (for example urgent requests) when you are assigned as reviewer.",
    ]),
    bestPracticesSection([
      "Approve wallet members before peak experimental periods.",
      "Encourage students to cancel unused slots early.",
    ]),
    permissionsSection({
      paragraphs: [
        "Faculty can book and manage group funding within institute rules. Lab operations remain with OIC/operators.",
      ],
      bullets: [
        "You manage your wallets and approvals — not other faculty wallets.",
        "You do not mark bookings complete or set equipment maintenance (OIC/operator roles).",
        "Facility-caused disruptions follow compensation / free-reschedule rules published by the lab or institute policy.",
      ],
    }),
    faqSection([
      {
        question: "A student cannot book against my wallet — why?",
        answer:
          "Confirm their join request is approved and the wallet has sufficient balance. Programme dates on their profile must also be valid.",
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
    ]),
    troubleshootingSection([
      "If wallet actions fail, refresh and confirm you are signed in as faculty via Channel i.",
      "For missing recharge emails, check spam and Profile email accuracy.",
      "Slot conflicts usually mean another booking took the slot — reopen the calendar and pick free slots.",
    ]),
    supportSection(),
  ],
};

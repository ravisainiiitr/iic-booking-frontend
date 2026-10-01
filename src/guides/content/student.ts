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
  memberWalletSection,
  myBookingsSection,
  whatsNewSection,
} from "./recent";

export const studentGuide: UserGuideContent = {
  audience: "student",
  audienceLabel: "Internal Students",
  title: "Student User Guide",
  subtitle: `${PRODUCT_NAME} — Channel i login, real-time booking, waitlist, and campus features`,
  welcomeHeadline: "Welcome, IIT Roorkee student",
  welcomeBody: `As an internal IIT Roorkee user you can book laboratory equipment across participating departments, centres, and laboratories. This guide covers Channel i login, live slot booking, booking templates, sample sets, the Booking Assistant, waitlists, cancellations, urgent requests, your supervisor's wallet and spending limits, operational policies (maintenance, disruptions, samples), and how to download results from your dashboard.`,
  sections: [
    whatsNewSection("student"),
    purposeSection({
      paragraphs: [
        `The ${PRODUCT_NAME} is the institute-wide channel for reserving analytical and specialised instruments at IIT Roorkee.`,
        "Students typically book at internal rates and pay via a linked faculty or department wallet.",
      ],
      bullets: [
        "Browse and book eligible equipment in real time",
        "Join waitlists when slots are full",
        "Cancel fully or partially within institutional time limits",
        "Understand waitlist, disruption, and sample policies",
        "Download results from your dashboard when the lab publishes them",
      ],
    }),
    loginAccountSection({
      paragraphs: [
        "Internal IIT Roorkee users should sign in with Channel i (Omniport) wherever that option is shown on the Auth page.",
      ],
      bullets: [
        "Open Sign In and choose Channel i / Omniport.",
        "Authenticate with your institute credentials.",
        "You return to the portal already signed in — no separate password for most campus accounts.",
        "If Sign in with email is turned on under Sign-in options in My Profile, you can also sign in with your email and a portal password.",
        "Keep Profile details (email, phone, programme dates) current so reminders and access checks work.",
      ],
      callouts: [
        "If Channel i login fails, raise a Support Ticket — do not share passwords.",
      ],
    }),
    {
      id: "book-workflow",
      title: "How to Book Equipment",
      paragraphs: [
        "Availability is live. When you open an equipment page and the booking calendar, you see current free and occupied slots.",
      ],
      steps: [
        {
          title: "Find equipment",
          body: "From the Dashboard or Equipments catalog, search by name, department, or category. Open View Details.",
          screenshotCaption: "Equipment catalog with search and filters",
          screenshotSrc: "/guides/equipment-catalog-search-filters.jpg",
        },
        {
          title: "Review charges and requirements",
          body: "Check accessories, sample rules, and Calculate Charges for your user category before selecting slots.",
          screenshotCaption: "Equipment detail page — charges and accessories",
          screenshotSrc: "/guides/equipment-calculate-charges.png",
        },
        {
          title: "Fill the booking inputs",
          body: "Read the Important instruction, then enter the inputs (or pick a saved template under Booking template). Add sample sets if your samples need different parameters.",
        },
        {
          title: "Select slots",
          body: "Choose consecutive slots for the duration you need. The system validates conflicts in real time.",
          screenshotCaption: "Weekly booking calendar",
          screenshotSrc: "/guides/booking-weekly-calendar.png",
        },
        {
          title: "Confirm and pay",
          body: "Confirm the booking and complete wallet selection when prompted. Status moves to Booked, Awaiting payment, or Waitlisted depending on the path.",
          screenshotCaption: "Booking confirmation and wallet selection",
          screenshotSrc: "/guides/booking-confirmation-success.png",
        },
      ],
      bullets: bookingPageExtrasBullets(),
      callouts: [
        "Popular instruments fill quickly — book as soon as your experimental plan is clear.",
      ],
    },
    bookingInputsSection(),
    bookingTemplatesSection(),
    bookingAssistantSection(),
    myBookingsSection(),
    {
      id: "cancellation",
      title: "Cancellation and Waitlist",
      paragraphs: [
        "You may cancel an entire booking or, where the lab allows, cancel part of a multi-slot booking within the published time window. Full waitlist rules are in Waitlist Policy below.",
      ],
      bullets: [
        "Open View Booking on the dashboard → select the booking → Cancel (full or partial when enabled).",
        "If a slot is full, join the FCFS waitlist; you will be notified if a place opens.",
        "Respond promptly after promotion — sample and arrival deadlines still apply.",
        "See Waitlist Policy, Wallet & Refunds (via Support if needed), and Sample Lifecycle chapters for details.",
      ],
      callouts: [
        "Cross-reference: Waitlist Policy · Under Maintenance · Operator Absent · Sample Submission · Sample Collection & Discard.",
      ],
    },
    memberWalletSection(),
    bookingStatusSection(),
    ...internalOperationalPoliciesSections(),
    notificationsSection([
      "Sample submission deadline reminders — prepare and submit samples before the cut-off shown on the booking.",
      "Waitlist join / promotion and Leave Waitlist confirmation emails.",
      "Maintenance, operator absence, and other disruption decision deadlines.",
    ]),
    bestPracticesSection([
      "Coordinate with your faculty supervisor so the correct wallet is linked before you book.",
      "Cancel unused slots early so waitlisted users can be promoted.",
      "Collect analysed samples before the discard deadline in the completion email.",
    ]),
    permissionsSection({
      paragraphs: [
        "Student accounts use internal rates and campus booking windows. Some features depend on equipment and lab configuration.",
      ],
      bullets: [
        "You can book eligible equipment and manage your own bookings.",
        "You cannot manage other users’ bookings or lab operations.",
        "Programme validity dates may limit access — keep profile dates current.",
        "Urgent requests appear only when enabled for that equipment/lab. For a repeat sample, visit the lab; the Officer In Charge arranges it and you receive a confirmation email.",
        "Your supervisor may set weekly or monthly spending limits on what you can charge to their wallet.",
      ],
    }),
    faqSection([
      {
        question: "Why can’t I see a wallet when booking?",
        answer:
          "Open Wallet management, find your supervisor under Request to Join Wallet and click Send Request. Once they approve, their wallet is used for your bookings.",
      },
      {
        question: "Why was my booking blocked by a spending limit?",
        answer:
          "Your supervisor has set a weekly or monthly limit and this booking would exceed it. The booking page shows the limit and your usage; ask your supervisor to raise it, or wait for the next week or month.",
      },
      {
        question: "Where do I download results?",
        answer:
          "Open the completed booking from View Booking, or open View results on the dashboard. When the lab publishes files, download links appear there — a lab visit is usually not required.",
      },
      {
        question: "What if Channel i redirects fail?",
        answer:
          "Try another browser or clear cookies for the portal domains, then raise a Support Ticket with the approximate time of the failure.",
      },
      {
        question: "Where are waitlist and disruption policies explained?",
        answer:
          "See the Operational Policies chapters in this guide (Waitlist, Urgent Booking, Under Maintenance, Operator Absent, Not Utilized, Analysis Not Possible, Sample Submission, and Sample Collection & Discard), plus the Operational Policies FAQ.",
      },
    ]),
    troubleshootingSection([
      "Refresh the page or try an Incognito window if the calendar looks stale.",
      "Confirm you are signed in with your student Channel i account (not a guest email).",
      "If charges look wrong, re-open Calculate Charges and verify accessories/sample count.",
      "For payment failures, check wallet balance and supervisor approval of join requests.",
    ]),
    supportSection(),
  ],
};

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

export const studentGuide: UserGuideContent = {
  audience: "student",
  audienceLabel: "Internal Students",
  title: "Student User Guide",
  subtitle: `${PRODUCT_NAME} — Channel i login, real-time booking, waitlist, and campus features`,
  welcomeHeadline: "Welcome, IIT Roorkee student",
  welcomeBody: `As an internal IIT Roorkee user you can book laboratory equipment across participating departments, centres, and laboratories. This guide covers Channel i login, live slot booking, waitlists, cancellation, urgent requests, and how to download results from your dashboard.`,
  sections: [
    purposeSection({
      paragraphs: [
        `The ${PRODUCT_NAME} is the institute-wide channel for reserving analytical and specialised instruments at IIT Roorkee.`,
        "Students typically book at internal rates and pay via a linked faculty or department wallet.",
      ],
      bullets: [
        "Browse and book eligible equipment in real time",
        "Join waitlists when slots are full",
        "Cancel fully or partially within institutional time limits",
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
          body: "From the Dashboard or Equipments catalog, search by name, department, or category. Open View Details & Charges.",
          screenshotCaption: "Equipment catalog with search and filters",
        },
        {
          title: "Review charges and requirements",
          body: "Check accessories, sample rules, and Calculate Charges for your user category before selecting slots.",
          screenshotCaption: "Equipment detail page — charges and accessories",
        },
        {
          title: "Select slots",
          body: "Choose consecutive slots for the duration you need. The system validates conflicts in real time.",
          screenshotCaption: "Weekly booking calendar",
        },
        {
          title: "Confirm and pay",
          body: "Confirm the booking and complete wallet selection when prompted. Status moves to Booked, Awaiting payment, or Waitlisted depending on the path.",
          screenshotCaption: "Booking confirmation and wallet selection",
        },
      ],
      callouts: [
        "Popular instruments fill quickly — book as soon as your experimental plan is clear.",
      ],
    },
    {
      id: "cancellation",
      title: "Cancellation and Waitlist",
      paragraphs: [
        "You may cancel an entire booking or, where the lab allows, cancel part of a multi-slot booking within the published time window.",
      ],
      bullets: [
        "Open My Bookings → select the booking → Cancel (full or partial when enabled).",
        "If a slot is full, join the FCFS waitlist; you will be notified if a place opens.",
        "Respond promptly to short-notice waitlist offers — they may expire.",
      ],
    },
    bookingStatusSection(),
    notificationsSection([
      "Sample submission deadline reminders — prepare and submit samples before the cut-off shown on the booking.",
    ]),
    bestPracticesSection([
      "Coordinate with your faculty supervisor so the correct wallet is linked before you book.",
    ]),
    permissionsSection({
      paragraphs: [
        "Student accounts use internal rates and campus booking windows. Some features depend on equipment and lab configuration.",
      ],
      bullets: [
        "You can book eligible equipment and manage your own bookings.",
        "You cannot manage other users’ bookings or lab operations.",
        "Programme validity dates may limit access — keep profile dates current.",
        "Urgent requests and repeat samples appear only when enabled for that equipment/lab.",
      ],
    }),
    faqSection([
      {
        question: "Why can’t I see a wallet when booking?",
        answer:
          "Ask your faculty supervisor to add you to their wallet (or use the wallet join request flow). Without a linked wallet, payment cannot complete for many internal bookings.",
      },
      {
        question: "Where do I download results?",
        answer:
          "Open the completed booking on your Dashboard / My Bookings. When the lab publishes files, download links appear there — a lab visit is usually not required.",
      },
      {
        question: "What if Channel i redirects fail?",
        answer:
          "Try another browser or clear cookies for the portal domains, then raise a Support Ticket with the approximate time of the failure.",
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

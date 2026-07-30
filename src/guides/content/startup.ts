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

export const startupGuide: UserGuideContent = {
  audience: "startup",
  audienceLabel: "Startup Users",
  title: "Startup / MSME User Guide",
  subtitle: `${PRODUCT_NAME} — incubated and external startup booking paths`,
  welcomeHeadline: "Welcome, startup / MSME user",
  welcomeBody: `Startup and MSME accounts use the ${PRODUCT_NAME} to access instrumentation with category-specific rates. This guide covers booking, payment, and operational policies (waitlist, disruptions, samples) for incubated and external startup/MSME paths.`,
  sections: [
    purposeSection({
      paragraphs: [
        `The ${PRODUCT_NAME} connects startups with laboratories across IIT Roorkee for characterisation, testing, and development work.`,
      ],
      bullets: [
        "Register under the correct startup / MSME category",
        "Book published equipment at category rates",
        "Complete payments and track results online",
      ],
    }),
    loginAccountSection({
      paragraphs: [
        "Incubated startups may use campus-linked login paths where offered; external startups/MSMEs typically register with email and documents.",
      ],
      bullets: [
        "Choose the correct user category during registration.",
        "Complete KYC/document uploads when the portal requests them.",
        "Keep organisation details current for invoicing.",
      ],
    }),
    {
      id: "book-workflow",
      title: "Booking Workflow",
      paragraphs: ["Use the equipment catalog and live calendar like other booking users, watching for startup-specific charge profiles."],
      steps: [
        {
          title: "Verify account readiness",
          body: "Confirm verification is complete and any required documents are approved.",
          screenshotCaption: "Profile / verification status",
        },
        {
          title: "Review startup rates",
          body: "Open equipment details and Calculate Charges for your category before selecting slots.",
          screenshotCaption: "Charge estimate for startup category",
        },
        {
          title: "Book and pay",
          body: "Reserve slots, complete payment steps, then track sample deadlines and results in My Bookings.",
          screenshotCaption: "Booking confirmation",
        },
      ],
    },
    bookingStatusSection(),
    ...internalOperationalPoliciesSections(),
    notificationsSection([
      "Sample deadline, waitlist promotion, and disruption decision emails.",
    ]),
    bestPracticesSection([
      "Book early for popular characterisation tools used by many startups.",
      "Cancel unused bookings early; collect samples before discard deadlines.",
    ]),
    permissionsSection({
      paragraphs: ["Startup accounts are end-user booking roles with category pricing — not lab staff roles."],
      bullets: [
        "Incubated vs external categories can change rates and document requirements.",
        "You cannot manage institute equipment or department staff.",
      ],
    }),
    faqSection([
      {
        question: "Which category should I pick — incubated or external?",
        answer:
          "Incubated at IIT Roorkee if you are formally incubated on campus; otherwise use External Startup/MSME. Wrong category can delay verification.",
      },
      {
        question: "Are rates the same as industry?",
        answer:
          "Not necessarily. Always use Calculate Charges for your signed-in category on each equipment page.",
      },
      {
        question: "Where are waitlist and disruption policies explained?",
        answer:
          "See the Operational Policies chapters in this guide and the Operational Policies FAQ.",
      },
    ]),
    troubleshootingSection([
      "Pending verification: complete documents and wait for staff email.",
      "Payment issues: retain transaction references and open a Support Ticket with booking ID.",
    ]),
    supportSection(),
  ],
};

import {
  type UserGuideContent,
  bookingStatusSection,
  notificationsSection,
  supportSection,
  bestPracticesSection,
} from "../types";

export const startupGuide: UserGuideContent = {
  audience: "startup",
  audienceLabel: "Startup Users",
  title: "Startup User Guide",
  subtitle: "IITR-incubated startups and external Startup/MSME accounts",
  welcomeHeadline: "Welcome, Startup User",
  welcomeBody:
    "Startup and MSME accounts use the IIC booking portal to access instrumentation with category-specific rates. Depending on whether you are incubated at IIT Roorkee or registering as an external startup/MSME, payment and eligibility rules differ slightly — this guide covers both.",
  sections: [
    {
      id: "welcome",
      title: "Welcome",
      paragraphs: [
        "The Online Equipment Booking System connects startups with IIC laboratories for characterisation, testing, and development work.",
        "You can discover equipment, estimate charges for your startup category, book slots, manage samples, and pay according to your account type.",
      ],
      bullets: [
        "Browse instruments relevant to product and R&D work",
        "Book with startup / MSME pricing where configured",
        "Track samples and results online",
        "Get help via equipment-linked support tickets",
      ],
    },
    {
      id: "access",
      title: "What You Can Access",
      paragraphs: [
        "Two common startup paths exist on this portal — privileges follow your registered user type.",
      ],
      bullets: [
        "Startup Incubated at IIT Roorkee — often treated closer to internal/incubator rules with specialised rates.",
        "External Startup/MSME — follows external booking windows, GST-aware charging, and online payment flows.",
        "I-STEM acknowledgement may be required before external-style bookings.",
        "Not all instruments are open to every category; unpublished or restricted labs will not appear for booking.",
        "Wallet vs online payment depends on whether your account is incubator-linked internal or fully external.",
      ],
      callouts: [
        "If you are unsure which path applies, check Profile → user type, or raise a Support Ticket before your first paid booking.",
      ],
    },
    {
      id: "profile",
      title: "Registration & Profile",
      paragraphs: ["Accurate organisation details keep invoices and lab records clean."],
      bullets: [
        "Complete organisation name, contacts, and department/incubator linkage.",
        "Finish email verification and any admin approval steps.",
        "For external startups: confirm I-STEM registration when prompted.",
        "Keep billing/GST fields updated when the portal requests external billing information.",
      ],
    },
    {
      id: "booking",
      title: "Booking Workflow",
      paragraphs: ["A typical startup booking:"],
      bullets: [
        "Find equipment → open details → Calculate Charges using your startup category.",
        "Review accessories and sample preparation notes carefully for product samples.",
        "Book available slots within your allowed window.",
        "Complete wallet debit or online payment as directed until status is Booked.",
        "Monitor My Bookings for sample deadlines and lab messages.",
      ],
    },
    {
      id: "samples",
      title: "Sample Submission Process",
      paragraphs: [
        "Startup samples may be proprietary — still follow lab labelling, safety, and deadline rules.",
      ],
      bullets: [
        "Submit before the published deadline; reminders include advance countdown notices.",
        "Declare atmosphere-sensitive needs only when the instrument supports that option.",
        "Ask the lab (via ticket) before sending hazardous or unusual materials.",
        "Collect results promptly after Completed status.",
      ],
    },
    {
      id: "payments",
      title: "Payments & Charges",
      paragraphs: [
        "Startup pricing is category-specific. Incubated startups may use institute wallet/grant paths; external startups/MSMEs usually pay online.",
      ],
      bullets: [
        "Always verify the quote on Calculate Charges before confirming.",
        "External path: complete Awaiting payment via the online gateway; retain invoices/receipts.",
        "Incubator/internal path: ensure the correct wallet is funded.",
        "Unresolved payment may release the reserved slot.",
      ],
    },
    bookingStatusSection(),
    notificationsSection([
      "Payment confirmation emails are critical for external startup bookings — whitelist institute mailers.",
    ]),
    supportSection(),
    {
      id: "faq",
      title: "Frequently Asked Questions",
      paragraphs: ["Startup FAQs:"],
      bullets: [
        "Incubated vs external — which am I? — Check your Profile user type label; contact support if it looks wrong.",
        "Can I get academic rates? — Rates follow your registered category, not personal preference.",
        "NDA / confidentiality — Raise a ticket with the lab before booking if you need special handling.",
        "Multiple team members — Each user needs an account; do not share logins.",
      ],
    },
    bestPracticesSection([
      "Plan characterisation into your product sprint so payment and sample logistics are not last-minute.",
      "Cancel early if a prototype iteration slips — slots are scarce on popular tools.",
    ]),
  ],
};

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

export const externalGuide: UserGuideContent = {
  audience: "external",
  audienceLabel: "External Users",
  title: "External User Guide",
  subtitle: `${PRODUCT_NAME} — registration, KYC, booking, and payments for external organisations`,
  welcomeHeadline: `Welcome to the ${PRODUCT_NAME}`,
  welcomeBody: `This portal lets your organisation book laboratory equipment across participating departments, centres, and laboratories at IIT Roorkee, track samples and results, and manage payments. This guide explains registration, your first booking, and common external workflows.`,
  sections: [
    purposeSection({
      paragraphs: [
        `The ${PRODUCT_NAME} is the official channel for reserving analytical and specialised instruments at IIT Roorkee for eligible external categories (educational institutes, R&D, industry, and other approved types).`,
      ],
      bullets: [
        "Register and complete document / KYC requirements when prompted",
        "Browse published equipment and transparent charge profiles",
        "Book slots subject to external booking windows and policies",
        "Track sample submission, payments, and online results",
      ],
    }),
    loginAccountSection({
      paragraphs: [
        "External users create an account on the Auth page (email/password) rather than Channel i campus SSO.",
      ],
      bullets: [
        "Register with an organisational email when possible.",
        "Upload required documents; if you use a public email, download and upload the signed KYC form as instructed.",
        "Await verification where required before full booking access.",
        "Sign in anytime from Auth; update Profile contacts for notifications.",
      ],
      callouts: [
        "Keep organisation and GST details accurate — they may appear on invoices and requisition forms.",
      ],
    }),
    {
      id: "book-workflow",
      title: "First Booking Workflow",
      paragraphs: [
        "External bookings may use reserved windows, payment steps, and document requirements that differ from campus users.",
      ],
      steps: [
        {
          title: "Complete registration",
          body: "Finish profile and document uploads. Wait for approval if your account shows pending verification.",
          screenshotCaption: "Auth / registration document upload",
        },
        {
          title: "Select equipment",
          body: "Browse the catalog, open details, and review external charge rates and sample instructions.",
          screenshotCaption: "Equipment details for external rates",
        },
        {
          title: "Book within the allowed window",
          body: "Use the calendar to select eligible slots. Confirm and complete any payment or invoice step shown.",
          screenshotCaption: "External booking calendar",
        },
        {
          title: "Submit samples and track status",
          body: "Follow sample submission deadlines on the booking. Download results from My Bookings when published.",
          screenshotCaption: "My Bookings — sample deadline and results",
        },
      ],
    },
    bookingStatusSection({
      extraBullets: [
        "Awaiting payment is common for external paths — complete payment promptly to secure the slot.",
      ],
    }),
    notificationsSection(),
    bestPracticesSection([
      "Download and retain proforma invoices / payment references for your accounts team.",
      "Label samples clearly with booking ID as instructed by the lab.",
    ]),
    permissionsSection({
      paragraphs: [
        "External accounts book under external charge profiles and policy windows. Campus-only features (Channel i, internal wallets) do not apply.",
      ],
      bullets: [
        "You manage bookings and documents for your organisation account.",
        "You cannot access lab operations, department administration, or internal wallet tools.",
        "Some instruments may be campus-only or require additional lab approval.",
      ],
    }),
    faqSection([
      {
        question: "Why is my account pending?",
        answer:
          "External verification or document review may be required. Complete KYC/document uploads and wait for staff confirmation; check email for updates.",
      },
      {
        question: "How do I get the KYC form?",
        answer:
          "On registration, use the Download IIT Roorkee KYC Form link, then upload a signed scan with the KYC document type.",
      },
      {
        question: "Can I cancel an external booking?",
        answer:
          "Yes, subject to cancellation windows and refund policy shown for that booking. Cancel early when possible.",
      },
    ]),
    troubleshootingSection([
      "If login fails, reset password from Auth and confirm you are using the registered email.",
      "Missing equipment may mean it is not published for external booking — contact support with the instrument name.",
      "Payment pending longer than expected: check spam for payment links and raise a ticket with booking ID.",
    ]),
    supportSection(),
  ],
};

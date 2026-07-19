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

export const projectStaffGuide: UserGuideContent = {
  audience: "project_staff",
  audienceLabel: "Project Staff",
  title: "Project Staff User Guide",
  subtitle: `${PRODUCT_NAME} — project-funded booking with PI wallet support`,
  welcomeHeadline: "Welcome, project staff",
  welcomeBody: `Project staff book laboratory equipment much like students and faculty: internal rates when eligible, wallet or grant funding through the project PI, and the same sample workflows. This guide focuses on your access pattern and staying aligned with your faculty supervisor on the ${PRODUCT_NAME}.`,
  sections: [
    purposeSection({
      paragraphs: [
        `The ${PRODUCT_NAME} serves researchers across IIT Roorkee, including project-funded staff working in participating departments, centres, and laboratories.`,
      ],
      bullets: [
        "Book eligible equipment for project work",
        "Pay via PI / faculty wallets when linked",
        "Track samples, deadlines, and online results",
        "Use waitlist and cancellation features when enabled",
      ],
    }),
    loginAccountSection({
      paragraphs: [
        "Use Channel i when available for campus accounts, or the credentials issued for your portal profile.",
      ],
      bullets: [
        "Sign in from Auth and confirm your Profile details.",
        "Request wallet access from your PI/faculty if bookings require a linked wallet.",
        "Keep programme / project validity dates accurate on your profile when shown.",
      ],
    }),
    {
      id: "book-workflow",
      title: "Booking for Project Work",
      paragraphs: ["Follow the standard live-calendar booking path used by internal users."],
      steps: [
        {
          title: "Confirm wallet access",
          body: "Ensure your PI has approved any wallet join request before peak booking times.",
          screenshotCaption: "Wallet join / membership status",
        },
        {
          title: "Select equipment and slots",
          body: "Browse Equipments, review charges, and reserve consecutive free slots.",
          screenshotCaption: "Booking calendar",
        },
        {
          title: "Complete confirmation",
          body: "Confirm booking and wallet debit. Monitor My Bookings for sample deadlines and results.",
          screenshotCaption: "My Bookings list",
        },
      ],
    },
    bookingStatusSection(),
    notificationsSection(),
    bestPracticesSection([
      "Align booking dates with project milestones and PI availability for approvals.",
    ]),
    permissionsSection({
      paragraphs: ["You book as an end user. Lab and department administration tools are outside this role."],
      bullets: [
        "You manage your own bookings only.",
        "Wallet funding depends on PI approval and balance.",
        "Urgent/repeat-sample features appear only when the lab enables them.",
      ],
    }),
    faqSection([
      {
        question: "My alias shows project staff — does that change rates?",
        answer:
          "Charge profiles follow your user type and equipment configuration. Confirm Calculate Charges before booking if unsure.",
      },
      {
        question: "Who approves my wallet join?",
        answer: "Usually your faculty PI / wallet owner. Ask them to check Wallet join requests on their dashboard.",
      },
    ]),
    troubleshootingSection([
      "If booking is blocked for payment, verify wallet membership and balance with your PI.",
      "Calendar conflicts: pick another free slot; the previous one may have been taken.",
    ]),
    supportSection(),
  ],
};

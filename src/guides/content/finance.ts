import {
  type UserGuideContent,
  PRODUCT_NAME,
  loginAccountSection,
  troubleshootingSection,
  permissionsSection,
  faqSection,
  purposeSection,
  notificationsSection,
  supportSection,
  bestPracticesSection,
} from "../types";

export const financeGuide: UserGuideContent = {
  audience: "finance",
  audienceLabel: "Accounts In Charge",
  title: "Accounts In Charge User Guide",
  subtitle: `${PRODUCT_NAME} — department payment and receipt workflows`,
  welcomeHeadline: "Welcome, Accounts In Charge",
  welcomeBody: `As Accounts In Charge you process payment receipts and support department finance workflows in the ${PRODUCT_NAME}. This guide covers sign-in, receipt processing, and how your role relates to Department Administrators and Officer-in-Charge users.`,
  sections: [
    purposeSection({
      paragraphs: [
        "You verify and process user payment / recharge receipts for your department so bookings and wallets stay accurate.",
        "Your dashboard emphasises finance queues rather than end-user booking cards.",
      ],
      bullets: [
        "Review pending payment receipts for your department",
        "Mark receipts processed with remarks when required",
        "Coordinate with Dept Admin / OIC when payment status blocks bookings",
        "Keep profile contact details current for operational notices",
      ],
    }),
    loginAccountSection({
      paragraphs: [
        "Sign in with the staff credentials or Channel i path provided for your campus account.",
      ],
      bullets: [
        "After login you land on Dashboard — open finance / payment receipt tools from there.",
        "Use User Guide from the menu anytime to reopen these instructions.",
      ],
    }),
    {
      id: "receipts",
      title: "Payment Receipts",
      paragraphs: [
        "Process receipts promptly so users are not left waiting on wallet or booking confirmation.",
      ],
      steps: [
        {
          title: "Open the receipts queue",
          body: "From Dashboard, open Payment Receipts (or the finance module assigned to your role).",
        },
        {
          title: "Verify the payment",
          body: "Match UTR / amount / user details against bank records before marking processed.",
        },
        {
          title: "Complete with remarks",
          body: "Add clear remarks when rejecting or clarifying a receipt so the user and Dept Admin understand next steps.",
        },
      ],
    },
    notificationsSection([
      "Watch email and in-app notifications for new receipts needing attention.",
    ]),
    permissionsSection({
      paragraphs: [
        "Your access is limited to Accounts In Charge tools for your assigned department unless Admin grants additional modules.",
      ],
      bullets: [
        "You do not configure department-wide credit facility or OIC mappings — those belong to Department Administrators.",
        "Escalate disputed payments to Dept Admin or Institute Admin as needed.",
      ],
    }),
    bestPracticesSection([
      "Never mark a receipt processed without verifying the bank credit.",
      "Use consistent remarks so finance audits remain readable.",
    ]),
    troubleshootingSection([
      "If a receipt is missing or a user cannot book after payment, confirm processing status and escalate.",
    ]),
    supportSection(),
    faqSection([
      {
        question: "Where do I reopen this guide?",
        answer: "User menu → User Guide, or the User Guide link in the footer when signed in.",
      },
    ]),
  ],
};

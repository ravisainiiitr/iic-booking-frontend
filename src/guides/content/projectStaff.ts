import {
  type UserGuideContent,
  bookingStatusSection,
  notificationsSection,
  supportSection,
  bestPracticesSection,
} from "../types";

export const projectStaffGuide: UserGuideContent = {
  audience: "project_staff",
  audienceLabel: "Project Staff",
  title: "Project Staff User Guide",
  subtitle: "Post-doctoral fellows, research associates, and project researchers",
  welcomeHeadline: "Welcome, Project Staff",
  welcomeBody:
    "Project staff book IIC equipment much like students and faculty: internal rates, wallet or grant funding through the project PI, and the same sample workflows. This guide focuses on your access pattern and how to stay aligned with your faculty supervisor.",
  sections: [
    {
      id: "welcome",
      title: "Welcome",
      paragraphs: [
        "The Online Equipment Booking System serves Institute Instrumentation Centre users across IIT Roorkee, including project-funded researchers.",
        "Your account type sits under the internal student/researcher framework with an alias that identifies you as project staff or a post-doctoral fellow.",
      ],
      bullets: [
        "Book eligible IIC equipment for project work",
        "Pay via linked faculty / project wallets",
        "Track samples, results, and support tickets",
      ],
    },
    {
      id: "access",
      title: "What You Can Access",
      paragraphs: [
        "You receive internal booking privileges similar to IITR students, subject to lab publication and your program validity dates.",
      ],
      bullets: [
        "Internal charge rates where the lab publishes them for your category.",
        "Wallet-backed bookings through your PI / faculty supervisor.",
        "Full My Bookings, sample deadline, and disruption response tools.",
        "Restrictions: you are not faculty wallet owners; funding must be authorised by the PI.",
        "Access may end when project or program validity dates expire — renew documents on time.",
      ],
    },
    {
      id: "profile",
      title: "Registration & Profile",
      paragraphs: ["Complete profile details so the lab and finance teams can identify your project affiliation."],
      bullets: [
        "Confirm department, designation, and contact numbers.",
        "Link the correct faculty supervisor / PI for wallet access.",
        "Keep program start/end dates accurate to avoid access-on-hold.",
        "Submit documentary evidence promptly if revalidation is requested.",
      ],
    },
    {
      id: "booking",
      title: "Booking Workflow",
      paragraphs: ["Project bookings follow the internal path:"],
      bullets: [
        "Search equipment → review details, accessories, and charges.",
        "Check calendar availability and create the booking.",
        "Select the authorised wallet / grant when prompted.",
        "Confirm Booked status and note sample deadlines.",
        "Coordinate with your PI if balance or approval is insufficient.",
      ],
    },
    {
      id: "samples",
      title: "Sample Submission Process",
      paragraphs: [
        "Treat sample deadlines as project milestones — missed samples waste funded slots.",
      ],
      bullets: [
        "Submit before the countdown reaches zero; reminders are sent by email and on the dashboard.",
        "Use atmosphere-sensitive options only when scientifically required and supported.",
        "Follow lab acceptance rules and collect results when the booking is completed.",
      ],
    },
    {
      id: "payments",
      title: "Payments & Charges",
      paragraphs: [
        "Charges debit the linked faculty/project wallet. Online external payment is not the primary path for project staff.",
      ],
      bullets: [
        "Confirm with your PI which grant/wallet to use before large campaigns.",
        "Monitor booking cost estimates with Calculate Charges.",
        "Receipts appear against the wallet; your PI may reconcile project spend from Wallet history.",
      ],
    },
    bookingStatusSection(),
    notificationsSection(),
    supportSection(),
    {
      id: "faq",
      title: "Frequently Asked Questions",
      paragraphs: ["Project staff FAQs:"],
      bullets: [
        "Why do I look like a “student” type? — The portal stores project researchers under the internal student framework with a project/PDF alias.",
        "Wallet link failed — Ask your PI to accept/link you and ensure the wallet allows your bookings.",
        "Project ended but I need one more run — Update program validity / documents or request a short extension with admin support.",
        "Can I approve student wallets? — No; wallet ownership and faculty approvals stay with faculty accounts.",
      ],
    },
    bestPracticesSection([
      "Share booking IDs with your PI for project reporting.",
      "Cancel promptly if experimental plans change after funding is reserved.",
    ]),
  ],
};

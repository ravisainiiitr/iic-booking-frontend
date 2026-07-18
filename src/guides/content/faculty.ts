import {
  type UserGuideContent,
  bookingStatusSection,
  notificationsSection,
  bestPracticesSection,
} from "../types";

export const facultyGuide: UserGuideContent = {
  audience: "faculty",
  audienceLabel: "Faculty Members",
  title: "Faculty User Guide",
  subtitle: "IIT Roorkee faculty — Channel i, wallets, urgent requests, and group supervision",
  welcomeHeadline: "Welcome, Faculty Member",
  welcomeBody:
    "Faculty accounts combine personal booking rights with wallet funding and approval tools for students and project staff. Your name is shown with the Prof. prefix across the portal. This guide highlights Channel i login and the internal features that make IIC booking efficient for research groups.",
  sections: [
    {
      id: "welcome",
      title: "Welcome",
      paragraphs: [
        "The Online Equipment Booking System is the institute channel for IIC instrument reservations at IIT Roorkee.",
        "As faculty you book at internal rates, fund wallets for your group, approve urgent research requests, and supervise student bookings that debit your grants.",
      ],
      bullets: [
        "Channel i single sign-on for campus identity",
        "Real-time slot booking and FCFS waitlists",
        "Full / partial cancellation within time limits",
        "Urgent requests for time-critical experiments",
        "Online results on the dashboard for you and your students",
      ],
    },
    {
      id: "channel-i",
      title: "Channel i Login",
      paragraphs: [
        "Sign in with Channel i (Omniport) on the Auth page for secure campus authentication.",
      ],
      bullets: [
        "Choose Channel i / Omniport → authenticate with institute credentials → return signed in.",
        "Benefits: SSO security, fewer local passwords, correct linkage to faculty identity and department.",
        "After login, verify Profile and Wallet settings so students can link to you.",
      ],
    },
    {
      id: "access",
      title: "What You Can Access",
      paragraphs: [
        "Faculty are full internal users with funding and, when enabled, approval dashboards.",
      ],
      bullets: [
        "Internal faculty charge profiles on published equipment.",
        "Wallet / grant-code recharges and transaction history.",
        "Students and project staff may debit your wallet when correctly linked.",
        "Urgent-request approval, nominations, and related modules when assigned to you.",
        "Your display name appears as Prof. followed by your name in bookings, tickets, and communications.",
      ],
    },
    {
      id: "realtime-booking",
      title: "Real-Time Booking",
      paragraphs: [
        "Equipment calendars show live availability. Book consecutive slots for your own experiments the same way students do.",
      ],
      bullets: [
        "Browse Equipments → Calculate Charges (faculty rates) → select live free slots → confirm via wallet.",
        "Conflicts are validated in real time; waitlist if the instrument is full.",
        "Track everything under My Bookings with sample deadlines and result downloads.",
      ],
    },
    {
      id: "cancellation",
      title: "Full & Partial Cancellation",
      paragraphs: [
        "Cancel entire bookings or partial multi-slot ranges when the portal offers that action.",
      ],
      bullets: [
        "Allowed only within institutional time limits before slot start.",
        "Early cancellation frees capacity and can auto-promote the next FCFS waitlisted user.",
        "Coordinate with students who booked on your wallet so they cancel unused slots too.",
      ],
    },
    {
      id: "waitlist",
      title: "Waiting List (FCFS)",
      paragraphs: [
        "Internal faculty may join waitlists like other campus users.",
      ],
      bullets: [
        "Order is First-Come, First-Served.",
        "When a confirmed booking is cancelled, the first eligible waitlisted request is automatically promoted.",
        "Respond quickly to promotion notices so payment and sample deadlines are met.",
      ],
    },
    {
      id: "urgent",
      title: "Urgent Booking Requests",
      paragraphs: [
        "Faculty can initiate urgent requests when research cannot wait for normal calendars — for example additional experiments after reviewer comments or publication deadlines.",
      ],
      bullets: [
        "Automatic path: users with repeated failed booking attempts may become eligible under system policy.",
        "Faculty-initiated path: raise an urgent request describing scientific urgency; wallet approval and lab/OIC decision follow.",
        "Approve student/group urgent requests from User menu → Urgent requests (approve) when that module is enabled.",
        "Track outcomes via dashboard cards and email notifications.",
      ],
      callouts: [
        "Urgent capacity is limited — reserve it for genuine research time pressure, not routine scheduling.",
      ],
    },
    {
      id: "repeat-sample",
      title: "Repeat Sample Facility",
      paragraphs: [
        "If laboratory operational error spoils a run, a repeat sample may be authorised without a fresh charge.",
      ],
      bullets: [
        "Eligibility: fault on the lab/ops side, within policy windows.",
        "Request from the booking (or Support Ticket with booking ID); OIC/lab approves.",
        "Not applicable for user sample-preparation mistakes.",
      ],
    },
    {
      id: "disruption",
      title: "Disruption Policy",
      paragraphs: [
        "Breakdowns and unexpected maintenance surface as disruption statuses on bookings.",
      ],
      bullets: [
        "You (or your student) may be asked to reschedule, cancel, or choose another option.",
        "Facility-caused disruptions follow compensation / free-reschedule rules published by IIC.",
        "Keep notifications on so group bookings are not left unanswered.",
      ],
    },
    {
      id: "results",
      title: "Online Result Availability",
      paragraphs: [
        "Results are uploaded to the booking record. Faculty and students download them from the dashboard.",
      ],
      bullets: [
        "No routine need to collect paper reports from the lab in person.",
        "Advise students to check My Bookings after Completed status.",
      ],
    },
    {
      id: "atmosphere",
      title: "Atmosphere-Sensitive Samples",
      paragraphs: [
        "When an instrument supports it, atmosphere-sensitive samples may be submitted up to slot start to reduce degradation.",
      ],
      bullets: [
        "Selecting the option adjusts sample countdown / deadline behaviour accordingly.",
        "Use only when scientifically required.",
      ],
    },
    {
      id: "payments",
      title: "Payments & Charges",
      paragraphs: [
        "Faculty payments are grant/wallet based. Online gateway payment is for external categories.",
      ],
      bullets: [
        "Recharge wallets via approved SRIC / grant workflows in Wallet.",
        "Enable low-balance alerts so student bookings are not blocked mid-week.",
        "Reconcile Wallet history with group usage regularly.",
      ],
    },
    {
      id: "profile",
      title: "Registration & Profile",
      paragraphs: ["Keep faculty profile and wallet settings current after Channel i login."],
      bullets: [
        "Confirm department and contacts under Profile.",
        "Review linked students so only intended users charge your wallet.",
        "Your name is automatically prefixed with Prof. in the UI and outbound communications.",
      ],
    },
    bookingStatusSection({
      extraBullets: [
        "Student bookings on your wallet may generate related notifications for you as funder.",
      ],
    }),
    notificationsSection([
      "Wallet low-balance, urgent-approval, waitlist promotion, and disruption alerts.",
    ]),
    {
      id: "support",
      title: "Support Ticket System",
      paragraphs: [
        "Raise and track tickets for lab questions, booking disputes, or equipment issues.",
      ],
      bullets: [
        "User menu → Support Tickets, or equipment-page Raise Support Request.",
        "Conversation thread + status updates by email and in-app notification.",
        "Include booking ID for fastest routing to the Officer In Charge.",
      ],
    },
    {
      id: "faq",
      title: "Frequently Asked Questions",
      paragraphs: ["Faculty FAQs:"],
      bullets: [
        "Student cannot book on my wallet — Confirm link, balance, and permissions.",
        "How do I fund the wallet? — Wallet recharge / grant-code flows; Support if stuck.",
        "Where do I approve urgent requests? — User menu → Urgent requests (approve).",
        "Why does my name show as Prof.? — Automatic for faculty accounts across the portal.",
      ],
    },
    bestPracticesSection([
      "Set clear rules with students on who may book and which grants to use.",
      "Cancel unused group slots early to feed the FCFS waitlist fairly.",
    ]),
  ],
};

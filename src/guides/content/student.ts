import {
  type UserGuideContent,
  bookingStatusSection,
  notificationsSection,
  supportSection,
  bestPracticesSection,
} from "../types";

export const studentGuide: UserGuideContent = {
  audience: "student",
  audienceLabel: "Internal Students",
  title: "Student User Guide",
  subtitle: "IIT Roorkee students — Channel i, real-time booking, waitlist, and campus features",
  welcomeHeadline: "Welcome, IIT Roorkee student",
  welcomeBody:
    "As an internal IIT Roorkee user you have access to powerful features: Channel i login, live slot booking, waitlists, partial cancellation, urgent requests, repeat samples, disruption handling, and online results. This guide explains each one so you can use the portal confidently from day one.",
  sections: [
    {
      id: "welcome",
      title: "Welcome",
      paragraphs: [
        "The Online Equipment Booking System is the official campus channel for reserving Institute Instrumentation Centre (IIC) instruments at IIT Roorkee.",
        "Students book at internal rates, typically paying via a linked faculty or department wallet.",
      ],
      bullets: [
        "Browse and book eligible equipment in real time",
        "Join FCFS waitlists when slots are full",
        "Cancel fully or partially within institutional time limits",
        "Download results from your dashboard — usually no lab visit needed",
      ],
    },
    {
      id: "channel-i",
      title: "Channel i Login",
      paragraphs: [
        "Internal IIT Roorkee users should sign in with Channel i (Omniport) wherever that option is shown on the Auth page.",
      ],
      bullets: [
        "Click the Channel i / Omniport login button on the sign-in screen.",
        "Authenticate with your institute credentials on the Channel i portal.",
        "You are redirected back to the booking system already signed in — no separate password for most campus accounts.",
        "Benefits: secure campus SSO, fewer password resets, and automatic linkage to your institute identity.",
      ],
      callouts: [
        "If Channel i login fails, use the support ticket system or contact IIC — do not share passwords.",
      ],
    },
    {
      id: "access",
      title: "What You Can Access",
      paragraphs: [
        "Internal student accounts see campus booking windows and student-eligible charge profiles.",
      ],
      bullets: [
        "Internal student rates (typically lower than external categories).",
        "Wallet-backed payment through your faculty supervisor when required.",
        "Waitlist, urgent request, and repeat-sample features when enabled for the equipment/lab.",
        "Program validity dates may limit access — keep profile dates current.",
      ],
    },
    {
      id: "realtime-booking",
      title: "Real-Time Booking",
      paragraphs: [
        "Availability is live. When you open an equipment page and the booking calendar, you see current free and occupied slots.",
      ],
      bullets: [
        "Search Equipments → open View Details & Charges → review accessories and Calculate Charges.",
        "Select consecutive slots for the duration you need; the system validates conflicts in real time.",
        "Confirm booking and complete wallet selection when prompted.",
        "Status moves to Booked (or Awaiting payment / Waitlisted depending on the path).",
        "Popular instruments fill quickly — book as soon as your experimental plan is clear.",
      ],
    },
    {
      id: "cancellation",
      title: "Full & Partial Cancellation",
      paragraphs: [
        "You may cancel an entire booking or, where the lab allows, cancel part of a multi-slot booking.",
      ],
      bullets: [
        "Open My Bookings → select the booking → use Cancel (full) or partial-cancel controls when offered.",
        "Cancellations are allowed only within the prescribed institutional time limits before the slot start.",
        "Late cancellations may be blocked or treated as Booking Not Utilized per lab policy.",
        "Cancelling early returns capacity to others and can promote the next waitlisted user.",
      ],
      callouts: [
        "Always cancel unused slots promptly — unused bookings waste funded capacity and may affect future privileges.",
      ],
    },
    {
      id: "waitlist",
      title: "Waiting List (FCFS)",
      paragraphs: [
        "When no suitable slot is free, internal users can join the equipment waiting list.",
      ],
      bullets: [
        "Waitlists are maintained on a First-Come, First-Served (FCFS) basis.",
        "If a confirmed booking is cancelled (within rules), the first eligible waiting-list request is automatically promoted to a confirmed booking.",
        "You receive email / in-app notification when promoted — check payment or sample deadlines immediately.",
        "Track waitlisted bookings under My Bookings (status: Waitlisted).",
      ],
    },
    {
      id: "urgent",
      title: "Urgent Booking Requests",
      paragraphs: [
        "Two urgent paths exist for internal users (subject to system and lab policy):",
      ],
      bullets: [
        "Automatic consideration — if you repeatedly fail to obtain a slot despite multiple genuine attempts, the system may flag eligibility for urgent handling under configured rules.",
        "Faculty-initiated urgent requests — your faculty supervisor can raise an urgent request for time-critical research (e.g. reviewer comments, publication deadlines).",
        "Workflow: request is submitted → wallet/faculty approval if required → lab/OIC decision → you are notified of approval or rejection.",
        "Use Dashboard / My Urgent Requests to track status; do not treat urgent requests as a substitute for normal advance booking.",
      ],
    },
    {
      id: "repeat-sample",
      title: "Repeat Sample Facility",
      paragraphs: [
        "If a sample run fails because of an operational mistake by laboratory personnel, you may be eligible for a repeat sample without a new charge (subject to approval).",
      ],
      bullets: [
        "Eligibility: error attributable to lab operations (not user sample preparation fault), within the lab’s repeat-sample policy window.",
        "Raise the request from the booking detail / repeat-sample action when available, or via Support Ticket referencing the booking ID.",
        "Lab/OIC reviews and approves or declines; you are notified of the outcome.",
        "Conditions: one repeat per incident is typical; abuse or user-side sample issues are not covered.",
      ],
    },
    {
      id: "disruption",
      title: "Disruption Policy",
      paragraphs: [
        "Equipment can break down or require unexpected maintenance. The portal surfaces disruption statuses so you can choose how to proceed.",
      ],
      bullets: [
        "Statuses such as Under Maintenance, Other Disruption, or Awaiting your choice (disruption) appear on affected bookings.",
        "You may be offered reschedule, cancel, or hold options — respond promptly from My Bookings / dashboard alerts.",
        "Compensation or free reschedule follows institutional / lab rules for disruption caused by the facility.",
        "Watch email and in-app notifications during disruption events.",
      ],
    },
    {
      id: "results",
      title: "Online Result Availability",
      paragraphs: [
        "Test reports and result files are published to your booking on the portal whenever the lab uploads them.",
      ],
      bullets: [
        "Open My Bookings → booking detail to download results from your dashboard.",
        "You generally do not need to visit the laboratory in person to collect reports.",
        "You still receive completion notifications by email when configured.",
      ],
    },
    {
      id: "atmosphere",
      title: "Atmosphere-Sensitive Samples",
      paragraphs: [
        "Some equipment offers an atmosphere-sensitive sample option so you can bring/submit samples closer to the slot start and reduce degradation risk.",
      ],
      bullets: [
        "Enable the option only when your sample truly requires it and the instrument supports it.",
        "When selected, sample submission deadlines / countdown timers may extend up to the start of the booked slot (per lab configuration).",
        "Standard (non-sensitive) samples still follow the usual lead-time deadline — plan accordingly.",
      ],
    },
    {
      id: "samples",
      title: "Sample Submission Process",
      paragraphs: [
        "Most runs require physical sample submission before the slot. Deadlines are enforced.",
      ],
      bullets: [
        "Note the deadline on your booking; dashboard and email reminders (including advance warnings) help you submit on time.",
        "Lab staff accept or reject samples per published rules.",
        "After Completed status, collect results online as described above.",
      ],
    },
    {
      id: "payments",
      title: "Payments & Charges",
      paragraphs: [
        "Student bookings normally debit a linked faculty/department wallet — not personal cards.",
      ],
      bullets: [
        "Link your supervisor’s wallet from Wallet / Profile before booking.",
        "Use Calculate Charges for student rates and accessories.",
        "Insufficient balance blocks confirmation — ask your faculty to recharge or approve funding.",
      ],
    },
    {
      id: "profile",
      title: "Registration & Profile",
      paragraphs: ["Complete your profile after first Channel i login."],
      bullets: [
        "Confirm department, branch, degree, and phone under Profile.",
        "Link the correct faculty supervisor for wallet access.",
        "Keep program validity dates updated to avoid access-on-hold.",
      ],
    },
    bookingStatusSection(),
    notificationsSection([
      "Waitlist promotion and disruption choice alerts are especially important for students.",
    ]),
    {
      id: "support",
      title: "Support Ticket System",
      paragraphs: [
        "Use the integrated support system for booking issues, equipment questions, and lab communication.",
      ],
      bullets: [
        "Raise a ticket from User menu → Support Tickets, or Raise Support Request on an equipment page.",
        "Track status (Open / In Progress / Resolved) and reply in the conversation thread.",
        "Receive email and in-app updates when staff respond or resolve the ticket.",
        "Mention booking ID and equipment code for faster routing to the Officer In Charge.",
      ],
    },
    {
      id: "faq",
      title: "Frequently Asked Questions",
      paragraphs: ["Common student questions:"],
      bullets: [
        "Channel i vs email login — Prefer Channel i for campus accounts.",
        "Wallet not linked — Link faculty under Wallet; ask supervisor to approve if needed.",
        "Why waitlisted? — No free slot; FCFS promotion happens when someone cancels.",
        "Can I cancel part of a booking? — Yes when the UI offers partial cancel and you are within time limits.",
        "Where are my results? — My Bookings → booking detail downloads.",
      ],
    },
    bestPracticesSection([
      "Book early for popular tools; use waitlist instead of last-minute urgent requests when possible.",
      "Cancel unused capacity so FCFS waitlisted peers can proceed.",
    ]),
  ],
};

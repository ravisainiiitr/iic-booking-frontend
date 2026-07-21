/** Role-specific onboarding user guide types and shared section builders. */

export const PRODUCT_NAME = "Institute Equipment Booking Portal";
export const PRODUCT_NAME_SHORT = "Equipment Booking System";

export type GuideAudienceId =
  | "external"
  | "student"
  | "faculty"
  | "project_staff"
  | "startup"
  | "oic"
  | "operator"
  | "dept_admin"
  | "admin"
  | "finance"
  | "external_relations";

export interface GuideStep {
  title: string;
  body: string;
  screenshotCaption?: string;
}

export interface GuideFaq {
  question: string;
  answer: string;
}

export interface GuideSection {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
  callouts?: string[];
  steps?: GuideStep[];
  faqs?: GuideFaq[];
}

export interface UserGuideContent {
  audience: GuideAudienceId;
  audienceLabel: string;
  title: string;
  subtitle: string;
  welcomeHeadline: string;
  welcomeBody: string;
  sections: GuideSection[];
}

export const GUIDE_AUDIENCE_LABELS: Record<GuideAudienceId, string> = {
  external: "External Users",
  student: "Internal Students",
  faculty: "Internal Faculty",
  project_staff: "Project Staff",
  startup: "Startup Users",
  oic: "Equipment Officer-in-Charge",
  operator: "Lab In-Charge / Operator",
  dept_admin: "Department Administrator",
  admin: "Institute Administrator",
  finance: "Accounts In Charge",
  external_relations: "External Relations Administrator",
};

/** Shared booking status explanations used across end-user guides. */
export function bookingStatusSection(tweaks?: { extraBullets?: string[] }): GuideSection {
  return {
    id: "statuses",
    title: "Booking Statuses",
    paragraphs: [
      "Every booking moves through clearly labelled statuses. Checking My Bookings regularly helps you know what action (if any) is required from you.",
    ],
    bullets: [
      "Pending — Your request is submitted and awaiting confirmation or the next system step.",
      "Awaiting payment — Payment (or wallet debit confirmation) is required before the slot is fully secured.",
      "Waitlisted — No slot was free; you are on the waitlist and will be notified if a place opens.",
      "Booked — Your slot is confirmed. Note sample submission deadlines and arrival times.",
      "Awaiting your choice (disruption) — A lab disruption needs your decision (reschedule, cancel, etc.).",
      "Under Maintenance / Other Disruption / Hold — Lab-side holds; watch for emails and dashboard updates.",
      "Completed — Analysis/run finished successfully.",
      "Cancelled — Booking cancelled (by you or the lab, subject to policy).",
      "Operator Unavailable / Booking Not Utilized / Refunded — Special outcomes; refunds follow institute policy when applicable.",
      ...(tweaks?.extraBullets ?? []),
    ],
  };
}

export function notificationsSection(audienceNotes?: string[]): GuideSection {
  return {
    id: "notifications",
    title: "Notifications",
    paragraphs: [
      `The ${PRODUCT_NAME} keeps you informed by email and in-app notifications so you do not miss critical deadlines.`,
    ],
    bullets: [
      "Email — Booking confirmation, status changes, payment updates, and resolution of support tickets.",
      "In-app / dashboard — Alerts for pending actions, sample deadlines, and disruptions.",
      "Booking reminders — Ahead of your scheduled slot so you can prepare samples and documents.",
      "Sample submission / collection reminders — Including countdown-style notices before deadlines (for example, ahead of the sample submission cut-off).",
      "Support ticket updates — When staff reply, reassign, or resolve your request.",
      ...(audienceNotes ?? []),
    ],
    callouts: [
      "Keep your email and phone up to date under Profile so reminders reach you.",
    ],
  };
}

export function supportSection(): GuideSection {
  return {
    id: "support",
    title: "Support",
    paragraphs: [
      "Help is available directly from the portal whenever you have a booking, payment, or equipment question.",
    ],
    bullets: [
      "Raise a Support Ticket from the user menu (Support Tickets) or from an equipment page via Raise Support Request.",
      "Describe the issue clearly, attach a screenshot if useful, and mention your booking ID when relevant.",
      "For equipment-linked tickets raised from an instrument page, the Officer In Charge may be auto-assigned.",
      "Use the chat help widget for quick FAQ-style answers; escalate to a ticket for anything that needs follow-up.",
      "Laboratory contacts and OIC details appear on the equipment profile when published by the lab.",
    ],
  };
}

export function bestPracticesSection(extra?: string[]): GuideSection {
  return {
    id: "best-practices",
    title: "Best Practices",
    paragraphs: [
      "Following these habits keeps the labs running smoothly and protects your booking credits and timelines.",
    ],
    bullets: [
      "Book well in advance for popular instruments; check the weekly calendar before locking a slot.",
      "Review accessories and sample requirements on the equipment page before you book.",
      "Arrive on time with labelled samples and any required safety information.",
      "Follow laboratory safety and sample handling rules published by the facility.",
      "Cancel unused bookings promptly so others can use the slot and to avoid no-show outcomes.",
      "Track sample submission deadlines; late samples may not be accepted for that run.",
      ...(extra ?? []),
    ],
  };
}

export function loginAccountSection(opts: {
  paragraphs: string[];
  bullets: string[];
  callouts?: string[];
}): GuideSection {
  return {
    id: "login-account",
    title: "Login and Account Management",
    paragraphs: opts.paragraphs,
    bullets: opts.bullets,
    callouts: opts.callouts,
  };
}

export function troubleshootingSection(bullets: string[]): GuideSection {
  return {
    id: "troubleshooting",
    title: "Troubleshooting",
    paragraphs: [
      "Try these steps before raising a support ticket. Many issues resolve with a refresh, a different browser, or an updated profile.",
    ],
    bullets,
  };
}

export function permissionsSection(opts: {
  paragraphs: string[];
  bullets: string[];
  callouts?: string[];
}): GuideSection {
  return {
    id: "permissions",
    title: "Permissions and Limitations",
    paragraphs: opts.paragraphs,
    bullets: opts.bullets,
    callouts: opts.callouts,
  };
}

export function faqSection(faqs: GuideFaq[]): GuideSection {
  return {
    id: "faqs",
    title: "Frequently Asked Questions",
    paragraphs: [
      "Quick answers to questions users in your role ask most often.",
    ],
    faqs,
  };
}

export function purposeSection(opts: {
  paragraphs: string[];
  bullets: string[];
  callouts?: string[];
}): GuideSection {
  return {
    id: "purpose",
    title: "Purpose and Responsibilities",
    paragraphs: opts.paragraphs,
    bullets: opts.bullets,
    callouts: opts.callouts,
  };
}

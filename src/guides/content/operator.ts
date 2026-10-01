import {
  type UserGuideContent,
  PRODUCT_NAME,
  loginAccountSection,
  troubleshootingSection,
  permissionsSection,
  faqSection,
  purposeSection,
  notificationsSection,
  bestPracticesSection,
  supportSection,
} from "../types";
import { staffViewBookingSection, whatsNewSection } from "./recent";

export const operatorGuide: UserGuideContent = {
  audience: "operator",
  audienceLabel: "Lab Operator",
  title: "Lab Operator User Guide",
  subtitle: `${PRODUCT_NAME} — day-of-run operations for assigned equipment`,
  welcomeHeadline: "Welcome, Lab Operator",
  welcomeBody: `As Lab Operator (formerly Lab In-charge) you run day-of-slot operations on equipment assigned to you in the ${PRODUCT_NAME}. This guide covers View Booking, Intimate Unavailability, support tickets, and how your role differs from Officer-in-Charge.`,
  sections: [
    whatsNewSection("operator"),
    purposeSection({
      paragraphs: [
        "You support laboratory operations for instruments where you are assigned as operator.",
        "Your lab-style dashboard emphasises View Booking, the week calendar and Intimate Unavailability rather than end-user booking cards.",
      ],
      bullets: [
        "Complete bookings and mark not utilized for assigned equipment",
        "Intimate and track unavailability via Intimate Unavailability (no OIC approval needed)",
        "View equipment-performance style reports when available",
      ],
    }),
    loginAccountSection({
      paragraphs: [
        "Sign in with the staff credentials or Channel i path provided for your campus account.",
      ],
      bullets: [
        "Open Dashboard after login — look for View Booking, Intimate Unavailability and Support tickets.",
        "Keep Profile phone/email current for operational notifications.",
        "Use User Guide from the menu to reopen these instructions.",
      ],
    }),
    {
      id: "run-workflow",
      title: "Day-of-Run Workflow",
      paragraphs: [
        "Focus on completing scheduled work accurately so users receive timely status and results.",
      ],
      steps: [
        {
          title: "Review today’s queue",
          body: "Open View Booking and filter to your assigned equipment / today’s slots. Check Bookings awaiting completion on the dashboard for earlier runs not yet completed.",
          screenshotCaption: "Operator View Booking queue",
        },
        {
          title: "Receive samples / prepare the run",
          body: "Follow lab SOPs for sample intake, labelling, and instrument preparation before the slot.",
          screenshotCaption: "Booking detail — sample notes",
        },
        {
          title: "Complete or mark not utilized",
          body: "After the run, use Complete (and publish results per lab process) or Not Utilized when the user did not use the slot. Other exception actions are typically OIC/Admin only.",
          screenshotCaption: "Complete / Not Utilized actions",
        },
        {
          title: "Intimate unavailability when needed",
          body: "Use Intimate Unavailability so coverage can be planned. It is recorded as Submitted immediately and your OIC is informed by email — no approval is needed. This is not the Institute leave portal.",
          screenshotCaption: "Intimate Unavailability",
        },
      ],
    },
    {
      id: "common-tasks",
      title: "Common Tasks",
      paragraphs: ["These tasks keep the lab calendar trustworthy for users."],
      bullets: [
        "Ask the OIC to update slot status when a run cannot proceed as scheduled.",
        "Coordinate with the OIC for maintenance holds, refunds, disruptions, and reschedules.",
        "Raise and follow your own tickets from Support tickets on the dashboard.",
        "Open Reports for equipment-performance views when your permissions allow.",
      ],
    },
    staffViewBookingSection(),
    notificationsSection([
      "Unavailability intimation and duty-related emails when configured by administrators.",
      "Daily 9:00 AM reminder for bookings whose time is over but not yet marked completed.",
    ]),
    bestPracticesSection([
      "Complete bookings the same day the run finishes whenever possible.",
      "Escalate refunds, disruptions, and policy exceptions to the OIC promptly.",
      "Intimate unavailability early so Temporary OIC / coverage can be arranged.",
    ]),
    permissionsSection({
      paragraphs: [
        "Operator booking actions are intentionally limited compared with Officer-in-Charge.",
      ],
      bullets: [
        "Allowed on View Booking (typical): Complete and Not Utilized.",
        "Not typical for operators: refund, absent, maintenance/disruption, reschedule — use OIC/Admin.",
        "The dashboard shows Support tickets, but hides Book Equipment, Rate your experience and urgent booking cards for this role.",
        "Admin Settings appear only if Admin Panel Access is enabled for operators in your department.",
        "Equipment scope is limited to instruments assigned to you.",
      ],
    }),
    faqSection([
      {
        question: "Why can’t I refund a booking?",
        answer:
          "Refunds and most exception actions are reserved for Officer-in-Charge or Institute Admin. Ask your OIC to process the exception.",
      },
      {
        question: "Where do I raise a support ticket?",
        answer:
          "Click Support tickets on your dashboard to raise a ticket and follow the replies. Tickets marked to me lists any ticket assigned to you.",
      },
      {
        question: "How do I get access to another instrument?",
        answer:
          "Ask your Department Administrator or OIC to assign you as Lab Operator for that equipment.",
      },
    ]),
    troubleshootingSection([
      "No equipment listed: confirm operator assignment with Dept Admin.",
      "Action buttons missing: the booking may require an OIC, or it is already completed/cancelled.",
      "Intimate Unavailability form errors: refresh and ensure dates do not overlap existing unavailability entries.",
    ]),
    supportSection(),
  ],
};

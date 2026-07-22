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
} from "../types";

export const operatorGuide: UserGuideContent = {
  audience: "operator",
  audienceLabel: "Lab In-Charge / Operator",
  title: "Lab In-Charge / Operator User Guide",
  subtitle: `${PRODUCT_NAME} — day-of-run operations for assigned equipment`,
  welcomeHeadline: "Welcome, Lab In-Charge",
  welcomeBody: `As Lab In-Charge / Operator you run day-of-slot operations on equipment assigned to you in the ${PRODUCT_NAME}. This guide covers Booking Management limits, Operator Availability, team calendar, and how your role differs from Officer-in-Charge.`,
  sections: [
    purposeSection({
      paragraphs: [
        "You support laboratory operations for instruments where you are assigned as operator.",
        "Your lab-style dashboard emphasises Booking Management and Operator Availability rather than end-user booking cards.",
      ],
      bullets: [
        "Complete bookings and mark not utilized for assigned equipment",
        "Change slot status on the equipment calendar where permitted",
        "Intimate and track unavailability via Operator Availability",
        "View team calendar and equipment-performance style reports when available",
      ],
    }),
    loginAccountSection({
      paragraphs: [
        "Sign in with the staff credentials or Channel i path provided for your campus account.",
      ],
      bullets: [
        "Open Dashboard after login — look for Booking Management and Operator Availability.",
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
          body: "Open Booking Management and filter to your assigned equipment / today’s slots.",
          screenshotCaption: "Operator Booking Management queue",
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
          body: "Use Operator Availability so coverage can be planned; coordinate with your OIC for instrument coverage. This is not the Institute leave portal.",
          screenshotCaption: "Operator Availability",
        },
      ],
    },
    {
      id: "common-tasks",
      title: "Common Tasks",
      paragraphs: ["These tasks keep the lab calendar trustworthy for users."],
      bullets: [
        "Update slot status when a run cannot proceed as scheduled (within your allowed actions).",
        "Coordinate with the OIC for maintenance holds, refunds, disruptions, and reschedules.",
        "Check Team Calendar for overlapping duties across the lab.",
        "Open Reports for equipment-performance views when your permissions allow.",
      ],
    },
    notificationsSection([
      "Operator availability and duty-related emails when configured by administrators.",
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
        "Allowed on Booking Management (typical): Complete and Not Utilized.",
        "Not typical for operators: refund, absent, maintenance/disruption, reschedule — use OIC/Admin.",
        "Dashboard usually hides Book Equipment, Feedback, Support Tickets, and Urgent Request cards for this role.",
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
        question: "I don’t see Support Tickets on my dashboard — is that normal?",
        answer:
          "Yes for many Lab In-Charge dashboards. Coordinate ticket follow-up with the OIC or use any staff path your department provides.",
      },
      {
        question: "How do I get access to another instrument?",
        answer:
          "Ask your Department Administrator or OIC to assign you as Lab Incharge for that equipment.",
      },
    ]),
    troubleshootingSection([
      "No equipment listed: confirm operator assignment with Dept Admin.",
      "Action buttons missing: the booking may require an OIC, or it is already completed/cancelled.",
      "Operator Availability form errors: refresh and ensure dates do not overlap existing unavailability entries.",
    ]),
  ],
};

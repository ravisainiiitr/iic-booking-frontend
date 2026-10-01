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
import {
  bookingAssistantSection,
  oicConfigurationBullets,
  oicRecentToolsSection,
  staffViewBookingSection,
  whatsNewSection,
} from "./recent";

export const oicGuide: UserGuideContent = {
  audience: "oic",
  audienceLabel: "Equipment Officer-in-Charge",
  title: "Officer-in-Charge User Guide",
  subtitle: `${PRODUCT_NAME} — equipment stewardship, View Booking, and lab operations`,
  welcomeHeadline: "Welcome, Officer-in-Charge",
  welcomeBody: `As Equipment Officer-in-Charge you steward instruments assigned to you across the ${PRODUCT_NAME}. This guide covers View Booking, urgent bookings, waitlist confirmation, slot status, maintenance holds, accessories, quotas, important instructions, tickets and reporting for your equipment.`,
  sections: [
    whatsNewSection("oic"),
    purposeSection({
      paragraphs: [
        "You are responsible for the operational health of equipment where you are primary or temporary OIC.",
        "Your dashboard focuses on those instruments — metrics, queues, and the weekly lab calendar.",
      ],
      bullets: [
        "Manage bookings for your equipment (complete, disruption, reschedule, refund where policy allows)",
        "Publish accessories, quotas, important instructions and multi-mode settings from OIC tools",
        "Give final approval to urgent bookings, confirm waitlisted bookings and handle support tickets for your instruments",
        "Delegate temporary OIC when you are unavailable (where enabled)",
      ],
    }),
    loginAccountSection({
      paragraphs: [
        "Staff accounts typically sign in with Channel i or the credentials issued by your department administrator.",
      ],
      bullets: [
        "Sign in and open Dashboard — you should see View Booking and OIC tool cards for your equipment.",
        "Confirm Profile contact details so lab emails and ticket alerts reach you.",
        "Reopen this guide from the user menu anytime.",
      ],
    }),
    {
      id: "daily-ops",
      title: "Daily Operations Workflow",
      paragraphs: [
        "Most day-to-day work happens in View Booking (formerly Booking Management) for equipment you manage. The dashboard's week calendar opens expanded.",
      ],
      steps: [
        {
          title: "Open View Booking",
          body: "Click View Booking on the dashboard to see the bookings and the week calendar for your instruments.",
          screenshotCaption: "View Booking — OIC week view",
        },
        {
          title: "Process bookings",
          body: "Complete runs, mark not utilized, apply maintenance/disruption holds, reschedule, or refund according to institute policy and on-screen actions. Check Bookings awaiting completion on the dashboard for runs that are over but not yet completed.",
          screenshotCaption: "Booking action menu",
        },
        {
          title: "Handle urgent bookings",
          body: "Open Urgent booking from the dashboard (it shows pending requests) and click Manage urgent requests.",
          screenshotCaption: "Urgent booking queue",
        },
        {
          title: "Review tickets and reports",
          body: "Open Support tickets → Tickets marked to me for tickets on your equipment, and Reports & Statistics for utilisation where you have access.",
          screenshotCaption: "Support tickets / Reports",
        },
      ],
    },
    staffViewBookingSection(),
    oicRecentToolsSection(),
    {
      id: "oic-tools",
      title: "OIC Configuration Tools",
      paragraphs: [
        "Dedicated OIC pages help you keep the catalog accurate for users booking your instruments.",
      ],
      bullets: [
        "Accessories — manage bookable accessories for your equipment",
        "3D Print Materials — maintain materials where applicable",
        "Equipment Booking Configuration — set the important instruction shown to users, slot visibility, usage quotas, and booking and sample timings",
        "Multi-Mode Equipment — configure modes and related schedules",
        "Temporary OIC / Leave Management — delegate coverage when flags allow",
        ...oicConfigurationBullets(),
      ],
      callouts: [
        "TA nomination, leave, and reward tools appear only when enabled for your account by administrators.",
      ],
    },
    bookingAssistantSection({ staff: true }),
    notificationsSection([
      "OIC monthly reports and booking exception emails when configured.",
      "Support ticket assignment for equipment-linked requests.",
      "Daily 9:00 AM reminder for bookings whose time is over but not yet marked completed.",
      "Urgent booking requests awaiting your final approval.",
    ]),
    bestPracticesSection([
      "Update maintenance holds promptly so users are not surprised by unavailable slots.",
      "Publish clear sample instructions on the equipment page.",
      "Delegate temporary OIC before planned leave.",
    ]),
    permissionsSection({
      paragraphs: [
        "Your scope is equipment where you are OIC (primary or temporary). You do not have full institute-admin powers by default.",
      ],
      bullets: [
        "You can perform full booking-management actions on your equipment.",
        "You may book on behalf of a user when the booking UI offers that staff option.",
        "You can open and Calculate charges for any catalog equipment, but Book for a user and Change slot status are available only on equipment assigned to you.",
        "Admin Settings modules appear only if Admin Panel Access is enabled for your type and department.",
        "Inventory, CMS, and department-wide RBAC remain institute/department admin tools.",
      ],
    }),
    faqSection([
      {
        question: "I do not see an instrument I expect — why?",
        answer:
          "Management tools (View Booking, Change slot status, Book for a user) only cover equipment where you are assigned as OIC. Ask your Department Administrator to assign you as Officer In Charge for that asset.",
      },
      {
        question: "How do I place a waitlisted user into a slot myself?",
        answer:
          "Open Equipment waitlist, click Confirm manually on the entry, choose any unbooked slot and click Confirm booking. The charge is debited from the user's wallet.",
      },
      {
        question: "Can operators do everything I can?",
        answer:
          "No. Lab Operators are typically limited to complete and not-utilized actions, while OICs handle disruption, refunds, and broader configuration.",
      },
      {
        question: "How do I cover leave?",
        answer:
          "Use Temporary OIC or Leave Management when those features are enabled on your account; otherwise ask Dept Admin / Admin to assign coverage.",
      },
    ]),
    troubleshootingSection([
      "Missing Dashboard cards: refresh and confirm your user type is Officer In Charge (manager).",
      "Cannot open Admin Settings: your department may not have Admin Panel Access enabled for OICs.",
      "Actions greyed out: the booking may be outside your equipment scope or already in a terminal status.",
    ]),
    supportSection(),
  ],
};

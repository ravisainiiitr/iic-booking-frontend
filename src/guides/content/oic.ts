import { SHOW_ANDROID_APP_BANNER } from "@/lib/androidAppBanner";
import { compact, type RoleGuide } from "../gate";
import { assistantSection } from "./booking";
import { helpSection } from "./help";
import { trainingSection } from "./training";
import {
  disruptionHistorySection,
  oicChargesSection,
  oicConfigSection,
  slotStatusSection,
  staffViewBookingSection,
  ticketsSection,
  urgentApprovalSection,
  waitlistConfirmSection,
} from "./staff";

export const oicGuide: RoleGuide = {
  title: "Officer In Charge guide",
  welcome: "Run bookings, approvals and settings for the equipment where you are Officer In Charge.",
  sections: (g) =>
    compact([
      {
        id: "getting-started",
        title: "Getting started",
        icon: "rocket",
        group: "Start",
        intro: [
          "Sign in with Channel i or your staff credentials. Your tools cover equipment where you are Officer In Charge (primary or temporary).",
        ],
        steps: compact([
          {
            title: "Your dashboard",
            body: "View Booking, Urgent booking, Change slot status, Equipment waitlist, Support tickets and the OIC tools for your equipment are on the dashboard.",
          },
          SHOW_ANDROID_APP_BANNER && {
            title: "Android app",
            body: "Use Get the Android app on the dashboard to install IIC Booking on your phone. Sign in once with OTP and unlock it with your fingerprint or phone PIN; it opens on Today: today's and tomorrow's bookings, pending samples, messages, results overdue, urgent requests and waitlist.",
          },
          {
            title: "Book for a user",
            body: "Click Book on your equipment and choose Book slots for a user, then select the user. The charge goes to that user.",
          },
        ]),
        rules: [
          "Booking for a user and Change slot status work only on equipment assigned to you, including equipment you cover as temporary OIC.",
          "Admin Settings appears only if Admin Panel Access is enabled for your role and department.",
        ],
      },
      staffViewBookingSection(g),
      urgentApprovalSection(g),
      waitlistConfirmSection(g),
      slotStatusSection(g),
      disruptionHistorySection(g),
      oicConfigSection(g),
      oicChargesSection(),
      {
        id: "oic-substitute",
        title: "OIC Substitute",
        icon: "users",
        group: "Lab operations",
        intro: [
          "Going on leave or away? Let other Officers In Charge of your department manage one, several or all of your equipment for a set period. You keep your own access.",
        ],
        steps: [
          {
            title: "Choose equipment and substitutes",
            body: "Open OIC Substitute from the dashboard. Tick the equipment to hand over (Select all ticks every one). Choose a substitute on each row, or pick an OIC under Same substitute for all selected and click Apply. You can give some equipment to one OIC and the rest to another.",
          },
          {
            title: "Period, reason and review",
            body: "Choose the From and Until dates (DD-MM-YYYY) and write the reason; use Different dates on a row if one equipment needs other days. Click Review and assign to see who gets what, then Confirm and assign. If any row has a problem, nothing is saved and the row shows what to fix.",
          },
          {
            title: "What the substitute can do",
            body: "For those days the substitute has the same OIC permissions on that equipment as you: View Booking, approvals, urgent requests, waitlist, Change slot status and Equipment Booking Configuration. Each substitute gets one email listing all their equipment, each Lab Operator one email for the equipment they look after, and you get one summary.",
          },
          {
            title: "Revoke or cancel",
            body: "Under Substitutes you assigned, the list is grouped by substitute. Use Revoke (active) or Cancel (not started) on one row, tick several and end them together, or use Revoke all. A reason is required, and everyone involved gets one notification.",
          },
          {
            title: "History",
            body: "The Active, Scheduled and Past tabs list every substitution with its reason. Click History on a row to see who created, changed, revoked or cancelled it and when. Export downloads the substitutes you assigned, the equipment assigned to you and the full history as Excel (.xlsx), CSV or PDF.",
          },
        ],
        rules: [
          "Only active OICs of your own department can be chosen, and not for equipment they already manage. Up to 5 substitutes per equipment; the same substitute cannot have overlapping periods on the same equipment.",
          "Dates are in IST. Starting today gives access at once; access ends automatically at 11:59 PM on the Until date, and everyone is told when it ends.",
          "Only the equipment's own (permanent) OIC can assign a substitute. The Main Administrator can see and revoke all substitutions.",
        ],
      },
      trainingSection(g),
      ticketsSection(g),
      assistantSection(g),
      helpSection(g, {
        faqs: [
          {
            question: "An instrument I expect is missing. Why?",
            answer: "Your tools only cover equipment where you are assigned as Officer In Charge. Ask your Department Administrator to assign you.",
          },
          {
            question: "Can the Lab Operator do everything I can?",
            answer: "No. Lab Operators can Complete and mark Not Utilized; refunds, disruptions and reschedules stay with you.",
          },
        ],
        tips: ["Greyed-out actions usually mean the booking is outside your equipment or already closed."],
      }),
    ]),
};

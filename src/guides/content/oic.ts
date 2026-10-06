import { compact, type RoleGuide } from "../gate";
import { assistantSection } from "./booking";
import { helpSection } from "./help";
import { trainingSection } from "./training";
import {
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
        steps: [
          {
            title: "Your dashboard",
            body: "View Booking, Urgent booking, Change slot status, Equipment waitlist, Support tickets and the OIC tools for your equipment are on the dashboard.",
          },
          {
            title: "Android app",
            body: "Use Get the Android app on the dashboard to install IIC Booking on your phone. Sign in once with OTP and unlock it with your fingerprint or phone PIN; it opens on Today: today's and tomorrow's bookings, pending samples, messages, results overdue, urgent requests and waitlist.",
          },
          {
            title: "Book for a user",
            body: "Click Book on your equipment and choose Book slots for a user, then select the user. The charge goes to that user.",
          },
        ],
        rules: [
          "Booking for a user and Change slot status work only on equipment assigned to you, including equipment you cover as temporary OIC.",
          "Admin Settings appears only if Admin Panel Access is enabled for your role and department.",
        ],
      },
      staffViewBookingSection(g),
      urgentApprovalSection(g),
      waitlistConfirmSection(g),
      slotStatusSection(g),
      oicConfigSection(g),
      oicChargesSection(),
      {
        id: "oic-substitute",
        title: "OIC Substitute",
        icon: "users",
        group: "Lab operations",
        intro: [
          "Going on leave or away? Let another Officer In Charge of your department manage your equipment for a set period. You keep your own access.",
        ],
        steps: [
          {
            title: "Assign a substitute",
            body: "Open OIC Substitute from the dashboard. Pick the equipment, search and select one or more OICs of your department, choose the From and Until dates and write the reason, then click Assign substitute.",
          },
          {
            title: "What the substitute can do",
            body: "For those days the substitute has the same OIC permissions on that equipment as you: View Booking, approvals, urgent requests, waitlist, Change slot status and Equipment Booking Configuration. They, the equipment's Lab Operators and you get an email and a notification.",
          },
          {
            title: "Revoke or cancel",
            body: "Under Substitutes you assigned, use Revoke to end active access now or Cancel for one that has not started. A reason is required, and everyone notified at the start is told.",
          },
          {
            title: "History",
            body: "The Active, Scheduled and Past tabs list every substitution with its reason. Click History on a card to see who created, changed, revoked or cancelled it and when.",
          },
        ],
        rules: [
          "Only active OICs of your own department can be chosen, and not for equipment they already manage. Choose up to 5 substitutes at once; the same substitute cannot have overlapping periods on the same equipment.",
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

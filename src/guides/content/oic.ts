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
            body: "View Booking, Urgent booking, Equipment waitlist, Support tickets and the OIC tools for your equipment are on the dashboard.",
          },
          {
            title: "Book for a user",
            body: "Click Book on your equipment and choose Book slots for a user, then select the user. The charge goes to that user.",
          },
        ],
        rules: [
          "Booking for a user and Change slot status work only on equipment assigned to you.",
          "Admin Settings appears only if Admin Panel Access is enabled for your role and department.",
        ],
      },
      staffViewBookingSection(g),
      urgentApprovalSection(g),
      waitlistConfirmSection(g),
      slotStatusSection(g),
      oicConfigSection(g),
      oicChargesSection(),
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

import { compact, type RoleGuide } from "../gate";
import { helpSection } from "./help";
import { staffViewBookingSection, ticketsSection } from "./staff";
import { trainingSection } from "./training";

export const operatorGuide: RoleGuide = {
  title: "Lab Operator guide",
  welcome: "Close each day's runs on the equipment assigned to you and keep your Officer In Charge informed.",
  sections: (g) => compact([
    {
      id: "getting-started",
      title: "Getting started",
      icon: "rocket",
      group: "Start",
      intro: [
        "Lab Operator is the new name for Lab In-charge. Sign in with Channel i or your staff credentials; your tools cover equipment assigned to you.",
      ],
      steps: [
        {
          title: "Your dashboard",
          body: "View Booking, Intimate Unavailability and Support tickets are on the dashboard.",
        },
      ],
      rules: ["Admin Settings appears only if Admin Panel Access is enabled for Lab Operators in your department."],
    },
    staffViewBookingSection(g),
    {
      id: "unavailability",
      title: "Intimate Unavailability",
      icon: "clock",
      group: "Lab operations",
      intro: ["Tell your Officer In Charge when you will be away so cover can be planned. This is not the Institute leave portal."],
      steps: [
        { title: "Submit", body: "Click Intimate Unavailability on the dashboard, enter the dates and reason, and submit." },
      ],
      rules: [
        "It is recorded as Submitted at once and your Officer In Charge is emailed; no approval is needed.",
        "Dates cannot overlap an entry you already submitted.",
      ],
    },
    trainingSection(g),
    ticketsSection(g),
    helpSection(g, {
      faqs: [
        {
          question: "Why can't I refund or reschedule a booking?",
          answer: "Those actions belong to the Officer In Charge or Admin. Ask your Officer In Charge.",
        },
        {
          question: "How do I get access to another instrument?",
          answer: "Ask your Department Administrator or Officer In Charge to assign you as Lab Operator for it.",
        },
      ],
    }),
  ]),
};

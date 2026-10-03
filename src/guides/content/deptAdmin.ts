import type { RoleGuide } from "../gate";
import { helpSection } from "./help";
import { staffViewBookingSection } from "./staff";

const GROUP = "Department";

export const deptAdminGuide: RoleGuide = {
  title: "Department Administrator guide",
  welcome: "Keep your department's staff, equipment and wallet requests in order.",
  sections: (g) => [
    {
      id: "getting-started",
      title: "Getting started",
      icon: "rocket",
      group: "Start",
      intro: [
        "Your access covers your own department. Upcoming Bookings and Equipment Statistics on the dashboard show only your department's equipment.",
        "The Administration overview at the top of the dashboard shows your department's sessions and bookings today, charges this month, equipment status, waitlist, failed booking attempts, ratings and a Needs attention list. It refreshes every minute.",
        "The menu is grouped into sections such as Bookings, Finance and Support & feedback. Click a section heading to open or close it, or type in Search menu to find a page.",
      ],
      rules: [
        "Admin Settings appears only if Admin Panel Access is enabled for your role and department.",
        "Approving equipment addition requests is done by the Institute Admin.",
      ],
      tips: ["If your profile shows the wrong department, contact the Institute Admin before changing staff."],
    },
    {
      id: "department-staff",
      title: "Department staff",
      icon: "users",
      group: GROUP,
      intro: ["Assign the Officer In Charge, Lab Operator and Accounts staff for your department."],
      steps: [
        {
          title: "Open Department Administration",
          body: "Choose OIC, Lab or Accounts management and map users from your department to the role.",
        },
        {
          title: "Faculty Credit Facility (optional)",
          body: "Open Faculty Credit Facility, enable it, set the Date of Joining cut-off and the maximum credit limit (₹) for newly joined faculty.",
        },
      ],
      rules: [
        "Every active equipment needs an Officer In Charge so its bookings are handled.",
        "Faculty credit is recovered first from later recharges; once recovered, the facility closes for that faculty member.",
      ],
    },
    {
      id: "book-for-user",
      title: "Book for a user",
      icon: "calendar",
      group: GROUP,
      intro: ["Book a slot on someone's behalf on your department's equipment. The charge goes to that user."],
      steps: [
        {
          title: "Pick the user",
          body: "Click Book on the equipment, choose Book slots for a user, filter by user type (for example IIT Roorkee Students) and select the user.",
        },
        { title: "Book", body: "Fill the inputs and choose slots as on the normal booking page." },
      ],
      rules: ["Only equipment in your department. Staff types (Admin, OIC, Lab Operator) and Other are not listed."],
    },
    staffViewBookingSection(g),
    {
      id: "department-queues",
      title: "Urgent requests, waitlist and repeat samples",
      icon: "clock",
      group: GROUP,
      intro: [
        "Urgent Requests, Equipment waitlist and Repeat samples in the Bookings menu list your department's equipment only, so there is no department to pick. You can act on them just as the Officer In Charge can.",
      ],
      steps: [
        {
          title: "Pick the equipment",
          body: "Each page opens on All equipment, with an Equipment column. Choose one instrument in Equipment to see only its entries; on Equipment waitlist this also shows its queue depth.",
        },
        {
          title: "Decide urgent requests",
          body: "In Urgent Requests click Review, add optional notes, then Accept & allocate or Reject. Type A (rush relief) and Type B (urgent with reason) both appear; a Type B request can be accepted only after the supervisor approves. Delete removes a request.",
        },
        {
          title: "Manage the waitlist",
          body: "Click Confirm manually next to an entry (shown as Confirm in the table), pick any unbooked slot and click Confirm booking. Long reasons are cut to two lines: click more to read them. Select one equipment to use Clear queue.",
        },
        {
          title: "Arrange a repeat sample",
          body: "Open the user's completed booking in View Booking and click Mark as repeat & book (free). Repeat samples keeps the record.",
        },
      ],
      rules: [
        "Equipment in other departments is refused.",
        "These actions need the Manage bookings permission from the Main Administrator.",
        "The urgent request expiry period applies to every department, so only the Main Administrator can change it.",
        "Users and the Officer In Charge are told that the Department Administrator took the action, and it is recorded under your name.",
      ],
    },
    {
      id: "recharge-requests",
      title: "Wallet recharge requests",
      icon: "receipt",
      group: "Wallet",
      intro: ["Open Wallet recharge requests on the dashboard to follow requests from your department's users: method, amount, status and any decline reason."],
      glossary: [
        { term: "Project Grant declines", meaning: "Wrong Project Code, Insufficient Funds in the Project, Project Already Closed or Other." },
        { term: "Cash / Bank transfer declines", meaning: "Mismatch in User Information or Other." },
        { term: "Declined by SRIC", meaning: "The amount becomes an auto-approved credit, recovered from the user's next approved recharge." },
      ],
    },
    helpSection(g, {
      faqs: [
        {
          question: "Why can't I see another department's equipment?",
          answer: "Department Administrators are limited to their own department.",
        },
        {
          question: "Staff mapping fails. What should I check?",
          answer: "The user must belong to your department. Contact the Institute Admin if their department is wrong.",
        },
      ],
    }),
  ],
};

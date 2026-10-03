import { compact, type RoleGuide } from "../gate";
import { assistantSection } from "./booking";
import { helpSection } from "./help";
import { slotStatusSection, staffViewBookingSection, urgentApprovalSection, waitlistConfirmSection } from "./staff";
import { trainingSection } from "./training";

const ADMIN = "Administration";

export const adminGuide: RoleGuide = {
  title: "Institute Administrator guide",
  welcome: "Configure the portal institute-wide and step in on any booking, wallet or support issue.",
  sections: (g) =>
    compact([
      {
        id: "getting-started",
        title: "Getting started",
        icon: "rocket",
        group: "Start",
        intro: [
          "You have full Admin Panel access and every permission. Most tools are on the dashboard; deeper settings are in Admin Settings.",
          "The dashboard opens with the Administration overview: sessions and bookings today, charges this month, equipment status, active users, waitlist, failed booking attempts, ratings, a Needs attention list and the countdown to the weekly booking opening. It refreshes every minute.",
          "The menu is grouped into sections (Overview, Bookings, Equipment & configuration, Users & access, TA & training, Finance, Operations & infrastructure, Content & communication, Support & feedback, System). Click a section heading to open or close it, or type in Search menu to find a page.",
        ],
        rules: ["Do not share the Admin account. Give staff named accounts with only the modules they need."],
        tips: [
          "To book on someone's behalf, click Book on any equipment and choose Book slots for a user.",
          "Customize menu still works: your own menus appear above the built-in sections, and Reset to default brings the sections back.",
        ],
      },
      {
        id: "administration",
        title: "Users, departments and content",
        icon: "settings",
        group: ADMIN,
        intro: ["Institute-level configuration in Admin Settings."],
        steps: [
          { title: "Admin Panel Access", body: "Choose which user types and departments may open Admin Settings modules." },
          { title: "Department Administration", body: "Oversee staff roles and permission caps across departments." },
          { title: "Equipment", body: "Approve equipment addition requests and maintain equipment settings: semesters, buffers, charges and mode schedules." },
          {
            title: "Equipment form",
            body: "Pick a title (Mr., Mrs., Ms., Miss, Dr. or Prof.) for each Officer In Charge and Lab Operator; the preview shows how the name appears. Untick Allow samples with different parameters to stop users adding extra sample sets on that equipment.",
          },
          {
            title: "Results deadline",
            body: "In the equipment form (or the Django admin), set Results deadline in working days (default 2) or hours after the slot, and whether to Show results deadline to users (off by default). The Officer In Charge can set the same in their configuration page. It replaces the Auto Operator Unavailable and Auto Operator Absent Disruption hours, which are kept only as deprecated fields.",
          },
          {
            title: "Advanced tables",
            body: "In Dynamic input fields, choose the field type Advanced table (typed columns) and click Configure columns (the same button appears in the Django admin). Give each column a label and a kind: Numeric (with lower and upper limits, step and whole numbers only), Text (with a maximum length), Radio, Combobox, Multi-select, Toggle or Periodic table. Under Rows, either let users add, remove and duplicate rows (minimum, starting and maximum rows), or make the rows follow a Numeric field such as No. of samples. The preview shows the table as users will see it. In charge and time formulas the table's key stands for its number of filled rows.",
          },
          {
            title: "Peak booking window",
            body: "In Admin Settings → Session / Auto-logout, set the minutes before and after the weekly slot opening and choose Pause external users. Internal users then go straight to booking from the catalog.",
          },
          { title: "Communications and CMS", body: "Keep Communication templates and Home Page content accurate." },
          { title: "Legacy user sync", body: "Map a user to their old-portal ID, run a test sync, then sync wallet balance and legacy bookings." },
        ],
        rules: [
          "Only the Main Administrator or a superuser can change the sample sets switch; bookings made earlier keep their sets.",
          "The results deadline can be changed only by the Main Administrator and the equipment's Officer In Charge (including a temporary OIC). The automatic outcome after the deadline is switched on under Results deadline policy in the Django admin and applies only to bookings whose slot ends after it was switched on.",
          "By default external users are paused from 8:55 to 9:15 pm on Wednesdays; admins, Officers In Charge and staff are never paused.",
        ],
      },
      {
        id: "recharge-requests",
        title: "Wallets",
        icon: "wallet",
        group: ADMIN,
        intro: ["Control how users fund wallets and process their requests."],
        steps: [
          {
            title: "Wallet payment modes",
            body: "Switch Recharge via Project Grant, Direct Cash Deposit / Bank Transfer, Online payment gateway, Transfer within the same department and Credit Limit on or off.",
          },
          {
            title: "Wallet recharge requests",
            body: "Approve, Decline or Cancel requests and Verify Fund Receipt.",
          },
          {
            title: "Credit requests",
            body: "Approve or reject Credit Facility requests in Admin Settings → User Management → Wallet Credit Management.",
          },
        ],
        rules: [
          "Users see a switched-off mode greyed out with Awaiting Competent Authority Approval.",
          "A Project Grant request declined by SRIC becomes an auto-approved credit, recovered from the user's next approved recharge.",
        ],
        glossary: [
          { term: "Project Grant declines", meaning: "Wrong Project Code, Insufficient Funds in the Project, Project Already Closed or Other." },
          { term: "Cash / Bank transfer declines", meaning: "Mismatch in User Information or Other." },
        ],
        tips: ["Approval notices to the SRIC offices name the approver."],
      },
      staffViewBookingSection(g),
      urgentApprovalSection(g),
      waitlistConfirmSection(g),
      slotStatusSection(g),
      trainingSection(g),
      {
        id: "support-admin",
        title: "Support and feedback",
        icon: "ticket",
        group: ADMIN,
        intro: ["Route support tickets and read user feedback."],
        steps: [
          { title: "New ticket email alerts", body: "In Admin Settings → Support Tickets, choose who is emailed about every new ticket." },
          { title: "Experience ratings", body: "Read Rate your experience responses, sort by any column and use Export CSV." },
        ],
      },
      g.when(g.flags.assistant, {
        id: "assistant-admin",
        title: "Booking Assistant administration",
        icon: "bot",
        group: ADMIN,
        intro: ["Keep the assistant's answers accurate."],
        steps: [
          { title: "Booking Assistant Knowledge", body: "Manage the verified answers and documents the assistant uses (Admin Settings)." },
          { title: "Copilot Answers & Console", body: "Review answers and user feedback." },
        ],
      }),
      assistantSection(g),
      helpSection(g, {
        faqs: [
          {
            question: "A Department Administrator cannot open Admin Settings. Why?",
            answer: "Enable Admin Panel Access for Department Administrator and their department, then grant the modules they need.",
          },
          {
            question: "The home page shows outdated text. Where is it?",
            answer: "Update Home Page content in the CMS, then hard-refresh the site.",
          },
        ],
      }),
    ]),
};

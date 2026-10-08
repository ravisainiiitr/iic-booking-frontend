import { compact, type RoleGuide } from "../gate";
import { assistantSection } from "./booking";
import { helpSection } from "./help";
import { disruptionHistorySection, slotStatusSection, staffViewBookingSection, urgentApprovalSection, waitlistConfirmSection } from "./staff";
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
          "To book on someone's behalf, click Book on any equipment and choose Book slots for a user. Weekly and monthly booking limits don't apply to bookings you make or reschedule for a user; they still count toward that user's own limits.",
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
          {
            title: "OIC Substitute",
            body: "Under Users & access, OIC Substitute lists every substitution an Officer In Charge has given to another OIC of their department, with the reason, period and history, grouped by substitute. Use Revoke (or Cancel, if it has not started) with a reason to end one, or tick several and end them together; the substitute, the Lab Operators and the OIC are notified. Export downloads the list and its history as Excel (.xlsx), CSV or PDF.",
          },
          {
            title: "Reports and exports",
            body: "Reports & Statistics, Booking attempt log, Urgent Requests, Equipment waitlist, Repeat samples, Student nominations, TA nominations log, Wallet recharge requests, Wallet withdrawal requests and the Support desk each have an Export button. It downloads every row matching the filters on screen (not just the current page) as a formatted Excel workbook, a CSV or a printable PDF, up to 10,000 rows (2,000 for PDF). Each card on Reports & Statistics can also be exported on its own.",
          },
          { title: "Equipment", body: "Approve equipment addition requests and maintain equipment settings: semesters, buffers and charges. Multi-mode equipment (one page for all departments, with a department filter) is where you plan mode days on a month calendar: choosing equipment in a schedule makes it a mode of the base instrument, and a schedule with blank dates keeps that mode always available." },
          {
            title: "Equipment form",
            body: "Pick a title (Mr., Mrs., Ms., Miss, Dr. or Prof.) for each Officer In Charge and Lab Operator; the preview shows how the name appears. Untick Allow samples with different parameters to stop users adding extra sample sets on that equipment.",
          },
          {
            title: "Results deadline",
            body: "In the equipment form (or the Django admin), set Results deadline in working days (default 2) or hours after the slot or sample receipt, whichever is later, and whether to Show results deadline to users (off by default). A booking has no results deadline until its sample is marked Sample Accepted (walk-in equipment counts from the slot). The Officer In Charge can set the same in their configuration page. It replaces the Auto Operator Unavailable and Auto Operator Absent Disruption hours, which are kept only as deprecated fields. Separately, Results overdue after (hours), 24 by default, decides when an open booking counts as Results overdue (counted from the booking end, or from the Sample Accepted time plus the booked time if later): the overdue counter, the Results overdue list and the 9:00 AM completion reminder start only then. Show results countdown to users (off by default) lets users see Results expected by and Results overdue by.",
          },
          {
            title: "Advanced tables",
            body: "In Dynamic input fields, choose the field type Advanced table (typed columns) and click Configure columns (the same button appears in the Django admin). Give each column a label and a kind: Numeric (with lower and upper limits, step and whole numbers only), Text (with a maximum length), Radio, Combobox, Multi-select, Toggle or Periodic table. Under Rows, either let users add, remove and duplicate rows (minimum, starting and maximum rows), or make the rows follow a Numeric field such as No. of samples. The preview shows the table as users will see it. In charge and time formulas the table's key stands for its number of filled rows.",
          },
          {
            title: "Peak booking window",
            body: "In Admin Settings → Session / Auto-logout, set the minutes before and after the weekly slot opening and choose Pause external users. Internal users then go straight to booking from the catalog.",
          },
          {
            title: "Fabrication materials",
            body: "Fabrication Materials is the master list of 3D print materials and laser cutting sheets. For each 3D printer or laser cutter, tick its Supported materials from the master list of the same kind and save; users see a material only when it is supported and enabled, otherwise No materials configured — contact the OIC. Disabling a material hides it everywhere but keeps it supported; bookings already made keep their price. 3D printers and laser cutters also ask for Quantity Required (field key A), which multiplies the job's material charge (and the print time); it is added automatically when an equipment is switched to a fabrication profile.",
          },
          {
            title: "Maximum print size",
            body: "In Fabrication Materials, choose any 3D printer and under Lab settings → Maximum print size (mm) enter its largest X, Y and Z, choose Allow rotation to fit (on by default, so a model that fits when turned is accepted) and click Save settings; its Officer In Charge can do the same. An empty axis has no limit. Users see the maximum at the STL upload, and larger models (each file of a ZIP, and replaced files too) are refused on upload and again when booking, with a 0.5 mm allowance.",
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
        id: "registration-requests",
        title: "Registration requests",
        icon: "users",
        group: ADMIN,
        intro: [
          "Accounts created with email and password (not Channel i) are listed under Users & access → Registration requests. Requests from people claiming to be at IIT Roorkee (post-doctoral fellows, research associates in projects and IITR Startups) are approved by the IIT Roorkee faculty member chosen at registration, from Approve and Decline buttons in their email, within 24 hours.",
        ],
        steps: [
          {
            title: "Review a request",
            body: "Filter by status, Claims IITR, faculty, date or search, then click a row to see the user's details, programme validity, documents, the faculty's decision and the full timeline.",
          },
          {
            title: "Forward to faculty",
            body: "New registrations are sent to the faculty automatically once the email is verified, and the 24-hour decision window starts then; the Status column shows the time left. For older requests, click Send to faculty on one request, or Send all IITR requests to faculty; the confirmation shows how many will be sent, and each gets its own 24-hour window. Resend reminder keeps the deadline; Send again starts a new window.",
          },
          {
            title: "Approve or reject yourself",
            body: "Approve overrides the faculty step. Reject needs a reason, which is emailed to the user. Change faculty (with a reason) sends the request to another faculty member and cancels the old link.",
          },
          {
            title: "Registration log",
            body: "The Registration log tab lists every event with who acted, their role, the time, IP address and channel (email link, dashboard or admin). Filter it and click Export CSV.",
          },
          {
            title: "Programme expiry",
            body: "The Programme expiry tab shows whether automatic expiry is on and a dry run of who would be warned or disabled today. To switch it on, click Enable and type ENABLE.",
          },
        ],
        rules: [
          "Only the Main Administrator can open Registration requests. A faculty member can act only on requests that name them, and each email link works once.",
          "Once the faculty approves, the account is fully active and no further approval is needed. Requests from other external users follow the existing verification path.",
          "If the faculty declines, or does not decide within 24 hours, the request is cancelled, the pending account is removed (the Registration log keeps a snapshot) and the user is emailed that they can register again. Requests sent before the window was introduced do not time out.",
          "With automatic expiry on, users are warned 30, 7 and 1 days before their programme validity ends and disabled when it passes unless their faculty grants an extension. An extension runs for at most six months from the current end date (or from today if it has already passed), and can be repeated.",
          "Future bookings of a disabled account are never cancelled automatically; they are listed in the request and on the Programme expiry tab for you or the Officer In Charge to handle.",
        ],
      },
      {
        id: "recharge-requests",
        title: "Wallets",
        icon: "wallet",
        group: ADMIN,
        intro: ["See every wallet and its transactions, correct balances, control how users fund wallets and process their requests."],
        steps: [
          {
            title: "Wallet ledger",
            body: "Finance → Wallet ledger lists every wallet owner with category, department, sub-wallet balances, linked students, account status and last transaction. Search after two letters, filter by department, category, sub-wallet, balance or transaction dates, sort by name, balance or last transaction, and export. Click an owner to see their details, sub-wallets, linked students and every transaction with its source, booking ID, balance after and who made it; filter by date (Today, Last 7 or 30 days, This month, This financial year or a custom range), type, source, sub-wallet, amount, booking ID or performed by. All transactions shows the same ledger across every wallet.",
          },
          {
            title: "Credit or debit a wallet",
            body: "On an owner's page click Credit or Debit (or the buttons on a sub-wallet). Choose the sub-wallet, enter the amount, select a reason (Manual adjustment, Correction, Refund outside system, Grant top-up or Other), add remarks and an optional receipt or UTR number, and choose whether to email the owner. Review shows the current and new balance; confirm to post the entry. A credit can open a sub-wallet for a new department.",
          },
          {
            title: "Wallet payment modes",
            body: "In Payment options, the master switches turn Recharge via Project Grant, Direct Cash Deposit / Bank Transfer, Online payment gateway, Transfer within the same department and Credit Limit on or off for everyone. Below them, switch an option off for individual departments; only departments with equipment in the catalog are listed, and others that still have saved settings are under Other departments with saved settings. While a master switch is off its column is locked, and each department's saved choice returns when the master is turned on. Search the list or use a column's menu to change every department shown. Click Save on each section.",
          },
          {
            title: "Email recipients",
            body: "Choose an option and Default (all departments) or one department, then add To and CC recipients as email addresses, portal users or roles such as SRIC Office or Department Administrator. The requesting user is always copied. Reset to built-in goes back to today's recipients.",
          },
          {
            title: "Direct wallet recharge",
            body: "Turn Allow direct wallet recharge on, then Add person to give someone temporary permission: valid from and until, optional department and per-transaction limit, and a reason. Revoke ends it at once. Recharge a wallet credits funds after you review the owner, the new balance and who is emailed; every recharge is listed in the history.",
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
          "Only the Main Administrator can open the Wallet ledger or credit and debit wallets. A debit cannot take a sub-wallet below ₹0.00, and bookings are not changed.",
          "Every credit and debit is recorded with a reference (WAC- or WAD-), your name, the time, the reason and the IP address, and appears in the owner's transactions. Submitting the same entry twice posts it only once.",
          "Users see a switched-off mode greyed out with Awaiting Competent Authority Approval. The department is that of the sub-wallet being funded, debited or transferred from.",
          "A department can only switch an option off; while a master switch is off, the option is off in every department. Credit limit caps apply to every department.",
          "Every IITR Student linked to a supervisor's wallet can recharge it for the same departments as the supervisor, with the methods these switches allow; Project Grant stays faculty-only. There is no separate student switch to turn on.",
          "Direct wallet recharge is off by default. Only the Main Administrator and people with a current permission can use it, and each recharge is recorded with who made it, when, the permission used and the IP address.",
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
      disruptionHistorySection(g),
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

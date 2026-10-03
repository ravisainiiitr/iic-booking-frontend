/** Chapters for lab and administrative staff. Items are filtered per role. */

import { compact, type Gate } from "../gate";
import type { GuideSection } from "../types";

const LAB = "Lab operations";

export function staffViewBookingSection(g: Gate): GuideSection {
  const scope = g.pick(
    { admin: "every equipment", dept_admin: "your department's equipment", operator: "equipment assigned to you" },
    "equipment you manage"
  );
  return {
    id: "view-booking",
    title: "View Booking",
    icon: "list",
    group: LAB,
    intro: [`Click View Booking on the dashboard to see bookings and the week calendar for ${scope}.`],
    steps: compact([
      {
        title: "Find bookings",
        body: "Use search, Status, dates and All equipment; More filters shows the rest. Click any column heading to sort.",
      },
      {
        title: "Check who booked",
        body: "Hover over a booked slot in the week calendar to see the user's name, department, email, mobile and booking ID.",
      },
      g.only(["operator"], {
        title: "Read the job sheet",
        body: "Click a booking ID to open its job sheet: user, date and time, sample stage, the user's instructions and the Sample requirements table. Each sample set is one row (Set 1, Set 2 and so on) and each input the user filled in is a column; values that vary from Set 1 are lightly tinted and a Total row adds up the samples. Advanced tables appear inside it as a small table for each set, with S.No. and the column names. On a phone, swipe the table sideways. Use Print job sheet for an A4 copy; wide tables print in landscape.",
      }),
      g.only(["operator"], {
        title: "Close the run",
        body: "After the run, choose Complete (and publish results per lab process), or Not Utilized if the user did not use the slot.",
      }),
      g.only(["oic", "admin"], {
        title: "Act on a booking",
        body: "Complete, mark Not Utilized, apply a disruption, reschedule or refund from the booking's actions, as policy allows.",
      }),
      g.only(["oic", "admin", "operator"], {
        title: "Comment",
        body: "Use Add Comment and tick who should be notified: the user, the Officer In Charge and the Lab Operator.",
      }),
      g.only(["oic", "admin", "operator"], {
        title: "Send a reminder or ask the user",
        body: "In the booking's actions, click Send reminder or Ask user. Pick a suggested message (for example Upcoming slot, Submit sample or Collect sample / results) or write your own, and for a question you can set a Reply by date. Check the email subject shown, then click Send. The user gets an email with a Reply in portal button and a notification; both appear in the booking's messages and history.",
      }),
      g.only(["oic", "admin", "operator"], {
        title: "Follow up questions",
        body: "Open questions show Awaiting reply on the booking and in View Booking, and a card above the bookings list shows how many are awaiting the user's reply, with overdue ones marked. When the user replies you get an email and a notification, and the question is marked Answered. Use Mark resolved if it was settled another way.",
      }),
    ]),
    rules: compact([
      g.only(["operator"], "Refunds, disruptions and reschedules are done by the Officer In Charge or Admin."),
      g.only(["dept_admin"], "Completion and exception handling stay with the Officer In Charge and Lab Operator."),
      "Cancelled and refunded bookings keep their original dates.",
      g.only(["oic", "admin", "operator"], "Up to 3 reminders and 5 questions can be sent per booking in 24 hours, shared by all lab staff; sending the same text twice within 2 minutes sends it once."),
    ]),
    tips: compact([
      g.only(["oic", "operator"], "Bookings awaiting completion on the dashboard lists runs that are over but not completed; a reminder email goes out daily at 9:00 AM until they are."),
      g.only(["operator"], "Booking lists show the number of sample sets and samples under each booking ID, for example 3 sets · 12 samples."),
    ]),
  };
}

export function urgentApprovalSection(g: Gate): GuideSection {
  return {
    id: "urgent-approvals",
    title: "Urgent booking approvals",
    icon: "alert",
    group: LAB,
    intro: [
      g.is("admin")
        ? "Type B urgent requests (urgent with reason, 50% surcharge) wait for final approval; as Admin you can act on any equipment."
        : "Type B urgent requests (urgent with reason, 50% surcharge) for your equipment wait for your final approval.",
    ],
    steps: [
      { title: "Open the queue", body: "Click Urgent booking on the dashboard, then Manage urgent requests." },
      { title: "Decide", body: "Read the reason and any document, then approve or reject. You may reschedule, including to a weekend." },
    ],
    rules: [
      "Students' requests reach you only after their supervisor approves.",
      "The user's wallet is charged only after final approval.",
    ],
  };
}

export function waitlistConfirmSection(g: Gate): GuideSection {
  return {
    id: "waitlist-confirm",
    title: "Equipment waitlist",
    icon: "clock",
    group: LAB,
    intro: [
      g.is("admin")
        ? "Equipment waitlist shows who is waiting on any equipment."
        : "Equipment waitlist shows who is waiting on your equipment. It opens on your first equipment.",
    ],
    steps: [
      {
        title: "Confirm manually",
        body: "Click Confirm manually on an entry, choose any unbooked slot and click Confirm booking.",
      },
    ],
    rules: [
      "Any unbooked slot can be used, including weekends, holidays, closed, blocked and maintenance slots.",
      "The charge is debited from the user's wallet.",
    ],
  };
}

export function slotStatusSection(g: Gate): GuideSection {
  return {
    id: "slot-status",
    title: "Change slot status",
    icon: "calendar",
    group: LAB,
    intro: ["Open slots, block them or mark maintenance in bulk from a week view."],
    steps: [
      {
        title: "Open it",
        body: "On the equipment page, choose Change slot status in the menu.",
      },
      {
        title: "Pick the week",
        body: "Double-click a date (or drag across several) to open the Week view; it starts on the current week. One click on an arrow changes the week; double-clicking a date jumps to it.",
      },
      {
        title: "Select and apply",
        body: "Click slots, time labels (rows) or day headers (columns), then apply the new status.",
      },
    ],
    rules: compact([
      g.only(["oic"], "Available only on equipment assigned to you."),
      "Admins and Officers In Charge can see and book slots in any week.",
    ]),
  };
}

export function oicConfigSection(g: Gate): GuideSection {
  return {
    id: "equipment-config",
    title: "Equipment configuration",
    icon: "settings",
    group: LAB,
    intro: ["Keep what users see accurate from the OIC tools on your dashboard."],
    steps: compact([
      {
        title: "Important instruction",
        body: "In Equipment Booking Configuration, write the Default (all user types) text with the toolbar: font, point size, subscript and superscript (for H₂O or cm⁻¹), lists, colours and links. Use Add an instruction for a user type for a different note to, say, students or external users.",
      },
      {
        title: "Booking and sample timings",
        body: "In the same page set slot visibility, usage quotas, the sample submission lead time and the sample collect deadline.",
      },
      {
        title: "Accessories and modes",
        body: "Use Accessories, 3D Print Materials (where applicable) and Multi-Mode Equipment to keep options and mode schedules current.",
      },
      g.when(g.flags.oicLeaveManagement, {
        title: "Cover your leave",
        body: "Use Temporary OIC / Leave Management to delegate your equipment before planned leave.",
      }),
    ]),
    rules: [
      "A lead time of 0 means no sample deadline. With both values at 0 (walk-in), no sample emails are sent and bookings are not marked Not Utilized automatically.",
    ],
  };
}

export function oicChargesSection(): GuideSection {
  return {
    id: "charges",
    title: "Charges and input edits",
    icon: "receipt",
    group: LAB,
    intro: ["Users can edit booking inputs until completion; the charge is recalculated."],
    steps: [
      {
        title: "Lower charge",
        body: "When the user edits before the cancellation deadline, the difference is refunded to their wallet automatically. For edits after the deadline, and for edits made by lab staff, use Confirm refund on the booking.",
      },
      { title: "Higher charge, unpaid", body: "Use Deduct Money to debit the difference from the user's wallet." },
    ],
    rules: [
      "You can open Calculate charges on any catalog equipment; it is view-only on equipment not assigned to you.",
      "You can also edit inputs yourself after completion.",
    ],
  };
}

export function ticketsSection(g: Gate): GuideSection {
  return {
    id: "tickets",
    title: "Support tickets",
    icon: "ticket",
    group: LAB,
    intro: ["Click Support tickets on the dashboard."],
    steps: compact([
      g.only(["oic", "operator"], {
        title: "Tickets marked to me",
        body: "Lists tickets assigned to you or raised for equipment you look after. Reply and resolve them here.",
      }),
      { title: "My Tickets", body: "Lists the tickets you raised; raise a new one with a clear description and booking ID." },
    ]),
  };
}

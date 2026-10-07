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
        body: `${g.pick(
          { admin: "The list opens on Booked; choose All status to see every booking." },
          `The list opens on All status, so every booking for ${scope} is shown.`
        )} Use search, Status, dates and All equipment; More filters shows the rest. The list updates as soon as you change a filter or type 2 or more characters in search; Clear resets them. Click any column heading to sort. Export downloads every booking matching the filters, search and sort (not just the page on screen) as Excel (.xlsx), CSV or PDF, up to 10,000 bookings at a time.${g.pick(
          { operator: " Amounts are not included." },
          " The file includes the amount."
        )}`,
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
      g.only(["oic", "admin"], {
        title: "Charge for IIC material used",
        body: "When a user ticked I will bring my own sheet material or I will bring my own printing material but it was not enough, open the booking and click Charge for IIC material used. Choose the material, enter the sheets (0.5 for half a sheet) or grams used and the reason, then click Preview amount. The amount uses the material's price and GST like a booking, and Confirm charge deducts it from the wallet like Deduct Money, or adds it to the amount to pay if the balance is short. The user and the wallet owner get the wallet debit email and a notification, and the charge appears in the charge breakdown and history. Use Reverse on a charge made in error; a paid amount then waits for your Confirm refund.",
      }),
      g.only(["oic", "admin", "operator"], {
        title: "Comment",
        body: "Use Add Comment and tick who should be notified: the user, the Officer In Charge and the Lab Operator.",
      }),
      g.only(["oic", "admin", "operator"], {
        title: "Send a reminder or ask the user",
        body: "In the booking's actions, click Send reminder or Ask user. Pick a suggested message (for example Upcoming slot, Submit sample, Results delayed or Collect sample / results) or write your own, and for a question you can set a Reply by date. Check the email subject shown, then click Send. The user gets an email with a Reply in portal button and a notification; both appear in the booking's messages and history.",
      }),
      g.only(["oic", "admin", "operator"], {
        title: "Results overdue",
        body: "The results deadline starts once the sample is marked Sample Accepted: it counts from the slot end, or from the receipt if the sample came later, and bookings without a received sample have none. Bookings still open after it show a red Results overdue badge in the list and on the job sheet, and the Results overdue card on the dashboard lists them. Choose Results overdue in Status to see only those. Share the results and complete the booking; for a genuine delay, send the user the Results delayed reminder, and the Officer In Charge or Admin can use Extend results deadline in the booking details.",
      }),
      g.only(["oic", "admin"], {
        title: "See why a booking attempt failed",
        body: "In Booking Attempt Log, click the reason in the Failure reason column (or the details icon under Actions). The details show the user's full details, the slots they picked, their inputs as a table with the field names, and at the bottom the outcome in plain words, such as Weekly booking limit reached with the minutes used. Technical details keeps the original message.",
      }),
      g.only(["oic", "admin"], {
        title: "Bookings behind a limit failure",
        body: "For a weekly or monthly limit failure, the attempt details show Bookings counted toward this limit at the bottom, after the outcome (the calculator icon under Actions opens the same list). It gives the user's supervisor with email and employee ID, and lists the bookings that used the limit in the week or month of the requested slot, with when each was requested (to the second) and each person's total for a research group limit; if the request alone is longer than the limit, it says so. The list is worked out from current bookings, so it notes when the limit or the usage has changed since the attempt. Users see the same calculation for their own attempts under Unsuccessful attempts in My Bookings, without other members' booking links, inputs or the supervisor's email and employee ID.",
      }),
      g.only(["oic", "admin", "operator"], {
        title: "Follow up questions",
        body: "Open questions show Awaiting reply on the booking and in View Booking, and a card above the bookings list shows how many are awaiting the user's reply, with overdue ones marked. When the user replies you get an email and a notification, and the question is marked Answered. Use Mark resolved if it was settled another way.",
      }),
    ]),
    rules: compact([
      g.only(["operator"], "Refunds, disruptions and reschedules are done by the Officer In Charge or Admin."),
      g.only(
        ["oic", "admin"],
        "IIC material can be charged only on own-material 3D print and laser bookings that are not cancelled or refunded, including completed ones, by the equipment's Officer In Charge (or temporary OIC) and the Main Administrator. Only the Main Administrator can enter a different amount."
      ),
      g.only(["dept_admin"], "Completion and exception handling stay with the Officer In Charge and Lab Operator."),
      "Cancelled and refunded bookings keep their original dates.",
      g.only(["oic", "admin", "operator"], "Up to 3 reminders and 5 questions can be sent per booking in 24 hours, shared by all lab staff; sending the same text twice within 2 minutes sends it once."),
    ]),
    tips: compact([
      g.only(["operator"], "Bookings awaiting completion on the dashboard lists runs that are over and whose sample has been marked Sample Accepted (received), but are not completed, with when the sample was received and the date results are due; a reminder email goes out daily at 9:00 AM until they are, marking results that are overdue. Overdue by and Results due count from the slot end, or from the receipt if it came later. A booking whose sample was never received is not listed: it follows the Booking Not Utilized rule."),
      g.only(["operator"], "Booking lists show the number of sample sets and samples under each booking ID, for example 3 sets · 12 samples."),
    ]),
  };
}

export function urgentApprovalSection(g: Gate): GuideSection {
  return {
    id: "urgent-approvals",
    title: g.is("admin") ? "Urgent Requests" : "Urgent booking approvals",
    icon: "alert",
    group: LAB,
    intro: [
      g.is("admin")
        ? "Urgent Requests lists every urgent request, Type A (rush relief) and Type B (urgent with reason, 50% surcharge), with a Type column. Type B requests wait for final approval; as Admin you can act on any equipment."
        : "Type B urgent requests (urgent with reason, 50% surcharge) for your equipment wait for your final approval.",
    ],
    steps: [
      g.is("admin")
        ? {
            title: "Open the list",
            body: "Click Urgent Requests in the Bookings menu (or Manage urgent requests on its card). Department/Centre starts on Institute Instrumentation Centre and Equipment on All equipment; change either to narrow the list.",
          }
        : {
            title: "Open the queue",
            body: "Click Urgent booking on the dashboard, then Manage urgent requests. Pick one instrument in Equipment to see only its requests; the list covers only equipment you are responsible for, including equipment you cover as temporary OIC.",
          },
      { title: "Decide", body: "Read the reason and any document, then approve or reject. You may reschedule, including to a weekend." },
    ],
    rules: [
      "Students' requests reach you only after their supervisor approves.",
      "The user's wallet is charged only after final approval.",
      ...(g.is("admin")
        ? ["Requests expire after the period shown above the list. Click Change next to it to set the period; it applies to every department."]
        : ["Requests expire after the period shown above the list. It applies to every department, so only the Main Administrator can change it."]),
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
        ? "Equipment waitlist and Repeat samples show who is waiting and which repeats were arranged. Department/Centre starts on Institute Instrumentation Centre and Equipment on All equipment, where an Equipment column shows the instrument of each entry."
        : "Equipment waitlist and Repeat samples cover only the equipment you are responsible for, including equipment you cover as temporary OIC. They open on All equipment, with an Equipment column; pick one instrument in Equipment to see only its entries.",
    ],
    steps: [
      {
        title: "Queue depth and Clear queue",
        body: "Select one equipment to see its queue depth (0 means its waitlist is off) and to use Clear queue.",
      },
      {
        title: "Confirm manually",
        body: "Click Confirm manually next to an entry (shown as Confirm in the table), choose any unbooked slot and click Confirm booking.",
      },
      {
        title: "Arrange a repeat sample",
        body: "Open the user's completed booking in View Booking and click Mark as repeat & book (free). Booking opens straight away for that user, with their details at the top and the original parameters filled in. Change the parameters or the number of samples if needed (the slot time follows them), pick slots and confirm. The repeat is free and does not count toward the user's limits; the original booking is marked as repeated, the user is emailed, and any changed parameters are recorded in the booking history.",
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
    steps: compact([
      g.only(["admin"], {
        title: "Open it",
        body: "In the dashboard menu, choose Change slot status, pick the Department/Centre (IIC first) and then the equipment, and click Change slot status. The equipment page menu has it too.",
      }),
      g.only(["oic"], {
        title: "Open it",
        body: "In the dashboard menu, choose Change slot status, pick one of your equipment (including equipment you cover as temporary OIC) and click Change slot status. The equipment page menu has it too.",
      }),
      {
        title: "Pick the week",
        body: "Double-click a date (or drag across several) to open the Week view; it starts on the current week. One click on an arrow changes the week; double-clicking a date jumps to it.",
      },
      {
        title: "Select and apply",
        body: "Click slots, time labels (rows) or day headers (columns), then apply the new status.",
      },
      g.only(["oic", "admin"], {
        title: "Read the week",
        body: "The week uses the same colours and labels as the booking calendar, and a free slot whose time has passed shows No booking. Hatched slots with a lock are ones users cannot book or see, for example outside the user visibility window or closed by the multi-mode schedule; hover one to see why. A weekend or holiday slot you mark Available shows as Available, with a small dot in the corner.",
      }),
      g.only(["oic"], {
        title: "From your dashboard",
        body: "On the dashboard week calendar, click upcoming free slots of your equipment to select them, choose Available, Other Reasons (with an optional reason), Under Maintenance or Operator Absent under Mark as, and click Apply. Booked slots still open the booking; change booked or past slots here in Change slot status.",
      }),
      g.only(["oic", "admin"], {
        title: "Repeat block",
        body: "To block the same slots every week (say every Mon and Thu at 10:00), click Repeat block…, pick the weekdays, slot times, date range (Rest of this month, Next 12 months or custom dates) and an optional label, then Preview and Confirm and block. Slots created later in the range are blocked too. Remove a repeat block from the list below it to open its future slots again.",
      }),
    ]),
    rules: compact([
      g.only(["oic"], "Available only on equipment assigned to you."),
      "Admins and Officers In Charge can see and book slots in any week.",
      g.only(
        ["oic", "admin"],
        "Repeat block only blocks free slots. Booked slots keep their bookings (nothing is cancelled or refunded) and are listed for you; slots already blocked or under maintenance are left as they are.",
      ),
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
        body: "In the same page set the weekly view time range, the external slot quota, usage quotas, the sample submission lead time and the sample collect deadline. When next week's slots open (Slot window reference weekday and Reference time) is set by the Main Administrator only.",
      },
      {
        title: "Waitlist and urgent requests",
        body: "Under Waitlist and urgent requests set Waitlist depth (how many people can wait in the queue; 0 or empty = waitlist off), Open urgent requests at a time (Type A and B together), and the Type A (rush relief) and Type B (50% surcharge) limits per week. Empty means no limit and 0 means none accepted. Each box shows the current count, such as 3 of 10 in queue.",
      },
      {
        title: "Results deadline",
        body: "Under Booking and operator timings, set Results deadline (after the slot or sample receipt): a number of working days (default 2) or hours, counted from the end of the slot, or from the Sample Accepted time if the sample was received after the slot. Bookings whose sample has not been received have no results deadline. Working days skip Saturdays, Sundays and institute holidays; 0 means no deadline. Tick Show results deadline to users if users should see Results expected by on their bookings and the list in the sample submission policy; it is off by default, and the deadline still works for staff when it is off.",
      },
      {
        title: "Accessories",
        body: "Use Accessories and 3D Print Materials (where applicable) to keep booking options current.",
      },
      {
        title: "Fabrication materials",
        body: "Fabrication Materials holds the master list of 3D print materials and laser cutting sheets. Choose your 3D printer or laser cutter, then under Supported materials tick the materials it offers and click Save supported materials. A 3D printer can support only 3D print materials and a laser cutter only laser sheets, including ones another lab added (their price is set by that lab). Users can choose a material only when it is supported and enabled. Under Materials added for this equipment you add materials and set their prices; a new one is supported on your equipment automatically.",
      },
      {
        title: "Maximum print size",
        body: "For a 3D printer, under Lab settings → Maximum print size (mm) enter the largest X (width), Y (depth) and Z (height) it can print, choose Allow rotation to fit, and click Save settings. Users see the maximum next to the STL upload, and a model larger than it is refused straight away with its size and the maximum, so it is not uploaded and rejected later. Leave an axis empty for no limit on it; all empty means no limit. With Allow rotation to fit on (the default), a model that fits after turning it on its side is accepted, since the lab can re-orient it on the plate.",
      },
      {
        title: "Multi-mode equipment",
        body: "When one instrument runs in several modes (for example XPS with UPS and Depth Profile), open Multi-mode equipment and pick the base instrument. Click a day in the calendar (or Add schedule) and choose the mode; picking other equipment of your department makes it a mode. Leave From and To blank to make the mode always available, or enter dates (DD-MM-YYYY) to allow it only on those days. Add optional Repeat on days (for example Mon and Thu), optional hours, and whether other modes and the base can be booked at the same time. Answer No to run that mode on its own; the base and the other modes are then closed for those hours. A mode with no current schedule cannot be booked by users; Remove mode makes it a standalone instrument again. Use Slot status beside each mode to open its slots.",
      },
      {
        title: "Cover your leave",
        body: "Before planned leave, open OIC Substitute to let another OIC of your department manage your equipment for those days.",
      },
    ]),
    rules: [
      "A lead time of 0 means no sample deadline. With both values at 0 (walk-in), no sample emails are sent and bookings are not marked Not Utilized automatically.",
      "If no supported material is enabled, users see No materials configured — contact the OIC and cannot book; the page warns you. Disabling a material hides it from new bookings on every equipment but keeps it supported, so enabling it again brings it back. Bookings already made keep their material and price. Two supported materials cannot share a code. If the equipment's profile changes from 3D printing or laser cutting, its supported materials are removed but stay in the master list.",
      "The maximum print size is checked on every STL, including each file in a ZIP and files replaced after a rejection, both in the browser and on the server. STL sizes are read in millimetres and a model may be up to 0.5 mm over on each side. A model under 1 mm is not refused, but the user is warned it may have been exported in metres or inches.",
      "You can only add an instrument as a mode if you are its Officer In Charge and it is in the same department as the base. A mode that still has upcoming bookings or current or future schedules cannot be removed; clear those first.",
      "When a waitlist or urgent limit is reached, new users are told the waitlist is full or the urgent limit has been reached. Nobody already in the queue, and no request awaiting a decision, is removed. The weekly Type A and Type B limits count this week's (Monday–Sunday) approved requests plus the pending ones.",
      "Only you (as primary or temporary Officer In Charge) and the Main Administrator can change the results deadline. It replaces the old Auto Operator Unavailable and Auto Operator Absent Disruption hours: when results are still not shared after the deadline, the booking goes to Operator Absent (the user chooses refund or reschedule) if the sample is with the lab, as before. A sample forwarded to the lab but never accepted is marked Operator Unavailable with a full refund after the same period counted from the slot end, and a sample whose receipt was never recorded is treated as Booking Not Utilized, as before. Use Extend results deadline in the booking details for a genuine delay.",
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
      {
        title: "3D print actual weight and time",
        body: "After printing, open the booking and click Set actual weight & time (choose the file first when the booking has several STL files). Enter the total weight and time of all copies of that file, including the Quantity Required; the form starts from the estimated total. Saving recalculates the amount with the same rates and GST as the estimate: a lower amount waits for your Confirm refund, a higher amount is collected with Deduct Money or the user's Pay Now.",
      },
      {
        title: "Quantity Required (field A)",
        body: "Every 3D printer and laser cutter asks for Quantity Required (field key A, a whole number from 1 by default), the number of copies of the whole job. For 3D printing the weight and print time are multiplied by it; for laser cutting the sheet material charge is multiplied by it, and the machine time only when your time formula uses A. Booking details and exports show it under A, and reports count it as the number of samples. Bookings made before it was added count as 1 and keep their charge.",
      },
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

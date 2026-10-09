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
        )} Use search, Status, dates and All equipment; More filters shows the rest. The list updates as soon as you change a filter or type 2 or more characters in search; Clear resets them. By default the list is in status order: Result Overdue (earliest due first), Pending, Booked (including rescheduled) and Awaiting your choice, oldest slot first; then Operator Unavailable, Booking Not Utilized, Refunded / Cancelled, Completed and the rest, most recent slot first. Click any column heading to sort by it; Default order goes back. Rows per page, below the list, shows 10, 25, 50, 100 or 500 bookings per page and is remembered on this browser. Export downloads every booking matching the filters, search and sort (not just the page on screen) with everything the user entered, including tables, each sample set and uploaded file names. Excel (.xlsx) adds Sample sets and Input tables sheets, CSV keeps each booking on one row, and PDF shows a summary page and then one card per booking. Excel and CSV take up to 10,000 bookings; PDF up to 500.${g.pick(
          { operator: " Amounts are not included." },
          " The file includes the amount and its charge breakdown."
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
        title: "Pending and Result Overdue",
        body: "Once the sample is marked Sample Accepted (or the booking is Processing, or for walk-in equipment once the slot has ended), the booking shows as Pending until it is completed or otherwise closed. Results become overdue a set time after the booking end, or after the Sample Accepted time plus the booked time if that is later: 24 hours unless the Officer In Charge changed Results overdue after (hours) for the equipment; the booking then shows as Result Overdue. A sample held at the office or rejected keeps the booking Booked. Bookings without a received sample are never Pending or overdue. These statuses are shown in the list, booking details, calendar and exports, and charges, cancellation, refunds and reschedule rules still follow Booked. Until the due time the job sheet and booking details show Results due by the time; after it they show Results overdue by the hours (counted from that time) and the Results overdue card on the dashboard lists the booking. Choose Pending or Result Overdue in Status to see only those. The equipment's results deadline, if set, is shown separately as Results deadline. Share the results and complete the booking; for a genuine delay, send the user the Results delayed reminder, and the Officer In Charge or Admin can use Extend results deadline in the booking details.",
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
      g.only(["oic", "admin", "operator"], {
        title: "Messages from users at sign-in",
        body: "After you sign in, the items needing your attention include Unread messages from users: bookings whose user sent a message through Message the lab that no one has answered yet, with the booking ID, the start of the message and when it was sent. Click one to open the booking at its messages; that marks its notifications read. View all opens View Booking.",
      }),
    ]),
    rules: compact([
      g.only(["operator"], "Refunds, disruptions and reschedules are done by the Officer In Charge or Admin."),
      g.only(
        ["operator"],
        "Disruptions (Under Maintenance, Scheduled Maintenance, Operator Absent and Other Reasons) are recorded with an optional reason and the action taken. If you are allowed to change slot status, you are asked for them too; the Officer In Charge can add details and service reports later.",
      ),
      g.only(
        ["oic", "admin"],
        "IIC material can be charged only on own-material 3D print and laser bookings that are not cancelled or refunded, including completed ones, by the equipment's Officer In Charge (or temporary OIC) and the Main Administrator. Only the Main Administrator can enter a different amount."
      ),
      g.only(["dept_admin"], "Completion and exception handling stay with the Officer In Charge and Lab Operator."),
      "Cancelled and refunded bookings keep their original dates.",
      g.only(["oic", "admin", "operator"], "Up to 3 reminders and 5 questions can be sent per booking in 24 hours, shared by all lab staff; sending the same text twice within 2 minutes sends it once."),
    ]),
    tips: compact([
      g.only(["operator"], "Bookings awaiting completion on the dashboard lists runs that are over and whose sample has been marked Sample Accepted (received), but are not completed, with when the sample was received. The Results column shows Due by a time until the results overdue time (24 hours after the booking end, or after the receipt plus the booked time if later, unless the Officer In Charge changed it), then Overdue by counted from that time. The daily 9:00 AM reminder email and the login reminder include a booking only once it is overdue, every day until it is completed. Results deadline shows the equipment's separate results deadline, if any. A booking whose sample was never received is not listed: it follows the Booking Not Utilized rule."),
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
      g.is("admin")
        ? {
            title: "Sign-in alerts",
            body: "After you sign in, the items needing your attention list up to 5 urgent requests waiting for a decision; click one to open its details directly. The equipment's Officer In Charge (and temporary OIC) also gets an email when a Type B request is raised and when the supervisor approves it.",
          }
        : {
        title: "Email and sign-in alerts",
        body: "You get an email when a Type B request is raised for your equipment (including equipment you cover as temporary OIC) and, for a student's request, another when the supervisor approves it and it is ready to allocate. The email shows the request ID, requester category, required time, amount, preferred dates and reason; Open urgent request takes you to it. After you sign in, the items needing your attention list up to 5 waiting requests; click one to open its details directly.",
      },
      {
        title: "Decide",
        body: "Click Review. The top of the details shows the required time, slots, samples, amount (with the 50% surcharge), whether the wallet can pay and the user's approved urgent requests in the last 6 months. Reason given by user and Supervisor comment (with the supervisor's decision and date, or Awaiting supervisor / Not required) sit side by side, followed by the sample details, any document and the preferred dates. Add optional decision notes, then approve or reject.",
      },
      {
        title: "Approve & allocate",
        body: "A Type B request marked No slots · OIC allocates has no slots. Click Approve & allocate to open the weekly calendar used in Change slot status. Pick a year and month or use Previous Week / Next Week to reach any week, including weeks not yet open to users. Click slots to select them (selections are kept when you change week), or click Select back-to-back slots. Weekends, holidays, Not Available, closed and maintenance slots can be chosen and are listed as a warning; only slots booked by someone else and past slots cannot. Check the selected time against the required time, the amount and the wallet, add an optional note, then click Allocate booking.",
      },
      { title: "Export", body: "Export downloads every request matching the filters as Excel (.xlsx), CSV or PDF." },
    ],
    rules: [
      "Students' requests reach you only after their supervisor approves.",
      "The user's wallet is charged only after final approval.",
      "Allocate booking stays off while the wallet is short of the amount; the shortfall is shown. Once allocated, the booking is confirmed, the chosen slots become Booked (their previous status is kept in Disruption history), the user and the supervisor get the usual confirmation email, and the equipment's lab operator gets an email with the booking ID, slots, requester category and sample details.",
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
        body: "Click Confirm manually next to an entry (shown as Confirm in the table), choose any unbooked slot and click Confirm booking. If the booking would take the user over a weekly or monthly limit, an amber warning shows the minutes used and the limit; you can still confirm, because staff bookings skip limits.",
      },
      { title: "Export", body: "On Equipment waitlist and Repeat samples, Export downloads the list for the chosen Department/Centre, Equipment and tab as Excel (.xlsx), CSV or PDF." },
      {
        title: "Arrange a repeat sample",
        body: "Open the user's completed booking in View Booking and click Mark as repeat & book (free). Booking opens straight away for that user, with their details at the top and the original parameters filled in. Change the parameters or the number of samples if needed (the slot time follows them), pick slots and confirm. The repeat is free and does not count toward the user's limits; the original booking is marked as repeated, the user is emailed, and any changed parameters are recorded in the booking history.",
      },
    ],
    rules: [
      "Any unbooked slot can be used, including weekends, holidays, closed, blocked and maintenance slots.",
      "The charge is debited from the user's wallet.",
      "Waitlisted users are confirmed automatically only into slots freed when a booking is cancelled or rescheduled. Slots lab staff open (marked Available, maintenance ended or equipment back to Operational) are never used automatically; use Confirm manually to place someone there.",
      "Automatic confirmation and joining the waitlist follow the user's weekly and monthly limits, counted in the week and month of the slot. A user whose limit would be exceeded is not added to the waitlist; if already waiting, they are skipped (they stay waitlisted, with the reason shown) and the slot goes to the next person in the queue.",
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
        body: "In the dashboard menu, choose Change slot status: the slot calendar opens straight away. Switch the Department/Centre (IIC first) and the equipment with the two filters at the top. The equipment page menu has it too.",
      }),
      g.only(["oic"], {
        title: "Open it",
        body: "In the dashboard menu, choose Change slot status: the slot calendar of your first equipment opens straight away. Switch to another of your equipment (including equipment you cover as temporary OIC) with the Equipment filter at the top. The equipment page menu has it too.",
      }),
      {
        title: "Pick the week",
        body: "Double-click a date (or drag across several) to open the Week view; it starts on the current week. One click on an arrow changes the week; double-clicking a date jumps to it.",
      },
      {
        title: "Select and apply",
        body: "Click slots, time labels (rows) or day headers (columns), then apply the new status.",
      },
      g.only(["oic", "admin", "operator"], {
        title: "Choose the operation",
        body: "Under Maintenance, Scheduled Maintenance, Operator Absent and Other Reasons are disruptions: booked slots in them are cancelled and refunded, and each one is recorded in the disruption history. Not Available closes slots without counting as a disruption. Reserved for External keeps slots for an external (I-STEM) user, with an optional I-STEM FBR reference; users cannot book them, but you can book them for the external user with Book slots for a user. Not Available and Reserved for External leave booked slots unchanged.",
      }),
      g.only(["oic", "admin"], {
        title: "Record the reason",
        body: "When you mark a disruption, a short dialog shows what will change and asks for a category and a reason. When you make the slots Available again, it asks for the action taken and lets you attach a service report (PDF, image or Word, up to 20 MB). Everything is optional: Skip applies the change, and you can add the details later from the disruption history.",
      }),
      g.only(["oic", "admin"], {
        title: "Read the week",
        body: "The week uses the same colours and labels as the booking calendar, and a free slot whose time has passed shows No booking. Hatched slots with a lock are ones users cannot book or see, for example outside the user visibility window or closed by the multi-mode schedule; hover one to see why. A weekend or holiday slot you mark Available shows as Available, with a small dot in the corner.",
      }),
      g.only(["oic"], {
        title: "From your dashboard",
        body: "On the dashboard week calendar, click upcoming free slots of your equipment to select them, choose Available, Other Reasons (with an optional reason), Under Maintenance, Scheduled Maintenance, Operator Absent, Not Available or Reserved for External under Mark as, and click Apply. The same reason and action-taken prompts appear. Booked slots still open the booking; change booked or past slots here in Change slot status.",
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
        "Setting equipment to Under Maintenance or back to Operational from its card asks for the same reason or action taken; the whole period is recorded as one disruption.",
      ),
      g.only(
        ["oic", "admin", "operator"],
        "Operator Unavailable, Under maintenance and Analysis Not Possible on a booking are recorded as disruptions too, with an optional category.",
      ),
      g.only(
        ["oic", "admin"],
        "Repeat block only blocks free slots. Booked slots keep their bookings (nothing is cancelled or refunded) and are listed for you; slots already blocked or under maintenance are left as they are.",
      ),
      g.only(
        ["oic", "admin"],
        "Slots you mark Available, or open by removing a repeat block, are not given to waitlisted users automatically; only slots freed by a cancellation or reschedule are. Use Confirm manually on Equipment waitlist to place someone.",
      ),
    ]),
  };
}

export function disruptionHistorySection(g: Gate): GuideSection {
  return {
    id: "disruption-history",
    title: "Disruption history",
    icon: "settings",
    group: LAB,
    intro: [
      g.pick(
        {
          oic: "Every disruption on your equipment (including equipment you cover as temporary OIC) is recorded with its reason, the action taken and any service report.",
          dept_admin: "Every disruption on your department's equipment is recorded with its reason, the action taken and any service report.",
        },
        "Every disruption on every equipment is recorded with its reason, the action taken and any service report.",
      ),
    ],
    steps: [
      {
        title: "Open it",
        body: "In the dashboard menu, choose Disruption history. If some disruptions have no reason yet, a banner on the dashboard says how many; click Review to see just those, or dismiss it for this session.",
      },
      {
        title: "Filter",
        body: g.pick(
          { admin: "Filter by date range, department, equipment, type, open or closed, where it was recorded from, or Reason / Action not recorded, and search by equipment, reason or action. Click a type chip under the totals to show only that type." },
          "Filter by date range, equipment, type, open or closed, where it was recorded from, or Reason / Action not recorded, and search by equipment, reason or action. Click a type chip under the totals to show only that type.",
        ),
      },
      {
        title: "Read the table",
        body: "The table scrolls inside its own box: the column headings, S.No and Equipment stay in view, and the sideways scrollbar is always at the bottom of the box. Started by and Ended by show who did it, their role at the time (OIC, Temp OIC, Main Admin, Dept Admin or Operator) and when. Open disruptions show the expected recovery under Status; Procurement lists requests raised for the disruption.",
      },
      {
        title: "Add details",
        body: "Click a row to open it. Add or change the category and reason, record the action taken and attach a service report (PDF, image or Word, up to 20 MB). The timeline lists every change and who made it.",
      },
      {
        title: "Expected recovery",
        body: "When you mark slots or equipment as disrupted you can give an expected recovery date and time; leave it empty if not known. Change it later from the opened entry (Mark as not known clears it); every change is kept in the timeline. Users see it on the equipment page, the equipment card and when they hover over the slot, for example “Expected back: Mon 13 Oct, 10:00” or “Recovery date not yet announced”. Once the time passes they see “Recovery delayed — update awaited”; the status does not change on its own.",
      },
      {
        title: "Procurement request after service",
        body: "When the equipment's department has Procurement & Assets enabled, the dialog for making slots or equipment available again has Service person recommended items?. Tick it, choose Consumables, Minor assets or Major assets, and list the items (quantity, estimated cost, notes). The request goes through the usual approval with the service report attached, and its number appears in the history. For a closed disruption, use Raise procurement request in the opened entry.",
      },
      {
        title: "Delete an entry",
        body: g.pick(
          {
            admin: "To remove a wrong or duplicate entry, click the bin icon on its row (or Delete entry in the opened entry), optionally give a reason, and confirm. It disappears from the history, totals, exports and reports; slot statuses and bookings are not changed. Tick Show deleted entries to see deleted entries with who deleted them and why, and click Restore to bring one back.",
          },
          "To remove a wrong or duplicate entry, click the bin icon on its row (or Delete entry in the opened entry), optionally give a reason, and confirm. It disappears from the history, totals, exports and reports; slot statuses and bookings are not changed.",
        ),
      },
      {
        title: "Export",
        body: "Export downloads all disruptions matching the filters as Excel, CSV or PDF.",
      },
    ],
    rules: [
      "Under Maintenance, Scheduled Maintenance, Operator Absent and Other Reasons count as disruptions. Not Available, Reserved for External, Booking Not Utilized, holidays and closed days do not.",
      "Neighbouring slots marked together form one disruption; equipment Under Maintenance is one disruption until it is made Operational again.",
      "Disruption hours in Reports are downtime (under maintenance, scheduled maintenance and operator absent) plus slots marked for other reasons.",
      "Deleting a disruption that is still ongoing leaves its slots (or the equipment) in their current status; make them available again as usual when ready.",
      "Users see only the disruption type, the reason you recorded (or a standard sentence if none) and the expected recovery — never staff names, action notes or service reports.",
    ],
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
        title: "Results overdue time",
        body: "Under Booking and operator timings, set Results overdue after (hours), 24 by default (1 to 720). It counts from the booking end, or from the Sample Accepted time plus the booked time if that is later; for example, a 2-hour booking that ended at 2:00 PM with the sample accepted at 4:00 PM becomes overdue at 6:00 PM the next day. Until then the booking shows Results due by that time, with no overdue counter, no Results overdue listing and no reminder. After it, the Lab Operators and you see Overdue by counted from that time, the booking appears under Results overdue, and the daily 9:00 AM completion reminder includes it until it is completed. Tick Show results countdown to users (off by default) if users should see Results expected by that time and, after it, Results overdue by the hours in their booking details.",
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
        body: "For a 3D printer, under Lab settings → Maximum print size (mm) enter the largest X (width), Y (depth) and Z (height) it can print, choose Allow rotation to fit, and click Save settings. Users see the maximum next to the STL upload, and a model larger than it is refused straight away with its size and the maximum, so it is not uploaded and rejected later. Leave an axis empty for no limit on it; all empty means no limit. With Allow rotation to fit on (the default), a model that fits after turning it on its side is accepted, since the lab can re-orient it on the plate. The X and Y (and Z) are also the build plate drawn in the 3D preview on the booking page and in booking details; without them the preview uses 220 × 220 mm.",
      },
      {
        title: "3D print estimate settings",
        body: "For a 3D printer, the Weight & time estimate card in Fabrication Materials sets how weight and print time are estimated. The printer type is detected from its make and model (for example Bambu Lab, Prusa, resin); choose another under Printer type if it is wrong. Change any value (speeds, wall count, layer overhead, warm-up, support density and so on) and click Save estimate settings; leave a box empty to use the default shown. Under Separate support materials, tick the materials users may print supports in (for example PVA); with none ticked, supports use the model material. Once at least 3 parts have actual weight or time entered, Fit from actuals shows how far the estimates were off and the correction factor; Apply factors uses it for new estimates and Turn off removes it.",
      },
      {
        title: "Multi-mode equipment",
        body: "When one instrument runs in several modes (for example XPS with UPS and Depth Profile), open Multi-mode equipment and pick the base instrument. Click a day in the calendar (or Add schedule) and choose the mode; picking other equipment of your department makes it a mode. Leave From and To blank to make the mode always available, or enter dates (DD-MM-YYYY) to allow it only on those days. Add optional Repeat on days (for example Mon and Thu), optional hours, and whether other modes and the base can be booked at the same time. Answer No to run that mode on its own; the base and the other modes are then closed for those hours. A mode with no current schedule cannot be booked by users; Remove mode makes it a standalone instrument again. Use Slot status beside each mode to open its slots. Users see the result as a one-line summary of each mode's days and next free day at the top left of the equipment card photo (in place of the category) and beside the name on the equipment page, and in full under Availability by mode in Availability calendar.",
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
      "Changing the print estimate settings or calibration affects only new estimates; bookings already made keep their weight, time and charge. Supports in a separate material are charged at that material's rate, and with Own material no material is charged for the model or the supports.",
      "You can only add an instrument as a mode if you are its Officer In Charge and it is in the same department as the base. A mode that still has upcoming bookings or current or future schedules cannot be removed; clear those first.",
      "When a waitlist or urgent limit is reached, new users are told the waitlist is full or the urgent limit has been reached. Nobody already in the queue, and no request awaiting a decision, is removed. The weekly Type A and Type B limits count this week's (Monday–Sunday) approved requests plus the pending ones.",
      "The results overdue time and the results deadline are separate: the results overdue time decides when a booking counts as overdue (counter, Results overdue list and reminders), while the results deadline is the date users may be shown and the point at which the automatic Operator Absent / Operator Unavailable outcome can act. Extend results deadline on a booking moves both. Bookings that are already past the results overdue time get the next 9:00 AM reminder as usual.",
      "Only you (as primary or temporary Officer In Charge) and the Main Administrator can change the results deadline and the results overdue time. It replaces the old Auto Operator Unavailable and Auto Operator Absent Disruption hours: when results are still not shared after the deadline, the booking goes to Operator Absent (the user chooses refund or reschedule) if the sample is with the lab, as before. A sample forwarded to the lab but never accepted is marked Operator Unavailable with a full refund after the same period counted from the slot end, and a sample whose receipt was never recorded is treated as Booking Not Utilized, as before. Use Extend results deadline in the booking details for a genuine delay.",
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
      { title: "My Tickets", body: "Lists the tickets you raised; raise a new one with a clear description and booking ID. Export downloads the tickets on the tab you are viewing as Excel (.xlsx), CSV or PDF." },
    ]),
  };
}

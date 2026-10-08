/** Booking policy chapters for roles that book equipment. Items are filtered per role. */

import { compact, URGENT_BOOKERS, WALLET_MEMBERS, type Gate } from "../gate";
import type { GuideSection } from "../types";

const GROUP = "Policies";

export function waitlistSection(): GuideSection {
  return {
    id: "waitlist",
    title: "Waitlist",
    icon: "clock",
    group: GROUP,
    intro: [
      "When an instrument is full, you can join its first-come, first-served waitlist (if the lab has enabled one). You get a position — WL1, WL2 and so on.",
    ],
    steps: [
      {
        title: "Join",
        body: "Choose the waitlist option when the booking cannot be completed. The page shows your place in the queue (for example, You're #2 in the queue) and you are emailed your WL position.",
      },
      {
        title: "Get promoted",
        body: "When another booking is cancelled or rescheduled and frees a slot, WL1 is confirmed automatically with the normal checks, and you are emailed. Slots the lab opens itself (for example after maintenance) are not used automatically.",
      },
      {
        title: "Leave",
        body: "Use Leave Waitlist on the entry in My Bookings. Everyone behind you moves up.",
      },
    ],
    rules: [
      "Nothing is charged while you are only waitlisted; the wallet is checked at promotion.",
      "Each equipment has a maximum queue; when it is full you cannot join.",
      "Entries not promoted before the slot window are cleared.",
    ],
  };
}

export function urgentSection(g: Gate): GuideSection | null {
  if (!g.is(...URGENT_BOOKERS)) return null;
  const member = g.is(...WALLET_MEMBERS);
  return {
    id: "urgent",
    title: "Urgent booking",
    icon: "alert",
    group: GROUP,
    intro: [
      "For a genuine short-notice need the normal calendar cannot meet. On the booking page click Request urgent booking (when the equipment offers it) and choose a type.",
    ],
    steps: compact([
      {
        title: "Type A — Rush relief (no surcharge)",
        body: "If you failed at least 2 peak-window booking attempts in the last 14 days, click Book advance week (Type A — normal rates) and book a slot in the advance week at normal rates.",
      },
      {
        title: "Type B — Urgent with reason (50% surcharge)",
        body: "You do not pick slots. Click Continue: describe your requirement (or Enter requirement (Type B) in My Urgent Requests), fill in Step 1, check the required time and the amount with the 50% surcharge, add preferred dates if any, give a reason (at least 10 characters, document optional), tick I confirm my reason is genuine and accept the 50% urgent surcharge, then click Submit Type B request.",
      },
      g.when(member, {
        title: "Follow the approval",
        body: "Your supervisor approves first, then the Officer In Charge allocates a day and time (any day, including weekends). You and your supervisor get the booking confirmation by email. Track it under Urgent booking request on the dashboard.",
      }),
      g.only(["faculty"], {
        title: "Approve your students' requests",
        body: "Open Urgent booking requests on the dashboard, then Manage urgent requests. Read the reason and approve or reject; the Officer In Charge decides next.",
      }),
    ]),
    rules: compact([
      "Quota-limit failures do not count towards Type A, and using Type A resets the 14-day window.",
      g.when(member, "Nothing is charged when you submit a Type B request. Your supervisor's wallet is charged when the Officer In Charge allocates the booking, so keep enough balance for the amount shown."),
      g.only(["faculty"], "Nothing is charged when a Type B request is submitted; the wallet is charged when the Officer In Charge allocates the booking, so keep enough balance for the amount shown."),
      "Weekly caps may apply. Urgent bookings never cancel other users' confirmed bookings.",
    ]),
    tips: ["After the Officer In Charge allocates your Type B booking, submit your sample at the earliest."],
  };
}

export function disruptionsSection(): GuideSection {
  return {
    id: "disruptions",
    title: "Disruptions and refunds",
    icon: "shield",
    group: GROUP,
    intro: [
      "If the lab cannot run your booking, you are emailed and the booking waits for your choice with a decision deadline.",
    ],
    glossary: [
      { term: "Under Maintenance", meaning: "Instrument down. Cancel with refund now, or reschedule once it is Operational." },
      { term: "Operator Absent / Operator Unavailable", meaning: "No operator. Cancel with refund or reschedule; a full closure is refunded." },
      { term: "Analysis Not Possible", meaning: "Power, network, safety or other failure. The email gives the reason and your options." },
      { term: "Booking Not Utilized", meaning: "You did not attend or the sample never arrived. Usually not refunded." },
    ],
    rules: [
      "Act before the deadline; otherwise the booking may be cancelled automatically under the policy.",
      "Facility-side disruptions are refunded or rescheduled. Not Utilized is user-side.",
    ],
    tips: ["Cancel unused bookings early to avoid Not Utilized."],
  };
}

export function samplesSection(g: Gate): GuideSection {
  const deadline = g.pick(
    {
      external: "Your sample deadline is the slot start time.",
      startup:
        "Your sample deadline is the slot start time minus the sample lead time configured for the equipment (for External Startups/MSMEs, the slot start time).",
    },
    "Your sample deadline is the slot start time minus the sample lead time configured for the equipment (for example, 24 hours)."
  );
  return {
    id: "samples",
    title: "Samples",
    icon: "flask",
    group: GROUP,
    intro: [
      "Most instruments need your sample before the slot. Each booking shows its sample deadline in the booking details, and a reminder email and notification are sent 12 hours before it.",
    ],
    steps: [
      {
        title: "Submit before the deadline",
        body: `${deadline} A deadline on a Saturday, Sunday or institute holiday moves to the same time on the previous working day. Pack and label the sample as the equipment page says and declare hazards.`,
      },
      {
        title: "Have the receipt recorded",
        body: "When you hand over the sample, request the Lab Operator to record its receipt in the portal. Follow it under Sample Lifecycle in the booking details. The time for results starts only once receipt is recorded.",
      },
      {
        title: "Collect after analysis",
        body: "The completion email gives the collection deadline. Collect from the lab within it.",
      },
    ],
    rules: [
      "A sample whose receipt has not been recorded is considered not submitted: the booking is treated as Booking Not Utilized and the charges are not refunded. The portal applies this automatically 24 hours after the slot ends.",
      "If you will be late, inform the lab before the deadline through Message the lab in the booking details (Sample submission delayed). Late samples may be refused.",
      "Equipment without a sample lead time (for example, electron microscopes) takes the sample at the slot: bring it at the start of your slot, and the Lab Operator records its receipt then.",
      "You are welcome to submit your sample before the deadline, provided it is not atmosphere-sensitive. Early submission does not lead to earlier analysis or earlier results; the sample is analysed in your booked slot.",
      "Where the equipment permits, choose Atmosphere-sensitive sample (submit at slot start) while booking to submit at the start of the slot.",
      "Once the lab has accepted your sample, the booking can no longer be rescheduled or cancelled.",
      "Each instrument has a target time within which the lab shares results after analysis, and in most cases results arrive within it; you are emailed and notified when they are available. The time counts from the end of your slot, or from the sample receipt if the lab receives the sample after the slot; no results date applies before receipt is recorded. Where the lab publishes this time, the sample submission policy lists it and your booking details show Results expected by with the date (working days exclude Saturdays, Sundays and institute holidays). In rare circumstances, such as a medical emergency or other unforeseen events, results may be delayed; the lab will inform you if this happens.",
      "Some labs also show a results countdown in your booking details: Results expected by a date and time (24 hours after your booking ends, or after your sample is received plus your booked time if that is later, unless the lab set a different time) and, if that time passes before the results are shared, Results overdue by the hours.",
      "Uncollected samples may be discarded after the deadline; ask the lab before it if you need longer.",
      "Walk-in equipment has no sample deadlines: bring the sample to the slot and take it back yourself.",
    ],
  };
}

export function statusesSection(): GuideSection {
  return {
    id: "statuses",
    title: "Booking statuses",
    icon: "list",
    group: "Help",
    intro: ["What each status on My Bookings means."],
    glossary: [
      { term: "Pending", meaning: "Submitted; waiting for the next step." },
      { term: "Awaiting payment", meaning: "Pay to secure the slot." },
      { term: "Waitlisted", meaning: "In the queue (WL1, WL2 …); nothing charged yet." },
      { term: "Booked", meaning: "Confirmed. Note the sample deadline." },
      { term: "Awaiting your choice", meaning: "A disruption needs your decision before the deadline." },
      { term: "Completed", meaning: "Analysis finished; results appear when published." },
      { term: "Cancelled / Refunded", meaning: "Closed; dates are kept." },
      { term: "Booking Not Utilized", meaning: "Not used for user-side reasons; usually no refund." },
    ],
  };
}

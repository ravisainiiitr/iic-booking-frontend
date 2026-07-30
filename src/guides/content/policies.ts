/** Shared operational policy chapters for Internal User Guides. */

import type { GuideFaq, GuideSection } from "../types";
import { PRODUCT_NAME } from "../types";

/**
 * All operational policy sections for internal end users
 * (students, faculty, project staff, startups).
 */
export function internalOperationalPoliciesSections(): GuideSection[] {
  return [
    waitlistPolicySection(),
    urgentBookingPolicySection(),
    underMaintenancePolicySection(),
    operatorAbsentPolicySection(),
    bookingNotUtilizedPolicySection(),
    otherDisruptionPolicySection(),
    sampleSubmissionPolicySection(),
    sampleCollectionDiscardPolicySection(),
    operationalPoliciesFaqSection(),
  ];
}

export function waitlistPolicySection(): GuideSection {
  return {
    id: "policy-waitlist",
    title: "Waitlist Policy",
    paragraphs: [
      `When an instrument is fully booked, the ${PRODUCT_NAME} can place you on a first-come, first-served (FCFS) waitlist instead of rejecting your request outright. Waitlisting is available only when the laboratory has enabled a waitlist queue depth for that equipment.`,
      "Being on the waitlist is not the same as a confirmed booking. Your wallet is not charged until the system promotes you and creates a confirmed booking.",
    ],
    bullets: [
      "What is a waitlist? — A queue of eligible users waiting for the next free slot on a specific instrument.",
      "When do you join? — Typically when your booking attempt fails because slots are unavailable (or when the lab offers an explicit “join waitlist” option).",
      "Positions WL1, WL2, … — Assigned in the order you joined among users who are still actively waiting. WL1 is first in line for automatic confirmation.",
      "Queue depth — Each equipment has a configured maximum number of waitlisted users (for example, 10). Once the queue is full, further users cannot join and see a “no slots / waitlist full” style message.",
      "Promotion — When a confirmed booking is cancelled, refunded, or otherwise releases slots (and timing rules allow), the system tries to confirm waitlisted users in order, applying the same eligibility, quota, and wallet checks as a normal booking.",
      "Notifications — You receive an email when you are added to the waitlist (with your WL position) and again when you are promoted to a confirmed booking.",
      "Leave Waitlist (opt-out) — You may voluntarily withdraw. Your place is kept for laboratory records, but you will no longer be auto-confirmed. The queue compresses for everyone behind you.",
      "Sample submission while waitlisted — Where enabled, you may submit / declare your sample before confirmation so the lab can prepare if you are promoted close to the slot time.",
      "If you are never promoted — You stay waitlisted until you opt out, the laboratory clears the queue, business rules mark your request as cannot-fulfil, or a scheduled clear near the slot window removes remaining entries. No booking charge applies while you were only waitlisted.",
    ],
    callouts: [
      "Important: No wallet debit occurs while you are only on the waitlist. Balance is checked when you are promoted.",
      "Related: Booking Workflow · Cancellation · Wallet & Refund Policy · Sample Lifecycle (elsewhere in this guide).",
    ],
    steps: [
      {
        title: "Example 1 — Filling slots and the waitlist",
        body: "Available slots = 5 and waitlist depth = 10. Fifteen users try to book the same window. The first five eligible users receive confirmed bookings. The next ten receive positions WL1–WL10. The remaining users are not added to the queue.",
      },
      {
        title: "Example 2 — Promotion after a cancellation",
        body: "A confirmed user cancels. If the released slot is far enough in advance (per the equipment’s reschedule threshold), WL1 is automatically confirmed, charged, and notified. Former WL2 becomes WL1, and so on.",
      },
      {
        title: "Example 3 — Opt-out compresses the queue",
        body: "You hold WL4 and choose Leave Waitlist. You are marked opted out and will not be auto-confirmed. Former WL5 becomes WL4, WL6 becomes WL5, and so on.",
      },
    ],
  };
}

export function urgentBookingPolicySection(): GuideSection {
  return {
    id: "policy-urgent",
    title: "Urgent Booking Policy",
    paragraphs: [
      "Urgent booking is a controlled exception for situations where the normal calendar cannot meet a genuine short-notice scientific or academic need. It is not a shortcut for everyday planning.",
      "Availability and review paths depend on the equipment and your role. Many urgent requests require Officer In-charge (OIC) and/or supervisor review.",
    ],
    bullets: [
      "What qualifies — Typically: repeated inability to obtain a slot despite genuine attempts (NO_SLOT path), or a documented urgent need supported by a reviewer/supervisor (REVIEWER_URGENT path with evidence).",
      "Who can request — Internal users for whom the equipment exposes Urgent Request. External users generally follow different processes.",
      "Approvals — OIC reviews equipment-linked urgent requests. REVIEWER_URGENT additionally needs documentary evidence and supervisor/reviewer involvement as configured.",
      "Effect on slots — Approved urgent flows may allocate or hold capacity according to lab rules; they do not silently cancel other users’ confirmed bookings.",
      "Waitlist — Urgent requests are a separate workflow from the FCFS waitlist. Joining a waitlist is not the same as an urgent approval.",
      "Limits — Equipment may cap how many urgent requests are accepted; peak-window and disclaimer acknowledgements may apply. Misuse can lead to rejection.",
    ],
    callouts: [
      "Warning: Submit urgent requests only with a genuine need and complete evidence when asked. False urgency delays everyone.",
      "Related: Contact Lab In-charge / OIC · Raise Support Ticket · Booking Workflow.",
    ],
    steps: [
      {
        title: "Example — No slot after repeated tries",
        body: "You tried the calendar several times over days with no free slot. You raise an urgent NO_SLOT request from the equipment/dashboard path, accept the disclaimer, and wait for OIC review. Until approved, you do not have a confirmed booking.",
      },
      {
        title: "Example — Supervisor-documented urgency",
        body: "Your thesis reviewer asks for characterisation before a hard deadline. You submit a REVIEWER_URGENT request with the required evidence file and comments. After approval, follow the booking/hold instructions shown in the portal.",
      },
    ],
  };
}

export function underMaintenancePolicySection(): GuideSection {
  return {
    id: "policy-under-maintenance",
    title: "Under Maintenance Policy",
    paragraphs: [
      "When an instrument is placed Under Maintenance, it is not available for normal new bookings. Existing confirmed bookings that are affected enter a disruption workflow so you can cancel with refund or reschedule once the instrument is operational again.",
    ],
    bullets: [
      "New bookings — Slots stay blocked (under maintenance) while the equipment status remains non-operational.",
      "Existing bookings — Affected users are notified by email and see an “awaiting your choice” style status with a decision deadline.",
      "Your options — Cancel with refund (typically available during the disruption), or reschedule after the laboratory marks the equipment operational again (extra calendar flexibility may be granted).",
      "If you take no action — The system may auto-cancel at the published deadline and refund according to maintenance policy.",
      "When maintenance ends — Freed capacity returns to Available (subject to lab rules); waitlisted users may be considered for FCFS confirmation where applicable.",
    ],
    callouts: [
      "Check My Bookings and email promptly after a maintenance notice — deadlines are real.",
      "Related: Other Disruption Policy · Wallet & Refund Policy · Booking Cancellation.",
    ],
    steps: [
      {
        title: "Example — Same-day maintenance",
        body: "Your afternoon SEM booking is flagged when the instrument goes under maintenance that morning. You receive an email with a decision deadline. You cancel and receive a wallet refund, then rebook later when the instrument is Operational.",
      },
      {
        title: "Example — Reschedule after repair",
        body: "You keep the booking during maintenance. When the lab marks the instrument Operational, you use the unlocked reschedule window (often with an extra week of visibility) to pick a new slot without losing your place unnecessarily.",
      },
    ],
  };
}

export function operatorAbsentPolicySection(): GuideSection {
  return {
    id: "policy-operator-absent",
    title: "Operator Absent Policy",
    paragraphs: [
      "Laboratory work depends on trained operators. If the assigned Lab In-charge / operator cannot run your session, the portal treats this as an operator-absence disruption (distinct from equipment maintenance).",
    ],
    bullets: [
      "Short absence — Staff may place bookings into a disruption-pending state so you can choose cancel (usually with refund) or wait for reschedule instructions.",
      "Prolonged / full operator unavailable — Bookings may be closed as Operator Unavailable with a full wallet refund, and slots released for others (including waitlist FCFS when timing rules allow).",
      "Notifications — You are emailed with the reason context and any decision deadline.",
      "New slots — Released slots can become Available again unless other holds (for example maintenance) apply.",
      "Difference from Not Utilized — Operator absence is a laboratory-side issue. Booking Not Utilized is used when the user/sample side did not proceed as expected.",
    ],
    callouts: [
      "If you already submitted a sample, tell the Lab In-charge immediately so the sample can be safeguarded while disruption is resolved.",
      "Related: Under Maintenance · Other Disruption · Sample Submission Policy.",
    ],
    steps: [
      {
        title: "Example — Operator on short leave",
        body: "Your booking moves to disruption-pending. You cancel before the deadline and receive a refund, then book another day.",
      },
      {
        title: "Example — Session marked Operator Unavailable",
        body: "The lab cannot staff the run. Your booking is closed as Operator Unavailable, the wallet is credited, and the freed slot may help a waitlisted user if timing allows.",
      },
    ],
  };
}

export function bookingNotUtilizedPolicySection(): GuideSection {
  return {
    id: "policy-not-utilized",
    title: "Booking Not Utilized Policy",
    paragraphs: [
      "“Booking Not Utilized” means the reserved session did not proceed as a completed laboratory run for user-side reasons (for example, no show or sample never progressed beyond the initial send), as determined by laboratory staff under institute rules.",
      "This status is different from cancellations, maintenance, operator absence, or other facility disruptions.",
    ],
    bullets: [
      "Common causes — User does not report/arrive; sample never submitted or only marked sent without further progress; user abandons the booking without cancelling in time.",
      "Consequences — The booking is closed as Not Utilized. Charges are typically not refunded.",
      "Future bookings — Repeated non-utilization may be reviewed by the laboratory or department under local discipline/access rules.",
      "Not the same as — Equipment Under Maintenance, Operator Absent, or Other Disruption (those are facility-side and usually refund/reschedule).",
      "Waitlisted users — Pure waitlist entries are not confirmed bookings. Do not confuse “still waiting for confirmation” with Not Utilized. If you submitted a sample while waitlisted, tell staff — you are awaiting promotion, not a no-show.",
    ],
    callouts: [
      "Warning: Always cancel unused bookings early. Leaving a slot idle blocks others and may lead to Not Utilized without refund.",
      "Related: Sample Submission Policy · Cancellation · Waitlist Policy.",
    ],
    steps: [
      {
        title: "Example — No show",
        body: "You hold a confirmed morning slot but neither arrive nor cancel. After the utilization window, staff mark Booking Not Utilized. No refund is issued.",
      },
      {
        title: "Example — Sample never progresses",
        body: "You booked and perhaps marked Sample Submitted, but never completed the laboratory hand-off. Staff may close the booking as Not Utilized per policy.",
      },
      {
        title: "Example — What is NOT Not Utilized",
        body: "Power failure stops the run (Other Disruption), or the operator is unavailable. Those follow disruption/refund rules — not Not Utilized.",
      },
    ],
  };
}

export function otherDisruptionPolicySection(): GuideSection {
  return {
    id: "policy-other-disruption",
    title: "Other Disruption Policy",
    paragraphs: [
      "“Other Disruption” covers laboratory interruptions that are not simple planned maintenance or operator leave. Staff record a reason so you understand what happened.",
    ],
    bullets: [
      "Examples — Power failure, network outage, instrument malfunction mid-run, unsafe environmental conditions, laboratory closure, safety stoppages.",
      "How bookings are handled — Affected bookings typically enter disruption-pending with a decision deadline, similar to maintenance/operator-absent flows.",
      "Refunds / reschedule — Cancel with refund is commonly available; reschedule unlocks when operations allow. Exact options appear on My Bookings and in email.",
      "Notifications — Email includes the staff-provided reason and deadline.",
      "Administration — OIC / Lab In-charge / Admin apply the disruption and manage slot release when the booking is closed.",
    ],
    callouts: [
      "Read the disruption reason carefully and act before the deadline to protect your refund/reschedule options.",
      "Related: Under Maintenance · Operator Absent · Support Tickets.",
    ],
    steps: [
      {
        title: "Example — Power failure",
        body: "A campus power incident stops the afternoon queue. Your booking is flagged Other Disruption with reason “Power failure”. You cancel with refund and rebook next week.",
      },
      {
        title: "Example — Safety closure",
        body: "The lab closes for a safety drill. Staff apply Other Disruption. You wait for operational recovery and use the unlocked reschedule window.",
      },
    ],
  };
}

export function sampleSubmissionPolicySection(): GuideSection {
  return {
    id: "policy-sample-submission",
    title: "Sample Submission Policy",
    paragraphs: [
      "Most instruments require you to submit samples (or digital files) before the laboratory can start work. Deadlines are shown on the booking (and often as email/dashboard countdowns).",
    ],
    bullets: [
      "Deadlines — Submit before the sample submission lead time configured for that equipment (commonly measured in hours before the slot start). Late samples may be refused for that run.",
      "When you may submit — After your booking is confirmed (Booked), or while waitlisted when the portal offers “Submit sample while waitlisted”.",
      "Packaging — Follow the equipment page and lab SOPs (sealed vials, secondary containment, cold chain if required).",
      "Labelling — Label every container with booking ID / user name / date as instructed by the lab.",
      "Documentation — Complete any forms, safety declarations, or concentration lists requested on the equipment page.",
      "Physical vs digital — Physical samples go to the designated drop point. Digital inputs (STL, CAD, datasets) upload through the booking workflow when the instrument requires them (for example 3D printing).",
      "Your responsibilities — Meet deadlines, label correctly, declare hazards, and keep contact details current.",
      "Laboratory responsibilities — Acknowledge receipt through the sample lifecycle statuses, run the analysis when ready, and notify you of completion or issues.",
      "Waitlisted samples — Submitting early helps the lab if you are promoted late; it does not guarantee promotion. If you opt out, contact the lab about any sample already delivered.",
    ],
    callouts: [
      "Important: Atmosphere-sensitive or hazardous samples may have stricter timing — follow on-screen warnings exactly.",
      "Related: Sample Collection & Discard · Waitlist Policy · Booking Statuses.",
    ],
    steps: [
      {
        title: "Example — On-time physical sample",
        body: "Your booking starts Thursday 10:00 with a 24-hour submission lead. You drop labelled vials Wednesday morning and mark Sample Submitted. The lab accepts and runs the session.",
      },
      {
        title: "Example — Waitlisted early submission",
        body: "You are WL2 and submit your sample while waiting. Later you are promoted to confirmed. The laboratory already has your sample recorded as submitted.",
      },
      {
        title: "Example — Late sample",
        body: "You miss the submission cut-off. The lab may refuse the sample for that slot; the booking may proceed to Not Utilized or other outcomes per lab policy — cancel early if you cannot submit.",
      },
    ],
  };
}

export function sampleCollectionDiscardPolicySection(): GuideSection {
  return {
    id: "policy-sample-collection",
    title: "Sample Collection & Discard Policy",
    paragraphs: [
      "After analysis, you are responsible for collecting remaining sample material (or acknowledging disposal) within the period stated by the laboratory.",
      "The completion email and booking detail indicate when the sample is ready and the final collection / discard deadline.",
    ],
    bullets: [
      "Collect on time — Collect from the designated laboratory point within the published window.",
      "Completion email — States readiness and the final deadline for collection or discard.",
      "Uncollected samples — May be discarded according to laboratory / institute EHS policy after the deadline.",
      "Institute responsibility — IIT Roorkee is not responsible for samples retained beyond the stated period once the discard deadline has passed.",
      "Extensions — Only if the laboratory explicitly permits extended retention; request in writing / via Support Ticket before the deadline.",
    ],
    callouts: [
      "Warning: Do not assume free long-term storage. Treat the collection deadline as firm unless the lab confirms otherwise.",
      "Related: Sample Submission Policy · Support · Contact Lab In-charge.",
    ],
    steps: [
      {
        title: "Example — Collect within time",
        body: "You receive a completion email Monday with a Friday collection deadline. You collect Wednesday. No further action needed.",
      },
      {
        title: "Example — Extended retention (if allowed)",
        body: "You will be away until next week. Before the discard deadline you request an extension; the Lab In-charge confirms a new date in writing.",
      },
      {
        title: "Example — Discard after deadline",
        body: "You miss the collection window without an approved extension. The laboratory discards the sample per policy. The institute is not liable for the material after that point.",
      },
    ],
  };
}

export function operationalPoliciesFaqSection(): GuideSection {
  return {
    id: "policy-faqs",
    title: "Operational Policies — FAQ",
    paragraphs: [
      "Answers to questions users ask most often about waitlists, disruptions, samples, and urgent bookings.",
    ],
    faqs: operationalPoliciesFaqs(),
  };
}

export function operationalPoliciesFaqs(): GuideFaq[] {
  return [
    {
      question: "Why was I placed on the waitlist?",
      answer:
        "No eligible free slot was available when you booked (or you chose to join the waitlist). If the equipment’s waitlist was enabled and not full, you received the next WL position.",
    },
    {
      question: "Can I cancel my waitlisted booking?",
      answer:
        "Yes. Use Leave Waitlist / cancel on the waitlisted entry in My Bookings. You opt out of automatic confirmation; nothing was charged to your wallet while only waitlisted.",
    },
    {
      question: "Will my wallet be refunded if my booking is cancelled?",
      answer:
        "Confirmed bookings: refunds depend on who cancels, timing rules, and whether the cause was a facility disruption. Waitlisted-only entries: there is usually nothing to refund because no charge was taken until promotion.",
    },
    {
      question: "Can I submit my sample before confirmation?",
      answer:
        "If you are actively waitlisted and the portal shows Submit sample while waitlisted, yes. Otherwise submit after the booking is confirmed (Booked), and always before the sample deadline.",
    },
    {
      question: "What happens if I miss my booking?",
      answer:
        "Cancel as early as possible. If you neither attend nor cancel, staff may mark Booking Not Utilized, typically without refund.",
    },
    {
      question: "What should I do if the equipment goes under maintenance?",
      answer:
        "Read the email/My Bookings notice. Cancel with refund or wait to reschedule when the instrument is Operational again. Act before any decision deadline.",
    },
    {
      question: "What happens if the operator is unavailable?",
      answer:
        "You will be notified. You can usually cancel with refund or follow reschedule instructions. Full Operator Unavailable closures typically refund the wallet.",
    },
    {
      question: "How long will my sample be retained after analysis?",
      answer:
        "Until the collection/discard deadline in your completion email and booking detail. After that, the laboratory may discard the sample under institute policy.",
    },
    {
      question: "Can I request an urgent booking?",
      answer:
        "When the equipment exposes Urgent Request and you meet the criteria (for example repeated no-slot attempts or documented reviewer urgency). Approval by OIC/supervisor may be required.",
    },
    {
      question: "Who should I contact if my booking is disrupted?",
      answer:
        "Start with the Lab In-charge / OIC contacts on the equipment page, use Raise Support Ticket for a tracked case, and watch My Bookings for the disruption decision options.",
    },
  ];
}

/** Cross-reference blurb for cancellation / wallet sections. */
export function policiesCrossRefCallout(): string {
  return `For waitlists, maintenance, operator absence, other disruptions, Not Utilized, and sample rules, see the Operational Policies chapters in this ${PRODUCT_NAME} User Guide.`;
}

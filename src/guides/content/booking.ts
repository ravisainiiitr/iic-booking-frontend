/** Booking chapters shared by every role that books equipment. Items are filtered per role. */

import { compact, WALLET_MEMBERS, WALLET_OWNERS, type Gate } from "../gate";
import type { GuideSection } from "../types";

const GROUP = "Booking";

export function bookSection(g: Gate): GuideSection {
  return {
    id: "book",
    title: "Book equipment",
    icon: "calendar",
    group: GROUP,
    intro: ["The calendar shows live free slots. Booking windows open by the server clock (IST) in the booking page header."],
    steps: compact([
      {
        title: "Find the equipment",
        body: "Open Equipments, search or filter by department or category. Each card shows a From price and a Book now button.",
        screenshotCaption: "Equipment catalog",
        screenshotSrc: "/guides/equipment-catalog-search-filters.jpg",
      },
      {
        title: "Check charges and instructions",
        body: "Use Calculate Charges and read the Important instruction box. The lab can write a different instruction for your user type.",
        screenshotCaption: "Charges calculator",
        screenshotSrc: "/guides/equipment-calculate-charges.png",
      },
      {
        title: "Fill the inputs",
        body: "Click Book and fill the inputs, or choose a saved template under Booking template.",
      },
      {
        title: "Select slots",
        body: "Under Choose slots, pick I'll pick to tap consecutive free slots on the weekly calendar yourself, or Auto-select to have them chosen (My preferred slot appears when your template has one). It works on phones too. Tap a greyed-out slot to see why it cannot be booked. Saturday/Sunday and Holiday labels mark closed days.",
        screenshotCaption: "Weekly booking calendar",
        screenshotSrc: "/guides/booking-weekly-calendar.png",
      },
      g.when(!g.is("startup", "external"), {
        title: "If your slots are taken",
        body: "Choose one answer: Let me choose again (nothing is booked), Any free slots this week (other free slots, possibly not back-to-back), or Any free slots, or just one (books one slot with fewer samples if that is all that is free). The i buttons explain each choice.",
      }),
      g.only(WALLET_MEMBERS, {
        title: "Confirm",
        body: "Check the Review line above Confirm (slots, time and charge), then confirm. The charge goes to your supervisor's wallet.",
      }),
      g.only(["faculty"], {
        title: "Confirm",
        body: "Check the Review line above Confirm (slots, time and charge), then confirm. The charge is debited from your department sub-wallet.",
      }),
      g.only(["startup", "external"], {
        title: "Confirm and pay",
        body: "Check the Review line above Confirm, confirm the booking and complete payment if the status shows Awaiting payment.",
      }),
      {
        title: "If the booking fails",
        body: "Your form stays filled in; only slots someone else took are dropped and marked. An unsaved booking is also kept on this device and restored next time (Discard clears it). If a weekly or monthly limit stopped it, View bookings counted shows what used up the limit.",
      },
    ]),
    rules: compact([
      "Next week's slots normally open every Wednesday at 9:00 PM; a countdown on the booking page shows the time left. The page also shows the window for your account, for example Current week only — new slots open ….",
      g.when(g.is("student", "project_staff", "faculty"), "During the weekly slot opening, clicking an equipment card opens its booking page directly."),
      g.when(g.flags.externalBooking, "External bookings follow the external booking window and any slots the lab reserves for external users."),
      g.when(g.flags.externalBooking, "To give IIT Roorkee users a fair start, external access is paused from 8:55 to 9:15 pm on Wednesdays; a notice appears beforehand."),
      "The booking page shows how much of your weekly booking quota is left. A booking that needs more time is stopped before you pick slots.",
      "Cancelled or refunded bookings give their quota back, and repeat samples never use quota. A booking moved because of a disruption or by the lab stays counted in its original week; when you reschedule it yourself, it counts in the new week. Editing your inputs uses or frees quota as the analysis time changes.",
      "When a booking, reschedule or input edit is refused for a weekly or monthly limit, or once 80% of the limit is used, click View bookings counted. It shows the period (weeks run Monday to Sunday, months by calendar month, in Indian time), the limit, the minutes used and every booking that counted; Not counted lists the others with the reason.",
      g.only(WALLET_MEMBERS, "For your research group's limit you see everyone's bookings in the group with a total per person, but you can open only your own."),
      g.only(["faculty"], "For your research group's limit you see every member's bookings in full, with a total per person."),
      g.only(WALLET_MEMBERS, "Until your supervisor's wallet is linked, a banner offers Link supervisor's wallet or Invite your supervisor; you can still fill in the form."),
      g.only([...WALLET_MEMBERS, "faculty"], "If the wallet cannot cover the charge, the page says how much to add before you confirm."),
      g.only(WALLET_MEMBERS, "Your supervisor's spending limit, if set, is checked before the booking is made."),
    ]),
    tips: compact([
      "If no slot is free, tick Join the waitlist (when offered). You are told your place in the queue.",
      g.when(g.flags.assistant, "After a failed booking, click Ask the Booking Assistant under Need help? for the reason and the next step."),
    ]),
  };
}

export function inputsSection(): GuideSection {
  return {
    id: "inputs",
    title: "Inputs and sample sets",
    icon: "layers",
    group: GROUP,
    intro: [
      "The inputs (number of samples, analysis type, elements and so on) decide the charge and the number of slots.",
    ],
    steps: [
      {
        title: "Fill sample set 1",
        body: "The fields at the top are sample set 1. Where the equipment asks for elements, click Select elements and pick them on the periodic table.",
      },
      {
        title: "Add sets with different parameters",
        body: "At the bottom of Step 1, click Add sample with different parameters. The new set starts with the equipment's default values; use Copy set 1 values, Duplicate or Remove on a set's header as needed, and click the header to collapse it.",
      },
      {
        title: "Edit inputs after booking",
        body: "Open the booking from View Booking and choose Edit User Inputs. If the charge goes up, click Pay ₹X now; use Cancel edit to back out.",
      },
    ],
    rules: [
      "Each sample set is charged and timed separately within the same booking.",
      "Sample sets are offered only where the equipment allows them; bookings made earlier keep their sets.",
      "Number boxes start at 1 and show Max N allowed when you reach the limit. Limits that depend on another input (for example, samples up to 4 × slots) apply to every user type and to each sample set.",
      "Some equipment ask for details in a table. Either click Add row for each entry, or the table has one row per sample and follows your number of samples; lowering the number hides the extra rows until you raise it again. Each column checks its own limits, and on a phone every row is shown as a card.",
      "A higher charge from an edit must be paid within 1 minute, or the edit is cancelled and the old values return.",
      "If the new charge is lower, the difference goes back to your wallet straight away when you edit before the cancellation deadline (the same deadline as for cancelling or rescheduling; the edit form shows it). After that deadline, the refund needs the Officer In Charge's approval.",
      "Inputs can be edited until the booking is completed.",
    ],
  };
}

export function templatesSection(): GuideSection {
  return {
    id: "templates",
    title: "Booking templates",
    icon: "template",
    group: GROUP,
    intro: [
      "A template saves the booking form for one equipment — inputs, sample sets and booking options — and, optionally, a preferred weekly slot. It never books by itself.",
    ],
    steps: [
      {
        title: "Create",
        body: "On the dashboard open Booking Templates and click New template, choose a Department and the equipment, then Continue. Fill the form, enter a Template name and click Save template.",
      },
      {
        title: "Choose slots",
        body: "Under Choose slots, pick one: I'll pick, Auto-select, or My preferred slot. For a preferred slot, click a green slot in the Monday–Friday calendar; the number of slots comes from your sample details. It is pre-selected on the booking page when free.",
      },
      {
        title: "Choose what happens if they are taken",
        body: "Under If your slots are taken, pick one: Let me choose again, Any free slots this week or Any free slots, or just one. With a preferred slot you can also pick Next free time, same day or Next free time, any day and tick the consent. Join the waitlist if nothing is booked is a separate tick box.",
      },
      {
        title: "Book with it",
        body: "Click Book now on the template card, or pick it under Booking template on the booking page, then click Book.",
      },
      {
        title: "Save from a booking attempt",
        body: "After any attempt, click Save these parameters as a template. Tick Pre-select this slot next time to keep the slot.",
      },
    ],
    rules: [
      "Up to 25 templates per equipment, private to you, and only for equipment you may book.",
      "Automatic options may book the next free slot of the same length and charge the wallet; the usual booking checks still apply.",
      "On the booking page the template's choices are already selected; you can change them for that booking only.",
    ],
    tips: ["Use Edit, Duplicate and Delete from the card's ⋯ menu. Deleting a template does not affect your bookings."],
  };
}

export function assistantSection(g: Gate): GuideSection | null {
  if (!g.flags.assistant) return null;
  const booker = g.is("student", "project_staff", "faculty", "startup", "external");
  return {
    id: "assistant",
    title: "Booking Assistant",
    icon: "bot",
    group: booker ? GROUP : "Tools",
    intro: compact([
      "Open Booking Assistant (bottom-right) to ask about equipment, free slots, charges, contacts and your bookings, using live portal data.",
      g.when(!booker, "It answers look-ups; booking management stays on View Booking and your role's pages."),
    ]),
    steps: booker
      ? [
          {
            title: "Start",
            body: "Choose Book equipment. Pick a department, then the equipment (only equipment you may book is listed).",
          },
          {
            title: "Inputs and slot",
            body: "Fill the inputs, including sample sets, then tap a free slot. Use Earlier and Later to change dates.",
          },
          g.flags.inChatBooking
            ? {
                title: "Confirm",
                body: "Check the summary, tick I have read the instructions above and press Confirm booking. You get the virtual booking ID.",
              }
            : {
                title: "Finish on the booking page",
                body: "Check the summary and continue on the booking page, where your details are already filled in.",
              },
        ]
      : undefined,
    rules: booker
      ? [
          "Nothing is booked until you press the confirm button; typing “confirm” does not book.",
          "The same checks as the booking page apply: slot length, input limits, wallet balance and quotas.",
        ]
      : undefined,
    tips: compact([
      g.when(booker, "After a failed booking or charge calculation, Need help? opens the assistant with what went wrong."),
      "Rate any answer with Was this helpful?; you can add what you were looking for.",
      g.when(booker, "Change your mind at any step with Change slot, Change samples/inputs or Change equipment."),
      g.when(booker && g.flags.inChatBooking, "Open Analysis Workspace appears after booking only when the equipment offers Remote Analysis."),
      booker
        ? "Free text works too: “I need FESEM tomorrow”, “What are the TEM charges?”, “Show my upcoming bookings”."
        : "Try “Show today's bookings on XRD” or “What are the FESEM charges?”.",
    ]),
  };
}

export function myBookingsSection(g: Gate): GuideSection {
  return {
    id: "my-bookings",
    title: "Your bookings and results",
    icon: "list",
    group: GROUP,
    intro: ["Click View Booking on the dashboard to open My Bookings: status, slot dates, charges and sample deadlines for every booking."],
    steps: [
      {
        title: "Find a booking",
        body: "Use search, Status, dates and All equipment; More filters shows the rest. Click Apply, or Clear to reset. What do these statuses mean? explains each status badge.",
        screenshotCaption: "My Bookings",
        screenshotSrc: "/guides/my-bookings-dashboard.png",
      },
      {
        title: "Cancel or reschedule",
        body: "Each booking shows its cancel/reschedule deadline. Open the booking and choose cancel (full or partial where allowed) or reschedule to another free slot. After the deadline it shows Deadline passed - contact the Officer in Charge.",
      },
      {
        title: "Book again",
        body: "Book again opens the booking form for the same equipment with your earlier inputs.",
      },
      {
        title: "Get results",
        body: "Download published files from the booking or from View results on the dashboard.",
      },
      {
        title: "Reply to the lab",
        body: "If the Officer In Charge or Lab Operator sends a reminder or asks a question, you get an email and a notification. Click Reply in portal (or open the booking): a Question from the lab - reply needed banner shows the question. Click Reply, type your answer and send. Bookings with an open question show Reply needed in My Bookings.",
      },
      {
        title: "Sync to calendar",
        body: "Add your bookings to Google Calendar, Outlook or Apple Calendar. Subscribing keeps the calendar updated; a one-time add does not.",
      },
    ],
    rules: compact([
      "You can cancel or reschedule yourself until the equipment's cutoff (48 hours unless the lab set another) before the slot.",
      "Once the lab has accepted your sample, Reschedule and Cancel are no longer available to you or your supervisor; use Message the lab to contact the Officer in Charge.",
      "Refunds follow the cancellation policy; the amount is shown before you confirm.",
      g.only(WALLET_OWNERS, "Refunds are credited to the wallet that was charged."),
    ]),
    tips: ["Share feedback any time with Rate your experience on the dashboard."],
  };
}

/** Students and project staff: book against a supervisor's / PI's wallet. */
export function memberWalletSection(g: Gate): GuideSection {
  const owner = g.pick({ project_staff: "PI" }, "supervisor");
  return {
    id: "wallet",
    title: "Wallet and spending limit",
    icon: "wallet",
    group: "Wallet",
    intro: [`Your bookings are charged to your ${owner}'s wallet. You can book once they approve your request to join it.`],
    steps: compact([
      {
        title: "Join the wallet",
        body: `Open Wallet management, find your ${owner} under Request to Join Wallet and click Send Request. Use Resend Request if needed.`,
      },
      {
        title: `${owner === "PI" ? "PI" : "Supervisor"} not listed? Invite them`,
        body: `Click Invite your ${owner}, enter their IIT Roorkee email (their name, department and a short message are optional) and click Send invitation. They get an email asking them to sign in. When they do, your request waits for them to approve or reject, and you are told by email. Track it under Invitations you sent, where you can Resend (once a day) or Cancel.`,
      },
      {
        title: "Check your limit",
        body: "If a limit is set, the booking page shows Supervisor spending limit with what you used This week and This month.",
      },
      g.when(g.flags.studentRecharge, {
        title: "Recharge",
        body: `Click Recharge Wallet, choose Direct Cash Deposit / Bank Transfer, select the department and amount, accept the undertaking and enter the OTP sent to your email. Then deposit the cash or complete the bank transfer at the SRIC Bill Section and share the transaction number. Once the request is approved, the amount is added to your ${owner}'s wallet.`,
      }),
    ]),
    rules: [
      "A booking that would exceed a weekly or monthly limit is blocked. Weeks run Monday–Sunday (IST).",
      "Leaving a wallet removes your access at once; you can then request another wallet.",
      "You can have up to 3 pending invitations. Each one expires after 30 days.",
    ],
    tips: [`The search only lists faculty who have signed in to the portal at least once. If your ${owner} is not listed, invite them by email.`],
  };
}

/** Faculty, startups and external users hold their own wallet. */
export function ownerWalletSection(g: Gate): GuideSection {
  const f = g.flags;
  const faculty = g.is("faculty");
  const methods = compact([
    g.when(faculty && f.projectGrant, "Project Grant (approved by the SRIC Office)"),
    g.when(f.directCash, "Direct Cash Deposit / Bank Transfer"),
    g.when(f.onlineGateway, "Pay online (card, UPI or net banking; a convenience fee applies)"),
  ]);
  const anySwitchedOff = (faculty && (!f.projectGrant || !f.peerTransfer || !f.creditFacility)) || !f.directCash;

  return {
    id: "wallet",
    title: faculty ? "Wallet: recharge, transfer and credit" : "Wallet and payments",
    icon: "wallet",
    group: "Wallet",
    intro: compact([
      faculty
        ? "Open Wallet management. Your wallet has a sub-wallet per department, and linked students book against it."
        : "Open Wallet management to see your balance, recharges and transactions.",
      g.when(methods.length > 0, `Recharge methods available to you: ${methods.join("; ")}.`),
    ]),
    steps: compact([
      g.when(methods.length > 0, {
        title: "Recharge",
        body: faculty
          ? "Click Recharge Wallet, choose the Recharge method and the sub-wallet in Credit to, enter the Amount (₹) and tick I agree to the above undertaking."
          : "Click Recharge Wallet, choose the Recharge method, enter the Amount (₹) and accept the undertaking.",
      }),
      g.when(faculty && f.projectGrant, {
        title: "Project Grant",
        body: "Select your project, or click Add Project. The request goes to the SRIC Office after you verify it.",
      }),
      g.when(f.directCash, {
        title: "Cash or bank transfer",
        body: "Confirm with the OTP sent to your email, then deposit or transfer the amount at the SRIC Bill Section and share the transaction number with them.",
      }),
      g.when(faculty && f.peerTransfer, {
        title: "Transfer",
        body: "Click Transfer, choose From department (grant), Recipient (same grant) and Amount (₹), and confirm with the email OTP.",
      }),
      g.when(faculty && f.creditFacility, {
        title: "Credit Facility",
        body: "Click Credit Facility, choose the Department, enter Requested Amount (₹) and Purpose / Reason, and click Submit Credit Request.",
      }),
      g.when(f.externalBooking, {
        title: "Transfer balance to your bank",
        body: "Under Transfer wallet balance to bank, click Save bank details, then Request transfer and enter the amount.",
      }),
    ]),
    rules: compact([
      g.when(methods.length > 0, "The minimum recharge is ₹100. Each request shows its status and, if declined, the reason."),
      g.when(faculty && f.projectGrant, "Project Grant decline reasons: Wrong Project Code, Insufficient Funds in the Project, Project Already Closed or Other."),
      g.when(faculty && f.projectGrant, "Declined by SRIC: the amount stays as an auto-approved credit and is recovered from your next approved recharge."),
      g.when(faculty && f.peerTransfer, "Transfers stay within the same department grant and need no admin approval."),
      g.when(faculty && f.creditFacility, "Credit requests are approved by the Main Administrator; only one facility can be active at a time."),
      g.when(f.externalBooking, "Funds are held when you request a bank transfer."),
    ]),
    tips: compact([
      g.when(faculty, "If your department offers a Faculty Credit Facility and you are eligible, use Avail credit on that sub-wallet."),
      g.when(anySwitchedOff, "Options switched off by the Main Administrator appear greyed out with Awaiting Competent Authority Approval."),
    ]),
  };
}

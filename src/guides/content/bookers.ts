/** Guide composition for roles that book equipment: student, project staff, faculty, startup, external. */

import { compact, WALLET_MEMBERS, type Gate } from "../gate";
import type { GuideFaq, GuideSection } from "../types";
import {
  assistantSection,
  bookSection,
  inputsSection,
  memberWalletSection,
  myBookingsSection,
  ownerWalletSection,
  templatesSection,
} from "./booking";
import { helpSection } from "./help";
import { disruptionsSection, samplesSection, statusesSection, urgentSection, waitlistSection } from "./policies";
import { trainingSection } from "./training";

function gettingStartedSection(g: Gate): GuideSection {
  const campus = g.is("student", "project_staff", "faculty");
  return {
    id: "getting-started",
    title: "Getting started",
    icon: "rocket",
    group: "Start",
    intro: [
      campus
        ? "Sign in with Channel i on the Sign in page using your institute credentials."
        : "Create your account on the Sign in page with your email and password.",
    ],
    steps: compact([
      g.when(!campus, {
        title: "Register",
        body: g.is("startup")
          ? "Choose IITR Startup or External Startup/MSME, then fill in your organisation details."
          : "Choose your user category and fill in your organisation details, including GST where applicable.",
      }),
      g.when(!campus, {
        title: "Upload documents",
        body: g.is("project_staff", "startup")
          ? "Optional: upload proof of employment or enrolment in a programme. Your profile picture is also optional and can be added later from My Profile."
          : "With a public email (such as Gmail), click Download IIT Roorkee KYC Form (PDF), sign it and upload the scan as KYC Form (signed & scanned). An institution email skips this. Your profile picture is optional and can be added later from My Profile.",
      }),
      g.when(!campus, {
        title: "Wait for verification",
        body: "You are emailed when your account is verified; booking opens after that.",
      }),
      g.only(WALLET_MEMBERS, {
        title: "Link a wallet",
        body: "Send a request to join your supervisor's wallet before your first booking. If they are not listed, invite them by email (see Wallet and spending limit).",
      }),
      g.when(g.is("project_staff", "startup"), {
        title: "Registered with email?",
        body: g.is("startup")
          ? "If you registered as IITR Startup, the IITR faculty member who mentors your startup must approve within 24 hours of receiving the request. If they decline or do not respond in time, the request is cancelled and you can register again. You are emailed at each step."
          : "If you registered with email instead of Channel i, the faculty member you chose at registration must approve within 24 hours of receiving the request. If they decline or do not respond in time, the request is cancelled and you can register again. You are emailed at each step; the Sign in page names them while it is pending.",
      }),
      g.when(g.is("project_staff", "startup"), {
        title: "Programme validity and extensions",
        body: "You are reminded 30, 7 and 1 days before your programme validity ends. Click Request an extension in the email, or on the Sign in page once it has ended, and your faculty is asked to approve. An extension lasts at most six months and can be requested again.",
      }),
      g.when(campus, {
        title: "Optional: email sign-in",
        body: "To also sign in with email and a portal password, turn on Sign in with email under Sign-in options in My Profile.",
      }),
      {
        title: "Check your profile",
        body: "Keep your email and mobile number current in My Profile so booking and wallet emails reach you.",
      },
    ]),
    rules: compact([
      g.when(!campus, "Use the correct category: it decides your rates and which equipment you can book."),
    ]),
  };
}

function studentsSection(g: Gate): GuideSection {
  return {
    id: "students",
    title: "Your students",
    icon: "users",
    group: "Your students",
    intro: [
      "Students book against your wallet after you approve their request to join. Open Student management on the dashboard to manage them.",
    ],
    steps: compact([
      {
        title: "Approve join requests",
        body: "Approve or reject pending requests in Wallet management. Act promptly so students are not blocked.",
      },
      {
        title: "Requests from students who invited you",
        body: "If a student invited you by email before you had signed in, their request is waiting under Pending actions and in Wallet management when you sign in. Nothing is linked until you click Approve; you can also Reject it.",
      },
      {
        title: "Set a spending limit",
        body: "In the Spending limit column, enter a Weekly limit (₹), a Monthly limit (₹) or both, and click Save. Leave a box empty for no limit.",
      },
      {
        title: "View or delink a student",
        body: "Click a name to open the Student identity card. Turn off the Linked toggle to delink; choose Keep linked to cancel.",
      },
      {
        title: "Nominate for TA operating",
        body: "When a call is open under TA operating nominations, click Nominate student before the deadline.",
      },
      {
        title: "Registration approvals",
        body: "When someone registers with email (a post-doctoral fellow, research associate or IITR Startup) and names you as their faculty, you get an email with Approve and Decline buttons; no sign-in is needed. Check their details, tick the confirmation that they work under you and the details are correct to the best of your knowledge, then Approve, or Decline with a reason. Please respond within 24 hours: after that the request is treated as declined and they can register again. The request is also listed under Registration approvals.",
      },
      {
        title: "Programme extensions",
        body: "Before a researcher's programme validity ends they can ask you for an extension. It appears in Registration approvals with its own confirmation. Approve for up to six months (you may choose an earlier date) or decline with a reason.",
      },
    ]),
    rules: [
      "Limits count bookings the student makes in that week (Monday–Sunday) or calendar month (IST). Unpaid or fully refunded bookings do not count.",
      "Bookings the lab makes on a student's behalf are not blocked by the limit.",
      "Your approval makes the account fully active; no further approval is needed. Each email link works once, and only for requests that name you.",
    ],
    tips: [
      "You get one email per student booking, matching the student's, with a Booked by row.",
      "If a student cannot book, check that they are Linked, the wallet has balance and their limit has room.",
    ],
  };
}

function bookerFaqs(g: Gate): GuideFaq[] {
  return compact([
    g.only(WALLET_MEMBERS, {
      question: "Why can't I book?",
      answer: "Check that your request to join the wallet was approved, the wallet has balance and your spending limit has room.",
    }),
    g.only(["startup", "external"], {
      question: "Why is my account pending?",
      answer: "Verification is in progress. Make sure your documents (and the signed KYC form, if required) are uploaded; you are emailed when it is done.",
    }),
    g.only(["startup", "external"], {
      question: "An equipment is not listed for me. Why?",
      answer: "Some equipment is open only to campus users. Raise a ticket with the equipment name if you think it should be available.",
    }),
    {
      question: "Where do I download results?",
      answer: "Open the completed booking from View Booking, or View results on the dashboard, once the lab publishes the files.",
    },
    {
      question: "The slot I picked was taken. What now?",
      answer: "Another user booked it first. Reload the calendar and choose another free slot, or join the waitlist if offered. To have the portal book other free slots instead next time, choose Any free slots this week under If your slots are taken.",
    },
  ]);
}

export function bookerSections(g: Gate): GuideSection[] {
  return compact([
    gettingStartedSection(g),
    bookSection(g),
    inputsSection(),
    templatesSection(),
    assistantSection(g),
    myBookingsSection(g),
    g.is(...WALLET_MEMBERS) ? memberWalletSection(g) : ownerWalletSection(g),
    g.when(g.is("faculty"), studentsSection(g)),
    trainingSection(g),
    urgentSection(g),
    waitlistSection(),
    disruptionsSection(),
    samplesSection(g),
    statusesSection(),
    helpSection(g, {
      faqs: bookerFaqs(g),
      tips: compact([
        g.when(g.is("student", "project_staff", "faculty"), "If Channel i sign-in fails, try another browser or clear cookies for the portal, then raise a ticket with the time it failed."),
        g.when(g.is("startup", "external"), "Keep payment references; quote the booking ID in any ticket."),
      ]),
    }),
  ]);
}

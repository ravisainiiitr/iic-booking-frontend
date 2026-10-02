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
          ? "Choose Startup Incubated at IIT Roorkee or External Startup/MSME, then fill in your organisation details."
          : "Choose your user category and fill in your organisation details, including GST where applicable.",
      }),
      g.when(!campus, {
        title: "Upload documents",
        body: "With a public email (such as Gmail), click Download IIT Roorkee KYC Form (PDF), sign it and upload the scan as KYC Form (signed & scanned). An institution email skips this.",
      }),
      g.when(!campus, {
        title: "Wait for verification",
        body: "You are emailed when your account is verified; booking opens after that.",
      }),
      g.only(WALLET_MEMBERS, {
        title: "Link a wallet",
        body: "Send a request to join your supervisor's wallet before your first booking. If they are not listed, invite them by email (see Wallet and spending limit).",
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
    ]),
    rules: [
      "Limits count bookings the student makes in that week (Monday–Sunday) or calendar month (IST). Unpaid or fully refunded bookings do not count.",
      "Bookings the lab makes on a student's behalf are not blocked by the limit.",
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
      answer: "Another user booked it first. Reload the calendar and choose another free slot, or join the waitlist if offered.",
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
    samplesSection(),
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

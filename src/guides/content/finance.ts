import type { RoleGuide } from "../gate";
import { helpSection } from "./help";

export const financeGuide: RoleGuide = {
  title: "Accounts In Charge guide",
  welcome: "Verify and approve wallet recharges for your department.",
  sections: (g) => [
    {
      id: "getting-started",
      title: "Getting started",
      icon: "rocket",
      group: "Start",
      intro: ["Sign in with Channel i or your staff credentials. Your menu has Wallet recharge requests, External booking requests and Reports & Statistics."],
      rules: ["Your access covers your own department. Credit facility and staff settings belong to the Department Administrator."],
    },
    {
      id: "recharge-requests",
      title: "Wallet recharge requests",
      icon: "receipt",
      group: "Wallet",
      intro: ["Process requests promptly so users are not kept waiting to book."],
      steps: [
        { title: "Open the queue", body: "On the dashboard click Wallet recharge requests → Review & verify." },
        {
          title: "Verify",
          body: "Open Details and match the transaction number or UTR, amount and user against bank or cash-book records. Use Verify Fund Receipt where funds must be confirmed.",
        },
        { title: "Approve or escalate", body: "Click Approve on a verified request. Escalate a mismatch to the Department Administrator or Admin, saying what is wrong." },
      ],
      rules: [
        "Declining and cancelling are done by the Department Administrator or Institute Admin.",
        "Never approve without confirming the funds were received.",
      ],
      tips: ["The dashboard alert lists recharges whose funds are not yet matched."],
    },
    helpSection(g, {
      faqs: [
        {
          question: "A user paid but still cannot book. What should I check?",
          answer: "Check the request's status in Wallet recharge requests; approve it if verified, or escalate it.",
        },
      ],
    }),
  ],
};

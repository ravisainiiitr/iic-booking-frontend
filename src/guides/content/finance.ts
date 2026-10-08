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
      intro: ["Sign in with Channel i or your staff credentials. Your menu has Wallet recharge requests, External booking requests and Reports & Statistics.", "On Reports & Statistics, Export downloads the report you are viewing as Excel (.xlsx), CSV or PDF."],
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
        { title: "Export", body: "Export downloads every request matching the filters as Excel (.xlsx), CSV or PDF, with totals." },
      ],
      rules: [
        "Declining and cancelling are done by the Department Administrator or Institute Admin.",
        "Never approve without confirming the funds were received.",
      ],
      tips: ["The dashboard alert lists recharges whose funds are not yet matched."],
    },
    {
      id: "direct-recharge",
      title: "Direct wallet recharge",
      icon: "wallet",
      group: "Wallet",
      intro: [
        "If the Main Administrator gives you temporary permission, you can add funds received outside the portal straight to a user's wallet. You get a notification; open it, or the Direct wallet recharge button on your Wallet page.",
      ],
      steps: [
        { title: "Choose the wallet", body: "Search for the user by name, email or employee ID and pick the department sub-wallet." },
        {
          title: "Fill in the details",
          body: "Enter the amount, the mode (cash, bank transfer, cheque, DD, internal adjustment or other), the reference number, the transaction date and remarks. Attach the receipt if you have one.",
        },
        { title: "Review and confirm", body: "Click Review recharge, check the owner and the new balance, then Confirm and credit. The owner is emailed and you are copied." },
      ],
      rules: [
        "Your permission ends at its valid-until time and may be limited to one department or an amount per transaction.",
        "Recharge only after the funds are confirmed received. Every recharge is recorded with your name.",
      ],
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

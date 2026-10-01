import type { RoleGuide } from "../gate";
import { helpSection } from "./help";

export const externalRelationsGuide: RoleGuide = {
  title: "External Relations guide",
  welcome: "Verify external organisations and users so they can book.",
  sections: (g) => [
    {
      id: "getting-started",
      title: "Getting started",
      icon: "rocket",
      group: "Start",
      intro: ["Sign in with your staff credentials. Click External organization verification on the dashboard to open External user management."],
    },
    {
      id: "verification",
      title: "Verification",
      icon: "shield",
      group: "External users",
      intro: ["Review KYC and approve or reject external organisations and users."],
      steps: [
        {
          title: "External Departments",
          body: "Click Open departments to add an external department (State/Union Territory and type) or verify one added during registration.",
        },
        {
          title: "External Users",
          body: "Click Open verification to review users, their documents (including the signed KYC form) and approval status.",
        },
      ],
      rules: ["Escalate unclear cases to the Institute Admin rather than setting local policy."],
      tips: ["Record the reason for each decision so the user knows what to fix."],
    },
    helpSection(g, {
      faqs: [
        {
          question: "A module I need is missing. Why?",
          answer: "Ask the Institute Admin to enable it for your role.",
        },
      ],
    }),
  ],
};

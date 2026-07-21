import {
  type UserGuideContent,
  PRODUCT_NAME,
  loginAccountSection,
  troubleshootingSection,
  permissionsSection,
  faqSection,
  purposeSection,
  notificationsSection,
  supportSection,
  bestPracticesSection,
} from "../types";

export const externalRelationsGuide: UserGuideContent = {
  audience: "external_relations",
  audienceLabel: "External Relations Administrator",
  title: "External Relations Administrator User Guide",
  subtitle: `${PRODUCT_NAME} — external user verification and relations`,
  welcomeHeadline: "Welcome, External Relations Administrator",
  welcomeBody: `You support external organisations and users on the ${PRODUCT_NAME}. This guide covers sign-in, verification workflows, and coordination with Institute Admin.`,
  sections: [
    purposeSection({
      paragraphs: [
        "External Relations Administrators help onboard and verify external users and related organisation requests.",
        "Your tools focus on verification and oversight rather than day-of-lab operations.",
      ],
      bullets: [
        "Review external user / organisation requests as assigned",
        "Coordinate with Admin when institute-wide policy applies",
        "Keep communication clear when verification is pending or rejected",
      ],
    }),
    loginAccountSection({
      paragraphs: ["Sign in with the staff path provided for your campus account."],
      bullets: [
        "Land on Dashboard after authentication for quick access cards.",
        "Reopen this guide anytime from User Guide in the menu.",
      ],
    }),
    notificationsSection([
      "Monitor notifications for pending verification items.",
    ]),
    permissionsSection({
      paragraphs: [
        "Access is limited to External Relations modules enabled by Institute Admin.",
      ],
      bullets: [
        "Use only the verification and relations tools assigned to your role.",
        "Escalate ambiguous cases to Institute Admin rather than inventing local policy.",
      ],
    }),
    bestPracticesSection([
      "Document verification decisions clearly.",
      "Escalate ambiguous cases to Institute Admin rather than inventing local policy.",
    ]),
    troubleshootingSection([
      "If a module is missing, ask Institute Admin to enable the relevant Admin Panel module for your role.",
    ]),
    supportSection(),
    faqSection([
      {
        question: "Can I reopen this guide later?",
        answer: "Yes — User menu → User Guide, or the footer User Guide link while signed in.",
      },
    ]),
  ],
};

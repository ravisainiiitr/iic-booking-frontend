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

export const adminGuide: UserGuideContent = {
  audience: "admin",
  audienceLabel: "Institute Administrator",
  title: "Institute Administrator User Guide",
  subtitle: `${PRODUCT_NAME} — institute-wide configuration and oversight`,
  welcomeHeadline: "Welcome, Institute Administrator",
  welcomeBody: `You have full administrative access to the ${PRODUCT_NAME}. This guide summarises institute-wide responsibilities: users and departments, equipment lifecycle, communication templates, CMS, wallets/finance settings, and Admin Panel Access for other roles.`,
  sections: [
    purposeSection({
      paragraphs: [
        "Institute Administrators (main Admin) ensure the portal works consistently for every participating department, centre, and laboratory at IIT Roorkee.",
        "You configure policy, unlock Admin Panel modules for other roles, and resolve cross-department issues that Dept Admins and OICs cannot.",
      ],
      bullets: [
        "Full Admin Panel access and all RBAC permissions",
        "Oversee users, external verification, and department administration",
        "Configure equipment settings, booking buffers, charges, and related catalogs",
        "Manage CMS/home content, communication templates, wallets, inventory, and support queues",
      ],
    }),
    loginAccountSection({
      paragraphs: [
        "Protect Admin accounts carefully. Prefer Channel i or strong unique credentials as deployed by your team.",
      ],
      bullets: [
        "Sign in and land on Dashboard — Admin quick-access cards surface most tools.",
        "Use Admin Settings for deep configuration hubs (users, auth, communication, equipment, wallets, support).",
        "Open User Guide anytime from the menu; Save as PDF for offline SOPs.",
      ],
      callouts: [
        "Avoid sharing Admin credentials. Create named staff accounts with least privilege via Dept Admin / Admin Panel Access where possible.",
      ],
    }),
    {
      id: "core-workflows",
      title: "Core Administrative Workflows",
      paragraphs: [
        "These workflows cover the most common institute-level tasks.",
      ],
      steps: [
        {
          title: "Enable Admin Panel Access for roles",
          body: "Open Admin Settings → Admin Panel Access to decide which user types/departments may open Admin Settings modules.",
          screenshotCaption: "Admin Panel Access configuration",
        },
        {
          title: "Department Administration & RBAC",
          body: "Use Department Administration to oversee staff roles and permission caps across departments.",
          screenshotCaption: "Department Administration / RBAC",
        },
        {
          title: "Equipment lifecycle",
          body: "Approve equipment addition requests, maintain equipment settings (semesters, buffers, charge settings, mode schedules), and support OIC tooling when needed.",
          screenshotCaption: "Equipment addition requests / Equipment settings",
        },
        {
          title: "Communications & CMS",
          body: "Update email/push templates and home page CMS content so branding and notices stay institute-wide and accurate.",
          screenshotCaption: "Communication templates / CMS home",
        },
        {
          title: "Wallets & finance controls",
          body: "Configure SRIC/wallet settings, credit facility, student recharge rules, and process withdrawal or parse workflows as deployed.",
          screenshotCaption: "Wallet settings hub",
        },
      ],
    },
    {
      id: "booking-oversight",
      title: "Booking Oversight",
      paragraphs: [
        "Admins inherit full Booking Management powers (including booking on behalf of users) and can intervene on exceptions across equipment.",
      ],
      bullets: [
        "Open Booking Management for institute-wide operational oversight.",
        "Review Urgent Requests, waitlists, and booking attempt logs.",
        "Use Reports for utilisation and performance analytics.",
        "Coordinate with OICs before overriding local lab decisions except for policy or safety issues.",
      ],
    },
    notificationsSection([
      "System and template-driven emails — keep Communication templates free of outdated centre-only branding.",
    ]),
    bestPracticesSection([
      "Prefer department-scoped admins for day-to-day staff mapping; reserve Institute Admin for cross-cutting change.",
      "Document configuration changes (buffers, charges, templates) for auditability.",
      "Keep CMS hero and footer messaging aligned with institute-wide identity.",
      "Grant Admin Panel modules narrowly — least privilege reduces risk.",
    ]),
    permissionsSection({
      paragraphs: [
        "Admin always has full Admin Panel access and all RBAC permissions. Other roles require explicit Admin Panel Access and/or grants.",
      ],
      bullets: [
        "You can configure who else sees Admin Settings modules.",
        "Inventory, procurement, CMS, and global finance tools are Admin-gated on those pages.",
        "Even with full power, operational ownership of an instrument should usually stay with its OIC.",
        "External Relations / Org Admin / Finance roles (if present) are separate — do not assume they share this guide.",
      ],
    }),
    faqSection([
      {
        question: "A Dept Admin cannot open Admin Settings — why?",
        answer:
          "Enable Admin Panel Access for dept_admin + their department, then grant the specific modules they need.",
      },
      {
        question: "Home page still shows old centre branding — where is it?",
        answer:
          "Update CMS Home Page content (hero_title_line1 and related keys). Frontend defaults only apply when CMS values are empty or migrated.",
      },
      {
        question: "How do email templates stay on-brand?",
        answer:
          "Edit Communication templates in Admin Settings. Data migrations update historical wording, but new edits should use Institute Equipment Booking Portal.",
      },
      {
        question: "Can I restrict an OIC to read-only?",
        answer:
          "Use department RBAC / permission caps rather than sharing the Admin account. Exact caps depend on configured permission codes.",
      },
    ]),
    troubleshootingSection([
      "Module missing from Admin Settings: confirm you are user_type admin (not a limited panel role).",
      "CMS changes not visible: hard-refresh the public site and confirm the correct HomePageContent keys were saved.",
      "Email not sending: use send_test_email / Inbox tools and verify DEFAULT_FROM_EMAIL in deployment settings.",
    ]),
    supportSection(),
  ],
};

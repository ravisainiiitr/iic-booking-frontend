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

export const deptAdminGuide: UserGuideContent = {
  audience: "dept_admin",
  audienceLabel: "Department Administrator",
  title: "Department Administrator User Guide",
  subtitle: `${PRODUCT_NAME} — department-scoped staff, equipment, and access`,
  welcomeHeadline: "Welcome, Department Administrator",
  welcomeBody: `You administer booking-related staff and equipment for your department on the ${PRODUCT_NAME}. This guide covers department administration hubs, equipment scoping, addition requests, and how your powers differ from Institute Admin.`,
  sections: [
    purposeSection({
      paragraphs: [
        "Department Administrators keep their department’s participation in the institute-wide portal healthy: correct OIC/Lab/Accounts assignments, department equipment visibility, and local access grants where RBAC applies.",
      ],
      bullets: [
        "Manage departmental staff roles (OIC, Lab Incharge, Accounts) via Department Administration",
        "Work with equipment scoped to your internal department",
        "Track equipment addition requests (approval is typically Institute Admin)",
        "Book as an end user when needed, and use Reports / Support like other campus users",
      ],
    }),
    loginAccountSection({
      paragraphs: [
        "Sign in with Channel i or staff credentials linked to your department administrator account.",
      ],
      bullets: [
        "Confirm your Profile department matches the unit you administer.",
        "Open Dashboard — look for department tools such as Equipment Addition Status and Admin Settings (if enabled).",
        "Navigate to Manage → Department Administration for staff role pages.",
      ],
      callouts: [
        "If the wrong department is linked, contact Institute Admin before changing staff assignments.",
      ],
    }),
    {
      id: "staff-workflow",
      title: "Managing Department Staff",
      paragraphs: [
        "Assign the right people as Officer In Charge, Lab Incharge, and Accounts for your department’s instruments and finance workflows.",
      ],
      steps: [
        {
          title: "Open Department Administration",
          body: "Go to /manage/department-administration (or the Department Administration hub from staff navigation).",
          screenshotCaption: "Department Administration hub",
        },
        {
          title: "Choose a role or Faculty Credit Facility",
          body: "Open OIC, Lab, or Accounts management for your department, or open Faculty Credit Facility to configure the one-time negative-balance credit line for newly joined faculty.",
          screenshotCaption: "Role selection — OIC / Lab / Accounts / Faculty Credit",
        },
        {
          title: "Map users to roles",
          body: "Create or map users to manager/operator/finance within your department when you have user-management access.",
          screenshotCaption: "Staff mapping form",
        },
        {
          title: "Configure Faculty Credit Facility (optional)",
          body: "Enable the facility, set the eligible Date of Joining cut-off, and the maximum credit limit (₹). Faculty spend against a controlled negative department sub-wallet balance; recharges recover outstanding credit first. Once recovered, the facility closes permanently for that faculty member.",
          screenshotCaption: "Faculty Credit Facility settings",
        },
        {
          title: "Verify equipment coverage",
          body: "Ensure every active instrument has an OIC (and operators as needed) so Booking Management stays staffed.",
          screenshotCaption: "Equipment list filtered to department",
        },
      ],
    },
    {
      id: "equipment",
      title: "Department Equipment",
      paragraphs: [
        "Your equipment catalog views are locked to your department’s internal equipment.",
      ],
      bullets: [
        "Browse /equipments to see department instruments (not the full institute catalog of other units’ private assets).",
        "When adding equipment (if permitted), Internal Department is typically fixed to your department.",
        "Submit or track Equipment Addition Requests; Institute Admin approves/rejects proposals.",
        "Admin Settings / Equipment modules appear only when Admin Panel Access grants them to your role.",
      ],
    },
    notificationsSection([
      "Equipment addition status updates when administrators review requests.",
    ]),
    bestPracticesSection([
      "Keep OIC assignments current when faculty rotate equipment responsibility.",
      "Grant only the RBAC capabilities staff need — avoid over-privileging.",
      "Coordinate with Institute Admin before changing institute-wide charge or buffer settings.",
    ]),
    permissionsSection({
      paragraphs: [
        "Your authority is department-scoped. Institute-wide CMS, inventory, and global Admin Panel modules remain with Institute Admin unless explicitly granted.",
      ],
      bullets: [
        "You typically receive broad department RBAC capabilities on setup (users, equipment, wallets, reports, role assignment) — then you can grant subsets to staff.",
        "You do not see the Admin-only Department Administration dashboard card that Institute Admins use for institute RBAC overview — use /manage/department-administration instead.",
        "Booking Management lab queues are not your primary dashboard (those belong to OIC/operator).",
        "Approve/reject of equipment addition proposals is Admin-only.",
      ],
    }),
    faqSection([
      {
        question: "Why can’t I see another department’s equipment?",
        answer:
          "Department Administrators are intentionally scoped to their own internal department for catalog and staff management.",
      },
      {
        question: "Where is Admin Settings?",
        answer:
          "Only if Admin Panel Access is enabled for Department Administrator + your department. Ask Institute Admin to enable modules you need.",
      },
      {
        question: "Can I approve an equipment addition request?",
        answer:
          "You can track status; final approve/reject is performed by Institute Admin.",
      },
    ]),
    troubleshootingSection([
      "Staff mapping fails: confirm the user belongs to your department and the role code is manager/operator/finance.",
      "Empty equipment list: verify department access_enabled and that instruments are tagged to your internal department.",
      "Missing manage routes: hard-refresh and confirm user_type is dept_admin.",
    ]),
    supportSection(),
  ],
};

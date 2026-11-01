import type { ReactNode } from "react";
import {
  BookOpen,
  Database,
  FileSpreadsheet,
  FolderTree,
  GraduationCap,
  Inbox,
  KeyRound,
  LifeBuoy,
  MessageSquare,
  Package,
  Shield,
  Sparkles,
  Star,
  Target,
  ToggleRight,
  Trophy,
  User as UserIcon,
  UsersRound,
} from "lucide-react";
import { canAccessModule, hasAdminPanelAccess, type AdminPanelAwareUser } from "@/lib/adminPanelAccess";

export interface AdminSettingsTile {
  title: string;
  description: string;
  path: string;
  icon: ReactNode;
}

/**
 * The Admin Settings tiles this user may open, in page order. Visibility follows Admin Panel Access (user type and
 * department module grants); the Main Administrator sees everything. Shared by the Admin Settings page and search.
 */
export function adminSettingsTiles(user: AdminPanelAwareUser | null | undefined, trainingMenu?: (key: string) => boolean): AdminSettingsTile[] {
  const type = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const isAdmin = type === "admin";
  const panelOk = hasAdminPanelAccess(user);
  if (!panelOk && !isAdmin) return [];
  const can = (moduleKey: string) => isAdmin || (panelOk && canAccessModule(user, moduleKey));
  const icon = (Icon: typeof UserIcon) => <Icon className="h-5 w-5" />;

  const tiles: Array<AdminSettingsTile & { show: boolean }> = [
    { show: can("user_management"), icon: icon(UserIcon), title: "User Management", description: "Users, roles & permissions", path: "/user-management" },
    { show: isAdmin || can("user_management.departments"), icon: icon(FolderTree), title: "Departments", description: "Department list; equipment visibility and booking enable/disable", path: "/admin/section/departments" },
    { show: can("admin_settings.auth"), icon: icon(Shield), title: "Session / Auto-logout", description: "Inactivity timeout and the slot-opening peak window", path: "/admin-settings/auth" },
    { show: can("admin_settings.communication"), icon: icon(MessageSquare), title: "Communication", description: "Email templates and communication logs", path: "/admin-settings/communication" },
    { show: can("admin_settings.inbox_email"), icon: icon(Inbox), title: "Inbox Email", description: "Fetch and view the configured IMAP mailbox", path: "/admin-settings/inbox-email" },
    { show: can("admin_settings.legacy_wallet") || can("admin_settings.inbox_email"), icon: icon(FileSpreadsheet), title: "Wallet Recharge Cash Book", description: "Parse bills@sric TXT / IMAP and match grant codes for verification", path: "/admin-settings/wallet-recharge-parse" },
    { show: can("admin_settings.legacy_wallet"), icon: icon(Database), title: "Legacy Wallet Lookup", description: "Import historical wallet data for testing", path: "/admin-settings/legacy-wallet-import" },
    { show: can("admin_settings.equipment"), icon: icon(Package), title: "Equipment", description: "Equipment modules, slots, nominations, charges, buffers", path: "/admin-settings/equipment" },
    { show: can("admin_settings.department_rbac"), icon: icon(Shield), title: "Department Administration", description: "Staff modules (OIC / Lab / Accounts) and permission caps", path: "/admin/department-administration" },
    { show: can("admin_settings.admin_panel_access"), icon: icon(KeyRound), title: "Admin Panel Access", description: "Enable Admin Panel and modules per user type and department", path: "/admin-settings/admin-panel-access" },
    { show: can("admin_settings.support"), icon: icon(LifeBuoy), title: "Support Tickets", description: "Helpdesk queue, reassign, resolve & notify; new ticket email recipients", path: "/admin-settings/support" },
    { show: can("admin_settings.feedback"), icon: icon(Star), title: "Experience Ratings", description: "“Rate your experience” ratings, comments, statistics and CSV export", path: "/admin-settings/feedback" },
    { show: can("admin_settings.quality_improvement"), icon: icon(Target), title: "Quality Improvement", description: "Bugs & portal suggestions from users", path: "/admin-settings/quality-improvement" },
    { show: isAdmin, icon: icon(BookOpen), title: "Booking Assistant Knowledge", description: "Manage SOPs, FAQs, indexing, gaps, and Booking Assistant usage", path: "/admin-settings/knowledge" },
    { show: isAdmin, icon: icon(Sparkles), title: "AI and automation", description: "Instrument finder, best times, ticket triage, weekly OIC alerts and no-show prompts: switches, dry-run previews and activity log", path: "/admin-settings/automation" },
    { show: isAdmin || type === "dept_admin" || type === "manager", icon: icon(MessageSquare), title: "Copilot Answers & Console", description: "Approved answers, unanswered questions, escalations, feedback and usage", path: "/admin-settings/copilot-answers" },
    { show: can("admin_settings.rewards"), icon: icon(Trophy), title: "Reward Config (Per Equipment)", description: "Per-equipment reward settings", path: "/admin-settings/rewards" },
    { show: isAdmin, icon: icon(ToggleRight), title: "Department Modules", description: "Switch DSA, Remote Analysis, Training, Courier Tracking and Procurement on, off or test-users-only per department", path: "/admin/department-modules" },
    { show: isAdmin, icon: icon(UsersRound), title: "User Groups & Email", description: "Booking users by equipment, facility group, lab and department; export lists and email groups with CC / BCC", path: "/admin-settings/user-groups" },
    { show: can("admin_settings.training") || Boolean(trainingMenu?.("training_policy_settings")), icon: icon(GraduationCap), title: "Training Policy", description: "Training & Certification caps, scoring weights, timelines and demo charges", path: "/admin-settings/training" },
  ];
  return tiles.filter((t) => t.show).map(({ show: _show, ...tile }) => tile);
}

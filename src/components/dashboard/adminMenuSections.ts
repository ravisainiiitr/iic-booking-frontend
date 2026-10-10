import {
  BarChart3,
  Boxes,
  CalendarCheck2,
  GraduationCap,
  LayoutGrid,
  LifeBuoy,
  Megaphone,
  Server,
  Settings,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { DashboardMenuSection } from "./dashboardMenuLayout";

export interface AdminMenuSection extends DashboardMenuSection {
  icon: LucideIcon;
}

/**
 * Sidebar sections for the Main Administrator and Department Administrator. Each role only sees
 * the items its visibility rules allow; empty sections are not shown. Ids are saved in the user's
 * menu order, so keep them stable.
 */
export const ADMIN_MENU_SECTIONS: AdminMenuSection[] = [
  {
    id: "sec_overview",
    name: "Overview",
    icon: BarChart3,
    items: [
      "reports_statistics",
      "equipment_overview",
      "users_overview",
      "cancellations_dashboard",
      "team_calendar",
    ],
  },
  {
    id: "sec_bookings",
    name: "Bookings",
    icon: CalendarCheck2,
    items: [
      "booking_management",
      "view_bookings",
      "urgent_requests",
      "repeat_sample_requests",
      "equipment_waitlist",
      "booking_attempt_log",
      "booking_templates",
      "view_results",
      "proforma_invoice",
      "browse_equipment",
    ],
  },
  {
    id: "sec_equipment",
    name: "Equipment & configuration",
    icon: Boxes,
    items: [
      "equipment_settings",
      "multi_mode_equipment",
      "change_slot_status",
      "disruption_history",
      "accessories",
      "3d_print_materials",
      "equipment_lifecycle_expenses",
      "calendar_colors",
    ],
  },
  {
    id: "sec_people",
    name: "Users & access",
    icon: Users,
    items: [
      "registration_requests",
      "external_user_management",
      "external_organization_verification",
      "department_administration",
      "organization_users",
      "leave_management",
      "oic_substitute",
      "legacy_user_sync",
    ],
  },
  {
    id: "sec_training",
    name: "TA & training",
    icon: GraduationCap,
    items: [
      "nomination_requests",
      "ta_nomination_call",
      "ta_duty_assignments",
      "reward_config",
      "training_workspace",
      "operator_duty",
      "training_attendance",
      "training_events",
      "training_admin",
      "my_trainings",
      "my_duty",
    ],
  },
  {
    id: "sec_finance",
    name: "Finance",
    icon: Wallet,
    items: ["wallet_ledger", "wallet_recharge_requests", "wallet_payment_modes", "wallet_management"],
  },
  {
    id: "sec_operations",
    name: "Operations & infrastructure",
    icon: Server,
    items: [
      "inventory_management",
      "procurement_workflow",
      "procurement_assets",
      "laboratory_infrastructure",
      "remote_analysis",
      "department_sync_agents",
      "deployment_center",
    ],
  },
  {
    id: "sec_content",
    name: "Content & communication",
    icon: Megaphone,
    items: [
      "notice_board_requests",
      "equipment_flash_messages",
      "publication_claims",
      "content_management",
      "my_publications",
    ],
  },
  {
    id: "sec_support",
    name: "Support & feedback",
    icon: LifeBuoy,
    items: ["support_tickets_2", "support_tickets", "experience_ratings", "rate_your_experience", "user_guide"],
  },
  {
    id: "sec_system",
    name: "System",
    icon: Settings,
    items: ["admin_settings", "department_modules", "acceptance_test_dashboard"],
  },
  {
    id: "sec_more",
    name: "More",
    icon: LayoutGrid,
    items: [],
    fallback: true,
  },
];

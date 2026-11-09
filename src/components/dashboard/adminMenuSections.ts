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
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { NOTIFICATION_SETTINGS_MENU_ID, type DashboardMenuSection } from "./dashboardMenuLayout";

export interface AdminMenuSection extends DashboardMenuSection {
  icon: LucideIcon;
}

/**
 * Sidebar sections for the Main Administrator and Department Administrator, in the order of a working day:
 * see the picture, handle bookings, look after equipment, then people, money and the back office.
 * Each role only sees the items its visibility rules allow; empty sections are not shown. Ids are saved in
 * the user's menu order, so keep them stable (new sections get new ids).
 */
export const ADMIN_MENU_SECTIONS: AdminMenuSection[] = [
  {
    id: "sec_overview",
    name: "Overview & insights",
    icon: BarChart3,
    items: [
      "reports_statistics",
      "equipment_overview",
      "users_overview",
      "cancellations_dashboard",
      "service_levels",
      "experience_ratings",
      "funder_impact_report",
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
      "urgent_booking_requests",
      "repeat_sample_requests",
      "equipment_waitlist",
      "view_results",
      "team_calendar",
      "booking_templates",
      "booking_attempt_log",
      "proforma_invoice",
      "browse_equipment",
    ],
  },
  {
    id: "sec_equipment",
    name: "Equipment setup",
    icon: Boxes,
    items: [
      "equipment_settings",
      "multi_mode_equipment",
      "change_slot_status",
      "istem_equipment",
      "equipment_qr_codes",
      "equipment_flash_messages",
      "accessories",
      "3d_print_materials",
      "calendar_colors",
      "equipment_config_audit",
    ],
  },
  {
    id: "sec_maintenance",
    name: "Maintenance & assets",
    icon: Wrench,
    items: [
      "disruption_history",
      "equipment_upkeep",
      "equipment_lifecycle_expenses",
      "inventory_management",
      "procurement_workflow",
      "procurement_assets",
      "laboratory_infrastructure",
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
      "organization_users",
      "student_management",
      "department_administration",
      "leave_management",
      "oic_substitute",
      "legacy_user_sync",
    ],
  },
  {
    id: "sec_finance",
    name: "Finance",
    icon: Wallet,
    items: [
      "wallet_ledger",
      "wallet_recharge_requests",
      "sric_wallet_recharges",
      "wallet_payment_modes",
      "receipt_template",
      "wallet_management",
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
      "ta_reward_points",
      "reward_config",
      "training_workspace",
      "operator_duty",
      "training_attendance",
      "training_authorisations",
      "training_events",
      "training_admin",
      "my_trainings",
      "my_authorisations",
      "my_duty",
    ],
  },
  {
    id: "sec_content",
    name: "Research & communication",
    icon: Megaphone,
    items: [
      "publication_claims",
      "publication_matches",
      "author_confirmations",
      "my_publications",
      "notice_board_requests",
      "content_management",
    ],
  },
  {
    id: "sec_support",
    name: "Support & feedback",
    icon: LifeBuoy,
    items: [
      "support_tickets_2",
      "support_tickets",
      NOTIFICATION_SETTINGS_MENU_ID,
      "rate_your_experience",
      "user_guide",
    ],
  },
  {
    id: "sec_operations",
    name: "Integrations",
    icon: Server,
    items: ["remote_analysis", "department_sync_agents", "deployment_center"],
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

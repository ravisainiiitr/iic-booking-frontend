/**
 * Admin Panel module access helpers (mirrors backend `iic_booking.users.rbac`
 * and `iic_booking.users.admin_settings_registry` matching logic).
 *
 * Module keys are dotted strings, e.g. "user_management", "user_management.users",
 * "admin_settings.equipment.bookings".
 *
 * `admin_panel_modules` is expanded server-side for parent→descendants only
 * (selecting a parent grants all children). Ancestors are NOT injected for leaf
 * grants — otherwise every sibling under a hub would appear allowed.
 */

export interface AdminPanelAwareUser {
  user_type?: string | number | null;
  is_staff?: boolean;
  admin_panel_enabled?: boolean;
  admin_panel_modules?: string[] | null;
}

function isMainAdmin(user: AdminPanelAwareUser | null | undefined): boolean {
  if (!user) return false;
  if (user.is_staff) return true;
  return String(user.user_type ?? "").toLowerCase() === "admin";
}

/** Whether the user may see/use the Admin Panel at all. Main Admin is always true. */
export function hasAdminPanelAccess(user: AdminPanelAwareUser | null | undefined): boolean {
  if (!user) return false;
  if (isMainAdmin(user)) return true;
  return user.admin_panel_enabled === true;
}

/**
 * Whether the user can access a specific Admin Settings module key.
 * - Exact key in `admin_panel_modules`
 * - Parent grant: moduleKey is under a granted key (parent selected → all children)
 * - Hub: moduleKey is an ancestor of a granted leaf (hub page reachable)
 */
export function hasAdminModule(user: AdminPanelAwareUser | null | undefined, moduleKey: string | null | undefined): boolean {
  if (!moduleKey) return false;
  if (!user) return false;
  if (isMainAdmin(user)) return true;
  if (!hasAdminPanelAccess(user)) return false;
  const keys = user.admin_panel_modules;
  if (!Array.isArray(keys) || keys.length === 0) return false;
  if (keys.includes(moduleKey)) return true;
  // Parent explicitly granted → this child is allowed
  if (keys.some((k) => moduleKey.startsWith(`${k}.`))) return true;
  // Hub page when any granted module sits under this key
  if (keys.some((k) => k.startsWith(`${moduleKey}.`))) return true;
  return false;
}

/** Alias of `hasAdminModule`, named to read well at call sites gating page/tile access. */
export function canAccessModule(user: AdminPanelAwareUser | null | undefined, moduleKey: string | null | undefined): boolean {
  return hasAdminModule(user, moduleKey);
}

/** Alias of `hasAdminModule`, named to read well as a guard-clause check. */
export function assertModuleAccess(user: AdminPanelAwareUser | null | undefined, moduleKey: string | null | undefined): boolean {
  return hasAdminModule(user, moduleKey);
}

/**
 * Best-effort mirror of the backend's `module_key_for_path`: maps a frontend route to
 * its Admin Settings module key by longest-prefix match. Optional — used by
 * `AdminModuleGuard` when no explicit `moduleKey` prop is given.
 */
const PATH_TO_MODULE_KEY: Array<{ path: string; key: string }> = [
  { path: "/user-management", key: "user_management" },
  { path: "/admin/section/users", key: "user_management.users" },
  { path: "/admin/section/departments", key: "user_management.departments" },
  { path: "/admin/section/projects", key: "user_management.projects" },
  { path: "/admin/section/wallets", key: "user_management.wallets" },
  { path: "/admin/section/subWallets", key: "user_management.sub_wallets" },
  { path: "/admin/section/subWalletTransactions", key: "user_management.sub_wallet_transactions" },
  { path: "/admin/section/walletRazorpayOrders", key: "user_management.wallet_razorpay_orders" },
  { path: "/admin/section/walletRechargeRequests", key: "user_management.wallet_recharge_requests" },
  { path: "/admin/section/userDocuments", key: "user_management.user_documents" },
  { path: "/admin/section/userGroups", key: "user_management.user_groups" },
  { path: "/admin/section/userGroupMembers", key: "user_management.user_group_members" },
  { path: "/admin-settings/wallet-sric-settings", key: "user_management.wallet_sric_settings" },
  { path: "/admin-settings/wallet-withdrawal-requests", key: "user_management.wallet_withdrawal_requests" },
  { path: "/admin-settings/wallet-credit-facility-settings", key: "user_management.wallet_credit_facility_settings" },
  { path: "/admin-settings/wallet-student-recharge-settings", key: "user_management.wallet_student_recharge_settings" },
  { path: "/admin-settings/auth", key: "admin_settings.auth" },
  { path: "/admin-settings/communication", key: "admin_settings.communication" },
  { path: "/admin-settings/inbox-email", key: "admin_settings.inbox_email" },
  { path: "/admin-settings/wallet-recharge-parse", key: "admin_settings.wallet" },
  { path: "/admin-settings/legacy-wallet-import", key: "admin_settings.legacy_wallet" },
  { path: "/admin-settings/equipment", key: "admin_settings.equipment" },
  { path: "/admin/equipment-addition-requests", key: "admin_settings.equipment.addition_requests" },
  { path: "/booking-attempt-logs", key: "admin_settings.equipment.booking_attempt_logs" },
  { path: "/admin/section/bookings", key: "admin_settings.equipment.bookings" },
  { path: "/admin/section/repeatSampleRequests", key: "admin_settings.equipment.repeat_sample_requests" },
  { path: "/admin/section/dailySlots", key: "admin_settings.equipment.daily_slots" },
  { path: "/admin/section/equipment", key: "admin_settings.equipment.equipment" },
  { path: "/admin/section/equipmentCategories", key: "admin_settings.equipment.categories" },
  { path: "/admin/section/equipmentGroups", key: "admin_settings.equipment.groups" },
  { path: "/admin/section/holidays", key: "admin_settings.equipment.holidays" },
  { path: "/admin-settings/equipment/semesters", key: "admin_settings.equipment.semesters" },
  { path: "/admin-settings/equipment/student-nominations", key: "admin_settings.equipment.student_nominations" },
  { path: "/admin-settings/equipment/icpms-standards", key: "admin_settings.equipment.icpms_standards" },
  { path: "/admin-settings/equipment/mode-schedules", key: "admin_settings.equipment.mode_schedules" },
  { path: "/admin-settings/equipment/booking-charge-settings", key: "admin_settings.equipment.booking_charge_settings" },
  { path: "/admin-settings/equipment/booking-buffer-config", key: "admin_settings.equipment.booking_buffer_config" },
  { path: "/admin/department-rbac", key: "admin_settings.department_rbac" },
  { path: "/admin/department-administration", key: "admin_settings.department_rbac" },
  { path: "/manage/department-administration", key: "admin_settings.department_rbac" },
  { path: "/admin-settings/admin-panel-access", key: "admin_settings.admin_panel_access" },
  { path: "/admin-settings/support", key: "admin_settings.support" },
  { path: "/admin-settings/feedback", key: "admin_settings.feedback" },
  { path: "/admin-settings/quality-improvement", key: "admin_settings.quality_improvement" },
  { path: "/admin-settings/rewards", key: "admin_settings.rewards" },
];

export function moduleKeyForPath(path: string | null | undefined): string | null {
  if (!path) return null;
  const normalized = path.replace(/\/+$/, "") || "/";
  let best: string | null = null;
  let bestLen = -1;
  for (const row of PATH_TO_MODULE_KEY) {
    const p = row.path.replace(/\/+$/, "");
    if (!p) continue;
    if (normalized === p || normalized.startsWith(`${p}/`)) {
      if (p.length > bestLen) {
        best = row.key;
        bestLen = p.length;
      }
    }
  }
  return best;
}

/**
 * Where a dashboard shows equipment maintenance events (Module 9): OIC and Lab Operator dashboards show them inside
 * "Needs your attention"; the Main Administrator's dashboard keeps the banner. Never both, so an event is never
 * listed twice.
 */
export function maintenancePlacement(role: { showsLabStyleDashboard: boolean; isAdmin: boolean }): {
  banner: boolean;
  inAttention: boolean;
} {
  if (role.showsLabStyleDashboard) return { banner: false, inAttention: true };
  return { banner: role.isAdmin, inAttention: false };
}

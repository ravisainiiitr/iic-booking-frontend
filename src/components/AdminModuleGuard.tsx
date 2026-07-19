import { useEffect, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { assertModuleAccess, moduleKeyForPath } from "@/lib/adminPanelAccess";

/**
 * Route guard for Admin Settings pages. Redirects away when the current user does not
 * have the given (or path-derived) Admin Settings module key. Main Admin always passes.
 *
 * Usage:
 *   <Route path="/admin-settings/admin-panel-access" element={
 *     <AdminModuleGuard moduleKey="admin_settings.admin_panel_access">
 *       <AdminPanelAccessConfig />
 *     </AdminModuleGuard>
 *   } />
 */
export default function AdminModuleGuard({
  moduleKey,
  redirectTo = "/admin-settings",
  children,
}: {
  /** Admin Settings module key to require. Falls back to matching the current path when omitted. */
  moduleKey?: string;
  /** Where to send the user when access is denied. Defaults to the Admin Settings hub. */
  redirectTo?: string;
  children: ReactNode;
}) {
  const { user, loading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const effectiveKey = moduleKey ?? moduleKeyForPath(location.pathname);
  const allowed = !effectiveKey || assertModuleAccess(user, effectiveKey);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated || !user) {
      navigate("/auth");
      return;
    }
    if (!allowed) {
      toast.error("You do not have permission to access this section.");
      navigate(redirectTo);
    }
  }, [loading, isAuthenticated, user, allowed, navigate, redirectTo]);

  if (loading || !isAuthenticated || !user || !allowed) return null;

  return <>{children}</>;
}

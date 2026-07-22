import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  User as UserIcon,
  MessageSquare,
  Package,
  LifeBuoy,
  Target,
  Inbox,
  Shield,
  Trophy,
  Database,
  Star,
  KeyRound,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { canAccessModule, hasAdminPanelAccess } from "@/lib/adminPanelAccess";
import { PageHero, PageShell, SettingsTile } from "@/components/PageShell";

/**
 * Admin Settings hub. Tile visibility is driven by Admin Panel Access config
 * (user_type + department module grants). Main Admin always sees everything.
 */
const AdminSettings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userTypeStr = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const isAdmin = userTypeStr === "admin";
  const panelOk = hasAdminPanelAccess(user);

  const can = (moduleKey: string) => isAdmin || (panelOk && canAccessModule(user, moduleKey));

  if (!panelOk && !isAdmin) {
    return (
      <PageShell>
        <main className="container mx-auto px-4 py-8">
          <PageHero title="Admin Settings" description="Admin Panel access is not enabled for your user type in this department.">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
              className="mb-4 text-white/90 hover:text-white hover:bg-white/20"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </PageHero>
        </main>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <main className="container mx-auto px-4 py-8">
        <PageHero
          title="Admin Settings"
          description={
            isAdmin
              ? "Institute-wide configuration. Use Admin Panel Access to enable modules per user type and department."
              : "Only modules granted by the Main Administrator for your user type and department are shown."
          }
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="mb-4 text-white/90 hover:text-white hover:bg-white/20"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </PageHero>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {can("user_management") && (
            <SettingsTile
              icon={<UserIcon className="h-5 w-5" />}
              title="User Management"
              description="Users, roles & permissions"
              onClick={() => navigate("/user-management")}
            />
          )}
          {can("admin_settings.auth") && (
            <SettingsTile
              icon={<Shield className="h-5 w-5" />}
              title="Session / Auto-logout"
              description="Inactivity timeout for authenticated sessions"
              onClick={() => navigate("/admin-settings/auth")}
            />
          )}
          {can("admin_settings.communication") && (
            <SettingsTile
              icon={<MessageSquare className="h-5 w-5" />}
              title="Communication"
              description="Email templates and communication logs"
              onClick={() => navigate("/admin-settings/communication")}
            />
          )}
          {can("admin_settings.inbox_email") && (
            <SettingsTile
              icon={<Inbox className="h-5 w-5" />}
              title="Inbox Email"
              description="Fetch and view the configured IMAP mailbox"
              onClick={() => navigate("/admin-settings/inbox-email")}
            />
          )}
          {can("admin_settings.legacy_wallet") && (
            <SettingsTile
              icon={<Database className="h-5 w-5" />}
              title="Legacy Wallet Lookup"
              description="Import historical wallet data for testing"
              onClick={() => navigate("/admin-settings/legacy-wallet-import")}
            />
          )}
          {can("admin_settings.equipment") && (
            <SettingsTile
              icon={<Package className="h-5 w-5" />}
              title="Equipment"
              description="Equipment modules, slots, nominations, charges, buffers"
              onClick={() => navigate("/admin-settings/equipment")}
            />
          )}
          {can("admin_settings.department_rbac") && (
            <SettingsTile
              icon={<Shield className="h-5 w-5" />}
              title="Department Administration"
              description="Staff modules (OIC / Lab / Accounts) and permission caps"
              onClick={() => navigate("/admin/department-administration")}
            />
          )}
          {can("admin_settings.admin_panel_access") && (
            <SettingsTile
              icon={<KeyRound className="h-5 w-5" />}
              title="Admin Panel Access"
              description="Enable Admin Panel and modules per user type and department"
              onClick={() => navigate("/admin-settings/admin-panel-access")}
            />
          )}
          {can("admin_settings.support") && (
            <SettingsTile
              icon={<LifeBuoy className="h-5 w-5" />}
              title="Support Tickets"
              description="Helpdesk queue, reassign, resolve & notify"
              onClick={() => navigate("/admin-settings/support")}
            />
          )}
          {can("admin_settings.feedback") && (
            <SettingsTile
              icon={<Star className="h-5 w-5" />}
              title="Portal Feedback"
              description="UX ratings, suggestions, and summary statistics"
              onClick={() => navigate("/admin-settings/feedback")}
            />
          )}
          {can("admin_settings.quality_improvement") && (
            <SettingsTile
              icon={<Target className="h-5 w-5" />}
              title="Quality Improvement"
              description="Bugs & portal suggestions from users"
              onClick={() => navigate("/admin-settings/quality-improvement")}
            />
          )}
          {can("admin_settings.rewards") && (
            <SettingsTile
              icon={<Trophy className="h-5 w-5" />}
              title="Reward Config (Per Equipment)"
              description="Per-equipment reward settings"
              onClick={() => navigate("/admin-settings/rewards")}
            />
          )}
        </div>
      </main>
    </PageShell>
  );
};

export default AdminSettings;

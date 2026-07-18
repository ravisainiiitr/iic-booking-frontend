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
  Wallet,
  Shield,
  Trophy,
  Database,
  Star,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { PageHero, PageShell, SettingsTile } from "@/components/PageShell";

const AdminSettings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userTypeStr = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const isAdmin = userTypeStr === "admin";
  const canManageRewards =
    userTypeStr === "admin" || userTypeStr === "manager" || userTypeStr === "operator";

  return (
    <PageShell>
      <main className="container mx-auto px-4 py-8">
        <PageHero
          title="Admin Settings"
          description="Manage users, equipment, communications, support, and portal configuration."
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
          <SettingsTile
            icon={<UserIcon className="h-5 w-5" />}
            title="User Management"
            description="Users, roles & permissions"
            onClick={() => navigate("/user-management")}
          />
          {isAdmin && (
            <SettingsTile
              icon={<Shield className="h-5 w-5" />}
              title="Session / Auto-logout"
              description="Inactivity timeout for authenticated sessions"
              onClick={() => navigate("/admin-settings/auth")}
            />
          )}
          {isAdmin && (
            <SettingsTile
              icon={<MessageSquare className="h-5 w-5" />}
              title="Communication"
              description="Email templates and communication logs"
              onClick={() => navigate("/admin-settings/communication")}
            />
          )}
          {isAdmin && (
            <SettingsTile
              icon={<Inbox className="h-5 w-5" />}
              title="Inbox Email"
              description="Fetch and view the configured IMAP mailbox"
              onClick={() => navigate("/admin-settings/inbox-email")}
            />
          )}
          {isAdmin && (
            <SettingsTile
              icon={<Wallet className="h-5 w-5" />}
              title="Wallet Management"
              description="Parse and manage wallet recharge emails"
              onClick={() => navigate("/admin-settings/wallet-recharge-parse")}
            />
          )}
          {isAdmin && (
            <SettingsTile
              icon={<Database className="h-5 w-5" />}
              title="Legacy Wallet Lookup"
              description="Import historical wallet data for testing"
              onClick={() => navigate("/admin-settings/legacy-wallet-import")}
            />
          )}
          {isAdmin && (
            <SettingsTile
              icon={<Package className="h-5 w-5" />}
              title="Equipment"
              description="List, search, filter & edit equipment"
              onClick={() => navigate("/admin-settings/equipment")}
            />
          )}
          {isAdmin && (
            <SettingsTile
              icon={<LifeBuoy className="h-5 w-5" />}
              title="Support Tickets"
              description="Helpdesk queue, reassign, resolve & notify"
              onClick={() => navigate("/admin-settings/support")}
            />
          )}
          {isAdmin && (
            <SettingsTile
              icon={<Star className="h-5 w-5" />}
              title="Portal Feedback"
              description="UX ratings, suggestions, and summary statistics"
              onClick={() => navigate("/admin-settings/feedback")}
            />
          )}
          {isAdmin && (
            <SettingsTile
              icon={<Target className="h-5 w-5" />}
              title="Quality Improvement"
              description="Bugs & portal suggestions from users"
              onClick={() => navigate("/admin-settings/quality-improvement")}
            />
          )}
          {canManageRewards && (
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

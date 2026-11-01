import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { hasAdminPanelAccess } from "@/lib/adminPanelAccess";
import { PageHero, PageShell, SettingsTile, StandaloneOnly } from "@/components/PageShell";
import { useTrainingAvailability } from "@/components/training/useTrainingAvailability";
import { adminSettingsTiles } from "@/pages/adminSettingsTiles";

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
  const { menu: trainingMenu } = useTrainingAvailability();

  if (!panelOk && !isAdmin) {
    return (
      <PageShell>
        <main className="container mx-auto px-4 py-5">
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
      <main className="container mx-auto px-4 py-5">
        <StandaloneOnly>
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
        </StandaloneOnly>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {adminSettingsTiles(user, trainingMenu).map((tile) => (
            <SettingsTile
              key={tile.path}
              icon={tile.icon}
              title={tile.title}
              description={tile.description}
              onClick={() => navigate(tile.path)}
            />
          ))}
        </div>
      </main>
    </PageShell>
  );
};

export default AdminSettings;

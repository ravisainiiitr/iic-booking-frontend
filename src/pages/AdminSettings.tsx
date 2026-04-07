import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, User as UserIcon, MessageSquare, Package, LifeBuoy, Target, Inbox, Wallet, Shield, Trophy } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { useAuth } from "@/contexts/AuthContext";

const AdminSettings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userTypeStr = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const isAdmin = userTypeStr === "admin";
  const canManageRewards = userTypeStr === "admin" || userTypeStr === "manager" || userTypeStr === "operator";

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
              className="mb-2"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold">Admin Settings</h1>
            <p className="text-muted-foreground mt-1">
              Equipment and users management.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate("/user-management")}
          >
            <CardHeader>
              <UserIcon className="h-8 w-8 text-primary mb-2" />
              <CardTitle className="text-base">User Management</CardTitle>
              <CardDescription className="text-sm">
                Users, roles & permissions
              </CardDescription>
            </CardHeader>
          </Card>
          {isAdmin && (
            <Card
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate("/admin-settings/auth")}
            >
              <CardHeader>
                <Shield className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-base">Session / Auto-logout</CardTitle>
                <CardDescription className="text-sm">
                  Set inactivity timeout (auto-logout after no activity)
                </CardDescription>
              </CardHeader>
            </Card>
          )}
          {isAdmin && (
            <Card
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate("/admin-settings/communication")}
            >
              <CardHeader>
                <MessageSquare className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-base">Communication</CardTitle>
                <CardDescription className="text-sm">
                  Templates & communication logs (same as Django admin)
                </CardDescription>
              </CardHeader>
            </Card>
          )}
          {isAdmin && (
            <Card
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate("/admin-settings/inbox-email")}
            >
              <CardHeader>
                <Inbox className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-base">Inbox Email</CardTitle>
                <CardDescription className="text-sm">
                  Fetch and view emails from the configured IMAP mailbox
                </CardDescription>
              </CardHeader>
            </Card>
          )}
          {isAdmin && (
            <Card
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate("/admin-settings/wallet-recharge-parse")}
            >
              <CardHeader>
                <Wallet className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-base">Wallet Management</CardTitle>
                <CardDescription className="text-sm">
                  Manual credits, file import, IMAP, and wallet recharge history
                </CardDescription>
              </CardHeader>
            </Card>
          )}
          {isAdmin && (
            <Card
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate("/admin-settings/equipment")}
            >
              <CardHeader>
                <Package className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-base">Equipment</CardTitle>
                <CardDescription className="text-sm">
                  List, search, filter & edit equipment (same as Django /admin/equipment/)
                </CardDescription>
              </CardHeader>
            </Card>
          )}
          {isAdmin && (
            <Card
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate("/admin-settings/support")}
            >
              <CardHeader>
                <LifeBuoy className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-base">Support</CardTitle>
                <CardDescription className="text-sm">
                  View and add support tickets (mirrors Django admin /admin/support/ticket/)
                </CardDescription>
              </CardHeader>
            </Card>
          )}
          {isAdmin && (
            <Card
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate("/admin-settings/quality-improvement")}
            >
              <CardHeader>
                <Target className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-base">Quality Improvement</CardTitle>
                <CardDescription className="text-sm">
                  Bugs & suggestions for the booking website; mark resolved or unresolved and notify users
                </CardDescription>
              </CardHeader>
            </Card>
          )}
          {canManageRewards && (
            <Card
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate("/admin-settings/rewards")}
            >
              <CardHeader>
                <Trophy className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-base">Reward Config (Per Equipment)</CardTitle>
                <CardDescription className="text-sm">
                  Configure TA reward earning and redemption rules equipment-wise
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminSettings;

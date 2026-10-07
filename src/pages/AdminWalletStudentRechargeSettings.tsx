import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardHeader from "@/components/DashboardHeader";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import { StandaloneOnly } from "@/components/PageShell";

export default function AdminWalletStudentRechargeSettings() {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const userTypeStr = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const isAdmin = userTypeStr === "admin";

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      navigate("/auth");
      return;
    }
    if (!isAdmin) {
      toast.error("Only admin can access Wallet Student Recharge Settings.");
      navigate("/user-management");
    }
  }, [navigate, isAuthenticated, user, isAdmin, authLoading]);

  if (!isAdmin && !authLoading) return null;

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-5 max-w-2xl">
        <div className="mb-6">
          <StandaloneOnly>
            <Button variant="ghost" size="sm" onClick={() => navigate("/user-management")} className="mb-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to User Management
            </Button>
          </StandaloneOnly>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShoppingCart className="h-8 w-8 text-primary" />
            Wallet Student Recharge Settings
          </h1>
          <p className="text-muted-foreground mt-1">No longer used: there is nothing to switch on here.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>IITR Student wallet recharge is always available</CardTitle>
            <CardDescription>
              Every IITR Student linked to a supervisor&apos;s wallet sees Recharge Wallet on the Wallet page, for the
              same departments the supervisor can recharge.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              The recharge methods follow{" "}
              <strong className="text-foreground">Admin Settings → Wallet Payment Modes</strong> (global switches and
              per-department overrides). A method switched off for a department shows &quot;Awaiting Competent
              Authority Approval&quot;. Project Grant stays faculty-only; students use Direct Cash Deposit / Bank
              Transfer (or Pay online when it is on).
            </p>
            <p>
              The old global switch and the per-department &quot;Student wallet recharge&quot; option no longer change
              anything. Students not linked to a supervisor still see the form to link their supervisor first.
              Individual Students keep their own wallet and are not affected.
            </p>
            <div className="pt-2">
              <Button variant="outline" onClick={() => navigate("/user-management")}>
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

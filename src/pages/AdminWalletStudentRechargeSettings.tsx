import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import DashboardHeader from "@/components/DashboardHeader";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft, Loader2, ShoppingCart } from "lucide-react";

interface WalletStudentRechargeSettingsData {
  id: number;
  enable_iitr_student_wallet_recharge: boolean;
}

export default function AdminWalletStudentRechargeSettings() {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const userTypeStr = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const isAdmin = userTypeStr === "admin";

  const [id, setId] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);

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

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    apiClient
      .adminSingletonGet<WalletStudentRechargeSettingsData>("walletStudentRechargeSettings")
      .then((res) => {
        if (res.error) {
          toast.error(res.error);
          return;
        }
        if (res.data) {
          setId(res.data.id ?? 1);
          setEnabled(res.data.enable_iitr_student_wallet_recharge ?? false);
        }
      })
      .catch(() => toast.error("Failed to load wallet student recharge settings."))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  const handleSave = async () => {
    setSaving(true);
    const res = await apiClient.adminSingletonUpdate<WalletStudentRechargeSettingsData>(
      "walletStudentRechargeSettings",
      { enable_iitr_student_wallet_recharge: enabled },
      id
    );
    setSaving(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Wallet student recharge settings updated.");
  };

  if (!isAdmin && !authLoading) return null;

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/user-management")} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to User Management
          </Button>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShoppingCart className="h-8 w-8 text-primary" />
            Wallet Student Recharge Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Allow IITR Students to recharge the shared faculty wallet via SBIePay or offline payment-receipt upload.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>IITR Student wallet recharge</CardTitle>
              <CardDescription>
                Individual Students keep their own wallet and are not affected by this setting.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label className="text-base">Enable IITR Student wallet recharge</Label>
                  <p className="text-sm text-muted-foreground">
                    When on, IITR Students may recharge via SBIePay or Offline Request (payment receipt upload).
                    Funds park in the concerned faculty wallet.
                  </p>
                </div>
                <Switch checked={enabled} onCheckedChange={setEnabled} />
              </div>
              <div className="flex gap-3 pt-2">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save
                </Button>
                <Button variant="outline" onClick={() => navigate("/user-management")}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

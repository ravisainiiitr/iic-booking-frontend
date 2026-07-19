import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import DashboardHeader from "@/components/DashboardHeader";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Loader2, CreditCard } from "lucide-react";

interface WalletCreditFacilitySettingsData {
  id: number;
  balance_threshold_inr: string | number;
  credit_window_days: number;
  max_credit_inr: string | number;
}

export default function AdminWalletCreditFacilitySettings() {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const userTypeStr = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const isAdmin = userTypeStr === "admin";

  const [id, setId] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [balanceThreshold, setBalanceThreshold] = useState("1000");
  const [creditWindowDays, setCreditWindowDays] = useState(7);
  const [maxCredit, setMaxCredit] = useState("1000");

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      navigate("/auth");
      return;
    }
    if (!isAdmin) {
      toast.error("Only admin can access Wallet Credit Facility Settings.");
      navigate("/user-management");
    }
  }, [navigate, isAuthenticated, user, isAdmin, authLoading]);

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    apiClient
      .adminSingletonGet<WalletCreditFacilitySettingsData>("walletCreditFacilitySettings")
      .then((res) => {
        if (res.error) {
          toast.error(res.error);
          return;
        }
        if (res.data) {
          setId(res.data.id ?? 1);
          setBalanceThreshold(String(res.data.balance_threshold_inr ?? "1000"));
          setCreditWindowDays(res.data.credit_window_days ?? 7);
          setMaxCredit(String(res.data.max_credit_inr ?? "1000"));
        }
      })
      .catch(() => toast.error("Failed to load wallet credit facility settings."))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  const handleSave = async () => {
    setSaving(true);
    const res = await apiClient.adminSingletonUpdate<WalletCreditFacilitySettingsData>(
      "walletCreditFacilitySettings",
      {
        balance_threshold_inr: balanceThreshold,
        credit_window_days: creditWindowDays,
        max_credit_inr: maxCredit,
      },
      id
    );
    setSaving(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Wallet credit facility settings updated.");
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
            <CreditCard className="h-8 w-8 text-primary" />
            Wallet Credit Facility Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Faculty may opt into a short credit line when raising a recharge request while the department
            sub-wallet balance is below the threshold.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Credit facility parameters</CardTitle>
              <CardDescription>Single row settings applied for all faculty recharge requests.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="cf-threshold">Balance threshold (₹)</Label>
                <Input
                  id="cf-threshold"
                  type="number"
                  min={0}
                  value={balanceThreshold}
                  onChange={(e) => setBalanceThreshold(e.target.value)}
                  className="max-w-xs"
                />
                <p className="text-sm text-muted-foreground">
                  If the department sub-wallet balance is below this amount, the faculty may be offered the credit
                  facility popup.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cf-window">Credit window (days)</Label>
                <Input
                  id="cf-window"
                  type="number"
                  min={0}
                  value={creditWindowDays}
                  onChange={(e) => setCreditWindowDays(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="max-w-xs"
                />
                <p className="text-sm text-muted-foreground">
                  Parse confirmation is expected within this many days from OTP verification, else bookings for that
                  department are blocked.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cf-max">Maximum credit line (₹)</Label>
                <Input
                  id="cf-max"
                  type="number"
                  min={0}
                  value={maxCredit}
                  onChange={(e) => setMaxCredit(e.target.value)}
                  className="max-w-xs"
                />
                <p className="text-sm text-muted-foreground">
                  Upper cap for the temporary credit line. Actual line is min(this, requested recharge amount).
                </p>
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

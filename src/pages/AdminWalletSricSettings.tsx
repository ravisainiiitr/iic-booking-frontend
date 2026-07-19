import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import DashboardHeader from "@/components/DashboardHeader";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Mail } from "lucide-react";

interface WalletSricSettingsData {
  id: number;
  recipient_emails: string;
  grant_code_for_credit: string;
}

export default function AdminWalletSricSettings() {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const userTypeStr = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const isAdmin = userTypeStr === "admin";

  const [id, setId] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recipientEmails, setRecipientEmails] = useState("");
  const [grantCode, setGrantCode] = useState("IIC-000-002");

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      navigate("/auth");
      return;
    }
    if (!isAdmin) {
      toast.error("Only admin can access Wallet SRIC Office Notification Settings.");
      navigate("/user-management");
    }
  }, [navigate, isAuthenticated, user, isAdmin, authLoading]);

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    apiClient
      .adminSingletonGet<WalletSricSettingsData>("walletSricSettings")
      .then((res) => {
        if (res.error) {
          toast.error(res.error);
          return;
        }
        if (res.data) {
          setId(res.data.id ?? 1);
          setRecipientEmails(res.data.recipient_emails ?? "");
          setGrantCode(res.data.grant_code_for_credit ?? "IIC-000-002");
        }
      })
      .catch(() => toast.error("Failed to load SRIC office settings."))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  const handleSave = async () => {
    setSaving(true);
    const res = await apiClient.adminSingletonUpdate<WalletSricSettingsData>(
      "walletSricSettings",
      { recipient_emails: recipientEmails, grant_code_for_credit: grantCode.trim() },
      id
    );
    setSaving(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Wallet SRIC office settings updated.");
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
            <Mail className="h-8 w-8 text-primary" />
            Wallet SRIC Office Notification Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            SRIC Office email recipients used when a faculty member sends a wallet recharge request to the SRIC
            Office.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>SRIC Office recipients</CardTitle>
              <CardDescription>One address per line, or comma/semicolon separated.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="sric-emails">SRIC Office email addresses</Label>
                <Textarea
                  id="sric-emails"
                  value={recipientEmails}
                  onChange={(e) => setRecipientEmails(e.target.value)}
                  rows={6}
                  placeholder="sric.office@iitr.ac.in"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sric-grant-code">Default grant code (fallback)</Label>
                <Input id="sric-grant-code" value={grantCode} onChange={(e) => setGrantCode(e.target.value)} className="max-w-xs" />
                <p className="text-sm text-muted-foreground">
                  Used in the SRIC Office recharge email only when the selected internal department has no grant
                  code of its own.
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

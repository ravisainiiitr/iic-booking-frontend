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
  bill_section_emails?: string;
  grant_code_for_credit: string;
}

export default function AdminWalletSricSettings() {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const userTypeStr = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const isAdmin = userTypeStr === "admin";
  const isDeptAdmin = userTypeStr === "dept_admin";
  const canAccess = isAdmin || isDeptAdmin;
  const backPath = isDeptAdmin && !isAdmin ? "/manage/department-administration" : "/user-management";

  const [id, setId] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recipientEmails, setRecipientEmails] = useState("");
  const [billSectionEmails, setBillSectionEmails] = useState("");
  const [grantCode, setGrantCode] = useState("IIC-000-002");

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      navigate("/auth");
      return;
    }
    if (!canAccess) {
      toast.error("Only Admin or Department Administrator can access Wallet SRIC settings.");
      navigate("/dashboard");
    }
  }, [navigate, isAuthenticated, user, canAccess, authLoading]);

  useEffect(() => {
    if (!canAccess) return;
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
          setBillSectionEmails(res.data.bill_section_emails ?? "");
          setGrantCode(res.data.grant_code_for_credit ?? "IIC-000-002");
        }
      })
      .catch(() => toast.error("Failed to load SRIC office settings."))
      .finally(() => setLoading(false));
  }, [canAccess]);

  const handleSave = async () => {
    setSaving(true);
    const payload: Partial<WalletSricSettingsData> = isAdmin
      ? {
          recipient_emails: recipientEmails,
          bill_section_emails: billSectionEmails,
          grant_code_for_credit: grantCode.trim(),
        }
      : { bill_section_emails: billSectionEmails };
    const res = await apiClient.adminSingletonUpdate<WalletSricSettingsData>(
      "walletSricSettings",
      payload,
      id
    );
    setSaving(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(isAdmin ? "Wallet SRIC office settings updated." : "SRIC Bill Section emails updated.");
  };

  if (!canAccess && !authLoading) return null;

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate(backPath)} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {isDeptAdmin && !isAdmin ? "Back to Department Administration" : "Back to User Management"}
          </Button>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Mail className="h-8 w-8 text-primary" />
            {isAdmin ? "Wallet SRIC Office Notification Settings" : "SRIC Bill Section Email Settings"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin
              ? "SRIC Office and Bill Section email recipients used for wallet recharge request notifications."
              : "Configure Bill Section email recipients used for Direct Cash Deposit / Bank Transfer recharge requests."}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{isAdmin ? "SRIC notification recipients" : "Bill Section recipients"}</CardTitle>
              <CardDescription>One address per line, or comma/semicolon separated.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isAdmin ? (
                <>
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
                    <Input
                      id="sric-grant-code"
                      value={grantCode}
                      onChange={(e) => setGrantCode(e.target.value)}
                      className="max-w-xs"
                    />
                    <p className="text-sm text-muted-foreground">
                      Used in the SRIC Office recharge email only when the selected internal department has no grant
                      code of its own.
                    </p>
                  </div>
                </>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="bill-section-emails">SRIC Bill Section Email</Label>
                <Textarea
                  id="bill-section-emails"
                  value={billSectionEmails}
                  onChange={(e) => setBillSectionEmails(e.target.value)}
                  rows={6}
                  placeholder="sric.bill@iitr.ac.in"
                />
                <p className="text-sm text-muted-foreground">
                  Used for Direct Cash Deposit / Bank Transfer recharge requests.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save
                </Button>
                <Button variant="outline" onClick={() => navigate(backPath)}>
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

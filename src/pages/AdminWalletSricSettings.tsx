import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import DashboardHeader from "@/components/DashboardHeader";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Mail } from "lucide-react";

interface WalletSricSettingsData {
  id: number;
  project_grant_recharge_enabled?: boolean;
  recipient_emails: string;
  bill_section_emails?: string;
  project_grant_cc_emails?: string;
  cash_deposit_cc_emails?: string;
  grant_code_for_credit: string;
  ar_sric_emails?: string;
  dean_sric_emails?: string;
  decline_converts_to_credit?: boolean;
  auto_read_cashbook_mailbox?: boolean;
  cashbook_sender_emails?: string;
  fund_receipt_overdue_days?: number;
}

const CC_HELP =
  "The requesting user (and the wallet owner, if different) is always copied. CC recipients receive the full request details without Approve / Decline links, and are also informed when the request is approved, declined or cancelled.";

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
  const [projectGrantEnabled, setProjectGrantEnabled] = useState(false);
  const [recipientEmails, setRecipientEmails] = useState("");
  const [billSectionEmails, setBillSectionEmails] = useState("");
  const [projectGrantCcEmails, setProjectGrantCcEmails] = useState("");
  const [cashDepositCcEmails, setCashDepositCcEmails] = useState("");
  const [grantCode, setGrantCode] = useState("IIC-000-002");
  const [arSricEmails, setArSricEmails] = useState("");
  const [deanSricEmails, setDeanSricEmails] = useState("");
  const [declineToCredit, setDeclineToCredit] = useState(true);
  const [autoReadMailbox, setAutoReadMailbox] = useState(true);
  const [cashbookSenders, setCashbookSenders] = useState("");
  const [overdueDays, setOverdueDays] = useState("15");

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
          setProjectGrantEnabled(Boolean(res.data.project_grant_recharge_enabled));
          setRecipientEmails(res.data.recipient_emails ?? "");
          setBillSectionEmails(res.data.bill_section_emails ?? "");
          setProjectGrantCcEmails(res.data.project_grant_cc_emails ?? "");
          setCashDepositCcEmails(res.data.cash_deposit_cc_emails ?? "");
          setGrantCode(res.data.grant_code_for_credit ?? "IIC-000-002");
          setArSricEmails(res.data.ar_sric_emails ?? "");
          setDeanSricEmails(res.data.dean_sric_emails ?? "");
          setDeclineToCredit(res.data.decline_converts_to_credit ?? true);
          setAutoReadMailbox(res.data.auto_read_cashbook_mailbox ?? true);
          setCashbookSenders(res.data.cashbook_sender_emails ?? "");
          setOverdueDays(String(res.data.fund_receipt_overdue_days ?? 15));
        }
      })
      .catch(() => toast.error("Failed to load SRIC office settings."))
      .finally(() => setLoading(false));
  }, [canAccess]);

  const handleSave = async () => {
    setSaving(true);
    const payload: Partial<WalletSricSettingsData> = isAdmin
      ? {
          project_grant_recharge_enabled: projectGrantEnabled,
          recipient_emails: recipientEmails,
          bill_section_emails: billSectionEmails,
          project_grant_cc_emails: projectGrantCcEmails,
          cash_deposit_cc_emails: cashDepositCcEmails,
          grant_code_for_credit: grantCode.trim(),
          ar_sric_emails: arSricEmails,
          dean_sric_emails: deanSricEmails,
          decline_converts_to_credit: declineToCredit,
          auto_read_cashbook_mailbox: autoReadMailbox,
          cashbook_sender_emails: cashbookSenders,
          fund_receipt_overdue_days: Math.min(365, Math.max(1, Math.round(Number(overdueDays) || 15))),
        }
      : { bill_section_emails: billSectionEmails, cash_deposit_cc_emails: cashDepositCcEmails };
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
    toast.success(isAdmin ? "Wallet recharge routing emails updated." : "Cash / bank transfer emails updated.");
  };

  if (!canAccess && !authLoading) return null;

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-5 max-w-2xl">
        <div className="mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate(backPath)} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {isDeptAdmin && !isAdmin ? "Back to Department Administration" : "Back to User Management"}
          </Button>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Mail className="h-8 w-8 text-primary" />
            {isAdmin ? "Wallet Recharge Routing Emails" : "SRIC Bill Section Email Settings"}
          </h1>
          <p className="text-muted-foreground mt-1">
            Enter one address per line, or separate them with commas or semicolons. Approval emails (with Approve and
            Decline buttons) go only to the approver list of each mode.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {isAdmin ? (
              <Card>
                <CardHeader>
                  <CardTitle>Recharge via Project Grant</CardTitle>
                  <CardDescription>
                    Emailed to the SRIC Office with the grant to be credited and the project grant code to be debited.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="project-grant-enabled">Allow wallet recharge requests via Project Grant</Label>
                      <p className="text-sm text-muted-foreground">
                        When off, faculty cannot raise new Project Grant recharge requests or send unsent ones to the
                        SRIC Office. Direct Cash Deposit / Bank Transfer is unaffected.
                      </p>
                    </div>
                    <Switch
                      id="project-grant-enabled"
                      checked={projectGrantEnabled}
                      onCheckedChange={setProjectGrantEnabled}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sric-emails">Approvers: SRIC Office email addresses</Label>
                    <Textarea
                      id="sric-emails"
                      value={recipientEmails}
                      onChange={(e) => setRecipientEmails(e.target.value)}
                      rows={4}
                      placeholder="sric.office@iitr.ac.in"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="project-grant-cc">CC email addresses</Label>
                    <Textarea
                      id="project-grant-cc"
                      value={projectGrantCcEmails}
                      onChange={(e) => setProjectGrantCcEmails(e.target.value)}
                      rows={3}
                      placeholder={"accounts@iitr.ac.in\ndept.office@iitr.ac.in"}
                    />
                    <p className="text-sm text-muted-foreground">{CC_HELP}</p>
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
                      Used as the grant to be credited only when the selected internal department has no grant code of
                      its own.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {isAdmin ? (
              <Card>
                <CardHeader>
                  <CardTitle>SRIC officers and automation</CardTitle>
                  <CardDescription>
                    AR SRIC and Dean SRIC receive a copy (without Approve / Decline links) of each request and of its
                    final decision.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="ar-sric-emails">AR SRIC email addresses (both modes)</Label>
                    <Textarea
                      id="ar-sric-emails"
                      value={arSricEmails}
                      onChange={(e) => setArSricEmails(e.target.value)}
                      rows={2}
                      placeholder="ar.sric@iitr.ac.in"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dean-sric-emails">Dean SRIC email addresses (Project Grant)</Label>
                    <Textarea
                      id="dean-sric-emails"
                      value={deanSricEmails}
                      onChange={(e) => setDeanSricEmails(e.target.value)}
                      rows={2}
                      placeholder="dean.sric@iitr.ac.in"
                    />
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="decline-to-credit">Treat SRIC-declined Project Grant requests as credit</Label>
                      <p className="text-sm text-muted-foreground">
                        When SRIC declines (Wrong Project Code, Insufficient Funds in the Project, or Other), the request
                        is cancelled and the amount becomes an auto-approved credit, recovered from the faculty
                        member&apos;s next approved recharge for the same department. If a credit is already running,
                        no new credit is given, and an SRIC approval credits the wallet only when the cash-book
                        confirms the funds.
                      </p>
                    </div>
                    <Switch id="decline-to-credit" checked={declineToCredit} onCheckedChange={setDeclineToCredit} />
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="auto-read-mailbox">Read the SRIC cash-book mailbox automatically</Label>
                      <p className="text-sm text-muted-foreground">
                        Every 30 minutes, new cash-book emails from the senders below are read and matching recharge
                        requests are marked as fund-received. Rows quoting the IIC transaction number (IIC-TXN-…) in
                        Payment Details are matched exactly.
                      </p>
                    </div>
                    <Switch id="auto-read-mailbox" checked={autoReadMailbox} onCheckedChange={setAutoReadMailbox} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cashbook-senders">Cash-book sender addresses</Label>
                    <Textarea
                      id="cashbook-senders"
                      value={cashbookSenders}
                      onChange={(e) => setCashbookSenders(e.target.value)}
                      rows={2}
                      placeholder="bills@sric.iitr.ac.in"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="overdue-days">Dashboard follow-up after (days)</Label>
                    <Input
                      id="overdue-days"
                      type="number"
                      min={1}
                      max={365}
                      value={overdueDays}
                      onChange={(e) => setOverdueDays(e.target.value)}
                      className="max-w-[8rem]"
                    />
                    <p className="text-sm text-muted-foreground">
                      Requests with no matching SRIC cash-book entry after this many days are shown to the Main
                      Administrator and the Account In-charge every time they open the dashboard.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle>Direct Cash Deposit / Bank Transfer</CardTitle>
                <CardDescription>
                  Emailed to the SRIC Bill Section. The copy to the requester includes the deposit next steps.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="bill-section-emails">Approvers: SRIC Bill Section email addresses</Label>
                  <Textarea
                    id="bill-section-emails"
                    value={billSectionEmails}
                    onChange={(e) => setBillSectionEmails(e.target.value)}
                    rows={4}
                    placeholder="bills@sric.iitr.ac.in"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cash-deposit-cc">CC email addresses</Label>
                  <Textarea
                    id="cash-deposit-cc"
                    value={cashDepositCcEmails}
                    onChange={(e) => setCashDepositCcEmails(e.target.value)}
                    rows={3}
                    placeholder={"accounts@iitr.ac.in\ndept.office@iitr.ac.in"}
                  />
                  <p className="text-sm text-muted-foreground">{CC_HELP}</p>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save
              </Button>
              <Button variant="outline" onClick={() => navigate(backPath)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

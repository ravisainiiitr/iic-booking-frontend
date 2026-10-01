import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Banknote, Building2, CreditCard, Globe, Landmark, Loader2, Repeat, Wallet } from "lucide-react";
import { toast } from "sonner";

import { apiClient, type AdminWalletModeSettings } from "@/lib/api";
import { AWAITING_APPROVAL_TEXT } from "@/lib/walletModes";
import DashboardHeader from "@/components/DashboardHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useEmbeddedMode } from "@/contexts/EmbeddedModeContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type ToggleKey =
  | "project_grant_recharge_enabled"
  | "direct_cash_recharge_enabled"
  | "online_gateway_recharge_enabled"
  | "peer_transfer_enabled"
  | "credit_facility_enabled";

const MODES: Array<{ key: ToggleKey; title: string; description: string; icon: ReactNode }> = [
  {
    key: "project_grant_recharge_enabled",
    title: "Recharge via Project Grant",
    description: "Faculty fund a department sub-wallet from an active project. Requests go to the SRIC Office.",
    icon: <Landmark className="h-5 w-5" />,
  },
  {
    key: "direct_cash_recharge_enabled",
    title: "Direct Cash Deposit / Bank Transfer",
    description: "Users deposit cash or transfer funds at the SRIC Bill Section and share the transaction number.",
    icon: <Banknote className="h-5 w-5" />,
  },
  {
    key: "online_gateway_recharge_enabled",
    title: "Online payment gateway",
    description: "Instant sub-wallet recharge through Razorpay (card, UPI, net banking). Convenience fee applies.",
    icon: <Globe className="h-5 w-5" />,
  },
  {
    key: "peer_transfer_enabled",
    title: "Transfer within the same department",
    description: "Faculty move funds from their sub-wallet to another eligible wallet under the same department grant.",
    icon: <Repeat className="h-5 w-5" />,
  },
  {
    key: "credit_facility_enabled",
    title: "Credit Limit",
    description: "Faculty request temporary wallet credit, approved by the Main Administrator within the caps below.",
    icon: <CreditCard className="h-5 w-5" />,
  },
];

function StatusBadge({ enabled }: { enabled: boolean }) {
  return enabled ? (
    <Badge className="bg-emerald-600 hover:bg-emerald-600">Enabled</Badge>
  ) : (
    <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-400">
      Users see: {AWAITING_APPROVAL_TEXT}
    </Badge>
  );
}

export default function AdminWalletPaymentModes() {
  const navigate = useNavigate();
  const embedded = useEmbeddedMode();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const isAdmin = String(user?.user_type ?? "").toLowerCase() === "admin";

  const [settings, setSettings] = useState<AdminWalletModeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<ToggleKey | null>(null);
  const [maxAmount, setMaxAmount] = useState("");
  const [maxDays, setMaxDays] = useState("");
  const [savingCaps, setSavingCaps] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      navigate("/auth");
      return;
    }
    if (!isAdmin) {
      toast.error("Only the Main Administrator can manage wallet payment modes.");
      navigate("/dashboard");
    }
  }, [authLoading, isAuthenticated, user, isAdmin, navigate]);

  const applySettings = (data: AdminWalletModeSettings) => {
    setSettings(data);
    setMaxAmount(String(Math.round(Number(data.credit_max_amount) || 0)));
    setMaxDays(String(data.credit_max_days ?? ""));
  };

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    apiClient
      .getAdminWalletModeSettings()
      .then((res) => {
        if (res.error || !res.data) {
          toast.error(res.error || "Could not load wallet payment modes.");
          return;
        }
        applySettings(res.data);
      })
      .finally(() => setLoading(false));
  }, [isAdmin]);

  const toggle = async (key: ToggleKey, value: boolean) => {
    if (!settings || savingKey) return;
    const previous = settings;
    setSettings({ ...settings, [key]: value });
    setSavingKey(key);
    const res = await apiClient.updateAdminWalletModeSettings({ [key]: value });
    setSavingKey(null);
    if (res.error || !res.data) {
      setSettings(previous);
      toast.error(res.error || "Could not update the setting.");
      return;
    }
    applySettings(res.data);
    const mode = MODES.find((m) => m.key === key)?.title ?? "Mode";
    toast.success(`${mode} ${value ? "enabled" : "disabled"}.`);
  };

  const amountNum = Number(maxAmount);
  const daysNum = Number(maxDays);
  const capsError =
    !maxAmount || !Number.isFinite(amountNum) || amountNum < 1
      ? "Enter a maximum credit amount of at least ₹1."
      : !maxDays || !Number.isInteger(daysNum) || daysNum < 1 || daysNum > 3650
        ? "Enter a maximum credit period between 1 and 3650 days."
        : null;
  const capsDirty =
    settings != null &&
    (Math.round(Number(settings.credit_max_amount)) !== Math.round(amountNum) || settings.credit_max_days !== daysNum);

  const saveCaps = async () => {
    if (capsError || savingCaps) return;
    setSavingCaps(true);
    const res = await apiClient.updateAdminWalletModeSettings({
      credit_max_amount: amountNum.toFixed(2),
      credit_max_days: daysNum,
    });
    setSavingCaps(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not save the credit caps.");
      return;
    }
    applySettings(res.data);
    toast.success("Credit limit caps saved.");
  };

  if (!isAdmin && !authLoading) return null;

  const content = loading || !settings ? (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  ) : (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            Funding and transfer options
          </CardTitle>
          <CardDescription>
            Changes apply immediately. While an option is off, users see it greyed out with “{AWAITING_APPROVAL_TEXT}”
            and the server rejects new requests for it. Requests already submitted are not affected.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y p-0">
          {MODES.map((m) => {
            const enabled = Boolean(settings[m.key]);
            const envBlocked = m.key === "credit_facility_enabled" && !settings.credit_facility_available_in_environment;
            return (
              <div key={m.key} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {m.icon}
                  </span>
                  <div className="min-w-0 space-y-1">
                    <Label htmlFor={`mode-${m.key}`} className="text-sm font-semibold">
                      {m.title}
                    </Label>
                    <p className="text-sm text-muted-foreground">{m.description}</p>
                    <StatusBadge enabled={enabled && !envBlocked} />
                    {envBlocked ? (
                      <p className="text-xs text-destructive">
                        The credit facility is switched off in the server configuration, so users still see “
                        {AWAITING_APPROVAL_TEXT}” even when this is on.
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-start">
                  {savingKey === m.key ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                  <Switch
                    id={`mode-${m.key}`}
                    checked={enabled}
                    disabled={savingKey != null}
                    onCheckedChange={(v) => void toggle(m.key, v)}
                    aria-label={`${enabled ? "Disable" : "Enable"} ${m.title}`}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            Credit Limit caps
          </CardTitle>
          <CardDescription>
            Users cannot request more than the maximum amount, and an approved credit must be repaid within the maximum
            number of days.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="credit-max-amount">Maximum credit amount (₹)</Label>
              <Input
                id="credit-max-amount"
                inputMode="numeric"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value.replace(/[^\d]/g, ""))}
                className="tabular-nums"
                disabled={savingCaps}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="credit-max-days">Maximum credit period (days)</Label>
              <Input
                id="credit-max-days"
                inputMode="numeric"
                value={maxDays}
                onChange={(e) => setMaxDays(e.target.value.replace(/[^\d]/g, ""))}
                className="tabular-nums"
                disabled={savingCaps}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Credit is offered only for departments with wallet credit enabled in Department settings.
            </p>
            <Button onClick={() => void saveCaps()} disabled={Boolean(capsError) || !capsDirty || savingCaps}>
              {savingCaps ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save caps
            </Button>
          </div>
          {capsError && capsDirty ? <p className="text-xs text-destructive">{capsError}</p> : null}
        </CardContent>
      </Card>
    </div>
  );

  if (embedded) return <div className="mx-auto max-w-3xl">{content}</div>;

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto max-w-3xl px-4 py-5">
        <div className="mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/user-management")} className="mb-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to User Management
          </Button>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <Wallet className="h-8 w-8 text-primary" />
            Wallet Payment Modes
          </h1>
          <p className="mt-1 text-muted-foreground">
            Turn wallet recharge, transfer and credit options on or off for all users.
          </p>
        </div>
        {content}
      </main>
    </div>
  );
}

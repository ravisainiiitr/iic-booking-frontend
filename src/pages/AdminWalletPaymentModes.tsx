import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CreditCard, HandCoins, Loader2, Mail, SlidersHorizontal, Wallet } from "lucide-react";
import { toast } from "sonner";

import { heroButtonClass, PageHero, PageShell, StandaloneOnly } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CreditCapsTab from "@/components/walletModes/CreditCapsTab";
import DirectRechargeTab from "@/components/walletModes/DirectRechargeTab";
import EmailRecipientsTab from "@/components/walletModes/EmailRecipientsTab";
import PaymentOptionsTab from "@/components/walletModes/PaymentOptionsTab";
import { OPTION_ORDER, OPTION_SHORT_LABEL, StatusChip } from "@/components/walletModes/shared";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient, type AdminWalletModeSettings, type WalletPaymentModesOverview } from "@/lib/api";
import { cn } from "@/lib/utils";

const TABS = [
  { value: "options", label: "Payment options", icon: SlidersHorizontal },
  { value: "recipients", label: "Email recipients", icon: Mail },
  { value: "direct", label: "Direct wallet recharge", icon: HandCoins },
  { value: "caps", label: "Credit limit caps", icon: CreditCard },
] as const;
type TabValue = (typeof TABS)[number]["value"];

const UNSAVED_PROMPT = "You have unsaved changes on this tab. Leave without saving?";

export default function AdminWalletPaymentModes() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const isAdmin = String(user?.user_type ?? "").toLowerCase() === "admin";

  const [settings, setSettings] = useState<AdminWalletModeSettings | null>(null);
  const [overview, setOverview] = useState<WalletPaymentModesOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [dirtyTabs, setDirtyTabs] = useState<Record<TabValue, boolean>>({
    options: false,
    recipients: false,
    direct: false,
    caps: false,
  });

  const requestedTab = searchParams.get("tab");
  const tab: TabValue = TABS.some((t) => t.value === requestedTab) ? (requestedTab as TabValue) : "options";
  const anyDirty = Object.values(dirtyTabs).some(Boolean);

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

  const loadOverview = useCallback(async () => {
    const res = await apiClient.getWalletPaymentModesOverview();
    if (res.error || !res.data) {
      toast.error(res.error || "Could not load the department settings.");
      return;
    }
    setOverview(res.data);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    Promise.all([apiClient.getAdminWalletModeSettings(), apiClient.getWalletPaymentModesOverview()])
      .then(([s, o]) => {
        if (s.error || !s.data) toast.error(s.error || "Could not load wallet payment modes.");
        else setSettings(s.data);
        if (o.error || !o.data) toast.error(o.error || "Could not load the department settings.");
        else setOverview(o.data);
      })
      .finally(() => setLoading(false));
  }, [isAdmin]);

  useEffect(() => {
    if (!anyDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [anyDirty]);

  const dirtySetters = useMemo(() => {
    const make = (key: TabValue) => (dirty: boolean) =>
      setDirtyTabs((prev) => (prev[key] === dirty ? prev : { ...prev, [key]: dirty }));
    return { options: make("options"), recipients: make("recipients"), direct: make("direct"), caps: make("caps") };
  }, []);

  const onSettingsSaved = useCallback(
    (data: AdminWalletModeSettings) => {
      setSettings(data);
      void loadOverview();
    },
    [loadOverview]
  );

  const changeTab = (next: string) => {
    if (next === tab) return;
    if (dirtyTabs[tab] && !window.confirm(UNSAVED_PROMPT)) return;
    setDirtyTabs((prev) => ({ ...prev, [tab]: false }));
    const params = new URLSearchParams(searchParams);
    params.set("tab", next);
    setSearchParams(params, { replace: true });
  };

  const goBack = () => {
    if (anyDirty && !window.confirm(UNSAVED_PROMPT)) return;
    navigate("/user-management");
  };

  if (!isAdmin && !authLoading) return null;

  const masters = overview?.masters;

  return (
    <PageShell>
      <main className="container mx-auto max-w-6xl space-y-4 px-3 py-4 sm:px-4 sm:py-5">
        <StandaloneOnly>
          <PageHero
            compact
            title="Wallet Payment Modes"
            description="Control how users fund, transfer and borrow wallet money — overall and per department — and who is emailed."
            icon={<Wallet className="h-5 w-5" />}
            actions={
              <Button variant="outline" size="sm" className={heroButtonClass.secondary} onClick={goBack}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            }
          />
        </StandaloneOnly>

        {masters ? (
          <div className="flex flex-wrap items-center gap-1.5" aria-label="Current master switches">
            {OPTION_ORDER.map((o) => (
              <StatusChip key={o} tone={masters[o] ? "on" : "off"}>
                {OPTION_SHORT_LABEL[o]}: {masters[o] ? "On" : "Off"}
              </StatusChip>
            ))}
          </div>
        ) : null}

        {loading || !settings || !overview ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs value={tab} onValueChange={changeTab} className="space-y-4">
            <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
              <TabsList className="h-auto w-max min-w-full justify-start gap-1 p-1 sm:w-auto sm:min-w-0">
                {TABS.map(({ value, label, icon: Icon }) => (
                  <TabsTrigger key={value} value={value} className="gap-2 px-3 py-1.5">
                    <Icon className="h-4 w-4" />
                    {label}
                    {dirtyTabs[value] ? (
                      <span className={cn("h-2 w-2 rounded-full bg-amber-500")} aria-label="Unsaved changes" />
                    ) : null}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            <TabsContent value="options" className="mt-0">
              <PaymentOptionsTab
                overview={overview}
                settings={settings}
                onSettingsSaved={setSettings}
                onReload={loadOverview}
                onDirtyChange={dirtySetters.options}
              />
            </TabsContent>
            <TabsContent value="recipients" className="mt-0">
              <EmailRecipientsTab overview={overview} onReload={loadOverview} onDirtyChange={dirtySetters.recipients} />
            </TabsContent>
            <TabsContent value="direct" className="mt-0">
              <DirectRechargeTab
                overview={overview}
                settings={settings}
                onSettingsSaved={onSettingsSaved}
                onDirtyChange={dirtySetters.direct}
              />
            </TabsContent>
            <TabsContent value="caps" className="mt-0">
              <CreditCapsTab settings={settings} onSettingsSaved={setSettings} onDirtyChange={dirtySetters.caps} />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </PageShell>
  );
}

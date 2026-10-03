import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, HandCoins, Loader2 } from "lucide-react";

import { heroButtonClass, PageHero, PageShell, StandaloneOnly } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import DirectRechargeForm from "@/components/walletModes/DirectRechargeForm";
import DirectRechargeHistory from "@/components/walletModes/DirectRechargeHistory";
import { formatDateTime, formatInr, StatusChip } from "@/components/walletModes/shared";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient, type WalletDirectRechargeAccess } from "@/lib/api";
import { AWAITING_APPROVAL_TEXT } from "@/lib/walletModes";

/** Direct wallet recharge for the Main Administrator and designated persons. */
export default function WalletDirectRecharge() {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [access, setAccess] = useState<WalletDirectRechargeAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [historyKey, setHistoryKey] = useState(0);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate("/auth");
  }, [authLoading, isAuthenticated, navigate]);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiClient.getWalletDirectRechargeAccess();
    setLoading(false);
    if (!res.error && res.data) setAccess(res.data);
  }, []);

  useEffect(() => {
    if (isAuthenticated) void load();
  }, [isAuthenticated, load]);

  return (
    <PageShell>
      <main className="container mx-auto max-w-5xl space-y-4 px-3 py-4 sm:px-4 sm:py-5">
        <StandaloneOnly>
          <PageHero
            compact
            title="Direct wallet recharge"
            description="Add funds received outside the portal straight to a user’s department sub-wallet."
            icon={<HandCoins className="h-5 w-5" />}
            actions={
              <Button variant="outline" size="sm" className={heroButtonClass.secondary} onClick={() => navigate("/wallet")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            }
          />
        </StandaloneOnly>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !access?.allowed ? (
          <Card>
            <CardContent className="space-y-2 py-8 text-center">
              <StatusChip tone="warn">{AWAITING_APPROVAL_TEXT}</StatusChip>
              <p className="text-sm text-muted-foreground">
                {access && !access.enabled_globally
                  ? "Direct wallet recharge is not open at the moment."
                  : "Only the Main Administrator or a person designated by them can recharge wallets directly. Your permission may have expired."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {!access.is_main_admin && access.grants.length ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                <StatusChip tone="on">Designated person</StatusChip>
                {access.grants.map((g) => (
                  <span key={g.id} className="text-muted-foreground">
                    {g.department_name ?? "All departments"} · until {formatDateTime(g.valid_until)}
                    {g.max_amount_per_transaction ? ` · up to ${formatInr(g.max_amount_per_transaction)} each` : ""}
                  </span>
                ))}
              </div>
            ) : null}
            <DirectRechargeForm access={access} onRecharged={() => setHistoryKey((k) => k + 1)} />
            <DirectRechargeHistory
              isAdmin={access.is_main_admin}
              departments={access.departments ?? []}
              modes={access.modes}
              refreshKey={historyKey}
            />
          </>
        )}
      </main>
    </PageShell>
  );
}

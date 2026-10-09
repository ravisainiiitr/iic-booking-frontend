import { useNavigate } from "react-router-dom";
import { ArrowLeft, FolderKanban } from "lucide-react";

import DashboardHeader from "@/components/DashboardHeader";
import { StandaloneOnly } from "@/components/PageShell";
import SricRechargePanel from "@/components/wallet/SricRechargePanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function WalletSricRecharge() {
  const navigate = useNavigate();
  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto max-w-3xl px-4 py-5">
        <StandaloneOnly>
          <Button variant="ghost" size="sm" className="mb-3" onClick={() => navigate("/wallet")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Wallet
          </Button>
        </StandaloneOnly>
        <h1 className="mb-1 flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <FolderKanban className="h-6 w-6 text-primary" />
          Recharge from a project
        </h1>
        <p className="mb-5 text-sm text-muted-foreground">
          Project funds now reach your wallet through the SRIC portal. Direct Cash Deposit / Bank Transfer and online
          payment are still available from <span className="font-medium text-foreground">Recharge Wallet</span> on the
          Wallet page.
        </p>
        <Card>
          <CardContent className="p-5 sm:p-6">
            <SricRechargePanel />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

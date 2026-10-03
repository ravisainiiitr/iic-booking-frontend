import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HandCoins } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";

import { formatDateTime } from "./shared";

/** Shown only to people who may recharge wallets directly right now. */
export default function DirectRechargeEntry() {
  const navigate = useNavigate();
  const [state, setState] = useState<{ allowed: boolean; until: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient.getWalletDirectRechargeAccess().then((res) => {
      if (cancelled || res.error || !res.data) return;
      const until = res.data.grants.map((g) => g.valid_until).sort().pop() ?? null;
      setState({ allowed: res.data.allowed, until: res.data.is_main_admin ? null : until });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!state?.allowed) return null;
  return (
    <div className="mb-5 flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary dark:text-sky-200">
          <HandCoins className="h-4 w-4" />
        </span>
        <div className="text-sm">
          <p className="font-medium text-foreground">You can recharge wallets directly</p>
          <p className="text-muted-foreground">
            {state.until ? `Your permission is valid until ${formatDateTime(state.until)}.` : "As Main Administrator."}
          </p>
        </div>
      </div>
      <Button onClick={() => navigate("/wallet/direct-recharge")} className="sm:shrink-0">
        Direct wallet recharge
      </Button>
    </div>
  );
}

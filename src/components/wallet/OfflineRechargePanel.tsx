import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Landmark, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import OfflineRechargeDialog from "@/components/wallet/OfflineRechargeDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api";
import { STATE_TONE, formatRupees, type OfflineRecharge } from "@/lib/offlineRecharge";

type Props = { onCredited?: () => void };

export function OfflineRechargeStateBadge({ request }: { request: Pick<OfflineRecharge, "state" | "state_label"> }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATE_TONE[request.state]}`}
      data-testid={`orc-state-${request.state}`}
    >
      {request.state_label}
    </span>
  );
}

/** External users: offline payment recharges on the Wallet page (submit, follow the state, cancel while pending). */
export default function OfflineRechargePanel({ onCredited }: Props) {
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(false);
  const [maxMb, setMaxMb] = useState(10);
  const [rows, setRows] = useState<OfflineRecharge[]>([]);
  const [open, setOpen] = useState(false);
  const [cancelling, setCancelling] = useState<number | null>(null);

  const load = useCallback(async () => {
    const res = await apiClient.getOfflineRecharges();
    setLoading(false);
    if (res.error || !res.data) return;
    setAvailable(res.data.available);
    setMaxMb(res.data.max_receipt_mb || 10);
    setRows(res.data.requests);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return null;
  if (!available && rows.length === 0) return null;

  const cancel = async (row: OfflineRecharge) => {
    setCancelling(row.id);
    const res = await apiClient.cancelOfflineRecharge(row.id);
    setCancelling(null);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not cancel the request.");
      return;
    }
    toast.success(res.data.message);
    void load();
  };

  return (
    <Card className="mb-5 rounded-lg border-border shadow-sm" data-testid="offline-recharge-panel">
      <CardHeader className="flex flex-col gap-3 space-y-0 pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Landmark className="h-4 w-4 text-muted-foreground" />
            Offline payments
          </CardTitle>
          <CardDescription className="mt-1 text-xs">
            Paid by bank transfer, UPI, demand draft or cheque? Send the details and receipt; the wallet is credited on
            approval.
          </CardDescription>
        </div>
        {available ? (
          <Button size="sm" onClick={() => setOpen(true)} data-testid="orc-open">
            <Plus className="mr-1 h-4 w-4" />
            Record an offline payment
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No offline payments recorded yet.</p>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="flex flex-col gap-2 rounded-md border border-border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              data-testid="orc-row"
            >
              <div className="min-w-0 space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium tabular-nums">{formatRupees(row.approved_amount ?? row.claimed_amount)}</span>
                  <OfflineRechargeStateBadge request={row} />
                  <span className="text-xs text-muted-foreground">{row.reference}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {row.payment_mode_label} · {row.transaction_reference} · paid {row.payment_date} · {row.department.name}
                </p>
                {row.state === "rejected" && row.decision_note ? (
                  <p className="text-xs text-destructive">Reason: {row.decision_note}</p>
                ) : null}
                {row.approved_amount && row.approved_amount !== row.claimed_amount ? (
                  <p className="text-xs text-muted-foreground">
                    Approved {formatRupees(row.approved_amount)} of {formatRupees(row.claimed_amount)} declared.
                  </p>
                ) : null}
                {row.state === "mismatch" && row.reconciliation_note ? (
                  <p className="text-xs text-orange-700 dark:text-orange-300">Accounts: {row.reconciliation_note}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-2">
                {row.receipt_url ? (
                  <Button asChild size="sm" variant="outline">
                    <a href={row.receipt_url} target="_blank" rel="noopener noreferrer">
                      Receipt <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                  </Button>
                ) : null}
                {row.can_cancel ? (
                  <Button size="sm" variant="ghost" disabled={cancelling === row.id} onClick={() => void cancel(row)}>
                    {cancelling === row.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                    Cancel
                  </Button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </CardContent>
      <OfflineRechargeDialog
        open={open}
        onOpenChange={setOpen}
        maxReceiptMb={maxMb}
        onSubmitted={() => {
          void load();
          onCredited?.();
        }}
      />
    </Card>
  );
}

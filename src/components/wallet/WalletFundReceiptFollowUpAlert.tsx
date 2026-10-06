import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { apiClient, type OverdueFundReceiptRow } from "@/lib/api";
import { formatMoney } from "@/lib/walletRecharge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const OVERDUE_RECHARGE_REQUESTS_PATH = "/admin-settings/wallet-recharge-requests?overdue=1";

const MAX_ROWS_IN_DIALOG = 8;

function stageLabel(row: OverdueFundReceiptRow): string {
  if (row.status === "PENDING") return "Awaiting SRIC action";
  return row.wallet_credit_pending ? "Approved · wallet not yet credited" : "Approved by SRIC";
}

/**
 * Main Administrator / Account In-charge: every dashboard visit lists recharge requests that still have
 * no matching SRIC cash-book entry after the configured follow-up period.
 */
export default function WalletFundReceiptFollowUpAlert({ onReview }: { onReview: (path: string) => void }) {
  const [rows, setRows] = useState<OverdueFundReceiptRow[]>([]);
  const [count, setCount] = useState(0);
  const [days, setDays] = useState(15);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiClient.adminWalletRechargeOverdueFundReceipts().then((res) => {
      if (cancelled || res.error || !res.data) return;
      setRows(res.data.results || []);
      setCount(res.data.count || 0);
      setDays(res.data.days || 15);
      if ((res.data.count || 0) > 0) setOpen(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (count === 0) return null;

  const review = () => {
    setOpen(false);
    onReview(OVERDUE_RECHARGE_REQUESTS_PATH);
  };
  const summary = `${count} wallet recharge request${count === 1 ? " has" : "s have"} no matching SRIC cash-book entry after ${days} days.`;

  return (
    <>
      <div
        className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
        data-testid="overdue-fund-receipt-banner"
      >
        <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
        <span className="font-medium">{summary}</span>
        <span className="text-amber-800/80 dark:text-amber-200/80">Follow up with the SRIC Office.</span>
        <Button size="sm" variant="outline" className="ml-auto" onClick={review}>
          Review requests
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl" data-testid="overdue-fund-receipt-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden />
              Wallet recharges awaiting SRIC confirmation
            </DialogTitle>
            <DialogDescription>
              {summary} Please confirm the transfer with the SRIC Office, then match the cash-book receipt or verify
              the fund receipt.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50dvh] overflow-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Transaction</th>
                  <th className="px-3 py-2 font-medium">Faculty / Department</th>
                  <th className="px-3 py-2 font-medium text-right">Amount</th>
                  <th className="px-3 py-2 font-medium">Stage</th>
                  <th className="px-3 py-2 font-medium text-right">Days</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, MAX_ROWS_IN_DIALOG).map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-3 py-2 font-medium whitespace-nowrap">{row.transaction_number}</td>
                    <td className="px-3 py-2">
                      <div>{row.user_name}</div>
                      <div className="text-xs text-muted-foreground">{row.department_name || "—"}</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{formatMoney(row.amount)}</td>
                    <td className="px-3 py-2 text-xs">{stageLabel(row)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.days_waiting ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {count > MAX_ROWS_IN_DIALOG ? (
            <p className="text-xs text-muted-foreground">
              and {count - MAX_ROWS_IN_DIALOG} more. Open the list to see all of them.
            </p>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Remind me next time
            </Button>
            <Button onClick={review}>Review requests</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

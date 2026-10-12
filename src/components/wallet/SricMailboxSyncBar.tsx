import { useCallback, useEffect, useState } from "react";
import { Loader2, MailCheck, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/components/walletModes/shared";
import { apiClient, type SricMailboxRefreshResult, type SricMailboxStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

const STATUS_POLL_MS = 30_000;

export function formatCountdown(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  if (seconds <= 0) return "due now";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m ? `${m} min ${String(s).padStart(2, "0")} s` : `${s} s`;
}

export function resultLine(result: SricMailboxRefreshResult | null | undefined): string {
  if (!result) return "";
  const t = result.totals;
  return `${t.new_emails} new email(s) · ${t.rows_parsed} row(s) read · ${t.matched} matched · ${t.unmatched} not matched`;
}

type Props = {
  /** Called after a Refresh read the mailbox, so the page can reload its lists. */
  onRefreshed?: () => void;
  className?: string;
};

/**
 * Main Administrator / Accounts In-charge: SRIC mailbox (Wallet_Recharge.csv + cash-book) — last check, next automatic
 * check, and a Refresh button that reads both now (short cooldown; the server skips it if a check is running).
 */
export default function SricMailboxSyncBar({ onRefreshed, className }: Props) {
  const [status, setStatus] = useState<SricMailboxStatus | null>(null);
  const [nextIn, setNextIn] = useState<number | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [result, setResult] = useState<SricMailboxRefreshResult | null>(null);

  const apply = useCallback((s: SricMailboxStatus) => {
    setStatus(s);
    setNextIn(s.next_check_in_seconds);
    setCooldown(s.cooldown_remaining);
  }, []);

  const loadStatus = useCallback(async () => {
    const res = await apiClient.getSricMailboxStatus();
    if (!res.error && res.data) apply(res.data);
  }, [apply]);

  useEffect(() => {
    void loadStatus();
    const id = window.setInterval(() => void loadStatus(), STATUS_POLL_MS);
    return () => window.clearInterval(id);
  }, [loadStatus]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setNextIn((n) => (n == null ? n : Math.max(0, n - 1)));
      setCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    const res = await apiClient.refreshSricMailbox();
    setRefreshing(false);
    if (res.error || !res.data) {
      if (res.status === 429) toast.message(res.error || "Checked moments ago. Please wait a little.");
      else toast.error(res.error || "Could not check the mailbox.");
      void loadStatus();
      return;
    }
    setResult(res.data.result);
    apply(res.data.status);
    const t = res.data.result.totals;
    if (t.unmatched) toast.warning(res.data.result.message);
    else toast.success(res.data.result.message);
    onRefreshed?.();
  };

  const shown = result ?? status?.last_refresh ?? null;
  const busy = refreshing || Boolean(status?.running);
  const disabled = busy || cooldown > 0;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
      data-testid="sric-mailbox-sync-bar"
    >
      <div className="flex min-w-0 items-start gap-2">
        <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 space-y-0.5">
          <p className="text-foreground" data-testid="sric-mailbox-last-checked">
            SRIC mailbox · Last checked at {status?.last_checked_at ? formatDateTime(status.last_checked_at) : "—"}
            {" · "}
            {busy ? "checking now…" : `next automatic check in ${formatCountdown(nextIn)}`}
          </p>
          <p className="text-xs text-muted-foreground">
            Read automatically every {Math.round((status?.poll_seconds ?? 300) / 60)} min (Wallet_Recharge.csv and cash-book emails).
            {shown ? ` Last Refresh: ${resultLine(shown)}.` : ""}
          </p>
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => void refresh()}
        disabled={disabled}
        data-testid="sric-mailbox-refresh"
        title={cooldown > 0 ? `Available in ${cooldown} s` : "Read the SRIC emails now"}
      >
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
        {cooldown > 0 && !busy ? `Refresh (${cooldown}s)` : "Refresh"}
      </Button>
    </div>
  );
}

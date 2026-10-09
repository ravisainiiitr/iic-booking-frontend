import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Info, Loader2, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/components/walletModes/shared";
import { apiClient, type SricMyRechargesResponse, type SricRechargeRow, type SricRechargeStatus } from "@/lib/api";
import { formatMoney } from "@/lib/walletRecharge";
import { cn } from "@/lib/utils";

export const SRIC_PORTAL_URL = "https://rnd.iitr.ac.in";

const STATUS_TONE: Record<SricRechargeStatus, string> = {
  credited: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  awaiting_credit: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  needs_review: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  duplicate: "border-muted-foreground/30 bg-muted text-muted-foreground",
  failed: "border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-950/40 dark:text-red-300",
  rejected: "border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-950/40 dark:text-red-300",
};

const FACULTY_STATUS_LABEL: Record<SricRechargeStatus, string> = {
  credited: "Credited",
  awaiting_credit: "Being checked",
  needs_review: "Being checked",
  duplicate: "Duplicate",
  failed: "Being checked",
  rejected: "Not credited",
};

const REVERSED_TONE = "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-300";

export function SricStatusBadge({ status, label, reversed = false }: { status: SricRechargeStatus; label?: string; reversed?: boolean }) {
  return (
    <Badge variant="outline" className={cn("whitespace-nowrap font-medium", reversed ? REVERSED_TONE : STATUS_TONE[status])}>
      {reversed ? "Reversed" : (label ?? FACULTY_STATUS_LABEL[status])}
    </Badge>
  );
}

export function SricTestBadge() {
  return (
    <Badge
      variant="outline"
      className="whitespace-nowrap border-violet-300 bg-violet-50 font-semibold text-violet-800 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
      title="Entry from a test run; not counted in totals or exports"
    >
      TEST
    </Badge>
  );
}

function waitSeconds(message: string | undefined): number {
  const m = /(\d+)\s*seconds?/i.exec(message || "");
  return m ? Math.min(600, Number(m[1])) : 60;
}

type RefreshResult = { tone: "success" | "info" | "error"; text: string };

export type SricRechargePanelProps = {
  /** Called after a refresh credits at least one recharge, so the caller can reload balances. */
  onCredited?: () => void | Promise<void>;
  /** Fewer rows and tighter spacing (inside the Recharge Wallet dialog). */
  compact?: boolean;
};

/** "How to recharge your wallet from a project": SRIC portal procedure, Refresh and recent SRIC credits. */
export default function SricRechargePanel({ onCredited, compact = false }: SricRechargePanelProps) {
  const [info, setInfo] = useState<SricMyRechargesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [result, setResult] = useState<RefreshResult | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const load = useCallback(async () => {
    const res = await apiClient.getMySricRecharges();
    if (!res.error && res.data) setInfo(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const refresh = async () => {
    if (refreshing || cooldown > 0) return;
    setRefreshing(true);
    setResult(null);
    try {
      const res = await apiClient.refreshMySricRecharges();
      if (res.error || !res.data) {
        if (res.status === 429 || res.errorCode === "RATE_LIMITED") {
          const wait = waitSeconds(res.error);
          setCooldown(wait);
          setResult({ tone: "info", text: `Please wait ${wait} seconds before refreshing again.` });
        } else {
          setResult({ tone: "error", text: res.error || "Could not check for new recharges. Please try again." });
        }
        return;
      }
      const credited = res.data.results.some((r) => r.status === "credited");
      setResult({
        tone: credited ? "success" : res.data.status === "error" ? "error" : "info",
        text: res.data.message,
      });
      setCooldown(60);
      await load();
      if (credited) await onCredited?.();
    } finally {
      setRefreshing(false);
    }
  };

  const rows: SricRechargeRow[] = (info?.results ?? []).slice(0, compact ? 5 : 20);
  const receivers = info?.receivers ?? [];
  const receiverText = receivers.length
    ? receivers.map((r) => r.label).join(" or ")
    : "IIC or Tinkering";

  return (
    <div className={cn("space-y-4", compact && "text-sm")} data-testid="sric-recharge-panel">
      <div className="rounded-lg border bg-muted/30 p-4">
        <h3 className="text-sm font-semibold text-foreground">How to recharge your wallet from a project</h3>
        <ol className="mt-2 list-inside list-decimal space-y-1.5 text-sm text-foreground/90">
          <li>
            Open the SRIC portal (<span className="font-medium">rnd.iitr.ac.in</span>) and sign in.
          </li>
          <li>
            Go to <span className="font-medium">Ledger</span> &gt; <span className="font-medium">New Wallet Recharge</span>.
          </li>
          <li>Select the project that should fund the recharge.</li>
          <li>
            Choose the <span className="font-medium">Receiver Type</span> ({receiverText}) — this decides which
            department balance is credited.
          </li>
          <li>
            Enter the amount and a remark, then press <span className="font-medium">Submit Recharge</span>.
          </li>
          <li>
            SRIC emails the recharge to this portal. We check for it every 5 minutes; press{" "}
            <span className="font-medium">Refresh</span> to check now. You get an email when your wallet is credited.
          </li>
        </ol>
        {info && !info.auto_credit_enabled ? (
          <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Each recharge is checked by the IIC office before it reaches your wallet, so the credit may take a little
            longer than the email from SRIC.
          </p>
        ) : null}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button asChild>
            <a href={info?.portal_url || SRIC_PORTAL_URL} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Open SRIC portal
            </a>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void refresh()}
            disabled={refreshing || cooldown > 0}
            data-testid="sric-refresh-button"
          >
            {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            {refreshing ? "Checking for new recharges…" : cooldown > 0 ? `Refresh (${cooldown}s)` : "Refresh"}
          </Button>
        </div>
        <div aria-live="polite" className="mt-3 min-h-[1.25rem]">
          {result ? (
            <p
              role="status"
              className={cn(
                "flex items-start gap-2 text-sm",
                result.tone === "success" && "text-emerald-700 dark:text-emerald-400",
                result.tone === "error" && "text-destructive",
                result.tone === "info" && "text-muted-foreground",
              )}
            >
              {result.tone === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : null}
              {result.text}
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground">Recent SRIC recharges</h3>
        {loading ? (
          <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        ) : rows.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No SRIC recharges yet.</p>
        ) : (
          <ul className="mt-2 divide-y rounded-lg border" data-testid="sric-recent-list">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium tabular-nums text-foreground">
                    {row.amount != null ? formatMoney(row.amount) : row.amount_raw}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {row.receiver_label || row.receiver_code}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Ledger {row.ledger_id} · FY {row.financial_year} · Project {row.project_number}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row.credited_at ? `Credited ${formatDateTime(row.credited_at)}` : `Received ${formatDateTime(row.email_date || row.created_at)}`}
                  </p>
                  {row.reversed ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      This credit was reversed by the IIC office{row.reversed_at ? ` on ${formatDateTime(row.reversed_at)}` : ""}.
                    </p>
                  ) : row.status === "rejected" ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      This recharge was not credited. Please contact the IIC office.
                    </p>
                  ) : row.status !== "credited" ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      The IIC office is checking this recharge before it is credited.
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-1">
                  {row.is_test ? <SricTestBadge /> : null}
                  <SricStatusBadge status={row.status} reversed={row.reversed} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

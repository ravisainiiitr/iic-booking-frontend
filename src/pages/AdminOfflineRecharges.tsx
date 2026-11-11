import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink, Landmark, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { heroButtonClass, PageHero, PageShell, StandaloneOnly } from "@/components/PageShell";
import { OfflineRechargeStateBadge } from "@/components/wallet/OfflineRechargePanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api";
import {
  auditActionLabel,
  formatRupees,
  todayIso,
  type OfflineRecharge,
  type OfflineRechargeQueueResponse,
} from "@/lib/offlineRecharge";

const TABS: { state: string; label: string; countKey?: keyof OfflineRechargeQueueResponse["counts"] }[] = [
  { state: "pending", label: "Pending", countKey: "pending" },
  { state: "approved", label: "Awaiting reconciliation", countKey: "approved" },
  { state: "mismatch", label: "Mismatch", countKey: "mismatch" },
  { state: "reconciled", label: "Reconciled", countKey: "reconciled" },
  { state: "rejected", label: "Rejected", countKey: "rejected" },
  { state: "all", label: "All" },
];

const ROLE_SCOPE: Record<string, string> = {
  main_admin: "You see every department.",
  dept_admin: "You see requests for your department.",
  accounts: "You see requests for your department and can reconcile them.",
};

type Action = "approve" | "reject" | "reconciled" | "mismatch";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="grid grid-cols-[9rem_minmax(0,1fr)] gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-words">{value}</span>
    </div>
  );
}

export default function AdminOfflineRecharges() {
  const navigate = useNavigate();
  const [state, setState] = useState("pending");
  const [query, setQuery] = useState("");
  const [data, setData] = useState<OfflineRechargeQueueResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<OfflineRecharge | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [creditDate, setCreditDate] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiClient.getOfflineRechargeQueue({ state, q: query.trim() || undefined });
    setLoading(false);
    if (res.error || !res.data) {
      setError(res.error || "Could not load offline payment recharges.");
      return;
    }
    setError(null);
    setData(res.data);
  }, [state, query]);

  useEffect(() => {
    void load();
  }, [load]);

  const open = async (row: OfflineRecharge) => {
    setSelected(row);
    setAction(null);
    const res = await apiClient.getOfflineRecharge(row.id);
    if (res.data) setSelected(res.data.request);
  };

  const startAction = (next: Action) => {
    setAction(next);
    setNote("");
    setAmount(selected?.claimed_amount ?? "");
    setReference("");
    setCreditDate("");
  };

  const noteRequired = action === "approve" || action === "reject" || action === "mismatch";
  const canSend =
    !busy &&
    (!noteRequired || note.trim().length > 0) &&
    (action !== "reconciled" || (reference.trim().length > 0 && creditDate.length > 0));

  const send = async () => {
    if (!selected || !action || !canSend) return;
    setBusy(true);
    const res =
      action === "approve" || action === "reject"
        ? await apiClient.decideOfflineRecharge(selected.id, action, {
            note: note.trim(),
            ...(action === "approve" && amount.trim() && amount.trim() !== selected.claimed_amount
              ? { approved_amount: amount.trim() }
              : {}),
          })
        : await apiClient.reconcileOfflineRecharge(selected.id, {
            outcome: action,
            reference: reference.trim(),
            credit_date: creditDate || undefined,
            note: note.trim(),
          });
    setBusy(false);
    if (res.error || !res.data) {
      toast.error(res.error || "The action failed.");
      return;
    }
    toast.success(res.data.message);
    setSelected(null);
    setAction(null);
    void load();
  };

  return (
    <PageShell>
      <main className="container mx-auto max-w-7xl space-y-4 px-3 py-4 sm:px-4 sm:py-5">
        <StandaloneOnly>
          <PageHero
            compact
            title="Offline Payment Recharges"
            description="External users' wallet recharges paid offline: check the receipt, approve or reject, then reconcile with the funds received."
            icon={<Landmark className="h-5 w-5" />}
            actions={
              <Button
                variant="outline"
                size="sm"
                className={heroButtonClass.secondary}
                onClick={() => navigate("/dashboard")}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            }
          />
        </StandaloneOnly>

        {data ? <p className="text-sm text-muted-foreground">{ROLE_SCOPE[data.role]}</p> : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Request state">
            {TABS.map((tab) => (
              <Button
                key={tab.state}
                role="tab"
                aria-selected={state === tab.state}
                size="sm"
                variant={state === tab.state ? "default" : "outline"}
                onClick={() => setState(tab.state)}
              >
                {tab.label}
                {tab.countKey && data ? <span className="ml-1.5 tabular-nums">({data.counts[tab.countKey]})</span> : null}
              </Button>
            ))}
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Name, email or UTR"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search offline payment recharges"
            />
          </div>
        </div>

        {error ? (
          <Card>
            <CardContent className="py-6 text-sm text-destructive">{error}</CardContent>
          </Card>
        ) : loading && !data ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : data && data.requests.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">Nothing here.</CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {data?.requests.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => void open(row)}
                className="flex w-full flex-col gap-1 rounded-lg border border-border bg-card p-3 text-left text-sm transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                data-testid="orc-queue-row"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{row.user.name || row.user.email}</span>
                    <OfflineRechargeStateBadge request={row} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {row.reference} · {row.payment_mode_label} {row.transaction_reference} · paid {row.payment_date} ·{" "}
                    {row.department.name}
                  </p>
                </div>
                <span className="shrink-0 font-medium tabular-nums">
                  {formatRupees(row.approved_amount ?? row.claimed_amount)}
                </span>
              </button>
            ))}
          </div>
        )}
      </main>

      <Dialog open={Boolean(selected)} onOpenChange={(next) => !next && !busy && setSelected(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  {selected.reference} <OfflineRechargeStateBadge request={selected} />
                </DialogTitle>
                <DialogDescription>
                  {selected.user.name} · {selected.user.email}
                  {selected.user.organisation ? ` · ${selected.user.organisation}` : ""}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-1.5">
                <Row label="Amount declared" value={formatRupees(selected.claimed_amount)} />
                <Row label="Amount approved" value={selected.approved_amount ? formatRupees(selected.approved_amount) : null} />
                <Row label="Credit to" value={selected.department.name} />
                <Row label="Date of payment" value={selected.payment_date} />
                <Row
                  label="Mode"
                  value={`${selected.payment_mode_label}${selected.payment_mode_other ? ` (${selected.payment_mode_other})` : ""}`}
                />
                <Row label="UTR / reference" value={selected.transaction_reference} />
                <Row label="Payer bank" value={selected.payer_bank} />
                <Row label="Payer account" value={selected.payer_account_name} />
                <Row label="Paid into" value={selected.paid_into} />
                <Row label="Remarks" value={selected.remarks} />
                <Row label="Decision note" value={selected.decision_note} />
                <Row label="Decided by" value={selected.decided_by} />
                <Row label="Credit reference" value={selected.reconciled_reference} />
                <Row label="Funds credited on" value={selected.reconciled_credit_date} />
                <Row label="Reconciliation note" value={selected.reconciliation_note} />
                {selected.receipt_url ? (
                  <Button asChild size="sm" variant="outline" className="mt-2">
                    <a href={selected.receipt_url} target="_blank" rel="noopener noreferrer">
                      Open the receipt <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                  </Button>
                ) : null}
              </div>

              {selected.audit?.length ? (
                <div className="space-y-1 rounded-md border border-border p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">History</p>
                  <ol className="space-y-1 text-xs" data-testid="orc-audit">
                    {selected.audit.map((log, i) => (
                      <li key={`${log.at}-${i}`}>
                        <span className="font-medium">{auditActionLabel(log.action)}</span> · {log.actor} ·{" "}
                        {new Date(log.at).toLocaleString("en-IN")}
                        {log.message ? <span className="block text-muted-foreground">{log.message}</span> : null}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}

              {action ? (
                <div className="space-y-3 rounded-md border border-border p-3" data-testid="orc-action-form">
                  {action === "approve" ? (
                    <div className="space-y-1.5">
                      <Label htmlFor="orc-approve-amount">Amount to credit (₹)</Label>
                      <Input
                        id="orc-approve-amount"
                        inputMode="decimal"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">At most the amount declared.</p>
                    </div>
                  ) : null}
                  {action === "reconciled" || action === "mismatch" ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="orc-rec-ref">
                          Bank / grant credit reference{action === "mismatch" ? " (optional)" : ""}
                        </Label>
                        <Input id="orc-rec-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
                      </div>
                      {action === "reconciled" ? (
                        <div className="space-y-1.5">
                          <Label htmlFor="orc-rec-date">Date funds were credited</Label>
                          <Input
                            id="orc-rec-date"
                            type="date"
                            max={todayIso()}
                            value={creditDate}
                            onChange={(e) => setCreditDate(e.target.value)}
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="space-y-1.5">
                    <Label htmlFor="orc-note">
                      {action === "reject"
                        ? "Reason for rejection"
                        : action === "approve"
                          ? "Approval note"
                          : action === "mismatch"
                            ? "What does not match"
                            : "Note (optional)"}
                    </Label>
                    <Textarea id="orc-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
                    <p className="text-xs text-muted-foreground">The user sees this note.</p>
                  </div>
                </div>
              ) : null}

              <DialogFooter className="gap-2">
                {action ? (
                  <>
                    <Button variant="outline" disabled={busy} onClick={() => setAction(null)}>
                      Back
                    </Button>
                    <Button
                      disabled={!canSend}
                      variant={action === "reject" ? "destructive" : "default"}
                      onClick={() => void send()}
                      data-testid="orc-confirm"
                    >
                      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {action === "approve"
                        ? "Approve and credit"
                        : action === "reject"
                          ? "Reject"
                          : action === "mismatch"
                            ? "Flag mismatch"
                            : "Mark reconciled"}
                    </Button>
                  </>
                ) : (
                  <>
                    {selected.can_decide ? (
                      <>
                        <Button variant="destructive" onClick={() => startAction("reject")}>
                          Reject
                        </Button>
                        <Button onClick={() => startAction("approve")}>Approve</Button>
                      </>
                    ) : null}
                    {selected.can_reconcile ? (
                      <>
                        {selected.state !== "mismatch" ? (
                          <Button variant="outline" onClick={() => startAction("mismatch")}>
                            Flag mismatch
                          </Button>
                        ) : null}
                        <Button onClick={() => startAction("reconciled")}>Mark reconciled</Button>
                      </>
                    ) : null}
                  </>
                )}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

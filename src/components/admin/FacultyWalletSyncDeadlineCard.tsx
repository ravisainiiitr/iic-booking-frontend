import { useCallback, useEffect, useState } from "react";
import { apiClient, type FacultyWalletBatchSyncRun, type FacultyWalletSyncDeadline } from "@/lib/api";
import { formatIst, istInputToIso, istInputValue } from "@/lib/facultyWalletSyncDeadline";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CalendarClock, Loader2, Lock, Save } from "lucide-react";
import { toast } from "sonner";

type PendingChange = { cutoff: string; label: string } | null;

const inr = (value: string) =>
  Number(value || 0).toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 });

const STATUS_TEXT: Record<string, string> = {
  window_closed: "Not run: the sync deadline had passed.",
  legacy_mysql_not_configured: "Not run: the old portal database is not reachable from this server.",
};

const DailySyncSummary = ({ time, run }: { time?: string; run: FacultyWalletBatchSyncRun | null }) => (
  <div className="space-y-1 rounded-lg border p-3 text-sm">
    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      Daily automatic sync{time ? ` · ${time} IST` : ""}
    </div>
    {!run ? (
      <p className="text-muted-foreground">No automatic run yet.</p>
    ) : (
      <>
        <p>
          Last run {formatIst(run.ran_at)} ({run.trigger === "daily" ? "scheduled" : "started by IIC"}).
        </p>
        {run.status !== "completed" ? (
          <p className="text-muted-foreground">{STATUS_TEXT[run.status] ?? `Not run: ${run.status}.`}</p>
        ) : (
          <p className="text-muted-foreground">
            {run.checked} faculty checked: {run.credits.count} credited ({inr(run.credits.total)}), {run.debits.count}{" "}
            deducted ({inr(run.debits.total)}), {run.in_sync} already up to date.
          </p>
        )}
        {run.blocked_below_zero.length > 0 && (
          <p className="text-amber-700 dark:text-amber-400">
            {run.blocked_below_zero.length} deduction{run.blocked_below_zero.length === 1 ? "" : "s"} held because the IIC
            wallet would go below zero (user {run.blocked_below_zero.map((b) => `#${b.user_id}`).join(", ")}).
          </p>
        )}
        {run.failed.length > 0 && (
          <p className="text-red-700 dark:text-red-400">
            {run.failed.length} failed (user {run.failed.map((f) => `#${f.user_id}`).join(", ")}); they are retried on the
            next run.
          </p>
        )}
      </>
    )}
  </div>
);

const FacultyWalletSyncDeadlineCard = () => {
  const [status, setStatus] = useState<FacultyWalletSyncDeadline | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<PendingChange>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const applyStatus = (data: FacultyWalletSyncDeadline) => {
    setStatus(data);
    setDraft(istInputValue(data.stored_cutoff ?? data.cutoff));
  };

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiClient.getFacultyWalletSyncDeadline();
    setLoading(false);
    if (res.error || !res.data) {
      setLoadError(res.error || "Could not load the faculty wallet sync deadline.");
      return;
    }
    setLoadError(null);
    applyStatus(res.data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const draftIso = istInputToIso(draft);
  const draftUnchanged = Boolean(status && draftIso && new Date(draftIso).getTime() === new Date(status.cutoff).getTime());
  const draftTooFar = Boolean(status && draftIso && new Date(draftIso).getTime() > new Date(status.max_cutoff).getTime());

  const openSave = () => {
    if (!draftIso) {
      toast.error("Enter a valid date and time.");
      return;
    }
    setReason("");
    setPending({ cutoff: draftIso, label: formatIst(draftIso) });
  };

  const openClose = () => {
    setReason("");
    setPending({ cutoff: "", label: "now (sync closes immediately)" });
  };

  const submit = async () => {
    if (!pending || !reason.trim()) return;
    setSaving(true);
    const res = await apiClient.setFacultyWalletSyncDeadline({ cutoff: pending.cutoff, reason: reason.trim() });
    setSaving(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not save the deadline.");
      return;
    }
    applyStatus(res.data);
    setPending(null);
    toast.success(res.data.window_open ? `Sync open until ${formatIst(res.data.cutoff)}` : "Faculty login wallet sync is closed.");
  };

  const last = status?.last_change ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <CalendarClock className="h-5 w-5" />
          Faculty login wallet sync
        </CardTitle>
        <CardDescription>
          Until this deadline, each faculty sign-in, and an automatic run every night for all faculty, brings the old-portal
          wallet transactions and balance into the IIC wallet. The manual sync on this page is not affected by the deadline.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && !status && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        )}
        {loadError && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
            <span>{loadError}</span>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        )}

        {status && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</span>
                <span>
                  <Badge variant={status.window_open ? "default" : "secondary"}>
                    {status.window_open ? "Open" : "Closed"}
                  </Badge>
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Deadline</span>
                <span className="text-sm font-medium">{formatIst(status.cutoff)}</span>
                {status.source === "default" && (
                  <span className="text-xs text-muted-foreground">Built-in default (no deadline set here yet)</span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Last change</span>
                {last ? (
                  <span className="text-sm">
                    {last.changed_by_name || last.changed_by_email} · {formatIst(last.changed_at)}
                    <span className="block text-xs text-muted-foreground" title={last.reason}>
                      {last.reason}
                    </span>
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">Never changed</span>
                )}
              </div>
            </div>

            <DailySyncSummary time={status.daily_sync_time_ist} run={status.last_batch_sync ?? null} />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1">
                <Label htmlFor="faculty-wallet-sync-deadline">New deadline (IST)</Label>
                <Input
                  id="faculty-wallet-sync-deadline"
                  type="datetime-local"
                  step={1}
                  value={draft}
                  max={istInputValue(status.max_cutoff)}
                  onChange={(e) => setDraft(e.target.value)}
                />
              </div>
              <Button onClick={openSave} disabled={!draftIso || draftUnchanged || draftTooFar || saving}>
                <Save className="mr-2 h-4 w-4" />
                Save deadline
              </Button>
              <Button variant="outline" onClick={openClose} disabled={!status.window_open || saving}>
                <Lock className="mr-2 h-4 w-4" />
                Close sync now
              </Button>
            </div>
            {draftTooFar && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                The deadline can be at most one year ahead ({formatIst(status.max_cutoff)}).
              </p>
            )}

            {status.recent_changes.length > 1 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">
                  Change history ({status.recent_changes.length})
                </summary>
                <ul className="mt-2 space-y-1">
                  {status.recent_changes.map((c) => (
                    <li key={c.id}>
                      {formatIst(c.changed_at)} · {c.changed_by_name || c.changed_by_email}: {formatIst(c.old_cutoff)} →{" "}
                      {formatIst(c.new_cutoff)} · <span className="text-muted-foreground">{c.reason}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </CardContent>

      <AlertDialog open={pending !== null} onOpenChange={(open) => !saving && !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change faculty wallet sync deadline</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  From <strong>{formatIst(status?.cutoff)}</strong> to <strong>{pending?.label}</strong>.
                </p>
                <p className="text-xs text-muted-foreground">
                  The change applies to the next faculty sign-in and is recorded with your name and reason.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1">
            <Label htmlFor="faculty-wallet-sync-reason">Reason (required)</Label>
            <Textarea
              id="faculty-wallet-sync-reason"
              value={reason}
              maxLength={1000}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is the deadline changing?"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void submit();
              }}
              disabled={saving || !reason.trim()}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default FacultyWalletSyncDeadlineCard;

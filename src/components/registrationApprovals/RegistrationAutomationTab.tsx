import { useCallback, useEffect, useState } from "react";
import { Loader2, Power, PowerOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiClient } from "@/lib/api";
import type { RegistrationAutomationStatus, RegistrationDryRunRow } from "@/lib/registrationApprovalTypes";
import { formatDay, formatMoment, SIX_MONTH_NOTE } from "./shared";

function DryRunTable({ rows, showDays, onOpenUser }: { rows: RegistrationDryRunRow[]; showDays?: boolean; onOpenUser: (id: number) => void }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">None today.</p>;
  return (
    <div className="max-h-80 overflow-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Validity</TableHead>
            {showDays ? <TableHead>Warning</TableHead> : null}
            <TableHead>Faculty</TableHead>
            <TableHead className="text-right">Future bookings</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.user_id}>
              <TableCell>
                <button type="button" className="text-left text-sm underline-offset-2 hover:underline" onClick={() => onOpenUser(r.user_id)}>
                  {r.name}
                </button>
                <p className="text-xs text-muted-foreground">{r.email}</p>
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm">{formatDay(r.programme_validity)}</TableCell>
              {showDays ? <TableCell className="text-sm">{r.days} day(s)</TableCell> : null}
              <TableCell className="text-sm">{r.faculty || "—"}</TableCell>
              <TableCell className="text-right text-sm">{r.future_bookings}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function RegistrationAutomationTab({ onOpenUser, onChanged }: { onOpenUser: (id: number) => void; onChanged: () => void }) {
  const [data, setData] = useState<RegistrationAutomationStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiClient.getRegistrationAutomation();
    setLoading(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not load the automation status.");
      return;
    }
    setData(res.data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (enabled: boolean) => {
    setSaving(true);
    const res = await apiClient.setRegistrationAutomation(enabled, enabled ? confirmText.trim() : "");
    setSaving(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not change the automation.");
      return;
    }
    setData(res.data);
    setConfirmOpen(false);
    setConfirmText("");
    toast.success(enabled ? "Programme expiry automation switched on." : "Programme expiry automation switched off.");
    onChanged();
  };

  if (loading && !data) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!data) return null;
  const run = data.dry_run;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            Programme expiry automation
            <span
              className={
                data.enabled
                  ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                  : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
              }
            >
              {data.enabled ? `On since ${formatMoment(data.enabled_at)}` : "Off"}
            </span>
          </CardTitle>
          <CardDescription>
            Runs every morning for approved IITR-claiming accounts (post-docs, research associates, IITR startups). It emails warnings{" "}
            {data.warning_days.join(", ")} day(s) before the programme validity ends, copying the faculty member, and disables the account the day after.
            Existing bookings are never cancelled. {SIX_MONTH_NOTE}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {data.enabled ? (
            <Button variant="outline" onClick={() => save(false)} disabled={saving}>
              <PowerOff className="mr-1.5 h-4 w-4" />
              Switch off
            </Button>
          ) : (
            <Button onClick={() => setConfirmOpen(true)} disabled={saving}>
              <Power className="mr-1.5 h-4 w-4" />
              Switch on…
            </Button>
          )}
          <Button variant="ghost" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Refresh preview
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">What the next run would do (dry run for {formatDay(run.today)})</CardTitle>
          <CardDescription>Nothing is sent or changed by this preview.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Would be disabled ({run.counts.would_disable})</h3>
            <p className="text-xs text-muted-foreground">
              Programme validity has passed but the account is still active. These users already cannot sign in; switching on sends them the
              disabled email with a link to request an extension.
            </p>
            <DryRunTable rows={run.would_disable} onOpenUser={onOpenUser} />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Would be warned ({run.counts.would_warn})</h3>
            <DryRunTable rows={run.would_warn} showDays onOpenUser={onOpenUser} />
          </div>
        </CardContent>
      </Card>

      {data.disabled_with_future_bookings.length ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Disabled accounts with upcoming bookings</CardTitle>
            <CardDescription>These bookings were kept. Decide with the Officer In Charge whether to cancel or keep them.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {data.disabled_with_future_bookings.map((u) => (
                <li key={u.user_id} className="rounded-lg border p-2.5">
                  <button type="button" className="font-medium underline-offset-2 hover:underline" onClick={() => onOpenUser(u.user_id)}>
                    {u.name}
                  </button>{" "}
                  <span className="text-xs text-muted-foreground">{u.email}</span>
                  <ul className="mt-1 text-xs text-muted-foreground">
                    {u.bookings.map((b) => (
                      <li key={b.booking_id}>
                        {b.display_id} · {b.equipment} · {formatMoment(b.starts_at)}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Switch on programme expiry automation?</DialogTitle>
            <DialogDescription>
              From the next morning run, {run.counts.would_disable} account(s) would be disabled and {run.counts.would_warn} user(s) warned by
              email, with their faculty member copied. Bookings are not cancelled.
            </DialogDescription>
          </DialogHeader>
          <Alert>
            <AlertTitle>Check the dry run first</AlertTitle>
            <AlertDescription>Make sure the programme validity dates and faculty names are right before switching on.</AlertDescription>
          </Alert>
          <div className="space-y-1.5">
            <Label htmlFor="automation-confirm">Type ENABLE to confirm</Label>
            <Input id="automation-confirm" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => save(true)} disabled={saving || confirmText.trim() !== "ENABLE"}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Switch on
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

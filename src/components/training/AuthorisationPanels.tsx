import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, Download, Loader2, Search, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { trainingApi } from "@/lib/trainingApi";
import type {
  AuthorisationRequest,
  AuthorisationSetting,
  AuthorisationSettingInput,
  AuthorisedUser,
  GrandfatherResult,
} from "@/lib/trainingAuthTypes";
import type { CertificationLevelInfo } from "@/lib/trainingOpsTypes";
import type { TrainingUserRef } from "@/lib/trainingTypes";
import { formatDate, formatDateTime, formatWindow, fromLocalInputValue, humanizeCode } from "./trainingHelpers";
import { EmptyState, LoadingBlock, PromptDialog, StatusChip, runTrainingAction } from "./trainingUi";

const MONTHS_MAX = 60;

function monthsOrUndefined(raw: string): number | undefined {
  const n = Number(raw);
  return raw.trim() && Number.isInteger(n) && n >= 1 && n <= MONTHS_MAX ? n : undefined;
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------
function ScheduleDialog({ request, onClose, onDone }: { request: AuthorisationRequest; onClose: () => void; onDone: () => void }) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [location, setLocation] = useState(request.location || "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const startAt = fromLocalInputValue(start);
    if (!startAt) {
      toast.error("Choose when the session starts.");
      return;
    }
    setBusy(true);
    const res = await runTrainingAction(
      trainingApi.authorisationRequestAction(request.id, "schedule", {
        start_at: startAt,
        end_at: fromLocalInputValue(end) || undefined,
        location,
        note,
      }),
      "Training session scheduled; the user has been told",
    );
    setBusy(false);
    if (!res.error) {
      onDone();
      onClose();
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule training</DialogTitle>
          <DialogDescription>
            {request.user.name} on {request.equipment.name}. They (and their supervisor) are notified.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="auth-sched-start">Starts</Label>
              <Input id="auth-sched-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="auth-sched-end">Ends (optional)</Label>
              <Input id="auth-sched-end" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="auth-sched-loc">Location</Label>
            <Input id="auth-sched-loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Lab / room" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="auth-sched-note">Note to the user (optional)</Label>
            <Textarea id="auth-sched-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Close
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={busy || !start}>
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RequestsPanel({ equipmentId, validityMonths, onChanged }: { equipmentId: number; validityMonths: number; onChanged: () => void }) {
  const [rows, setRows] = useState<AuthorisationRequest[] | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const [scheduling, setScheduling] = useState<AuthorisationRequest | null>(null);
  const [approving, setApproving] = useState<AuthorisationRequest | null>(null);
  const [rejecting, setRejecting] = useState<AuthorisationRequest | null>(null);
  const [approveMonths, setApproveMonths] = useState("");

  const load = useCallback(async () => {
    const res = await trainingApi.authorisationRequests({ scope: "inbox", equipment_id: equipmentId, status: showClosed ? undefined : "open" });
    if (res.error) toast.error(res.error);
    setRows(res.data?.results ?? []);
  }, [equipmentId, showClosed]);

  useEffect(() => {
    setRows(null);
    void load();
  }, [load]);

  const done = () => {
    void load();
    onChanged();
  };

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={showClosed} onCheckedChange={(v) => setShowClosed(v === true)} />
        Show closed requests
      </label>
      {rows === null ? (
        <LoadingBlock />
      ) : !rows.length ? (
        <EmptyState icon={<CheckCircle2 className="h-8 w-8" />} title="No open training requests" description="Requests from users who need authorisation appear here." />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Requester</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Past use</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm">
                    <div className="font-medium">{r.user.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {[r.user.email, r.user.department].filter(Boolean).join(" · ")}
                    </div>
                    {r.supervisor ? <div className="text-xs text-muted-foreground">Supervisor: {r.supervisor.name}</div> : null}
                    <div className="text-xs text-muted-foreground">
                      {r.reference} · {formatDateTime(r.created_at)}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs whitespace-pre-line text-xs">{r.message || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    {r.history ? `${r.history.completed_bookings_12m} completed booking${r.history.completed_bookings_12m === 1 ? "" : "s"} (12 months)` : "—"}
                  </TableCell>
                  <TableCell>
                    <StatusChip kind="authRequest" status={r.status} label={r.status_label} />
                    {r.status === "SCHEDULED" && r.scheduled_start ? (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatWindow(r.scheduled_start, r.scheduled_end)}
                        {r.location ? ` · ${r.location}` : ""}
                      </div>
                    ) : null}
                    {r.decision_reason ? <div className="mt-1 text-xs text-muted-foreground">{r.decision_reason}</div> : null}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.can_handle ? (
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Button type="button" size="sm" variant="outline" onClick={() => setScheduling(r)} className="gap-1">
                          <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                          {r.status === "SCHEDULED" ? "Reschedule" : "Schedule"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            setApproveMonths("");
                            setApproving(r);
                          }}
                        >
                          Mark trained
                        </Button>
                        <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => setRejecting(r)}>
                          Reject
                        </Button>
                      </div>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {scheduling ? <ScheduleDialog request={scheduling} onClose={() => setScheduling(null)} onDone={done} /> : null}
      <PromptDialog
        open={approving !== null}
        onOpenChange={(v) => !v && setApproving(null)}
        title="Mark trained and authorise"
        description={approving ? `${approving.user.name} gets a certificate for ${approving.equipment.name} and can book it.` : undefined}
        label="Note (optional)"
        required={false}
        confirmLabel="Authorise"
        onConfirm={async (note) => {
          if (!approving) return false;
          const res = await runTrainingAction(
            trainingApi.authorisationRequestAction(approving.id, "approve", { note, months: monthsOrUndefined(approveMonths) }),
            "Authorised; certificate issued",
          );
          if (res.error) return false;
          done();
          return true;
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="auth-approve-months">Valid for (months)</Label>
          <Input
            id="auth-approve-months"
            type="number"
            min={1}
            max={MONTHS_MAX}
            value={approveMonths}
            placeholder={String(validityMonths)}
            onChange={(e) => setApproveMonths(e.target.value)}
          />
        </div>
      </PromptDialog>
      <PromptDialog
        open={rejecting !== null}
        onOpenChange={(v) => !v && setRejecting(null)}
        title="Reject training request"
        description={rejecting ? `${rejecting.user.name} sees your reason.` : undefined}
        confirmLabel="Reject"
        destructive
        onConfirm={async (reason) => {
          if (!rejecting) return false;
          const res = await runTrainingAction(trainingApi.authorisationRequestAction(rejecting.id, "reject", { reason }), "Request rejected");
          if (res.error) return false;
          done();
          return true;
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Authorised users
// ---------------------------------------------------------------------------
function GrantDialog({
  open,
  onOpenChange,
  equipmentId,
  equipmentName,
  validityMonths,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipmentId: number;
  equipmentName: string;
  validityMonths: number;
  onDone: () => void;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<TrainingUserRef[]>([]);
  const [picked, setPicked] = useState<TrainingUserRef[]>([]);
  const [months, setMonths] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setHits([]);
    setPicked([]);
    setMonths("");
    setReason("");
  }, [open]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    const t = window.setTimeout(async () => {
      const res = await trainingApi.authorisationPeople(equipmentId, q.trim());
      setHits(res.data?.results ?? []);
    }, 250);
    return () => window.clearTimeout(t);
  }, [q, equipmentId]);

  const submit = async () => {
    setBusy(true);
    const res = await trainingApi.grantAuthorisation(equipmentId, {
      user_ids: picked.map((p) => p.id),
      reason: reason.trim(),
      months: monthsOrUndefined(months),
    });
    setBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    const d = res.data;
    toast.success(
      `Authorised ${d?.granted ?? 0}, renewed ${d?.renewed ?? 0}${d?.skipped.length ? `, skipped ${d.skipped.length}` : ""}`,
    );
    onDone();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Authorise people</DialogTitle>
          <DialogDescription>
            Grant authorisation on {equipmentName} to one or more people, for example after a group training. Each grant is recorded with your reason.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
            <Input className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email" aria-label="Search people" />
          </div>
          {hits.length ? (
            <ul className="max-h-40 divide-y overflow-y-auto rounded-md border text-sm">
              {hits.map((u) => {
                const chosen = picked.some((p) => p.id === u.id);
                return (
                  <li key={u.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-muted/50 disabled:opacity-50"
                      disabled={chosen}
                      onClick={() => setPicked((prev) => [...prev, u])}
                    >
                      <span>
                        {u.name}
                        <span className="ml-2 text-xs text-muted-foreground">{u.email}</span>
                      </span>
                      {chosen ? <span className="text-xs text-muted-foreground">Added</span> : <UserPlus className="h-4 w-4" aria-hidden />}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
          {picked.length ? (
            <div className="flex flex-wrap gap-1.5">
              {picked.map((p) => (
                <span key={p.id} className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-xs">
                  {p.name}
                  <button type="button" aria-label={`Remove ${p.name}`} onClick={() => setPicked((prev) => prev.filter((x) => x.id !== p.id))}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          <div className="grid grid-cols-[8rem_1fr] items-center gap-2">
            <Label htmlFor="auth-grant-months">Valid for (months)</Label>
            <Input id="auth-grant-months" type="number" min={1} max={MONTHS_MAX} value={months} placeholder={String(validityMonths)} onChange={(e) => setMonths(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="auth-grant-reason">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea id="auth-grant-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Hands-on training on 12 Oct, all passed the practical" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Close
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={busy || !picked.length || !reason.trim()}>
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Authorise {picked.length || ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const SOURCE_LABELS: Record<string, string> = {
  manual: "Granted",
  bulk: "Bulk grant",
  request: "Training request",
  grandfathered: "Grandfathered",
  assessment: "Assessment",
  certificate: "Certificate",
};

export function AuthorisedUsersPanel({
  equipmentId,
  equipmentName,
  equipmentCode,
  validityMonths,
  onChanged,
}: {
  equipmentId: number;
  equipmentName: string;
  equipmentCode: string;
  validityMonths: number;
  onChanged: () => void;
}) {
  const [rows, setRows] = useState<AuthorisedUser[] | null>(null);
  const [includeClosed, setIncludeClosed] = useState(false);
  const [filter, setFilter] = useState("");
  const [grantOpen, setGrantOpen] = useState(false);
  const [acting, setActing] = useState<{ award: AuthorisedUser; action: "revoke" | "renew" } | null>(null);
  const [renewMonths, setRenewMonths] = useState("");

  const load = useCallback(async () => {
    const res = await trainingApi.authorisedUsers(equipmentId, includeClosed);
    if (res.error) toast.error(res.error);
    setRows(res.data?.results ?? []);
  }, [equipmentId, includeClosed]);

  useEffect(() => {
    setRows(null);
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f || !rows) return rows ?? [];
    return rows.filter((r) => `${r.user.name} ${r.user.email ?? ""} ${r.user.department ?? ""}`.toLowerCase().includes(f));
  }, [rows, filter]);

  const done = () => {
    void load();
    onChanged();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input className="pl-8" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by name, email, department" aria-label="Filter authorised users" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={includeClosed} onCheckedChange={(v) => setIncludeClosed(v === true)} />
          Include revoked
        </label>
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => void trainingApi.exportAuthorisedUsers(equipmentId, equipmentCode).then((r) => r.error && toast.error(r.error))}>
          <Download className="h-4 w-4" aria-hidden />
          Export CSV
        </Button>
        <Button type="button" size="sm" className="gap-1.5" onClick={() => setGrantOpen(true)}>
          <UserPlus className="h-4 w-4" aria-hidden />
          Authorise people
        </Button>
      </div>
      {rows === null ? (
        <LoadingBlock />
      ) : !visible.length ? (
        <EmptyState title="No authorised users yet" description="Authorise people after training, or use Grandfathering for experienced users." />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Valid until</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="text-sm">
                    <div className="font-medium">{a.user.name}</div>
                    <div className="text-xs text-muted-foreground">{[a.user.email, a.user.department].filter(Boolean).join(" · ")}</div>
                    {a.supervisor ? <div className="text-xs text-muted-foreground">Supervisor: {a.supervisor.name}</div> : null}
                  </TableCell>
                  <TableCell className="text-sm">{a.level_name}</TableCell>
                  <TableCell>
                    <StatusChip kind="award" status={a.expiring ? "DORMANT" : a.status} label={a.status_label} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{a.valid_until ? formatDate(a.valid_until) : "No expiry"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{SOURCE_LABELS[a.source] ?? humanizeCode(a.source)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      {["ACTIVE", "DORMANT", "EXPIRED"].includes(a.status) ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setRenewMonths("");
                            setActing({ award: a, action: "renew" });
                          }}
                        >
                          Renew
                        </Button>
                      ) : null}
                      {a.status !== "REVOKED" ? (
                        <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => setActing({ award: a, action: "revoke" })}>
                          Revoke
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <GrantDialog open={grantOpen} onOpenChange={setGrantOpen} equipmentId={equipmentId} equipmentName={equipmentName} validityMonths={validityMonths} onDone={done} />
      <PromptDialog
        open={acting !== null}
        onOpenChange={(v) => !v && setActing(null)}
        title={acting?.action === "revoke" ? "Revoke authorisation" : "Renew authorisation"}
        description={
          acting
            ? acting.action === "revoke"
              ? `${acting.award.user.name} can no longer book ${equipmentName} on their own. They are told, with your reason.`
              : `Extends ${acting.award.user.name}'s authorisation from its current expiry (or today).`
            : undefined
        }
        confirmLabel={acting?.action === "revoke" ? "Revoke" : "Renew"}
        destructive={acting?.action === "revoke"}
        onConfirm={async (reason) => {
          if (!acting) return false;
          const res = await runTrainingAction(
            trainingApi.authorisationAwardAction(acting.award.id, acting.action, {
              reason,
              months: acting.action === "renew" ? monthsOrUndefined(renewMonths) : undefined,
            }),
            acting.action === "revoke" ? "Authorisation revoked" : "Authorisation renewed",
          );
          if (res.error) return false;
          done();
          return true;
        }}
      >
        {acting?.action === "renew" ? (
          <div className="space-y-1.5">
            <Label htmlFor="auth-renew-months">Extend by (months)</Label>
            <Input id="auth-renew-months" type="number" min={1} max={MONTHS_MAX} value={renewMonths} placeholder={String(validityMonths)} onChange={(e) => setRenewMonths(e.target.value)} />
          </div>
        ) : null}
      </PromptDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
export function liveExplanation(s: AuthorisationSetting): string {
  if (!s.required) return "Off: anyone allowed to book this equipment can book it.";
  if (!s.module_enabled) return "Saved, but not checked yet: the Training module is switched off.";
  if (!s.in_training_scope) return "Saved, but not checked yet: Training is not turned on for this equipment.";
  if (s.audience === "TEST_ACCOUNTS") return "On for test accounts only (pilot). Real users are not checked until the audience is Everyone.";
  return "On: bookings are checked now.";
}

export function SettingsPanel({ setting, onSaved }: { setting: AuthorisationSetting; onSaved: (s: AuthorisationSetting) => void }) {
  const [form, setForm] = useState({
    required: setting.required,
    applies_to: setting.applies_to,
    min_level_code: setting.min_level_code,
    validity_months: String(setting.validity_months),
    grace_completed_bookings: String(setting.grace_completed_bookings),
    grace_months: String(setting.grace_months),
    note: setting.note,
  });
  const [reason, setReason] = useState("");
  const [levels, setLevels] = useState<CertificationLevelInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const canEdit = Boolean(setting.can_configure);

  useEffect(() => {
    void trainingApi.levels().then((r) => setLevels(r.data?.results ?? []));
  }, []);

  const save = async () => {
    const input: AuthorisationSettingInput = {
      required: form.required,
      applies_to: form.applies_to,
      min_level_code: form.min_level_code,
      validity_months: Number(form.validity_months),
      grace_completed_bookings: Number(form.grace_completed_bookings || 0),
      grace_months: Number(form.grace_months),
      note: form.note,
      reason,
    };
    setBusy(true);
    const res = await runTrainingAction(trainingApi.saveAuthorisationSetting(setting.equipment.equipment_id, input), "Saved");
    setBusy(false);
    if (res.data) {
      setReason("");
      onSaved({ ...res.data, can_configure: setting.can_configure });
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-start justify-between gap-4 rounded-xl border bg-muted/20 p-4">
        <div>
          <Label htmlFor="auth-required" className="text-base font-semibold">
            Authorisation required to book
          </Label>
          <p className="mt-1 text-sm text-muted-foreground">{liveExplanation({ ...setting, required: form.required })}</p>
        </div>
        <Switch id="auth-required" checked={form.required} disabled={!canEdit} onCheckedChange={(v) => setForm((f) => ({ ...f, required: v }))} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Who needs it</Label>
          <Select value={form.applies_to} disabled={!canEdit} onValueChange={(v) => setForm((f) => ({ ...f, applies_to: v as typeof f.applies_to }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {setting.applies_to_choices.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Minimum level</Label>
          <Select value={form.min_level_code} disabled={!canEdit} onValueChange={(v) => setForm((f) => ({ ...f, min_level_code: v }))}>
            <SelectTrigger>
              <SelectValue placeholder={setting.min_level_name} />
            </SelectTrigger>
            <SelectContent>
              {(levels.length ? levels : [{ code: setting.min_level_code, name: setting.min_level_name } as CertificationLevelInfo]).map((l) => (
                <SelectItem key={l.code} value={l.code}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="auth-validity">Certificate validity (months)</Label>
          <Input id="auth-validity" type="number" min={1} max={MONTHS_MAX} disabled={!canEdit} value={form.validity_months} onChange={(e) => setForm((f) => ({ ...f, validity_months: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="auth-grace">Grace: allow users with at least N completed bookings</Label>
          <div className="flex items-center gap-2">
            <Input id="auth-grace" type="number" min={0} max={50} className="w-24" disabled={!canEdit} value={form.grace_completed_bookings} onChange={(e) => setForm((f) => ({ ...f, grace_completed_bookings: e.target.value }))} aria-label="Completed bookings for grace" />
            <span className="text-sm text-muted-foreground">in the last</span>
            <Input type="number" min={1} max={MONTHS_MAX} className="w-20" disabled={!canEdit} value={form.grace_months} onChange={(e) => setForm((f) => ({ ...f, grace_months: e.target.value }))} aria-label="Grace window in months" />
            <span className="text-sm text-muted-foreground">months</span>
          </div>
          <p className="text-xs text-muted-foreground">0 = no grace. Users in grace can book but are asked to get trained.</p>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="auth-note">Note (shown to staff)</Label>
        <Textarea id="auth-note" rows={2} disabled={!canEdit} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
      </div>
      {canEdit ? (
        <div className="space-y-1.5">
          <Label htmlFor="auth-reason">Reason for the change (kept in the audit log)</Label>
          <Input id="auth-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Only the equipment's OIC or the Main Admin can change these settings.</p>
      )}
      {setting.updated_at ? (
        <p className="text-xs text-muted-foreground">
          Last changed {formatDateTime(setting.updated_at)}
          {setting.updated_by ? ` by ${setting.updated_by}` : ""}
        </p>
      ) : null}
      {canEdit ? (
        <Button type="button" onClick={() => void save()} disabled={busy}>
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          Save settings
        </Button>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grandfathering
// ---------------------------------------------------------------------------
export function GrandfatherPanel({
  equipmentId,
  canApply,
  validityMonths,
  onChanged,
}: {
  equipmentId: number;
  canApply: boolean;
  validityMonths: number;
  onChanged: () => void;
}) {
  const [minBookings, setMinBookings] = useState("2");
  const [months, setMonths] = useState("12");
  const [preview, setPreview] = useState<GrandfatherResult | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirm, setConfirm] = useState("");
  const [validFor, setValidFor] = useState("");
  const [busy, setBusy] = useState(false);

  const params = () => ({ min_bookings: Math.max(1, Number(minBookings) || 2), months: Math.max(1, Number(months) || 12) });

  const runPreview = async () => {
    setBusy(true);
    const res = await trainingApi.grandfatherPreview(equipmentId, params());
    setBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    const data = res.data ?? null;
    setPreview(data);
    setSelected(new Set((data?.candidates ?? []).filter((c) => !c.already_authorised).map((c) => c.user.id)));
    setConfirm("");
  };

  const apply = async () => {
    setBusy(true);
    const res = await trainingApi.grandfatherApply(equipmentId, {
      ...params(),
      confirm,
      user_ids: [...selected],
      validity_months: monthsOrUndefined(validFor),
    });
    setBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`Grandfathered ${res.data?.granted ?? 0} user${res.data?.granted === 1 ? "" : "s"}`);
    setPreview(null);
    onChanged();
  };

  const eligible = (preview?.candidates ?? []).filter((c) => !c.already_authorised);

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Authorise experienced users in one step: everyone with at least the given number of completed bookings in the period. The preview changes
        nothing; applying needs the OIC (or Main Admin) to type GRANDFATHER and is recorded in the audit log.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="gf-min">Completed bookings (at least)</Label>
          <Input id="gf-min" type="number" min={1} max={50} className="w-28" value={minBookings} onChange={(e) => setMinBookings(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gf-months">In the last (months)</Label>
          <Input id="gf-months" type="number" min={1} max={MONTHS_MAX} className="w-28" value={months} onChange={(e) => setMonths(e.target.value)} />
        </div>
        <Button type="button" variant="outline" onClick={() => void runPreview()} disabled={busy}>
          {busy && !preview ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          Preview (dry run)
        </Button>
      </div>
      {preview ? (
        <>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-lg border bg-card px-3 py-1.5">
              <strong className="tabular-nums">{preview.candidates.length}</strong> users qualify
            </span>
            <span className="rounded-lg border bg-card px-3 py-1.5">
              <strong className="tabular-nums">{preview.would_authorise}</strong> would be authorised
            </span>
            <span className="rounded-lg border bg-card px-3 py-1.5">
              <strong className="tabular-nums">{preview.already_authorised}</strong> already authorised
            </span>
          </div>
          {preview.candidates.length ? (
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        aria-label="Select all"
                        checked={eligible.length > 0 && selected.size === eligible.length}
                        onCheckedChange={(v) => setSelected(v === true ? new Set(eligible.map((c) => c.user.id)) : new Set())}
                      />
                    </TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Completed bookings</TableHead>
                    <TableHead>Last completed</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.candidates.map((c) => (
                    <TableRow key={c.user.id}>
                      <TableCell>
                        <Checkbox
                          aria-label={`Select ${c.user.name}`}
                          disabled={c.already_authorised}
                          checked={selected.has(c.user.id)}
                          onCheckedChange={(v) =>
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (v === true) next.add(c.user.id);
                              else next.delete(c.user.id);
                              return next;
                            })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium">{c.user.name}</div>
                        <div className="text-xs text-muted-foreground">{[c.user.email, c.user.department].filter(Boolean).join(" · ")}</div>
                      </TableCell>
                      <TableCell className="tabular-nums">{c.completed_bookings}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{c.last_completed ? formatDate(c.last_completed) : "—"}</TableCell>
                      <TableCell>
                        {c.already_authorised ? (
                          <StatusChip kind="authorisation" status="AUTHORISED" />
                        ) : (
                          <StatusChip kind="authorisation" status="GRACE" label="Would be authorised" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState title="Nobody qualifies" description="Try fewer bookings or a longer period." />
          )}
          {canApply && eligible.length ? (
            <div className="max-w-xl space-y-3 rounded-xl border border-amber-300 bg-amber-50/60 p-4 dark:border-amber-800 dark:bg-amber-950/30">
              <p className="text-sm font-medium">Apply to {selected.size} selected user{selected.size === 1 ? "" : "s"}</p>
              <div className="grid grid-cols-[10rem_1fr] items-center gap-2">
                <Label htmlFor="gf-valid">Valid for (months)</Label>
                <Input id="gf-valid" type="number" min={1} max={MONTHS_MAX} value={validFor} placeholder={String(validityMonths)} onChange={(e) => setValidFor(e.target.value)} />
                <Label htmlFor="gf-confirm">Type GRANDFATHER</Label>
                <Input id="gf-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
              </div>
              <Button type="button" onClick={() => void apply()} disabled={busy || confirm !== "GRANDFATHER" || !selected.size}>
                {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                Authorise {selected.size} user{selected.size === 1 ? "" : "s"}
              </Button>
            </div>
          ) : !canApply && eligible.length ? (
            <p className="text-sm text-muted-foreground">Only the equipment's OIC or the Main Admin can apply grandfathering.</p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, CalendarCheck, CheckCircle2, Plus, Search, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, LoadingBlock, PromptDialog, SectionCard, TrainingPageFrame } from "@/components/training/trainingUi";
import {
  upkeepApi,
  type MaintenancePlan,
  type PlanInput,
  type PlanState,
  type UpkeepAlert,
  type UpkeepDetail,
  type UpkeepListRow,
} from "@/lib/upkeepApi";
import { cn } from "@/lib/utils";

const WINDOWS = [30, 90, 180, 365];

export function formatDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

const STATE_STYLE: Record<PlanState, string> = {
  OK: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200",
  DUE: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200",
  OVERDUE: "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/60 dark:text-red-200",
  CLOSED: "border-border bg-muted text-muted-foreground",
};
const STATE_LABEL: Record<PlanState, string> = { OK: "On schedule", DUE: "Due soon", OVERDUE: "Overdue", CLOSED: "Closed" };

function Chip({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium", className)}>{children}</span>;
}

function UptimeValue({ value, target, below }: { value: number; target: number; below: boolean }) {
  return (
    <span className={cn("font-medium tabular-nums", below ? "text-red-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300")}>
      {value.toFixed(1)}%<span className="ml-1 text-xs font-normal text-muted-foreground">/ {target}%</span>
    </span>
  );
}

function hours(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return v >= 48 ? `${(v / 24).toFixed(1)} d` : `${v.toFixed(1)} h`;
}

// --------------------------------------------------------------------------- alerts
function AlertList({ alerts, onChanged, showEquipment = true }: { alerts: UpkeepAlert[]; onChanged: () => void; showEquipment?: boolean }) {
  const [acking, setAcking] = useState<UpkeepAlert | null>(null);
  if (!alerts.length) return <p className="px-4 py-3 text-sm text-muted-foreground">No open alerts.</p>;
  return (
    <>
      <ul className="divide-y">
        {alerts.map((a) => (
          <li key={a.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-2.5 text-sm" data-testid="upkeep-alert">
            <div className="min-w-0">
              <p className="font-medium">
                <AlertTriangle
                  className={cn("mr-1.5 inline h-4 w-4", a.severity === "CRITICAL" ? "text-red-600" : a.severity === "WARNING" ? "text-amber-600" : "text-sky-600")}
                  aria-hidden
                />
                {a.kind_label}
                {showEquipment ? <span className="font-normal text-muted-foreground"> · {a.equipment.name}</span> : null}
              </p>
              <p className="text-xs text-muted-foreground">{a.message}</p>
              {a.acknowledged_by ? (
                <p className="text-xs text-muted-foreground">
                  Acknowledged by {a.acknowledged_by.name}
                  {a.acknowledge_note ? `: ${a.acknowledge_note}` : ""}
                </p>
              ) : null}
              {a.resolved_at ? <p className="text-xs text-muted-foreground">Resolved {formatDay(a.resolved_at)}</p> : null}
            </div>
            {!a.resolved_at && !a.acknowledged_by ? (
              <Button type="button" size="sm" variant="outline" onClick={() => setAcking(a)}>
                Acknowledge
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      <PromptDialog
        open={acking !== null}
        onOpenChange={(v) => !v && setAcking(null)}
        title="Acknowledge alert"
        description="The alert stays open until the condition clears; acknowledging tells others it is being handled."
        label="Note (optional)"
        required={false}
        confirmLabel="Acknowledge"
        onConfirm={async (note) => {
          if (!acking) return false;
          const res = await upkeepApi.acknowledge(acking.id, note);
          if (res.error) {
            toast.error(res.error);
            return false;
          }
          onChanged();
          return true;
        }}
      />
    </>
  );
}

// --------------------------------------------------------------------------- plan dialogs
function PlanDialog({
  open,
  onOpenChange,
  kinds,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kinds: Array<{ value: string; label: string }>;
  onSave: (input: PlanInput) => Promise<boolean>;
}) {
  const [form, setForm] = useState({ title: "", kind: "PREVENTIVE", interval_days: "90", lead_days: "14", next_due_on: "", instructions: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setForm({ title: "", kind: "PREVENTIVE", interval_days: "90", lead_days: "14", next_due_on: "", instructions: "" });
  }, [open]);
  const save = async () => {
    setBusy(true);
    const ok = await onSave({
      title: form.title.trim(),
      kind: form.kind,
      interval_days: Number(form.interval_days),
      lead_days: Number(form.lead_days || 0),
      instructions: form.instructions,
      ...(form.next_due_on ? { next_due_on: form.next_due_on } : {}),
    });
    setBusy(false);
    if (ok) onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Schedule maintenance</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="plan-title">What is done</Label>
            <Input id="plan-title" value={form.title} placeholder="e.g. Calibration with Si standard" onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plan-kind">Kind</Label>
            <Select value={form.kind} onValueChange={(v) => setForm((f) => ({ ...f, kind: v }))}>
              <SelectTrigger id="plan-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {kinds.map((k) => (
                  <SelectItem key={k.value} value={k.value}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="plan-interval">Repeat every (days)</Label>
              <Input id="plan-interval" type="number" min={1} max={1825} value={form.interval_days} onChange={(e) => setForm((f) => ({ ...f, interval_days: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-lead">Remind (days before)</Label>
              <Input id="plan-lead" type="number" min={0} max={180} value={form.lead_days} onChange={(e) => setForm((f) => ({ ...f, lead_days: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plan-next">First due on (blank = one interval from today)</Label>
            <Input id="plan-next" type="date" value={form.next_due_on} onChange={(e) => setForm((f) => ({ ...f, next_due_on: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plan-instructions">Instructions (optional)</Label>
            <Textarea id="plan-instructions" rows={2} value={form.instructions} onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void save()} disabled={busy || !form.title.trim() || !Number(form.interval_days)}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CompleteDialog({ plan, onOpenChange, onDone }: { plan: MaintenancePlan | null; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const [form, setForm] = useState({ done_on: "", notes: "", report_reference: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (plan) setForm({ done_on: "", notes: "", report_reference: "" });
  }, [plan]);
  const save = async () => {
    if (!plan) return;
    setBusy(true);
    const res = await upkeepApi.completePlan(plan.id, { ...(form.done_on ? { done_on: form.done_on } : {}), notes: form.notes, report_reference: form.report_reference });
    setBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`Recorded. Next due ${formatDay(res.data?.plan.next_due_on)}.`);
    onOpenChange(false);
    onDone();
  };
  return (
    <Dialog open={plan !== null} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record done: {plan?.title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="done-on">Done on (blank = today)</Label>
            <Input id="done-on" type="date" value={form.done_on} onChange={(e) => setForm((f) => ({ ...f, done_on: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="done-ref">Service / calibration report reference</Label>
            <Input id="done-ref" value={form.report_reference} onChange={(e) => setForm((f) => ({ ...f, report_reference: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="done-notes">Notes</Label>
            <Textarea id="done-notes" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void save()} disabled={busy}>
            Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --------------------------------------------------------------------------- detail
function Tile({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg border bg-background px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function UpkeepDetailView({ equipmentId, days, onBack }: { equipmentId: number; days: number; onBack: () => void }) {
  const [data, setData] = useState<UpkeepDetail | null>(null);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [completing, setCompleting] = useState<MaintenancePlan | null>(null);
  const [closing, setClosing] = useState<MaintenancePlan | null>(null);
  const [target, setTarget] = useState({ uptime_target_pct: "", breakdown_alert_count: "", breakdown_window_days: "" });

  const load = useCallback(async () => {
    const res = await upkeepApi.detail(equipmentId, days);
    if (res.error) {
      setError(res.error);
      return;
    }
    setError("");
    setData(res.data ?? null);
    if (res.data) {
      const s = res.data.setting;
      setTarget({
        uptime_target_pct: String(s.uptime_target_pct),
        breakdown_alert_count: String(s.breakdown_alert_count),
        breakdown_window_days: String(s.breakdown_window_days),
      });
    }
  }, [equipmentId, days]);

  useEffect(() => {
    setData(null);
    void load();
  }, [load]);

  if (error) return <EmptyState title="Not available" description={error} />;
  if (!data) return <LoadingBlock />;
  const m = data.metrics;
  const openAlerts = data.alerts.filter((a) => !a.resolved_at);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All equipment
        </Button>
        <h2 className="text-lg font-semibold">
          {data.equipment.name} <span className="text-sm font-normal text-muted-foreground">{data.equipment.code}</span>
        </h2>
      </div>
      <SectionCard title={`Last ${m.days} days`} icon={<CheckCircle2 className="h-4 w-4" />}>
        <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 lg:grid-cols-6" data-testid="upkeep-metrics">
          <Tile label="Uptime" value={<UptimeValue value={m.uptime_pct} target={m.target_pct} below={m.below_target} />} />
          <Tile label="Availability (excl. planned work)" value={`${m.availability_excl_planned_pct.toFixed(1)}%`} />
          <Tile label="Breakdowns" value={m.breakdowns} hint={`${hours(m.breakdown_hours)} down`} />
          <Tile label="Mean time to repair" value={hours(m.mttr_hours)} />
          <Tile label="Mean time between failures" value={hours(m.mtbf_hours)} />
          <Tile label="Planned work" value={hours(m.planned_hours)} hint={m.staff_unavailable_hours ? `Staff unavailable ${hours(m.staff_unavailable_hours)}` : undefined} />
        </div>
        {m.causes.length ? (
          <div className="border-t px-4 py-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Downtime by cause</p>
            <ul className="grid gap-1 text-sm sm:grid-cols-2">
              {m.causes.map((c) => (
                <li key={c.cause} className="flex justify-between gap-2">
                  <span>{c.cause}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {c.count} × · {hours(c.hours)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="Alerts" icon={<AlertTriangle className="h-4 w-4" />}>
        <AlertList alerts={openAlerts} onChanged={() => void load()} showEquipment={false} />
      </SectionCard>

      <SectionCard
        title="Maintenance and calibration schedule"
        icon={<CalendarCheck className="h-4 w-4" />}
        actions={
          data.can_manage ? (
            <Button type="button" size="sm" className="gap-1.5" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              Schedule
            </Button>
          ) : null
        }
      >
        {data.plans.length ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Work</TableHead>
                  <TableHead>Every</TableHead>
                  <TableHead>Last done</TableHead>
                  <TableHead>Next due</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.plans.map((p) => (
                  <TableRow key={p.id} className={cn(!p.is_active && "opacity-60")}>
                    <TableCell className="text-sm">
                      <div className="font-medium">{p.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.kind_label}
                        {p.responsible ? ` · ${p.responsible.name}` : ""}
                        {p.closed_reason ? ` · Closed: ${p.closed_reason}` : ""}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{p.interval_days} days</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{formatDay(p.last_done_on)}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDay(p.next_due_on)} <Chip className={STATE_STYLE[p.state]}>{STATE_LABEL[p.state]}</Chip>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        {p.can_record ? (
                          <Button type="button" size="sm" variant="outline" onClick={() => setCompleting(p)}>
                            Record done
                          </Button>
                        ) : null}
                        {data.can_manage && p.is_active ? (
                          <Button type="button" size="sm" variant="ghost" onClick={() => setClosing(p)}>
                            Close
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="px-4 py-3 text-sm text-muted-foreground">Nothing scheduled yet.</p>
        )}
      </SectionCard>

      {data.completions.length ? (
        <SectionCard title="Maintenance log">
          <ul className="divide-y text-sm">
            {data.completions.map((c) => (
              <li key={c.id} className="px-4 py-2">
                <span className="font-medium">{formatDay(c.done_on)}</span> · {c.plan_title}
                {c.done_by ? ` · ${c.done_by.name}` : ""}
                {c.report_reference ? ` · Ref ${c.report_reference}` : ""}
                {c.notes ? <div className="text-xs text-muted-foreground">{c.notes}</div> : null}
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      {data.can_manage ? (
        <SectionCard title="Uptime target and early warning">
          <div className="grid gap-3 p-4 sm:grid-cols-4 sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="up-target">Uptime target (%)</Label>
              <Input id="up-target" type="number" min={0} max={100} step="0.5" value={target.uptime_target_pct} onChange={(e) => setTarget((t) => ({ ...t, uptime_target_pct: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="up-count">Warn after breakdowns (0 = off)</Label>
              <Input id="up-count" type="number" min={0} max={50} value={target.breakdown_alert_count} onChange={(e) => setTarget((t) => ({ ...t, breakdown_alert_count: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="up-window">…within (days)</Label>
              <Input id="up-window" type="number" min={7} max={365} value={target.breakdown_window_days} onChange={(e) => setTarget((t) => ({ ...t, breakdown_window_days: e.target.value }))} />
            </div>
            <Button
              type="button"
              onClick={async () => {
                const res = await upkeepApi.saveSetting(equipmentId, {
                  uptime_target_pct: Number(target.uptime_target_pct),
                  breakdown_alert_count: Number(target.breakdown_alert_count),
                  breakdown_window_days: Number(target.breakdown_window_days),
                });
                if (res.error) toast.error(res.error);
                else {
                  toast.success("Saved");
                  void load();
                }
              }}
            >
              Save
            </Button>
          </div>
        </SectionCard>
      ) : null}

      <PlanDialog
        open={adding}
        onOpenChange={setAdding}
        kinds={data.kinds}
        onSave={async (input) => {
          const res = await upkeepApi.createPlan(equipmentId, input);
          if (res.error) {
            toast.error(res.error);
            return false;
          }
          toast.success("Scheduled");
          void load();
          return true;
        }}
      />
      <CompleteDialog plan={completing} onOpenChange={(v) => !v && setCompleting(null)} onDone={() => void load()} />
      <PromptDialog
        open={closing !== null}
        onOpenChange={(v) => !v && setClosing(null)}
        title="Close this schedule"
        description="No more reminders are sent for it. Past completions stay in the log."
        confirmLabel="Close schedule"
        onConfirm={async (reason) => {
          if (!closing) return false;
          const res = await upkeepApi.closePlan(closing.id, reason);
          if (res.error) {
            toast.error(res.error);
            return false;
          }
          void load();
          return true;
        }}
      />
    </div>
  );
}

// --------------------------------------------------------------------------- page
export default function EquipmentUpkeep() {
  const [params, setParams] = useSearchParams();
  const selected = Number(params.get("equipment")) || null;
  const [days, setDays] = useState(90);
  const [rows, setRows] = useState<UpkeepListRow[] | null>(null);
  const [alerts, setAlerts] = useState<UpkeepAlert[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [list, al] = await Promise.all([upkeepApi.list({ days }), upkeepApi.alerts()]);
    setLoading(false);
    if (list.error) toast.error(list.error);
    setRows(list.data?.results ?? []);
    setAlerts(al.data?.results ?? []);
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const list = rows ?? [];
    const sorted = [...list].sort((a, b) => b.open_alerts - a.open_alerts || a.uptime_pct - b.uptime_pct);
    return f ? sorted.filter((r) => `${r.equipment.name} ${r.equipment.code}`.toLowerCase().includes(f)) : sorted;
  }, [rows, filter]);

  const open = (id: number | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set("equipment", String(id));
    else next.delete("equipment");
    setParams(next, { replace: false });
  };

  return (
    <TrainingPageFrame
      title="Equipment upkeep"
      description="Maintenance and calibration schedule, uptime against target, and early warnings before equipment fails."
      icon={<Wrench className="h-6 w-6" />}
      onRefresh={() => void load()}
      refreshing={loading}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Label htmlFor="upkeep-window" className="text-sm">
          Window
        </Label>
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger id="upkeep-window" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WINDOWS.map((d) => (
              <SelectItem key={d} value={String(d)}>
                Last {d} days
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {selected ? (
        <UpkeepDetailView equipmentId={selected} days={days} onBack={() => { open(null); void load(); }} />
      ) : (
        <div className="space-y-4">
          <SectionCard title={`Open alerts (${alerts.length})`} icon={<AlertTriangle className="h-4 w-4" />}>
            <AlertList alerts={alerts} onChanged={() => void load()} />
          </SectionCard>
          <SectionCard title="Equipment">
            <div className="p-3">
              <div className="relative max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
                <Input className="pl-8" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by name or code" aria-label="Filter equipment" />
              </div>
            </div>
            {rows === null ? (
              <LoadingBlock />
            ) : !visible.length ? (
              <EmptyState title="No equipment" description="Upkeep is shown for equipment you manage or operate." />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Equipment</TableHead>
                      <TableHead>Uptime / target</TableHead>
                      <TableHead>Breakdowns</TableHead>
                      <TableHead>Downtime</TableHead>
                      <TableHead>Next maintenance</TableHead>
                      <TableHead>Alerts</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((r) => (
                      <TableRow key={r.equipment.equipment_id} className="cursor-pointer" onClick={() => open(r.equipment.equipment_id)}>
                        <TableCell className="text-sm">
                          <button
                            type="button"
                            className="text-left font-medium text-primary hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              open(r.equipment.equipment_id);
                            }}
                          >
                            {r.equipment.name}
                          </button>
                          <div className="text-xs text-muted-foreground">{r.equipment.code}</div>
                        </TableCell>
                        <TableCell>
                          <UptimeValue value={r.uptime_pct} target={r.target_pct} below={r.below_target} />
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">{r.breakdowns}</TableCell>
                        <TableCell className="text-sm tabular-nums">{hours(r.downtime_hours)}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{r.plans ? formatDay(r.next_due_on) : <span className="text-muted-foreground">Not scheduled</span>}</TableCell>
                        <TableCell>
                          {r.open_alerts ? (
                            <Chip className={STATE_STYLE.OVERDUE}>{r.open_alerts}</Chip>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </SectionCard>
        </div>
      )}
    </TrainingPageFrame>
  );
}

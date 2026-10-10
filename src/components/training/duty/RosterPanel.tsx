import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { trainingApi } from "@/lib/trainingApi";
import type { RosterEntry } from "@/lib/trainingOpsTypes";
import type { TrainingEquipmentRef, TrainingUserRef } from "@/lib/trainingTypes";
import { cn } from "@/lib/utils";
import { EquipmentPicker } from "../EquipmentPicker";
import { formatDate } from "../trainingHelpers";
import { EmptyState, LoadingBlock, PromptDialog, StatusChip, runTrainingAction } from "../trainingUi";

type RosterAction = "pause" | "resume" | "remove";

const ACTION_COPY: Record<RosterAction, { title: string; label: string; success: string; destructive?: boolean }> = {
  pause: { title: "Pause this operator?", label: "Pause", success: "Operator paused — they are skipped in the rotation" },
  resume: { title: "Resume this operator?", label: "Resume", success: "Operator back in the rotation" },
  remove: { title: "Remove from the roster?", label: "Remove", success: "Removed from the roster", destructive: true },
};

function AddOperatorDialog({
  equipment,
  open,
  onOpenChange,
  onAdded,
}: {
  equipment: TrainingEquipmentRef | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdded: () => void;
}) {
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<TrainingUserRef[]>([]);
  const [searching, setSearching] = useState(false);
  const [person, setPerson] = useState<TrainingUserRef | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setQ("");
      setPeople([]);
      setPerson(null);
      setReason("");
    }
  }, [open]);

  useEffect(() => {
    if (!equipment || q.trim().length < 2 || person) return;
    let live = true;
    setSearching(true);
    const t = window.setTimeout(() => {
      void trainingApi.rosterPeople(equipment.equipment_id, q.trim()).then((res) => {
        if (!live) return;
        setPeople(res.data?.results ?? []);
        setSearching(false);
      });
    }, 300);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [equipment, q, person]);

  const save = async () => {
    if (!equipment || !person) return;
    setBusy(true);
    const res = await runTrainingAction(
      trainingApi.addToRoster({ equipment_id: equipment.equipment_id, user_id: person.id, reason: reason.trim() }),
      `${person.name} added to the roster`,
    );
    setBusy(false);
    if (!res.error) {
      onAdded();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add an operator</DialogTitle>
          <DialogDescription>
            For someone qualified outside the portal (e.g. trained by the vendor). Certified operators and approved TA nominees join automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {person ? (
            <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
              <div>
                <p className="text-sm font-medium">{person.name}</p>
                <p className="text-xs text-muted-foreground">{person.email}</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setPerson(null)}>
                Change
              </Button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="roster-search">Student</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
                <Input id="roster-search" className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or email" autoFocus />
              </div>
              {searching ? <p className="text-xs text-muted-foreground">Searching…</p> : null}
              {people.length ? (
                <ul className="max-h-56 overflow-y-auto rounded-md border border-border/70">
                  {people.map((p) => (
                    <li key={p.id}>
                      <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50" onClick={() => setPerson(p)}>
                        {p.name} <span className="text-xs text-muted-foreground">{p.email}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="roster-reason">Why are they qualified? *</Label>
            <Textarea id="roster-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Vendor training certificate dated 12 Aug 2026" />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" onClick={() => void save()} disabled={!person || !reason.trim() || busy}>
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Add to roster
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CapEditor({ entry, onSaved }: { entry: RosterEntry; onSaved: () => void }) {
  const [value, setValue] = useState(entry.max_hours_week != null ? String(entry.max_hours_week) : "");
  const dirty = value !== (entry.max_hours_week != null ? String(entry.max_hours_week) : "");
  const save = async () => {
    const res = await runTrainingAction(
      trainingApi.updateRoster(entry.id, { max_hours_week: value.trim() === "" ? null : Number(value) }),
      "Weekly cap saved",
    );
    if (!res.error) onSaved();
  };
  return (
    <div className="flex items-center gap-1">
      <Input
        type="number"
        min={1}
        max={80}
        step={1}
        className="h-8 w-20"
        value={value}
        placeholder="Policy"
        aria-label={`Weekly hour cap for ${entry.user.name}`}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && dirty && void save()}
      />
      {dirty ? (
        <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => void save()}>
          Save
        </Button>
      ) : null}
    </div>
  );
}

export function RosterPanel({ refreshKey }: { refreshKey: number }) {
  const [equipment, setEquipment] = useState<TrainingEquipmentRef | null>(null);
  const [showRemoved, setShowRemoved] = useState(false);
  const [rows, setRows] = useState<RosterEntry[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<{ entry: RosterEntry; action: RosterAction } | null>(null);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    const res = await trainingApi.roster({ equipment_id: equipment?.equipment_id, include_removed: showRemoved });
    if (res.error) toast.error(res.error);
    setRows(res.data?.results ?? []);
  }, [equipment, showRemoved]);

  useEffect(() => {
    setRows(null);
    void load();
  }, [load, refreshKey]);

  const visible = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!rows || !term) return rows;
    return rows.filter((r) => [r.user.name, r.user.email ?? "", r.department_name, r.faculty?.name ?? "", r.equipment.name].some((v) => v.toLowerCase().includes(term)));
  }, [rows, filter]);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] md:items-center">
        <EquipmentPicker managed value={equipment} onChange={setEquipment} placeholder="All equipment you manage" />
        <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by name, department, faculty" aria-label="Filter roster" />
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={showRemoved} onCheckedChange={setShowRemoved} /> Show removed
        </label>
        <Button type="button" onClick={() => setAdding(true)} disabled={!equipment} title={equipment ? undefined : "Choose the equipment first"}>
          <UserPlus className="mr-1.5 h-4 w-4" /> Add operator
        </Button>
      </div>
      {visible === null ? (
        <LoadingBlock />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="No operators yet"
          description="People with an operator-level certification (or an approved TA nomination) for this equipment appear here automatically."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border/70">
          <Table className="min-w-[860px]" stackOnMobile>
            <TableHeader>
              <TableRow>
                <TableHead>Operator</TableHead>
                {!equipment ? <TableHead>Equipment</TableHead> : null}
                <TableHead>Basis</TableHead>
                <TableHead>Faculty group / department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Max h/week</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((r) => (
                <TableRow key={r.id} className={cn(r.status === "REMOVED" && "opacity-60")}>
                  <TableCell>
                    <p className="text-sm font-medium">{r.user.name}</p>
                    <p className="text-xs text-muted-foreground">{r.user.email}</p>
                  </TableCell>
                  {!equipment ? <TableCell className="text-sm">{r.equipment.name}</TableCell> : null}
                  <TableCell className="text-xs">
                    <p>{r.basis || r.source_label}</p>
                    {r.award?.valid_until ? <p className="text-muted-foreground">valid to {formatDate(r.award.valid_until)}</p> : null}
                    {!r.eligible ? <p className="text-rose-700 dark:text-rose-300">Certification no longer valid</p> : null}
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.faculty?.name ?? "—"}
                    {r.department_name ? <p className="text-muted-foreground">{r.department_name}</p> : null}
                  </TableCell>
                  <TableCell>
                    <StatusChip kind="roster" status={r.status} label={r.status_label} />
                    {r.status_reason ? <p className="mt-0.5 max-w-[14rem] text-[11px] text-muted-foreground">{r.status_reason}</p> : null}
                  </TableCell>
                  <TableCell>{r.status !== "REMOVED" ? <CapEditor key={`${r.id}-${r.max_hours_week}`} entry={r} onSaved={() => void load()} /> : "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {r.status === "ACTIVE" ? (
                        <Button type="button" size="sm" variant="outline" onClick={() => setPending({ entry: r, action: "pause" })}>
                          Pause
                        </Button>
                      ) : null}
                      {r.status !== "ACTIVE" ? (
                        <Button type="button" size="sm" variant="outline" onClick={() => setPending({ entry: r, action: "resume" })}>
                          {r.status === "REMOVED" ? "Restore" : "Resume"}
                        </Button>
                      ) : null}
                      {r.status !== "REMOVED" ? (
                        <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => setPending({ entry: r, action: "remove" })}>
                          Remove
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

      <AddOperatorDialog equipment={equipment} open={adding} onOpenChange={setAdding} onAdded={() => void load()} />
      <PromptDialog
        open={Boolean(pending)}
        onOpenChange={(v) => !v && setPending(null)}
        title={pending ? ACTION_COPY[pending.action].title : ""}
        description={pending ? `${pending.entry.user.name} · ${pending.entry.equipment.name}` : undefined}
        confirmLabel={pending ? ACTION_COPY[pending.action].label : "Confirm"}
        destructive={pending ? Boolean(ACTION_COPY[pending.action].destructive) : false}
        required={pending?.action !== "resume"}
        onConfirm={async (reason) => {
          if (!pending) return false;
          const res = await runTrainingAction(trainingApi.rosterAction(pending.entry.id, pending.action, reason), ACTION_COPY[pending.action].success);
          if (res.error) return false;
          void load();
          return true;
        }}
      />
    </div>
  );
}

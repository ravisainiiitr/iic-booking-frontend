import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, History, Loader2, RefreshCw, Search, ToggleRight } from "lucide-react";
import { toast } from "sonner";
import { PageHero, PageShell, StandaloneOnly } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import {
  cellState,
  departmentModulesApi,
  describeChange,
  stateLabel,
  type CellChange,
  type DepartmentRow,
  type HistoryEntry,
  type ModuleCell,
  type ModuleKey,
  type ModuleMatrix,
  type ModuleMeta,
  type PendingChange,
} from "@/lib/departmentModulesApi";

const REASON_MIN = 5;

type Filter = "all" | "in_use" | "restricted";

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function inUse(row: DepartmentRow): boolean {
  return Object.entries(row.cells).some(([key, cell]) =>
    key === "procurement" ? cell.enabled : (cell.configured && cell.enabled) || Boolean(cell.usage),
  );
}

function restricted(row: DepartmentRow): boolean {
  return Object.entries(row.cells).some(([key, cell]) => key !== "procurement" && (!cell.enabled || cell.test_users_only));
}

function ModuleCellControls({
  department,
  module,
  cell,
  busy,
  onChange,
}: {
  department: DepartmentRow;
  module: ModuleMeta;
  cell: ModuleCell;
  busy: boolean;
  onChange: (change: Omit<CellChange, "reason">) => void;
}) {
  const state = cellState(cell);
  const restrictLabel = module.key === "procurement" ? "Pilot users only" : "Test users only";
  const idBase = `dm-${department.id}-${module.key}`;
  const usage = module.key === "procurement" ? cell.pilot_user_count ?? 0 : cell.usage ?? 0;
  return (
    <div className="flex min-w-[10rem] flex-col gap-1.5" title={cell.note || undefined}>
      <div className="flex items-center gap-2">
        <Switch
          id={`${idBase}-on`}
          checked={cell.enabled}
          disabled={busy}
          onCheckedChange={(v) => onChange({ enabled: v })}
          aria-label={`${module.label} for ${department.name}`}
        />
        <span
          className={
            state === "off"
              ? "text-sm text-muted-foreground"
              : state === "test"
                ? "text-sm font-medium text-amber-700 dark:text-amber-300"
                : "text-sm font-medium text-emerald-700 dark:text-emerald-300"
          }
        >
          {stateLabel(module.key, cell)}
        </span>
        {module.key !== "procurement" && cell.source === "new" && !cell.enabled ? (
          <Badge
            variant="outline"
            className="text-[10px]"
            title="Department created after department switches were introduced: off until you turn it on."
          >
            New department
          </Badge>
        ) : !cell.configured && module.key !== "procurement" ? (
          <Badge variant="outline" className="text-[10px]" title="Never saved: works as it did before department switches existed.">
            As before
          </Badge>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id={`${idBase}-test`}
          checked={cell.test_users_only}
          disabled={busy || !cell.enabled}
          onCheckedChange={(v) => onChange({ test_users_only: v === true })}
          aria-label={`${restrictLabel}: ${module.label} for ${department.name}`}
        />
        <Label htmlFor={`${idBase}-test`} className="text-xs font-normal text-muted-foreground">
          {restrictLabel}
        </Label>
      </div>
      {usage ? (
        <span className="text-xs text-muted-foreground">
          {usage} {module.usage_label}
        </span>
      ) : null}
    </div>
  );
}

function ReasonDialog({
  pending,
  onCancel,
  onConfirm,
}: {
  pending: PendingChange | null;
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<boolean>;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (pending) setReason("");
  }, [pending]);

  if (!pending) return null;
  const { title, detail } = describeChange(pending);
  const valid = reason.trim().length >= REASON_MIN;

  const submit = async () => {
    if (!valid) return;
    setSaving(true);
    const ok = await onConfirm(reason.trim());
    setSaving(false);
    if (ok) setReason("");
  };

  return (
    <Dialog open onOpenChange={(open) => (!open && !saving ? onCancel() : undefined)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {detail ? `${detail} ` : ""}The change is recorded in the history with your name and reason.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="dm-reason">Reason</Label>
          <Textarea
            id="dm-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this changing?"
            rows={3}
            autoFocus
          />
          {!valid && reason.length > 0 ? (
            <p className="text-xs text-destructive">Give a reason of at least {REASON_MIN} characters.</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={!valid || saving}>
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Save change
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function changeSummary(entry: HistoryEntry): string {
  const label = (v: HistoryEntry["new"]) =>
    v.enabled === undefined ? "Not configured" : stateLabel(entry.module_key, { enabled: Boolean(v.enabled), test_users_only: Boolean(v.test_users_only) });
  if (entry.action === "module.seeded") return `Starting state: ${label(entry.new)}`;
  if (entry.action === "module.new_department_off") return "New department: starts Off";
  return `${label(entry.old)} → ${label(entry.new)}`;
}

function HistoryDialog({
  open,
  onClose,
  matrix,
  initialDepartment,
}: {
  open: boolean;
  onClose: () => void;
  matrix: ModuleMatrix;
  initialDepartment: number | null;
}) {
  const [department, setDepartment] = useState<string>("all");
  const [module, setModule] = useState<string>("all");
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setDepartment(initialDepartment ? String(initialDepartment) : "all");
      setModule("all");
    }
  }, [open, initialDepartment]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    departmentModulesApi
      .history({
        department: department === "all" ? undefined : Number(department),
        module: module === "all" ? undefined : (module as ModuleKey),
        limit: 300,
      })
      .then((res) => alive && setEntries(res.results))
      .catch((err: Error) => {
        if (alive) {
          setEntries([]);
          toast.error(err.message || "Could not load the history.");
        }
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [open, department, module]);

  const moduleLabel = (key: ModuleKey) => matrix.modules.find((m) => m.key === key)?.label ?? key;

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Change history</DialogTitle>
          <DialogDescription>Every change to a department switch, with who made it and why. Entries are never deleted.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          <Select value={department} onValueChange={setDepartment}>
            <SelectTrigger className="w-64" aria-label="Department">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {matrix.departments.map((d) => (
                <SelectItem key={d.id} value={String(d.id)}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={module} onValueChange={setModule}>
            <SelectTrigger className="w-56" aria-label="Module">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All modules</SelectItem>
              {matrix.modules.map((m) => (
                <SelectItem key={m.key} value={m.key}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {loading && !entries ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !entries?.length ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No changes recorded yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Change</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap text-xs">{formatWhen(e.created_at)}</TableCell>
                  <TableCell className="text-sm">{e.department}</TableCell>
                  <TableCell className="text-sm">{moduleLabel(e.module_key)}</TableCell>
                  <TableCell className="text-sm">{changeSummary(e)}</TableCell>
                  <TableCell className="max-w-xs text-sm">{e.reason}</TableCell>
                  <TableCell className="text-sm">{e.actor ?? "System"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function AdminDepartmentModules() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const isAdmin = String(user?.user_type ?? "").toLowerCase() === "admin";

  const [matrix, setMatrix] = useState<ModuleMatrix | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyDepartment, setHistoryDepartment] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setMatrix(await departmentModulesApi.matrix());
    } catch (err) {
      setError((err as Error).message || "Could not load department modules.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (matrix?.departments ?? []).filter((d) => {
      if (q && !d.name.toLowerCase().includes(q) && !d.code.toLowerCase().includes(q)) return false;
      if (filter === "in_use") return inUse(d);
      if (filter === "restricted") return restricted(d);
      return true;
    });
  }, [matrix, query, filter]);

  const confirm = async (reason: string): Promise<boolean> => {
    if (!pending) return false;
    const { department, module, change } = pending;
    try {
      const res = await departmentModulesApi.update(department.id, module.key, { ...change, reason });
      setMatrix((m) =>
        m
          ? {
              ...m,
              departments: m.departments.map((d) =>
                d.id === department.id ? { ...d, cells: { ...d.cells, [module.key]: { ...d.cells[module.key], ...res.cell } } } : d,
              ),
            }
          : m,
      );
      toast.success(`${module.label} for ${department.name}: ${stateLabel(module.key, res.cell)}.`);
      setPending(null);
      return true;
    } catch (err) {
      toast.error((err as Error).message || "Could not save the change.");
      return false;
    }
  };

  const openHistory = (departmentId: number | null) => {
    setHistoryDepartment(departmentId);
    setHistoryOpen(true);
  };

  return (
    <PageShell>
      <main className="container mx-auto px-4 py-5">
        <StandaloneOnly>
          <PageHero
            title="Department Modules"
            description="Switch Department Sync, Remote Analysis, Training & Certification and Procurement & Assets on or off per department, or limit them to test users."
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/admin-settings")}
              className="mb-4 text-white/90 hover:bg-white/20 hover:text-white"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Admin Settings
            </Button>
          </PageHero>
        </StandaloneOnly>

        {authLoading ? null : !isAdmin ? (
          <p className="rounded-lg border p-6 text-sm text-muted-foreground">Only the Main Administrator can manage department modules.</p>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">Off</strong> stops new work for the department's equipment; bookings, sessions and
                workspaces that already started finish normally. <strong className="text-foreground">Test users only</strong> keeps the
                module for test accounts (Procurement: its pilot users). Every change needs a reason and is kept in the history.
              </p>
              <p className="mt-1">
                The global switches and per-equipment settings still apply: a department switch can only narrow them.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search departments"
                  className="w-64 pl-8"
                  aria-label="Search departments"
                />
              </div>
              <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
                <SelectTrigger className="w-56" aria-label="Show">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All departments</SelectItem>
                  <SelectItem value="in_use">Using a module</SelectItem>
                  <SelectItem value="restricted">Switched off or test-only</SelectItem>
                </SelectContent>
              </Select>
              <div className="ml-auto flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => openHistory(null)} disabled={!matrix}>
                  <History className="mr-1.5 h-4 w-4" />
                  History
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
                  <RefreshCw className={loading ? "mr-1.5 h-4 w-4 animate-spin" : "mr-1.5 h-4 w-4"} />
                  Refresh
                </Button>
              </div>
            </div>

            {error ? (
              <p className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">{error}</p>
            ) : loading && !matrix ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : matrix ? (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[14rem]">Department</TableHead>
                      {matrix.modules.map((m) => (
                        <TableHead key={m.key} title={m.off_help}>
                          {m.label}
                        </TableHead>
                      ))}
                      <TableHead className="w-12">
                        <span className="sr-only">History</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={matrix.modules.length + 2} className="py-8 text-center text-sm text-muted-foreground">
                          No departments match.
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="align-top">
                            <div className="font-medium">{d.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {d.code ? `${d.code} · ` : ""}
                              {d.equipment_count} equipment
                            </div>
                          </TableCell>
                          {matrix.modules.map((m) => (
                            <TableCell key={m.key} className="align-top">
                              <ModuleCellControls
                                department={d}
                                module={m}
                                cell={d.cells[m.key]}
                                busy={pending !== null}
                                onChange={(change) => setPending({ department: d, module: m, change })}
                              />
                            </TableCell>
                          ))}
                          <TableCell className="align-top">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => openHistory(d.id)}
                              aria-label={`History for ${d.name}`}
                            >
                              <History className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            ) : null}

            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ToggleRight className="h-3.5 w-3.5" />
              Procurement & Assets pilot users are chosen on the Procurement & Assets settings page.
              <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => navigate("/procurement/settings")}>
                Open settings
              </Button>
            </p>
          </div>
        )}
      </main>

      <ReasonDialog pending={pending} onCancel={() => setPending(null)} onConfirm={confirm} />
      {matrix ? (
        <HistoryDialog open={historyOpen} onClose={() => setHistoryOpen(false)} matrix={matrix} initialDepartment={historyDepartment} />
      ) : null}
    </PageShell>
  );
}

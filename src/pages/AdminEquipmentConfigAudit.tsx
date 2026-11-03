import { useCallback, useEffect, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, History, Loader2, Search } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import {
  apiClient,
  type EquipmentConfigAuditFacets,
  type EquipmentConfigAuditPage,
  type EquipmentConfigAuditRow,
} from "@/lib/api";
import { formatDMYTime } from "@/lib/dateFormat";

const ALL = "__all__";

type Filters = {
  equipment_id: string;
  user_id: string;
  setting: string;
  source: string;
  date_from: string;
  date_to: string;
  q: string;
};

const EMPTY: Filters = { equipment_id: ALL, user_id: ALL, setting: ALL, source: ALL, date_from: "", date_to: "", q: "" };

function clean(filters: Filters, page: number) {
  const pick = (v: string) => (v === ALL ? undefined : v);
  return {
    equipment_id: pick(filters.equipment_id),
    user_id: filters.user_id === "system" ? undefined : pick(filters.user_id),
    system: filters.user_id === "system" ? "1" : undefined,
    setting: pick(filters.setting),
    source: pick(filters.source),
    date_from: filters.date_from || undefined,
    date_to: filters.date_to || undefined,
    q: filters.q.trim() || undefined,
    page,
    page_size: 25,
  };
}

function Value({ text }: { text: string }) {
  if (!text) return <span className="text-muted-foreground">—</span>;
  return <span className="break-words">{text}</span>;
}

/** Main Administrator: every change to equipment configuration, with who, when, from where and old → new value. */
export default function AdminEquipmentConfigAudit() {
  const { user } = useAuth();
  const isMainAdmin = user?.user_type === "admin";
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<EquipmentConfigAuditPage | null>(null);
  const [facets, setFacets] = useState<EquipmentConfigAuditFacets | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<EquipmentConfigAuditRow | null>(null);

  useEffect(() => {
    if (!isMainAdmin) return;
    void apiClient.getEquipmentConfigAuditFacets().then((res) => res.data && setFacets(res.data));
  }, [isMainAdmin]);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiClient.getEquipmentConfigAudit(clean(filters, page));
    setLoading(false);
    if (res.error || !res.data) {
      setError(res.error || "Could not load the audit trail.");
      return;
    }
    setError("");
    setData(res.data);
  }, [filters, page]);

  useEffect(() => {
    if (isMainAdmin) void load();
  }, [isMainAdmin, load]);

  const set = (key: keyof Filters) => (value: string) => {
    setPage(1);
    setFilters((f) => ({ ...f, [key]: value }));
  };

  const openDetail = async (row: EquipmentConfigAuditRow) => {
    setDetail(row);
    const res = await apiClient.getEquipmentConfigAuditDetail(row.id);
    if (res.data) setDetail(res.data);
  };

  if (!isMainAdmin) {
    return (
      <PageShell>
        <main className="container mx-auto max-w-3xl px-4 py-10">
          <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">
            Only the Main Administrator can view the equipment configuration audit trail.
          </p>
        </main>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <main className="container mx-auto max-w-7xl space-y-5 px-4 py-6">
        <header className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
            <History className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Equipment Configuration Audit Trail</h1>
            <p className="text-sm text-muted-foreground">
              Every change to equipment settings, slot masters and charge profiles: who or which system process made it,
              when, from where, and the value before and after.
            </p>
          </div>
        </header>

        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <form
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              set("q")(query);
            }}
          >
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="audit-q">Search</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="audit-q"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onBlur={() => query !== filters.q && set("q")(query)}
                  placeholder="Equipment, setting, value or person"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Equipment</Label>
              <Select value={filters.equipment_id} onValueChange={set("equipment_id")}>
                <SelectTrigger aria-label="Equipment"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All equipment</SelectItem>
                  {(facets?.equipment ?? []).map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>{e.name || e.code} {e.code ? `(${e.code})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Changed by</Label>
              <Select value={filters.user_id} onValueChange={set("user_id")}>
                <SelectTrigger aria-label="Changed by"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Anyone</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                  {(facets?.users ?? []).map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Setting</Label>
              <Select value={filters.setting} onValueChange={set("setting")}>
                <SelectTrigger aria-label="Setting"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All settings</SelectItem>
                  {(facets?.settings ?? []).map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label || s.value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Select value={filters.source} onValueChange={set("source")}>
                <SelectTrigger aria-label="Source"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All sources</SelectItem>
                  {(data?.sources ?? []).map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="audit-from">From</Label>
              <Input id="audit-from" type="date" value={filters.date_from} onChange={(e) => set("date_from")(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="audit-to">To</Label>
              <Input id="audit-to" type="date" value={filters.date_to} onChange={(e) => set("date_to")(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setQuery("");
                  setPage(1);
                  setFilters(EMPTY);
                }}
              >
                Clear filters
              </Button>
            </div>
          </form>
        </section>

        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</p>
        ) : null}

        <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b px-4 py-2.5 text-sm text-muted-foreground">
            <span>{data ? `${data.count} change${data.count === 1 ? "" : "s"}` : " "}</span>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          </div>
          {data && data.results.length === 0 && !loading ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">No changes match these filters.</p>
          ) : (
            <ul className="divide-y" data-testid="audit-rows">
              {(data?.results ?? []).map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => void openDetail(row)}
                    className="grid w-full gap-1 px-4 py-3 text-left transition-colors hover:bg-muted/40 md:grid-cols-[10rem_1fr_1.3fr_15rem] md:items-center md:gap-4"
                  >
                    <span className="text-xs text-muted-foreground">{formatDMYTime(row.changed_at)}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{row.equipment_name || row.equipment_code}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {row.object_type !== "Equipment" ? `${row.object_type} · ` : ""}
                        {row.action === "UPDATED" ? row.setting_label || row.setting : row.action_label}
                      </span>
                    </span>
                    <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm">
                      <span className="max-w-[45%] truncate rounded bg-red-50 px-1.5 py-0.5 text-red-900 line-through decoration-red-300 dark:bg-red-950/40 dark:text-red-200">
                        {row.previous_value || "—"}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="max-w-[45%] truncate rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                        {row.new_value || "—"}
                      </span>
                    </span>
                    <span className="flex items-center gap-2 text-xs md:justify-end">
                      {row.is_system ? <Badge variant="secondary">System</Badge> : <span className="truncate">{row.changed_by}</span>}
                      <Badge variant="outline" className="whitespace-nowrap">{row.source_label}</Badge>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {data && data.num_pages > 1 ? (
            <div className="flex items-center justify-between border-t px-4 py-2.5 text-sm">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Previous
              </Button>
              <span className="text-muted-foreground">Page {data.page} of {data.num_pages}</span>
              <Button variant="outline" size="sm" disabled={page >= data.num_pages} onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          ) : null}
        </section>
      </main>

      <Dialog open={detail !== null} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{detail?.setting_label || detail?.setting || "Change"}</DialogTitle>
            <DialogDescription>
              {detail?.equipment_name} {detail?.equipment_code ? `(${detail.equipment_code})` : ""} · ID {detail?.equipment_id}
            </DialogDescription>
          </DialogHeader>
          {detail ? (
            <dl className="grid grid-cols-[8.5rem_1fr] gap-x-3 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Change</dt>
              <dd>{detail.action_label}{detail.object_type !== "Equipment" ? ` · ${detail.object_type} ${detail.object_label}` : ""}</dd>
              <dt className="text-muted-foreground">Setting</dt>
              <dd className="font-mono text-xs">{detail.setting}</dd>
              <dt className="text-muted-foreground">Before</dt>
              <dd><Value text={detail.previous_value} /></dd>
              <dt className="text-muted-foreground">After</dt>
              <dd><Value text={detail.new_value} /></dd>
              <dt className="text-muted-foreground">Changed by</dt>
              <dd>
                {detail.is_system ? "System" : detail.changed_by}
                {detail.changed_by_role ? ` · ${detail.changed_by_role}` : ""}
                {detail.changed_by_department ? ` · ${detail.changed_by_department}` : ""}
              </dd>
              <dt className="text-muted-foreground">When</dt>
              <dd>{formatDMYTime(detail.changed_at)}</dd>
              <dt className="text-muted-foreground">Source</dt>
              <dd>{detail.source_label}</dd>
              <dt className="text-muted-foreground">Process</dt>
              <dd className="break-all"><Value text={detail.process ?? ""} /></dd>
              <dt className="text-muted-foreground">Reference</dt>
              <dd className="break-all"><Value text={detail.reference ?? ""} /></dd>
            </dl>
          ) : null}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

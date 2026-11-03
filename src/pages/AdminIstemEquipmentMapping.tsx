import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Building2, Check, CheckCircle2, ChevronRight, CircleHelp, List, Loader2, RefreshCw, Search, Sparkles,
  Wifi, WifiOff, X, XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { PageShell } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import ConfidencePill from "@/components/istem/ConfidencePill";
import IstemListingPanel from "@/components/istem/IstemListingPanel";
import IstemMappingDialog from "@/components/istem/IstemMappingDialog";
import {
  INSTRUMENT_FILTERS, filterInstruments, isMapped, readAt, reasonText, sourceNote, type InstrumentFilter,
} from "@/components/istem/mappingModel";
import {
  apiClient,
  type IstemDepartmentProgress,
  type IstemDepartmentRow,
  type IstemEquipmentMappingList,
  type IstemMappingEquipmentRow,
  type IstemSource,
  type IstemSuggestionRow,
} from "@/lib/api";

type DepartmentKey = string;
const keyOf = (id: number | null | undefined): DepartmentKey => (id == null ? "none" : String(id));

type Suggestions = { rows: Record<number, IstemSuggestionRow>; source?: IstemSource; error?: string };

function Progress({ value, total }: { value: number; total: number }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="h-1.5 w-full rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-1.5 rounded-full ${pct === 100 ? "bg-emerald-500" : "bg-primary"}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function StepHeading({ n, title, hint, done }: { n: number; title: string; hint: string; done: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${done ? "bg-emerald-600 text-white" : "bg-primary/10 text-primary"}`}>
        {done ? <Check className="h-4 w-4" aria-hidden /> : n}
      </span>
      <div>
        <h3 className="text-base font-semibold leading-7">{title}</h3>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

function IstemStatus({ connected, source }: { connected: boolean; source?: IstemSource | null }) {
  if (!connected) {
    return <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs text-muted-foreground"><WifiOff className="h-3.5 w-3.5" />I-STEM not connected</span>;
  }
  if (source && !source.live) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
        title={sourceNote(source)}>
        <AlertTriangle className="h-3.5 w-3.5" />I-STEM not answering · list from {readAt(source.read_at) || "earlier"}
        {source.institute_id ? ` · institute ${source.institute_id}` : ""}
      </span>
    );
  }
  return <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200" title="The institute is the one I-STEM names when the portal signs in."><Wifi className="h-3.5 w-3.5" />I-STEM connected{source?.institute_id ? ` · institute ${source.institute_id}` : ""}</span>;
}

function MappedStatus({ row }: { row: IstemMappingEquipmentRow }) {
  const m = row.mapping!;
  const state = !m.is_active ? "off" : m.remote_found === true ? "found" : m.remote_found === false ? "missing" : "unchecked";
  return (
    <div className="min-w-0">
      <div className="truncate text-sm font-medium">{m.remote_equipment_name || "I-STEM equipment"}</div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono">{m.istem_equipment_id}</span>
        {state === "found" ? <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-3 w-3" />Found on I-STEM</span>
          : state === "missing" ? <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-400"><XCircle className="h-3 w-3" />Not found on I-STEM</span>
          : state === "off" ? <span>Switched off</span>
          : <span className="inline-flex items-center gap-1"><CircleHelp className="h-3 w-3" />Not checked yet</span>}
        {!m.sample_count_input_key ? <span className="text-amber-700 dark:text-amber-400">Samples field not set</span> : null}
      </div>
    </div>
  );
}

/** I-STEM equipment mapping, redesigned (3 Nov 2026): pick a department, link it to its I-STEM department, then map its
 * instruments from the suggestions. Main Admin sees every department; a department administrator sees their own. */
export default function AdminIstemEquipmentMapping() {
  const [data, setData] = useState<IstemEquipmentMappingList | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [istem, setIstem] = useState<{ rows: IstemDepartmentRow[]; source?: IstemSource; error?: string } | null>(null);
  const [selected, setSelected] = useState<DepartmentKey | null>(null);
  const [suggestions, setSuggestions] = useState<Record<DepartmentKey, Suggestions | undefined>>({});
  const [departmentText, setDepartmentText] = useState("");
  const [filter, setFilter] = useState<InstrumentFilter>("all");
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<IstemMappingEquipmentRow | null>(null);
  const [busy, setBusy] = useState<string>("");
  const [listOpen, setListOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiClient.getIstemEquipmentMappings();
    setLoading(false);
    if (res.error || !res.data) {
      setError(res.error || "Could not load the instruments.");
      return;
    }
    setError("");
    setData(res.data);
  }, []);

  const loadIstemDepartments = useCallback(async (refresh = false) => {
    const res = await apiClient.getIstemDepartmentMappings(refresh);
    if (res.error || !res.data) setIstem({ rows: [], error: res.error || "Could not read I-STEM's departments." });
    else setIstem({ rows: res.data.istem_departments, source: res.data.istem_source });
  }, []);

  const loadSuggestions = useCallback(async (key: DepartmentKey, refresh = false) => {
    if (key === "none") return;
    const res = await apiClient.getIstemEquipmentSuggestions(data?.all_departments ? key : undefined, refresh);
    setSuggestions((s) => ({
      ...s,
      [key]: res.error || !res.data
        ? { rows: {}, error: res.error || "Could not read I-STEM's list." }
        : { rows: Object.fromEntries(res.data.equipment.map((r) => [r.equipment_id, r])), source: res.data.istem_source },
    }));
  }, [data?.all_departments]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (data?.all_departments && data.istem_connected && !istem) void loadIstemDepartments();
  }, [data, istem, loadIstemDepartments]);

  const departments: IstemDepartmentProgress[] = useMemo(() => data?.departments ?? [], [data]);
  useEffect(() => {
    if (selected || !departments.length) return;
    const first = departments.find((d) => d.total > d.mapped && d.id != null) ?? departments[0];
    setSelected(keyOf(first.id));
  }, [departments, selected]);
  useEffect(() => {
    if (selected && data?.istem_connected && !suggestions[selected]) void loadSuggestions(selected);
  }, [selected, data?.istem_connected, suggestions, loadSuggestions]);

  const department = departments.find((d) => keyOf(d.id) === selected) ?? null;
  const instruments = useMemo(
    () => (data?.equipment ?? []).filter((r) => keyOf(r.department?.id) === selected),
    [data, selected],
  );
  const shown = useMemo(() => filterInstruments(instruments, filter, text), [instruments, filter, text]);
  const current = selected ? suggestions[selected] : undefined;
  const certain = instruments.filter((r) => !isMapped(r) && current?.rows[r.equipment_id]?.confident);
  const source = current?.source ?? istem?.source ?? null;

  const totals = useMemo(() => {
    const real = departments.filter((d) => d.id != null);
    return {
      departments: real.length,
      linked: real.filter((d) => (d.istem_department_ids?.length ?? 0) > 0).length,
      instruments: departments.reduce((n, d) => n + d.total, 0),
      mapped: departments.reduce((n, d) => n + d.mapped, 0),
      fbr: departments.reduce((n, d) => n + d.fbr_unmapped, 0),
    };
  }, [departments]);

  const refreshAll = async () => {
    setSuggestions({});
    setIstem(null);
    await load();
  };

  const accept = async (rows: IstemMappingEquipmentRow[]) => {
    const items = rows.flatMap((r) => {
      const s = current?.rows[r.equipment_id];
      const top = s?.candidates[0];
      return top ? [{ equipment_id: r.equipment_id, istem_equipment_id: top.equipment_id, sample_count_input_key: s.default_sample_key }] : [];
    });
    if (!items.length) return;
    setBusy(items.length === 1 ? `accept:${items[0].equipment_id}` : "accept-all");
    const res = await apiClient.saveIstemEquipmentMappingsBulk(items);
    setBusy("");
    if (res.error || !res.data) {
      toast.error(res.error || "Could not save.");
      return;
    }
    if (res.data.saved) toast.success(res.data.saved === 1 ? "Instrument mapped." : `${res.data.saved} instruments mapped.`);
    res.data.results.filter((r) => !r.ok).forEach((r) => toast.error(r.error || "Not saved."));
    res.data.results.filter((r) => r.ok).forEach((r) => (r.warnings ?? []).forEach((w) => toast.warning(w)));
    await load();
    if (selected) void loadSuggestions(selected);
  };

  const link = async (istemDepartmentId: string, departmentId: number | null) => {
    setBusy(`link:${istemDepartmentId}`);
    const res = await apiClient.saveIstemDepartmentMappings([{ istem_department_id: istemDepartmentId, department_id: departmentId }]);
    setBusy("");
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(departmentId == null ? `I-STEM department ${istemDepartmentId} unlinked.` : `Linked to I-STEM department ${istemDepartmentId}.`);
    await Promise.all([load(), loadIstemDepartments()]);
    if (selected) void loadSuggestions(selected);
  };

  const linkedIds = department?.istem_department_ids ?? [];
  const istemById = useMemo(() => Object.fromEntries((istem?.rows ?? []).map((r) => [r.istem_department_id, r])), [istem]);
  const linkOptions = useMemo(() => {
    if (!department) return [];
    return (istem?.rows ?? [])
      .filter((r) => r.istem_department_id && !linkedIds.includes(r.istem_department_id))
      .sort((a, b) => Number(b.suggested?.id === department.id) - Number(a.suggested?.id === department.id) || b.equipment_count - a.equipment_count);
  }, [istem, department, linkedIds]);

  const visibleDepartments = departments.filter((d) => d.name.toLowerCase().includes(departmentText.trim().toLowerCase()));
  const allDepartments = Boolean(data?.all_departments);

  return (
    <PageShell>
      <main className="container mx-auto max-w-7xl space-y-5 px-4 py-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">I-STEM mapping</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Link each department to its department on I-STEM, then match its instruments to I-STEM's equipment. Bookings
              that need an I-STEM FBR are then registered on I-STEM automatically.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {data ? <IstemStatus connected={data.istem_connected} source={source} /> : null}
            <Button variant="outline" size="sm" onClick={() => setListOpen(true)} disabled={!data?.istem_connected}>
              <List className="mr-1.5 h-4 w-4" />I-STEM's list
            </Button>
            <Button variant="outline" size="sm" onClick={() => void refreshAll()} disabled={loading}>
              <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
            </Button>
          </div>
        </header>

        {error ? <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p> : null}
        {data && source && !source.live ? (
          <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{sourceNote(source)} Mappings can still be saved; they are checked on I-STEM once it answers.</span>
          </p>
        ) : null}

        {data && allDepartments ? (
          <section aria-label="Institute summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ["Departments linked to I-STEM", `${totals.linked} / ${totals.departments}`],
              ["Instruments mapped", `${totals.mapped} / ${totals.instruments}`],
              ["FBR instruments still to map", String(totals.fbr)],
              ["Equipment on I-STEM", istem ? String(istem.rows.reduce((n, r) => n + r.equipment_count, 0)) : "—"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
              </div>
            ))}
          </section>
        ) : null}

        {data ? (
          <div className={allDepartments ? "grid gap-5 lg:grid-cols-[19rem_minmax(0,1fr)]" : ""}>
            {allDepartments ? (
              <aside className="rounded-xl border bg-card shadow-sm lg:sticky lg:top-20 lg:max-h-[calc(100vh-7rem)] lg:overflow-hidden" aria-label="Departments">
                <div className="space-y-2 border-b p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold"><Building2 className="h-4 w-4" />Departments</div>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-8" placeholder="Find a department" value={departmentText}
                      onChange={(e) => setDepartmentText(e.target.value)} aria-label="Find a department" />
                  </div>
                </div>
                <ul className="max-h-[60vh] overflow-auto p-1.5 lg:max-h-[calc(100vh-14rem)]">
                  {visibleDepartments.map((d) => {
                    const key = keyOf(d.id);
                    const active = key === selected;
                    const linked = (d.istem_department_ids?.length ?? 0) > 0;
                    return (
                      <li key={key}>
                        <button type="button" data-testid="department-item" aria-current={active ? "true" : undefined}
                          onClick={() => { setSelected(key); setFilter("all"); setText(""); }}
                          className={`group w-full rounded-lg px-3 py-2.5 text-left transition-colors ${active ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted/70"}`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-medium">{d.name}</span>
                            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{d.mapped}/{d.total}</span>
                          </div>
                          <div className="mt-1.5"><Progress value={d.mapped} total={d.total} /></div>
                          <div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
                            {d.id == null ? <span className="text-muted-foreground">Instruments without a department</span>
                              : linked ? <span className="text-emerald-700 dark:text-emerald-400">I-STEM dept {d.istem_department_ids!.join(", ")}</span>
                              : <span className="text-amber-700 dark:text-amber-400">Not linked to I-STEM</span>}
                            {d.fbr_unmapped ? <span className="ml-auto rounded bg-amber-100 px-1.5 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">{d.fbr_unmapped} FBR</span> : null}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                  {!visibleDepartments.length ? <li className="p-4 text-center text-sm text-muted-foreground">No department matches.</li> : null}
                </ul>
              </aside>
            ) : null}

            {department ? (
              <section className="space-y-5" aria-label={department.name}>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      {allDepartments ? <>Institute<ChevronRight className="h-3 w-3" /></> : null}Department
                    </div>
                    <h2 className="text-xl font-semibold">{department.name}</h2>
                  </div>
                  <div className="w-56 space-y-1 text-right">
                    <div className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{department.mapped}</span> of {department.total} instruments mapped</div>
                    <Progress value={department.mapped} total={department.total} />
                  </div>
                </div>

                {department.id != null ? (
                  <div className="rounded-xl border bg-card p-5 shadow-sm" data-testid="step-link">
                    <StepHeading n={1} done={linkedIds.length > 0} title="Link to the I-STEM department"
                      hint="I-STEM numbers its departments without names. Recognise it by its equipment; suggestions come from instruments already mapped." />
                    <div className="mt-4 space-y-3 pl-10">
                      {linkedIds.length ? (
                        <div className="flex flex-wrap gap-2">
                          {linkedIds.map((id) => {
                            const info = istemById[id];
                            return (
                              <span key={id} className="inline-flex items-center gap-2 rounded-lg border bg-muted/40 py-1.5 pl-3 pr-1.5 text-sm" data-testid="linked-istem-department">
                                <span className="font-medium">I-STEM dept {id}</span>
                                {info ? <span className="text-xs text-muted-foreground">{info.equipment_count} equipment{info.locations[0] ? ` · ${info.locations[0]}` : ""}</span> : null}
                                {allDepartments ? (
                                  <Button size="icon" variant="ghost" className="h-6 w-6" aria-label={`Unlink I-STEM department ${id}`}
                                    disabled={busy === `link:${id}`} onClick={() => void link(id, null)}><X className="h-3.5 w-3.5" /></Button>
                                ) : null}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Not linked yet: matching searches the institute's whole I-STEM list, which is slower to check.</p>
                      )}
                      {allDepartments && data.istem_connected ? (
                        istem?.error ? <p className="text-sm text-amber-800 dark:text-amber-300">{istem.error}</p>
                          : !istem ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Reading I-STEM's departments…</div>
                          : (
                            <Select value="" onValueChange={(v) => void link(v, department.id)}>
                              <SelectTrigger className="w-full sm:w-[34rem]" aria-label="Link an I-STEM department">
                                <SelectValue placeholder={linkedIds.length ? "Link another I-STEM department…" : "Choose the I-STEM department…"} />
                              </SelectTrigger>
                              <SelectContent>
                                {linkOptions.map((r) => (
                                  <SelectItem key={r.istem_department_id} value={r.istem_department_id}>
                                    {r.suggested?.id === department.id ? "★ Suggested · " : ""}I-STEM dept {r.istem_department_id} · {r.equipment_count} equipment
                                    {r.sample_equipment.length ? ` · ${r.sample_equipment.slice(0, 2).join(", ")}` : ""}
                                    {r.department ? ` · now: ${r.department.name}` : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div className="rounded-xl border bg-card shadow-sm" data-testid="step-instruments">
                  <div className="space-y-4 p-5 pb-3">
                    <StepHeading n={department.id != null ? 2 : 1} done={department.total > 0 && department.mapped === department.total}
                      title="Map the instruments"
                      hint="Each instrument shows its best match on I-STEM. Accept it, or choose another." />
                    <div className="flex flex-wrap items-center gap-2 pl-10">
                      <div className="inline-flex rounded-lg border p-0.5" role="tablist" aria-label="Show">
                        {INSTRUMENT_FILTERS.map((f) => (
                          <button key={f.value} type="button" role="tab" aria-selected={filter === f.value}
                            onClick={() => setFilter(f.value)}
                            className={`rounded-md px-3 py-1 text-sm transition-colors ${filter === f.value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                            {f.label}
                          </button>
                        ))}
                      </div>
                      <Input className="h-9 w-full sm:w-56" placeholder="Find an instrument" value={text}
                        onChange={(e) => setText(e.target.value)} aria-label="Find an instrument" />
                      <Button size="sm" className="ml-auto" disabled={!certain.length || busy === "accept-all"} onClick={() => void accept(certain)}>
                        {busy === "accept-all" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
                        Accept all certain ({certain.length})
                      </Button>
                    </div>
                    {current?.error ? <p className="pl-10 text-sm text-amber-800 dark:text-amber-300">{current.error}</p> : null}
                  </div>
                  <ul className="divide-y border-t">
                    {shown.map((row) => {
                      const s = current?.rows[row.equipment_id];
                      const top = s?.candidates[0];
                      const mapped = isMapped(row);
                      return (
                        <li key={row.equipment_id} data-testid="istem-mapping-row"
                          className="grid gap-3 px-5 py-3.5 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_auto] sm:items-center">
                          <div className="min-w-0">
                            <div className="truncate font-medium">{row.name}</div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{row.code}</span>
                              {row.requires_istem_fbr ? <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">I-STEM FBR</Badge> : null}
                            </div>
                          </div>
                          <div className="min-w-0">
                            {mapped ? <MappedStatus row={row} />
                              : !data.istem_connected ? <span className="text-sm text-muted-foreground">Not mapped</span>
                              : !current ? <span className="inline-flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Looking on I-STEM…</span>
                              : top ? (
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="truncate text-sm font-medium">{top.equipment_name}</span>
                                    <ConfidencePill score={top.score} />
                                  </div>
                                  <div className="truncate text-xs text-muted-foreground">
                                    <span className="font-mono">{top.equipment_id}</span> · {reasonText(top.reasons)}
                                    {s && s.candidates.length > 1 ? ` · ${s.candidates.length - 1} more option(s)` : ""}
                                  </div>
                                  {top.mapped_to.length ? <div className="text-xs text-amber-700 dark:text-amber-400">Already mapped to {top.mapped_to.map((m) => m.name).join(", ")}</div> : null}
                                </div>
                              ) : <span className="text-sm text-muted-foreground">No close match on I-STEM</span>}
                          </div>
                          <div className="flex justify-end gap-2">
                            {/* One-click Accept only for Likely and Certain matches; a weak one is reviewed in the dialog. */}
                            {!mapped && top && top.score >= 0.7 ? (
                              <Button size="sm" onClick={() => void accept([row])} disabled={busy === `accept:${row.equipment_id}`}>
                                {busy === `accept:${row.equipment_id}` ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}Accept
                              </Button>
                            ) : null}
                            <Button size="sm" variant="outline" onClick={() => setEditing(row)}>
                              {mapped ? "Change" : !top ? "Map" : top.score >= 0.7 ? "Choose other" : "Review"}
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                    {!shown.length ? (
                      <li className="px-5 py-10 text-center text-sm text-muted-foreground">
                        {instruments.length ? "No instruments match." : "This department has no instruments."}
                      </li>
                    ) : null}
                  </ul>
                </div>
              </section>
            ) : (
              <p className="rounded-xl border p-8 text-center text-sm text-muted-foreground">No instruments to map.</p>
            )}
          </div>
        ) : loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading…</div>
        ) : null}

        {editing && data ? (
          <IstemMappingDialog row={editing} connected={data.istem_connected} onClose={() => setEditing(null)}
            onSaved={() => { setEditing(null); void load(); if (selected) void loadSuggestions(selected); }} />
        ) : null}

        <Sheet open={listOpen} onOpenChange={setListOpen}>
          <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
            <SheetHeader>
              <SheetTitle>I-STEM's equipment list</SheetTitle>
              <SheetDescription>Every active I-STEM equipment of the institute, and the portal instrument mapped to it.</SheetDescription>
            </SheetHeader>
            <div className="mt-4">{listOpen && data ? <IstemListingPanel connected={data.istem_connected} /> : null}</div>
          </SheetContent>
        </Sheet>
      </main>
    </PageShell>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Building2, Check, CheckCircle2, CircleHelp, Link2, List, Loader2, RefreshCw, Search, Settings2, Sparkles,
  UploadCloud, Wifi, WifiOff, XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { PageShell } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import ConfidencePill from "@/components/istem/ConfidencePill";
import IstemDepartmentLinking from "@/components/istem/IstemDepartmentLinking";
import IstemInstituteCard from "@/components/istem/IstemInstituteCard";
import IstemEquipmentPicker from "@/components/istem/IstemEquipmentPicker";
import IstemListingPanel from "@/components/istem/IstemListingPanel";
import IstemMappingDialog from "@/components/istem/IstemMappingDialog";
import IstemEquipmentCreateDialog from "@/components/istem/IstemEquipmentCreateDialog";
import {
  INSTRUMENT_FILTERS, filterInstruments, isMapped, readAt, reasonText, sourceNote, type InstrumentFilter,
} from "@/components/istem/mappingModel";
import {
  apiClient,
  type IstemDepartmentProgress,
  type IstemDepartmentRow,
  type IstemEquipmentMappingList,
  type IstemEquipmentSearchRow,
  type IstemInstituteStatus,
  type IstemMappingEquipmentRow,
  type IstemSource,
  type IstemSuggestionRow,
} from "@/lib/api";

type DepartmentKey = string;
const keyOf = (id: number | null | undefined): DepartmentKey => (id == null ? "none" : String(id));
type Tab = "departments" | "equipment";

type Suggestions = { rows: Record<number, IstemSuggestionRow>; source?: IstemSource; error?: string };
type Listing = { rows: IstemEquipmentSearchRow[]; source?: IstemSource; error?: string };

/** The sample-count field to send: "A" (the usual "number of samples") or the only field. */
function defaultSampleKey(row: IstemMappingEquipmentRow): string {
  const keys = row.input_fields.map((f) => f.key);
  if (keys.includes("A")) return "A";
  return keys.length === 1 ? keys[0] : "";
}

function Progress({ value, total }: { value: number; total: number }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="h-1.5 w-full rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-1.5 rounded-full ${pct === 100 ? "bg-emerald-500" : "bg-primary"}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function IstemStatus({ connected, source, institute }: { connected: boolean; source?: IstemSource | null; institute?: IstemInstituteStatus | null }) {
  const instituteText = institute?.institute_id
    ? ` · institute ${institute.institute_id}${institute.source === "portal" ? " (set on portal)" : ""}`
    : source?.institute_id ? ` · institute ${source.institute_id}` : "";
  if (!connected) {
    return <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs text-muted-foreground"><WifiOff className="h-3.5 w-3.5" />I-STEM not connected</span>;
  }
  if (source && !source.live) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
        title={sourceNote(source)}>
        <AlertTriangle className="h-3.5 w-3.5" />I-STEM not answering · list from {readAt(source.read_at) || "earlier"}
        {instituteText}
      </span>
    );
  }
  return <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200" title="The institute is the one I-STEM names when the portal signs in."><Wifi className="h-3.5 w-3.5" />I-STEM connected{instituteText}</span>;
}

function MappingState({ row }: { row: IstemMappingEquipmentRow }) {
  const m = row.mapping!;
  const state = !m.is_active ? "off" : m.remote_found === true ? "found" : m.remote_found === false ? "missing" : "unchecked";
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span className="font-mono">{m.istem_equipment_id}</span>
      {state === "found" ? <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-3 w-3" />Found on I-STEM</span>
        : state === "missing" ? <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-400"><XCircle className="h-3 w-3" />Not found on I-STEM</span>
        : state === "off" ? <span>Switched off</span>
        : <span className="inline-flex items-center gap-1"><CircleHelp className="h-3 w-3" />Not checked yet</span>}
      {!m.sample_count_input_key ? <span className="text-amber-700 dark:text-amber-400">Samples field not set</span> : null}
    </div>
  );
}

/**
 * I-STEM equipment mapping (3 Nov 2026). On arrival the page reads I-STEM's whole equipment list for the institute.
 * Departments tab (Main Admin): the distinct I-STEM departments in that list, each matched to a portal department.
 * Equipment tab: every portal instrument with a searchable list of its I-STEM department's equipment, best match first.
 */
export default function AdminIstemEquipmentMapping() {
  const [data, setData] = useState<IstemEquipmentMappingList | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [istem, setIstem] = useState<{ rows: IstemDepartmentRow[]; portal: { id: number; name: string }[]; source?: IstemSource; error?: string } | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [tab, setTab] = useState<Tab | null>(null);
  const [selected, setSelected] = useState<DepartmentKey | null>(null);
  const [suggestions, setSuggestions] = useState<Record<DepartmentKey, Suggestions | undefined>>({});
  const [departmentText, setDepartmentText] = useState("");
  const [filter, setFilter] = useState<InstrumentFilter>("all");
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<IstemMappingEquipmentRow | null>(null);
  const [creating, setCreating] = useState<number | null>(null);
  const [busy, setBusy] = useState<string>("");
  const [listOpen, setListOpen] = useState(false);
  const [institute, setInstitute] = useState<IstemInstituteStatus | null>(null);
  const [changingInstitute, setChangingInstitute] = useState(false);

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
    if (res.error || !res.data) setIstem({ rows: [], portal: [], error: res.error || "Could not read I-STEM's departments." });
    else setIstem({ rows: res.data.istem_departments, portal: res.data.portal_departments, source: res.data.istem_source });
  }, []);

  const loadListing = useCallback(async (refresh = false) => {
    const res = await apiClient.getIstemEquipmentListing(refresh);
    if (res.error || !res.data) setListing({ rows: [], error: res.error || "Could not read I-STEM's equipment list." });
    else setListing({ rows: res.data.equipment, source: res.data.istem_source });
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

  const loadInstitute = useCallback(async () => {
    const res = await apiClient.getIstemInstitute();
    if (res.data) setInstitute(res.data);
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (data?.istem_connected && !institute) void loadInstitute(); }, [data, institute, loadInstitute]);
  // On arrival: I-STEM's whole equipment list, and (Main Admin) its departments.
  useEffect(() => {
    if (!data?.istem_connected) return;
    if (!listing) void loadListing();
    if (data.all_departments && !istem) void loadIstemDepartments();
  }, [data, listing, istem, loadListing, loadIstemDepartments]);

  const allDepartments = Boolean(data?.all_departments);
  const departments: IstemDepartmentProgress[] = useMemo(() => data?.departments ?? [], [data]);
  const noneLinked = departments.every((d) => !(d.istem_department_ids?.length));
  useEffect(() => {
    if (tab || !data) return;
    setTab(allDepartments && noneLinked ? "departments" : "equipment");
  }, [tab, data, allDepartments, noneLinked]);
  useEffect(() => {
    if (selected || !departments.length) return;
    const first = departments.find((d) => d.total > d.mapped && d.id != null) ?? departments[0];
    setSelected(keyOf(first.id));
  }, [departments, selected]);
  useEffect(() => {
    if (tab === "equipment" && selected && data?.istem_connected && !suggestions[selected]) void loadSuggestions(selected);
  }, [tab, selected, data?.istem_connected, suggestions, loadSuggestions]);

  const department = departments.find((d) => keyOf(d.id) === selected) ?? null;
  const linkedIds = useMemo(() => department?.istem_department_ids ?? [], [department]);
  const instruments = useMemo(
    () => (data?.equipment ?? []).filter((r) => keyOf(r.department?.id) === selected),
    [data, selected],
  );
  const shown = useMemo(() => filterInstruments(instruments, filter, text), [instruments, filter, text]);
  const current = selected ? suggestions[selected] : undefined;
  const certain = instruments.filter((r) => !isMapped(r) && current?.rows[r.equipment_id]?.confident);
  const source = listing?.source ?? current?.source ?? istem?.source ?? null;
  const allRows = useMemo(() => listing?.rows ?? [], [listing]);
  const departmentRows = useMemo(
    () => allRows.filter((r) => r.department_id && linkedIds.includes(r.department_id)),
    [allRows, linkedIds],
  );
  const istemNames = useMemo(() => Object.fromEntries((istem?.rows ?? []).map((r) => [r.istem_department_id, r.name || ""])), [istem]);
  const istemLabel = (id: string) => (istemNames[id] ? `${istemNames[id]} (${id})` : `I-STEM dept ${id}`);

  const totals = useMemo(() => {
    const real = departments.filter((d) => d.id != null);
    const withEquipment = (istem?.rows ?? []).filter((r) => r.istem_department_id && r.equipment_count > 0);
    return {
      istemDepartments: withEquipment.length,
      istemLinked: withEquipment.filter((r) => r.department).length,
      departments: real.length,
      instruments: departments.reduce((n, d) => n + d.total, 0),
      mapped: departments.reduce((n, d) => n + d.mapped, 0),
      fbr: departments.reduce((n, d) => n + d.fbr_unmapped, 0),
    };
  }, [departments, istem]);

  const refreshAll = async () => {
    setSuggestions({});
    setIstem(null);
    setListing(null);
    await load();
    await loadListing(true);
  };

  const save = async (items: { equipment_id: number; istem_equipment_id: string; sample_count_input_key: string }[], key: string) => {
    if (!items.length) return;
    setBusy(key);
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

  const acceptTop = (rows: IstemMappingEquipmentRow[], key: string) =>
    save(rows.flatMap((r) => {
      const s = current?.rows[r.equipment_id];
      const top = s?.candidates[0];
      return top ? [{ equipment_id: r.equipment_id, istem_equipment_id: top.equipment_id, sample_count_input_key: s.default_sample_key }] : [];
    }), key);

  const pick = (row: IstemMappingEquipmentRow, istemRow: IstemEquipmentSearchRow) =>
    save([{
      equipment_id: row.equipment_id,
      istem_equipment_id: istemRow.equipment_id,
      sample_count_input_key: row.mapping?.sample_count_input_key || current?.rows[row.equipment_id]?.default_sample_key || defaultSampleKey(row),
    }], `pick:${row.equipment_id}`);

  const link = async (items: { istem_department_id: string; department_id: number | null }[]) => {
    if (!items.length) return;
    setBusy(items.length > 1 ? "link-all" : `link:${items[0].istem_department_id}`);
    const res = await apiClient.saveIstemDepartmentMappings(items);
    setBusy("");
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(items.length > 1 ? `${items.length} I-STEM departments matched.`
      : items[0].department_id == null ? "Match removed." : "Department matched.");
    setSuggestions({});
    await Promise.all([load(), loadIstemDepartments()]);
  };

  const instituteSaved = async () => {
    setChangingInstitute(false);
    setSuggestions({});
    setIstem(null);
    setListing(null);
    await loadInstitute();
  };
  const needsInstitute = Boolean(institute && !institute.institute_id && institute.can_set);

  const visibleDepartments = departments.filter((d) => d.name.toLowerCase().includes(departmentText.trim().toLowerCase()));
  const listingProblem = listing?.error || istem?.error || "";

  return (
    <PageShell>
      <main className="container mx-auto max-w-7xl space-y-5 px-4 py-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">I-STEM mapping</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Match the departments on I-STEM to the portal's departments, then pick each instrument's I-STEM equipment.
              Bookings that need an I-STEM FBR are then registered on I-STEM automatically.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {data ? <IstemStatus connected={data.istem_connected} source={source} institute={institute} /> : null}
            {institute?.can_set && institute.source === "portal" && !changingInstitute ? (
              <Button variant="ghost" size="sm" onClick={() => setChangingInstitute(true)}>Change institute</Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => setListOpen(true)} disabled={!data?.istem_connected}>
              <List className="mr-1.5 h-4 w-4" />I-STEM's list
            </Button>
            <Button variant="outline" size="sm" onClick={() => void refreshAll()} disabled={loading}>
              <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
            </Button>
          </div>
        </header>

        {error ? <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p> : null}
        {institute && (needsInstitute || changingInstitute) ? (
          <IstemInstituteCard status={institute} onSaved={() => void instituteSaved()}
            onCancel={changingInstitute ? () => setChangingInstitute(false) : undefined} />
        ) : null}
        {needsInstitute ? null : data?.istem_connected && listingProblem ? (
          <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200" role="alert">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{listingProblem}</span>
          </p>
        ) : data && source && !source.live ? (
          <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{sourceNote(source)} Mappings can still be saved; they are checked on I-STEM once it answers.</span>
          </p>
        ) : null}

        {data ? (
          <section aria-label="Summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ["Equipment on I-STEM", listing && !listing.error ? String(allRows.length) : listing ? "—" : "…"],
              ...(allDepartments ? [["I-STEM departments matched", istem && !istem.error ? `${totals.istemLinked} / ${totals.istemDepartments}` : "…"]] : []),
              ["Instruments mapped", `${totals.mapped} / ${totals.instruments}`],
              ["FBR instruments still to map", String(totals.fbr)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
              </div>
            ))}
          </section>
        ) : null}

        {data && allDepartments ? (
          <div className="inline-flex rounded-lg border bg-card p-1 shadow-sm" role="tablist" aria-label="Mapping steps">
            {([["departments", "1 · Departments", Building2], ["equipment", "2 · Equipment", Link2]] as const).map(([value, label, Icon]) => (
              <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)}
                className={`inline-flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${tab === value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                <Icon className="h-4 w-4" />{label}
              </button>
            ))}
          </div>
        ) : null}

        {data && allDepartments && tab === "departments" ? (
          !data.istem_connected ? <p className="rounded-xl border p-8 text-center text-sm text-muted-foreground">I-STEM is not connected on this portal.</p>
            : !istem ? <div className="flex items-center gap-2 rounded-xl border p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Reading I-STEM's equipment list and departments…</div>
            : istem.error ? null
            : <IstemDepartmentLinking rows={istem.rows} portal={istem.portal} busy={busy} onLink={(items) => void link(items)} />
        ) : null}

        {data && (tab === "equipment" || !allDepartments) ? (
          <div className={allDepartments ? "grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]" : ""}>
            {allDepartments ? (
              <aside className="rounded-xl border bg-card shadow-sm lg:sticky lg:top-20 lg:max-h-[calc(100vh-7rem)] lg:overflow-hidden" aria-label="Departments">
                <div className="space-y-2 border-b p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold"><Building2 className="h-4 w-4" />Portal departments</div>
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
                              : linked ? <span className="truncate text-emerald-700 dark:text-emerald-400">I-STEM: {d.istem_department_ids!.map(istemLabel).join(", ")}</span>
                              : <span className="text-amber-700 dark:text-amber-400">Not matched to I-STEM</span>}
                            {d.fbr_unmapped ? <span className="ml-auto shrink-0 whitespace-nowrap rounded bg-amber-100 px-1.5 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">{d.fbr_unmapped} FBR</span> : null}
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
              <section className="space-y-4" aria-label={department.name}>
                <div className="rounded-xl border bg-card p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-xl font-semibold">{department.name}</h2>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground" data-testid="linked-istem">
                        {department.id == null ? "Instruments without a department: search I-STEM's whole list."
                          : linkedIds.length ? (
                            <>On I-STEM:{linkedIds.map((id) => <Badge key={id} variant="secondary" data-testid="linked-istem-department">{istemLabel(id)}</Badge>)}
                              <span>· {departmentRows.length} I-STEM equipment</span></>
                          ) : (
                            <span className="text-amber-700 dark:text-amber-400">
                              Not matched to an I-STEM department yet{allDepartments ? " (Departments tab)" : ""}: pickers search I-STEM's whole list.
                            </span>
                          )}
                      </div>
                    </div>
                    <div className="w-56 space-y-1 text-right">
                      <div className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{department.mapped}</span> of {department.total} instruments mapped</div>
                      <Progress value={department.mapped} total={department.total} />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border bg-card shadow-sm" data-testid="step-instruments">
                  <div className="flex flex-wrap items-center gap-2 border-b p-4">
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
                    <Button size="sm" className="ml-auto" disabled={!certain.length || busy === "accept-all"} onClick={() => void acceptTop(certain, "accept-all")}>
                      {busy === "accept-all" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
                      Accept all certain ({certain.length})
                    </Button>
                  </div>
                  <div className="hidden grid-cols-[minmax(0,15rem)_minmax(0,1fr)_auto] gap-4 border-b bg-muted/40 px-5 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid">
                    <span>Portal instrument</span><span>I-STEM equipment</span><span className="w-40 text-right">Action</span>
                  </div>
                  <ul className="divide-y">
                    {shown.map((row) => {
                      const s = current?.rows[row.equipment_id];
                      const top = s?.candidates[0];
                      const mapped = isMapped(row);
                      return (
                        <li key={row.equipment_id} data-testid="istem-mapping-row"
                          className="grid gap-3 px-5 py-3.5 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_auto] md:items-center md:gap-4">
                          <div className="min-w-0">
                            <div className="truncate font-medium">{row.name}</div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{row.code}</span>
                              {row.requires_istem_fbr ? <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">I-STEM FBR</Badge> : null}
                            </div>
                          </div>
                          <div className="min-w-0 space-y-1">
                            {data.istem_connected && listing && !listing.error ? (
                              <IstemEquipmentPicker departmentRows={departmentRows} allRows={allRows}
                                suggestions={(s?.candidates ?? []).map((c) => ({ ...c, score: c.score }))}
                                value={row.mapping?.istem_equipment_id} busy={busy === `pick:${row.equipment_id}`}
                                onPick={(r) => void pick(row, r)} />
                            ) : data.istem_connected && !listing ? (
                              <span className="inline-flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Reading I-STEM's list…</span>
                            ) : mapped ? <div className="truncate text-sm font-medium">{row.mapping?.remote_equipment_name || "I-STEM equipment"}</div>
                              : <span className="text-sm text-muted-foreground">Not mapped</span>}
                            {mapped ? <MappingState row={row} />
                              : top ? (
                                <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                                  <span className="truncate">Best match: <span className="font-medium text-foreground">{top.equipment_name}</span> · {reasonText(top.reasons)}</span>
                                  <ConfidencePill score={top.score} />
                                </div>
                              ) : current && data.istem_connected ? <div className="text-xs text-muted-foreground">No close match: choose from the list.</div> : null}
                          </div>
                          <div className="flex justify-end gap-2 md:w-40">
                            {!mapped && top && top.score >= 0.7 ? (
                              <Button size="sm" onClick={() => void acceptTop([row], `accept:${row.equipment_id}`)} disabled={busy === `accept:${row.equipment_id}`}>
                                {busy === `accept:${row.equipment_id}` ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}Accept
                              </Button>
                            ) : null}
                            {!mapped && allDepartments && data.istem_connected ? (
                              <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Create ${row.name} on I-STEM`}
                                title="Not on I-STEM? Create it there" data-testid="istem-create-open" onClick={() => setCreating(row.equipment_id)}>
                                <UploadCloud className="h-4 w-4" />
                              </Button>
                            ) : null}
                            <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Mapping settings for ${row.name}`} onClick={() => setEditing(row)}>
                              <Settings2 className="h-4 w-4" />
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
        ) : !data && loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading…</div>
        ) : null}

        {editing && data ? (
          <IstemMappingDialog row={editing} connected={data.istem_connected} onClose={() => setEditing(null)}
            onSaved={() => { setEditing(null); void load(); if (selected) void loadSuggestions(selected); }} />
        ) : null}

        {creating != null ? (
          <IstemEquipmentCreateDialog equipmentId={creating} onClose={() => setCreating(null)}
            onCreated={() => { setCreating(null); void load(); if (selected) void loadSuggestions(selected); }} />
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

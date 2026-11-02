import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleHelp, Link2, Loader2, RefreshCw, Search, XCircle } from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  apiClient,
  type IstemEquipmentMappingList,
  type IstemEquipmentSearchRow,
  type IstemMappingEquipmentRow,
} from "@/lib/api";

export type MappingFilter = "all" | "needs" | "mapped" | "not_found" | "unmapped";

const FILTERS: { value: MappingFilter; label: string }[] = [
  { value: "all", label: "All instruments" },
  { value: "needs", label: "Needs mapping (I-STEM FBR bookings)" },
  { value: "mapped", label: "Mapped" },
  { value: "not_found", label: "Not found on I-STEM" },
  { value: "unmapped", label: "Not mapped" },
];

const NO_FIELD = "__none__";
const ALL_DEPARTMENTS = "__all__";

function isMapped(row: IstemMappingEquipmentRow): boolean {
  return Boolean(row.mapping?.is_active && row.mapping.istem_equipment_id);
}

/** Rows shown for a filter: "needs" = bookings require an I-STEM FBR but no active mapping exists. */
export function filterRows(rows: IstemMappingEquipmentRow[], filter: MappingFilter, text: string, departmentId: string) {
  const needle = text.trim().toLowerCase();
  return rows.filter((row) => {
    if (departmentId !== ALL_DEPARTMENTS && String(row.department?.id ?? "") !== departmentId) return false;
    if (needle) {
      const haystack = [row.name, row.code, row.mapping?.istem_equipment_id, row.mapping?.remote_equipment_name]
        .join(" ").toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    switch (filter) {
      case "needs": return row.requires_istem_fbr && !isMapped(row);
      case "mapped": return isMapped(row);
      case "not_found": return isMapped(row) && row.mapping?.remote_found === false;
      case "unmapped": return !isMapped(row);
      default: return true;
    }
  });
}

function RemoteStatus({ row }: { row: IstemMappingEquipmentRow }) {
  const m = row.mapping;
  if (!m || !m.istem_equipment_id) return <span className="text-muted-foreground">—</span>;
  const state = !m.is_active ? "off" : m.remote_found === true ? "found" : m.remote_found === false ? "missing" : "unchecked";
  return (
    <div className="space-y-0.5">
      <div className="font-mono text-sm">{m.istem_equipment_id}</div>
      {m.remote_equipment_name ? <div className="text-xs text-muted-foreground">{m.remote_equipment_name}</div> : null}
      {state === "found" ? (
        <Badge variant="outline" className="border-emerald-300 text-emerald-700"><CheckCircle2 className="mr-1 h-3 w-3" />Found on I-STEM</Badge>
      ) : state === "missing" ? (
        <Badge variant="outline" className="border-red-300 text-red-700"><XCircle className="mr-1 h-3 w-3" />Not found on I-STEM</Badge>
      ) : state === "off" ? (
        <Badge variant="outline">Switched off</Badge>
      ) : (
        <Badge variant="outline" className="text-muted-foreground"><CircleHelp className="mr-1 h-3 w-3" />Not checked yet</Badge>
      )}
    </div>
  );
}

function MappingDialog({ row, connected, onClose, onSaved }: {
  row: IstemMappingEquipmentRow;
  connected: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [istemId, setIstemId] = useState(row.mapping?.istem_equipment_id ?? "");
  const [fieldKey, setFieldKey] = useState(row.mapping?.sample_count_input_key || NO_FIELD);
  const [active, setActive] = useState(row.mapping?.is_active ?? true);
  const [notes, setNotes] = useState(row.mapping?.notes ?? "");
  const [query, setQuery] = useState(row.name);
  const [results, setResults] = useState<IstemEquipmentSearchRow[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const locked = row.open_istem_bookings > 0 && Boolean(row.mapping?.istem_equipment_id);

  const search = async () => {
    setSearching(true);
    const res = await apiClient.searchIstemEquipment(query.trim());
    setSearching(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setResults(res.data?.results ?? []);
  };

  const save = async () => {
    setSaving(true);
    const res = await apiClient.saveIstemEquipmentMapping(row.equipment_id, {
      istem_equipment_id: istemId.trim(),
      sample_count_input_key: fieldKey === NO_FIELD ? "" : fieldKey,
      is_active: active,
      notes,
    });
    setSaving(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`${row.name} mapped to I-STEM equipment ${istemId.trim()}.`);
    for (const warning of res.data?.warnings ?? []) toast.warning(warning);
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>I-STEM mapping: {row.name}</DialogTitle>
          <DialogDescription>
            Choose the I-STEM equipment this instrument is listed as on I-STEM. Bookings that need an I-STEM FBR are
            registered on I-STEM under this ID.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {connected ? (
            <div className="space-y-2">
              <Label htmlFor="istem-search">Search I-STEM equipment</Label>
              <div className="flex gap-2">
                <Input id="istem-search" value={query} onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void search(); } }}
                  placeholder="Part of the name on I-STEM, e.g. Fluorescence" />
                <Button type="button" variant="outline" onClick={() => void search()} disabled={searching || query.trim().length < 3}>
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  <span className="ml-1">Search</span>
                </Button>
              </div>
              {results ? (
                results.length ? (
                  <ul className="max-h-56 divide-y overflow-auto rounded-md border" data-testid="istem-search-results">
                    {results.map((r) => {
                      const elsewhere = r.mapped_to.filter((m) => m.equipment_id !== row.equipment_id);
                      return (
                        <li key={r.equipment_id}>
                          <button type="button" onClick={() => setIstemId(r.equipment_id)}
                            className={`flex w-full items-start justify-between gap-3 px-3 py-2 text-left hover:bg-muted ${istemId === r.equipment_id ? "bg-primary/10" : ""}`}>
                            <span>
                              <span className="block text-sm font-medium">{r.equipment_name || "(no name)"}</span>
                              {elsewhere.length ? (
                                <span className="block text-xs text-amber-700">
                                  Already mapped to {elsewhere.map((m) => m.name).join(", ")}
                                </span>
                              ) : null}
                            </span>
                            <span className="font-mono text-xs text-muted-foreground">{r.equipment_id}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No active I-STEM equipment of the institute matches.</p>
                )
              ) : null}
            </div>
          ) : (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              I-STEM is not connected on this portal, so its equipment list cannot be searched. Enter the I-STEM
              equipment ID; it is checked against I-STEM once the portal is connected.
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="istem-id">I-STEM equipment ID</Label>
              <Input id="istem-id" inputMode="numeric" value={istemId} disabled={locked}
                onChange={(e) => setIstemId(e.target.value.replace(/\D/g, ""))} placeholder="e.g. 38750" />
              {locked ? (
                <p className="text-xs text-amber-700">
                  {row.open_istem_bookings} booking(s) are still open on I-STEM under this ID; it can change once they
                  are executed or cancelled.
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label>Number of samples is entered in</Label>
              <Select value={fieldKey} onValueChange={setFieldKey}>
                <SelectTrigger aria-label="Sample-count field"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_FIELD}>Not set</SelectItem>
                  {row.input_fields.map((f) => (
                    <SelectItem key={f.key} value={f.key}>{f.key} — {f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Sent to I-STEM as the booking's number of samples.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch id="istem-active" checked={active} onCheckedChange={setActive} disabled={locked && active} />
            <Label htmlFor="istem-active">Mapping in use</Label>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="istem-notes">Notes</Label>
            <Textarea id="istem-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. confirmed with the I-STEM team on …" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void save()} disabled={saving || !istemId.trim()}>
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Link2 className="mr-1 h-4 w-4" />}Save mapping
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** I-STEM equipment mapping (2 Nov 2026): which portal instrument is which I-STEM equipment. Main Admin maps every
 * instrument; a department administrator maps their own department's, as departments join the portal. */
export default function AdminIstemEquipmentMapping() {
  const [data, setData] = useState<IstemEquipmentMappingList | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [filter, setFilter] = useState<MappingFilter>("all");
  const [text, setText] = useState("");
  const [departmentId, setDepartmentId] = useState(ALL_DEPARTMENTS);
  const [editing, setEditing] = useState<IstemMappingEquipmentRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiClient.getIstemEquipmentMappings();
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setError("");
    setData(res.data ?? null);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => data?.equipment ?? [], [data]);
  const departments = useMemo(() => {
    const seen = new Map<number, string>();
    rows.forEach((r) => { if (r.department) seen.set(r.department.id, r.department.name); });
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);
  const shown = useMemo(() => filterRows(rows, filter, text, departmentId), [rows, filter, text, departmentId]);
  const counts = useMemo(() => ({
    total: rows.length,
    mapped: rows.filter(isMapped).length,
    needs: rows.filter((r) => r.requires_istem_fbr && !isMapped(r)).length,
    missing: rows.filter((r) => isMapped(r) && r.mapping?.remote_found === false).length,
  }), [rows]);

  const checkAll = async () => {
    setChecking(true);
    const res = await apiClient.verifyIstemEquipmentMappings();
    setChecking(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    const missing = res.data?.missing ?? [];
    if (missing.length) toast.warning(`Not found on I-STEM: ${missing.join(", ")}`);
    else toast.success(`All ${res.data?.found.length ?? 0} mapping(s) found on I-STEM.`);
    void load();
  };

  return (
    <PageShell>
      <main className="container mx-auto max-w-6xl space-y-4 px-4 py-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">I-STEM equipment mapping</h1>
            <p className="text-sm text-muted-foreground">
              Link each instrument to its I-STEM equipment so bookings that need an I-STEM FBR are registered on I-STEM
              automatically.{data && !data.all_departments ? " Showing your department's instruments." : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
            </Button>
            <Button onClick={() => void checkAll()} disabled={checking || !data?.istem_connected || counts.mapped === 0}>
              {checking ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />}
              Check all on I-STEM
            </Button>
          </div>
        </header>

        {error ? (
          <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>
        ) : null}
        {data && !data.istem_connected ? (
          <p className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            I-STEM is not connected on this portal: mappings can be entered, and are checked once it is connected.
          </p>
        ) : null}

        {data ? (
          <>
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Summary">
              {[
                ["Instruments", counts.total],
                ["Mapped", counts.mapped],
                ["Need mapping", counts.needs],
                ["Not found on I-STEM", counts.missing],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border bg-card p-3">
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="text-xl font-semibold">{value}</div>
                </div>
              ))}
            </section>

            <section className="flex flex-wrap gap-2">
              <Input className="w-full sm:w-64" placeholder="Search instrument or I-STEM ID" value={text}
                onChange={(e) => setText(e.target.value)} aria-label="Search instruments" />
              <Select value={filter} onValueChange={(v) => setFilter(v as MappingFilter)}>
                <SelectTrigger className="w-full sm:w-72" aria-label="Filter"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FILTERS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {data.all_departments && departments.length > 1 ? (
                <Select value={departmentId} onValueChange={setDepartmentId}>
                  <SelectTrigger className="w-full sm:w-64" aria-label="Department"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_DEPARTMENTS}>All departments</SelectItem>
                    {departments.map(([id, name]) => <SelectItem key={id} value={String(id)}>{name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : null}
            </section>

            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Instrument</TableHead>
                    {data.all_departments ? <TableHead>Department</TableHead> : null}
                    <TableHead>I-STEM equipment</TableHead>
                    <TableHead>Samples field</TableHead>
                    <TableHead>Set by</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((row) => (
                    <TableRow key={row.equipment_id} data-testid="istem-mapping-row">
                      <TableCell>
                        <div className="font-medium">{row.name}</div>
                        <div className="text-xs text-muted-foreground">{row.code}</div>
                        {row.requires_istem_fbr ? (
                          <Badge variant="secondary" className="mt-1">I-STEM FBR bookings</Badge>
                        ) : null}
                      </TableCell>
                      {data.all_departments ? <TableCell className="text-sm">{row.department?.name ?? "—"}</TableCell> : null}
                      <TableCell><RemoteStatus row={row} /></TableCell>
                      <TableCell className="text-sm">
                        {row.mapping?.sample_count_input_key
                          ? `${row.mapping.sample_count_input_key} — ${row.input_fields.find((f) => f.key === row.mapping?.sample_count_input_key)?.label ?? ""}`
                          : row.mapping ? <span className="text-amber-700">Not set</span> : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.mapping?.set_by || "—"}
                        {row.mapping?.set_at ? <div>{new Date(row.mapping.set_at).toLocaleDateString("en-IN")}</div> : null}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant={row.mapping ? "outline" : "default"} onClick={() => setEditing(row)}>
                          {row.mapping ? "Edit" : "Map"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!shown.length ? (
                    <TableRow>
                      <TableCell colSpan={data.all_departments ? 6 : 5} className="py-8 text-center text-sm text-muted-foreground">
                        No instruments match.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </>
        ) : loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading…</div>
        ) : null}

        {editing && data ? (
          <MappingDialog row={editing} connected={data.istem_connected} onClose={() => setEditing(null)}
            onSaved={() => { setEditing(null); void load(); }} />
        ) : null}
      </main>
    </PageShell>
  );
}

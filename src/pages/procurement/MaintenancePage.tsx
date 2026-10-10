import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { DateTimeInput } from "@/components/ui/datetime-input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, pmGet, pmPatch, pmPost, type Page, type PmItem, type PmMaintenance } from "@/lib/procurementApi";
import { MAINTENANCE_KINDS } from "./inventory";
import {
  EmptyRow,
  ExportButtons,
  Field,
  fmtDate,
  humanize,
  LoadingRow,
  money,
  NativeSelect,
  pageSerialStart,
  Pager,
  qty,
  SectionCard,
  StatusBadge,
  usePm,
  useRunner,
} from "./shared";

export function hours(h: number | null | undefined): string {
  if (h === null || h === undefined) return "—";
  if (h < 48) return `${Math.round(h * 10) / 10} h`;
  return `${Math.round((h / 24) * 10) / 10} days`;
}

export default function MaintenancePage() {
  const { deptId, boot, hasPerm } = usePm();
  const [params, setParams] = useSearchParams();
  const equipment = boot.equipment.filter((e) => e.department_id === deptId);
  const [equipmentId, setEquipmentId] = useState(params.get("equipment") ?? "");
  const [kind, setKind] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(params.get("new") === "1");
  const openId = params.get("record");
  const filters = { department_id: deptId ?? undefined, equipment_id: equipmentId, kind, date_from: from, date_to: to };
  const q = useQuery({
    queryKey: ["procurement", "maintenance", filters, page],
    queryFn: () => pmGet<Page<PmMaintenance>>("maintenance/", { ...filters, page }),
    enabled: !!deptId,
  });
  const open = (id: number | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set("record", String(id));
    else next.delete("record");
    next.delete("new");
    setParams(next, { replace: true });
  };
  const canRecord = hasPerm("assets") || hasPerm("stock") || equipment.length > 0;
  return (
    <div className="space-y-4">
      <SectionCard
        title={<span className="flex items-center gap-2"><Wrench className="h-4 w-4" />Maintenance history</span>}
        description="Breakdowns, preventive maintenance, calibration and AMC visits per equipment — downtime, cause, action, cost and parts used from stock."
        actions={
          <>
            {hasPerm("reports") || hasPerm("assets") ? <ExportButtons path="maintenance/" query={filters} name="maintenance-history" /> : null}
            {canRecord ? <Button size="sm" onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" />Record maintenance</Button> : null}
          </>
        }
      >
        <div className="mb-3 flex flex-wrap gap-2">
          <NativeSelect aria-label="Equipment" className="w-64" value={equipmentId} onChange={(e) => { setPage(1); setEquipmentId(e.target.value); }} placeholder="All equipment" options={equipment.map((e) => ({ value: String(e.id), label: e.name }))} />
          <NativeSelect aria-label="Kind" className="w-52" value={kind} onChange={(e) => { setPage(1); setKind(e.target.value); }} placeholder="All kinds" options={MAINTENANCE_KINDS} />
          <DateInput aria-label="From" className="w-40" value={from} onChange={(e) => { setPage(1); setFrom(e.target.value); }} />
          <DateInput aria-label="To" className="w-40" value={to} onChange={(e) => { setPage(1); setTo(e.target.value); }} />
        </div>
        {q.error ? <p className="mb-2 text-sm text-destructive">{errorMessage(q.error)}</p> : null}
        <div className="overflow-x-auto">
          <Table serialStart={pageSerialStart(q.data)}>
            <TableHeader>
              <TableRow>
                <TableHead>Record</TableHead>
                <TableHead>Equipment</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Down from</TableHead>
                <TableHead>Downtime</TableHead>
                <TableHead>Cause</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead>By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.isLoading ? <LoadingRow colSpan={9} /> : !q.data?.results.length ? <EmptyRow colSpan={9} text="No maintenance recorded." /> : q.data.results.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => open(r.id)}>
                  <TableCell className="font-mono text-xs">
                    <button type="button" className="text-primary underline" onClick={(e) => { e.stopPropagation(); open(r.id); }}>{r.number}</button>
                  </TableCell>
                  <TableCell>{r.equipment.name}</TableCell>
                  <TableCell>{r.kind_label}</TableCell>
                  <TableCell className="whitespace-nowrap">{fmtDate(r.downtime_start, true)}</TableCell>
                  <TableCell>{r.downtime_start && !r.downtime_end ? <StatusBadge status="PENDING" label="Still down" /> : hours(r.downtime_hours)}</TableCell>
                  <TableCell className="max-w-xs truncate">{r.cause || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(r.total_cost)}</TableCell>
                  <TableCell className="text-xs">{r.recorded_by?.name}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {q.data ? <Pager page={q.data.page} count={q.data.count} pageSize={q.data.page_size} onPage={setPage} /> : null}
      </SectionCard>
      {creating ? (
        <MaintenanceDialog
          equipmentId={equipmentId || params.get("equipment") || ""}
          disruptionEventId={params.get("disruption")}
          onClose={(id) => { setCreating(false); open(id ?? null); }}
        />
      ) : null}
      {openId ? <MaintenanceDetail id={openId} onClose={() => open(null)} /> : null}
    </div>
  );
}

interface PartRow {
  item_id: string;
  quantity: string;
  laboratory_id: string;
}

function PartsEditor({ parts, onChange, items }: { parts: PartRow[]; onChange: (p: PartRow[]) => void; items: PmItem[] }) {
  const set = (i: number, patch: Partial<PartRow>) => onChange(parts.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  return (
    <div className="space-y-2 sm:col-span-2">
      <p className="text-sm font-medium">Parts / consumables used from stock</p>
      {parts.map((p, i) => (
        <div key={i} className="flex gap-2">
          <NativeSelect aria-label="Item" className="flex-1" value={p.item_id} onChange={(e) => set(i, { item_id: e.target.value })} placeholder="Choose item" options={items.map((it) => ({ value: String(it.id), label: `${it.code} · ${it.name} (${it.uom})` }))} />
          <Input aria-label="Quantity" className="w-24" inputMode="decimal" value={p.quantity} onChange={(e) => set(i, { quantity: e.target.value })} />
          <Button type="button" variant="ghost" size="icon" aria-label="Remove part" onClick={() => onChange(parts.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...parts, { item_id: "", quantity: "1", laboratory_id: "" }])}>
        <Plus className="mr-2 h-4 w-4" />Add part
      </Button>
      <p className="text-xs text-muted-foreground">Issued from the central store by OC Stores; costs are taken from the last receipt price.</p>
    </div>
  );
}

const toLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : "");

function MaintenanceDialog({ equipmentId, disruptionEventId, record, onClose }: { equipmentId: string; disruptionEventId?: string | null; record?: PmMaintenance; onClose: (id?: number) => void }) {
  const { deptId, boot } = usePm();
  const qc = useQueryClient();
  const equipment = boot.equipment.filter((e) => e.department_id === deptId);
  const items = useQuery({
    queryKey: ["procurement", "items-all", deptId],
    queryFn: () => pmGet<Page<PmItem>>("items/", { department_id: deptId, page_size: 200 }),
    enabled: !!deptId,
  }).data?.results ?? [];
  const [f, setF] = useState({
    equipment_id: record ? String(record.equipment.id) : equipmentId,
    kind: record?.kind ?? "BREAKDOWN",
    downtime_start: toLocal(record?.downtime_start ?? null),
    downtime_end: toLocal(record?.downtime_end ?? null),
    cause: record?.cause ?? "",
    action_taken: record?.action_taken ?? "",
    service_provider: record?.service_provider ?? "",
    service_report_reference: record?.service_report_reference ?? "",
    service_cost: record ? String(Number(record.service_cost)) : "",
    other_cost: record ? String(Number(record.other_cost)) : "",
    under_warranty_or_amc: record?.under_warranty_or_amc ?? false,
    remarks: record?.remarks ?? "",
  });
  const [parts, setParts] = useState<PartRow[]>([]);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const { busy, run } = useRunner();
  const save = async () => {
    let id: number | undefined;
    const body = {
      ...f,
      equipment_id: Number(f.equipment_id),
      downtime_start: f.downtime_start || null,
      downtime_end: f.downtime_end || null,
      service_cost: f.service_cost || "0",
      other_cost: f.other_cost || "0",
      disruption_event_id: !record && disruptionEventId ? Number(disruptionEventId) : undefined,
      parts: parts.filter((p) => p.item_id && Number(p.quantity) > 0).map((p) => ({ item_id: Number(p.item_id), quantity: p.quantity, laboratory_id: p.laboratory_id || null })),
    };
    const ok = await run(async () => {
      const rec = record ? await pmPatch<PmMaintenance>(`maintenance/${record.id}/`, body) : await pmPost<PmMaintenance>("maintenance/", body);
      id = rec.id;
      qc.invalidateQueries({ queryKey: ["procurement"] });
    }, record ? "Maintenance record updated." : "Maintenance recorded.");
    if (ok) onClose(id);
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose(record?.id)}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{record ? `Edit ${record.number}` : "Record maintenance"}</DialogTitle>
          <DialogDescription>Downtime is the period the equipment was not available to users.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Equipment">
            <NativeSelect disabled={!!record} value={f.equipment_id} onChange={set("equipment_id")} placeholder="Choose" options={equipment.map((e) => ({ value: String(e.id), label: e.name }))} />
          </Field>
          <Field label="Kind"><NativeSelect value={f.kind} onChange={set("kind")} options={MAINTENANCE_KINDS} /></Field>
          <Field label="Down from"><DateTimeInput value={f.downtime_start} onValueChange={(v) => setF({ ...f, downtime_start: v })} /></Field>
          <Field label="Back in service" hint="Leave empty while still down."><DateTimeInput value={f.downtime_end} onValueChange={(v) => setF({ ...f, downtime_end: v })} /></Field>
          <Field label="Cause / fault" className="sm:col-span-2"><Textarea rows={2} value={f.cause} onChange={set("cause")} /></Field>
          <Field label="Action taken" className="sm:col-span-2"><Textarea rows={2} value={f.action_taken} onChange={set("action_taken")} /></Field>
          <Field label="Service provider / engineer"><Input value={f.service_provider} onChange={set("service_provider")} /></Field>
          <Field label="Service report no."><Input value={f.service_report_reference} onChange={set("service_report_reference")} /></Field>
          <Field label="Service charges (₹)"><Input inputMode="decimal" value={f.service_cost} onChange={set("service_cost")} /></Field>
          <Field label="Other cost (₹)"><Input inputMode="decimal" value={f.other_cost} onChange={set("other_cost")} /></Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Switch checked={f.under_warranty_or_amc} onCheckedChange={(v) => setF({ ...f, under_warranty_or_amc: v })} />
            Covered by warranty / AMC
          </label>
          <PartsEditor parts={parts} onChange={setParts} items={items} />
          <Field label="Remarks" className="sm:col-span-2"><Textarea rows={2} value={f.remarks} onChange={set("remarks")} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(record?.id)}>Cancel</Button>
          <Button disabled={busy || !f.equipment_id} onClick={save}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MaintenanceDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const q = useQuery({ queryKey: ["procurement", "maintenance-record", id], queryFn: () => pmGet<PmMaintenance>(`maintenance/${id}/`) });
  const r = q.data;
  if (editing && r) return <MaintenanceDialog equipmentId={String(r.equipment.id)} record={r} onClose={() => setEditing(false)} />;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        {!r ? (
          q.error ? <p className="text-sm text-destructive">{errorMessage(q.error)}</p> : <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{r.number} · {r.kind_label}</DialogTitle>
              <DialogDescription>{r.equipment.name}{r.asset ? ` · ${r.asset.number}` : ""}{r.disruption_event_id ? " · from a downtime / disruption entry" : ""}</DialogDescription>
            </DialogHeader>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div><dt className="text-muted-foreground">Down from</dt><dd>{fmtDate(r.downtime_start, true)}</dd></div>
              <div><dt className="text-muted-foreground">Back in service</dt><dd>{r.downtime_end ? fmtDate(r.downtime_end, true) : r.downtime_start ? "Still down" : "—"}</dd></div>
              <div><dt className="text-muted-foreground">Downtime</dt><dd>{hours(r.downtime_hours)}</dd></div>
              <div><dt className="text-muted-foreground">Warranty / AMC</dt><dd>{r.under_warranty_or_amc ? "Yes" : "No"}</dd></div>
              <div className="sm:col-span-2"><dt className="text-muted-foreground">Cause</dt><dd className="whitespace-pre-wrap">{r.cause || "—"}</dd></div>
              <div className="sm:col-span-2"><dt className="text-muted-foreground">Action taken</dt><dd className="whitespace-pre-wrap">{r.action_taken || "—"}</dd></div>
              <div><dt className="text-muted-foreground">Service provider</dt><dd>{r.service_provider || r.vendor?.name || "—"}{r.service_report_reference ? ` · ${r.service_report_reference}` : ""}</dd></div>
              <div><dt className="text-muted-foreground">Cost</dt><dd>{money(r.total_cost)} <span className="text-xs text-muted-foreground">(service {money(r.service_cost)}, parts {money(r.parts_cost)}, other {money(r.other_cost)})</span></dd></div>
            </dl>
            {r.parts_used?.length ? (
              <div>
                <p className="mb-1 text-sm font-medium">Parts used</p>
                <ul className="space-y-1 text-sm">
                  {r.parts_used.map((p) => <li key={p.id}>{p.item.name}: {qty(String(Math.abs(Number(p.signed_quantity))))} {p.item.uom} <span className="text-xs text-muted-foreground">({p.number})</span></li>)}
                </ul>
              </div>
            ) : null}
            <div>
              <p className="mb-1 text-sm font-medium">Requirements raised</p>
              {r.requests?.length ? (
                <ul className="space-y-1 text-sm">
                  {r.requests.map((x) => (
                    <li key={x.id} className="flex items-center gap-2">
                      <Link className="text-primary underline" to={`/procurement/requests/${x.id}`}>{x.number}</Link> {x.title} <StatusBadge status={x.status} /> {money(x.estimated_total)}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted-foreground">None yet.</p>}
            </div>
            <DialogFooter className="gap-2 sm:justify-between">
              <span className="text-xs text-muted-foreground">Recorded by {r.recorded_by?.name} · {fmtDate(r.created_at, true)}</span>
              <div className="flex gap-2">
                {r.can_edit ? <Button variant="outline" onClick={() => setEditing(true)}>Edit / add parts</Button> : null}
                <Button onClick={() => navigate(`/procurement/requests/new?equipment=${r.equipment.id}&maintenance=${r.id}&title=${encodeURIComponent(`Spares / service after ${humanize(r.kind).toLowerCase()} — ${r.equipment.name}`)}`)}>
                  Raise requirement
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

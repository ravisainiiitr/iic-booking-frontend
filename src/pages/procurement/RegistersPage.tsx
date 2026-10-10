import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileUp, Loader2, Plus, ScanLine, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, pmGet, pmPatch, pmPost, type Page, type PmAsset, type PmRegister } from "@/lib/procurementApi";
import { CONDITIONS, labelOf, printLabels, REGISTER_TYPES, useRegisters } from "./inventory";
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
  SectionCard,
  StatusBadge,
  usePm,
  useRunner,
} from "./shared";

export default function RegistersPage() {
  const { id } = useParams();
  return id ? <RegisterDetail id={id} /> : <RegistersList />;
}

function RegistersList() {
  const { deptId, hasPerm, dept } = usePm();
  const navigate = useNavigate();
  const q = useRegisters(deptId);
  const [editing, setEditing] = useState<PmRegister | "new" | null>(null);
  const regs = q.data?.results ?? [];
  const canEdit = hasPerm("assets");
  return (
    <div className="space-y-4">
      <SectionCard
        title="Asset register books"
        description="One entry per physical register book (GFR Form 22 Major / Minor registers). Each asset sits on a page and serial of one book; the asset tag on its QR label links back to that entry."
        actions={
          <>
            <Button size="sm" variant="outline" asChild>
              <Link to="/procurement/scan"><ScanLine className="mr-2 h-4 w-4" />Find by tag / page</Link>
            </Button>
            {dept?.menus.register_import ? (
              <Button size="sm" variant="outline" asChild>
                <Link to="/procurement/registers/import"><FileUp className="mr-2 h-4 w-4" />Import existing register</Link>
              </Button>
            ) : null}
            {canEdit ? (
              <Button size="sm" onClick={() => setEditing("new")}>
                <Plus className="mr-2 h-4 w-4" />
                New register book
              </Button>
            ) : null}
          </>
        }
      >
        {q.error ? <p className="mb-2 text-sm text-destructive">{errorMessage(q.error)}</p> : null}
        <div className="overflow-x-auto">
          <Table serialStart={1}>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Volume</TableHead>
                <TableHead>Laboratory / custodian</TableHead>
                <TableHead className="text-right">Entries</TableHead>
                <TableHead>Pages</TableHead>
                <TableHead>Status</TableHead>
                {canEdit ? <TableHead /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.isLoading ? <LoadingRow colSpan={canEdit ? 10 : 9} /> : !regs.length ? (
                <EmptyRow colSpan={canEdit ? 10 : 9} text="No register books yet. Create one, or import your existing register from Excel." />
              ) : regs.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/procurement/registers/${r.id}`)}>
                  <TableCell className="font-mono text-xs">
                    <Link className="text-primary underline" to={`/procurement/registers/${r.id}`} onClick={(e) => e.stopPropagation()}>{r.code}</Link>
                  </TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{humanize(r.register_type)}</TableCell>
                  <TableCell>{r.volume || "—"}</TableCell>
                  <TableCell>{[r.laboratory?.name, r.custodian?.name].filter(Boolean).join(" · ") || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.entry_count ?? 0}</TableCell>
                  <TableCell>{r.total_pages ?? "—"}</TableCell>
                  <TableCell><StatusBadge status={r.active ? "ACTIVE" : "CLOSED"} label={r.active ? "Open" : "Closed"} /></TableCell>
                  {canEdit ? (
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setEditing(r); }}>Edit</Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SectionCard>
      {editing ? <RegisterDialog register={editing === "new" ? null : editing} onOpenChange={(o) => !o && setEditing(null)} /> : null}
    </div>
  );
}

function RegisterDialog({ register, onOpenChange }: { register: PmRegister | null; onOpenChange: (o: boolean) => void }) {
  const { deptId } = usePm();
  const qc = useQueryClient();
  const { busy, run } = useRunner();
  const [f, setF] = useState({
    register_type: register?.register_type ?? "MAJOR",
    code: register?.code ?? "",
    name: register?.name ?? "",
    volume: register?.volume ?? "",
    opened_on: register?.opened_on ?? "",
    total_pages: register?.total_pages ? String(register.total_pages) : "",
    remarks: register?.remarks ?? "",
    active: register?.active ?? true,
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    const body = { ...f, total_pages: f.total_pages ? Number(f.total_pages) : null, opened_on: f.opened_on || null };
    const ok = await run(async () => {
      if (register) await pmPatch(`registers/${register.id}/`, body);
      else await pmPost("registers/", { ...body, department_id: deptId });
      qc.invalidateQueries({ queryKey: ["procurement"] });
    }, register ? "Register updated." : "Register book created.");
    if (ok) onOpenChange(false);
  };
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{register ? `Edit ${register.code}` : "New register book"}</DialogTitle>
          <DialogDescription>Use the code written on the register&apos;s cover (e.g. MAJ-1, MIN-2024).</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Type" className="sm:col-span-2">
            <NativeSelect value={f.register_type} onChange={set("register_type")} options={REGISTER_TYPES} />
          </Field>
          <Field label="Code"><Input value={f.code} onChange={set("code")} placeholder="MAJ-1" /></Field>
          <Field label="Volume"><Input value={f.volume} onChange={set("volume")} placeholder="I" /></Field>
          <Field label="Name" className="sm:col-span-2"><Input value={f.name} onChange={set("name")} placeholder="Major asset register" /></Field>
          <Field label="Opened on"><DateInput value={f.opened_on} onChange={set("opened_on")} /></Field>
          <Field label="Total pages"><Input inputMode="numeric" value={f.total_pages} onChange={set("total_pages")} /></Field>
          <Field label="Remarks" className="sm:col-span-2"><Textarea rows={2} value={f.remarks} onChange={set("remarks")} /></Field>
          {register ? (
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <Switch checked={f.active} onCheckedChange={(v) => setF({ ...f, active: v })} />
              Open for new entries
            </label>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={busy || !f.code.trim()} onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RegisterDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  const { hasPerm } = usePm();
  const reg = useQuery({ queryKey: ["procurement", "register", id], queryFn: () => pmGet<PmRegister>(`registers/${id}/`) });
  const [pageNo, setPageNo] = useState("");
  const [serial, setSerial] = useState("");
  const [term, setTerm] = useState("");
  const [applied, setApplied] = useState({ page_no: "", serial: "", q: "" });
  const [page, setPage] = useState(1);
  const entries = useQuery({
    queryKey: ["procurement", "register-entries", id, applied, page],
    queryFn: () => pmGet<Page<PmAsset>>(`registers/${id}/entries/`, { ...applied, page }),
  });
  const { busy, run } = useRunner();
  if (reg.isLoading) return <Loader2 className="mx-auto mt-10 h-6 w-6 animate-spin text-muted-foreground" />;
  if (reg.error || !reg.data) return <p className="text-sm text-destructive">{errorMessage(reg.error)}</p>;
  const r = reg.data;
  const canExport = hasPerm("reports") || hasPerm("assets");
  const goPage = (p: string) => {
    setPageNo(p);
    setSerial("");
    setPage(1);
    setApplied({ page_no: p, serial: "", q: "" });
  };
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate("/procurement/registers")}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        All register books
      </Button>
      <SectionCard
        title={<span className="flex flex-wrap items-center gap-2"><span className="font-mono">{r.code}</span>{r.name}{r.volume ? <span className="text-muted-foreground">Vol. {r.volume}</span> : null}<StatusBadge status={r.active ? "ACTIVE" : "CLOSED"} label={r.active ? "Open" : "Closed"} /></span>}
        description={`${r.register_type_label} · ${r.entry_count ?? 0} entries${r.total_pages ? ` · ${r.total_pages} pages` : ""}${r.next_free ? ` · next free: page ${r.next_free.page}, serial ${r.next_free.serial}` : ""}`}
        actions={
          <>
            {canExport ? <ExportButtons path={`registers/${r.id}/entries/`} query={applied} name={`register-${r.code}`} /> : null}
            <Button size="sm" variant="outline" disabled={busy || !r.entry_count} onClick={() => run(() => printLabels({ register_id: r.id, page_no: applied.page_no ? Number(applied.page_no) : undefined }, `labels-${r.code}.pdf`))}>
              QR labels{applied.page_no ? ` (page ${applied.page_no})` : ""}
            </Button>
          </>
        }
      >
        {r.pages_used?.length ? (
          <div className="mb-3 flex flex-wrap items-center gap-1 text-sm">
            <span className="mr-1 text-muted-foreground">Pages:</span>
            <Button size="sm" variant={applied.page_no ? "ghost" : "secondary"} className="h-7 px-2" onClick={() => goPage("")}>All</Button>
            {r.pages_used.map((p) => (
              <Button key={p} size="sm" variant={applied.page_no === String(p) ? "secondary" : "ghost"} className="h-7 px-2 tabular-nums" onClick={() => goPage(String(p))}>{p}</Button>
            ))}
          </div>
        ) : null}
        <form
          className="mb-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setApplied({ page_no: pageNo.trim(), serial: serial.trim(), q: term.trim() });
          }}
        >
          <Input className="w-28" inputMode="numeric" placeholder="Page" aria-label="Page number" value={pageNo} onChange={(e) => setPageNo(e.target.value)} />
          <Input className="w-28" placeholder="Serial" aria-label="Serial number" value={serial} onChange={(e) => setSerial(e.target.value)} />
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Description, tag, make…" value={term} onChange={(e) => setTerm(e.target.value)} />
          </div>
          <Button type="submit" variant="secondary">Find</Button>
        </form>
        {entries.error ? <p className="mb-2 text-sm text-destructive">{errorMessage(entries.error)}</p> : null}
        <div className="overflow-x-auto">
          <Table serialStart={pageSerialStart(entries.data)}>
            <TableHeader>
              <TableRow>
                <TableHead>Page</TableHead>
                <TableHead>Serial</TableHead>
                <TableHead>Asset tag</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Make / model</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead>Equipment / location</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Last verified</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.isLoading ? <LoadingRow colSpan={12} /> : !entries.data?.results.length ? (
                <EmptyRow colSpan={12} text={applied.page_no || applied.serial || applied.q ? "No entry matches." : "No entries in this register yet."} />
              ) : entries.data.results.map((a) => (
                <TableRow key={a.id} className="cursor-pointer" onClick={() => navigate(`/procurement/assets/${a.id}`)}>
                  <TableCell className="tabular-nums">{a.register_page ?? "—"}</TableCell>
                  <TableCell className="tabular-nums">{a.register_serial || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">
                    <Link className="text-primary underline" to={`/procurement/assets/${a.id}`} onClick={(e) => e.stopPropagation()}>{a.asset_tag || a.number}</Link>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{a.parent ? <span className="mr-1 text-xs text-muted-foreground">↳</span> : null}{a.description}</TableCell>
                  <TableCell>{[a.make, a.model_number].filter(Boolean).join(" / ") || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{a.quantity ?? 1}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(a.cost)}</TableCell>
                  <TableCell>{a.equipment?.name ?? a.location ?? "—"}</TableCell>
                  <TableCell>{a.condition ? labelOf(CONDITIONS, a.condition) : "—"}</TableCell>
                  <TableCell>{a.last_verified_on ? fmtDate(a.last_verified_on) : "—"}</TableCell>
                  <TableCell><StatusBadge status={a.status} label={a.status_label} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {entries.data ? <Pager page={entries.data.page} count={entries.data.count} pageSize={entries.data.page_size} onPage={setPage} /> : null}
      </SectionCard>
    </div>
  );
}

import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Loader2, Pencil, Plus, ScanLine, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { refetchingClass } from "@/components/filters/LiveFilterStatus";
import { useLiveSearchTerm } from "@/hooks/use-live-search";
import { cn } from "@/lib/utils";
import { errorMessage, pmForm, pmGet, pmPatch, pmPost, type Page, type PmAsset, type PmDocument, type PmTransfer } from "@/lib/procurementApi";
import {
  CONDITIONS,
  DisposeDialog,
  ExtraFields,
  entryPayload,
  extraFromAsset,
  extraPayload,
  LabelButton,
  labelOf,
  RegisterEntryFields,
  REGISTER_TYPES,
  useRegisters,
  VerifyDialog,
  type EntryState,
  type ExtraState,
} from "./inventory";
import { AssetRegisterDialog } from "./RecordDetail";
import { AttachDialog } from "./RequestDetail";
import {
  DocumentList,
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
  ReasonDialog,
  SectionCard,
  StatusBadge,
  todayIso,
  usePm,
  useRunner,
} from "./shared";

const ASSET_STATUSES = [
  "ACTIVE", "IN_STORE", "UNDER_INSTALLATION", "IN_USE", "UNDER_REPAIR", "UNDER_AMC", "TEMPORARILY_TRANSFERRED",
  "PERMANENTLY_TRANSFERRED", "LOST", "DAMAGED", "CONDEMNED", "DISPOSED", "RETIRED",
];
const OIC_STATUSES = ["IN_USE", "UNDER_REPAIR", "DAMAGED", "LOST"];
const MANUAL_STATUSES = ASSET_STATUSES.filter((s) => !s.endsWith("_TRANSFERRED"));

export default function AssetsPage() {
  const { id } = useParams();
  return id ? <AssetDetail id={id} /> : <AssetsList />;
}

function AssetsList() {
  const { deptId, hasPerm, dept } = usePm();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [registerId, setRegisterId] = useState("");
  const [registerType, setRegisterType] = useState("");
  const [condition, setCondition] = useState("");
  const [placement, setPlacement] = useState("");
  const [term, setTerm] = useState("");
  const [search, setSearch] = useLiveSearchTerm(term);
  const [pageSearch, setPageSearch] = useState(search);
  if (pageSearch !== search) {
    setPageSearch(search);
    setPage(1);
  }
  const [registering, setRegistering] = useState(false);
  const registers = useRegisters(deptId).data?.results ?? [];
  const filters = {
    department_id: deptId ?? undefined,
    status,
    register_id: registerId,
    register_type: registerType,
    condition,
    unregistered: placement === "unregistered" ? "1" : undefined,
    main_only: placement === "main" ? "1" : undefined,
    ordering: registerId ? "register" : undefined,
  };
  const q = useQuery({
    queryKey: ["procurement", "assets", filters, page, search],
    queryFn: () => pmGet<Page<PmAsset>>("assets/", { ...filters, page, q: search }),
    enabled: !!deptId,
    placeholderData: keepPreviousData,
  });
  const reset = () => setPage(1);
  const transfers = useQuery({
    queryKey: ["procurement", "transfers", deptId],
    queryFn: () => pmGet<Page<PmTransfer>>("transfers/", { department_id: deptId, page_size: 100 }),
    enabled: !!deptId,
  });
  return (
    <Tabs defaultValue="register">
      <TabsList>
        <TabsTrigger value="register">Asset register</TabsTrigger>
        <TabsTrigger value="transfers">Transfers ({transfers.data?.results.filter((t) => ["REQUESTED", "APPROVED"].includes(t.status)).length ?? 0} open)</TabsTrigger>
      </TabsList>
      <TabsContent value="register">
        <SectionCard
          title="Asset register"
          actions={
            <>
              {hasPerm("reports") || hasPerm("assets") ? <ExportButtons path="assets/" query={{ ...filters, q: search || undefined }} name="asset-register" /> : null}
              {dept?.menus.registers ? (
                <Button size="sm" variant="outline" asChild>
                  <Link to="/procurement/registers"><BookOpen className="mr-2 h-4 w-4" />Register books</Link>
                </Button>
              ) : null}
              <Button size="sm" variant="outline" asChild>
                <Link to="/procurement/scan"><ScanLine className="mr-2 h-4 w-4" />Scan / verify</Link>
              </Button>
              {hasPerm("assets") ? (
                <Button size="sm" onClick={() => setRegistering(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Register asset
                </Button>
              ) : null}
            </>
          }
        >
          <form className="mb-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); setPage(1); setSearch(term.trim()); }}>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Tag, number, serial, PO, or MAJ-1/12/3" value={term} onChange={(e) => setTerm(e.target.value)} />
            </div>
            <NativeSelect aria-label="Status" className="w-48" value={status} onChange={(e) => { reset(); setStatus(e.target.value); }} placeholder="All statuses" options={ASSET_STATUSES.map((s) => ({ value: s, label: humanize(s) }))} />
            <NativeSelect aria-label="Register book" className="w-48" value={registerId} onChange={(e) => { reset(); setRegisterId(e.target.value); }} placeholder="All register books" options={registers.map((r) => ({ value: String(r.id), label: `${r.code} · ${r.name}` }))} />
            <NativeSelect aria-label="Register type" className="w-44" value={registerType} onChange={(e) => { reset(); setRegisterType(e.target.value); }} placeholder="Major & Minor" options={REGISTER_TYPES} />
            <NativeSelect aria-label="Condition" className="w-40" value={condition} onChange={(e) => { reset(); setCondition(e.target.value); }} placeholder="Any condition" options={CONDITIONS} />
            <NativeSelect aria-label="Entry" className="w-48" value={placement} onChange={(e) => { reset(); setPlacement(e.target.value); }} placeholder="All entries" options={[{ value: "unregistered", label: "Not yet in a register" }, { value: "main", label: "Main assets only" }]} />
          </form>
          {q.error ? <p className="mb-2 text-sm text-destructive">{errorMessage(q.error)}</p> : null}
          <div className={cn("overflow-x-auto", refetchingClass(q.isPlaceholderData))} aria-busy={q.isFetching}>
            <Table serialStart={pageSerialStart(q.data)}>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset tag</TableHead>
                  <TableHead>Register · page · serial</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Mfr. serial</TableHead>
                  <TableHead>Equipment / location</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Last verified</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.isLoading ? <LoadingRow colSpan={10} /> : !q.data?.results.length ? <EmptyRow colSpan={10} /> : q.data.results.map((a) => (
                  <TableRow key={a.id} className="cursor-pointer" onClick={() => navigate(`/procurement/assets/${a.id}`)}>
                    <TableCell className="font-mono text-xs">
                      <Link className="text-primary underline" to={`/procurement/assets/${a.id}`} onClick={(e) => e.stopPropagation()}>{a.asset_tag || a.number}</Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs">{a.register_ref || <span className="text-amber-700">not entered</span>}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {a.parent ? <span className="mr-1 text-xs text-muted-foreground">↳</span> : null}
                      {a.description}
                    </TableCell>
                    <TableCell>{a.serial_number || "—"}</TableCell>
                    <TableCell>{a.equipment?.name ?? a.location ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(a.cost)}</TableCell>
                    <TableCell>{a.condition ? labelOf(CONDITIONS, a.condition) : "—"}</TableCell>
                    <TableCell>{a.last_verified_on ? fmtDate(a.last_verified_on) : "—"}</TableCell>
                    <TableCell><StatusBadge status={a.status} label={a.status_label} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {q.data ? <Pager page={q.data.page} count={q.data.count} pageSize={q.data.page_size} onPage={setPage} /> : null}
        </SectionCard>
      </TabsContent>
      <TabsContent value="transfers">
        <TransfersTable transfers={transfers.data?.results ?? []} loading={transfers.isLoading} />
      </TabsContent>
      <AssetRegisterDialog open={registering} onOpenChange={setRegistering} onSaved={() => qc.invalidateQueries({ queryKey: ["procurement"] })} />
    </Tabs>
  );
}

function TransfersTable({ transfers, loading }: { transfers: PmTransfer[]; loading?: boolean }) {
  const { hasPerm } = usePm();
  const qc = useQueryClient();
  const { busy, run } = useRunner();
  const [dlg, setDlg] = useState<{ t: PmTransfer; action: "reject" | "cancel" } | null>(null);
  const act = (t: PmTransfer, action: string, body: Record<string, unknown>, ok: string) =>
    run(async () => {
      await pmPost(`transfers/${t.id}/${action}/`, body);
      qc.invalidateQueries({ queryKey: ["procurement"] });
    }, ok);
  return (
    <SectionCard title="Asset transfers" description="Transfers stay within the department. Temporary transfers need a return date.">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead>Asset</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Requested by</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? <LoadingRow colSpan={8} /> : !transfers.length ? <EmptyRow colSpan={8} text="No transfers." /> : transfers.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-mono text-xs">{t.number}</TableCell>
                <TableCell><Link className="text-primary underline" to={`/procurement/assets/${t.asset.id}`}>{t.asset.number}</Link></TableCell>
                <TableCell>{humanize(t.transfer_type)}{t.expected_return_date ? ` · back ${fmtDate(t.expected_return_date)}` : ""}</TableCell>
                <TableCell>{t.to_equipment?.name ?? t.to_location ?? "—"}</TableCell>
                <TableCell className="max-w-xs truncate">{t.reason}</TableCell>
                <TableCell>{t.requested_by.name}</TableCell>
                <TableCell><StatusBadge status={t.status} /></TableCell>
                <TableCell className="whitespace-nowrap">
                  {hasPerm("assets") && t.status === "REQUESTED" ? (
                    <>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => act(t, "decide", { decision: "APPROVE" }, "Transfer approved.")}>Approve</Button>{" "}
                      <Button size="sm" variant="ghost" onClick={() => setDlg({ t, action: "reject" })}>Reject</Button>
                    </>
                  ) : null}
                  {hasPerm("assets") && t.status === "APPROVED" ? <Button size="sm" variant="outline" disabled={busy} onClick={() => act(t, "complete", {}, "Transfer completed.")}>Complete</Button> : null}
                  {hasPerm("assets") && t.status === "COMPLETED" && t.transfer_type === "TEMPORARY" ? <Button size="sm" variant="outline" disabled={busy} onClick={() => act(t, "return", {}, "Asset returned.")}>Mark returned</Button> : null}
                  {["REQUESTED", "APPROVED"].includes(t.status) ? <Button size="sm" variant="ghost" onClick={() => setDlg({ t, action: "cancel" })}>Cancel</Button> : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ReasonDialog
        open={!!dlg}
        onOpenChange={(o) => !o && setDlg(null)}
        title={dlg?.action === "reject" ? "Reject transfer" : "Cancel transfer"}
        label={dlg?.action === "reject" ? "Note" : "Reason"}
        destructive
        confirmLabel={dlg?.action === "reject" ? "Reject" : "Cancel transfer"}
        onConfirm={(text) => (dlg?.action === "reject" ? act(dlg.t, "decide", { decision: "REJECT", note: text }, "Transfer rejected.") : act(dlg!.t, "cancel", { reason: text }, "Transfer cancelled."))}
      />
    </SectionCard>
  );
}

type FullAsset = PmAsset & { documents?: PmDocument[]; amc_records?: { id: number; number: string; status: string; end_date: string }[]; remarks?: string };

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children || "—"}</dd>
    </div>
  );
}

function AssetDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { hasPerm, boot, deptId } = usePm();
  const key = ["procurement", "asset", id];
  const q = useQuery({ queryKey: key, queryFn: () => pmGet<FullAsset>(`assets/${id}/`) });
  const { run } = useRunner();
  const [dlg, setDlg] = useState<"" | "status" | "transfer" | "attach" | "edit" | "verify" | "dispose">("");
  if (q.isLoading) return <Loader2 className="mx-auto mt-10 h-6 w-6 animate-spin text-muted-foreground" />;
  if (q.error || !q.data) return <p className="text-sm text-destructive">{errorMessage(q.error)}</p>;
  const a = q.data;
  const final = ["DISPOSED", "RETIRED"].includes(a.status);
  const labStaff = !!a.equipment && (boot.oic_equipment_ids.includes(a.equipment.id) || (boot.incharge_equipment_ids ?? []).includes(a.equipment.id));
  const canStatus = !final && (hasPerm("assets") || labStaff);
  const canVerify = !final && (a.can_verify ?? (hasPerm("assets") || labStaff));
  const refresh = () => qc.invalidateQueries({ queryKey: ["procurement"] });
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>
      <SectionCard
        title={<span className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm text-muted-foreground">{a.asset_tag || a.number}</span>{a.description}<StatusBadge status={a.status} label={a.status_label} /></span>}
        description={`${a.number} · ${a.category.name} · ${a.department.name}`}
        actions={
          <>
            {hasPerm("assets") && !final ? <Button size="sm" variant="outline" onClick={() => setDlg("edit")}><Pencil className="mr-2 h-4 w-4" />Edit / register entry</Button> : null}
            {canVerify ? <Button size="sm" variant="outline" onClick={() => setDlg("verify")}>Verify</Button> : null}
            <LabelButton ids={[a.id]} />
            {canStatus ? <Button size="sm" variant="outline" onClick={() => setDlg("status")}>Change status</Button> : null}
            {canStatus ? <Button size="sm" variant="outline" onClick={() => setDlg("transfer")}>Request transfer</Button> : null}
            {hasPerm("assets") ? <Button size="sm" variant="outline" onClick={() => setDlg("attach")}>Attach</Button> : null}
            {hasPerm("assets") && !final ? <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDlg("dispose")}>Condemn / dispose</Button> : null}
          </>
        }
      >
        <div className="mb-4 rounded-md border bg-muted/30 p-3 text-sm">
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
            <Detail label="Register book">{a.register ? <Link className="text-primary underline" to={`/procurement/registers/${a.register.id}`}>{a.register.code} · {a.register.name}{a.register.volume ? ` (Vol. ${a.register.volume})` : ""}</Link> : <span className="text-amber-700">Not entered in a register yet</span>}</Detail>
            <Detail label="Page / serial">{a.register ? `p.${a.register_page ?? "—"} · s.${a.register_serial || "—"}` : ""}</Detail>
            <Detail label="Entry date">{a.register_entry_date ? fmtDate(a.register_entry_date) : ""}</Detail>
            <Detail label="Quantity on entry">{String(a.quantity ?? 1)}</Detail>
            <Detail label="Condition">{a.condition ? labelOf(CONDITIONS, a.condition) : ""}</Detail>
            <Detail label="Last verified">{a.last_verified_on ? `${fmtDate(a.last_verified_on)} · ${humanize(a.last_verification_result)}` : <span className="text-amber-700">Never</span>}</Detail>
            <Detail label="Main asset">{a.parent ? <Link className="text-primary underline" to={`/procurement/assets/${a.parent.id}`}>{a.parent.asset_tag || a.parent.number} · {a.parent.description}</Link> : ""}</Detail>
            <Detail label="Legacy reference">{a.legacy_ref}</Detail>
          </dl>
        </div>
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-muted-foreground">Make / model</dt><dd>{[a.make, a.model_number].filter(Boolean).join(" / ") || "—"}</dd></div>
          <div><dt className="text-muted-foreground">Serial / tag</dt><dd>{[a.serial_number, a.asset_tag].filter(Boolean).join(" / ") || "—"}</dd></div>
          <div><dt className="text-muted-foreground">Equipment</dt><dd>{a.equipment?.name ?? "—"}</dd></div>
          <div><dt className="text-muted-foreground">Location</dt><dd>{a.location || "—"}</dd></div>
          <div><dt className="text-muted-foreground">Cost</dt><dd>{money(a.cost)}</dd></div>
          <div><dt className="text-muted-foreground">Purchased</dt><dd>{fmtDate(a.purchase_date)}{a.vendor ? ` · ${a.vendor.name}` : ""}</dd></div>
          <div><dt className="text-muted-foreground">Warranty until</dt><dd>{fmtDate(a.warranty_until)}</dd></div>
          <div><dt className="text-muted-foreground">Procurement</dt><dd>{a.procurement_record ? <Link className="text-primary underline" to={`/procurement/records/${a.procurement_record.id}`}>{a.procurement_record.number}</Link> : "—"}</dd></div>
          <div><dt className="text-muted-foreground">Custodian</dt><dd>{a.custodian?.name ?? "—"}</dd></div>
          <div><dt className="text-muted-foreground">AMC / service</dt><dd>{a.amc_records?.length ? a.amc_records.map((x) => `${x.number} (${humanize(x.status)}, ${fmtDate(x.end_date)})`).join(", ") : a.amc_until ? `until ${fmtDate(a.amc_until)}` : "—"}</dd></div>
          <Detail label="Supplier">{a.supplier_name || a.vendor?.name}</Detail>
          <Detail label="PO / supply order">{[a.po_number, a.po_date ? fmtDate(a.po_date) : ""].filter(Boolean).join(" · ")}</Detail>
          <Detail label="Invoice">{[a.invoice_number, a.invoice_date ? fmtDate(a.invoice_date) : ""].filter(Boolean).join(" · ")}</Detail>
          <Detail label="Funding">{[a.funding_source || (a.funding_type ? humanize(a.funding_type) : ""), a.project_code].filter(Boolean).join(" · ")}</Detail>
          <Detail label="Installed">{a.installation_date ? fmtDate(a.installation_date) : ""}</Detail>
          <Detail label="Laboratory">{a.laboratory?.name}</Detail>
        </dl>
      </SectionCard>
      {a.accessories?.length ? (
        <SectionCard title={`Accessories (${a.accessories.length})`} description="Items entered as accessories of this main asset.">
          <ul className="divide-y rounded-md border text-sm">
            {a.accessories.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <Link className="text-primary underline" to={`/procurement/assets/${x.id}`}>{x.asset_tag || x.number}</Link>
                <span className="min-w-0 flex-1 truncate">{x.description}</span>
                <span className="font-mono text-xs text-muted-foreground">{x.register_ref}</span>
                <StatusBadge status={x.status} />
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Physical verification" description="GFR Rule 213: verify at least once a year.">
          {a.verifications?.length ? (
            <ol className="space-y-2 text-sm">
              {a.verifications.map((v) => (
                <li key={v.id} className="border-l-2 border-primary/30 pl-3">
                  <div className="flex flex-wrap items-center gap-2"><StatusBadge status={v.result === "FOUND" ? "COMPLETED" : "FLAGGED"} label={v.result_label} />{v.campaign ? <span className="text-xs text-muted-foreground">{v.campaign.number}</span> : null}</div>
                  <div className="text-xs text-muted-foreground">{v.verified_by?.name} · {fmtDate(v.verified_on)} · {humanize(v.method)}{v.location_seen ? ` · ${v.location_seen}` : ""}</div>
                  {v.remarks ? <p>{v.remarks}</p> : null}
                </li>
              ))}
            </ol>
          ) : <p className="text-sm text-muted-foreground">Not verified yet.</p>}
        </SectionCard>
        <SectionCard title="Maintenance & disposal">
          {a.maintenance_records?.length ? (
            <ul className="mb-3 space-y-1 text-sm">
              {a.maintenance_records.map((m) => (
                <li key={m.id}><Link className="text-primary underline" to={`/procurement/maintenance?record=${m.id}`}>{m.number}</Link> · {humanize(m.kind)} · {fmtDate(m.downtime_start)} · {money(m.total_cost)}</li>
              ))}
            </ul>
          ) : <p className="mb-3 text-sm text-muted-foreground">No maintenance recorded against this asset.</p>}
          {a.disposals?.map((d) => (
            <div key={d.id} className="rounded-md border border-red-200 bg-red-50 p-2 text-sm dark:bg-red-950/20">
              <div className="font-medium">{d.number} · {d.action_label}</div>
              <div className="text-xs text-muted-foreground">Board: {d.board_reference || "—"} · Sanction: {d.sanction_reference || "—"}{d.sanction_date ? ` (${fmtDate(d.sanction_date)})` : ""} · {d.recorded_by?.name}, {fmtDate(d.recorded_at, true)}</div>
              <p>{d.remarks}</p>
            </div>
          ))}
        </SectionCard>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Status history">
          <ol className="space-y-2 text-sm">
            {(a.status_history ?? []).map((h, i) => (
              <li key={i} className="border-l-2 border-primary/30 pl-3">
                <div>{h.from_status ? `${humanize(h.from_status)} → ` : ""}<span className="font-medium">{humanize(h.to_status)}</span></div>
                <div className="text-xs text-muted-foreground">{h.changed_by?.name} · {fmtDate(h.changed_at, true)}</div>
                {h.reason ? <p>{h.reason}</p> : null}
              </li>
            ))}
          </ol>
        </SectionCard>
        <SectionCard title="Documents"><DocumentList docs={a.documents} /></SectionCard>
      </div>
      {a.transfers?.length ? <TransfersTable transfers={a.transfers} /> : null}

      <StatusDialog
        open={dlg === "status"}
        onOpenChange={(o) => setDlg(o ? "status" : "")}
        options={hasPerm("assets") ? MANUAL_STATUSES.filter((s) => s !== a.status) : OIC_STATUSES.filter((s) => s !== a.status)}
        onSave={(body) => run(async () => { await pmPost(`assets/${a.id}/status/`, body); refresh(); }, "Status updated.")}
      />
      <TransferDialog
        open={dlg === "transfer"}
        onOpenChange={(o) => setDlg(o ? "transfer" : "")}
        equipment={boot.equipment.filter((e) => e.department_id === deptId && e.id !== a.equipment?.id)}
        onSave={(body) => run(async () => { await pmPost(`assets/${a.id}/transfers/`, body); refresh(); }, "Transfer requested.")}
      />
      {dlg === "edit" ? (
        <EditAssetDialog asset={a} onOpenChange={(o) => setDlg(o ? "edit" : "")} onSaved={refresh} />
      ) : null}
      <VerifyDialog
        open={dlg === "verify"}
        onOpenChange={(o) => setDlg(o ? "verify" : "")}
        asset={a}
        onSubmit={(body) => run(async () => { await pmPost(`assets/${a.id}/verifications/`, body); refresh(); }, "Verification recorded.")}
      />
      {dlg === "dispose" ? (
        <DisposeDialog
          open
          onOpenChange={(o) => setDlg(o ? "dispose" : "")}
          asset={a}
          onSubmit={(body) => run(async () => { await pmPost(`assets/${a.id}/dispose/`, body); refresh(); }, "Recorded.")}
        />
      ) : null}
      <AttachDialog
        open={dlg === "attach"}
        onOpenChange={(o) => setDlg(o ? "attach" : "")}
        types={["ASSET_PHOTO", "INVOICE", "INSPECTION_REPORT", "OTHER"]}
        onUpload={(file, docType, description) =>
          run(async () => {
            const form = new FormData();
            form.append("file", file);
            form.append("doc_type", docType);
            form.append("description", description);
            await pmForm(`assets/${a.id}/documents/`, form);
            refresh();
          }, "Document attached.")
        }
      />
    </div>
  );
}

function StatusDialog({ open, onOpenChange, options, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; options: string[]; onSave: (b: Record<string, unknown>) => Promise<boolean> }) {
  const [status, setStatus] = useState("");
  return (
    <ReasonDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Change asset status"
      description="Disposal is only allowed from Condemned, Damaged or Lost. Use a transfer to move the asset."
      confirmLabel="Save"
      onConfirm={(reason) => (status ? onSave({ status, reason }) : Promise.resolve(false))}
    >
      <Field label="New status">
        <NativeSelect value={status} onChange={(e) => setStatus(e.target.value)} placeholder="Choose" options={options.map((s) => ({ value: s, label: humanize(s) }))} />
      </Field>
    </ReasonDialog>
  );
}

function TransferDialog({
  open,
  onOpenChange,
  equipment,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  equipment: { id: number; name: string }[];
  onSave: (b: Record<string, unknown>) => Promise<boolean>;
}) {
  const [f, setF] = useState({ transfer_type: "TEMPORARY", to_equipment_id: "", to_location: "", expected_return_date: "", reason: "" });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const [busy, setBusy] = useState(false);
  const ok = f.reason.trim() && (f.to_equipment_id || f.to_location.trim()) && (f.transfer_type === "PERMANENT" || f.expected_return_date > todayIso());
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request transfer</DialogTitle>
          <DialogDescription>The office (asset permission) approves; the requester cannot approve their own transfer.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Type">
            <NativeSelect value={f.transfer_type} onChange={set("transfer_type")} options={[{ value: "TEMPORARY", label: "Temporary" }, { value: "PERMANENT", label: "Permanent" }]} />
          </Field>
          {f.transfer_type === "TEMPORARY" ? (
            <Field label="Expected return"><DateInput min={todayIso()} value={f.expected_return_date} onChange={set("expected_return_date")} /></Field>
          ) : <div />}
          <Field label="To equipment">
            <NativeSelect value={f.to_equipment_id} onChange={set("to_equipment_id")} placeholder="—" options={equipment.map((e) => ({ value: String(e.id), label: e.name }))} />
          </Field>
          <Field label="Or to location"><Input value={f.to_location} onChange={set("to_location")} /></Field>
        </div>
        <Field label="Reason (required)"><Textarea rows={3} value={f.reason} onChange={set("reason")} /></Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={busy || !ok}
            onClick={async () => {
              setBusy(true);
              const done = await onSave({
                transfer_type: f.transfer_type,
                to_equipment_id: f.to_equipment_id ? Number(f.to_equipment_id) : null,
                to_location: f.to_location,
                expected_return_date: f.transfer_type === "TEMPORARY" ? f.expected_return_date : null,
                reason: f.reason.trim(),
              });
              setBusy(false);
              if (done) onOpenChange(false);
            }}
          >
            Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditAssetDialog({ asset, onOpenChange, onSaved }: { asset: FullAsset; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const { deptId, boot } = usePm();
  const registers = useRegisters(deptId).data?.results ?? [];
  const equipment = boot.equipment.filter((e) => e.department_id === deptId);
  const [entry, setEntry] = useState<EntryState>({
    register_id: asset.register ? String(asset.register.id) : "",
    register_page: asset.register_page ? String(asset.register_page) : "",
    register_serial: asset.register_serial ?? "",
    register_entry_date: asset.register_entry_date ?? "",
  });
  const [extra, setExtra] = useState<ExtraState>(() => extraFromAsset(asset));
  const [f, setF] = useState({
    description: asset.description,
    make: asset.make,
    model_number: asset.model_number,
    serial_number: asset.serial_number,
    asset_tag: asset.asset_tag,
    location: asset.location,
    equipment_id: asset.equipment ? String(asset.equipment.id) : "",
    warranty_until: asset.warranty_until ?? "",
    cost: asset.cost,
    reason: "",
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const parents = useQuery({
    queryKey: ["procurement", "assets", "parents", deptId, asset.equipment?.id],
    queryFn: () => pmGet<Page<PmAsset>>("assets/", { department_id: deptId, main_only: 1, equipment_id: asset.equipment?.id, page_size: 100 }),
    enabled: !!deptId && !asset.accessories?.length,
  }).data?.results.filter((p) => p.id !== asset.id) ?? [];
  const { busy, run } = useRunner();
  const costChanged = Number(f.cost) !== Number(asset.cost);
  const save = async () => {
    const body: Record<string, unknown> = {
      description: f.description,
      make: f.make,
      model_number: f.model_number,
      serial_number: f.serial_number,
      asset_tag: f.asset_tag,
      location: f.location,
      equipment_id: f.equipment_id ? Number(f.equipment_id) : null,
      warranty_until: f.warranty_until || null,
      ...extraPayload(extra),
      ...entryPayload(entry),
    };
    if (asset.accessories?.length) delete body.parent_id;
    if (costChanged) {
      body.cost = f.cost;
      body.reason = f.reason;
    }
    const ok = await run(async () => { await pmPatch(`assets/${asset.id}/`, body); onSaved(); }, "Asset updated.");
    if (ok) onOpenChange(false);
  };
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit asset & register entry</DialogTitle>
          <DialogDescription>Register, page and serial must be unique; the asset tag is printed on the QR label.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <RegisterEntryFields value={entry} onChange={setEntry} registers={registers} />
          <Field label="Description" className="sm:col-span-2"><Input value={f.description} onChange={set("description")} /></Field>
          <Field label="Make"><Input value={f.make} onChange={set("make")} /></Field>
          <Field label="Model"><Input value={f.model_number} onChange={set("model_number")} /></Field>
          <Field label="Manufacturer serial no."><Input value={f.serial_number} onChange={set("serial_number")} /></Field>
          <Field label="Asset tag" hint="Leave as generated unless an older tag is painted on the item."><Input value={f.asset_tag} onChange={set("asset_tag")} /></Field>
          <Field label="Equipment">
            <NativeSelect value={f.equipment_id} onChange={set("equipment_id")} placeholder="—" options={equipment.map((e) => ({ value: String(e.id), label: e.name }))} />
          </Field>
          <Field label="Location"><Input value={f.location} onChange={set("location")} /></Field>
          <Field label="Warranty until"><DateInput value={f.warranty_until} onChange={set("warranty_until")} /></Field>
          <Field label="Cost (₹)"><Input inputMode="decimal" value={f.cost} onChange={set("cost")} /></Field>
          {costChanged ? <Field label="Reason for cost change (required)" className="sm:col-span-2"><Input value={f.reason} onChange={set("reason")} /></Field> : null}
          <ExtraFields
            value={extra}
            onChange={setExtra}
            parents={asset.accessories?.length ? [] : parents.map((p) => ({ id: p.id, label: `${p.asset_tag || p.number} · ${p.description}` }))}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={busy || !f.description.trim() || (costChanged && !f.reason.trim())} onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, pmForm, pmGet, pmPost, type Page, type PmAsset, type PmDocument, type PmTransfer } from "@/lib/procurementApi";
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
  const { deptId, hasPerm } = usePm();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const [registering, setRegistering] = useState(false);
  const q = useQuery({
    queryKey: ["procurement", "assets", deptId, page, status, search],
    queryFn: () => pmGet<Page<PmAsset>>("assets/", { department_id: deptId, page, status, q: search }),
    enabled: !!deptId,
  });
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
              {hasPerm("reports") || hasPerm("assets") ? <ExportButtons path="assets/" query={{ department_id: deptId ?? undefined, status }} name="asset-register" /> : null}
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
              <Input className="pl-8" placeholder="Number, serial, tag or description" value={term} onChange={(e) => setTerm(e.target.value)} />
            </div>
            <NativeSelect aria-label="Status" className="w-56" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} placeholder="All statuses" options={ASSET_STATUSES.map((s) => ({ value: s, label: humanize(s) }))} />
          </form>
          {q.error ? <p className="mb-2 text-sm text-destructive">{errorMessage(q.error)}</p> : null}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Serial</TableHead>
                  <TableHead>Equipment / location</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.isLoading ? <LoadingRow colSpan={7} /> : !q.data?.results.length ? <EmptyRow colSpan={7} /> : q.data.results.map((a) => (
                  <TableRow key={a.id} className="cursor-pointer" onClick={() => navigate(`/procurement/assets/${a.id}`)}>
                    <TableCell className="font-mono text-xs">{a.number}</TableCell>
                    <TableCell className="max-w-xs truncate">{a.description}</TableCell>
                    <TableCell>{a.serial_number || "—"}</TableCell>
                    <TableCell>{a.equipment?.name ?? a.location ?? "—"}</TableCell>
                    <TableCell>{a.category.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(a.cost)}</TableCell>
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

function AssetDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { hasPerm, boot, deptId } = usePm();
  const key = ["procurement", "asset", id];
  const q = useQuery({ queryKey: key, queryFn: () => pmGet<FullAsset>(`assets/${id}/`) });
  const { run } = useRunner();
  const [dlg, setDlg] = useState<"" | "status" | "transfer" | "attach">("");
  if (q.isLoading) return <Loader2 className="mx-auto mt-10 h-6 w-6 animate-spin text-muted-foreground" />;
  if (q.error || !q.data) return <p className="text-sm text-destructive">{errorMessage(q.error)}</p>;
  const a = q.data;
  const final = ["DISPOSED", "RETIRED"].includes(a.status);
  const isOic = !!a.equipment && boot.oic_equipment_ids.includes(a.equipment.id);
  const canStatus = !final && (hasPerm("assets") || isOic);
  const refresh = () => qc.invalidateQueries({ queryKey: ["procurement"] });
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>
      <SectionCard
        title={<span className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm text-muted-foreground">{a.number}</span>{a.description}<StatusBadge status={a.status} label={a.status_label} /></span>}
        description={`${a.category.name} · ${a.department.name}`}
        actions={
          <>
            {canStatus ? <Button size="sm" variant="outline" onClick={() => setDlg("status")}>Change status</Button> : null}
            {canStatus ? <Button size="sm" variant="outline" onClick={() => setDlg("transfer")}>Request transfer</Button> : null}
            {hasPerm("assets") ? <Button size="sm" variant="outline" onClick={() => setDlg("attach")}>Attach</Button> : null}
          </>
        }
      >
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
          <div><dt className="text-muted-foreground">AMC / service</dt><dd>{a.amc_records?.length ? a.amc_records.map((x) => `${x.number} (${humanize(x.status)}, ${fmtDate(x.end_date)})`).join(", ") : "—"}</dd></div>
        </dl>
      </SectionCard>
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
            <Field label="Expected return"><Input type="date" min={todayIso()} value={f.expected_return_date} onChange={set("expected_return_date")} /></Field>
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

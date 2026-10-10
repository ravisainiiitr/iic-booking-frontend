import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Plus, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, pmForm, pmGet, pmPost, type PmRecord, type PmRequest, type PmRequestLine } from "@/lib/procurementApi";
import { useDeptMasters } from "./RequestWizard";
import {
  DocumentList,
  Field,
  FilePicker,
  fmtDate,
  humanize,
  money,
  NativeSelect,
  qty,
  ReasonDialog,
  SectionCard,
  StatusBadge,
  todayIso,
  usePm,
  useRunner,
} from "./shared";

type Dlg = "" | "approve" | "reject" | "hold" | "cancel" | "stores" | "offline" | "attach" | "stores_edit";

const FULFILMENT_LABEL: Record<string, string> = { STOCK: "From stock", PROCURE: "To procure" };

export default function RequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const key = ["procurement", "request", id];
  const q = useQuery({ queryKey: key, queryFn: () => pmGet<PmRequest>(`requests/${id}/`) });
  const { busy, run } = useRunner();
  const [dlg, setDlg] = useState<Dlg>("");

  if (q.isLoading) return <Loader2 className="mx-auto mt-10 h-6 w-6 animate-spin text-muted-foreground" />;
  if (q.error || !q.data) return <p className="text-sm text-destructive">{errorMessage(q.error)}</p>;
  const r = q.data;
  const acts = new Set(r.available_actions ?? []);
  const refresh = (data?: PmRequest) => {
    if (data) qc.setQueryData(key, data);
    qc.invalidateQueries({ queryKey: ["procurement"] });
  };
  const act = (action: string, body: Record<string, unknown>, ok: string) =>
    run(async () => refresh(await pmPost<PmRequest>(`requests/${r.id}/${action}/`, body)), ok);

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <SectionCard
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">{r.number}</span>
            {r.title}
            <StatusBadge status={r.status} label={r.status_label} />
          </span>
        }
        description={`${r.request_type.name}${r.category ? ` · ${r.category.name}` : ""} · ${r.department.name}${r.equipment ? ` · ${r.equipment.name}` : ""}`}
        actions={
          <>
            {acts.has("submit") ? <Button size="sm" disabled={busy} onClick={() => act("submit", {}, "Submitted for approval.")}>Submit</Button> : null}
            {acts.has("resubmit") ? <Button size="sm" disabled={busy} onClick={() => act("resubmit", {}, "Resubmitted.")}>Resubmit</Button> : null}
            {acts.has("approve") ? <Button size="sm" onClick={() => setDlg("approve")}>Approve</Button> : null}
            {acts.has("stores_edit") ? <Button size="sm" variant="outline" onClick={() => setDlg("stores_edit")}>Modify lines / stock check</Button> : null}
            {acts.has("stores_review") ? <Button size="sm" variant="outline" onClick={() => setDlg("stores")}>Stores availability</Button> : null}
            {acts.has("hold") ? <Button size="sm" variant="outline" onClick={() => setDlg("hold")}>Hold</Button> : null}
            {acts.has("resume") ? <Button size="sm" variant="outline" disabled={busy} onClick={() => act("resume", {}, "Resumed.")}>Resume</Button> : null}
            {acts.has("reject") ? <Button size="sm" variant="destructive" onClick={() => setDlg("reject")}>Reject</Button> : null}
            {acts.has("offline_hod_decision") ? <Button size="sm" variant="outline" onClick={() => setDlg("offline")}>Record offline HOD decision</Button> : null}
            {acts.has("issue") ? <Button size="sm" disabled={busy} onClick={() => act("issue", {}, "Issued from stores.")}>Issue from stores</Button> : null}
            {acts.has("start_procurement") ? (
              <Button
                size="sm"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const rec = await pmPost<PmRecord>(`requests/${r.id}/start-procurement/`, {});
                    refresh();
                    navigate(`/procurement/records/${rec.id}`);
                  }, "Procurement record opened.")
                }
              >
                Start procurement
              </Button>
            ) : null}
            {acts.has("record_purchase") ? (
              <Button size="sm" variant="outline" asChild>
                <Link to={`/procurement/small-purchases/new?request=${r.id}`}>Record purchase & bill</Link>
              </Button>
            ) : null}
            {acts.has("cancel") ? <Button size="sm" variant="ghost" onClick={() => setDlg("cancel")}>Cancel request</Button> : null}
          </>
        }
      >
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-muted-foreground">Requested by</dt><dd>{r.requested_by.name} ({humanize(r.raised_as_role)})</dd></div>
          <div><dt className="text-muted-foreground">Estimated total</dt><dd className="font-semibold">{money(r.estimated_total)}</dd></div>
          <div><dt className="text-muted-foreground">Approved amount</dt><dd>{money(r.approved_amount)}</dd></div>
          <div><dt className="text-muted-foreground">Financial year</dt><dd>{r.financial_year} · {humanize(r.funding_type)}</dd></div>
          <div><dt className="text-muted-foreground">Approval route</dt><dd>{r.approval_route.length ? r.approval_route.map(humanize).join(" → ") : "—"}</dd></div>
          <div><dt className="text-muted-foreground">Small purchase</dt><dd>{r.is_small_purchase ? "Yes" : "No"}</dd></div>
          <div><dt className="text-muted-foreground">Priority</dt><dd>{humanize(r.priority)}</dd></div>
          <div><dt className="text-muted-foreground">Submitted</dt><dd>{fmtDate(r.submitted_at, true)}</dd></div>
          {r.stage_age_days !== null && r.stage_age_days !== undefined ? (
            <div><dt className="text-muted-foreground">At this stage for</dt><dd className={r.stage_age_days > 7 ? "font-medium text-destructive" : ""}>{r.stage_age_days} day(s)</dd></div>
          ) : null}
          {r.maintenance_record_id ? (
            <div><dt className="text-muted-foreground">Raised from</dt><dd><Link className="text-primary underline" to={`/procurement/maintenance?record=${r.maintenance_record_id}`}>maintenance record</Link></dd></div>
          ) : null}
        </dl>
        {r.last_reason ? <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">Last reason: {r.last_reason}</p> : null}
        {r.justification ? <p className="mt-3 whitespace-pre-wrap text-sm"><span className="text-muted-foreground">Justification: </span>{r.justification}</p> : null}
        {r.specification ? <p className="mt-2 whitespace-pre-wrap text-sm"><span className="text-muted-foreground">Specification: </span>{r.specification}</p> : null}
        {r.procurement_record_ids?.length ? (
          <p className="mt-3 text-sm">
            Procurement:{" "}
            {r.procurement_record_ids.map((rid) => (
              <Link key={rid} to={`/procurement/records/${rid}`} className="mr-2 text-primary underline">
                record #{rid}
              </Link>
            ))}
          </p>
        ) : null}
      </SectionCard>

      <SectionCard title="Items">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Unit price</TableHead>
                <TableHead className="text-right">GST %</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Issued</TableHead>
                <TableHead>Stores</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(r.lines ?? []).map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-left">
                    {l.description}
                    {l.added_by_stores ? <span className="ml-2 rounded bg-sky-100 px-1.5 text-xs text-sky-900">added by Stores</span> : null}
                    {l.store_original && Object.keys(l.store_original).length ? (
                      <span className="block text-xs text-muted-foreground">
                        Requested: {Object.entries(l.store_original).map(([k, v]) => `${humanize(k)} ${v ?? "—"}`).join(", ")}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{qty(l.quantity)}</TableCell>
                  <TableCell>{l.uom}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(l.estimated_unit_price)}</TableCell>
                  <TableCell className="text-right tabular-nums">{Number(l.gst_rate)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(l.line_total)}</TableCell>
                  <TableCell className="text-right tabular-nums">{Number(l.issued_quantity) ? qty(l.issued_quantity) : "—"}</TableCell>
                  <TableCell className="text-xs">
                    {l.fulfilment ? <StatusBadge status={l.fulfilment === "STOCK" ? "AVAILABLE" : "PROCUREMENT"} label={FULFILMENT_LABEL[l.fulfilment]} /> : "—"}
                    {l.store_note ? <span className="block text-muted-foreground">{l.store_note}</span> : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Documents"
          actions={
            !["CANCELLED", "COMPLETED"].includes(r.status) ? (
              <Button size="sm" variant="outline" onClick={() => setDlg("attach")}>Attach</Button>
            ) : undefined
          }
        >
          <DocumentList docs={r.documents} />
        </SectionCard>
        <SectionCard title="Approval history" description="Immutable — entries are never edited or deleted.">
          <ol className="space-y-3">
            {(r.history ?? []).map((h) => (
              <li key={h.id} className="border-l-2 border-primary/30 pl-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{humanize(h.action)}</span>
                  <span className="text-muted-foreground">· {humanize(h.stage)}</span>
                  {h.is_offline ? <StatusBadge status="OFFLINE" label="Offline" /> : null}
                </div>
                <div className="text-xs text-muted-foreground">
                  {h.is_offline
                    ? `${h.offline_approver_name} (${h.offline_approver_designation}) on ${fmtDate(h.offline_approval_date)}, recorded by ${h.actor?.name ?? "—"}`
                    : h.actor?.name ?? "System"}{" "}
                  · {fmtDate(h.created_at, true)}
                </div>
                {h.amount ? <div className="text-xs">Amount: {money(h.amount)}</div> : null}
                {h.comments ? <p className="mt-1 whitespace-pre-wrap">{h.comments}</p> : null}
              </li>
            ))}
            {!r.history?.length ? <li className="text-sm text-muted-foreground">Not submitted yet.</li> : null}
          </ol>
        </SectionCard>
      </div>

      <ApproveDialog open={dlg === "approve"} onOpenChange={(o) => setDlg(o ? "approve" : "")} estimate={r.estimated_total} onApprove={(body) => act("approve", body, "Approved.")} />
      <ReasonDialog open={dlg === "reject"} onOpenChange={(o) => setDlg(o ? "reject" : "")} title="Reject request" destructive confirmLabel="Reject" onConfirm={(reason) => act("reject", { reason }, "Rejected.")} />
      <ReasonDialog open={dlg === "hold"} onOpenChange={(o) => setDlg(o ? "hold" : "")} title="Put request on hold" confirmLabel="Hold" onConfirm={(reason) => act("hold", { reason }, "Put on hold.")} />
      <ReasonDialog open={dlg === "cancel"} onOpenChange={(o) => setDlg(o ? "cancel" : "")} title="Cancel request" destructive confirmLabel="Cancel request" onConfirm={(reason) => act("cancel", { reason }, "Cancelled.")} />
      <StoresDialog open={dlg === "stores"} onOpenChange={(o) => setDlg(o ? "stores" : "")} request={r} onSubmit={(body) => act("stores-review", body, "Stores review recorded.")} />
      {dlg === "stores_edit" ? (
        <StoresEditDialog request={r} onOpenChange={(o) => setDlg(o ? "stores_edit" : "")} onSubmit={(body) => act("stores-edit", body, "Lines updated.")} />
      ) : null}
      <OfflineHodDialog
        open={dlg === "offline"}
        onOpenChange={(o) => setDlg(o ? "offline" : "")}
        onSubmit={(form) => run(async () => refresh(await pmForm<PmRequest>(`requests/${r.id}/offline-hod-decision/`, form)), "Offline decision recorded.")}
      />
      <AttachDialog
        open={dlg === "attach"}
        onOpenChange={(o) => setDlg(o ? "attach" : "")}
        types={["QUOTATION", "SPECIFICATION", "ESTIMATE", "OTHER"]}
        onUpload={(file, docType, description) =>
          run(async () => {
            const form = new FormData();
            form.append("file", file);
            form.append("doc_type", docType);
            form.append("description", description);
            await pmForm(`requests/${r.id}/documents/`, form);
            refresh();
          }, "Document attached.")
        }
      />
    </div>
  );
}

function ApproveDialog({
  open,
  onOpenChange,
  estimate,
  onApprove,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  estimate: string;
  onApprove: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const [comments, setComments] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve request</DialogTitle>
          <DialogDescription>Estimate {money(estimate)}. Leave the amount empty to approve the estimate.</DialogDescription>
        </DialogHeader>
        <Field label="Approved amount (optional)">
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={estimate} />
        </Field>
        <Field label="Comments (optional)">
          <Textarea rows={3} value={comments} onChange={(e) => setComments(e.target.value)} />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const ok = await onApprove({ comments, amount: amount || null });
              setBusy(false);
              if (ok) onOpenChange(false);
            }}
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StoresDialog({
  open,
  onOpenChange,
  request,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  request: PmRequest;
  onSubmit: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const decided = (request.lines ?? []).some((l) => l.fulfilment);
  const [decision, setDecision] = useState(decided ? "BY_LINES" : "AVAILABLE");
  const [comments, setComments] = useState("");
  const [avail, setAvail] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Stores availability</DialogTitle>
          <DialogDescription>Partly available items are issued from the central store; the rest continues to approval.</DialogDescription>
        </DialogHeader>
        <Field label="Decision">
          <NativeSelect
            value={decision}
            onChange={(e) => setDecision(e.target.value)}
            options={[
              ...(decided ? [{ value: "BY_LINES", label: "As marked on each line (stock / procure)" }] : []),
              { value: "AVAILABLE", label: "Everything available in stores" },
              { value: "PARTIAL", label: "Partly available" },
              { value: "NOT_AVAILABLE", label: "Not available — continue to purchase" },
            ]}
          />
        </Field>
        {decision === "PARTIAL" ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Requested</TableHead>
                <TableHead className="w-32">Available now</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(request.lines ?? []).map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{l.description}</TableCell>
                  <TableCell className="text-right">{qty(l.quantity)} {l.uom}</TableCell>
                  <TableCell>
                    <Input inputMode="decimal" aria-label={`Available ${l.description}`} value={avail[l.id] ?? ""} onChange={(e) => setAvail({ ...avail, [l.id]: e.target.value })} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
        <Field label="Comments (optional)">
          <Textarea rows={2} value={comments} onChange={(e) => setComments(e.target.value)} />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const lines = Object.entries(avail)
                .filter(([, v]) => v !== "" && Number(v) > 0)
                .map(([line_id, quantity]) => ({ line_id: Number(line_id), quantity }));
              const ok = await onSubmit({ decision, comments, lines: decision === "PARTIAL" ? lines : undefined });
              setBusy(false);
              if (ok) onOpenChange(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OfflineHodDialog({ open, onOpenChange, onSubmit }: { open: boolean; onOpenChange: (o: boolean) => void; onSubmit: (form: FormData) => Promise<boolean> }) {
  const [decision, setDecision] = useState("APPROVE");
  const [name, setName] = useState("");
  const [designation, setDesignation] = useState("Head of Department");
  const [date, setDate] = useState(todayIso());
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState("");
  const [comments, setComments] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const ok = name.trim() && designation.trim() && date && files.length === 1;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Record offline HOD decision</DialogTitle>
          <DialogDescription>Upload the signed approval. You are recorded as the person entering it; the HOD as the approver.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Decision">
            <NativeSelect value={decision} onChange={(e) => setDecision(e.target.value)} options={[{ value: "APPROVE", label: "Approved" }, { value: "REJECT", label: "Rejected" }]} />
          </Field>
          <Field label="Decision date">
            <DateInput max={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Approver name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Designation">
            <Input value={designation} onChange={(e) => setDesignation(e.target.value)} />
          </Field>
          <Field label="File / letter reference (optional)">
            <Input value={reference} onChange={(e) => setReference(e.target.value)} />
          </Field>
          {decision === "APPROVE" ? (
            <Field label="Approved amount (optional)">
              <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
          ) : null}
        </div>
        <Field label={decision === "REJECT" ? "Reason (required)" : "Comments (optional)"}>
          <Textarea rows={2} value={comments} onChange={(e) => setComments(e.target.value)} />
        </Field>
        <Field label="Signed document">
          <FilePicker files={files} onChange={setFiles} multiple={false} label="Choose signed approval" />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={busy || !ok || (decision === "REJECT" && !comments.trim())}
            onClick={async () => {
              setBusy(true);
              const form = new FormData();
              form.append("decision", decision);
              form.append("approver_name", name.trim());
              form.append("approver_designation", designation.trim());
              form.append("approval_date", date);
              form.append("reference", reference);
              form.append("comments", comments);
              if (amount) form.append("amount", amount);
              form.append("file", files[0]);
              const done = await onSubmit(form);
              setBusy(false);
              if (done) onOpenChange(false);
            }}
          >
            Record decision
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AttachDialog({
  open,
  onOpenChange,
  types,
  onUpload,
  title = "Attach document",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  types: string[];
  onUpload: (file: File, docType: string, description: string) => Promise<boolean>;
  title?: string;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [docType, setDocType] = useState(types[0]);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Documents are private; downloads are checked against your access every time.</DialogDescription>
        </DialogHeader>
        <Field label="Type">
          <NativeSelect value={docType} onChange={(e) => setDocType(e.target.value)} options={types.map((t) => ({ value: t, label: humanize(t) }))} />
        </Field>
        <Field label="Description (optional)">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={255} />
        </Field>
        <FilePicker files={files} onChange={setFiles} multiple={false} label="Choose file" />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={busy || files.length !== 1}
            onClick={async () => {
              setBusy(true);
              const ok = await onUpload(files[0], docType, description);
              setBusy(false);
              if (ok) {
                setFiles([]);
                setDescription("");
                onOpenChange(false);
              }
            }}
          >
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface EditLine {
  id: number | null;
  item_id: string;
  description: string;
  quantity: string;
  uom: string;
  estimated_unit_price: string;
  gst_rate: string;
  fulfilment: string;
  store_note: string;
  remove: boolean;
}

export const fromLine = (l: PmRequestLine): EditLine => ({
  id: l.id,
  item_id: l.item_id ? String(l.item_id) : "",
  description: l.description,
  quantity: String(Number(l.quantity)),
  uom: l.uom,
  estimated_unit_price: String(Number(l.estimated_unit_price)),
  gst_rate: String(Number(l.gst_rate)),
  fulfilment: l.fulfilment ?? "",
  store_note: l.store_note ?? "",
  remove: false,
});

/** Payload for ``requests/<id>/stores-edit/``: changed / removed existing lines and new lines. */
export function storesEditPayload(original: PmRequestLine[], rows: EditLine[]) {
  const byId = new Map(original.map((l) => [l.id, fromLine(l)]));
  const out: Record<string, unknown>[] = [];
  for (const r of rows) {
    if (r.id === null) {
      if (!r.remove && (r.description.trim() || r.item_id)) {
        out.push({ item_id: r.item_id ? Number(r.item_id) : null, description: r.description.trim(), quantity: r.quantity, uom: r.uom, estimated_unit_price: r.estimated_unit_price || "0", gst_rate: r.gst_rate, fulfilment: r.fulfilment, store_note: r.store_note });
      }
      continue;
    }
    if (r.remove) {
      out.push({ id: r.id, remove: true });
      continue;
    }
    const before = byId.get(r.id);
    const changed = !before || (Object.keys(r) as (keyof EditLine)[]).some((k) => k !== "remove" && r[k] !== before[k]);
    if (changed) {
      out.push({ id: r.id, item_id: r.item_id ? Number(r.item_id) : null, description: r.description.trim(), quantity: r.quantity, uom: r.uom, estimated_unit_price: r.estimated_unit_price, gst_rate: r.gst_rate, fulfilment: r.fulfilment, store_note: r.store_note });
    }
  }
  return out;
}

function StoresEditDialog({ request, onOpenChange, onSubmit }: { request: PmRequest; onOpenChange: (o: boolean) => void; onSubmit: (body: Record<string, unknown>) => Promise<boolean> }) {
  const { deptId } = usePm();
  const { items } = useDeptMasters(deptId);
  const original = request.lines ?? [];
  const [rows, setRows] = useState<EditLine[]>(() => original.map(fromLine));
  const [comments, setComments] = useState("");
  const [busy, setBusy] = useState(false);
  const check = useQuery({
    queryKey: ["procurement", "stock-check", request.id],
    queryFn: () => pmGet<{ results: { line_id: number; on_hand: string | null; suggested: string }[] }>(`requests/${request.id}/stock-check/`),
  }).data?.results ?? [];
  const stockOf = (id: number | null) => check.find((c) => c.line_id === id);
  const set = (i: number, patch: Partial<EditLine>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const pickItem = (i: number, id: string) => {
    const it = items.find((x) => String(x.id) === id);
    set(i, it ? { item_id: id, description: it.name, uom: it.uom || "Nos" } : { item_id: "" });
  };
  const applySuggestions = () =>
    setRows((rs) => rs.map((r) => {
      const s = stockOf(r.id);
      return s?.suggested && !r.fulfilment ? { ...r, fulfilment: s.suggested } : r;
    }));
  const payload = storesEditPayload(original, rows);
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modify lines (OC Stores)</DialogTitle>
          <DialogDescription>
            Correct quantities, substitute an item, add or drop lines and mark each line as issued from stock or to be procured. The requester is notified and the original values stay on record.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[150px]">Item</TableHead>
                <TableHead className="min-w-[180px]">Description</TableHead>
                <TableHead className="w-20">Qty</TableHead>
                <TableHead className="w-20">Unit</TableHead>
                <TableHead className="w-28">Unit price</TableHead>
                <TableHead className="w-20">GST %</TableHead>
                <TableHead className="text-right">In store</TableHead>
                <TableHead className="w-36">Fulfil</TableHead>
                <TableHead className="min-w-[140px]">Note</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => {
                const s = stockOf(r.id);
                return (
                  <TableRow key={r.id ?? `new-${i}`} className={r.remove ? "opacity-50" : ""}>
                    <TableCell>
                      <NativeSelect aria-label="Item" disabled={r.remove} value={r.item_id} onChange={(e) => pickItem(i, e.target.value)} placeholder="Free text" options={items.map((it) => ({ value: String(it.id), label: `${it.code} · ${it.name}` }))} />
                    </TableCell>
                    <TableCell><Input aria-label="Description" disabled={r.remove} value={r.description} onChange={(e) => set(i, { description: e.target.value })} /></TableCell>
                    <TableCell><Input aria-label="Quantity" disabled={r.remove} inputMode="decimal" value={r.quantity} onChange={(e) => set(i, { quantity: e.target.value })} /></TableCell>
                    <TableCell><Input aria-label="Unit" disabled={r.remove} value={r.uom} onChange={(e) => set(i, { uom: e.target.value })} /></TableCell>
                    <TableCell><Input aria-label="Unit price" disabled={r.remove} inputMode="decimal" value={r.estimated_unit_price} onChange={(e) => set(i, { estimated_unit_price: e.target.value })} /></TableCell>
                    <TableCell><Input aria-label="GST" disabled={r.remove} inputMode="decimal" value={r.gst_rate} onChange={(e) => set(i, { gst_rate: e.target.value })} /></TableCell>
                    <TableCell className="text-right tabular-nums">{s?.on_hand != null ? qty(s.on_hand) : "—"}</TableCell>
                    <TableCell>
                      <NativeSelect aria-label="Fulfilment" disabled={r.remove} value={r.fulfilment} onChange={(e) => set(i, { fulfilment: e.target.value })} placeholder="Not decided" options={[{ value: "STOCK", label: "From stock" }, { value: "PROCURE", label: "Procure" }]} />
                    </TableCell>
                    <TableCell><Input aria-label="Note" disabled={r.remove} value={r.store_note} onChange={(e) => set(i, { store_note: e.target.value })} /></TableCell>
                    <TableCell>
                      {r.id === null ? (
                        <Button variant="ghost" size="icon" aria-label="Drop new line" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
                      ) : (
                        <Button variant="ghost" size="icon" aria-label={r.remove ? "Keep line" : "Remove line"} onClick={() => set(i, { remove: !r.remove })}>
                          {r.remove ? <Undo2 className="h-4 w-4" /> : <X className="h-4 w-4" />}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setRows((rs) => [...rs, { id: null, item_id: "", description: "", quantity: "1", uom: "Nos", estimated_unit_price: "", gst_rate: "18", fulfilment: "", store_note: "", remove: false }])}>
            <Plus className="mr-2 h-4 w-4" />Add line
          </Button>
          <Button variant="ghost" size="sm" disabled={!check.some((c) => c.suggested)} onClick={applySuggestions}>Mark from stock where enough is on hand</Button>
        </div>
        <Field label="Comments for the requester (optional)">
          <Textarea rows={2} value={comments} onChange={(e) => setComments(e.target.value)} />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={busy || !payload.length || rows.every((r) => r.remove)}
            onClick={async () => {
              setBusy(true);
              const ok = await onSubmit({ lines: payload, comments });
              setBusy(false);
              if (ok) onOpenChange(false);
            }}
          >
            Save {payload.length ? `(${payload.length} change${payload.length > 1 ? "s" : ""})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

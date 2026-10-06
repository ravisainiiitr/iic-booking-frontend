import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, pmForm, pmGet, pmPost, type PmRecord, type PmRequest } from "@/lib/procurementApi";
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
  useRunner,
} from "./shared";

type Dlg = "" | "approve" | "reject" | "hold" | "cancel" | "stores" | "offline" | "attach";

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
              </TableRow>
            </TableHeader>
            <TableBody>
              {(r.lines ?? []).map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{l.description}</TableCell>
                  <TableCell className="text-right tabular-nums">{qty(l.quantity)}</TableCell>
                  <TableCell>{l.uom}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(l.estimated_unit_price)}</TableCell>
                  <TableCell className="text-right tabular-nums">{Number(l.gst_rate)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(l.line_total)}</TableCell>
                  <TableCell className="text-right tabular-nums">{Number(l.issued_quantity) ? qty(l.issued_quantity) : "—"}</TableCell>
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
  const [decision, setDecision] = useState("AVAILABLE");
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

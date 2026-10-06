import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  errorMessage,
  payloadForm,
  pmForm,
  pmGet,
  pmPost,
  type PmAsset,
  type PmInvoice,
  type PmRecord,
} from "@/lib/procurementApi";
import { blankInvoice, InvoiceFields, invoicePayload, invoiceValid, useVendors } from "./InvoiceForm";
import { AttachDialog } from "./RequestDetail";
import {
  DocumentList,
  EmptyRow,
  ExportButtons,
  Field,
  FilePicker,
  fmtDate,
  humanize,
  money,
  NativeSelect,
  ReasonDialog,
  SectionCard,
  StatusBadge,
  todayIso,
  usePm,
  useRunner,
} from "./shared";

const STEP_LABEL: Record<string, string> = {
  INDENT: "Indent",
  SPECIFICATION: "Specification",
  RFQ: "RFQ",
  QUOTATIONS: "Quotations",
  COMPARATIVE: "Comparative statement",
  VENDOR_SELECTION: "Vendor selection",
  PURCHASE_ORDER: "Purchase order",
  DELIVERY: "Delivery",
  INSPECTION: "Inspection / acceptance",
  INVOICE: "Bill / invoice",
  PAYMENT: "Payment",
  STOCK_ASSET_ENTRY: "Stock / asset entry",
};
const STEP_ORDER = Object.keys(STEP_LABEL);
const DEPENDS_ON: Record<string, string> = {
  COMPARATIVE: "QUOTATIONS",
  VENDOR_SELECTION: "QUOTATIONS",
  PURCHASE_ORDER: "VENDOR_SELECTION",
  DELIVERY: "PURCHASE_ORDER",
  INSPECTION: "DELIVERY",
};
const BLOCKER_TEXT: Record<string, string> = {
  invoice_missing: "No bill recorded yet.",
  bill_document_missing: "Attach the bill image / PDF.",
  variance_open: "A bill variance is waiting for review.",
  asset_entry_missing: "Register the purchased asset(s) in the asset register.",
  steps_incomplete: "Some required procurement steps are not complete.",
};

export default function RecordDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { hasPerm, wide } = usePm();
  const key = ["procurement", "record", id];
  const q = useQuery({ queryKey: key, queryFn: () => pmGet<PmRecord>(`records/${id}/`) });
  const { busy, run } = useRunner();
  const [dlg, setDlg] = useState<"" | "cancel" | "bill" | "attach" | "asset" | "quote">("");
  const [stepOpen, setStepOpen] = useState("");
  const [review, setReview] = useState<PmInvoice | null>(null);
  const [payFor, setPayFor] = useState<PmInvoice | null>(null);

  if (q.isLoading) return <Loader2 className="mx-auto mt-10 h-6 w-6 animate-spin text-muted-foreground" />;
  if (q.error || !q.data) return <p className="text-sm text-destructive">{errorMessage(q.error)}</p>;
  const rec = q.data;
  const closed = rec.status === "COMPLETED" || rec.status === "CANCELLED";
  const canRun = hasPerm("procurement") && !closed;
  const steps = STEP_ORDER.filter((s) => rec.required_steps.includes(s));
  const done = new Set(rec.completed_steps);
  const refresh = (data?: PmRecord) => {
    if (data) qc.setQueryData(key, data);
    qc.invalidateQueries({ queryKey: ["procurement"] });
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>
      <SectionCard
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">{rec.number}</span>
            {rec.title}
            <StatusBadge status={rec.status} />
            {rec.is_small_purchase ? <StatusBadge status="SMALL" label="Small purchase" /> : null}
          </span>
        }
        description={`${rec.department.name}${rec.equipment ? ` · ${rec.equipment.name}` : ""} · ${humanize(rec.origin)} · FY ${rec.financial_year} · ${humanize(rec.funding_type)}`}
        actions={
          <>
            {!closed && wide ? (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => run(async () => refresh(await pmPost<PmRecord>(`records/${rec.id}/complete/`, {})), "Record completed.")}>
                Mark complete
              </Button>
            ) : null}
            {canRun ? <Button size="sm" variant="ghost" onClick={() => setDlg("cancel")}>Cancel record</Button> : null}
          </>
        }
      >
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-muted-foreground">Request</dt><dd>{rec.purchase_request ? <Link className="text-primary underline" to={`/procurement/requests/${rec.purchase_request.id}`}>{rec.purchase_request.number}</Link> : "—"}</dd></div>
          <div><dt className="text-muted-foreground">Approved amount</dt><dd className="font-semibold">{money(rec.approved_amount)}</dd></div>
          <div><dt className="text-muted-foreground">PO amount</dt><dd>{money(rec.po_amount)}</dd></div>
          <div><dt className="text-muted-foreground">Vendor</dt><dd>{rec.selected_vendor?.name ?? "—"}</dd></div>
          <div><dt className="text-muted-foreground">Paid</dt><dd>{money(rec.paid_amount)} <StatusBadge status={rec.payment_status} /></dd></div>
          <div><dt className="text-muted-foreground">Category</dt><dd>{rec.category?.name ?? "—"}</dd></div>
        </dl>
        {rec.blockers?.length && !closed ? (
          <ul className="mt-3 space-y-1 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
            {rec.blockers.map((b) => <li key={b}>• {BLOCKER_TEXT[b] ?? humanize(b)}</li>)}
          </ul>
        ) : null}
      </SectionCard>

      <Tabs defaultValue="steps">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="steps">Steps</TabsTrigger>
          {rec.required_steps.includes("QUOTATIONS") ? <TabsTrigger value="quotations">Quotations ({rec.quotations?.length ?? 0})</TabsTrigger> : null}
          <TabsTrigger value="bills">Bills ({rec.invoices?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="documents">Documents ({rec.documents?.length ?? 0})</TabsTrigger>
          {rec.category?.is_asset ? <TabsTrigger value="assets">Assets ({rec.assets?.length ?? 0})</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="steps">
          <SectionCard title="Procurement steps" description="Steps are configured per request type and amount; dependent steps unlock in order.">
            <ol className="space-y-2">
              {steps.map((s) => {
                const dep = DEPENDS_ON[s];
                const locked = !!dep && rec.required_steps.includes(dep) && !done.has(dep);
                const manual = !["INVOICE", "PAYMENT"].includes(s);
                return (
                  <li key={s} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {done.has(s) ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                        <span className={cn("font-medium", locked && "text-muted-foreground")}>{STEP_LABEL[s]}</span>
                        <StepSummary step={s} rec={rec} />
                      </div>
                      {canRun && manual && !locked ? (
                        <Button size="sm" variant={done.has(s) ? "ghost" : "outline"} onClick={() => setStepOpen(stepOpen === s ? "" : s)}>
                          {done.has(s) ? "Update" : "Record"}
                        </Button>
                      ) : locked ? (
                        <span className="text-xs text-muted-foreground">after {STEP_LABEL[dep]}</span>
                      ) : null}
                    </div>
                    {stepOpen === s ? (
                      <StepForm
                        step={s}
                        rec={rec}
                        onSave={(body) =>
                          run(async () => {
                            refresh(await pmPost<PmRecord>(`records/${rec.id}/steps/${s.toLowerCase()}/`, body));
                            setStepOpen("");
                          }, `${STEP_LABEL[s]} saved.`)
                        }
                      />
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </SectionCard>
        </TabsContent>

        <TabsContent value="quotations">
          <SectionCard
            title="Quotations"
            description="Ranked by total. Choosing other than the lowest compliant quotation needs a justification."
            actions={
              <>
                {(rec.quotations?.length ?? 0) >= 2 ? <ExportButtons path={`records/${rec.id}/quotations/`} name={`comparative-${rec.number.replace(/\//g, "-")}`} /> : null}
                {canRun ? <Button size="sm" onClick={() => setDlg("quote")}>Add quotation</Button> : null}
              </>
            }
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">GST</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Compliance</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {!rec.quotations?.length ? (
                  <EmptyRow colSpan={7} text="No quotations recorded." />
                ) : (
                  [...rec.quotations].sort((a, b) => Number(a.total_amount) - Number(b.total_amount)).map((qt) => (
                    <TableRow key={qt.id}>
                      <TableCell>{qt.vendor.name}</TableCell>
                      <TableCell>{qt.quotation_reference || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(qt.amount)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(qt.gst_amount)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{money(qt.total_amount)}</TableCell>
                      <TableCell><StatusBadge status={qt.compliance} /></TableCell>
                      <TableCell>{qt.is_selected ? <StatusBadge status="APPROVED" label="Selected" /> : null}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>

        <TabsContent value="bills">
          <SectionCard
            title="Bills / invoices"
            description="Variance against the approved amount is computed on the server using the department tolerance."
            actions={hasPerm("invoices") && !closed ? <Button size="sm" onClick={() => setDlg("bill")}>Add bill</Button> : undefined}
          >
            <div className="space-y-3">
              {!rec.invoices?.length ? <p className="text-sm text-muted-foreground">No bills recorded.</p> : null}
              {rec.invoices?.map((inv) => (
                <div key={inv.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {inv.vendor?.name ?? inv.vendor_name} · Bill {inv.invoice_number} · {fmtDate(inv.invoice_date)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Taxable {money(inv.taxable_amount)} · GST {money(Number(inv.cgst_amount) + Number(inv.sgst_amount) + Number(inv.igst_amount))} · Total{" "}
                        <span className="font-semibold text-foreground">{money(inv.total_amount)}</span>
                        {inv.approved_amount ? ` · Approved ${money(inv.approved_amount)} · Variance ${money(inv.variance_amount)} (${inv.variance_percent}%)` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={inv.variance_status} />
                      <StatusBadge status={inv.payment_status} />
                      {["OFFICE_REVIEW", "REAPPROVAL_REQUIRED"].includes(inv.variance_status) ? (
                        <Button size="sm" variant="outline" onClick={() => setReview(inv)}>Review variance</Button>
                      ) : null}
                      {hasPerm("payments") && inv.payment_status !== "PAID" && !["OFFICE_REVIEW", "REAPPROVAL_REQUIRED"].includes(inv.variance_status) ? (
                        <Button size="sm" variant="outline" onClick={() => setPayFor(inv)}>Record payment</Button>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-2">
                    <DocumentList docs={inv.documents} empty="No bill image attached." />
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="documents">
          <SectionCard title="Documents" actions={!closed ? <Button size="sm" variant="outline" onClick={() => setDlg("attach")}>Attach</Button> : undefined}>
            <DocumentList docs={rec.documents} />
          </SectionCard>
        </TabsContent>

        <TabsContent value="assets">
          <SectionCard
            title="Assets from this purchase"
            actions={hasPerm("assets") && rec.status !== "CANCELLED" ? <Button size="sm" onClick={() => setDlg("asset")}>Register asset(s)</Button> : undefined}
          >
            {rec.assets?.length ? (
              <ul className="divide-y rounded-md border">
                {rec.assets.map((a) => (
                  <li key={a.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <Link to={`/procurement/assets/${a.id}`} className="font-mono text-primary underline">{a.number}</Link>
                    <span className="flex-1 px-3">{a.description}</span>
                    <StatusBadge status={a.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No assets registered yet.</p>
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>

      <ReasonDialog
        open={dlg === "cancel"}
        onOpenChange={(o) => setDlg(o ? "cancel" : "")}
        title="Cancel procurement record"
        destructive
        confirmLabel="Cancel record"
        onConfirm={(reason) => run(async () => refresh(await pmPost<PmRecord>(`records/${rec.id}/cancel/`, { reason })), "Record cancelled.")}
      />
      <ReasonDialog
        open={!!review}
        onOpenChange={(o) => !o && setReview(null)}
        title={review?.variance_status === "REAPPROVAL_REQUIRED" ? "HOD re-approval of bill variance" : "Clear bill variance"}
        description={review ? `Bill ${review.invoice_number}: ${money(review.total_amount)} against approved ${money(review.approved_amount)}.` : undefined}
        label="Review note"
        confirmLabel="Clear variance"
        onConfirm={(note) => run(async () => { await pmPost(`invoices/${review!.id}/variance-review/`, { note }); refresh(); }, "Variance cleared.")}
      />
      <PaymentDialog invoice={payFor} onClose={() => setPayFor(null)} onSave={(body) => run(async () => { await pmPost(`invoices/${payFor!.id}/payments/`, body); refresh(); }, "Payment recorded.")} />
      <BillDialog open={dlg === "bill"} onOpenChange={(o) => setDlg(o ? "bill" : "")} recordId={rec.id} onSaved={refresh} />
      <QuotationDialog open={dlg === "quote"} onOpenChange={(o) => setDlg(o ? "quote" : "")} onSave={(body) => run(async () => refresh(await pmPost<PmRecord>(`records/${rec.id}/quotations/`, body)), "Quotation added.")} />
      <AssetRegisterDialog open={dlg === "asset"} onOpenChange={(o) => setDlg(o ? "asset" : "")} recordId={rec.id} onSaved={() => refresh()} />
      <AttachDialog
        open={dlg === "attach"}
        onOpenChange={(o) => setDlg(o ? "attach" : "")}
        types={["INDENT", "RFQ", "QUOTATION", "COMPARATIVE_STATEMENT", "PURCHASE_ORDER", "DELIVERY_CHALLAN", "INSPECTION_REPORT", "INVOICE", "PAYMENT_PROOF", "OTHER"]}
        onUpload={(file, docType, description) =>
          run(async () => {
            const form = new FormData();
            form.append("file", file);
            form.append("doc_type", docType);
            form.append("description", description);
            await pmForm(`records/${rec.id}/documents/`, form);
            refresh();
          }, "Document attached.")
        }
      />
    </div>
  );
}

function StepSummary({ step, rec }: { step: string; rec: PmRecord }) {
  const v = (k: string) => (rec[k] as string | null | undefined) || "";
  const text: Record<string, string> = {
    INDENT: v("indent_number") && `${v("indent_number")} · ${fmtDate(v("indent_date"))}`,
    RFQ: v("rfq_reference") && `${v("rfq_reference")} · ${fmtDate(v("rfq_date"))}`,
    VENDOR_SELECTION: rec.selected_vendor?.name ?? "",
    PURCHASE_ORDER: v("po_number") && `${v("po_number")} · ${fmtDate(v("po_date"))} · ${money(rec.po_amount)}`,
    DELIVERY: v("delivery_date") && `${fmtDate(v("delivery_date"))}${v("delivery_challan_number") ? ` · challan ${v("delivery_challan_number")}` : ""}`,
    INSPECTION: v("inspection_result") && v("inspection_result") !== "PENDING" ? `${humanize(v("inspection_result"))} · ${fmtDate(v("inspection_date"))}` : "",
  };
  return text[step] ? <span className="text-xs text-muted-foreground">{text[step]}</span> : null;
}

function StepForm({ step, rec, onSave }: { step: string; rec: PmRecord; onSave: (body: Record<string, unknown>) => Promise<boolean> }) {
  const [f, setF] = useState<Record<string, string>>({});
  const val = (k: string) => f[k] ?? ((rec[k] as string | null | undefined) || "");
  const set = (k: string) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const [busy, setBusy] = useState(false);
  const body: Record<string, unknown> = {};
  const keys: Record<string, string[]> = {
    INDENT: ["indent_number", "indent_date"],
    SPECIFICATION: ["specification"],
    RFQ: ["rfq_reference", "rfq_date"],
    VENDOR_SELECTION: ["quotation_id", "selection_justification"],
    PURCHASE_ORDER: ["po_number", "po_date", "po_amount", "expected_delivery_date"],
    DELIVERY: ["delivery_date", "delivery_challan_number"],
    INSPECTION: ["inspection_date", "inspection_result", "inspection_remarks"],
  };
  for (const k of keys[step] ?? []) body[k] = val(k) || null;
  const date = (k: string, label: string, future = false) => (
    <Field label={label}>
      <DateInput max={future ? undefined : todayIso()} value={val(k)} onChange={set(k)} />
    </Field>
  );
  const text = (k: string, label: string) => (
    <Field label={label}>
      <Input value={val(k)} onChange={set(k)} />
    </Field>
  );
  return (
    <div className="mt-3 space-y-3 border-t pt-3">
      <div className="grid gap-3 md:grid-cols-3">
        {step === "INDENT" ? <>{text("indent_number", "Indent number")}{date("indent_date", "Indent date")}</> : null}
        {step === "SPECIFICATION" ? (
          <Field label="Specification" className="md:col-span-3">
            <Textarea rows={5} value={val("specification")} onChange={set("specification")} />
          </Field>
        ) : null}
        {step === "RFQ" ? <>{text("rfq_reference", "RFQ reference")}{date("rfq_date", "RFQ date")}</> : null}
        {step === "QUOTATIONS" || step === "COMPARATIVE" || step === "STOCK_ASSET_ENTRY" ? (
          <p className="text-sm text-muted-foreground md:col-span-3">
            {step === "QUOTATIONS" ? "Confirm after adding the quotations on the Quotations tab." : step === "COMPARATIVE" ? "Needs at least two quotations. Export the statement from the Quotations tab." : "Confirm that stock receipt / asset registration is done."}
          </p>
        ) : null}
        {step === "VENDOR_SELECTION" ? (
          <>
            <Field label="Selected quotation">
              <NativeSelect
                value={val("quotation_id")}
                onChange={set("quotation_id")}
                placeholder="Choose"
                options={(rec.quotations ?? []).map((q) => ({ value: String(q.id), label: `${q.vendor.name} · ${money(q.total_amount)} · ${humanize(q.compliance)}` }))}
              />
            </Field>
            <Field label="Justification (required if not the lowest compliant)" className="md:col-span-2">
              <Textarea rows={2} value={val("selection_justification")} onChange={set("selection_justification")} />
            </Field>
          </>
        ) : null}
        {step === "PURCHASE_ORDER" ? (
          <>
            {text("po_number", "PO number")}
            {date("po_date", "PO date")}
            <Field label="PO amount (₹)" hint={rec.approved_amount ? `Approved ${money(rec.approved_amount)}` : undefined}>
              <Input inputMode="decimal" value={val("po_amount")} onChange={set("po_amount")} />
            </Field>
            {date("expected_delivery_date", "Expected delivery", true)}
          </>
        ) : null}
        {step === "DELIVERY" ? <>{date("delivery_date", "Delivery date")}{text("delivery_challan_number", "Delivery challan (optional)")}</> : null}
        {step === "INSPECTION" ? (
          <>
            {date("inspection_date", "Inspection date")}
            <Field label="Result">
              <NativeSelect
                value={val("inspection_result") === "PENDING" ? "" : val("inspection_result")}
                onChange={set("inspection_result")}
                placeholder="Choose"
                options={["ACCEPTED", "PARTIALLY_ACCEPTED", "REJECTED"].map((v) => ({ value: v, label: humanize(v) }))}
              />
            </Field>
            <Field label="Remarks (required unless accepted)">
              <Input value={val("inspection_remarks")} onChange={set("inspection_remarks")} />
            </Field>
          </>
        ) : null}
      </div>
      <div className="flex justify-end">
        <Button
          size="sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onSave(body);
            setBusy(false);
          }}
        >
          Save {STEP_LABEL[step]}
        </Button>
      </div>
    </div>
  );
}

function PaymentDialog({ invoice, onClose, onSave }: { invoice: PmInvoice | null; onClose: () => void; onSave: (body: Record<string, unknown>) => Promise<boolean> }) {
  const due = invoice ? Number(invoice.total_amount) - Number(invoice.paid_amount) : 0;
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayIso());
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={!!invoice} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>Outstanding {money(due)} on bill {invoice?.invoice_number}.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Amount (₹)"><Input inputMode="decimal" value={amount} placeholder={due.toFixed(2)} onChange={(e) => setAmount(e.target.value)} /></Field>
          <Field label="Date"><DateInput max={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Reference (UTR / cheque)"><Input value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={busy || !reference.trim()}
            onClick={async () => {
              setBusy(true);
              const ok = await onSave({ amount: amount || due.toFixed(2), payment_date: date, payment_reference: reference.trim() });
              setBusy(false);
              if (ok) {
                setAmount("");
                setReference("");
                onClose();
              }
            }}
          >
            Save payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BillDialog({ open, onOpenChange, recordId, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; recordId: number; onSaved: (r: PmRecord) => void }) {
  const { deptId } = usePm();
  const [invoice, setInvoice] = useState(blankInvoice);
  const [files, setFiles] = useState<File[]>([]);
  const { busy, run } = useRunner();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add bill</DialogTitle>
          <DialogDescription>Attach every page of the bill.</DialogDescription>
        </DialogHeader>
        <InvoiceFields deptId={deptId} value={invoice} onChange={setInvoice} />
        <div className="space-y-2">
          <FilePicker files={files} onChange={setFiles} label="Capture with camera" capture hideList />
          <FilePicker files={files} onChange={setFiles} label="Attach bill pages" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={busy || !invoiceValid(invoice)}
            onClick={async () => {
              const ok = await run(async () => onSaved(await pmForm<PmRecord>(`records/${recordId}/invoices/`, payloadForm(invoicePayload(invoice), files))), "Bill recorded.");
              if (ok) {
                setInvoice(blankInvoice());
                setFiles([]);
                onOpenChange(false);
              }
            }}
          >
            Save bill
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuotationDialog({ open, onOpenChange, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; onSave: (body: Record<string, unknown>) => Promise<boolean> }) {
  const { deptId } = usePm();
  const vendors = useVendors(deptId).data?.results ?? [];
  const [f, setF] = useState({ vendor_id: "", quotation_reference: "", quotation_date: "", amount: "", gst_amount: "", delivery_period: "", warranty: "", compliance: "COMPLIANT", remarks: "" });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add quotation</DialogTitle>
          <DialogDescription>Vendors come from the department vendor master.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Vendor">
            <NativeSelect value={f.vendor_id} onChange={set("vendor_id")} placeholder="Choose vendor" options={vendors.map((v) => ({ value: String(v.id), label: v.name }))} />
          </Field>
          <Field label="Reference"><Input value={f.quotation_reference} onChange={set("quotation_reference")} /></Field>
          <Field label="Date"><DateInput value={f.quotation_date} onChange={set("quotation_date")} /></Field>
          <Field label="Compliance">
            <NativeSelect value={f.compliance} onChange={set("compliance")} options={["COMPLIANT", "PARTIAL", "NON_COMPLIANT"].map((v) => ({ value: v, label: humanize(v) }))} />
          </Field>
          <Field label="Amount before GST (₹)"><Input inputMode="decimal" value={f.amount} onChange={set("amount")} /></Field>
          <Field label="GST (₹)"><Input inputMode="decimal" value={f.gst_amount} onChange={set("gst_amount")} /></Field>
          <Field label="Delivery period"><Input value={f.delivery_period} onChange={set("delivery_period")} /></Field>
          <Field label="Warranty"><Input value={f.warranty} onChange={set("warranty")} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={busy || !f.vendor_id || !(Number(f.amount) > 0)}
            onClick={async () => {
              setBusy(true);
              const ok = await onSave({ ...f, vendor_id: Number(f.vendor_id), quotation_date: f.quotation_date || null, gst_amount: f.gst_amount || null });
              setBusy(false);
              if (ok) onOpenChange(false);
            }}
          >
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AssetRegisterDialog({
  open,
  onOpenChange,
  recordId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  recordId?: number;
  onSaved: (assets: PmAsset[]) => void;
}) {
  const { boot, deptId } = usePm();
  const equipment = boot.equipment.filter((e) => e.department_id === deptId);
  const [f, setF] = useState({ description: "", count: "1", serials: "", make: "", model_number: "", location: "", status: "IN_STORE", equipment_id: "", cost: "", purchase_date: "", warranty_until: "", category_id: "" });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const { busy, run } = useRunner();
  const categories = useQuery({
    queryKey: ["procurement", "categories", deptId],
    queryFn: () => pmGet<{ results: { id: number; name: string; is_asset: boolean }[] }>("categories/", { department_id: deptId }),
    enabled: open && !recordId && !!deptId,
  }).data?.results.filter((c) => c.is_asset) ?? [];
  const serials = f.serials.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Register asset(s)</DialogTitle>
          <DialogDescription>
            {recordId ? "Cost, vendor and purchase date are taken from the bill; cost is split equally across the units." : "Register an existing or donated asset."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={recordId ? "Description (optional)" : "Description"} className="sm:col-span-2"><Input value={f.description} onChange={set("description")} /></Field>
          {!recordId ? (
            <>
              <Field label="Category">
                <NativeSelect value={f.category_id} onChange={set("category_id")} placeholder="Choose" options={categories.map((c) => ({ value: String(c.id), label: c.name }))} />
              </Field>
              <Field label="Cost per unit (₹)"><Input inputMode="decimal" value={f.cost} onChange={set("cost")} /></Field>
              <Field label="Purchase date"><DateInput max={todayIso()} value={f.purchase_date} onChange={set("purchase_date")} /></Field>
            </>
          ) : null}
          <Field label="Number of units"><Input inputMode="numeric" value={f.count} onChange={set("count")} /></Field>
          <Field label="Equipment (optional)">
            <NativeSelect value={f.equipment_id} onChange={set("equipment_id")} placeholder="—" options={equipment.map((e) => ({ value: String(e.id), label: e.name }))} />
          </Field>
          <Field label="Make"><Input value={f.make} onChange={set("make")} /></Field>
          <Field label="Model"><Input value={f.model_number} onChange={set("model_number")} /></Field>
          <Field label="Location"><Input value={f.location} onChange={set("location")} /></Field>
          <Field label="Status">
            <NativeSelect value={f.status} onChange={set("status")} options={["IN_STORE", "UNDER_INSTALLATION", "ACTIVE", "IN_USE"].map((v) => ({ value: v, label: humanize(v) }))} />
          </Field>
          <Field label="Warranty until (optional)"><DateInput value={f.warranty_until} onChange={set("warranty_until")} /></Field>
          <Field label="Serial numbers (one per line, optional)" className="sm:col-span-2" hint={serials.length ? `${serials.length} serial(s) — must match the number of units.` : undefined}>
            <Textarea rows={3} value={f.serials} onChange={set("serials")} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={busy || (!recordId && (!f.description.trim() || !f.category_id || !f.cost))}
            onClick={async () => {
              const ok = await run(async () => {
                const res = await pmPost<{ results: PmAsset[] }>("assets/", {
                  procurement_record_id: recordId ?? null,
                  department_id: recordId ? undefined : deptId,
                  category_id: f.category_id ? Number(f.category_id) : undefined,
                  description: f.description,
                  count: Number(f.count) || 1,
                  serial_numbers: serials.length ? serials : undefined,
                  make: f.make,
                  model_number: f.model_number,
                  location: f.location,
                  status: f.status,
                  equipment_id: f.equipment_id ? Number(f.equipment_id) : null,
                  cost: recordId ? undefined : f.cost,
                  purchase_date: f.purchase_date || null,
                  warranty_until: f.warranty_until || null,
                });
                onSaved(res.results);
              }, "Asset(s) registered.");
              if (ok) onOpenChange(false);
            }}
          >
            Register
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

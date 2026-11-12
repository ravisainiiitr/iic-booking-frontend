import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, FileDown, KeyRound, Loader2, RefreshCw, Search, ShieldCheck, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { PageHero, PageShell, StandaloneOnly } from "@/components/PageShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  STATUS_TONE,
  gstEinvoiceApi,
  rupees,
  type DemoInvoiceInput,
  type GstInvoice,
  type GstRegister,
  type GstStatus,
  type Gstr1Kind,
  type Gstr1Month,
  type SignerCertificate,
  type SignerDevice,
} from "@/lib/gstEinvoiceApi";

/**
 * GST invoices prepared by the portal (Dean SRIC proposal). SRIC reviewers (Main Administrator, Accounts In Charge,
 * named SRIC accounts) see every invoice, review held ones, send again after a failure, and download the monthly
 * register; signatories link the SRIC Invoice Signer utility; the Main Administrator registers DSC certificates and
 * sets SRIC's rules. Everything is SANDBOX: no real IRN, no real tax invoice.
 */

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong. Try again.";
}

function when(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
}

const STATUS_FILTERS: Array<[string, string]> = [
  ["", "All"],
  ["pending_review", "Waiting for SRIC's review"],
  ["awaiting_signature", "Waiting for the DSC"],
  ["submission_failed,submission_uncertain,submitting", "Needs attention"],
  ["irn_generated,signed", "Issued"],
  ["rejected", "Not issued"],
];

function SandboxBanner({ status }: { status: GstStatus }) {
  return (
    <Alert className="border-orange-300 bg-orange-50 text-orange-950 dark:bg-orange-950 dark:text-orange-100">
      <TriangleAlert className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>Sandbox demonstration: nothing here is a real tax invoice</AlertTitle>
      <AlertDescription className="space-y-1 text-sm">
        <p>
          E-invoices go to {status.provider_label}
          {status.sandbox_host && !status.simulated ? ` (${status.sandbox_host})` : ""}; the live GST system cannot be reached from this module. Booking
          invoices are prepared for test accounts only; demonstration invoices use demo buyers.
        </p>
        {status.problem ? <p className="font-medium">Configuration: {status.problem}</p> : null}
      </AlertDescription>
    </Alert>
  );
}

// --- invoice detail -------------------------------------------------------------------------------------------------

function BuyerEditor({ inv, onSaved }: { inv: GstInvoice; onSaved: (i: GstInvoice) => void }) {
  const [form, setForm] = useState<Record<string, string>>({
    legal_name: inv.buyer.legal_name ?? inv.buyer.name,
    gstin: inv.buyer.gstin,
    address1: inv.buyer.address1 ?? "",
    location: inv.buyer.location,
    pincode: inv.buyer.pincode ?? "",
    state_code: inv.buyer.state_code,
  });
  const [busy, setBusy] = useState(false);
  const field = (key: string, label: string) => (
    <div>
      <Label htmlFor={`buyer-${key}`}>{label}</Label>
      <Input id={`buyer-${key}`} value={form[key] ?? ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
    </div>
  );
  return (
    <details className="rounded-md border p-2">
      <summary className="cursor-pointer text-sm font-medium">Correct the buyer's details</summary>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {field("legal_name", "Legal name")}
        {field("gstin", "GSTIN (blank if not registered)")}
        {field("address1", "Address")}
        {field("location", "City / town")}
        {field("pincode", "PIN code")}
        {field("state_code", "State code (e.g. 05 Uttarakhand)")}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">An invoice that already has a number keeps it; without a GSTIN it becomes a tax invoice for the DSC.</p>
      <Button
        size="sm"
        className="mt-2"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            onSaved(await gstEinvoiceApi.updateBuyer(inv.id, form));
            toast.success("Buyer corrected.");
          } catch (e) {
            toast.error(errorText(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        Save and continue
      </Button>
    </details>
  );
}

function CreditNotePanel({ inv, canAdminister, onChanged }: { inv: GstInvoice; canAdminister: boolean; onChanged: (i: GstInvoice) => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  if (inv.doc_type === "CRN" || !["irn_generated", "signed"].includes(inv.status) || !inv.booking_id) return null;
  const perm = inv.credit_note_permission;
  const act = async (fn: () => Promise<GstInvoice>, done: string) => {
    setBusy(true);
    try {
      onChanged(await fn());
      setReason("");
      toast.success(done);
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-2 rounded-md border p-2" aria-labelledby={`cn-${inv.id}`}>
      <h3 id={`cn-${inv.id}`} className="font-medium">
        Credit note on refund
      </h3>
      {perm ? (
        <p>
          Allowed by {perm.enabled_by} on {when(perm.enabled_at)}: {perm.reason}. A refund of this booking returns the GST too and issues a credit note
          {inv.credit_remaining ? ` (up to ${rupees(inv.credit_remaining.total)} left to credit)` : ""}.
        </p>
      ) : (
        <p className="text-muted-foreground">
          Not allowed: a refund of this booking returns the base amount only, as today. Only the Main Administrator can allow a credit note, for this invoice alone.
        </p>
      )}
      {inv.credit_notes?.length ? (
        <ul className="list-disc pl-5">
          {inv.credit_notes.map((n) => (
            <li key={n.id}>
              Credit note {n.number}: {rupees(n.total)}, {n.status_label}
            </li>
          ))}
        </ul>
      ) : null}
      {canAdminister ? (
        <div className="space-y-1">
          <Label htmlFor={`cn-reason-${inv.id}`}>{perm ? "Reason to withdraw" : "Reason to allow (kept in the audit record)"}</Label>
          <Textarea id={`cn-reason-${inv.id}`} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          {perm ? (
            <Button size="sm" variant="outline" disabled={busy || reason.trim().length < 5} onClick={() => act(() => gstEinvoiceApi.revokeCreditNote(inv.id, reason), "Credit note withdrawn.")}>
              Withdraw
            </Button>
          ) : (
            <Button size="sm" disabled={busy || reason.trim().length < 10} onClick={() => act(() => gstEinvoiceApi.allowCreditNote(inv.id, reason), "Credit note allowed for this invoice.")}>
              Allow a credit note on refund
            </Button>
          )}
        </div>
      ) : null}
    </section>
  );
}

function InvoiceDialog({
  id,
  canReview,
  canAdminister = false,
  onClose,
  onChanged,
}: {
  id: number;
  canReview: boolean;
  canAdminister?: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [inv, setInv] = useState<GstInvoice | null>(null);
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    gstEinvoiceApi.invoice(id).then(setInv).catch((e) => toast.error(errorText(e)));
  }, [id]);

  const act = async (fn: () => Promise<GstInvoice>, done: string) => {
    setBusy(true);
    try {
      const next = await fn();
      setInv(next);
      toast.success(done);
      onChanged();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        {!inv ? (
          <div className="flex items-center gap-2 p-4 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading…
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                {inv.doc_type === "CRN" ? "Credit note" : "Invoice"} {inv.number}
                <Badge variant={STATUS_TONE[inv.status]}>{inv.status_label}</Badge>
                <Badge variant="outline">{inv.supply_type === "B2B" ? "e-Invoice (IRN)" : "Tax invoice + DSC"}</Badge>
                {inv.is_demo ? <Badge variant="outline">Demo buyer</Badge> : null}
              </DialogTitle>
              <DialogDescription>
                {inv.buyer.name} · {inv.buyer.gstin ? `GSTIN ${inv.buyer.gstin} (${inv.buyer.gstin_status_label})` : "Unregistered (no GSTIN)"} · Place of supply{" "}
                {inv.buyer.state || inv.place_of_supply}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 text-sm">
              {inv.review_reasons.length && inv.status === "pending_review" ? (
                <Alert>
                  <AlertTitle>Held for SRIC's review</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc pl-4">
                      {inv.review_reasons.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              ) : null}

              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
                <dt className="text-muted-foreground">Booking</dt>
                <dd>{inv.booking_reference || "—"}</dd>
                <dt className="text-muted-foreground">Payment receipt</dt>
                <dd>{inv.receipt_number || "—"}</dd>
                <dt className="text-muted-foreground">Equipment</dt>
                <dd>{inv.equipment || "—"}</dd>
                <dt className="text-muted-foreground">Invoice date</dt>
                <dd>{inv.invoice_date || "not numbered yet"}</dd>
                <dt className="text-muted-foreground">Taxable value</dt>
                <dd>{rupees(inv.taxable_value)}</dd>
                <dt className="text-muted-foreground">{inv.inter_state ? "IGST" : "CGST + SGST"}</dt>
                <dd>{inv.inter_state ? rupees(inv.igst) : `${rupees(inv.cgst)} + ${rupees(inv.sgst)}`}</dd>
                <dt className="text-muted-foreground">Total</dt>
                <dd className="font-semibold">{rupees(inv.total)}</dd>
                <dt className="text-muted-foreground">Booking charged</dt>
                <dd>{inv.portal_total ? rupees(inv.portal_total) : "—"}</dd>
              </dl>

              {inv.irn ? (
                <div className="rounded-md border bg-muted/40 p-2 font-mono text-xs break-all">
                  IRN {inv.irn}
                  <div className="font-sans">
                    Ack {inv.ack_number} · {when(inv.ack_date)} {inv.simulated ? "· simulated (mock)" : "· NIC sandbox"}
                  </div>
                </div>
              ) : null}
              {inv.original_invoice ? (
                <p>
                  Against invoice {inv.original_invoice.number} dated {inv.original_invoice.date}
                  {inv.credit_reason ? ` — ${inv.credit_reason}` : ""}
                </p>
              ) : null}
              <CreditNotePanel
                inv={inv}
                canAdminister={canAdminister}
                onChanged={(next) => {
                  setInv(next);
                  onChanged();
                }}
              />
              {inv.signer_certificate ? (
                <p className="flex items-center gap-1">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                  Signed {when(inv.signed_at)} by {inv.signed_by} with {inv.signer_certificate.subject}
                  {inv.signer_certificate.is_test ? " (test DSC)" : ""}
                </p>
              ) : null}

              {inv.lines?.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>SAC</TableHead>
                      <TableHead className="text-right">Taxable</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inv.lines.map((l) => (
                      <TableRow key={l.sl_no}>
                        <TableCell>
                          {l.description}
                          {l.detail ? <div className="text-xs text-muted-foreground">{l.detail}</div> : null}
                        </TableCell>
                        <TableCell>{l.sac_code}</TableCell>
                        <TableCell className="text-right">{rupees(l.taxable_value)}</TableCell>
                        <TableCell className="text-right">{l.gst_rate}%</TableCell>
                        <TableCell className="text-right">{rupees(l.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : null}

              {canReview && (inv.status === "pending_review" || inv.status === "submission_failed") ? (
                <BuyerEditor inv={inv} onSaved={(next) => { setInv(next); onChanged(); }} />
              ) : null}

              {canReview && inv.status === "pending_review" ? (
                <div className="space-y-1">
                  <Label htmlFor="review-remarks">Review remarks</Label>
                  <Textarea id="review-remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Required to reject; optional to approve." />
                </div>
              ) : null}

              <details>
                <summary className="cursor-pointer font-medium">History ({inv.events?.length ?? 0}) and e-invoice system calls ({inv.attempts?.length ?? 0})</summary>
                <ol className="mt-2 space-y-1">
                  {inv.events?.map((e, i) => (
                    <li key={i} className="text-xs">
                      <span className="text-muted-foreground">{when(e.at)}</span> · {e.by} · <span className="font-medium">{e.action.replace(/_/g, " ")}</span>
                      {e.note ? ` — ${e.note}` : ""}
                    </li>
                  ))}
                </ol>
                {inv.attempts?.length ? (
                  <ul className="mt-2 space-y-1 text-xs">
                    {inv.attempts.map((a, i) => (
                      <li key={i}>
                        {when(a.at)} · {a.operation} · {a.outcome}
                        {a.simulated ? " (simulated)" : ""}
                        {a.error_code || a.error_message ? ` — ${a.error_code} ${a.error_message}` : ""}
                        {a.duration_ms != null ? ` · ${a.duration_ms} ms` : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </details>
            </div>

            <DialogFooter className="flex flex-wrap gap-2">
              {inv.pdf_url ? (
                <Button variant="outline" onClick={() => gstEinvoiceApi.downloadPdf(inv).catch((e) => toast.error(errorText(e)))}>
                  <FileDown className="mr-1 h-4 w-4" aria-hidden="true" />
                  {inv.status === "signed" ? "Signed PDF" : "PDF"}
                </Button>
              ) : null}
              {canReview && inv.buyer.gstin && inv.status === "pending_review" ? (
                <Button variant="outline" disabled={busy} onClick={() => act(() => gstEinvoiceApi.checkGstin(inv.id), "GSTIN checked with the sandbox.")}>
                  Check GSTIN
                </Button>
              ) : null}
              {canReview && ["submission_failed", "submission_uncertain", "submitting"].includes(inv.status) ? (
                <Button disabled={busy} onClick={() => act(() => gstEinvoiceApi.submit(inv.id), "Sent to the e-invoice sandbox.")}>
                  <RefreshCw className="mr-1 h-4 w-4" aria-hidden="true" />
                  {inv.status === "submission_uncertain" ? "Check and send again" : "Send again"}
                </Button>
              ) : null}
              {canReview && inv.status === "pending_review" ? (
                <>
                  <Button variant="outline" disabled={busy || remarks.trim().length < 5} onClick={() => act(() => gstEinvoiceApi.reject(inv.id, remarks), "Not issued. A booking's request goes to SRIC by e-mail as before.")}>
                    Do not issue
                  </Button>
                  <Button disabled={busy} onClick={() => act(() => gstEinvoiceApi.approve(inv.id, remarks), "Approved and issued.")}>
                    <CheckCircle2 className="mr-1 h-4 w-4" aria-hidden="true" />
                    Approve and issue
                  </Button>
                </>
              ) : null}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// --- tabs ---------------------------------------------------------------------------------------------------------------

function InvoicesTab({ canReview, canAdminister = false }: { canReview: boolean; canAdminister?: boolean }) {
  const [rows, setRows] = useState<GstInvoice[] | null>(null);
  const [status, setStatus] = useState("");
  const [supply, setSupply] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const load = useCallback(() => {
    gstEinvoiceApi
      .invoices({ status, supply, q: q.trim() })
      .then((d) => setRows(d.results))
      .catch((e) => {
        toast.error(errorText(e));
        setRows([]);
      });
  }, [status, supply, q]);
  useEffect(load, [load]);

  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <Label htmlFor="f-status">Status</Label>
          <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
            <SelectTrigger id="f-status" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map(([v, l]) => (
                <SelectItem key={l} value={v || "all"}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="f-supply">Buyer</Label>
          <Select value={supply || "all"} onValueChange={(v) => setSupply(v === "all" ? "" : v)}>
            <SelectTrigger id="f-supply" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">With and without GSTIN</SelectItem>
              <SelectItem value="B2B">With GSTIN (IRN)</SelectItem>
              <SelectItem value="B2C">Without GSTIN (DSC)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[14rem] flex-1">
          <Label htmlFor="f-q">Search</Label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input id="f-q" className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Invoice no., buyer, GSTIN, IRN, booking, receipt" />
          </div>
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            <TableHead>Buyer</TableHead>
            <TableHead>Path</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows === null ? (
            <TableRow>
              <TableCell colSpan={5}>Loading…</TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground">
                No invoices.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => setOpen(r.id)}>
                <TableCell>
                  <button type="button" className="font-medium underline-offset-2 hover:underline" onClick={() => setOpen(r.id)}>
                    {r.number}
                  </button>
                  <div className="text-xs text-muted-foreground">
                    {r.invoice_date || "draft"}
                    {r.booking_reference ? ` · ${r.booking_reference}` : r.is_demo ? " · demo" : ""}
                  </div>
                </TableCell>
                <TableCell>
                  {r.buyer.name}
                  <div className="text-xs text-muted-foreground">{r.buyer.gstin || "Unregistered"}</div>
                </TableCell>
                <TableCell>{r.supply_type === "B2B" ? "e-Invoice (IRN)" : "Tax invoice + DSC"}</TableCell>
                <TableCell className="text-right">{rupees(r.total)}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_TONE[r.status]}>{r.status_label}</Badge>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {open !== null ? <InvoiceDialog id={open} canReview={canReview} canAdminister={canAdminister} onClose={() => setOpen(null)} onChanged={load} /> : null}
    </div>
  );
}

const DEMO_BUYERS: Array<{ label: string; data: Partial<DemoInvoiceInput> }> = [
  { label: "Company in Delhi, with GSTIN (IRN, IGST)", data: { legal_name: "Demo Analytics Pvt Ltd", gstin: "07AAACX0000X1Z2", address1: "12 Ring Road", location: "New Delhi", pincode: "110001" } },
  { label: "Company in Uttarakhand, with GSTIN (IRN, CGST + SGST)", data: { legal_name: "Demo Materials LLP", gstin: "05AABCU9603R1ZT", address1: "Industrial Area", location: "Haridwar", pincode: "249403" } },
  { label: "Researcher without GSTIN, Uttarakhand (DSC)", data: { legal_name: "Dr Demo Researcher", gstin: "", address1: "Civil Lines", location: "Roorkee", pincode: "247667", state_code: "05" } },
  { label: "Institute without GSTIN, Maharashtra (DSC, IGST)", data: { legal_name: "Demo Institute of Science", gstin: "", address1: "College Road", location: "Pune", pincode: "411001", state_code: "27" } },
];

function DemoTab({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState<DemoInvoiceInput>({ ...(DEMO_BUYERS[0].data as DemoInvoiceInput), amount: "9000", description: "FE-SEM analysis (6 samples)", receipt_number: "IITR/IIC/2026/TEST-00003" });
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<GstInvoice | null>(null);
  const set = (k: keyof DemoInvoiceInput, v: string) => setForm({ ...form, [k]: v });
  const field = (k: keyof DemoInvoiceInput, label: string, placeholder = "") => (
    <div>
      <Label htmlFor={`demo-${k}`}>{label}</Label>
      <Input id={`demo-${k}`} value={String(form[k] ?? "")} placeholder={placeholder} onChange={(e) => set(k, e.target.value)} />
    </div>
  );
  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">A demonstration invoice for a demo buyer (no booking). It follows exactly the same rules, series and path as a booking's invoice.</p>
      <div className="flex flex-wrap gap-2">
        {DEMO_BUYERS.map((b) => (
          <Button key={b.label} type="button" size="sm" variant="outline" onClick={() => setForm({ ...form, gstin: "", state_code: "", ...(b.data as DemoInvoiceInput) })}>
            {b.label}
          </Button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {field("legal_name", "Buyer's legal name")}
        {field("gstin", "GSTIN", "blank = not registered")}
        {field("address1", "Address")}
        {field("location", "City / town")}
        {field("pincode", "PIN code")}
        {field("state_code", "State code (without GSTIN)", "e.g. 05")}
        {field("amount", "Charge before GST (₹)")}
        {field("description", "Service")}
        {field("receipt_number", "Payment receipt number")}
        {field("po_number", "Buyer's PO number")}
        {field("notes", "Demo switch", "#simulate-timeout or #simulate-refusal")}
      </div>
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const inv = await gstEinvoiceApi.createDemo(form);
            setMade(inv);
            toast.success(`Invoice ${inv.number}: ${inv.status_label}.`);
            onCreated();
          } catch (e) {
            toast.error(errorText(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        Prepare the invoice
      </Button>
      {made ? (
        <p role="status">
          {made.number} — {made.status_label}
          {made.irn ? ` · IRN ${made.irn.slice(0, 24)}…` : ""}.{" "}
          {made.pdf_url ? (
            <button type="button" className="underline" onClick={() => gstEinvoiceApi.downloadPdf(made).catch((e) => toast.error(errorText(e)))}>
              Download the PDF
            </button>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

function thisMonth(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 7);
}

function RegisterTab() {
  const [month, setMonth] = useState(thisMonth());
  const [data, setData] = useState<GstRegister | null>(null);
  useEffect(() => {
    setData(null);
    gstEinvoiceApi.register(month).then(setData).catch((e) => toast.error(errorText(e)));
  }, [month]);
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <Label htmlFor="reg-month">Month</Label>
          <Input id="reg-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />
        </div>
        <Button variant="outline" onClick={() => gstEinvoiceApi.downloadRegister(month).catch((e) => toast.error(errorText(e)))}>
          <FileDown className="mr-1 h-4 w-4" aria-hidden="true" />
          Download CSV
        </Button>
      </div>
      {!data ? (
        <p>Loading…</p>
      ) : (
        <>
          <p>
            {data.counts.b2b} e-invoice(s) with IRN, {data.counts.b2c} signed tax invoice(s), {data.counts.not_yet_issued} numbered but not yet issued. Taxable {rupees(data.totals.taxable_value)}, CGST{" "}
            {rupees(data.totals.cgst)}, SGST {rupees(data.totals.sgst)}, IGST {rupees(data.totals.igst)}.
          </p>
          {data.series.length ? (
            <p className="text-muted-foreground">
              Document summary (GSTR-1 Table 13):{" "}
              {data.series.map((s) => `${s.series}: ${s.from} to ${s.to} (${s.count})`).join("; ")}
            </p>
          ) : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Buyer</TableHead>
                <TableHead>IRN / signed by</TableHead>
                <TableHead className="text-right">Taxable</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    No invoices this month.
                  </TableCell>
                </TableRow>
              ) : (
                data.rows.map((r) => (
                  <TableRow key={r.invoice_number}>
                    <TableCell>
                      {r.invoice_number}
                      <div className="text-xs text-muted-foreground">
                        {r.invoice_date} · {r.status_label}
                      </div>
                    </TableCell>
                    <TableCell>
                      {r.buyer}
                      <div className="text-xs text-muted-foreground">{r.buyer_gstin || "Unregistered"} · POS {r.place_of_supply}</div>
                    </TableCell>
                    <TableCell className="max-w-[14rem] truncate font-mono text-xs">{r.irn || r.signed_by || "—"}</TableCell>
                    <TableCell className="text-right">{rupees(r.taxable_value)}</TableCell>
                    <TableCell className="text-right">{rupees(Number(r.cgst) + Number(r.sgst) + Number(r.igst))}</TableCell>
                    <TableCell className="text-right">{rupees(r.total)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  );
}

const GSTR1_FILES: Array<[Gstr1Kind, string]> = [
  ["json", "GSTR-1 JSON (upload)"],
  ["invoice_register", "Invoice Register (Excel)"],
  ["credit_note_register", "Credit Note Register (Excel)"],
  ["b2b_register", "B2B e-invoices (Excel, verify GSTR-1)"],
  ["xlsx", "GSTR-1 offline-tool Excel"],
];

function Gstr1Export() {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [months, setMonths] = useState<Gstr1Month[] | null>(null);
  const [limit, setLimit] = useState("");
  useEffect(() => {
    if (!from || !to || to < from) return;
    setMonths(null);
    gstEinvoiceApi
      .gstr1Preview(from, to)
      .then((d) => {
        setMonths(d.months);
        setLimit(d.b2cl_limit);
      })
      .catch((e) => toast.error(errorText(e)));
  }, [from, to]);
  const save = (kind: Gstr1Kind) => gstEinvoiceApi.downloadGstr1(from, to, kind).catch((e) => toast.error(errorText(e)));
  return (
    <section className="space-y-2 rounded-md border p-3" aria-labelledby="gstr1-title">
      <h2 id="gstr1-title" className="text-base font-semibold">
        Monthly export: GSTR-1 JSON and registers
      </h2>
      <p className="text-muted-foreground">
        One file per month (SRIC files monthly): B2CS (Table 7), B2CL above {limit ? rupees(limit) : "₹1,00,000"} inter-state (Table 5), credit notes (Table 9B), HSN B2C
        (Table 12) and documents issued (Table 13). E-invoices reach GSTR-1 from the e-invoice system and are not included. A range over several months downloads as a zip.
        The Invoice and Credit Note Registers list the same B2C documents one by one (credit notes with their original invoice); the B2B
        E-Invoice Register lists the e-invoices and their credit notes with IRN, to check that GSTR-1 picked them up by itself (Tables 4A and 9B).
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <Label htmlFor="g1-from">From</Label>
          <Input id="g1-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" />
        </div>
        <div>
          <Label htmlFor="g1-to">To</Label>
          <Input id="g1-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" />
        </div>
        <Button disabled={!months} onClick={() => save("all")}>
          <FileDown className="mr-1 h-4 w-4" aria-hidden="true" />
          All files (zip)
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {GSTR1_FILES.map(([kind, label]) => (
          <Button key={kind} size="sm" variant="outline" disabled={!months} onClick={() => save(kind)}>
            <FileDown className="mr-1 h-4 w-4" aria-hidden="true" />
            {label}
          </Button>
        ))}
      </div>
      {to < from ? <p className="text-destructive">The end date is before the start date.</p> : null}
      {months?.map((m) => (
        <div key={m.fp} className="text-sm" data-testid={`gstr1-${m.fp}`}>
          <p>
            <span className="font-medium">
              {m.fp.slice(0, 2)}/{m.fp.slice(2)}
            </span>
            : {m.summary.b2c_invoices} signed B2C invoice(s) ({m.summary.b2cl_invoices} B2CL, {m.summary.b2cs_rows} B2CS row(s)), taxable{" "}
            {rupees(m.summary.taxable_value)}, tax {rupees(m.summary.tax)}; {m.summary.credit_notes} credit note(s); {m.summary.documents_issued} document(s) in the series.
          </p>
          {m.warnings.length ? (
            <ul className="list-disc pl-5 text-amber-700 dark:text-amber-300">
              {m.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </section>
  );
}

function SigningTab({ status }: { status: GstStatus }) {
  const [certs, setCerts] = useState<SignerCertificate[]>([]);
  const [devices, setDevices] = useState<SignerDevice[]>([]);
  const [deviceName, setDeviceName] = useState("SRIC office computer");
  const [newToken, setNewToken] = useState<SignerDevice | null>(null);
  const [email, setEmail] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isTest, setIsTest] = useState(true);
  const load = useCallback(() => {
    gstEinvoiceApi.certificates().then((d) => setCerts(d.results)).catch(() => setCerts([]));
    if (status.is_signatory) gstEinvoiceApi.devices().then((d) => setDevices(d.results)).catch(() => setDevices([]));
  }, [status.is_signatory]);
  useEffect(load, [load]);

  return (
    <div className="space-y-5 text-sm">
      <section className="space-y-2">
        <h2 className="text-base font-semibold">How signing works</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Invoices to buyers without a GSTIN wait for the authorised signatory's DSC.</li>
          <li>The signatory opens the SRIC Invoice Signer on their own computer, ticks the invoices, previews them, inserts the DSC token and enters its PIN there.</li>
          <li>The PIN and the key stay on that computer and token. Only signed PDFs come back; the portal accepts one only if it verifies with the signatory's registered certificate and matches the prepared invoice exactly.</li>
        </ol>
      </section>

      {status.is_signatory ? (
        <section className="space-y-2">
          <h2 className="text-base font-semibold">Your signing utility</h2>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label htmlFor="dev-name">Computer name</Label>
              <Input id="dev-name" value={deviceName} onChange={(e) => setDeviceName(e.target.value)} className="w-64" />
            </div>
            <Button
              onClick={async () => {
                try {
                  setNewToken(await gstEinvoiceApi.linkDevice(deviceName));
                  load();
                } catch (e) {
                  toast.error(errorText(e));
                }
              }}
            >
              <KeyRound className="mr-1 h-4 w-4" aria-hidden="true" />
              Link a signing utility
            </Button>
          </div>
          {newToken?.token ? (
            <Alert>
              <AlertTitle>Copy this token into the SRIC Invoice Signer now</AlertTitle>
              <AlertDescription>
                <code className="block break-all rounded bg-muted p-2 text-xs">{newToken.token}</code>
                It is not shown again. Anyone holding it can only list, download and upload invoices for signature; it cannot sign.
              </AlertDescription>
            </Alert>
          ) : null}
          <ul className="space-y-1">
            {devices.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{d.name}</span>
                <span className="text-muted-foreground">
                  {d.token_hint} · linked {when(d.created_at)} · last used {when(d.last_seen_at)}
                </span>
                {d.revoked_at ? (
                  <Badge variant="outline">Revoked</Badge>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => gstEinvoiceApi.revokeDevice(d.id).then(load).catch((e) => toast.error(errorText(e)))}>
                    Revoke
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Registered DSC certificates</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Signatory</TableHead>
              <TableHead>Certificate</TableHead>
              <TableHead>Valid until</TableHead>
              <TableHead>State</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {certs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  No certificate registered yet.
                </TableCell>
              </TableRow>
            ) : (
              certs.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    {c.user.name || c.user.email}
                    <div className="text-xs text-muted-foreground">{c.user.email}</div>
                  </TableCell>
                  <TableCell className="max-w-[20rem]">
                    <div className="truncate">{c.subject}</div>
                    <div className="truncate font-mono text-xs text-muted-foreground">SHA-256 {c.fingerprint.slice(0, 24)}…</div>
                  </TableCell>
                  <TableCell>{when(c.not_after)}</TableCell>
                  <TableCell className="space-x-1">
                    <Badge variant={c.is_active ? "default" : "outline"}>{c.is_active ? "Active" : "Deactivated"}</Badge>
                    {c.is_test ? <Badge variant="secondary">Test DSC</Badge> : null}
                    {status.can_administer && c.is_active ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const reason = window.prompt("Why is this certificate being deactivated? (e.g. token lost, officer transferred)") || "";
                          if (reason.trim()) gstEinvoiceApi.deactivateCertificate(c.id, reason).then(load).catch((e) => toast.error(errorText(e)));
                        }}
                      >
                        Deactivate
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {status.can_administer ? (
          <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div>
              <Label htmlFor="cert-email">Signatory's portal email</Label>
              <Input id="cert-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="cert-file">Certificate (.cer / .crt, public part only)</Label>
              <Input id="cert-file" type="file" accept=".cer,.crt,.pem,.der" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
            <Button
              disabled={!email || !file}
              onClick={() =>
                gstEinvoiceApi
                  .registerCertificate({ user_email: email.trim(), file: file!, is_test: isTest })
                  .then(() => {
                    toast.success("Certificate registered.");
                    setFile(null);
                    load();
                  })
                  .catch((e) => toast.error(errorText(e)))
              }
            >
              Register
            </Button>
            <div className="flex items-center gap-2 sm:col-span-3">
              <Checkbox id="cert-test" checked={isTest} onCheckedChange={(v) => setIsTest(v === true)} />
              <Label htmlFor="cert-test">This is a test DSC for the sandbox demonstration</Label>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function SettingsTab({ status, onSaved }: { status: GstStatus; onSaved: () => void }) {
  const s = status.settings!;
  const [limit, setLimit] = useState(s.review_above_amount);
  const [auto, setAuto] = useState(s.auto_issue);
  const [emails, setEmails] = useState(s.approver_emails);
  const [rules, setRules] = useState(status.tax_rules ?? []);
  const save = (fn: () => Promise<unknown>) =>
    fn()
      .then(() => {
        toast.success("Saved.");
        onSaved();
      })
      .catch((e) => toast.error(errorText(e)));
  return (
    <div className="space-y-5 text-sm">
      <section className="space-y-2">
        <h2 className="text-base font-semibold">SRIC's rules</h2>
        <p className="text-muted-foreground">
          Supplier on every invoice: {s.supplier_legal_name}, GSTIN {s.supplier_gstin}, PAN {s.supplier_pan}, state code {s.supplier_state_code}.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="set-limit">Hold invoices above (₹) for SRIC's review</Label>
            <Input id="set-limit" inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Switch id="set-auto" checked={auto} onCheckedChange={setAuto} />
            <Label htmlFor="set-auto">Issue invoices that pass every rule without a manual review</Label>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="set-emails">SRIC accounts that may review invoices (one email per line)</Label>
            <Textarea id="set-emails" value={emails} onChange={(e) => setEmails(e.target.value)} rows={3} />
          </div>
        </div>
        <Button onClick={() => save(() => gstEinvoiceApi.updateSettings({ review_above_amount: limit, auto_issue: auto, approver_emails: emails }))}>Save rules</Button>
      </section>
      <section className="space-y-2">
        <h2 className="text-base font-semibold">SAC and GST rate</h2>
        {rules.map((r, i) => (
          <div key={r.id} className="grid gap-2 rounded-md border p-2 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
            <div>
              <Label htmlFor={`rule-${r.id}-label`}>Service</Label>
              <Input id={`rule-${r.id}-label`} value={r.label} onChange={(e) => setRules(rules.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            </div>
            <div>
              <Label htmlFor={`rule-${r.id}-sac`}>SAC</Label>
              <Input id={`rule-${r.id}-sac`} value={r.sac_code} onChange={(e) => setRules(rules.map((x, j) => (j === i ? { ...x, sac_code: e.target.value } : x)))} />
            </div>
            <div>
              <Label htmlFor={`rule-${r.id}-rate`}>GST rate (%)</Label>
              <Input id={`rule-${r.id}-rate`} value={r.gst_rate} onChange={(e) => setRules(rules.map((x, j) => (j === i ? { ...x, gst_rate: e.target.value } : x)))} />
            </div>
            <Button variant="outline" onClick={() => save(() => gstEinvoiceApi.updateTaxRule(r.id, { label: r.label, sac_code: r.sac_code, gst_rate: r.gst_rate }))}>
              Save
            </Button>
            {r.illustrative ? <p className="text-xs text-muted-foreground sm:col-span-4">Subject to SRIC's approval.</p> : null}
          </div>
        ))}
      </section>
      {status.nic_options ? (
        <section className="space-y-1">
          <h2 className="text-base font-semibold">NIC sandbox connection (server settings)</h2>
          <p className="text-muted-foreground">
            Provider: {status.provider_label}. AppKey {status.nic_options.appkey_bytes} bytes; header {status.nic_options.client_id_header}; paths {status.nic_options.vital_prefix} and{" "}
            {status.nic_options.core_prefix}. Credentials are server environment settings and are never shown here.
          </p>
          {status.credentials_missing?.length ? <p className="text-destructive">Missing: {status.credentials_missing.join(", ")}</p> : null}
        </section>
      ) : null}
    </div>
  );
}

export default function GstInvoices() {
  const [status, setStatus] = useState<GstStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState("invoices");
  const [version, setVersion] = useState(0);
  const load = useCallback(() => {
    gstEinvoiceApi
      .status()
      .then((s) => {
        setStatus(s);
        if (!s.can_review && s.is_signatory) setTab("signing");
      })
      .catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);
  const counts = status?.counts;
  const waiting = useMemo(() => (counts ? counts.pending_review + counts.submission_failed + counts.submission_uncertain : 0), [counts]);

  return (
    <PageShell>
      <main className="container mx-auto space-y-4 px-4 py-5">
        <StandaloneOnly>
          <PageHero
            title="GST invoices prepared by the portal"
            description="E-invoices with an IRN for buyers with a GSTIN, and tax invoices signed with SRIC's DSC for the rest, in the portal's own series. Each quotes the payment receipt."
          />
        </StandaloneOnly>
        {failed ? <p className="text-sm text-destructive">Could not load the GST invoice settings.</p> : null}
        {status && !status.enabled ? (
          <Alert>
            <AlertTitle>Not switched on</AlertTitle>
            <AlertDescription>
              Portal GST invoicing is off on this server. Invoices go to SRIC by the weekly e-mail as before:{" "}
              <Link className="underline" to="/accounts/invoice-requests">
                Invoice requests to SRIC
              </Link>
              .
            </AlertDescription>
          </Alert>
        ) : null}
        {status?.enabled && !(status.can_review || status.is_signatory || status.can_administer) ? (
          <p className="text-sm">GST invoices are handled by SRIC and the Accounts In Charge.</p>
        ) : null}
        {status?.enabled && (status.can_review || status.is_signatory || status.can_administer) ? (
          <>
            <SandboxBanner status={status} />
            {counts ? (
              <p className="text-sm">
                {counts.awaiting_signature} waiting for the DSC · {waiting} waiting for review or attention · {counts.irn_generated + counts.signed} issued
              </p>
            ) : null}
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="flex-wrap">
                {status.can_review ? <TabsTrigger value="invoices">Invoices</TabsTrigger> : null}
                {status.can_review ? <TabsTrigger value="demo">Demonstration</TabsTrigger> : null}
                {status.can_review ? <TabsTrigger value="register">Monthly register</TabsTrigger> : null}
                <TabsTrigger value="signing">Signing (DSC)</TabsTrigger>
                {status.can_administer && status.settings ? <TabsTrigger value="settings">Rules</TabsTrigger> : null}
              </TabsList>
              {status.can_review ? (
                <>
                  <TabsContent value="invoices">
                    <InvoicesTab key={version} canReview={status.can_review} canAdminister={status.can_administer} />
                  </TabsContent>
                  <TabsContent value="demo">
                    <DemoTab
                      onCreated={() => {
                        setVersion((v) => v + 1);
                        load();
                      }}
                    />
                  </TabsContent>
                  <TabsContent value="register" className="space-y-4">
                    <RegisterTab />
                    <Gstr1Export />
                  </TabsContent>
                </>
              ) : null}
              <TabsContent value="signing">
                <SigningTab status={status} />
              </TabsContent>
              {status.can_administer && status.settings ? (
                <TabsContent value="settings">
                  <SettingsTab status={status} onSaved={load} />
                </TabsContent>
              ) : null}
            </Tabs>
          </>
        ) : null}
      </main>
    </PageShell>
  );
}

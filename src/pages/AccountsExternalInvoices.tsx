import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { FileDown, Loader2, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import { PageHero, PageShell, StandaloneOnly } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ExternalBookingApiError, externalBookingApi, formatInstant, type CopyRequest, type StaffInvoiceRequest } from "@/lib/externalBookingApi";

const MAX_BYTES = 10 * 1024 * 1024;

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong. Try again.";
}

function UploadDialog({ row, onClose, onDone }: { row: StaffInvoiceRequest; onClose: () => void; onDone: () => void }) {
  const replacing = Boolean(row.document);
  const [file, setFile] = useState<File | null>(null);
  const [reference, setReference] = useState("");
  const [number, setNumber] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const fileProblem = file && (!file.name.toLowerCase().endsWith(".pdf") || file.size > MAX_BYTES) ? "Choose a PDF of at most 10 MB." : "";

  const submit = async () => {
    if (!file || busy) return;
    setBusy(true);
    try {
      await externalBookingApi.uploadInvoice(row.id, { file, booking_reference: reference.trim(), invoice_number: number.trim(), replace: replacing, replacement_reason: reason.trim() });
      toast.success(replacing ? "Invoice replaced. The user has been told." : "Invoice uploaded. The user has been told.");
      onDone();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{replacing ? "Replace" : "Upload"} the GST invoice from SRIC</DialogTitle>
          <DialogDescription>
            Booking {row.booking_reference} · FBR {row.fbr_number || "not available"} · {row.billing_name}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <Label htmlFor="up-file">Invoice PDF</Label>
            <Input id="up-file" type="file" accept="application/pdf,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} aria-describedby="up-file-help" />
            <p id="up-file-help" className="text-xs text-muted-foreground">
              PDF only, at most 10 MB. Stored privately; only the user and the accounts office can download it.
            </p>
            {fileProblem ? (
              <p role="alert" className="text-destructive">
                {fileProblem}
              </p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="up-ref">Type the booking reference or FBR number printed on the invoice</Label>
            <Input id="up-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="up-number">Invoice number (optional)</Label>
            <Input id="up-number" value={number} onChange={(e) => setNumber(e.target.value)} />
          </div>
          {replacing ? (
            <div>
              <Label htmlFor="up-reason">Why is the current invoice being replaced?</Label>
              <Textarea id="up-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !file || Boolean(fileProblem) || !reference.trim() || (replacing && reason.trim().length < 10)}>
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="mr-1 h-4 w-4" aria-hidden="true" />}
            {replacing ? "Replace invoice" : "Upload invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RequestsTab() {
  const [rows, setRows] = useState<StaffInvoiceRequest[] | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [q, setQ] = useState("");
  const [uploading, setUploading] = useState<StaffInvoiceRequest | null>(null);

  const load = useCallback((query = "") => {
    externalBookingApi
      .staffInvoiceRequests({ q: query })
      .then((d) => setRows(d.requests))
      .catch((e) => {
        if (e instanceof ExternalBookingApiError && e.status === 403) setForbidden(true);
        setRows([]);
      });
  }, []);
  useEffect(() => load(), [load]);

  const resolve = async (row: StaffInvoiceRequest, action: "confirm_sent" | "resend") => {
    const note = action === "confirm_sent" ? "SRIC confirmed they received the request" : "Resending after checking the address";
    try {
      await externalBookingApi.resolveInvoiceRequest(row.id, action, note);
      toast.success("Recorded.");
      load(q);
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  if (forbidden) return <p className="rounded-md border p-4 text-sm">Only the Accounts In Charge can see invoice requests.</p>;
  return (
    <div className="space-y-3">
      <form
        className="flex max-w-md gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          load(q.trim());
        }}
      >
        <Label htmlFor="ir-search" className="sr-only">
          Search
        </Label>
        <Input id="ir-search" placeholder="Booking reference, FBR, user email or name" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button type="submit" variant="outline">
          <Search className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Search</span>
        </Button>
      </form>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Booking / FBR</TableHead>
            <TableHead>Billed to</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Queued / sent</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows === null ? (
            <TableRow>
              <TableCell colSpan={6}>Loading…</TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground">
                No invoice requests.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <div className="font-medium">{row.booking_reference}</div>
                  <div className="text-xs text-muted-foreground">FBR {row.fbr_number || "—"} · {row.equipment}</div>
                </TableCell>
                <TableCell>
                  {row.billing_name}
                  <div className="text-xs text-muted-foreground">{row.user_email}</div>
                </TableCell>
                <TableCell>{row.early_requested ? "Early (before analysis)" : "After analysis"}</TableCell>
                <TableCell>
                  <Badge variant="outline">{row.status_label}</Badge>
                  {row.last_error ? <div className="text-xs text-destructive">{row.last_error}</div> : null}
                </TableCell>
                <TableCell className="text-xs">
                  {formatInstant(row.queued_at)}
                  {row.sent_at ? <div>Sent {formatInstant(row.sent_at)}</div> : null}
                </TableCell>
                <TableCell className="space-x-1 space-y-1">
                  {["sent", "invoice_received", "uncertain", "gave_up"].includes(row.status) ? (
                    <Button size="sm" variant={row.document ? "outline" : "default"} onClick={() => setUploading(row)}>
                      {row.document ? "Replace invoice" : "Upload invoice"}
                    </Button>
                  ) : null}
                  {row.document ? (
                    <Button size="sm" variant="ghost" onClick={() => externalBookingApi.downloadInvoice(row.document!.id).catch((e) => toast.error(errorText(e)))}>
                      <FileDown className="h-4 w-4" aria-hidden="true" />
                      <span className="sr-only">Download invoice</span>
                    </Button>
                  ) : null}
                  {row.status === "uncertain" || row.status === "gave_up" ? (
                    <>
                      <Button size="sm" variant="outline" onClick={() => resolve(row, "confirm_sent")}>
                        SRIC has it
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => resolve(row, "resend")}>
                        Send again
                      </Button>
                    </>
                  ) : null}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {uploading ? (
        <UploadDialog
          row={uploading}
          onClose={() => setUploading(null)}
          onDone={() => {
            setUploading(null);
            load(q);
          }}
        />
      ) : null}
    </div>
  );
}

function DispatchTab() {
  const [rows, setRows] = useState<CopyRequest[] | null>(null);
  const [dispatching, setDispatching] = useState<CopyRequest | null>(null);
  const [date, setDate] = useState("");
  const [reference, setReference] = useState("");
  const [printedOk, setPrintedOk] = useState(false);

  const load = useCallback(() => {
    externalBookingApi.staffCopies("requested,prepared,waiting_invoice").then((d) => setRows(d.copies)).catch(() => setRows([]));
  }, []);
  useEffect(load, [load]);

  const act = async (fn: () => Promise<unknown>, done: string) => {
    try {
      await fn();
      toast.success(done);
      load();
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  return (
    <div className="space-y-3 text-sm">
      <p className="rounded-md border bg-muted/40 p-2">
        Envelope labels are 10 × 4.5 inches. Print at 100% / Actual size with “Fit to page” turned off, and check the first print with a ruler.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Booking</TableHead>
            <TableHead>Recipient</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows === null ? (
            <TableRow>
              <TableCell colSpan={4}>Loading…</TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground">
                Nothing to dispatch.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  {c.booking_reference}
                  <div className="text-xs text-muted-foreground">FBR {c.fbr_number || "—"}</div>
                </TableCell>
                <TableCell>
                  {c.address.recipient_name}, {c.address.city} {c.address.postal_code}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{c.status_label}</Badge>
                </TableCell>
                <TableCell className="space-x-1">
                  {c.status !== "waiting_invoice" ? (
                    <Button size="sm" variant="outline" onClick={() => externalBookingApi.downloadEnvelope(c.id).catch((e) => toast.error(errorText(e)))}>
                      Envelope label
                    </Button>
                  ) : null}
                  {c.status === "requested" ? (
                    <Button size="sm" variant="outline" onClick={() => act(() => externalBookingApi.markCopyPrepared(c.id), "Marked prepared.")}>
                      Mark prepared
                    </Button>
                  ) : null}
                  {c.status === "requested" || c.status === "prepared" ? (
                    <Button
                      size="sm"
                      onClick={() => {
                        setDispatching(c);
                        setDate(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));
                        setReference("");
                        setPrintedOk(false);
                      }}
                    >
                      Record dispatch
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {dispatching ? (
        <Dialog open onOpenChange={(open) => !open && setDispatching(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Speed Post dispatch</DialogTitle>
              <DialogDescription>Only record it once the envelope has actually been handed over; a printed label is not a dispatch.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="dp-date">Dispatch date</Label>
              <Input id="dp-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <Label htmlFor="dp-ref">Speed Post reference</Label>
              <Input id="dp-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. EE123456789IN" />
              <div className="flex items-center gap-2">
                <Checkbox id="dp-ok" checked={printedOk} onCheckedChange={(v) => setPrintedOk(v === true)} />
                <Label htmlFor="dp-ok">The envelope has been handed to the post office.</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDispatching(null)}>
                Cancel
              </Button>
              <Button
                disabled={!date || !printedOk}
                onClick={() =>
                  act(() => externalBookingApi.markCopyDispatched(dispatching.id, date, reference.trim()), "Dispatch recorded. The user has been told.").then(() => setDispatching(null))
                }
              >
                Record dispatch
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

export default function AccountsExternalInvoices() {
  const location = useLocation();
  const defaultTab = location.pathname.endsWith("invoice-dispatch") ? "dispatch" : "requests";
  return (
    <PageShell>
      <main className="container mx-auto space-y-4 px-4 py-5">
        <StandaloneOnly>
          <PageHero title="GST invoices for external bookings" description="Requests sent to SRIC, official invoices received from SRIC, and printed copies to post. SRIC issues the GST invoice; upload it here when it arrives." />
        </StandaloneOnly>
        <p className="text-sm">
          Refunds to users' bank accounts go to SRIC in the same weekly batch:{" "}
          <Link to="/accounts/refunds" className="font-medium underline">Refunds to bank accounts</Link>.
        </p>
        <Tabs defaultValue={defaultTab}>
          <TabsList>
            <TabsTrigger value="requests">Invoice requests</TabsTrigger>
            <TabsTrigger value="dispatch">Printed copies</TabsTrigger>
          </TabsList>
          <TabsContent value="requests">
            <RequestsTab />
          </TabsContent>
          <TabsContent value="dispatch">
            <DispatchTab />
          </TabsContent>
        </Tabs>
      </main>
    </PageShell>
  );
}

import { useCallback, useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { PageHero, PageShell, StandaloneOnly } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { externalBookingApi, formatInstant, type ExternalRefund } from "@/lib/externalBookingApi";
import { formatINRWithPaise } from "@/lib/money";

const TABS: { value: string; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "queued", label: "Waiting for SRIC batch" },
  { value: "sent", label: "Sent to SRIC" },
  { value: "failed", label: "Sending failed" },
  { value: "closed", label: "Closed" },
];

const TONE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  queued: "secondary",
  sent: "default",
  failed: "destructive",
  closed: "outline",
};

function CloseDialog({ row, onClose, onDone }: { row: ExternalRefund; onClose: () => void; onDone: () => void }) {
  const [utr, setUtr] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const ready = utr.trim().length > 0 || note.trim().length >= 5;

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    try {
      await externalBookingApi.closeRefund(row.id, { utr: utr.trim(), note: note.trim() });
      toast.success("Refund closed. The user has been told it was paid.");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The refund could not be closed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close the refund for booking {row.booking_reference}</DialogTitle>
          <DialogDescription>
            Close it only once SRIC confirms that {formatINRWithPaise(row.refund_amount)} has reached{" "}
            {row.bank?.account_holder_name || "the user"}'s account.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="space-y-1">
            <Label htmlFor="refund-utr">Bank reference (UTR)</Label>
            <Input id="refund-utr" value={utr} onChange={(e) => setUtr(e.target.value)} maxLength={64} autoComplete="off" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="refund-note">Note (needed when there is no UTR)</Label>
            <Textarea id="refund-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Back</Button>
          <Button onClick={() => void submit()} disabled={!ready || busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Mark as paid
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Accounts In Charge: refunds to users' bank accounts, from the weekly SRIC batch until the money is received. */
export default function AccountsExternalRefunds() {
  const [tab, setTab] = useState("open");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<ExternalRefund[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [closing, setClosing] = useState<ExternalRefund | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await externalBookingApi.staffRefunds({ status: tab === "open" ? "" : tab, q: q.trim() });
      setRows(tab === "open" ? res.refunds.filter((r) => r.status !== "closed") : res.refunds);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refunds could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [tab, q]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PageShell>
      <main className="container mx-auto space-y-4 px-4 py-5">
        <StandaloneOnly>
          <PageHero
            title="Refunds to bank accounts"
            description="Refunds external users asked to receive in their bank account after a lab disruption. They go to SRIC with the weekly batch (first working day of the week, 09:30). Close each one once SRIC confirms the payment."
          />
        </StandaloneOnly>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="flex-wrap">
              {TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <form
            className="flex items-center gap-2"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              void load();
            }}
          >
            <Input aria-label="Search refunds" placeholder="Booking, email or UTR" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
            <Button type="submit" variant="outline" size="icon" aria-label="Search">
              <Search className="h-4 w-4" />
            </Button>
          </form>
        </div>
        {error ? (
          <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">{error}</p>
        ) : loading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading refunds…
          </div>
        ) : rows.length === 0 ? (
          <p className="rounded-md border p-6 text-center text-sm text-muted-foreground">No refunds here.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Booking</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Bank account</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.booking_reference}</div>
                      <div className="text-xs text-muted-foreground">{r.equipment}</div>
                    </TableCell>
                    <TableCell>
                      <div>{r.user?.name}</div>
                      <div className="text-xs text-muted-foreground">{r.user?.email}</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>{r.bank?.account_holder_name}</div>
                      <div>{r.bank?.bank_name} {r.bank?.branch}</div>
                      <div className="font-mono">{r.bank?.account_number} · {r.bank?.ifsc}</div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatINRWithPaise(r.refund_amount)}
                      <div className="text-xs text-muted-foreground">{r.gst_refunded ? "GST included" : "GST not refunded"}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={TONE[r.status] ?? "secondary"}>{r.status_label}</Badge>
                      {r.utr ? <div className="mt-1 font-mono text-xs">UTR {r.utr}</div> : null}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>Asked {formatInstant(r.created_at)}</div>
                      {r.sent_at ? <div>Sent {formatInstant(r.sent_at)}</div> : null}
                      {r.closed_at ? <div>Closed {formatInstant(r.closed_at)}</div> : null}
                    </TableCell>
                    <TableCell>
                      {r.status !== "closed" ? (
                        <Button size="sm" variant="outline" onClick={() => setClosing(r)}>Mark as paid</Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {closing ? (
          <CloseDialog
            row={closing}
            onClose={() => setClosing(null)}
            onDone={() => {
              setClosing(null);
              void load();
            }}
          />
        ) : null}
      </main>
    </PageShell>
  );
}

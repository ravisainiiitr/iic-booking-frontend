import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Ban,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Download,
  FileText,
  Landmark,
  Loader2,
  Pencil,
  Plus,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import { heroButtonClass, PageHero, PageShell, StandaloneOnly } from "@/components/PageShell";
import OfflineRechargeDialog from "@/components/wallet/OfflineRechargeDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient, type SavedProformaInvoice } from "@/lib/api";
import { checkoutBranding } from "@/lib/institutionIdentity";
import { loadRazorpayScript } from "@/lib/razorpay";
import { isExternalBookingUserType } from "@/lib/userTypes";
import { downloadSavedProforma, MY_PROFORMAS_PATH, PROFORMA_STATE_FILTERS, rupees, startRevising } from "@/lib/savedProformas";
import { ProformaDetails, ProformaStateBadge } from "@/components/proforma/SavedProformaParts";

function when(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function MyProformaInvoices() {
  const navigate = useNavigate();
  const { user } = useAuth();
  // Offline payment against a receipt is open to external users (as on the Wallet page).
  const canPayOffline = isExternalBookingUserType((user as { user_type?: string } | null)?.user_type);
  const [rows, setRows] = useState<SavedProformaInvoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState("");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [cancelling, setCancelling] = useState<SavedProformaInvoice | null>(null);
  const [reason, setReason] = useState("");
  const [paying, setPaying] = useState<SavedProformaInvoice | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [offlineFor, setOfflineFor] = useState<SavedProformaInvoice | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await apiClient.getMyProformaInvoices({ state: state || undefined, q: query.trim() || undefined });
    if (res.error || !res.data) {
      setError(res.error || "Could not load your proforma invoices.");
      return;
    }
    setError(null);
    setRows(res.data.results);
  }, [state, query]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), query ? 300 : 0);
    return () => window.clearTimeout(t);
  }, [load, query]);

  const confirmCancel = async () => {
    if (!cancelling) return;
    setBusy(true);
    const res = await apiClient.cancelProformaInvoice(cancelling.id, reason.trim());
    setBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`Proforma ${cancelling.number} cancelled.`);
    setCancelling(null);
    setReason("");
    void load();
  };

  const edit = (pi: SavedProformaInvoice) => {
    startRevising(pi);
    navigate("/proforma-invoice");
  };

  const payOnline = async () => {
    if (!paying) return;
    setBusy(true);
    const ok = await loadRazorpayScript();
    if (!ok || !window.Razorpay) {
      setBusy(false);
      toast.error("Could not load the payment page. Check your connection and try again.");
      return;
    }
    const res = await apiClient.payProformaInvoiceOnline(paying.id, payAmount.replace(/,/g, "").trim() || undefined);
    if (res.error || !res.data) {
      setBusy(false);
      toast.error(res.error || "Could not start the payment.");
      return;
    }
    const order = res.data;
    const pi = paying;
    const rzp = new window.Razorpay({
      key: order.key || order.key_id,
      amount: order.amount,
      currency: order.currency || "INR",
      ...checkoutBranding(order.checkout_name),
      description: `Payment against proforma ${order.proforma_number}`.slice(0, 250),
      order_id: order.order_id,
      handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        const verify = await apiClient.verifyRazorpayCheckout(response);
        setBusy(false);
        setPaying(null);
        if (verify.error) {
          toast.error(verify.error);
          void load();
          return;
        }
        const paidId = verify.data?.payment_id || response.razorpay_payment_id;
        toast.success(`Payment received against proforma ${pi.number}.`);
        window.location.assign(`/payments/receipts/${encodeURIComponent(paidId)}?next=${encodeURIComponent(MY_PROFORMAS_PATH)}`);
      },
      modal: {
        ondismiss: () => {
          setBusy(false);
          void load();
        },
      },
    });
    rzp.open();
  };

  return (
    <PageShell>
      <main className="container mx-auto max-w-5xl space-y-4 px-3 py-4 sm:px-4 sm:py-5">
        <StandaloneOnly>
          <PageHero
            compact
            title="My Proforma Invoices"
            description="Every proforma you have downloaded: pay it online, record an offline payment, edit or cancel it."
            icon={<FileText className="h-5 w-5" />}
            actions={
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className={heroButtonClass.secondary} onClick={() => navigate("/dashboard")}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button size="sm" className={heroButtonClass.primary} onClick={() => navigate("/proforma-invoice")}>
                  <Plus className="mr-2 h-4 w-4" />
                  New proforma
                </Button>
              </div>
            }
          />
        </StandaloneOnly>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Proforma state">
            {PROFORMA_STATE_FILTERS.map((f) => (
              <Button
                key={f.key || "all"}
                role="tab"
                aria-selected={state === f.key}
                size="sm"
                variant={state === f.key ? "default" : "outline"}
                onClick={() => setState(f.key)}
              >
                {f.label}
              </Button>
            ))}
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Proforma number" value={query} onChange={(e) => setQuery(e.target.value)}
              aria-label="Search proforma invoices" />
          </div>
        </div>

        {error ? (
          <Card>
            <CardContent className="py-6 text-sm text-destructive">{error}</CardContent>
          </Card>
        ) : rows === null ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No proforma invoices yet. Proformas you download from the Proforma invoice page are kept here.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {rows.map((pi) => {
              const open = openId === pi.id;
              return (
                <Card key={pi.id} data-testid="pi-card">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{pi.number}</span>
                          <ProformaStateBadge pi={pi} />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {pi.department.name || "—"} · issued {when(pi.issued_at)} · valid until {when(pi.valid_until)}
                        </p>
                        {pi.replaced_by ? <p className="text-xs text-muted-foreground">Replaced by {pi.replaced_by}</p> : null}
                        {pi.replaces ? <p className="text-xs text-muted-foreground">Revision of {pi.replaces}</p> : null}
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-lg font-semibold tabular-nums">{rupees(pi.total)}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          Paid {rupees(pi.state.credited)}
                          {Number(pi.state.pending) > 0 ? ` · awaiting approval ${rupees(pi.state.pending)}` : ""}
                          {pi.state.can_pay ? ` · to pay ${rupees(pi.state.outstanding)}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => void downloadSavedProforma(pi)}>
                        <Download className="mr-1.5 h-4 w-4" /> PDF
                      </Button>
                      {pi.state.can_pay ? (
                        <>
                          <Button size="sm" onClick={() => { setPaying(pi); setPayAmount(String(Number(pi.state.outstanding))); }}>
                            <CreditCard className="mr-1.5 h-4 w-4" /> Pay online
                          </Button>
                          {canPayOffline ? (
                            <Button size="sm" variant="secondary" onClick={() => setOfflineFor(pi)}>
                              <Landmark className="mr-1.5 h-4 w-4" /> Record offline payment
                            </Button>
                          ) : null}
                        </>
                      ) : null}
                      {pi.state.can_edit ? (
                        <Button size="sm" variant="outline" onClick={() => edit(pi)}>
                          <Pencil className="mr-1.5 h-4 w-4" /> Edit
                        </Button>
                      ) : null}
                      {pi.state.can_cancel ? (
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setCancelling(pi)}>
                          <Ban className="mr-1.5 h-4 w-4" /> Cancel
                        </Button>
                      ) : null}
                      <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setOpenId(open ? null : pi.id)}
                        aria-expanded={open}>
                        {open ? <ChevronUp className="mr-1 h-4 w-4" /> : <ChevronDown className="mr-1 h-4 w-4" />}
                        Details
                      </Button>
                    </div>
                    {open ? <ProformaDetails pi={pi} /> : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <Dialog open={Boolean(cancelling)} onOpenChange={(next) => !busy && !next && setCancelling(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel proforma {cancelling?.number}?</DialogTitle>
            <DialogDescription>
              The proforma stays on record marked cancelled and can no longer be paid. This cannot be undone; make a new
              proforma if you need one later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="pi-cancel-reason">Reason (optional)</Label>
            <Textarea id="pi-cancel-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelling(null)} disabled={busy}>Keep it</Button>
            <Button variant="destructive" onClick={() => void confirmCancel()} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Cancel proforma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(paying)} onOpenChange={(next) => !busy && !next && setPaying(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pay proforma {paying?.number} online</DialogTitle>
            <DialogDescription>
              The amount is added to your wallet for {paying?.department.name || "the department"} and recorded against
              this proforma. A gateway convenience fee may apply; it is shown before you pay.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="pi-pay-amount">Amount (₹), at most {rupees(paying?.state.outstanding)}</Label>
            <Input id="pi-pay-amount" inputMode="decimal" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaying(null)} disabled={busy}>Close</Button>
            <Button onClick={() => void payOnline()} disabled={busy || !(Number(payAmount.replace(/,/g, "")) > 0)}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
              Continue to payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OfflineRechargeDialog
        open={Boolean(offlineFor)}
        onOpenChange={(next) => !next && setOfflineFor(null)}
        onSubmitted={() => {
          setOfflineFor(null);
          void load();
        }}
        proforma={
          offlineFor
            ? {
                id: offlineFor.id,
                number: offlineFor.number,
                departmentId: offlineFor.department.id,
                departmentName: offlineFor.department.name,
                outstanding: offlineFor.state.outstanding,
              }
            : null
        }
      />
    </PageShell>
  );
}

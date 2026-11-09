import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { PageHero, PageShell, StandaloneOnly } from "@/components/PageShell";
import { BookingLink } from "@/components/BookingLink";
import { TestAccountBadge } from "@/components/wallet/TestAccountBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient, type PaymentIssueRow } from "@/lib/api";
import { formatINRAmount } from "@/lib/money";

type View = "OPEN" | "RESOLVED" | "ALL";

const dateTime = new Intl.DateTimeFormat("en-IN", {
  day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
});

/** What Finance usually does about each kind of issue (the portal never moves money by itself here). */
export const NEXT_STEP: Record<string, string> = {
  DUPLICATE_CAPTURE: "Refund the second payment on Razorpay, then close with the refund reference.",
  CANCELLED_BOOKING: "Refund the payment on Razorpay (the booking is cancelled), then close with the refund reference.",
  NOT_APPLIED: "Apply the payment to the booking or wallet by hand, or refund it, then close with what was done.",
  UNKNOWN_ORDER: "Find who paid (Razorpay dashboard) and refund or apply it, then close with what was done.",
  MISMATCH: "Compare the amount with the order; refund the difference or the payment, then close with what was done.",
  NOT_CAPTURED: "Usually clears itself when Razorpay captures the payment. If it stays, capture or let it expire on Razorpay.",
  ORDER_WITHOUT_PAYMENT: "Check the order on Razorpay; if no money came in, close with that note.",
  UNSETTLED: "Wait for Razorpay's next settlement; close only if it was settled outside the usual report.",
  SETTLEMENT_MISMATCH: "Compare the settlement line with the payment and its fees, then close with the finding.",
  SETTLEMENT_UNKNOWN: "Find the payment on Razorpay and record or refund it, then close with what was done.",
};

function purposeLabel(purpose?: string): string {
  if (!purpose) return "";
  if (purpose.startsWith("WALLET")) return "Wallet recharge";
  if (purpose.startsWith("BOOKING") || purpose.startsWith("EXTERNAL")) return "Booking payment";
  return purpose.replace(/_/g, " ").toLowerCase();
}

/** Accounts In Charge and Main Administrator: payments that reached Razorpay but were not applied normally. */
export default function PaymentIssues() {
  const { user, loading: authLoading } = useAuth();
  const [view, setView] = useState<View>("OPEN");
  const [rows, setRows] = useState<PaymentIssueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState<PaymentIssueRow | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (which: View) => {
    setLoading(true);
    const res = await apiClient.getPaymentIssues(which);
    if (res.data) {
      setRows(res.data.results);
      setError(null);
    } else {
      setRows([]);
      setError(res.error || "Could not load payment issues.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authLoading && user) void load(view);
  }, [authLoading, user, view, load]);

  const openTotal = useMemo(
    () => rows.filter((r) => r.status === "OPEN").reduce((sum, r) => sum + (Number(r.amount) || 0), 0),
    [rows],
  );

  const submit = async () => {
    if (!closing) return;
    setSaving(true);
    const res = await apiClient.resolvePaymentIssue(closing.id, note.trim());
    setSaving(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Issue closed");
    setClosing(null);
    setNote("");
    void load(view);
  };

  if (authLoading) return null;
  const forbidden = !!error && /forbidden/i.test(error);

  return (
    <PageShell>
      <main className="mx-auto w-full max-w-[1400px] space-y-4 px-3 py-4 sm:px-6">
        <StandaloneOnly>
          <PageHero
            compact
            icon={<ShieldAlert className="h-5 w-5" />}
            title="Payment issues"
            description="Payments that reached Razorpay but were not applied normally: refund or apply them, then close each one with a note."
          />
        </StandaloneOnly>

        {forbidden ? (
          <Card className="rounded-2xl border-border/70">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Only the Accounts In Charge and the Main Administrator can see payment issues.
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <Tabs value={view} onValueChange={(v) => setView(v as View)}>
                <TabsList className="h-auto gap-1 p-1">
                  <TabsTrigger value="OPEN" className="px-3 py-1.5">Open</TabsTrigger>
                  <TabsTrigger value="RESOLVED" className="px-3 py-1.5">Closed</TabsTrigger>
                  <TabsTrigger value="ALL" className="px-3 py-1.5">All</TabsTrigger>
                </TabsList>
              </Tabs>
              {view !== "RESOLVED" && rows.some((r) => r.status === "OPEN") ? (
                <span className="text-sm text-muted-foreground" data-testid="open-total">
                  {rows.filter((r) => r.status === "OPEN").length} open · {formatINRAmount(openTotal)}
                </span>
              ) : null}
              <Button variant="outline" size="sm" className="ml-auto gap-1.5" onClick={() => void load(view)} disabled={loading}>
                <RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} aria-hidden />
                Refresh
              </Button>
            </div>

            {loading && rows.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden /> Loading payment issues…
              </div>
            ) : error ? (
              <p className="text-sm text-amber-700 dark:text-amber-300">{error}</p>
            ) : rows.length === 0 ? (
              <Card className="rounded-2xl border-border/70">
                <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" aria-hidden />
                  {view === "OPEN" ? "No open payment issues. Every payment was applied normally." : "Nothing to show."}
                </CardContent>
              </Card>
            ) : (
              <ul className="space-y-3" data-testid="payment-issue-list">
                {rows.map((row) => (
                  <li key={row.id}>
                    <Card className="rounded-2xl border-border/70 shadow-sm">
                      <CardContent className="space-y-3 p-4">
                        <div className="flex flex-wrap items-start gap-2">
                          {row.status === "OPEN" ? (
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                          ) : (
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">{row.kind_label}</p>
                            <p className="text-xs text-muted-foreground">
                              Raised {dateTime.format(new Date(row.raised_at))}
                              {row.mode ? ` · ${row.mode} mode` : ""}
                              {row.purpose ? ` · ${purposeLabel(row.purpose)}` : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {row.test_account ? <TestAccountBadge /> : null}
                            {row.amount != null ? <span className="text-sm font-semibold tabular-nums">{formatINRAmount(Number(row.amount))}</span> : null}
                            <Badge variant={row.status === "OPEN" ? "destructive" : "secondary"}>{row.status === "OPEN" ? "Open" : "Closed"}</Badge>
                          </div>
                        </div>

                        <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
                          <div>
                            <dt className="text-muted-foreground">Booking</dt>
                            <dd>{row.booking_id ? <BookingLink pk={row.booking_id} displayId={row.booking_reference} staff /> : "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">Razorpay order</dt>
                            <dd className="font-mono">{row.razorpay_order_id || "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">Razorpay payment</dt>
                            <dd className="font-mono">{row.razorpay_payment_id || "—"}</dd>
                          </div>
                        </dl>

                        {row.detail ? <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs">{row.detail}</p> : null}

                        {row.status === "OPEN" ? (
                          <div className="flex flex-wrap items-center gap-3">
                            <p className="min-w-0 flex-1 text-xs text-muted-foreground">
                              <span className="font-semibold text-foreground">Next step: </span>
                              {NEXT_STEP[row.kind] ?? "Check the payment on Razorpay, then close with what was done."}
                            </p>
                            <Button size="sm" onClick={() => { setClosing(row); setNote(""); }}>
                              Close issue
                            </Button>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Closed {row.resolved_at ? dateTime.format(new Date(row.resolved_at)) : ""}
                            {row.resolved_by ? ` by ${row.resolved_by}` : " automatically"}: {row.resolution_note}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <Dialog open={closing != null} onOpenChange={(open) => !open && setClosing(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Close payment issue</DialogTitle>
              <DialogDescription>
                Closing records your note only; it does not refund or move any money. Do the refund or adjustment first
                (Razorpay or the wallet ledger), then note what was done.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="issue-note">What was done</Label>
              <Textarea
                id="issue-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Refunded on Razorpay, refund ID rfnd_..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">At least 5 characters.</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setClosing(null)}>Cancel</Button>
              <Button onClick={() => void submit()} disabled={saving || note.trim().length < 5}>
                {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
                Close issue
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </PageShell>
  );
}

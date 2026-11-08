import { useEffect, useState } from "react";
import { Download, Loader2, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiClient, type PaymentReceiptSummary } from "@/lib/api";
import { formatINRWithPaise } from "@/lib/money";
import { downloadReceipt } from "@/lib/receiptDownload";

/** The signed-in user's online-payment receipts (bookings and wallet recharges), each downloadable again as a PDF. */
export function PaymentReceiptsList() {
  const [rows, setRows] = useState<PaymentReceiptSummary[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void apiClient.getMyPaymentReceipts().then((res) => {
      if (live) setRows(res.data?.results ?? []);
    });
    return () => {
      live = false;
    };
  }, []);

  if (!rows || rows.length === 0) return null;

  const get = async (id: string) => {
    setBusy(id);
    try {
      await downloadReceipt(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The receipt could not be downloaded.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="space-y-2 rounded-xl border bg-card p-4" data-testid="payment-receipts">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <ReceiptText className="h-4 w-4" aria-hidden /> Online payment receipts
      </h2>
      <ul className="divide-y text-sm">
        {rows.map((r) => (
          <li key={r.razorpay_payment_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div className="min-w-0">
              <p className="font-medium">{r.purpose}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(r.paid_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} · {formatINRWithPaise(r.total_paid)}
                {r.test_mode ? " · test mode" : ""}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => void get(r.razorpay_payment_id)} disabled={busy !== null}>
              {busy === r.razorpay_payment_id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <Download className="mr-1.5 h-4 w-4" aria-hidden />}
              Receipt
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

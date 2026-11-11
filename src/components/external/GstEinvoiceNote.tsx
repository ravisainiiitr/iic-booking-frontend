import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { gstEinvoiceApi, rupees, type BuyerGstInvoice } from "@/lib/gstEinvoiceApi";

/**
 * The portal-prepared GST invoice of a booking, when there is one (sandbox: test accounts only). Shows its number and
 * how it is authenticated: the IRN for a buyer with a GSTIN, SRIC's DSC for the rest. The invoice itself downloads
 * from the official-invoice button above (the same document the accounts office would otherwise upload).
 */
export function GstEinvoiceNote({ bookingId }: { bookingId: number }) {
  const [inv, setInv] = useState<BuyerGstInvoice | null>(null);
  useEffect(() => {
    let live = true;
    gstEinvoiceApi
      .myBooking(bookingId)
      .then((d) => live && setInv(d.enabled ? d.invoice : null))
      .catch(() => live && setInv(null));
    return () => {
      live = false;
    };
  }, [bookingId]);
  if (!inv) return null;
  return (
    <div className="space-y-1 rounded-md border p-2 text-sm" data-testid="gst-einvoice-note">
      <p className="flex flex-wrap items-center gap-1">
        <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
        <span className="font-medium">Tax invoice {inv.number}</span>
        <span>
          · {inv.status_label} · {rupees(inv.total)}
          {inv.receipt_number ? ` · against receipt ${inv.receipt_number}` : ""}
        </span>
      </p>
      {inv.irn ? <p className="break-all font-mono text-xs">IRN {inv.irn}{inv.ack_number ? ` · Ack ${inv.ack_number}` : ""}</p> : null}
      {inv.supply_type === "B2C" && inv.signed_at ? <p className="text-xs">Digitally signed by SRIC's authorised signatory (DSC). Check the signature in Adobe Reader's Signature panel.</p> : null}
      {!inv.issued ? <p className="text-xs text-muted-foreground">{inv.next_step}</p> : null}
      {inv.mode === "sandbox" ? (
        <p className="text-xs font-medium text-orange-700 dark:text-orange-300">Sandbox demonstration: not a valid tax invoice{inv.simulated ? " (simulated IRN)" : ""}.</p>
      ) : null}
    </div>
  );
}

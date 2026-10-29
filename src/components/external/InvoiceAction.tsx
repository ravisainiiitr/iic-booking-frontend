import { useCallback, useEffect, useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { externalBookingApi, type InvoiceStatus } from "@/lib/externalBookingApi";
import { ExternalInvoicePanel } from "./ExternalInvoicePanel";

/**
 * The booking's "Invoice" action for external users.
 * * Official GST invoice uploaded: the button downloads it directly (no proforma, no choices).
 * * External invoice service on, no invoice yet: the button opens the invoice options (proforma, when to get the GST
 *   invoice, printed copy) in a dialog. Hidden from the page by default.
 * * Service off or not an external booking: the previous behaviour (``legacy``: portal invoice after completion).
 */
export function InvoiceAction({
  bookingId,
  disabled,
  legacy,
  legacyAvailable,
  legacyBusy,
}: {
  bookingId: number;
  disabled?: boolean;
  legacy: () => Promise<void> | void;
  legacyAvailable: boolean;
  legacyBusy: boolean;
}) {
  const [status, setStatus] = useState<InvoiceStatus | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    externalBookingApi
      .invoice(bookingId)
      .then(setStatus)
      .catch(() => setStatus(null));
  }, [bookingId]);
  useEffect(load, [load]);

  if (status === undefined) {
    return (
      <Button size="sm" variant="outline" disabled>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
        Invoice
      </Button>
    );
  }

  if (status?.is_external && status.document) {
    const doc = status.document;
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={disabled || busy}
        data-testid="invoice-download-gst"
        onClick={async () => {
          setBusy(true);
          try {
            await externalBookingApi.downloadInvoice(doc.id);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "The invoice could not be downloaded.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Download className="mr-2 h-4 w-4" aria-hidden="true" />
        {busy ? "Preparing…" : `GST invoice${doc.invoice_number ? ` ${doc.invoice_number}` : ""}`}
      </Button>
    );
  }

  if (status?.is_external && status.enabled) {
    return (
      <>
        <Button size="sm" variant="outline" disabled={disabled} onClick={() => setOpen(true)} data-testid="invoice-open">
          <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
          Invoice
        </Button>
        <Dialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) load(); // a choice made in the dialog may change what the button does
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Invoice</DialogTitle>
              <DialogDescription>
                The official GST invoice comes from SRIC. Until then you can download a proforma invoice.
              </DialogDescription>
            </DialogHeader>
            <ExternalInvoicePanel bookingId={bookingId} initialStatus={status} />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <Button size="sm" variant="outline" disabled={disabled || legacyBusy || !legacyAvailable} onClick={() => void legacy()}>
      <Download className="mr-2 h-4 w-4" aria-hidden="true" />
      {legacyBusy ? "Preparing…" : "Invoice (PDF)"}
    </Button>
  );
}

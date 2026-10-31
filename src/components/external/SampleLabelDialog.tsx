import { useEffect, useState } from "react";
import { Loader2, Tag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExternalBookingApiError, externalBookingApi, type PostalAddress } from "@/lib/externalBookingApi";
import { dispatchPackName, mergePdfs, saveBlob } from "@/lib/dispatchPack";
import { AddressFields } from "./ExternalInvoicePanel";

const EMPTY_ADDRESS: PostalAddress = { recipient_name: "", organisation: "", line1: "", line2: "", city: "", state: "", postal_code: "", country: "India", phone: "" };

/**
 * The booking's "Shipping label and requisition form" action for external users: one PDF with the sample label
 * (booking ID in large type, TO and FROM with mobile numbers; no QR code since 31 Oct 2026) on page 1 and the
 * filled equipment requisition form after it. Asks only for the sender address and the number of samples; the
 * sender of the latest label is offered first (a newly typed one is saved to the address book by the server). When
 * sample labels are switched off the previous plain label is used through ``legacyLabelPdf``, still with the form.
 */
export function SampleLabelDialog({
  bookingId,
  bookingReference,
  open,
  onOpenChange,
  requisitionPdf,
  legacyLabelPdf,
}: {
  bookingId: number;
  /** The booking ID shown to the user (file name). */
  bookingReference: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The filled equipment requisition form for this booking. */
  requisitionPdf: () => Promise<Blob>;
  /** The previous plain shipping label, used while sample labels are switched off. */
  legacyLabelPdf: () => Promise<Blob | null>;
}) {
  const [addresses, setAddresses] = useState<PostalAddress[]>([]);
  const [choice, setChoice] = useState("new");
  const [sender, setSender] = useState<PostalAddress>(EMPTY_ADDRESS);
  const [count, setCount] = useState("1");
  const [busy, setBusy] = useState(false);
  const [disabled, setDisabled] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDisabled(false);
    externalBookingApi
      .addresses()
      .then((d) => {
        setDisabled(d.sample_labels_enabled === false);
        setAddresses(d.addresses);
        // The sender of the latest label first, then the default address, then any saved one.
        const preferred =
          d.addresses.find((a) => a.id != null && a.id === d.last_label_address_id) ??
          d.addresses.find((a) => a.is_default) ??
          d.addresses[0];
        setChoice(preferred?.id != null ? String(preferred.id) : "new");
      })
      .catch(() => setAddresses([]));
  }, [open]);

  const download = async () => {
    if (busy) return;
    const n = Number(count);
    if (!Number.isInteger(n) || n < 1 || n > 500) {
      toast.error("Give the number of samples (1 to 500).");
      return;
    }
    setBusy(true);
    try {
      const [label, form] = await Promise.all([
        externalBookingApi.sampleLabelBytes(
          bookingId,
          choice === "new" ? { sample_count: n, description: "", sender } : { sample_count: n, description: "", address_id: Number(choice) },
        ),
        requisitionPdf(),
      ]);
      saveBlob(await mergePdfs([label, form]), dispatchPackName(bookingReference));
      toast.success(
        "Downloaded: label (page 1) and requisition form. Print the label at actual size for the parcel; sign the form and put it inside.",
      );
      onOpenChange(false);
    } catch (e) {
      if (e instanceof ExternalBookingApiError && e.code === "labels_disabled") {
        setDisabled(true);
      } else {
        toast.error(e instanceof Error ? e.message : "The label could not be prepared.");
      }
    } finally {
      setBusy(false);
    }
  };

  const plainLabel = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const [label, form] = await Promise.all([legacyLabelPdf(), requisitionPdf()]);
      saveBlob(label ? await mergePdfs([label, form]) : form, dispatchPackName(bookingReference));
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The documents could not be prepared.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Shipping label and requisition form</DialogTitle>
          <DialogDescription>
            One PDF: the 10 × 4.5 inch label with your booking ID in large type and the TO and FROM addresses with mobile
            numbers (page 1), then your filled equipment requisition form. Print the label at actual size and stick it on
            the parcel; sign the form and put it inside. Each new label replaces the previous one.
          </DialogDescription>
        </DialogHeader>
        {disabled ? (
          <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" data-testid="labels-disabled">
            The new labels are switched off at the moment. You can download the plain shipping label with the requisition form.
          </p>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="space-y-1">
              <Label htmlFor={`label-from-${bookingId}`}>Sender (printed small on the label)</Label>
              <Select value={choice} onValueChange={setChoice}>
                <SelectTrigger id={`label-from-${bookingId}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {addresses.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.label || a.recipient_name} — {a.line1}, {a.city} {a.postal_code}
                    </SelectItem>
                  ))}
                  <SelectItem value="new">A new address</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {choice === "new" ? (
              <>
                <AddressFields value={sender} onChange={setSender} idPrefix={`label-sender-${bookingId}`} />
                <p className="text-xs text-muted-foreground">Saved to your addresses and offered first next time.</p>
              </>
            ) : null}
            <div className="space-y-1">
              <Label htmlFor={`label-count-${bookingId}`}>Number of samples in the parcel</Label>
              <Input id={`label-count-${bookingId}`} type="number" min={1} max={500} className="w-28" value={count} onChange={(e) => setCount(e.target.value)} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          {disabled ? (
            <Button type="button" onClick={() => void plainLabel()} disabled={busy}>
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Download label and form
            </Button>
          ) : (
            <Button type="button" onClick={() => void download()} disabled={busy} data-testid="download-label">
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" /> : <Tag className="mr-1 h-4 w-4" aria-hidden="true" />}
              Download label and form
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

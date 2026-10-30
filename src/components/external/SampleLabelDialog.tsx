import { useEffect, useState } from "react";
import { Loader2, Tag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExternalBookingApiError, externalBookingApi, type PostalAddress } from "@/lib/externalBookingApi";
import { AddressFields } from "./ExternalInvoicePanel";

const EMPTY_ADDRESS: PostalAddress = { recipient_name: "", organisation: "", line1: "", line2: "", city: "", state: "", postal_code: "", country: "India", phone: "" };

/**
 * The booking's "Shipping label" action for external users: the QR-coded sample label (lab, addressed person, QR the
 * receiving office and lab scan). Asks only for the sender address and the number of samples; the sender of the
 * latest label is offered first (a newly typed one is saved to the address book by the server). When sample labels
 * are switched off the dialog says so and offers the previous label (no QR code) through ``onLegacy``.
 */
export function SampleLabelDialog({
  bookingId,
  open,
  onOpenChange,
  onLegacy,
}: {
  bookingId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLegacy: () => Promise<void> | void;
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
      await externalBookingApi.downloadSampleLabel(
        bookingId,
        choice === "new" ? { sample_count: n, description: "", sender } : { sample_count: n, description: "", address_id: Number(choice) },
      );
      toast.success("Label downloaded. Print it at actual size and stick it on the parcel.");
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

  const plainLabel = () => {
    onOpenChange(false);
    void onLegacy();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Shipping label</DialogTitle>
          <DialogDescription>
            A 10 × 4.5 inch label with the lab, the person it is addressed to and a QR code the receiving office scans.
            Print at actual size and keep the QR code visible. Each new label replaces the previous one.
          </DialogDescription>
        </DialogHeader>
        {disabled ? (
          <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" data-testid="labels-disabled">
            Labels with a QR code are switched off at the moment. You can download the plain shipping label (no QR code).
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
            <Button type="button" onClick={plainLabel}>
              Download plain label
            </Button>
          ) : (
            <Button type="button" onClick={() => void download()} disabled={busy} data-testid="download-label">
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" /> : <Tag className="mr-1 h-4 w-4" aria-hidden="true" />}
              Download label
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

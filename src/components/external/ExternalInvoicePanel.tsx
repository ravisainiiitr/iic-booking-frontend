import { useCallback, useEffect, useState } from "react";
import { FileDown, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  externalBookingApi,
  formatInstant,
  isValidIndianPin,
  type CopyRequest,
  type InvoiceStatus,
  type PostalAddress,
} from "@/lib/externalBookingApi";

const STAGE_LABEL: Record<InvoiceStatus["stage"], string> = {
  invoice_available: "Official GST invoice available",
  waiting_for_analysis: "Waiting for the analysis to be completed",
  not_requested: "No invoice requested yet",
  request_queued: "Invoice request queued for SRIC",
  with_sric: "Request sent to SRIC; the invoice is being prepared",
  action_required: "The accounts office is resolving a problem",
};

const EMPTY_ADDRESS: PostalAddress = { recipient_name: "", organisation: "", line1: "", line2: "", city: "", state: "", postal_code: "", country: "India", phone: "" };

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong. Try again.";
}

export function AddressFields({ value, onChange, idPrefix }: { value: PostalAddress; onChange: (a: PostalAddress) => void; idPrefix: string }) {
  const field = (key: keyof PostalAddress, label: string, required = false) => (
    <div>
      <Label htmlFor={`${idPrefix}-${key}`}>
        {label}
        {required ? " *" : ""}
      </Label>
      <Input
        id={`${idPrefix}-${key}`}
        value={String(value[key] ?? "")}
        required={required}
        onChange={(e) => onChange({ ...value, [key]: e.target.value })}
        aria-invalid={key === "postal_code" && value.postal_code !== "" && (value.country ?? "India").toLowerCase() === "india" && !isValidIndianPin(value.postal_code) ? true : undefined}
      />
    </div>
  );
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {field("recipient_name", "Recipient name", true)}
      {field("organisation", "Organisation / department")}
      {field("line1", "Address line 1", true)}
      {field("line2", "Address line 2")}
      {field("city", "City / town", true)}
      {field("state", "State", true)}
      {field("postal_code", "PIN code", true)}
      {field("country", "Country")}
      {field("phone", "Phone for delivery")}
    </div>
  );
}

export function ExternalInvoicePanel({ bookingId, initialStatus = null }: { bookingId: number; initialStatus?: InvoiceStatus | null }) {
  const [status, setStatus] = useState<InvoiceStatus | null>(initialStatus);
  const [hidden, setHidden] = useState(false);
  const [option, setOption] = useState<"after_analysis" | "early">(initialStatus?.preference?.option ?? "after_analysis");
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [addresses, setAddresses] = useState<PostalAddress[]>([]);
  const [copies, setCopies] = useState<CopyRequest[]>([]);
  const [addressChoice, setAddressChoice] = useState<string>("new");
  const [address, setAddress] = useState<PostalAddress>(EMPTY_ADDRESS);
  const [saveAddress, setSaveAddress] = useState(true);

  const load = useCallback(() => {
    externalBookingApi
      .invoice(bookingId)
      .then((s) => {
        setStatus(s);
        if (s.preference) setOption(s.preference.option);
      })
      .catch(() => setHidden(true));
    externalBookingApi.addresses().then((d) => setAddresses(d.addresses)).catch(() => setAddresses([]));
    externalBookingApi.myCopies().then((d) => setCopies(d.copies.filter((c) => c.booking_id === bookingId))).catch(() => setCopies([]));
  }, [bookingId]);
  useEffect(load, [load]);

  if (hidden || !status || !status.is_external) return null;

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(done);
      load();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const earlyPolicy = status.early_policy;
  const copy = copies.find((c) => c.status !== "cancelled");

  return (
    <section aria-labelledby={`invoice-${bookingId}`} className="space-y-3 text-sm" id="invoice">
      <h3 id={`invoice-${bookingId}`} className="sr-only">
        Invoices
      </h3>
      {!status.document ? (
        <Button type="button" variant="outline" size="sm" onClick={() => externalBookingApi.downloadProvisional(bookingId).catch((e) => toast.error(errorText(e)))}>
          <FileDown className="mr-1 h-4 w-4" aria-hidden="true" />
          Proforma invoice (not a GST tax invoice)
        </Button>
      ) : null}

      {status.enabled ? (
        <>
          <p aria-live="polite">
            <span className="font-medium">GST invoice:</span> {STAGE_LABEL[status.stage]}. {status.next_step}
            {status.request?.updated_at ? <span className="text-muted-foreground"> (updated {formatInstant(status.request.updated_at)})</span> : null}
          </p>
          {status.document ? (
            <Button type="button" size="sm" onClick={() => externalBookingApi.downloadInvoice(status.document!.id).catch((e) => toast.error(errorText(e)))}>
              <FileDown className="mr-1 h-4 w-4" aria-hidden="true" />
              Download the official GST invoice{status.document.invoice_number ? ` (${status.document.invoice_number})` : ""}
            </Button>
          ) : null}

          {!status.request ? (
            <fieldset className="space-y-2">
              <legend className="font-medium">When do you want the official GST invoice?</legend>
              <RadioGroup value={option} onValueChange={(v) => setOption(v as "after_analysis" | "early")}>
                <div className="flex items-center gap-2">
                  <RadioGroupItem id={`opt-after-${bookingId}`} value="after_analysis" />
                  <Label htmlFor={`opt-after-${bookingId}`}>After the analysis is completed (requested automatically)</Label>
                </div>
                {status.early_allowed ? (
                  <div className="flex items-center gap-2">
                    <RadioGroupItem id={`opt-early-${bookingId}`} value="early" />
                    <Label htmlFor={`opt-early-${bookingId}`}>Before the analysis is completed</Label>
                  </div>
                ) : null}
              </RadioGroup>
              {option === "early" && earlyPolicy ? (
                <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-2 dark:bg-amber-950">
                  <p className="whitespace-pre-line">{earlyPolicy.text}</p>
                  {!earlyPolicy.approved ? <p className="text-xs text-muted-foreground">This wording is awaiting approval by the SRIC / Institute finance office.</p> : null}
                  <div className="flex items-center gap-2">
                    <Checkbox id={`ack-early-${bookingId}`} checked={ack} onCheckedChange={(v) => setAck(v === true)} />
                    <Label htmlFor={`ack-early-${bookingId}`}>I have read and accept this condition.</Label>
                  </div>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy || (option === "early" && !ack)}
                  onClick={() => run(() => externalBookingApi.setInvoicePreference(bookingId, option, option === "early" ? earlyPolicy?.version : undefined), "Invoice preference saved.")}
                >
                  Save my choice
                </Button>
                {status.preference?.option === "early" && status.preference.acknowledged_at ? (
                  <Button type="button" size="sm" disabled={busy || !status.payment_realised} onClick={() => run(() => externalBookingApi.requestEarlyInvoice(bookingId), "Invoice request queued for SRIC.")}>
                    <Mail className="mr-1 h-4 w-4" aria-hidden="true" />
                    Request the GST invoice now
                  </Button>
                ) : null}
              </div>
              {status.preference ? <p className="text-xs text-muted-foreground">Your choice: {status.preference.label}.</p> : null}
            </fieldset>
          ) : null}

          {status.request ? (
            copy ? (
              <p>
                Printed copy: {copy.status_label}
                {copy.dispatch_date ? ` on ${copy.dispatch_date}` : ""}
                {copy.speed_post_reference ? ` (Speed Post ${copy.speed_post_reference})` : ""}.
              </p>
            ) : (
              <details>
                <summary className="cursor-pointer font-medium">Request a printed copy by Speed Post</summary>
                <div className="mt-2 space-y-2">
                  <Label htmlFor={`addr-${bookingId}`}>Deliver to</Label>
                  <Select value={addressChoice} onValueChange={setAddressChoice}>
                    <SelectTrigger id={`addr-${bookingId}`}>
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
                  {addressChoice === "new" ? (
                    <>
                      <AddressFields value={address} onChange={setAddress} idPrefix={`copy-${bookingId}`} />
                      <div className="flex items-center gap-2">
                        <Checkbox id={`save-${bookingId}`} checked={saveAddress} onCheckedChange={(v) => setSaveAddress(v === true)} />
                        <Label htmlFor={`save-${bookingId}`}>Save this address for next time</Label>
                      </div>
                    </>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () =>
                          externalBookingApi.requestCopy(
                            bookingId,
                            addressChoice === "new" ? { address, save_address: saveAddress } : { address_id: Number(addressChoice) },
                          ),
                        "Printed copy requested.",
                      )
                    }
                  >
                    {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                    Request printed copy
                  </Button>
                </div>
              </details>
            )
          ) : null}
        </>
      ) : null}
    </section>
  );
}

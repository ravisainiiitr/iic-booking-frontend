import { useId, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
  CourierTrackingApiError,
  courierTrackingApi,
  type Arrival,
  type ArrivalEligibility,
  type ArrivalInput,
  type ArrivalMode,
} from "@/lib/courierTrackingApi";

import { CourierCombobox } from "./CourierCombobox";
import { trackingNumberProblem, useCouriers } from "./courierHelpers";

type FieldErrors = Partial<Record<keyof ArrivalInput | "form", string>>;

export interface SampleArrivalFormProps {
  bookingId: number;
  eligibility: ArrivalEligibility;
  current?: Arrival | null;
  onSaved: (arrival: Arrival, message: string) => void;
  onCancel?: () => void;
}

export function SampleArrivalForm({ bookingId, eligibility, current, onSaved, onCancel }: SampleArrivalFormProps) {
  const ids = { mode: useId(), courier: useId(), courierLabel: useId(), number: useId(), numberHelp: useId() };
  const courierAllowed = eligibility.courier_allowed;
  const [mode, setMode] = useState<ArrivalMode>(
    current?.arrival_mode === "COURIER" && courierAllowed ? "COURIER" : courierAllowed ? eligibility.default_mode : "MANUAL",
  );
  const [courierSlug, setCourierSlug] = useState(current?.courier?.slug ?? "");
  const [trackingNumber, setTrackingNumber] = useState(current?.tracking_number ?? "");
  const [sampleIds, setSampleIds] = useState(current?.sample_identifiers ?? "");
  const [dispatchDate, setDispatchDate] = useState(current?.dispatch_date ?? "");
  const [expectedDate, setExpectedDate] = useState(current?.expected_arrival_date ?? "");
  const [notes, setNotes] = useState(current?.notes ?? "");
  const [emailUpdates, setEmailUpdates] = useState(current?.email_updates ?? true);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  // The courier list is loaded only when courier tracking can actually be used.
  const couriers = useCouriers(courierAllowed && mode === "COURIER");

  const courierValid = useMemo(
    () => !courierSlug || (couriers.couriers ?? []).some((c) => c.slug === courierSlug),
    [couriers.couriers, courierSlug],
  );

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (mode === "COURIER") {
      if (!courierSlug || !courierValid) next.courier_slug = "Choose a courier from the list.";
      const problem = trackingNumberProblem(courierSlug, trackingNumber);
      if (problem) next.tracking_number = problem;
      if (dispatchDate && expectedDate && expectedDate < dispatchDate) {
        next.expected_arrival_date = "The expected arrival date cannot be before the dispatch date.";
      }
    }
    return next;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;
    setSubmitting(true);
    try {
      const payload: ArrivalInput =
        mode === "COURIER"
          ? {
              arrival_mode: "COURIER",
              courier_slug: courierSlug,
              tracking_number: trackingNumber.trim(),
              sample_identifiers: sampleIds.trim(),
              dispatch_date: dispatchDate || null,
              expected_arrival_date: expectedDate || null,
              notes: notes.trim(),
              email_updates: emailUpdates,
            }
          : {
              arrival_mode: "MANUAL",
              sample_identifiers: sampleIds.trim(),
              expected_arrival_date: expectedDate || null,
              notes: notes.trim(),
            };
      const res = await courierTrackingApi.declareArrival(bookingId, payload);
      onSaved(res.arrival, res.message);
    } catch (err) {
      if (err instanceof CourierTrackingApiError) {
        const fieldErrors: FieldErrors = {};
        for (const [field, messages] of Object.entries(err.fields)) {
          fieldErrors[field as keyof ArrivalInput] = Array.isArray(messages) ? String(messages[0]) : String(messages);
        }
        setErrors({ ...fieldErrors, form: err.message });
      } else {
        setErrors({ form: "The details could not be saved. Please try again." });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate aria-busy={submitting}>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium" id={ids.mode}>
          How will the sample reach the lab?
        </legend>
        {courierAllowed ? (
          <RadioGroup
            value={mode}
            onValueChange={(v) => setMode(v as ArrivalMode)}
            aria-labelledby={ids.mode}
            className="grid gap-2 sm:grid-cols-2"
          >
            <Label className="flex cursor-pointer items-start gap-2 rounded-md border p-3 font-normal has-[:checked]:border-primary">
              <RadioGroupItem value="COURIER" className="mt-0.5" />
              <span>
                <span className="block font-medium">Courier / postal shipment</span>
                <span className="text-muted-foreground">We follow the tracking number for you.</span>
              </span>
            </Label>
            <Label className="flex cursor-pointer items-start gap-2 rounded-md border p-3 font-normal has-[:checked]:border-primary">
              <RadioGroupItem value="MANUAL" className="mt-0.5" />
              <span>
                <span className="block font-medium">Manual delivery</span>
                <span className="text-muted-foreground">You or a colleague will bring the sample.</span>
              </span>
            </Label>
          </RadioGroup>
        ) : (
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <p className="font-medium">Manual delivery</p>
            <p className="text-muted-foreground">{eligibility.courier_reason || "Bring the sample to the lab in person."}</p>
          </div>
        )}
      </fieldset>

      {mode === "COURIER" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label id={ids.courierLabel} htmlFor={ids.courier}>
              Courier <span aria-hidden="true">*</span>
            </Label>
            <CourierCombobox
              id={ids.courier}
              labelId={ids.courierLabel}
              value={courierSlug}
              onChange={(slug) => {
                setCourierSlug(slug);
                setErrors((e) => ({ ...e, courier_slug: undefined }));
              }}
              couriers={couriers.couriers}
              loading={couriers.loading}
              error={couriers.error}
              onRetry={couriers.retry}
              invalid={Boolean(errors.courier_slug)}
              describedBy={errors.courier_slug ? `${ids.courier}-error` : undefined}
            />
            {errors.courier_slug ? (
              <p id={`${ids.courier}-error`} className="text-sm text-destructive">
                {errors.courier_slug}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor={ids.number}>
              Tracking / AWB number <span aria-hidden="true">*</span>
            </Label>
            <Input
              id={ids.number}
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              autoComplete="off"
              inputMode="text"
              maxLength={64}
              aria-invalid={Boolean(errors.tracking_number) || undefined}
              aria-describedby={ids.numberHelp}
              className="font-mono"
            />
            <p id={ids.numberHelp} className={errors.tracking_number ? "text-sm text-destructive" : "text-xs text-muted-foreground"}>
              {errors.tracking_number || "Spaces are removed and letters capitalised automatically."}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${ids.number}-dispatch`}>Dispatch date (optional)</Label>
            <Input id={`${ids.number}-dispatch`} type="date" value={dispatchDate} onChange={(e) => setDispatchDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${ids.number}-expected`}>Expected arrival (optional)</Label>
            <Input
              id={`${ids.number}-expected`}
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
              aria-invalid={Boolean(errors.expected_arrival_date) || undefined}
            />
            {errors.expected_arrival_date ? <p className="text-sm text-destructive">{errors.expected_arrival_date}</p> : null}
          </div>
          <label className="flex items-start gap-2 text-sm sm:col-span-2">
            <Checkbox checked={emailUpdates} onCheckedChange={(v) => setEmailUpdates(v === true)} className="mt-0.5" />
            <span>Email me when the courier tracking status changes.</span>
          </label>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor={`${ids.number}-expected-manual`}>Expected arrival (optional)</Label>
          <Input
            id={`${ids.number}-expected-manual`}
            type="date"
            value={expectedDate}
            onChange={(e) => setExpectedDate(e.target.value)}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor={`${ids.number}-samples`}>Sample / reference identifiers (optional)</Label>
        <Input id={`${ids.number}-samples`} value={sampleIds} onChange={(e) => setSampleIds(e.target.value)} maxLength={2000} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${ids.number}-notes`}>Notes for the lab (optional)</Label>
        <Textarea id={`${ids.number}-notes`} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} rows={2} />
      </div>

      {errors.form ? (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {errors.form}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={submitting || (mode === "COURIER" && couriers.loading)}>
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {mode === "COURIER" ? "Register shipment" : "Confirm manual delivery"}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}

export default SampleArrivalForm;

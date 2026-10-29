import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock, FileDown, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHero, PageShell, StandaloneOnly } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SpecialRequestDraft } from "@/components/external/ExternalWindowNotice";
import {
  ExternalBookingApiError,
  externalBookingApi,
  formatInstant,
  isShortNotice,
  timeLeft,
  type SpecialPolicy,
  type SpecialPreview,
  type SpecialRequest,
  type SpecialRequestInput,
} from "@/lib/externalBookingApi";

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-900 border-amber-300",
  CLARIFICATION: "bg-sky-100 text-sky-900 border-sky-300",
  APPROVED: "bg-emerald-100 text-emerald-900 border-emerald-300",
  REJECTED: "bg-zinc-100 text-zinc-800 border-zinc-300",
  EXPIRED: "bg-zinc-100 text-zinc-800 border-zinc-300",
};

/** "2026-11-20T10:00" (a datetime-local value, IST wall clock) -> ISO with the +05:30 offset. */
export function localToIso(value: string): string {
  return value ? `${value}:00+05:30` : "";
}

function errorText(err: unknown): string {
  if (err instanceof ExternalBookingApiError) return err.message;
  return err instanceof Error ? err.message : "Something went wrong. Try again.";
}

/** Steps that apply to this request, in order, each marked done / current / upcoming. */
export function timelineSteps(r: SpecialRequest): Array<{ key: string; label: string; state: "done" | "current" | "upcoming" | "stopped"; detail?: string }> {
  const a = r.allocation;
  const steps: Array<{ key: string; label: string; state: "done" | "current" | "upcoming" | "stopped"; detail?: string }> = [
    { key: "submitted", label: "Request submitted", state: "done", detail: formatInstant(r.requested_at) },
  ];
  if (r.status === "CLARIFICATION") {
    steps.push({ key: "clarify", label: "Your reply is needed", state: "current", detail: r.clarification_message });
    return steps;
  }
  if (r.status === "PENDING") {
    steps.push({ key: "review", label: "Under review by the Officer in Charge", state: "current" });
    steps.push({ key: "allocated", label: "Slot assigned", state: "upcoming" });
    steps.push({ key: "paid", label: "Payment confirmed", state: "upcoming" });
    return steps;
  }
  if (r.status === "REJECTED") {
    steps.push({ key: "rejected", label: r.withdrawn_at ? "Withdrawn" : "Not approved", state: "stopped", detail: r.decision_note });
    return steps;
  }
  steps.push({ key: "review", label: "Approved", state: "done", detail: formatInstant(r.decided_at) });
  if (a) {
    steps.push({ key: "allocated", label: "Slot assigned", state: "done", detail: formatInstant(a.slot_start) });
    if (a.state === "awaiting_payment") {
      steps.push({ key: "deadline", label: `Pay by ${formatInstant(a.payment_deadline_at)}`, state: "current", detail: timeLeft(a.payment_deadline_at) });
    } else if (a.state === "paid") {
      steps.push({ key: "paid", label: "Payment confirmed — booking confirmed", state: "done", detail: formatInstant(a.paid_at) });
    } else {
      steps.push({ key: "expired", label: "Not paid in time — slot released", state: "stopped", detail: formatInstant(a.expired_at) });
    }
  }
  return steps;
}

function RequestDetail({ id, onChanged }: { id: number; onChanged: () => void }) {
  const [r, setR] = useState<SpecialRequest | null>(null);
  const [policy, setPolicy] = useState<SpecialPolicy | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [ackChecked, setAckChecked] = useState(false);

  const load = useCallback(() => {
    externalBookingApi.special(id).then(setR).catch((e) => toast.error(errorText(e)));
    externalBookingApi.specialPolicy().then(setPolicy).catch(() => setPolicy(null));
  }, [id]);
  useEffect(load, [load]);

  if (!r) return <p className="text-sm text-muted-foreground">Loading request…</p>;
  const a = r.allocation;
  const needsAck = Boolean(a && a.state === "awaiting_payment" && a.short_notice && !a.short_notice_acknowledged_at);

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(done);
      load();
      onChanged();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
          Special request #{r.id} · {r.equipment.name}
          <Badge variant="outline" className={STATUS_STYLE[r.status]}>
            {r.status_label}
          </Badge>
        </CardTitle>
        <CardDescription>
          Requested time (tentative): {formatInstant(r.preferred_start)} to {formatInstant(r.preferred_end)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <ol className="space-y-2" aria-label="Progress">
          {timelineSteps(r).map((s) => (
            <li key={s.key} className="flex gap-2">
              {s.state === "done" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" aria-hidden="true" />
              ) : s.state === "stopped" ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 text-zinc-500" aria-hidden="true" />
              ) : (
                <Clock className={`mt-0.5 h-4 w-4 ${s.state === "current" ? "text-amber-600" : "text-muted-foreground"}`} aria-hidden="true" />
              )}
              <div>
                <span className={s.state === "current" ? "font-semibold" : ""}>
                  {s.label}
                  <span className="sr-only"> ({s.state})</span>
                </span>
                {s.detail ? <div className="text-muted-foreground">{s.detail}</div> : null}
              </div>
            </li>
          ))}
        </ol>

        {r.estimated_total ? (
          <p>
            Estimated amount: <strong>₹{r.estimated_total}</strong> <span className="text-muted-foreground">(estimate; the final amount is set when a slot is allocated)</span>
          </p>
        ) : null}

        {r.status === "CLARIFICATION" ? (
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => externalBookingApi.respondSpecial(r.id, reply.trim()), "Reply sent.");
            }}
          >
            <p className="rounded-md border bg-sky-50 p-2 dark:bg-sky-950">
              <span className="font-medium">Question from the Officer in Charge:</span> {r.clarification_message}
            </p>
            <Label htmlFor="sr-reply">Your reply</Label>
            <Textarea id="sr-reply" value={reply} onChange={(e) => setReply(e.target.value)} maxLength={2000} required />
            <Button type="submit" disabled={busy || !reply.trim()}>
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Send reply
            </Button>
          </form>
        ) : null}

        {a && a.state === "awaiting_payment" ? (
          <div className="space-y-2 rounded-md border p-3">
            <p>
              Slot{a.slots.length > 1 ? "s" : ""}:{" "}
              {a.slots.map((s) => `${formatInstant(s.start)} – ${formatInstant(s.end)}`).join("; ")}
            </p>
            <p>
              Amount due: <strong>₹{a.amount_due}</strong>. Pay by <strong>{formatInstant(a.payment_deadline_at)}</strong>{" "}
              <span className="text-muted-foreground">({timeLeft(a.payment_deadline_at)})</span>. If payment is not realised by then the slot is released.
            </p>
            {needsAck && policy?.short_notice_policy ? (
              <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-2 dark:bg-amber-950">
                <p className="font-medium">Short-notice booking conditions</p>
                <p className="whitespace-pre-line">{policy.short_notice_policy.text}</p>
                {!policy.short_notice_policy.approved ? (
                  <p className="text-xs text-muted-foreground">This wording is awaiting approval by IIC administration.</p>
                ) : null}
                <div className="flex items-center gap-2">
                  <Checkbox id="sr-ack" checked={ackChecked} onCheckedChange={(v) => setAckChecked(v === true)} />
                  <Label htmlFor="sr-ack">I have read and understand these conditions.</Label>
                </div>
                <Button
                  type="button"
                  disabled={!ackChecked || busy}
                  onClick={() => run(() => externalBookingApi.acknowledgeShortNotice(r.id, policy.short_notice_policy!.version), "Conditions accepted.")}
                >
                  Accept conditions
                </Button>
              </div>
            ) : (
              <Button asChild>
                <Link to={`/bookings/${a.booking_id}/payment`}>Pay now</Link>
              </Button>
            )}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => externalBookingApi.downloadSpecialEstimate(r.id).catch((e) => toast.error(errorText(e)))}>
            <FileDown className="mr-1 h-4 w-4" aria-hidden="true" />
            Provisional estimate (not a GST invoice)
          </Button>
          {r.status === "PENDING" || r.status === "CLARIFICATION" ? (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => run(() => externalBookingApi.withdrawSpecial(r.id, ""), "Request withdrawn.")}>
              <Trash2 className="mr-1 h-4 w-4" aria-hidden="true" />
              Withdraw request
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function emptyAlternative() {
  return { start: "", end: "" };
}

export function NewSpecialRequestForm({ draft, policy, onCreated }: { draft: SpecialRequestDraft; policy: SpecialPolicy; onCreated: (r: SpecialRequest) => void }) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [alternatives, setAlternatives] = useState<Array<{ start: string; end: string }>>([]);
  const [samples, setSamples] = useState(String(draft.numberOfSamples ?? 1));
  const [description, setDescription] = useState("");
  const [remarks, setRemarks] = useState("");
  const [ack, setAck] = useState(false);
  const [preview, setPreview] = useState<SpecialPreview | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ field: string; message: string } | null>(null);

  const shortNotice = start ? isShortNotice(localToIso(start), policy.short_notice_days) : false;
  const ackPolicy = policy.short_notice_policy;

  const payload = (): SpecialRequestInput => ({
    equipment_id: draft.equipmentId,
    input_values: draft.inputValues,
    number_of_samples: Number(samples) || 0,
    preferred_start: localToIso(start),
    preferred_end: localToIso(end),
    alternatives: alternatives.filter((a) => a.start && a.end).map((a) => ({ start: localToIso(a.start), end: localToIso(a.end) })),
    sample_description: description.trim(),
    remarks: remarks.trim(),
    short_notice_ack_version: shortNotice && ack && ackPolicy ? ackPolicy.version : undefined,
  });

  const getEstimate = async () => {
    setError(null);
    try {
      setPreview(await externalBookingApi.previewSpecial(payload()));
    } catch (e) {
      const err = e as ExternalBookingApiError;
      setError({ field: err.field || "", message: errorText(e) });
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const created = await externalBookingApi.createSpecial(payload());
      toast.success("Special request submitted. It is not a confirmed booking yet.");
      onCreated(created);
    } catch (err) {
      const apiErr = err as ExternalBookingApiError;
      setError({ field: apiErr.field || "", message: errorText(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const fieldError = (name: string) =>
    error && error.field === name ? (
      <p id={`sr-${name}-error`} role="alert" className="text-sm text-destructive">
        {error.message}
      </p>
    ) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Request a Special Booking · {draft.equipmentName}</CardTitle>
        <CardDescription>{policy.notice}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit} noValidate>
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-1 text-sm font-medium">Preferred date and time (IST)</legend>
            <div>
              <Label htmlFor="sr-start">Start</Label>
              <Input id="sr-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required aria-describedby="sr-preferred_start-error" />
            </div>
            <div>
              <Label htmlFor="sr-end">End</Label>
              <Input id="sr-end" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} required />
            </div>
            <div className="sm:col-span-2">{fieldError("preferred_start")}</div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Alternative times (optional, up to 3)</legend>
            {alternatives.map((alt, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <Input aria-label={`Alternative ${i + 1} start`} type="datetime-local" value={alt.start} onChange={(e) => setAlternatives((xs) => xs.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} />
                <Input aria-label={`Alternative ${i + 1} end`} type="datetime-local" value={alt.end} onChange={(e) => setAlternatives((xs) => xs.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} />
                <Button type="button" variant="ghost" size="sm" onClick={() => setAlternatives((xs) => xs.filter((_, j) => j !== i))}>
                  Remove
                </Button>
              </div>
            ))}
            {alternatives.length < 3 ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setAlternatives((xs) => [...xs, emptyAlternative()])}>
                <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
                Add an alternative
              </Button>
            ) : null}
            {fieldError("alternatives")}
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
            <div>
              <Label htmlFor="sr-samples">Number of samples</Label>
              <Input id="sr-samples" type="number" min={1} max={1000} value={samples} onChange={(e) => setSamples(e.target.value)} />
              {fieldError("number_of_samples")}
            </div>
            <div>
              <Label htmlFor="sr-description">Sample details</Label>
              <Textarea id="sr-description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} required placeholder="Type of samples, size, handling needs" />
              {fieldError("sample_description")}
            </div>
          </div>
          <div>
            <Label htmlFor="sr-remarks">Remarks or reason for urgency (optional)</Label>
            <Textarea id="sr-remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={2000} />
          </div>
          {fieldError("input_values")}

          {shortNotice && ackPolicy ? (
            <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:bg-amber-950" role="region" aria-label="Short-notice booking conditions">
              <p className="font-medium">This time is less than {policy.short_notice_days} days away.</p>
              <p className="whitespace-pre-line">{ackPolicy.text}</p>
              {!ackPolicy.approved ? <p className="text-xs text-muted-foreground">This wording is awaiting approval by IIC administration.</p> : null}
              <div className="flex items-center gap-2">
                <Checkbox id="sr-ack-form" checked={ack} onCheckedChange={(v) => setAck(v === true)} />
                <Label htmlFor="sr-ack-form">I have read and understand these conditions.</Label>
              </div>
            </div>
          ) : null}

          {preview ? (
            <p className="rounded-md border p-2 text-sm">
              Estimated amount: <strong>₹{preview.quote.estimated_total}</strong> for about {preview.quote.required_minutes} minutes (estimate, not a final price).
            </p>
          ) : null}
          {error && !["preferred_start", "alternatives", "number_of_samples", "sample_description", "input_values"].includes(error.field) ? (
            <p role="alert" className="text-sm text-destructive">
              {error.message}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={getEstimate} disabled={!start || !end}>
              Show estimate
            </Button>
            <Button type="submit" disabled={submitting || !start || !end || !description.trim() || (shortNotice && !ack)}>
              {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Submit special request
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function ExternalSpecialRequests() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const isNew = location.pathname.endsWith("/new");
  const draft = (location.state as { draft?: SpecialRequestDraft } | null)?.draft ?? null;
  const [policy, setPolicy] = useState<SpecialPolicy | null>(null);
  const [requests, setRequests] = useState<SpecialRequest[] | null>(null);
  const selected = Number(params.get("request")) || null;

  const load = useCallback(() => {
    externalBookingApi.mySpecial().then((d) => setRequests(d.requests)).catch(() => setRequests([]));
  }, []);
  useEffect(() => {
    load();
    externalBookingApi.specialPolicy().then(setPolicy).catch(() => setPolicy(null));
  }, [load]);

  const list = useMemo(() => requests ?? [], [requests]);

  return (
    <PageShell>
      <main className="container mx-auto max-w-4xl space-y-4 px-4 py-5">
        <StandaloneOnly>
          <PageHero title="Special booking requests" description="Ask for analysis on a date outside the dates open for ordinary booking. A request is reviewed by the Officer in Charge; it is not a confirmed booking until a slot is allocated and paid." />
        </StandaloneOnly>
        {isNew ? (
          <>
            <Button variant="ghost" size="sm" onClick={() => navigate("/external-special-requests")}>
              <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" />
              My requests
            </Button>
            {!policy ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : !policy.available_to_you ? (
              <p className="rounded-md border p-4 text-sm">Special booking requests are not available for your account at the moment.</p>
            ) : !draft ? (
              <p className="rounded-md border p-4 text-sm">
                Start from the booking page: choose the equipment and fill in the booking details, then use “Request a Special Booking”.{" "}
                <Link className="underline" to="/book-equipment">
                  Go to booking
                </Link>
              </p>
            ) : (
              <NewSpecialRequestForm draft={draft} policy={policy} onCreated={(r) => navigate(`/external-special-requests?request=${r.id}`)} />
            )}
          </>
        ) : (
          <div className="grid gap-4 md:grid-cols-[260px_1fr]">
            <nav aria-label="My special requests" className="space-y-2">
              {requests === null ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
              {requests !== null && list.length === 0 ? <p className="text-sm text-muted-foreground">You have no special requests.</p> : null}
              {list.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setParams({ request: String(r.id) })}
                  aria-current={selected === r.id ? "true" : undefined}
                  className={`w-full rounded-md border p-2 text-left text-sm hover:bg-muted ${selected === r.id ? "border-primary" : ""}`}
                >
                  <div className="font-medium">
                    #{r.id} · {r.equipment.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {r.status_label} · {formatInstant(r.preferred_start)}
                  </div>
                </button>
              ))}
            </nav>
            <section aria-live="polite">{selected ? <RequestDetail id={selected} onChanged={load} /> : <p className="text-sm text-muted-foreground">Choose a request to see its progress.</p>}</section>
          </div>
        )}
      </main>
    </PageShell>
  );
}

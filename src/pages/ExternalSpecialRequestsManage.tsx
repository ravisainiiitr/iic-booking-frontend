import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHero, PageShell, StandaloneOnly } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ExternalBookingApiError,
  externalBookingApi,
  formatInstant,
  type CandidateSlot,
  type SpecialRequest,
} from "@/lib/externalBookingApi";

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong. Try again.";
}

function todayIst(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function StaffDetail({ id, onChanged }: { id: number; onChanged: () => void }) {
  const [r, setR] = useState<SpecialRequest | null>(null);
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [start, setStart] = useState(todayIst());
  const [slots, setSlots] = useState<CandidateSlot[] | null>(null);
  const [chosen, setChosen] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    externalBookingApi.staffSpecialDetail(id).then(setR).catch((e) => toast.error(errorText(e)));
  }, [id]);
  useEffect(() => {
    load();
    setSlots(null);
    setChosen([]);
  }, [load]);

  useEffect(() => {
    if (r?.preferred_start) setStart(r.preferred_start.slice(0, 10));
  }, [r?.preferred_start]);

  if (!r) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const open = r.status === "PENDING" || r.status === "CLARIFICATION";

  const act = async (fn: () => Promise<unknown>, done: string) => {
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

  const findSlots = async () => {
    try {
      const data = await externalBookingApi.candidateSlots(r.id, start, 7);
      setSlots(data.slots);
      setChosen([]);
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  const allocate = () =>
    act(async () => {
      try {
        await externalBookingApi.allocateSpecial(r.id, chosen, r.estimated_total, note.trim());
      } catch (e) {
        if (e instanceof ExternalBookingApiError && e.code === "amount_changed") load();
        throw e;
      }
    }, "Slot allocated. The user has been asked to pay by the deadline.");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
          #{r.id} · {r.equipment.name}
          <Badge variant="outline">{r.status_label}</Badge>
          {r.short_notice ? <Badge variant="outline">Short notice</Badge> : null}
        </CardTitle>
        <CardDescription>
          {r.user?.name} ({r.user?.email}) · requested {formatInstant(r.requested_at)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <dl className="grid gap-1 sm:grid-cols-[180px_1fr]">
          <dt className="font-medium">Preferred time</dt>
          <dd>
            {formatInstant(r.preferred_start)} – {formatInstant(r.preferred_end)}
          </dd>
          <dt className="font-medium">Alternatives</dt>
          <dd>{r.alternatives?.length ? r.alternatives.map((a) => `${formatInstant(a.start)} – ${formatInstant(a.end)}`).join("; ") : "None"}</dd>
          <dt className="font-medium">Samples</dt>
          <dd>
            {r.number_of_samples} · {r.sample_description}
          </dd>
          <dt className="font-medium">Required time</dt>
          <dd>
            {r.required_minutes} min ({r.required_slots} slot(s))
          </dd>
          <dt className="font-medium">Estimated amount</dt>
          <dd>₹{r.estimated_total}</dd>
          <dt className="font-medium">Remarks</dt>
          <dd>{r.remarks || "—"}</dd>
          {r.clarification_response ? (
            <>
              <dt className="font-medium">User's reply</dt>
              <dd>{r.clarification_response}</dd>
            </>
          ) : null}
        </dl>

        {r.allocation ? (
          <p className="rounded-md border p-2">
            Allocation: {r.allocation.state_label}. Payment deadline {formatInstant(r.allocation.payment_deadline_at)}.
          </p>
        ) : null}

        {open ? (
          <div className="space-y-3">
            <div className="space-y-2 rounded-md border p-3">
              <p className="font-medium">Allocate slots</p>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <Label htmlFor="ms-start">From date</Label>
                  <Input id="ms-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
                </div>
                <Button type="button" variant="outline" onClick={findSlots}>
                  Show slots
                </Button>
              </div>
              {slots ? (
                slots.length === 0 ? (
                  <p className="text-muted-foreground">No slots in those 7 days.</p>
                ) : (
                  <ul className="max-h-72 space-y-1 overflow-auto" aria-label="Candidate slots">
                    {slots.map((s) => {
                      const disabled = s.taken || s.past;
                      return (
                        <li key={s.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`slot-${s.id}`}
                            disabled={disabled}
                            checked={chosen.includes(s.id)}
                            onCheckedChange={(v) => setChosen((xs) => (v === true ? [...xs, s.id] : xs.filter((x) => x !== s.id)))}
                          />
                          <Label htmlFor={`slot-${s.id}`} className={disabled ? "text-muted-foreground" : ""}>
                            {formatInstant(s.start)} – {s.end ? new Date(s.end).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" }) : ""}
                            {s.taken ? " · booked" : s.past ? " · past" : ""}
                            {s.notes.length ? ` · ${s.notes.join(", ")}` : ""}
                          </Label>
                        </li>
                      );
                    })}
                  </ul>
                )
              ) : null}
              <Label htmlFor="ms-note">Note to the user (optional)</Label>
              <Textarea id="ms-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
              <Button type="button" disabled={busy || chosen.length === 0 || r.status !== "PENDING"} onClick={allocate}>
                {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                Approve and allocate {chosen.length ? `${chosen.length} slot(s)` : ""}
              </Button>
              {r.status !== "PENDING" ? <p className="text-xs text-muted-foreground">Waiting for the user's reply before allocation.</p> : null}
            </div>
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                void act(() => externalBookingApi.clarifySpecial(r.id, message.trim()), "Question sent to the user.");
              }}
            >
              <Label htmlFor="ms-question">Ask the user a question</Label>
              <Textarea id="ms-question" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} />
              <Button type="submit" variant="outline" disabled={busy || !message.trim()}>
                Request clarification
              </Button>
            </form>
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                void act(() => externalBookingApi.rejectSpecial(r.id, reason.trim()), "Request rejected.");
              }}
            >
              <Label htmlFor="ms-reason">Reason for rejection</Label>
              <Textarea id="ms-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={2000} />
              <Button type="submit" variant="destructive" disabled={busy || !reason.trim()}>
                Reject request
              </Button>
            </form>
          </div>
        ) : null}

        {r.history?.length ? (
          <div>
            <p className="font-medium">History</p>
            <ul className="space-y-1">
              {r.history.map((h, i) => (
                <li key={i}>
                  {formatInstant(h.at)} · {h.action_label}
                  {h.actor ? ` · ${h.actor}` : ""}
                  {h.reason ? ` — ${h.reason}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function ExternalSpecialRequestsManage() {
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState("PENDING,CLARIFICATION");
  const [rows, setRows] = useState<SpecialRequest[] | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const selected = Number(params.get("request")) || null;

  const load = useCallback(() => {
    externalBookingApi
      .staffSpecial(status === "all" ? "" : status)
      .then((d) => setRows(d.requests))
      .catch((e) => {
        if (e instanceof ExternalBookingApiError && e.status === 403) setForbidden(true);
        setRows([]);
      });
  }, [status]);
  useEffect(load, [load]);

  return (
    <PageShell>
      <main className="container mx-auto space-y-4 px-4 py-5">
        <StandaloneOnly>
          <PageHero title="External special requests" description="Review special booking requests from external users for equipment in your charge: ask questions, reject, or allocate a slot. The user then pays by the deadline or the slot is released." />
        </StandaloneOnly>
        {forbidden ? (
          <p className="rounded-md border p-4 text-sm">Only the Officer in Charge or the Main Administrator can review special requests.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            <div className="space-y-2">
              <Label htmlFor="ms-filter">Show</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="ms-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING,CLARIFICATION">Open</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED,EXPIRED">Closed</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
              {rows === null ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
              {rows?.length === 0 ? <p className="text-sm text-muted-foreground">No requests.</p> : null}
              <ul className="space-y-2" aria-label="Special requests">
                {rows?.map((r) => (
                  <li key={r.id}>
                    <button
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
                  </li>
                ))}
              </ul>
            </div>
            <section aria-live="polite">{selected ? <StaffDetail id={selected} onChanged={load} /> : <p className="text-sm text-muted-foreground">Choose a request.</p>}</section>
          </div>
        )}
      </main>
    </PageShell>
  );
}

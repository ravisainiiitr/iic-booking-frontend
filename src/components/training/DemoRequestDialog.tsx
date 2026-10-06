import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, History, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatINRAmount, formatINRWithPaise } from "@/lib/money";
import { reservationConflicts, trainingApi } from "@/lib/trainingApi";
import { WAIVER_REASON_MIN_CHARS } from "@/lib/trainingTypes";
import type {
  CurtailReasonCode,
  DemoDecisionInput,
  DemoQuote,
  DemoRequest,
  DemoRevision,
  ReservationConflict,
  TrainingUserRef,
} from "@/lib/trainingTypes";
import { cn } from "@/lib/utils";
import { FreeWindowFinder } from "./FreeWindowFinder";
import {
  CURTAIL_REASON_OPTIONS,
  estimateCharge,
  formatDateTime,
  formatDuration,
  formatWindow,
  fromLocalInputValue,
  humanizeCode,
  isCurtailed,
  parseRate,
  toLocalInputValue,
} from "./trainingHelpers";
import { ConflictList, DetailRow, PromptDialog, StatusChip, runTrainingAction } from "./trainingUi";
import { WindowsEditor, windowsToIso, type LocalWindow } from "./WindowsEditor";

export const CURTAILMENT_FINAL_NOTE = "Curtailment is final; the faculty member is notified.";

function personName(p: TrainingUserRef | string | null | undefined): string {
  if (!p) return "";
  return typeof p === "string" ? p : p.name || p.email || "";
}

function money(value: string | number | null | undefined): string {
  return formatINRWithPaise(value ?? 0);
}

function changedFields(rev: DemoRevision): Array<{ key: string; before: unknown; after: unknown }> {
  const before = rev.before ?? {};
  const after = rev.after ?? {};
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  return keys
    .filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
    .map((k) => ({ key: k, before: before[k], after: after[k] }));
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return formatDateTime(value);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function RevisionTimeline({ revisions }: { revisions: DemoRevision[] }) {
  if (!revisions.length) return <p className="text-sm text-muted-foreground">No history yet.</p>;
  return (
    <ol className="relative space-y-3 border-l border-border/70 pl-4">
      {revisions.map((rev, i) => {
        const changes = changedFields(rev);
        return (
          <li key={`${rev.created_at}-${i}`} className="relative">
            <span className="absolute -left-[1.3rem] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" aria-hidden />
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-sm font-medium">{humanizeCode(rev.action)}</span>
              {rev.to_status ? <StatusChip kind="demo" status={rev.to_status} /> : null}
              <span className="text-xs text-muted-foreground">
                {formatDateTime(rev.created_at)}
                {personName(rev.actor) ? ` · ${personName(rev.actor)}` : ""}
              </span>
            </div>
            {rev.reason_code || rev.reason ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {rev.reason_code ? <span className="font-medium">{humanizeCode(rev.reason_code)}: </span> : null}
                {rev.reason}
              </p>
            ) : null}
            {changes.length ? (
              <ul className="mt-1 space-y-0.5 text-xs">
                {changes.map((c) => (
                  <li key={c.key} className="text-muted-foreground">
                    <span className="font-medium text-foreground">{humanizeCode(c.key)}</span>: {displayValue(c.before)} →{" "}
                    {displayValue(c.after)}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

type DecideMode = "approve" | "curtail" | "propose" | "reject";

function DecidePanel({ request, onDone }: { request: DemoRequest; onDone: () => void }) {
  const [mode, setMode] = useState<DecideMode>("approve");
  const [duration, setDuration] = useState(String(request.requested_duration_minutes));
  const [participants, setParticipants] = useState(String(request.participants_requested));
  const [reasonCode, setReasonCode] = useState<CurtailReasonCode | "">("");
  const [remarks, setRemarks] = useState("");
  const [quote, setQuote] = useState<DemoQuote | null>(null);
  const [rate, setRate] = useState("");
  const [waive, setWaive] = useState(false);
  const [waiverReason, setWaiverReason] = useState("");
  const [scheduleNow, setScheduleNow] = useState(false);
  const [startLocal, setStartLocal] = useState("");
  const [busy, setBusy] = useState(false);
  const [conflicts, setConflicts] = useState<ReservationConflict[]>([]);

  const durationNum = Number(duration);
  const participantsNum = Number(participants);
  const curtailed =
    mode === "curtail" &&
    isCurtailed(
      { duration: request.requested_duration_minutes, participants: request.participants_requested },
      { duration: durationNum, participants: participantsNum },
    );
  const effectiveDuration = mode === "curtail" ? durationNum : request.requested_duration_minutes;
  const showCharge = mode !== "reject";
  const canWaive = showCharge && Boolean(quote?.chargeable);
  const waiving = canWaive && waive;
  const needsRate = Boolean(quote?.chargeable && !quote.rate_available) && !waiving;

  useEffect(() => {
    if (!showCharge || !Number.isInteger(effectiveDuration) || effectiveDuration <= 0) return;
    let alive = true;
    const handle = window.setTimeout(() => {
      void trainingApi
        .demoQuote(request.equipment.equipment_id, { purpose: request.purpose, minutes: effectiveDuration, request_id: request.id })
        .then((res) => {
          if (alive) setQuote(res.data ?? null);
        });
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(handle);
    };
  }, [showCharge, effectiveDuration, request.equipment.equipment_id, request.purpose, request.id]);

  const validate = (): string | null => {
    if (mode === "curtail") {
      if (!Number.isInteger(durationNum) || durationNum <= 0) return "Enter the approved duration in minutes.";
      if (durationNum > request.requested_duration_minutes) return "Approved duration cannot exceed the requested duration.";
      if (!Number.isInteger(participantsNum) || participantsNum <= 0) return "Enter the approved number of participants.";
      if (participantsNum > request.participants_requested) return "Approved participants cannot exceed the number requested.";
      if (curtailed && !reasonCode) return "Choose a reason for the curtailment.";
    }
    if (mode === "propose" && !fromLocalInputValue(startLocal)) return "Choose the proposed start time.";
    if (mode === "reject" && !remarks.trim()) return "Remarks are required to reject a request.";
    if ((mode === "approve" || mode === "curtail") && scheduleNow && !fromLocalInputValue(startLocal)) return "Choose a start time or untick “Schedule now”.";
    if (showCharge && needsRate && parseRate(rate) <= 0) return "Enter the hourly rate to charge.";
    if (waiving && waiverReason.trim().length < WAIVER_REASON_MIN_CHARS)
      return `Give a reason of at least ${WAIVER_REASON_MIN_CHARS} characters for waiving the charge.`;
    return null;
  };

  const submit = async () => {
    const problem = validate();
    if (problem) {
      toast.error(problem);
      return;
    }
    const input: DemoDecisionInput = { action: mode === "curtail" ? "approve" : mode };
    if (mode === "approve") {
      input.approved_duration_minutes = request.requested_duration_minutes;
      input.approved_participants = request.participants_requested;
    }
    if (mode === "curtail") {
      input.approved_duration_minutes = durationNum;
      input.approved_participants = participantsNum;
      if (curtailed && reasonCode) input.reason_code = reasonCode;
    }
    if (remarks.trim()) input.remarks = remarks.trim();
    if (showCharge && needsRate) input.rate_per_hour = String(rate);
    if (waiving) {
      input.waive_charge = true;
      input.waiver_reason = waiverReason.trim();
    }
    if (mode === "propose" || ((mode === "approve" || mode === "curtail") && scheduleNow)) {
      input.start_at = fromLocalInputValue(startLocal);
    }
    setBusy(true);
    setConflicts([]);
    const res = await runTrainingAction(
      trainingApi.decideDemo(request.id, input),
      mode === "reject" ? "Request rejected." : mode === "propose" ? "Alternative time proposed." : "Request approved.",
    );
    setBusy(false);
    if (res.error) {
      setConflicts(reservationConflicts(res));
      return;
    }
    onDone();
  };

  const modes: Array<{ value: DecideMode; label: string }> = [
    { value: "approve", label: "Approve as requested" },
    { value: "curtail", label: "Approve with changes" },
    { value: "propose", label: "Propose another time" },
    { value: "reject", label: "Reject" },
  ];

  return (
    <div className="space-y-3 rounded-lg border border-primary/25 bg-primary/[0.03] p-3 dark:border-primary/40">
      <p className="text-sm font-semibold">Decision</p>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Decision">
        {modes.map((m) => (
          <Button
            key={m.value}
            type="button"
            size="sm"
            role="radio"
            aria-checked={mode === m.value}
            variant={mode === m.value ? (m.value === "reject" ? "destructive" : "default") : "outline"}
            onClick={() => setMode(m.value)}
            className="h-8"
          >
            {m.label}
          </Button>
        ))}
      </div>

      {mode === "curtail" ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="decide-duration">Approved duration (minutes)</Label>
              <Input
                id="decide-duration"
                type="number"
                min={1}
                max={request.requested_duration_minutes}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Requested {formatDuration(request.requested_duration_minutes)}</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="decide-participants">Approved participants</Label>
              <Input
                id="decide-participants"
                type="number"
                min={1}
                max={request.participants_requested}
                value={participants}
                onChange={(e) => setParticipants(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Requested {request.participants_requested}</p>
            </div>
          </div>
          {curtailed ? (
            <>
              <div className="space-y-1">
                <Label>
                  Reason for curtailment <span className="text-destructive">*</span>
                </Label>
                <Select value={reasonCode} onValueChange={(v) => setReasonCode(v as CurtailReasonCode)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {CURTAIL_REASON_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="flex items-start gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                {CURTAILMENT_FINAL_NOTE}
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Same as requested — lower a number to curtail.</p>
          )}
        </div>
      ) : null}

      {mode === "propose" ? (
        <div className="space-y-2">
          <Label htmlFor="decide-propose-start">
            Proposed start <span className="text-destructive">*</span>
          </Label>
          <Input id="decide-propose-start" type="datetime-local" value={startLocal} onChange={(e) => setStartLocal(e.target.value)} className="sm:w-auto" />
          <FreeWindowFinder
            compact
            equipmentId={request.equipment.equipment_id}
            durationMinutes={request.requested_duration_minutes}
            onPick={(start) => setStartLocal(toLocalInputValue(start))}
          />
        </div>
      ) : null}

      {showCharge ? (
        <div className="space-y-1 rounded-md border border-border/70 px-3 py-2 text-sm" data-testid="decide-charge">
          {!quote ? (
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Working out the charge…
            </span>
          ) : !quote.chargeable && quote.rate_available ? (
            <p className="text-muted-foreground">
              {request.purpose === "COURSE" && quote.course_demos_free
                ? "Course / curricular demonstration — free of charge (Training Policy setting)."
                : "No charge for this demonstration."}
            </p>
          ) : waiving ? (
            <p>
              <span className="font-medium">Charge waived</span>{" "}
              <span className="text-muted-foreground">
                {quote.rate_available && quote.amount ? `(${formatINRAmount(quote.amount)} not deducted). ` : ""}The faculty member sees your
                name and reason.
              </span>
            </p>
          ) : needsRate ? (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{quote.basis} Enter the hourly rate to charge the faculty member's wallet.</p>
              <Label htmlFor="decide-rate">Rate per hour (₹)</Label>
              <Input id="decide-rate" type="number" min={0} step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} className="sm:w-48" />
              <p className="text-xs text-muted-foreground">
                Estimated {money(estimateCharge(rate, effectiveDuration))} for {formatDuration(effectiveDuration)}
              </p>
            </div>
          ) : (
            <p>
              <span className="font-medium">Charge on approval: {formatINRAmount(quote.amount)}</span>{" "}
              <span className="text-muted-foreground">
                (internal IITR rate {formatINRAmount(quote.rate_per_hour)}/h × {formatDuration(effectiveDuration)}), deducted from the faculty
                member's {quote.wallet_label}.
              </span>
            </p>
          )}
          {quote?.balance_error && !waiving ? (
            <p className="flex items-start gap-1.5 text-xs font-medium text-destructive" role="alert">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {quote.balance_error} Approval will fail until they recharge.
            </p>
          ) : null}
          {canWaive ? (
            <div className="space-y-1.5 border-t border-border/60 pt-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={waive} onCheckedChange={(v) => setWaive(v === true)} />
                Waive demonstration charge
              </label>
              {waive ? (
                <div className="space-y-1">
                  <Label htmlFor="decide-waiver-reason">
                    Reason for waiving <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="decide-waiver-reason"
                    rows={2}
                    value={waiverReason}
                    onChange={(e) => setWaiverReason(e.target.value)}
                    placeholder={`At least ${WAIVER_REASON_MIN_CHARS} characters — shown to the faculty member and kept in the audit log`}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {mode === "approve" || mode === "curtail" ? (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={scheduleNow} onCheckedChange={(v) => setScheduleNow(v === true)} />
            Schedule now (reserves instrument slots)
          </label>
          {scheduleNow ? (
            <>
              <Input type="datetime-local" value={startLocal} onChange={(e) => setStartLocal(e.target.value)} className="sm:w-auto" aria-label="Start time" />
              <FreeWindowFinder
                compact
                equipmentId={request.equipment.equipment_id}
                durationMinutes={effectiveDuration}
                onPick={(start) => setStartLocal(toLocalInputValue(start))}
              />
            </>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-1">
        <Label htmlFor="decide-remarks">
          Remarks{mode === "reject" ? <span className="text-destructive"> *</span> : <span className="text-muted-foreground"> (optional)</span>}
        </Label>
        <Textarea id="decide-remarks" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      </div>

      <ConflictList conflicts={conflicts} />

      <div className="flex justify-end">
        <Button type="button" onClick={() => void submit()} disabled={busy} variant={mode === "reject" ? "destructive" : "default"}>
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          {modes.find((m) => m.value === mode)?.label}
        </Button>
      </div>
    </div>
  );
}

function SchedulePanel({ request, onDone }: { request: DemoRequest; onDone: () => void }) {
  const [startLocal, setStartLocal] = useState(toLocalInputValue(request.approved_start_at));
  const [busy, setBusy] = useState(false);
  const [conflicts, setConflicts] = useState<ReservationConflict[]>([]);
  const duration = request.approved_duration_minutes ?? request.requested_duration_minutes;
  const rescheduling = request.status === "SCHEDULED";

  const submit = async () => {
    const iso = fromLocalInputValue(startLocal);
    if (!iso) {
      toast.error("Choose a start time.");
      return;
    }
    setBusy(true);
    setConflicts([]);
    const res = await runTrainingAction(trainingApi.scheduleDemo(request.id, iso), rescheduling ? "Demonstration rescheduled." : "Demonstration scheduled.");
    setBusy(false);
    if (res.error) {
      setConflicts(reservationConflicts(res));
      return;
    }
    onDone();
  };

  return (
    <div className="space-y-2 rounded-lg border border-border/70 p-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <CalendarClock className="h-4 w-4" aria-hidden /> {rescheduling ? "Reschedule" : "Schedule"} ({formatDuration(duration)})
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Input type="datetime-local" value={startLocal} onChange={(e) => setStartLocal(e.target.value)} className="sm:w-auto" aria-label="Start time" />
        <Button type="button" size="sm" onClick={() => void submit()} disabled={busy}>
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          {rescheduling ? "Reschedule" : "Schedule & reserve slots"}
        </Button>
      </div>
      <FreeWindowFinder
        compact
        equipmentId={request.equipment.equipment_id}
        durationMinutes={duration}
        onPick={(start) => setStartLocal(toLocalInputValue(start))}
      />
      <ConflictList conflicts={conflicts} />
    </div>
  );
}

function AttendancePanel({ request, onDone }: { request: DemoRequest; onDone: () => void }) {
  const participants = request.participants ?? [];
  const [count, setCount] = useState(String(request.attended_count ?? request.approved_participants ?? request.participants_requested));
  const [present, setPresent] = useState<number[]>(participants.map((p) => p.id));
  const [busy, setBusy] = useState<"attendance" | "complete" | null>(null);
  const [noShowOpen, setNoShowOpen] = useState(false);

  const attended = participants.length ? present.length : Number(count);

  const saveAttendance = async () => {
    setBusy("attendance");
    const res = await runTrainingAction(
      trainingApi.demoAttendance(request.id, participants.length ? { present_user_ids: present, attended_count: present.length } : { attended_count: Number(count) }),
      "Attendance saved.",
    );
    setBusy(null);
    if (!res.error) onDone();
  };

  const complete = async () => {
    setBusy("complete");
    const res = await runTrainingAction(trainingApi.completeDemo(request.id, { attended_count: attended }), "Demonstration marked completed.");
    setBusy(null);
    if (!res.error) onDone();
  };

  return (
    <div className="space-y-2 rounded-lg border border-border/70 p-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <Users className="h-4 w-4" aria-hidden /> Attendance
      </p>
      {participants.length ? (
        <ul className="grid gap-1 sm:grid-cols-2">
          {participants.map((p) => (
            <li key={p.id}>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={present.includes(p.id)}
                  disabled={!request.permissions.attendance}
                  onCheckedChange={(v) => setPresent((prev) => (v === true ? [...prev, p.id] : prev.filter((id) => id !== p.id)))}
                />
                <span className="truncate">{p.name}</span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex items-center gap-2">
          <Label htmlFor="demo-attended" className="text-sm">
            Attended
          </Label>
          <Input
            id="demo-attended"
            type="number"
            min={0}
            value={count}
            disabled={!request.permissions.attendance}
            onChange={(e) => setCount(e.target.value)}
            className="h-8 w-24"
          />
        </div>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        {request.permissions.attendance ? (
          <Button type="button" size="sm" variant="outline" onClick={() => void saveAttendance()} disabled={busy !== null}>
            {busy === "attendance" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Save attendance
          </Button>
        ) : null}
        {request.permissions.complete ? (
          <>
            <Button type="button" size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setNoShowOpen(true)} disabled={busy !== null}>
              Mark no-show
            </Button>
            <Button type="button" size="sm" onClick={() => void complete()} disabled={busy !== null}>
              {busy === "complete" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
              Mark completed
            </Button>
          </>
        ) : null}
      </div>
      <PromptDialog
        open={noShowOpen}
        onOpenChange={setNoShowOpen}
        title="Mark as no-show?"
        description="Use this when the requesting group did not turn up. The faculty member is notified."
        label=""
        required={false}
        confirmLabel="Mark no-show"
        destructive
        onConfirm={async () => {
          const res = await runTrainingAction(trainingApi.completeDemo(request.id, { no_show: true }), "Marked as no-show.");
          if (res.error) return false;
          onDone();
          return true;
        }}
      />
    </div>
  );
}

function RespondPanel({ request, onDone }: { request: DemoRequest; onDone: () => void }) {
  const [counterOpen, setCounterOpen] = useState(false);
  const [windows, setWindows] = useState<LocalWindow[]>([{ start: "", end: "" }]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const canCounter = request.permissions.counter && !request.counter_used;

  const send = async (response: "accept" | "counter", extra: { windows?: Array<{ start: string; end: string }>; note?: string } = {}) => {
    setBusy(true);
    const res = await runTrainingAction(
      trainingApi.respondDemo(request.id, { response, ...extra }),
      response === "accept" ? "Proposed time accepted." : "Counter-proposal sent.",
    );
    setBusy(false);
    if (!res.error) onDone();
  };

  const sendCounter = () => {
    const { windows: iso, error } = windowsToIso(windows);
    if (error) {
      toast.error(error);
      return;
    }
    void send("counter", { windows: iso, note: note.trim() || undefined });
  };

  return (
    <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50/60 p-3 dark:border-amber-800 dark:bg-amber-950/30">
      <p className="text-sm font-semibold">The OIC proposed another time</p>
      <p className="text-sm">{formatWindow(request.proposed_start_at, request.proposed_end_at)}</p>
      {request.proposal_expires_at ? (
        <p className="text-xs text-muted-foreground">Respond by {formatDateTime(request.proposal_expires_at)}</p>
      ) : null}
      {request.oic_remarks ? <p className="text-xs text-muted-foreground">OIC remarks: {request.oic_remarks}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => void send("accept")} disabled={busy}>
          Accept this time
        </Button>
        {canCounter ? (
          <Button type="button" size="sm" variant="outline" onClick={() => setCounterOpen((v) => !v)} disabled={busy}>
            Suggest other times
          </Button>
        ) : null}
        <Button type="button" size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setDeclineOpen(true)} disabled={busy}>
          Decline
        </Button>
      </div>
      {request.counter_used ? <p className="text-xs text-muted-foreground">You have already used your one counter-proposal.</p> : null}
      {counterOpen && canCounter ? (
        <div className="space-y-2 border-t border-amber-300/60 pt-2 dark:border-amber-800/60">
          <p className="text-xs text-muted-foreground">You can counter once. Give up to 3 windows that suit you.</p>
          <WindowsEditor
            value={windows}
            onChange={setWindows}
            equipmentId={request.equipment.equipment_id}
            durationMinutes={request.approved_duration_minutes ?? request.requested_duration_minutes}
          />
          <Textarea rows={2} placeholder="Note for the OIC (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex justify-end">
            <Button type="button" size="sm" onClick={sendCounter} disabled={busy}>
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Send counter-proposal
            </Button>
          </div>
        </div>
      ) : null}
      <PromptDialog
        open={declineOpen}
        onOpenChange={setDeclineOpen}
        title="Decline the proposed time?"
        description="The request will be closed. You can submit a new request later."
        label="Note"
        required={false}
        confirmLabel="Decline"
        destructive
        onConfirm={async (text) => {
          const res = await runTrainingAction(trainingApi.respondDemo(request.id, { response: "decline", note: text || undefined }), "Proposal declined.");
          if (res.error) return false;
          onDone();
          return true;
        }}
      />
    </div>
  );
}

type Props = {
  requestId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
};

/** Demo request detail with revision history; the actions shown come from `permissions`. */
export function DemoRequestDialog({ requestId, open, onOpenChange, onChanged }: Props) {
  const [request, setRequest] = useState<DemoRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [waiveOpen, setWaiveOpen] = useState(false);

  const load = useCallback(async () => {
    if (!requestId) return;
    setLoading(true);
    setError(null);
    const res = await trainingApi.demoRequest(requestId);
    setLoading(false);
    if (res.error || !res.data) {
      setError(res.error || "Could not load the request.");
      return;
    }
    setRequest(res.data);
  }, [requestId]);

  useEffect(() => {
    if (!open || !requestId) return;
    setRequest(null);
    void load();
  }, [open, requestId, load]);

  const refresh = useCallback(() => {
    void load();
    onChanged?.();
  }, [load, onChanged]);

  const perms = request?.permissions;
  const showAttendance = Boolean(perms?.attendance || perms?.complete);
  const chargeText = useMemo(() => {
    if (!request) return "";
    if (request.charge_text) return request.charge_text;
    if (request.charge_mode === "FREE") return "Free";
    if (!request.charge_mode) return request.rate_per_hour ? `${money(request.rate_per_hour)}/h (to be confirmed)` : "To be decided by the OIC";
    const parts = [`${money(request.rate_per_hour)}/h`];
    if (request.charge_amount) parts.push(`${request.charged ? "charged" : "estimated"} ${money(request.charge_amount)}`);
    if (request.refund_amount && parseRate(request.refund_amount) > 0) parts.push(`refunded ${money(request.refund_amount)}`);
    return parts.join(" · ");
  }, [request]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 pr-6">
            Demo request {request?.reference ?? ""}
            {request ? <StatusChip kind="demo" status={request.status} label={request.status_label} /> : null}
            {request?.sla_escalated ? (
              <span className="rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
                Review overdue
              </span>
            ) : null}
          </DialogTitle>
          <DialogDescription>
            {request ? `${request.equipment.name} (${request.equipment.code}) · ${request.requester.name}` : "Demonstration request details"}
          </DialogDescription>
        </DialogHeader>

        {loading && !request ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : error && !request ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : request ? (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              <DetailRow label="Purpose">{request.purpose_label || humanizeCode(request.purpose)}</DetailRow>
              <DetailRow label="Course">
                {[request.course_code, request.course_name].filter(Boolean).join(" — ") || "—"}
              </DetailRow>
              <DetailRow label="Requested">
                {formatDuration(request.requested_duration_minutes)} · {request.participants_requested} participant
                {request.participants_requested === 1 ? "" : "s"}
              </DetailRow>
              {request.approved_duration_minutes != null || request.approved_participants != null ? (
                <DetailRow label="Approved">
                  <span className={cn(request.curtailed && "font-medium text-amber-800 dark:text-amber-200")}>
                    {formatDuration(request.approved_duration_minutes)} · {request.approved_participants ?? "—"} participants
                  </span>
                  {request.curtailed ? (
                    <span className="block text-xs text-muted-foreground">
                      Curtailed{request.curtail_reason_label ? `: ${request.curtail_reason_label}` : ""}
                    </span>
                  ) : null}
                </DetailRow>
              ) : null}
              {request.approved_start_at ? (
                <DetailRow label="Scheduled for">{formatWindow(request.approved_start_at, request.approved_end_at)}</DetailRow>
              ) : null}
              <DetailRow label="Charge">{chargeText}</DetailRow>
              <DetailRow label="Submitted">{formatDateTime(request.submitted_at)}</DetailRow>
              {request.decided_at ? (
                <DetailRow label="Decided">
                  {formatDateTime(request.decided_at)}
                  {personName(request.decided_by) ? ` · ${personName(request.decided_by)}` : ""}
                </DetailRow>
              ) : null}
              {request.attended_count != null ? <DetailRow label="Attended">{request.attended_count}</DetailRow> : null}
            </dl>

            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Preferred windows</p>
              <ul className="space-y-0.5 text-sm">
                {(request.preferred_windows ?? []).map((w, i) => (
                  <li key={`${w.start}-${i}`}>{formatWindow(w.start, w.end)}</li>
                ))}
                {!request.preferred_windows?.length ? <li className="text-muted-foreground">—</li> : null}
              </ul>
            </div>

            {request.notes ? (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <p className="mb-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">Notes</p>
                <p className="whitespace-pre-wrap">{request.notes}</p>
              </div>
            ) : null}
            {request.oic_remarks && request.status !== "PROPOSED_ALTERNATIVE" ? (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <p className="mb-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">OIC remarks</p>
                <p className="whitespace-pre-wrap">{request.oic_remarks}</p>
              </div>
            ) : null}
            {request.cancel_reason ? (
              <p className="text-sm text-muted-foreground">
                Cancelled{request.cancelled_by_side ? ` by ${humanizeCode(request.cancelled_by_side).toLowerCase()}` : ""}: {request.cancel_reason}
              </p>
            ) : null}

            {request.participants?.length || request.participant_list_text ? (
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Participants</p>
                {request.participants?.length ? (
                  <p className="text-sm">{request.participants.map((p) => p.name).join(", ")}</p>
                ) : null}
                {request.participant_list_text ? (
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{request.participant_list_text}</p>
                ) : null}
              </div>
            ) : null}

            {perms?.respond ? <RespondPanel request={request} onDone={refresh} /> : null}
            {perms?.decide ? <DecidePanel key={`decide-${request.id}-${request.status}`} request={request} onDone={refresh} /> : null}
            {perms?.schedule ? <SchedulePanel key={`schedule-${request.id}-${request.approved_start_at}`} request={request} onDone={refresh} /> : null}
            {showAttendance ? <AttendancePanel key={`attendance-${request.id}-${request.status}`} request={request} onDone={refresh} /> : null}

            {perms?.withdraw || perms?.cancel || perms?.waive ? (
              <div className="flex flex-wrap justify-end gap-2">
                {perms.waive ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => setWaiveOpen(true)}>
                    Waive charge
                  </Button>
                ) : null}
                {perms.withdraw ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => setWithdrawOpen(true)}>
                    Withdraw request
                  </Button>
                ) : null}
                {perms.cancel ? (
                  <Button type="button" variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setCancelOpen(true)}>
                    Cancel demonstration
                  </Button>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-2 border-t pt-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <History className="h-4 w-4" aria-hidden /> History
              </p>
              <RevisionTimeline revisions={request.revisions ?? []} />
            </div>
          </div>
        ) : null}

        {request ? (
          <>
            <PromptDialog
              open={withdrawOpen}
              onOpenChange={setWithdrawOpen}
              title="Withdraw this request?"
              required={false}
              confirmLabel="Withdraw"
              destructive
              onConfirm={async (text) => {
                const res = await runTrainingAction(trainingApi.withdrawDemo(request.id, text || undefined), "Request withdrawn.");
                if (res.error) return false;
                refresh();
                return true;
              }}
            />
            <PromptDialog
              open={cancelOpen}
              onOpenChange={setCancelOpen}
              title="Cancel this demonstration?"
              description="Reserved instrument slots are released. Any wallet charge is refunded per the demonstration refund policy: full or half refund depending on how far ahead you cancel (cancellations by IIC are refunded in full)."
              confirmLabel="Cancel demonstration"
              destructive
              onConfirm={async (text) => {
                const res = await runTrainingAction(trainingApi.cancelDemo(request.id, text), "Demonstration cancelled.");
                if (res.error) return false;
                refresh();
                return true;
              }}
            />
            <PromptDialog
              open={waiveOpen}
              onOpenChange={setWaiveOpen}
              title="Waive the demonstration charge?"
              description={
                request.charged
                  ? `The ${money(request.charge_amount)} already deducted is refunded in full to the faculty member's wallet. They see your name and reason; the waiver is kept in the audit log.`
                  : `The ${money(request.charge_amount)} charge will not be deducted. The faculty member sees your name and reason; the waiver is kept in the audit log.`
              }
              label="Reason for waiving"
              placeholder={`At least ${WAIVER_REASON_MIN_CHARS} characters`}
              minLength={WAIVER_REASON_MIN_CHARS}
              confirmLabel="Waive charge"
              onConfirm={async (text) => {
                const res = await runTrainingAction(trainingApi.waiveDemoCharge(request.id, text), "Charge waived.");
                if (res.error) return false;
                refresh();
                return true;
              }}
            />
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

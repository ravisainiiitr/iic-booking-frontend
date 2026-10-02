import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Download,
  Flag,
  Gavel,
  Loader2,
  Megaphone,
  Play,
  Plus,
  Send,
  ShieldCheck,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trainingApi } from "@/lib/trainingApi";
import type {
  AppealRow,
  Nomination,
  NominationCall,
  OverrideOutcome,
  PublishedResults,
  RunVerification,
  ShortlistEntry,
  ShortlistRun,
  TrainingEquipmentRef,
} from "@/lib/trainingTypes";
import { cn } from "@/lib/utils";
import { EquipmentPicker } from "./EquipmentPicker";
import { ScoreBreakdown } from "./ScoreBreakdown";
import { deadlineCountdown, formatDateTime, formatScore, fromLocalInputValue, humanizeCode } from "./trainingHelpers";
import { DetailRow, EmptyState, LoadingBlock, PromptDialog, SectionCard, StatusChip, runTrainingAction } from "./trainingUi";

function OpenCallDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: (call: NominationCall) => void }) {
  const [equipment, setEquipment] = useState<TrainingEquipmentRef | null>(null);
  const [seats, setSeats] = useState("6");
  const [deadline, setDeadline] = useState("");
  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEquipment(null);
    setSeats("6");
    setDeadline("");
    setTitle("");
    setVenue("");
    setDescription("");
    setNotes("");
  }, [open]);

  const submit = async () => {
    const seatsNum = Number(seats);
    const deadlineIso = fromLocalInputValue(deadline);
    if (!equipment) return toast.error("Choose the equipment.");
    if (!Number.isInteger(seatsNum) || seatsNum <= 0) return toast.error("Enter the number of seats.");
    if (!deadlineIso || new Date(deadlineIso).getTime() <= Date.now()) return toast.error("Choose a nomination deadline in the future.");
    setBusy(true);
    const res = await runTrainingAction(
      trainingApi.createCall({
        equipment_id: equipment.equipment_id,
        seats: seatsNum,
        deadline: deadlineIso,
        title: title.trim() || undefined,
        venue: venue.trim() || undefined,
        description: description.trim() || undefined,
        notes: notes.trim() || undefined,
      }),
      "Nomination call opened. Faculty can now nominate students.",
    );
    setBusy(false);
    if (res.data) {
      onCreated(res.data);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Open a nomination call</DialogTitle>
          <DialogDescription>Creates a hands-on training event; faculty nominate students until the deadline.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>
              Equipment <span className="text-destructive">*</span>
            </Label>
            <EquipmentPicker managed value={equipment} onChange={setEquipment} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="call-seats">
                Seats <span className="text-destructive">*</span>
              </Label>
              <Input id="call-seats" type="number" min={1} value={seats} onChange={(e) => setSeats(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="call-deadline">
                Nomination deadline <span className="text-destructive">*</span>
              </Label>
              <Input id="call-deadline" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="call-title">Title</Label>
            <Input id="call-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Defaults to “Hands-on training: <equipment>”" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="call-venue">Venue</Label>
            <Input id="call-venue" value={venue} onChange={(e) => setVenue(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="call-description">Description</Label>
            <Textarea id="call-description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="call-notes">Notes for faculty</Label>
            <Textarea id="call-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Close
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={busy}>
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Megaphone className="mr-1.5 h-4 w-4" />}
            Open call
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OverrideDialog({
  entry,
  onClose,
  onUpdated,
}: {
  entry: ShortlistEntry | null;
  onClose: () => void;
  onUpdated: (run: ShortlistRun) => void;
}) {
  const [outcome, setOutcome] = useState<OverrideOutcome>("SELECTED");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!entry) return;
    setOutcome(entry.overridden ? "CLEAR" : "SELECTED");
    setReason("");
  }, [entry]);

  const submit = async () => {
    if (!entry) return;
    if (!reason.trim()) return toast.error("A reason is required for an override.");
    setBusy(true);
    const res = await runTrainingAction(trainingApi.overrideEntry(entry.entry_id, outcome, reason.trim()), "Override saved on the preview.");
    setBusy(false);
    if (res.data) {
      onUpdated(res.data);
      onClose();
    }
  };

  return (
    <Dialog open={Boolean(entry)} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Override outcome</DialogTitle>
          <DialogDescription>
            {entry?.student.name} — currently {entry?.outcome_label || humanizeCode(entry?.outcome)}. Overrides are recorded with your reason and shown in
            the published ranking.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>New outcome</Label>
            <Select value={outcome} onValueChange={(v) => setOutcome(v as OverrideOutcome)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SELECTED">Selected</SelectItem>
                <SelectItem value="WAITLISTED">Waitlisted</SelectItem>
                <SelectItem value="NOT_SELECTED">Not selected</SelectItem>
                {entry?.overridden ? <SelectItem value="CLEAR">Clear override (use computed outcome)</SelectItem> : null}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="override-reason">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea id="override-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Close
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={busy || !reason.trim()}>
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Save override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AppealDecisionDialog({ appeal, onClose, onDone }: { appeal: AppealRow | null; onClose: () => void; onDone: () => void }) {
  const [decision, setDecision] = useState<"UPHELD" | "OVERTURNED">("UPHELD");
  return (
    <PromptDialog
      open={Boolean(appeal)}
      onOpenChange={(open) => !open && onClose()}
      title="Decide appeal"
      description={
        appeal ? (
          <>
            {appeal.student.name} · {appeal.call.reference}
            <span className="mt-1 block whitespace-pre-wrap text-foreground">“{appeal.reason}”</span>
          </>
        ) : null
      }
      label="Decision note"
      confirmLabel={decision === "OVERTURNED" ? "Overturn (select student)" : "Uphold result"}
      onConfirm={async (note) => {
        if (!appeal) return true;
        const res = await runTrainingAction(trainingApi.decideAppeal(appeal.id, decision, note), "Appeal decided.");
        if (res.error) return false;
        onDone();
        return true;
      }}
    >
      <div className="space-y-1">
        <Label>Decision</Label>
        <Select value={decision} onValueChange={(v) => setDecision(v as "UPHELD" | "OVERTURNED")}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="UPHELD">Uphold — the published result stands</SelectItem>
            <SelectItem value="OVERTURNED">Overturn — select the student</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </PromptDialog>
  );
}

function RankedTable({
  run,
  onOverride,
}: {
  run: ShortlistRun;
  onOverride?: (entry: ShortlistEntry) => void;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const entries = useMemo(
    () => [...run.entries].sort((a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER)),
    [run.entries],
  );
  if (!entries.length) return <p className="text-sm text-muted-foreground">No nominations in this run.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-border/70">
      <Table className="min-w-[760px]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">Rank</TableHead>
            <TableHead>Student</TableHead>
            <TableHead className="hidden md:table-cell">Nominator</TableHead>
            <TableHead className="text-right">Score</TableHead>
            <TableHead>Outcome</TableHead>
            <TableHead>Seat</TableHead>
            <TableHead className="hidden lg:table-cell">Tie group</TableHead>
            <TableHead>Flags</TableHead>
            {onOverride ? <TableHead className="w-24" /> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((e) => {
            const open = expanded === e.entry_id;
            const flags = [...(e.flags ?? []), ...(e.ineligible_reasons ?? [])];
            return (
              <Fragment key={e.entry_id}>
                <TableRow className={cn(open && "border-b-0")}>
                  <TableCell className="font-semibold tabular-nums">{e.rank ?? "—"}</TableCell>
                  <TableCell>
                    <p className="font-medium">{e.student.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.department_name}
                      {e.need_category ? ` · ${humanizeCode(e.need_category)}` : ""}
                    </p>
                  </TableCell>
                  <TableCell className="hidden text-sm md:table-cell">{e.nominator?.name ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <button
                      type="button"
                      onClick={() => setExpanded(open ? null : e.entry_id)}
                      className="inline-flex items-center gap-1 font-semibold tabular-nums text-primary hover:underline dark:text-sky-300"
                      aria-expanded={open}
                    >
                      {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      {formatScore(e.score_total)}
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      <StatusChip kind="outcome" status={e.outcome} label={e.outcome_label} />
                      {e.waitlist_position ? <span className="text-xs text-muted-foreground">#{e.waitlist_position}</span> : null}
                      {e.overridden ? (
                        <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800 dark:bg-violet-950 dark:text-violet-200" title={e.override_reason ?? undefined}>
                          Override
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">{e.seat_type ? humanizeCode(e.seat_type) : "—"}</TableCell>
                  <TableCell className="hidden text-xs lg:table-cell">{e.tie_group ?? "—"}</TableCell>
                  <TableCell>
                    {flags.length ? (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-800 dark:text-amber-200" title={flags.map(humanizeCode).join(", ")}>
                        <Flag className="h-3 w-3" aria-hidden /> {flags.length}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  {onOverride ? (
                    <TableCell>
                      <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onOverride(e)}>
                        Override
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
                {open ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={onOverride ? 9 : 8} className="bg-muted/20 pt-0">
                      <div className="space-y-2 py-2">
                        <ScoreBreakdown breakdown={e.score_breakdown} total={e.score_total} />
                        {flags.length ? (
                          <p className="text-xs text-amber-800 dark:text-amber-200">Flags: {flags.map(humanizeCode).join(", ")}</p>
                        ) : null}
                        {e.override_reason ? <p className="text-xs text-muted-foreground">Override reason: {e.override_reason}</p> : null}
                        {e.note ? <p className="text-xs text-muted-foreground">Note: {e.note}</p> : null}
                        {e.justification ? <p className="whitespace-pre-wrap text-xs text-muted-foreground">Justification: {e.justification}</p> : null}
                        {e.lottery_key ? <p className="font-mono text-[11px] text-muted-foreground">Lottery key: {e.lottery_key}</p> : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function CallDetail({ callId, onBack }: { callId: number; onBack: () => void }) {
  const [call, setCall] = useState<NominationCall | null>(null);
  const [nominations, setNominations] = useState<Nomination[] | null>(null);
  const [run, setRun] = useState<ShortlistRun | null>(null);
  const [results, setResults] = useState<PublishedResults | null>(null);
  const [appeals, setAppeals] = useState<AppealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [publicInput, setPublicInput] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [verification, setVerification] = useState<RunVerification | null>(null);
  const [stalePreview, setStalePreview] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [overrideEntry, setOverrideEntry] = useState<ShortlistEntry | null>(null);
  const [appealToDecide, setAppealToDecide] = useState<AppealRow | null>(null);
  const [adjustFor, setAdjustFor] = useState<Nomination | null>(null);
  const [adjustPoints, setAdjustPoints] = useState("0");
  const [tab, setTab] = useState("nominations");

  const load = useCallback(async () => {
    setLoading(true);
    const [callRes, nomRes, runRes, appealRes] = await Promise.all([
      trainingApi.call(callId),
      trainingApi.callNominations(callId),
      trainingApi.callShortlist(callId),
      trainingApi.appeals({ status: "PENDING" }),
    ]);
    setLoading(false);
    if (callRes.error || !callRes.data) {
      toast.error(callRes.error || "Could not load the call.");
      return;
    }
    setCall(callRes.data);
    setNominations(nomRes.data?.results ?? []);
    setRun(runRes.data?.run ?? null);
    setAppeals((appealRes.data?.results ?? []).filter((a) => a.call?.id === callId));
    if (callRes.data.published_run_id || callRes.data.status === "PUBLISHED") {
      const r = await trainingApi.callResults(callId);
      setResults(r.data ?? null);
    } else {
      setResults(null);
    }
  }, [callId]);

  useEffect(() => {
    void load();
  }, [load]);

  const runPreview = async () => {
    setBusy("preview");
    setVerification(null);
    const res = await runTrainingAction(trainingApi.runShortlist(callId, publicInput.trim() || undefined), "Preview ranking computed.");
    setBusy(null);
    if (res.data) {
      setRun(res.data);
      setStalePreview(false);
      setTab("shortlist");
    }
  };

  const publish = async (input: string) => {
    if (!run) return false;
    const res = await trainingApi.publishRun(run.id, input);
    if (res.error) {
      toast.error(res.error);
      if (res.code === "stale_preview") setStalePreview(true);
      return false;
    }
    toast.success("Results published. Students and nominators are notified.");
    void load();
    setTab("results");
    return true;
  };

  const exportCsv = async () => {
    if (!run) return;
    setBusy("export");
    const res = await trainingApi.exportRun(run.id);
    setBusy(null);
    if (res.error) toast.error(res.error);
  };

  const verify = async () => {
    if (!run) return;
    setBusy("verify");
    const res = await runTrainingAction(trainingApi.verifyRun(run.id));
    setBusy(null);
    if (res.data) setVerification(res.data);
  };

  if (loading && !call) return <LoadingBlock />;
  if (!call) {
    return (
      <div className="space-y-3">
        <Button type="button" variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> All calls
        </Button>
        <EmptyState title="Call not found" />
      </div>
    );
  }

  const deadlinePassed = new Date(call.deadline).getTime() <= Date.now();
  const isDraft = run?.status === "DRAFT";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> All calls
        </Button>
        {call.can_manage && call.status === "OPEN" ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setCloseOpen(true)}>
            <Lock className="mr-1.5 h-4 w-4" /> Close call
          </Button>
        ) : null}
      </div>

      <SectionCard
        title={
          <span className="flex flex-wrap items-center gap-2">
            {call.reference} · {call.title}
            <StatusChip kind="call" status={call.status} label={call.status_label} />
          </span>
        }
        description={`${call.equipment.name} (${call.equipment.code})`}
      >
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <DetailRow label="Seats">{call.seats}</DetailRow>
          <DetailRow label="Deadline">
            {formatDateTime(call.deadline)}
            {call.status === "OPEN" ? <span className="block text-xs text-muted-foreground">{deadlineCountdown(call.deadline)}</span> : null}
          </DetailRow>
          <DetailRow label="Nominations">
            {call.nominations_count} ({call.confirmed_interest_count} confirmed interest)
          </DetailRow>
          <DetailRow label="Policy">
            v{call.policy_version ?? "—"}
            <span className="block text-xs text-muted-foreground">
              Faculty cap {call.caps?.per_faculty_cap ?? "—"} · dept {call.caps?.per_department_pct ?? "—"}% · reserved {call.caps?.reserved_pct ?? "—"}%
            </span>
          </DetailRow>
          {call.appeal_deadline ? <DetailRow label="Appeals until">{formatDateTime(call.appeal_deadline)}</DetailRow> : null}
          {call.notes ? (
            <div className="col-span-2 sm:col-span-4">
              <DetailRow label="Notes">{call.notes}</DetailRow>
            </div>
          ) : null}
        </dl>
      </SectionCard>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="nominations">Nominations ({nominations?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="shortlist">Shortlist</TabsTrigger>
          <TabsTrigger value="results" disabled={!results}>
            Published ranking
          </TabsTrigger>
          <TabsTrigger value="appeals">Appeals{appeals.length ? ` (${appeals.length})` : ""}</TabsTrigger>
        </TabsList>

        <TabsContent value="nominations" className="mt-3">
          {!nominations?.length ? (
            <EmptyState title="No nominations yet" description="Faculty nominations appear here as they come in." />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/70">
              <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Nominator</TableHead>
                    <TableHead>Need</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden lg:table-cell">Justification</TableHead>
                    <TableHead>Flags</TableHead>
                    {call.can_manage ? <TableHead className="w-28" /> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nominations.map((n) => (
                    <TableRow key={n.id}>
                      <TableCell>
                        <p className="font-medium">{n.student.name}</p>
                        <p className="text-xs text-muted-foreground">{n.student.department ?? n.student.email}</p>
                      </TableCell>
                      <TableCell className="text-sm">{n.nominator?.name ?? "—"}</TableCell>
                      <TableCell className="text-sm">
                        {n.need_category_label || humanizeCode(n.need_category)}
                        {n.expected_hours_month ? <span className="block text-xs text-muted-foreground">{n.expected_hours_month} h/month</span> : null}
                        {n.need_adjustment ? (
                          <span className="block text-xs text-violet-700 dark:text-violet-300" title={n.need_adjust_reason ?? undefined}>
                            Adjusted +{n.need_adjustment}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <StatusChip kind="nomination" status={n.status} label={n.status_label} />
                        {n.ineligible_reason ? <p className="mt-0.5 text-xs text-muted-foreground">{n.ineligible_reason}</p> : null}
                      </TableCell>
                      <TableCell className="hidden max-w-xs lg:table-cell">
                        <p className="line-clamp-2 text-xs text-muted-foreground" title={n.justification}>
                          {n.justification}
                        </p>
                      </TableCell>
                      <TableCell className="text-xs">{n.flags?.length ? n.flags.map(humanizeCode).join(", ") : "—"}</TableCell>
                      {call.can_manage ? (
                        <TableCell>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => {
                              setAdjustPoints(String(n.need_adjustment ?? 0));
                              setAdjustFor(n);
                            }}
                          >
                            Adjust need
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="shortlist" className="mt-3 space-y-3">
          {call.can_manage && call.status !== "PUBLISHED" && call.status !== "CANCELLED" ? (
            <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border/70 bg-muted/20 p-3">
              <div className="space-y-1">
                <Label htmlFor="shortlist-public" className="text-xs">
                  Public number (optional for preview)
                </Label>
                <Input id="shortlist-public" value={publicInput} onChange={(e) => setPublicInput(e.target.value)} className="h-9 w-56" placeholder="e.g. today's Sensex close" />
              </div>
              <Button type="button" size="sm" className="h-9" onClick={() => void runPreview()} disabled={busy !== null}>
                {busy === "preview" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Play className="mr-1.5 h-4 w-4" />}
                {run ? "Re-run preview" : "Run preview"}
              </Button>
              {!deadlinePassed && call.status === "OPEN" ? (
                <p className="w-full text-xs text-muted-foreground">
                  Nominations are still open. You can preview now; publishing needs the call closed (or the deadline passed) and a fresh preview.
                </p>
              ) : null}
            </div>
          ) : null}

          {stalePreview ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              The preview is older than the call’s closing. Re-run the preview, check it, then publish.
              <Button type="button" size="sm" variant="outline" onClick={() => void runPreview()} disabled={busy !== null}>
                Re-run preview
              </Button>
            </div>
          ) : null}

          {!run ? (
            <EmptyState title="No ranking yet" description="Run a preview to compute the ranking from the published policy." />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <StatusChip kind="run" status={run.status} />
                <span>Run {formatDateTime(run.run_at)}</span>
                <span>{run.seats} seats</span>
                {run.seed_public_input ? <span>Public number: {run.seed_public_input}</span> : null}
                {run.seed ? <span className="font-mono">Seed {run.seed.slice(0, 16)}…</span> : null}
                {run.underrepresented_departments?.length ? <span>Under-represented: {run.underrepresented_departments.join(", ")}</span> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {isDraft && call.can_manage ? (
                  <Button type="button" size="sm" onClick={() => setPublishOpen(true)} disabled={busy !== null}>
                    <Send className="mr-1.5 h-4 w-4" /> Publish results
                  </Button>
                ) : null}
                <Button type="button" size="sm" variant="outline" onClick={() => void exportCsv()} disabled={busy !== null}>
                  {busy === "export" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
                  Export CSV
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => void verify()} disabled={busy !== null}>
                  {busy === "verify" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-1.5 h-4 w-4" />}
                  Verify reproducibility
                </Button>
              </div>
              {verification ? (
                <div
                  className={cn(
                    "rounded-lg border p-3 text-sm",
                    verification.reproducible
                      ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100"
                      : "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100",
                  )}
                >
                  {verification.reproducible
                    ? "Re-running with the same inputs and seed gives the same ranking."
                    : `Ranking differs on re-run${verification.mismatched_nomination_ids.length ? ` (nominations ${verification.mismatched_nomination_ids.join(", ")})` : ""}.`}
                  {!verification.seed_matches ? " The seed does not match the recorded inputs." : ""}
                </div>
              ) : null}
              <RankedTable run={run} onOverride={isDraft && call.can_manage ? setOverrideEntry : undefined} />
            </>
          )}
        </TabsContent>

        <TabsContent value="results" className="mt-3 space-y-2">
          {results ? (
            <>
              <p className="text-xs text-muted-foreground">
                Published {formatDateTime(results.published_at)}
                {results.appeal_deadline ? ` · appeals until ${formatDateTime(results.appeal_deadline)}` : ""}
                {results.seed_public_input ? ` · public number ${results.seed_public_input}` : ""}
              </p>
              <div className="overflow-x-auto rounded-lg border border-border/70">
                <Table className="min-w-[600px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Rank</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                      <TableHead>Outcome</TableHead>
                      <TableHead>Seat</TableHead>
                      <TableHead>Tie group</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.entries.map((e, i) => (
                      <TableRow key={`${e.rank}-${i}`}>
                        <TableCell className="font-semibold tabular-nums">{e.rank ?? "—"}</TableCell>
                        <TableCell>
                          <p className="font-medium">{e.student_name}</p>
                          <p className="text-xs text-muted-foreground">{e.department_name}</p>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatScore(e.score_total)}</TableCell>
                        <TableCell>
                          <StatusChip kind="outcome" status={e.outcome} label={e.outcome_label} />
                          {e.waitlist_position ? <span className="ml-1 text-xs text-muted-foreground">#{e.waitlist_position}</span> : null}
                          {e.overridden ? <span className="ml-1 text-[10px] font-semibold text-violet-700 dark:text-violet-300">Override</span> : null}
                        </TableCell>
                        <TableCell className="text-xs">{e.seat_type ? humanizeCode(e.seat_type) : "—"}</TableCell>
                        <TableCell className="text-xs">{e.tie_group ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <EmptyState title="Not published yet" />
          )}
        </TabsContent>

        <TabsContent value="appeals" className="mt-3">
          {!appeals.length ? (
            <EmptyState icon={<Gavel className="h-8 w-8" />} title="No pending appeals" />
          ) : (
            <ul className="space-y-2">
              {appeals.map((a) => (
                <li key={a.id} className="rounded-lg border border-border/70 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {a.student.name}
                        {a.entry?.rank ? <span className="text-xs text-muted-foreground"> · rank {a.entry.rank}</span> : null}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Filed {formatDateTime(a.created_at)}
                        {a.submitted_by?.name ? ` by ${a.submitted_by.name}` : ""}
                      </p>
                    </div>
                    {a.can_decide ? (
                      <Button type="button" size="sm" onClick={() => setAppealToDecide(a)}>
                        <Gavel className="mr-1.5 h-4 w-4" /> Decide
                      </Button>
                    ) : (
                      <StatusChip kind="appeal" status={a.status} />
                    )}
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm">{a.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      <PromptDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        title="Publish results"
        description="Enter the public number used to seed the tie-break lottery (e.g. a published index value announced in advance). The ranking becomes final for this call and everyone is notified; appeals open after publishing."
        label="Public number"
        placeholder="e.g. 81234.56"
        confirmLabel="Publish"
        onConfirm={(text) => publish(text)}
      />
      <PromptDialog
        open={closeOpen}
        onOpenChange={setCloseOpen}
        title="Close this call?"
        description="No more nominations will be accepted. Re-run the preview after closing before you publish."
        label=""
        required={false}
        confirmLabel="Close call"
        onConfirm={async () => {
          const res = await runTrainingAction(trainingApi.closeCall(call.id), "Call closed.");
          if (res.error) return false;
          void load();
          return true;
        }}
      />
      <PromptDialog
        open={Boolean(adjustFor)}
        onOpenChange={(open) => !open && setAdjustFor(null)}
        title="Adjust research need"
        description={adjustFor ? `${adjustFor.student.name} — add 0–3 points to the research-need factor.` : undefined}
        confirmLabel="Save adjustment"
        onConfirm={async (reason) => {
          if (!adjustFor) return true;
          const res = await runTrainingAction(trainingApi.adjustNeed(adjustFor.id, Number(adjustPoints), reason), "Need adjustment saved.");
          if (res.error) return false;
          void load();
          return true;
        }}
      >
        <div className="space-y-1">
          <Label>Points</Label>
          <Select value={adjustPoints} onValueChange={setAdjustPoints}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[0, 1, 2, 3].map((p) => (
                <SelectItem key={p} value={String(p)}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </PromptDialog>
      <OverrideDialog entry={overrideEntry} onClose={() => setOverrideEntry(null)} onUpdated={setRun} />
      <AppealDecisionDialog appeal={appealToDecide} onClose={() => setAppealToDecide(null)} onDone={() => void load()} />
    </div>
  );
}

const CALL_FILTERS = [
  { value: "all", label: "All calls" },
  { value: "OPEN", label: "Open" },
  { value: "CLOSED", label: "Closed" },
  { value: "PUBLISHED", label: "Published" },
  { value: "CANCELLED", label: "Cancelled" },
];

/** OIC: nomination calls they manage, with the shortlist / publish workflow. */
export function CallsPanel({ callId, onCallChange }: { callId: number | null; onCallChange: (id: number | null) => void }) {
  const [calls, setCalls] = useState<NominationCall[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("all");
  const [openDialog, setOpenDialog] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await trainingApi.calls({ scope: "manage", status: status === "all" ? undefined : status });
    setLoading(false);
    if (res.error) {
      toast.error(res.error);
      setCalls([]);
      return;
    }
    setCalls(res.data?.results ?? []);
  }, [status]);

  useEffect(() => {
    if (callId == null) void load();
  }, [load, callId]);

  if (callId != null) return <CallDetail callId={callId} onBack={() => onCallChange(null)} />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CALL_FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" size="sm" className="ml-auto h-9" onClick={() => setOpenDialog(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Open a call
        </Button>
      </div>

      {loading && !calls ? (
        <LoadingBlock />
      ) : !calls?.length ? (
        <EmptyState icon={<Megaphone className="h-8 w-8" />} title="No nomination calls" description="Open a call to invite faculty to nominate students for hands-on training." />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {calls.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onCallChange(c.id)}
                className="w-full rounded-xl border border-border/70 bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-muted-foreground">{c.reference}</p>
                    <p className="truncate font-medium">{c.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.equipment.name} ({c.equipment.code})
                    </p>
                  </div>
                  <StatusChip kind="call" status={c.status} label={c.status_label} />
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span>{c.seats} seats</span>
                  <span>{c.nominations_count} nominations</span>
                  <span>Deadline {formatDateTime(c.deadline)}</span>
                  {c.status === "OPEN" ? <span className="font-medium text-foreground">{deadlineCountdown(c.deadline)}</span> : null}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <OpenCallDialog open={openDialog} onOpenChange={setOpenDialog} onCreated={(c) => onCallChange(c.id)} />
    </div>
  );
}

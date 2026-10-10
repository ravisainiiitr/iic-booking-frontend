import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarCheck2, CheckCircle2, ClipboardList, LogIn, LogOut, Timer, UserCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AllocationDialog } from "@/components/training/duty/AllocationDialog";
import { AllocationsTable } from "@/components/training/duty/AllocationsPanel";
import { HoursTiles, PeriodSelect, StatementView } from "@/components/training/duty/HoursPanel";
import { academicYearChoices, formatHours, minutesToHours, periodQuery } from "@/components/training/dutyHelpers";
import { deadlineCountdown, formatDate, formatDateTime, formatWindow } from "@/components/training/trainingHelpers";
import { EmptyState, LoadingBlock, ModuleUnavailable, PromptDialog, SectionCard, StatusChip, TrainingPageFrame, runTrainingAction } from "@/components/training/trainingUi";
import { useTrainingAvailability } from "@/components/training/useTrainingAvailability";
import { trainingApi } from "@/lib/trainingApi";
import type { DutyAllocation, DutyStatement, MyDuty as MyDutyData } from "@/lib/trainingOpsTypes";

function PendingCard({ alloc, onChanged, onOpen }: { alloc: DutyAllocation; onChanged: () => void; onOpen: () => void }) {
  const [busy, setBusy] = useState(false);
  const [declining, setDeclining] = useState(false);
  const confirm = async () => {
    setBusy(true);
    const res = await runTrainingAction(trainingApi.dutyAction(alloc.id, "confirm"), "Duty confirmed — thank you");
    setBusy(false);
    if (!res.error) onChanged();
  };
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50/60 p-4 dark:border-amber-800 dark:bg-amber-950/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{alloc.title || alloc.equipment.name}</p>
          <p className="text-sm text-muted-foreground">
            {alloc.equipment.name} · {formatHours(minutesToHours(alloc.planned_minutes))} in {alloc.shift_count} shift(s)
          </p>
          <p className="text-sm">{alloc.first_start ? formatWindow(alloc.first_start, alloc.last_end) : null}</p>
          {alloc.note ? <p className="mt-1 text-sm italic">“{alloc.note}”</p> : null}
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
            Please answer by {formatDateTime(alloc.confirm_by)} ({deadlineCountdown(alloc.confirm_by)}). Unanswered duty is released to the next operator.
          </p>
          <button type="button" className="mt-1 text-xs text-primary hover:underline" onClick={onOpen}>
            See every shift
          </button>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => setDeclining(true)} disabled={busy}>
            <XCircle className="mr-1.5 h-4 w-4" /> Decline
          </Button>
          <Button type="button" onClick={() => void confirm()} disabled={busy}>
            <CheckCircle2 className="mr-1.5 h-4 w-4" /> Confirm
          </Button>
        </div>
      </div>
      <PromptDialog
        open={declining}
        onOpenChange={setDeclining}
        title="Decline this duty?"
        description="The OIC is told straight away so the slot can go to someone else. Declining does not count against you."
        confirmLabel="Decline"
        destructive
        onConfirm={async (reason) => {
          const res = await runTrainingAction(trainingApi.dutyAction(alloc.id, "decline", reason), "Duty declined");
          if (res.error) return false;
          onChanged();
          return true;
        }}
      />
    </div>
  );
}

export default function MyDuty() {
  const { loading: bootLoading, menu } = useTrainingAvailability();
  const allowed = menu("my_duty");
  const [params, setParams] = useSearchParams();
  const allocationParam = Number(params.get("allocation")) || null;
  const [data, setData] = useState<MyDutyData | null>(null);
  const [period, setPeriod] = useState(() => `ay:${academicYearChoices(1)[0]}`);
  const [statement, setStatement] = useState<DutyStatement | null>(null);
  const [showStatement, setShowStatement] = useState(false);
  const [busyShift, setBusyShift] = useState<number | null>(null);

  const load = useCallback(async () => {
    const res = await trainingApi.myDuty();
    if (res.error) toast.error(res.error);
    setData(res.data ?? null);
  }, []);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  useEffect(() => {
    if (!showStatement) return;
    setStatement(null);
    void trainingApi.dutyStatement(periodQuery(period)).then((res) => {
      if (res.error) toast.error(res.error);
      setStatement(res.data ?? null);
    });
  }, [showStatement, period]);

  const setAllocation = (id: number | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set("allocation", String(id));
    else next.delete("allocation");
    setParams(next, { replace: true });
  };

  const shiftAction = async (id: number, action: "check-in" | "check-out") => {
    setBusyShift(id);
    const res = await runTrainingAction(trainingApi.shiftAction(id, action), action === "check-in" ? "Checked in" : "Checked out — hours recorded");
    setBusyShift(null);
    if (!res.error) void load();
  };

  return (
    <TrainingPageFrame
      title="My operator duty"
      description="Confirm duty, check in and out, and see the hours you have operated."
      icon={<UserCheck className="h-5 w-5" />}
      onRefresh={allowed ? () => void load() : undefined}
    >
      {bootLoading ? (
        <LoadingBlock />
      ) : !allowed ? (
        <ModuleUnavailable message="This page is for certified operators and teaching assistants on an equipment roster." />
      ) : !data ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-4">
          {data.pending.length ? (
            <SectionCard title="Waiting for your answer" icon={<ClipboardList className="h-4 w-4" />}>
              <div className="space-y-3">
                {data.pending.map((a) => (
                  <PendingCard key={a.id} alloc={a} onChanged={() => void load()} onOpen={() => setAllocation(a.id)} />
                ))}
              </div>
            </SectionCard>
          ) : null}

          <SectionCard title="Upcoming shifts" icon={<CalendarCheck2 className="h-4 w-4" />} description="Check in up to 30 minutes before a shift and check out when you finish.">
            {data.upcoming_shifts.length === 0 ? (
              <EmptyState title="No upcoming duty" description="When an OIC allocates you duty it appears here and you get an email." />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border/70">
                <Table className="min-w-[640px]" stackOnMobile>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Equipment</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.upcoming_shifts.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="whitespace-nowrap text-sm">{formatWindow(s.start_at, s.end_at)}</TableCell>
                        <TableCell className="text-sm">
                          {s.equipment.name}
                          <p className="text-xs text-muted-foreground">{s.reference}</p>
                        </TableCell>
                        <TableCell>
                          <StatusChip kind="shift" status={s.status} label={s.status_label} />
                          {s.check_in_at ? <p className="mt-0.5 text-[11px] text-muted-foreground">In at {formatDateTime(s.check_in_at)}</p> : null}
                        </TableCell>
                        <TableCell>
                          {s.can_check_in ? (
                            <Button type="button" size="sm" onClick={() => void shiftAction(s.id, "check-in")} disabled={busyShift === s.id}>
                              <LogIn className="mr-1.5 h-4 w-4" /> Check in
                            </Button>
                          ) : s.can_check_out ? (
                            <Button type="button" size="sm" variant="outline" onClick={() => void shiftAction(s.id, "check-out")} disabled={busyShift === s.id}>
                              <LogOut className="mr-1.5 h-4 w-4" /> Check out
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="My hours"
            icon={<Timer className="h-4 w-4" />}
            description={`${data.hours.period.label}. Hours count from check-in/out, completed bookings during your shift, or the OIC's record.`}
            actions={
              <Button type="button" size="sm" variant="outline" onClick={() => setShowStatement((v) => !v)}>
                {showStatement ? "Hide statement" : "Statement"}
              </Button>
            }
          >
            <div className="space-y-3">
              <HoursTiles totals={data.hours.totals} />
              {showStatement ? (
                <div className="space-y-3 border-t border-border/60 pt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="w-60">
                      <PeriodSelect value={period} onChange={setPeriod} />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void trainingApi.exportDutyStatement(periodQuery(period)).then((r) => r.error && toast.error(r.error))}
                    >
                      Download CSV
                    </Button>
                  </div>
                  {statement ? <StatementView statement={statement} /> : <LoadingBlock />}
                </div>
              ) : null}
            </div>
          </SectionCard>

          {data.active.length || data.recent.length ? (
            <SectionCard title="My duty allocations">
              <AllocationsTable rows={[...data.active, ...data.recent]} onOpen={setAllocation} showOperator={false} />
            </SectionCard>
          ) : null}

          <SectionCard title="Equipment I can operate" icon={<UserCheck className="h-4 w-4" />}>
            {data.roster.length === 0 ? (
              <EmptyState title="Not on an operator roster yet" description="Earn an operator-level certification (or be approved as a TA) to be offered duty." />
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {data.roster.map((r) => (
                  <li key={r.id} className="rounded-lg border border-border/70 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{r.equipment.name}</p>
                      <StatusChip kind="roster" status={r.status} label={r.status_label} />
                    </div>
                    <p className="text-xs text-muted-foreground">{r.basis || r.source_label}</p>
                    {r.award?.valid_until ? <p className="text-xs text-muted-foreground">Certificate valid to {formatDate(r.award.valid_until)}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      )}
      <AllocationDialog allocationId={allowed ? allocationParam : null} onOpenChange={(open) => !open && setAllocation(null)} onChanged={() => void load()} />
    </TrainingPageFrame>
  );
}

import { useCallback, useEffect, useState } from "react";
import { BellRing, Info, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trainingApi } from "@/lib/trainingApi";
import type { DutyAllocation } from "@/lib/trainingOpsTypes";
import { formatHours, minutesToHours } from "../dutyHelpers";
import { formatDateTime, formatWindow } from "../trainingHelpers";
import { DetailRow, LoadingBlock, PromptDialog, StatusChip, runTrainingAction } from "../trainingUi";
import { ShiftHoursDialog, type ShiftRef } from "./ShiftHoursDialog";

const CHANNEL: Record<string, string> = { PORTAL: "in the portal", EMAIL: "from the email link", AUTO: "automatically" };

export function AllocationDialog({
  allocationId,
  onOpenChange,
  onChanged,
}: {
  allocationId: number | null;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}) {
  const [alloc, setAlloc] = useState<DutyAllocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [editing, setEditing] = useState<ShiftRef | null>(null);

  const load = useCallback(async () => {
    if (!allocationId) return;
    setLoading(true);
    const res = await trainingApi.dutyAllocation(allocationId);
    setLoading(false);
    if (res.error) toast.error(res.error);
    else setAlloc(res.data ?? null);
  }, [allocationId]);

  useEffect(() => {
    if (allocationId) void load();
    else setAlloc(null);
  }, [allocationId, load]);

  const changed = () => {
    void load();
    onChanged?.();
  };
  const snap = alloc?.fairness_snapshot;
  const now = Date.now();

  return (
    <Dialog open={Boolean(allocationId)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Duty {alloc?.reference ?? ""}</DialogTitle>
          <DialogDescription>{alloc ? `${alloc.operator.name} · ${alloc.equipment.name}` : "Loading…"}</DialogDescription>
        </DialogHeader>
        {loading && !alloc ? (
          <LoadingBlock />
        ) : alloc ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip kind="duty" status={alloc.status} label={alloc.status_label} />
              {alloc.academic_year ? <span className="text-xs text-muted-foreground">Academic year {alloc.academic_year}</span> : null}
            </div>
            <dl className="grid gap-3 sm:grid-cols-3">
              <DetailRow label="Planned">{formatHours(minutesToHours(alloc.planned_minutes))} in {alloc.shift_count} shift(s)</DetailRow>
              <DetailRow label="Operated">{formatHours(minutesToHours(alloc.operated_minutes))}</DetailRow>
              <DetailRow label="Allocated by">
                {alloc.allocated_by?.name ?? "—"} · {formatDateTime(alloc.created_at)}
              </DetailRow>
              {alloc.requires_confirmation ? (
                <DetailRow label="Confirmation">
                  {alloc.responded_at
                    ? `${alloc.status === "DECLINED" ? "Declined" : "Answered"} ${CHANNEL[alloc.response_channel] ?? ""} on ${formatDateTime(alloc.responded_at)}`
                    : `Due by ${formatDateTime(alloc.confirm_by)}`}
                </DetailRow>
              ) : (
                <DetailRow label="Confirmation">Not required</DetailRow>
              )}
              {alloc.decline_reason ? <DetailRow label="Decline reason">{alloc.decline_reason}</DetailRow> : null}
              {alloc.cancel_reason ? <DetailRow label="Cancel reason">{alloc.cancel_reason}</DetailRow> : null}
              {Number(alloc.hourly_rate) > 0 ? <DetailRow label="Honorarium rate">₹{alloc.hourly_rate} / hour</DetailRow> : null}
            </dl>

            {alloc.can_manage && (alloc.status === "PENDING" || alloc.status === "CONFIRMED") ? (
              <div className="flex flex-wrap gap-2">
                {alloc.status === "PENDING" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const res = await runTrainingAction(trainingApi.dutyAction(alloc.id, "remind"), "Reminder sent");
                      if (!res.error) changed();
                    }}
                  >
                    <BellRing className="mr-1.5 h-4 w-4" /> Send reminder
                  </Button>
                ) : null}
                <Button type="button" size="sm" variant="destructive" onClick={() => setCancelling(true)}>
                  <XCircle className="mr-1.5 h-4 w-4" /> Cancel duty
                </Button>
              </div>
            ) : null}

            <div className="overflow-x-auto rounded-lg border border-border/70">
              <Table className="min-w-[620px]" stackOnMobile>
                <TableHeader>
                  <TableRow>
                    <TableHead>Shift</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Check-in / out</TableHead>
                    <TableHead>Hours</TableHead>
                    {alloc.can_manage ? <TableHead>Record</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(alloc.shifts ?? []).map((s) => {
                    const canRecord =
                      alloc.can_manage &&
                      (alloc.status === "CONFIRMED" || alloc.status === "COMPLETED") &&
                      !["RELEASED", "CANCELLED"].includes(s.status) &&
                      new Date(s.start_at).getTime() <= now;
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="whitespace-nowrap text-sm">{formatWindow(s.start_at, s.end_at)}</TableCell>
                        <TableCell>
                          <StatusChip kind="shift" status={s.status} label={s.status_label} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {s.check_in_at ? formatDateTime(s.check_in_at) : "—"}
                          {s.check_out_at ? ` → ${formatDateTime(s.check_out_at)}` : ""}
                        </TableCell>
                        <TableCell className="text-sm">
                          {s.operated_minutes != null ? formatHours(minutesToHours(s.operated_minutes)) : "—"}
                          {s.hours_source_label ? <p className="text-[11px] text-muted-foreground">{s.hours_source_label}{s.verified_by ? ` · ${s.verified_by.name}` : ""}</p> : null}
                          {s.remarks ? <p className="text-[11px] text-muted-foreground">{s.remarks}</p> : null}
                        </TableCell>
                        {alloc.can_manage ? (
                          <TableCell>
                            {canRecord ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setEditing({
                                    id: s.id,
                                    start: s.start_at,
                                    end: s.end_at,
                                    plannedMinutes: s.planned_minutes,
                                    operatedMinutes: s.operated_minutes,
                                    operatorName: alloc.operator.name,
                                  })
                                }
                              >
                                {s.operated_minutes != null ? "Correct" : "Record"}
                              </Button>
                            ) : null}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {snap?.chosen ? (
              <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm">
                <p className="mb-1 flex items-center gap-1.5 font-medium">
                  <Info className="h-4 w-4" aria-hidden /> Why this operator
                </p>
                <p className="text-muted-foreground">
                  {alloc.suggested_rank ? `Rank ${alloc.suggested_rank} in the fair rotation` : "Outside the rotation (blocked by caps or cooling)"}
                  {snap.term?.label ? ` for ${snap.term.label}` : ""}.
                  {snap.chosen.reasons?.length ? ` ${snap.chosen.reasons.join("; ")}.` : ""}
                </p>
                {alloc.override_reason ? <p className="mt-1">OIC's reason: {alloc.override_reason}</p> : null}
                {snap.ranking?.length ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ranking at the time: {snap.ranking.filter((r) => r.rank).slice(0, 5).map((r) => `${r.rank}. ${r.name}`).join(", ")}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <PromptDialog
          open={cancelling}
          onOpenChange={setCancelling}
          title="Cancel this duty?"
          description="Scheduled shifts are cancelled and the operator is told. Hours already recorded are kept."
          destructive
          confirmLabel="Cancel duty"
          onConfirm={async (reason) => {
            if (!alloc) return false;
            const res = await runTrainingAction(trainingApi.dutyAction(alloc.id, "cancel", reason), "Duty cancelled");
            if (res.error) return false;
            changed();
            return true;
          }}
        />
        <ShiftHoursDialog shift={editing} onOpenChange={(v) => !v && setEditing(null)} onSaved={changed} />
      </DialogContent>
    </Dialog>
  );
}

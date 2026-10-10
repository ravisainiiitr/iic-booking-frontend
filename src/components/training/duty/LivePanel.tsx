import { useCallback, useEffect, useState } from "react";
import { Activity, CalendarClock, ClipboardCheck, LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trainingApi } from "@/lib/trainingApi";
import type { DutyLive, ShiftLine } from "@/lib/trainingOpsTypes";
import { formatHours, liveShiftAction } from "../dutyHelpers";
import { formatWindow } from "../trainingHelpers";
import { CountTile, EmptyState, LoadingBlock, SectionCard, StatusChip, runTrainingAction } from "../trainingUi";
import { ShiftHoursDialog, type ShiftRef } from "./ShiftHoursDialog";

const REFRESH_MS = 60_000;

function LineList({
  lines,
  empty,
  onOpen,
  onRecord,
  onShiftAction,
  busyId,
}: {
  lines: ShiftLine[];
  empty: string;
  onOpen: (allocationId: number) => void;
  onRecord?: (line: ShiftLine) => void;
  onShiftAction?: (line: ShiftLine, action: "check-in" | "check-out") => void;
  busyId?: number | null;
}) {
  if (!lines.length) return <p className="py-4 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="divide-y divide-border/60">
      {lines.map((l) => {
        const action = onShiftAction ? liveShiftAction(l) : null;
        return (
          <li key={l.shift_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <button type="button" className="min-w-0 text-left" onClick={() => onOpen(l.allocation_id)}>
              <p className="truncate text-sm font-medium hover:underline">{l.operator_name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {l.equipment_name} · {formatWindow(l.start, l.end)}
              </p>
            </button>
            <div className="flex items-center gap-2">
              {l.checked_in ? <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">Checked in</span> : null}
              <StatusChip kind="shift" status={l.status} label={l.status_label} />
              {action && onShiftAction ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busyId === l.shift_id}
                  title={`${action === "check-in" ? "Check in" : "Check out"} ${l.operator_name}`}
                  onClick={() => onShiftAction(l, action)}
                >
                  {action === "check-in" ? <LogIn className="mr-1 h-4 w-4" /> : <LogOut className="mr-1 h-4 w-4" />}
                  {action === "check-in" ? "Check in" : "Check out"}
                </Button>
              ) : null}
              {onRecord ? (
                <Button type="button" size="sm" variant="outline" onClick={() => onRecord(l)}>
                  Record {formatHours(l.planned_hours)}
                </Button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function LivePanel({ onOpenAllocation, refreshKey }: { onOpenAllocation: (id: number) => void; refreshKey: number }) {
  const [live, setLive] = useState<DutyLive | null>(null);
  const [recording, setRecording] = useState<ShiftRef | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const res = await trainingApi.dutyLive();
    if (res.data) setLive(res.data);
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), REFRESH_MS);
    return () => window.clearInterval(t);
  }, [load, refreshKey]);

  const shiftAction = async (line: ShiftLine, action: "check-in" | "check-out") => {
    setBusyId(line.shift_id);
    const res = await runTrainingAction(
      trainingApi.shiftAction(line.shift_id, action),
      action === "check-in" ? `${line.operator_name} checked in` : `${line.operator_name} checked out — hours recorded`,
    );
    setBusyId(null);
    if (!res.error) void load();
  };

  if (!live) return <LoadingBlock />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <CountTile label="On duty now" value={live.on_duty.length} />
        <CountTile label="Later today" value={live.later_today.length} />
        <CountTile label="Awaiting confirmation" value={live.awaiting_confirmation_count} highlight />
        <CountTile label="Hours to verify" value={live.pending_verification_count} highlight />
      </div>
      {live.due_within_24h_count ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          {live.due_within_24h_count} confirmation(s) are due within 24 hours. Unanswered duty is released automatically at the deadline.
        </p>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="On duty now" icon={<Activity className="h-4 w-4" />} description="Updates every minute. Check operators in or out if they cannot do it themselves.">
          <LineList lines={live.on_duty} empty="Nobody is on duty right now." onOpen={onOpenAllocation} onShiftAction={shiftAction} busyId={busyId} />
        </SectionCard>
        <SectionCard title="Later today" icon={<CalendarClock className="h-4 w-4" />} description="Check-in opens 30 minutes before a shift.">
          <LineList lines={live.later_today} empty="No more duty today." onOpen={onOpenAllocation} onShiftAction={shiftAction} busyId={busyId} />
        </SectionCard>
      </div>
      <SectionCard
        title="Hours to verify"
        icon={<ClipboardCheck className="h-4 w-4" />}
        description="Finished shifts without check-out or a completed booking. Record the actual hours or mark them missed."
      >
        {live.pending_verification.length ? (
          <LineList
            lines={live.pending_verification}
            empty=""
            onOpen={onOpenAllocation}
            onRecord={(l) =>
              setRecording({
                id: l.shift_id,
                start: l.start,
                end: l.end,
                plannedMinutes: Math.round(l.planned_hours * 60),
                operatedMinutes: l.operated_hours != null ? Math.round(l.operated_hours * 60) : null,
                operatorName: l.operator_name,
              })
            }
          />
        ) : (
          <EmptyState title="All caught up" description="Every finished shift has its hours recorded." />
        )}
      </SectionCard>
      <ShiftHoursDialog shift={recording} onOpenChange={(v) => !v && setRecording(null)} onSaved={() => void load()} />
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileText, Timer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trainingApi } from "@/lib/trainingApi";
import type { AccountingGroup, AccountingQuery, DutyStatement, HoursFigures, HoursSummary } from "@/lib/trainingOpsTypes";
import type { TrainingEquipmentRef } from "@/lib/trainingTypes";
import { academicYearChoices, formatHours, periodQuery, recentMonths } from "../dutyHelpers";
import { EquipmentPicker } from "../EquipmentPicker";
import { formatDate, formatWindow } from "../trainingHelpers";
import { CountTile, EmptyState, LoadingBlock, StatusChip } from "../trainingUi";

const GROUPS: Array<{ value: AccountingGroup; label: string }> = [
  { value: "operator", label: "Operator" },
  { value: "equipment", label: "Equipment" },
  { value: "department", label: "Department" },
  { value: "faculty", label: "Faculty group" },
  { value: "month", label: "Month" },
];

const SOURCE_LABELS: Record<string, string> = { CHECKIN: "Check-in / out", BOOKING: "Completed booking", OIC: "Recorded by OIC" };

export function PeriodSelect({ value, onChange, id }: { value: string; onChange: (v: string) => void; id?: string }) {
  const years = useMemo(() => academicYearChoices(), []);
  const months = useMemo(() => recentMonths(12), []);
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} aria-label="Period">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {years.map((y) => (
          <SelectItem key={y} value={`ay:${y}`}>
            Academic year {y}
          </SelectItem>
        ))}
        {months.map((m) => (
          <SelectItem key={m.value} value={`m:${m.value}`}>
            {m.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function HoursTiles({ totals, showMoney = true }: { totals: HoursFigures & { operators?: number }; showMoney?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <CountTile label="Hours allocated" value={totals.allocated_hours} />
      <CountTile label="Hours confirmed" value={totals.confirmed_hours} />
      <CountTile label="Hours operated" value={totals.operated_hours} />
      <CountTile label="Upcoming" value={totals.upcoming_hours} />
      <CountTile label="Awaiting verification" value={totals.pending_hours} highlight />
      {showMoney && Number(totals.honorarium) > 0 ? (
        <div className="flex flex-col items-start gap-0.5 rounded-lg border border-border/70 bg-card px-3 py-2 shadow-sm">
          <span className="text-xl font-semibold tabular-nums">₹{totals.honorarium}</span>
          <span className="text-xs text-muted-foreground">Honorarium (indicative)</span>
        </div>
      ) : (
        <CountTile label="Missed" value={totals.missed_hours} />
      )}
    </div>
  );
}

export function StatementView({ statement }: { statement: DutyStatement }) {
  return (
    <div className="space-y-3">
      <HoursTiles totals={statement.totals} />
      {statement.lines.length === 0 && statement.legacy_logs.length === 0 ? (
        <EmptyState title="No duty in this period" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border/70">
          <Table className="min-w-[720px]" stackOnMobile>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Equipment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Planned</TableHead>
                <TableHead>Operated</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statement.lines.map((l) => (
                <TableRow key={l.shift_id}>
                  <TableCell className="whitespace-nowrap text-xs">{formatWindow(l.start, l.end)}</TableCell>
                  <TableCell className="text-sm">{l.equipment_name}</TableCell>
                  <TableCell>
                    <StatusChip kind="shift" status={l.status} label={l.status_label} />
                  </TableCell>
                  <TableCell className="tabular-nums">{formatHours(l.planned_hours)}</TableCell>
                  <TableCell className="tabular-nums">{l.operated_hours != null ? formatHours(l.operated_hours) : l.pending ? "Awaiting" : "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {SOURCE_LABELS[l.hours_source] ?? "—"}
                    {l.verified_by ? ` · ${l.verified_by}` : ""}
                  </TableCell>
                </TableRow>
              ))}
              {statement.legacy_logs.map((l) => (
                <TableRow key={`legacy-${l.id}`}>
                  <TableCell className="text-xs">{formatDate(l.date)}</TableCell>
                  <TableCell className="text-sm">{l.equipment_name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">TA duty log (verified)</TableCell>
                  <TableCell>—</TableCell>
                  <TableCell className="tabular-nums">{formatHours(l.hours)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{l.remarks || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function StatementDialog({ query, onOpenChange }: { query: AccountingQuery | null; onOpenChange: (v: boolean) => void }) {
  const [statement, setStatement] = useState<DutyStatement | null>(null);

  useEffect(() => {
    setStatement(null);
    if (!query) return;
    void trainingApi.dutyStatement(query).then((res) => {
      if (res.error) toast.error(res.error);
      setStatement(res.data ?? null);
    });
  }, [query]);

  return (
    <Dialog open={Boolean(query)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Duty statement{statement ? ` — ${statement.operator.name}` : ""}</DialogTitle>
          <DialogDescription>{statement?.period.label ?? "Loading…"}</DialogDescription>
        </DialogHeader>
        {statement && query ? (
          <>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void trainingApi.exportDutyStatement(query).then((r) => r.error && toast.error(r.error))}
              >
                <Download className="mr-1.5 h-4 w-4" /> CSV
              </Button>
            </div>
            <StatementView statement={statement} />
          </>
        ) : (
          <LoadingBlock />
        )}
      </DialogContent>
    </Dialog>
  );
}

export function HoursPanel({ refreshKey }: { refreshKey: number }) {
  const [groupBy, setGroupBy] = useState<AccountingGroup>("operator");
  const [periodValue, setPeriodValue] = useState(() => `ay:${academicYearChoices(1)[0]}`);
  const [equipment, setEquipment] = useState<TrainingEquipmentRef | null>(null);
  const [data, setData] = useState<HoursSummary | null>(null);
  const [statementQuery, setStatementQuery] = useState<AccountingQuery | null>(null);

  const query = useMemo<AccountingQuery>(
    () => ({ group_by: groupBy, equipment_id: equipment?.equipment_id, ...periodQuery(periodValue) }),
    [groupBy, equipment, periodValue],
  );

  const load = useCallback(async () => {
    setData(null);
    const res = await trainingApi.dutyAccounting(query);
    if (res.error) toast.error(res.error);
    setData(res.data ?? null);
  }, [query]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const exportCsv = async () => {
    const res = await trainingApi.exportDutyAccounting(query);
    if (res.error) toast.error(res.error);
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_220px_180px_auto]">
        <EquipmentPicker managed value={equipment} onChange={setEquipment} placeholder="All equipment you manage" />
        <PeriodSelect value={periodValue} onChange={setPeriodValue} />
        <Select value={groupBy} onValueChange={(v) => setGroupBy(v as AccountingGroup)}>
          <SelectTrigger aria-label="Group by">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GROUPS.map((g) => (
              <SelectItem key={g.value} value={g.value}>
                By {g.label.toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" onClick={() => void exportCsv()}>
          <Download className="mr-1.5 h-4 w-4" /> Export CSV
        </Button>
      </div>
      {!data ? (
        <LoadingBlock />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {data.period.label} · {data.totals.operators} operator(s) · {data.totals.allocations} allocation(s). Operated hours come from check-in/out, completed bookings during the shift, or the OIC's
            entry; legacy TA duty logs are included.
          </p>
          <HoursTiles totals={data.totals} />
          {data.rows.length === 0 ? (
            <EmptyState icon={<Timer className="h-8 w-8" />} title="No duty hours in this period" />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/70">
              <Table className="min-w-[880px]" stackOnMobile>
                <TableHeader>
                  <TableRow>
                    <TableHead>{GROUPS.find((g) => g.value === data.group_by)?.label}</TableHead>
                    <TableHead>Allocated</TableHead>
                    <TableHead>Confirmed</TableHead>
                    <TableHead>Operated</TableHead>
                    <TableHead>Utilisation</TableHead>
                    <TableHead>Upcoming</TableHead>
                    <TableHead>To verify</TableHead>
                    <TableHead>Missed / released</TableHead>
                    <TableHead>Legacy TA</TableHead>
                    {data.group_by === "operator" ? <TableHead>Statement</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((r) => (
                    <TableRow key={r.key || r.label}>
                      <TableCell className="text-sm font-medium">
                        {r.label}
                        {data.group_by !== "operator" && r.operators ? <p className="text-xs font-normal text-muted-foreground">{r.operators} operator(s)</p> : null}
                      </TableCell>
                      <TableCell className="tabular-nums">{formatHours(r.allocated_hours)}</TableCell>
                      <TableCell className="tabular-nums">{formatHours(r.confirmed_hours)}</TableCell>
                      <TableCell className="tabular-nums font-medium">{formatHours(r.operated_hours)}</TableCell>
                      <TableCell className="tabular-nums">{r.utilisation_pct != null ? `${r.utilisation_pct}%` : "—"}</TableCell>
                      <TableCell className="tabular-nums">{formatHours(r.upcoming_hours)}</TableCell>
                      <TableCell className="tabular-nums">{formatHours(r.pending_hours)}</TableCell>
                      <TableCell className="tabular-nums">
                        {formatHours(r.missed_hours)} / {formatHours(r.released_hours)}
                      </TableCell>
                      <TableCell className="tabular-nums">{r.legacy_ta_hours ? formatHours(r.legacy_ta_hours) : "—"}</TableCell>
                      {data.group_by === "operator" ? (
                        <TableCell>
                          {r.key ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setStatementQuery({ operator_id: Number(r.key), equipment_id: equipment?.equipment_id, ...periodQuery(periodValue) })}
                            >
                              <FileText className="mr-1 h-4 w-4" /> View
                            </Button>
                          ) : null}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
      <StatementDialog query={statementQuery} onOpenChange={(v) => !v && setStatementQuery(null)} />
    </div>
  );
}

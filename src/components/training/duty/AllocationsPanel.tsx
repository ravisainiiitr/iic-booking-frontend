import { useCallback, useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trainingApi } from "@/lib/trainingApi";
import type { DutyAllocation } from "@/lib/trainingOpsTypes";
import type { TrainingEquipmentRef } from "@/lib/trainingTypes";
import { formatHours, minutesToHours } from "../dutyHelpers";
import { EquipmentPicker } from "../EquipmentPicker";
import { formatDateTime, formatWindow } from "../trainingHelpers";
import { EmptyState, LoadingBlock, StatusChip } from "../trainingUi";

const STATUS_FILTERS = [
  { value: "open", label: "Pending & confirmed" },
  { value: "PENDING", label: "Awaiting confirmation" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "COMPLETED", label: "Completed" },
  { value: "DECLINED", label: "Declined" },
  { value: "EXPIRED", label: "Released (no answer)" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "all", label: "All" },
];

export function AllocationsTable({ rows, onOpen, showOperator = true }: { rows: DutyAllocation[]; onOpen: (id: number) => void; showOperator?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border/70">
      <Table className="min-w-[760px]" stackOnMobile>
        <TableHeader>
          <TableRow>
            <TableHead>Reference</TableHead>
            {showOperator ? <TableHead>Operator</TableHead> : null}
            <TableHead>Equipment</TableHead>
            <TableHead>When</TableHead>
            <TableHead>Hours (planned / operated)</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((a) => (
            <TableRow key={a.id} className="cursor-pointer hover:bg-muted/40" onClick={() => onOpen(a.id)}>
              <TableCell className="font-mono text-xs">{a.reference}</TableCell>
              {showOperator ? <TableCell className="text-sm">{a.operator.name}</TableCell> : null}
              <TableCell className="text-sm">{a.equipment.name}</TableCell>
              <TableCell className="text-xs">
                {a.first_start ? formatWindow(a.first_start, a.last_end) : "—"}
                {a.shift_count > 1 ? <p className="text-muted-foreground">{a.shift_count} shifts</p> : null}
              </TableCell>
              <TableCell className="text-sm tabular-nums">
                {formatHours(minutesToHours(a.planned_minutes))} / {formatHours(minutesToHours(a.operated_minutes))}
              </TableCell>
              <TableCell>
                <StatusChip kind="duty" status={a.status} label={a.status_label} />
                {a.status === "PENDING" && a.confirm_by ? <p className="mt-0.5 text-[11px] text-muted-foreground">by {formatDateTime(a.confirm_by)}</p> : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function AllocationsPanel({ onOpen, refreshKey }: { onOpen: (id: number) => void; refreshKey: number }) {
  const [equipment, setEquipment] = useState<TrainingEquipmentRef | null>(null);
  const [status, setStatus] = useState("open");
  const [rows, setRows] = useState<DutyAllocation[] | null>(null);

  const load = useCallback(async () => {
    setRows(null);
    const res = await trainingApi.dutyAllocations({
      equipment_id: equipment?.equipment_id,
      status: status === "all" ? undefined : status === "open" ? "PENDING,CONFIRMED" : status,
    });
    if (res.error) toast.error(res.error);
    setRows(res.data?.results ?? []);
  }, [equipment, status]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px]">
        <EquipmentPicker managed value={equipment} onChange={setEquipment} placeholder="All equipment you manage" />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {rows === null ? (
        <LoadingBlock />
      ) : rows.length === 0 ? (
        <EmptyState icon={<ClipboardList className="h-8 w-8" />} title="No duty allocations" description="Allocate duty from the Allocate tab; it appears here with its confirmation and hours." />
      ) : (
        <AllocationsTable rows={rows} onOpen={onOpen} />
      )}
    </div>
  );
}

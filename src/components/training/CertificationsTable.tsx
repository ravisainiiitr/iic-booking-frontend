import { useCallback, useEffect, useMemo, useState } from "react";
import { Award, Search } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trainingApi } from "@/lib/trainingApi";
import type { TrainingAward, TrainingEquipmentRef } from "@/lib/trainingTypes";
import { EquipmentPicker } from "./EquipmentPicker";
import { formatDate } from "./trainingHelpers";
import { EmptyState, LoadingBlock, StatusChip } from "./trainingUi";

export function AwardsTable({ awards, showUser = true }: { awards: TrainingAward[]; showUser?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border/70">
      <Table className="min-w-[560px]">
        <TableHeader>
          <TableRow>
            {showUser ? <TableHead>Holder</TableHead> : null}
            <TableHead>Equipment</TableHead>
            <TableHead>Level</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="whitespace-nowrap">Awarded</TableHead>
            <TableHead className="whitespace-nowrap">Valid until</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {awards.map((a) => (
            <TableRow key={a.id}>
              {showUser ? (
                <TableCell>
                  <p className="font-medium">{a.user?.name}</p>
                  <p className="text-xs text-muted-foreground">{a.user?.department ?? a.user?.email}</p>
                </TableCell>
              ) : null}
              <TableCell>
                <p className="text-sm font-medium">{a.equipment?.name}</p>
                <p className="text-xs text-muted-foreground">{a.equipment?.code}</p>
              </TableCell>
              <TableCell className="text-sm">{a.level_name || a.level}</TableCell>
              <TableCell>
                <StatusChip kind="award" status={a.status} />
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDate(a.awarded_at)}</TableCell>
              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{a.valid_until ? formatDate(a.valid_until) : "No expiry"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Certifications on the equipment the signed-in OIC / admin can see. */
export function CertificationsPanel() {
  const [equipment, setEquipment] = useState<TrainingEquipmentRef | null>(null);
  const [awards, setAwards] = useState<TrainingAward[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await trainingApi.certifications({ equipment_id: equipment?.equipment_id });
    setLoading(false);
    if (res.error) {
      toast.error(res.error);
      setAwards([]);
      return;
    }
    setAwards(res.data?.results ?? []);
  }, [equipment]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return awards ?? [];
    return (awards ?? []).filter((a) =>
      [a.user?.name, a.user?.email, a.equipment?.code, a.equipment?.name].some((v) => String(v ?? "").toLowerCase().includes(q)),
    );
  }, [awards, query]);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <EquipmentPicker managed value={equipment} onChange={setEquipment} placeholder="Filter by equipment (all if empty)" />
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search holder or equipment" className="pl-8" />
        </div>
      </div>
      {loading && !awards ? (
        <LoadingBlock />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Award className="h-8 w-8" />} title="No certifications yet" description="Certifications are issued automatically when a participant completes every session." />
      ) : (
        <AwardsTable awards={filtered} />
      )}
    </div>
  );
}

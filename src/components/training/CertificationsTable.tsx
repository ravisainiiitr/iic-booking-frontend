import { useCallback, useEffect, useMemo, useState } from "react";
import { Award, Search } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trainingApi } from "@/lib/trainingApi";
import type { TrainingAward, TrainingEquipmentRef } from "@/lib/trainingTypes";
import { CertificateDialog } from "./CertificateDialog";
import { EquipmentPicker } from "./EquipmentPicker";
import { formatDate } from "./trainingHelpers";
import { EmptyState, LoadingBlock, StatusChip } from "./trainingUi";

const DAY = 86_400_000;

function expiresSoon(a: TrainingAward, now = Date.now()): boolean {
  if (!a.valid_until || a.status !== "ACTIVE") return false;
  const left = new Date(a.valid_until).getTime() - now;
  return left > 0 && left < 30 * DAY;
}

export function AwardsTable({
  awards,
  showUser = true,
  onOpen,
}: {
  awards: TrainingAward[];
  showUser?: boolean;
  onOpen?: (award: TrainingAward) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border/70">
      <Table className="min-w-[640px]" stackOnMobile>
        <TableHeader>
          <TableRow>
            {showUser ? <TableHead>Holder</TableHead> : null}
            <TableHead>Equipment</TableHead>
            <TableHead>Level</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="whitespace-nowrap">Certificate no.</TableHead>
            <TableHead className="whitespace-nowrap">Awarded</TableHead>
            <TableHead className="whitespace-nowrap">Valid until</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {awards.map((a) => (
            <TableRow key={a.id} className={onOpen ? "cursor-pointer" : undefined} onClick={onOpen ? () => onOpen(a) : undefined}>
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
                <div className="flex flex-col items-center gap-1">
                  <StatusChip kind="award" status={a.status} label={a.status_label} />
                  {expiresSoon(a) ? <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">Expires soon</span> : null}
                </div>
              </TableCell>
              <TableCell className="whitespace-nowrap font-mono text-xs">{a.certificate_no || "—"}</TableCell>
              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDate(a.awarded_at)}</TableCell>
              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{a.valid_until ? formatDate(a.valid_until) : "No expiry"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

const STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "expiring", label: "Expiring within 30 days" },
  { value: "DORMANT", label: "Dormant" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "EXPIRED", label: "Expired" },
  { value: "REVOKED", label: "Revoked" },
];

/** Certifications on the equipment the signed-in OIC / admin can see. */
export function CertificationsPanel() {
  const [equipment, setEquipment] = useState<TrainingEquipmentRef | null>(null);
  const [awards, setAwards] = useState<TrainingAward[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [openId, setOpenId] = useState<number | null>(null);

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
    return (awards ?? []).filter((a) => {
      if (status === "expiring" ? !expiresSoon(a) : status !== "all" && a.status !== status) return false;
      if (!q) return true;
      return [a.user?.name, a.user?.email, a.equipment?.code, a.equipment?.name, a.certificate_no].some((v) =>
        String(v ?? "").toLowerCase().includes(q),
      );
    });
  }, [awards, query, status]);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <EquipmentPicker managed value={equipment} onChange={setEquipment} placeholder="Filter by equipment (all if empty)" />
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search holder, equipment or certificate no." className="pl-8" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {loading && !awards ? (
        <LoadingBlock />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Award className="h-8 w-8" />}
          title="No certifications match"
          description="Trained status is issued when a participant completes every session; operator certificates come from a passed, signed-off assessment."
        />
      ) : (
        <AwardsTable awards={filtered} onOpen={(a) => setOpenId(a.id)} />
      )}
      <CertificateDialog awardId={openId} open={openId !== null} onOpenChange={(v) => !v && setOpenId(null)} onChanged={() => void load()} />
    </div>
  );
}

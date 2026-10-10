import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  formatDuration,
  type ProficiencyRole,
  type ProficiencySort,
  type StaffProficiency,
  type StaffProficiencyRow,
} from "@/lib/adminInsights";
import { apiClient } from "@/lib/api";
import { formatDMY, formatDMYTime } from "@/lib/dateFormat";
import { cn } from "@/lib/utils";
import { FilterSelect, LoadError, Muted, SectionCard } from "./InsightParts";
import { useInsights } from "./useInsights";

const SORT_LABELS: Record<ProficiencySort, string> = {
  proficiency: "Most proficient",
  pending: "Fewest pending",
  response: "Fastest response",
};
const PERIODS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];
const ROLE_TITLES: Record<ProficiencyRole, string> = { operator: "Lab Operators", oic: "Officers in Charge" };

function scoreTone(score: number | null): string {
  if (score == null) return "bg-muted";
  if (score >= 75) return "bg-emerald-500/80";
  if (score >= 50) return "bg-amber-500/80";
  return "bg-red-500/80";
}

function hours(value: number | null): string {
  return value == null ? "—" : formatDuration(value * 60);
}

function ProficiencyTable({
  role,
  rows,
  loading,
  onOpen,
}: {
  role: ProficiencyRole;
  rows: StaffProficiencyRow[];
  loading: boolean;
  onOpen: (row: StaffProficiencyRow) => void;
}) {
  return (
    <Table
      scrollPane
      containerProps={{ role: "region", "aria-label": ROLE_TITLES[role], tabIndex: 0 }}
      className={cn("min-w-[640px] text-sm", loading && "opacity-60")}
      aria-busy={loading}
    >
      <TableHeader className="z-20 bg-card">
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-14">Rank</TableHead>
          <TableHead className="min-w-[180px]">{role === "oic" ? "Officer in Charge" : "Lab Operator"}</TableHead>
          <TableHead>Pending</TableHead>
          <TableHead>Handled</TableHead>
          <TableHead>Avg response</TableHead>
          <TableHead className="min-w-[140px]">Proficiency</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 && !loading ? (
          <TableRow>
            <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
              No {role === "oic" ? "Officers in Charge" : "Lab Operators"} assigned to equipment here.
            </TableCell>
          </TableRow>
        ) : (
          rows.map((r) => (
            <TableRow key={r.id} className="hover:bg-muted/50">
              <TableCell className="tabular-nums font-medium">{r.rank ?? <Muted />}</TableCell>
              <TableCell>
                <button
                  type="button"
                  className="text-left font-medium text-primary underline-offset-2 hover:underline"
                  onClick={() => onOpen(r)}
                >
                  {r.name || `User #${r.id}`}
                </button>
                <div className="text-xs text-muted-foreground" title={r.equipment.map((e) => e.name).join(", ")}>
                  {r.equipment.length} equipment
                </div>
              </TableCell>
              <TableCell className="tabular-nums">
                <div>{r.pending}</div>
                {r.overdue ? <div className="text-xs text-red-600 dark:text-red-400">{r.overdue} overdue</div> : null}
              </TableCell>
              <TableCell className="tabular-nums">{r.handled}</TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">{hours(r.avg_response_hours)}</TableCell>
              <TableCell>
                {r.score == null ? (
                  <Muted>No work in period</Muted>
                ) : (
                  <div className="w-28">
                    <div className="text-sm font-medium tabular-nums">{r.score}</div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className={cn("h-full rounded-full", scoreTone(r.score))} style={{ width: `${r.score}%` }} />
                    </div>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

function PendingDialog({
  person,
  dept,
  days,
  onClose,
}: {
  person: StaffProficiencyRow | null;
  dept: string;
  days: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<StaffProficiency | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!person) return;
    let cancelled = false;
    setLoading(true);
    setData(null);
    apiClient
      .getAdminStaffProficiency({ dept: dept || undefined, days, person: person.id, role: person.role })
      .then((res) => {
        if (cancelled) return;
        setLoading(false);
        setError(res.error || (res.data ? null : "Could not load the pending list."));
        setData(res.data ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [person, dept, days, retry]);

  const items = data?.person?.pending ?? [];
  return (
    <Dialog open={person != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Pending with {person?.name}</DialogTitle>
          <DialogDescription>
            {person ? `${person.pending} pending, ${person.overdue} overdue — on ${person.equipment.length} equipment.` : ""}
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <LoadError message={error} onRetry={() => setRetry((n) => n + 1)} />
        ) : (
          <div className="max-h-[60vh] overflow-auto">
            <Table className={cn("text-sm", loading && "opacity-60")} aria-busy={loading}>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Booking</TableHead>
                  <TableHead>Waiting for</TableHead>
                  <TableHead>Equipment</TableHead>
                  <TableHead>Since</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 && !loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                      Nothing pending.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.key}>
                      <TableCell>
                        {item.link ? (
                          <Link to={item.link} className="font-medium text-primary underline-offset-2 hover:underline">
                            {item.booking_ref}
                          </Link>
                        ) : (
                          item.booking_ref
                        )}
                        {item.user_name ? <div className="text-xs text-muted-foreground">{item.user_name}</div> : null}
                      </TableCell>
                      <TableCell>
                        <div>{item.kind_display}</div>
                        {item.overdue ? <div className="text-xs font-medium text-red-600 dark:text-red-400">Overdue</div> : null}
                      </TableCell>
                      <TableCell>
                        {item.equipment_name}
                        {item.equipment_code ? <div className="text-xs text-muted-foreground">{item.equipment_code}</div> : null}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {item.since ? formatDMYTime(item.since) : <Muted />}
                        {item.waiting_hours != null ? (
                          <div className="text-xs text-muted-foreground">{hours(item.waiting_hours)} ago</div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Lab Operator and Officer in Charge panels: who keeps their pending queue short, most proficient first. */
export function StaffProficiencyPanels({ dept }: { dept: string }) {
  const [sort, setSort] = useState<ProficiencySort>("proficiency");
  const [days, setDays] = useState("30");
  const [open, setOpen] = useState<StaffProficiencyRow | null>(null);
  const { data, loading, error, reload } = useInsights(
    (p) => apiClient.getAdminStaffProficiency(p),
    { sort, days, ...(dept ? { dept } : {}) },
    "Could not load the Lab Operator and Officer in Charge panels.",
  );

  const toolbar = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1.5">
        <span className="text-xs font-medium">Order</span>
        <ToggleGroup
          type="single"
          value={sort}
          onValueChange={(v) => v && setSort(v as ProficiencySort)}
          className="justify-start"
          aria-label="Order the lists"
        >
          {(Object.keys(SORT_LABELS) as ProficiencySort[]).map((key) => (
            <ToggleGroupItem key={key} value={key} size="sm" className="px-3 text-xs">
              {SORT_LABELS[key]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <div className="w-full sm:w-48">
        <FilterSelect id="proficiency-period" label="Handled in" value={days} onChange={(v) => setDays(v || "30")} options={PERIODS} allLabel="Last 30 days" />
      </div>
    </div>
  );

  return (
    <section aria-label="Lab Operator and Officer in Charge proficiency" className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-base font-semibold tracking-tight">Lab Operators and Officers in Charge</h2>
        <p className="text-xs text-muted-foreground">
          Fewer bookings left pending means a more proficient operator. Proficiency ={" "}
          {data?.formula ?? "handled ÷ (handled + pending + overdue) × 100."} Pending: bookings awaiting completion and
          repeat-sample requests (Officers in Charge also: urgent requests and I-STEM FBRs to verify); requests waiting
          over {data?.decision_overdue_hours ?? 48} h count as overdue. Click a name for their pending bookings.
        </p>
      </div>
      {toolbar}
      {error ? (
        <LoadError message={error} onRetry={reload} />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {(["operator", "oic"] as ProficiencyRole[]).map((role) => (
            <SectionCard
              key={role}
              title={ROLE_TITLES[role]}
              description={data ? `Handled ${formatDMY(data.date_from)} – ${formatDMY(data.date_to)}` : undefined}
            >
              <ProficiencyTable
                role={role}
                rows={(role === "oic" ? data?.oics : data?.operators) ?? []}
                loading={loading}
                onOpen={setOpen}
              />
            </SectionCard>
          ))}
        </div>
      )}
      <PendingDialog person={open} dept={dept} days={days} onClose={() => setOpen(null)} />
    </section>
  );
}

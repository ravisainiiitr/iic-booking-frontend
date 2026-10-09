import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  GraduationCap,
  IndianRupee,
  ListOrdered,
  Loader2,
  RotateCcw,
  Search,
  ShieldCheck,
  UserCog,
  UserRound,
  Users,
} from "lucide-react";

import { ExportMenu } from "@/components/ExportMenu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLiveSearchTerm } from "@/hooks/use-live-search";
import {
  apiClient,
  type LedgerLinkedStudent,
  type LedgerLinkedStudentsResponse,
  type LedgerSupervisedUser,
} from "@/lib/api";
import { formatDMY, formatDMYTime } from "@/lib/dateFormat";
import {
  countActive,
  DATE_PRESETS,
  EMPTY_LINKED_STUDENT_FILTERS,
  formatLedgerAmount,
  LINK_STATUS_OPTIONS,
  LINK_STATUS_TONE,
  linkedStudentParams,
  type DatePreset,
  type LinkedStudentFilters,
} from "@/lib/walletLedger";
import { cn } from "@/lib/utils";

import { FilterSelect, SortHeader, SummaryStat } from "./shared";

export type StudentRef = { id: number; name: string };

export function LinkStatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <Badge variant="outline" className={cn("whitespace-nowrap font-medium", LINK_STATUS_TONE[status] ?? LINK_STATUS_TONE.cancelled)}>
      {label}
    </Badge>
  );
}

function linkDates(s: LedgerLinkedStudent): string {
  const requested = s.requested_at ? `Requested ${formatDMY(s.requested_at)}` : "";
  const responded = s.responded_at
    ? `${s.status === "linked" ? "Linked" : s.status === "declined" ? "Declined" : "Removed"} ${formatDMY(s.responded_at)}`
    : "";
  return [requested, responded].filter(Boolean).join(" · ");
}

function LimitUsage({ label, spent, limit }: { label: string; spent: string | null; limit: string | null }) {
  if (limit == null) return <div className="text-xs text-muted-foreground">{label}: no cap</div>;
  const used = Number(spent ?? 0);
  const cap = Number(limit);
  const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 100;
  const over = used >= cap;
  return (
    <div className="space-y-0.5">
      <div className={cn("text-xs tabular-nums", over && "font-medium text-red-600 dark:text-red-400")}>
        {label}: {formatLedgerAmount(spent)} of {formatLedgerAmount(limit)}
      </div>
      <div className="h-1 w-28 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className={cn("h-full rounded-full", over ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SpendingLimits({ s }: { s: LedgerLinkedStudent }) {
  if (s.status !== "linked") return <span className="text-muted-foreground">—</span>;
  if (!s.spending_limit_enabled) return <span className="text-xs text-muted-foreground">No limits</span>;
  return (
    <div className="space-y-1.5">
      <LimitUsage label="Week" spent={s.week_spent} limit={s.weekly_limit} />
      <LimitUsage label="Month" spent={s.month_spent} limit={s.monthly_limit} />
    </div>
  );
}

function SupervisedList({ rows, compact = false }: { rows: LedgerSupervisedUser[]; compact?: boolean }) {
  if (rows.length === 0) return null;
  return (
    <section aria-label="Supervised (not linked to wallet)" className="space-y-2">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" aria-hidden />
          Supervised (not linked to wallet) · {rows.length}
        </h3>
        <p className="text-xs text-muted-foreground">
          Users whose profile names this owner as supervisor. They cannot book against this wallet until they send a wallet link request.
        </p>
      </div>
      <ul className="divide-y rounded-lg border text-sm">
        {rows.map((u) => (
          <li key={u.student_id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 px-3 py-2">
            <span className="font-medium">
              {u.name}
              {!u.is_active ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">(inactive)</span> : null}
            </span>
            <span className="text-xs text-muted-foreground">
              {[u.enrollment, u.user_type_label, u.department_name, compact ? "" : u.email].filter(Boolean).join(" · ")}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Full table of an owner's linked students (owner page tab). */
export function LinkedStudentsPanel({
  ownerId,
  onShowTransactions,
  onOpenProfile,
}: {
  ownerId: number;
  onShowTransactions: (student: StudentRef) => void;
  onOpenProfile: (studentId: number) => void;
}) {
  const [filters, setFilters] = useState<LinkedStudentFilters>(EMPTY_LINKED_STUDENT_FILTERS);
  const [searchDraft, setSearchDraft] = useState("");
  const [searchTerm, setSearchTerm] = useLiveSearchTerm(searchDraft);
  const [ordering, setOrdering] = useState("status");
  const [data, setData] = useState<LedgerLinkedStudentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  const effective = useMemo(() => ({ ...filters, search: searchTerm }), [filters, searchTerm]);
  const params = useMemo(() => linkedStudentParams(effective, ordering, ownerId), [effective, ordering, ownerId]);
  const hasRange = Boolean(params.date_from || params.date_to);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiClient.getWalletLedgerLinkedStudents(params).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.error || !res.data) {
        setError(res.error || "Could not load linked students.");
        return;
      }
      setError(null);
      setData(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [params, retry]);

  const update = (patch: Partial<LinkedStudentFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const reset = () => {
    setSearchDraft("");
    setSearchTerm("");
    setFilters(EMPTY_LINKED_STUDENT_FILTERS);
  };
  const onSort = (key: string) =>
    setOrdering((o) => (o === key ? `-${key}` : o === `-${key}` ? key : key === "name" || key === "department" || key === "status" ? key : `-${key}`));

  const active = countActive(effective, EMPTY_LINKED_STUDENT_FILTERS, ["date_from", "date_to"]);
  const rows = data?.results ?? [];
  const summary = data?.summary;
  const colSpan = hasRange ? 11 : 10;

  return (
    <div className="space-y-4">
      <section aria-label="Linked student summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <button type="button" className="text-left" onClick={() => update({ status: "linked" })} aria-label="Show linked students">
          <SummaryStat
            label="Linked"
            value={summary ? summary.linked.toLocaleString("en-IN") : "—"}
            hint="Can book against this wallet"
            icon={<Users className="h-4 w-4" aria-hidden />}
          />
        </button>
        <button type="button" className="text-left" onClick={() => update({ status: "pending" })} aria-label="Show pending requests">
          <SummaryStat
            label="Pending approval"
            value={summary ? summary.pending.toLocaleString("en-IN") : "—"}
            tone={summary && summary.pending > 0 ? "text-amber-700 dark:text-amber-300" : undefined}
            hint="Waiting for the owner"
          />
        </button>
        <SummaryStat
          label={hasRange ? "Spent in range" : "Spent from wallet"}
          value={summary ? formatLedgerAmount(hasRange ? summary.range_spent : summary.total_spent) : "—"}
          hint={hasRange && summary ? `All time ${formatLedgerAmount(summary.total_spent)}` : "Charges less refunds, students shown"}
          icon={<IndianRupee className="h-4 w-4" aria-hidden />}
        />
        <SummaryStat
          label="Spending limits"
          value={summary ? summary.with_limits.toLocaleString("en-IN") : "—"}
          hint={data ? `Week from ${formatDMY(data.period.week_start)}` : "Students with weekly or monthly caps"}
          icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
        />
      </section>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="wl-ls-search" className="text-xs">
                Search
              </Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
                <Input
                  id="wl-ls-search"
                  placeholder="Name, enrolment no., email or department"
                  className="h-9 pl-8"
                  value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                />
              </div>
            </div>
            <FilterSelect
              id="wl-ls-status"
              label="Link status"
              value={filters.status}
              onChange={(v) => update({ status: v })}
              options={data?.statuses ?? LINK_STATUS_OPTIONS}
              allLabel="Any status"
            />
            <FilterSelect
              id="wl-ls-dates"
              label="Spend period"
              value={filters.date_preset === "all" ? "" : filters.date_preset}
              onChange={(v) => update({ date_preset: (v || "all") as DatePreset })}
              options={DATE_PRESETS.filter((p) => p.value !== "all")}
              allLabel="All time"
            />
            {filters.date_preset === "custom" ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="wl-ls-from" className="text-xs">
                    From
                  </Label>
                  <DateInput id="wl-ls-from" value={filters.date_from} onChange={(e) => update({ date_from: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wl-ls-to" className="text-xs">
                    To
                  </Label>
                  <DateInput id="wl-ls-to" value={filters.date_to} onChange={(e) => update({ date_to: e.target.value })} />
                </div>
              </>
            ) : null}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Spend is booking, extra and training charges on this wallet less refunds. Limits use the current IST week and month.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {active > 0 ? (
                <Button variant="ghost" size="sm" onClick={reset}>
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  Clear filters ({active})
                </Button>
              ) : null}
              <ExportMenu
                report="admin-wallet-linked-students"
                getParams={() => params}
                description="Linked students matching the filters"
                noun="students"
                disabled={rows.length === 0}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {error ? (
            <div className="flex flex-col items-center gap-3 p-8 text-center text-sm" role="alert">
              <p className="text-destructive">{error}</p>
              <Button size="sm" variant="outline" onClick={() => setRetry((k) => k + 1)}>
                Try again
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className={cn("min-w-[1300px] text-sm", loading && "opacity-60")} aria-busy={loading} aria-label="Linked students">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">S.No</TableHead>
                    <SortHeader label="Student" sortKey="name" ordering={ordering} onSort={onSort} />
                    <SortHeader label="Department" sortKey="department" ordering={ordering} onSort={onSort} />
                    <TableHead>Category</TableHead>
                    <SortHeader label="Link status" sortKey="status" ordering={ordering} onSort={onSort} />
                    <TableHead>Books against</TableHead>
                    <TableHead>Spending limits</TableHead>
                    <SortHeader label="Total spent" sortKey="total_spent" ordering={ordering} onSort={onSort} className="text-right" />
                    {hasRange ? (
                      <SortHeader label="In period" sortKey="range_spent" ordering={ordering} onSort={onSort} className="text-right" />
                    ) : null}
                    <SortHeader label="Last booking" sortKey="last_booking" ordering={ordering} onSort={onSort} />
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && !data ? (
                    <TableRow>
                      <TableCell colSpan={colSpan} className="py-10 text-center text-muted-foreground">
                        Loading linked students…
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={colSpan} className="py-10 text-center text-muted-foreground">
                        {active > 0 ? "No students match these filters." : "No student has asked to book against this wallet yet."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((s) => (
                      <TableRow key={s.join_request_id} className="align-top" data-testid={`linked-student-${s.student_id}`}>
                        <TableCell className="tabular-nums text-muted-foreground">{s.s_no}</TableCell>
                        <TableCell>
                          <button
                            type="button"
                            className="text-left font-medium text-primary hover:underline dark:text-sky-300"
                            onClick={() => onShowTransactions({ id: s.student_id, name: s.name })}
                            title="Show this student's transactions on this wallet"
                          >
                            {s.name}
                          </button>
                          {!s.is_active ? <span className="ml-1.5 text-xs text-muted-foreground">(inactive)</span> : null}
                          {s.enrollment ? <div className="text-xs text-muted-foreground">ID: {s.enrollment}</div> : null}
                          <div className="break-all text-xs text-muted-foreground">{s.email}</div>
                        </TableCell>
                        <TableCell>{s.department_name || "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">{s.user_type_label}</TableCell>
                        <TableCell>
                          <LinkStatusBadge status={s.status} label={s.status_label} />
                          <div className="mt-1 text-xs text-muted-foreground">{linkDates(s)}</div>
                        </TableCell>
                        <TableCell>
                          {s.sub_wallets.length === 0 ? (
                            <span className="text-xs text-muted-foreground">No charges yet</span>
                          ) : (
                            <div className="flex max-w-[220px] flex-wrap gap-1">
                              {s.sub_wallets.map((w) => (
                                <span key={w.id} className="rounded-md border bg-muted/40 px-1.5 py-0.5 text-xs">
                                  {w.department_name}
                                </span>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <SpendingLimits s={s} />
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          <div className="font-semibold tabular-nums">{formatLedgerAmount(s.total_spent)}</div>
                          {Number(s.total_refunded) > 0 ? (
                            <div className="text-xs text-muted-foreground">
                              {formatLedgerAmount(s.total_charged)} charged · {formatLedgerAmount(s.total_refunded)} refunded
                            </div>
                          ) : null}
                        </TableCell>
                        {hasRange ? (
                          <TableCell className="whitespace-nowrap text-right tabular-nums">{formatLedgerAmount(s.range_spent)}</TableCell>
                        ) : null}
                        <TableCell className="whitespace-nowrap">
                          {s.last_booking_at ? formatDMYTime(s.last_booking_at) : <span className="text-muted-foreground">Never</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8"
                              onClick={() => onShowTransactions({ id: s.student_id, name: s.name })}
                              aria-label={`Transactions for ${s.name}`}
                              title="Transactions for this student's bookings"
                            >
                              <ListOrdered className="h-4 w-4" aria-hidden />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8"
                              onClick={() => onOpenProfile(s.student_id)}
                              aria-label={`Open ${s.name} in User Management`}
                              title="Open in User Management"
                            >
                              <UserCog className="h-4 w-4" aria-hidden />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {data && data.supervised.length > 0 ? (
        <Card>
          <CardContent className="p-4">
            <SupervisedList rows={data.supervised} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

/** Side drawer listing an owner's linked students from the owners table. */
export function LinkedStudentsDrawer({
  owner,
  onOpenChange,
  onOpenOwner,
}: {
  owner: { id: number; name: string } | null;
  onOpenChange: (open: boolean) => void;
  onOpenOwner: (ownerId: number, student?: StudentRef) => void;
}) {
  const [data, setData] = useState<LedgerLinkedStudentsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const ownerId = owner?.id ?? 0;

  useEffect(() => {
    if (!ownerId) return;
    let cancelled = false;
    setLoading(true);
    setData(null);
    setError(null);
    setSearch("");
    setStatus("");
    apiClient.getWalletLedgerLinkedStudents({ owner: ownerId }).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.error || !res.data) setError(res.error || "Could not load linked students.");
      else setData(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [ownerId]);

  const needle = search.trim().toLowerCase();
  const matches = (...values: string[]) => !needle || values.some((v) => (v || "").toLowerCase().includes(needle));
  const rows = (data?.results ?? []).filter(
    (s) => (!status || s.status === status) && matches(s.name, s.enrollment, s.email, s.department_name),
  );
  const supervised = status ? [] : (data?.supervised ?? []).filter((u) => matches(u.name, u.enrollment, u.email, u.department_name));

  return (
    <Sheet open={owner !== null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-4 sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 pr-8">
            <GraduationCap className="h-5 w-5 text-muted-foreground" aria-hidden />
            Linked students
          </SheetTitle>
          <SheetDescription>{owner?.name}</SheetDescription>
        </SheetHeader>

        {data ? (
          <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/30 p-3 text-center text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Linked</p>
              <p className="font-semibold tabular-nums">{data.summary.linked}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="font-semibold tabular-nums">{data.summary.pending}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Spent from wallet</p>
              <p className="font-semibold tabular-nums">{formatLedgerAmount(data.summary.total_spent)}</p>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
            <Input
              aria-label="Search linked students"
              placeholder="Name, ID, email or department"
              className="h-9 pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <FilterSelect
            id="wl-drawer-status"
            label="Link status"
            value={status}
            onChange={setStatus}
            options={data?.statuses ?? LINK_STATUS_OPTIONS}
            allLabel="Any status"
          />
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10" aria-busy>
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading linked students" />
            </div>
          ) : error ? (
            <p className="py-6 text-center text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : data ? (
            <>
              {rows.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {search || status ? "No students match." : "No student has asked to book against this wallet yet."}
                </p>
              ) : (
                <ul className="divide-y rounded-lg border text-sm" aria-label="Linked students list">
                  {rows.map((s) => (
                    <li key={s.join_request_id}>
                      <button
                        type="button"
                        className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                        onClick={() => owner && onOpenOwner(owner.id, { id: s.student_id, name: s.name })}
                        aria-label={`Open transactions for ${s.name}`}
                      >
                        <span className="min-w-0 space-y-0.5">
                          <span className="flex items-center gap-1.5 font-medium">
                            <UserRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                            <span className="truncate">{s.name}</span>
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {[s.enrollment, s.user_type_label, s.department_name].filter(Boolean).join(" · ")}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {s.last_booking_at ? `Last booking ${formatDMY(s.last_booking_at)}` : "No bookings yet"}
                            {s.spending_limit_enabled ? " · Spending limits on" : ""}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <LinkStatusBadge status={s.status} label={s.status_label} />
                          <span className="text-xs font-medium tabular-nums">{formatLedgerAmount(s.total_spent)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <SupervisedList rows={supervised} compact />
            </>
          ) : null}
        </div>

        {owner ? (
          <Button onClick={() => onOpenOwner(owner.id)} className="w-full">
            Open wallet and full student table
            <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
          </Button>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
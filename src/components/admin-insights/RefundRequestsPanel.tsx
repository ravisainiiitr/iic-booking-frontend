import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Info, Repeat, X } from "lucide-react";
import { BookingLink } from "@/components/BookingLink";
import { ExportMenu } from "@/components/ExportMenu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BreakdownBars,
  ClearFilters,
  DebouncedSearch,
  FilterSelect,
  LoadError,
  Muted,
  Pager,
  SectionCard,
  SortHeader,
  StatTile,
} from "@/components/admin-insights/InsightParts";
import { useInsights } from "@/components/admin-insights/useInsights";
import {
  EMPTY_REFUND_FILTERS,
  formatDuration,
  formatPercent,
  insightParams,
  type RefundFilters,
  type RefundRequestRow,
} from "@/lib/adminInsights";
import { apiClient } from "@/lib/api";
import { formatDMY, formatDMYTime } from "@/lib/dateFormat";
import { formatINRAmount } from "@/lib/money";
import { cn } from "@/lib/utils";

const toggle = (current: string, key: string) => (current === key ? "" : key);

const STATUS_TONE: Record<RefundRequestRow["status"], string> = {
  refunded: "border-emerald-300 text-emerald-800 dark:border-emerald-800 dark:text-emerald-300",
  approved: "border-emerald-300 text-emerald-800 dark:border-emerald-800 dark:text-emerald-300",
  pending: "border-amber-300 text-amber-800 dark:border-amber-800 dark:text-amber-300",
  rejected: "border-rose-300 text-rose-800 dark:border-rose-800 dark:text-rose-300",
  withdrawn: "border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300",
  no_refund: "border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300",
};

function money(value: number) {
  return formatINRAmount(Math.round(value));
}

/** Users who cancelled their own bookings for a refund before the slot (a tab of the Cancellations page). */
export default function RefundRequestsPanel({ initial }: { initial?: Partial<RefundFilters> }) {
  const [filters, setFilters] = useState<RefundFilters>(() => ({ ...EMPTY_REFUND_FILTERS, ...initial }));
  const [ordering, setOrdering] = useState("-requested_at");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filterParams = useMemo(() => insightParams(filters, { sort: ordering }), [filters, ordering]);
  const params = useMemo(() => ({ ...filterParams, page, page_size: pageSize }), [filterParams, page, pageSize]);
  const { data, options, loading, error, reload } = useInsights(
    (p) => apiClient.getAdminRefundRequestInsights(p),
    params,
    "Could not load refund requests.",
  );

  const update = useCallback((patch: Partial<RefundFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  }, []);
  const onSearch = useCallback((search: string) => update({ search }), [update]);
  const onSort = (key: string) => {
    setOrdering((o) => (o === `-${key}` ? key : `-${key}`));
    setPage(1);
  };

  const summary = data?.summary;
  const rows = data?.results ?? [];
  const total = data?.count ?? 0;
  const filtersActive = JSON.stringify(filters) !== JSON.stringify(EMPTY_REFUND_FILTERS);
  const rangeText = data ? `${formatDMY(data.date_from)} – ${formatDMY(data.date_to)}` : "";
  const focusedUser = filters.user
    ? summary?.repeaters.find((r) => String(r.user.id) === filters.user)?.user ?? rows[0]?.user
    : undefined;
  const exportParams = () => ({
    ...filterParams,
    date_from: filters.date_from || data?.date_from || "",
    date_to: filters.date_to || data?.date_to || "",
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <p>
          A <span className="font-semibold">refund request</span> is a user giving up their own booking for a refund
          before the slot starts: cancelling it themselves, asking the administrator to approve a cancellation, or
          releasing some of its slots. <span className="font-semibold">Within the window</span> = requested at least the
          equipment's cancellation hours ({data?.default_window_hours ?? 48} h unless set otherwise) before the slot.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            <div className="space-y-1.5">
              <Label htmlFor="rr-from" className="text-xs">
                Requested from
              </Label>
              <DateInput id="rr-from" value={filters.date_from} onValueChange={(v) => update({ date_from: v })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rr-to" className="text-xs">
                Requested to
              </Label>
              <DateInput id="rr-to" value={filters.date_to} onValueChange={(v) => update({ date_to: v })} />
            </div>
            <FilterSelect
              id="rr-source"
              label="Type"
              value={filters.source}
              onChange={(v) => update({ source: v })}
              options={options?.sources ?? []}
              allLabel="All types"
            />
            <FilterSelect
              id="rr-status"
              label="Status"
              value={filters.status}
              onChange={(v) => update({ status: v })}
              options={options?.statuses ?? []}
              allLabel="All statuses"
            />
            <FilterSelect
              id="rr-window"
              label="Window"
              value={filters.window}
              onChange={(v) => update({ window: v })}
              options={options?.windows ?? []}
              allLabel="Any time before the slot"
            />
            <FilterSelect
              id="rr-equipment"
              label="Equipment"
              value={filters.equipment}
              onChange={(v) => update({ equipment: v })}
              options={(options?.equipment ?? []).map((e) => ({
                value: String(e.id),
                label: e.code ? `${e.name} (${e.code})` : e.name,
              }))}
              allLabel="All equipment"
            />
            <FilterSelect
              id="rr-category"
              label="User category"
              value={filters.category}
              onChange={(v) => update({ category: v })}
              options={options?.categories ?? []}
              allLabel="All categories"
            />
            <FilterSelect
              id="rr-department"
              label="User's department"
              value={filters.department}
              onChange={(v) => update({ department: v })}
              options={[
                ...(options?.departments ?? []).map((d) => ({ value: String(d.id), label: d.name })),
                { value: "none", label: "None set" },
              ]}
              allLabel="All departments"
            />
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <DebouncedSearch
                value={filters.search}
                onChange={onSearch}
                label="Search refund requests"
                placeholder="Search booking ID, user, equipment…"
              />
              {filters.user ? (
                <Badge variant="secondary" className="gap-1">
                  {focusedUser ? focusedUser.name : "One user"}
                  <button type="button" aria-label="Show every user" onClick={() => update({ user: "" })}>
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                </Badge>
              ) : null}
              {filtersActive ? (
                <ClearFilters
                  onClick={() => {
                    setFilters(EMPTY_REFUND_FILTERS);
                    setPage(1);
                  }}
                />
              ) : null}
            </div>
            <ExportMenu
              report="admin-refund-requests"
              getParams={exportParams}
              description="All refund requests matching the filters, with repeat refunders"
              noun="refund requests"
              disabled={total === 0}
            />
          </div>
        </CardContent>
      </Card>

      <section aria-label="Refund request summary" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile
          label="Refund requests"
          value={summary ? summary.total : "—"}
          hint={summary ? `${rangeText} · previously ${summary.previous.total}` : undefined}
          tone={summary && summary.change > 0 ? "text-rose-600 dark:text-rose-400" : undefined}
        />
        <StatTile
          label="Of bookings made"
          value={summary ? formatPercent(summary.rate) : "—"}
          hint={summary ? `${summary.bookings_created} bookings made in these dates` : undefined}
        />
        <StatTile
          label="Booked, then refunded in the window"
          value={summary ? summary.unique_users_within_window : "—"}
          hint={summary ? `users · ${summary.within_window} requests within the window` : undefined}
          active={filters.window === "within"}
          onClick={() => update({ window: toggle(filters.window, "within") })}
        />
        <StatTile
          label="Users asking for refunds"
          value={summary ? summary.unique_users : "—"}
          hint={summary ? `previously ${summary.previous.unique_users}` : undefined}
        />
        <StatTile
          label={`Repeat refunders (${data?.repeat_min ?? 2}+)`}
          value={summary ? summary.repeat_refunders : "—"}
          hint="Users with several requests in these dates"
          tone={summary && summary.repeat_refunders > 0 ? "text-amber-600 dark:text-amber-400" : undefined}
        />
        <StatTile label="Refunded" value={summary ? money(summary.refund_total) : "—"} hint="Credited back to wallets" />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-4">
        <SectionCard title="Repeat refunders" description="Click a user to list only their requests" className="2xl:col-span-2">
          {summary && summary.repeaters.length > 0 ? (
            <ul className="divide-y">
              {summary.repeaters.map((r) => (
                <li key={r.user.id}>
                  <button
                    type="button"
                    onClick={() => update({ user: filters.user === String(r.user.id) ? "" : String(r.user.id) })}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 px-1 py-2 text-left text-sm hover:bg-muted/50",
                      filters.user === String(r.user.id) && "bg-primary/5",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Repeat className="h-3.5 w-3.5 text-amber-600" aria-hidden />
                        {r.user.name}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {[r.user.category_display, r.user.department].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-xs">
                      <span className="block font-semibold tabular-nums">{r.count} requests</span>
                      <span className="text-muted-foreground">
                        {r.within_window} in window · {money(r.refund_total)} · last{" "}
                        {r.last_requested_at ? formatDMY(r.last_requested_at) : "—"}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">No user asked more than once.</p>
          )}
        </SectionCard>
        <SectionCard title="By type">
          <BreakdownBars
            items={summary?.by_source ?? []}
            selected={filters.source}
            onSelect={(key) => update({ source: toggle(filters.source, key) })}
          />
        </SectionCard>
        <SectionCard title="By status">
          <BreakdownBars
            items={(summary?.by_status ?? []).filter((s) => s.count > 0)}
            selected={filters.status}
            onSelect={(key) => update({ status: toggle(filters.status, key) })}
            color="bg-emerald-500/80"
          />
        </SectionCard>
        <SectionCard title="Window" description="Requested before or inside the cancellation cut-off">
          <BreakdownBars
            items={summary?.by_window ?? []}
            selected={filters.window}
            onSelect={(key) => key !== "unknown" && update({ window: toggle(filters.window, key) })}
            color="bg-amber-500/80"
          />
        </SectionCard>
        <SectionCard title="By equipment" description="Top 15">
          <BreakdownBars
            items={(summary?.by_equipment ?? []).map((e) => ({
              key: String(e.id),
              label: e.code ? `${e.label} (${e.code})` : e.label,
              count: e.count,
            }))}
            selected={filters.equipment}
            onSelect={(key) => update({ equipment: toggle(filters.equipment, key) })}
            color="bg-sky-500/80"
          />
        </SectionCard>
      </div>

      <Card>
        <CardContent className="p-0">
          {error ? (
            <LoadError message={error} onRetry={reload} />
          ) : (
            <Table
              serialStart={(page - 1) * pageSize + 1}
              scrollPane
              containerProps={{ role: "region", "aria-label": "Refund requests", tabIndex: 0 }}
              className={cn("min-w-[1500px] text-sm", loading && "opacity-60")}
              aria-busy={loading}
            >
              <TableHeader className="z-20 bg-card">
                <TableRow className="hover:bg-transparent">
                  <TableHead>Booking ID</TableHead>
                  <TableHead className="min-w-[170px]">User</TableHead>
                  <TableHead className="min-w-[170px]">Equipment</TableHead>
                  <TableHead>Type</TableHead>
                  <SortHeader label="Requested" sortKey="requested_at" ordering={ordering} onSort={onSort} />
                  <SortHeader label="Slot" sortKey="slot" ordering={ordering} onSort={onSort} />
                  <SortHeader label="Ahead of slot" sortKey="lead" ordering={ordering} onSort={onSort} />
                  <TableHead>Window</TableHead>
                  <TableHead>Status</TableHead>
                  <SortHeader label="Refund" sortKey="refund" ordering={ordering} onSort={onSort} />
                  <TableHead>Wallet transaction</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && !loading ? (
                  <TableRow>
                    <TableCell colSpan={12} className="py-10 text-center text-muted-foreground">
                      {filtersActive ? "No refund requests match these filters." : "No refund requests in this period."}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.id} className="hover:bg-muted/50">
                      <TableCell className="whitespace-nowrap">
                        <BookingLink pk={r.booking.pk} displayId={r.booking.display_id} />
                        <div className="text-xs text-muted-foreground">{r.booking.status_display}</div>
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          className="text-left font-medium text-primary underline-offset-2 hover:underline"
                          onClick={() => update({ user: String(r.user.id) })}
                          title="Only this user's requests"
                        >
                          {r.user.name}
                        </button>
                        <div className="text-xs text-muted-foreground">
                          {[r.user.category_display, r.user.department].filter(Boolean).join(" · ")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link
                          to={`/equipment/${r.equipment.id}`}
                          className="font-medium text-primary underline-offset-2 hover:underline"
                        >
                          {r.equipment.name}
                        </Link>
                        {r.equipment.code ? <div className="text-xs text-muted-foreground">{r.equipment.code}</div> : null}
                      </TableCell>
                      <TableCell>
                        <div className="whitespace-nowrap text-xs">{r.source_display}</div>
                        {r.note ? (
                          <div className="line-clamp-2 max-w-[220px] break-words text-xs text-muted-foreground" title={r.note}>
                            {r.note}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {r.requested_at ? formatDMYTime(r.requested_at) : <Muted />}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{r.slot_start ? formatDMYTime(r.slot_start) : <Muted />}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {r.lead_minutes == null ? <Muted /> : formatDuration(r.lead_minutes)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {r.within_window == null ? (
                          <Muted>Not known</Muted>
                        ) : r.within_window ? (
                          <span className="text-emerald-700 dark:text-emerald-400">Yes ({r.window_hours} h)</span>
                        ) : (
                          <span className="text-amber-700 dark:text-amber-400">No ({r.window_hours} h)</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("whitespace-nowrap text-[0.65rem]", STATUS_TONE[r.status])}>
                          {r.status_display}
                        </Badge>
                        {r.responded_at ? (
                          <div className="mt-0.5 text-[0.68rem] text-muted-foreground">{formatDMYTime(r.responded_at)}</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="tabular-nums">{r.refund != null ? money(r.refund) : <Muted />}</TableCell>
                      <TableCell className="text-xs">
                        {r.wallet_transaction ? (
                          <>
                            {r.wallet_transaction.wallet_owner_id ? (
                              <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
                                <Link to={`/admin/wallet-ledger/${r.wallet_transaction.wallet_owner_id}`}>
                                  Credit #{r.wallet_transaction.id}
                                </Link>
                              </Button>
                            ) : (
                              <span>Credit #{r.wallet_transaction.id}</span>
                            )}
                            <div className="text-muted-foreground">
                              {money(r.wallet_transaction.amount)}
                              {r.wallet_transaction.created_at ? ` · ${formatDMYTime(r.wallet_transaction.created_at)}` : ""}
                            </div>
                          </>
                        ) : (
                          <Muted />
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
          <Pager
            page={page}
            pageSize={pageSize}
            total={total}
            loading={loading}
            noun="refund requests"
            onPage={setPage}
            onPageSize={(v) => {
              setPageSize(v);
              setPage(1);
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

import { useCallback, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarX2, Info } from "lucide-react";
import { PageHero, PageShell, StandaloneOnly } from "@/components/PageShell";
import { BookingLink } from "@/components/BookingLink";
import { ExportMenu } from "@/components/ExportMenu";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RefundRequestsPanel from "@/components/admin-insights/RefundRequestsPanel";
import {
  BreakdownBars,
  ClearFilters,
  DebouncedSearch,
  DonutChart,
  FilterSelect,
  LoadError,
  Muted,
  Pager,
  SectionCard,
  SortHeader,
  StatTile,
  TrendChart,
} from "@/components/admin-insights/InsightParts";
import { useInsights } from "@/components/admin-insights/useInsights";
import {
  CHART_COLORS,
  EMPTY_CANCELLATION_FILTERS,
  EMPTY_REFUND_FILTERS,
  filtersFromSearch,
  formatDuration,
  formatPercent,
  insightParams,
  type CancellationFilters,
  type CancellationRow,
  type NamedCount,
} from "@/lib/adminInsights";
import { apiClient } from "@/lib/api";
import { formatDMY, formatDMYTime } from "@/lib/dateFormat";
import { formatINRAmount } from "@/lib/money";
import { cn } from "@/lib/utils";

const toggle = (current: string, key: string) => (current === key ? "" : key);
const dayFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });

const QUALITY_TONE: Record<CancellationRow["data_quality"], string> = {
  RECORDED: "border-emerald-300 text-emerald-800 dark:border-emerald-800 dark:text-emerald-300",
  FROM_HISTORY: "border-sky-300 text-sky-800 dark:border-sky-800 dark:text-sky-300",
  INFERRED: "border-amber-300 text-amber-800 dark:border-amber-800 dark:text-amber-300",
};

const REFILL_TONE: Record<CancellationRow["refill"], string> = {
  waitlist: "text-emerald-700 dark:text-emerald-400",
  rebooked: "text-sky-700 dark:text-sky-400",
  not_refilled: "text-muted-foreground",
  unknown: "italic text-muted-foreground",
};

const named = (items: NamedCount[] | undefined) =>
  (items ?? []).map((i) => ({
    key: i.id == null ? "none" : String(i.id),
    label: i.code ? `${i.label} (${i.code})` : i.label,
    count: i.count,
    detail: i.late ? `${i.late} late` : undefined,
  }));

function money(value: number) {
  return formatINRAmount(Math.round(value));
}

function changeText(current: number, previous: number) {
  const diff = current - previous;
  if (diff === 0) return "Same as the previous period";
  const pct = previous > 0 ? ` (${diff > 0 ? "+" : "−"}${Math.round((Math.abs(diff) / previous) * 100)}%)` : "";
  return `${diff > 0 ? "▲" : "▼"} ${Math.abs(diff)} vs previous period${pct}`;
}

export default function CancellationsDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get("view") === "refunds" ? "refunds" : "cancellations";
  const switchView = (next: string) =>
    setSearchParams(
      (prev) => {
        const out = new URLSearchParams(prev);
        if (next === "refunds") out.set("view", "refunds");
        else out.delete("view");
        return out;
      },
      { replace: true },
    );
  const [refundInitial] = useState(() => filtersFromSearch(EMPTY_REFUND_FILTERS, searchParams));
  const [filters, setFilters] = useState<CancellationFilters>(() =>
    filtersFromSearch(EMPTY_CANCELLATION_FILTERS, searchParams),
  );
  const [ordering, setOrdering] = useState("-cancelled_at");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filterParams = useMemo(() => insightParams(filters, { sort: ordering }), [filters, ordering]);
  const params = useMemo(() => ({ ...filterParams, page, page_size: pageSize }), [filterParams, page, pageSize]);
  const { data, options, loading, error, reload } = useInsights(
    (p) => apiClient.getAdminCancellationInsights(p),
    params,
    "Could not load cancellations.",
  );

  const update = useCallback((patch: Partial<CancellationFilters>) => {
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
  const filtersActive = JSON.stringify(filters) !== JSON.stringify(EMPTY_CANCELLATION_FILTERS);
  const exportParams = () => ({
    ...filterParams,
    date_from: filters.date_from || data?.date_from || "",
    date_to: filters.date_to || data?.date_to || "",
  });
  const trendData = (summary?.trend.series ?? []).map((s) => ({
    ...s,
    onTime: s.count - s.late,
    label: dayFormat.format(new Date(`${s.period}T00:00:00`)),
  }));
  const rangeText = data ? `${formatDMY(data.date_from)} – ${formatDMY(data.date_to)}` : "";
  const previous = summary?.previous;

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-[1600px] space-y-4 px-3 py-4 sm:px-6">
        <StandaloneOnly>
          <PageHero
            compact
            icon={<CalendarX2 className="h-5 w-5" />}
            title="Cancellations"
            description="Who cancelled, why, how late, what was refunded and whether the freed slots were re-booked."
          />
        </StandaloneOnly>

        <Tabs value={view} onValueChange={switchView}>
          <TabsList>
            <TabsTrigger value="cancellations">Cancellations</TabsTrigger>
            <TabsTrigger value="refunds">Refund requests</TabsTrigger>
          </TabsList>
        </Tabs>

        {view === "refunds" ? (
          <RefundRequestsPanel initial={refundInitial} />
        ) : (
        <>
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
              <div className="space-y-1.5">
                <Label htmlFor="cd-from" className="text-xs">
                  Cancelled from
                </Label>
                <DateInput id="cd-from" value={filters.date_from} onValueChange={(v) => update({ date_from: v })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cd-to" className="text-xs">
                  Cancelled to
                </Label>
                <DateInput id="cd-to" value={filters.date_to} onValueChange={(v) => update({ date_to: v })} />
              </div>
              <FilterSelect
                id="cd-equipment"
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
                id="cd-role"
                label="Cancelled by"
                value={filters.role}
                onChange={(v) => update({ role: v })}
                options={options?.roles ?? []}
                allLabel="Anyone"
              />
              <FilterSelect
                id="cd-reason"
                label="Reason"
                value={filters.reason}
                onChange={(v) => update({ reason: v })}
                options={options?.reasons ?? []}
                allLabel="All reasons"
              />
              <FilterSelect
                id="cd-category"
                label="User category"
                value={filters.category}
                onChange={(v) => update({ category: v })}
                options={options?.categories ?? []}
                allLabel="All categories"
              />
              <FilterSelect
                id="cd-department"
                label="User's department"
                value={filters.department}
                onChange={(v) => update({ department: v })}
                options={[
                  ...(options?.departments ?? []).map((d) => ({ value: String(d.id), label: d.name })),
                  { value: "none", label: "None set" },
                ]}
                allLabel="All departments"
              />
              <FilterSelect
                id="cd-oic"
                label="Officer-in-Charge"
                value={filters.oic}
                onChange={(v) => update({ oic: v })}
                options={(options?.oics ?? []).map((o) => ({ value: String(o.id), label: o.name }))}
                allLabel="All OICs"
              />
              <FilterSelect
                id="cd-quality"
                label="Data quality"
                value={filters.data_quality}
                onChange={(v) => update({ data_quality: v })}
                options={options?.data_qualities ?? []}
                allLabel="All records"
              />
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <DebouncedSearch
                  value={filters.search}
                  onChange={onSearch}
                  label="Search cancellations"
                  placeholder="Search booking ID, user, equipment, note…"
                />
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={filters.late_only} onCheckedChange={(c) => update({ late_only: c === true })} />
                  Late only (under 24 h)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={filters.include_no_shows}
                    onCheckedChange={(c) => update({ include_no_shows: c === true })}
                  />
                  Include no-shows
                </label>
                {filtersActive ? (
                  <ClearFilters
                    onClick={() => {
                      setFilters(EMPTY_CANCELLATION_FILTERS);
                      setPage(1);
                    }}
                  />
                ) : null}
              </div>
              <ExportMenu
                report="admin-cancellations"
                getParams={exportParams}
                description="All cancellations matching the filters"
                noun="cancellations"
                disabled={total === 0}
              />
            </div>
          </CardContent>
        </Card>

        <section aria-label="Summary" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatTile
            label="Cancellations"
            value={summary ? summary.total : "—"}
            hint={summary ? `${rangeText} · ${changeText(summary.total, summary.previous.total)}` : undefined}
            tone={summary && summary.change > 0 ? "text-rose-600 dark:text-rose-400" : undefined}
          />
          <StatTile
            label="Cancellation rate"
            value={summary ? formatPercent(summary.rate) : "—"}
            hint={
              summary && previous
                ? `of ${summary.bookings_created} bookings made · previously ${formatPercent(previous.rate)}`
                : undefined
            }
          />
          <StatTile
            label="Late (under 24 h)"
            value={summary ? summary.late : "—"}
            hint={summary ? `${formatPercent(summary.late_share, 0)} of cancellations` : undefined}
            tone={summary && summary.late > 0 ? "text-amber-600 dark:text-amber-400" : undefined}
            active={filters.late_only}
            onClick={() => update({ late_only: !filters.late_only })}
          />
          <StatTile
            label="Refunded"
            value={summary ? money(summary.refund_total) : "—"}
            hint={
              summary
                ? `${summary.refunded_count} refunds${summary.refund_estimated ? ` · ${summary.refund_estimated} estimated` : ""}`
                : undefined
            }
          />
          <StatTile
            label="Charges retained"
            value={summary ? money(summary.retained_total) : "—"}
            hint={summary ? `of ${money(summary.charge_total)} charged` : undefined}
          />
          <StatTile
            label="Refund not known"
            value={summary ? summary.refund_unknown : "—"}
            hint="Older records without the refund"
            tone={summary && summary.refund_unknown > 0 ? "text-amber-600 dark:text-amber-400" : undefined}
          />
        </section>

        {summary && summary.by_data_quality.some((q) => q.key !== "RECORDED" && q.count > 0) ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <p>
              Cancellations made before this dashboard existed were rebuilt from booking history (
              <span className="font-semibold">From history</span>) or, where no history was kept, from the booking status
              alone (<span className="font-semibold">Inferred</span> — who cancelled, the reason and the refund may be
              unknown). Refunds that were not recorded are estimated as the full charge for refunded or lab-stopped
              bookings.
            </p>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <SectionCard
            title="Cancellations over time"
            description={`Per ${summary?.trend.granularity ?? "day"}; late = under 24 h before the slot`}
            className="xl:col-span-2"
          >
            <TrendChart
              data={trendData}
              series={[
                { key: "onTime", label: "24 h or more before", color: CHART_COLORS[0] },
                { key: "late", label: "Late", color: CHART_COLORS[2] },
              ]}
            />
          </SectionCard>
          <SectionCard title="Who cancelled">
            <DonutChart label="Cancellations by who cancelled" items={summary?.by_role ?? []} />
            <BreakdownBars
              items={summary?.by_role ?? []}
              selected={filters.role}
              onSelect={(key) => update({ role: toggle(filters.role, key) })}
            />
          </SectionCard>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-4">
          <SectionCard title="Reasons">
            <BreakdownBars
              items={summary?.by_reason ?? []}
              selected={filters.reason}
              onSelect={(key) => key !== "none" && update({ reason: toggle(filters.reason, key) })}
            />
          </SectionCard>
          <SectionCard title="How far ahead" description="Time between cancelling and the first booked slot">
            <BreakdownBars items={summary?.by_lead_time ?? []} limit={7} color="bg-amber-500/80" />
          </SectionCard>
          <SectionCard title="By user category">
            <BreakdownBars
              items={summary?.by_category ?? []}
              selected={filters.category}
              onSelect={(key) => update({ category: toggle(filters.category, key) })}
              color="bg-violet-500/80"
            />
          </SectionCard>
          <SectionCard title="Freed slots re-booked" description="From the waitlist or by another booking">
            <BreakdownBars items={summary?.refills ?? []} color="bg-emerald-500/80" />
          </SectionCard>
          <SectionCard title="By equipment" description="Top 15">
            <BreakdownBars
              items={named(summary?.by_equipment)}
              selected={filters.equipment}
              onSelect={(key) => key !== "none" && update({ equipment: toggle(filters.equipment, key) })}
            />
          </SectionCard>
          <SectionCard title="By user's department" description="Top 15">
            <BreakdownBars
              items={named(summary?.by_department)}
              selected={filters.department}
              onSelect={(key) => update({ department: toggle(filters.department, key) })}
              color="bg-sky-500/80"
            />
          </SectionCard>
          <SectionCard title="By Officer-in-Charge" description="Top 15; equipment with several OICs counts for each">
            <BreakdownBars
              items={named(summary?.by_oic)}
              selected={filters.oic}
              onSelect={(key) => key !== "none" && update({ oic: toggle(filters.oic, key) })}
              color="bg-violet-500/80"
            />
          </SectionCard>
          <SectionCard title="Data quality">
            <BreakdownBars
              items={summary?.by_data_quality ?? []}
              selected={filters.data_quality}
              onSelect={(key) => update({ data_quality: toggle(filters.data_quality, key) })}
              color="bg-slate-500/80"
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
                containerProps={{ role: "region", "aria-label": "Cancellations", tabIndex: 0 }}
                className={cn("min-w-[1700px] text-sm", loading && "opacity-60")}
                aria-busy={loading}
              >
                <TableHeader className="z-20 bg-card">
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Booking ID</TableHead>
                    <TableHead className="min-w-[170px]">User</TableHead>
                    <TableHead className="min-w-[180px]">Equipment</TableHead>
                    <SortHeader label="Slot" sortKey="slot" ordering={ordering} onSort={onSort} />
                    <SortHeader label="Cancelled" sortKey="cancelled_at" ordering={ordering} onSort={onSort} />
                    <TableHead>Cancelled by</TableHead>
                    <TableHead className="min-w-[200px]">Reason</TableHead>
                    <SortHeader label="Ahead of slot" sortKey="lead" ordering={ordering} onSort={onSort} />
                    <SortHeader label="Charge" sortKey="charge" ordering={ordering} onSort={onSort} />
                    <SortHeader label="Refund" sortKey="refund" ordering={ordering} onSort={onSort} />
                    <TableHead>Slots re-booked</TableHead>
                    <TableHead>Record</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 && !loading ? (
                    <TableRow>
                      <TableCell colSpan={13} className="py-10 text-center text-muted-foreground">
                        {filtersActive ? "No cancellations match these filters." : "No cancellations in this period."}
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
                          <div className="font-medium">{r.user.name}</div>
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
                        <TableCell className="whitespace-nowrap">
                          {r.slot_start ? formatDMYTime(r.slot_start) : <Muted />}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {r.cancelled_at ? formatDMYTime(r.cancelled_at) : <Muted />}
                        </TableCell>
                        <TableCell>
                          <div className="whitespace-nowrap">{r.actor_role_display}</div>
                          {r.cancelled_by ? <div className="text-xs text-muted-foreground">{r.cancelled_by}</div> : null}
                        </TableCell>
                        <TableCell>
                          <div>{r.reason_display}</div>
                          {r.note ? (
                            <div className="line-clamp-2 break-words text-xs text-muted-foreground" title={r.note}>
                              {r.note}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {r.lead_minutes == null ? (
                            <Muted />
                          ) : r.lead_minutes < 0 ? (
                            <span className="text-rose-600 dark:text-rose-400">After start</span>
                          ) : (
                            formatDuration(r.lead_minutes)
                          )}
                          {r.late ? (
                            <Badge variant="outline" className="ml-1.5 border-amber-300 text-[0.65rem] text-amber-800 dark:text-amber-300">
                              Late
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell className="tabular-nums">{r.charge ? money(r.charge) : <Muted />}</TableCell>
                        <TableCell className="tabular-nums">
                          {r.refund == null ? (
                            <span className="text-xs italic text-amber-700 dark:text-amber-400">Not known</span>
                          ) : (
                            <>
                              {money(r.refund)}
                              {r.refund_estimated ? <div className="text-[0.68rem] text-muted-foreground">estimated</div> : null}
                            </>
                          )}
                        </TableCell>
                        <TableCell className={cn("text-xs", REFILL_TONE[r.refill])}>{r.refill_display}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("whitespace-nowrap text-[0.65rem]", QUALITY_TONE[r.data_quality])}>
                            {r.data_quality_display}
                          </Badge>
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
              noun="cancellations"
              onPage={setPage}
              onPageSize={(v) => {
                setPageSize(v);
                setPage(1);
              }}
            />
          </CardContent>
        </Card>
        </>
        )}
      </div>
    </PageShell>
  );
}

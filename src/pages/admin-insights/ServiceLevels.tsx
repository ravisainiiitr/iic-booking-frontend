import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Gauge, Info } from "lucide-react";
import { PageHero, PageShell, StandaloneOnly } from "@/components/PageShell";
import { ExportMenu } from "@/components/ExportMenu";
import { Card, CardContent } from "@/components/ui/card";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DepartmentPicker, useDepartmentParam } from "@/components/admin-insights/DepartmentPicker";
import {
  ClearFilters,
  FilterSelect,
  LoadError,
  Muted,
  Pager,
  SectionCard,
  SortHeader,
  StatTile,
} from "@/components/admin-insights/InsightParts";
import { useInsights } from "@/components/admin-insights/useInsights";
import { EMPTY_SERVICE_LEVEL_FILTERS, formatPercent, insightParams, type ServiceLevelFilters } from "@/lib/adminInsights";
import { apiClient } from "@/lib/api";
import { formatDMY } from "@/lib/dateFormat";

/** "12 h" below two days, "3.5 days" from there; turnaround spans both. */
export function formatTurnaround(hours: number | null | undefined): string {
  if (hours == null) return "—";
  if (hours < 48) return `${Number(hours.toFixed(1))} h`;
  return `${Number((hours / 24).toFixed(1))} days`;
}

function formatDays(days: number | null | undefined): string {
  if (days == null) return "—";
  return `${Number(days.toFixed(1))} ${days === 1 ? "day" : "days"}`;
}

/** Previous period's figure beside the current one; it states the figure and never calls a change good or bad. */
function previousText(text: string, available: boolean) {
  return available ? `Previous period: ${text}` : "No figure for the previous period";
}

export default function ServiceLevels() {
  const [filters, setFilters] = useState<ServiceLevelFilters>(EMPTY_SERVICE_LEVEL_FILTERS);
  const [ordering, setOrdering] = useState("-bookings");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [dept, setDeptParam] = useDepartmentParam();

  const filterParams = useMemo(
    () => insightParams(filters, { sort: ordering, dept: dept || undefined }),
    [filters, ordering, dept],
  );
  const params = useMemo(() => ({ ...filterParams, page, page_size: pageSize }), [filterParams, page, pageSize]);
  const { data, options, loading, error, reload } = useInsights(
    (p) => apiClient.getAdminServiceLevels(p),
    params,
    "Could not load service levels.",
    dept,
  );
  const setDept = useCallback(
    (value: string) => {
      setDeptParam(value);
      setFilters((f) => ({ ...f, equipment: "" }));
      setPage(1);
    },
    [setDeptParam],
  );
  const update = useCallback((patch: Partial<ServiceLevelFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  }, []);
  const onSort = (key: string) => {
    setOrdering((o) => (o === `-${key}` ? key : `-${key}`));
    setPage(1);
  };

  const summary = data?.summary;
  const previous = summary?.previous;
  const rows = data?.results ?? [];
  const total = data?.count ?? 0;
  const filtersActive = JSON.stringify(filters) !== JSON.stringify(EMPTY_SERVICE_LEVEL_FILTERS);
  const exportParams = () => ({
    ...filterParams,
    date_from: filters.date_from || data?.date_from || "",
    date_to: filters.date_to || data?.date_to || "",
  });
  const header = (label: string, key: string, className = "text-right") => (
    <SortHeader label={label} sortKey={key} ordering={ordering} onSort={onSort} className={className} />
  );

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-[1600px] space-y-4 px-3 py-4 sm:px-6">
        <StandaloneOnly>
          <PageHero
            compact
            icon={<Gauge className="h-5 w-5" />}
            title="Service levels"
            description="How long users wait, how quickly results arrive and how reliably each instrument serves them."
          />
        </StandaloneOnly>

        <DepartmentPicker departments={data?.departments} value={dept} onChange={setDept} />

        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 p-4">
            <div className="space-y-1">
              <Label htmlFor="sl-from">From</Label>
              <DateInput id="sl-from" value={filters.date_from} onValueChange={(v) => update({ date_from: v })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sl-to">To</Label>
              <DateInput id="sl-to" value={filters.date_to} onValueChange={(v) => update({ date_to: v })} />
            </div>
            <FilterSelect
              id="sl-equipment"
              label="Equipment"
              value={filters.equipment}
              onChange={(v) => update({ equipment: v })}
              options={(options?.equipment ?? []).map((e) => ({
                value: String(e.id),
                label: e.code ? `${e.name} (${e.code})` : e.name,
              }))}
              allLabel="All equipment"
            />
            {filtersActive ? <ClearFilters onClick={() => update(EMPTY_SERVICE_LEVEL_FILTERS)} /> : null}
            <div className="ml-auto">
              <ExportMenu
                report="admin-service-levels"
                getParams={exportParams}
                description="Service levels for every instrument matching the filters"
                noun="instruments"
                disabled={total === 0}
              />
            </div>
          </CardContent>
        </Card>

        {data ? (
          <p className="text-sm text-muted-foreground">
            {formatDMY(data.date_from)} – {formatDMY(data.date_to)}, compared with {formatDMY(data.previous_from)} –{" "}
            {formatDMY(data.previous_to)}.
          </p>
        ) : null}

        <section aria-label="Summary" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <StatTile
            label="Bookings"
            value={summary?.bookings ?? "—"}
            hint={previous ? previousText(String(previous.bookings), true) : undefined}
          />
          <StatTile
            label="Booking lead"
            value={formatDays(summary?.lead_days)}
            hint={previous ? previousText(formatDays(previous.lead_days), previous.lead_days != null) : undefined}
          />
          <StatTile
            label="Results turnaround"
            value={formatTurnaround(summary?.turnaround_hours)}
            hint={
              previous
                ? previousText(formatTurnaround(previous.turnaround_hours), previous.turnaround_hours != null)
                : undefined
            }
          />
          <StatTile
            label="No-show rate"
            value={formatPercent(summary?.no_show_rate)}
            hint={previous ? previousText(formatPercent(previous.no_show_rate), previous.no_show_rate != null) : undefined}
          />
          <StatTile
            label="Utilisation"
            value={formatPercent(summary?.utilisation)}
            hint={previous ? previousText(formatPercent(previous.utilisation), previous.utilisation != null) : undefined}
          />
        </section>

        <SectionCard
          title="By instrument"
          description={
            <span className="inline-flex items-start gap-1.5">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                Medians, counted in the period of each booking's first slot. Turnaround runs from the end of the last
                slot to the first results notice, and only covers bookings with one; no figure means none were timed.
              </span>
            </span>
          }
        >
          {error ? (
            <LoadError message={error} onRetry={reload} />
          ) : !loading && rows.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No instrument had slots or bookings in these dates.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {header("Equipment", "name", "")}
                      {header("Bookings", "bookings")}
                      {header("Booking lead", "lead")}
                      {header("Turnaround", "turnaround")}
                      {header("Results awaited", "awaited")}
                      {header("No-show", "no_show")}
                      {header("Cancelled", "cancellation")}
                      {header("Lab-stopped", "lab_stopped")}
                      {header("Rating", "rating")}
                      {header("Utilisation", "utilisation")}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.equipment_id}>
                        <TableCell className="min-w-[220px]">
                          <Link to={`/equipment/${r.equipment_id}`} className="font-medium hover:underline">
                            {r.name}
                          </Link>
                          <div className="text-xs text-muted-foreground">
                            {[r.code, r.department].filter(Boolean).join(" · ")}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{r.bookings}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.lead_days == null ? <Muted /> : formatDays(r.lead_days)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.turnaround_hours == null ? (
                            <Muted />
                          ) : (
                            <>
                              {formatTurnaround(r.turnaround_hours)}
                              <div className="text-xs text-muted-foreground">{r.results_timed} timed</div>
                            </>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{r.results_awaited}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.no_show_rate == null ? <Muted /> : formatPercent(r.no_show_rate)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.cancellation_rate == null ? <Muted /> : formatPercent(r.cancellation_rate)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.lab_stopped_rate == null ? <Muted /> : formatPercent(r.lab_stopped_rate)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.rating == null ? (
                            <Muted />
                          ) : (
                            <>
                              {r.rating.toFixed(1)}
                              <div className="text-xs text-muted-foreground">{r.rated} rated</div>
                            </>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.utilisation == null ? <Muted /> : formatPercent(r.utilisation)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pager
                page={page}
                pageSize={pageSize}
                total={total}
                loading={loading}
                noun="instruments"
                onPage={setPage}
                onPageSize={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
            </>
          )}
        </SectionCard>
      </div>
    </PageShell>
  );
}

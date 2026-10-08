import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Paperclip, RotateCcw, Search, Wrench } from "lucide-react";
import { PageHero, PageShell, StandaloneOnly } from "@/components/PageShell";
import { ExportMenu } from "@/components/ExportMenu";
import { RowsPerPageSelect } from "@/components/RowsPerPageSelect";
import { DisruptionDetailSheet } from "@/components/disruptions/DisruptionDetailSheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiClient } from "@/lib/api";
import { formatDMYTime } from "@/lib/dateFormat";
import {
  EMPTY_DISRUPTION_FILTERS,
  disruptionFilterParams,
  filtersFromSearchParams,
  formatDurationHours,
  notifyDisruptionsChanged,
  type DisruptionFilters,
  type DisruptionListResponse,
  type DisruptionRecord,
} from "@/lib/disruptions";
import { cn } from "@/lib/utils";

const ALL = "__all__";

const TYPE_TONE: Record<string, string> = {
  UNDER_MAINTENANCE: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200",
  SCHEDULED_MAINTENANCE: "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200",
  OPERATOR_ABSENT: "bg-sky-100 text-sky-900 dark:bg-sky-950/60 dark:text-sky-200",
  OTHER: "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
};

type SortKey = "start_at" | "end_at" | "equipment" | "type" | "slots_affected" | "bookings_affected" | "started_at";

function SortHeader({
  label,
  sortKey,
  ordering,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  ordering: string;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = ordering.replace(/^-/, "") === sortKey;
  const desc = ordering.startsWith("-");
  const Icon = !active ? ArrowUpDown : desc ? ArrowDown : ArrowUp;
  return (
    <TableHead className={className} aria-sort={active ? (desc ? "descending" : "ascending") : "none"}>
      <button
        type="button"
        className="inline-flex items-center gap-1 font-medium hover:text-foreground"
        onClick={() => onSort(sortKey)}
      >
        {label}
        <Icon className={cn("h-3.5 w-3.5", !active && "opacity-40")} aria-hidden />
      </button>
    </TableHead>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  allLabel: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Select value={value || ALL} onValueChange={(v) => onChange(v === ALL ? "" : v)}>
        <SelectTrigger id={id} className="h-9">
          <SelectValue placeholder={allLabel} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SummaryCard({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className={cn("mt-1 text-2xl font-semibold tabular-nums", tone)}>{value}</p>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function MissingText({ value, missing }: { value: string; missing: boolean }) {
  if (missing || !value) return <span className="text-xs italic text-amber-700 dark:text-amber-400">Not recorded</span>;
  return <span className="line-clamp-2 break-words">{value}</span>;
}

export default function DisruptionHistory() {
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState<DisruptionFilters>(() => filtersFromSearchParams(searchParams));
  const [searchDraft, setSearchDraft] = useState(filters.search);
  const [ordering, setOrdering] = useState("-start_at");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [data, setData] = useState<DisruptionListResponse | null>(null);
  const [options, setOptions] = useState<Pick<DisruptionListResponse, "equipment_options" | "department_options">>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const optionsLoaded = useRef(false);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setFilters((f) => (f.search === searchDraft.trim() ? f : { ...f, search: searchDraft.trim() }));
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchDraft]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params: Record<string, string | number | boolean> = {
      ...disruptionFilterParams(filters, ordering),
      page,
      page_size: pageSize,
    };
    if (!optionsLoaded.current) params.with_options = true;
    apiClient.getDisruptions(params).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.error || !res.data) {
        setError(res.error || "Could not load disruptions.");
        return;
      }
      setError(null);
      setData(res.data);
      if (res.data.equipment_options) {
        optionsLoaded.current = true;
        setOptions({ equipment_options: res.data.equipment_options, department_options: res.data.department_options });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [filters, ordering, page, pageSize, reloadKey]);

  const update = useCallback((patch: Partial<DisruptionFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  }, []);

  const resetFilters = () => {
    setSearchDraft("");
    setFilters(EMPTY_DISRUPTION_FILTERS);
    setPage(1);
  };

  const onSort = (key: SortKey) => {
    setOrdering((o) => (o === `-${key}` ? key : `-${key}`));
    setPage(1);
  };

  const equipmentOptions = useMemo(() => {
    const list = options.equipment_options ?? [];
    const dept = filters.department ? Number(filters.department) : null;
    return list
      .filter((e) => dept == null || e.department_id === dept)
      .map((e) => ({ value: String(e.id), label: e.code ? `${e.name} (${e.code})` : e.name }));
  }, [options.equipment_options, filters.department]);

  const departmentOptions = (options.department_options ?? []).map((d) => ({ value: String(d.id), label: d.name }));
  const typeOptions = data?.types ?? [];
  const sourceOptions = data?.sources ?? [];
  const summary = data?.summary;
  const total = data?.count ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const filtersActive = JSON.stringify(filters) !== JSON.stringify(EMPTY_DISRUPTION_FILTERS);
  const rows: DisruptionRecord[] = data?.results ?? [];

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-[1600px] space-y-4 px-3 py-4 sm:px-6">
        <StandaloneOnly>
          <PageHero
            compact
            icon={<Wrench className="h-5 w-5" />}
            title="Disruption history"
            description="Every maintenance, operator absence and other disruption, with reasons, actions taken and service reports."
          />
        </StandaloneOnly>

        <section aria-label="Summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard label="Disruptions" value={summary ? String(summary.total) : "—"} hint="Matching the filters" />
          <SummaryCard
            label="Disruption hours"
            value={summary ? formatDurationHours(summary.total_hours) : "—"}
            hint="Within the date range"
          />
          <SummaryCard
            label="Open now"
            value={summary ? String(summary.open_now) : "—"}
            tone={summary && summary.open_now > 0 ? "text-red-600 dark:text-red-400" : undefined}
          />
          <SummaryCard
            label="Reason not recorded"
            value={summary ? String(summary.reason_missing) : "—"}
            tone={summary && summary.reason_missing > 0 ? "text-amber-600 dark:text-amber-400" : undefined}
          />
        </section>
        {summary && summary.by_type.length > 0 ? (
          <div className="flex flex-wrap gap-2" aria-label="By type">
            {summary.by_type.map((t) => (
              <button
                key={t.type}
                type="button"
                onClick={() => update({ type: filters.type === t.type ? "" : t.type })}
                aria-pressed={filters.type === t.type}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium ring-offset-background transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  TYPE_TONE[t.type],
                  filters.type === t.type && "ring-2 ring-primary"
                )}
              >
                {t.label}: {t.count} · {formatDurationHours(t.hours)} h
              </button>
            ))}
          </div>
        ) : null}

        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
              <div className="space-y-1.5">
                <Label htmlFor="dh-from" className="text-xs">
                  From
                </Label>
                <DateInput id="dh-from" value={filters.date_from} onValueChange={(v) => update({ date_from: v })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dh-to" className="text-xs">
                  To
                </Label>
                <DateInput id="dh-to" value={filters.date_to} onValueChange={(v) => update({ date_to: v })} />
              </div>
              {data?.can_filter_department ? (
                <FilterSelect
                  id="dh-department"
                  label="Department"
                  value={filters.department}
                  onChange={(v) => update({ department: v, equipment: "" })}
                  options={departmentOptions}
                  allLabel="All departments"
                />
              ) : null}
              <FilterSelect
                id="dh-equipment"
                label="Equipment"
                value={filters.equipment}
                onChange={(v) => update({ equipment: v })}
                options={equipmentOptions}
                allLabel="All equipment"
              />
              <FilterSelect
                id="dh-type"
                label="Type"
                value={filters.type}
                onChange={(v) => update({ type: v })}
                options={typeOptions}
                allLabel="All types"
              />
              <FilterSelect
                id="dh-status"
                label="Status"
                value={filters.status}
                onChange={(v) => update({ status: v })}
                options={[
                  { value: "open", label: "Open" },
                  { value: "closed", label: "Closed" },
                ]}
                allLabel="Open and closed"
              />
              <FilterSelect
                id="dh-source"
                label="Recorded from"
                value={filters.source}
                onChange={(v) => update({ source: v })}
                options={sourceOptions}
                allLabel="Anywhere"
              />
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <div className="relative w-full sm:w-72">
                  <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
                  <Input
                    aria-label="Search disruptions"
                    placeholder="Search equipment, reason, action…"
                    className="h-9 pl-8"
                    value={searchDraft}
                    onChange={(e) => setSearchDraft(e.target.value)}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={filters.reason_missing}
                    onCheckedChange={(c) => update({ reason_missing: c === true })}
                  />
                  Reason not recorded
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={filters.action_missing}
                    onCheckedChange={(c) => update({ action_missing: c === true })}
                  />
                  Action not recorded
                </label>
                {filtersActive ? (
                  <Button variant="ghost" size="sm" onClick={resetFilters}>
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                    Clear filters
                  </Button>
                ) : null}
              </div>
              <ExportMenu
                report="disruption-history"
                getParams={() => disruptionFilterParams(filters, ordering)}
                description="All disruptions matching the filters"
                noun="disruptions"
                disabled={total === 0}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {error ? (
              <div className="flex flex-col items-center gap-3 p-8 text-center text-sm">
                <p className="text-destructive">{error}</p>
                <Button size="sm" variant="outline" onClick={() => setReloadKey((k) => k + 1)}>
                  Try again
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className={cn("min-w-[1400px] text-sm", loading && "opacity-60")} aria-busy={loading}>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">S.No</TableHead>
                      <SortHeader label="Equipment" sortKey="equipment" ordering={ordering} onSort={onSort} />
                      <SortHeader label="Type" sortKey="type" ordering={ordering} onSort={onSort} />
                      <TableHead>Scope</TableHead>
                      <SortHeader label="Start" sortKey="start_at" ordering={ordering} onSort={onSort} />
                      <SortHeader label="End" sortKey="end_at" ordering={ordering} onSort={onSort} />
                      <TableHead className="text-right">Duration (h)</TableHead>
                      <SortHeader label="Slots" sortKey="slots_affected" ordering={ordering} onSort={onSort} className="text-right" />
                      <SortHeader
                        label="Bookings"
                        sortKey="bookings_affected"
                        ordering={ordering}
                        onSort={onSort}
                        className="text-right"
                      />
                      <TableHead className="min-w-[180px]">Reason</TableHead>
                      <TableHead className="min-w-[180px]">Action taken</TableHead>
                      <TableHead>Report</TableHead>
                      <TableHead>Started by</TableHead>
                      <TableHead>Ended by</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 && !loading ? (
                      <TableRow>
                        <TableCell colSpan={15} className="py-10 text-center text-muted-foreground">
                          {filtersActive ? "No disruptions match these filters." : "No disruptions recorded yet."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((r, i) => (
                        <TableRow
                          key={r.id}
                          tabIndex={0}
                          className="cursor-pointer align-top hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                          onClick={() => setOpenId(r.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setOpenId(r.id);
                            }
                          }}
                          aria-label={`Open ${r.disruption_type_display} on ${r.equipment_name}`}
                        >
                          <TableCell className="tabular-nums text-muted-foreground">
                            {r.s_no ?? (page - 1) * pageSize + i + 1}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{r.equipment_name}</div>
                            {r.department_name ? (
                              <div className="text-xs text-muted-foreground">{r.department_name}</div>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", TYPE_TONE[r.disruption_type])}>
                              {r.disruption_type_display}
                            </span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs">{r.scope_display}</TableCell>
                          <TableCell className="whitespace-nowrap">{formatDMYTime(r.start_at) || "—"}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            {r.end_at ? formatDMYTime(r.end_at) : <span className="text-muted-foreground">Ongoing</span>}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{formatDurationHours(r.duration_hours)}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.slots_affected ?? "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.bookings_affected}</TableCell>
                          <TableCell>
                            {r.reason_category_display ? (
                              <div className="text-xs font-medium text-muted-foreground">{r.reason_category_display}</div>
                            ) : null}
                            <MissingText value={r.reason} missing={r.reason_missing} />
                          </TableCell>
                          <TableCell>
                            <MissingText value={r.action_taken} missing={r.action_missing} />
                          </TableCell>
                          <TableCell>
                            {r.service_reports.length > 0 ? (
                              <span className="inline-flex items-center gap-1 text-xs">
                                <Paperclip className="h-3.5 w-3.5" aria-hidden />
                                {r.service_reports.length}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{r.started_by_name || "—"}</TableCell>
                          <TableCell className="whitespace-nowrap">{r.ended_by_name || "—"}</TableCell>
                          <TableCell>
                            <Badge variant={r.status === "OPEN" ? "destructive" : "secondary"}>
                              {r.status === "OPEN" ? "Open" : "Closed"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="flex flex-col gap-3 border-t border-border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted-foreground">
                {total === 0
                  ? "0 disruptions"
                  : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
              </span>
              <div className="flex items-center gap-3">
                <RowsPerPageSelect
                  value={pageSize}
                  onChange={(v) => {
                    setPageSize(v);
                    setPage(1);
                  }}
                />
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  aria-label="Previous page"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="tabular-nums">
                  Page {page} of {pages}
                </span>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  aria-label="Next page"
                  disabled={page >= pages || loading}
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <DisruptionDetailSheet
        eventId={openId}
        onClose={() => setOpenId(null)}
        onChanged={() => {
          setReloadKey((k) => k + 1);
          notifyDisruptionsChanged();
        }}
      />
    </PageShell>
  );
}

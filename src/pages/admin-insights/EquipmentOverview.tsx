import { useCallback, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Wrench } from "lucide-react";
import { PageHero, PageShell, StandaloneOnly } from "@/components/PageShell";
import { ExportMenu } from "@/components/ExportMenu";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
} from "@/components/admin-insights/InsightParts";
import { DepartmentPicker, useDepartmentParam } from "@/components/admin-insights/DepartmentPicker";
import { StaffProficiencyPanels } from "@/components/admin-insights/StaffProficiency";
import { useInsights } from "@/components/admin-insights/useInsights";
import {
  EMPTY_EQUIPMENT_FILTERS,
  filtersFromSearch,
  formatDuration,
  formatPercent,
  insightParams,
  type EquipmentFilters,
  type EquipmentInsightRow,
} from "@/lib/adminInsights";
import { apiClient } from "@/lib/api";
import { formatDMYTime } from "@/lib/dateFormat";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<EquipmentInsightRow["status_group"], string> = {
  operational: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200",
  under_maintenance: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200",
  other: "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
  disposed: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

const toggle = (current: string, key: string) => (current === key ? "" : key);

export default function EquipmentOverview() {
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState<EquipmentFilters>(() => filtersFromSearch(EMPTY_EQUIPMENT_FILTERS, searchParams));
  const [ordering, setOrdering] = useState("name");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [dept, setDeptParam] = useDepartmentParam();
  const [includeProfile, setIncludeProfile] = useState(() => Boolean(filters.profile_type));

  const filterParams = useMemo(
    () => insightParams(filters, { sort: ordering, dept: dept || undefined }),
    [filters, ordering, dept],
  );
  const params = useMemo(() => ({ ...filterParams, page, page_size: pageSize }), [filterParams, page, pageSize]);
  const { data, options, loading, error, reload } = useInsights(
    (p) => apiClient.getAdminEquipmentInsights(p),
    params,
    "Could not load the equipment overview.",
    dept,
  );
  const setDept = useCallback(
    (value: string) => {
      setDeptParam(value);
      setFilters((f) => ({ ...f, department: "", category: "", oic: "" }));
      setPage(1);
    },
    [setDeptParam],
  );

  const update = useCallback((patch: Partial<EquipmentFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  }, []);
  const onSearch = useCallback((search: string) => update({ search }), [update]);
  const onSort = (key: string) => {
    setOrdering((o) => (o === key ? `-${key}` : key));
    setPage(1);
  };

  const summary = data?.summary;
  const card = data?.card;
  const rows = data?.results ?? [];
  const total = data?.count ?? 0;
  const institute = data?.scope === "institute" && !dept;
  const filtersActive = JSON.stringify(filters) !== JSON.stringify(EMPTY_EQUIPMENT_FILTERS);
  const statusCount = (key: string) => summary?.by_status.find((s) => s.key === key)?.count ?? 0;

  const categoryOptions = [
    ...(options?.categories ?? []).map((c) => ({ value: String(c.id), label: c.name })),
    { value: "none", label: "No category" },
  ];
  const oicOptions = [
    ...(options?.oics ?? []).map((o) => ({ value: String(o.id), label: o.name })),
    { value: "none", label: "No OIC assigned" },
  ];
  const statusOptions = [...(options?.statuses ?? []), { value: "all", label: "All, including disposed" }];

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-[1600px] space-y-4 px-3 py-4 sm:px-6">
        <StandaloneOnly>
          <PageHero
            compact
            icon={<Wrench className="h-5 w-5" />}
            title="Equipment overview"
            description="Status, ownership, downtime, upcoming bookings and utilisation of every instrument, and how promptly Lab Operators and Officers in Charge clear their pending work."
          />
        </StandaloneOnly>

        <DepartmentPicker departments={data?.departments} value={dept} onChange={setDept} equipmentOwnersOnly />

        <section aria-label="Summary" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatTile
            label="Equipment"
            value={summary ? summary.total : "—"}
            hint={
              card && !filtersActive
                ? `Dashboard card: ${card.operational}/${card.total} operational`
                : "Matching the filters (disposed excluded)"
            }
          />
          <StatTile
            label="Operational"
            value={summary ? statusCount("operational") : "—"}
            tone="text-emerald-700 dark:text-emerald-400"
            active={filters.status === "operational"}
            onClick={() => update({ status: toggle(filters.status, "operational") })}
          />
          <StatTile
            label="Under maintenance"
            value={summary ? statusCount("under_maintenance") : "—"}
            hint="Repair, maintenance or inactive"
            tone={statusCount("under_maintenance") > 0 ? "text-red-600 dark:text-red-400" : undefined}
            active={filters.status === "under_maintenance"}
            onClick={() => update({ status: toggle(filters.status, "under_maintenance") })}
          />
          <StatTile
            label="Other status"
            value={summary ? statusCount("other") : "—"}
            active={filters.status === "other"}
            onClick={() => update({ status: toggle(filters.status, "other") })}
          />
          <StatTile label="Upcoming bookings" value={summary ? summary.upcoming_bookings : "—"} hint="Booked, held or pending" />
          <StatTile
            label={`Utilisation (${summary?.utilisation_days ?? 30} days)`}
            value={summary ? formatPercent(summary.utilisation) : "—"}
            hint={
              <>
                {summary?.utilisation_formula ?? "Booked hours ÷ available hours"}
                {summary?.utilisation_period_note ? <span className="block">{summary.utilisation_period_note}</span> : null}
              </>
            }
          />
        </section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <SectionCard title="By status">
            <DonutChart label="Equipment by status" items={summary?.by_status ?? []} />
          </SectionCard>
          <SectionCard title={institute ? "By department" : "By category / lab"}>
            {institute ? (
              <BreakdownBars
                items={(summary?.by_department ?? []).map((d) => ({ ...d, key: String(d.key) }))}
                selected={dept}
                onSelect={(key) => key !== "none" && setDept(toggle(dept, key))}
              />
            ) : (
              <BreakdownBars
                items={(summary?.by_category ?? []).map((d) => ({ ...d, key: String(d.key) }))}
                selected={filters.category}
                onSelect={(key) => update({ category: toggle(filters.category, key) })}
              />
            )}
          </SectionCard>
          <SectionCard title="By Officer-in-Charge" description="Equipment with several OICs counts for each">
            <BreakdownBars
              items={(summary?.by_oic ?? []).map((d) => ({ ...d, key: String(d.key) }))}
              selected={filters.oic}
              onSelect={(key) => update({ oic: toggle(filters.oic, key) })}
              color="bg-violet-500/80"
            />
          </SectionCard>
          {includeProfile ? (
            <SectionCard title="By profile type">
              <BreakdownBars
                items={(summary?.by_profile_type ?? []).map((d) => ({ ...d, key: String(d.key) }))}
                selected={filters.profile_type}
                onSelect={(key) => update({ profile_type: toggle(filters.profile_type, key) })}
                color="bg-emerald-500/80"
              />
            </SectionCard>
          ) : null}
          {institute ? (
            <SectionCard title="By category / lab" className="lg:col-span-3">
              <BreakdownBars
                items={(summary?.by_category ?? []).map((d) => ({ ...d, key: String(d.key) }))}
                selected={filters.category}
                onSelect={(key) => update({ category: toggle(filters.category, key) })}
                limit={12}
              />
            </SectionCard>
          ) : null}
        </div>

        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
              <FilterSelect
                id="eo-status"
                label="Status"
                value={filters.status}
                onChange={(v) => update({ status: v })}
                options={statusOptions}
                allLabel="All except disposed"
              />
              <FilterSelect
                id="eo-category"
                label="Category / lab"
                value={filters.category}
                onChange={(v) => update({ category: v })}
                options={categoryOptions}
                allLabel="All categories"
              />
              <FilterSelect
                id="eo-oic"
                label="Officer-in-Charge"
                value={filters.oic}
                onChange={(v) => update({ oic: v })}
                options={oicOptions}
                allLabel="All OICs"
              />
              {includeProfile ? (
                <FilterSelect
                  id="eo-profile"
                  label="Profile type"
                  value={filters.profile_type}
                  onChange={(v) => update({ profile_type: v })}
                  options={[...(options?.profile_types ?? []), { value: "none", label: "Not set" }]}
                  allLabel="All profile types"
                />
              ) : null}
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <DebouncedSearch
                  value={filters.search}
                  onChange={onSearch}
                  label="Search equipment"
                  placeholder="Search name or code…"
                />
                <label htmlFor="eo-include-profile" className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    id="eo-include-profile"
                    checked={includeProfile}
                    onCheckedChange={(checked) => {
                      setIncludeProfile(checked === true);
                      if (checked !== true && filters.profile_type) update({ profile_type: "" });
                    }}
                  />
                  Include profile type
                </label>
                {filtersActive ? (
                  <ClearFilters
                    onClick={() => {
                      setFilters(EMPTY_EQUIPMENT_FILTERS);
                      setPage(1);
                    }}
                  />
                ) : null}
              </div>
              <ExportMenu
                report="admin-equipment-overview"
                getParams={() => (includeProfile ? { ...filterParams, include_profile_type: "1" } : filterParams)}
                description="All equipment matching the filters"
                noun="equipment"
                disabled={total === 0}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {error ? (
              <LoadError message={error} onRetry={reload} />
            ) : (
              <Table
                serialStart={(page - 1) * pageSize + 1}
                scrollPane
                containerProps={{ role: "region", "aria-label": "Equipment", tabIndex: 0 }}
                className={cn("min-w-[1400px] text-sm", loading && "opacity-60")}
                aria-busy={loading}
              >
                <TableHeader className="z-20 bg-card">
                  <TableRow className="hover:bg-transparent">
                    <SortHeader label="Equipment" sortKey="name" ordering={ordering} onSort={onSort} className="min-w-[220px]" />
                    <SortHeader label="Status" sortKey="status" ordering={ordering} onSort={onSort} />
                    <TableHead>Category / lab</TableHead>
                    {institute ? <TableHead>Department</TableHead> : null}
                    <TableHead className="min-w-[180px]">Officer-in-Charge</TableHead>
                    <SortHeader label="Last status change" sortKey="last_change" ordering={ordering} onSort={onSort} />
                    <SortHeader label="Down since" sortKey="down_since" ordering={ordering} onSort={onSort} />
                    <SortHeader label="Upcoming bookings" sortKey="upcoming" ordering={ordering} onSort={onSort} />
                    <SortHeader label="Utilisation (30 d)" sortKey="utilisation" ordering={ordering} onSort={onSort} />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 && !loading ? (
                    <TableRow>
                      <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                        {filtersActive ? "No equipment matches these filters." : "No equipment yet."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((r) => (
                      <TableRow key={r.equipment_id} className="hover:bg-muted/50">
                        <TableCell>
                          <Link
                            to={`/equipment/${r.equipment_id}`}
                            className="font-medium text-primary underline-offset-2 hover:underline"
                          >
                            {r.name}
                          </Link>
                          <div className="text-xs text-muted-foreground">
                            {[r.code, r.parent_equipment ? `Mode of ${r.parent_equipment.name}` : ""].filter(Boolean).join(" · ")}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", STATUS_TONE[r.status_group])}
                            title={r.status_group_display}
                          >
                            {r.status_display}
                          </span>
                        </TableCell>
                        <TableCell>{r.category?.name ?? <Muted />}</TableCell>
                        {institute ? <TableCell>{r.department?.name ?? <Muted />}</TableCell> : null}
                        <TableCell>
                          {r.officers_in_charge.length ? (
                            r.officers_in_charge.map((o) => (
                              <div key={o.id} className="whitespace-nowrap">
                                {o.name}
                              </div>
                            ))
                          ) : (
                            <span className="text-xs italic text-amber-700 dark:text-amber-400">None assigned</span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {r.last_status_change ? formatDMYTime(r.last_status_change) : <Muted />}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {r.down_since ? (
                            <>
                              <div>{formatDMYTime(r.down_since)}</div>
                              <div className="text-xs text-red-600 dark:text-red-400">
                                {formatDuration((r.downtime_hours ?? 0) * 60)} down
                              </div>
                            </>
                          ) : (
                            <Muted />
                          )}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          <div>{r.upcoming_bookings}</div>
                          {r.next_booking_at ? (
                            <div className="whitespace-nowrap text-xs text-muted-foreground">Next {formatDMYTime(r.next_booking_at)}</div>
                          ) : null}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {r.utilisation == null ? (
                            <Muted>{r.utilisation_counted_under ? "Counted on parent" : "No hours available"}</Muted>
                          ) : (
                            <div className="mx-auto w-28">
                              <div className="text-sm font-medium">{formatPercent(r.utilisation)}</div>
                              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-primary/80"
                                  style={{ width: `${Math.min(100, r.utilisation * 100)}%` }}
                                />
                              </div>
                              <div className="mt-0.5 text-[0.68rem] text-muted-foreground">
                                {r.booked_hours_30d} of {r.slot_hours_30d} h
                              </div>
                            </div>
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
              noun="equipment"
              onPage={setPage}
              onPageSize={(v) => {
                setPageSize(v);
                setPage(1);
              }}
            />
          </CardContent>
        </Card>

        <StaffProficiencyPanels dept={dept} />
      </div>
    </PageShell>
  );
}

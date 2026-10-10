import { useCallback, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Info, Users, Wallet } from "lucide-react";
import { PageHero, PageShell, StandaloneOnly } from "@/components/PageShell";
import { ExportMenu } from "@/components/ExportMenu";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
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
  TrendChart,
} from "@/components/admin-insights/InsightParts";
import { useInsights } from "@/components/admin-insights/useInsights";
import UserCardDrawer from "@/components/admin-insights/UserCardDrawer";
import {
  CHART_COLORS,
  EMPTY_USER_FILTERS,
  filtersFromSearch,
  insightParams,
  type UserFilters,
} from "@/lib/adminInsights";
import { apiClient } from "@/lib/api";
import { formatDMY, formatDMYTime } from "@/lib/dateFormat";
import { cn } from "@/lib/utils";

const toggle = (current: string, key: string) => (current === key ? "" : key);
const monthFormat = new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit" });
const weekFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });

/** The list API reads an empty status as "active"; "" here means active and inactive. */
function userQuery(filters: UserFilters, extra: Record<string, string>) {
  return insightParams({ ...filters, status: filters.status || "all" }, extra);
}

export default function UsersOverview() {
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState<UserFilters>(() => filtersFromSearch(EMPTY_USER_FILTERS, searchParams));
  const [ordering, setOrdering] = useState("-joined");
  const [trend, setTrend] = useState<"month" | "week">("month");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [cardUser, setCardUser] = useState<number | null>(() => {
    const raw = searchParams.get("user");
    return raw && /^\d+$/.test(raw) ? Number(raw) : null;
  });

  const filterParams = useMemo(() => userQuery(filters, { sort: ordering, trend }), [filters, ordering, trend]);
  const params = useMemo(() => ({ ...filterParams, page, page_size: pageSize }), [filterParams, page, pageSize]);
  const { data, options, loading, error, reload } = useInsights(
    (p) => apiClient.getAdminUserInsights(p),
    params,
    "Could not load the users overview.",
  );

  const update = useCallback((patch: Partial<UserFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  }, []);
  const onSearch = useCallback((search: string) => update({ search }), [update]);
  const onOrganisation = useCallback((organisation: string) => update({ organisation }), [update]);
  const onSort = (key: string) => {
    setOrdering((o) => (o === `-${key}` ? key : `-${key}`));
    setPage(1);
  };

  const summary = data?.summary;
  const rows = data?.results ?? [];
  const total = data?.count ?? 0;
  const filtersActive = JSON.stringify(filters) !== JSON.stringify(EMPTY_USER_FILTERS);
  const bookedRange = Boolean(filters.booked_from || filters.booked_to);

  const trendData = (summary?.trend.series ?? []).map((s) => {
    const d = new Date(`${s.period}T00:00:00`);
    return { ...s, label: (summary?.trend.granularity === "week" ? weekFormat : monthFormat).format(d) };
  });
  const categoryOptions = (options?.categories ?? []).filter(
    (c) => !filters.segment || c.segment === filters.segment,
  );

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-[1600px] space-y-4 px-3 py-4 sm:px-6">
        <StandaloneOnly>
          <PageHero
            compact
            icon={<Users className="h-5 w-5" />}
            title="Users overview"
            description="Who uses the facility: categories, programmes, departments, organisations and sign-up trends."
          />
        </StandaloneOnly>

        <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <p>
            <span className="font-semibold">Active</span> = {data?.definitions.active ?? "account enabled (can sign in). Test accounts are never counted."}{" "}
            {bookedRange ? (
              <>
                <span className="font-semibold">Booked in period</span> = {data?.definitions.booked_in_period}
              </>
            ) : null}
          </p>
        </div>

        <section aria-label="Summary" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatTile
            label="Users"
            value={summary ? summary.total.toLocaleString("en-IN") : "—"}
            hint={data?.card && filters.status === "active" && !filtersActive ? `Dashboard card: ${data.card.active.toLocaleString("en-IN")} active` : "Matching the filters"}
          />
          <StatTile
            label="Active"
            value={summary ? summary.active.toLocaleString("en-IN") : "—"}
            tone="text-emerald-700 dark:text-emerald-400"
            active={filters.status === "active"}
            onClick={() => update({ status: filters.status === "active" ? "" : "active" })}
          />
          <StatTile
            label="Inactive"
            value={summary ? summary.inactive.toLocaleString("en-IN") : "—"}
            hint={filters.status === "active" ? "Select to list inactive users" : undefined}
            active={filters.status === "inactive"}
            onClick={() => update({ status: filters.status === "inactive" ? "" : "inactive" })}
          />
          <StatTile
            label="Internal (IITR)"
            value={summary ? summary.internal.toLocaleString("en-IN") : "—"}
            active={filters.segment === "internal"}
            onClick={() => update({ segment: toggle(filters.segment, "internal"), category: "" })}
          />
          <StatTile
            label="External"
            value={summary ? summary.external.toLocaleString("en-IN") : "—"}
            active={filters.segment === "external"}
            onClick={() => update({ segment: toggle(filters.segment, "external"), category: "" })}
          />
          <StatTile label="New in 30 days" value={summary ? summary.new_last_30_days.toLocaleString("en-IN") : "—"} />
        </section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          <SectionCard title="By category">
            <DonutChart label="Users by category" items={summary?.by_category ?? []} />
            <BreakdownBars
              items={summary?.by_category.filter((c) => c.count > 0) ?? []}
              selected={filters.category}
              onSelect={(key) => update({ category: toggle(filters.category, key) })}
              limit={9}
            />
          </SectionCard>
          <SectionCard title="IITR Students by programme" description="Post-doc from the registration type; others from the Channel i degree">
            <BreakdownBars
              items={summary?.by_programme ?? []}
              selected={filters.programme}
              onSelect={(key) => update({ programme: toggle(filters.programme, key) })}
              color="bg-emerald-500/80"
            />
          </SectionCard>
          <SectionCard
            title="New users"
            description={`Sign-ups per ${trend}, internal and external`}
            className="lg:col-span-2 2xl:col-span-1"
            action={
              <div className="flex rounded-md border border-border p-0.5 text-xs" role="group" aria-label="Trend period">
                {(["month", "week"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={trend === g}
                    onClick={() => setTrend(g)}
                    className={cn("rounded px-2 py-0.5 capitalize", trend === g ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
                  >
                    {g === "month" ? "Monthly" : "Weekly"}
                  </button>
                ))}
              </div>
            }
          >
            <TrendChart
              data={trendData}
              series={[
                { key: "internal", label: "Internal", color: CHART_COLORS[0] },
                { key: "external", label: "External", color: CHART_COLORS[2] },
              ]}
            />
          </SectionCard>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <SectionCard title="Internal users by department" description="Faculty, students, staff and startups">
            <Table serial={false} className="text-sm" containerProps={{ className: "max-h-[360px]" }}>
              <TableHeader className="bg-card">
                <TableRow>
                  <TableHead>Department</TableHead>
                  <TableHead>Faculty</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead>Startups</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(summary?.internal_by_department ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      No internal users match.
                    </TableCell>
                  </TableRow>
                ) : (
                  summary?.internal_by_department.map((d) => (
                    <TableRow key={d.id ?? "none"}>
                      <TableCell className="text-left">
                        {d.id ? (
                          <button
                            type="button"
                            className="text-left font-medium text-primary underline-offset-2 hover:underline"
                            onClick={() => update({ department: toggle(filters.department, String(d.id)) })}
                          >
                            {d.name}
                          </button>
                        ) : (
                          d.name
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums">{d.faculty}</TableCell>
                      <TableCell className="tabular-nums">{d.students}</TableCell>
                      <TableCell className="tabular-nums">{d.staff}</TableCell>
                      <TableCell className="tabular-nums">{d.startups}</TableCell>
                      <TableCell className="font-semibold tabular-nums">{d.total}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </SectionCard>
          <SectionCard title="External users by organisation" description="Top 50 organisations">
            <Table serial={false} className="text-sm" containerProps={{ className: "max-h-[360px]" }}>
              <TableHeader className="bg-card">
                <TableRow>
                  <TableHead>Organisation</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Users</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(summary?.external_by_organisation ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      No external users match.
                    </TableCell>
                  </TableRow>
                ) : (
                  summary?.external_by_organisation.map((o) => (
                    <TableRow key={o.id ?? "none"}>
                      <TableCell className="text-left">
                        {o.id ? (
                          <button
                            type="button"
                            className="text-left font-medium text-primary underline-offset-2 hover:underline"
                            onClick={() => update({ department: toggle(filters.department, String(o.id)) })}
                          >
                            {o.name}
                          </button>
                        ) : (
                          o.name
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{o.type || <Muted />}</TableCell>
                      <TableCell className="text-xs">{o.state || <Muted />}</TableCell>
                      <TableCell className="font-semibold tabular-nums">{o.count}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </SectionCard>
          <SectionCard title="External users by state" className="xl:col-span-2">
            <BreakdownBars items={summary?.external_by_state ?? []} limit={10} color="bg-amber-500/80" empty="No external users match." />
          </SectionCard>
        </div>

        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
              <FilterSelect
                id="uo-status"
                label="Account"
                value={filters.status}
                onChange={(v) => update({ status: v })}
                options={[
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                ]}
                allLabel="Active and inactive"
              />
              <FilterSelect
                id="uo-segment"
                label="Internal / external"
                value={filters.segment}
                onChange={(v) => update({ segment: v, category: "" })}
                options={[
                  { value: "internal", label: "Internal (IITR)" },
                  { value: "external", label: "External" },
                ]}
                allLabel="Internal and external"
              />
              <FilterSelect
                id="uo-category"
                label="Category"
                value={filters.category}
                onChange={(v) => update({ category: v })}
                options={categoryOptions}
                allLabel="All categories"
              />
              <FilterSelect
                id="uo-programme"
                label="Programme (students)"
                value={filters.programme}
                onChange={(v) => update({ programme: v })}
                options={options?.programmes ?? []}
                allLabel="All programmes"
              />
              <FilterSelect
                id="uo-department"
                label="Department / organisation"
                value={filters.department}
                onChange={(v) => update({ department: v })}
                options={[
                  ...(options?.departments ?? []).map((d) => ({ value: String(d.id), label: d.name })),
                  { value: "none", label: "None set" },
                ]}
                allLabel="All"
              />
              <div className="space-y-1.5">
                <Label className="text-xs">Organisation name</Label>
                <DebouncedSearch
                  value={filters.organisation}
                  onChange={onOrganisation}
                  label="Organisation name contains"
                  placeholder="Contains…"
                  className="sm:w-full"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="uo-joined-from" className="text-xs">
                  Joined from
                </Label>
                <DateInput id="uo-joined-from" value={filters.joined_from} onValueChange={(v) => update({ joined_from: v })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="uo-joined-to" className="text-xs">
                  Joined to
                </Label>
                <DateInput id="uo-joined-to" value={filters.joined_to} onValueChange={(v) => update({ joined_to: v })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="uo-booked-from" className="text-xs">
                  Booked from
                </Label>
                <DateInput id="uo-booked-from" value={filters.booked_from} onValueChange={(v) => update({ booked_from: v })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="uo-booked-to" className="text-xs">
                  Booked to
                </Label>
                <DateInput id="uo-booked-to" value={filters.booked_to} onValueChange={(v) => update({ booked_to: v })} />
              </div>
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <DebouncedSearch
                  value={filters.search}
                  onChange={onSearch}
                  label="Search users"
                  placeholder="Search name, email, mobile, ID…"
                />
                <label className={cn("flex items-center gap-2 text-sm", !bookedRange && "opacity-50")}>
                  <Checkbox
                    checked={filters.not_booked}
                    disabled={!bookedRange}
                    onCheckedChange={(c) => update({ not_booked: c === true })}
                  />
                  Did not book in these dates
                </label>
                {filtersActive ? (
                  <ClearFilters
                    onClick={() => {
                      setFilters(EMPTY_USER_FILTERS);
                      setPage(1);
                    }}
                  />
                ) : null}
              </div>
              <ExportMenu
                report="admin-users-overview"
                getParams={() => filterParams}
                description="All users matching the filters"
                noun="users"
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
                containerProps={{ role: "region", "aria-label": "Users", tabIndex: 0 }}
                className={cn("min-w-[1400px] text-sm", loading && "opacity-60")}
                aria-busy={loading}
              >
                <TableHeader className="z-20 bg-card">
                  <TableRow className="hover:bg-transparent">
                    <SortHeader label="Name" sortKey="name" ordering={ordering} onSort={onSort} className="min-w-[180px]" />
                    <TableHead>Category</TableHead>
                    <TableHead className="min-w-[180px]">Department / organisation</TableHead>
                    <SortHeader label="Email" sortKey="email" ordering={ordering} onSort={onSort} />
                    <TableHead>Mobile</TableHead>
                    <SortHeader label="Joined" sortKey="joined" ordering={ordering} onSort={onSort} />
                    <SortHeader label="Last booking" sortKey="last_booking" ordering={ordering} onSort={onSort} />
                    <SortHeader label="Bookings" sortKey="bookings" ordering={ordering} onSort={onSort} />
                    <TableHead>Wallet</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 && !loading ? (
                    <TableRow>
                      <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                        {filtersActive ? "No users match these filters." : "No users yet."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((r) => (
                      <TableRow key={r.id} className="hover:bg-muted/50">
                        <TableCell>
                          <button
                            type="button"
                            className="text-left font-medium text-primary underline-offset-2 hover:underline"
                            onClick={() => setCardUser(r.id)}
                            title="Open the user card"
                          >
                            {r.name || r.email || `User ${r.id}`}
                          </button>
                          {!r.is_active ? <div className="text-xs text-amber-700 dark:text-amber-400">Inactive</div> : null}
                        </TableCell>
                        <TableCell>
                          <div className="whitespace-nowrap">{r.category_display}</div>
                          <div className="text-xs text-muted-foreground">
                            {r.programme_display || (r.user_type_display !== r.category_display ? r.user_type_display : "")}
                          </div>
                        </TableCell>
                        <TableCell>{r.department?.name ?? <Muted />}</TableCell>
                        <TableCell className="break-all text-xs">
                          {r.email ? (
                            <a href={`mailto:${r.email}`} className="text-primary underline-offset-2 hover:underline">
                              {r.email}
                            </a>
                          ) : (
                            <Muted />
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{r.phone || <Muted />}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDMY(r.date_joined) || <Muted />}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {r.last_booking_at ? formatDMYTime(r.last_booking_at) : <Muted>Never</Muted>}
                        </TableCell>
                        <TableCell className="tabular-nums">{r.bookings_count}</TableCell>
                        <TableCell>
                          {r.wallet_owner_id ? (
                            <Button asChild variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs">
                              <Link to={`/admin/wallet-ledger/${r.wallet_owner_id}`}>
                                <Wallet className="h-3.5 w-3.5" aria-hidden />
                                {r.wallet_owner_id === r.id ? "Wallet" : "Supervisor's"}
                              </Link>
                            </Button>
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
              noun="users"
              onPage={setPage}
              onPageSize={(v) => {
                setPageSize(v);
                setPage(1);
              }}
            />
          </CardContent>
        </Card>
      </div>
      <UserCardDrawer userId={cardUser} onClose={() => setCardUser(null)} />
    </PageShell>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CalendarRange, ChevronRight, IndianRupee, Layers, Loader2, Users } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { BookingLink } from "@/components/BookingLink";
import { EquipmentLink } from "@/components/EquipmentLink";
import { ExportMenu } from "@/components/ExportMenu";
import { UserIdCardLink } from "@/components/users/UserIdCardLink";
import { ReportKpiCard } from "@/components/reports/ReportKpiCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiClient, type ReportDrillBookings, type ReportDrillUsers } from "@/lib/api";
import {
  drillApiParams,
  drilldownPath,
  formatInr,
  parseDrillTarget,
  reportPath,
  type DrillTarget,
} from "@/lib/reportDrilldown";

type View = "users" | "bookings";

const formatSlot = (start: string | null, end: string | null) => {
  if (!start) return "—";
  const s = new Date(start);
  const date = s.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const time = (d: Date) => d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  return end ? `${date}, ${time(s)} – ${time(new Date(end))}` : `${date}, ${time(s)}`;
};

const STATUS_TONE: Record<string, string> = {
  COMPLETED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  BOOKED: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  PROCESSING: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200",
  BOOKING_NOT_UTILIZED: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
};

function exportParams(t: DrillTarget) {
  const p = drillApiParams(t);
  return {
    src: t.source,
    dimension: p.dimension,
    value: p.value,
    date_from: p.date_from,
    date_to: p.date_to,
    equipment_id: p.equipment_id,
    preset: p.preset,
    user: p.user,
  };
}

/**
 * Reports & Statistics drill-down: a report row (e.g. "IITR Students") → the users in it → one user's bookings → the
 * booking. Every level is a URL, keeps the report's filters and adds up to the level above.
 */
const ReportDrilldown = () => {
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const target = useMemo(() => parseDrillTarget(search), [search]);
  const view: View = target?.user ? "bookings" : search.get("view") === "bookings" ? "bookings" : "users";
  const [users, setUsers] = useState<ReportDrillUsers | null>(null);
  const [bookings, setBookings] = useState<ReportDrillBookings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!target) {
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    setError(null);
    const params = drillApiParams(target);
    const request =
      view === "users"
        ? apiClient.getReportDrilldownUsers(target.source, params).then((res) => {
            if (!live) return;
            if (res.error || !res.data) setError(res.error || "Could not load this breakdown.");
            else setUsers(res.data);
          })
        : apiClient.getReportDrilldownBookings(target.source, params).then((res) => {
            if (!live) return;
            if (res.error || !res.data) setError(res.error || "Could not load these bookings.");
            else setBookings(res.data);
          });
    void request.finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [target, view]);

  if (!target) {
    return (
      <div className="page-shell">
        <DashboardHeader />
        <main className="container mx-auto max-w-5xl px-4 py-10">
          <Card>
            <CardHeader>
              <CardTitle>Nothing to show</CardTitle>
              <CardDescription>Open a row of Reports &amp; Statistics to see the users and bookings behind it.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link to="/reports">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Reports &amp; Statistics
                </Link>
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const data = view === "users" ? users : bookings;
  const segment = data?.segment;
  const revenueVisible = data?.revenue_visible !== false;
  const segmentTarget: DrillTarget = { ...target, user: undefined };
  const segmentPath = drilldownPath(segmentTarget);
  const person = bookings?.user ?? null;
  const backToReport = reportPath(target);
  const setView = (next: View) => {
    const q = new URLSearchParams(search);
    if (next === "bookings") q.set("view", "bookings");
    else q.delete("view");
    navigate({ pathname: location.pathname, search: q.toString() }, { replace: true });
  };

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto max-w-7xl px-4 py-5">
        <Breadcrumb className="mb-4 print:hidden">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to={backToReport}>Reports &amp; Statistics</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to={backToReport}>{data?.report_title ?? "Report"}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {target.user ? (
                <BreadcrumbLink asChild>
                  <Link to={segmentPath}>{segment?.label ?? "Segment"}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{segment?.label ?? "…"}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
            {target.user ? (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{person?.name ?? "User"}</BreadcrumbPage>
                </BreadcrumbItem>
              </>
            ) : null}
          </BreadcrumbList>
        </Breadcrumb>

        <section className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-brand via-brand to-brand-accent p-6 text-white shadow-xl sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/75">
            {data?.report_title ?? "Report"} · {segment?.dimension_label ?? "Breakdown"}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            {target.user ? (
              <>
                {person?.name ?? "User"}
                <span className="font-normal text-white/80"> in {segment?.label ?? "…"}</span>
              </>
            ) : (
              segment?.label ?? "Loading…"
            )}
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/85">
            <span className="inline-flex items-center gap-1.5">
              <CalendarRange className="h-4 w-4" /> {data?.period_display ?? `${target.from ?? ""} – ${target.to ?? ""}`}
            </span>
            {data?.revenue_definition ? <span className="text-white/70">{data.revenue_definition}</span> : null}
          </p>
        </section>

        {target.user && person ? (
          <Card className="mb-6">
            <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-3 pt-6">
              <div className="min-w-0">
                <UserIdCardLink userId={person.user_id} name={person.name} showIcon className="text-lg" />
                <p className="text-sm text-muted-foreground">{person.email}</p>
              </div>
              <div className="text-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Category</p>
                <p className="font-medium">{person.category_label}</p>
              </div>
              <div className="text-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Department / organisation</p>
                <p className="font-medium">{person.department || "—"}</p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <ReportKpiCard
            title="Bookings"
            icon={Layers}
            value={target.user ? (person?.bookings ?? "—") : (segment?.bookings ?? "—")}
            hint={target.user ? `of ${segment?.bookings ?? 0} in ${segment?.label ?? "this row"}` : "Counted in this report row"}
          />
          {!target.user ? (
            <ReportKpiCard title="Users" icon={Users} tone="sky" value={segment?.users ?? "—"} hint="Distinct users who booked" />
          ) : (
            <ReportKpiCard title="Share of row" icon={Users} tone="sky" value={
              segment?.revenue && person?.revenue != null
                ? `${((person.revenue / segment.revenue) * 100).toFixed(1)}%`
                : "—"
            } hint="Of this row's revenue" />
          )}
          {revenueVisible ? (
            <ReportKpiCard
              title="Revenue"
              icon={IndianRupee}
              tone="emerald"
              value={formatInr(target.user ? person?.revenue : segment?.revenue)}
              definition={data?.revenue_definition}
            />
          ) : null}
        </div>

        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
            <div className="space-y-1">
              <CardTitle>{view === "users" ? "Users" : target.user ? "Bookings" : "All bookings in this row"}</CardTitle>
              <CardDescription>
                {view === "users"
                  ? "Click a user's name for their ID card, or their bookings to see each booking."
                  : "Click a Booking ID to open the booking."}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!target.user ? (
                <Tabs value={view} onValueChange={(v) => setView(v as View)}>
                  <TabsList>
                    <TabsTrigger value="users">By user</TabsTrigger>
                    <TabsTrigger value="bookings">All bookings</TabsTrigger>
                  </TabsList>
                </Tabs>
              ) : (
                <Button asChild variant="outline" size="sm">
                  <Link to={segmentPath}>
                    <ArrowLeft className="mr-1.5 h-4 w-4" /> All users
                  </Link>
                </Button>
              )}
              <ExportMenu
                report={view === "users" ? "report-drilldown-users" : "report-drilldown-bookings"}
                description={view === "users" ? "Users in this report row" : "Bookings in this report row"}
                getParams={() => exportParams(target)}
                disabled={loading || !!error}
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-14">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : error ? (
              <p className="py-10 text-center text-sm text-destructive">{error}</p>
            ) : view === "users" && users ? (
              <UsersTable data={users} target={target} />
            ) : bookings ? (
              <BookingsTable data={bookings} showUser={!target.user} />
            ) : null}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

function UsersTable({ data, target }: { data: ReportDrillUsers; target: DrillTarget }) {
  const navigate = useNavigate();
  const money = data.revenue_visible;
  return (
    <Table stickyFirstColumn>
      <TableHeader>
        <TableRow className="bg-muted/40">
          <TableHead>Name</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Department / organisation</TableHead>
          <TableHead className="text-center">Bookings</TableHead>
          {money ? <TableHead className="text-right">Revenue</TableHead> : null}
          <TableHead className="text-right print:hidden" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.users.length === 0 ? (
          <TableRow>
            <TableCell colSpan={money ? 6 : 5} className="py-10 text-center text-muted-foreground">
              No bookings in this row for the period.
            </TableCell>
          </TableRow>
        ) : (
          data.users.map((u) => {
            const to = drilldownPath({ ...target, user: u.user_id });
            return (
              <TableRow key={u.user_id} className="cursor-pointer hover:bg-primary/5" onClick={() => navigate(to)}>
                <TableCell>
                  <UserIdCardLink userId={u.user_id} name={u.name} />
                  <span className="block text-xs text-muted-foreground">{u.email}</span>
                </TableCell>
                <TableCell className="text-sm">{u.category_label}</TableCell>
                <TableCell className="text-sm">{u.department || "—"}</TableCell>
                <TableCell className="text-center tabular-nums">{u.bookings}</TableCell>
                {money ? <TableCell className="text-right font-medium tabular-nums">{formatInr(u.revenue)}</TableCell> : null}
                <TableCell className="text-right print:hidden">
                  <Link
                    to={to}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-medium text-primary hover:underline"
                  >
                    Bookings <ChevronRight className="h-4 w-4" />
                  </Link>
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}

function BookingsTable({ data, showUser }: { data: ReportDrillBookings; showUser: boolean }) {
  const money = data.revenue_visible;
  const cols = 5 + (showUser ? 1 : 0) + (money ? 1 : 0);
  return (
    <>
      {data.truncated ? (
        <p className="mb-3 text-sm text-amber-700 dark:text-amber-300">
          Showing the first {data.count} bookings; export the table for all of them.
        </p>
      ) : null}
      <Table stickyFirstColumn>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead>Booking ID</TableHead>
            {showUser ? <TableHead>User</TableHead> : null}
            <TableHead>Equipment</TableHead>
            <TableHead>Slot</TableHead>
            <TableHead className="text-center">Hours</TableHead>
            <TableHead className="text-center">Status</TableHead>
            {money ? <TableHead className="text-right">Charge</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.bookings.length === 0 ? (
            <TableRow>
              <TableCell colSpan={cols} className="py-10 text-center text-muted-foreground">
                No bookings.
              </TableCell>
            </TableRow>
          ) : (
            data.bookings.map((b) => (
              <TableRow key={b.pk}>
                <TableCell>
                  <BookingLink pk={b.pk} displayId={b.display_id} />
                </TableCell>
                {showUser ? (
                  <TableCell>
                    <UserIdCardLink userId={b.user.id} name={b.user.name} email={b.user.email} />
                    <span className="block text-xs text-muted-foreground">{b.category_label}</span>
                  </TableCell>
                ) : null}
                <TableCell>
                  <EquipmentLink id={b.equipment.id} name={b.equipment.name} code={b.equipment.code} showCode />
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">{formatSlot(b.slot_start, b.slot_end)}</TableCell>
                <TableCell className="text-center tabular-nums">{b.hours.toFixed(2)}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary" className={STATUS_TONE[b.status] ?? undefined}>
                    {b.status_display}
                  </Badge>
                </TableCell>
                {money ? <TableCell className="text-right font-medium tabular-nums">{formatInr(b.charge)}</TableCell> : null}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </>
  );
}

export default ReportDrilldown;

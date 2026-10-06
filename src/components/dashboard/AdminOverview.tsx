import { useCallback, useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  Clock,
  IndianRupee,
  ListOrdered,
  Loader2,
  RefreshCw,
  Server,
  Star,
  TimerReset,
  Users,
  Wrench,
} from "lucide-react";
import { apiClient, type AdminDashboardSummary } from "@/lib/api";
import { formatINRAmount } from "@/lib/money";
import { usePeakWindow } from "@/hooks/use-peak-window";
import { peakNow } from "@/lib/peakWindow";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { mergeAttentionItems, nextWeeklyOpening, formatCountdown, type AttentionItem } from "./adminOverviewData";

interface AdminOverviewProps {
  /** Opens a dashboard workspace page. */
  onOpen: (path: string) => void;
  /** True when the signed-in user has a menu entry for this page (links are only shown for those). */
  canOpen: (path: string) => boolean;
  /** Dashboard notices (the tip of the day) shown between the overview header and the figures. */
  notices?: ReactNode;
}

const REFRESH_MS = 60_000;

const chartConfig = {
  count: { label: "Bookings", color: "hsl(var(--primary))" },
} satisfies ChartConfig;

function useMinuteClock(): number {
  const [now, setNow] = useState(() => peakNow());
  useEffect(() => {
    const id = window.setInterval(() => setNow(peakNow()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

const timeFormat = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
const openingFormat = new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: "Asia/Kolkata",
});
const dayFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

function formatClock(iso: string | null | undefined, format = timeFormat): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  return Number.isFinite(t) ? format.format(new Date(t)).replace(/\s?(am|pm)$/i, (m) => ` ${m.trim().toLowerCase()}`) : "";
}

interface KpiProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "primary" | "emerald" | "amber" | "rose" | "slate" | "violet";
  onClick?: () => void;
  compact?: boolean;
}

const TONES: Record<NonNullable<KpiProps["tone"]>, string> = {
  primary: "bg-primary/10 text-primary dark:bg-primary/25 dark:text-sky-200",
  emerald: "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  amber: "bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  rose: "bg-rose-500/10 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
  slate: "bg-slate-500/10 text-slate-700 dark:bg-slate-400/20 dark:text-slate-200",
  violet: "bg-violet-500/10 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
};

function Kpi({ icon: Icon, label, value, hint, tone = "primary", onClick, compact }: KpiProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", TONES[tone])}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <p className={cn("font-bold tabular-nums tracking-tight text-foreground", compact ? "text-xl" : "text-2xl sm:text-[1.7rem]")}>
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{hint}</p> : null}
    </>
  );
  const className = "flex h-full flex-col rounded-xl border border-border/70 bg-card p-3.5 text-left shadow-sm";
  if (!onClick) return <div className={className}>{body}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        className,
        "transition-colors hover:border-primary/40 hover:bg-primary/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {body}
    </button>
  );
}

function SectionCard({ title, description, action, children, className }: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("overflow-hidden border-border/70 shadow-sm", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 border-b border-border/60 px-4 py-3">
        <div className="min-w-0">
          <CardTitle className="text-sm font-semibold tracking-tight">{title}</CardTitle>
          {description ? <CardDescription className="mt-0.5 text-xs">{description}</CardDescription> : null}
        </div>
        {action}
      </CardHeader>
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  );
}

export default function AdminOverview({ onOpen, canOpen, notices }: AdminOverviewProps) {
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [pending, setPending] = useState<AttentionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const peak = usePeakWindow();
  const now = useMinuteClock();

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    const [summaryRes, pendingRes] = await Promise.all([
      apiClient.getAdminDashboardSummary({ refresh }),
      apiClient.getPendingActions(),
    ]);
    if (summaryRes.data) {
      setSummary(summaryRes.data);
      setError(null);
    } else if (summaryRes.error) {
      setError(summaryRes.error);
    }
    setPending(pendingRes.data?.items ?? []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const attention = useMemo(() => mergeAttentionItems(summary?.attention ?? [], pending), [summary, pending]);
  const attentionTotal = attention.reduce((sum, i) => sum + i.count, 0);
  const open = (path: string) => (canOpen(path) ? () => onOpen(path) : undefined);

  const opening = useMemo(() => {
    if (peak.window?.opening_at) return { at: peak.window.opening_at, live: peak.active };
    return { at: nextWeeklyOpening(now).toISOString(), live: false };
  }, [peak, now]);
  const openingMs = Date.parse(opening.at) - now;

  if (loading && !summary) {
    return (
      <Card className="border-border/70 shadow-sm">
        <CardContent className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
          Loading administration overview…
        </CardContent>
      </Card>
    );
  }

  if (!summary) {
    return (
      <div className="space-y-4">
        <Card className="border-border/70 shadow-sm">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center text-sm text-muted-foreground">
            <p>{error || "Could not load the administration overview."}</p>
            <Button variant="outline" size="sm" onClick={() => void load(true)}>
              Try again
            </Button>
          </CardContent>
        </Card>
        {notices}
      </div>
    );
  }

  const { bookings, revenue, equipment, users, waitlist, booking_attempts: attempts, ratings } = summary;
  const scopeLabel =
    summary.scope === "institute" ? "Institute-wide" : summary.department?.name ? summary.department.name : "Your department";
  const failureRate = attempts && attempts.total > 0 ? Math.round((attempts.failed / attempts.total) * 100) : 0;
  const chartData = summary.bookings_per_day.map((d) => ({ ...d, label: dayFormat.format(new Date(`${d.date}T00:00:00+05:30`)) }));
  const chartTotal = summary.bookings_per_day.reduce((s, d) => s + d.count, 0);
  const maxHours = Math.max(1, ...summary.top_equipment.map((e) => e.hours));

  return (
    <div className="space-y-4" data-testid="admin-overview">
      <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-border/60">
        <div className="h-1.5 w-full bg-gradient-to-r from-primary via-accent to-primary/50" />
        <CardHeader className="flex flex-col gap-3 space-y-0 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="text-xl font-semibold tracking-tight sm:text-2xl">Administration overview</CardTitle>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <Badge variant="secondary" className="font-medium">{scopeLabel}</Badge>
              <span>Updated {formatClock(summary.generated_at)} · refreshes every minute</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs",
                opening.live ? "border-emerald-500/40 bg-emerald-500/10" : "border-border/70 bg-muted/40",
              )}
            >
              <CalendarClock className="h-4 w-4 shrink-0 text-primary dark:text-sky-300" aria-hidden />
              {opening.live ? (
                <span className="font-semibold text-emerald-700 dark:text-emerald-300">Booking window is open now</span>
              ) : (
                <span>
                  Booking opens <span className="font-semibold">{formatClock(opening.at, openingFormat)}</span>
                  {openingMs > 0 ? <span className="text-muted-foreground"> · in {formatCountdown(openingMs)}</span> : null}
                </span>
              )}
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void load(true)} disabled={refreshing}>
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} aria-hidden />
              Refresh
            </Button>
          </div>
        </CardHeader>
      </Card>

      {notices}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          icon={CalendarCheck2}
          label="Sessions today"
          value={bookings.sessions_today}
          hint={`${bookings.sessions_next_7_days} in the next 7 days`}
          onClick={open("/booking-management")}
        />
        <Kpi
          icon={ListOrdered}
          label="Bookings made today"
          value={bookings.created_today}
          hint={`${bookings.created_this_week} this week · ${bookings.created_last_7_days} in 7 days`}
          tone="violet"
          onClick={open("/reports")}
        />
        <Kpi
          icon={AlertTriangle}
          label="Needs attention"
          value={attentionTotal}
          hint={attention.length ? `${attention.length} kind${attention.length === 1 ? "" : "s"} of request waiting` : "Nothing is waiting"}
          tone={attentionTotal ? "amber" : "emerald"}
          onClick={attention.length ? () => document.getElementById("admin-attention")?.scrollIntoView({ behavior: "smooth", block: "start" }) : undefined}
        />
        <Kpi
          icon={IndianRupee}
          label="Charges this month"
          value={revenue ? formatINRAmount(Math.round(revenue.charged_this_month)) : "—"}
          hint={
            revenue
              ? `${revenue.charged_bookings_this_month} charged bookings · last month ${formatINRAmount(Math.round(revenue.charged_last_month))}`
              : undefined
          }
          tone="emerald"
          onClick={open("/reports")}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi
          compact
          icon={Wrench}
          label="Equipment"
          value={equipment ? `${equipment.operational}/${equipment.total}` : "—"}
          hint={equipment ? `${equipment.under_maintenance} under maintenance${equipment.other ? ` · ${equipment.other} other` : ""}` : undefined}
          tone={equipment && equipment.under_maintenance > 0 ? "rose" : "slate"}
        />
        <Kpi
          compact
          icon={Users}
          label="Active users"
          value={users ? users.active.toLocaleString("en-IN") : "—"}
          hint={users ? `+${users.new_last_7_days} new in 7 days · +${users.new_last_30_days} in 30` : undefined}
          tone="slate"
        />
        <Kpi
          compact
          icon={TimerReset}
          label="Waitlist"
          value={waitlist ? waitlist.active : "—"}
          hint="Users waiting for a slot"
          tone="violet"
          onClick={open("/equipment-waitlist")}
        />
        <Kpi
          compact
          icon={Ban}
          label={`Failed attempts (${attempts?.days ?? 7} days)`}
          value={attempts ? attempts.failed : "—"}
          hint={
            attempts
              ? attempts.top_failure_reasons[0]
                ? `${failureRate}% of ${attempts.total} · top: ${attempts.top_failure_reasons[0].reason}`
                : `${failureRate}% of ${attempts.total} attempts`
              : undefined
          }
          tone={attempts && attempts.failed > 0 ? "rose" : "slate"}
          onClick={open("/booking-attempt-logs")}
        />
        <Kpi
          compact
          icon={Star}
          label="Experience rating"
          value={ratings?.booking_average != null ? `${ratings.booking_average.toFixed(1)} ★` : "—"}
          hint={
            ratings
              ? `${ratings.booking_count} booking ratings in ${ratings.days} days${
                  ratings.portal_average != null ? ` · portal ${ratings.portal_average.toFixed(1)} ★` : ""
                }`
              : undefined
          }
          tone="amber"
          onClick={open("/admin-settings/feedback")}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <SectionCard
          className="xl:col-span-2"
          title="Bookings per day"
          description={`Bookings made in the last ${summary.bookings_per_day.length} days (${chartTotal} in total)`}
        >
          <div className="px-2 pb-2 pt-3">
            {chartTotal === 0 ? (
              <p className="py-14 text-center text-sm text-muted-foreground">No bookings in this period.</p>
            ) : (
              <ChartContainer config={chartConfig} className="aspect-auto h-[220px] w-full">
                <BarChart data={chartData} margin={{ left: -18, right: 6, top: 4, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={18} fontSize={11} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} fontSize={11} />
                  <ChartTooltip cursor={{ fillOpacity: 0.08 }} content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--color-count)" radius={[3, 3, 0, 0]} maxBarSize={22} />
                </BarChart>
              </ChartContainer>
            )}
          </div>
        </SectionCard>

        <div id="admin-attention" className="scroll-mt-24">
          <SectionCard title="Needs attention" description="Requests waiting for a decision" className="h-full">
            {attention.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground">
                <CheckCircle2 className="h-7 w-7 text-emerald-600" aria-hidden />
                All clear — nothing is waiting for you.
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {attention.map((item) => {
                  const go = canOpen(item.link) || item.fromPendingActions ? () => onOpen(item.link) : undefined;
                  return (
                    <li key={item.key} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground" title={item.description}>
                          {item.label}
                        </p>
                        <p className="truncate text-xs text-muted-foreground" title={item.description}>
                          {item.description}
                        </p>
                      </div>
                      <Badge className="shrink-0 bg-amber-500 tabular-nums text-amber-950 dark:text-amber-950 hover:bg-amber-500">{item.count}</Badge>
                      {go ? (
                        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label={`Open ${item.label}`} onClick={go}>
                          <ArrowRight className="h-4 w-4" aria-hidden />
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SectionCard title="Top equipment by booked hours" description="Charged bookings with slots in the last 30 days">
          {summary.top_equipment.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">No equipment usage in this period.</p>
          ) : (
            <ul className="space-y-2.5 px-4 py-3">
              {summary.top_equipment.map((eq) => (
                <li key={eq.equipment_id}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-medium text-foreground" title={`${eq.name} (${eq.code})`}>
                      {eq.name}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {eq.hours} h · {eq.bookings} booking{eq.bookings === 1 ? "" : "s"} · {formatINRAmount(Math.round(eq.charged))}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary/80" style={{ width: `${Math.max(4, (eq.hours / maxHours) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Recent bookings"
          description="Latest bookings in scope"
          action={
            canOpen("/booking-management") ? (
              <Button variant="ghost" size="sm" className="h-7 shrink-0 gap-1 text-xs" onClick={() => onOpen("/booking-management")}>
                View all <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Button>
            ) : null
          }
        >
          {summary.recent_bookings.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">No bookings yet.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {summary.recent_bookings.map((b) => (
                <li key={b.booking_id} className="flex items-center gap-3 px-4 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground" title={b.equipment_name}>
                      {b.equipment_name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {b.reference} · {b.user_name}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge variant="outline" className="text-[0.68rem] font-medium">
                      {b.status_display}
                    </Badge>
                    <p className="mt-0.5 flex items-center justify-end gap-1 text-[0.68rem] text-muted-foreground">
                      <Clock className="h-3 w-3" aria-hidden />
                      {formatClock(b.created_at, openingFormat)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {summary.system ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
            <Server className="h-3.5 w-3.5" aria-hidden />
            Backend online{summary.system.backend_version ? ` · ${summary.system.backend_version}` : ""}
          </span>
          {summary.system.build_date ? <span>Built {summary.system.build_date}</span> : null}
        </p>
      ) : null}
    </div>
  );
}

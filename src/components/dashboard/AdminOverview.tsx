import { useCallback, useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  BarChart3,
  CalendarCheck2,
  CalendarClock,
  CalendarX2,
  CheckCircle2,
  ClipboardList,
  Clock,
  IndianRupee,
  ListOrdered,
  Loader2,
  RefreshCw,
  Server,
  Settings2,
  Star,
  TimerReset,
  UserPlus,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { apiClient, type AdminDashboardSummary } from "@/lib/api";
import { INSIGHT_PATHS } from "@/lib/adminInsights";
import { DepartmentPicker, useDepartmentParam, withDepartment } from "@/components/admin-insights/DepartmentPicker";
import { BookingLink } from "@/components/BookingLink";
import { formatINRAmount } from "@/lib/money";
import { usePeakWindow } from "@/hooks/use-peak-window";
import { peakNow } from "@/lib/peakWindow";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import IntegrationHealthCard from "./IntegrationHealthCard";
import {
  experienceRatingCard,
  formatCountdown,
  madeTodayLink,
  mergeAttentionItems,
  nextWeeklyOpening,
  reportsLink,
  type AttentionItem,
} from "./adminOverviewData";

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

/** Pages an administrator opens most; each is shown only when it is in the user's menu. */
const QUICK_LINKS: Array<{ path: string; label: string; icon: ComponentType<{ className?: string }> }> = [
  { path: "/booking-management", label: "View Booking", icon: ClipboardList },
  { path: "/admin/registration-requests", label: "Registration requests", icon: UserPlus },
  { path: "/admin-settings/wallet-recharge-requests", label: "Wallet recharges", icon: Wallet },
  { path: "/oic/equipment-settings", label: "Equipment configuration", icon: Settings2 },
  { path: "/reports", label: "Reports & Statistics", icon: BarChart3 },
];

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
const longDayFormat = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" });
const hourFormat = new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" });

function formatClock(iso: string | null | undefined, format = timeFormat): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  return Number.isFinite(t) ? format.format(new Date(t)).replace(/\s?(am|pm)$/i, (m) => ` ${m.trim().toLowerCase()}`) : "";
}

function greeting(now: number): string {
  const hour = Number(hourFormat.format(new Date(now)));
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

type Tone = "primary" | "emerald" | "amber" | "rose" | "slate" | "violet";

interface KpiProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  onClick?: () => void;
  compact?: boolean;
  /** A small trend drawn under the value (e.g. bookings per day). */
  trend?: number[];
}

const TONES: Record<Tone, { icon: string; glow: string; bar: string }> = {
  primary: {
    icon: "bg-primary/10 text-primary dark:bg-primary/25 dark:text-sky-200",
    glow: "from-primary/[0.07]",
    bar: "bg-primary/70 dark:bg-sky-400/70",
  },
  emerald: {
    icon: "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
    glow: "from-emerald-500/[0.07]",
    bar: "bg-emerald-500/70",
  },
  amber: {
    icon: "bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
    glow: "from-amber-500/[0.08]",
    bar: "bg-amber-500/70",
  },
  rose: {
    icon: "bg-rose-500/10 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
    glow: "from-rose-500/[0.07]",
    bar: "bg-rose-500/70",
  },
  slate: {
    icon: "bg-slate-500/10 text-slate-700 dark:bg-slate-400/20 dark:text-slate-200",
    glow: "from-slate-500/[0.05]",
    bar: "bg-slate-500/60",
  },
  violet: {
    icon: "bg-violet-500/10 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
    glow: "from-violet-500/[0.07]",
    bar: "bg-violet-500/70",
  },
};

function Sparkbars({ values, tone }: { values: number[]; tone: Tone }) {
  const max = Math.max(1, ...values);
  return (
    <div className="mt-2 flex h-7 items-end gap-[3px]" aria-hidden>
      {values.map((v, i) => (
        <span
          key={i}
          className={cn("w-full rounded-sm", i === values.length - 1 ? TONES[tone].bar : "bg-muted-foreground/20")}
          style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, hint, tone = "primary", onClick, compact, trend }: KpiProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <span className={cn("flex shrink-0 items-center justify-center rounded-xl", compact ? "h-8 w-8" : "h-9 w-9", TONES[tone].icon)}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <p className={cn("font-bold tabular-nums tracking-tight text-foreground", compact ? "text-xl" : "text-3xl")}>{value}</p>
      {trend && trend.length > 1 ? <Sparkbars values={trend} tone={tone} /> : null}
      {hint ? <p className="mt-1 text-xs leading-snug text-muted-foreground">{hint}</p> : null}
      {onClick ? (
        <ArrowRight
          className="absolute bottom-3 right-3 h-3.5 w-3.5 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
          aria-hidden
        />
      ) : null}
    </>
  );
  const className = cn(
    "relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br to-card text-left shadow-sm",
    TONES[tone].glow,
    compact ? "p-3.5" : "p-4",
  );
  if (!onClick) return <div className={className}>{body}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        className,
        "group cursor-pointer pr-7 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {body}
    </button>
  );
}

function cancellationHint(c: NonNullable<AdminDashboardSummary["cancellations"]>): string {
  const counts =
    c.refund_requests != null
      ? `${c.total} cancellations · ${c.refund_requests} refund request${c.refund_requests === 1 ? "" : "s"}`
      : null;
  const rate = c.rate != null ? `${(c.rate * 100).toFixed(1)}% of ${c.bookings_created} bookings` : "No bookings made";
  const diff = c.total - c.previous_total;
  const trend = diff === 0 ? "same as the 30 days before" : `${diff > 0 ? "▲" : "▼"} ${Math.abs(diff)} vs the 30 days before`;
  return counts ? `${counts} · ${rate}` : `${rate} · ${trend}`;
}

function madeTodayHint(b: AdminDashboardSummary["bookings"]): string {
  const base = `${b.created_this_week} this week · ${b.created_last_7_days} in 7 days`;
  const tests = b.test_created_today ?? 0;
  return tests ? `${base} · ${tests} test booking${tests === 1 ? "" : "s"} not counted` : base;
}

function SectionCard({ title, description, action, children, className }: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("overflow-hidden rounded-2xl border-border/70 shadow-sm", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 border-b border-border/60 bg-muted/20 px-4 py-3">
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

function GroupLabel({ children }: { children: ReactNode }) {
  return <h3 className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{children}</h3>;
}

export default function AdminOverview({ onOpen, canOpen, notices }: AdminOverviewProps) {
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [pending, setPending] = useState<AttentionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const peak = usePeakWindow();
  const now = useMinuteClock();
  const [dept, setDept] = useDepartmentParam();

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    const [summaryRes, pendingRes] = await Promise.all([
      apiClient.getAdminDashboardSummary(dept ? { refresh, dept } : { refresh }),
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
  }, [dept]);

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
  /** Like ``open`` for a page that takes filters in its address (permission is checked on the page path). */
  const openFiltered = (target: string) => (canOpen(target.split("?")[0]) ? () => onOpen(target) : undefined);
  const openInsight = (path: string) => (canOpen(path) ? () => onOpen(withDepartment(path, dept)) : undefined);

  const opening = useMemo(() => {
    if (peak.window?.opening_at) return { at: peak.window.opening_at, live: peak.active };
    return { at: nextWeeklyOpening(now).toISOString(), live: false };
  }, [peak, now]);
  const openingMs = Date.parse(opening.at) - now;

  if (loading && !summary) {
    return (
      <Card className="rounded-2xl border-border/70 shadow-sm">
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
        <Card className="rounded-2xl border-border/70 shadow-sm">
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

  const { bookings, revenue, equipment, users, cancellations, waitlist, booking_attempts: attempts, ratings } = summary;
  const ratingCard = experienceRatingCard(ratings, Boolean(dept));
  const scopeLabel =
    summary.department?.name ?? (summary.scope === "institute" ? "Institute-wide" : "Your department");
  const failureRate = attempts && attempts.total > 0 ? Math.round((attempts.failed / attempts.total) * 100) : 0;
  const chartData = summary.bookings_per_day.map((d) => ({ ...d, label: dayFormat.format(new Date(`${d.date}T00:00:00+05:30`)) }));
  const chartTotal = summary.bookings_per_day.reduce((s, d) => s + d.count, 0);
  const trend = summary.bookings_per_day.slice(-14).map((d) => d.count);
  const maxHours = Math.max(1, ...summary.top_equipment.map((e) => e.hours));
  const quickLinks = QUICK_LINKS.filter((q) => canOpen(q.path));

  return (
    <div className="space-y-5" data-testid="admin-overview">
      {/* Header: who is looking at what, and when booking opens. */}
      <Card className="overflow-hidden rounded-3xl border-0 shadow-lg ring-1 ring-border/60">
        <div className="relative overflow-hidden bg-gradient-to-r from-brand via-brand to-brand-accent px-5 py-5 text-white sm:px-6">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-sky-300/20 blur-3xl" />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
                {greeting(now)} · {longDayFormat.format(new Date(now))}
              </p>
              <CardTitle className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Administration overview</CardTitle>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/80">
                <Badge className="border-0 bg-white/15 font-medium text-white hover:bg-white/20">{scopeLabel}</Badge>
                <span>Updated {formatClock(summary.generated_at)} · refreshes every minute</span>
              </div>
            </div>
            <div
              className={cn(
                "flex items-center gap-2 self-start rounded-xl px-3 py-2 text-xs ring-1 ring-inset md:self-auto",
                opening.live ? "bg-emerald-400/20 ring-emerald-200/40" : "bg-white/10 ring-white/25",
              )}
            >
              <CalendarClock className="h-4 w-4 shrink-0" aria-hidden />
              {opening.live ? (
                <span className="font-semibold">Booking window is open now</span>
              ) : (
                <span>
                  Booking opens <span className="font-semibold">{formatClock(opening.at, openingFormat)}</span>
                  {openingMs > 0 ? <span className="text-white/75"> · in {formatCountdown(openingMs)}</span> : null}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3 bg-card px-5 py-3 sm:flex-row sm:items-end sm:justify-between sm:px-6">
          <DepartmentPicker
            departments={summary.departments}
            value={dept}
            onChange={setDept}
            equipmentOwnersOnly
            className="sm:w-72"
          />
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            {error ? (
              <span className="text-xs font-medium text-amber-700 dark:text-amber-300" role="status">
                Last refresh failed; these figures are from {formatClock(summary.generated_at)}
              </span>
            ) : null}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void load(true)} disabled={refreshing}>
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} aria-hidden />
              Refresh
            </Button>
          </div>
        </div>
      </Card>

      {notices}

      <section className="space-y-2.5">
        <GroupLabel>Today</GroupLabel>
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
            hint={madeTodayHint(bookings)}
            tone="violet"
            trend={trend}
            onClick={openFiltered(madeTodayLink(false))}
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
            onClick={openFiltered(reportsLink("month"))}
          />
        </div>
      </section>

      {quickLinks.length ? (
        <nav aria-label="Quick links" className="flex flex-wrap gap-2">
          {quickLinks.map(({ path, label, icon: Icon }) => (
            <button
              key={path}
              type="button"
              onClick={() => onOpen(path)}
              className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-3.5 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/[0.04] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {label}
            </button>
          ))}
        </nav>
      ) : null}

      <IntegrationHealthCard />

      <section className="space-y-2.5">
        <GroupLabel>Facility health</GroupLabel>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Kpi
            compact
            icon={Wrench}
            label="Equipment"
            value={equipment ? `${equipment.operational}/${equipment.total}` : "—"}
            hint={equipment ? `${equipment.under_maintenance} under maintenance${equipment.other ? ` · ${equipment.other} other` : ""}` : undefined}
            tone={equipment && equipment.under_maintenance > 0 ? "rose" : "slate"}
            onClick={openInsight(INSIGHT_PATHS.equipment)}
          />
          <Kpi
            compact
            icon={Users}
            label="Active users"
            value={users ? users.active.toLocaleString("en-IN") : "—"}
            hint={users ? `+${users.new_last_7_days} new in 7 days · +${users.new_last_30_days} in 30` : undefined}
            tone="slate"
            onClick={openInsight(INSIGHT_PATHS.users)}
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
            label="Failed attempts"
            value={attempts ? attempts.failed : "—"}
            hint={
              attempts
                ? `Last ${attempts.days} days · ${
                    attempts.top_failure_reasons[0]
                      ? `${failureRate}% of ${attempts.total} · top: ${attempts.top_failure_reasons[0].reason}`
                      : `${failureRate}% of ${attempts.total} attempts`
                  }`
                : undefined
            }
            tone={attempts && attempts.failed > 0 ? "rose" : "slate"}
            onClick={open("/booking-attempt-logs")}
          />
          <Kpi
            compact
            icon={CalendarX2}
            label="Cancellations"
            value={cancellations ? cancellations.total : "—"}
            hint={cancellations ? `Last ${cancellations.days} days · ${cancellationHint(cancellations)}` : undefined}
            tone={cancellations && cancellations.total > cancellations.previous_total ? "rose" : "slate"}
            onClick={openInsight(INSIGHT_PATHS.cancellations)}
          />
          <Kpi
            compact
            icon={Star}
            label="Experience rating"
            value={ratingCard.value}
            hint={ratingCard.hint}
            tone="amber"
            onClick={ratingCard.source === "portal" ? open("/admin-settings/feedback") : undefined}
          />
        </div>
      </section>

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
              <ChartContainer config={chartConfig} className="aspect-auto h-[230px] w-full">
                <BarChart data={chartData} margin={{ left: -18, right: 6, top: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="admin-bookings-bar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-count)" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="var(--color-count)" stopOpacity={0.45} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={18} fontSize={11} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} fontSize={11} />
                  <ChartTooltip cursor={{ fillOpacity: 0.08 }} content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="url(#admin-bookings-bar)" radius={[4, 4, 0, 0]} maxBarSize={22} />
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
                    <li key={item.key} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/30">
                      <span className="h-8 w-1 shrink-0 rounded-full bg-amber-400/80" aria-hidden />
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
            <ol className="space-y-3 px-4 py-3">
              {summary.top_equipment.map((eq, i) => (
                <li key={eq.equipment_id} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[0.7rem] font-bold text-primary dark:text-sky-200">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate font-medium text-foreground" title={`${eq.name} (${eq.code})`}>
                        {eq.name}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {eq.hours} h · {eq.bookings} booking{eq.bookings === 1 ? "" : "s"} · {formatINRAmount(Math.round(eq.charged))}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-brand-accent"
                        style={{ width: `${Math.max(4, (eq.hours / maxHours) * 100)}%` }}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
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
                <li key={b.booking_id} className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-muted/30">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground" title={b.equipment_name}>
                      {b.equipment_name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      <BookingLink pk={b.booking_id} displayId={b.reference} /> · {b.user_name}
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

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  FlaskConical,
  Hourglass,
  Loader2,
  Plus,
  RefreshCw,
  Wallet,
} from "lucide-react";

import { apiClient, type MyActivity as MyActivityData, type MyActivityBooking } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type OpenFn = (path: string, label?: string) => void;

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inrExact = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 });

const STATUS_TONE: Record<string, string> = {
  BOOKED: "bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-200 dark:ring-sky-500/30",
  PENDING: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30",
  PENDING_PAYMENT: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30",
  DISRUPTION_PENDING: "bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-200 dark:ring-rose-500/30",
  WAITLISTED: "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-200 dark:ring-slate-500/30",
  HOLD: "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-200 dark:ring-slate-500/30",
  COMPLETED: "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/30",
};

function StatusPill({ status, label }: { status: string; label: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", STATUS_TONE[status] ?? STATUS_TONE.HOLD)}>
      {label}
    </span>
  );
}

const asDate = (iso: string | null | undefined) => (iso ? new Date(iso) : null);
const dayLabel = (d: Date) => d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
const timeLabel = (d: Date) => d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

/** "in 2 d 4 h", "in 35 min", "now". */
export function relativeTo(target: Date, now: Date): string {
  const mins = Math.round((target.getTime() - now.getTime()) / 60000);
  if (mins <= 0) return "now";
  if (mins < 60) return `in ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `in ${hours} h ${mins % 60 ? `${mins % 60} min` : ""}`.trim();
  const days = Math.floor(hours / 24);
  return `in ${days} d${hours % 24 ? ` ${hours % 24} h` : ""}`;
}

function bookingPath(b: MyActivityBooking) {
  return `/my-bookings?booking=${encodeURIComponent(b.display_id)}`;
}

function SampleDeadline({ iso, now, onDark = false }: { iso?: string | null; now: Date; onDark?: boolean }) {
  const d = asDate(iso);
  if (!d) return null;
  const hoursLeft = (d.getTime() - now.getTime()) / 3600000;
  const tone =
    hoursLeft < 0
      ? onDark ? "bg-rose-500/20 text-rose-100" : "text-rose-700 dark:text-rose-300"
      : hoursLeft < 24
        ? onDark ? "bg-amber-400/20 text-amber-100" : "text-amber-700 dark:text-amber-300"
        : onDark ? "bg-white/10 text-white/80" : "text-muted-foreground";
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", onDark && "rounded-full px-2 py-0.5", tone)}>
      {hoursLeft < 24 ? <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> : <Hourglass className="h-3.5 w-3.5" aria-hidden />}
      {hoursLeft < 0 ? "Sample was due " : "Sample due "}
      {dayLabel(d)}, {timeLabel(d)}
    </span>
  );
}

function Panel({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col rounded-2xl border border-border/70 bg-card shadow-sm", className)}>
      <header className="flex items-center justify-between gap-2 border-b border-border/60 px-5 py-3.5">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {action}
      </header>
      <div className="flex-1 p-5">{children}</div>
    </section>
  );
}

function LinkButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline dark:text-sky-300">
      {children}
      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}

function Metric({ icon, label, value, hint, tone = "default", onClick }: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint: ReactNode;
  tone?: "default" | "attention";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex min-w-0 flex-col gap-3 rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        tone === "attention" ? "border-amber-300/80 dark:border-amber-500/40" : "border-border/70",
      )}
    >
      <span className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        {label}
        <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", tone === "attention" ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200" : "bg-primary/10 text-primary dark:text-sky-300")}>
          {icon}
        </span>
      </span>
      <span className="text-2xl font-semibold tabular-nums tracking-tight">{value}</span>
      <span className="truncate text-xs text-muted-foreground">{hint}</span>
    </button>
  );
}

function NextUp({ next, now, onOpen }: { next: MyActivityBooking | null; now: Date; onOpen: OpenFn }) {
  const start = asDate(next?.slot_start);
  const end = asDate(next?.slot_end);
  if (!next || !start) {
    return (
      <div className="relative flex h-full flex-col justify-between gap-6 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-primary/80 p-6 text-white shadow-lg">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/60">Next up</p>
          <p className="mt-2 text-xl font-semibold">No sessions scheduled</p>
          <p className="mt-1 max-w-md text-sm text-white/70">Book an instrument and your next session, its sample deadline and countdown will appear here.</p>
        </div>
        <div>
          <Button size="sm" className="gap-1.5 bg-white text-slate-900 hover:bg-white/90" onClick={() => onOpen("/equipments", "Browse and Book Equipment")}>
            <Plus className="h-4 w-4" aria-hidden /> Book equipment
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="relative flex h-full flex-col justify-between gap-6 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-primary/80 p-6 text-white shadow-lg" data-testid="my-activity-next">
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/5" />
      <div className="relative flex items-start gap-5">
        <div className="flex w-16 shrink-0 flex-col items-center rounded-xl bg-white/10 py-2 ring-1 ring-white/15">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/70">{start.toLocaleDateString("en-IN", { month: "short" })}</span>
          <span className="text-2xl font-semibold leading-tight tabular-nums">{start.getDate()}</span>
          <span className="text-[11px] text-white/70">{start.toLocaleDateString("en-IN", { weekday: "short" })}</span>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/60">Next up · {relativeTo(start, now)}</p>
          <p className="mt-1 truncate text-xl font-semibold">{next.equipment.name}</p>
          <p className="mt-0.5 text-sm text-white/75">
            {timeLabel(start)}
            {end ? ` – ${timeLabel(end)}` : ""} · <span className="font-mono text-xs">{next.display_id}</span>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <SampleDeadline iso={next.sample_deadline} now={now} onDark />
          </div>
        </div>
      </div>
      <div className="relative flex flex-wrap gap-2">
        <Button size="sm" className="gap-1.5 bg-white text-slate-900 hover:bg-white/90" onClick={() => onOpen(bookingPath(next), "My Bookings")}>
          View booking <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
        <Button size="sm" variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={() => onOpen("/my-bookings", "My Bookings")}>
          All bookings
        </Button>
      </div>
    </div>
  );
}

function SpendCard({ data, onOpen }: { data: MyActivityData; onOpen: OpenFn }) {
  const { spend, wallet } = data;
  const delta = spend.last_month > 0 ? (spend.this_month - spend.last_month) / spend.last_month : null;
  return (
    <div className="flex h-full flex-col justify-between gap-5 rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
      <div>
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          <Wallet className="h-3.5 w-3.5" aria-hidden /> {wallet ? "Wallet balance" : "Spent this month"}
        </p>
        <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{inrExact.format(wallet ? wallet.balance : spend.this_month)}</p>
        {wallet && !wallet.is_owner ? <p className="mt-1 text-xs text-muted-foreground">Your supervisor's wallet</p> : null}
      </div>
      <div className="space-y-3">
        {wallet ? (
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">Spent this month</span>
            <span className="font-medium tabular-nums">{inr.format(spend.this_month)}</span>
          </div>
        ) : null}
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">vs last month</span>
          {delta == null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <span className={cn("inline-flex items-center gap-0.5 font-medium tabular-nums", delta > 0 ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300")}>
              {delta > 0 ? <ArrowUpRight className="h-4 w-4" aria-hidden /> : <ArrowDownRight className="h-4 w-4" aria-hidden />}
              {Math.abs(Math.round(delta * 100))}%
            </span>
          )}
        </div>
        <LinkButton onClick={() => onOpen("/wallet", "Wallet")}>{wallet ? "Recharge and transactions" : "Wallet"}</LinkButton>
      </div>
    </div>
  );
}

function Schedule({ rows, now, onOpen }: { rows: MyActivityBooking[]; now: Date; onOpen: OpenFn }) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Nothing scheduled. Your upcoming sessions appear here.</p>;
  }
  return (
    <ol className="relative space-y-1">
      {rows.map((b) => {
        const start = asDate(b.slot_start);
        return (
          <li key={b.id}>
            <button
              type="button"
              onClick={() => onOpen(bookingPath(b), "My Bookings")}
              className="flex w-full items-center gap-4 rounded-xl px-2 py-2.5 text-left transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex w-14 shrink-0 flex-col items-center rounded-lg border border-border/70 bg-muted/30 py-1 text-center">
                {start ? (
                  <>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{start.toLocaleDateString("en-IN", { month: "short" })}</span>
                    <span className="text-lg font-semibold leading-tight tabular-nums">{start.getDate()}</span>
                  </>
                ) : (
                  <Clock className="my-2 h-4 w-4 text-muted-foreground" aria-label="No slot yet" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium">{b.equipment.name}</span>
                  <StatusPill status={b.status} label={b.status_display} />
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span>{start ? `${dayLabel(start)}, ${timeLabel(start)}` : "Slot to be confirmed"}</span>
                  <span className="font-mono">{b.display_id}</span>
                  <SampleDeadline iso={b.sample_deadline} now={now} />
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function SpendTrend({ data }: { data: MyActivityData }) {
  const months = data.spend.months;
  const max = Math.max(...months.map((m) => m.amount), 1);
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-2xl font-semibold tabular-nums tracking-tight">{inr.format(data.spend.year)}</p>
        <p className="text-xs text-muted-foreground">this year · {data.hours.year} h</p>
      </div>
      <ul className="mt-5 flex h-36 items-end gap-2" aria-label="Spending in the last six months">
        {months.map((m, i) => {
          const label = new Date(`${m.month}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short" });
          const current = i === months.length - 1;
          return (
            <li key={m.month} className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5" title={`${label}: ${inr.format(m.amount)} · ${m.bookings} booking${m.bookings === 1 ? "" : "s"}`}>
              <span className="text-[10px] tabular-nums text-muted-foreground opacity-0 transition group-hover:opacity-100">{inr.format(m.amount)}</span>
              <span
                className={cn("w-full max-w-[28px] rounded-md transition-all", current ? "bg-primary dark:bg-sky-400" : "bg-primary/25 group-hover:bg-primary/40 dark:bg-sky-400/25")}
                style={{ height: `${Math.max((m.amount / max) * 100, m.amount > 0 ? 4 : 2)}%` }}
              />
              <span className={cn("text-[11px]", current ? "font-semibold text-foreground" : "text-muted-foreground")}>{label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Dashboard "My activity" for internal and external users: the next session with its sample deadline, what needs
 * the user's attention, schedule, new results, spending and quick re-booking. One request (``/profiles/me/activity/``).
 */
export default function MyActivity({ onOpen }: { onOpen: OpenFn }) {
  const [data, setData] = useState<MyActivityData | null>(null);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async () => {
    const res = await apiClient.getMyActivity();
    if (res.error || !res.data) setError(true);
    else {
      setError(false);
      setData(res.data);
      setNow(new Date());
    }
  }, []);

  useEffect(() => {
    void load();
    const tick = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(tick);
  }, [load]);

  const attention = useMemo(() => (data ? data.counts.awaiting_payment + data.counts.needs_choice : 0), [data]);

  const heading = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">My activity</h2>
        <p className="text-sm text-muted-foreground">{now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p>
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => void load()} aria-label="Refresh my activity">
          <RefreshCw className="h-4 w-4" aria-hidden />
        </Button>
        <Button size="sm" className="gap-1.5" onClick={() => onOpen("/equipments", "Browse and Book Equipment")}>
          <Plus className="h-4 w-4" aria-hidden /> Book equipment
        </Button>
      </div>
    </div>
  );

  if (!data) {
    return (
      <section className="mt-6 space-y-4" aria-busy={!error}>
        {heading}
        <div className="flex items-center justify-center rounded-2xl border border-border/70 bg-card py-14 text-sm text-muted-foreground">
          {error ? (
            <span>
              Your activity could not be loaded.{" "}
              <button type="button" className="font-medium text-primary hover:underline" onClick={() => void load()}>
                Try again
              </button>
            </span>
          ) : (
            <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading your activity" />
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="mt-6 space-y-4" data-testid="my-activity">
      {heading}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <NextUp next={data.next} now={now} onOpen={onOpen} />
        </div>
        <SpendCard data={data} onOpen={onOpen} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric
          icon={<CalendarDays className="h-4 w-4" aria-hidden />}
          label="Upcoming"
          value={data.counts.upcoming}
          hint={data.counts.waitlisted ? `${data.counts.waitlisted} on the waitlist` : "Sessions and requests"}
          onClick={() => onOpen("/my-bookings", "My Bookings")}
        />
        <Metric
          icon={<AlertTriangle className="h-4 w-4" aria-hidden />}
          label="Needs your action"
          value={attention}
          tone={attention ? "attention" : "default"}
          hint={
            attention
              ? [data.counts.awaiting_payment ? `${data.counts.awaiting_payment} awaiting payment` : "", data.counts.needs_choice ? `${data.counts.needs_choice} awaiting your choice` : ""]
                  .filter(Boolean)
                  .join(" · ")
              : "You're all caught up"
          }
          onClick={() => onOpen("/my-bookings", "My Bookings")}
        />
        <Metric
          icon={<FileText className="h-4 w-4" aria-hidden />}
          label="New results"
          value={data.results.new}
          hint={data.counts.processing ? `${data.counts.processing} being processed` : "Ready to download"}
          onClick={() => onOpen("/my-results", "My Results")}
        />
        <Metric
          icon={<Clock className="h-4 w-4" aria-hidden />}
          label="Instrument time"
          value={<>{data.hours.this_month}<span className="ml-1 text-base font-medium text-muted-foreground">h</span></>}
          hint={`This month · ${data.counts.completed_month} completed`}
          onClick={() => onOpen("/my-bookings", "My Bookings")}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel
          title="Schedule"
          className="lg:col-span-3"
          action={<LinkButton onClick={() => onOpen("/my-bookings", "My Bookings")}>All bookings</LinkButton>}
        >
          <Schedule rows={data.upcoming} now={now} onOpen={onOpen} />
        </Panel>
        <Panel title="Spending" className="lg:col-span-2" action={<LinkButton onClick={() => onOpen("/wallet", "Wallet")}>Wallet</LinkButton>}>
          <SpendTrend data={data} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Recent results" action={<LinkButton onClick={() => onOpen("/my-results", "My Results")}>All results</LinkButton>}>
          {data.results.recent.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Results from completed bookings appear here.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {data.results.recent.map((r) => {
                const ready = asDate(r.ready_at);
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => onOpen("/my-results", "My Results")}
                      className="flex w-full items-center gap-3 py-2.5 text-left hover:opacity-80"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                        <CheckCircle2 className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <span className="truncate">{r.equipment.name}</span>
                          {r.new ? <span className="rounded-full bg-primary px-1.5 py-px text-[10px] font-semibold uppercase text-primary-foreground">New</span> : null}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {r.files} file{r.files === 1 ? "" : "s"}
                          {ready ? ` · ${dayLabel(ready)}` : ""} · <span className="font-mono">{r.display_id}</span>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
        <Panel title="Book again">
          {data.book_again.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">The instruments you use most will appear here.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {data.book_again.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    disabled={!e.available}
                    onClick={() => onOpen(`/book-equipment?equipment_id=${e.id}`, "Book Equipment")}
                    className="flex w-full items-center gap-3 rounded-xl border border-border/70 p-3 text-left transition hover:border-primary/50 hover:bg-primary/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary dark:text-sky-300">
                      <FlaskConical className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{e.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {e.available ? `Booked ${e.times}× this year` : "Not bookable right now"}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <CalendarClock className="h-3.5 w-3.5" aria-hidden /> Spending counts charged bookings, by the month they were made.
      </p>
    </section>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  Sparkles,
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

/** True unless the device asks for reduced motion (or cannot say, as in tests). */
function motionAllowed(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** The number counts up from zero the first time it is shown; reduced motion shows it at once. */
function useCountUp(target: number, ms = 1100): number {
  const [shown, setShown] = useState<number | null>(null);
  const done = useRef(false);
  useEffect(() => {
    if (!Number.isFinite(target) || target <= 0 || done.current || !motionAllowed()) return;
    done.current = true;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setShown(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
      else setShown(null);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, ms]);
  return shown ?? target;
}

function CountUp({ value, format }: { value: number; format?: (n: number) => string }) {
  const n = useCountUp(value);
  return <>{format ? format(n) : Math.round(n).toLocaleString("en-IN")}</>;
}

/** Staggered entrance for each block (no movement with reduced motion). */
const enter = (delay: string) => cn("motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:fill-mode-both motion-safe:duration-700", delay);

function SampleDeadline({ iso, now, onDark = false }: { iso?: string | null; now: Date; onDark?: boolean }) {
  const d = asDate(iso);
  if (!d) return null;
  const hoursLeft = (d.getTime() - now.getTime()) / 3600000;
  const tone =
    hoursLeft < 0
      ? onDark ? "bg-rose-500/20 text-rose-100 ring-rose-300/30" : "text-rose-700 dark:text-rose-300"
      : hoursLeft < 24
        ? onDark ? "bg-amber-400/20 text-amber-100 ring-amber-300/30" : "text-amber-700 dark:text-amber-300"
        : onDark ? "bg-white/10 text-white/85 ring-white/15" : "text-muted-foreground";
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", onDark && "rounded-full px-2.5 py-1 ring-1 backdrop-blur-sm", tone)}>
      {hoursLeft < 24 ? <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> : <Hourglass className="h-3.5 w-3.5" aria-hidden />}
      {hoursLeft < 0 ? "Sample was due " : "Sample due "}
      {dayLabel(d)}, {timeLabel(d)}
    </span>
  );
}

function Panel({ title, icon, action, children, className }: { title: string; icon?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "relative flex flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white/85 shadow-[0_10px_40px_-20px_hsl(215_40%_30%/0.35)] backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/70 dark:shadow-[0_10px_40px_-20px_hsl(0_0%_0%/0.7)]",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-2 px-5 pb-2 pt-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          {icon ? <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-sky-400/10 dark:text-sky-300">{icon}</span> : null}
          {title}
        </h3>
        {action}
      </header>
      <div className="flex-1 px-5 pb-5 pt-2">{children}</div>
    </section>
  );
}

function LinkButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-primary transition hover:bg-primary/5 dark:text-sky-300 dark:hover:bg-sky-400/10"
    >
      {children}
      <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden />
    </button>
  );
}

const METRIC_TONES = {
  sky: { tile: "from-sky-400 to-blue-600 shadow-sky-500/30", bar: "from-sky-400 to-blue-500", glow: "bg-sky-400/15" },
  amber: { tile: "from-amber-400 to-orange-500 shadow-amber-500/30", bar: "from-amber-400 to-orange-500", glow: "bg-amber-400/20" },
  emerald: { tile: "from-emerald-400 to-teal-600 shadow-emerald-500/30", bar: "from-emerald-400 to-teal-500", glow: "bg-emerald-400/15" },
  violet: { tile: "from-violet-400 to-indigo-600 shadow-violet-500/30", bar: "from-violet-400 to-indigo-500", glow: "bg-violet-400/15" },
  slate: { tile: "from-slate-300 to-slate-500 shadow-slate-500/20", bar: "from-slate-300 to-slate-400", glow: "bg-slate-400/10" },
} as const;

function Metric({ icon, label, value, suffix, hint, tone, onClick, className }: {
  icon: ReactNode;
  label: string;
  value: number;
  suffix?: string;
  hint: ReactNode;
  tone: keyof typeof METRIC_TONES;
  onClick: () => void;
  className?: string;
}) {
  const t = METRIC_TONES[tone];
  const decimals = Number.isInteger(value) ? 0 : 1;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex min-w-0 flex-col gap-3 overflow-hidden rounded-3xl border border-slate-200/80 bg-white/85 p-4 text-left shadow-[0_10px_40px_-22px_hsl(215_40%_30%/0.4)] backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_50px_-20px_hsl(215_50%_35%/0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5 dark:border-white/10 dark:bg-slate-900/70",
        className,
      )}
    >
      <span aria-hidden className={cn("pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full blur-2xl transition group-hover:scale-125", t.glow)} />
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", t.bar)} />
      <span className="relative flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
        {label}
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg", t.tile)}>{icon}</span>
      </span>
      <span className="relative text-3xl font-bold tabular-nums tracking-tight">
        <CountUp value={value} format={(n) => n.toFixed(decimals)} />
        {suffix ? <span className="ml-1 text-base font-medium text-muted-foreground">{suffix}</span> : null}
      </span>
      <span className="relative truncate text-xs text-muted-foreground">{hint}</span>
    </button>
  );
}

/** Days, hours and minutes to the session, as glass tiles. */
function Countdown({ start, now }: { start: Date; now: Date }) {
  const mins = Math.max(0, Math.round((start.getTime() - now.getTime()) / 60000));
  const parts: Array<[number, string]> = [
    [Math.floor(mins / 1440), "days"],
    [Math.floor((mins % 1440) / 60), "hrs"],
    [mins % 60, "min"],
  ];
  return (
    <div className="flex gap-2" aria-hidden>
      {parts.map(([n, unit]) => (
        <span key={unit} className="flex w-14 flex-col items-center rounded-2xl bg-white/10 py-2 ring-1 ring-white/15 backdrop-blur-md sm:w-16">
          <span className="text-2xl font-bold leading-none tabular-nums sm:text-3xl">{String(n).padStart(2, "0")}</span>
          <span className="mt-1 text-[10px] font-medium uppercase tracking-widest text-white/60">{unit}</span>
        </span>
      ))}
    </div>
  );
}

const HERO_CARD =
  "relative isolate flex h-full flex-col justify-between gap-6 overflow-hidden rounded-3xl bg-[hsl(220_62%_13%)] p-6 text-white shadow-[0_24px_60px_-24px_hsl(218_70%_20%/0.8)] sm:p-7";

function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(222_65%_12%)] via-[hsl(216_70%_20%)] to-[hsl(205_85%_32%)]" />
      <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-sky-400/30 blur-3xl motion-safe:animate-hero-float" />
      <div className="absolute -bottom-32 left-1/4 h-72 w-72 rounded-full bg-amber-300/20 blur-3xl motion-safe:animate-hero-float-slow" />
      <div className="absolute inset-0 bg-[radial-gradient(hsl(0_0%_100%/0.09)_1px,transparent_1px)] [background-size:20px_20px] [mask-image:linear-gradient(to_left,black,transparent_75%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
    </div>
  );
}

function NextUp({ next, now, onOpen }: { next: MyActivityBooking | null; now: Date; onOpen: OpenFn }) {
  const start = asDate(next?.slot_start);
  const end = asDate(next?.slot_end);
  if (!next || !start) {
    return (
      <div className={HERO_CARD}>
        <HeroBackdrop />
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-sky-200/80">
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> Next up
          </p>
          <p className="mt-3 text-2xl font-bold tracking-tight">No sessions scheduled</p>
          <p className="mt-1.5 max-w-md text-sm text-white/75">Book an instrument and your next session, its sample deadline and countdown will appear here.</p>
        </div>
        <div>
          <Button size="sm" className="gap-1.5 rounded-full bg-white px-4 text-slate-900 shadow-lg shadow-black/20 hover:bg-white/90" onClick={() => onOpen("/equipments", "Browse and Book Equipment")}>
            <Plus className="h-4 w-4" aria-hidden /> Book equipment
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className={HERO_CARD} data-testid="my-activity-next">
      <HeroBackdrop />
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex min-w-0 items-start gap-4 sm:gap-5">
          <div className="flex w-16 shrink-0 flex-col items-center rounded-2xl bg-gradient-to-b from-white to-sky-50 py-2 text-[hsl(218_62%_20%)] shadow-xl shadow-black/25">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600">{start.toLocaleDateString("en-IN", { month: "short" })}</span>
            <span className="text-3xl font-extrabold leading-none tabular-nums">{start.getDate()}</span>
            <span className="mt-0.5 text-[11px] font-medium text-slate-500">{start.toLocaleDateString("en-IN", { weekday: "short" })}</span>
          </div>
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-200/90">
              <span className="relative flex h-2 w-2" aria-hidden>
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Next up · {relativeTo(start, now)}
            </p>
            <p className="mt-1.5 text-xl font-bold tracking-tight sm:text-2xl">{next.equipment.name}</p>
            <p className="mt-1 text-sm text-white/75">
              {timeLabel(start)}
              {end ? ` – ${timeLabel(end)}` : ""} · <span className="font-mono text-xs">{next.display_id}</span>
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <SampleDeadline iso={next.sample_deadline} now={now} onDark />
            </div>
          </div>
        </div>
        <Countdown start={start} now={now} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="gap-1.5 rounded-full bg-white px-4 text-slate-900 shadow-lg shadow-black/20 hover:bg-white/90" onClick={() => onOpen(bookingPath(next), "My Bookings")}>
          View booking <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
        <Button size="sm" variant="ghost" className="rounded-full px-4 text-white ring-1 ring-white/25 hover:bg-white/10 hover:text-white" onClick={() => onOpen("/my-bookings", "My Bookings")}>
          All bookings
        </Button>
      </div>
    </div>
  );
}

/** The wallet as a gold card. */
function SpendCard({ data, onOpen }: { data: MyActivityData; onOpen: OpenFn }) {
  const { spend, wallet } = data;
  const delta = spend.last_month > 0 ? (spend.this_month - spend.last_month) / spend.last_month : null;
  return (
    <div className="relative isolate flex h-full flex-col justify-between gap-5 overflow-hidden rounded-3xl border border-amber-200/80 bg-gradient-to-br from-amber-100 via-[hsl(45_90%_94%)] to-white p-6 text-slate-900 shadow-[0_24px_60px_-28px_hsl(38_80%_40%/0.55)] sm:p-7 dark:border-amber-400/20 dark:from-[hsl(38_45%_18%)] dark:via-[hsl(222_40%_12%)] dark:to-[hsl(222_45%_10%)] dark:text-white">
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 -z-10 h-48 w-48 rounded-full bg-amber-300/40 blur-3xl dark:bg-amber-400/15" />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(115deg,transparent_35%,hsl(0_0%_100%/0.55)_50%,transparent_65%)] dark:bg-[linear-gradient(115deg,transparent_35%,hsl(0_0%_100%/0.06)_50%,transparent_65%)]" />
      <div>
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-amber-800/80 dark:text-amber-200/80">
            <Wallet className="h-3.5 w-3.5" aria-hidden /> {wallet ? "Wallet balance" : "Spent this month"}
          </p>
          <span aria-hidden className="h-7 w-10 rounded-md bg-gradient-to-br from-amber-300 via-amber-200 to-amber-400 shadow-inner ring-1 ring-amber-500/30" />
        </div>
        <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight sm:text-4xl">
          <CountUp value={wallet ? wallet.balance : spend.this_month} format={(n) => inrExact.format(n)} />
        </p>
        {wallet && !wallet.is_owner ? <p className="mt-1 text-xs text-slate-600 dark:text-white/60">Your supervisor's wallet</p> : null}
      </div>
      <div className="space-y-3">
        {wallet ? (
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-slate-600 dark:text-white/60">Spent this month</span>
            <span className="font-semibold tabular-nums">{inr.format(spend.this_month)}</span>
          </div>
        ) : null}
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-slate-600 dark:text-white/60">vs last month</span>
          {delta == null ? (
            <span className="text-slate-500 dark:text-white/50">—</span>
          ) : (
            <span className={cn("inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums", delta > 0 ? "bg-amber-200/70 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200")}>
              {delta > 0 ? <ArrowUpRight className="h-3.5 w-3.5" aria-hidden /> : <ArrowDownRight className="h-3.5 w-3.5" aria-hidden />}
              {Math.abs(Math.round(delta * 100))}%
            </span>
          )}
        </div>
        <LinkButton onClick={() => onOpen("/wallet", "Wallet")}>{wallet ? "Recharge and transactions" : "Wallet"}</LinkButton>
      </div>
    </div>
  );
}

/** Upcoming sessions as a timeline. */
function Schedule({ rows, now, onOpen }: { rows: MyActivityBooking[]; now: Date; onOpen: OpenFn }) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Nothing scheduled. Your upcoming sessions appear here.</p>;
  }
  return (
    <ol className="relative space-y-1.5">
      <span aria-hidden className="absolute bottom-4 left-[1.7rem] top-4 w-px bg-gradient-to-b from-sky-400/70 via-sky-300/40 to-transparent dark:from-sky-400/50" />
      {rows.map((b, i) => {
        const start = asDate(b.slot_start);
        return (
          <li key={b.id} className="relative">
            <button
              type="button"
              onClick={() => onOpen(bookingPath(b), "My Bookings")}
              className="group flex w-full items-center gap-4 rounded-2xl px-2 py-2.5 text-left transition hover:bg-sky-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-white/5"
            >
              <span
                className={cn(
                  "relative z-10 flex w-[3.25rem] shrink-0 flex-col items-center rounded-xl py-1 text-center shadow-sm ring-1",
                  i === 0
                    ? "bg-gradient-to-b from-sky-500 to-blue-600 text-white ring-sky-400/50 shadow-sky-500/30"
                    : "bg-white text-foreground ring-slate-200 dark:bg-slate-800 dark:ring-white/10",
                )}
              >
                {start ? (
                  <>
                    <span className={cn("text-[10px] font-semibold uppercase tracking-wider", i === 0 ? "text-white/80" : "text-muted-foreground")}>{start.toLocaleDateString("en-IN", { month: "short" })}</span>
                    <span className="text-lg font-bold leading-tight tabular-nums">{start.getDate()}</span>
                  </>
                ) : (
                  <Clock className="my-2 h-4 w-4 opacity-70" aria-label="No slot yet" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-semibold">{b.equipment.name}</span>
                  <StatusPill status={b.status} label={b.status_display} />
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span>{start ? `${dayLabel(start)}, ${timeLabel(start)}` : "Slot to be confirmed"}</span>
                  <span className="font-mono">{b.display_id}</span>
                  <SampleDeadline iso={b.sample_deadline} now={now} />
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
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
        <p className="bg-gradient-to-r from-[hsl(218_65%_22%)] to-[hsl(205_85%_38%)] bg-clip-text text-3xl font-bold tabular-nums tracking-tight text-transparent dark:from-white dark:to-sky-300">
          <CountUp value={data.spend.year} format={(n) => inr.format(n)} />
        </p>
        <p className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-muted-foreground dark:bg-white/5">this year · {data.hours.year} h</p>
      </div>
      <ul className="mt-5 flex h-40 items-end gap-2.5" aria-label="Spending in the last six months">
        {months.map((m, i) => {
          const label = new Date(`${m.month}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short" });
          const current = i === months.length - 1;
          const pct = Math.max((m.amount / max) * 100, m.amount > 0 ? 6 : 3);
          return (
            <li key={m.month} className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5" title={`${label}: ${inr.format(m.amount)} · ${m.bookings} booking${m.bookings === 1 ? "" : "s"}`}>
              <span className={cn("text-[10px] tabular-nums transition", current && m.amount > 0 ? "font-semibold text-foreground" : "text-muted-foreground opacity-0 group-hover:opacity-100")}>{inr.format(m.amount)}</span>
              <span
                className={cn(
                  "w-full max-w-[30px] origin-bottom rounded-t-lg rounded-b-sm transition-all motion-safe:animate-bar-grow",
                  current
                    ? "bg-gradient-to-t from-blue-600 via-sky-500 to-cyan-300 shadow-[0_0_24px_-4px_hsl(199_90%_55%/0.7)]"
                    : "bg-gradient-to-t from-sky-200 to-sky-100 group-hover:from-sky-300 group-hover:to-sky-200 dark:from-sky-400/30 dark:to-sky-400/10",
                )}
                style={{ height: `${pct}%` }}
              />
              <span className={cn("text-[11px]", current ? "font-semibold text-foreground" : "text-muted-foreground")}>{label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function greeting(now: Date): string {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/**
 * Dashboard "My activity" for internal and external users: the next session with its sample deadline, what needs
 * the user's attention, schedule, new results, spending and quick re-booking. One request (``/profiles/me/activity/``).
 */
export default function MyActivity({ onOpen, userName }: { onOpen: OpenFn; userName?: string | null }) {
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
  const firstName = (userName || "").trim().split(/\s+/)[0] || "";

  const heading = (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", enter("delay-0"))}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700/80 dark:text-sky-300/80">My activity</p>
        <h2 className="mt-1 bg-gradient-to-r from-[hsl(218_65%_20%)] via-[hsl(212_72%_32%)] to-[hsl(200_85%_38%)] bg-clip-text text-2xl font-bold tracking-tight text-transparent sm:text-3xl dark:from-white dark:via-sky-100 dark:to-sky-300">
          {greeting(now)}{firstName ? `, ${firstName}` : ""}
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p>
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" className="gap-1.5 rounded-full" onClick={() => void load()} aria-label="Refresh my activity">
          <RefreshCw className="h-4 w-4" aria-hidden />
        </Button>
        <Button
          size="sm"
          className="gap-1.5 rounded-full bg-gradient-to-r from-[hsl(218_65%_24%)] to-[hsl(205_85%_38%)] px-4 text-white shadow-lg shadow-sky-700/25 transition hover:brightness-110"
          onClick={() => onOpen("/equipments", "Browse and Book Equipment")}
        >
          <Plus className="h-4 w-4" aria-hidden /> Book equipment
        </Button>
      </div>
    </div>
  );

  const shell = "relative mt-6 isolate space-y-5 rounded-[2rem] p-1 sm:p-2";
  const backdrop = (
    <div aria-hidden className="pointer-events-none absolute -inset-x-2 -inset-y-3 -z-10 overflow-hidden rounded-[2.25rem]">
      <div className="absolute inset-0 bg-gradient-to-br from-sky-50/90 via-white/40 to-amber-50/70 dark:from-sky-500/[0.06] dark:via-transparent dark:to-amber-400/[0.05]" />
      <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-sky-300/25 blur-3xl dark:bg-sky-500/10" />
      <div className="absolute -right-16 bottom-0 h-72 w-72 rounded-full bg-amber-200/30 blur-3xl dark:bg-amber-400/5" />
    </div>
  );

  if (!data) {
    return (
      <section className={shell} aria-busy={!error}>
        {backdrop}
        {heading}
        <div className="flex items-center justify-center rounded-3xl border border-slate-200/80 bg-white/80 py-14 text-sm text-muted-foreground dark:border-white/10 dark:bg-slate-900/70">
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
    <section className={shell} data-testid="my-activity">
      {backdrop}
      {heading}

      <div className={cn("grid gap-4 lg:grid-cols-3", enter("delay-75"))}>
        <div className="lg:col-span-2">
          <NextUp next={data.next} now={now} onOpen={onOpen} />
        </div>
        <SpendCard data={data} onOpen={onOpen} />
      </div>

      <div className={cn("grid grid-cols-2 gap-4 lg:grid-cols-4", enter("delay-150"))}>
        <Metric
          icon={<CalendarDays className="h-4 w-4" aria-hidden />}
          label="Upcoming"
          value={data.counts.upcoming}
          tone="sky"
          hint={data.counts.waitlisted ? `${data.counts.waitlisted} on the waitlist` : "Sessions and requests"}
          onClick={() => onOpen("/my-bookings", "My Bookings")}
        />
        <Metric
          icon={<AlertTriangle className="h-4 w-4" aria-hidden />}
          label="Needs your action"
          value={attention}
          tone={attention ? "amber" : "slate"}
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
          tone="emerald"
          hint={data.counts.processing ? `${data.counts.processing} being processed` : "Ready to download"}
          onClick={() => onOpen("/my-results", "My Results")}
        />
        <Metric
          icon={<Clock className="h-4 w-4" aria-hidden />}
          label="Instrument time"
          value={data.hours.this_month}
          suffix="h"
          tone="violet"
          hint={`This month · ${data.counts.completed_month} completed`}
          onClick={() => onOpen("/my-bookings", "My Bookings")}
        />
      </div>

      <div className={cn("grid gap-4 lg:grid-cols-5", enter("delay-200"))}>
        <Panel
          title="Schedule"
          icon={<CalendarDays className="h-3.5 w-3.5" aria-hidden />}
          className="lg:col-span-3"
          action={<LinkButton onClick={() => onOpen("/my-bookings", "My Bookings")}>All bookings</LinkButton>}
        >
          <Schedule rows={data.upcoming} now={now} onOpen={onOpen} />
        </Panel>
        <Panel
          title="Spending"
          icon={<Wallet className="h-3.5 w-3.5" aria-hidden />}
          className="lg:col-span-2"
          action={<LinkButton onClick={() => onOpen("/wallet", "Wallet")}>Wallet</LinkButton>}
        >
          <SpendTrend data={data} />
        </Panel>
      </div>

      <div className={cn("grid gap-4 lg:grid-cols-2", enter("delay-300"))}>
        <Panel
          title="Recent results"
          icon={<CheckCircle2 className="h-3.5 w-3.5" aria-hidden />}
          action={<LinkButton onClick={() => onOpen("/my-results", "My Results")}>All results</LinkButton>}
        >
          {data.results.recent.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-5 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-50 text-emerald-600 ring-1 ring-emerald-200/70 dark:from-emerald-400/10 dark:to-transparent dark:text-emerald-300 dark:ring-emerald-400/20">
                <FileText className="h-5 w-5" aria-hidden />
              </span>
              <p className="text-sm text-muted-foreground">Results from completed bookings appear here.</p>
            </div>
          ) : (
            <ul className="space-y-1">
              {data.results.recent.map((r) => {
                const ready = asDate(r.ready_at);
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => onOpen("/my-results", "My Results")}
                      className="group flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition hover:bg-emerald-50/70 dark:hover:bg-white/5"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-lg shadow-emerald-500/25">
                        <CheckCircle2 className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-sm font-semibold">
                          <span className="truncate">{r.equipment.name}</span>
                          {r.new ? <span className="rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-1.5 py-px text-[10px] font-semibold uppercase text-white">New</span> : null}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {r.files} file{r.files === 1 ? "" : "s"}
                          {ready ? ` · ${dayLabel(ready)}` : ""} · <span className="font-mono">{r.display_id}</span>
                        </span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
        <Panel title="Book again" icon={<FlaskConical className="h-3.5 w-3.5" aria-hidden />}>
          {data.book_again.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-5 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-100 to-indigo-50 text-sky-600 ring-1 ring-sky-200/70 dark:from-sky-400/10 dark:to-transparent dark:text-sky-300 dark:ring-sky-400/20">
                <FlaskConical className="h-5 w-5" aria-hidden />
              </span>
              <p className="text-sm text-muted-foreground">The instruments you use most will appear here.</p>
            </div>
          ) : (
            <ul className="grid gap-2.5 sm:grid-cols-2">
              {data.book_again.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    disabled={!e.available}
                    onClick={() => onOpen(`/book-equipment?equipment_id=${e.id}`, "Book Equipment")}
                    className="group flex w-full items-center gap-3 rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-sky-50/60 p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:from-slate-900 dark:to-sky-500/[0.06] dark:hover:border-sky-400/40"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-indigo-600 text-white shadow-lg shadow-sky-500/25">
                      <FlaskConical className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{e.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {e.available ? `Booked ${e.times}× this year` : "Not bookable right now"}
                      </span>
                    </span>
                    {e.available ? <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden /> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <p className="flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
        <CalendarClock className="h-3.5 w-3.5" aria-hidden /> Spending counts charged bookings, by the month they were made.
      </p>
    </section>
  );
}

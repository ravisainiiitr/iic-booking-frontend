import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType } from "react";
import {
  Ban, CalendarCheck2, CalendarClock, CheckCircle2, Clock3, FilePlus2, Hourglass, Loader2, Microscope, MoonStar,
  Radio, ReceiptText, UserCheck, UserPlus, XCircle,
} from "lucide-react";

import { PageShell } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { apiClient, type IstemLiveEvent, type IstemLiveFeed, type IstemLiveKind, type IstemLiveWaiting } from "@/lib/api";
import { cn } from "@/lib/utils";

/** How often the page asks for new I-STEM activity while it is on screen. */
export const POLL_MS = 2000;
const FRESH_MS = 8000;

type KindStyle = { icon: ComponentType<{ className?: string }>; tone: string };

const KIND: Record<string, KindStyle> = {
  user_created: { icon: UserPlus, tone: "bg-violet-500/15 text-violet-700 dark:text-violet-300" },
  user_existing: { icon: UserCheck, tone: "bg-violet-500/15 text-violet-700 dark:text-violet-300" },
  booking_created: { icon: FilePlus2, tone: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  booking_allocated: { icon: CalendarCheck2, tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  fbr_executed: { icon: ReceiptText, tone: "bg-teal-500/15 text-teal-700 dark:text-teal-300" },
  booking_cancelled: { icon: Ban, tone: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
  booking_moved: { icon: CalendarClock, tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  equipment_created: { icon: Microscope, tone: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300" },
};
const FALLBACK: KindStyle = { icon: Radio, tone: "bg-muted text-muted-foreground" };
const kindStyle = (kind: IstemLiveKind) => KIND[kind] ?? FALLBACK;

const STATUS: Record<string, { label: string; className: string }> = {
  done: { label: "Done on I-STEM", className: "border-emerald-500/40 text-emerald-700 dark:text-emerald-300" },
  sending: { label: "Sending", className: "border-sky-500/40 text-sky-700 dark:text-sky-300" },
  refused: { label: "Refused", className: "border-rose-500/40 text-rose-700 dark:text-rose-300" },
  uncertain: { label: "Outcome uncertain", className: "border-amber-500/40 text-amber-700 dark:text-amber-300" },
  unknown: { label: "Unknown", className: "border-border text-muted-foreground" },
};

const clock = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
const day = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

export function formatSeconds(seconds: number | null | undefined): string {
  if (seconds == null) return "-";
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return minutes < 60 ? `${minutes} min ${rest} s` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

function when(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return today ? clock.format(d) : `${day.format(d)}, ${clock.format(d)}`;
}

function Identifiers({ e }: { e: IstemLiveEvent }) {
  const ids = [
    e.fbr_no ? ["FBR", e.fbr_no] : null,
    e.request_id ? ["Request", e.request_id] : null,
    e.confirmation_id ? ["Confirmation", e.confirmation_id] : null,
    e.istem_user_id ? ["I-STEM user", e.istem_user_id] : null,
    e.istem_equipment_id ? ["I-STEM equipment", e.istem_equipment_id] : null,
  ].filter(Boolean) as [string, string][];
  if (!ids.length) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {ids.map(([k, v]) => (
        <span key={k} className="rounded-md bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] text-foreground/80">
          {k} {v}
        </span>
      ))}
    </div>
  );
}

function EventRow({ e, fresh }: { e: IstemLiveEvent; fresh: boolean }) {
  const { icon: Icon, tone } = kindStyle(e.kind);
  const status = STATUS[e.status] ?? STATUS.unknown;
  const subject = [e.booking_ref, e.equipment, e.user].filter(Boolean).join(" · ");
  return (
    <li
      className={cn("flex gap-3 px-4 py-3 transition-colors duration-1000", fresh && "bg-sky-500/10")}
      data-testid="istem-live-event"
      data-kind={e.kind}
    >
      <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", tone)}>
        <Icon className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-semibold">{e.label}</span>
          <Badge variant="outline" className={cn("h-5 px-1.5 text-[11px] font-medium", status.className)}>{status.label}</Badge>
        </div>
        {subject ? <p className="truncate text-xs text-muted-foreground">{subject}</p> : null}
        <Identifiers e={e} />
        {e.status !== "done" && e.detail ? <p className="mt-1 text-xs text-rose-700 dark:text-rose-300">{e.detail}</p> : null}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-xs tabular-nums text-muted-foreground">{when(e.answered_at || e.sent_at)}</p>
        {e.total_seconds != null ? (
          <p
            className="mt-1 text-sm font-semibold tabular-nums"
            title={`Waited ${formatSeconds(e.wait_seconds)} to be sent, I-STEM answered in ${formatSeconds(e.call_seconds)}`}
            data-testid="istem-live-total"
          >
            {formatSeconds(e.total_seconds)}
          </p>
        ) : null}
        {e.total_seconds != null ? <p className="text-[11px] text-muted-foreground">after the portal event</p> : null}
      </div>
    </li>
  );
}

function WaitingRow({ w, now }: { w: IstemLiveWaiting; now: number }) {
  const { icon: Icon, tone } = kindStyle(w.kind);
  const age = w.queued_at ? Math.max(0, (now - new Date(w.queued_at).getTime()) / 1000) : null;
  const retrying = w.state === "RETRY_WAIT";
  return (
    <li className="flex items-center gap-3 px-4 py-2.5" data-testid="istem-live-waiting">
      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", tone)}>
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{w.label}</p>
        <p className="truncate text-xs text-muted-foreground">
          {[w.booking_ref, w.equipment, w.user].filter(Boolean).join(" · ")}
          {retrying && w.next_attempt_at ? ` · retrying at ${when(w.next_attempt_at)}` : ""}
          {retrying && w.detail ? ` · ${w.detail}` : ""}
        </p>
      </div>
      <span className="flex items-center gap-1.5 text-xs font-medium tabular-nums text-sky-700 dark:text-sky-300">
        {retrying ? <Hourglass className="h-3.5 w-3.5" aria-hidden /> : <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
        {formatSeconds(age)}
      </span>
    </li>
  );
}

/**
 * Main Administrator: I-STEM activity as it happens, for the end-to-end demonstration (portal on one half of the screen,
 * I-STEM on the other). Each row is one call to I-STEM with the time from the portal event to I-STEM's answer.
 */
export default function AdminIstemLive() {
  const [feed, setFeed] = useState<IstemLiveFeed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const seen = useRef<Map<string, number>>(new Map());
  const first = useRef(true);

  const load = useCallback(async () => {
    const res = await apiClient.getIstemLiveFeed();
    if (res.data) {
      const at = Date.now();
      for (const e of res.data.events) {
        if (!seen.current.has(e.id)) seen.current.set(e.id, first.current ? 0 : at);
      }
      first.current = false;
      setFeed(res.data);
      setError(null);
    } else if (res.error) setError(res.error);
  }, []);

  useEffect(() => {
    void load();
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(tick);
    };
  }, [load]);

  const stats = useMemo(() => (feed?.stats ?? []).filter((s) => s.calls > 0), [feed]);

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
              I-STEM live
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Every portal event sent to I-STEM, as it happens: users, bookings and allocation (FBR), completion (FBR
              Execute), cancellations, reschedules and equipment.
            </p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            {feed ? (
              <>
                <p className="font-medium text-foreground">{feed.realtime ? "Real-time sync on" : "Real-time sync off"}</p>
                <p>Updated {clock.format(new Date(feed.server_time))}</p>
              </>
            ) : null}
          </div>
        </header>

        {error ? <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">{error}</p> : null}

        {feed?.peak.active ? (
          <div className="flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-sm" data-testid="istem-live-peak">
            <MoonStar className="h-4 w-4 shrink-0 text-indigo-600" aria-hidden />
            Peak booking window: I-STEM calls are held so bookings stay fast, and are sent at
            {feed.peak.ends_at ? ` ${clock.format(new Date(feed.peak.ends_at))}` : " the end of the window"}.
          </div>
        ) : null}

        {feed && feed.waiting.length ? (
          <section className="overflow-hidden rounded-2xl border border-sky-500/30 bg-card">
            <h2 className="flex items-center gap-2 border-b border-border/60 bg-sky-500/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-200">
              <Clock3 className="h-3.5 w-3.5" aria-hidden /> On the way to I-STEM
            </h2>
            <ul className="divide-y divide-border/60">
              {feed.waiting.map((w) => <WaitingRow key={w.id} w={w} now={now} />)}
            </ul>
          </section>
        ) : null}

        <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
          <h2 className="border-b border-border/60 bg-muted/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Last 24 hours
          </h2>
          {!feed ? (
            <p className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading I-STEM activity…
            </p>
          ) : feed.events.length ? (
            <ul className="divide-y divide-border/60">
              {feed.events.map((e) => {
                const seenAt = seen.current.get(e.id) ?? 0;
                return <EventRow key={e.id} e={e} fresh={seenAt > 0 && now - seenAt < FRESH_MS} />;
              })}
            </ul>
          ) : (
            <p className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden /> Nothing sent to I-STEM in the last 24 hours.
            </p>
          )}
        </section>

        {stats.length ? (
          <section className="rounded-2xl border border-border/70 bg-card p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Last 7 days: portal event to I-STEM answer</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {stats.map((s) => {
                const { icon: Icon, tone } = kindStyle(s.kind);
                return (
                  <div key={s.kind} className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2" data-testid="istem-live-stat">
                    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", tone)}>
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{s.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.calls} call{s.calls === 1 ? "" : "s"}
                        {s.failed ? (
                          <span className="text-rose-700 dark:text-rose-300">
                            {" "}· <XCircle className="inline h-3 w-3" aria-hidden /> {s.failed} not done
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">{formatSeconds(s.median_total_seconds)}</p>
                      <p className="text-[11px] text-muted-foreground">typical</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    </PageShell>
  );
}

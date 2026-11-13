import { useEffect, useState, type ReactNode } from "react";
import { Bell, BellRing, CheckCircle2, Clock3, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useCountdown } from "@/hooks/use-countdown";
import { notificationsPermission, requestSeatNotifications } from "@/hooks/use-seat-ready-alert";

export type SeatQueue = {
  is_queued?: boolean;
  title?: string;
  body?: string[] | string;
  position?: number | null;
  queue_size?: number | null;
  people_ahead?: number | null;
  estimated_wait_minutes?: number | null;
  expected_start_at?: string | null;
  reason?: string | null;
  reason_code?: string | null;
  average_session_minutes?: number | null;
};

function clock(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function mmss(total: number) {
  const s = Math.max(0, Math.floor(total));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * The one place a Remote Analysis user sees where they stand: waiting in line, or holding a PC.
 *
 * Follows virtual-waiting-room practice (Queue-it): position and people ahead, an estimated wait and start
 * time, why the wait exists, when the status was last checked, and a promise to notify — never a bare spinner.
 */
export function SeatStatusCard({
  mode,
  queue,
  holdSeconds,
  updatedAt,
  busy,
  onJoin,
  onRelease,
  joinDisabledReason,
}: {
  mode: "queued" | "held";
  queue: SeatQueue;
  holdSeconds?: number | null;
  updatedAt?: number | null;
  busy?: boolean;
  onJoin?: () => void;
  onRelease?: () => void;
  joinDisabledReason?: string | null;
}) {
  const hold = useCountdown(mode === "held" ? holdSeconds ?? null : null);
  const [perm, setPerm] = useState(notificationsPermission());
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 15000);
    return () => window.clearInterval(id);
  }, []);

  const updatedLabel = updatedAt
    ? (() => {
        const secs = Math.round((Date.now() - updatedAt) / 1000);
        return secs < 10 ? "just now" : secs < 60 ? `${secs} s ago` : `${Math.round(secs / 60)} min ago`;
      })()
    : null;

  if (mode === "held") {
    const urgent = hold != null && hold <= 120;
    return (
      <Card
        className={cn(
          "border-emerald-500/40 bg-emerald-500/5 shadow-md",
          urgent && "border-amber-500/60 bg-amber-500/10",
        )}
        role="status"
        aria-live="polite"
        data-testid="seat-held"
      >
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" aria-hidden />
            <div className="space-y-1">
              <p className="text-base font-semibold">Your Analysis PC is ready and held for you</p>
              <p className="text-sm text-muted-foreground">
                {hold != null && hold > 0 ? (
                  <>
                    Join within <span className="font-semibold tabular-nums text-foreground">{mmss(hold)}</span>. After that it
                    goes to the next person and you move to the end of the queue.
                  </>
                ) : (
                  "The hold is ending — join now or request analysis again."
                )}
              </p>
              {joinDisabledReason ? <p className="text-sm font-medium text-rose-700 dark:text-rose-300">{joinDisabledReason}</p> : null}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {onRelease ? (
              <Button variant="outline" onClick={onRelease} disabled={busy}>
                Give it to the next person
              </Button>
            ) : null}
            {onJoin ? (
              <Button size="lg" onClick={onJoin} disabled={busy || Boolean(joinDisabledReason)} className="min-w-[160px]">
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                Join session
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    );
  }

  const ahead = Math.max(0, Number(queue.people_ahead ?? (queue.position ? queue.position - 1 : 0)));
  const size = Math.max(Number(queue.queue_size || 0), Number(queue.position || 0), 1);
  const progress = queue.position ? Math.round(((size - ahead) / size) * 100) : 0;
  const start = clock(queue.expected_start_at);
  const wait = queue.estimated_wait_minutes;
  const reason =
    queue.reason ||
    (Array.isArray(queue.body) ? queue.body[0] : queue.body) ||
    "Every Analysis PC with this software is in use right now.";

  return (
    <Card className="border-amber-500/40 bg-amber-500/5 shadow-md" role="status" aria-live="polite" data-testid="seat-queued">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-base font-semibold">
              {queue.position ? (ahead === 0 ? "You are next in line" : `You are number ${queue.position} in line`) : "You are in the queue"}
            </p>
            <p className="max-w-2xl text-sm text-muted-foreground">{reason}</p>
          </div>
          {perm === "default" ? (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={async () => setPerm(await requestSeatNotifications())}
            >
              <Bell className="h-3.5 w-3.5" aria-hidden />
              Alert me in this browser
            </Button>
          ) : perm === "granted" ? (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300">
              <BellRing className="h-3.5 w-3.5" aria-hidden /> Browser alert on
            </span>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Stat icon={<Users className="h-3.5 w-3.5" aria-hidden />} label="People ahead of you" value={String(ahead)} />
          <Stat
            icon={<Clock3 className="h-3.5 w-3.5" aria-hidden />}
            label="Estimated wait"
            value={wait == null ? "Not known yet" : wait === 0 ? "Any moment" : `About ${wait} min`}
          />
          <Stat label="Expected start" value={start || "—"} />
        </div>
        {queue.position ? <Progress value={progress} aria-label="Progress through the queue" /> : null}

        <p className="text-xs text-muted-foreground">
          You can leave this page. When a PC is held for you we tell you here, in the portal notifications, by email and on
          WhatsApp (if you opted in), and you then have a few minutes to join.
          {updatedLabel ? ` Updated ${updatedLabel}.` : ""}
        </p>
      </CardContent>
    </Card>
  );
}

function Stat({ icon, label, value }: { icon?: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-background/80 p-3">
      <p className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

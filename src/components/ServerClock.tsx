import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";

const RESYNC_MS = 5 * 60 * 1000;
const RETRY_MS = 10 * 1000;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Sync = { offsetMs: number; utcOffsetMinutes: number; zoneLabel: string };

const pad = (n: number) => String(n).padStart(2, "0");

const zoneLabelFor = (timezone: string, utcOffsetMinutes: number) => {
  if (timezone === "Asia/Kolkata" || timezone === "Asia/Calcutta") return "IST";
  const sign = utcOffsetMinutes < 0 ? "-" : "+";
  const abs = Math.abs(utcOffsetMinutes);
  return `UTC${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
};

/** Live server clock (24-hour) so users can line up with the booking window opening time. */
export function ServerClock({ className }: { className?: string }) {
  const [sync, setSync] = useState<Sync | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    let retryTimer: number | undefined;

    const resync = async () => {
      const sentAt = Date.now();
      const res = await apiClient.getServerTime();
      const receivedAt = Date.now();
      if (cancelled) return;
      if (res.error || !res.data || typeof res.data.epoch_ms !== "number") {
        window.clearTimeout(retryTimer);
        retryTimer = window.setTimeout(resync, RETRY_MS);
        return;
      }
      const next: Sync = {
        offsetMs: res.data.epoch_ms - (sentAt + receivedAt) / 2,
        utcOffsetMinutes: Number(res.data.utc_offset_minutes) || 0,
        zoneLabel: zoneLabelFor(res.data.timezone, Number(res.data.utc_offset_minutes) || 0),
      };
      setSync(next);
    };

    resync();
    const resyncTimer = window.setInterval(resync, RESYNC_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") resync();
    };
    document.addEventListener("visibilitychange", onVisible);
    const tick = window.setInterval(() => setNow(Date.now()), 250);

    return () => {
      cancelled = true;
      window.clearTimeout(retryTimer);
      window.clearInterval(resyncTimer);
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!sync) return null;

  const server = new Date(now + sync.offsetMs + sync.utcOffsetMinutes * 60_000);
  const time = `${pad(server.getUTCHours())}:${pad(server.getUTCMinutes())}:${pad(server.getUTCSeconds())}`;
  const date = `${DAYS[server.getUTCDay()]}, ${server.getUTCDate()} ${MONTHS[server.getUTCMonth()]} ${server.getUTCFullYear()}`;

  return (
    <div
      className={cn(
        "flex w-full min-w-0 items-center justify-center gap-3 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 px-3 py-1.5 shadow-sm",
        className,
      )}
      role="timer"
      aria-live="off"
      aria-label={`Server time ${time} ${sync.zoneLabel}`}
      title={`Portal server time (${sync.zoneLabel}). Booking windows open by this clock.`}
    >
      <Clock className="server-clock-extra h-7 w-7 shrink-0 text-primary" aria-hidden />
      <span className="server-clock-time font-mono font-extrabold leading-none tabular-nums tracking-tight text-foreground">
        {time}
      </span>
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
      </span>
      <span className="server-clock-extra whitespace-nowrap text-sm font-medium text-muted-foreground">{date}</span>
    </div>
  );
}

export default ServerClock;

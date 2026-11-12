import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Phone, PhoneCall, PhoneMissed } from "lucide-react";
import { CallAvatar, formatDuration } from "@/components/calls/CallScreen";
import { useCalls } from "@/components/calls/CallProvider";
import { apiClient, type CallInfo } from "@/lib/api";
import { isMissedCall } from "@/lib/callEngine";
import { markCallsSeen } from "@/lib/appShell";
import { cn } from "@/lib/utils";
import { AppScreen, ChoiceChips, EmptyState, ErrorState, ListSkeleton } from "./ui";

export type CallFilter = "all" | "missed" | "incoming" | "outgoing";

const FILTERS: Array<{ value: CallFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "missed", label: "Missed" },
  { value: "incoming", label: "Incoming" },
  { value: "outgoing", label: "Outgoing" },
];

export { isMissedCall };

export function matchesCallFilter(c: Pick<CallInfo, "direction" | "status">, filter: CallFilter): boolean {
  if (filter === "all") return true;
  if (filter === "missed") return isMissedCall(c);
  return c.direction === filter;
}

const IST_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" });
const IST_TIME = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
const IST_LONG = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

export function callDayLabel(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const day = IST_DAY.format(date);
  if (day === IST_DAY.format(now)) return "Today";
  if (day === IST_DAY.format(new Date(now.getTime() - 86_400_000))) return "Yesterday";
  return IST_LONG.format(date);
}

/** Status after the time: how long it lasted, or how it ended. */
function callDetail(c: CallInfo): string {
  if (c.status === "ended" && c.duration_seconds > 0) return formatDuration(c.duration_seconds);
  if (c.status === "failed" && c.answered_at) return "Disconnected";
  if (isMissedCall(c)) return "Missed";
  return c.status_display;
}

function CallRow({ call, disabled, onCall }: { call: CallInfo; disabled: boolean; onCall: () => void }) {
  const missed = isMissedCall(call);
  const DirectionIcon = missed ? PhoneMissed : call.direction === "incoming" ? ArrowDownLeft : ArrowUpRight;
  const directionLabel = missed ? "Missed call" : call.direction === "incoming" ? "Incoming call" : "Outgoing call";
  const about = [call.other.designation || call.other.user_type_label || call.role_label, call.context_label].filter(Boolean).join(" · ");
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <CallAvatar name={call.other.name} photoUrl={call.other.photo_url} className="h-12 w-12 bg-primary/10 text-sm text-primary" />
      <div className="min-w-0 flex-1">
        <p className={cn("truncate font-semibold", missed ? "text-destructive" : "text-foreground")}>{call.other.name}</p>
        <p className="flex items-center gap-1 truncate text-sm text-muted-foreground">
          <DirectionIcon
            role="img"
            aria-label={directionLabel}
            className={cn("h-4 w-4 shrink-0", missed ? "text-destructive" : call.direction === "incoming" ? "text-info" : "text-success")}
          />
          <span className="truncate">{IST_TIME.format(new Date(call.created_at))} · {callDetail(call)}</span>
        </p>
        {about ? <p className="truncate text-xs text-muted-foreground">{about}</p> : null}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onCall}
        aria-label={`Call ${call.other.name}`}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-success transition-colors active:bg-success-subtle disabled:opacity-40"
      >
        <PhoneCall className="h-5 w-5" aria-hidden />
      </button>
    </li>
  );
}

/** Calls, as people know them from their phone: newest first by day, with one tap to call back. */
export default function AppCalls() {
  const { engine, state, enabled } = useCalls();
  const [rows, setRows] = useState<CallInfo[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<CallFilter>("all");
  const free = state.phase === "idle" || state.phase === "ended";

  const load = useCallback(() => {
    setError("");
    void apiClient.getCallHistory().then((res) => {
      if (res.data) setRows(res.data.results ?? []);
      else setError(res.error || "Please try again.");
    });
  }, []);

  useEffect(() => markCallsSeen(), [rows]);

  // Reloads when a call finishes, so it shows here straight away.
  useEffect(load, [load, state.phase === "ended"]); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => {
    const out: Array<{ day: string; calls: CallInfo[] }> = [];
    (rows ?? [])
      .filter((c) => matchesCallFilter(c, filter))
      .forEach((c) => {
        const day = callDayLabel(c.created_at);
        const last = out[out.length - 1];
        if (last?.day === day) last.calls.push(c);
        else out.push({ day, calls: [c] });
      });
    return out;
  }, [rows, filter]);

  return (
    <AppScreen
      title="Calls"
      subtitle="Calls with lab staff. Calls are not recorded."
      toolbar={<ChoiceChips label="Show calls" value={filter} onChange={(v) => setFilter(v as CallFilter)} options={FILTERS} />}
    >
      {error && !rows ? (
        <ErrorState message={error} onRetry={load} />
      ) : !rows ? (
        <ListSkeleton />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={<Phone className="h-6 w-6" aria-hidden />}
          title={filter === "all" ? "No calls yet" : `No ${filter} calls`}
          hint={filter === "all" ? "Use Call on a booking or an equipment page to speak to the lab." : undefined}
        />
      ) : (
        <div className="-mx-4 -mt-4">
          {groups.map((g) => (
            <section key={g.day}>
              <h2 className="sticky top-[calc(6.75rem+env(safe-area-inset-top))] z-10 bg-background/95 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.day}</h2>
              <ul>
                {g.calls.map((c) => (
                  <CallRow key={c.id} call={c} disabled={!engine || !enabled || !free} onCall={() => void engine?.callBack(c)} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </AppScreen>
  );
}

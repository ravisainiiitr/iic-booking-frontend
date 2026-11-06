import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, Bell, CalendarClock, CreditCard, FileCheck2, FlaskConical, PhoneCall, PhoneMissed, Search, Wallet } from "lucide-react";
import EquipmentImage from "@/components/EquipmentImage";
import { CallAvatar } from "@/components/calls/CallScreen";
import { useCalls } from "@/components/calls/CallProvider";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { apiClient, type CallInfo, type MyActivity } from "@/lib/api";
import { bookingTone, slotWhen, timeUntil } from "@/lib/bookingJourney";
import { formatINR } from "@/lib/money";
import { isMissedCall } from "./AppCalls";
import { Card, ErrorState, SectionTitle, StatusPill } from "./ui";
import { Skeleton } from "@/components/ui/skeleton";

function greeting(now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(now));
  if (hour < 12) return "Good morning";
  return hour < 17 ? "Good afternoon" : "Good evening";
}

function firstName(user: { first_name?: unknown; name?: unknown; email?: unknown } | null | undefined) {
  const name = String(user?.first_name || user?.name || "").trim();
  return name.split(/\s+/).find((w) => !/^(dr|prof|mr|mrs|ms)\.?$/i.test(w)) ?? "";
}

function Attention({ to, icon, text, tone }: { to: string; icon: ReactNode; text: string; tone: "warning" | "danger" | "success" }) {
  const toneClass = {
    warning: "border-warning-border bg-warning-subtle text-warning-subtle-foreground",
    danger: "border-destructive-border bg-destructive-subtle text-destructive-subtle-foreground",
    success: "border-success-border bg-success-subtle text-success-subtle-foreground",
  }[tone];
  return (
    <Link to={to} className={`flex min-h-12 items-center gap-3 rounded-2xl border px-4 py-2.5 text-sm font-medium ${toneClass}`}>
      {icon}
      <span className="min-w-0 flex-1">{text}</span>
      <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
    </Link>
  );
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function MissedCalls({ calls }: { calls: CallInfo[] }) {
  const { engine, state } = useCalls();
  if (calls.length === 0) return null;
  const free = state.phase === "idle" || state.phase === "ended";
  return (
    <section>
      <SectionTitle action={<Link to="/app/calls" className="text-sm font-medium text-primary">All calls</Link>}>Missed calls</SectionTitle>
      <Card className="divide-y divide-border/60">
        {calls.slice(0, 2).map((c) => (
          <div key={c.id} className="flex items-center gap-3 p-3">
            <CallAvatar name={c.other.name} photoUrl={c.other.photo_url} className="h-11 w-11 bg-primary/10 text-sm text-primary" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{c.other.name}</p>
              <p className="flex items-center gap-1 truncate text-xs text-destructive">
                <PhoneMissed className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {new Date(c.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}
              </p>
            </div>
            <button
              type="button"
              disabled={!engine || !free}
              onClick={() => void engine?.callBack(c)}
              aria-label={`Call ${c.other.name} back`}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground disabled:opacity-50"
            >
              <PhoneCall className="h-5 w-5" aria-hidden />
            </button>
          </div>
        ))}
      </Card>
    </section>
  );
}

/** Home for people who book equipment: what they can do first, then only what needs them today. */
export default function AppHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const { enabled: callsEnabled } = useCalls();
  const [activity, setActivity] = useState<MyActivity | null>(null);
  const [failed, setFailed] = useState("");
  const [missed, setMissed] = useState<CallInfo[]>([]);

  const load = useCallback(() => {
    setFailed("");
    void apiClient.getMyActivity().then((res) => {
      if (res.data) setActivity(res.data);
      else setFailed(res.error || "Please try again.");
    });
  }, []);

  useEffect(load, [load]);

  useEffect(() => {
    if (!callsEnabled) return;
    let cancelled = false;
    void apiClient.getCallHistory().then((res) => {
      if (cancelled) return;
      const weekAgo = Date.now() - 7 * 86_400_000;
      setMissed((res.data?.results ?? []).filter((c) => isMissedCall(c) && new Date(c.created_at).getTime() > weekAgo));
    });
    return () => {
      cancelled = true;
    };
  }, [callsEnabled]);

  const next = activity?.next ?? null;
  const counts = activity?.counts;
  const name = firstName(user as never);

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="bg-brand px-4 pb-16 pt-[calc(1rem+env(safe-area-inset-top))] text-brand-foreground">
        <div className="mx-auto flex max-w-3xl items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm opacity-80">{greeting()}</p>
            <h1 className="truncate text-2xl font-semibold tracking-tight">{name || "Welcome"}</h1>
          </div>
          <Link to="/app/notifications" aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"} className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 active:bg-white/20">
            <Bell className="h-5 w-5" aria-hidden />
            {unreadCount > 0 ? (
              <span className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-semibold text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
          </Link>
        </div>
      </header>

      <main className="mx-auto -mt-12 max-w-3xl space-y-5 px-4 pb-6">
        <Card className="p-4">
          <p className="text-base font-semibold text-foreground">What would you like to analyse?</p>
          <button
            type="button"
            onClick={() => navigate("/app/equipment?search=1")}
            className="mt-3 flex h-12 w-full items-center gap-2.5 rounded-xl border border-border bg-muted/40 px-3.5 text-left text-sm text-muted-foreground active:bg-muted"
          >
            <Search className="h-5 w-5 shrink-0" aria-hidden /> Search equipment, technique or department
          </button>
          <Link to="/app/equipment" className="mt-3 flex h-12 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground active:opacity-90">
            <FlaskConical className="h-5 w-5" aria-hidden /> Book equipment
          </Link>
        </Card>

        {failed && !activity ? <ErrorState message={failed} onRetry={load} /> : null}

        {counts && (counts.needs_choice > 0 || counts.awaiting_payment > 0 || (activity?.results.new ?? 0) > 0) ? (
          <section className="space-y-2" aria-label="Needs your attention">
            {counts.needs_choice > 0 ? (
              <Attention to="/app/bookings?tab=pending" tone="danger" icon={<AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />} text={`${plural(counts.needs_choice, "booking")} waiting for your choice`} />
            ) : null}
            {counts.awaiting_payment > 0 ? (
              <Attention to="/app/bookings?tab=pending" tone="warning" icon={<CreditCard className="h-5 w-5 shrink-0" aria-hidden />} text={`${plural(counts.awaiting_payment, "booking")} awaiting payment`} />
            ) : null}
            {(activity?.results.new ?? 0) > 0 ? (
              <Attention to="/my-results" tone="success" icon={<FileCheck2 className="h-5 w-5 shrink-0" aria-hidden />} text={`New results for ${plural(activity!.results.new, "booking")}`} />
            ) : null}
          </section>
        ) : null}

        {!activity && !failed ? <Skeleton className="h-28 w-full rounded-2xl" /> : null}

        {next ? (
          <section>
            <SectionTitle action={<Link to="/app/bookings" className="text-sm font-medium text-primary">All bookings</Link>}>Your next booking</SectionTitle>
            <Link to={`/app/bookings/${next.id}`} className="block">
              <Card className="flex items-center gap-3 p-3 active:bg-muted/50">
                <EquipmentImage equipmentId={next.equipment.id} alt="" sizes="64px" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-foreground">{next.equipment.name}</p>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-muted-foreground">
                    <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden /> {slotWhen(next.slot_start, next.slot_end)}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <StatusPill tone={bookingTone(next.status)}>{next.status_display}</StatusPill>
                    {timeUntil(next.slot_start) ? <span className="text-xs font-medium text-primary">{timeUntil(next.slot_start)}</span> : null}
                  </div>
                </div>
              </Card>
            </Link>
            {next.sample_deadline ? (
              <p className="mt-2 px-1 text-xs text-muted-foreground">Sample due at the lab by {slotWhen(next.sample_deadline)}</p>
            ) : null}
          </section>
        ) : null}

        {activity && activity.book_again.length > 0 ? (
          <section>
            <SectionTitle>Book again</SectionTitle>
            <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {activity.book_again.map((eq) => (
                <Link key={eq.id} to={`/app/equipment/${eq.id}`} className="w-36 shrink-0">
                  <Card className="overflow-hidden active:bg-muted/50">
                    <EquipmentImage equipmentId={eq.id} alt="" sizes="144px" className="h-24 w-full object-cover" />
                    <div className="p-2.5">
                      <p className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-tight text-foreground">{eq.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{plural(eq.times, "time")}</p>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <MissedCalls calls={missed} />

        {activity?.wallet ? (
          <Link to="/wallet" className="block">
            <Card className="flex items-center gap-3 p-4 active:bg-muted/50">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Wallet className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Wallet balance</p>
                <p className="text-lg font-semibold tabular-nums text-foreground">{formatINR(activity.wallet.balance)}</p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" aria-hidden />
            </Card>
          </Link>
        ) : null}
      </main>
    </div>
  );
}

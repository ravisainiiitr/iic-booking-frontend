import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import {
  AlarmClock,
  AlertTriangle,
  CalendarOff,
  ChevronRight,
  ClipboardList,
  Inbox,
  LifeBuoy,
  ListOrdered,
  Loader2,
  MessageSquare,
  RefreshCw,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient, type StaffAppBookingRow, type StaffAppToday } from "@/lib/api";
import { cn } from "@/lib/utils";
import StaffTopBar from "./StaffTopBar";

const StaffWeekCalendar = lazy(() => import("./StaffWeekCalendar"));

const STAGE_TONE: Record<string, string> = {
  SAMPLE_SENT: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
  HELD_AT_OFFICE: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
  FORWARDED_TO_LAB: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
  SAMPLE_ACCEPTED: "bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200",
  PROCESSING: "bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200",
  COMPLETED: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200",
  RETURNED: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200",
  SAMPLE_REJECTED: "bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-200",
  NOT_UTILIZED: "bg-violet-100 text-violet-900 dark:bg-violet-950/50 dark:text-violet-200",
};

const IST_TIME = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
const IST_DAY = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" });

/** Slot times are institute (IST) wall-clock times whatever the phone's time zone. */
function timeOf(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : IST_TIME.format(d);
}

function dayHeading(label: string, iso: string): string {
  try {
    return `${label} · ${format(parseISO(iso), "EEE d MMM")}`;
  } catch {
    return label;
  }
}

function jobSheetPath(bookingId: number) {
  return `/booking-management?expand=${bookingId}`;
}

function BookingRow({ row, showEquipment }: { row: StaffAppBookingRow; showEquipment: boolean }) {
  const start = timeOf(row.start_time);
  const end = start && timeOf(row.end_time) === "00:00" ? "24:00" : timeOf(row.end_time);
  return (
    <li>
      <Link
        to={jobSheetPath(row.booking_id)}
        className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors active:bg-muted/60 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <div className="w-14 shrink-0 text-sm font-semibold tabular-nums leading-tight text-foreground">
          {start || "—"}
          {end && <span className="block text-xs font-normal text-muted-foreground">{end}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {row.user_name || "User"}
            {row.is_test && (
              <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Test
              </span>
            )}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {row.booking_ref}
            {showEquipment && row.equipment_code ? ` · ${row.equipment_code}` : ""}
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {row.sample_stage_display ? (
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STAGE_TONE[row.sample_stage] ?? "bg-muted text-foreground")}>
                {row.sample_stage_display}
              </span>
            ) : (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">No sample update yet</span>
            )}
            {row.status !== "BOOKED" && (
              <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">{row.status_display}</span>
            )}
          </div>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}

function CountTile({
  icon,
  label,
  value,
  to,
  urgent,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  to: string;
  urgent?: boolean;
}) {
  const active = value > 0;
  return (
    <Link
      to={to}
      className={cn(
        "flex min-h-[4.5rem] flex-col justify-between rounded-xl border p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active && urgent
          ? "border-amber-500/50 bg-amber-50 dark:bg-amber-950/30"
          : active
            ? "border-primary/30 bg-primary/5"
            : "border-border bg-card",
      )}
    >
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className={cn("text-2xl font-semibold tabular-nums", active ? "text-foreground" : "text-muted-foreground")}>{value}</span>
    </Link>
  );
}

/** Mounts the week calendar only when it scrolls into view, so opening the app stays quick. */
function WhenVisible({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setVisible(true);
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);
  return <div ref={ref}>{visible ? children : <div className="h-40" />}</div>;
}

export default function StaffToday() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState<StaffAppToday | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      const res = await apiClient.getStaffAppToday({ refresh });
      if (res.data) {
        setData(res.data);
        setError(null);
      } else if (res.error) {
        setError(res.error);
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  const isOic = String(user?.user_type ?? "").toLowerCase() === "manager";
  const roleLabel = isOic ? "Officer In Charge" : "Lab Operator";
  const firstName = (user?.display_name || user?.name || "").trim().split(/\s+/)[0];
  const counts = data?.counts;
  const showEquipment = (data?.equipment.length ?? 0) > 1;
  const offline = data?.equipment.filter((e) => e.status && e.status !== "ACTIVE") ?? [];
  const firstMessage = data?.message_booking_ids?.[0];

  return (
    <div className="min-h-[100dvh] bg-muted/20">
      <StaffTopBar
        title={firstName ? `Hello, ${firstName}` : "Today"}
        subtitle={`${roleLabel} · ${IST_DAY.format(new Date())}`}
        actions={
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11"
            aria-label="Refresh"
            onClick={() => void load(true)}
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-5 w-5", refreshing && "animate-spin")} />
          </Button>
        }
      />

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-4">
        {error && !data && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
            <Button variant="outline" size="sm" className="ml-3" onClick={() => void load(true)}>
              Try again
            </Button>
          </div>
        )}

        {!data && !error && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-5 w-5 animate-spin text-primary" /> Loading today…
          </div>
        )}

        {data && (
          <>
            {offline.length > 0 && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{offline.map((e) => `${e.code || e.name}: ${e.status_display}`).join(" · ")}</span>
              </div>
            )}

            {counts && (
              <section aria-label="Waiting for you" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <CountTile
                  icon={<Inbox className="h-3.5 w-3.5" aria-hidden />}
                  label="Samples to receive"
                  value={counts.samples_awaiting_receipt}
                  to="/booking-management"
                />
                <CountTile
                  icon={<MessageSquare className="h-3.5 w-3.5" aria-hidden />}
                  label="Messages to answer"
                  value={counts.user_messages_awaiting_reply}
                  to={firstMessage ? jobSheetPath(firstMessage) : "/booking-management"}
                />
                {counts.results_overdue != null && (
                  <CountTile
                    icon={<AlarmClock className="h-3.5 w-3.5" aria-hidden />}
                    label="Results overdue"
                    value={counts.results_overdue}
                    to={
                      counts.results_overdue === 1 && data.results_overdue_booking_ids?.[0]
                        ? jobSheetPath(data.results_overdue_booking_ids[0])
                        : "/booking-management?results=overdue"
                    }
                    urgent
                  />
                )}
                {counts.urgent_requests_pending != null && (
                  <CountTile
                    icon={<Zap className="h-3.5 w-3.5" aria-hidden />}
                    label="Urgent requests"
                    value={counts.urgent_requests_pending}
                    to="/urgent-requests"
                    urgent
                  />
                )}
                {counts.waitlist_active != null && (
                  <CountTile
                    icon={<ListOrdered className="h-3.5 w-3.5" aria-hidden />}
                    label="Waitlist"
                    value={counts.waitlist_active}
                    to="/equipment-waitlist"
                  />
                )}
                <CountTile
                  icon={<LifeBuoy className="h-3.5 w-3.5" aria-hidden />}
                  label="My support tickets"
                  value={counts.tickets_assigned_open}
                  to="/tickets"
                />
              </section>
            )}

            {data.days.map((day) => (
              <section key={day.date} aria-labelledby={`day-${day.date}`}>
                <div className="mb-2 flex items-baseline justify-between">
                  <h2 id={`day-${day.date}`} className="text-sm font-semibold text-foreground">
                    {dayHeading(day.label, day.date)}
                  </h2>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {day.bookings.length} {day.bookings.length === 1 ? "booking" : "bookings"}
                  </span>
                </div>
                {day.bookings.length === 0 ? (
                  <p className="rounded-xl border border-dashed bg-card px-4 py-5 text-center text-sm text-muted-foreground">
                    No bookings {day.label.toLowerCase()} on your instruments.
                  </p>
                ) : (
                  <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border bg-card">
                    {day.bookings.map((row) => (
                      <BookingRow key={`${day.date}-${row.booking_id}`} row={row} showEquipment={showEquipment} />
                    ))}
                  </ul>
                )}
              </section>
            ))}

            <section aria-label="Quick actions" className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-12 justify-start gap-2" onClick={() => navigate("/booking-management")}>
                <ClipboardList className="h-5 w-5 text-primary" aria-hidden />
                All bookings
              </Button>
              <Button variant="outline" className="h-12 justify-start gap-2" onClick={() => navigate("/leave-management")}>
                <CalendarOff className="h-5 w-5 text-primary" aria-hidden />
                Unavailability
              </Button>
            </section>

            <section aria-labelledby="week-heading">
              <h2 id="week-heading" className="mb-2 text-sm font-semibold text-foreground">
                This week
              </h2>
              <div className="rounded-xl border bg-card p-4">
                <WhenVisible>
                  <Suspense fallback={<div className="h-40" />}>
                    <StaffWeekCalendar equipment={data.equipment} />
                  </Suspense>
                </WhenVisible>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarClock, ClipboardList, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";
import { getBookingKey } from "@/lib/bookingRef";
import { bookingTab, bookingTone, slotWhen, type BookingTab } from "@/lib/bookingJourney";
import { AppScreen, Card, ChoiceChips, EmptyState, ErrorState, ListSkeleton, StatusPill } from "./ui";

const PAGE = 100;

type Row = {
  real_booking_id?: number | null;
  booking_id?: number | string | null;
  id?: number;
  virtual_booking_id?: string | null;
  equipment_name?: string;
  status?: string;
  status_display?: string;
  start_time?: string | null;
  end_time?: string | null;
  created_at?: string;
};

const TABS: Array<{ value: BookingTab; label: string }> = [
  { value: "upcoming", label: "Upcoming" },
  { value: "pending", label: "Needs action" },
  { value: "past", label: "Past" },
  { value: "cancelled", label: "Cancelled" },
];

const EMPTY: Record<BookingTab, { title: string; hint: string }> = {
  upcoming: { title: "No upcoming bookings", hint: "Book an instrument and it will show here." },
  pending: { title: "Nothing needs you", hint: "Bookings awaiting payment, approval or your choice show here." },
  past: { title: "No past bookings yet", hint: "Finished bookings and their results show here." },
  cancelled: { title: "No cancelled bookings", hint: "Cancelled and refunded bookings show here." },
};

function primaryKey(row: Row): number | null {
  const n = Number(row.real_booking_id ?? row.id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function isTab(v: string | null): v is BookingTab {
  return TABS.some((t) => t.value === v);
}

/** My bookings: find one, and see at a glance where it stands. Changing a booking opens its details. */
export default function AppBookings() {
  const [params, setParams] = useSearchParams();
  const tabParam = params.get("tab");
  const [tab, setTab] = useState<BookingTab>(isTab(tabParam) ? tabParam : "upcoming");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (offset: number) => {
    setError("");
    const res = await apiClient.getBookings({ list_view: true, limit: PAGE, offset });
    if (!res.data) {
      setError(res.error || "Please try again.");
      return;
    }
    const page = res.data.bookings as unknown as Row[];
    setTotal(res.data.total_count ?? res.data.count ?? page.length);
    setRows((cur) => (offset === 0 || !cur ? page : [...cur, ...page]));
  }, []);

  useEffect(() => {
    void load(0);
  }, [load]);

  const words = useMemo(() => query.toLowerCase().split(/\s+/).filter(Boolean), [query]);
  const counts = useMemo(() => {
    const out: Record<BookingTab, number> = { upcoming: 0, pending: 0, past: 0, cancelled: 0 };
    (rows ?? []).forEach((r) => (out[bookingTab(r)] += 1));
    return out;
  }, [rows]);

  const visible = useMemo(() => {
    const list = (rows ?? []).filter((r) => {
      if (words.length) {
        const text = `${r.equipment_name ?? ""} ${r.virtual_booking_id ?? ""} ${r.booking_id ?? ""}`.toLowerCase();
        return words.every((w) => text.includes(w));
      }
      return bookingTab(r) === tab;
    });
    // Soonest first for what is ahead; most recent first for what is behind.
    if (!words.length && tab === "upcoming") {
      return [...list].sort((a, b) => new Date(a.start_time ?? 0).getTime() - new Date(b.start_time ?? 0).getTime());
    }
    return list;
  }, [rows, tab, words]);

  const chooseTab = (next: BookingTab) => {
    setTab(next);
    setParams(next === "upcoming" ? {} : { tab: next }, { replace: true });
  };

  return (
    <AppScreen
      title="My bookings"
      toolbar={
        <div className="space-y-2.5">
          <label className="flex h-11 items-center gap-2 rounded-xl border border-border bg-background px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="sr-only">Search bookings</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by equipment or booking ID"
              className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
            />
            {query ? (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="-mr-1 flex h-8 w-8 items-center justify-center text-muted-foreground">
                <X className="h-4 w-4" aria-hidden />
              </button>
            ) : null}
          </label>
          {words.length === 0 ? (
            <ChoiceChips label="Booking group" value={tab} onChange={chooseTab} options={TABS.map((t) => ({ ...t, count: t.value === "pending" ? counts.pending : undefined }))} />
          ) : null}
        </div>
      }
    >
      {error && !rows ? (
        <ErrorState message={error} onRetry={() => void load(0)} />
      ) : !rows ? (
        <ListSkeleton />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-6 w-6" aria-hidden />}
          title={words.length ? "No booking matches your search" : EMPTY[tab].title}
          hint={words.length ? "Try the equipment name or the booking ID." : EMPTY[tab].hint}
          action={tab === "upcoming" && !words.length ? <Button asChild className="h-11"><Link to="/app/equipment">Book equipment</Link></Button> : undefined}
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((b) => {
            const pk = primaryKey(b);
            return (
              <li key={getBookingKey(b as never) || pk} className="[content-visibility:auto] [contain-intrinsic-size:auto_96px]">
                <Link to={pk ? `/app/bookings/${pk}` : "/my-bookings"} className="block">
                  <Card className="p-3.5 active:bg-muted/50">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 font-semibold leading-snug text-foreground">{b.equipment_name}</p>
                      <StatusPill tone={bookingTone(b.status)} className="shrink-0">{b.status_display}</StatusPill>
                    </div>
                    {slotWhen(b.start_time, b.end_time) ? (
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <CalendarClock className="h-4 w-4 shrink-0" aria-hidden /> {slotWhen(b.start_time, b.end_time)}
                      </p>
                    ) : null}
                    <p className="mt-1 truncate text-xs text-muted-foreground">{String(b.booking_id ?? b.virtual_booking_id ?? "")}</p>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {rows && rows.length < total ? (
        <Button
          variant="outline"
          className="mt-4 h-11 w-full"
          disabled={loadingMore}
          onClick={() => {
            setLoadingMore(true);
            void load(rows.length).finally(() => setLoadingMore(false));
          }}
        >
          {loadingMore ? "Loading…" : "Load older bookings"}
        </Button>
      ) : null}
    </AppScreen>
  );
}

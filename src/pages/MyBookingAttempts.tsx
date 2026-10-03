import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, History, ListChecks, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api";
import { groupSlotsByDay, type JobSheetSlot } from "@/lib/jobSheet";
import type { MyBookingAttempt, MyBookingAttemptsPage } from "@/lib/myBookingAttempts";
import { formatRequestedAt, openQuotaBreakdown } from "@/lib/quotaBreakdown";
import { PageHero, PageShell, StandaloneOnly, heroButtonClass } from "@/components/PageShell";
import { preloadQuotaBreakdown } from "@/components/quota/QuotaBreakdownHost";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const PAGE_SIZE = 20;

function SlotsCell({ attempt }: { attempt: MyBookingAttempt }) {
  const slots: JobSheetSlot[] = attempt.requested_slots.flatMap((s) =>
    s.start_datetime && s.end_datetime ? [{ ...s, start_datetime: s.start_datetime, end_datetime: s.end_datetime }] : [],
  );
  const days = groupSlotsByDay(slots);
  if (days.length === 0) {
    return (
      <span className="text-muted-foreground">
        {attempt.slots_requested} {attempt.slots_requested === 1 ? "slot" : "slots"} (times not recorded)
      </span>
    );
  }
  return (
    <ul className="space-y-0.5">
      {days.map((day) => (
        <li key={day.dateLabel}>
          <span className="font-medium">{day.dateLabel}</span>{" "}
          <span className="text-muted-foreground">{day.ranges.join(", ")}</span>
        </li>
      ))}
    </ul>
  );
}

function ReasonCell({ attempt }: { attempt: MyBookingAttempt }) {
  const others = attempt.booked_by_name
    ? `Submitted for you by ${attempt.booked_by_name}.`
    : attempt.booked_for_name
      ? `Submitted by you for ${attempt.booked_for_name}.`
      : null;
  return (
    <div className="space-y-0.5">
      <p className="font-medium">{attempt.failure_title || (attempt.outcome === "SUCCESS" ? "Booked" : "Booking unsuccessful")}</p>
      {attempt.failure_summary && attempt.failure_summary !== attempt.failure_title && (
        <p className="text-muted-foreground">{attempt.failure_summary}</p>
      )}
      {others && <p className="text-xs text-muted-foreground">{others}</p>}
    </div>
  );
}

function CalculationButton({ attempt }: { attempt: MyBookingAttempt }) {
  if (!attempt.can_view_calculation) return null;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-1.5"
      onClick={() => openQuotaBreakdown({ logId: attempt.id })}
      onPointerEnter={preloadQuotaBreakdown}
      onFocus={preloadQuotaBreakdown}
      aria-label={`View calculation for the attempt on ${formatRequestedAt(attempt.requested_at)}`}
    >
      <ListChecks className="h-4 w-4" aria-hidden />
      View calculation
    </Button>
  );
}

/**
 * The signed-in user's unsuccessful booking attempts. For a weekly / monthly limit, View calculation opens
 * the same breakdown staff see (subject to the privacy rules for other group members).
 */
export default function MyBookingAttempts() {
  const navigate = useNavigate();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<MyBookingAttemptsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiClient
      .listMyBookingAttempts({ outcome: "FAILED", date_from: dateFrom, date_to: dateTo, limit: PAGE_SIZE, offset })
      .then((res) => {
        if (cancelled) return;
        if (res.error || !Array.isArray(res.data?.results)) {
          setError(res.error || "Could not load your booking attempts.");
          setPage(null);
        } else {
          setPage(res.data!);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Could not load your booking attempts.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dateFrom, dateTo, offset]);

  const results = page?.results ?? [];
  const total = page?.total_count ?? 0;
  const filtered = Boolean(dateFrom || dateTo);

  return (
    <PageShell>
      <main className="container mx-auto space-y-5 px-4 py-5">
        <StandaloneOnly>
          <PageHero
            compact
            title="My booking attempts"
            description="Booking attempts that did not go through, with the reason. For a weekly or monthly limit, View calculation shows the bookings that used it."
            icon={<History className="h-5 w-5" />}
            actions={
              <Button variant="outline" size="sm" className={heroButtonClass.secondary} onClick={() => navigate("/my-bookings")}>
                My Bookings
              </Button>
            }
          />
        </StandaloneOnly>

        <Card className="overflow-hidden border shadow-sm">
          <div className="flex flex-wrap items-end gap-3 border-b bg-muted/30 px-4 py-3">
            <div className="space-y-1">
              <Label htmlFor="attempts-from" className="text-xs">From</Label>
              <Input
                id="attempts-from"
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) => { setDateFrom(e.target.value); setOffset(0); }}
                className="h-9 w-40"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="attempts-to" className="text-xs">To</Label>
              <Input
                id="attempts-to"
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => { setDateTo(e.target.value); setOffset(0); }}
                className="h-9 w-40"
              />
            </div>
            {filtered && (
              <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); setOffset(0); }}>
                Clear dates
              </Button>
            )}
            <p className="ml-auto text-xs text-muted-foreground">Times are in Indian time (IST).</p>
          </div>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-10" role="status" aria-label="Loading booking attempts">
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" aria-hidden />
              </div>
            ) : error ? (
              <p className="m-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                {error}
              </p>
            ) : results.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                {filtered ? "No unsuccessful booking attempts between these dates." : "You have no unsuccessful booking attempts."}
              </p>
            ) : (
              <>
                <ul className="divide-y md:hidden" aria-label="Unsuccessful booking attempts">
                  {results.map((a) => (
                    <li key={a.id} className="space-y-2 px-4 py-3 text-sm">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-medium">{a.equipment_name}</span>
                        <span className="text-xs tabular-nums text-muted-foreground">{formatRequestedAt(a.requested_at)}</span>
                      </div>
                      <SlotsCell attempt={a} />
                      <ReasonCell attempt={a} />
                      <CalculationButton attempt={a} />
                    </li>
                  ))}
                </ul>
                <div className="hidden overflow-x-auto md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Attempted (IST)</TableHead>
                        <TableHead>Equipment</TableHead>
                        <TableHead>Requested slots</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead className="text-right">Calculation</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.map((a) => (
                        <TableRow key={a.id} className="align-top">
                          <TableCell className="whitespace-nowrap text-sm tabular-nums">{formatRequestedAt(a.requested_at)}</TableCell>
                          <TableCell className="min-w-[10rem] text-sm">
                            <div>{a.equipment_name}</div>
                            {a.equipment_code && <div className="text-xs text-muted-foreground">{a.equipment_code}</div>}
                          </TableCell>
                          <TableCell className="min-w-[12rem] text-sm">
                            <SlotsCell attempt={a} />
                          </TableCell>
                          <TableCell className="min-w-[16rem] text-sm">
                            <ReasonCell attempt={a} />
                          </TableCell>
                          <TableCell className="text-right">
                            <CalculationButton attempt={a} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
          {total > PAGE_SIZE && !loading && !error && (
            <nav className="flex items-center justify-between gap-2 border-t px-4 py-2 text-sm" aria-label="Pages">
              <span className="text-muted-foreground">
                {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
                  <ChevronLeft className="h-4 w-4" aria-hidden /> Previous
                </Button>
                <Button variant="outline" size="sm" disabled={offset + PAGE_SIZE >= total} onClick={() => setOffset(offset + PAGE_SIZE)}>
                  Next <ChevronRight className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            </nav>
          )}
        </Card>
      </main>
    </PageShell>
  );
}

import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CalendarClock, Check, CreditCard, FileCheck2, Settings2 } from "lucide-react";
import CallButton from "@/components/calls/CallButton";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";
import { getBookingKey } from "@/lib/bookingRef";
import { bookingTimeline, bookingTone, slotWhen, type TimelineStep } from "@/lib/bookingJourney";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";
import { AppScreen, Card, ErrorState, ListSkeleton, SectionTitle, StatusPill } from "./ui";

type Booking = {
  equipment?: number;
  equipment_name?: string;
  status?: string;
  status_display?: string;
  start_time?: string | null;
  end_time?: string | null;
  booking_id?: number | string | null;
  virtual_booking_id?: string | null;
  total_charge?: string;
  charge_breakdown?: Array<{ amount: number; description: string }>;
  sample_trace?: Array<{ status_display?: string; stage_display?: string; label?: string; created_at?: string; at?: string }>;
  daily_slots?: Array<{ id: number; start_datetime: string; end_datetime: string }>;
};

function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="flex" aria-label="Booking progress">
      {steps.map((step, i) => (
        <li key={step.key} className="relative flex min-w-0 flex-1 flex-col items-center text-center" aria-current={step.state === "current" ? "step" : undefined}>
          {i > 0 ? (
            <span aria-hidden className={cn("absolute right-1/2 top-3 h-0.5 w-full -translate-y-1/2", step.state === "todo" ? "bg-border" : "bg-primary")} />
          ) : null}
          <span
            className={cn(
              "relative z-10 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
              step.state === "done" && "bg-primary text-primary-foreground",
              step.state === "current" && "bg-primary text-primary-foreground ring-4 ring-primary/20",
              step.state === "todo" && "bg-muted text-muted-foreground",
            )}
          >
            {step.state === "done" ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
          </span>
          <span className={cn("mt-1.5 px-0.5 text-[11px] leading-tight", step.state === "todo" ? "text-muted-foreground" : "font-medium text-foreground")}>{step.label}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * One booking: where it stands, when, what it costs and what can be done now. Cancelling, rescheduling and editing keep the
 * portal's own booking details screen, which applies every cancellation and refund rule.
 */
export default function AppBookingDetail() {
  const { id } = useParams<{ id: string }>();
  const pk = Number(id);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setError("");
    void apiClient.getBookings({ booking_id: pk, limit: 1 }).then((res) => {
      const row = res.data?.bookings?.[0];
      if (row) setBooking(row as unknown as Booking);
      else setError(res.error || "This booking could not be found.");
    });
  }, [pk]);
  useEffect(load, [load]);

  const status = String(booking?.status ?? "").toUpperCase();
  const steps = booking ? bookingTimeline(booking) : null;
  const key = booking ? getBookingKey(booking as never) : "";
  const manageTo = `/my-bookings?booking=${encodeURIComponent(String(key || pk))}`;
  const charge = Number(booking?.total_charge ?? 0);

  return (
    <AppScreen
      title={booking?.equipment_name ?? "Booking"}
      subtitle={booking ? String(booking.booking_id ?? booking.virtual_booking_id ?? "") : undefined}
      backTo="/app/bookings"
      footer={
        status === "PENDING_PAYMENT" ? (
          <Link to={`/bookings/${pk}/payment`} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground active:opacity-90">
            <CreditCard className="h-5 w-5" aria-hidden /> Complete payment
          </Link>
        ) : status === "COMPLETED" ? (
          <Link to="/my-results" className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground active:opacity-90">
            <FileCheck2 className="h-5 w-5" aria-hidden /> View results
          </Link>
        ) : undefined
      }
    >
      {error && !booking ? (
        <ErrorState message={error} onRetry={load} />
      ) : !booking ? (
        <ListSkeleton rows={3} />
      ) : (
        <div className="space-y-5">
          <Card className="p-4">
            <StatusPill tone={bookingTone(status)}>{booking.status_display}</StatusPill>
            {slotWhen(booking.start_time, booking.end_time) ? (
              <p className="mt-2.5 flex items-center gap-2 font-medium text-foreground">
                <CalendarClock className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden /> {slotWhen(booking.start_time, booking.end_time)}
              </p>
            ) : null}
            {steps ? <div className="mt-4"><Timeline steps={steps} /></div> : null}
          </Card>

          {charge > 0 || (booking.charge_breakdown?.length ?? 0) > 0 ? (
            <section>
              <SectionTitle>Charges</SectionTitle>
              <Card className="p-4">
                <ul className="space-y-1.5 text-sm">
                  {(booking.charge_breakdown ?? []).map((line, i) => (
                    <li key={i} className="flex justify-between gap-3">
                      <span className="min-w-0 text-muted-foreground">{line.description}</span>
                      <span className="shrink-0 tabular-nums text-foreground">{formatINR(line.amount)}</span>
                    </li>
                  ))}
                </ul>
                <p className={cn("flex justify-between gap-3 font-semibold text-foreground", (booking.charge_breakdown?.length ?? 0) > 0 && "mt-2.5 border-t border-border/60 pt-2.5")}>
                  <span>Total</span>
                  <span className="tabular-nums">{formatINR(charge)}</span>
                </p>
              </Card>
            </section>
          ) : null}

          <section>
            <SectionTitle>Actions</SectionTitle>
            <div className="space-y-2">
              <Button asChild variant="outline" className="h-12 w-full justify-start gap-2 text-sm">
                <Link to={manageTo}>
                  <Settings2 className="h-5 w-5" aria-hidden /> Sample status, reschedule or cancel
                </Link>
              </Button>
              <div className="flex flex-wrap gap-2">
                <CallButton context="booking" id={pk} role="operator" className="h-11" />
                <CallButton context="booking" id={pk} role="oic" className="h-11" />
              </div>
            </div>
          </section>
        </div>
      )}
    </AppScreen>
  );
}

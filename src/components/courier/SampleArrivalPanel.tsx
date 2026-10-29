import { useCallback, useEffect, useState } from "react";
import { PackageSearch } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { courierTrackingApi, type Arrival, type BookingArrival } from "@/lib/courierTrackingApi";

import { SampleArrivalForm } from "./SampleArrivalForm";
import { formatWhen } from "./courierHelpers";
import { ShipmentStatus, StatusBadge } from "./ShipmentStatus";

/**
 * "Sample arrival" section of a booking: the booking user declares manual delivery or (external users, where the
 * department has Courier Tracking on) registers a courier shipment; everyone allowed to see the booking sees the
 * status. The server decides every permission; this only reflects its answer.
 */
export function SampleArrivalPanel({
  bookingId,
  isOwner,
  allowEdit = true,
  refreshKey = 0,
}: {
  bookingId: number;
  isOwner: boolean;
  /** false: status only (the booking page declares through its "Mark Sample Submitted" action instead). */
  allowEdit?: boolean;
  /** Bump to reload after a declaration made elsewhere on the page. */
  refreshKey?: number;
}) {
  const [data, setData] = useState<BookingArrival | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setData(await courierTrackingApi.bookingArrival(bookingId));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const refresh = async (arrival: Arrival) => {
    setRefreshing(true);
    try {
      const res = await courierTrackingApi.refresh(arrival.id);
      setData((prev) => (prev ? { ...prev, active: res.arrival } : prev));
      if (res.checked) toast.success(res.message);
      else toast.info(res.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The shipment could not be checked.");
    } finally {
      setRefreshing(false);
    }
  };

  if (loading && !data && !allowEdit) return null;
  if (loading && !data) {
    return (
      <section aria-label="Sample arrival" className="space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-16 w-full" />
      </section>
    );
  }
  if ((failed || !data) && !allowEdit) return null; // status-only view: nothing to show without data
  if (failed || !data) {
    return (
      <section aria-label="Sample arrival" className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        Sample arrival details could not be loaded.
        <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
          Retry
        </Button>
      </section>
    );
  }

  const { eligibility, active, history } = data;
  const canDeclare = allowEdit && isOwner && eligibility.may_declare;
  if (!active && !canDeclare && history.length === 0) return null;

  return (
    <section aria-labelledby={`arrival-${bookingId}`} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`arrival-${bookingId}`} className="flex items-center gap-2 text-sm font-semibold">
          <PackageSearch className="h-4 w-4" aria-hidden="true" /> Shipment tracking
        </h3>
        {active && canDeclare && !editing ? (
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
            Change
          </Button>
        ) : null}
      </div>

      {active && !editing ? (
        <ShipmentStatus
          arrival={active}
          onRefresh={() => void refresh(active)}
          refreshing={refreshing}
          showSubmitter={!isOwner}
        />
      ) : null}

      {active && isOwner && !eligibility.may_declare && eligibility.reasons.length > 0 ? (
        <p className="text-xs text-muted-foreground">{eligibility.reasons[0]}</p>
      ) : null}

      {canDeclare && (!active || editing) ? (
        <SampleArrivalForm
          bookingId={bookingId}
          eligibility={eligibility}
          current={active}
          onCancel={active ? () => setEditing(false) : undefined}
          onSaved={(arrival, message) => {
            toast.success(message);
            setEditing(false);
            void load();
            setData((prev) => (prev ? { ...prev, active: arrival } : prev));
          }}
        />
      ) : null}

      {history.length > 0 ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Earlier declarations ({history.length})</summary>
          <ul className="mt-2 space-y-1">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-2">
                <StatusBadge arrival={h} />
                {h.arrival_mode === "COURIER" ? (
                  <span>
                    {h.courier?.name} <span className="font-mono">{h.tracking_number}</span>
                  </span>
                ) : null}
                <span className="text-muted-foreground">replaced {formatWhen(h.superseded_at)}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

export default SampleArrivalPanel;

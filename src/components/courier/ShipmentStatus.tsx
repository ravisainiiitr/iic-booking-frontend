import { Truck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { Arrival } from "@/lib/courierTrackingApi";

import { formatWhen } from "./courierHelpers";

/** How the sample is coming: manual delivery, or a courier with the tracking number the user entered. */
export function StatusBadge({ arrival }: { arrival: Arrival }) {
  if (arrival.arrival_mode === "MANUAL") {
    return <Badge variant="secondary">Manual delivery</Badge>;
  }
  return <Badge variant="secondary">By courier</Badge>;
}

/**
 * The sample's arrival details as entered by the user. Automatic courier tracking was removed (31 Oct 2026); lab
 * staff confirm on the portal when the sample is received, and that is the status users follow.
 */
export function ShipmentStatus({
  arrival,
  showSubmitter = false,
}: {
  arrival: Arrival;
  showSubmitter?: boolean;
}) {
  if (arrival.arrival_mode === "MANUAL") {
    return (
      <div className="space-y-1 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge arrival={arrival} />
          <span className="text-muted-foreground">Declared {formatWhen(arrival.created_at)}</span>
        </div>
        <p>The sample will be brought to the lab in person. Lab staff confirm when they receive it.</p>
        {arrival.expected_arrival_date ? <p>Expected arrival: {arrival.expected_arrival_date}</p> : null}
        {arrival.notes ? <p className="text-muted-foreground">Notes: {arrival.notes}</p> : null}
      </div>
    );
  }
  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge arrival={arrival} />
        <Truck className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="font-medium">{arrival.courier?.name}</span>
        <span className="font-mono text-xs sm:text-sm">{arrival.tracking_number}</span>
        {showSubmitter && arrival.submitted_by ? (
          <span className="text-muted-foreground">by {arrival.submitted_by.name || arrival.submitted_by.email}</span>
        ) : null}
      </div>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
        <div>
          <dt className="inline text-muted-foreground">Entered: </dt>
          <dd className="inline">{formatWhen(arrival.created_at)}</dd>
        </div>
        {arrival.dispatch_date ? (
          <div>
            <dt className="inline text-muted-foreground">Dispatched: </dt>
            <dd className="inline">{arrival.dispatch_date}</dd>
          </div>
        ) : null}
        {arrival.expected_arrival_date ? (
          <div>
            <dt className="inline text-muted-foreground">Expected arrival: </dt>
            <dd className="inline">{arrival.expected_arrival_date}</dd>
          </div>
        ) : null}
      </dl>
      <p className="text-muted-foreground">
        {arrival.receipt_note || "Staff confirm on the portal when the lab receives the sample."}
      </p>
    </div>
  );
}

export default ShipmentStatus;

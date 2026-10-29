import { useState } from "react";
import { AlertTriangle, ChevronDown, Clock, PackageCheck, Truck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { Arrival } from "@/lib/courierTrackingApi";
import { cn } from "@/lib/utils";

import { formatWhen } from "./courierHelpers";

const STATUS_TONE: Record<string, string> = {
  REGISTERED: "bg-muted text-foreground",
  INFO_RECEIVED: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100",
  PENDING: "bg-muted text-foreground",
  IN_TRANSIT: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100",
  OUT_FOR_DELIVERY: "bg-indigo-100 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-100",
  ATTEMPT_FAILED: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  DELIVERY_REPORTED: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100",
  EXCEPTION: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  RETURNED: "bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-100",
  CANCELLED: "bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-100",
  EXPIRED: "bg-muted text-foreground",
  TRACKING_PROBLEM: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
};

export function StatusBadge({ arrival }: { arrival: Arrival }) {
  if (arrival.arrival_mode === "MANUAL") {
    return <Badge variant="secondary">Manual delivery</Badge>;
  }
  const status = arrival.status || "REGISTERED";
  return (
    <Badge className={cn("border-transparent font-medium", STATUS_TONE[status] ?? "bg-muted text-foreground")}>
      {arrival.status_label || status}
    </Badge>
  );
}

export function ShipmentStatus({
  arrival,
  onRefresh,
  refreshing = false,
  showSubmitter = false,
}: {
  arrival: Arrival;
  onRefresh?: () => void;
  refreshing?: boolean;
  showSubmitter?: boolean;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
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
  const latest = arrival.latest_checkpoint;
  const checkpoints = arrival.checkpoints ?? [];
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge arrival={arrival} />
        <span className="font-medium">{arrival.courier?.name}</span>
        <span className="font-mono text-xs sm:text-sm">{arrival.tracking_number}</span>
        {showSubmitter && arrival.submitted_by ? (
          <span className="text-muted-foreground">by {arrival.submitted_by.name || arrival.submitted_by.email}</span>
        ) : null}
      </div>

      {arrival.delivery_reported ? (
        <div className="flex items-start gap-2 rounded-md border border-emerald-300/60 bg-emerald-50 px-3 py-2 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-50">
          <PackageCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            The courier reports this shipment as delivered{arrival.delivery_event_at ? ` (${arrival.delivery_event_at})` : ""}.{" "}
            {arrival.receipt_note}
          </span>
        </div>
      ) : null}

      {arrival.needs_attention ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-50">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {arrival.status === "TRACKING_PROBLEM" || arrival.problem === "details"
              ? "The courier could not find these tracking details. Please check the courier and the tracking number."
              : "The last check could not reach the courier. The status shown is the last one we received."}
          </span>
        </div>
      ) : null}

      {latest ? (
        <div className="rounded-md border px-3 py-2">
          <div className="flex items-center gap-2 font-medium">
            <Truck className="h-4 w-4 shrink-0" aria-hidden="true" /> Latest update
          </div>
          <p className="mt-1">{latest.activity || arrival.provider_status_label}</p>
          <p className="text-muted-foreground">
            {[latest.date, latest.time].filter(Boolean).join(" ")} {latest.location ? `· ${latest.location}` : ""}
          </p>
        </div>
      ) : (
        <p className="text-muted-foreground">No courier updates yet. Courier updates can take several hours to appear.</p>
      )}

      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
        <div>
          <dt className="inline text-muted-foreground">Last checked: </dt>
          <dd className="inline">{formatWhen(arrival.last_synced_at)}</dd>
        </div>
        <div>
          <dt className="inline text-muted-foreground">Next check: </dt>
          <dd className="inline">{arrival.is_terminal ? "Not needed" : formatWhen(arrival.next_check_at)}</dd>
        </div>
        {arrival.expected_arrival_date ? (
          <div>
            <dt className="inline text-muted-foreground">Expected arrival: </dt>
            <dd className="inline">{arrival.expected_arrival_date}</dd>
          </div>
        ) : null}
        <div>
          <dt className="inline text-muted-foreground">Status emails: </dt>
          <dd className="inline">{arrival.email_updates ? "On" : "Off"}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center gap-2">
        {onRefresh && !arrival.is_terminal && arrival.is_active ? (
          <Button type="button" size="sm" variant="outline" onClick={onRefresh} disabled={refreshing}>
            <Clock className="mr-1 h-4 w-4" aria-hidden="true" />
            {refreshing ? "Checking…" : "Check now"}
          </Button>
        ) : null}
        {checkpoints.length > 0 ? (
          <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
            <CollapsibleTrigger asChild>
              <Button type="button" size="sm" variant="ghost" aria-expanded={historyOpen}>
                <ChevronDown className={cn("mr-1 h-4 w-4 transition-transform", historyOpen && "rotate-180")} aria-hidden="true" />
                {historyOpen ? "Hide history" : `Show history (${checkpoints.length})`}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ol className="mt-2 space-y-2 border-l pl-4">
                {checkpoints.map((c, i) => (
                  <li key={`${c.date}-${c.time}-${i}`} className="relative">
                    <span className="absolute -left-[1.3rem] top-1.5 h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                    <p>{c.activity}</p>
                    <p className="text-muted-foreground">
                      {[c.date, c.time].filter(Boolean).join(" ")} {c.location ? `· ${c.location}` : ""}
                    </p>
                  </li>
                ))}
              </ol>
            </CollapsibleContent>
          </Collapsible>
        ) : null}
      </div>
    </div>
  );
}

export default ShipmentStatus;
